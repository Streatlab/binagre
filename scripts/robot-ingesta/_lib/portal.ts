/**
 * PORTAL · Lo común a todos los robots de portal (Uber, Glovo, Just Eat).
 *
 *  · Credenciales: tabla `robot_credenciales` en Supabase (NO en el repo).
 *  · Sesión: estado del navegador guardado en el bucket 'informes-plataforma'.
 *  · Código de un solo uso: se lee del buzón del cartero por IMAP.
 *
 * 14-jul-2026 · Dos reglas que costaron sangre:
 *   1) Solo vale el código de un correo posterior al momento de pedirlo. Un correo
 *      viejo trae un código caducado y el portal lo rechaza.
 *   2) No basta con que el remitente sea de la plataforma: una factura de Glovo
 *      también viene de glovo y tiene números de 6 cifras. El correo debe HABLAR
 *      de código/verificación.
 * Si no aparece, se deja en el log qué ha llegado al buzón (remitente + asunto).
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
const RE_ES_CODIGO = /c[oó]digo|code|verificaci[oó]n|verification|acceso|inicio de sesi[oó]n|one[- ]time/i;

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

/** Correo más reciente del remitente, posterior a `desde`, que hable de código. */
async function buscarEn(cli: ImapFlow, carpeta: string, remitente: string, desde: Date): Promise<Hallazgo | null> {
  let lock;
  try { lock = await cli.getMailboxLock(carpeta); } catch { return null; }
  try {
    const uids = await cli.search({ since: new Date(desde.getTime() - 24 * 60 * 60 * 1000) });
    const lista = Array.isArray(uids) ? uids.slice(-30).reverse() : [];
    let mejor: Hallazgo | null = null;
    for (const uid of lista) {
      const msg = await cli.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const parsed = await simpleParser(msg.source as Buffer);
      const fecha = parsed.date ? parsed.date.getTime() : 0;
      if (fecha < desde.getTime()) continue;
      const de = `${(parsed.from as any)?.text || ''}`.toLowerCase();
      const asunto = `${parsed.subject || ''}`;
      const cuerpo = `${parsed.text || ''}`;
      if (!de.includes(remitente.toLowerCase())) continue;
      if (!RE_ES_CODIGO.test(`${asunto} ${cuerpo}`)) continue;      // facturas y resúmenes fuera
      const m = `${asunto}\n${cuerpo}`.match(/\b(\d{4,8})\b/);
      if (!m) continue;
      if (!mejor || fecha > mejor.fecha) mejor = { codigo: m[1], fecha };
    }
    return mejor;
  } finally { try { lock?.release(); } catch { /* noop */ } }
}

/** Deja en el log qué ha llegado al buzón del cartero (para ver si el reenvío entra). */
async function radiografia(cli: ImapFlow, plataforma: string, desde: Date) {
  for (const carpeta of ['INBOX', '[Gmail]/Todos', '[Gmail]/All Mail']) {
    let lock;
    try { lock = await cli.getMailboxLock(carpeta); } catch { continue; }
    try {
      const uids = await cli.search({ since: new Date(desde.getTime() - 60 * 60 * 1000) });
      const lista = Array.isArray(uids) ? uids.slice(-6).reverse() : [];
      const filas: string[] = [];
      for (const uid of lista) {
        const msg = await cli.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg?.source) continue;
        const p = await simpleParser(msg.source as Buffer);
        filas.push(`${(p.from as any)?.text || '?'} · ${p.subject || '?'} · ${p.date?.toISOString() || '?'}`.slice(0, 110));
      }
      await log(plataforma, 'buzon', `${carpeta}: ${filas.length ? filas.join(' || ') : 'nada en la última hora'}`);
    } finally { try { lock?.release(); } catch { /* noop */ } }
  }
}

/** Espera el código que llega DESPUÉS de `pedidoEn`. Devuelve el código o null. */
export async function esperarCodigo(
  plataforma: string,
  remitente: string,
  segundos = 240,
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
        await log(plataforma, 'otp_ok', `código ${mejor.codigo} de ${remitente} (${new Date(mejor.fecha).toISOString()}) en ${donde}`);
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
