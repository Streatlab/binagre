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
 *      por artículo de la semana cerrada (lunes-domingo anterior). Se pide y
 *      se espera a que Uber lo prepare (\"Disponible\"); si no da tiempo, la
 *      pasada siguiente ya lo encuentra listo.
 *   2) FACTURAS (/manager/invoices): Uber las emite el domingo ~02:00: se
 *      intenta lunes y martes (reintento si el lunes no había nada nuevo).
 *   3) RESUMEN MENSUAL POR MARCA (/manager/payments): desde el día 3 del mes,
 *      intenta bajar el resumen de CADA marca del mes cerrado con los
 *      selectores reales mapeados el 16-jul (ver resumenMensualPorMarca).
 *
 * Modos (env MODO): diario | semanal | mensual | backfill (MES=AAAA-MM, se
 * salta toda la lógica de robot_objetivos y baja el mes pedido a mano).
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
 * Baja TODAS las filas con estado Disponible de la página actual (hasta un
 * tope), no solo la primera — la semana cerrada suele traer más de un informe
 * listo a la vez (resumen de ganancias + detalle por artículo). Un solo
 * recorrido, sin recargar entre descargas (evita reprocesar la misma fila).
 */
async function bajarFilasDisponibles(page: Page, tipo: string, periodo: string, destino: string, tope = 5): Promise<number> {
  // 16-jul (noche, fix con DOM volcado): en el centro de informes "Disponible" es el
  // nombre de la PESTANA, no aparece en las filas. Una fila lista para bajar se
  // reconoce porque su columna Accion trae un boton/enlace "Descargar". Se filtra
  // por eso; el filtro antiguo por "Disponible" queda de respaldo.
  // 17-jul (v3): las "filas" del centro de informes son DIVs, no <tr>/[role=row],
  // por eso ninguna pasada veia nada listo. Se pulsan directamente los botones
  // "Descargar" que haya en la pagina (aria-label o texto), sin buscar filas.
  const directos = page.locator('button[aria-label="Descargar"], a[aria-label="Descargar"], button[aria-label="Download"]')
    .or(page.getByRole('button', { name: /^\s*descargar\s*$/i }))
    .or(page.getByRole('link', { name: /^\s*descargar\s*$/i }));
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

/** Baja la primera fila con estado Disponible (menú de acción → Descargar). */
async function bajarFilaDisponible(page: Page, tipo: string, periodo: string, destino: string): Promise<boolean> {
  return (await bajarFilasDisponibles(page, tipo, periodo, destino, 1)) > 0;
}

/** INFORMES: pedir y volver cuando Uber los tenga listos. Devuelve si bajó algo. */
async function informes(page: Page, periodo: string): Promise<boolean> {
  await page.goto(`${RAIZ}/manager/reports`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(8000);
  await quitarEstorbos(page);

  if (await bajarFilaDisponible(page, 'uber_informe', periodo, 'ventas')) return true;

  // Nada listo: pedir de nuevo los informes QUE INTERESAN (resumen/detalle de pagos,
  // ganancias, historial de pedidos) y quedarse esperando en el MISMO run hasta 12
  // minutos (orden de Rubén 16-jul: Uber tarda ~10 min como mucho; no salir sin bajar).
  const RE_INFORMES_UTILES = /detalles del pago|payment details|resumen de pagos|pagos|payment summary|ganancias|earnings|historial de pedidos|order history/i;
  const filasUtiles = page.locator('tr, [role="row"]').filter({ hasText: RE_INFORMES_UTILES });
  const nUtiles = Math.min(await filasUtiles.count().catch(() => 0), 3);
  let pedidos = 0;
  for (let i = 0; i < nUtiles; i++) {
    const b = filasUtiles.nth(i).locator('button[aria-label="Solicitar de nuevo"], button, [role="button"]').filter({ hasText: /solicitar de nuevo|request again/i }).first();
    if (await b.count().catch(() => 0)) { await b.click({ timeout: 8000 }).catch(() => {}); pedidos++; await page.waitForTimeout(1500); }
  }
  if (!pedidos) {
    const rehacer = page.getByRole('button', { name: /solicitar de nuevo|request again|crear informe|create report/i }).first()
      .or(page.locator('button, [role="button"]').filter({ hasText: /solicitar de nuevo|crear informe/i }).first());
    if (!(await rehacer.count().catch(() => 0))) {
      await volcar(`${P}_informes`, await page.content().catch(() => ''));
      await log(P, 'sin_descarga', 'informes: no encuentro ni descarga ni "solicitar de nuevo"');
      return false;
    }
    await rehacer.click({ timeout: 8000 }).catch(() => {});
    pedidos = 1;
  }
  await log(P, 'aviso', `${pedidos} informe(s) solicitados; espero en este mismo run a que Uber los prepare (tope 12 min)`);

  let bajadas = 0;
  for (let vuelta = 0; vuelta < 12; vuelta++) {
    await page.waitForTimeout(60000);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(8000);
    bajadas += await bajarFilasDisponibles(page, 'uber_informe', periodo, 'ventas');
    if (bajadas >= pedidos) return true;   // todos los pedidos bajados: no seguir esperando
  }
  if (bajadas > 0) return true;
  await log(P, 'aviso', 'el informe seguía preparándose tras 12 min; se bajará en la próxima pasada');
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

/**
 * Resumen mensual POR MARCA en Pagos (/manager/payments), con los selectores
 * reales mapeados el 16-jul (uber_mapa_payments).
 */
async function resumenMensualPorMarca(page: Page, periodo: string, cuenta: string): Promise<{ bajadas: number; totalMarcas: number | null }> {
  // 16-jul (noche, fix con DOM volcado uber_mapa_payments): la pagina real de
  // "Resumenes de pagos" tiene:
  //   - selector de MARCA: [data-testid="location-selector-button-testid"] (p. ej. "Binagre")
  //   - rango de fechas: input[aria-label="Select a date range."] (dd/mm/yyyy - dd/mm/yyyy, se puede teclear)
  //   - descarga: un div[role="button"] con el texto "Descargar" (icono de nube), NO un <button>
  // 17-jul (captura de Ruben): la pantalla simple es /manager/payments/statements
  // ("Ganancias > Resumenes"): tabla mensual con boton "Descargar" por fila y
  // selector de tienda arriba. Sin nube, sin rango que teclear.
  await page.goto(`${RAIZ}/manager/payments/statements`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(8000);
  await quitarEstorbos(page);
  await volcar('uber_mapa_payments', await page.content().catch(() => ''));

  // Rango = mes cerrado (periodo AAAA-MM) tecleado en el date-picker
  const [anio, mes] = periodo.split('-').map(Number);
  const finMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  const rangoTxt = `01/${mm}/${anio} \u2013 ${String(finMes).padStart(2, '0')}/${mm}/${anio}`;
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

  // 17-jul (captura de Ruben): en /statements hay UN boton "Descargar" por mes;
  // el PRIMERO de la tabla es el mes cerrado mas reciente -> first(), no last().
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
      // Si sale menu de formato (CSV/PDF), elegir la primera opcion
      // OJO: "Descargar en el centro de informes" NAVEGA, no descarga -> excluirlo.
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
    // volcar el desplegable abierto para mapearlo a mano en la siguiente pasada
    await volcar('uber_mapa_marcas', await page.content().catch(() => ''));
    await page.keyboard.press('Escape').catch(() => {});
    const n = await bajarActual(cuenta);
    await log(P, 'aviso', `mensual_${cuenta}: selector sin opciones legibles; ${n} fichero(s) de la marca visible (DOM en uber_mapa_payments)`);
    return { bajadas: n, totalMarcas: null };
  }

  // 17-jul (v3): al elegir una marca en el selector, Uber NAVEGA a la vista de esa
  // marca y el toolbar con "Descargar" desaparece -> tras cada seleccion hay que
  // VOLVER a /manager/payments/statements, refijar el rango y entonces descargar.
  totalMarcas = Math.min(totalMarcas, 12);
  // 17-jul (v4, run 19:58 "0/12 en 45s"): el desplegable quedaba ABIERTO tras contar
  // las marcas; el primer click del bucle lo cerraba, la opcion 0 no aparecia y el
  // bucle rompia a la primera. Cerrarlo aqui y reabrir con reintento dentro del bucle.
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
      // el click anterior pudo cerrar un desplegable ya abierto: reintentar una vez
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
    // volver a la vista de pagos de ESTA marca
    // 17-jul (captura de Ruben): la pantalla simple es /manager/payments/statements
  // ("Ganancias > Resumenes"): tabla mensual con boton "Descargar" por fila y
  // selector de tienda arriba. Sin nube, sin rango que teclear.
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
      // Backfill explícito: baja todo lo del mes pedido, sin tocar robot_objetivos.
      await informes(page, MES);
      await seccionSimple(page, '/manager/payments/statements', 'uber_resumen_pagos', MES, 'ventas');
      await seccionSimple(page, '/manager/invoices', 'uber_factura', MES, 'facturas');
      return;
    }

    // 1) Informes semanales (resumen + detalle de ganancias) de la semana cerrada.
    const sem = semanaCerrada();
    if (await objetivoPendiente(P, sem.periodo, 'informes_semanales')) {
      const huboDescarga = await informes(page, sem.periodo);
      if (huboDescarga) await marcarConseguido(P, sem.periodo, 'informes_semanales', `${c.cuenta}: descargado`);
      else await registrarIntento(P, sem.periodo, 'informes_semanales', `${c.cuenta}: aún sin "Disponible"`);
    }

    // 2) Facturas: Uber las emite domingo ~02:00 → se intenta lunes y martes.
    const diaSem = diaSemanaMadrid();
    if ((diaSem === 1 || diaSem === 2) && await objetivoPendiente(P, sem.periodo, 'facturas')) {
      const n = await seccionSimple(page, '/manager/invoices', 'uber_factura', sem.periodo, 'facturas');
      if (n > 0) await marcarConseguido(P, sem.periodo, 'facturas', `${c.cuenta}: ${n} fichero(s)`);
      else await registrarIntento(P, sem.periodo, 'facturas', `${c.cuenta}: 0 ficheros nuevos (día ${diaSem})`);
    }

    // 3) Resumen mensual por marca, desde el día 3 del mes cerrado.
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
