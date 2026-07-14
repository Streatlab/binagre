/**
 * PORTAL · Lo común a todos los robots de portal (Uber, Glovo, Just Eat).
 *
 *  · Credenciales: tabla `robot_credenciales` en Supabase (NO en el repo).
 *  · Sesión: estado del navegador guardado en el bucket 'informes-plataforma'.
 *  · Código de un solo uso: se lee POR IMAP del buzón de origen (tabla `buzones_otp`)
 *    y, de respaldo, del buzón del cartero en Gmail.
 *
 * Tres reglas que costaron sangre (14-jul-2026):
 *   1) Solo vale el código de un correo posterior al momento de pedirlo.
 *   2) El correo debe HABLAR de código/verificación: una factura de Glovo también
 *      viene de glovo y trae números de 6 cifras.
 *   3) EL FALLO GORDO: `search()` de imapflow devuelve números de ORDEN, no UID.
 *      Si luego se pide el correo por UID, no aparece nada aunque esté ahí.
 *      Hay que pedir `search(..., { uid: true })`. Por esto el robot juraba que el
 *      buzón estaba vacío mientras el correo del código estaba dentro.
 *   Además: un reenvío a Gmail se pierde (SPF/DMARC) y el filtro de Roundcube que
 *   redirige SIN copia se lleva el correo del buzón. Por eso se lee el de origen.
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
const CARPETAS_GMAIL = ['INBOX', '[Gmail]/Spam', '[Gmail]/Todos', '[Gmail]/All Mail'];
const CARPETAS_CPANEL = ['INBOX', 'INBOX.spam', 'Junk', 'spam'];
const RE_ES_CODIGO = /c[oó]digo|code|verificaci[oó]n|verification|acceso|inicio de sesi[oó]n|one[- ]time/i;

interface Buzon { cli: ImapFlow; carpetas: string[]; nombre: string }

async function buzonOrigen(email: string): Promise<Buzon | null> {
  const { data } = await sb
    .from('buzones_otp')
    .select('email, host, puerto, password, activo')
    .eq('email', email)
    .eq('activo', true)
    .maybeSingle();
  if (!data?.password) return null;
  const cli = new ImapFlow({
    host: data.host,
    port: data.puerto || 993,
    secure: true,
    auth: { user: data.email, pass: data.password },
    logger: false,
  });
  await cli.connect();
  return { cli, carpetas: CARPETAS_CPANEL, nombre: `origen ${data.email}` };
}

async function buzonCartero(): Promise<Buzon | null> {
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
  return { cli, carpetas: CARPETAS_GMAIL, nombre: `cartero ${data.email}` };
}

async function abrirBuzones(email?: string): Promise<Buzon[]> {
  const lista: Buzon[] = [];
  if (email) { try { const b = await buzonOrigen(email); if (b) lista.push(b); } catch { /* noop */ } }
  try { const c = await buzonCartero(); if (c) lista.push(c); } catch { /* noop */ }
  return lista;
}

async function cerrar(buzones: Buzon[]) {
  for (const b of buzones) { try { await b.cli.logout(); } catch { /* noop */ } }
}

interface Hallazgo { codigo: string; fecha: number }

/** Correo más reciente del remitente, posterior a `desde`, que hable de código. */
async function buscarEn(cli: ImapFlow, carpeta: string, remitente: string, desde: Date): Promise<Hallazgo | null> {
  let lock;
  try { lock = await cli.getMailboxLock(carpeta); } catch { return null; }
  try {
    // OJO: sin { uid: true } esto devuelve números de orden, no UIDs (ver cabecera).
    const uids = await cli.search({ since: new Date(desde.getTime() - 24 * 60 * 60 * 1000) }, { uid: true });
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

/** Deja en el log qué ha llegado a cada buzón (para ver dónde se pierde el correo). */
async function radiografia(buzones: Buzon[], plataforma: string, desde: Date) {
  for (const b of buzones) {
    let lock;
    try { lock = await b.cli.getMailboxLock('INBOX'); } catch { continue; }
    try {
      const uids = await b.cli.search({ since: new Date(desde.getTime() - 60 * 60 * 1000) }, { uid: true });
      const lista = Array.isArray(uids) ? uids.slice(-6).reverse() : [];
      const filas: string[] = [];
      for (const uid of lista) {
        const msg = await b.cli.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg?.source) continue;
        const p = await simpleParser(msg.source as Buffer);
        filas.push(`${(p.from as any)?.text || '?'} · ${p.subject || '?'}`.slice(0, 100));
      }
      await log(plataforma, 'buzon', `${b.nombre}: ${filas.length ? filas.join(' || ') : 'nada en la última hora'}`);
    } finally { try { lock?.release(); } catch { /* noop */ } }
  }
}

/**
 * Espera el código que llega DESPUÉS de `pedidoEn`.
 * `emailCuenta` = buzón donde la plataforma manda el código (el de la cuenta).
 */
export async function esperarCodigo(
  plataforma: string,
  remitente: string,
  segundos = 240,
  pedidoEn: Date = new Date(Date.now() - 60 * 1000),
  emailCuenta?: string,
): Promise<string | null> {
  const limite = Date.now() + segundos * 1000;

  while (Date.now() < limite) {
    let buzones: Buzon[] = [];
    try {
      buzones = await abrirBuzones(emailCuenta);
      if (buzones.length === 0) { await log(plataforma, 'otp_sin_buzon', 'no hay ningún buzón con clave puesta'); return null; }

      let mejor: Hallazgo | null = null;
      let donde = '';
      for (const b of buzones) {
        for (const carpeta of b.carpetas) {
          const h = await buscarEn(b.cli, carpeta, remitente, pedidoEn);
          if (h && (!mejor || h.fecha > mejor.fecha)) { mejor = h; donde = `${b.nombre}/${carpeta}`; }
        }
      }
      if (mejor) {
        await log(plataforma, 'otp_ok', `código ${mejor.codigo} de ${remitente} en ${donde}`);
        return mejor.codigo;
      }
    } catch (e: any) {
      await log(plataforma, 'otp_aviso', String(e?.message || e));
    } finally {
      await cerrar(buzones);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  let buzones: Buzon[] = [];
  try {
    buzones = await abrirBuzones(emailCuenta);
    await radiografia(buzones, plataforma, pedidoEn);
  } catch { /* noop */ } finally { await cerrar(buzones); }

  await log(plataforma, 'otp_no_recibido', `no llegó código nuevo de ${remitente} en ${segundos}s`);
  return null;
}
