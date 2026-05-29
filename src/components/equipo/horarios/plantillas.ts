/**
 * Plantillas tipo S1-S5 — base sagrada del cuadrante cocina.
 * DiaKey usa 'Lun'..'Dom' (capitalizado), igual que utils.ts/DIAS.
 */
import type { DiaKey, Tramo } from '@/components/equipo/horarios/utils'

export type PlantillaId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6'

export interface Plantilla {
  id: PlantillaId
  nombre: string
  descripcion: string
  patron_libranza: {
    Ray: DiaKey[]
    'Andrés': DiaKey[]
    Emilio: DiaKey[]
    Rubén: DiaKey[]
  }
  turnos: Record<string, Partial<Record<DiaKey, Tramo[]>>>
  cierres: Partial<Record<DiaKey, string>>
  totales_objetivo: Record<string, number>
}

export const PLANTILLAS: Record<PlantillaId, Plantilla> = {
  S1: {
    id: 'S1',
    nombre: 'Semana 1',
    descripcion: 'Ray libra V+S · Andrés libra X+J · Rubén+Emilio libran L+M',
    patron_libranza: { Ray: ['Vie','Sáb'], 'Andrés': ['Mié','Jue'], Emilio: ['Lun','Mar'], 'Rubén': ['Lun','Mar'] },
    turnos: {
      Ray: {
        Lun: [{ entrada:'13:30', salida:'23:15' }],
        Mar: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        'Mié': [{ entrada:'13:00', salida:'23:15' }],
        Jue: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        Dom: [{ entrada:'14:30', salida:'23:15' }],
      },
      'Andrés': {
        Lun: [{ entrada:'12:00', salida:'16:30' }, { entrada:'19:30', salida:'23:15' }],
        Mar: [{ entrada:'13:00', salida:'23:15' }],
        Vie: [{ entrada:'12:00', salida:'16:30' }, { entrada:'19:30', salida:'23:15' }],
        'Sáb': [{ entrada:'13:00', salida:'23:15' }],
        Dom: [{ entrada:'13:00', salida:'16:00' }, { entrada:'20:30', salida:'23:15' }],
      },
      Emilio: {
        'Mié': [{ entrada:'13:00', salida:'16:00' }],
        Jue: [{ entrada:'12:30', salida:'16:00' }],
        Vie: [{ entrada:'13:00', salida:'16:00' }],
        'Sáb': [{ entrada:'13:00', salida:'16:00' }, { entrada:'21:00', salida:'22:30' }],
        Dom: [{ entrada:'14:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
      },
      'Rubén': {
        'Mié': [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
        Jue: [{ entrada:'16:30', salida:'23:00' }],
        Vie: [{ entrada:'16:00', salida:'23:00' }],
        'Sáb': [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
        Dom: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'22:30' }],
      },
    },
    cierres: {
      Lun: 'Andrés + Ray', Mar: 'Andrés + Ray',
      'Mié': 'Ray + Rubén + E', Jue: 'Ray + Rubén',
      Vie: 'Andrés + Rubén', 'Sáb': 'Andrés + Rubén + E', Dom: 'Ray + Rubén',
    },
    totales_objetivo: { Ray: 41.75, 'Andrés': 41.25, Emilio: 21, 'Rubén': 35.5 },
  },

  S2: {
    id: 'S2',
    nombre: 'Semana 2',
    descripcion: 'Ray libra X+J · Andrés libra V+S · Rubén+Emilio libran L+M',
    patron_libranza: { Ray: ['Mié','Jue'], 'Andrés': ['Vie','Sáb'], Emilio: ['Lun','Mar'], 'Rubén': ['Lun','Mar'] },
    turnos: {
      Ray: {
        Lun: [{ entrada:'13:30', salida:'23:15' }],
        Mar: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        Vie: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        'Sáb': [{ entrada:'13:30', salida:'23:15' }],
        Dom: [{ entrada:'14:30', salida:'23:15' }],
      },
      'Andrés': {
        Lun: [{ entrada:'12:00', salida:'16:30' }, { entrada:'19:30', salida:'23:15' }],
        Mar: [{ entrada:'12:30', salida:'23:15' }],
        'Mié': [{ entrada:'12:30', salida:'23:15' }],
        Jue: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        Dom: [{ entrada:'12:30', salida:'16:30' }, { entrada:'20:30', salida:'23:15' }],
      },
      Emilio: {
        'Mié': [{ entrada:'13:00', salida:'16:00' }],
        Jue: [{ entrada:'12:30', salida:'16:00' }],
        Vie: [{ entrada:'13:00', salida:'16:00' }],
        'Sáb': [{ entrada:'13:00', salida:'16:00' }, { entrada:'21:00', salida:'22:30' }],
        Dom: [{ entrada:'14:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
      },
      'Rubén': {
        'Mié': [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
        Jue: [{ entrada:'16:30', salida:'23:00' }],
        Vie: [{ entrada:'16:00', salida:'23:00' }],
        'Sáb': [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
        Dom: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'22:30' }],
      },
    },
    cierres: {
      Lun: 'Andrés + Ray', Mar: 'Andrés + Ray',
      'Mié': 'Andrés + Rubén + E', Jue: 'Andrés + Rubén',
      Vie: 'Ray + Rubén', 'Sáb': 'Ray + Rubén + E', Dom: 'Andrés + Rubén',
    },
    totales_objetivo: { Ray: 41.25, 'Andrés': 41.75, Emilio: 18, 'Rubén': 35.5 },
  },

  S3: {
    id: 'S3',
    nombre: 'Semana 3',
    descripcion: 'Rubén+Emilio libran X+J · Andrés+Ray libran L+M',
    patron_libranza: { Ray: ['Lun','Mar'], 'Andrés': ['Lun','Mar'], Emilio: ['Mié','Jue'], 'Rubén': ['Mié','Jue'] },
    turnos: {
      Ray: {
        'Mié': [{ entrada:'12:00', salida:'16:00' }, { entrada:'20:00', salida:'23:15' }],
        Jue: [{ entrada:'13:30', salida:'23:15' }],
        Vie: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        'Sáb': [{ entrada:'13:30', salida:'23:15' }],
        Dom: [{ entrada:'13:30', salida:'23:15' }],
      },
      'Andrés': {
        'Mié': [{ entrada:'13:00', salida:'23:15' }],
        Jue: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        Vie: [{ entrada:'13:00', salida:'23:15' }],
        'Sáb': [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        Dom: [{ entrada:'13:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
      },
      Emilio: {
        Lun: [{ entrada:'13:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
        Mar: [{ entrada:'13:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
        Vie: [{ entrada:'13:30', salida:'16:00' }],
        'Sáb': [{ entrada:'12:30', salida:'16:00' }],
        Dom: [{ entrada:'12:30', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
      },
      'Rubén': {
        Lun: [{ entrada:'12:00', salida:'23:00' }],
        Mar: [{ entrada:'12:00', salida:'23:00' }],
        Vie: [{ entrada:'20:00', salida:'23:00' }],
        'Sáb': [{ entrada:'12:30', salida:'16:00' }, { entrada:'20:00', salida:'22:30' }],
        Dom: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'22:30' }],
      },
    },
    cierres: {
      Lun: 'Andrés + Ray + Rubén', Mar: 'Andrés + Ray + Rubén',
      'Mié': 'Andrés + Ray', Jue: 'Andrés + Ray',
      Vie: 'Andrés + Rubén', 'Sáb': 'Andrés + Ray + Rubén', Dom: 'Andrés + Ray',
    },
    totales_objetivo: { Ray: 42.5, 'Andrés': 41.5, Emilio: 21.5, 'Rubén': 36.75 },
  },

  S4: {
    id: 'S4',
    nombre: 'Semana 4',
    descripcion: 'Emilio+Rubén libran S+D · Andrés libra X+J · Ray libra M+X',
    patron_libranza: { Ray: ['Mar','Mié'], 'Andrés': ['Mié','Jue'], Emilio: ['Sáb','Dom'], 'Rubén': ['Sáb','Dom'] },
    turnos: {
      Ray: {
        Lun: [{ entrada:'12:00', salida:'16:00' }, { entrada:'20:00', salida:'23:15' }],
        Jue: [{ entrada:'12:00', salida:'16:30' }, { entrada:'19:30', salida:'23:15' }],
        Vie: [{ entrada:'14:00', salida:'23:15' }],
        'Sáb': [{ entrada:'13:00', salida:'23:15' }],
        Dom: [{ entrada:'12:00', salida:'16:00' }, { entrada:'19:30', salida:'23:15' }],
      },
      'Andrés': {
        Lun: [{ entrada:'13:30', salida:'23:15' }],
        Mar: [{ entrada:'13:30', salida:'23:15' }],
        Vie: [{ entrada:'12:00', salida:'15:30' }, { entrada:'20:30', salida:'23:15' }],
        'Sáb': [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        Dom: [{ entrada:'13:00', salida:'23:15' }],
      },
      Emilio: {
        Mar: [{ entrada:'13:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
        'Mié': [{ entrada:'13:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
        Jue: [{ entrada:'13:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
        Vie: [{ entrada:'13:00', salida:'16:00' }],
      },
      'Rubén': {
        Lun: [{ entrada:'20:00', salida:'23:00' }],
        Mar: [{ entrada:'12:00', salida:'23:00' }],
        'Mié': [{ entrada:'12:00', salida:'23:00' }],
        Jue: [{ entrada:'16:00', salida:'23:00' }],
        Vie: [{ entrada:'20:00', salida:'23:00' }],
      },
    },
    cierres: {
      Lun: 'Ray+Rub', Mar: 'And+Rub', 'Mié': 'Rub+E', Jue: 'Ray+Rub',
      Vie: 'And+Ray+Rub', 'Sáb': 'And+Ray', Dom: 'And+Ray',
    },
    totales_objetivo: { Ray: 41.75, 'Andrés': 41.25, Emilio: 18, 'Rubén': 35 },
  },

  S5: {
    id: 'S5',
    nombre: 'Semana 5',
    descripcion: 'Como S3 pero Rubén libra el viernes noche (se va con Emilio)',
    patron_libranza: { Ray: ['Sáb','Dom'], 'Andrés': ['Mié','Jue'], Emilio: ['Lun','Mar'], 'Rubén': ['Lun','Mar'] },
    turnos: {
      Ray: {
        Lun: [{ entrada:'13:30', salida:'23:15' }],
        Mar: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        'Mié': [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        Jue: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        Vie: [{ entrada:'13:30', salida:'23:15' }],
      },
      'Andrés': {
        Lun: [{ entrada:'12:00', salida:'16:00' }, { entrada:'20:00', salida:'23:15' }],
        Mar: [{ entrada:'13:30', salida:'23:15' }],
        Vie: [{ entrada:'12:00', salida:'16:00' }, { entrada:'20:00', salida:'23:15' }],
        'Sáb': [{ entrada:'13:30', salida:'23:15' }],
        Dom: [{ entrada:'13:30', salida:'23:15' }],
      },
      Emilio: {
        'Mié': [{ entrada:'13:00', salida:'16:30' }],
        Jue: [{ entrada:'13:00', salida:'16:30' }],
        'Sáb': [{ entrada:'13:00', salida:'16:00' }, { entrada:'21:00', salida:'22:30' }],
        Dom: [{ entrada:'14:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
      },
      'Rubén': {
        'Mié': [{ entrada:'16:30', salida:'23:00' }],
        Jue: [{ entrada:'16:30', salida:'23:00' }],
        'Sáb': [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
        Dom: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
      },
    },
    cierres: {
      Lun: 'And+Ray', Mar: 'And+Ray',
      'Mié': 'Ray+Rub', Jue: 'Ray+Rub',
      Vie: 'And+Ray', 'Sáb': 'And+Rub+E', Dom: 'And+Rub',
    },
    totales_objetivo: { Ray: 40.25, 'Andrés': 42.5, Emilio: 15.5, 'Rubén': 28 },
  },

  S6: {
    id: 'S6',
    nombre: 'Semana 6',
    descripcion: 'Igual que S5 con Ray y Andrés intercambiados',
    patron_libranza: { Ray: ['Mié','Jue'], 'Andrés': ['Sáb','Dom'], Emilio: ['Lun','Mar'], 'Rubén': ['Lun','Mar'] },
    turnos: {
      Ray: {
        Lun: [{ entrada:'12:00', salida:'16:00' }, { entrada:'20:00', salida:'23:15' }],
        Mar: [{ entrada:'13:30', salida:'23:15' }],
        Vie: [{ entrada:'12:00', salida:'16:00' }, { entrada:'20:00', salida:'23:15' }],
        'Sáb': [{ entrada:'13:30', salida:'23:15' }],
        Dom: [{ entrada:'13:30', salida:'23:15' }],
      },
      'Andrés': {
        Lun: [{ entrada:'13:30', salida:'23:15' }],
        Mar: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        'Mié': [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        Jue: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        Vie: [{ entrada:'13:30', salida:'23:15' }],
      },
      Emilio: {
        'Mié': [{ entrada:'13:00', salida:'16:30' }],
        Jue: [{ entrada:'13:00', salida:'16:30' }],
        'Sáb': [{ entrada:'13:00', salida:'16:00' }, { entrada:'21:00', salida:'22:30' }],
        Dom: [{ entrada:'14:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
      },
      'Rubén': {
        'Mié': [{ entrada:'16:30', salida:'23:00' }],
        Jue: [{ entrada:'16:30', salida:'23:00' }],
        'Sáb': [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
        Dom: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
      },
    },
    cierres: {
      Lun: 'And+Ray', Mar: 'And+Ray',
      'Mié': 'And+Rub', Jue: 'And+Rub',
      Vie: 'And+Ray', 'Sáb': 'Ray+Rub+E', Dom: 'Ray+Rub',
    },
    totales_objetivo: { Ray: 42.5, 'Andrés': 40.25, Emilio: 15.5, 'Rubén': 28 },
  },
}

export function aplicarPlantilla(plantillaId: PlantillaId, swapRayAndres = false): Plantilla['turnos'] {
  const p = PLANTILLAS[plantillaId]
  if (!swapRayAndres) return p.turnos
  return {
    Ray: p.turnos['Andrés'] ?? {},
    'Andrés': p.turnos['Ray'] ?? {},
    Emilio: p.turnos['Emilio'] ?? {},
    'Rubén': p.turnos['Rubén'] ?? {},
  }
}

export interface AsignacionPlanning {
  semana: string
  lunes: string
  plantilla: PlantillaId | null
  swapRayAndres: boolean
  finde_largo?: string
  finde_medio?: string
  nota?: string
}

export const PLANNING_2026: AsignacionPlanning[] = [
  { semana: 'S22', lunes: '2026-05-25', plantilla: null, swapRayAndres: false, nota: 'Datos reales del Excel (semana actual)' },
  { semana: 'S23', lunes: '2026-06-01', plantilla: 'S2', swapRayAndres: false, finde_medio: 'Andrés' },
  { semana: 'S24', lunes: '2026-06-08', plantilla: 'S1', swapRayAndres: false, finde_medio: 'Ray' },
  { semana: 'S25', lunes: '2026-06-15', plantilla: 'S3', swapRayAndres: false, finde_largo: 'Ray (1/2)' },
  { semana: 'S26', lunes: '2026-06-22', plantilla: 'S2', swapRayAndres: false, finde_largo: 'Ray (2/2)', finde_medio: 'Andrés' },
  { semana: 'S27', lunes: '2026-06-29', plantilla: 'S4', swapRayAndres: false, finde_largo: 'Rubén+Emilio (1/2)' },
  { semana: 'S28', lunes: '2026-07-06', plantilla: 'S4', swapRayAndres: false, finde_largo: 'Rubén+Emilio (2/2)' },
  { semana: 'S29', lunes: '2026-07-13', plantilla: 'S3', swapRayAndres: true, finde_largo: 'Andrés (1/2)' },
  { semana: 'S30', lunes: '2026-07-20', plantilla: 'S2', swapRayAndres: true, finde_largo: 'Andrés (2/2)', finde_medio: 'Ray' },
  { semana: 'S31', lunes: '2026-07-27', plantilla: 'S3', swapRayAndres: false, finde_largo: 'Ray (1/2)' },
  { semana: 'S32', lunes: '2026-08-03', plantilla: 'S2', swapRayAndres: false, finde_largo: 'Ray (2/2)', finde_medio: 'Andrés' },
  { semana: 'S33', lunes: '2026-08-10', plantilla: 'S4', swapRayAndres: false, finde_largo: 'Rubén+Emilio (1/2)' },
  { semana: 'S34', lunes: '2026-08-17', plantilla: 'S4', swapRayAndres: false, finde_largo: 'Rubén+Emilio (2/2)' },
  { semana: 'S35', lunes: '2026-08-24', plantilla: 'S3', swapRayAndres: true, finde_largo: 'Andrés (1/2)' },
]

export function getAsignacionPorLunes(lunesISO: string): AsignacionPlanning | null {
  return PLANNING_2026.find(a => a.lunes === lunesISO) ?? null
}
