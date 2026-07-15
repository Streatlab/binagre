/**
 * ROBOT GLOVO · Descarga los informes del portal de comercio y los deja en la bandeja.
 * Dos cuentas (posmodernos y streatlab). Entra solo: sesión guardada + código por
 * correo (IMAP del buzón de la cuenta) si hace falta.
 *
 * 15-jul-2026 · RUTAS REALES (confirmadas por Rubén con capturas):
 *   portal.glovoapp.com/reports  → Rendimiento: pestañas Ventas / Operaciones / Clientes
 *   portal.glovoapp.com/orders   → Historial de pedidos ("Descargar informe")
 *   portal.glovoapp.com/finance  → "Pagos": facturas + liquidaciones
 *
 * 15-jul-2026 · FACTURAS POR API INTERNA (sin captcha, capturado del HAR de Rubén):
 *   El portal descarga las facturas llamando a su gateway GraphQL vagw-api.../query:
 *     1) ListPayouts  → lista de pagos con sus adjuntos (xlsx+pdf en S3) y su cuenta (grid)
 *     2) RequestPayouts(payoutId, paymentDateLocal, attachments, account) → downloadUrl (zip)
 *     3) GET downloadUrl → ZIP con los ficheros
 *   El propio navegador del robot, al abrir /finance, ya hace esas llamadas con un token válido
 *   del antibot (cabecera x-px-cookies). Capturamos esas cabeceras de una llamada real y
 *   replicamos la secuencia con page.request (que arrastra la sesión). CERO botón, CERO captcha.
 *   Reports (Ventas/Operaciones) e Historial siguen por botón; pendiente pasarlos a la misma vía.
 *
 * Modos (env MODO): diario | semanal | backfill (MES=AAAA-MM)
 */
import type { Page, BrowserContext } from 'playwright';
import { randomUUID } from 'node:crypto';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos } from './_lib/navegador.js';
import { captureExport } from './_lib/capturar-export.js';

const P = 'glovo';
const PORTAL = 'https://portal.glovoapp.com';
const MANAGERS = 'https://managers.glovoapp.com';
const GATEWAY = 'https://vagw-api.eu.prd.portal.restaurant/query';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

// Las 8 cuentas de facturación (grid/chainId), por si no se capturan en vivo.
const ACCOUNTS_GLOVO = [
  { grid: '4MWIW9', billingParentId: '', chainId: '392092' },
  { grid: '4MW2I2', billingParentId: '', chainId: '136613' },
  { grid: '4MW92V', billingParentId: '', chainId: '392943' },
  { grid: '4MWIID', billingParentId: '', chainId: '305034' },
  { grid: '4MW17H', billingParentId: '', chainId: '385861' },
  { grid: '4MW1UQ', billingParentId: '', chainId: '393035' },
  { grid: '4MW9WS', billingParentId: '', chainId: '393175' },
  { grid: '4MWQP4', billingParentId: '', chainId: '218178' },
];

const Q_LIST_PAYOUTS = `query ListPayouts($params: ListPayoutsRequest!) {
  finances {
    listPayouts(input: $params) {
      nextPageToken
      prevPageToken
      payouts {
        payoutId: id
        payoutAmount: netPayout
        payoutCurrency: currency
        payoutOrders: ordersCount
        at: paymentDateLocal
        status: payoutStatus
        payoutAttachments: attachments
        payoutAccount: account { grid billingParentId chainId __typename }
        invoices {
          invoiceId: id
          invoiceAmount: totalPayout
          invoiceCurrency: currency
          invoiceOrders: ordersCount
          processedDate
          invoiceAttachments: attachments
          period: earningsPeriod { from: invoiceStartDate to: invoiceEndDate __typename }
          invoiceAccount: account { grid billingParentId chainId __typename }
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}`;

const Q_REQUEST_PAYOUTS = `query RequestPayouts($params: DownloadPayoutsRequest!) {
  finances {
    downloadPayouts(input: $params) {
      downloadUrl
      __typename
    }
    __typename
  }
}`;

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

/** El portal filtra por establecimiento; "Ver negocio" cubre TODAS las tiendas. */
async function verNegocio(page: Page, paso: string): Promise<void> {
  try {
    const abridor = page.locator('[data-testid="brand-view-selection"], [data-testid="vendor-filter-button"]').first()
      .or(page.getByRole('button', { name: /todos los establecimientos|establecimientos|establishments/i }).first());
    if (await abridor.count().catch(() => 0)) {
      await abridor.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    const verNeg = page.getByRole('button', { name: /ver negocio|view business/i }).first()
      .or(page.locator('[data-testid="chain-select-button"]').first());
    if (await verNeg.count().catch(() => 0)) {
      await verNeg.click({ timeout: 6000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(4000);
      await log(P, 'negocio', `${paso}: "Ver negocio" (todas las tiendas)`);
    }
  } catch { /* seguimos */ }
}

/** Espera a que el informe/página termine de cargar (spinner role=progressbar). */
async function esperarCarga(page: Page, paso: string): Promise<void> {
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < 35000) {
      const cargando = await page.locator('[role="progressbar"]:visible').count().catch(() => 0);
      if (cargando === 0) break;
      await page.waitForTimeout(1500);
    }
  } catch { /* seguimos */ }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500);
  await log(P, 'carga', `${paso}: cargado (${Math.round((Date.now() - t0) / 1000)}s)`);
}

/** Rango de fechas para la URL de los informes (from/to = AAAA-MM-DD). */
function rango(): { from: string; to: string } {
  if (MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES)) {
    const [a, m] = MES.split('-').map(Number);
    const from = `${MES}-01`;
    const fin = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return { from, to: `${MES}-${String(fin).padStart(2, '0')}` };
  }
  return { from: hoyMadrid(7), to: hoyMadrid(1) };
}

/** Pulsa el botón de descarga (por testid o texto) y captura el fichero (para reports/orders). */
async function bajarDescargar(page: Page, paso: string, testid?: string): Promise<{ nombre: string; datos: Buffer } | null> {
  const porTexto = page.getByRole('button', { name: /descargar( informe)?/i }).first()
    .or(page.locator('button, a, [role="button"]').filter({ hasText: /descargar( informe)?/i }).first());
  const boton = testid ? page.locator(`[data-testid="${testid}"]`).first().or(porTexto) : porTexto;
  if (!(await boton.count().catch(() => 0))) {
    await volcar(`${P}_${paso}`, await page.content().catch(() => ''));
    await log(P, 'sin_descarga', `${paso}: no veo el botón de descarga (HTML volcado)`);
    return null;
  }
  try {
    const f = await captureExport(page, async () => {
      await boton.click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1800);
      const dlg = page.locator('[role="dialog"], .modal, [class*="modal" i]')
        .filter({ hasText: /formato del informe|descargar informe|archivo \.?csv/i }).first();
      if (await dlg.count().catch(() => 0)) {
        const csv = dlg.getByText(/archivo\s*\.?csv/i).first().or(dlg.locator('input[type="radio"]').first());
        await csv.click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(400);
        const conf = dlg.getByRole('button', { name: /descargar( informe)?/i }).first()
          .or(dlg.locator('button').filter({ hasText: /descargar/i }).last());
        await conf.click({ timeout: 8000 }).catch(() => {});
      }
    });
    await log(P, 'descarga', `${paso}: ${f.filename} (${f.buffer.length} bytes · ${f.source})`);
    return { nombre: f.filename, datos: f.buffer };
  } catch (e: any) {
    await volcar(`${P}_${paso}`, await page.content().catch(() => ''));
    await log(P, 'sin_descarga', `${paso}: el export no soltó fichero (${e?.message || e})`);
    return null;
  }
}

/** Rendimiento: pestañas Ventas [tab-sales] y Operaciones [tab-ops]. */
async function rendimiento(page: Page, periodo: string, cuenta: string, from: string, to: string) {
  await page.goto(`${PORTAL}/reports?from=${from}&to=${to}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);
  if (/\/dashboard/.test(page.url())) {
    const nav = page.locator('[data-testid="plugin-link-reports"], [data-testid="reports-nav-item"]').first();
    if (await nav.count().catch(() => 0)) {
      await nav.click({ timeout: 6000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(5000);
    }
  }
  await verNegocio(page, `ventas_${cuenta}`);

  for (const [testid, nombreTab, tipo] of [['tab-sales', 'Ventas', 'glovo_ventas'], ['tab-ops', 'Operaciones', 'glovo_operaciones']] as const) {
    const tab = page.locator(`[data-testid="${testid}"]`).first()
      .or(page.getByRole('tab', { name: new RegExp(`^${nombreTab}$`, 'i') }).first())
      .or(page.locator('[role="tab"], button, a').filter({ hasText: new RegExp(`^${nombreTab}$`, 'i') }).first());
    if (await tab.count().catch(() => 0)) {
      await tab.click({ timeout: 6000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(3000);
    }
    await esperarCarga(page, `${tipo}_${cuenta}`);
    const f = await bajarDescargar(page, `${tipo}_${cuenta}`);
    if (f) await entregar({ fuente: P, tipo, nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'ventas' });
  }
}

/** Historial de pedidos. */
async function historial(page: Page, periodo: string, cuenta: string, from: string, to: string) {
  await page.goto(`${PORTAL}/orders?from=${from}&to=${to}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);
  await verNegocio(page, `historial_${cuenta}`);
  await esperarCarga(page, `historial_${cuenta}`);
  const f = await bajarDescargar(page, `historial_${cuenta}`, 'export-report-btn');
  if (f) await entregar({ fuente: P, tipo: 'glovo_historial', nombre: `${cuenta}_${f.nombre}`, datos: f.datos, periodo, destino: 'ventas' });
}

/**
 * FACTURAS + LIQUIDACIONES · vía API interna (sin captcha).
 * Abre /finance para que el portal haga sus llamadas (y con ellas un token válido del antibot),
 * captura esas cabeceras y replica ListPayouts → RequestPayouts → GET zip con la propia sesión.
 */
async function finanzas(page: Page, periodo: string, cuenta: string) {
  let apiHeaders: Record<string, string> | null = null;
  let accounts: any[] | null = null;

  page.on('request', (req) => {
    try {
      if (apiHeaders) return;
      if (req.method() !== 'POST' || !req.url().startsWith(GATEWAY)) return;
      const h = req.headers();
      if (!h['x-px-cookies']) return;
      apiHeaders = {
        'content-type': 'application/json',
        'apollographql-client-name': h['apollographql-client-name'] || 'API Gateway',
        'x-app-name': h['x-app-name'] || 'one-web',
        'x-country': h['x-country'] || 'ES',
        'x-global-entity-id': h['x-global-entity-id'] || 'GV_ES',
        'x-user-id': h['x-user-id'] || '',
        'x-vendor-id': h['x-vendor-id'] || '',
        'x-rps-device': h['x-rps-device'] || '',
        'x-px-cookies': h['x-px-cookies'],
      };
      const pd = req.postData() || '';
      if (pd.includes('ListPayouts')) { try { accounts = JSON.parse(pd).variables.params.accounts; } catch {} }
    } catch {}
  });

  await page.goto(`${PORTAL}/finance`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);
  await esperarCarga(page, `finanzas_${cuenta}`);

  if (!apiHeaders) {
    await volcar(`${P}_finanzas_${cuenta}`, await page.content().catch(() => ''));
    await log(P, 'sin_descarga', `finanzas_${cuenta}: no capturé la llamada interna del portal (antibot pudo bloquear la carga)`);
    return;
  }

  const req = (op: string, query: string, variables: any) =>
    page.request.post(GATEWAY, { headers: { ...apiHeaders!, 'x-request-id': randomUUID() }, data: { operationName: op, query, variables } });

  const { from, to } = rango();
  const desde = MODO === 'backfill' ? from : hoyMadrid(60);
  const hasta = to;
  const cuentasFin = accounts && accounts.length ? accounts : ACCOUNTS_GLOVO;

  let payouts: any[] = [];
  try {
    const r = await req('ListPayouts', Q_LIST_PAYOUTS, { params: { startDate: desde, endDate: hasta, filter: {}, pagination: { pageSize: 50 }, globalEntityId: 'GV_ES', accounts: cuentasFin } });
    if (r.ok()) payouts = (await r.json())?.data?.finances?.listPayouts?.payouts || [];
    else await log(P, 'sin_descarga', `finanzas_${cuenta}: ListPayouts devolvió ${r.status()}`);
  } catch (e: any) {
    await log(P, 'sin_descarga', `finanzas_${cuenta}: ListPayouts error (${e?.message || e})`);
  }

  let bajados = 0;
  for (const po of payouts) {
    try {
      const att = (po.payoutAttachments && po.payoutAttachments.length)
        ? po.payoutAttachments
        : (po.invoices || []).flatMap((iv: any) => iv.invoiceAttachments || []);
      if (!att.length) continue;
      const grid = po.payoutAccount?.grid || '';
      const r = await req('RequestPayouts', Q_REQUEST_PAYOUTS, { params: { payoutId: po.payoutId, paymentDateLocal: po.at, attachments: att, globalEntityId: 'GV_ES', accounts: [{ grid, billingParentId: '', chainId: '' }] } });
      const j = r.ok() ? await r.json() : null;
      const url = j?.data?.finances?.downloadPayouts?.downloadUrl;
      if (!url) { await log(P, 'sin_descarga', `finanzas_${cuenta}: sin enlace para pago ${po.payoutId}`); continue; }
      const dl = await page.request.get(url);
      if (!dl.ok()) { await log(P, 'sin_descarga', `finanzas_${cuenta}: zip ${dl.status()} pago ${po.payoutId}`); continue; }
      const buf = Buffer.from(await dl.body());
      await entregar({ fuente: P, tipo: 'glovo_finanzas', nombre: `${cuenta}_pagos_${po.payoutId}.zip`, datos: buf, periodo, destino: 'facturas' });
      bajados++;
      await page.waitForTimeout(400);
    } catch (e: any) {
      await log(P, 'sin_descarga', `finanzas_${cuenta}: error pago ${po?.payoutId} (${e?.message || e})`);
    }
  }
  await log(P, bajados ? 'descarga' : 'sin_descarga', `finanzas_${cuenta}: ${bajados}/${payouts.length} pago(s) descargado(s)`);
}

async function trabajarCuenta(c: Cuenta) {
  const { browser, ctx, page } = await abrir(P, c.cuenta);
  try {
    if (!(await entrar(page, ctx, c))) return;
    const { from, to } = rango();
    const periodo = MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES) ? MES : hoyMadrid(1);

    await rendimiento(page, periodo, c.cuenta, from, to);
    await historial(page, periodo, c.cuenta, from, to);
    await finanzas(page, periodo, c.cuenta);
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
