/**
 * Overrides editables de horarios — persistidos en Supabase (tabla `horarios`).
 * Clave por (empleado_id, fecha). Cada tramo = 1 fila (turno_tipo T1/T2).
 * Una fila turno_tipo='LIBRE' marca que el usuario ha vaciado esa celda a propósito.
 */
import { supabase } from '@/lib/supabase'
import type { Tramo } from './utils'

export type OverrideValor = Tramo[]          // [] = libre explícito
export type OverridesMap = Record<string, OverrideValor>  // clave `${empId}|${iso}`

export function claveOverride(empId: string, iso: string): string {
  return `${empId}|${iso}`
}

interface FilaHorario {
  empleado_id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  turno_tipo: string
}

/** Carga overrides de un rango de fechas (ISO inclusive). */
export async function cargarOverrides(desdeIso: string, hastaIso: string): Promise<OverridesMap> {
  const { data, error } = await supabase
    .from('horarios')
    .select('empleado_id, fecha, hora_inicio, hora_fin, turno_tipo')
    .gte('fecha', desdeIso)
    .lte('fecha', hastaIso)
  if (error || !data) return {}
  const filas = data as unknown as FilaHorario[]
  const map: OverridesMap = {}
  for (const f of filas) {
    const k = claveOverride(f.empleado_id, f.fecha)
    if (!map[k]) map[k] = []
    if (f.turno_tipo === 'LIBRE') continue
    map[k].push({ entrada: (f.hora_inicio || '').slice(0, 5), salida: (f.hora_fin || '').slice(0, 5) })
  }
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => a.entrada.localeCompare(b.entrada))
  }
  return map
}

/** Guarda (reemplaza) el override de una celda. tramos vacío => libre explícito. */
export async function guardarOverride(empId: string, iso: string, tramos: Tramo[]): Promise<boolean> {
  const { error: delErr } = await supabase
    .from('horarios')
    .delete()
    .eq('empleado_id', empId)
    .eq('fecha', iso)
  if (delErr) return false

  const filas = tramos.length > 0
    ? tramos.map((t, i) => ({
        empleado_id: empId, fecha: iso,
        hora_inicio: t.entrada, hora_fin: t.salida,
        turno_tipo: i === 0 ? 'T1' : 'T2',
      }))
    : [{ empleado_id: empId, fecha: iso, hora_inicio: '00:00', hora_fin: '00:00', turno_tipo: 'LIBRE' }]

  const { error: insErr } = await supabase.from('horarios').insert(filas)
  return !insErr
}

/** Normaliza una entrada de hora tecleada a HH:MM. Acepta "1430", "14:30", "9:00", "9". */
export function normalizarHora(v: string): string {
  const s = (v || '').trim()
  if (!s) return ''
  const m = s.match(/^(\d{1,2})[:.,]?(\d{2})?$/)
  if (!m) return s
  let hh = parseInt(m[1], 10)
  const mm = m[2] ? parseInt(m[2], 10) : 0
  if (hh > 23) hh = 23
  const mmc = mm > 59 ? 59 : mm
  return `${String(hh).padStart(2, '0')}:${String(mmc).padStart(2, '0')}`
}
