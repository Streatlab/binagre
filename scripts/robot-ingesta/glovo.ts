/**
 * ROBOT GLOVO · Descarga los informes del portal por API interna y los deja en la bandeja.
 *
 * 15-jul-2026 · CLAVE: PerimeterX FIRMA cada llamada que hace la propia página (hook de fetch).
 * Las llamadas "por fuera" (page.request) no llevan esa firma → 403/401. Por eso ahora TODAS
 * las llamadas se ejecutan DENTRO de la página con fetch (page.evaluate), para que el antibot
 * las firme igual que cuando el usuario las hace. Navegador headful (ver _lib/navegador.ts).
 *
 * VENTAS/OPERACIONES → POST vos-api.../reports/.../export (CSV) → downloadURL → GET
 * HISTORIAL          → GraphQL vagw op DownloadReport → downloadURL → GET
 * FACTURAS           → GraphQL vagw ListPayouts → RequestPayouts → GET zip
 */
import type { Page, BrowserContext } from 'playwright';
import { entregar, log, volcar, hoyMadrid } from './_lib/bandeja.js';
import { cuentasDe, esperarCodigo, guardarSesion, type Cuenta } from './_lib/portal.js';
import { abrir, quitarEstorbos } from './_lib/navegador.js';

const P = 'glovo';
const PORTAL = 'https://portal.glovoapp.com';
const MANAGERS = 'https://managers.glovoapp.com';
const GATEWAY = 'https://vagw-api.eu.prd.portal.restaurant/query';
const REPORTS_API = 'https://vos-api.eu.prd.portal.restaurant';
const MODO = (process.env.MODO || 'diario').toLowerCase();
const MES = process.env.MES || '';

const VENDOR_IDS = ['578570', '244299', '580042', '459466', '569883', '580156', '580336', '349698'];
const VENDOR_CODES = VENDOR_IDS.map((v) => `GV_ES;${v}`);
const VENDOR_OBJS = VENDOR_IDS.map((v) => ({ globalEntityId: 'GV_ES', vendorId: v }));

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
  finances { listPayouts(input: $params) { payouts { payoutId: id at: paymentDateLocal payoutAttachments: attachments payoutAccount: account { grid __typename } invoices { invoiceAttachments: attachments __typename } __typename } __typename } __typename }
}`;
const Q_REQUEST_PAYOUTS = `query RequestPayouts($params: DownloadPayoutsRequest!) {
  finances { downloadPayouts(input: $params) { downloadUrl __typename } __typename }
}`;
const Q_DOWNLOAD_REPORT = `query DownloadReport($params: DownloadOrdersExportReq!) {
  orders { ordersExport { downloadOrdersExport(input: $params) { downloadURL __typename } __typename } __typename }
}`;

// ── Llamadas DENTRO de la página (para que el antibot las firme) ─────────────
async function postEnPagina(page: Page, url: string, headers: Record<string, string>, body: any): Promise<{ status: number; text: string }> {
  return page.evaluate(async ({ url, headers, body }) => {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), credentials: 'include' });
      return { status: r.status, text: await r.text() };
    } catch (e: any) { return { status: -1, text: String(e && e.message ? e.message : e) }; }
  }, { url, headers, body });
}

async function getBinarioEnPagina(page: Page, url: string): Promise<{ status: number; b64: string }> {
  return page.evaluate(async ({ url }) => {
    try {
      const r = await fetch(url, { credentials: 'include' });
      const buf = await r.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return { status: r.status, b64: btoa(bin) };
    } catch (e: any) { return { status: -1, b64: '' }; }
  }, { url });
}

/** Cabeceras de app del gateway vagw (SIN x-px-cookies: lo pone el antibot al ir por dentro). */
function capturarVagw(page: Page): { get: () => Record<string, string> | null; accounts: () => any[] | null } {
  let hdrs: Record<string, string> | null = null;
  let accs: any[] | null = null;
  page.on('request', (req) => {
    try {
      if (req.method() !== 'POST' || !req.url().startsWith(GATEWAY)) return;
      const h = req.headers();
      if (!h['x-user-id']) return;
      hdrs = {
        'apollographql-client-name': h['apollographql-client-name'] || 'API Gateway',
        'x-app-name': h['x-app-name'] || 'one-web',
        'x-country': h['x-country'] || 'ES',
        'x-global-entity-id': h['x-global-entity-id'] || 'GV_ES',
        'x-user-id': h['x-user-id'] || '',
        'x-vendor-id': h['x-vendor-id'] || '',
        'x-rps-device': h['x-rps-device'] || '',
      };
      const pd = req.postData() || '';
      if (!accs && pd.includes('ListPayouts')) { try { accs = JSON.parse(pd).variables.params.accounts; } catch {} }
    } catch {}
  });
  return { get: () => hdrs, accounts: () => accs };
}

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

function rango(): { from: string; to: string } {
  if (MODO === 'backfill' && /^\d{4}-\d{2}$/.test(MES)) {
    const [a, m] = MES.split('-').map(Number);
    const fin = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return { from: `${MES}-01`, to: `${MES}-${String(fin).padStart(2, '0')}` };
  }
  return { from: hoyMadrid(7), to: hoyMadrid(1) };
}

async function esperarPagina(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);
}

async function exportarInforme(page: Page, tipo: string, path: string, fieldMask: string, from: string, to: string, periodo: string, cuenta: string) {
  try {
    const res = await postEnPagina(page, `${REPORTS_API}${path}`, { 'accept': 'application/json, text/plain, */*' }, { locale: 'es-ES', format: 'CSV', global_vendor_codes: VENDOR_CODES, from, to, field_mask: fieldMask });
    if (res.status !== 200) { await log(P, 'sin_descarga', `${tipo}_${cuenta}: export ${res.status}`); return; }
    const url = JSON.parse(res.text || '{}')?.reportDownloadURL;
    if (!url) { await log(P, 'sin_descarga', `${tipo}_${cuenta}: sin reportDownloadURL`); return; }
    const dl = await getBinarioEnPagina(page, url);
    if (dl.status !== 200 || !dl.b64) { await log(P, 'sin_descarga', `${tipo}_${cuenta}: descarga ${dl.status}`); return; }
    await entregar({ fuente: P, tipo: `glovo_${tipo}`, nombre: `${cuenta}_${tipo}_${from}_${to}.csv`, datos: Buffer.from(dl.b64, 'base64'), periodo, destino: 'ventas' });
    await log(P, 'descarga', `${tipo}_${cuenta}: CSV ok`);
  } catch (e: any) { await log(P, 'sin_descarga', `${tipo}_${cuenta}: error (${e?.message || e})`); }
}

async function rendimiento(page: Page, periodo: string, cuenta: string, from: string, to: string) {
  await page.goto(`${PORTAL}/reports?from=${from}&to=${to}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await quitarEstorbos(page);
  await esperarPagina(page);
  await exportarInforme(page, 'ventas', '/v1/vendors/reports/performance/summary/export', 'revenue,orderCount,avgBasketSize', from, to, periodo, cuenta);
  await exportarInforme(page, 'operaciones', '/v1/vendors/reports/ops/summary/export', 'offlineDuration,rejectionRate,avgPreparationTime,contactRate,ordersMarkedAsReadyRate', from, to, periodo, cuenta);
}

async function historial(page: Page, periodo: string, cuenta: string, from: string, to: string) {
  const cap = capturarVagw(page);
  await page.goto(`${PORTAL}/orders?from=${from}&to=${to}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await quitarEstorbos(page);
  await esperarPagina(page);
  const headers = cap.get() || {};
  try {
    const res = await postEnPagina(page, GATEWAY, headers, { operationName: 'DownloadReport', query: Q_DOWNLOAD_REPORT, variables: { params: { globalVendorCodes: VENDOR_OBJS, timeFrom: `${from}T22:00:00.000Z`, timeTo: `${to}T21:59:59.999Z`, format: 'CSV', locale: 'es-ES', withBillingFields: true } } });
    if (res.status !== 200) { await log(P, 'sin_descarga', `historial_${cuenta}: DownloadReport ${res.status}`); return; }
    const url = JSON.parse(res.text || '{}')?.data?.orders?.ordersExport?.downloadOrdersExport?.downloadURL;
    if (!url) { await log(P, 'sin_descarga', `historial_${cuenta}: sin downloadURL`); return; }
    const dl = await getBinarioEnPagina(page, url);
    if (dl.status !== 200 || !dl.b64) { await log(P, 'sin_descarga', `historial_${cuenta}: descarga ${dl.status}`); return; }
    await entregar({ fuente: P, tipo: 'glovo_historial', nombre: `${cuenta}_historial_${from}_${to}.csv`, datos: Buffer.from(dl.b64, 'base64'), periodo, destino: 'ventas' });
    await log(P, 'descarga', `historial_${cuenta}: CSV ok`);
  } catch (e: any) { await log(P, 'sin_descarga', `historial_${cuenta}: error (${e?.message || e})`); }
}

async function finanzas(page: Page, periodo: string, cuenta: string) {
  const cap = capturarVagw(page);
  await page.goto(`${PORTAL}/finance`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await quitarEstorbos(page);
  await esperarPagina(page);
  const headers = cap.get() || {};

  const { from, to } = rango();
  const desde = MODO === 'backfill' ? from : hoyMadrid(60);
  const cuentasFin = cap.accounts() && cap.accounts()!.length ? cap.accounts()! : ACCOUNTS_GLOVO;

  let payouts: any[] = [];
  const res = await postEnPagina(page, GATEWAY, headers, { operationName: 'ListPayouts', query: Q_LIST_PAYOUTS, variables: { params: { startDate: desde, endDate: to, filter: {}, pagination: { pageSize: 50 }, globalEntityId: 'GV_ES', accounts: cuentasFin } } });
  if (res.status === 200) { try { payouts = JSON.parse(res.text)?.data?.finances?.listPayouts?.payouts || []; } catch {} }
  else await log(P, 'sin_descarga', `finanzas_${cuenta}: ListPayouts ${res.status}`);

  let bajados = 0;
  for (const po of payouts) {
    try {
      const att = (po.payoutAttachments && po.payoutAttachments.length) ? po.payoutAttachments : (po.invoices || []).flatMap((iv: any) => iv.invoiceAttachments || []);
      if (!att.length) continue;
      const grid = po.payoutAccount?.grid || '';
      const rr = await postEnPagina(page, GATEWAY, headers, { operationName: 'RequestPayouts', query: Q_REQUEST_PAYOUTS, variables: { params: { payoutId: po.payoutId, paymentDateLocal: po.at, attachments: att, globalEntityId: 'GV_ES', accounts: [{ grid, billingParentId: '', chainId: '' }] } } });
      if (rr.status !== 200) continue;
      const url = JSON.parse(rr.text || '{}')?.data?.finances?.downloadPayouts?.downloadUrl;
      if (!url) continue;
      const dl = await getBinarioEnPagina(page, url);
      if (dl.status !== 200 || !dl.b64) continue;
      await entregar({ fuente: P, tipo: 'glovo_finanzas', nombre: `${cuenta}_pagos_${po.payoutId}.zip`, datos: Buffer.from(dl.b64, 'base64'), periodo, destino: 'facturas' });
      bajados++;
      await page.waitForTimeout(300);
    } catch { /* siguiente */ }
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
  } finally { await browser.close(); }
}

async function main() {
  await log(P, 'inicio', `modo=${MODO}${MES ? ` mes=${MES}` : ''}`);
  const cuentas = await cuentasDe(P);
  if (cuentas.length === 0) { await log(P, 'sin_credenciales', 'no hay cuentas activas de Glovo'); return; }
  for (const c of cuentas) await trabajarCuenta(c);
  await log(P, 'fin', `${cuentas.length} cuenta(s)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
