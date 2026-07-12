/**
 * NAVEGADOR · Utilidades comunes de descarga.
 *
 * Los portales cambian de aspecto a menudo, así que NO se atan selectores
 * frágiles: se busca cualquier botón/enlace de exportar o descargar y se captura
 * el fichero que suelte el navegador. Si no aparece ninguno, se vuelca el HTML a
 * `robot_debug` para poder ver qué cambió.
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { log, volcar } from './bandeja.js';
import { cargarSesion } from './portal.js';

export interface Fichero { nombre: string; datos: Buffer }

export async function abrir(plataforma: string, cuenta: string): Promise<{ browser: Browser; ctx: BrowserContext; page: Page }> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const sesion = await cargarSesion(plataforma, cuenta);
  const ctx = await browser.newContext({
    acceptDownloads: true,
    timezoneId: 'Europe/Madrid',
    locale: 'es-ES',
    viewport: { width: 1440, height: 900 },
    storageState: sesion as any,
  });
  ctx.setDefaultTimeout(30000);
  const page = await ctx.newPage();
  return { browser, ctx, page };
}

const PATRON_DESCARGA = /export|exportar|descargar|download|csv|excel|xlsx?|pdf|informe|report/i;

/** Captura el fichero que produce un clic. Devuelve null si no descarga nada. */
export async function capturar(page: Page, clic: () => Promise<void>, segundos = 60): Promise<Fichero | null> {
  const espera = page.waitForEvent('download', { timeout: segundos * 1000 });
  await clic();
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
    page.getByRole('button', { name: PATRON_DESCARGA }).first(),
    page.getByRole('link', { name: PATRON_DESCARGA }).first(),
    page.getByRole('menuitem', { name: PATRON_DESCARGA }).first(),
    page.locator('a[download], [data-testid*="download" i], [data-testid*="export" i], [class*="download" i], [class*="export" i]').first(),
  ];
  for (const c of candidatos) {
    if (!(await c.count().catch(() => 0))) continue;
    const f = await capturar(page, async () => { await c.click({ timeout: 10000 }).catch(() => {}); });
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
  const textos = /aceptar|accept|entendido|got it|permitir|allow all|cerrar|close/i;
  for (const rol of ['button', 'link'] as const) {
    const b = page.getByRole(rol, { name: textos }).first();
    if (await b.count().catch(() => 0)) await b.click({ timeout: 3000 }).catch(() => {});
  }
}
