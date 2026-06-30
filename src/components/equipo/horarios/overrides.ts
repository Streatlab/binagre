/**
 * Overrides editables de horarios — persistidos en Supabase (tabla `horarios`).
 * Clave por (empleado_id, fecha). Cada tramo = 1 fila (turno_tipo T1/T2).
 * Las celdas vacías no generan fila: ausencia de filas = día libre.
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
  // ordenar tramos por hora de entrada
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

  const filas = tramos
    .filter(t => t.entrada && t.salida && t.salida > t.entrada)
    .map((t, i) => ({
      empleado_id: empId, fecha: iso,
      hora_inicio: t.entrada, hora_fin: t.salida,
      turno_tipo: i === 0 ? 'T1' : 'T2',
    }))

  if (filas.length === 0) return true
  const { error: insErr } = await supabase.from('horarios').insert(filas)
  return !insErr
}

export interface CeldaGuardar { empId: string; iso: string; tramos: Tramo[] }

/**
 * Guarda toda una semana en 2 operaciones (1 borrado + 1 inserción), en vez de
 * decenas de peticiones sueltas. Devuelve el error real si algo falla.
 */
export async function guardarSemana(
  empIds: string[], desdeIso: string, hastaIso: string, celdas: CeldaGuardar[],
): Promise<{ ok: boolean; error?: string }> {
  if (empIds.length === 0) return { ok: true }
  const { error: delErr } = await supabase
    .from('horarios')
    .delete()
    .in('empleado_id', empIds)
    .gte('fecha', desdeIso)
    .lte('fecha', hastaIso)
  if (delErr) return { ok: false, error: delErr.message }

  const filas: Array<Record<string, string>> = []
  for (const c of celdas) {
    c.tramos.forEach((t, i) => {
      if (!t.entrada || !t.salida) return
      if (t.salida <= t.entrada) return
      filas.push({
        empleado_id: c.empId, fecha: c.iso,
        hora_inicio: t.entrada, hora_fin: t.salida, turno_tipo: i === 0 ? 'T1' : 'T2',
      })
    })
  }
  if (filas.length === 0) return { ok: true }

  const { error: insErr } = await supabase.from('horarios').insert(filas)
  if (insErr) return { ok: false, error: insErr.message }
  return { ok: true }
}

/** Normaliza una entrada de hora tecleada a HH:MM (24h). "1234"->12:34, "305"->03:05. Máx 4 cifras. */
export function normalizarHora(v: string): string {
  const s = (v || '').trim()
  if (!s) return ''
  const digits = s.replace(/\D/g, '').slice(0, 4)
  if (!digits) return ''
  let hh: number, mm: number
  if (digits.length <= 2) { hh = parseInt(digits, 10); mm = 0 }
  else if (digits.length === 3) { hh = parseInt(digits.slice(0, 1), 10); mm = parseInt(digits.slice(1), 10) }
  else { hh = parseInt(digits.slice(0, 2), 10); mm = parseInt(digits.slice(2), 10) }
  if (hh > 23) hh = 23
  if (mm > 59) mm = 59
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
