// matching v6 — HERENCIA por proveedor conocido (Ruben 04/06/26): al aplicar matching,
//   toda factura hereda NIF + categoria de su proveedor conocido (reglas_conciliacion por
//   alias/palabra, o ultimo movimiento conciliado del proveedor) AUNQUE no case fecha+importe.
//   Solo rellena campos vacios, nunca pisa. Cubre B-1 (alias), B-2 (traer de conciliacion) y
//   B-3 (al entrar: aplicarMatching corre en cada subida).
// matching v5 — lee matching_config (tolerancia_eur + ventana_dias por proveedor/plataforma) para no divergir del frontend (Chat B). Fallback a constantes si no hay fila.
// v4 — pre-jul-2023 -> asociada (conciliada sin banco) en vez de historica
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedFactura } from './ocr.js'
import { TOLERANCIA_IMPORTE, LIMITE_CONCILIACION } from './ocr-config.js'

const VENTANA_DEFAULT = { antes: 5, despues: 30 }

const VENTANAS_ESPECIALES: Record<string, { antes: number; despues: number }> = {
  lidl: { antes: 30, despues: 110 },
  alcampo: { antes: 30, despues: 45 },
  waitry: { antes: 5, despues: 60 },
  tesys: { antes: 5, despues: 60 },
  piensasolutions: { antes: 5, despues: 60 },
  envases: { antes: 5, despues: 45 },
  envapro: { antes: 5, despues: 45 },
  ayora: { antes: 5, despues: 30 },
  amazon: { antes: 10, despues: 45 },
  tgt: { antes: 5, despues: 120 },
  lacteos: { antes: 5, despues: 120 },
}

// ── matching_config (fuente compartida con el frontend / Chat B) ───────────
// Tabla: proveedor (text|null = default), ventana_dias (int), tolerancia_eur
// (numeric), activo (bool). El frontend la edita; el matching la LEE para que
// ambos lados usen los mismos números y nunca diverjan. Si no hay fila o falla
// la carga, se cae a las constantes/ventanas de siempre (comportamiento previo).
interface FilaMatchingConfig { proveedor: string | null; ventana_dias: number | null; tolerancia_eur: number | null }
interface ConfigResuelta { tolerancia: number; ventanaDias: number | null }

async function cargarMatchingConfig(supabase: SupabaseClient): Promise<FilaMatchingConfig[]> {
  try {
    const { data } = await supabase
      .from('matching_config')
      .select('proveedor, ventana_dias, tolerancia_eur, activo')
      .eq('activo', true)
    return (data || []).map((r) => ({
      proveedor: (r.proveedor as string | null) ?? null,
      ventana_dias: r.ventana_dias as number | null,
      tolerancia_eur: r.tolerancia_eur != null ? Number(r.tolerancia_eur) : null,
    }))
  } catch {
    return []
  }
}

// Resuelve la config aplicable a una factura: fila por proveedor/plataforma si
// existe; si no, la fila default (proveedor=null); si tampoco, las constantes.
function resolverConfig(filas: FilaMatchingConfig[], proveedorNorm: string, plataforma: string | null): ConfigResuelta {
  let especifica: FilaMatchingConfig | undefined
  for (const f of filas) {
    if (!f.proveedor) continue
    const clave = normalizar(f.proveedor)
    if (!clave) continue
    if ((plataforma && clave.includes(plataforma.replace('_', ' '))) || proveedorNorm.includes(clave) || clave.includes(proveedorNorm)) {
      especifica = f
      break
    }
  }
  const porDefecto = filas.find((f) => !f.proveedor)
  const elegida = especifica || porDefecto
  return {
    tolerancia: elegida?.tolerancia_eur ?? TOLERANCIA_IMPORTE,
    ventanaDias: elegida?.ventana_dias ?? null,
  }
}

function ventanaProveedor(proveedorNombre: string): { antes: number; despues: number } {
  const norm = normalizar(proveedorNombre)
  for (const [clave, ventana] of Object.entries(VENTANAS_ESPECIALES)) {
    if (norm.includes(clave)) return ventana
  }
  return VENTANA_DEFAULT
}

export type MatchingEstado =
  | 'asociada'
  | 'pendiente_revision'
  | 'historica'
  | 'sin_match'
  | 'pendiente_titular_manual'
  | 'ocr_fallido'
  | 'drive_pendiente'
  | 'solo_drive'

export interface MatchCandidato {
  id: string
  fecha: string
  concepto: string | null
  importe: number
  proveedor: string | null
  titular_id?: string | null
  categoria_codigo?: string | null
}

export interface MatchingResult {
  estado: MatchingEstado
  matches: MatchCandidato[]
  confianza: number
  mensaje: string
  cruza_cuentas?: boolean
}

export function normalizar(texto: string): string {
  if (!texto) return ''
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,.&]/g, ' ')
    .replace(/\s+s\s*\.?\s*a\s*\.?(\s|$)/gi, ' ')
    .replace(/\s+s\s*\.?\s*l\s*\.?\s*u?\s*\.?(\s|$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escaparLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&')
}

export async function obtenerAliasProveedor(
  supabase: SupabaseClient,
  proveedorNombre: string,
): Promise<string[]> {
  const normalizado = normalizar(proveedorNombre)
  if (!normalizado) return []

  const palabras = normalizado.split(' ').filter((p) => p.length >= 3)
  const termino = palabras.slice(0, 2).join(' ') || normalizado

  const { data: matches } = await supabase
    .from('proveedor_alias')
    .select('proveedor_canonico, alias')
    .or(`alias.ilike.%${escaparLike(termino)}%,proveedor_canonico.ilike.%${escaparLike(termino)}%`)

  if ((!matches || matches.length === 0) && palabras.length > 1) {
    const termino1 = palabras[0]
    const { data: matches1 } = await supabase
      .from('proveedor_alias')
      .select('proveedor_canonico, alias')
      .or(`alias.ilike.%${escaparLike(termino1)}%,proveedor_canonico.ilike.%${escaparLike(termino1)}%`)
    if (matches1 && matches1.length > 0) {
      const canonico = matches1[0].proveedor_canonico as string
      const { data: aliasCompletos } = await supabase
        .from('proveedor_alias')
        .select('alias')
        .eq('proveedor_canonico', canonico)
      const aliasList = (aliasCompletos || []).map((r) => (r.alias as string).toLowerCase())
      return aliasList.length > 0 ? aliasList : [normalizado]
    }
  }

  if (!matches || matches.length === 0) {
    return palabras.length > 0 ? palabras : [normalizado]
  }

  const canonico = matches[0].proveedor_canonico as string
  const { data: aliasCompletos } = await supabase
    .from('proveedor_alias')
    .select('alias')
    .eq('proveedor_canonico', canonico)

  const aliasList = (aliasCompletos || []).map((r) => (r.alias as string).toLowerCase())
  return aliasList.length > 0 ? aliasList : [normalizado]
}

function orFilterAlias(alias: string[]): string {
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

function mesAnterior(fecha: string): { inicio: string; fin: string } {
  const d = new Date(fecha)
  const año = d.getFullYear()
  const mes = d.getMonth()
  const inicio = new Date(año, mes - 1, 1)
  const fin = new Date(año, mes, 0)
  return { inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) }
}

function categoriaMayoritaria(matches: MatchCandidato[]): string | null {
  const categorias = matches.map((m) => m.categoria_codigo).filter((c): c is string => Boolean(c))
  if (categorias.length === 0) return null
  const frecuencia: Record<string, number> = {}
  for (const c of categorias) { frecuencia[c] = (frecuencia[c] || 0) + 1 }
  const [mejor] = Object.entries(frecuencia).sort((a, b) => b[1] - a[1])
  return mejor ? mejor[0] : null
}

async function categoriaDesdReglas(supabase: SupabaseClient, proveedorNombre: string, nifEmisor: string | null | undefined): Promise<{ categoria: string | null; proveedor_canonico: string | null }> {
  if (nifEmisor) {
    const { data } = await supabase.from('reglas_conciliacion').select('categoria_codigo, set_proveedor').eq('patron_nif', nifEmisor.toUpperCase()).eq('activa', true).order('prioridad', { ascending: true }).limit(1).maybeSingle()
    if (data?.categoria_codigo) return { categoria: data.categoria_codigo as string, proveedor_canonico: (data.set_proveedor as string) || null }
  }
  const norm = normalizar(proveedorNombre)
  const palabras = norm.split(' ').filter((p) => p.length >= 3)
  for (const palabra of palabras) {
    const { data } = await supabase.from('reglas_conciliacion').select('categoria_codigo, set_proveedor').ilike('patron', `%${escaparLike(palabra)}%`).eq('activa', true).order('prioridad', { ascending: true }).limit(1).maybeSingle()
    if (data?.categoria_codigo) return { categoria: data.categoria_codigo as string, proveedor_canonico: (data.set_proveedor as string) || null }
  }
  return { categoria: null, proveedor_canonico: null }
}

export async function matchFactura(supabase: SupabaseClient, factura: ExtractedFactura & { id?: string; total: number; titular_id?: string | null }): Promise<MatchingResult> {
  let result: MatchingResult
  if (factura.plataforma === 'uber') return { estado: 'solo_drive', matches: [], confianza: 100, mensaje: 'Factura Uber Eats: gasto deducible, no matchea con banco (se descuenta en liquidación). Guardado en Drive.' }
  if (Math.abs(factura.total) < 0.01) return { estado: 'solo_drive', matches: [], confianza: 100, mensaje: 'Importe 0€ (cupón/bono): solo guardado en Drive para contabilidad.' }
  // Carga de la config compartida (matching_config). Una vez por factura.
  const filasCfg = await cargarMatchingConfig(supabase)
  const cfg = resolverConfig(filasCfg, normalizar(factura.proveedor_nombre || ''), factura.plataforma ?? null)
  const provNorm = normalizar(factura.proveedor_nombre || '')
  if (provNorm.includes('mercadona')) result = await matchFacturaMercadona(supabase, factura, cfg)
  else if (factura.plataforma === 'glovo' || factura.plataforma === 'just_eat') result = await matchFacturaGlovoJustEat(supabase, factura, cfg)
  else if (factura.es_recapitulativa && factura.periodo_inicio && factura.periodo_fin) { const alias = await obtenerAliasProveedor(supabase, factura.proveedor_nombre); result = await matchFacturaRecapitulativa(supabase, factura, alias, cfg) }
  else { const alias = await obtenerAliasProveedor(supabase, factura.proveedor_nombre); result = await matchFacturaNormal(supabase, factura, alias, cfg) }
  result.cruza_cuentas = Boolean(factura.titular_id && result.matches.some((m) => m.titular_id && m.titular_id !== factura.titular_id))
  return result
}

async function matchFacturaNormal(supabase: SupabaseClient, factura: ExtractedFactura & { total: number; titular_id?: string | null }, alias: string[], cfg: ConfigResuelta): Promise<MatchingResult> {
  if (alias.length === 0) return fechaEsHistorica(factura.fecha_factura) ? { estado: 'asociada', matches: [], confianza: 100, mensaje: 'Pre 03/07/2023: sin banco, justificante en Drive, dada por conciliada' } : { estado: 'sin_match', matches: [], confianza: 0, mensaje: `Sin alias para proveedor "${factura.proveedor_nombre}"` }
  const ventana = ventanaProveedor(factura.proveedor_nombre)
  // Si matching_config define ventana_dias para este proveedor, manda esa (lado "después").
  const ventanaDespues = cfg.ventanaDias ?? ventana.despues
  const fechaBase = new Date(factura.fecha_factura)
  const fechaMin = new Date(fechaBase); fechaMin.setDate(fechaMin.getDate() - ventana.antes)
  const fechaMax = new Date(fechaBase); fechaMax.setDate(fechaMax.getDate() + ventanaDespues)
  let query = supabase.from('conciliacion').select('id, fecha, concepto, importe, proveedor, titular_id, categoria').lt('importe', 0).gte('fecha', fechaMin.toISOString().slice(0, 10)).lte('fecha', fechaMax.toISOString().slice(0, 10)).or(orFilterAlias(alias))
  if (factura.titular_id) query = query.eq('titular_id', factura.titular_id)
  const { data: candidatosRaw } = await query
  const candidatos: MatchCandidato[] = (candidatosRaw || []).map((c) => ({ id: c.id as string, fecha: c.fecha as string, concepto: (c.concepto as string) || null, importe: Number(c.importe), proveedor: (c.proveedor as string) || null, titular_id: (c.titular_id as string | null) ?? null, categoria_codigo: (c.categoria as string | null) ?? null }))
  if (candidatos.length === 0) return fechaEsHistorica(factura.fecha_factura) ? { estado: 'asociada', matches: [], confianza: 100, mensaje: 'Pre 03/07/2023: sin banco, justificante en Drive, dada por conciliada' } : { estado: 'sin_match', matches: [], confianza: 0, mensaje: `No hay movimientos de "${factura.proveedor_nombre}" entre ${fechaMin.toISOString().slice(0, 10)} y ${fechaMax.toISOString().slice(0, 10)}` }
  const total = Math.abs(factura.total)
  const ids = candidatos.map((c) => c.id)
  let yaAsociadosIds = new Set<string>()
  if (ids.length > 0) { const { data: yaAsociados } = await supabase.from('facturas_gastos').select('conciliacion_id, factura_id').in('conciliacion_id', ids); yaAsociadosIds = new Set((yaAsociados || []).filter((a) => a.factura_id !== (factura as { id?: string }).id).map((a) => a.conciliacion_id as string)) }
  const disponibles = candidatos.filter((c) => !yaAsociadosIds.has(c.id))
  const matchesExactos = disponibles.filter((c) => Math.abs(Math.abs(c.importe) - total) <= cfg.tolerancia)
  if (matchesExactos.length === 0) return { estado: 'pendiente_revision', matches: disponibles.slice(0, 5), confianza: 0, mensaje: `Proveedor encontrado pero ningún importe cuadra con ${total.toFixed(2)}€ (tolerancia ±${cfg.tolerancia}€)` }
  if (matchesExactos.length === 1) { const dias = diasEntre(matchesExactos[0].fecha, factura.fecha_factura); const confianza = dias <= 3 ? 100 : dias <= 15 ? 90 : 75; return { estado: 'asociada', matches: matchesExactos, confianza, mensaje: `Match directo: ${matchesExactos[0].fecha} · ${Math.abs(matchesExactos[0].importe).toFixed(2)}€` } }
  const ordenadosPorFecha = matchesExactos.map((m) => ({ m, dias: diasEntre(m.fecha, factura.fecha_factura) })).sort((a, b) => a.dias - b.dias)
  const mejor = ordenadosPorFecha[0]
  if (ordenadosPorFecha.length === 1 || ordenadosPorFecha[0].dias !== ordenadosPorFecha[1].dias) return { estado: 'asociada', matches: [mejor.m], confianza: 80, mensaje: `Match por importe + fecha más próxima (${mejor.dias.toFixed(0)} días)` }
  return { estado: 'pendiente_revision', matches: matchesExactos, confianza: 60, mensaje: `Varios movimientos coinciden (${matchesExactos.length}). Confirma manualmente.` }
}

async function matchFacturaMercadona(supabase: SupabaseClient, factura: ExtractedFactura & { total: number; titular_id?: string | null }, cfg: ConfigResuelta): Promise<MatchingResult> {
  const { inicio, fin } = mesAnterior(factura.fecha_factura)
  const alias = ['mercadona', 'cc.albufera', 'albufera plaza', 'mercadona online', 'mercadona colmena']
  const { data: movimientosRaw } = await supabase.from('conciliacion').select('id, fecha, concepto, importe, proveedor, titular_id, categoria').lt('importe', 0).gte('fecha', inicio).lte('fecha', fin).or(orFilterAlias(alias))
  const movimientos: MatchCandidato[] = (movimientosRaw || []).map((c) => ({ id: c.id as string, fecha: c.fecha as string, concepto: (c.concepto as string) || null, importe: Number(c.importe), proveedor: (c.proveedor as string) || null, titular_id: (c.titular_id as string | null) ?? null, categoria_codigo: (c.categoria as string | null) ?? null }))
  if (movimientos.length === 0) return { estado: 'pendiente_revision', matches: [], confianza: 0, mensaje: `Mercadona ${inicio} → ${fin}: no hay cargos en banco` }
  const ids = movimientos.map((m) => m.id)
  const { data: yaAsociados } = await supabase.from('facturas_gastos').select('conciliacion_id').in('conciliacion_id', ids)
  const yaAsociadosIds = new Set((yaAsociados || []).map((a) => a.conciliacion_id as string))
  const disponibles = movimientos.filter((m) => !yaAsociadosIds.has(m.id))
  const sumaMovs = disponibles.reduce((acc, m) => acc + Math.abs(m.importe), 0)
  const totalFactura = Math.abs(factura.total)
  const diferencia = Math.abs(sumaMovs - totalFactura)
  if (diferencia <= cfg.tolerancia) return { estado: 'asociada', matches: disponibles, confianza: 95, mensaje: `Mercadona ${inicio} → ${fin}: ${disponibles.length} cargos suman ${sumaMovs.toFixed(2)}€ ✓ cuadra` }
  if (diferencia <= 5.0) return { estado: 'pendiente_revision', matches: disponibles, confianza: 70, mensaje: `Mercadona: ${disponibles.length} cargos suman ${sumaMovs.toFixed(2)}€ vs factura ${totalFactura.toFixed(2)}€ (dif ${diferencia.toFixed(2)}€)` }
  return { estado: 'pendiente_revision', matches: disponibles, confianza: 40, mensaje: `Mercadona descuadre: ${sumaMovs.toFixed(2)}€ banco vs ${totalFactura.toFixed(2)}€ factura (dif ${diferencia.toFixed(2)}€). Falta extracto tarjeta Emilio o cargo sin etiquetar.` }
}

async function matchFacturaGlovoJustEat(supabase: SupabaseClient, factura: ExtractedFactura & { total: number }, cfg: ConfigResuelta): Promise<MatchingResult> {
  const plataforma = factura.plataforma as 'glovo' | 'just_eat'
  const aliasMap: Record<string, string[]> = { glovo: ['glovo', 'glovoapp', 'glovo app'], just_eat: ['just eat', 'justeat', 'je spain', 'takeaway'] }
  const alias = aliasMap[plataforma]
  const fechaInicio = factura.periodo_inicio || factura.fecha_factura
  const fechaFinBase = factura.periodo_fin || factura.fecha_factura
  // Ventana "después" desde matching_config si está definida (uber/glovo/just eat = 45d); fallback 14d.
  const diasExt = cfg.ventanaDias ?? 14
  const fechaFinExt = new Date(fechaFinBase); fechaFinExt.setDate(fechaFinExt.getDate() + diasExt)
  const { data: ingresosRaw } = await supabase.from('conciliacion').select('id, fecha, concepto, importe, proveedor, titular_id, categoria').gt('importe', 0).gte('fecha', fechaInicio).lte('fecha', fechaFinExt.toISOString().slice(0, 10)).or(orFilterAlias(alias))
  const ingresos: MatchCandidato[] = (ingresosRaw || []).map((c) => ({ id: c.id as string, fecha: c.fecha as string, concepto: (c.concepto as string) || null, importe: Number(c.importe), proveedor: (c.proveedor as string) || null, titular_id: (c.titular_id as string | null) ?? null, categoria_codigo: (c.categoria as string | null) ?? null }))
  if (ingresos.length === 0) return { estado: 'pendiente_revision', matches: [], confianza: 0, mensaje: `Liquidación ${plataforma}: sin ingresos en banco entre ${fechaInicio} y ${fechaFinExt.toISOString().slice(0, 10)}` }
  return { estado: 'pendiente_revision', matches: ingresos, confianza: 70, mensaje: `Liquidación ${plataforma}: ${ingresos.length} ingresos en periodo. Confirma manualmente.` }
}

async function matchFacturaRecapitulativa(supabase: SupabaseClient, factura: ExtractedFactura & { id?: string; total: number }, alias: string[], cfg: ConfigResuelta): Promise<MatchingResult> {
  if (!factura.periodo_inicio || !factura.periodo_fin) return { estado: 'pendiente_revision', matches: [], confianza: 0, mensaje: 'Recapitulativa sin periodo_inicio/periodo_fin' }
  const fechaFinExt = new Date(factura.periodo_fin); fechaFinExt.setDate(fechaFinExt.getDate() + 3)
  const { data: movimientosRaw } = await supabase.from('conciliacion').select('id, fecha, concepto, importe, proveedor, titular_id, categoria').lt('importe', 0).gte('fecha', factura.periodo_inicio).lte('fecha', fechaFinExt.toISOString().slice(0, 10)).or(orFilterAlias(alias))
  const movimientos: MatchCandidato[] = (movimientosRaw || []).map((c) => ({ id: c.id as string, fecha: c.fecha as string, concepto: (c.concepto as string) || null, importe: Number(c.importe), proveedor: (c.proveedor as string) || null, titular_id: (c.titular_id as string | null) ?? null, categoria_codigo: (c.categoria as string | null) ?? null }))
  if (movimientos.length === 0) return { estado: 'pendiente_revision', matches: [], confianza: 0, mensaje: `No hay movimientos de "${factura.proveedor_nombre}" en el periodo ${factura.periodo_inicio} → ${factura.periodo_fin}` }
  const ids = movimientos.map((m) => m.id)
  let yaAsociadosIds = new Set<string>()
  if (ids.length > 0) { let q = supabase.from('facturas_gastos').select('conciliacion_id').in('conciliacion_id', ids); if (factura.id) q = q.neq('factura_id', factura.id); const { data: yaAsociados } = await q; yaAsociadosIds = new Set((yaAsociados || []).map((a) => a.conciliacion_id as string)) }
  const disponibles = movimientos.filter((m) => !yaAsociadosIds.has(m.id))
  const sumaMovs = disponibles.reduce((acc, m) => acc + Math.abs(m.importe), 0)
  const totalFactura = Math.abs(factura.total)
  const diferencia = Math.abs(sumaMovs - totalFactura)
  // G06: tolerancia 2€ en recapitulativas es intencional (documentado) — recaps suman muchos cargos pequeños
  if (diferencia <= cfg.tolerancia) return { estado: 'asociada', matches: disponibles, confianza: 95, mensaje: `Recapitulativa: ${disponibles.length} cargos suman ${sumaMovs.toFixed(2)}€` }
  if (diferencia <= 2.0) return { estado: 'pendiente_revision', matches: disponibles, confianza: 70, mensaje: `Suma ${disponibles.length} cargos: ${sumaMovs.toFixed(2)}€ vs factura ${totalFactura.toFixed(2)}€ (dif ${diferencia.toFixed(2)}€)` }
  return { estado: 'pendiente_revision', matches: disponibles, confianza: 30, mensaje: `Descuadre: suma ${sumaMovs.toFixed(2)}€ vs factura ${totalFactura.toFixed(2)}€ (dif ${diferencia.toFixed(2)}€)` }
}

function fechaEsHistorica(fecha: string): boolean { return new Date(fecha) < new Date(LIMITE_CONCILIACION) }

// Trae NIF emisor y categoria del proveedor ya conocido, aunque no exista match
// por fecha+importe. Orden: (1) reglas_conciliacion por NIF -> patron/palabra;
// (2) ultimo movimiento conciliado del mismo proveedor (por alias) con categoria.
// Devuelve solo lo que encuentre; el caller decide si rellena (nunca pisa lo lleno).
async function metadatosProveedorConocido(
  supabase: SupabaseClient,
  proveedorNombre: string | null | undefined,
  nifEmisor: string | null | undefined,
): Promise<{ nif: string | null; categoria: string | null; proveedor_canonico: string | null }> {
  let nif: string | null = nifEmisor ? nifEmisor.toUpperCase() : null
  let categoria: string | null = null
  let proveedor_canonico: string | null = null

  // (1) reglas_conciliacion por NIF o por palabra del nombre.
  if (proveedorNombre || nif) {
    const fromReglas = await categoriaDesdReglas(supabase, proveedorNombre || '', nif)
    if (fromReglas.categoria) categoria = fromReglas.categoria
    if (fromReglas.proveedor_canonico) proveedor_canonico = fromReglas.proveedor_canonico
  }
  // NIF heredado: si la factura no traia NIF, buscar el patron_nif de una regla cuyo
  // patron (palabra) o set_proveedor coincida con el proveedor. Asi "ENVAPRO" hereda el
  // NIF registrado de "ENVASES PARA PROFESIONALES" aunque el nombre varie (B-1).
  if (!nif && proveedorNombre) {
    const palabras = normalizar(proveedorNombre).split(' ').filter((p) => p.length >= 3)
    for (const palabra of palabras) {
      const esc = escaparLike(palabra)
      const { data } = await supabase
        .from('reglas_conciliacion')
        .select('patron_nif')
        .not('patron_nif', 'is', null)
        .or(`patron.ilike.%${esc}%,set_proveedor.ilike.%${esc}%,razon_social.ilike.%${esc}%`)
        .eq('activa', true)
        .order('prioridad', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (data?.patron_nif) { nif = (data.patron_nif as string).toUpperCase(); break }
    }
  }

  // (2) Si aun falta categoria, copiar la del ultimo movimiento conciliado del mismo
  // proveedor (por alias), aunque su importe/fecha no casen con esta factura (B-2).
  if (!categoria && proveedorNombre) {
    const alias = await obtenerAliasProveedor(supabase, proveedorNombre)
    if (alias.length > 0) {
      const { data } = await supabase
        .from('conciliacion')
        .select('categoria, proveedor')
        .or(orFilterAlias(alias))
        .not('categoria', 'is', null)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data?.categoria) categoria = data.categoria as string
      if (!proveedor_canonico && data?.proveedor) proveedor_canonico = data.proveedor as string
    }
  }

  return { nif, categoria, proveedor_canonico }
}

export async function aplicarMatching(supabase: SupabaseClient, facturaId: string, result: MatchingResult, facturaExtra?: { proveedor_nombre?: string; nif_emisor?: string | null }): Promise<void> {
  await supabase.from('facturas_gastos').delete().eq('factura_id', facturaId).eq('confirmado_manual', false)
  if (result.matches.length > 0) {
    const { data: fac } = await supabase.from('facturas').select('titular_id').eq('id', facturaId).maybeSingle()
    const facturaTitular = (fac?.titular_id as string | null) ?? null
    const { data: manualesExistentes } = await supabase.from('facturas_gastos').select('conciliacion_id').eq('factura_id', facturaId).eq('confirmado_manual', true)
    const manualesIds = new Set((manualesExistentes || []).map(m => m.conciliacion_id as string))
    const filas = result.matches.filter(m => !manualesIds.has(m.id)).map((m) => ({ factura_id: facturaId, conciliacion_id: m.id, importe_asociado: Math.abs(m.importe), confirmado: result.estado === 'asociada', confirmado_manual: false, confianza_match: result.confianza, cruza_cuentas: Boolean(facturaTitular && m.titular_id && m.titular_id !== facturaTitular) }))
    if (filas.length > 0) await supabase.from('facturas_gastos').insert(filas)
  }
  let categoriaPropagada: string | null = null
  if (result.estado === 'asociada' && result.matches.length > 0) categoriaPropagada = categoriaMayoritaria(result.matches)

  // HERENCIA por proveedor conocido (B-1/B-2/B-3): rellena NIF y categoria desde el
  // proveedor ya conocido aunque no haya match por fecha+importe. Lee el estado real
  // de la factura para no pisar lo que ya tiene relleno.
  const { data: facActual } = await supabase
    .from('facturas')
    .select('nif_emisor, categoria_factura, proveedor_nombre')
    .eq('id', facturaId)
    .maybeSingle()
  const nombreProv = (facActual?.proveedor_nombre as string) || facturaExtra?.proveedor_nombre || ''
  const nifActual = (facActual?.nif_emisor as string) || facturaExtra?.nif_emisor || null
  const meta = await metadatosProveedorConocido(supabase, nombreProv, nifActual)
  if (!categoriaPropagada && meta.categoria) categoriaPropagada = meta.categoria

  const updateFactura: Record<string, unknown> = { estado: result.estado, mensaje_matching: result.mensaje }
  if (categoriaPropagada && !facActual?.categoria_factura) updateFactura.categoria_factura = categoriaPropagada
  if (meta.nif && !facActual?.nif_emisor) updateFactura.nif_emisor = meta.nif
  await supabase.from('facturas').update(updateFactura).eq('id', facturaId)
  if (result.estado === 'asociada' && result.matches.length > 0) { const matchIds = result.matches.map((m) => m.id); await supabase.from('conciliacion').update({ factura_id: facturaId }).in('id', matchIds) }
}

export type { MatchingEstado as MatchingResultLegacy }
