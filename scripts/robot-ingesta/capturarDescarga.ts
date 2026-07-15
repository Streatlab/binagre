/**
 * capturarDescarga — captura el fichero generado por un botón "Exportar"
 * cubriendo dos escenarios a la vez:
 *   A) download clásico de Playwright (evento 'download')
 *   B) la web pide el CSV por XHR/fetch y lo devuelve en la respuesta
 *      (o devuelve JSON con un enlace al fichero)
 *
 * Se queda con el primero que llegue (Promise.race).
 * Headless-safe: funciona en chromium headless en GitHub Actions.
 * Sin dependencias externas (solo Playwright + node:fs).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page, Download, Response } from 'playwright';

export interface FicheroCapturado {
  nombre: string;
  buffer: Buffer;
  origen: 'download' | 'xhr' | 'xhr-enlace';
}

export interface OpcionesCaptura {
  /** Timeout total en ms (por defecto 45s) */
  timeoutMs?: number;
  /** Regex para reconocer la URL de la petición del export */
  urlRegex?: RegExp;
  /** Regex para reconocer el content-type del fichero */
  contentTypeRegex?: RegExp;
}

const URL_EXPORT_RE = /export|report|download|descarga|csv|invoic|statement/i;
const CT_FICHERO_RE =
  /text\/csv|application\/csv|application\/octet-stream|application\/vnd\.ms-excel|application\/vnd\.openxmlformats|application\/zip/i;

/**
 * @param page   página de Playwright
 * @param accion función que dispara el export (normalmente el clic)
 *
 * Uso:
 *   const fichero = await capturarDescarga(page, () =>
 *     page.getByRole('button', { name: /exportar/i }).click()
 *   );
 *   fs.writeFileSync(`/tmp/${fichero.nombre}`, fichero.buffer);
 */
export async function capturarDescarga(
  page: Page,
  accion: () => Promise<unknown>,
  opts: OpcionesCaptura = {},
): Promise<FicheroCapturado> {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const urlRe = opts.urlRegex ?? URL_EXPORT_RE;
  const ctRe = opts.contentTypeRegex ?? CT_FICHERO_RE;

  // ── A) Download clásico ────────────────────────────────────────────────
  const pDownload: Promise<FicheroCapturado> = page
    .waitForEvent('download', { timeout: timeoutMs })
    .then(async (d: Download) => {
      // En headless, path() espera a que la descarga termine
      const tmp = await d.path();
      let buffer: Buffer;
      if (tmp) {
        buffer = fs.readFileSync(tmp);
      } else {
        // Fallback por si el navegador no expone path
        const stream = await d.createReadStream();
        const chunks: Buffer[] = [];
        for await (const c of stream) chunks.push(c as Buffer);
        buffer = Buffer.concat(chunks);
      }
      return { nombre: d.suggestedFilename() || 'export.csv', buffer, origen: 'download' as const };
    });

  // ── B) Respuesta XHR/fetch que trae el fichero (o un enlace a él) ─────
  const esRespuestaFichero = (r: Response): boolean => {
    if (!r.ok()) return false;
    const ct = (r.headers()['content-type'] ?? '').toLowerCase();
    const cd = (r.headers()['content-disposition'] ?? '').toLowerCase();
    if (ctRe.test(ct)) return true;                       // content-type de fichero
    if (cd.includes('attachment')) return true;           // header de descarga
    // URL de export que devuelve JSON (posible enlace firmado dentro)
    if (urlRe.test(r.url()) && ct.includes('application/json')) return true;
    return false;
  };

  const pXhr: Promise<FicheroCapturado> = page
    .waitForResponse(esRespuestaFichero, { timeout: timeoutMs })
    .then(async (r: Response) => {
      const ct = (r.headers()['content-type'] ?? '').toLowerCase();

      // Caso B2: JSON con enlace al fichero (url firmada de S3/GCS, etc.)
      if (ct.includes('application/json')) {
        const json = (await r.json().catch(() => null)) as Record<string, unknown> | null;
        const enlace = json ? buscarEnlace(json) : null;
        if (!enlace) throw new Error(`Respuesta JSON de export sin enlace reconocible: ${r.url()}`);
        const resp = await page.request.get(enlace, { timeout: timeoutMs });
        if (!resp.ok()) throw new Error(`Enlace de export devolvió ${resp.status()}: ${enlace}`);
        return {
          nombre: nombreDesdeHeaders(resp.headers(), enlace),
          buffer: Buffer.from(await resp.body()),
          origen: 'xhr-enlace' as const,
        };
      }

      // Caso B1: el body de la respuesta ES el fichero
      return {
        nombre: nombreDesdeHeaders(r.headers(), r.url()),
        buffer: await r.body(),
        origen: 'xhr' as const,
      };
    });

  // Silenciar el rechazo del perdedor (evita unhandledRejection al expirar su timeout)
  pDownload.catch(() => {});
  pXhr.catch(() => {});

  // IMPORTANTE: los listeners quedan registrados ANTES de disparar el clic
  const carrera = Promise.race([pDownload, pXhr]);
  await accion();
  return carrera;
}

/** Extrae filename de content-disposition o, en su defecto, de la URL. */
function nombreDesdeHeaders(headers: Record<string, string>, url: string): string {
  const cd = headers['content-disposition'] ?? '';
  const m = /filename\*?=(?:utf-8''|")?([^";]+)/i.exec(cd);
  if (m) {
    try {
      return decodeURIComponent(m[1].replace(/"/g, '').trim());
    } catch {
      return m[1].replace(/"/g, '').trim();
    }
  }
  try {
    const base = path.basename(new URL(url).pathname);
    if (base && base.includes('.')) return base;
  } catch {
    /* url no parseable */
  }
  return 'export.csv';
}

/** Busca recursivamente una URL http(s) en campos típicos de respuestas de export. */
function buscarEnlace(obj: Record<string, unknown>, profundidad = 0): string | null {
  if (profundidad > 4) return null;
  const clavesPrioritarias = ['url', 'downloadUrl', 'download_url', 'fileUrl', 'file_url', 'link', 'href', 'signedUrl', 'signed_url', 'location'];
  for (const k of clavesPrioritarias) {
    const v = obj[k];
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const hallado = buscarEnlace(v as Record<string, unknown>, profundidad + 1);
      if (hallado) return hallado;
    }
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item && typeof item === 'object') {
          const hallado = buscarEnlace(item as Record<string, unknown>, profundidad + 1);
          if (hallado) return hallado;
        }
      }
    }
  }
  return null;
}

/** Utilidad: guarda el fichero capturado en disco y devuelve la ruta final. */
export function guardarFichero(fichero: FicheroCapturado, dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const destino = path.join(dir, fichero.nombre);
  fs.writeFileSync(destino, fichero.buffer);
  return destino;
}
