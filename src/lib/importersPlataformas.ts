import * as XLSX from 'xlsx'
import { supabase } from './supabase'

export type Canal = 'uber' | 'glovo' | 'je' | 'web' | 'directa'
export type Plataforma = 'rushhour' | 'uber' | 'glovo' | 'justeat'

export interface ParsedRow {
  fecha: string         // YYYY-MM-DD
  marca_nombre: string  // tal cual aparece en el extracto, para matching
  marca_id?: string | null
  canal: Canal
  pedidos: number
  bruto: number
}

export interface ImportSummary {
  filas: number
  totalPedidos: number
  totalBruto: number
  marcasNoMatcheadas: string[]
  rows: ParsedRow[]
}

/* ─────────────────────────  HELPERS  ───────────────────────── */

export const normalize = (s: string): string =>
  (s ?? '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()

export async function buildMarcaMap(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('marcas').select('id, nombre')
  if (error) throw error
  const map: Record<string, string> = {}
  for (const m of data ?? []) {
    if (!m.nombre) continue
    map[normalize(m.nombre)] = m.id
  }
  return map
}

export function findMarcaId(nombre: string, marcaMap: Record<string, string>): string | null {
  const norm = normalize(nombre)
  if (!norm) return null
  if (marcaMap[norm]) return marcaMap[norm]
  // Match parcial: marca cuyo nombre normalizado está contenido (en cualquier dirección)
  for (const [key, id] of Object.entries(marcaMap)) {
    if (key && (norm.includes(key) || key.includes(norm))) return id
  }
  return null
}

export function findColByKeywords(headers: string[], keywords: string[]): number {
  const norm = headers.map(h => (h ?? '').toString().toLowerCase().trim())
  for (const kw of keywords) {
    const idx = norm.findIndex(h => h.includes(kw))
    if (idx >= 0) return idx
  }
  return -1
}

function parseFechaISO(raw: unknown): string {
  if (raw == null) return ''
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const y = raw.getFullYear()
    const m = String(raw.getMonth() + 1).padStart(2, '0')
    const d = String(raw.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(raw).trim().split(/[T\s]/)[0]
  let m = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(s)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = /^(\d{2})[\/-](\d{2})[\/-](\d{2})$/.exec(s)
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return ''
}

function parseImporte(raw: unknown): number {
  if (typeof raw === 'number') return raw
  if (raw == null) return 0
  let s = String(raw).trim().replace(/€/g, '').replace(/EUR/gi, '').trim()
  if (!s) return 0
  if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1).trim()
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s) || /^-?\d+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

/* ─────────────────────  XLSX/CSV LOADER  ─────────────────────── */

export function readWorkbookFromArrayBuffer(buf: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true })
}

export function sheetToRows(wb: XLSX.WorkBook): unknown[][] {
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as unknown[][]
}

function findHeaderIdx(rows: unknown[][], required: string[][]): number {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const cells = (rows[i] || []).map(c => String(c ?? '').toLowerCase().trim())
    const match = required.every(altKws => altKws.some(kw => cells.some(c => c.includes(kw))))
    if (match) return i
  }
  return -1
}

/* ─────────────────────────  PARSERS  ───────────────────────── */

/**
 * RushHour — agregador. Suele exportar en CSV o XLSX con:
 *   date | brand | channel | orders | gross
 * Marca viene EN LA FILA. Channel es UBER/GLOVO/JE/WEB/DIRECTA.
 */
export function parseRushHour(rows: unknown[][], marcaMap: Record<string, string>): ImportSummary {
  const headerIdx = findHeaderIdx(rows, [
    ['date', 'fecha'],
    ['brand', 'marca'],
    ['channel', 'platform', 'plataforma', 'canal'],
    ['order', 'pedid'],
  ])
  if (headerIdx === -1) return emptySummary()
  const headers = (rows[headerIdx] || []).map(h => String(h ?? ''))
  const idx = {
    fecha:  findColByKeywords(headers, ['date', 'fecha']),
    marca:  findColByKeywords(headers, ['brand', 'marca', 'restaurant']),
    canal:  findColByKeywords(headers, ['channel', 'platform', 'plataforma', 'canal']),
    pedidos: findColByKeywords(headers, ['orders', 'pedid']),
    bruto:  findColByKeywords(headers, ['gross', 'total', 'bruto']),
  }
  const out: ParsedRow[] = []
  const noMatch = new Set<string>()
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const fecha = parseFechaISO(idx.fecha >= 0 ? r[idx.fecha] : null)
    const marcaNombre = String(idx.marca >= 0 ? r[idx.marca] ?? '' : '').trim()
    const canalRaw = String(idx.canal >= 0 ? r[idx.canal] ?? '' : '').toLowerCase()
    const canal = mapCanal(canalRaw)
    const pedidos = Math.round(parseImporte(idx.pedidos >= 0 ? r[idx.pedidos] : 0))
    const bruto = parseImporte(idx.bruto >= 0 ? r[idx.bruto] : 0)
    if (!fecha || !marcaNombre || !canal) continue
    const marcaId = findMarcaId(marcaNombre, marcaMap)
    if (!marcaId) noMatch.add(marcaNombre)
    out.push({ fecha, marca_nombre: marcaNombre, marca_id: marcaId, canal, pedidos, bruto })
  }
  return aggregate(out, noMatch)
}

/**
 * Uber Eats — XLSX con `Fecha pedido | Restaurante | ID pedido | Subtotal | Total cliente`.
 * Devuelve una fila por (fecha, restaurante) con count(pedidos) y sum(bruto).
 */
export function parseUber(rows: unknown[][], marcaMap: Record<string, string>): ImportSummary {
  const headerIdx = findHeaderIdx(rows, [
    ['fecha', 'date'],
    ['restaurant', 'tienda', 'store'],
    ['total', 'gross', 'subtotal'],
  ])
  if (headerIdx === -1) return emptySummary()
  const headers = (rows[headerIdx] || []).map(h => String(h ?? ''))
  const idx = {
    fecha:  findColByKeywords(headers, ['fecha', 'date']),
    marca:  findColByKeywords(headers, ['restaurant', 'tienda', 'store', 'marca']),
    bruto:  findColByKeywords(headers, ['total cliente', 'gross', 'total', 'subtotal']),
  }
  return parsePedidosIndividuales(rows, headerIdx, idx, 'uber', marcaMap)
}

/**
 * Glovo — XLSX con `Fecha | Store | ID orden | Total | Comisión`.
 */
export function parseGlovo(rows: unknown[][], marcaMap: Record<string, string>): ImportSummary {
  const headerIdx = findHeaderIdx(rows, [
    ['fecha', 'date'],
    ['store', 'tienda', 'restaurant'],
    ['total', 'gross', 'bruto'],
  ])
  if (headerIdx === -1) return emptySummary()
  const headers = (rows[headerIdx] || []).map(h => String(h ?? ''))
  const idx = {
    fecha:  findColByKeywords(headers, ['fecha', 'date']),
    marca:  findColByKeywords(headers, ['store', 'tienda', 'restaurant', 'marca']),
    bruto:  findColByKeywords(headers, ['total', 'gross', 'bruto']),
  }
  return parsePedidosIndividuales(rows, headerIdx, idx, 'glovo', marcaMap)
}

/**
 * Just Eat — XLSX con `Order date | Restaurant | Order ID | Gross total`.
 */
export function parseJustEat(rows: unknown[][], marcaMap: Record<string, string>): ImportSummary {
  const headerIdx = findHeaderIdx(rows, [
    ['date', 'fecha'],
    ['restaurant', 'tienda', 'store'],
    ['gross', 'total'],
  ])
  if (headerIdx === -1) return emptySummary()
  const headers = (rows[headerIdx] || []).map(h => String(h ?? ''))
  const idx = {
    fecha:  findColByKeywords(headers, ['order date', 'date', 'fecha']),
    marca:  findColByKeywords(headers, ['restaurant', 'store', 'marca']),
    bruto:  findColByKeywords(headers, ['gross total', 'gross', 'total']),
  }
  return parsePedidosIndividuales(rows, headerIdx, idx, 'je', marcaMap)
}

/* ───────────────────  HELPERS DE AGREGACIÓN  ─────────────────── */

function parsePedidosIndividuales(
  rows: unknown[][],
  headerIdx: number,
  idx: { fecha: number; marca: number; bruto: number },
  canal: Canal,
  marcaMap: Record<string, string>,
): ImportSummary {
  const out: ParsedRow[] = []
  const noMatch = new Set<string>()
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const fecha = parseFechaISO(idx.fecha >= 0 ? r[idx.fecha] : null)
    const marcaNombre = String(idx.marca >= 0 ? r[idx.marca] ?? '' : '').trim()
    const bruto = parseImporte(idx.bruto >= 0 ? r[idx.bruto] : 0)
    if (!fecha || !marcaNombre || bruto <= 0) continue
    const marcaId = findMarcaId(marcaNombre, marcaMap)
    if (!marcaId) noMatch.add(marcaNombre)
    // Cada fila = 1 pedido
    out.push({ fecha, marca_nombre: marcaNombre, marca_id: marcaId, canal, pedidos: 1, bruto })
  }
  return aggregate(out, noMatch)
}

function aggregate(rows: ParsedRow[], noMatch: Set<string>): ImportSummary {
  const map = new Map<string, ParsedRow>()
  for (const r of rows) {
    const k = `${r.fecha}|${r.marca_id ?? '_'}|${r.canal}`
    const acc = map.get(k)
    if (acc) {
      acc.pedidos += r.pedidos
      acc.bruto += r.bruto
    } else {
      map.set(k, { ...r })
    }
  }
  const aggregated = Array.from(map.values())
  const totalPedidos = aggregated.reduce((s, r) => s + r.pedidos, 0)
  const totalBruto = aggregated.reduce((s, r) => s + r.bruto, 0)
  return {
    filas: aggregated.length,
    totalPedidos,
    totalBruto,
    marcasNoMatcheadas: Array.from(noMatch),
    rows: aggregated,
  }
}

function emptySummary(): ImportSummary {
  return { filas: 0, totalPedidos: 0, totalBruto: 0, marcasNoMatcheadas: [], rows: [] }
}

function mapCanal(s: string): Canal | null {
  const n = s.toLowerCase().trim()
  if (n.includes('uber')) return 'uber'
  if (n.includes('glovo')) return 'glovo'
  if (n.includes('just') || n === 'je') return 'je'
  if (n.includes('web')) return 'web'
  if (n.includes('direct') || n.includes('caja') || n.includes('local')) return 'directa'
  return null
}

/* ──────────────────  UPSERT EN facturacion_diario  ────────────── */

export interface UpsertResult {
  upserted: number
  saltadas: number  // por falta de marca_id
}

export async function upsertFacturacionDiario(
  rows: ParsedRow[],
  onProgress?: (current: number, total: number) => void,
): Promise<UpsertResult> {
  const validRows = rows.filter(r => r.marca_id)
  let upserted = 0
  onProgress?.(0, validRows.length)

  for (const r of validRows) {
    const { data: existing, error: selErr } = await supabase
      .from('facturacion_diario')
      .select('id, uber_pedidos, uber_bruto, glovo_pedidos, glovo_bruto, je_pedidos, je_bruto, web_pedidos, web_bruto, directa_pedidos, directa_bruto')
      .eq('fecha', r.fecha)
      .eq('marca_id', r.marca_id!)
      .maybeSingle()
    if (selErr) throw selErr

    const campoPed = `${r.canal}_pedidos`
    const campoBruto = `${r.canal}_bruto`

    if (existing) {
      const merged: Record<string, any> = {
        ...existing,
        [campoPed]: r.pedidos,
        [campoBruto]: r.bruto,
      }
      merged.total_pedidos =
        (merged.uber_pedidos || 0) + (merged.glovo_pedidos || 0) +
        (merged.je_pedidos || 0) + (merged.web_pedidos || 0) +
        (merged.directa_pedidos || 0)
      merged.total_bruto =
        Number(merged.uber_bruto || 0) + Number(merged.glovo_bruto || 0) +
        Number(merged.je_bruto || 0) + Number(merged.web_bruto || 0) +
        Number(merged.directa_bruto || 0)
      delete merged.id
      const { error } = await supabase.from('facturacion_diario').update(merged).eq('id', (existing as any).id)
      if (error) throw error
    } else {
      const insertRow: Record<string, any> = {
        fecha: r.fecha,
        marca_id: r.marca_id,
        [campoPed]: r.pedidos,
        [campoBruto]: r.bruto,
        total_pedidos: r.pedidos,
        total_bruto: r.bruto,
      }
      const { error } = await supabase.from('facturacion_diario').insert(insertRow)
      if (error) throw error
    }
    upserted++
    if (upserted % 10 === 0 || upserted === validRows.length) {
      onProgress?.(upserted, validRows.length)
    }
  }
  return { upserted, saltadas: rows.length - validRows.length }
}

export async function logImport(payload: {
  plataforma: Plataforma
  archivo: string
  marca_nombre?: string | null
  marca_id?: string | null
  filas: number
  totalPedidos: number
  totalBruto: number
  estado: 'ok' | 'error'
  error?: string | null
}): Promise<void> {
  await supabase.from('imports_plataformas').insert({
    plataforma: payload.plataforma,
    archivo: payload.archivo,
    marca_nombre: payload.marca_nombre ?? null,
    marca_id: payload.marca_id ?? null,
    filas: payload.filas,
    total_pedidos: payload.totalPedidos,
    total_bruto: payload.totalBruto,
    estado: payload.estado,
    error: payload.error ?? null,
  })
}

/* ───────────  CSV reader simple para RushHour si llega CSV  ─────── */

export function csvToRows(text: string): unknown[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  return lines.map(l => l.split(/[,;\t]/).map(c => c.trim().replace(/^"|"$/g, '')))
}
