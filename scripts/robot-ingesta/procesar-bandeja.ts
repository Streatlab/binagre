/**
 * ROBOT PROCESAR-BANDEJA · El "enchufe" bandeja → módulos del ERP.
 *
 * Los robots de portal solo DESCARGAN y dejan ficheros en la bandeja
 * (bucket 'informes-plataforma' + fila en imports_log, estado='pendiente').
 * Hasta hoy (19-jul-2026) NADIE recogía de ahí: 130 ficheros muertos.
 *
 * Este robot cierra el circuito. Por cada fila pendiente:
 *   1. Baja el fichero del bucket.
 *   2. Lo enruta al procesador que ya existe en el ERP:
 *      - tipo *factura* (PDF)  → POST /api/papeleo/facturas?action=upload
 *        (motor OCR de facturas: crea la factura, Drive, matching)
 *      - resto (informes CSV/XLS) → POST /api/papeleo/importar/plataforma
 *        (parsers Uber/Glovo/JustEat/Sinqro/Rushour → ventas_plataforma,
 *         uber_liquidaciones, pedidos_operativa, productos vendidos, ...)
 *   3. Marca la fila: estado='procesado' (+destino_id si hay factura) o
 *      estado='sin_parser' si el ERP no reconoce el formato (LEY-ANTIFALSOS:
 *      mejor hueco visible que dato inventado; se revisa a mano).
 *
 * Idempotente: solo toca filas estado='pendiente'. Reintentos: las filas
 * 'error' de red se quedan en 'pendiente' (detalle.intentos++) hasta 5.
 *
 * env: ERP_URL (por defecto producción), LOTE (máx filas por pasada).
 */
import { sb, log, latido, hoyMadrid, BUCKET } from './_lib/bandeja.js';

const P = 'procesar_bandeja';
const ERP = process.env.ERP_URL || 'https://binagre.vercel.app';
const LOTE = Number(process.env.LOTE || 40);
const MAX_INTENTOS = 5;

type Fila = {
  id: string; archivo_nombre: string; archivo_url: string;
  tipo_detectado: string; destino_modulo: string | null;
  detalle: Record<string, unknown> | null;
};

function mimeDe(nombre: string): string {
  const e = (nombre.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
  if (e === '.csv') return 'text/csv';
  if (e === '.xls') return 'application/vnd.ms-excel';
  if (e === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (e === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

async function bajarDelBucket(archivo_url: string): Promise<Buffer | null> {
  // archivo_url = 'informes-plataforma/<fuente>/<fichero>' → ruta dentro del bucket
  const ruta = archivo_url.startsWith(`${BUCKET}/`) ? archivo_url.slice(BUCKET.length + 1) : archivo_url;
  const { data, error } = await sb.storage.from(BUCKET).download(ruta);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function marcar(fila: Fila, estado: string, destino_modulo: string, destino_id: string | null, resumen: unknown) {
  const detalle = { ...(fila.detalle || {}), enchufe: { fecha: new Date().toISOString(), resumen } };
  await sb.from('imports_log').update({ estado, destino_modulo, destino_id, detalle }).eq('id', fila.id);
}

async function reintentoOtroDia(fila: Fila, motivo: string) {
  const intentos = Number((fila.detalle as Record<string, unknown> | null)?.['intentos_enchufe'] || 0) + 1;
  if (intentos >= MAX_INTENTOS) {
    await marcar(fila, 'error', fila.destino_modulo || 'ventas', null, `agotados ${MAX_INTENTOS} intentos: ${motivo}`);
    return;
  }
  await sb.from('imports_log').update({
    detalle: { ...(fila.detalle || {}), intentos_enchufe: intentos, ultimo_error: motivo },
  }).eq('id', fila.id);
}

async function post(ruta: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> | null; texto: string }> {
  // 19-jul: hasta 3 intentos con espera (la primera pasada cayó en 39/40 con
  // respuesta no-JSON: rate limit / challenge). Se guarda status+cuerpo para diagnosticar.
  for (let intento = 1; ; intento++) {
    const r = await fetch(`${ERP}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const texto = await r.text().catch(() => '');
    let json: Record<string, unknown> | null = null;
    try { json = JSON.parse(texto) as Record<string, unknown>; } catch { /* respuesta no-JSON */ }
    const transitorio = r.status === 429 || r.status >= 500 || json === null;
    if (!transitorio || intento >= 3) return { status: r.status, json, texto: texto.slice(0, 160) };
    await new Promise((ok) => setTimeout(ok, 4000 * intento));
  }
}

async function procesarFactura(fila: Fila, buffer: Buffer): Promise<'ok' | 'sin_parser' | 'red'> {
  const { status, json, texto } = await post('/api/papeleo/facturas?action=upload', {
    nombre: fila.archivo_nombre,
    base64: buffer.toString('base64'),
    mimeType: mimeDe(fila.archivo_nombre),
    sesionId: `bandeja-${fila.id.slice(0, 8)}`,
  });
  if (status >= 500 || status === 429 || json === null) { await reintentoOtroDia(fila, `HTTP ${status}: ${texto}`); return 'red'; }
  const estado = String(json.estado || '');
  const facturaId = (json.factura_id as string)
    || ((json.factura_existente as Record<string, unknown> | undefined)?.id as string)
    || null;
  if (estado === 'ok' || estado === 'duplicada' || estado === 'lectura_manual' || facturaId) {
    await marcar(fila, 'procesado', 'facturas', facturaId, { estado, motivo: json.motivo || null });
    await log(P, 'ok', `${fila.archivo_nombre} → facturas (${estado}${facturaId ? ` · ${facturaId.slice(0, 8)}` : ''})`);
    return 'ok';
  }
  await marcar(fila, 'sin_parser', 'facturas', null, json);
  await log(P, 'sin_parser', `${fila.archivo_nombre} → motor facturas no lo aceptó (${estado || status})`);
  return 'sin_parser';
}

async function procesarInforme(fila: Fila, buffer: Buffer): Promise<'ok' | 'sin_parser' | 'red'> {
  const { status, json, texto } = await post('/api/papeleo/importar/plataforma', {
    nombre: fila.archivo_nombre,
    base64: buffer.toString('base64'),
    mimeType: mimeDe(fila.archivo_nombre),
  });
  if (status >= 500 || status === 429 || json === null) { await reintentoOtroDia(fila, `HTTP ${status}: ${texto}`); return 'red'; }
  if (json.ok === true) {
    await marcar(fila, 'procesado', 'ventas', null, {
      tipo: json.tipo_detectado || null, plataforma: json.plataforma || null, mensaje: json.mensaje || null,
    });
    await log(P, 'ok', `${fila.archivo_nombre} → ${json.tipo_detectado || 'ventas'} (${String(json.mensaje || '').slice(0, 120)})`);
    return 'ok';
  }
  // El ERP respondió pero no reconoce el formato → se deja visible para revisión.
  await marcar(fila, 'sin_parser', fila.destino_modulo || 'ventas', null, {
    plataforma: json.plataforma || null, mensaje: json.mensaje || null,
  });
  await log(P, 'sin_parser', `${fila.archivo_nombre}: ${String(json.mensaje || 'formato no reconocido').slice(0, 140)}`);
  return 'sin_parser';
}

async function main() {
  await log(P, 'inicio', `ERP=${ERP} · lote=${LOTE}`);

  const { data, error } = await sb.from('imports_log')
    .select('id, archivo_nombre, archivo_url, tipo_detectado, destino_modulo, detalle')
    .eq('estado', 'pendiente')
    .order('fecha_subida', { ascending: true })
    .limit(LOTE);
  if (error) { await log(P, 'error', `leyendo bandeja: ${error.message}`); process.exit(1); }

  const filas = (data || []) as Fila[];
  if (!filas.length) {
    await log(P, 'fin', 'bandeja sin pendientes');
    await latido(P, hoyMadrid(), 'sin pendientes');
    return;
  }

  // Facturas primero (dinero en el ERP cuanto antes), después informes.
  filas.sort((a, b) => Number(/factura/.test(b.tipo_detectado)) - Number(/factura/.test(a.tipo_detectado)));

  let ok = 0, sinParser = 0, red = 0;
  for (const fila of filas) {
    await new Promise((okk) => setTimeout(okk, 1200));
    const buffer = await bajarDelBucket(fila.archivo_url);
    if (!buffer) { await reintentoOtroDia(fila, 'no pude bajar el fichero del bucket'); red++; continue; }
    try {
      const r = /factura/.test(fila.tipo_detectado)
        ? await procesarFactura(fila, buffer)
        : await procesarInforme(fila, buffer);
      if (r === 'ok') ok++;
      else if (r === 'sin_parser') sinParser++;
      else { red++; }
    } catch (e) {
      await reintentoOtroDia(fila, e instanceof Error ? e.message : String(e));
      red++;
    }
  }

  await log(P, 'fin', `procesados=${ok} sin_parser=${sinParser} red=${red} de ${filas.length}`);
  await latido(P, hoyMadrid(), `procesados=${ok} sin_parser=${sinParser} red=${red}`);
  if (red > 0 && ok === 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
