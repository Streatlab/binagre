/**
 * PORTAL · Lo común a todos los robots de portal (Uber, Glovo, Just Eat).
 *
 *  · Credenciales: tabla `robot_credenciales` en Supabase (NO en el repo, NO en
 *    los secretos de GitHub). Se cambian sin tocar código ni workflows.
 *  · Sesión: se guarda el estado del navegador en el bucket 'informes-plataforma'
 *    (sesiones/<plataforma>.json) para no tener que pedir código cada día.
 *  · Código de un solo uso: se lee del buzón facturasstreat@gmail.com por IMAP,
 *    con la misma contraseña de aplicación que ya usa el cartero
 *    (tabla `cartero_credenciales`). No marca leídos ni mueve nada: el cartero
 *    sigue funcionando igual.
 */
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { BrowserContext } from 'playwright';
import { sb, BUCKET, log } from './bandeja.js';

export interface Credenciales {
  usuario: string;
  password: string;
  otp_remitente: string | null;
}

/** Devuelve las credenciales de la plataforma, o null si aún no están puestas. */
export async function credenciales(plataforma: string): Promise<Credenciales | null> {
  const { data } = await sb
    .from('robot_credenciales')
    .select('usuario, password, otp_remitente, activo')
    .eq('plataforma', plataforma)
    .maybeSingle();
  if (!data || !data.activo || !data.usuario || !data.password) return null;
  return { usuario: data.usuario, password: data.password, otp_remitente: data.otp_remitente };
}

// ── Sesión persistida ───────────────────────────────────────────────────────
const rutaSesion = (p: string) => `sesiones/${p}.json`;

export async function cargarSesion(plataforma: string): Promise<Record<string, unknown> | undefined> {
  try {
    const { data, error } = await sb.storage.from(BUCKET).download(rutaSesion(plataforma));
    if (error || !data) return undefined;
    const texto = await data.text();
    return JSON.parse(texto);
  } catch { return undefined; }
}

export async function guardarSesion(plataforma: string, ctx: BrowserContext) {
  try {
    const estado = await ctx.storageState();
    await sb.storage.from(BUCKET).upload(
      rutaSesion(plataforma),
      Buffer.from(JSON.stringify(estado), 'utf-8'),
      { contentType: 'application/json', upsert: true },
    );
    await log(plataforma, 'sesion', 'sesión guardada para la próxima vez');
  } catch (e: any) {
    await log(plataforma, 'aviso', `no he podido guardar la sesión: ${e?.message || e}`);
  }
}

// ── Código de un solo uso por correo ────────────────────────────────────────
async function buzon(): Promise<ImapFlow | null> {
  const { data } = await sb
    .from('cartero_credenciales')
    .select('email, app_password')
    .eq('id', 1)
    .maybeSingle();
  if (!data?.email || !data?.app_password) return null;
  const cli = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: data.email, pass: data.app_password },
    logger: false,
  });
  await cli.connect();
  return cli;
}

/**
 * Espera a que llegue un correo del remitente indicado con un código de 4-8
 * dígitos. Sondea cada 5 s hasta `segundos`. Devuelve el código o null.
 * No modifica los correos (ni leídos, ni movidos).
 */
export async function esperarCodigo(
  plataforma: string,
  remitente: string,
  segundos = 120,
): Promise<string | null> {
  const desde = new Date(Date.now() - 10 * 60 * 1000); // 10 min de margen
  const limite = Date.now() + segundos * 1000;

  while (Date.now() < limite) {
    let cli: ImapFlow | null = null;
    try {
      cli = await buzon();
      if (!cli) { await log(plataforma, 'otp_sin_buzon', 'no hay credenciales de correo del cartero'); return null; }
      const lock = await cli.getMailboxLock('INBOX');
      try {
        const uids = await cli.search({ since: desde, from: remitente });
        const lista = Array.isArray(uids) ? uids.slice(-10).reverse() : [];
        for (const uid of lista) {
          const msg = await cli.fetchOne(String(uid), { source: true }, { uid: true });
          if (!msg || !msg.source) continue;
          const parsed = await simpleParser(msg.source as Buffer);
          const texto = `${parsed.subject || ''}\n${parsed.text || ''}`;
          const m = texto.match(/\b(\d{4,8})\b/);
          if (m) {
            await log(plataforma, 'otp_ok', `código recibido de ${remitente}`);
            return m[1];
          }
        }
      } finally { lock.release(); }
    } catch (e: any) {
      await log(plataforma, 'otp_aviso', String(e?.message || e));
    } finally {
      try { await cli?.logout(); } catch { /* noop */ }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  await log(plataforma, 'otp_no_recibido', `no llegó código de ${remitente} en ${segundos}s`);
  return null;
}
