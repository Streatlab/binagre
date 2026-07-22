/**
 * capturar-export.ts · Captura el fichero que genera un botón "Exportar/Descargar"
 * en Playwright, cubriendo los 3 casos reales:
 *   A) download clásico (evento 'download')
 *   B) CSV/Excel devuelto directamente en una respuesta XHR/fetch
 *   C) XHR que devuelve JSON con un enlace al fichero (se descarga aparte)
 *
 * Solo Playwright. Headless en GitHub Actions (ubuntu, chromium). Node 18+.
 * (Base aportada por Fable, 15-jul-2026; integrada en el robot de plataformas.)
 */
import type { Page, Download, Response } from 'playwright';

export interface CapturedFile {
  filename: string;
  buffer: Buffer;
  source: 'download' | 'xhr' | 'xhr-link';
}

export interface CaptureOptions {
  timeoutMs?: number;
  urlPattern?: RegExp;
  contentTypes?: string[];
  minBytes?: number;
}

const DEFAULTS: Required<CaptureOptions> = {
  timeoutMs: 45_000,
  urlPattern: /(export|report|csv|download|descarga|informe|orders|reports)/i,
  contentTypes: [
    'text/csv',
    'application/csv',
    'text/comma-separated-values',
    'application/octet-stream',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ],
  minBytes: 10,
};

export async function captureExport(
  page: Page,
  trigger: () => Promise<unknown>,
  options: CaptureOptions = {},
): Promise<CapturedFile> {
  const opts = { ...DEFAULTS, ...options };

  const downloadPromise: Promise<CapturedFile> = page
    .waitForEvent('download', { timeout: opts.timeoutMs })
    .then(async (download: Download) => {
      const filename = download.suggestedFilename() || 'export.csv';
      const tmp = `/tmp/pw-download-${Date.now()}`;
      await download.saveAs(tmp);
      const fs = await import('node:fs');
      return { filename, buffer: fs.readFileSync(tmp), source: 'download' as const };
    });

  let cleanup: () => void = () => {};
  const responsePromise: Promise<CapturedFile> = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('sin respuesta XHR')); }, opts.timeoutMs);

    const onResponse = async (response: Response) => {
      try {
        if (!response.ok()) return;
        const url = response.url();
        const ct = (response.headers()['content-type'] || '').toLowerCase();
        const urlMatch = opts.urlPattern.test(url);
        const ctMatch = opts.contentTypes.some((t) => ct.includes(t));

        if (urlMatch && ct.includes('application/json')) {
          const text = await response.text();
          const link = extractFileUrl(text, url);
          if (link) {
            const fileResp = await page.request.get(link);
            if (fileResp.ok()) {
              const buffer = Buffer.from(await fileResp.body());
              if (buffer.length >= opts.minBytes) {
                clearTimeout(timer); cleanup();
                resolve({ filename: filenameFromHeaders(fileResp.headers()) || filenameFromUrl(link) || 'export.csv', buffer, source: 'xhr-link' });
              }
            }
          }
          return;
        }

        if (!urlMatch && !ctMatch) return;
        if (ct.includes('text/html')) return;
        const buffer = await response.body();
        if (buffer.length < opts.minBytes) return;
        clearTimeout(timer); cleanup();
        resolve({ filename: filenameFromHeaders(response.headers()) || filenameFromUrl(url) || 'export.csv', buffer, source: 'xhr' });
      } catch { /* body no disponible; seguimos escuchando */ }
    };

    cleanup = () => page.off('response', onResponse);
    page.on('response', onResponse);
  });

  const winner = Promise.any([downloadPromise, responsePromise]);
  await trigger();
  try { return await winner; }
  catch { throw new Error('no se capturó ningún fichero (ni download ni XHR export)'); }
  finally { cleanup(); }
}

function filenameFromHeaders(headers: Record<string, string>): string | null {
  const cd = headers['content-disposition'] || headers['Content-Disposition'];
  if (!cd) return null;
  const m = /filename\*?=(?:UTF-8''|")?([^";\n]+)/i.exec(cd);
  return m ? decodeURIComponent(m[1].replace(/"/g, '').trim()) : null;
}

function filenameFromUrl(url: string): string | null {
  try {
    const last = new URL(url).pathname.split('/').pop() || '';
    return /\.(csv|xlsx?|zip|txt)$/i.test(last) ? decodeURIComponent(last) : null;
  } catch { return null; }
}

function extractFileUrl(jsonText: string, baseUrl: string): string | null {
  let data: unknown;
  try { data = JSON.parse(jsonText); } catch { return null; }
  const candidates: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') { if (/^https?:\/\//i.test(v) || v.startsWith('/')) candidates.push(v); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(data);
  const looksLikeFile = (u: string) =>
    /\.(csv|xlsx?|zip)(\?|$)/i.test(u) || /(export|report|download|descarga|file)/i.test(u) || /(X-Amz-Signature|GoogleAccessId|sig=)/i.test(u);
  const hit = candidates.find(looksLikeFile);
  if (!hit) return null;
  try { return new URL(hit, baseUrl).toString(); } catch { return null; }
}
