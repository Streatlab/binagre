/**
 * ROBOT GLOVO · Descarga los informes del portal de comercio y los deja en la bandeja.
 * Dos cuentas (posmodernos y streatlab). Entra solo: sesión guardada + código por IMAP.
 *
 * 15-jul-2026 · TODO POR API INTERNA (sin captcha), capturado de los HAR de Rubén:
 *   VENTAS  → POST vos-api.../v1/vendors/reports/performance/summary/export {format:CSV,
 *             global_vendor_codes, from, to, field_mask} → {reportDownloadURL} → GET → CSV
 *   FACTURAS→ GraphQL vagw-api.../query: ListPayouts → RequestPayouts → downloadUrl → GET → ZIP
 *   El navegador del robot, al abrir /reports o /finance, hace esas llamadas con un token
 *   válido del antibot (cabecera x-px-cookies). Capturamos esa cabecera de una llamada real y
 *   replicamos con page.request (que arrastra la sesión). CERO botón, CERO captcha.
 *   Operaciones e Historial: pendientes de capturar su export (mismo patrón).
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
const REPORTS_API = 'https://vos-api.eu.prd.portal.restaurant';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

// Los 8 códigos de tienda (global_vendor_codes) para los informes de Rendimiento.
const VENDOR_CODES = ['GV_ES;578570', 'GV_ES;244299', 'GV_ES;580042', 'GV_ES;459466', 'GV_ES;569883', 'GV_ES;580156', 'GV_ES;580336', 'GV_ES;349698'];

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

/** Captura la cabecera del antibot (x-px-cookies) de una llamada real del portal a su API. */
function capturarPx(page: Page): { get: () => string | null } {
  const box: { v: string | null } = { v: null };
  page.on('request', (req) => {
    try {
      if (box.v) return;
      if (req.method() !== 'POST') return;
      const u = req.url();
      if (!u.startsWith(REPORTS_API) && !u.startsWith(GATEWAY)) return;
      const h = req.headers();
      if (h['x-px-cookies']) box.v = h['x-px-cookies'];
    } catch {}
  });
  return { get: () => box.v };
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
}

/** Rango de fechas para los informes (from/to = AAAA-MM-DD). */
function rango(): { from: string; to: string } {
  if (MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES)) {
    const [a, m] = MES.split('-').map(Number);
    const from = `${MES}-01`;
    const fin = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return { from, to: `${MES}-${String(fin).padStart(2, '0')}` };
  }
  return { from: hoyMadrid(7), to: hoyMadrid(1) };
}

/**
 * RENDIMIENTO · Ventas por API interna (sin captcha).
 * Abre /reports (mint del token), captura x-px-cookies y llama al export de resumen.
 * Operaciones queda pendiente de capturar su field_mask.
 */
async function rendimiento(page: Page, periodo: string, cuenta: string, from: string, to: string) {
  const px = capturarPx(page);
  await page.goto(`${PORTAL}/reports?from=${from}&to=${to}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(9000);
  await quitarEstorbos(page);
  await esperarCarga(page, `ventas_${cuenta}`);

  const token = px.get();
  if (!token) {
    await volcar(`${P}_ventas_${cuenta}`, await page.content().catch(() => ''));
    await log(P, 'sin_descarga', `ventas_${cuenta}: no capturé el token del antibot (pudo bloquear la carga)`);
    return;
  }
  const hdr = { 'content-type': 'application/json', 'accept': 'application/json, text/plain, */*', 'x-px-cookies': token };

  try {
    const r = await page.request.post(`${REPORTS_API}/v1/vendors/reports/performance/summary/export`, {
      headers: hdr,
      data: { locale: 'es-ES', format: 'CSV', global_vendor_codes: VENDOR_CODES, from, to, field_mask: 'revenue,orderCount,avgBasketSize' },
    });
    if (!r.ok()) { await log(P, 'sin_descarga', `ventas_${cuenta}: export devolvió ${r.status()}`); }
    else {
      const url = (await r.json())?.reportDownloadURL;
      if (!url) { await log(P, 'sin_descarga', `ventas_${cuenta}: sin reportDownloadURL`); }
      else {
        const dl = await page.request.get(url);
        if (!dl.ok()) { await log(P, 'sin_descarga', `ventas_${cuenta}: descarga CSV ${dl.status()}`); }
        else {
          await entregar({ fuente: P, tipo: 'glovo_ventas', nombre: `${cuenta}_ventas_${from}_${to}.csv`, datos: Buffer.from(await dl.body()), periodo, destino: 'ventas' });
          await log(P, 'descarga', `ventas_${cuenta}: CSV ok`);
        }
      }
    }
  } catch (e: any) {
    await log(P, 'sin_descarga', `ventas_${cuenta}: error (${e?.message || e})`);
  }

  await log(P, 'pendiente', `operaciones_${cuenta}: pendiente capturar su export (mismo patrón, otro field_mask)`);
}

/** Historial de pedidos · pendiente de pasar a la API interna (mismo patrón que Ventas). */
async function historial(page: Page, periodo: string, cuenta: string, _from: string, _to: string) {
  await log(P, 'pendiente', `historial_${cuenta}: pendiente capturar su export (vía API interna)`);
}

/**
 * FACTURAS + LIQUIDACIONES · vía API interna (sin captcha).
 * ListPayouts → RequestPayouts → GET zip, con las cabeceras de la sesión real.
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
