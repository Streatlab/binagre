/**
 * JUST EAT FACTURAS POR CORREO · justeat-mail.ts (17-jul-2026)
 *
 * POR QUÉ EXISTE: el Partner Hub de Just Eat bloquea a los servidores de GitHub
 * (WAF Cloudflare, evidencia en robot_log estado bloqueo_waf). Pero Rubén
 * confirmó con captura que Just Eat envía CADA factura por email a
 * admin@streatlab.com (remitente *@justeat-int.com, asunto "Just-eat invoice:
 * NNNNNNN", con la factura adjunta) — a menudo marcada como SPAM. Este robot
 * lee el buzón por IMAP y deja los adjuntos en la bandeja. El WAF deja de
 * existir para nosotros.
 *
 * SECRETOS NECESARIOS (GitHub Actions):
 *  - JE_MAIL_USER  → admin@streatlab.com (o el buzón que corresponda)
 *  - JE_MAIL_PASS  → contraseña de aplicación de esa cuenta (Microsoft 365)
 *
 * Idempotencia doble: Message-ID en mail_procesados + huella sha256 de entregar().
 * Repetir corridas es inofensivo.
 */
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { sb, log, latido, entregar, marcarConseguido } from './_lib/bandeja.js';

const P = 'justeat_mail';
const HOST = process.env.JE_MAIL_HOST || 'outlook.office365.com';
const USER = process.env.JE_MAIL_USER || '';
const PASS = process.env.JE_MAIL_PASS || '';
const REMITENTE = /justeat-int\.com|just-?eat/i;
const ASUNTO = /invoice|factura/i;

/** Quincena a la que pertenece una fecha (para marcar el objetivo de insistencia). */
function quincenaDe(d: Date): string {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);
  const dia = Number(iso.slice(8, 10));
  return `${iso.slice(0, 7)}-Q${dia <= 15 ? 1 : 2}`;
}

async function yaProcesado(messageId: string): Promise<boolean> {
  try {
    const { data } = await sb.from('mail_procesados').select('message_id')
      .eq('message_id', messageId).maybeSingle();
    return !!data;
  } catch { return false; }
}
async function marcarProcesado(messageId: string, asunto: string) {
  try {
    await sb.from('mail_procesados').upsert(
      [{ message_id: messageId, fuente: P, asunto, procesado_en: new Date().toISOString() }],
      { onConflict: 'message_id' },
    );
  } catch { /* noop */ }
}

async function main() {
  if (!USER || !PASS) {
    await log(P, 'sin_credenciales', 'faltan los secretos JE_MAIL_USER / JE_MAIL_PASS en GitHub — pídeselos a Rubén');
    return;
  }
  const client = new ImapFlow({
    host: HOST, port: 993, secure: true,
    auth: { user: USER, pass: PASS },
    logger: false,
  });

  let entregadas = 0, vistas = 0;
  try {
    await client.connect();

    // Recorre TODOS los buzones (las facturas suelen caer en spam/junk)
    const buzones = await client.list();
    for (const bz of buzones) {
      // Salta papeleras de borrado definitivo; spam/junk SÍ se mira.
      if (/deleted|borrad/i.test(bz.path)) continue;
      let lock;
      try { lock = await client.getMailboxLock(bz.path); } catch { continue; }
      try {
        // Últimos 60 días, del remitente Just Eat
        const desde = new Date(Date.now() - 60 * 86400000);
        const uids = await client.search({ since: desde }, { uid: true });
        if (!uids || !uids.length) continue;
        for await (const msg of client.fetch(uids, { uid: true, envelope: true, source: true })) {
          const de = (msg.envelope?.from || []).map(f => `${f.address || ''}`).join(' ');
          const asunto = msg.envelope?.subject || '';
          if (!REMITENTE.test(de) || !ASUNTO.test(asunto)) continue;
          vistas++;
          const mid = msg.envelope?.messageId || `${bz.path}:${msg.uid}`;
          if (await yaProcesado(mid)) continue;

          const mail = await simpleParser(msg.source as Buffer);
          const fecha = mail.date || new Date();
          let algunaEntrega = false;
          for (const adj of mail.attachments || []) {
            if (!adj.content || !adj.content.length) continue;
            const nombre = adj.filename || `justeat_factura_${(asunto.match(/\d{5,}/) || ['sin_numero'])[0]}.pdf`;
            const ok = await entregar({
              fuente: 'justeat',
              tipo: 'justeat_factura',
              nombre,
              datos: adj.content as Buffer,
              periodo: quincenaDe(fecha),
              destino: 'facturas',
            });
            if (ok) { entregadas++; algunaEntrega = true; }
          }
          if (algunaEntrega || (mail.attachments || []).length === 0) {
            await marcarProcesado(mid, asunto);
          }
          if (algunaEntrega) {
            await marcarConseguido('justeat', quincenaDe(fecha), 'facturas_quincena', `vía correo: ${asunto}`);
          }
        }
      } finally {
        lock?.release();
      }
    }

    await log(P, 'ok', `correos JE vistos=${vistas} · facturas nuevas en bandeja=${entregadas}`);
    await latido(P, new Date(), `vistas=${vistas} entregadas=${entregadas}`);
  } catch (e: any) {
    await log(P, 'error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    try { await client.logout(); } catch { /* noop */ }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
