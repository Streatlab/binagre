/**
 * Datos reales de horarios — fuente única hasta que se enchufe a Supabase.
 * Formato cuadrante: empleado_id (nombre pila) → día → tramos.
 * Las semanas se identifican por el lunes en ISO (YYYY-MM-DD).
 */
import type { DiaKey, Tramo } from '@/components/equipo/horarios/utils'

export interface SemanaReal {
  lunes: string // YYYY-MM-DD del lunes ISO
  turnos: Record<string, Partial<Record<DiaKey, Tramo[]>>> // por nombre de pila
  horas: Record<string, number> // total reportado en Excel
}

// Mapeo nombre Excel → nombre pila usado en el cuadrante
const MAP_NOMBRE: Record<string, string> = {
  'RAY': 'Ray',
  'ANDRÉS': 'Andrés',
  'EMILIO': 'Emilio',
  'RUBÉN': 'Rubén',
  'JORDI': 'Jordi',
}

const RAW: Array<{ semana: string; lunes: string; emps: Record<string, { turnos: Record<string, Tramo[]>; horas: number }> }> = [
  {
    semana: 'S18', lunes: '2026-04-27',
    emps: {
      'ANDRÉS': { turnos: {
        jue: [{ entrada: '11:30', salida: '17:00' }],
        vie: [{ entrada: '12:30', salida: '21:00' }],
        sab: [{ entrada: '12:30', salida: '21:00' }],
        dom: [{ entrada: '12:30', salida: '21:00' }],
      }, horas: 31 },
      'EMILIO': { turnos: {
        mie: [{ entrada: '13:00', salida: '16:00' }, { entrada: '20:00', salida: '22:30' }],
        jue: [{ entrada: '12:00', salida: '16:00' }],
        vie: [{ entrada: '13:00', salida: '16:00' }, { entrada: '20:00', salida: '22:30' }],
        sab: [{ entrada: '13:00', salida: '16:00' }, { entrada: '20:00', salida: '22:30' }],
        dom: [{ entrada: '13:00', salida: '16:00' }, { entrada: '20:00', salida: '22:30' }],
      }, horas: 26 },
      'RUBÉN': { turnos: {
        mie: [{ entrada: '10:00', salida: '22:30' }],
        jue: [{ entrada: '10:00', salida: '17:30' }],
        vie: [{ entrada: '11:00', salida: '22:00' }],
        sab: [{ entrada: '11:00', salida: '22:00' }],
        dom: [{ entrada: '11:00', salida: '22:00' }],
      }, horas: 53 },
    },
  },
  {
    semana: 'S19', lunes: '2026-05-04',
    emps: {
      'ANDRÉS': { turnos: {
        lun: [{ entrada: '11:30', salida: '17:00' }, { entrada: '20:00', salida: '22:30' }],
        mar: [{ entrada: '11:30', salida: '17:00' }, { entrada: '20:00', salida: '22:30' }],
        vie: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '22:30' }],
        sab: [{ entrada: '12:30', salida: '21:30' }],
        dom: [{ entrada: '13:00', salida: '21:30' }],
      }, horas: 41 },
      'EMILIO': { turnos: {
        lun: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        mar: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        vie: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        sab: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        dom: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
      }, horas: 25 },
      'RUBÉN': { turnos: {
        lun: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '22:30' }],
        mar: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '22:30' }],
        vie: [{ entrada: '11:00', salida: '22:30' }],
        sab: [{ entrada: '11:00', salida: '22:30' }],
        dom: [{ entrada: '11:00', salida: '22:30' }],
      }, horas: 51.5 },
    },
  },
  {
    semana: 'S20', lunes: '2026-05-11',
    emps: {
      'ANDRÉS': { turnos: {
        lun: [{ entrada: '11:30', salida: '17:00' }, { entrada: '20:00', salida: '22:30' }],
        mar: [{ entrada: '11:30', salida: '17:00' }, { entrada: '20:00', salida: '22:30' }],
        vie: [{ entrada: '14:00', salida: '22:30' }],
        sab: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        dom: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
      }, horas: 40.5 },
      'EMILIO': { turnos: {
        lun: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        mar: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        vie: [{ entrada: '13:00', salida: '16:00' }, { entrada: '21:00', salida: '22:30' }],
        sab: [{ entrada: '13:00', salida: '16:00' }, { entrada: '21:00', salida: '22:30' }],
        dom: [{ entrada: '13:00', salida: '16:00' }, { entrada: '21:00', salida: '22:30' }],
      }, horas: 23.5 },
      'RUBÉN': { turnos: {
        lun: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '22:30' }],
        mar: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '22:30' }],
        vie: [{ entrada: '11:00', salida: '23:00' }],
        sab: [{ entrada: '11:00', salida: '23:00' }],
        dom: [{ entrada: '11:00', salida: '23:00' }],
      }, horas: 53 },
    },
  },
  {
    semana: 'S21', lunes: '2026-05-18',
    emps: {
      'RAY': { turnos: {
        mie: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        jue: [{ entrada: '12:00', salida: '16:30' }, { entrada: '20:00', salida: '22:30' }],
        vie: [{ entrada: '12:00', salida: '16:30' }, { entrada: '20:00', salida: '23:00' }],
        sab: [{ entrada: '14:00', salida: '23:00' }],
        dom: [{ entrada: '13:00', salida: '23:00' }],
      }, horas: 41.5 },
      'ANDRÉS': { turnos: {
        lun: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        mar: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        mie: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        jue: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        vie: [{ entrada: '14:00', salida: '23:00' }],
      }, horas: 41 },
      'EMILIO': { turnos: {
        mie: [{ entrada: '13:00', salida: '16:00' }, { entrada: '20:30', salida: '22:00' }],
        jue: [{ entrada: '13:00', salida: '16:00' }, { entrada: '20:30', salida: '22:00' }],
        vie: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        sab: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        dom: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
      }, horas: 24 },
      'RUBÉN': { turnos: {
        lun: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        mar: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        mie: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        jue: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        vie: [{ entrada: '11:00', salida: '23:00' }],
        sab: [{ entrada: '11:00', salida: '23:00' }],
        dom: [{ entrada: '11:00', salida: '23:00' }],
      }, horas: 72 },
    },
  },
  {
    semana: 'S22', lunes: '2026-05-25',
    emps: {
      'RAY': { turnos: {
        lun: [{ entrada: '12:00', salida: '16:30' }, { entrada: '20:00', salida: '23:00' }],
        mar: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        mie: [{ entrada: '12:30', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        jue: [{ entrada: '12:00', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        dom: [{ entrada: '13:00', salida: '23:00' }],
      }, horas: 41.5 },
      'ANDRÉS': { turnos: {
        mie: [{ entrada: '12:00', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        jue: [{ entrada: '12:00', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        vie: [{ entrada: '12:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        sab: [{ entrada: '12:00', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        dom: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
      }, horas: 41.5 },
      'EMILIO': { turnos: {
        lun: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        mar: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        mie: [{ entrada: '12:00', salida: '16:30' }, { entrada: '19:30', salida: '23:00' }],
        sab: [{ entrada: '12:00', salida: '16:30' }, { entrada: '19:30', salida: '23:00' }],
        dom: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
      }, horas: 31 },
      'RUBÉN': { turnos: {
        lun: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        mar: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        vie: [{ entrada: '11:30', salida: '23:00' }],
        sab: [{ entrada: '11:30', salida: '23:00' }],
        dom: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
      }, horas: 50 },
    },
  },
]

export const SEMANAS_REALES: SemanaReal[] = RAW.map(r => ({
  lunes: r.lunes,
  turnos: Object.fromEntries(Object.entries(r.emps).map(([k, v]) => [MAP_NOMBRE[k] ?? k, v.turnos as Partial<Record<DiaKey, Tramo[]>>])),
  horas: Object.fromEntries(Object.entries(r.emps).map(([k, v]) => [MAP_NOMBRE[k] ?? k, v.horas])),
}))

export function getSemanaPorLunes(lunesISO: string): SemanaReal | null {
  return SEMANAS_REALES.find(s => s.lunes === lunesISO) ?? null
}

export function getHistoricoSemanas(): SemanaReal[] {
  // todas menos la última (que es la "en curso")
  return SEMANAS_REALES.slice(0, -1)
}

export function getSemanaActual(): SemanaReal | null {
  return SEMANAS_REALES[SEMANAS_REALES.length - 1] ?? null
}
