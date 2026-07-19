/**
 * JUST EAT FACTURAS POR CORREO · justeat-mail.ts (19-jul-2026 · v5)
 *
 * POR QUÉ EXISTE: Just Eat envía CADA factura por email a admin@streatlab.com
 * (remitente *@justeat-int.com, asunto "Just-eat invoice: NNNNNNN"), a menudo a
 * SPAM. El Partner Hub bloquea a los servidores de GitHub, así que el correo es
 * la vía. Este robot lee el buzón por IMAP y deja la factura en la bandeja.
 *
 * CAMBIO CLAVE v5: Just Eat NO adjunta ningún archivo — la factura ES el cuerpo
 * del correo (HTML con nº de factura, base, IVA, total y el detalle de pedidos).
 * Hasta v4 el robot buscaba un adjunto inexistente, marcaba el correo como
 * procesado y entregaba 0. Ahora: si no hay adjunto, se genera un PDF del cuerpo
 * del correo y ese PDF es la factura que va a la bandeja. Solo se marca como
 * procesado si la factura se entregó de verdad.
 *
 * Secretos: JE_MAIL_HOST · JE_MAIL_USER (admin@streatlab.com) · JE_MAIL_PASS
 * Idempotencia: Message-ID en mail_procesados + huella sha256 en entregar().
 */
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { chromium, Browser } from 'playwright';
import { sb, log, latido, entregar, marcarConseguido } from './_lib/bandeja.js';

const P = 'justeat_mail';
const USER = process.env.JE_MAIL_USER || '';
const PASS = process.env.JE_MAIL_PASS || '';
const REMITENTE = /justeat-int\.com|just-?eat/i;
const ASUNTO = /invoice|factura/i;

function candidatosHost(): string[] {
  const dados = (process.env.JE_MAIL_HOST || '').split(',').map(s => s.trim()).filter(Boolean);
  const dominio = USER.includes('@') ? USER.split('@')[1] : '';
  const auto = dominio ? [`mail.${dominio}`, `imap.${dominio}`, dominio, `mx.${dominio}`] : [];
  return [...new Set([...dados, ...auto])];
}

function quincenaDe(d: Date): string {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);
  const dia = Number(iso.slice(8, 10));
  return `${iso.slice(0, 7)}-Q${dia <= 15 ? 1 : 2}`;
}

function numFactura(asunto: string): string {
  return (asunto.match(/\d{5,}/) || ['sin_numero'])[0];
}

async function yaProcesado(messageId: string): Promise<boolean> {
  try {
    const { data } = await sb.from('mail_procesados').select('message_id').eq('message_id', messageId).maybeSingle();
    return !!data;
  } catch { return false; }
}
async function marcarProcesado(messageId: string, asunto: string) {
  try {
    await sb.from('mail_procesados').upsert(
      [{ message_id: messageId, fuente: P, asunto, procesado_en: new Date().toISOString() }],
      { onConflict: 'message_id' });
  } catch { /* noop */ }
}

/** Convierte el cuerpo HTML de la factura en un PDF fiel (A4, con estilos). */
async function facturaAPdf(browser: Browser, html: string): Promise<Buffer | null> {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 20000 }).catch(async () => {
      // si alguna imagen remota no carga a tiempo, seguimos con lo que haya
      await page.setContent(html, { waitUntil: 'load', timeout: 10000 }).catch(() => {});
    });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
    return Buffer.from(pdf);
  } catch (e: any) {
    await log(P, 'aviso', `no pude generar el PDF de la factura: ${String(e?.message || e).slice(0, 80)}`);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

async function conectar(): Promise<ImapFlow | null> {
  for (const host of candidatosHost()) {
    for (const [port, secure] of [[993, true], [143, false]] as const) {
      const client = new ImapFlow({ host, port, secure, auth: { user: USER, pass: PASS }, logger: false, emitLogs: false });
      try {
        await client.connect();
        await log(P, 'conexion_ok', `${host}:${port} (${secure ? 'SSL' : 'STARTTLS'})`);
        return client;
      } catch (e: any) {
        const msg = String(e?.responseText || e?.message || e).slice(0, 90);
        await log(P, 'conexion_ko', `${host}:${port} → ${msg}`);
        try { await client.close(); } catch { /* noop */ }
      }
    }
  }
  return null;
}

/** Procesa UN buzón, 100% aislado. */
async function procesarBuzon(client: ImapFlow, ruta: string, browser: Browser): Promise<[number, number]> {
  let vistas = 0, entregadas = 0;
  let lock;
  try { lock = await client.getMailboxLock(ruta); } catch { return [0, 0]; }
  try {
    let uids: number[] = [];
    const desde = new Date(Date.now() - 60 * 86400000);
    try { uids = await client.search({ since: desde }, { uid: true }) as number[]; }
    catch {
      try { uids = await client.search({ all: true }, { uid: true }) as number[]; }
      catch { return [0, 0]; }
    }
    uids = (uids || []).filter(n => Number.isInteger(n) && n > 0);
    if (!uids.length) return [0, 0];
    if (uids.length > 300) uids = uids.slice(-300);
    const rango = uids.join(',');

    try {
      for await (const msg of client.fetch(rango, { envelope: true, source: true }, { uid: true })) {
        try {
          const de = (msg.envelope?.from || []).map(f => `${f.address || ''}`).join(' ');
          const asunto = msg.envelope?.subject || '';
          if (!REMITENTE.test(de) || !ASUNTO.test(asunto)) continue;
          vistas++;
          const mid = msg.envelope?.messageId || `${ruta}:${msg.uid}`;
          if (await yaProcesado(mid)) continue;

          const mail = await simpleParser(msg.source as Buffer);
          const fecha = mail.date || new Date();
          const num = numFactura(asunto);
          let entregada = false;

          // 1) Si por lo que sea viniera un PDF adjunto, se usa tal cual.
          for (const adj of mail.attachments || []) {
            if (!adj.content || !adj.content.length) continue;
            const esPdf = /pdf$/i.test(adj.contentType || '') || /\.pdf$/i.test(adj.filename || '');
            if (!esPdf) continue;
            const nombre = adj.filename || `justeat_factura_${num}.pdf`;
            if (await entregar({ fuente: 'justeat', tipo: 'justeat_factura', nombre, datos: adj.content as Buffer, periodo: quincenaDe(fecha), destino: 'facturas' })) entregada = true;
          }

          // 2) Caso real de Just Eat: la factura es el CUERPO del correo → PDF.
          if (!entregada) {
            const html = mail.html || mail.textAsHtml || (mail.text ? `<pre>${mail.text}</pre>` : '');
            if (html) {
              const pdf = await facturaAPdf(browser, html);
              if (pdf && pdf.length > 1000) {
                if (await entregar({ fuente: 'justeat', tipo: 'justeat_factura', nombre: `justeat_factura_${num}.pdf`, datos: pdf, periodo: quincenaDe(fecha), destino: 'facturas' })) entregada = true;
              }
            }
          }

          // Solo se marca como procesado si la factura entró de verdad.
          if (entregada) {
            entregadas++;
            await marcarProcesado(mid, asunto);
            await marcarConseguido('justeat', quincenaDe(fecha), 'factura_correo', `nº ${num}: ${asunto}`);
          } else {
            await log(P, 'sin_entregar', `factura ${num} no entregada (se reintentará): ${asunto}`);
          }
        } catch { /* un correo roto no detiene el buzón */ }
      }
    } catch (e: any) {
      const msg = String(e?.responseText || e?.message || e).slice(0, 100);
      await log(P, 'aviso', `buzón ${ruta}: lectura interrumpida (${msg}); sigo con el resto`);
    }
  } finally { try { lock?.release(); } catch { /* noop */ } }
  return [vistas, entregadas];
}

async function main() {
  if (!USER || !PASS) {
    await log(P, 'sin_credenciales', 'faltan los secretos JE_MAIL_USER / JE_MAIL_PASS');
    return;
  }
  let client = await conectar();
  if (!client) {
    await log(P, 'error', `no pude conectar a ningún servidor IMAP (probados: ${candidatosHost().join(', ') || 'ninguno'})`);
    await latido(P, new Date(), 'sin conexión IMAP');
    return;
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  let vistas = 0, entregadas = 0, avisos = 0;
  let buzones: { path: string }[] = [];
  try { buzones = (await client.list()).map(b => ({ path: b.path })); }
  catch { buzones = [{ path: 'INBOX' }]; }
  if (!buzones.some(b => /^inbox$/i.test(b.path))) buzones.unshift({ path: 'INBOX' });

  try {
    for (const bz of buzones) {
      if (/deleted|borrad|papelera|trash/i.test(bz.path)) continue;
      try {
        if (!client || !(client as any).usable) {
          try { await client?.logout(); } catch { /* noop */ }
          client = await conectar();
          if (!client) { await log(P, 'aviso', `conexión perdida y no recuperada; me quedo con lo leído hasta ${bz.path}`); break; }
        }
        const [v, e] = await procesarBuzon(client, bz.path, browser);
        vistas += v; entregadas += e;
      } catch (e: any) {
        avisos++;
        const msg = String(e?.responseText || e?.message || e).slice(0, 100);
        await log(P, 'aviso', `buzón ${bz.path}: ${msg}; sigo con el siguiente`);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  await log(P, 'ok', `correos JE vistos=${vistas} · facturas nuevas en bandeja=${entregadas}${avisos ? ` · buzones con aviso=${avisos}` : ''}`);
  await latido(P, new Date(), `vistas=${vistas} entregadas=${entregadas}`);
  try { await client?.logout(); } catch { /* noop */ }
}
main().catch((e) => { console.error(e); process.exit(1); });
