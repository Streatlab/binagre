// matchEmpleado.ts (cliente) — gemela de api/_lib/matchEmpleado.ts: misma lógica
// pura de resolución de empleado por nombre (cualquier orden de palabras) / NIF /
// alias, para que todos los módulos de Equipo (nóminas, SS, horarios, incentivos)
// comparen nombres de la misma forma en vez de strings a pelo. No se puede
// compartir un único archivo con la versión de servidor (api/ y src/ son builds
// distintos), así que esta copia contiene la misma lógica sin I/O de Node.
import { supabase } from '@/lib/supabase'

export interface CandidatoEmpleado {
  id: string
  nombre: string
  nombre_oficial: string | null
  nif: string | null
  aliases: string[]
}

export interface ResolucionEmpleado {
  empleado_id: string
  nombre: string
  metodo: 'nif' | 'exacto' | 'alias' | 'palabras'
  motivo: string
}

export function normalizarNombrePersona(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizarNif(s: string | null | undefined): string {
  if (!s) return ''
  return s.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

function palabrasOrdenadas(s: string): string {
  return normalizarNombrePersona(s).split(' ').filter(Boolean).sort().join(' ')
}

function palabrasSignificativas(s: string): Set<string> {
  return new Set(normalizarNombrePersona(s).split(' ').filter(p => p.length >= 3))
}

/** Carga todos los empleados activos con su nombre oficial, NIF y alias. */
export async function cargarCandidatosEmpleados(): Promise<CandidatoEmpleado[]> {
  const [{ data: empleados }, { data: alias }] = await Promise.all([
    supabase.from('empleados').select('id, nombre, nombre_oficial, nif').eq('estado', 'activo'),
    supabase.from('empleado_alias').select('empleado_id, alias'),
  ])
  const aliasPorEmpleado = new Map<string, string[]>()
  for (const a of (alias ?? []) as { empleado_id: string; alias: string }[]) {
    const arr = aliasPorEmpleado.get(a.empleado_id) ?? []
    arr.push(a.alias)
    aliasPorEmpleado.set(a.empleado_id, arr)
  }
  return ((empleados ?? []) as { id: string; nombre: string; nombre_oficial: string | null; nif: string | null }[]).map(e => ({
    id: e.id,
    nombre: e.nombre,
    nombre_oficial: e.nombre_oficial,
    nif: e.nif,
    aliases: aliasPorEmpleado.get(e.id) ?? [],
  }))
}

/** Misma lógica que la versión de servidor: NIF > nombre exacto (cualquier orden) > ≥2 palabras comunes. */
export function resolverEmpleado(
  nombreLibre: string | null | undefined,
  nifLibre: string | null | undefined,
  candidatos: CandidatoEmpleado[],
): ResolucionEmpleado | null {
  const nifNorm = normalizarNif(nifLibre)
  if (nifNorm) {
    const porNif = candidatos.find(c => normalizarNif(c.nif) === nifNorm)
    if (porNif) return { empleado_id: porNif.id, nombre: porNif.nombre, metodo: 'nif', motivo: `NIF ${nifNorm} coincide con ${porNif.nombre}` }
  }

  if (!nombreLibre) return null
  const libreNorm = normalizarNombrePersona(nombreLibre)
  if (!libreNorm) return null
  const libreOrdenado = palabrasOrdenadas(nombreLibre)

  for (const c of candidatos) {
    const nombres = [c.nombre, c.nombre_oficial, ...c.aliases].filter(Boolean) as string[]
    for (const candidato of nombres) {
      const candNorm = normalizarNombrePersona(candidato)
      if (!candNorm) continue
      if (candNorm === libreNorm || palabrasOrdenadas(candidato) === libreOrdenado) {
        const esOficial = candidato === c.nombre || candidato === c.nombre_oficial
        return {
          empleado_id: c.id,
          nombre: c.nombre,
          metodo: esOficial ? 'exacto' : 'alias',
          motivo: `"${nombreLibre}" coincide con "${candidato}"`,
        }
      }
    }
  }

  const librePalabras = palabrasSignificativas(nombreLibre)
  for (const c of candidatos) {
    const nombres = [c.nombre, c.nombre_oficial, ...c.aliases].filter(Boolean) as string[]
    for (const candidato of nombres) {
      const candPalabras = palabrasSignificativas(candidato)
      const comunes = [...librePalabras].filter(p => candPalabras.has(p))
      const esSubconjunto = comunes.length >= 2 && (comunes.length === librePalabras.size || comunes.length === candPalabras.size)
      if (esSubconjunto) {
        return {
          empleado_id: c.id,
          nombre: c.nombre,
          metodo: 'palabras',
          motivo: `"${nombreLibre}" y "${candidato}" comparten ${comunes.length} palabras (${comunes.join(', ')})`,
        }
      }
    }
  }

  return null
}
