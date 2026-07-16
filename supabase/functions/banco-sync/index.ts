// BANCO · DESCARGA DE MOVIMIENTOS v5 · SOLO las cuentas marcadas como de empresa
// en la tabla banco_cuentas (descargar = true). Las personales ni se tocan.
// Deja los movimientos en banco_movimientos_raw y, en la misma pasada,
// vuelca a Conciliación los que sigan con volcado=false (fila a fila:
// un INSERT masivo dispara mal el nido de triggers de conciliacion).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const API = 'https://api.enablebanking.com';
const LLAVE = 'sl-banco-2026';
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const b64url = (b: ArrayBuffer | Uint8Array) => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const txt = (s: string) => b64url(new TextEncoder().encode(s));
const log = (estado: string, detalle: string) => sb.from('robot_log').insert([{ fuente: 'banco_sync', estado, detalle }]);
const latido = (ultimoDato: string, detalle: string) =>
  sb.from('robot_salud').upsert([{ fuente: 'banco_sync', ultima_ejecucion: new Date().toISOString(), ultimo_dato: ultimoDato, estado: 'ok', detalle }]);

async function jwt(appId: string, pem: string): Promise<string> {
  const cuerpo = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(cuerpo), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const ahora = Math.floor(Date.now() / 1000);
  const cab = txt(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId }));
  const carga = txt(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: ahora, exp: ahora + 3600 }));
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${cab}.${carga}`));
  return `${cab}.${carga}.${b64url(firma)}`;
}

async function huella(...partes: (string | number | null | undefined)[]) {
  const datos = new TextEncoder().encode(partes.map((p) => String(p ?? '')).join('|'));
  const h = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── VOLCADO banco_movimientos_raw → conciliacion ──────────────────────────
// Mismo mapeo que usa ocr-procesar-extracto (Papeleo) para no inventar un
// formato nuevo: concepto partido en "detalle - tipo de operación",
// dedup_key con la misma fórmula, reglas_conciliacion para categoría/proveedor.
function normalizarConcepto(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function capitalize(s: string): string {
  if (!s) return s;
  return s.toLowerCase().charAt(0).toUpperCase() + s.toLowerCase().slice(1);
}
function stripAccents(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function deducirTipoMov(concepto: string): string {
  const c = (concepto || '').toLowerCase();
  if (/pago con tarjeta|compra con tarjeta|\btarjeta\b/.test(c)) return 'tarjeta';
  if (/abono por transferencia|transferencia recibida|recibida en euros|abono a su favor/.test(c)) return 'transferencia_recibida';
  if (/transferencia realizada|transferencia emitida|transferencia enviada|enviada/.test(c)) return 'transferencia_emitida';
  if (/\badeudo\b|recibo|domiciliacion|domiciliado/.test(c)) return 'adeudo';
  if (/traspaso/.test(c)) return 'traspaso';
  if (/bizum/.test(c)) return 'bizum';
  if (/recarga|prepago/.test(c)) return 'recarga';
  if (/comision|comisiones/.test(c)) return 'comision';
  return 'otro';
}
async function md5hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('MD5', buf).catch(() => null);
  if (!hash) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return Math.abs(h).toString(16).padStart(8, '0').slice(0, 8);
  }
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}
interface ReglaConc {
  patron: string; categoria_codigo: string | null; set_proveedor: string | null;
  asigna_como: string | null; match_importe_min: number | null; match_importe_max: number | null;
}
function aplicarReglas(concepto: string, importe: number, reglas: ReglaConc[]) {
  const c = normalizarConcepto(concepto);
  for (const r of reglas) {
    if (!r.categoria_codigo || !r.patron) continue;
    if (r.match_importe_min != null && Math.abs(importe) < r.match_importe_min) continue;
    if (r.match_importe_max != null && Math.abs(importe) > r.match_importe_max) continue;
    if (r.asigna_como === 'ingreso' && importe <= 0) continue;
    if (r.asigna_como === 'gasto' && importe >= 0) continue;
    let ok = false;
    try { ok = new RegExp(r.patron, 'i').test(c); } catch { ok = c.includes(r.patron.toLowerCase()); }
    if (ok) return { categoria: r.categoria_codigo, proveedor: r.set_proveedor };
  }
  return { categoria: null as string | null, proveedor: null as string | null };
}

async function volcarPendientes() {
  const { data: pendientes } = await sb
    .from('banco_movimientos_raw').select('*').eq('volcado', false).order('fecha', { ascending: true });
  if (!pendientes || pendientes.length === 0) return { volcados: 0, bloqueados: 0, errores: 0 };

  const { data: cuentas } = await sb.from('banco_cuentas').select('iban, titular');
  const porIban = new Map((cuentas || []).map((c: any) => [c.iban, c.titular]));
  const { data: titulares } = await sb.from('titulares').select('id, nombre');
  const porTitularTxt = new Map((titulares || []).map((t: any) => [stripAccents(t.nombre), t.id]));
  const { data: reglas } = await sb.from('reglas_conciliacion')
    .select('patron, set_proveedor, categoria_codigo, asigna_como, match_importe_min, match_importe_max')
    .eq('activa', true).not('categoria_codigo', 'is', null).order('prioridad', { ascending: true });
  const reglasList = (reglas || []) as ReglaConc[];

  let volcados = 0, bloqueados = 0, errores = 0;
  for (const raw of pendientes) {
    const titularTxt: string | null = porIban.get(raw.iban) ?? raw.crudo?.titular ?? null;
    const titular_id = titularTxt ? porTitularTxt.get(stripAccents(titularTxt)) : null;
    if (!titular_id) {
      await log('volcado_sin_titular', `raw id=${raw.id} iban=${raw.iban}: no hay titular mapeado`);
      errores++;
      continue;
    }

    const segmentos = String(raw.concepto || '').split('//').map((s: string) => s.trim()).filter(Boolean);
    const rawMov = segmentos.length >= 2 ? segmentos[segmentos.length - 2] : '';
    const rawConc = segmentos.length >= 1 ? segmentos[segmentos.length - 1] : (raw.concepto || '');
    const concepto = rawMov && rawMov.toLowerCase() !== rawConc.toLowerCase()
      ? `${capitalize(rawConc)} - ${rawMov.toLowerCase()}`
      : capitalize(rawConc) || 'Sin concepto';

    const importe = Number(raw.importe);
    const { categoria, proveedor } = aplicarReglas(raw.concepto, importe, reglasList);
    const fecha = raw.fecha_valor || raw.fecha;
    const t8 = String(titular_id).replace(/-/g, '').slice(0, 8);
    const h8 = await md5hex(normalizarConcepto(concepto));
    const dedup_key = `${fecha}|${importe.toFixed(2)}|${t8}|${h8}|1`;

    const { data: ins, error } = await sb.from('conciliacion').insert([{
      fecha, fecha_valor: fecha, concepto, importe, categoria, proveedor, titular_id,
      doc_estado: 'falta', dedup_key,
      referencia: raw.entry_reference || null, tipo_mov: deducirTipoMov(raw.concepto),
      notas: `origen: banco ${raw.banco} (conexión oficial)`,
    }]).select('id');

    if (error) {
      // Validación de categoría/signo del trigger de conciliacion: no se puede
      // forzar desde aquí (el trigger reasigna categoría por su cuenta). Se
      // marca volcado para no bloquear el resto y se avisa para revisión manual.
      const rechazoCategoria = /incoherente con el signo/i.test(error.message);
      await log('volcado_error', `raw id=${raw.id}: ${error.message}`);
      if (rechazoCategoria) {
        await sb.from('bitacora_novedades').insert([{
          texto: `Movimiento bancario ${fecha} · ${importe}€ · "${concepto}" no se pudo volcar a Conciliación (conflicto de categoría automática). Revisar y meterlo a mano.`,
          etiquetas: ['banco', 'conciliacion'], usuario: 'robot',
        }]).then(() => {}, () => {});
        await sb.from('banco_movimientos_raw').update({ volcado: true }).eq('id', raw.id);
      }
      errores++;
      continue;
    }
    if (!ins || ins.length === 0) bloqueados++; else volcados++;
    await sb.from('banco_movimientos_raw').update({ volcado: true }).eq('id', raw.id);
  }
  await log(errores ? 'volcado_parcial' : 'volcado_ok', `pendientes=${pendientes.length} volcados=${volcados} bloqueados_dup=${bloqueados} errores=${errores}`);
  return { volcados, bloqueados, errores };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (url.searchParams.get('llave') !== LLAVE) return new Response('no', { status: 401 });

  const dias = Number(url.searchParams.get('dias') || 30);
  const desde = url.searchParams.get('desde') || new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const hasta = url.searchParams.get('hasta') || new Date().toISOString().slice(0, 10);
  const soloTitular = url.searchParams.get('titular');

  // ⭐ Lista blanca: solo las cuentas de empresa.
  const { data: permitidas } = await sb
    .from('banco_cuentas').select('iban, alias').eq('descargar', true);
  const blanca = new Map((permitidas || []).map((c: any) => [c.iban, c.alias]));
  if (blanca.size === 0) { await log('sin_cuentas', 'ninguna cuenta marcada para descargar'); return new Response('sin cuentas', { status: 200 }); }

  const { data: apps } = await sb
    .from('robot_credenciales').select('cuenta, usuario, password')
    .eq('plataforma', 'enablebanking').eq('activo', true);
  const { data: todas } = await sb
    .from('banco_sesiones').select('*').eq('estado', 'autorizada').order('id', { ascending: false });

  const porTitular = new Map<string, any>();
  for (const s of todas || []) {
    const t = s.titular || 'ruben';
    if (soloTitular && t !== soloTitular) continue;
    if (!porTitular.has(t)) porTitular.set(t, s);
  }
  if (porTitular.size === 0) { await log('sin_sesion', 'no hay conexiones autorizadas'); return new Response('sin sesion', { status: 200 }); }

  let nuevos = 0, vistos = 0;
  const errores: string[] = [];
  const resumen: Record<string, number> = {};

  for (const [titular, ses] of porTitular) {
    const app = (apps || []).find((a: any) => a.cuenta === titular);
    if (!app || app.usuario === 'PENDIENTE') { errores.push(`${titular}: sin aplicacion`); continue; }

    const quedan = ses.valida_hasta ? Math.floor((new Date(ses.valida_hasta).getTime() - Date.now()) / 86400000) : 999;
    if (quedan <= 7) {
      await sb.from('bitacora_novedades').insert([{
        texto: `El permiso del banco de ${titular} caduca en ${quedan} dias. Hay que renovarlo.`,
        etiquetas: ['banco'], usuario: 'robot',
      }]).then(() => {}, () => {});
    }

    const token = await jwt(app.usuario, app.password);
    const cab = { Authorization: `Bearer ${token}`, accept: 'application/json' };
    let nuevosT = 0;

    for (const c of (ses.cuentas || []) as any[]) {
      if (!blanca.has(c.iban)) continue; // cuenta personal: ni se consulta

      let cont: string | null = null;
      let vueltas = 0;
      do {
        const q = new URLSearchParams({ date_from: desde, date_to: hasta });
        if (cont) q.set('continuation_key', cont);
        const r = await fetch(`${API}/accounts/${c.uid}/transactions?${q}`, { headers: cab });
        if (!r.ok) { errores.push(`${titular}/${c.iban}: ${r.status}`); break; }
        const j = await r.json();
        const movs = j.transactions || [];
        vistos += movs.length;

        for (const m of movs) {
          const signo = m.credit_debit_indicator === 'DBIT' ? -1 : 1;
          const importe = signo * Number(m.transaction_amount?.amount ?? 0);
          const concepto = (m.remittance_information || []).join(' ').trim() || m.bank_transaction_code?.description || '';
          const contraparte = signo < 0 ? (m.creditor?.name ?? null) : (m.debtor?.name ?? null);
          const h = await huella(c.iban, m.entry_reference, m.booking_date, importe, concepto);

          const { error } = await sb.from('banco_movimientos_raw').insert([{
            banco: ses.banco, iban: c.iban, cuenta_uid: c.uid,
            entry_reference: m.entry_reference ?? null,
            fecha: m.booking_date ?? m.transaction_date ?? null,
            fecha_valor: m.value_date ?? null,
            importe, moneda: m.transaction_amount?.currency ?? 'EUR',
            concepto, contraparte, estado_banco: m.status ?? null,
            crudo: { ...m, titular, cuenta: blanca.get(c.iban) }, huella: h,
          }]);
          if (!error) { nuevos++; nuevosT++; }
        }
        cont = j.continuation_key ?? null;
        vueltas++;
      } while (cont && vueltas < 10);
    }
    resumen[titular] = nuevosT;
  }

  await log(errores.length ? 'parcial' : 'ok',
    `${desde}..${hasta} · leidos=${vistos} nuevos=${nuevos} · ${JSON.stringify(resumen)}${errores.length ? ' · ' + errores.join(' | ') : ''}`);

  const volcado = await volcarPendientes().catch((e) => ({ volcados: 0, bloqueados: 0, errores: 1, fallo: String(e?.message || e) }));
  await latido(hasta, `nuevos=${nuevos} volcados=${(volcado as any).volcados} bloqueados_dup=${(volcado as any).bloqueados}`);

  return new Response(JSON.stringify({ desde, hasta, cuentas: [...blanca.keys()], leidos: vistos, nuevos, por_titular: resumen, errores, volcado }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
