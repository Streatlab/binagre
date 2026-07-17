/**
 * ROBOT GLOVO · Descarga los informes del portal de comercio y los deja en la bandeja.
 * Dos cuentas (posmodernos y streatlab). Entra solo: sesión guardada + código por
 * correo (IMAP del buzón de la cuenta) si hace falta.
 *
 * 15-jul-2026 · RUTAS REALES (confirmadas por Rubén con capturas):
 *   portal.glovoapp.com/reports  → Rendimiento: pestañas Ventas / Operaciones / Clientes
 *   portal.glovoapp.com/orders   → Historial de pedidos ("Descargar informe")
 *   portal.glovoapp.com/finance  → "Pagos" (última opción del sidebar): facturas + liquidaciones
 *
 * 15-jul-2026 (noche) · VUELTA AL BOTÓN REAL:
 *   La vía "API interna por dentro de la página" (page.evaluate + fetch) murió con -1:
 *   el navegador corta la llamada cross-origin (CORS) y por fuera PerimeterX devuelve
 *   403/401. Decisión del handoff: dejar de pelear el captcha y pulsar el botón del
 *   portal, que hace su propia petición firmada. La captura va con capturar() de
 *   _lib/navegador (waitForEvent('download') + confirma diálogos + "mantén pulsado").
 *   OJO: _lib/capturar-export.js NO EXISTE en el repo; importarlo tumbaba el robot al
 *   arrancar (ERR_MODULE_NOT_FOUND). No reintroducir ese import.
 *
 * 16-jul-2026 · RUN REAL: streatlab bajó TODO, posmodernos solo finanzas.
 *   1er intento de fix: se pensó que era el selector de tienda sin cerrar. FALSO.
 *   Causa real (DOM volcado, revisado a fondo): en posmodernos apareció el candado
 *   PerimeterX "mantén pulsado para confirmar que eres un ser humano" ANTES de buscar
 *   el botón "Descargar" — y ese candado solo se vigilaba dentro de capturar() (mientras
 *   se espera la descarga), nunca nada más cargar la página. Por eso "no veo el botón
 *   Descargar": la página entera estaba tapada por el diálogo del candado.
 *   Además: la tienda única de posmodernos YA sale marcada `data-selected="true"` de
 *   fábrica — no hace falta (ni hay que forzar) ningún clic para elegirla.
 *   Fix: 1) resolverCandado() se llama nada más cargar cada página (reports/orders/
 *   finance), antes de buscar cualquier botón. 2) verNegocio ya no fuerza clic en la
 *   tienda si ya está seleccionada; solo agrega con "Ver negocio"/"Ver marca" cuando
 *   hay varias tiendas y ninguna está ya marcada como vista agregada.
 *
 * Flujo real del portal (capturas de Rubén):
 *   1) Cuenta con 1 tienda (posmodernos) → ya viene seleccionada, no tocar.
 *      Cuenta con varias tiendas (streatlab, 8) → abrir selector y pulsar "Ver negocio"/"Ver marca".
 *   2) "Descargar informe" abre un MODAL de formato (.csv / .xls) → elegir .csv y
 *      confirmar el botón verde DENTRO del modal.
 *   3) FACTURAS: portal.glovoapp.com/finance (menú "Pagos"): "Descargar todo" +
 *      icono de descarga por fila (PDF individual). Sin captcha.
 *
 * Modos (env MODO): diario | semanal | backfill (MES=AAAA-MM)
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid, latido, objetivoPendiente, registrarIntento, marcarConseguido } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, capturar, mantenPulsado } from './_lib/navegador.js';
import { quincenaCerrada } from './_lib/periodos.js';

const P = 'glovo';
const PORTAL = 'https://portal.glovoapp.com';
const MANAGERS = 'https://managers.glovoapp.com';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

async function dentro(page: Page): Promise<boolean> {
  let ruta = '';
  try { ruta = new URL(page.url()).pathname; } catch { ruta = page.url(); }
  if (/\/(login|signin|sign-in|2fa|otp|verify|verificacion)/i.test(ruta)) return false;
  if (await page.locator('input[type="password"]').count().catch(() => 0)) return false;
  return true;
}

async function escribirCodigo(page: Page, codigo: string): Promise<boolean> {
  const huecos = page.locator('input[autocomplete="one-time-code"], input[maxlength="1"], input[type="tel"], input[name*="code" i], input[id*="otp" i], input[type="number"]');
  const n = await huecos.count().catch(() => 0);
  if (n === 0) return false;
  if (n >= codigo.length) {
    for (let i = 0; i < codigo.length; i++) { await huecos.nth(i).click({ timeout: 4000 }).catch(() => {}); await huecos.nth(i).fill(codigo[i]).catch(() => {}); await page.waitForTimeout(200); }
  } else { await huecos.first().click({ timeout: 5000 }).catch(() => {}); await huecos.first().type(codigo, { delay: 150 }).catch(() => {}); }
  await page.waitForTimeout(1500);
  const b = page.getByRole('button', { name: /verificar|confirmar|continuar|acceder|entrar|verify|submit|enviar/i }).first();
  if (await b.count().catch(() => 0)) await b.click({ timeout: 8000 }).catch(() => {});
  else await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(10000);
  return true;
}

async function entrar(page: Page, ctx: BrowserContext, c: Cuenta): Promise<boolean> {
  await page.goto(c.url_base || MANAGERS, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(5000);
  await quitarEstorbos(page);
  if (await dentro(page)) { await log(P, 'sesion_ok', `${c.cuenta}: sesión guardada todavía válida`); return true; }

  const email = page.locator('input[type="email"], input[name="email"], input[id*="email" i], input[name="username"]').first();
  await email.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await email.fill(c.usuario).catch(() => {});
  await page.locator('input[type="password"]').first().fill(c.password).catch(() => {});

  const pedidoEn = new Date();
  await page.getByRole('button', { name: /entrar|log ?in|iniciar|continuar|sign in/i }).first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);

  if (!(await dentro(page))) {
    const codigo = await esperarCodigo(P, c.otp_remitente || 'glovoapp.com', 240, pedidoEn, c.usuario);
    if (!codigo) { await log(P, 'login_ko', `${c.cuenta}: no llegó el código`); return false; }
    if (!(await escribirCodigo(page, codigo))) { await log(P, 'login_ko', `${c.cuenta}: no encuentro dónde escribir el código`); return false; }
    await quitarEstorbos(page);
  }

  const ok = await dentro(page);
  await log(P, ok ? 'login_ok' : 'login_ko', `${c.cuenta} · url=${page.url()}`);
  if (ok) await guardarSesion(P, c.cuenta, ctx);
  return ok;
}

/**
 * Resuelve el candado PerimeterX ("mantén pulsado para confirmar que eres un ser humano")
 * si aparece nada más cargar la página. Antes solo se vigilaba dentro de capturar()
 * mientras se esperaba una descarga; si salía ANTES (p. ej. justo tras el goto), tapaba
 * toda la página y ni el botón "Descargar" ni el selector de tienda se veían.
 */
async function resolverCandado(page: Page, paso: string): Promise<void> {
  const hay = await page.getByText(/mant[eé]n pulsado|press ?(&|and) ?hold/i).count().catch(() => 0);
  if (!hay) return;
  await log(P, 'candado_previo', `${paso}: candado antes de buscar botones`);
  await mantenPulsado(page, P);
  await page.waitForTimeout(2000);
}

/**
 * El portal filtra por establecimiento. Si la cuenta tiene UNA sola tienda (posmodernos),
 * esa tienda YA sale seleccionada por defecto (`data-selected="true"`) → no hace falta
 * ningún clic. Si tiene varias (streatlab, 8), pulsar "Ver negocio"/"Ver marca" para
 * agregarlas todas. Ya no fuerza clics contra elementos que no son un modal bloqueante.
 */
async function verNegocio(page: Page, paso: string): Promise<void> {
  try {
    const itemsTienda = page.locator('[data-testid="store-select-list-item"]');
    const abridor = page.locator('[data-testid="brand-view-selection"]').first()
      .or(page.getByRole('button', { name: /todos los establecimientos|establecimientos|establishments/i }).first());
    if (await abridor.count().catch(() => 0)) {
      await abridor.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }

    const nTiendas = await itemsTienda.count().catch(() => 0);
    if (nTiendas === 0) {
      await log(P, 'negocio', `${paso}: sin selector de tienda; sigo con la vista actual`);
      return;
    }
    if (nTiendas === 1) {
      const yaElegida = (await itemsTienda.first().getAttribute('data-selected').catch(() => null)) === 'true';
      if (!yaElegida) await itemsTienda.first().click({ timeout: 6000 }).catch(() => {});
      await log(P, 'negocio', `${paso}: 1 sola tienda (${yaElegida ? 'ya venía seleccionada' : 'elegida ahora'})`);
      return;
    }
    // Varias tiendas: agregar todas con "Ver negocio" / "Ver marca".
    const chip = page.locator('[data-testid="chain-select-button"]').first();
    const yaAgregada = (await chip.getAttribute('data-selected').catch(() => null)) === 'true';
    if (yaAgregada) { await log(P, 'negocio', `${paso}: ya en vista agregada (todas las tiendas)`); return; }
    const candidatos = [chip, page.getByRole('button', { name: /ver negocio|ver marca|view business/i }).first(), page.getByText(/ver negocio|ver marca|view business/i).first()];
    for (const c of candidatos) {
      if (await c.count().catch(() => 0)) { await c.click({ timeout: 6000 }).catch(() => {}); break; }
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(4000);
    await log(P, 'negocio', `${paso}: "Ver negocio"/"Ver marca" (todas las tiendas)`);
  } catch { /* seguimos: bajarDescargar volcará el DOM si no aparece el botón */ }
}

/** Rango de fechas para la URL de los informes (from/to = AAAA-MM-DD). */
function rango(): { from: string; to: string } {
  if (MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES)) {
    const [a, m] = MES.split('-').map(Number);
    const from = `${MES}-01`;
    const fin = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return { from, to: `${MES}-${String(fin).padStart(2, '0')}` };
  }
  return { from: hoyMadrid(7), to: hoyMadrid(1) };   // últimos 7 días cerrados
}

/**
 * Pulsa "Descargar informe" y captura el fichero con capturar() (navegador):
 * waitForEvent('download') + auto-confirma diálogos + "mantén pulsado" si salta el candado.
 * Si aparece el modal de formato (.csv / .xls), elige .csv y confirma DENTRO del modal.
 */
async function bajarDescargar(page: Page, paso: string): Promise<{ nombre: string; datos: Buffer } | null> {
  await resolverCandado(page, paso);
  const boton = page.getByRole('button', { name: /descargar( informe)?/i }).first()
    .or(page.locator('button, a, [role="button"]').filter({ hasText: /descargar( informe)?/i }).first());
  if (!(await boton.count().catch(() => 0))) {
    await resolverCandado(page, paso);
    if (!(await boton.count().catch(() => 0))) {
      await volcar(`${P}_${paso}`, await page.content().catch(() => ''));
      await log(P, 'sin_descarga', `${paso}: no veo el botón Descargar (HTML volcado)`);
      return null;
    }
  }
  const f = await capturar(page, P, async () => {
    await boton.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1800);
    // Modal de formato: "Formato del informe" con .csv / .xls → elegir .csv y confirmar
    const dlg = page.locator('[role="dialog"], .modal, [class*="modal" i]')
      .filter({ hasText: /formato del informe|descargar informe|archivo \.?csv/i }).first();
    if (await dlg.count().catch(() => 0)) {
      const csv = dlg.getByText(/archivo\s*\.?csv/i).first()
        .or(dlg.locator('input[type="radio"]').first());
      await csv.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(400);
      const conf = dlg.getByRole('button', { name: /descargar( informe)?/i }).last()
        .or(dlg.locator('button').filter({ hasText: /descargar/i }).last());
      await conf.click({ timeout: 8000 }).catch(() => {});
    }
  }, 120);
  if (!f) {
    await volcar(`${P}_${paso}`, await page.content().catch(() => ''));
    await log(P, 'sin_descarga', `${paso}: el export no soltó fichero (HTML volcado)`);
    return null;
  }
  await log(P, 'descarga', `${paso}: ${f.nombre} (${f.datos.length} bytes)`);
  return f;
}

/**
 * 16-jul (noche, fix real con el DOM volcado): en /reports YA NO existe un boton
 * "Descargar informe" global. Cada bloque del informe lleva su propio boton de
 * exportar con data-testid="<bloque>-report-export-button":
 *   - Ventas: performance_report, weekly_turnover
 *   - Operaciones: prep_time, order_rejections, offline_duration, contact_rate,
 *     orders_marked_as_ready
 * Se pulsan TODOS los del tab activo y se entrega cada fichero por separado.
 */
async function bajarExportsBloques(page: Page, paso: string, tipo: string, periodo: string, cuenta: string): Promise<number> {
  await resolverCandado(page, paso);
  // 17-jul (captura de Ruben): los botones de export ahora pueden ser SOLO un
  // icono de flecha, sin texto. Se aceptan por data-testid, aria-label, title
  // o clase que huela a descarga/export.
  const botones = page.locator([
    'button[data-testid$="-report-export-button"]',
    'button[data-testid*="export"]',
    'button[data-testid*="download"]',
    'button[aria-label*="escargar" i]',
    'button[aria-label*="ownload" i]',
    'button[aria-label*="xport" i]',
    'button[title*="escargar" i]',
    'button[class*="download" i]',
  ].join(', '));
  const n = await botones.count().catch(() => 0);
  if (!n) return 0;
  let bajados = 0;
  for (let i = 0; i < n; i++) {
    const btn = botones.nth(i);
    const testid = (await btn.getAttribute('data-testid').catch(() => '')) || `bloque_${i}`;
    const bloque = testid.replace(/-report-export-button$/, '');
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    const f = await capturar(page, P, async () => {
      await btn.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1500);
      // 17-jul (captura de Ruben): el modal "Selecciona un formato para tu
      // informe" pide DOS pasos: marcar el radio "Exportar en CSV" y despues
      // pulsar el boton "Exportar informe". El clic final es el que descarga.
      const dlg = page.locator('[role="dialog"], .modal, [class*="modal" i]').last();
      if (await dlg.count().catch(() => 0) && await dlg.isVisible().catch(() => false)) {
        const radio = dlg.locator('label, [role="radio"], input[type="radio"] + label')
          .filter({ hasText: /csv/i }).first()
          .or(dlg.getByText(/exportar en csv/i).first());
        if (await radio.count().catch(() => 0)) await radio.click({ timeout: 4000 }).catch(() => {});
        const confirmar = dlg.locator('button').filter({ hasText: /exportar|descargar|confirmar/i }).last();
        if (await confirmar.count().catch(() => 0)) await confirmar.click({ timeout: 5000 }).catch(() => {});
      } else {
        // Menu antiguo de un solo paso, por si Glovo lo mantiene en alguna cuenta
        const opcion = page.getByRole('menuitem', { name: /csv/i }).first()
          .or(page.locator('[role="menu"]').locator('li, [role="menuitem"]').filter({ hasText: /csv/i }).first());
        if (await opcion.count().catch(() => 0)) await opcion.click({ timeout: 5000 }).catch(() => {});
      }
    }, 60);
    if (f) {
      await entregar({ fuente: P, tipo, nombre: `${cuenta}_${bloque}_${f.nombre}`, datos: f.datos, periodo, destino: 'ventas' });
      await log(P, 'descarga', `${paso} · ${bloque}: ${f.nombre} (${f.datos.length} bytes)`);
      bajados++;
    } else {
      await log(P, 'sin_descarga', `${paso} · ${bloque}: el export no solto fichero`);
    }
  }
  return bajados;
}

/** Rendimiento: pestañas Ventas y Operaciones (Clientes lo dejamos para CRM más adelante). */
async function rendimiento(page: Page, periodo: string, cuenta: string, from: string, to: string) {
  await page.goto(`${PORTAL}/reports?from=${from}&to=${to}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);
  await resolverCandado(page, `ventas_${cuenta}`);
  await verNegocio(page, `ventas_${cuenta}`);   // todas las tiendas → informe completo

  for (const [nombreTab, tipo] of [['Ventas', 'glovo_ventas'], ['Operaciones', 'glovo_operaciones']] as const) {
    const tab = page.getByRole('tab', { name: new RegExp(`^${nombreTab}$`, 'i') }).first()
      .or(page.locator('[role="tab"], button, a').filter({ hasText: new RegExp(`^${nombreTab}$`, 'i') }).first());
    if (await tab.count().catch(() => 0)) {
      await tab.click({ timeout: 6000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(5000);
    }
    const bajados = await bajarExportsBloques(page, `${tipo}_${cuenta}`, tipo, periodo, cuenta);
    if (bajados === 0) {
      // Fallback al boton global antiguo por si Glovo vuelve a cambiar la pantalla
      const f = await bajarDescargar(page, `${tipo}_${cuenta}`);
      if (f) await entregar({ fuente: P, tipo, nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'ventas' });
    }
  }
}

/** Historial de pedidos: cada pedido con estado, marca, reclamaciones y subtotal. */
async function historial(page: Page, periodo: string, cuenta: string, from: string, to: string) {
  await page.goto(`${PORTAL}/orders?from=${from}&to=${to}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);
  await resolverCandado(page, `historial_${cuenta}`);
  await verNegocio(page, `historial_${cuenta}`);   // todas las tiendas → informe completo
  const f = await bajarDescargar(page, `historial_${cuenta}`);
  if (f) await entregar({ fuente: P, tipo: 'glovo_historial', nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'ventas' });
}

/**
 * FACTURAS + LIQUIDACIONES · página "Pagos" = portal.glovoapp.com/finance (última opción
 * del sidebar). Sin captcha y ya con los 8 establecimientos. Bajamos con "Descargar todo"
 * (paquete del rango) y con el icono de descarga de cada fila (PDF individual → Conciliación).
 */
async function finanzas(page: Page, periodo: string, cuenta: string): Promise<number> {
  await page.goto(`${PORTAL}/finance`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);
  await resolverCandado(page, `finanzas_${cuenta}`);

  // Rango por los chips de la propia página: semanal → 7 días; resto → 30 días (cubre la quincena)
  const preset = MODO === 'semanal' ? /últimos 7 días|ultimos 7 dias/i : /últimos 30 días|ultimos 30 dias/i;
  const chip = page.getByRole('button', { name: preset }).first()
    .or(page.locator('button, [role="button"]').filter({ hasText: preset }).first());
  if (await chip.count().catch(() => 0)) {
    await chip.click({ timeout: 6000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(4000);
  }

  let bajados = 0;

  // 1) "Descargar todo": un clic, todo el rango
  const todo = page.getByRole('button', { name: /descargar todo/i }).first()
    .or(page.locator('button, a, [role="button"]').filter({ hasText: /descargar todo/i }).first());
  if (await todo.count().catch(() => 0)) {
    const f = await capturar(page, P, async () => { await todo.click({ timeout: 10000 }).catch(() => {}); }, 120);
    if (f) {
      await entregar({ fuente: P, tipo: 'glovo_finanzas', nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'facturas' });
      bajados++;
      await log(P, 'descarga', `finanzas_todo_${cuenta}: ${f.nombre} (${f.datos.length} bytes)`);
    } else {
      await log(P, 'sin_descarga', `finanzas_todo_${cuenta}: "Descargar todo" no soltó fichero`);
    }
  }

  // 2) Icono de descarga por fila: PDF individual de cada factura / pago
  const iconos = page.locator('button[aria-label*="descarg" i], a[aria-label*="descarg" i], [data-testid*="download" i]');
  const n = Math.min(await iconos.count().catch(() => 0), 40);
  for (let i = 0; i < n; i++) {
    const f = await capturar(page, P, async () => { await iconos.nth(i).click({ timeout: 8000 }).catch(() => {}); }, 20);
    if (f) {
      await entregar({ fuente: P, tipo: 'glovo_finanzas', nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'facturas' });
      bajados++;
    }
    await page.waitForTimeout(600);
  }

  if (!bajados) {
    await volcar(`${P}_finanzas_${cuenta}`, await page.content().catch(() => ''));
    await log(P, 'sin_descarga', `finanzas_${cuenta}: sin ficheros (HTML volcado para ver los botones reales)`);
  } else {
    await log(P, 'descarga', `finanzas_${cuenta}: ${bajados} fichero(s)`);
  }
  return bajados;
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;
    const { from, to } = rango();
    const periodo = MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES) ? MES : hoyMadrid(1);

    // plan-v2/T5: diario baja SOLO historial; ventas+operaciones (rendimiento)
    // quedan para semanal/mensual/backfill. Facturas (antes "finanzas" aquí)
    // pasan a T6, con su propia lógica de insistencia por quincena.
    if (MODO !== 'diario') await rendimiento(page, periodo, c.cuenta, from, to);   // Ventas + Operaciones
    await historial(page, periodo, c.cuenta, from, to);     // Historial de pedidos

    // plan-v2/T6: facturas por quincena con insistencia — cada pasada comprueba
    // si la quincena cerrada más reciente ya está conseguida; si no, reintenta.
    // El backfill explícito (MES a mano) no toca robot_objetivos.
    if (MODO !== 'backfill') {
      const q = quincenaCerrada();
      if (await objetivoPendiente(P, q.periodo, 'facturas')) {
        const n = await finanzas(page, q.periodo, c.cuenta);
        if (n > 0) await marcarConseguido(P, q.periodo, 'facturas', `${c.cuenta}: ${n} fichero(s)`);
        else await registrarIntento(P, q.periodo, 'facturas', `${c.cuenta}: 0 ficheros nuevos`);
      } else {
        await log(P, 'facturas_ok', `quincena ${q.periodo} ya conseguida, no repito`);
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
  if (cuentas.length === 0) { await log(P, 'sin_credenciales', 'no hay cuentas activas de Glovo'); await latido(P, hoyMadrid(), 'sin credenciales'); return; }
  for (const c of cuentas) await trabajarCuenta(c);
  await log(P, 'fin', `${cuentas.length} cuenta(s)`);
  await latido(P, hoyMadrid(), `${cuentas.length} cuenta(s)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
