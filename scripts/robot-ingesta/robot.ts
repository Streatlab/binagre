/**
 * Robot de ingesta diaria · Rushour + Sinqro → Supabase
 * ------------------------------------------------------
 * Descarga ventas del DÍA EN CURSO por marca/plataforma y las deja en
 * `ingesta_robot_diaria` (NO toca tablas de conciliación).
 *
 * CALIBRACIÓN (2026-07-07) con HTML real:
 *   RUSHOUR: manager.rushour.io/login · input[name=username]/password.
 *            Tras login aparece modal promocional "Evolve your brand". El panel
 *            "Real-time view" muestra "Turnover including VAT" y "Volume of
 *            orders". El modal NO usa display:none, así que innerText a veces no
 *            devuelve los KPIs → se leen recorriendo el DOM con textContent y
 *            emparejando cada etiqueta con el número € más cercano.
 *   SINQRO:  app.sinqro.com · #login-email/#login-password/#loginButton.
 *            Historial #/sp/6416/online/orders es AngularJS. Los pedidos NO están
 *            en una <table> (la única <table> es el datepicker). Cada pedido es un
 *            bloque ng-repeat="order in orders" con .orderClientBox (cliente) y
 *            .orderAmountBox (importe €). Los checkboxes de tipo de pedido están
 *            OCULTOS dentro de un <label>; se clica el label + evento change.
 *   FECHA:   Rushour/Sinqro muestran por defecto el día actual, así que se
 *            ingiere el día en curso (no ayer).
 */

import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const DIAG = process.env.DIAG === '1';
const ART_DIR = './robot-artifacts';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function hoy(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
// Sinqro datepicker usa formato dd/mm/yyyy
function ddmmyyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function ensureArtDir() { if (!existsSync(ART_DIR)) mkdirSync(ART_DIR, { recursive: true }); }
async function diag(page: Page, etiqueta: string) {
  if (!DIAG) return;
  ensureArtDir();
  try {
    await page.screenshot({ path: `${ART_DIR}/${etiqueta}.png`, fullPage: true });
    writeFileSync(`${ART_DIR}/${etiqueta}.html`, await page.content());
    console.log(`  · diagnóstico: ${etiqueta}`);
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

// Cierra modales/overlays comunes (promos, cookies) que tapan el contenido.
async function cerrarModales(page: Page) {
  const nombres = [/close/i, /cerrar/i, /no,? gracias/i, /aceptar/i, /got it/i, /entendido/i, /×/];
  for (const re of nombres) {
    await page.getByRole('button', { name: re }).first().click({ timeout: 1200 }).catch(() => {});
  }
  // Botón "Close" del modal promocional de Rushour: el texto está dentro de un
  // <span> hijo de <button>, así que se clica el button que lo contiene.
  await page.locator('button:has(span:text-is("Close"))').first().click({ timeout: 1500 }).catch(() => {});
  await page.getByRole('button', { name: 'Close', exact: true }).first().click({ timeout: 1500 }).catch(() => {});
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => (x.textContent || '').trim() === 'Close');
    if (b) (b as HTMLButtonElement).click();
  }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
}

// ---------- RUSHOUR ----------
async function ingestaRushour(browser: Browser, fecha: string): Promise<Fila[]> {
  if (!RUSHOUR.user || !RUSHOUR.pass) { console.warn('  ⚠ rushour: sin credenciales.'); return []; }
  const page = await browser.newPage();
  try {
    console.log('→ rushour: login…');
    await page.goto(RUSHOUR.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await diag(page, 'rushour-01-login');
    await page.waitForSelector(RUSHOUR.userInput, { timeout: 15000 });
    await page.fill(RUSHOUR.userInput, RUSHOUR.user);
    await page.fill(RUSHOUR.passInput, RUSHOUR.pass);
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(RUSHOUR.submitBtn)]);
    await page.waitForTimeout(4000);
    // Cerrar modal promocional "Evolve your brand" que tapa los KPIs.
    await cerrarModales(page);
    await page.waitForTimeout(1200);
    await cerrarModales(page);
    await page.waitForTimeout(800);
    await diag(page, 'rushour-02-postlogin');

    // Real-time view: recorrer el DOM (textContent, que SÍ ve el texto tapado por
    // el modal) y emparejar cada etiqueta con el número que la acompaña.
    const datos = await page.evaluate(() => {
      const norm = (s: string | null | undefined) => {
        if (!s) return null;
        const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : null;
      };
      // Texto completo del DOM (incluye lo que innerText oculta bajo el modal).
      const full = (document.body.textContent || '').replace(/\s+/g, ' ');
      const mT = full.match(/Turnover(?:\s+including\s+VAT)?[^\d]*([\d.,]+)\s*€/i);
      const mV = full.match(/Volume of orders[^\d]*([\d.,]+)/i);
      let turnover = norm(mT?.[1]);
      let volumen = norm(mV?.[1]);
      // Respaldo: buscar el nodo cuya etiqueta contenga "Turnover" y leer el
      // primer número € de su bloque contenedor.
      if (turnover == null) {
        const nodos = Array.from(document.querySelectorAll('*'));
        const lbl = nodos.find((n) => /turnover/i.test(n.textContent || '') && (n.childElementCount <= 3));
        const cont = lbl?.closest('div,section,article') || lbl?.parentElement;
        const m = (cont?.textContent || '').match(/([\d.,]+)\s*€/);
        turnover = norm(m?.[1]);
      }
      return { turnover, volumen };
    }).catch(() => ({ turnover: null as number | null, volumen: null as number | null }));
    const turnover = datos.turnover;
    const volumen = datos.volumen;
    await diag(page, 'rushour-03-report');

    if (turnover == null && volumen == null) {
      ensureArtDir(); writeFileSync(`${ART_DIR}/rushour-EMPTY.html`, await page.content());
      console.warn('  ⚠ rushour: no se leyeron KPIs (revisar rushour-EMPTY.html).');
      return [];
    }
    console.log(`  ✓ rushour: turnover=${turnover} volumen=${volumen}`);
    return [{
      fecha, agregador: 'rushour', plataforma: 'uber_glovo', marca: 'Streat Lab',
      pedidos: volumen, bruto: turnover, neto: null,
      ticket_medio: turnover && volumen ? turnover / volumen : null,
    }];
  } catch (e: any) {
    console.error(`  ✗ rushour: ${e?.message || e}`);
    await diag(page, 'rushour-ERROR');
    return [];
  } finally { await page.close(); }
}

// ---------- SINQRO ----------
async function ingestaSinqro(browser: Browser, fecha: string): Promise<Fila[]> {
  if (!SINQRO.user || !SINQRO.pass) { console.warn('  ⚠ sinqro: sin credenciales.'); return []; }
  const page = await browser.newPage();
  try {
    console.log('→ sinqro: login…');
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

    // 1) Marcar TODOS los tipos de pedido. AngularJS: clic en el <label> que
    //    envuelve el checkbox oculto + disparar evento para actualizar ng-model.
    for (const sel of SINQRO.tipoChecks) {
      const chk = page.locator(sel).first();
      if (!(await chk.count())) continue;
      const yaMarcado = await chk.isChecked().catch(() => false);
      if (yaMarcado) continue;
      const label = page.locator(`label:has(${sel})`).first();
      if (await label.count()) {
        await label.click({ force: true }).catch(() => {});
      } else {
        await chk.click({ force: true }).catch(() => {});
      }
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

    // 2) Rango de fechas = día en curso (formato dd/mm/yyyy del datepicker).
    const f = ddmmyyyy(fecha);
    const sd = page.locator(SINQRO.startDate).first();
    const ed = page.locator(SINQRO.endDate).first();
    if (await sd.count()) { await sd.fill(f).catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); }
    if (await ed.count()) { await ed.fill(f).catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); }

    // 3) Buscar.
    await page.getByRole('button', { name: /buscar/i }).first().click().catch(() => {});
    await page.waitForTimeout(4000);
    await diag(page, 'sinqro-03-report');

    // 4) Leer los pedidos (bloques ng-repeat="order in orders"), NO la <table>
    //    del datepicker. Cada pedido: .orderClientBox (cliente) + .orderAmountBox (€).
    const pedidos = await page.evaluate(() => {
      const bloques = Array.from(document.querySelectorAll('[ng-repeat*="order in orders"]'));
      return bloques.map((b) => {
        const cli = (b.querySelector('.orderClientBox') as HTMLElement | null)?.textContent || '';
        const amt = (b.querySelector('.orderAmountBox') as HTMLElement | null)?.textContent || '';
        return { cliente: cli.replace(/\s+/g, ' ').trim(), importe: amt.replace(/\s+/g, ' ').trim() };
      });
    }).catch(() => [] as { cliente: string; importe: string }[]);

    if (!pedidos.length) {
      ensureArtDir(); writeFileSync(`${ART_DIR}/sinqro-EMPTY.html`, await page.content());
      console.warn('  ⚠ sinqro: 0 pedidos (sin ventas hoy o estructura distinta; revisar sinqro-EMPTY.html).');
      return [];
    }

    // Agrupar por plataforma inferida del texto del pedido. Sinqro solo etiqueta
    // con claridad JustEat; el resto (nombres de cliente reales) se agrupa como
    // "sinqro_otros" para no inventar plataforma.
    const norm = (s: string) => {
      const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    const acc = new Map<string, { pedidos: number; bruto: number }>();
    for (const p of pedidos) {
      const t = `${p.cliente} ${p.importe}`.toLowerCase();
      const plataforma = /glovo/.test(t) ? 'glovo'
        : /just\s?eat/.test(t) ? 'just_eat'
        : /uber/.test(t) ? 'uber_eats'
        : 'sinqro_otros';
      const cur = acc.get(plataforma) || { pedidos: 0, bruto: 0 };
      cur.pedidos += 1;
      cur.bruto += norm(p.importe);
      acc.set(plataforma, cur);
    }
    const out: Fila[] = Array.from(acc.entries()).map(([plataforma, v]) => ({
      fecha, agregador: 'sinqro', plataforma, marca: 'Streat Lab',
      pedidos: v.pedidos, bruto: Math.round(v.bruto * 100) / 100, neto: null,
      ticket_medio: v.pedidos ? Math.round((v.bruto / v.pedidos) * 100) / 100 : null,
    }));
    console.log(`  ✓ sinqro: ${pedidos.length} pedidos → ${out.length} filas por plataforma`);
    return out;
  } catch (e: any) {
    console.error(`  ✗ sinqro: ${e?.message || e}`);
    await diag(page, 'sinqro-ERROR');
    return [];
  } finally { await page.close(); }
}

// ---------- Guardar ----------
async function guardar(filas: Fila[]) {
  if (!filas.length) { console.log('Nada que guardar.'); return; }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.warn('⚠ Faltan credenciales Supabase.'); return; }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error } = await sb.from('ingesta_robot_diaria').upsert(filas, { onConflict: 'fecha,agregador,plataforma,marca' });
  if (error) { console.error('✗ Error Supabase:', error.message); process.exitCode = 1; }
  else console.log(`✓ Guardadas ${filas.length} filas.`);
}

async function main() {
  const fecha = hoy();
  console.log(`== Robot ingesta diaria · fecha=${fecha} · DIAG=${DIAG ? 'on' : 'off'} ==`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const rush = await ingestaRushour(browser, fecha);
    const sinq = await ingestaSinqro(browser, fecha);
    await guardar([...rush, ...sinq]);
  } finally { await browser.close(); }
  console.log('== Fin ==');
}
main().catch((e) => { console.error(e); process.exit(1); });
