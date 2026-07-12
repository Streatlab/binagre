/**
 * PORTAL · Lo común a todos los robots de portal (Uber, Glovo, Just Eat).
 *
 *  · Credenciales: tabla `robot_credenciales` en Supabase (NO en el repo, NO en
 *    los secretos de GitHub). Se cambian sin tocar código ni workflows.
 *    Una plataforma puede tener VARIAS cuentas (p.ej. Glovo: posmodernos y
 *    streatlab): el robot las recorre todas, una detrás de otra.
 *  · Sesión: se guarda el estado del navegador en el bucket 'informes-plataforma'
 *    (sesiones/<plataforma>__<cuenta>.json) para no pedir código cada día.
 *  · Código de un solo uso: se lee del buzón del cartero por IMAP
 *    (tabla `cartero_credenciales`). No marca leídos ni mueve nada.
 */
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { BrowserContext } from 'playwright';
import { sb, BUCKET, log } from './bandeja.js';

export interface Cuenta {
  plataforma: string;
  cuenta: string;
  usuario: string;
  password: string;
  url_base: string | null;
  otp_remitente: string | null;
}

/** Todas las cuentas activas de una plataforma. Vacío = no hay claves puestas. */
export async function cuentasDe(plataforma: string): Promise<Cuenta[]> {
  const { data } = await sb
    .from('robot_credenciales')
    .select('plataforma, cuenta, usuario, password, url_base, otp_remitente, activo')
    .eq('plataforma', plataforma)
    .eq('activo', true)
    .order('cuenta');
  return (data || []).filter((c: any) => c.usuario && c.password) as Cuenta[];
}

// ── Sesión persistida ───────────────────────────────────────────────────────
const rutaSesion = (p: string, c: string) => `sesiones/${p}__${c}.json`;

export async function cargarSesion(plataforma: string, cuenta: string): Promise<Record<string, unknown> | undefined> {
  try {
    const { data, error } = await sb.storage.from(BUCKET).download(rutaSesion(plataforma, cuenta));
    if (error || !data) return undefined;
    return JSON.parse(await data.text());
  } catch { return undefined; }
}

export async function guardarSesion(plataforma: string, cuenta: string, ctx: BrowserContext) {
  try {
    const estado = await ctx.storageState();
    await sb.storage.from(BUCKET).upload(
      rutaSesion(plataforma, cuenta),
      Buffer.from(JSON.stringify(estado), 'utf-8'),
      { contentType: 'application/json', upsert: true },
    );
    await log(plataforma, 'sesion', `${cuenta}: sesión guardada`);
  } catch (e: any) {
    await log(plataforma, 'aviso', `${cuenta}: no he podido guardar la sesión: ${e?.message || e}`);
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
 * Espera un correo del remitente indicado con un código de 4-8 dígitos.
 * Sondea cada 5 s hasta `segundos`. Devuelve el código o null.
 */
export async function esperarCodigo(
  plataforma: string,
  remitente: string,
  segundos = 120,
): Promise<string | null> {
  const desde = new Date(Date.now() - 10 * 60 * 1000);
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
          if (m) { await log(plataforma, 'otp_ok', `código recibido de ${remitente}`); return m[1]; }
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
