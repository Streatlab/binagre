// volcarVentasProducto — Conecta los documentos de detalle de producto con
// ventas_plato y ventas_franja. Lo llama procesarArchivo cuando detecta:
//   · CSV Sincro sold_products → ventas_plato + ventas_franja (Glovo + JustEat + Uber)
//   · CSV Uber detalle por producto (emea, cabecera en inglés con "Article Name")
//     → ventas_plato + ventas_franja (solo Uber)
// Idempotente: upsert por clave natural (canal, marca, plato/fecha/hora, año/mes).
// NO inventa marcas: lo que no case queda con marcaRaw sin mapear y se loguea.

import type { SupabaseClient } from '@supabase/supabase-js'
import { parseSincroProductos } from './parserSincroProductos.js'
import type { ProcesarResultado, ArchivoEntrada } from './procesarArchivo.js'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

async function mapearMarca(supabase: SupabaseClient, marcaRaw: string): Promise<string | null> {
  const { data } = await supabase.from('marcas').select('nombre')
  const marcas = (data || []) as { nombre: string }[]
  const raw = norm(marcaRaw)
  let mejor: string | null = null; let mejorLen = 0
  for (const m of marcas) {
    const n = norm(m.nombre)
    if (n && (raw.includes(n) || n.includes(raw)) && n.length > mejorLen) {
      mejor = m.nombre; mejorLen = n.length
    }
  }
  return mejor
}

// Detecta si el CSV tiene la cabecera de Uber detalle por producto (en inglés)
function esUberProductoCSV(texto: string): boolean {
  const primera = texto.split('\n')[0] || ''
  return /Article Name/i.test(primera) && /Membership Status/i.test(primera)
}

// Detecta si el CSV es un sold_products de Sincro (sin cabecera, col3=Glovo/JustEat/Uber)
function esSincroCSV(texto: string): boolean {
  const primeras = texto.split('\n').slice(0, 3).join('\n')
  return /;(Glovo|JustEat|Uber);/i.test(primeras)
}

async function volcarPlatos(
  supabase: SupabaseClient,
  file: ArchivoEntrada,
  marcaCache: Map<string, string | null>,
  platos: Array<{
    canal: string; marcaRaw: string; plato: string; es_modificador: boolean
    mes: number; anio: number; unidades: number; importe: number
  }>,
  franjas: Array<{
    canal: string; marcaRaw: string; fecha: string; hora: number
    dia_semana: number; pedidos: number; unidades: number; importe: number
  }>,
): Promise<ProcesarResultado> {
  // Mapear marcas (con caché para no repetir llamadas)
  const getMarca = async (raw: string) => {
    if (!marcaCache.has(raw)) marcaCache.set(raw, await mapearMarca(supabase, raw))
    return marcaCache.get(raw) || null
  }

  let platosOk = 0; let franjasOk = 0; const sinMarca: string[] = []

  // ── ventas_plato ──
  for (const p of platos) {
    const marca = await getMarca(p.marcaRaw)
    if (!marca) { if (!sinMarca.includes(p.marcaRaw)) sinMarca.push(p.marcaRaw); continue }
    const preciomedio = p.unidades > 0 ? p.importe / p.unidades : 0
    await supabase.from('ventas_plato').upsert({
      canal: p.canal, marca, plato: p.plato,
      mes: p.mes, ['año']: p.anio,
      unidades: p.unidades, ingresos_brutos: p.importe, precio_medio: preciomedio,
      origen: 'sincro', estimado: false, updated_at: new Date().toISOString(),
    }, { onConflict: 'canal,marca,plato,mes,año' })
    platosOk++
  }

  // ── ventas_franja ──
  for (const f of franjas) {
    const marca = await getMarca(f.marcaRaw)
    if (!marca) continue
    await supabase.from('ventas_franja').upsert({
      canal: f.canal, marca, fecha: f.fecha, hora: f.hora,
      dia_semana: f.dia_semana, pedidos: f.pedidos,
      unidades: f.unidades, importe: f.importe,
      origen: 'sincro', updated_at: new Date().toISOString(),
    }, { onConflict: 'canal,marca,fecha,hora' })
    franjasOk++
  }

  const motivo = [
    `${platosOk} filas ventas_plato`,
    `${franjasOk} filas ventas_franja`,
    sinMarca.length ? `⚠️ sin mapear: ${sinMarca.join(', ')}` : '',
  ].filter(Boolean).join(' | ')

  return {
    estado: platosOk > 0 ? 'ok' : 'lectura_manual',
    archivo: file.nombre,
    tipo_documento: 'resumen_ventas',
    motivo,
  }
}

// Punto de entrada: intenta tratar el archivo como CSV de producto.
// Devuelve null si no es un CSV de producto (para que siga el flujo normal).
export async function intentarVentaProducto(
  supabase: SupabaseClient,
  file: ArchivoEntrada,
  tipo: string,
): Promise<ProcesarResultado | null> {
  try {
    if (tipo !== 'csv' && tipo !== 'texto' && tipo !== 'excel') return null
    const texto = file.buffer.toString('utf8')

    // ── Sincro sold_products ──
    if (esSincroCSV(texto)) {
      const resultado = parseSincroProductos(texto)
      if (resultado.ventas_plato.length === 0 && resultado.ventas_franja.length === 0) return null
      const cache = new Map<string, string | null>()
      return await volcarPlatos(supabase, file, cache, resultado.ventas_plato, resultado.ventas_franja)
    }

    // ── Uber detalle por producto (CSV emea en inglés) ──
    if (esUberProductoCSV(texto)) {
      const platos: Parameters<typeof volcarPlatos>[3] = []
      const franjas: Parameters<typeof volcarPlatos>[4] = []
      const lineas = texto.split('\n')
      const cabecera = lineas[0].split(',')
      const idx = (col: string) => cabecera.findIndex(c => c.trim().toLowerCase().includes(col.toLowerCase()))
      const iNombre = idx('Article Name')
      const iFecha = idx('Order Accepted')
      const iPrecio = idx('Gross sales (ATV)')
      const iCantidad = idx('Quantity')
      const iMarca = idx('Store Name')

      if (iNombre < 0 || iFecha < 0) return null

      const pedidosPorFranjaMap = new Map<string, Set<string>>()

      for (let i = 1; i < lineas.length; i++) {
        const cols = lineas[i].split(',')
        if (cols.length < 5) continue
        const nombre = cols[iNombre]?.trim() || ''
        const fechaHora = cols[iFecha]?.trim() || ''
        const precioStr = cols[iPrecio]?.trim() || '0'
        const cantidadStr = cols[iCantidad]?.trim() || '1'
        const marcaRaw = iMarca >= 0 ? (cols[iMarca]?.trim() || '') : ''
        if (!nombre || !fechaHora) continue

        const precio = parseFloat(precioStr.replace(',','.')) || 0
        const cantidad = parseInt(cantidadStr, 10) || 1

        let dt: Date
        try { dt = new Date(fechaHora); if (isNaN(dt.getTime())) continue } catch { continue }

        const mes = dt.getMonth() + 1; const anio = dt.getFullYear()
        const hora = dt.getHours()
        const diaSemana = dt.getDay() === 0 ? 6 : dt.getDay() - 1
        const fecha = fechaHora.slice(0, 10)

        platos.push({ canal: 'uber', marcaRaw, plato: nombre, es_modificador: false,
          mes, anio, unidades: cantidad, importe: precio })

        const kf = `${marcaRaw}||${fecha}||${hora}`
        if (!pedidosPorFranjaMap.has(kf)) pedidosPorFranjaMap.set(kf, new Set())
        pedidosPorFranjaMap.get(kf)!.add(String(i))

        franjas.push({ canal: 'uber', marcaRaw, fecha, hora, dia_semana: diaSemana,
          pedidos: 1, unidades: cantidad, importe: precio })
      }

      if (platos.length === 0) return null
      const cache = new Map<string, string | null>()
      return await volcarPlatos(supabase, file, cache, platos, franjas)
    }
  } catch (e) {
    console.error('[intentarVentaProducto] fallo:', (e as Error)?.message)
  }
  return null
}
