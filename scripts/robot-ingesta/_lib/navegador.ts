/**
 * NAVEGADOR · Utilidades comunes de descarga.
 *
 * 14-jul-2026 · Glovo pone un candado "Mantén pulsado para confirmar que eres un
 * ser humano" ANTES de soltar el informe. Se resuelve manteniendo el ratón pulsado
 * sobre el botón unos segundos (mantenPulsado). Si no se resuelve, no hay fichero.
 * 13-jul-2026 · Uber corta el login si huele robot → navegador con pinta de Chrome
 * normal (user-agent real, sin la marca de automatización).
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { log, volcar } from './bandeja.js';
import { cargarSesion } from './portal.js';

export interface Fichero { nombre: string; datos: Buffer }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export async function abrir(plataforma: string, cuenta: string): Promise<{ browser: Browser; ctx: BrowserContext; page: Page }> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--lang=es-ES',
    ],
  });
  const sesion = await cargarSesion(plataforma, cuenta);
  const ctx = await browser.newContext({
    acceptDownloads: true,
    timezoneId: 'Europe/Madrid',
    locale: 'es-ES',
    userAgent: UA,
    viewport: { width: 1440, height: 900 },
    storageState: sesion as any,
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['es-ES', 'es'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });
  ctx.setDefaultTimeout(30000);
  const page = await ctx.newPage();
  return { browser, ctx, page };
}

const PATRON_DESCARGA = /export|exportar|descargar|download|csv|excel|xlsx?|informe|report/i;
const PATRON_CONFIRMAR = /^(descargar|download|confirmar|aceptar|exportar|generar|continuar|ok)/i;
const RE_MANTEN = /mant[eé]n pulsado|mantener pulsado|press ?(&|and) ?hold|hold to confirm/i;

/**
 * Candado "mantén pulsado": aprieta el ratón sobre el botón y aguanta.
 * Devuelve true si el candado desaparece.
 */
export async function mantenPulsado(page: Page, plataforma: string): Promise<boolean> {
  const aviso = page.getByText(RE_MANTEN).first();
  if (!(await aviso.count().catch(() => 0))) return false;

  // El botón suele ser el propio texto o su contenedor pulsable
  const objetivo = page.locator('[role="dialog"] button, [role="dialog"] [role="button"], [role="dialog"] div[tabindex]').first()
    .or(aviso);
  const caja = await objetivo.boundingBox().catch(() => null) || await aviso.boundingBox().catch(() => null);
  if (!caja) return false;

  const x = caja.x + caja.width / 2;
  const y = caja.y + caja.height / 2;

  for (const segundos of [12, 16]) {
    await page.mouse.move(x, y, { steps: 8 }).catch(() => {});
    await page.mouse.down().catch(() => {});
    for (let i = 0; i < segundos * 2; i++) {
      await page.waitForTimeout(500);
      await page.mouse.move(x + (i % 2 ? 0.4 : -0.4), y, { steps: 1 }).catch(() => {});   // micro-temblor humano
    }
    await page.mouse.up().catch(() => {});
    await page.waitForTimeout(5000);
    const sigue = await page.getByText(RE_MANTEN).count().catch(() => 0);
    if (!sigue) { await log(plataforma, 'candado', 'candado "mantén pulsado" superado'); return true; }
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
      if (await page.getByText(RE_MANTEN).count().catch(() => 0)) {
        const ok = await mantenPulsado(page, plataforma);
        if (!ok) continue;
      }
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
export async function descargarDeLaPagina(
  plataforma: string,
  page: Page,
  paso: string,
): Promise<Fichero | null> {
  const candidatos = [
    page.locator('[data-testid="export-report-btn"]').first(),
    page.getByRole('button', { name: PATRON_DESCARGA }).first(),
    page.getByRole('link', { name: PATRON_DESCARGA }).first(),
    page.getByRole('menuitem', { name: PATRON_DESCARGA }).first(),
    page.getByText(/descargar informe|download report/i).first(),
    page.locator('a[download], [data-testid*="download" i], [data-testid*="export" i]').first(),
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

/** Cierra avisos de cookies y modales que tapan los botones. */
export async function quitarEstorbos(page: Page) {
  const textos = /aceptar|accept|entendido|got it|permitir|allow all/i;
  for (const rol of ['button', 'link'] as const) {
    const b = page.getByRole(rol, { name: textos }).first();
    if (await b.count().catch(() => 0)) await b.click({ timeout: 3000 }).catch(() => {});
  }
}
