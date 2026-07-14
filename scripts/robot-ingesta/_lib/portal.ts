/**
 * PORTAL · Lo común a todos los robots de portal (Uber, Glovo, Just Eat).
 *
 *  · Credenciales: tabla `robot_credenciales` en Supabase (NO en el repo).
 *  · Sesión: se guarda el estado del navegador en el bucket 'informes-plataforma'.
 *  · Código de un solo uso: se lee del buzón del cartero por IMAP.
 *
 * 14-jul-2026 · IMPORTANTE: solo vale el código del correo que llega DESPUÉS de
 * pedirlo. Antes se cogía cualquier correo de los últimos 15 min y se metía un
 * código ya caducado → el portal lo rechazaba. Ahora se descartan los correos
 * anteriores al momento de pedirlo y se coge siempre el más reciente.
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
const CARPETAS = ['INBOX', '[Gmail]/Spam', '[Gmail]/Todos', '[Gmail]/All Mail'];

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

interface Hallazgo { codigo: string; fecha: number }

/** Busca en una carpeta el correo MÁS RECIENTE del remitente posterior a `desde`. */
async function buscarEn(cli: ImapFlow, carpeta: string, remitente: string, desde: Date): Promise<Hallazgo | null> {
  let lock;
  try { lock = await cli.getMailboxLock(carpeta); } catch { return null; }
  try {
    const dia = new Date(desde.getTime() - 24 * 60 * 60 * 1000);
    const uids = await cli.search({ since: dia });
    const lista = Array.isArray(uids) ? uids.slice(-30).reverse() : [];
    let mejor: Hallazgo | null = null;
    for (const uid of lista) {
      const msg = await cli.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const parsed = await simpleParser(msg.source as Buffer);
      const fecha = parsed.date ? parsed.date.getTime() : 0;
      if (fecha < desde.getTime()) continue;                       // correo viejo → código caducado
      const de = `${(parsed.from as any)?.text || ''}`.toLowerCase();
      const asunto = `${parsed.subject || ''}`;
      if (!de.includes(remitente.toLowerCase()) && !asunto.toLowerCase().includes(remitente.toLowerCase())) continue;
      const m = `${asunto}\n${parsed.text || ''}`.match(/\b(\d{4,8})\b/);
      if (!m) continue;
      if (!mejor || fecha > mejor.fecha) mejor = { codigo: m[1], fecha };
    }
    return mejor;
  } finally { try { lock?.release(); } catch { /* noop */ } }
}

/** Deja en el log qué ha llegado últimamente, para saber si el reenvío funciona. */
async function radiografia(cli: ImapFlow, plataforma: string, desde: Date) {
  try {
    const lock = await cli.getMailboxLock('INBOX');
    try {
      const uids = await cli.search({ since: new Date(desde.getTime() - 24 * 60 * 60 * 1000) });
      const lista = Array.isArray(uids) ? uids.slice(-8).reverse() : [];
      const filas: string[] = [];
      for (const uid of lista) {
        const msg = await cli.fetchOne(String(uid), { envelope: true }, { uid: true });
        const de = (msg as any)?.envelope?.from?.[0]?.address || '?';
        const asunto = (msg as any)?.envelope?.subject || '?';
        filas.push(`${de} · ${asunto}`.slice(0, 90));
      }
      await log(plataforma, 'buzon', filas.length ? filas.join(' || ') : 'no ha llegado NADA al buzón del cartero');
    } finally { lock.release(); }
  } catch { /* noop */ }
}

/**
 * Espera el código que llega DESPUÉS de `pedidoEn` (por defecto, ahora mismo).
 * Sondea cada 5 s hasta `segundos`. Devuelve el código o null.
 */
export async function esperarCodigo(
  plataforma: string,
  remitente: string,
  segundos = 180,
  pedidoEn: Date = new Date(Date.now() - 60 * 1000),
): Promise<string | null> {
  const limite = Date.now() + segundos * 1000;

  while (Date.now() < limite) {
    let cli: ImapFlow | null = null;
    try {
      cli = await buzon();
      if (!cli) { await log(plataforma, 'otp_sin_buzon', 'no hay credenciales de correo del cartero'); return null; }
      let mejor: Hallazgo | null = null;
      let donde = '';
      for (const carpeta of CARPETAS) {
        const h = await buscarEn(cli, carpeta, remitente, pedidoEn);
        if (h && (!mejor || h.fecha > mejor.fecha)) { mejor = h; donde = carpeta; }
      }
      if (mejor) {
        await log(plataforma, 'otp_ok', `código nuevo de ${remitente} (${new Date(mejor.fecha).toISOString()}) en ${donde}`);
        return mejor.codigo;
      }
    } catch (e: any) {
      await log(plataforma, 'otp_aviso', String(e?.message || e));
    } finally {
      try { await cli?.logout(); } catch { /* noop */ }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  let cli: ImapFlow | null = null;
  try {
    cli = await buzon();
    if (cli) await radiografia(cli, plataforma, pedidoEn);
  } catch { /* noop */ } finally { try { await cli?.logout(); } catch { /* noop */ } }

  await log(plataforma, 'otp_no_recibido', `no llegó código nuevo de ${remitente} en ${segundos}s`);
  return null;
}
