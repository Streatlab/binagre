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
 *      se espera a que Uber lo prepare ("Disponible"); si no da tiempo, la
 *      pasada siguiente ya lo encuentra listo.
 *   2) FACTURAS (/manager/invoices): Uber las emite el domingo ~02:00: se
 *      intenta lunes y martes (reintento si el lunes no había nada nuevo).
 *   3) RESUMEN MENSUAL POR MARCA (/manager/payments): desde el día 3 del mes,
 *      intenta bajar el resumen de CADA marca del mes cerrado. DECISIÓN
 *      AUTÓNOMA: no se ha podido inspeccionar /manager/payments en vivo desde
 *      esta sesión, así que el selector de marca se busca de forma genérica
 *      (patrones data-testid/role habituales) y SIEMPRE se vuelca el DOM a
 *      robot_debug (fuente=uber_mapa_payments) mientras el objetivo siga
 *      pendiente, para poder mapear los selectores reales a mano. Si no se
 *      detecta selector de marca, se intenta una descarga única y NO se marca
 *      conseguido — reintenta cada día hasta que alguien afine esta función.
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
  const filas = page.locator('tr, [role="row"]').filter({ hasText: RE_DISPONIBLE });
  const n = Math.min(await filas.count().catch(() => 0), tope);
  let bajadas = 0;
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

  // Nada listo: pedir de nuevo el último informe y esperar hasta 8 minutos
  const rehacer = page.getByRole('button', { name: /solicitar de nuevo|request again|crear informe|create report/i }).first()
    .or(page.locator('button, [role="button"]').filter({ hasText: /solicitar de nuevo|crear informe/i }).first());
  if (!(await rehacer.count().catch(() => 0))) {
    await volcar(`${P}_informes`, await page.content().catch(() => ''));
    await log(P, 'sin_descarga', 'informes: no encuentro ni descarga ni "solicitar de nuevo"');
    return false;
  }

  await rehacer.click({ timeout: 8000 }).catch(() => {});
  await log(P, 'aviso', 'informe solicitado; esperando a que Uber lo prepare');

  for (let vuelta = 0; vuelta < 8; vuelta++) {
    await page.waitForTimeout(60000);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(8000);
    if ((await bajarFilasDisponibles(page, 'uber_informe', periodo, 'ventas')) > 0) return true;
  }
  await log(P, 'aviso', 'el informe seguía preparándose; se bajará en la próxima pasada');
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
 * Resumen mensual POR MARCA en Pagos (/manager/payments). Sin selectores
 * confirmados en vivo (ver cabecera): busca un selector de marca/negocio con
 * patrones genéricos; si lo encuentra, baja el resumen de cada opción, si no,
 * un único intento. Siempre vuelca el DOM mientras el objetivo esté pendiente.
 */
async function resumenMensualPorMarca(page: Page, periodo: string, cuenta: string): Promise<{ bajadas: number; totalMarcas: number | null }> {
  await page.goto(`${RAIZ}/manager/payments`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(8000);
  await quitarEstorbos(page);
  await volcar('uber_mapa_payments', await page.content().catch(() => ''));

  const selectorMarca = page.locator(
    '[data-testid*="store-switcher" i], [data-testid*="store-select" i], [data-testid*="restaurant-switcher" i], [data-testid*="brand-switcher" i], [data-testid*="location-switcher" i]',
  ).first();

  if (!(await selectorMarca.count().catch(() => 0))) {
    // Sin selector detectado: una sola pasada (cuenta con 1 marca, o el
    // selector no encaja con los patrones probados — queda pendiente de mapeo).
    const n = await seccionSimple(page, '/manager/payments', 'uber_resumen_pagos_mensual', periodo, 'ventas');
    await log(P, n ? 'descarga' : 'sin_descarga', `mensual_${cuenta}: sin selector de marca detectado, ${n} fichero(s) en una pasada`);
    return { bajadas: n, totalMarcas: null };
  }

  await selectorMarca.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const opciones = page.locator('[role="option"], [role="menuitem"], li[data-testid*="option" i]');
  const totalMarcas = await opciones.count().catch(() => 0);
  if (!totalMarcas) {
    await log(P, 'aviso', `mensual_${cuenta}: selector de marca sin opciones legibles (DOM volcado en uber_mapa_payments)`);
    return { bajadas: 0, totalMarcas: null };
  }

  let bajadas = 0;
  for (let i = 0; i < totalMarcas; i++) {
    await selectorMarca.click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const opt = page.locator('[role="option"], [role="menuitem"], li[data-testid*="option" i]').nth(i);
    const nombreMarca = ((await opt.textContent().catch(() => '')) || `marca_${i}`).trim();
    await opt.click({ timeout: 6000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(4000);
    if (await bajarFilaDisponible(page, `uber_resumen_pagos_mensual_${nombreMarca}`, periodo, 'ventas')) bajadas++;
    else {
      const f = await descargarDeLaPagina(P, page, `uber_resumen_pagos_mensual_${nombreMarca}`);
      if (f) { await entregar({ fuente: P, tipo: 'uber_resumen_pagos_mensual', nombre: `${nombreMarca}_${f.nombre}`, datos: f.datos, periodo, destino: 'ventas' }); bajadas++; }
    }
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
      await seccionSimple(page, '/manager/payments', 'uber_resumen_pagos', MES, 'ventas');
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
