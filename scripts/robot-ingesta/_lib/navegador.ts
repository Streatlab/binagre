/**
 * NAVEGADOR · Utilidades comunes de descarga.
 *
 * 15-jul-2026 · CAMUFLAJE ANTIBOT: Chrome real vía Patchright (drop-in de Playwright, sin la
 * fuga CDP ni la marca de automatización), en modo HEADFUL bajo xvfb en CI. Se quitan los
 * parches manuales de navigator.* porque PerimeterX los detecta; Patchright lo hace mejor.
 * Con esto el gateway del portal deja de responder 403 al robot.
 * (Histórico) El candado "mantén pulsado" de PerimeterX ya no se usa: las descargas van por
 * la API interna del portal, no por el botón.
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'patchright';
import { log, volcar } from './bandeja.js';
import { cargarSesion } from './portal.js';

export interface Fichero { nombre: string; datos: Buffer }

export async function abrir(plataforma: string, cuenta: string): Promise<{ browser: Browser; ctx: BrowserContext; page: Page }> {
  // Chrome real, sin marcas de bot, headful (bajo xvfb en CI).
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--lang=es-ES'],
  });
  const sesion = await cargarSesion(plataforma, cuenta);
  const ctx = await browser.newContext({
    acceptDownloads: true,
    timezoneId: 'Europe/Madrid',
    locale: 'es-ES',
    storageState: sesion as any,
  });
  ctx.setDefaultTimeout(30000);
  const page = await ctx.newPage();
  return { browser, ctx, page };
}

const PATRON_DESCARGA = /export|exportar|descargar|download|csv|excel|xlsx?|informe|report/i;
const PATRON_CONFIRMAR = /^(descargar|download|confirmar|aceptar|exportar|generar|continuar|ok)/i;
const RE_MANTEN = /mant[eé]n pulsado|mantener pulsado|press ?(&|and) ?hold|hold to confirm/i;

/** Aprieta y aguanta sobre un punto, con micro-temblor humano. */
async function aguantar(page: Page, x: number, y: number, segundos: number) {
  await page.mouse.move(x, y, { steps: 10 });
  await page.mouse.down();
  const pasos = segundos * 4;
  for (let i = 0; i < pasos; i++) {
    await page.waitForTimeout(250);
    const dx = (Math.random() - 0.5) * 1.2;
    const dy = (Math.random() - 0.5) * 1.2;
    await page.mouse.move(x + dx, y + dy, { steps: 1 }).catch(() => {});
  }
  await page.mouse.up();
}

/** Candado "mantén pulsado" (PerimeterX). Devuelve true si desaparece. */
export async function mantenPulsado(page: Page, plataforma: string): Promise<boolean> {
  if (!(await page.getByText(RE_MANTEN).count().catch(() => 0))) return false;

  const marcos = [page, ...page.frames()];
  const candidatos: Array<{ caja: () => Promise<{ x: number; y: number; width: number; height: number } | null> }> = [];
  for (const m of marcos) {
    for (const sel of ['#px-captcha', '[id*="px-captcha" i]', '[class*="px-captcha" i]', 'iframe[title*="human" i]']) {
      const loc = (m as Page).locator(sel).first();
      candidatos.push({ caja: async () => ((await loc.count().catch(() => 0)) ? loc.boundingBox().catch(() => null) : null) });
    }
  }
  for (const loc of [
    page.getByText(RE_MANTEN).first(),
    page.locator('[role="dialog"] button').last(),
    page.locator('[role="dialog"] [role="button"]').last(),
  ]) {
    candidatos.push({ caja: async () => ((await loc.count().catch(() => 0)) ? loc.boundingBox().catch(() => null) : null) });
  }

  for (const segundos of [10, 20, 30]) {
    for (const c of candidatos) {
      const caja = await c.caja();
      if (!caja || caja.width < 5 || caja.height < 5) continue;

      await aguantar(page, caja.x + caja.width / 2, caja.y + caja.height / 2, segundos).catch(() => {});
      await page.waitForTimeout(5000);

      if (!(await page.getByText(RE_MANTEN).count().catch(() => 0))) {
        await log(plataforma, 'candado', `candado superado (${segundos}s)`);
        return true;
      }
    }
  }

  await log(plataforma, 'candado_ko', 'no he podido superar el "mantén pulsado"');
  await volcar(`${plataforma}_candado`, await page.content().catch(() => ''));
  return false;
}

/** Captura el fichero que produce un clic (resolviendo candado y cuadro intermedio). */
export async function capturar(page: Page, plataforma: string, clic: () => Promise<void>, segundos = 120): Promise<Fichero | null> {
  const espera = page.waitForEvent('download', { timeout: segundos * 1000 });
  await clic();

  (async () => {
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(4000);
      if (await page.getByText(RE_MANTEN).count().catch(() => 0)) await mantenPulsado(page, plataforma);
      const dialogo = page.locator('[role="dialog"]').last();
      if (!(await dialogo.count().catch(() => 0))) continue;
      const conf = dialogo.getByRole('button', { name: PATRON_CONFIRMAR }).last();
      if (await conf.count().catch(() => 0)) await conf.click({ timeout: 5000 }).catch(() => {});
    }
  })().catch(() => {});

  try {
    const dl = await espera;
    const ruta = await dl.path();
    if (!ruta) return null;
    const fs = await import('fs/promises');
    const datos = await fs.readFile(ruta);
    return { nombre: dl.suggestedFilename() || 'informe.csv', datos };
  } catch { return null; }
}

/** Busca un botón/enlace de descarga en la página y captura el fichero. */
export async function descargarDeLaPagina(plataforma: string, page: Page, paso: string): Promise<Fichero | null> {
  const candidatos = [
    page.locator('[data-testid="export-report-btn"]').first(),
    page.getByRole('button', { name: PATRON_DESCARGA }).first(),
    page.getByRole('link', { name: PATRON_DESCARGA }).first(),
    page.getByRole('menuitem', { name: PATRON_DESCARGA }).first(),
    page.getByText(/descargar informe|download report/i).first(),
    page.locator('a[download], a[href$=".csv"], a[href$=".pdf"], [data-testid*="download" i], [data-testid*="export" i]').first(),
  ];
  for (const c of candidatos) {
    if (!(await c.count().catch(() => 0))) continue;
    const f = await capturar(page, plataforma, async () => { await c.click({ timeout: 10000 }).catch(() => {}); });
    if (f) {
      await log(plataforma, 'descarga', `${paso}: ${f.nombre} (${f.datos.length} bytes)`);
      return f;
    }
  }
  await volcar(`${plataforma}_${paso}`, await page.content().catch(() => ''));
  await log(plataforma, 'sin_descarga', `${paso}: no encuentro botón de descarga (HTML volcado)`);
  return null;
}

/** Baja hasta `tope` ficheros enlazados en la página (PDF, CSV, download). */
export async function bajarEnlaces(plataforma: string, page: Page, paso: string, tope = 12): Promise<Fichero[]> {
  const enlaces = page.locator('a[href$=".pdf"], a[download], a[href*="download" i], a[href$=".csv"], a[href$=".xlsx"]');
  const n = Math.min(await enlaces.count().catch(() => 0), tope);
  const bajados: Fichero[] = [];
  for (let i = 0; i < n; i++) {
    const f = await capturar(page, plataforma, async () => { await enlaces.nth(i).click({ timeout: 8000 }).catch(() => {}); }, 60);
    if (f) bajados.push(f);
  }
  if (bajados.length) await log(plataforma, 'descarga', `${paso}: ${bajados.length} fichero(s) por enlace directo`);
  return bajados;
}

/** Cierra avisos de cookies y modales que tapan los botones. */
export async function quitarEstorbos(page: Page) {
  const textos = /aceptar|accept|entendido|got it|permitir|allow all/i;
  for (const rol of ['button', 'link'] as const) {
    const b = page.getByRole(rol, { name: textos }).first();
    if (await b.count().catch(() => 0)) await b.click({ timeout: 3000 }).catch(() => {});
  }
}
