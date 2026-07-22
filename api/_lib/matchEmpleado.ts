// matchEmpleado.ts — resuelve un nombre "como se dice en el día a día" (cuadrante,
// cuenta bancaria, documento de la gestoría en orden APELLIDOS, NOMBRE…) contra un
// empleado real, en cualquier orden de nombre/apellidos, por NIF si aparece, o por
// alias ya aprendidos. Sustituye a resolverEmpleado.ts (mismo criterio conservador:
// NUNCA fusionar por una coincidencia débil) con matching robusto al orden de las
// palabras. Gemela de src/lib/equipo/matchEmpleado.ts (misma lógica pura, dos
// entornos: Node/servidor aquí, navegador allí — no se pueden compartir un único
// módulo porque api/ y src/ son dos builds distintos).
import type { SupabaseClient } from '@supabase/supabase-js'

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

// Palabras ordenadas alfabéticamente: hace el match indiferente al orden real de
// nombre/apellidos ("CASTILLO GARCIA JOSE ANDRES" == "JOSE ANDRES CASTILLO GARCIA").
function palabrasOrdenadas(s: string): string {
  return normalizarNombrePersona(s).split(' ').filter(Boolean).sort().join(' ')
}

function palabrasSignificativas(s: string): Set<string> {
  return new Set(normalizarNombrePersona(s).split(' ').filter(p => p.length >= 3))
}

/** Carga los empleados de PLANTILLA con su nombre oficial, NIF y alias — incluidos
 *  los que ya no trabajan aquí: sus nóminas y documentos históricos siguen llegando
 *  y deben archivarse igual (antes se filtraba por estado='activo' y las nóminas de
 *  un ex-empleado acababan siempre en la cola de revisión). */
export async function cargarCandidatosEmpleados(supabase: SupabaseClient): Promise<CandidatoEmpleado[]> {
  const [{ data: empleados }, { data: alias }] = await Promise.all([
    // Solo PLANTILLA cobra nómina. Los EXTRA (se pagan por Bizum/transferencia) y
    // los SOCIOS (administradores, sin nómina) se excluyen del matching: además de
    // no contar como "falta su nómina", evita que el nombre del titular que sale en
    // la cabecera de todos los documentos de la gestoría cree nóminas fantasma.
    supabase.from('empleados').select('id, nombre, nombre_oficial, nif, aliases, tipo_relacion').eq('tipo_relacion', 'plantilla'),
    supabase.from('empleado_alias').select('empleado_id, alias'),
  ])
  const aliasPorEmpleado = new Map<string, string[]>()
  for (const a of (alias ?? []) as { empleado_id: string; alias: string }[]) {
    const arr = aliasPorEmpleado.get(a.empleado_id) ?? []
    arr.push(a.alias)
    aliasPorEmpleado.set(a.empleado_id, arr)
  }
  return ((empleados ?? []) as { id: string; nombre: string; nombre_oficial: string | null; nif: string | null; aliases: string[] | null }[]).map(e => ({
    id: e.id,
    nombre: e.nombre,
    nombre_oficial: e.nombre_oficial,
    nif: e.nif,
    // Alias = union de la tabla empleado_alias Y la columna empleados.aliases
    // (la ficha guarda ahí p.ej. el nombre legal de Ray: "Juan Ramón Méndez Melo";
    // antes solo se leía la tabla y esos alias se ignoraban).
    aliases: [...new Set([...(aliasPorEmpleado.get(e.id) ?? []), ...((e.aliases ?? []) as string[])])],
  }))
}

/** Carga los marcados `es_empleador=true` (el titular/autónomo, p.ej. Rubén). Se usa
 *  para DESCARTAR EN SILENCIO una fila que el parser haya leído como si fuera un
 *  trabajador (p.ej. su nombre sin el prefijo "CENTRO:"): nunca debe generar ni
 *  una nómina ni un aviso de revisión, a diferencia de un nombre desconocido de
 *  verdad, que sí va a revisión. Dato explícito, no nombre a fuego. */
export async function cargarEmpleadores(supabase: SupabaseClient): Promise<CandidatoEmpleado[]> {
  const { data: empleados } = await supabase
    .from('empleados').select('id, nombre, nombre_oficial, nif, aliases').eq('es_empleador', true)
  return ((empleados ?? []) as { id: string; nombre: string; nombre_oficial: string | null; nif: string | null; aliases: string[] | null }[]).map(e => ({
    id: e.id, nombre: e.nombre, nombre_oficial: e.nombre_oficial, nif: e.nif, aliases: (e.aliases ?? []) as string[],
  }))
}

/**
 * Resuelve un nombre/NIF libre contra la lista de candidatos ya cargada.
 * Orden de prioridad: NIF exacto > nombre/nombre_oficial/alias exacto (cualquier
 * orden de palabras) > subconjunto de ≥2 palabras en común (mismo criterio
 * conservador que resolverEmpleado.ts). null = sin match seguro.
 */
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

/**
 * Último recurso cuando no se ha podido aislar el nombre del trabajador de la
 * cabecera: busca a cada empleado conocido dentro del texto completo del documento.
 * Solo devuelve resultado si aparece UNO y solo uno — si hay varios (un resumen,
 * por ejemplo) no se adivina: el documento va a revisión.
 */
export function resolverEmpleadoEnTexto(
  texto: string,
  candidatos: CandidatoEmpleado[],
): ResolucionEmpleado | null {
  const textoNorm = normalizarNombrePersona(texto)
  if (!textoNorm) return null
  const encontrados: ResolucionEmpleado[] = []

  for (const c of candidatos) {
    const nombres = [c.nombre, c.nombre_oficial, ...c.aliases].filter(Boolean) as string[]
    let acierto: string | null = null
    for (const candidato of nombres) {
      const palabras = [...palabrasSignificativas(candidato)]
      if (palabras.length < 2) continue
      if (palabras.every(p => textoNorm.includes(p))) { acierto = candidato; break }
    }
    if (acierto) {
      encontrados.push({
        empleado_id: c.id,
        nombre: c.nombre,
        metodo: 'palabras',
        motivo: `El documento nombra a "${acierto}"`,
      })
    }
  }

  return encontrados.length === 1 ? encontrados[0] : null
}

/**
 * Variante plural: devuelve TODOS los empleados que aparecen en el texto. La usa el
 * flujo multi-nómina para descartar el "ruido del empleador": en el PDF único de la
 * gestoría, el nombre de la empresa/autónomo aparece en TODAS las páginas — si ese
 * nombre coincide con un empleado, casaba en todos los segmentos y bloqueaba la
 * identificación del trabajador real.
 */
export function resolverEmpleadosEnTexto(
  texto: string,
  candidatos: CandidatoEmpleado[],
): ResolucionEmpleado[] {
  const textoNorm = normalizarNombrePersona(texto)
  if (!textoNorm) return []
  const encontrados: ResolucionEmpleado[] = []
  for (const c of candidatos) {
    const nombres = [c.nombre, c.nombre_oficial, ...c.aliases].filter(Boolean) as string[]
    for (const candidato of nombres) {
      const palabras = [...palabrasSignificativas(candidato)]
      if (palabras.length < 2) continue
      if (palabras.every(p => textoNorm.includes(p))) {
        encontrados.push({ empleado_id: c.id, nombre: c.nombre, metodo: 'palabras', motivo: `El documento nombra a "${candidato}"` })
        break
      }
    }
  }
  return encontrados
}

/**
 * Autoaprendizaje: guarda el nombre tal cual venía en el documento como alias del
 * empleado, si no coincide ya literalmente con su nombre/nombre_oficial/algún alias
 * existente. No se vuelve a preguntar la próxima vez que aparezca ese mismo nombre.
 */
export async function aprenderAlias(supabase: SupabaseClient, empleadoId: string, nombreEnDocumento: string | null | undefined): Promise<void> {
  if (!nombreEnDocumento) return
  const limpio = nombreEnDocumento.trim()
  if (!limpio) return
  const candidatos = await cargarCandidatosEmpleados(supabase)
  const yaResuelve = resolverEmpleado(limpio, null, candidatos.filter(c => c.id === empleadoId))
  if (yaResuelve) return // ya se reconoce (nombre/nombre_oficial/alias existente), nada que aprender
  try {
    await supabase.from('empleado_alias').insert({ empleado_id: empleadoId, alias: limpio })
  } catch { /* el autoaprendizaje nunca debe romper el flujo de reasignación */ }
}
