/**
 * JUST EAT FACTURAS POR CORREO · justeat-mail.ts (17-jul-2026)
 *
 * POR QUÉ EXISTE: el Partner Hub de Just Eat bloquea a los servidores de GitHub
 * (WAF Cloudflare). Pero Just Eat envía CADA factura por email a un buzón de
 * Streat Lab (remitente *@justeat-int.com, asunto "Just-eat invoice: NNNNNNN",
 * con la factura adjunta) — a menudo marcada como SPAM. Este robot lee el buzón
 * por IMAP y deja los adjuntos en la bandeja. El WAF deja de existir.
 *
 * El buzón NO es Microsoft: es hosting propio. Secretos:
 *  - JE_MAIL_HOST → servidor IMAP (p. ej. mail.streatlab.com)
 *  - JE_MAIL_USER → admin@streatlab.com
 *  - JE_MAIL_PASS → contraseña normal del buzón
 *
 * Idempotencia: Message-ID en mail_procesados + huella sha256 de entregar().
 */
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
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

/** Procesa UN buzón, aislado: un fallo aquí no tumba el resto. Devuelve [vistas, entregadas]. */
async function procesarBuzon(client: ImapFlow, ruta: string): Promise<[number, number]> {
  let vistas = 0, entregadas = 0;
  let lock;
  try { lock = await client.getMailboxLock(ruta); } catch { return [0, 0]; }
  try {
    // Búsqueda robusta: primero por fecha; si el servidor la rechaza, todo el buzón.
    let uids: number[] = [];
    const desde = new Date(Date.now() - 60 * 86400000);
    try { uids = await client.search({ since: desde }, { uid: true }) as number[]; }
    catch {
      try { uids = await client.search({ all: true }, { uid: true }) as number[]; }
      catch { return [0, 0]; }
    }
    if (!uids || !uids.length) return [0, 0];
    // Solo los últimos 300 por buzón, por si acaso
    if (uids.length > 300) uids = uids.slice(-300);

    for await (const msg of client.fetch(uids, { uid: true, envelope: true, source: true })) {
      try {
        const de = (msg.envelope?.from || []).map(f => `${f.address || ''}`).join(' ');
        const asunto = msg.envelope?.subject || '';
        if (!REMITENTE.test(de) || !ASUNTO.test(asunto)) continue;
        vistas++;
        const mid = msg.envelope?.messageId || `${ruta}:${msg.uid}`;
        if (await yaProcesado(mid)) continue;

        const mail = await simpleParser(msg.source as Buffer);
        const fecha = mail.date || new Date();
        let algunaEntrega = false;
        for (const adj of mail.attachments || []) {
          if (!adj.content || !adj.content.length) continue;
          const nombre = adj.filename || `justeat_factura_${(asunto.match(/\d{5,}/) || ['sin_numero'])[0]}.pdf`;
          const ok = await entregar({ fuente: 'justeat', tipo: 'justeat_factura', nombre, datos: adj.content as Buffer, periodo: quincenaDe(fecha), destino: 'facturas' });
          if (ok) { entregadas++; algunaEntrega = true; }
        }
        if (algunaEntrega || (mail.attachments || []).length === 0) await marcarProcesado(mid, asunto);
        if (algunaEntrega) await marcarConseguido('justeat', quincenaDe(fecha), 'facturas_quincena', `vía correo: ${asunto}`);
      } catch { /* un correo roto no detiene el buzón */ }
    }
  } finally { lock?.release(); }
  return [vistas, entregadas];
}

async function main() {
  if (!USER || !PASS) {
    await log(P, 'sin_credenciales', 'faltan los secretos JE_MAIL_USER / JE_MAIL_PASS');
    return;
  }
  const client = await conectar();
  if (!client) {
    await log(P, 'error', `no pude conectar a ningún servidor IMAP (probados: ${candidatosHost().join(', ') || 'ninguno'})`);
    await latido(P, new Date(), 'sin conexión IMAP');
    return;
  }

  let vistas = 0, entregadas = 0;
  try {
    let buzones: { path: string }[] = [];
    try { buzones = (await client.list()).map(b => ({ path: b.path })); }
    catch { buzones = [{ path: 'INBOX' }]; }
    // Asegura INBOX aunque list() no lo devuelva
    if (!buzones.some(b => /^inbox$/i.test(b.path))) buzones.unshift({ path: 'INBOX' });

    for (const bz of buzones) {
      if (/deleted|borrad|papelera|trash/i.test(bz.path)) continue;
      const [v, e] = await procesarBuzon(client, bz.path);
      vistas += v; entregadas += e;
    }
    await log(P, 'ok', `correos JE vistos=${vistas} · facturas nuevas en bandeja=${entregadas}`);
    await latido(P, new Date(), `vistas=${vistas} entregadas=${entregadas}`);
  } catch (e: any) {
    await log(P, 'error', `procesando: ${String(e?.responseText || e?.message || e).slice(0, 120)}`);
    process.exitCode = 1;
  } finally {
    try { await client.logout(); } catch { /* noop */ }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
