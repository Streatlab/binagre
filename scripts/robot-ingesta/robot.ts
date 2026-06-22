/**
 * Robot de ingesta diaria · Rushour + Sinqro → Supabase
 * ------------------------------------------------------
 * Entra cada día a Rushour (Uber Eats + Glovo) y a Sinqro (Glovo + Just Eat),
 * descarga las ventas del día anterior por marca y plataforma, y las deja en
 * la tabla de aterrizaje `ingesta_robot_diaria` (NO toca tablas de conciliación).
 *
 * Ejecución:
 *   - GitHub Actions (cron diario)  -> credenciales desde Secrets del repo
 *   - Local:  tsx scripts/robot-ingesta/robot.ts        (lee .env.local)
 *   - Diagnóstico: DIAG=1 tsx scripts/robot-ingesta/robot.ts
 *       (abre navegador visible + guarda capturas/HTML en ./robot-artifacts)
 *
 * IMPORTANTE — CALIBRACIÓN:
 *   Los selectores de cada web (marcados con // CALIBRAR) son la única parte que
 *   depende del HTML real de Rushour/Sinqro. En la primera corrida el robot
 *   guarda captura + HTML de cada paso para poder afinarlos sin adivinar.
 */

import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

// ---------- Configuración ----------
const DIAG = process.env.DIAG === '1';
const ART_DIR = './robot-artifacts';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const CFG = {
  rushour: {
    nombre: 'rushour',
    loginUrl: 'https://app.rushour.io/login',          // CALIBRAR si la URL real difiere
    user: process.env.RUSHOUR_USER || '',
    pass: process.env.RUSHOUR_PASS || '',
    sel: {
      userInput: 'input[type="email"], input[name="email"]',   // CALIBRAR
      passInput: 'input[type="password"]',                     // CALIBRAR
      submitBtn: 'button[type="submit"]',                      // CALIBRAR
      // Página/tabla de ventas diarias por marca:
      reportUrl: 'https://app.rushour.io/reports/sales',       // CALIBRAR
      rows: 'table tbody tr',                                  // CALIBRAR
    },
  },
  sinqro: {
    nombre: 'sinqro',
    loginUrl: 'https://app.sinqro.com/login',          // CALIBRAR
    user: process.env.SINQRO_USER || '',
    pass: process.env.SINQRO_PASS || '',
    sel: {
      userInput: 'input[type="email"], input[name="email"]',   // CALIBRAR
      passInput: 'input[type="password"]',                     // CALIBRAR
      submitBtn: 'button[type="submit"]',                      // CALIBRAR
      reportUrl: 'https://app.sinqro.com/reports/sales',       // CALIBRAR
      rows: 'table tbody tr',                                  // CALIBRAR
    },
  },
};

// ---------- Utilidades ----------
function ayer(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function ensureArtDir() {
  if (!existsSync(ART_DIR)) mkdirSync(ART_DIR, { recursive: true });
}

async function diag(page: Page, etiqueta: string) {
  if (!DIAG) return;
  ensureArtDir();
  try {
    await page.screenshot({ path: `${ART_DIR}/${etiqueta}.png`, fullPage: true });
    writeFileSync(`${ART_DIR}/${etiqueta}.html`, await page.content());
    console.log(`  · diagnóstico guardado: ${etiqueta}`);
  } catch { /* no romper por un fallo de captura */ }
}

type Fila = {
  fecha: string;
  agregador: string;       // rushour | sinqro
  plataforma: string;      // uber_eats | glovo | just_eat
  marca: string;
  pedidos: number | null;
  bruto: number | null;
  neto: number | null;
  ticket_medio: number | null;
};

function numero(txt: string | null | undefined): number | null {
  if (!txt) return null;
  const n = parseFloat(txt.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// ---------- Login genérico ----------
async function login(page: Page, c: typeof CFG.rushour) {
  await page.goto(c.loginUrl, { waitUntil: 'domcontentloaded' });
  await diag(page, `${c.nombre}-01-login`);
  await page.fill(c.sel.userInput, c.user);
  await page.fill(c.sel.passInput, c.pass);
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.click(c.sel.submitBtn),
  ]);
  await diag(page, `${c.nombre}-02-postlogin`);
}

// ---------- Extracción de ventas ----------
async function extraer(page: Page, c: typeof CFG.rushour, fecha: string): Promise<Fila[]> {
  await page.goto(c.sel.reportUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await diag(page, `${c.nombre}-03-report`);

  const filas = await page.$$eval(c.sel.rows, (trs) =>
    trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim()))
  ).catch(() => [] as string[][]);

  if (!filas.length) {
    // Sin filas => casi seguro selector a calibrar. Forzar diagnóstico.
    ensureArtDir();
    writeFileSync(`${ART_DIR}/${c.nombre}-EMPTY.html`, await page.content());
    console.warn(`  ⚠ ${c.nombre}: 0 filas. Revisar selectores en robot-artifacts/${c.nombre}-EMPTY.html`);
    return [];
  }

  // Mapeo de columnas: [marca, plataforma, pedidos, bruto, ...] — CALIBRAR el orden real
  return filas.map((cols) => ({
    fecha,
    agregador: c.nombre,
    plataforma: (cols[1] || '').toLowerCase().replace(/\s+/g, '_') || 'desconocida',
    marca: cols[0] || 'desconocida',
    pedidos: numero(cols[2]),
    bruto: numero(cols[3]),
    neto: numero(cols[4]),
    ticket_medio: numero(cols[5]),
  }));
}

// ---------- Procesar una plataforma ----------
async function procesar(browser: Browser, c: typeof CFG.rushour, fecha: string): Promise<Fila[]> {
  if (!c.user || !c.pass) {
    console.warn(`  ⚠ ${c.nombre}: faltan credenciales, se omite.`);
    return [];
  }
  const page = await browser.newPage();
  try {
    console.log(`→ ${c.nombre}: login…`);
    await login(page, c);
    console.log(`→ ${c.nombre}: extrayendo ventas de ${fecha}…`);
    const filas = await extraer(page, c, fecha);
    console.log(`  ✓ ${c.nombre}: ${filas.length} filas`);
    return filas;
  } catch (e: any) {
    console.error(`  ✗ ${c.nombre}: ${e?.message || e}`);
    await diag(page, `${c.nombre}-ERROR`);
    return [];
  } finally {
    await page.close();
  }
}

// ---------- Guardar en Supabase ----------
async function guardar(filas: Fila[]) {
  if (!filas.length) { console.log('Nada que guardar.'); return; }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠ Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: no se guarda.');
    return;
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error } = await sb
    .from('ingesta_robot_diaria')
    .upsert(filas, { onConflict: 'fecha,agregador,plataforma,marca' });
  if (error) { console.error('✗ Error guardando en Supabase:', error.message); process.exitCode = 1; }
  else console.log(`✓ Guardadas ${filas.length} filas en ingesta_robot_diaria.`);
}

// ---------- Main ----------
async function main() {
  const fecha = ayer();
  console.log(`== Robot ingesta diaria · fecha=${fecha} · DIAG=${DIAG ? 'on' : 'off'} ==`);
  const browser = await chromium.launch({ headless: !DIAG });
  try {
    const rush = await procesar(browser, CFG.rushour, fecha);
    const sinq = await procesar(browser, CFG.sinqro, fecha);
    await guardar([...rush, ...sinq]);
  } finally {
    await browser.close();
  }
  console.log('== Fin ==');
}

main().catch((e) => { console.error(e); process.exit(1); });
