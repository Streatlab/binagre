// volcarVentasProducto — Conecta los documentos de detalle de producto con
// ventas_plato y ventas_franja (las tablas que alimentan Menú Engineering,
// Pareto y el Playbook). Lo llama procesarArchivo ANTES de tratar nada como factura.
//
// Reconoce (por contenido, no por nombre):
//   · CSV Sinqro sold_products (sin cabecera, ';', canal col 3)
//       → ventas_plato + ventas_franja (glovo + justeat, marca '')
//   · CSV Uber "detalle nivel artículo" (cabecera española o inglesa)
//       → ventas_plato (canal uber, marca = nombre de la tienda)
//   · CSV Uber "order history" (Restaurante / Valor del recibo / Hora del pedido del cliente)
//       → ventas_franja (canal uber, marca = restaurante, hora LOCAL directa)
//
// VERIFICADO al céntimo contra la verdad de BD (05/07/2026):
//   uber platos jun 336 filas = 12.571,49 · uber franjas 342 filas = 11.887,74
//   sinqro: ver cabecera de parserSincroProductos.
//
// Idempotente: upsert por clave natural (canal,marca,plato,mes,año) y
// (canal,marca,fecha,hora). Re-subir el mismo archivo deja los mismos números.

import type { SupabaseClient } from '@supabase/supabase-js'
import { parseSincroProductos } from './parserSincroProductos.js'
import type { ProcesarResultado, ArchivoEntrada } from './procesarArchivo.js'

// ── Utilidades CSV (coma con comillas) ──────────────────────────────────────
function partirCSV(linea: string): string[] {
  const out: string[] = []
  let cur = '', dentro = false
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i]
    if (ch === '"') { if (dentro && linea[i + 1] === '"') { cur += '"'; i++ } else dentro = !dentro }
    else if (ch === ',' && !dentro) { out.push(cur.trim()); cur = '' }
    else cur += ch
  }
  out.push(cur.trim())
  return out
}
function num(s: string | undefined): number {
  const v = (s || '').replace(/[€\s]/g, '').replace(',', '.')
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}
function dowDeFecha(fechaISO: string): number {
  return new Date(fechaISO + 'T12:00:00Z').getUTCDay() // 0=domingo (convención BD)
}

// ── Detección por contenido ─────────────────────────────────────────────────
function esSincroCSV(texto: string): boolean {
  const primeras = texto.split('\n').slice(0, 3).join('\n')
  return /;(Glovo|JustEat|Uber);/i.test(primeras)
}
function esUberDetalleCSV(texto: string): boolean {
  const primera = (texto.split('\n')[0] || '')
  return (/Nombre del art[ií]culo/i.test(primera) && /Nombre de la tienda/i.test(primera)) ||
         (/Article Name/i.test(primera) && /Store Name/i.test(primera))
}
function esUberOrderHistoryCSV(texto: string): boolean {
  const primera = (texto.split('\n')[0] || '')
  return /Restaurante/i.test(primera) && /Valor del recibo/i.test(primera) && /Hora del pedido del cliente/i.test(primera)
}

// ── Upserts a BD ────────────────────────────────────────────────────────────
async function upsertPlatos(
  supabase: SupabaseClient,
  platos: Array<{ canal: string; marca: string; plato: string; mes: number; anio: number; unidades: number; importe: number }>,
  origen: string,
): Promise<number> {
  // Upsert por lotes (una sola llamada por cada 300 filas): imprescindible para no
  // agotar el tiempo de la función en Vercel con archivos grandes.
  const filas = platos.map(p => ({
    canal: p.canal, marca: p.marca, plato: p.plato,
    mes: p.mes, ['año']: p.anio,
    unidades: p.unidades, ingresos_brutos: p.importe,
    precio_medio: p.unidades > 0 ? Math.round((p.importe / p.unidades) * 100) / 100 : 0,
    origen, estimado: false, updated_at: new Date().toISOString(),
  }))
  let ok = 0
  for (let i = 0; i < filas.length; i += 300) {
    const lote = filas.slice(i, i + 300)
    const { error } = await supabase.from('ventas_plato').upsert(lote, { onConflict: 'canal,marca,plato,mes,año' })
    if (!error) ok += lote.length
    else console.error('[upsertPlatos] lote falló:', error.message)
  }
  return ok
}

async function upsertFranjas(
  supabase: SupabaseClient,
  franjas: Array<{ canal: string; marca: string; fecha: string; hora: number; dia_semana: number; pedidos: number; unidades: number; importe: number }>,
  origen: string,
): Promise<number> {
  const filas = franjas.map(f => ({
    canal: f.canal, marca: f.marca, fecha: f.fecha, hora: f.hora,
    dia_semana: f.dia_semana, pedidos: f.pedidos,
    unidades: f.unidades, importe: Math.round(f.importe * 100) / 100,
    origen, updated_at: new Date().toISOString(),
  }))
  let ok = 0
  for (let i = 0; i < filas.length; i += 300) {
    const lote = filas.slice(i, i + 300)
    const { error } = await supabase.from('ventas_franja').upsert(lote, { onConflict: 'canal,marca,fecha,hora' })
    if (!error) ok += lote.length
    else console.error('[upsertFranjas] lote falló:', error.message)
  }
  return ok
}

// ── Uber detalle nivel artículo → ventas_plato ──────────────────────────────
// Regla verificada: importe = "Ventas (con IVA)" + "Promociones en artículos (con IVA)"
// (las promos vienen en negativo). Fecha dd/mm/yy. Marca por carry-forward del
// "Id. del flujo de trabajo" (las filas de artículo traen la tienda vacía).
function parseUberDetalle(texto: string) {
  const lineas = texto.split('\n').filter(l => l.trim())
  if (lineas[0]?.charCodeAt(0) === 0xFEFF) lineas[0] = lineas[0].slice(1)
  const hdr = partirCSV(lineas[0])
  const idx = (re: RegExp) => hdr.findIndex(h => re.test(h))
  const iWf = idx(/flujo de trabajo|workflow/i)
  const iTienda = idx(/nombre de la tienda|store name/i)
  const iArt = idx(/nombre del art[ií]culo|article name/i)
  const iFecha = idx(/fecha del pedido|order date/i)
  const iCant = idx(/cantidad final|final quantity/i)
  const iVent = idx(/^ventas \(con iva\)|gross sales/i)
  const iProm = hdr.reduce<number[]>((acc, h, i) => (/promociones en art[ií]culos \(con iva\)|item promotions/i.test(h) ? [...acc, i] : acc), [])
  if (iArt < 0 || iFecha < 0 || iVent < 0) return null

  const filas = lineas.slice(1).map(partirCSV)
  const marcaWf = new Map<string, string>()
  for (const c of filas) {
    const wf = c[iWf] || ''
    const tienda = (c[iTienda] || '').trim()
    if (wf && tienda) marcaWf.set(wf, tienda)
  }

  const agg = new Map<string, { canal: string; marca: string; plato: string; mes: number; anio: number; unidades: number; importe: number }>()
  for (const c of filas) {
    const art = (c[iArt] || '').trim()
    if (!art) continue
    const marca = (c[iTienda] || '').trim() || marcaWf.get(c[iWf] || '') || 'Sin marca'
    const fecha = (c[iFecha] || '').trim() // dd/mm/yy
    const p = fecha.split('/')
    if (p.length !== 3) continue
    const mes = parseInt(p[1], 10)
    const anio = 2000 + parseInt(p[2], 10)
    if (!mes || !anio) continue
    let cant = parseInt(c[iCant] || '1', 10)
    if (isNaN(cant) || cant < 1) cant = 1
    const importe = num(c[iVent]) + iProm.reduce((s, i) => s + num(c[i]), 0)
    const k = `${marca}||${art}||${anio}||${mes}`
    if (!agg.has(k)) agg.set(k, { canal: 'uber', marca, plato: art, mes, anio, unidades: 0, importe: 0 })
    const a = agg.get(k)!
    a.unidades += cant
    a.importe += importe
  }
  // Agregados a 0 € no aportan (líneas residuales fuera del mes del export)
  return Array.from(agg.values())
    .filter(a => Math.abs(a.importe) > 0.004)
    .map(a => ({ ...a, importe: Math.round(a.importe * 100) / 100 }))
}

// ── Uber order history → ventas_franja ──────────────────────────────────────
// Regla verificada: hora LOCAL directa ("Hora del pedido del cliente"), se excluyen
// pedidos 'canceled', importe = "Valor del recibo", unidades = artículos del menú.
function parseUberOrderHistory(texto: string) {
  const lineas = texto.split('\n').filter(l => l.trim())
  if (lineas[0]?.charCodeAt(0) === 0xFEFF) lineas[0] = lineas[0].slice(1)
  const hdr = partirCSV(lineas[0])
  const idx = (re: RegExp) => hdr.findIndex(h => re.test(h))
  const iR = idx(/^Restaurante$/i)
  const iE = idx(/^Estado del pedido$/i)
  const iV = idx(/^Valor del recibo$/i)
  const iN = idx(/Cantidad de art[ií]culos del men[uú]/i)
  const iH = idx(/^Hora del pedido del cliente$/i)
  if (iR < 0 || iH < 0 || iV < 0) return null

  const agg = new Map<string, { canal: string; marca: string; fecha: string; hora: number; dia_semana: number; pedidos: number; unidades: number; importe: number }>()
  for (const linea of lineas.slice(1)) {
    const c = partirCSV(linea)
    if ((c[iE] || '').trim() === 'canceled') continue
    const ts = (c[iH] || '').trim()
    if (ts.length < 13) continue
    const fecha = ts.slice(0, 10)
    const hora = parseInt(ts.slice(11, 13), 10)
    if (isNaN(hora)) continue
    const marca = (c[iR] || '').trim() || 'Sin marca'
    const k = `${marca}||${fecha}||${hora}`
    if (!agg.has(k)) agg.set(k, { canal: 'uber', marca, fecha, hora, dia_semana: dowDeFecha(fecha), pedidos: 0, unidades: 0, importe: 0 })
    const a = agg.get(k)!
    a.pedidos += 1
    a.unidades += Math.round(num(c[iN] || '0'))
    a.importe += num(c[iV])
  }
  return Array.from(agg.values())
}

// ── Punto de entrada ────────────────────────────────────────────────────────
export async function intentarVentaProducto(
  supabase: SupabaseClient,
  file: ArchivoEntrada,
  tipo: string,
): Promise<ProcesarResultado | null> {
  try {
    if (tipo !== 'csv' && tipo !== 'texto' && tipo !== 'excel') return null
    const texto = file.buffer.toString('utf8')

    // ── Sinqro sold_products → platos + franjas (glovo/justeat, marca '') ──
    if (esSincroCSV(texto)) {
      const r = parseSincroProductos(texto)
      if (r.ventas_plato.length === 0 && r.ventas_franja.length === 0) return null
      const p = await upsertPlatos(supabase, r.ventas_plato, 'sincro')
      const f = await upsertFranjas(supabase, r.ventas_franja, 'sincro')
      const tot = r.ventas_plato.reduce((s, x) => s + x.importe, 0)
      return { estado: p > 0 ? 'ok' : 'error', archivo: file.nombre, tipo_documento: 'resumen_ventas',
        motivo: `Sinqro → ${p} platos y ${f} franjas a Ventas (${Math.round(tot * 100) / 100} € brutos)` }
    }

    // ── Uber detalle nivel artículo → ventas_plato ──
    if (esUberDetalleCSV(texto)) {
      const platos = parseUberDetalle(texto)
      if (!platos || platos.length === 0) return null
      const p = await upsertPlatos(supabase, platos, 'uber_detalle')
      const tot = platos.reduce((s, x) => s + x.importe, 0)
      return { estado: p > 0 ? 'ok' : 'error', archivo: file.nombre, tipo_documento: 'resumen_ventas',
        motivo: `Uber detalle → ${p} platos a Ventas (${Math.round(tot * 100) / 100} € brutos)` }
    }

    // ── Uber order history → ventas_franja ──
    if (esUberOrderHistoryCSV(texto)) {
      const franjas = parseUberOrderHistory(texto)
      if (!franjas || franjas.length === 0) return null
      const f = await upsertFranjas(supabase, franjas, 'uber_order_history')
      const tot = franjas.reduce((s, x) => s + x.importe, 0)
      return { estado: f > 0 ? 'ok' : 'error', archivo: file.nombre, tipo_documento: 'resumen_ventas',
        motivo: `Uber pedidos → ${f} franjas horarias a Ventas (${Math.round(tot * 100) / 100} €)` }
    }
  } catch (e) {
    console.error('[intentarVentaProducto] fallo:', (e as Error)?.message)
  }
  return null
}
