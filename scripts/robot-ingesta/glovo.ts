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
 * 16-jul-2026 · RUN REAL: streatlab bajó TODO (ventas+operaciones+historial+9 finanzas)
 *   y posmodernos solo finanzas. Causa (DOM volcado): en posmodernos el clic a
 *   "Ver negocio" no cerró el selector de tienda (seguían store-select-list-item /
 *   chain-select-button en el DOM) → sin tienda elegida no se renderiza "Descargar".
 *   Fix: verNegocio ahora VERIFICA que el selector se cierra y reintenta hasta 3 veces;
 *   último recurso: elegir la 1ª tienda (datos parciales, mejor que nada).
 *
 * Flujo real del portal (capturas de Rubén):
 *   1) Abrir el selector de establecimientos y pulsar "Ver negocio" → coge las 8 tiendas.
 *   2) "Descargar informe" abre un MODAL de formato (.csv / .xls) → elegir .csv y
 *      confirmar el botón verde DENTRO del modal.
 *   3) FACTURAS: portal.glovoapp.com/finance (menú "Pagos"): "Descargar todo" +
 *      icono de descarga por fila (PDF individual). Sin captcha.
 *
 * Modos (env MODO): diario | semanal | backfill (MES=AAAA-MM)
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos, capturar } from './_lib/navegador.js';

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
 * El portal filtra por establecimiento. Abre el selector y pulsa "Ver negocio" para que
 * el informe cubra TODAS las tiendas (8). Una tienda suelta daría datos parciales.
 * VERIFICA que el selector se cierra de verdad (en posmodernos el primer clic no cerraba
 * y sin tienda elegida no se renderiza "Descargar"). Reintenta hasta 3 veces; último
 * recurso: elegir la 1ª tienda.
 */
async function verNegocio(page: Page, paso: string): Promise<void> {
  try {
    const enSelector = async () =>
      (await page.locator('[data-testid="store-select-list-item"], [data-testid="chain-select-button"]').count().catch(() => 0)) > 0;

    for (let intento = 1; intento <= 3; intento++) {
      const abridor = page.locator('[data-testid="brand-view-selection"]').first()
        .or(page.getByRole('button', { name: /todos los establecimientos|establecimientos|establishments/i }).first());
      if (!(await enSelector()) && (await abridor.count().catch(() => 0))) {
        await abridor.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1500);
      }
      if (!(await enSelector())) {
        if (intento === 1) await log(P, 'negocio', `${paso}: sin selector de tienda; sigo con la vista actual`);
        return;
      }
      // Preferimos el botón exacto del portal; luego el texto; último recurso: la 1ª tienda
      const candidatos = [
        page.locator('[data-testid="chain-select-button"]').first(),
        page.getByRole('button', { name: /ver negocio|view business/i }).first(),
        page.getByText(/ver negocio|view business/i).first(),
      ];
      let pulsado = false;
      for (const c of candidatos) {
        if (await c.count().catch(() => 0)) { await c.click({ timeout: 6000 }).catch(() => {}); pulsado = true; break; }
      }
      if (!pulsado && intento === 3) {
        await page.locator('[data-testid="store-select-list-item"]').first().click({ timeout: 6000 }).catch(() => {});
        await log(P, 'negocio', `${paso}: sin "Ver negocio"; elijo la 1ª tienda (datos parciales)`);
      }
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(5000);
      if (!(await enSelector())) {
        await log(P, 'negocio', `${paso}: "Ver negocio" (todas las tiendas) al intento ${intento}`);
        return;
      }
    }
    await log(P, 'negocio', `${paso}: el selector de tienda no se cierra tras 3 intentos`);
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
  const boton = page.getByRole('button', { name: /descargar( informe)?/i }).first()
    .or(page.locator('button, a, [role="button"]').filter({ hasText: /descargar( informe)?/i }).first());
  if (!(await boton.count().catch(() => 0))) {
    await volcar(`${P}_${paso}`, await page.content().catch(() => ''));
    await log(P, 'sin_descarga', `${paso}: no veo el botón Descargar (HTML volcado)`);
    return null;
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

/** Rendimiento: pestañas Ventas y Operaciones (Clientes lo dejamos para CRM más adelante). */
async function rendimiento(page: Page, periodo: string, cuenta: string, from: string, to: string) {
  await page.goto(`${PORTAL}/reports?from=${from}&to=${to}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);
  await verNegocio(page, `ventas_${cuenta}`);   // todas las tiendas → informe completo

  for (const [nombreTab, tipo] of [['Ventas', 'glovo_ventas'], ['Operaciones', 'glovo_operaciones']] as const) {
    const tab = page.getByRole('tab', { name: new RegExp(`^${nombreTab}$`, 'i') }).first()
      .or(page.locator('[role="tab"], button, a').filter({ hasText: new RegExp(`^${nombreTab}$`, 'i') }).first());
    if (await tab.count().catch(() => 0)) {
      await tab.click({ timeout: 6000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(5000);
    }
    const f = await bajarDescargar(page, `${tipo}_${cuenta}`);
    if (f) await entregar({ fuente: P, tipo, nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'ventas' });
  }
}

/** Historial de pedidos: cada pedido con estado, marca, reclamaciones y subtotal. */
async function historial(page: Page, periodo: string, cuenta: string, from: string, to: string) {
  await page.goto(`${PORTAL}/orders?from=${from}&to=${to}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);
  await verNegocio(page, `historial_${cuenta}`);   // todas las tiendas → informe completo
  const f = await bajarDescargar(page, `historial_${cuenta}`);
  if (f) await entregar({ fuente: P, tipo: 'glovo_historial', nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'ventas' });
}

/**
 * FACTURAS + LIQUIDACIONES · página "Pagos" = portal.glovoapp.com/finance (última opción
 * del sidebar). Sin captcha y ya con los 8 establecimientos. Bajamos con "Descargar todo"
 * (paquete del rango) y con el icono de descarga de cada fila (PDF individual → Conciliación).
 */
async function finanzas(page: Page, periodo: string, cuenta: string) {
  await page.goto(`${PORTAL}/finance`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);

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
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;
    const { from, to } = rango();
    const periodo = MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES) ? MES : hoyMadrid(1);

    await rendimiento(page, periodo, c.cuenta, from, to);   // Ventas + Operaciones
    await historial(page, periodo, c.cuenta, from, to);     // Historial de pedidos
    await finanzas(page, periodo, c.cuenta);                // Facturas y liquidaciones (Pagos)
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
  if (cuentas.length === 0) { await log(P, 'sin_credenciales', 'no hay cuentas activas de Glovo'); return; }
  for (const c of cuentas) await trabajarCuenta(c);
  await log(P, 'fin', `${cuentas.length} cuenta(s)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
