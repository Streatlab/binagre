/**
 * Robot de ingesta diaria · Rushour + Sinqro → Supabase
 * FUENTES: Rushour = Uber + Glovo (agregado). Sinqro = Just Eat + Glovo.
 * DEDUPE: Glovo se cuenta desde Rushour; de Sinqro solo Just Eat.
 * Escribe diagnóstico en `robot_log` para verificar sin descargar artefactos.
 */

import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const DIAG = process.env.DIAG === '1';
const ART_DIR = './robot-artifacts';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function hoy(): string { return new Date().toISOString().slice(0, 10); }
function ddmmyyyy(iso: string): string { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function ensureArtDir() { if (!existsSync(ART_DIR)) mkdirSync(ART_DIR, { recursive: true }); }
async function diag(page: Page, etiqueta: string) {
  if (!DIAG) return;
  ensureArtDir();
  try {
    await page.screenshot({ path: `${ART_DIR}/${etiqueta}.png`, fullPage: true });
    writeFileSync(`${ART_DIR}/${etiqueta}.html`, await page.content());
  } catch {}
}

type Fila = {
  fecha: string; agregador: string; plataforma: string; marca: string;
  pedidos: number | null; bruto: number | null; neto: number | null; ticket_medio: number | null;
};

const RUSHOUR = {
  loginUrl: 'https://manager.rushour.io/login',
  user: process.env.RUSHOUR_USER || '', pass: process.env.RUSHOUR_PASS || '',
  userInput: 'input[name="username"]', passInput: 'input[name="password"]', submitBtn: 'button[type="submit"]',
};
const SINQRO = {
  loginUrl: 'https://app.sinqro.com/', ventasUrl: 'https://app.sinqro.com/#/sp/6416/online/orders',
  user: process.env.SINQRO_USER || '', pass: process.env.SINQRO_PASS || '',
  userInput: '#login-email', passInput: '#login-password', submitBtn: '#loginButton',
  tipoChecks: ['#deliveryFilter', '#collectionFilter', '#insideFilter', '#insituFilter', '#reservationFilter'],
  startDate: '#startDateFilter', endDate: '#endDateFilter',
};

async function cerrarModales(page: Page) {
  const nombres = [/close/i, /cerrar/i, /no,? gracias/i, /aceptar/i, /got it/i, /entendido/i, /×/];
  for (const re of nombres) {
    await page.getByRole('button', { name: re }).first().click({ timeout: 1200 }).catch(() => {});
  }
  await page.locator('button:has(span:text-is("Close"))').first().click({ timeout: 1500 }).catch(() => {});
  await page.getByRole('button', { name: 'Close', exact: true }).first().click({ timeout: 1500 }).catch(() => {});
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => (x.textContent || '').trim() === 'Close');
    if (b) (b as HTMLButtonElement).click();
  }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
}

async function logRobot(fuente: string, estado: string, detalle: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    await sb.from('robot_log').insert([{ fuente, estado, detalle }]);
  } catch {}
}

// ---------- RUSHOUR ----------
async function ingestaRushour(browser: Browser, fecha: string): Promise<Fila[]> {
  if (!RUSHOUR.user || !RUSHOUR.pass) { await logRobot('rushour', 'error', 'sin credenciales'); return []; }
  const page = await browser.newPage();
  try {
    await page.goto(RUSHOUR.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await diag(page, 'rushour-01-login');
    await page.waitForSelector(RUSHOUR.userInput, { timeout: 15000 });
    await page.fill(RUSHOUR.userInput, RUSHOUR.user);
    await page.fill(RUSHOUR.passInput, RUSHOUR.pass);
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(RUSHOUR.submitBtn)]);
    await page.waitForTimeout(4000);
    await cerrarModales(page);
    await page.waitForTimeout(1200);
    await cerrarModales(page);
    await page.waitForTimeout(800);
    await diag(page, 'rushour-02-postlogin');

    const leerKpis = () => page.evaluate(() => {
      const norm = (s: string | null | undefined) => {
        if (!s) return null;
        const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : null;
      };
      const valorDeCard = (etiqueta: RegExp, conEuro: boolean): number | null => {
        const spans = Array.from(document.querySelectorAll('span'));
        const lbl = spans.find((s) => etiqueta.test((s.textContent || '').trim()));
        if (!lbl) return null;
        const card = lbl.parentElement?.parentElement || lbl.parentElement;
        if (!card) return null;
        const cands = Array.from(card.querySelectorAll('span'))
          .map((s) => (s.textContent || '').trim())
          .filter((t) => (conEuro ? /€/.test(t) : /^\s*[\d.,]+\s*$/.test(t)) && /\d/.test(t));
        return norm(cands[0]);
      };
      let turnover = valorDeCard(/Turnover/i, true);
      const volumen = valorDeCard(/Volume of orders/i, false);
      if (turnover == null) {
        const full = (document.body.textContent || '').replace(/\s+/g, ' ');
        const mT = full.match(/Turnover(?:\s+including\s+VAT)?[^\d]*([\d.,]+)\s*€/i);
        turnover = norm(mT?.[1]);
      }
      const spans = Array.from(document.querySelectorAll('span')).map((s) => (s.textContent || '').trim());
      const dg = {
        hayLabelTurnover: spans.some((t) => /turnover/i.test(t)),
        spansEuro: spans.filter((t) => /€/.test(t) && /\d/.test(t)).slice(0, 6),
        url: location.href,
      };
      return { turnover, volumen, dg };
    }).catch((e: any) => ({ turnover: null as number | null, volumen: null as number | null, dg: { error: String(e?.message || e) } as any }));

    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForSelector('span', { timeout: 10000 }).catch(() => {});

    let turnover: number | null = null;
    let volumen: number | null = null;
    let ultimoDiag: any = null;
    for (let intento = 1; intento <= 4; intento++) {
      const d = await leerKpis();
      turnover = d.turnover; volumen = d.volumen; ultimoDiag = d.dg;
      if (turnover != null || volumen != null) break;
      await cerrarModales(page);
      await page.waitForTimeout(2500);
      if (intento === 2) {
        await page.goto('https://manager.rushour.io/', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(3500);
        await cerrarModales(page);
        await page.waitForTimeout(1000);
      }
    }
    await diag(page, 'rushour-03-report');
    await logRobot('rushour', turnover != null ? 'ok' : 'vacio',
      `turnover=${turnover} volumen=${volumen} diag=${JSON.stringify(ultimoDiag)}`);

    if (turnover == null && volumen == null) return [];
    return [{
      fecha, agregador: 'rushour', plataforma: 'uber_glovo', marca: 'Streat Lab',
      pedidos: volumen, bruto: turnover, neto: null,
      ticket_medio: turnover && volumen ? turnover / volumen : null,
    }];
  } catch (e: any) {
    await logRobot('rushour', 'error', String(e?.message || e));
    await diag(page, 'rushour-ERROR');
    return [];
  } finally { await page.close(); }
}

// ---------- SINQRO ----------
async function ingestaSinqro(browser: Browser, fecha: string): Promise<Fila[]> {
  if (!SINQRO.user || !SINQRO.pass) { await logRobot('sinqro', 'error', 'sin credenciales'); return []; }
  const page = await browser.newPage();
  try {
    await page.goto(SINQRO.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await diag(page, 'sinqro-01-login');
    await page.waitForSelector(SINQRO.userInput, { timeout: 15000 });
    await page.fill(SINQRO.userInput, SINQRO.user);
    await page.fill(SINQRO.passInput, SINQRO.pass);
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(SINQRO.submitBtn)]);
    await page.waitForTimeout(3000);
    await diag(page, 'sinqro-02-postlogin');

    await page.goto(SINQRO.ventasUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    for (const sel of SINQRO.tipoChecks) {
      const chk = page.locator(sel).first();
      if (!(await chk.count())) continue;
      if (await chk.isChecked().catch(() => false)) continue;
      const label = page.locator(`label:has(${sel})`).first();
      if (await label.count()) { await label.click({ force: true }).catch(() => {}); }
      else { await chk.click({ force: true }).catch(() => {}); }
      await page.evaluate((id) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el && !el.checked) {
          el.checked = true;
          el.dispatchEvent(new Event('click', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, sel.replace('#', '')).catch(() => {});
    }
    await page.waitForTimeout(800);

    const f = ddmmyyyy(fecha);
    const sd = page.locator(SINQRO.startDate).first();
    const ed = page.locator(SINQRO.endDate).first();
    if (await sd.count()) { await sd.fill(f).catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); }
    if (await ed.count()) { await ed.fill(f).catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); }

    await page.getByRole('button', { name: /buscar/i }).first().click().catch(() => {});
    await page.waitForTimeout(4000);
    await diag(page, 'sinqro-03-report');

    const pedidos = await page.evaluate(() => {
      const bloques = Array.from(document.querySelectorAll('[ng-repeat*="order in orders"]'));
      return bloques.map((b) => {
        const cli = (b.querySelector('.orderClientBox') as HTMLElement | null)?.textContent || '';
        const amt = (b.querySelector('.orderAmountBox') as HTMLElement | null)?.textContent || '';
        return { cliente: cli.replace(/\s+/g, ' ').trim(), importe: amt.replace(/\s+/g, ' ').trim() };
      });
    }).catch(() => [] as { cliente: string; importe: string }[]);

    if (!pedidos.length) { await logRobot('sinqro', 'vacio', 'pedidos_leidos=0'); return []; }

    const norm = (s: string) => {
      const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    const acc = new Map<string, { pedidos: number; bruto: number }>();
    for (const p of pedidos) {
      const t = `${p.cliente} ${p.importe}`.toLowerCase();
      if (!/just\s?eat/.test(t)) continue; // Glovo → viene de Rushour.
      const cur = acc.get('just_eat') || { pedidos: 0, bruto: 0 };
      cur.pedidos += 1; cur.bruto += norm(p.importe);
      acc.set('just_eat', cur);
    }
    const out: Fila[] = Array.from(acc.entries()).map(([plataforma, v]) => ({
      fecha, agregador: 'sinqro', plataforma, marca: 'Streat Lab',
      pedidos: v.pedidos, bruto: Math.round(v.bruto * 100) / 100, neto: null,
      ticket_medio: v.pedidos ? Math.round((v.bruto / v.pedidos) * 100) / 100 : null,
    }));
    await logRobot('sinqro', 'ok', `pedidos_leidos=${pedidos.length} filas_justeat=${out.length}`);
    return out;
  } catch (e: any) {
    await logRobot('sinqro', 'error', String(e?.message || e));
    await diag(page, 'sinqro-ERROR');
    return [];
  } finally { await page.close(); }
}

async function guardar(filas: Fila[]) {
  if (!filas.length) { await logRobot('guardar', 'vacio', '0 filas'); return; }
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error } = await sb.from('ingesta_robot_diaria').upsert(filas, { onConflict: 'fecha,agregador,plataforma,marca' });
  if (error) { await logRobot('guardar', 'error', error.message); process.exitCode = 1; }
  else { await logRobot('guardar', 'ok', `${filas.length} filas`); }
}

async function main() {
  const fecha = hoy();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const rush = await ingestaRushour(browser, fecha);
    const sinq = await ingestaSinqro(browser, fecha);
    await guardar([...rush, ...sinq]);
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
