/**
 * Datos reales horarios — S18-S22 + S25 (override puntual). DiaKey capitalizado (Lun..Dom).
 */
import type { DiaKey, Tramo } from '@/components/equipo/horarios/utils'

export interface SemanaReal {
  lunes: string
  turnos: Record<string, Partial<Record<DiaKey, Tramo[]>>>
  horas: Record<string, number>
}

const MAP_NOMBRE: Record<string, string> = {
  'RAY': 'Ray', 'ANDRÉS': 'Andrés', 'EMILIO': 'Emilio', 'RUBÉN': 'Rubén', 'JORDI': 'Jordi',
}

const RAW: Array<{ semana: string; lunes: string; emps: Record<string, { turnos: Partial<Record<DiaKey, Tramo[]>>; horas: number }> }> = [
  {
    semana: 'S18', lunes: '2026-04-27',
    emps: {
      'ANDRÉS': { turnos: {
        Jue: [{ entrada: '11:30', salida: '17:00' }],
        Vie: [{ entrada: '12:30', salida: '21:00' }],
        'Sáb': [{ entrada: '12:30', salida: '21:00' }],
        Dom: [{ entrada: '12:30', salida: '21:00' }],
      }, horas: 31 },
      'EMILIO': { turnos: {
        'Mié': [{ entrada: '13:00', salida: '16:00' }, { entrada: '20:00', salida: '22:30' }],
        Jue: [{ entrada: '12:00', salida: '16:00' }],
        Vie: [{ entrada: '13:00', salida: '16:00' }, { entrada: '20:00', salida: '22:30' }],
        'Sáb': [{ entrada: '13:00', salida: '16:00' }, { entrada: '20:00', salida: '22:30' }],
        Dom: [{ entrada: '13:00', salida: '16:00' }, { entrada: '20:00', salida: '22:30' }],
      }, horas: 26 },
      'RUBÉN': { turnos: {
        'Mié': [{ entrada: '10:00', salida: '22:30' }],
        Jue: [{ entrada: '10:00', salida: '17:30' }],
        Vie: [{ entrada: '11:00', salida: '22:00' }],
        'Sáb': [{ entrada: '11:00', salida: '22:00' }],
        Dom: [{ entrada: '11:00', salida: '22:00' }],
      }, horas: 53 },
    },
  },
  {
    semana: 'S19', lunes: '2026-05-04',
    emps: {
      'ANDRÉS': { turnos: {
        Lun: [{ entrada: '11:30', salida: '17:00' }, { entrada: '20:00', salida: '22:30' }],
        Mar: [{ entrada: '11:30', salida: '17:00' }, { entrada: '20:00', salida: '22:30' }],
        Vie: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '22:30' }],
        'Sáb': [{ entrada: '12:30', salida: '21:30' }],
        Dom: [{ entrada: '13:00', salida: '21:30' }],
      }, horas: 41 },
      'EMILIO': { turnos: {
        Lun: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        Mar: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        Vie: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        'Sáb': [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        Dom: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
      }, horas: 25 },
      'RUBÉN': { turnos: {
        Lun: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '22:30' }],
        Mar: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '22:30' }],
        Vie: [{ entrada: '11:00', salida: '22:30' }],
        'Sáb': [{ entrada: '11:00', salida: '22:30' }],
        Dom: [{ entrada: '11:00', salida: '22:30' }],
      }, horas: 51.5 },
    },
  },
  {
    semana: 'S20', lunes: '2026-05-11',
    emps: {
      'ANDRÉS': { turnos: {
        Lun: [{ entrada: '11:30', salida: '17:00' }, { entrada: '20:00', salida: '22:30' }],
        Mar: [{ entrada: '11:30', salida: '17:00' }, { entrada: '20:00', salida: '22:30' }],
        Vie: [{ entrada: '14:00', salida: '22:30' }],
        'Sáb': [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        Dom: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
      }, horas: 40.5 },
      'EMILIO': { turnos: {
        Lun: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        Mar: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        Vie: [{ entrada: '13:00', salida: '16:00' }, { entrada: '21:00', salida: '22:30' }],
        'Sáb': [{ entrada: '13:00', salida: '16:00' }, { entrada: '21:00', salida: '22:30' }],
        Dom: [{ entrada: '13:00', salida: '16:00' }, { entrada: '21:00', salida: '22:30' }],
      }, horas: 23.5 },
      'RUBÉN': { turnos: {
        Lun: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '22:30' }],
        Mar: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '22:30' }],
        Vie: [{ entrada: '11:00', salida: '23:00' }],
        'Sáb': [{ entrada: '11:00', salida: '23:00' }],
        Dom: [{ entrada: '11:00', salida: '23:00' }],
      }, horas: 53 },
    },
  },
  {
    semana: 'S21', lunes: '2026-05-18',
    emps: {
      'RAY': { turnos: {
        'Mié': [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        Jue: [{ entrada: '12:00', salida: '16:30' }, { entrada: '20:00', salida: '22:30' }],
        Vie: [{ entrada: '12:00', salida: '16:30' }, { entrada: '20:00', salida: '23:00' }],
        'Sáb': [{ entrada: '14:00', salida: '23:00' }],
        Dom: [{ entrada: '13:00', salida: '23:00' }],
      }, horas: 41.5 },
      'ANDRÉS': { turnos: {
        Lun: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        Mar: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        'Mié': [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        Jue: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        Vie: [{ entrada: '14:00', salida: '23:00' }],
      }, horas: 41 },
      'EMILIO': { turnos: {
        'Mié': [{ entrada: '13:00', salida: '16:00' }, { entrada: '20:30', salida: '22:00' }],
        Jue: [{ entrada: '13:00', salida: '16:00' }, { entrada: '20:30', salida: '22:00' }],
        Vie: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        'Sáb': [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        Dom: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
      }, horas: 24 },
      'RUBÉN': { turnos: {
        Lun: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        Mar: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        'Mié': [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        Jue: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        Vie: [{ entrada: '11:00', salida: '23:00' }],
        'Sáb': [{ entrada: '11:00', salida: '23:00' }],
        Dom: [{ entrada: '11:00', salida: '23:00' }],
      }, horas: 72 },
    },
  },
  {
    semana: 'S22', lunes: '2026-05-25',
    emps: {
      'RAY': { turnos: {
        Lun: [{ entrada: '12:00', salida: '16:30' }, { entrada: '20:00', salida: '23:00' }],
        Mar: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        'Mié': [{ entrada: '12:30', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
        Jue: [{ entrada: '12:00', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        Dom: [{ entrada: '13:00', salida: '23:00' }],
      }, horas: 41.5 },
      'ANDRÉS': { turnos: {
        'Mié': [{ entrada: '12:00', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        Jue: [{ entrada: '12:00', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        Vie: [{ entrada: '12:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        'Sáb': [{ entrada: '12:00', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        Dom: [{ entrada: '12:00', salida: '17:00' }, { entrada: '20:00', salida: '23:00' }],
      }, horas: 41.5 },
      'EMILIO': { turnos: {
        Lun: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        Mar: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
        'Mié': [{ entrada: '12:00', salida: '16:30' }, { entrada: '19:30', salida: '23:00' }],
        'Sáb': [{ entrada: '12:00', salida: '16:30' }, { entrada: '19:30', salida: '23:00' }],
        Dom: [{ entrada: '13:00', salida: '17:00' }, { entrada: '21:00', salida: '22:00' }],
      }, horas: 31 },
      'RUBÉN': { turnos: {
        Lun: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        Mar: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
        Vie: [{ entrada: '11:30', salida: '23:00' }],
        'Sáb': [{ entrada: '11:30', salida: '23:00' }],
        Dom: [{ entrada: '11:30', salida: '17:00' }, { entrada: '19:30', salida: '23:00' }],
      }, horas: 50 },
    },
  },
  {
    semana: 'S25', lunes: '2026-06-15',
    emps: {
      'RAY': { turnos: {
        Lun: [{ entrada: '13:30', salida: '23:15' }],
        Mar: [{ entrada: '12:00', salida: '16:30' }, { entrada: '20:00', salida: '23:15' }],
        'Mié': [{ entrada: '12:00', salida: '16:30' }, { entrada: '20:00', salida: '23:15' }],
        Jue: [{ entrada: '12:00', salida: '16:30' }, { entrada: '20:00', salida: '23:15' }],
        Vie: [{ entrada: '12:00', salida: '16:00' }, { entrada: '20:00', salida: '23:15' }],
      }, horas: 37.75 },
      'ANDRÉS': { turnos: {
        Jue: [{ entrada: '16:00', salida: '23:15' }],
        Vie: [{ entrada: '16:00', salida: '23:15' }],
        'Sáb': [{ entrada: '13:30', salida: '23:15' }],
        Dom: [{ entrada: '13:30', salida: '23:15' }],
      }, horas: 32 },
      'EMILIO': { turnos: {
        'Mié': [{ entrada: '13:00', salida: '16:30' }],
        Jue: [{ entrada: '13:00', salida: '16:30' }],
        'Sáb': [{ entrada: '12:30', salida: '16:00' }, { entrada: '20:30', salida: '23:00' }],
        Dom: [{ entrada: '12:30', salida: '16:00' }, { entrada: '20:30', salida: '23:00' }],
      }, horas: 19 },
      'RUBÉN': { turnos: {
        'Mié': [{ entrada: '16:30', salida: '23:00' }],
        Jue: [{ entrada: '16:30', salida: '23:00' }],
        Vie: [{ entrada: '15:30', salida: '23:15' }],
        'Sáb': [{ entrada: '12:00', salida: '23:15' }],
        Dom: [{ entrada: '12:00', salida: '23:15' }],
      }, horas: 43.25 },
    },
  },
]

export const SEMANAS_REALES: SemanaReal[] = RAW.map(r => ({
  lunes: r.lunes,
  turnos: Object.fromEntries(Object.entries(r.emps).map(([k, v]) => [MAP_NOMBRE[k] ?? k, v.turnos])),
  horas: Object.fromEntries(Object.entries(r.emps).map(([k, v]) => [MAP_NOMBRE[k] ?? k, v.horas])),
}))

export function getSemanaPorLunes(lunesISO: string): SemanaReal | null {
  return SEMANAS_REALES.find(s => s.lunes === lunesISO) ?? null
}

export function getHistoricoSemanas(): SemanaReal[] {
  return SEMANAS_REALES.slice(0, -1)
}

export function getSemanaActual(): SemanaReal | null {
  return SEMANAS_REALES[SEMANAS_REALES.length - 1] ?? null
}
