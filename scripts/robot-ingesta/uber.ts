/**
 * ROBOT UBER EATS · Baja TODO lo que Uber deja descargar y lo deja en la bandeja.
 *
 * ENTRADA: sesión sembrada (cookies del navegador de Rubén en
 * sesiones/uber__streatlab.json). Uber bloquea el login automático desde servidores.
 * Si la sesión caduca: correo → "Más opciones" → CORREO ELECTRÓNICO → el código
 * llega a direccion@streatlab.com y se lee por IMAP (buzones_otp).
 *
 * REESCRITO plan-v2/T6 (16-jul-2026). Ya no depende de MODO para decidir qué
 * bajar: en CADA pasada (diario/semanal/mensual, lo que dispare el cron)
 * comprueba por fecha real de Madrid qué hay pendiente y lo reintenta con
 * robot_objetivos, igual que Glovo/Just Eat con las quincenas:
 *   1) INFORMES SEMANALES (/manager/reports): resumen de ganancias + detalle
 *      por artículo de la semana cerrada (lunes-domingo anterior).
 *   2) FACTURAS (/manager/invoices): Uber las emite el domingo ~02:00: se
 *      intenta lunes y martes (reintento si el lunes no había nada nuevo).
 *   3) RESUMEN MENSUAL POR MARCA (/manager/payments): desde el día 3 del mes,
 *      intenta bajar el resumen de CADA marca del mes cerrado.
 *
 * 18-jul: dos corridas pidieron el informe y a los ~6h la lista seguía sin
 * ninguna fila reconocida como "Disponible" → el selector de la fila lista no
 * casa con el DOM real. Ahora se vuelca SIEMPRE la lista (uber_lista_informes)
 * cuando no se reconoce nada, para leer el DOM real y clavar el selector.
 *
 * 19-jul: leído el DOM real (robot_debug/uber_lista_informes). El botón de
 * descarga de Uber es aria-label/texto "Descarga CSV" (no "Descargar archivo
 * CSV") y el de re-pedir es "Solicitar de nuevo". La lista tiene 3 páginas.
 * Se corrigen los selectores para que reconozcan el DOM real.
 *
 * Modos (env MODO): diario | semanal | mensual | backfill (MES=AAAA-MM).
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid, latido, objetivoPendiente, registrarIntento, marcarConseguido } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, capturar, descargarDeLaPagina } from './_lib/navegador.js';
import { semanaCerrada, mesCerrado, diaSemanaMadrid, diaMesMadrid } from './_lib/periodos.js';

const P = 'uber';
const RAIZ = 'https://merchants.ubereats.com';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

const RE_MAS = /m[aá]s opciones|otras opciones|otra forma|otro m[eé]todo|more options|try another way|enlace/i;
const RE_CORREO = /correo electr[oó]nico|email|e-mail/i;
const RE_SEGUIR = /^(continuar|siguiente|continue|next|acceder|iniciar sesi[oó]n|verificar)$/i;
const RE_DESCARGAR = /descargar|download/i;
const RE_DISPONIBLE = /disponible|available|listo|ready/i;
// 19-jul: el boton real de Uber es "Descarga CSV" (aria-label y texto).
const RE_DESC_CSV = /descarga(r)?\s*(archivo\s*)?csv|^\s*descargar\s*$/i;
// 19-jul: el boton real de re-pedir es "Solicitar de nuevo".
const RE_RESOLICITAR = /solicitar de nuevo|volver a solicitar|request again/i;

async function dentro(page: Page): Promise<boolean> {
  const u = page.url();
  return /merchants\.ubereats\.com/i.test(u) && !/auth\.uber\.com|\/login|\/signin/i.test(u);
}

async function seguir(page: Page) {
  const b = page.getByRole('button', { name: RE_SEGUIR }).first();
  if (await b.count().catch(() => 0)) await b.click({ timeout: 8000 }).catch(() => {});
  else await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(6000);
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  await page.goto(`${RAIZ}/manager/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(7000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión sembrada válida`); return true; }

  const email = page.locator('#PHONE_NUMBER_or_EMAIL_ADDRESS, input[type="email"], input[name="email"]').first();
  if (await email.count().catch(() => 0)) {
    await email.click({ timeout: 8000 }).catch(() => {});
    await email.type(c.usuario, { delay: 90 }).catch(() => {});
    const pedidoEn = new Date();
    await seguir(page);

    for (let i = 0; i < 3; i++) {
      if (await page.locator('input[autocomplete="one-time-code"], input[maxlength="1"]').count().catch(() => 0)) break;
      const mas = page.locator('button, a, [role="button"], span[tabindex]').filter({ hasText: RE_MAS }).first();
      if (await mas.count().catch(() => 0)) { await mas.click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(3000); }
      const correo = page.locator('button, a, li, label, div[role="button"], [role="radio"]').filter({ hasText: RE_CORREO }).first();
      if (await correo.count().catch(() => 0)) { await correo.click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500); await seguir(page); }
    }

    const codigo = await esperarCodigo(P, c.otp_remitente || 'uber.com', 240, pedidoEn, c.usuario);
    if (codigo) {
      const huecos = page.locator('input[autocomplete="one-time-code"], input[maxlength="1"], input[name*="code" i]');
      const n = await huecos.count().catch(() => 0);
      if (n >= codigo.length) for (let i = 0; i < codigo.length; i++) await huecos.nth(i).fill(codigo[i]).catch(() => {});
      else await huecos.first().type(codigo, { delay: 130 }).catch(() => {});
      await seguir(page);
    }
  }

  const ok = await dentro(page);
  await log(P, ok ? 'login_ok' : 'login_ko', `${c.cuenta} · url=${page.url()}`);
  if (!ok) await volcar(`${P}_login_ko`, await page.content().catch(() => ''));
  else await guardarSesion(P, c.cuenta, ctx);
  return ok;
}

/**
 * Baja TODAS las filas con estado Disponible de la página actual (hasta un tope).
 */
async function bajarFilasDisponibles(page: Page, tipo: string, periodo: string, destino: string, tope = 5): Promise<number> {
  const directos = page.locator('button[aria-label="Descarga CSV"], button[aria-label="Descargar"], a[aria-label="Descargar"], button[aria-label="Download"]')
    .or(page.getByRole('button', { name: RE_DESC_CSV }))
    .or(page.getByRole('link', { name: RE_DESC_CSV }))
    // 19-jul (DOM real): el boton final dice "Descarga CSV"; se mantiene "Descargar archivo CSV" por compatibilidad.
    .or(page.locator('button, a, [role="button"]').filter({ hasText: /descarga\s*csv|descargar archivo csv/i }));
  const nd = Math.min(await directos.count().catch(() => 0), tope);
  let bajadas = 0;
  for (let i = 0; i < nd; i++) {
    const f = await capturar(page, P, async () => { await directos.nth(i).click({ timeout: 6000 }).catch(() => {}); }, 90);
    if (f) {
      await entregar({ fuente: P, tipo, nombre: f.nombre, datos: f.datos, periodo, destino });
      await log(P, 'descarga', `${tipo}: ${f.nombre} (${f.datos.length} bytes)`);
      bajadas++;
    }
  }
  if (bajadas > 0) return bajadas;

  let filas = page.locator('tr, [role="row"]').filter({ has: page.locator('button, a, [role="button"]').filter({ hasText: RE_DESCARGAR }) });
  if (!(await filas.count().catch(() => 0))) filas = page.locator('tr, [role="row"]').filter({ hasText: RE_DISPONIBLE });
  const n = Math.min(await filas.count().catch(() => 0), tope);
  for (let i = 0; i < n; i++) {
    const fila = filas.nth(i);
    const f = await capturar(page, P, async () => {
      const directo = fila.getByRole('button', { name: RE_DESCARGAR }).first()
        .or(fila.locator('a[download], a[href*="download" i]').first());
      if (await directo.count().catch(() => 0)) { await directo.click({ timeout: 6000 }).catch(() => {}); return; }
      const accion = fila.locator('button, [role="button"]').last();
      if (await accion.count().catch(() => 0)) { await accion.click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500); }
      const desc = page.getByRole('menuitem', { name: RE_DESCARGAR }).first()
        .or(page.locator('li, a, button').filter({ hasText: RE_DESCARGAR }).first());
      if (await desc.count().catch(() => 0)) await desc.click({ timeout: 6000 }).catch(() => {});
    }, 90);
    if (f) {
      await entregar({ fuente: P, tipo, nombre: f.nombre, datos: f.datos, periodo, destino });
      await log(P, 'descarga', `${tipo}: ${f.nombre} (${f.datos.length} bytes)`);
      bajadas++;
    }
  }
  return bajadas;
}

async function bajarFilaDisponible(page: Page, tipo: string, periodo: string, destino: string): Promise<boolean> {
  return (await bajarFilasDisponibles(page, tipo, periodo, destino, 1)) > 0;
}

/**
 * 17-jul (receta de Ruben): crear un reporte desde cero en /manager/reports/create-report
 * cuando no hay nada que re-solicitar. Marca "Resumen de ganancias" y "Detalles de las
 * ganancias (nivel de articulo)", todas las tiendas, semana pasada, y pulsa "Crear un reporte".
 */
async function crearReporte(page: Page, periodo: string): Promise<boolean> {
  await page.goto(`${RAIZ}/manager/reports/create-report`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(6000);
  await quitarEstorbos(page);

  let marcados = 0;
  for (const t of [/resumen de ganancias/i, /detalles de las ganancias/i]) {
    const casilla = page.locator('label').filter({ hasText: t }).first().or(page.getByText(t).first());
    if (await casilla.count().catch(() => 0)) { await casilla.click({ timeout: 5000 }).catch(() => {}); marcados++; await page.waitForTimeout(600); }
  }
  if (!marcados) { await volcar('uber_crear_reporte', await page.content().catch(() => '')); return false; }

  const tiendas = page.locator('button, [role="button"], [role="combobox"]').filter({ hasText: /elegir restaurantes|choose restaurants/i }).first();
  if (await tiendas.count().catch(() => 0)) {
    await tiendas.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const panel = page.locator('[role="listbox"], [data-baseweb="popover"], [role="dialog"], [role="menu"]');
    const todas = panel.locator('label, [role="option"], li, button').filter({ hasText: /seleccionar todo|select all|todas las tiendas/i }).first();
    if (await todas.count().catch(() => 0)) await todas.click({ timeout: 4000 }).catch(() => {});
    else {
      const ops = panel.locator('[role="option"], li, label');
      const n = Math.min(await ops.count().catch(() => 0), 40);
      for (let i = 0; i < n; i++) await ops.nth(i).click({ timeout: 2500 }).catch(() => {});
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(800);
  }

  const fechas = page.locator('button, [role="button"], [role="combobox"], input').filter({ hasText: /intervalo de fechas|yyyy\/mm\/dd|date range/i }).first();
  if (await fechas.count().catch(() => 0)) {
    await fechas.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const preset = page.locator('[role="listbox"], [data-baseweb="popover"], [role="menu"], [role="dialog"]').locator('li, [role="option"], button, [role="menuitem"]')
      .filter({ hasText: /semana pasada|ultima semana|última semana|ultimos 7|últimos 7|last week/i }).first();
    if (await preset.count().catch(() => 0)) await preset.click({ timeout: 4000 }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(800);
  }

  const crear = page.getByRole('button', { name: /crear un reporte|create report/i }).last();
  if (!(await crear.count().catch(() => 0))) { await volcar('uber_crear_reporte', await page.content().catch(() => '')); return false; }
  await crear.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const toast = await page.getByText(/generando reportes|te enviaremos un correo/i).count().catch(() => 0);
  await log(P, toast ? 'solicitado' : 'aviso', `crear reporte (${periodo}): ${toast ? 'Uber confirmo la generacion' : 'sin confirmacion visible; DOM volcado'}`);
  if (!toast) await volcar('uber_crear_reporte_post', await page.content().catch(() => ''));
  await page.goto(`${RAIZ}/manager/reports`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(5000);
  return true;
}

/** INFORMES: pedir y volver cuando Uber los tenga listos. Devuelve si bajó algo. */
async function informes(page: Page, periodo: string): Promise<boolean> {
  await page.goto(`${RAIZ}/manager/reports`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(8000);
  await quitarEstorbos(page);

  if (await bajarFilaDisponible(page, 'uber_informe', periodo, 'ventas')) return true;

  // 18-jul DIAGNÓSTICO: si llegamos aquí habiendo pedido el informe en pasadas
  // anteriores, es que el selector de la fila lista no casa con el DOM real.
  // Se vuelca la lista para leerla en robot_debug y clavar el selector.
  await volcar('uber_lista_informes', await page.content().catch(() => ''));

  const RE_INFORMES_UTILES = /detalles del pago|payment details|resumen de pagos|pagos|payment summary|ganancias|earnings|historial de pedidos|order history/i;
  const filasUtiles = page.locator('tr, [role="row"]').filter({ hasText: RE_INFORMES_UTILES });
  const nUtiles = Math.min(await filasUtiles.count().catch(() => 0), 3);
  let pedidos = 0;
  for (let i = 0; i < nUtiles; i++) {
    const b = filasUtiles.nth(i).locator('button[aria-label="Solicitar de nuevo"], button, [role="button"]').filter({ hasText: RE_RESOLICITAR }).first();
    if (await b.count().catch(() => 0)) { await b.click({ timeout: 8000 }).catch(() => {}); pedidos++; await page.waitForTimeout(1500); }
  }
  if (!pedidos) {
    const rehacer = page.getByRole('button', { name: RE_RESOLICITAR }).first()
      .or(page.locator('button[aria-label="Solicitar de nuevo"], button, [role="button"]').filter({ hasText: RE_RESOLICITAR }).first());
    if (await rehacer.count().catch(() => 0)) {
      await rehacer.click({ timeout: 8000 }).catch(() => {});
      pedidos = 1;
    } else {
      if (!(await crearReporte(page, periodo))) {
        await volcar(`${P}_informes`, await page.content().catch(() => ''));
        await log(P, 'sin_descarga', 'informes: ni descarga, ni re-solicitar, ni pude crear el reporte (DOM volcado)');
        return false;
      }
      pedidos = 1;
    }
  }
  // 18-jul (Ruben: Uber tarda MINUTOS, no horas): reintentos cortos volviendo a
  // la lista y descargando, en vez de una espera bloqueante que agota el runner.
  // 8 vueltas x 45s = 6 min; si a los 6 min no esta, se deja pedido y la
  // siguiente pasada lo baja (ya estara "Disponible").
  await log(P, 'aviso', `${pedidos} informe(s) solicitados; reintento la descarga cada 45s durante ~6 min`);

  let bajadas = 0;
  for (let vuelta = 0; vuelta < 8; vuelta++) {
    await page.waitForTimeout(45000);
    await page.goto(`${RAIZ}/manager/reports`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(6000);
    await quitarEstorbos(page);
    bajadas += await bajarFilasDisponibles(page, 'uber_informe', periodo, 'ventas');
    if (bajadas >= pedidos) return true;
  }
  if (bajadas > 0) return true;
  // 18-jul DIAGNÓSTICO: volcado también al agotar los reintentos, con la lista tal cual quedó.
  await volcar('uber_lista_informes_fin', await page.content().catch(() => ''));
  await log(P, 'aviso', 'el informe seguía preparándose tras ~6 min; se bajará en la próxima pasada (ya quedó pedido)');
  return false;
}

async function seccionSimple(page: Page, ruta: string, tipo: string, periodo: string, destino: string): Promise<number> {
  await page.goto(`${RAIZ}${ruta}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(8000);
  await quitarEstorbos(page);
  if (await bajarFilaDisponible(page, tipo, periodo, destino)) return 1;
  const f = await descargarDeLaPagina(P, page, tipo);
  if (f) { await entregar({ fuente: P, tipo, nombre: f.nombre, datos: f.datos, periodo, destino }); return 1; }
  return 0;
}

/** Resumen mensual POR MARCA en /manager/payments/statements. */
async function resumenMensualPorMarca(page: Page, periodo: string, cuenta: string): Promise<{ bajadas: number; totalMarcas: number | null }> {
  await page.goto(`${RAIZ}/manager/payments/statements`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(8000);
  await quitarEstorbos(page);
  await volcar('uber_mapa_payments', await page.content().catch(() => ''));

  const [anio, mes] = periodo.split('-').map(Number);
  const finMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  const rangoTxt = `01/${mm}/${anio} – ${String(finMes).padStart(2, '0')}/${mm}/${anio}`;
  const campoFecha = page.locator('input[aria-label="Select a date range."]').first();
  if (await campoFecha.count().catch(() => 0)) {
    await campoFecha.click({ timeout: 6000 }).catch(() => {});
    await campoFecha.fill(rangoTxt).catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(4000);
  } else {
    await log(P, 'aviso', `mensual_${cuenta}: no veo el campo de rango de fechas; bajo el rango que este puesto`);
  }

  // En /statements hay UN boton "Descargar" por mes; el PRIMERO es el mes cerrado mas reciente.
  const controlDescargar = () => page.getByRole('button', { name: /^\s*Descargar\s*$/ }).first()
    .or(page.getByText('Descargar', { exact: true }).first())
    .or(page.locator('[role="button"], button', { hasText: /^\s*Descargar\s*$/ }).first())
    .or(page.locator('button[aria-label*="escarg" i], [role="button"][aria-label*="escarg" i], button[aria-label*="ownload" i]').first());

  let yaVolcado = false;
  const bajarActual = async (nombreMarca: string): Promise<number> => {
    const ctrl = controlDescargar();
    if (!(await ctrl.count().catch(() => 0))) {
      if (!yaVolcado) { yaVolcado = true; await volcar('uber_mapa_payments_marca', await page.content().catch(() => '')); }
      await log(P, 'sin_descarga', `mensual_${cuenta} · ${nombreMarca}: no veo el control Descargar`);
      return 0;
    }
    const f = await capturar(page, P, async () => {
      await ctrl.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1800);
      const opcion = page.getByRole('menuitem', { name: /csv|pdf/i }).first()
        .or(page.locator('[data-baseweb="popover"], [role="menu"], [role="listbox"]').locator('li, [role="option"], [role="menuitem"], button')
          .filter({ hasText: /csv|pdf|descargar|exportar/i })
          .filter({ hasNotText: /centro de informes|reports hub/i }).first());
      if (await opcion.count().catch(() => 0)) await opcion.click({ timeout: 5000 }).catch(() => {});
      else if (!yaVolcado) { yaVolcado = true; await volcar('uber_mapa_descarga', await page.content().catch(() => '')); }
    }, 90);
    if (!f) return 0;
    await entregar({ fuente: P, tipo: 'uber_resumen_pagos_mensual', nombre: `${nombreMarca}_${f.nombre}`, datos: f.datos, periodo, destino: 'ventas' });
    await log(P, 'descarga', `mensual_${cuenta} · ${nombreMarca}: ${f.nombre} (${f.datos.length} bytes)`);
    return 1;
  };

  const selectorMarca = page.locator('[data-testid="location-selector-button-testid"], [data-testid*="location-selector" i], [data-testid*="store-switcher" i]').first();
  if (!(await selectorMarca.count().catch(() => 0))) {
    const n = await bajarActual(cuenta);
    await log(P, n ? 'descarga' : 'sin_descarga', `mensual_${cuenta}: sin selector de marca, ${n} fichero(s) en una pasada`);
    return { bajadas: n, totalMarcas: null };
  }

  await selectorMarca.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const opciones = () => page.locator('[data-baseweb="popover"], [data-baseweb="menu"], [role="dialog"], [role="listbox"], [role="menu"]')
    .locator('[role="option"], [role="menuitem"], li, label, [data-testid*="option" i], [data-testid*="location" i] button');
  let totalMarcas = Math.min(await opciones().count().catch(() => 0), 20);
  if (!totalMarcas) {
    await volcar('uber_mapa_marcas', await page.content().catch(() => ''));
    await page.keyboard.press('Escape').catch(() => {});
    const n = await bajarActual(cuenta);
    await log(P, 'aviso', `mensual_${cuenta}: selector sin opciones legibles; ${n} fichero(s) de la marca visible`);
    return { bajadas: n, totalMarcas: null };
  }

  totalMarcas = Math.min(totalMarcas, 12);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(800);
  const refijarRango = async () => {
    const cf = page.locator('input[aria-label="Select a date range."]').first();
    if (await cf.count().catch(() => 0)) {
      await cf.click({ timeout: 6000 }).catch(() => {});
      await cf.fill(rangoTxt).catch(() => {});
      await page.keyboard.press('Enter').catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(3000);
    }
  };
  let bajadas = 0;
  for (let i = 0; i < totalMarcas; i++) {
    const sel = page.locator('[data-testid="location-selector-button-testid"], [data-testid*="location-selector" i]').first();
    await sel.click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1500);
    let opt = opciones().nth(i);
    if (!(await opt.count().catch(() => 0))) {
      await sel.click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(1500);
      opt = opciones().nth(i);
    }
    if (!(await opt.count().catch(() => 0))) { await page.keyboard.press('Escape').catch(() => {}); await log(P, 'aviso', `mensual_${cuenta}: el desplegable no reabre en la marca ${i}; paro aquí`); break; }
    const crudo = ((await opt.textContent().catch(() => '')) || `marca_${i}`).trim();
    const nombreMarca = (crudo.split(/calle|c\/|avda|avenida|[0-9a-f]{8}-/i)[0].trim() || `marca_${i}`).slice(0, 40);
    await opt.click({ timeout: 6000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);
    await page.goto(`${RAIZ}/manager/payments/statements`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(5000);
    await quitarEstorbos(page);
    await refijarRango();
    bajadas += await bajarActual(nombreMarca);
  }
  await log(P, 'descarga', `mensual_${cuenta}: ${bajadas}/${totalMarcas} marca(s) bajadas`);
  return { bajadas, totalMarcas };
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;

    if (MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES)) {
      await informes(page, MES);
      await seccionSimple(page, '/manager/payments/statements', 'uber_resumen_pagos', MES, 'ventas');
      await seccionSimple(page, '/manager/invoices', 'uber_factura', MES, 'facturas');
      return;
    }

    const sem = semanaCerrada();
    if (await objetivoPendiente(P, sem.periodo, 'informes_semanales')) {
      const huboDescarga = await informes(page, sem.periodo);
      if (huboDescarga) await marcarConseguido(P, sem.periodo, 'informes_semanales', `${c.cuenta}: descargado`);
      else await registrarIntento(P, sem.periodo, 'informes_semanales', `${c.cuenta}: aún sin "Disponible"`);
    }

    const diaSem = diaSemanaMadrid();
    if ((diaSem === 1 || diaSem === 2) && await objetivoPendiente(P, sem.periodo, 'facturas')) {
      const n = await seccionSimple(page, '/manager/invoices', 'uber_factura', sem.periodo, 'facturas');
      if (n > 0) await marcarConseguido(P, sem.periodo, 'facturas', `${c.cuenta}: ${n} fichero(s)`);
      else await registrarIntento(P, sem.periodo, 'facturas', `${c.cuenta}: 0 ficheros nuevos (día ${diaSem})`);
    }

    const mes = mesCerrado();
    if (diaMesMadrid() >= 3 && await objetivoPendiente(P, mes.periodo, 'facturas_mensual_marca')) {
      const { bajadas, totalMarcas } = await resumenMensualPorMarca(page, mes.periodo, c.cuenta);
      if (bajadas > 0 && (totalMarcas === null || bajadas >= totalMarcas)) {
        await marcarConseguido(P, mes.periodo, 'facturas_mensual_marca', `${c.cuenta}: ${bajadas}${totalMarcas ? `/${totalMarcas}` : ''} marca(s)`);
      } else {
        await registrarIntento(P, mes.periodo, 'facturas_mensual_marca', `${c.cuenta}: ${bajadas}${totalMarcas ? `/${totalMarcas}` : ''} marca(s)`);
      }
    }
  } catch (e: any) {
    await log(P, 'error', `${c.cuenta}: ${e?.message || e}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

async function main() {
  await log(P, 'inicio', `modo=${MODO}${MES ? ` mes=${MES}` : ''}`);
  const cuentas = await cuentasDe(P);
  if (cuentas.length === 0) { await log(P, 'sin_credenciales', 'no hay cuentas activas de Uber'); await latido(P, hoyMadrid(), 'sin credenciales'); return; }
  for (const c of cuentas) await trabajarCuenta(c);
  await log(P, 'fin', `${cuentas.length} cuenta(s)`);
  await latido(P, hoyMadrid(), `${cuentas.length} cuenta(s)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
