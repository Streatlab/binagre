// resolverEmpleado — resuelve un nombre libre (banco, cuadrante, resumen de gestoría…)
// contra la tabla `empleados`, comprobando también sus alias (`empleado_alias`).
//
// Regla dura de negocio: NUNCA fusionar dos personas por una coincidencia débil.
// Solo se resuelve automáticamente si:
//   (a) el nombre normalizado coincide EXACTO con `empleados.nombre` o con algún alias, o
//   (b) uno de los dos nombres (libre vs candidato) es un subconjunto de palabras del
//       otro con AL MENOS 2 palabras en común (ej. "Juan Ramón Méndez" ⊂ "Juan Ramón
//       Méndez Melo") — evita que una sola palabra común ("Andrés") empareje a la
//       persona equivocada.
// Cualquier otro caso → sin resolver, el llamador debe marcarlo "revisar identidad".

import type { SupabaseClient } from '@supabase/supabase-js'

export interface EmpleadoCandidato {
  empleado_id: string
  nombre: string
}

export interface ResolucionEmpleado {
  empleado_id: string
  nombre: string
  confianza: number // 100 = coincidencia exacta, 80 = subconjunto de palabras
  motivo: string
}

export function normalizarNombre(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function palabras(s: string): Set<string> {
  return new Set(normalizarNombre(s).split(' ').filter(p => p.length >= 3))
}

/** Trae, para cada empleado, todos sus nombres válidos (nombre oficial + alias). */
export async function cargarNombresEmpleados(supabase: SupabaseClient): Promise<Map<string, string[]>> {
  const [{ data: empleados }, { data: alias }] = await Promise.all([
    supabase.from('empleados').select('id, nombre').eq('estado', 'activo'),
    supabase.from('empleado_alias').select('empleado_id, alias'),
  ])
  const mapa = new Map<string, string[]>()
  for (const e of (empleados ?? []) as { id: string; nombre: string }[]) {
    mapa.set(e.id, [e.nombre])
  }
  for (const a of (alias ?? []) as { empleado_id: string; alias: string }[]) {
    const arr = mapa.get(a.empleado_id)
    if (arr) arr.push(a.alias)
  }
  return mapa
}

/** Resuelve un nombre libre contra el mapa de nombres/alias ya cargado. null = sin match seguro. */
export function resolverNombre(nombreLibre: string, mapaNombres: Map<string, string[]>): ResolucionEmpleado | null {
  const libreNorm = normalizarNombre(nombreLibre)
  if (!libreNorm) return null
  const librePalabras = palabras(nombreLibre)

  for (const [empleadoId, nombres] of mapaNombres) {
    for (const candidato of nombres) {
      const candNorm = normalizarNombre(candidato)
      if (candNorm && candNorm === libreNorm) {
        return { empleado_id: empleadoId, nombre: candidato, confianza: 100, motivo: `coincidencia exacta con "${candidato}"` }
      }
    }
  }

  for (const [empleadoId, nombres] of mapaNombres) {
    for (const candidato of nombres) {
      const candPalabras = palabras(candidato)
      const comunes = [...librePalabras].filter(p => candPalabras.has(p))
      const esSubconjunto = comunes.length >= 2 && (comunes.length === librePalabras.size || comunes.length === candPalabras.size)
      if (esSubconjunto) {
        return {
          empleado_id: empleadoId,
          nombre: candidato,
          confianza: 80,
          motivo: `"${nombreLibre}" y "${candidato}" comparten ${comunes.length} palabras (${comunes.join(', ')})`,
        }
      }
    }
  }

  return null
}
