/**
 * Convierte filas de la tabla `horarios` (por rango de fechas) a Turno[].
 * Un empleado puede tener varios registros el mismo día (turno partido) → se agrupan en tramos[].
 */
import { supabase } from '@/lib/supabase'
import type { DiaKey, Turno } from './utils'
import { DIAS } from './utils'

interface HorarioRow {
  id: string
  empleado_id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  turno_tipo: string
}

/** ISO date → DiaKey ('Lun'…'Dom'). */
function fechaToDia(fecha: string): DiaKey | null {
  const d = new Date(fecha + 'T12:00:00')
  const js = d.getDay()
  const map: Record<number, DiaKey> = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 0: 'Dom' }
  return map[js] ?? null
}

/** Extrae "HH:MM" de "HH:MM:SS" o "HH:MM". */
function fmtTime(t: string): string {
  return t.slice(0, 5)
}

/**
 * Carga los horarios de la semana lunes…domingo y los convierte a Turno[].
 * Turnos partidos (mismo empleado + misma fecha, dos filas) → tramos[].
 */
export async function fetchTurnosDB(lunesISO: string): Promise<Turno[]> {
  const lunes = new Date(lunesISO + 'T00:00:00')
  const dom = new Date(lunes)
  dom.setDate(dom.getDate() + 6)
  const domISO = dom.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('horarios')
    .select('id, empleado_id, fecha, hora_inicio, hora_fin, turno_tipo')
    .gte('fecha', lunesISO)
    .lte('fecha', domISO)
    .order('fecha')
    .order('hora_inicio')

  if (error || !data) return []

  const rows = data as HorarioRow[]

  // Agrupar por empleado_id + fecha
  const grouped: Record<string, HorarioRow[]> = {}
  for (const row of rows) {
    const key = `${row.empleado_id}::${row.fecha}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(row)
  }

  const turnos: Turno[] = []
  for (const [key, grupo] of Object.entries(grouped)) {
    const [empId, fecha] = key.split('::')
    const dia = fechaToDia(fecha)
    if (!dia || !DIAS.includes(dia)) continue

    const tramos = grupo.map(r => ({
      entrada: fmtTime(r.hora_inicio),
      salida: fmtTime(r.hora_fin),
    }))

    turnos.push({ empleado_id: empId, dia, tramos })
  }

  return turnos
}

/**
 * ¿Hay al menos un registro en `horarios` para esa semana?
 */
export async function semanaHasData(lunesISO: string): Promise<boolean> {
  const lunes = new Date(lunesISO + 'T00:00:00')
  const dom = new Date(lunes)
  dom.setDate(dom.getDate() + 6)
  const domISO = dom.toISOString().slice(0, 10)

  const { count } = await supabase
    .from('horarios')
    .select('id', { count: 'exact', head: true })
    .gte('fecha', lunesISO)
    .lte('fecha', domISO)

  return (count ?? 0) > 0
}
