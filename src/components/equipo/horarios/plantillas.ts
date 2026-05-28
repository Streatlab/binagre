/**
 * Plantillas tipo S1-S5 — base sagrada del cuadrante cocina.
 * Datos exactos del HTML aprobado por Rubén (HORARIOS__1_.html).
 * Aplicadas según planning S22→S35 + posteriores.
 *
 * Cierres: array por día (Lun..Dom) con los nombres que cierran.
 */
import type { DiaKey, Tramo } from '@/components/equipo/horarios/utils'

export type PlantillaId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5'

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
  // turnos[pila][dia] = tramos. Día sin entrada = libre.
  turnos: Record<string, Partial<Record<DiaKey, Tramo[]>>>
  cierres: Partial<Record<DiaKey, string>>
  totales_objetivo: Record<string, number>
}

export const PLANTILLAS: Record<PlantillaId, Plantilla> = {
  S1: {
    id: 'S1',
    nombre: 'Semana 1',
    descripcion: 'Ray libra V+S · Andrés libra X+J · Rubén+Emilio libran L+M',
    patron_libranza: { Ray: ['vie','sab'], 'Andrés': ['mie','jue'], Emilio: ['lun','mar'], 'Rubén': ['lun','mar'] },
    turnos: {
      Ray: {
        lun: [{ entrada:'13:30', salida:'23:15' }],
        mar: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        mie: [{ entrada:'13:00', salida:'23:15' }],
        jue: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        dom: [{ entrada:'14:30', salida:'23:15' }],
      },
      'Andrés': {
        lun: [{ entrada:'12:00', salida:'16:30' }, { entrada:'19:30', salida:'23:15' }],
        mar: [{ entrada:'13:00', salida:'23:15' }],
        vie: [{ entrada:'12:00', salida:'16:30' }, { entrada:'19:30', salida:'23:15' }],
        sab: [{ entrada:'13:00', salida:'23:15' }],
        dom: [{ entrada:'13:00', salida:'16:00' }, { entrada:'20:30', salida:'23:15' }],
      },
      Emilio: {
        mie: [{ entrada:'13:00', salida:'16:00' }],
        jue: [{ entrada:'12:30', salida:'16:00' }],
        vie: [{ entrada:'13:00', salida:'16:00' }],
        sab: [{ entrada:'13:00', salida:'16:00' }, { entrada:'21:00', salida:'22:30' }],
        dom: [{ entrada:'14:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
      },
      'Rubén': {
        mie: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
        jue: [{ entrada:'16:30', salida:'23:00' }],
        vie: [{ entrada:'16:00', salida:'23:00' }],
        sab: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
        dom: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'22:30' }],
      },
    },
    cierres: {
      lun: 'Andrés + Ray', mar: 'Andrés + Ray',
      mie: 'Ray + Rubén + E', jue: 'Ray + Rubén',
      vie: 'Andrés + Rubén', sab: 'Andrés + Rubén + E', dom: 'Ray + Rubén',
    },
    totales_objetivo: { Ray: 41.75, 'Andrés': 41.25, Emilio: 21, 'Rubén': 35.5 },
  },

  S2: {
    id: 'S2',
    nombre: 'Semana 2',
    descripcion: 'Ray libra X+J · Andrés libra V+S · Rubén+Emilio libran L+M',
    patron_libranza: { Ray: ['mie','jue'], 'Andrés': ['vie','sab'], Emilio: ['lun','mar'], 'Rubén': ['lun','mar'] },
    turnos: {
      Ray: {
        lun: [{ entrada:'13:30', salida:'23:15' }],
        mar: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        vie: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        sab: [{ entrada:'13:30', salida:'23:15' }],
        dom: [{ entrada:'14:30', salida:'23:15' }],
      },
      'Andrés': {
        lun: [{ entrada:'12:00', salida:'16:30' }, { entrada:'19:30', salida:'23:15' }],
        mar: [{ entrada:'12:30', salida:'23:15' }],
        mie: [{ entrada:'12:30', salida:'23:15' }],
        jue: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        dom: [{ entrada:'12:30', salida:'16:30' }, { entrada:'20:30', salida:'23:15' }],
      },
      Emilio: {
        mie: [{ entrada:'13:00', salida:'16:00' }],
        jue: [{ entrada:'12:30', salida:'16:00' }],
        vie: [{ entrada:'13:00', salida:'16:00' }],
        sab: [{ entrada:'13:00', salida:'16:00' }, { entrada:'21:00', salida:'22:30' }],
        dom: [{ entrada:'14:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
      },
      'Rubén': {
        mie: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
        jue: [{ entrada:'16:30', salida:'23:00' }],
        vie: [{ entrada:'16:00', salida:'23:00' }],
        sab: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
        dom: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'22:30' }],
      },
    },
    cierres: {
      lun: 'Andrés + Ray', mar: 'Andrés + Ray',
      mie: 'Andrés + Rubén + E', jue: 'Andrés + Rubén',
      vie: 'Ray + Rubén', sab: 'Ray + Rubén + E', dom: 'Andrés + Rubén',
    },
    totales_objetivo: { Ray: 41.25, 'Andrés': 41.75, Emilio: 18, 'Rubén': 35.5 },
  },

  S3: {
    id: 'S3',
    nombre: 'Semana 3',
    descripcion: 'Rubén+Emilio libran X+J · Andrés+Ray libran L+M',
    patron_libranza: { Ray: ['lun','mar'], 'Andrés': ['lun','mar'], Emilio: ['mie','jue'], 'Rubén': ['mie','jue'] },
    turnos: {
      Ray: {
        mie: [{ entrada:'12:00', salida:'16:00' }, { entrada:'20:00', salida:'23:15' }],
        jue: [{ entrada:'13:30', salida:'23:15' }],
        vie: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        sab: [{ entrada:'13:30', salida:'23:15' }],
        dom: [{ entrada:'13:30', salida:'23:15' }],
      },
      'Andrés': {
        mie: [{ entrada:'13:00', salida:'23:15' }],
        jue: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        vie: [{ entrada:'13:00', salida:'23:15' }],
        sab: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        dom: [{ entrada:'13:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
      },
      Emilio: {
        lun: [{ entrada:'13:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
        mar: [{ entrada:'13:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
        vie: [{ entrada:'13:30', salida:'16:00' }],
        sab: [{ entrada:'12:30', salida:'16:00' }],
        dom: [{ entrada:'12:30', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
      },
      'Rubén': {
        lun: [{ entrada:'12:00', salida:'23:00' }],
        mar: [{ entrada:'12:00', salida:'23:00' }],
        vie: [{ entrada:'20:00', salida:'23:00' }],
        sab: [{ entrada:'12:30', salida:'16:00' }, { entrada:'20:00', salida:'22:30' }],
        dom: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'22:30' }],
      },
    },
    cierres: {
      lun: 'Andrés + Ray + Rubén', mar: 'Andrés + Ray + Rubén',
      mie: 'Andrés + Ray', jue: 'Andrés + Ray',
      vie: 'Andrés + Rubén', sab: 'Andrés + Ray + Rubén', dom: 'Andrés + Ray',
    },
    totales_objetivo: { Ray: 42.5, 'Andrés': 41.5, Emilio: 21.5, 'Rubén': 36.75 },
  },

  S4: {
    id: 'S4',
    nombre: 'Semana 4',
    descripcion: 'Emilio+Rubén libran S+D · Andrés libra X+J · Ray libra M+X',
    patron_libranza: { Ray: ['mar','mie'], 'Andrés': ['mie','jue'], Emilio: ['sab','dom'], 'Rubén': ['sab','dom'] },
    turnos: {
      Ray: {
        lun: [{ entrada:'12:00', salida:'16:00' }, { entrada:'20:00', salida:'23:15' }],
        jue: [{ entrada:'12:00', salida:'16:30' }, { entrada:'19:30', salida:'23:15' }],
        vie: [{ entrada:'14:00', salida:'23:15' }],
        sab: [{ entrada:'13:00', salida:'23:15' }],
        dom: [{ entrada:'12:00', salida:'16:00' }, { entrada:'19:30', salida:'23:15' }],
      },
      'Andrés': {
        lun: [{ entrada:'13:30', salida:'23:15' }],
        mar: [{ entrada:'13:30', salida:'23:15' }],
        vie: [{ entrada:'12:00', salida:'15:30' }, { entrada:'20:30', salida:'23:15' }],
        sab: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        dom: [{ entrada:'13:00', salida:'23:15' }],
      },
      Emilio: {
        mar: [{ entrada:'13:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
        mie: [{ entrada:'13:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
        jue: [{ entrada:'13:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
        vie: [{ entrada:'13:00', salida:'16:00' }],
      },
      'Rubén': {
        lun: [{ entrada:'20:00', salida:'23:00' }],
        mar: [{ entrada:'12:00', salida:'23:00' }],
        mie: [{ entrada:'12:00', salida:'23:00' }],
        jue: [{ entrada:'16:00', salida:'23:00' }],
        vie: [{ entrada:'20:00', salida:'23:00' }],
      },
    },
    cierres: {
      lun: 'Ray+Rub', mar: 'And+Rub', mie: 'Rub+E', jue: 'Ray+Rub',
      vie: 'And+Ray+Rub', sab: 'And+Ray', dom: 'And+Ray',
    },
    totales_objetivo: { Ray: 41.75, 'Andrés': 41.25, Emilio: 18, 'Rubén': 35 },
  },

  S5: {
    id: 'S5',
    nombre: 'Semana 5',
    descripcion: 'Como S3 pero Rubén libra el viernes noche (se va con Emilio)',
    patron_libranza: { Ray: ['sab','dom'], 'Andrés': ['mie','jue'], Emilio: ['lun','mar'], 'Rubén': ['lun','mar'] },
    turnos: {
      Ray: {
        lun: [{ entrada:'13:30', salida:'23:15' }],
        mar: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        mie: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        jue: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:15' }],
        vie: [{ entrada:'13:30', salida:'23:15' }],
      },
      'Andrés': {
        lun: [{ entrada:'12:00', salida:'16:00' }, { entrada:'20:00', salida:'23:15' }],
        mar: [{ entrada:'13:30', salida:'23:15' }],
        vie: [{ entrada:'12:00', salida:'16:00' }, { entrada:'20:00', salida:'23:15' }],
        sab: [{ entrada:'13:30', salida:'23:15' }],
        dom: [{ entrada:'13:30', salida:'23:15' }],
      },
      Emilio: {
        mie: [{ entrada:'13:00', salida:'16:30' }],
        jue: [{ entrada:'13:00', salida:'16:30' }],
        sab: [{ entrada:'13:00', salida:'16:00' }, { entrada:'21:00', salida:'22:30' }],
        dom: [{ entrada:'14:00', salida:'16:00' }, { entrada:'20:00', salida:'22:00' }],
      },
      'Rubén': {
        mie: [{ entrada:'16:30', salida:'23:00' }],
        jue: [{ entrada:'16:30', salida:'23:00' }],
        sab: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
        dom: [{ entrada:'12:00', salida:'16:30' }, { entrada:'20:00', salida:'23:00' }],
      },
    },
    cierres: {
      lun: 'And+Ray', mar: 'And+Ray',
      mie: 'Ray+Rub', jue: 'Ray+Rub',
      vie: 'And+Ray', sab: 'And+Rub+E', dom: 'And+Rub',
    },
    totales_objetivo: { Ray: 40.25, 'Andrés': 42.5, Emilio: 15.5, 'Rubén': 28 },
  },
}

/**
 * Aplica una plantilla con swap opcional Ray↔Andrés.
 * Ray siempre debe quedar en fila 1 (encargado de cocina).
 * Cuando `swapRayAndres=true`, los turnos de Andrés pasan a Ray y los de Ray pasan a Andrés.
 */
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

/**
 * Planning S22→S35 (junio–agosto 2026).
 * S22 = real, no plantilla. El resto aplica plantilla S1–S5 con swap si toca.
 */
export interface AsignacionPlanning {
  semana: string // S22, S23…
  lunes: string // YYYY-MM-DD
  plantilla: PlantillaId | null // null = datos reales en datosReales.ts (S22)
  swapRayAndres: boolean
  finde_largo?: string // a quién toca
  finde_medio?: string
  nota?: string
}

export const PLANNING_2026: AsignacionPlanning[] = [
  { semana: 'S22', lunes: '2026-05-25', plantilla: null, swapRayAndres: false, nota: 'Datos reales del Excel (semana actual)' },
  { semana: 'S23', lunes: '2026-06-01', plantilla: 'S1', swapRayAndres: false, finde_medio: 'Ray' },
  { semana: 'S24', lunes: '2026-06-08', plantilla: 'S2', swapRayAndres: false, finde_medio: 'Andrés' },
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
