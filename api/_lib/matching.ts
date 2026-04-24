import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedFactura } from './ocr.js'

const LIMITE_CONCILIACION = '2023-07-01'

export type MatchingEstado = 'asociada' | 'pendiente_revision' | 'historica'

export interface MatchCandidato {
  id: string
  fecha: string
  concepto: string | null
  importe: number
  proveedor: string | null
}

export interface MatchingResult {
  estado: MatchingEstado
  matches: MatchCandidato[]
  confianza: number
  mensaje: string
}

/* ═════════════ HELPERS ═════════════ */

export function normalizar(texto: string): string {
  if (!texto) return ''
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[,.]/g, ' ')
    .replace(/\s+s\s*\.?\s*a\s*\.?(\s|$)/gi, ' ')
    .replace(/\s+s\s*\.?\s*l\s*\.?\s*u?\s*\.?(\s|$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escaparLike(s: string): string {
  return s.replace(/[%_]/g, '\\$&')
}

export async function obtenerAliasProveedor(
  supabase: SupabaseClient,
  proveedorNombre: string,
): Promise<string[]> {
  const normalizado = normalizar(proveedorNombre)
  if (!normalizado) return []

  // Buscar alias donde CUALQUIER palabra del nombre coincida con algún alias o con el canónico
  const palabras = normalizado.split(' ').filter((p) => p.length >= 3)
  const termino = palabras[0] || normalizado

  const { data: matches } = await supabase
    .from('proveedor_alias')
    .select('proveedor_canonico, alias')
    .or(`alias.ilike.%${escaparLike(termino)}%,proveedor_canonico.ilike.%${escaparLike(termino)}%`)

  if (!matches || matches.length === 0) {
    // fallback: usa el nombre normalizado como único alias y busca coincidencia por palabras
    return palabras.length > 0 ? palabras : [normalizado]
  }

  // Todos los alias del canónico encontrado
  const canonico = matches[0].proveedor_canonico as string
  const { data: aliasCompletos } = await supabase
    .from('proveedor_alias')
    .select('alias')
    .eq('proveedor_canonico', canonico)

  const aliasList = (aliasCompletos || []).map((r) => (r.alias as string).toLowerCase())
  return aliasList.length > 0 ? aliasList : [normalizado]
}

function orFilterAlias(alias: string[]): string {
  // Construye or-filter que busca en concepto y proveedor cualquiera de los alias
  const parts: string[] = []
  for (const a of alias) {
    const esc = escaparLike(a)
    parts.push(`concepto.ilike.%${esc}%`)
    parts.push(`proveedor.ilike.%${esc}%`)
  }
  return parts.join(',')
}

function diasEntre(a: string | Date, b: string | Date): number {
  const d1 = a instanceof Date ? a : new Date(a)
  const d2 = b instanceof Date ? b : new Date(b)
  return Math.abs((d1.getTime() - d2.getTime()) / 86_400_000)
}

/* ═════════════ ENTRY POINT ═════════════ */

export async function matchFactura(
  supabase: SupabaseClient,
  factura: ExtractedFactura & { id?: string; total: number },
): Promise<MatchingResult> {
  if (factura.tipo === 'plataforma') {
    return matchFacturaPlataforma(supabase, factura)
  }
  if (factura.es_recapitulativa && factura.periodo_inicio && factura.periodo_fin) {
    const alias = await obtenerAliasProveedor(supabase, factura.proveedor_nombre)
    return matchFacturaRecapitulativa(supabase, factura, alias)
  }
  const alias = await obtenerAliasProveedor(supabase, factura.proveedor_nombre)
  return matchFacturaNormal(supabase, factura, alias)
}

/* ═════════════ NORMAL ═════════════ */

async function matchFacturaNormal(
  supabase: SupabaseClient,
  factura: ExtractedFactura & { total: number },
  alias: string[],
): Promise<MatchingResult> {
  if (alias.length === 0) {
    return {
      estado: fechaEsHistorica(factura.fecha_factura) ? 'historica' : 'pendiente_revision',
      matches: [],
      confianza: 0,
      mensaje: `Sin alias para proveedor "${factura.proveedor_nombre}"`,
    }
  }

  const fechaBase = new Date(factura.fecha_factura)
  const fechaMin = new Date(fechaBase)
  fechaMin.setDate(fechaMin.getDate() - 5)
  const fechaMax = new Date(fechaBase)
  fechaMax.setDate(fechaMax.getDate() + 30)

  const { data: candidatosRaw } = await supabase
    .from('conciliacion')
    .select('id, fecha, concepto, importe, proveedor')
    .lt('importe', 0)
    .gte('fecha', fechaMin.toISOString().slice(0, 10))
    .lte('fecha', fechaMax.toISOString().slice(0, 10))
    .or(orFilterAlias(alias))

  const candidatos: MatchCandidato[] = (candidatosRaw || []).map((c) => ({
    id: c.id as string,
    fecha: c.fecha as string,
    concepto: (c.concepto as string) || null,
    importe: Number(c.importe),
    proveedor: (c.proveedor as string) || null,
  }))

  if (candidatos.length === 0) {
    return {
      estado: fechaEsHistorica(factura.fecha_factura) ? 'historica' : 'pendiente_revision',
      matches: [],
      confianza: 0,
      mensaje: `No hay movimientos de "${factura.proveedor_nombre}" entre ${fechaMin
        .toISOString()
        .slice(0, 10)} y ${fechaMax.toISOString().slice(0, 10)}`,
    }
  }

  const total = Math.abs(factura.total)
  const matchesExactos = candidatos.filter((c) => Math.abs(Math.abs(c.importe) - total) <= 0.5)

  if (matchesExactos.length === 0) {
    return {
      estado: 'pendiente_revision',
      matches: candidatos.slice(0, 5),
      confianza: 0,
      mensaje: `Proveedor encontrado pero ningún importe cuadra con ${total.toFixed(2)}€`,
    }
  }

  if (matchesExactos.length === 1) {
    const dias = diasEntre(matchesExactos[0].fecha, factura.fecha_factura)
    const confianza = dias <= 3 ? 100 : dias <= 15 ? 90 : 75
    return {
      estado: 'asociada',
      matches: matchesExactos,
      confianza,
      mensaje: `Match directo: ${matchesExactos[0].fecha} · ${Math.abs(
        matchesExactos[0].importe,
      ).toFixed(2)}€`,
    }
  }

  return {
    estado: 'pendiente_revision',
    matches: matchesExactos,
    confianza: 60,
    mensaje: `Varios movimientos coinciden (${matchesExactos.length}). Confirma manualmente.`,
  }
}

/* ═════════════ RECAPITULATIVA ═════════════ */

async function matchFacturaRecapitulativa(
  supabase: SupabaseClient,
  factura: ExtractedFactura & { id?: string; total: number },
  alias: string[],
): Promise<MatchingResult> {
  if (!factura.periodo_inicio || !factura.periodo_fin) {
    return {
      estado: 'pendiente_revision',
      matches: [],
      confianza: 0,
      mensaje: 'Recapitulativa sin periodo_inicio/periodo_fin',
    }
  }

  const fechaFinExt = new Date(factura.periodo_fin)
  fechaFinExt.setDate(fechaFinExt.getDate() + 3)

  const { data: movimientosRaw } = await supabase
    .from('conciliacion')
    .select('id, fecha, concepto, importe, proveedor')
    .lt('importe', 0)
    .gte('fecha', factura.periodo_inicio)
    .lte('fecha', fechaFinExt.toISOString().slice(0, 10))
    .or(orFilterAlias(alias))

  const movimientos: MatchCandidato[] = (movimientosRaw || []).map((c) => ({
    id: c.id as string,
    fecha: c.fecha as string,
    concepto: (c.concepto as string) || null,
    importe: Number(c.importe),
    proveedor: (c.proveedor as string) || null,
  }))

  if (movimientos.length === 0) {
    return {
      estado: 'pendiente_revision',
      matches: [],
      confianza: 0,
      mensaje: `No hay movimientos de "${factura.proveedor_nombre}" en el periodo ${factura.periodo_inicio} → ${factura.periodo_fin}`,
    }
  }

  // Excluir movimientos ya asociados a otras facturas
  const ids = movimientos.map((m) => m.id)
  let yaAsociadosIds = new Set<string>()
  if (ids.length > 0) {
    let q = supabase.from('facturas_gastos').select('conciliacion_id').in('conciliacion_id', ids)
    if (factura.id) q = q.neq('factura_id', factura.id)
    const { data: yaAsociados } = await q
    yaAsociadosIds = new Set((yaAsociados || []).map((a) => a.conciliacion_id as string))
  }

  const disponibles = movimientos.filter((m) => !yaAsociadosIds.has(m.id))
  const sumaMovs = disponibles.reduce((acc, m) => acc + Math.abs(m.importe), 0)
  const totalFactura = Math.abs(factura.total)
  const diferencia = Math.abs(sumaMovs - totalFactura)

  if (diferencia <= 0.5) {
    return {
      estado: 'asociada',
      matches: disponibles,
      confianza: 95,
      mensaje: `Recapitulativa: ${disponibles.length} cargos suman ${sumaMovs.toFixed(2)}€`,
    }
  }

  if (diferencia <= 2.0) {
    return {
      estado: 'pendiente_revision',
      matches: disponibles,
      confianza: 70,
      mensaje: `Suma ${disponibles.length} cargos: ${sumaMovs.toFixed(
        2,
      )}€ vs factura ${totalFactura.toFixed(2)}€ (dif ${diferencia.toFixed(2)}€)`,
    }
  }

  return {
    estado: 'pendiente_revision',
    matches: disponibles,
    confianza: 30,
    mensaje: `Descuadre: suma ${sumaMovs.toFixed(2)}€ vs factura ${totalFactura.toFixed(2)}€ (dif ${diferencia.toFixed(2)}€)`,
  }
}

/* ═════════════ PLATAFORMA ═════════════ */

const CATEGORIA_INGRESO: Record<string, string> = {
  uber: 'ING-UE',
  glovo: 'ING-GL',
  just_eat: 'ING-JE',
}

const PLATAFORMA_ALIAS: Record<string, string[]> = {
  uber: ['portier', 'uber', 'uber eats', 'portier eats'],
  glovo: ['glovo', 'glovoapp', 'glovo app'],
  just_eat: ['just eat', 'justeat', 'je spain'],
}

async function matchFacturaPlataforma(
  supabase: SupabaseClient,
  factura: ExtractedFactura & { total: number },
): Promise<MatchingResult> {
  const plataforma = factura.plataforma
  if (!plataforma || !CATEGORIA_INGRESO[plataforma]) {
    return {
      estado: 'pendiente_revision',
      matches: [],
      confianza: 0,
      mensaje: 'Plataforma no reconocida',
    }
  }

  const categoria = CATEGORIA_INGRESO[plataforma]
  const alias = PLATAFORMA_ALIAS[plataforma]
  const fechaInicio = factura.periodo_inicio || factura.fecha_factura
  const fechaFinBase = factura.periodo_fin || factura.fecha_factura
  const fechaFinExt = new Date(fechaFinBase)
  fechaFinExt.setDate(fechaFinExt.getDate() + 7)

  // Buscar ingresos por categoría o por concepto
  const { data: porCategoria } = await supabase
    .from('conciliacion')
    .select('id, fecha, concepto, importe, proveedor')
    .gt('importe', 0)
    .eq('categoria', categoria)
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFinExt.toISOString().slice(0, 10))

  const { data: porConcepto } = await supabase
    .from('conciliacion')
    .select('id, fecha, concepto, importe, proveedor')
    .gt('importe', 0)
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFinExt.toISOString().slice(0, 10))
    .or(orFilterAlias(alias))

  const map = new Map<string, MatchCandidato>()
  for (const r of [...(porCategoria || []), ...(porConcepto || [])]) {
    const c: MatchCandidato = {
      id: r.id as string,
      fecha: r.fecha as string,
      concepto: (r.concepto as string) || null,
      importe: Number(r.importe),
      proveedor: (r.proveedor as string) || null,
    }
    map.set(c.id, c)
  }
  const ingresos = Array.from(map.values())

  if (ingresos.length === 0) {
    return {
      estado: 'pendiente_revision',
      matches: [],
      confianza: 0,
      mensaje: `No hay ingresos de ${plataforma} en el periodo ${fechaInicio} → ${fechaFinBase}`,
    }
  }

  const sumaIngresos = ingresos.reduce((acc, i) => acc + i.importe, 0)
  const totalFactura = Math.abs(factura.total)
  const diferencia = Math.abs(sumaIngresos - totalFactura)

  if (diferencia <= 1.0) {
    return {
      estado: 'asociada',
      matches: ingresos,
      confianza: 85,
      mensaje: `${ingresos.length} ingresos ${plataforma} suman ${sumaIngresos.toFixed(2)}€`,
    }
  }

  return {
    estado: 'pendiente_revision',
    matches: ingresos,
    confianza: 50,
    mensaje: `Liquidación ${plataforma}: suma ${sumaIngresos.toFixed(2)}€ vs factura ${totalFactura.toFixed(2)}€ (dif ${diferencia.toFixed(2)}€)`,
  }
}

/* ═════════════ UTIL ═════════════ */

function fechaEsHistorica(fecha: string): boolean {
  return new Date(fecha) < new Date(LIMITE_CONCILIACION)
}

/* ═════════════ PERSISTENCIA ═════════════ */

/**
 * Aplica un MatchingResult a la BD: borra matches previos, inserta nuevos con confianza,
 * actualiza factura con estado + mensaje_matching.
 */
export async function aplicarMatching(
  supabase: SupabaseClient,
  facturaId: string,
  result: MatchingResult,
): Promise<void> {
  await supabase.from('facturas_gastos').delete().eq('factura_id', facturaId)

  if (result.matches.length > 0) {
    const filas = result.matches.map((m) => ({
      factura_id: facturaId,
      conciliacion_id: m.id,
      importe_asociado: Math.abs(m.importe),
      confirmado: result.estado === 'asociada',
      confianza_match: result.confianza,
    }))
    await supabase.from('facturas_gastos').insert(filas)
  }

  await supabase
    .from('facturas')
    .update({ estado: result.estado, mensaje_matching: result.mensaje })
    .eq('id', facturaId)
}

/* Legacy export para compatibilidad (ya no usado) */
export type { MatchingEstado as MatchingResultLegacy }
