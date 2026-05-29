/**
 * Utilidades compartidas Horarios — formato rota cuadrante.
 * Datos reales se enchufan en un segundo paso (Supabase tablas: turnos_semana, reglas_horario).
 */

export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const
export type DiaKey = typeof DIAS[number]

export interface Empleado {
  id: string
  nombre: string
  cargo?: string | null
}

/** Un tramo de un turno (formato HH:MM). Un turno partido tiene 2 tramos. */
export interface Tramo {
  entrada: string
  salida: string
}

/** Turno de un empleado en un día concreto de la semana. */
export interface Turno {
  empleado_id: string
  dia: DiaKey
  tramos: Tramo[]              // 1 = corrido, 2 = partido
  descuento_min?: number       // descanso descontado (ej. 30 min cocineros)
}

export interface ReglasHorario {
  horas_max_semana: number
  horas_max_dia: number
  descanso_min_entre_turnos: number
  dias_libres_min_semana: number
  cobertura: Record<string, number>
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

/** Color por empleado (rama suave del kit). Se asigna por orden estable. */
export const COLORES_EMPLEADO = [
  { bg: '#B5D4F4', text: '#042C53' }, // azul
  { bg: '#C0DD97', text: '#173404' }, // verde
  { bg: '#F4C0D1', text: '#4B1528' }, // rosa
  { bg: '#FAC775', text: '#412402' }, // ámbar
  { bg: '#9FE1CB', text: '#04342C' }, // teal
  { bg: '#CECBF6', text: '#26215C' }, // morado
] as const

export function colorEmpleado(idx: number) {
  return COLORES_EMPLEADO[idx % COLORES_EMPLEADO.length]
}

/** Minutos de un tramo (soporta cruce de medianoche). */
function minutosTramo(t: Tramo): number {
  const [eh, em] = t.entrada.split(':').map(Number)
  const [sh, sm] = t.salida.split(':').map(Number)
  let mins = (sh * 60 + sm) - (eh * 60 + em)
  if (mins < 0) mins += 24 * 60
  return mins
}

/** Horas brutas de un turno (suma de tramos). */
export function horasBrutas(t: Turno): number {
  return t.tramos.reduce((s, tr) => s + minutosTramo(tr), 0) / 60
}

/** Horas reales de un turno (brutas menos descuento). */
export function horasReales(t: Turno): number {
  return horasBrutas(t) - (t.descuento_min ?? 0) / 60
}

/** ¿Turno partido? */
export function esPartido(t: Turno): boolean {
  return t.tramos.length > 1
}

/** Texto multilínea de los tramos: "12:00–16:30 / 19:00–23:00". */
export function tramosTexto(t: Turno): string {
  return t.tramos.map(tr => `${tr.entrada}–${tr.salida}`).join('\n')
}

/** Total real semanal por empleado. */
export function horasSemanaPorEmpleado(turnos: Turno[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const t of turnos) {
    acc[t.empleado_id] = (acc[t.empleado_id] ?? 0) + horasReales(t)
  }
  return acc
}

/** Descuento total semanal por empleado (en horas). */
export function descuentoSemanaPorEmpleado(turnos: Turno[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const t of turnos) {
    acc[t.empleado_id] = (acc[t.empleado_id] ?? 0) + (t.descuento_min ?? 0) / 60
  }
  return acc
}

/** Lunes de la semana ISO que contiene `d`. */
export function lunesDeSemana(d: Date): Date {
  const r = new Date(d)
  const day = (r.getDay() + 6) % 7
  r.setDate(r.getDate() - day)
  r.setHours(0, 0, 0, 0)
  return r
}

export function numeroSemanaISO(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}

export function fmtRangoSemana(lunes: Date): string {
  const dom = new Date(lunes)
  dom.setDate(dom.getDate() + 6)
  const f = (x: Date) => `${x.getDate()} ${x.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}`
  return `${f(lunes)}–${f(dom)} ${dom.getFullYear()}`
}

export function fmtHoras(h: number): string {
  return h.toLocaleString('es-ES', { minimumFractionDigits: h % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 }) + 'h'
}

// build: rota v4 — master force build
