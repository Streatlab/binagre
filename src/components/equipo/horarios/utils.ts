/**
 * Utilidades compartidas Horarios.
 * Datos reales se enchufan en un segundo paso (Supabase tablas: turnos, reglas_horario, eventos_laborales).
 */

export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const
export type DiaKey = typeof DIAS[number]

export interface Empleado {
  id: string
  nombre: string
  cargo?: string | null
}

export interface Turno {
  empleado_id: string
  dia: DiaKey
  entrada: string   // 'HH:MM'
  salida: string    // 'HH:MM'
}

export interface ReglasHorario {
  horas_max_semana: number
  horas_max_dia: number
  descanso_min_entre_turnos: number   // horas
  dias_libres_min_semana: number
  cobertura: Record<string, number>   // franja -> nº personas mínimas
}

export const REGLAS_DEFAULT: ReglasHorario = {
  horas_max_semana: 40,
  horas_max_dia: 9,
  descanso_min_entre_turnos: 12,
  dias_libres_min_semana: 2,
  cobertura: {
    'Comida (12-16)': 2,
    'Tarde (16-20)': 1,
    'Cena (20-00)': 2,
  },
}

/** Horas de un turno (soporta turnos que cruzan medianoche). */
export function horasTurno(entrada: string, salida: string): number {
  const [eh, em] = entrada.split(':').map(Number)
  const [sh, sm] = salida.split(':').map(Number)
  let mins = (sh * 60 + sm) - (eh * 60 + em)
  if (mins < 0) mins += 24 * 60
  return mins / 60
}

/** Total semanal de horas por empleado a partir de una lista de turnos. */
export function horasSemanaPorEmpleado(turnos: Turno[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const t of turnos) {
    acc[t.empleado_id] = (acc[t.empleado_id] ?? 0) + horasTurno(t.entrada, t.salida)
  }
  return acc
}

/** Lunes de la semana ISO que contiene `d`. */
export function lunesDeSemana(d: Date): Date {
  const r = new Date(d)
  const day = (r.getDay() + 6) % 7 // 0 = lunes
  r.setDate(r.getDate() - day)
  r.setHours(0, 0, 0, 0)
  return r
}

export function fmtRangoSemana(lunes: Date): string {
  const dom = new Date(lunes)
  dom.setDate(dom.getDate() + 6)
  const f = (x: Date) => `${x.getDate()} ${x.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}`
  return `${f(lunes)} — ${f(dom)} ${dom.getFullYear()}`
}

export function fmtHoras(h: number): string {
  return h.toLocaleString('es-ES', { minimumFractionDigits: h % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })
}
