/**
 * BANDEJA · Punto único de entrega de los robots de portal.
 *
 * El robot NO interpreta nada. Solo deja el fichero en la misma bandeja donde
 * caen las subidas manuales de Papeleo:
 *
 *   bucket 'informes-plataforma'  +  fila en imports_log (estado='pendiente')
 *
 * Los parsers (otro track) recogen de ahí. Un solo sitio donde se interpreta.
 *
 * Idempotencia: huella sha256 del contenido. Si ese fichero ya se entregó, no
 * se vuelve a subir ni a registrar. Repetir una ejecución es inofensivo.
 *
 * OJO: imports_log.detalle es JSONB → se inserta objeto, no cadena.
 */
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const sb = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

export const BUCKET = 'informes-plataforma';
export const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
export const SIMULACRO = process.env.ROBOT_DRY === '1';

export function hoyMadrid(diasAtras = 0): string {
  const d = new Date(Date.now() - diasAtras * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);
}

export async function log(fuente: string, estado: string, detalle: string) {
  try {
    await sb.from('robot_log').insert([{ fuente, estado, detalle }]);
  } catch { /* el log nunca tumba al robot */ }
  console.log(`[${fuente}] ${estado} · ${detalle}`);
}

export async function volcar(fuente: string, html: string) {
  try {
    await sb.from('robot_debug').insert([{ fuente, fecha: HOY, html }]);
  } catch { /* noop */ }
}

export async function latido(fuente: string, ultimoDato?: string | Date, detalle?: string) {
  try {
    await sb.from('robot_salud').upsert([{
      fuente,
      ultima_ejecucion: new Date().toISOString(),
      ultimo_dato: ultimoDato ? new Date(ultimoDato).toISOString() : null,
      estado: 'ok',
      detalle: detalle || null,
    }]);
  } catch { /* el latido nunca tumba al robot */ }
}

function mimeDe(nombre: string): string {
  const e = (nombre.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
  if (e === '.csv') return 'text/csv';
  if (e === '.xls') return 'application/vnd.ms-excel';
  if (e === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (e === '.pdf') return 'application/pdf';
  if (e === '.zip') return 'application/zip';
  if (e === '.doc') return 'application/msword';
  return 'application/octet-stream';
}

export interface Entrega {
  fuente: string;            // uber | glovo | justeat
  tipo: string;              // uber_historial_pedidos, glovo_liquidacion, ...
  nombre: string;            // nombre original del fichero descargado
  datos: Buffer;
  periodo?: string;          // día, semana o mes al que corresponde
  destino?: string;          // módulo destino sugerido (ventas | facturas)
}

/** Deja el fichero en la bandeja. Devuelve true si lo dejó, false si ya estaba. */
export async function entregar(e: Entrega): Promise<boolean> {
  const huella = createHash('sha256').update(e.datos).digest('hex');

  const { data: yaEsta } = await sb
    .from('imports_log')
    .select('id')
    .eq('detalle->>huella', huella)
    .limit(1);
  if (yaEsta && yaEsta.length > 0) {
    await log(e.fuente, 'duplicado', `${e.nombre} ya estaba en la bandeja (huella ${huella.slice(0, 12)})`);
    return false;
  }

  if (SIMULACRO) {
    await log(e.fuente, 'simulacro', `${e.nombre} (${e.datos.length} bytes) · no dejo nada en la bandeja`);
    return false;
  }

  const ext = (e.nombre.match(/\.[a-z0-9]+$/i) || ['.bin'])[0];
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const ruta = `${e.fuente}/${e.tipo}_${e.periodo || HOY}_${sello}${ext}`;

  const { error: eUp } = await sb.storage
    .from(BUCKET)
    .upload(ruta, e.datos, { contentType: mimeDe(e.nombre), upsert: true });
  if (eUp) {
    await log(e.fuente, 'error', `subiendo a la bandeja: ${eUp.message}`);
    process.exitCode = 1;
    return false;
  }

  const { error: eLog } = await sb.from('imports_log').insert([{
    archivo_nombre: e.nombre,
    archivo_url: `${BUCKET}/${ruta}`,
    tipo_detectado: e.tipo,
    estado: 'pendiente',
    destino_modulo: e.destino || 'ventas',
    detalle: {
      fuente: `robot ${e.fuente}`,
      tipo: e.tipo,
      periodo: e.periodo || HOY,
      huella,
      bytes: e.datos.length,
      fecha_deposito: HOY,
    },
  }]);
  if (eLog) {
    await log(e.fuente, 'error', `fichero subido pero NO registrado: ${eLog.message}`);
    process.exitCode = 1;
    return false;
  }

  await log(e.fuente, 'ok', `${e.tipo} en bandeja: ${ruta} (${e.datos.length} bytes)`);
  return true;
}
