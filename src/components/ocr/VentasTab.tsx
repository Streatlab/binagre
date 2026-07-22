import { BLANCO, BORDE_SUAVE, CLARO, CREMA, GRANATE, GRIS, INK, NAR, OSC, ROJO, VERDE } from '@/styles/neobrutal'
import { useMultiSort } from '@/hooks/useMultiSort'
import SortableHeader, { ClearSortButton } from '@/components/ui/SortableHeader'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FONT, useTheme } from '@/styles/tokens'
import { fmtDate, fmtNumES } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import VentasPlatosFranjas from '@/components/ocr/VentasPlatosFranjas'

interface Liquidacion {
  id: string
  plataforma: 'uber' | 'glovo' | 'just_eat'
  marca: string
  fecha_deposito: string
  fecha_inicio_periodo: string | null
  fecha_fin_periodo: string | null
  num_pedidos: number
  ventas_bruto: number
  comision: number
  promociones: number
  pago_neto: number
  estado: string
  titular_id: string | null
  referencia: string
}

interface Titular { id: string; nombre: string }
interface ImportLog { archivo: string; plataforma: string; nuevas: number; duplicadas: number; actualizadas: number; errores: string[] }

type SortCol = 'fecha' | 'marca' | 'plataforma' | 'bruto' | 'comision' | 'neto' | 'estado' | 'titular'
type FiltroCard = 'conciliadas' | 'pendientes' | null

const PAGE_SIZES = [50, 100, 200] as const
type PageSize = typeof PAGE_SIZES[number]
const DEFAULT_PAGE_SIZE: PageSize = 50

function parsePage(raw: string | null) { const n = Number(raw); return Number.isInteger(n) && n >= 1 ? n : 1 }
function parsePageSize(raw: string | null): PageSize { const n = Number(raw); return ([50, 100, 200] as number[]).includes(n) ? n as PageSize : DEFAULT_PAGE_SIZE }

function fmtFechaCSV(v: string): string {
  if (!v) return ''
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/)
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2]}-${m[1]}`
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  return v
}

// Formato español "1.234,56" -> 1234.56 (para Glovo PDF y Just Eat HTML)
function numES(v: string): number {
  return parseFloat((v || '0').replace(/\./g, '').replace(',', '.')) || 0
}

// Formato inglés del CSV EMEA de Uber: "1,234.56" o "306.57" -> 1234.56
function numEN(v: string): number {
  const s = (v || '0').replace(/"/g, '').replace(/€/g, '').replace(/,/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

// Normaliza nombre de marca para construir una referencia estable
function normalizarMarca(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim()
}

// Parser CSV que respeta comillas (no parte por comas dentro de "..."), soporta \r\n y "" escapado
function parseCSVQuoted(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { current += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { current += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(current); current = '' }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(current); current = ''
        if (row.some(c => c.trim() !== '')) rows.push(row)
        row = []
        if (ch === '\r') i++
      } else { current += ch }
    }
  }
  if (current !== '' || row.length) { row.push(current); if (row.some(c => c.trim() !== '')) rows.push(row) }
  return rows
}

function parseUberResumenCSV(texto: string): { items: any[]; errores: string[] } {
  const rows = parseCSVQuoted(texto)
  if (rows.length < 2) return { items: [], errores: ['CSV vacío'] }
  const cab = rows[0].map(h => h.replace(/^\uFEFF/, '').trim().replace(/\s+/g, ' ').toLowerCase())
  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      const idx = cab.findIndex(h => h.includes(c.toLowerCase()))
      if (idx !== -1) return idx
    }
    return -1
  }
  const iMarca  = find('nombre del restaurante', 'store name', 'nombre de la tienda', 'restaurant name')
  const iRef    = find('id. de referencia de ganancias', 'id de referencia de ganancias', 'payment reference', 'earnings reference id')
  const iPago   = find('pago total', 'net payout', 'pago neto', 'total payout', 'payment total')
  const iFecha  = find('fecha de pago', 'payment date')
  const iVentas = find('ventas (con iva', 'ventas con iva', 'sales (incl')
  const iPromo  = find('promociones en artículos', 'promociones en articulos', 'item promotions')
  const iComis  = find('tasa de servicio después del descuento', 'tasa de servicio despues del descuento', 'tasas de servicio', 'service fee')
  const iPed    = find('cantidad de pedidos', 'número de pedidos', 'numero de pedidos', 'order count')

  if (iMarca === -1 || iPago === -1 || iFecha === -1) {
    return { items: [], errores: [`Formato CSV resumen no reconocido. Columnas: ${cab.slice(0, 6).join(' | ')}`] }
  }

  const items: any[] = []
  for (let li = 1; li < rows.length; li++) {
    const cols = rows[li]
    const marca = (cols[iMarca] || '').trim()
    if (!marca) continue
    const fechaPago = fmtFechaCSV((cols[iFecha] || '').trim())
    if (!fechaPago || !/^\d{4}-\d{2}-\d{2}$/.test(fechaPago)) continue

    // Semana real del pago = los 7 días anteriores: [pago-7, pago-1]
    const d = new Date(fechaPago + 'T12:00:00')
    const fin = new Date(d); fin.setDate(d.getDate() - 1)
    const ini = new Date(d); ini.setDate(d.getDate() - 7)
    const iniStr = ini.toISOString().slice(0, 10)
    const finStr = fin.toISOString().slice(0, 10)

    const ventas = iVentas !== -1 ? numEN(cols[iVentas]) : 0
    const promo  = iPromo  !== -1 ? Math.abs(numEN(cols[iPromo])) : 0
    const brutoReal = Math.round((ventas - promo) * 100) / 100   // bruto real = ventas - promo
    const pagoNeto = numEN(cols[iPago])
    const comision = iComis !== -1 ? Math.abs(numEN(cols[iComis])) : 0
    const pedidos  = iPed   !== -1 ? Math.round(numEN(cols[iPed])) : 0
    const refUber  = iRef   !== -1 ? (cols[iRef] || '').trim() : ''

    items.push({
      referencia_pago: `uber_${normalizarMarca(marca)}_${iniStr}_${finStr}`,
      ref_uber: refUber,
      marca,
      fecha_deposito: fechaPago,
      fecha_inicio_periodo: iniStr,
      fecha_fin_periodo: finStr,
      num_pedidos: pedidos,
      ventas_bruto: brutoReal,
      promociones: promo,
      comision_uber: comision,
      pago_neto: pagoNeto,
    })
  }
  return { items, errores: [] }
}

function parseJustEatHTML(texto: string): { data: any; errores: string[] } {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(texto, 'text/html')
    const lines = (doc.body?.textContent || '').split('\n').map(l => l.trim()).filter(Boolean)
    const facMatch = (doc.body?.textContent || '').match(/Nº Factura\s+(\d+)/)
    const numero_factura = facMatch?.[1] || ''
    const tuFactIdx = lines.findIndex(l => l === 'Tu factura')
    const marca = tuFactIdx >= 0 ? lines[tuFactIdx + 2] || '' : ''
    const periodoLine = lines.find(l => l.match(/\d+\s+\w+\s+\d{4}\s+-\s+\d+\s+\w+\s+\d{4}/))
    const periodoMatch = periodoLine?.match(/(\d+\s+\w+\s+\d{4})\s+-\s+(\d+\s+\w+\s+\d{4})/)
    const recibirasLine = lines.find(l => l.match(/^\d+,\d+€$/))
    const ingreso = recibirasLine ? numES(recibirasLine.replace('€', '')) : 0
    const abonoIdx = lines.findIndex(l => l.includes('Será abonado antes del'))
    const fecha_abono_str = abonoIdx >= 0 ? lines[abonoIdx + 1] || '' : ''
    const ventasIdx = lines.findIndex(l => l.includes('Total de ventas'))
    const total_ventas = ventasIdx >= 0 ? numES((lines[ventasIdx + 1] || '').replace('€', '')) : 0
    const fechaFacturaLine = lines.find(l => l.match(/Fecha de factura\s+\d+\s+\w+\s+\d{4}/))
    const fechaFacturaMatch = fechaFacturaLine?.match(/Fecha de factura\s+(\d+\s+\w+\s+\d{4})/)
    const comisionIdx = lines.findIndex(l => l.includes('Comisión total'))
    const comision = comisionIdx >= 0 ? numES((lines[comisionIdx + 1] || '').replace('€', '')) : 0
    const totalIvaIdx = lines.findIndex(l => l.includes('Total incluido IVA'))
    const total_iva = totalIvaIdx >= 0 ? numES((lines[totalIvaIdx + 1] || '').replace('€', '')) : 0
    if (!numero_factura || ingreso === 0) return { data: null, errores: ['No se pudo extraer Nº Factura o importe'] }
    const MESES: Record<string, string> = { enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12' }
    const parseFechaES = (s: string) => { const m = s?.match(/(\d+)\s+(\w+)\s+(\d{4})/); if (!m) return null; return `${m[3]}-${MESES[m[2].toLowerCase()] || '01'}-${m[1].padStart(2, '0')}` }
    return { data: { numero_factura, marca: marca || 'Just Eat', fecha_factura: parseFechaES(fechaFacturaMatch?.[1] || '') || new Date().toISOString().slice(0, 10), fecha_inicio_periodo: periodoMatch ? parseFechaES(periodoMatch[1]) : null, fecha_fin_periodo: periodoMatch ? parseFechaES(periodoMatch[2]) : null, total_ventas, comision_total: comision, total_factura_iva: total_iva, ingreso_colaborador: ingreso, fecha_abono: parseFechaES(fecha_abono_str) }, errores: [] }
  } catch (e: any) { return { data: null, errores: [`Error: ${e.message}`] } }
}

async function autoconciliar(tabla: string, id: string, pagoNeto: number, fechaDeposito: string, margenCentimos = 0) {
  const d = new Date(fechaDeposito + 'T12:00:00')
  const desde = new Date(d); desde.setDate(d.getDate() - 2)
  const hasta = new Date(d); hasta.setDate(d.getDate() + 7)
  const importes = margenCentimos > 0 ? [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5].map(c => Math.round((pagoNeto + c * 0.01) * 100) / 100) : [pagoNeto]
  for (const imp of importes) {
    const { data } = await supabase.from('conciliacion').select('id').eq('tipo', 'ingreso').gte('fecha', desde.toISOString().slice(0, 10)).lte('fecha', hasta.toISOString().slice(0, 10)).eq('importe', imp).is('factura_id', null).limit(1)
    if (data && data.length > 0) {
      await supabase.from(tabla).update({ conciliacion_id: data[0].id, estado: 'conciliada', updated_at: new Date().toISOString() }).eq('id', id)
      await supabase.from('conciliacion').update({ doc_estado: 'tiene' }).eq('id', data[0].id)
      return true
    }
  }
  return false
}

interface Props { fechaDesde: Date; fechaHasta: Date; titulares: Titular[] }

export default function VentasTab({ fechaDesde, fechaHasta, titulares }: Props) {
  const { T } = useTheme()
  const uberRef = useRef<HTMLInputElement>(null)
  const glovoRef = useRef<HTMLInputElement>(null)
  const jeRef = useRef<HTMLInputElement>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('vpage'))
  const pageSize = parsePageSize(searchParams.get('vsize'))
  const updateUrl = useCallback((next: { page?: number; size?: PageSize }) => {
    const params = new URLSearchParams(searchParams)
    if (next.page !== undefined) params.set('vpage', String(next.page))
    if (next.size !== undefined) params.set('vsize', String(next.size))
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  const [todasFilas, setTodasFilas] = useState<Liquidacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [filtroCard, setFiltroCard] = useState<FiltroCard>(null)
  const [filtroPlataforma, setFiltroPlataforma] = useState<string>('todas')
  const [filtroMarca, setFiltroMarca] = useState<string>('todas')
  const [marcas, setMarcas] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [busquedaDebounced, setBusquedaDebounced] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const ms = useMultiSort<Liquidacion, SortCol>({
    getValue: (row, col) => {
      switch(col) {
        case 'fecha':      return row.fecha_deposito
        case 'marca':      return row.marca
        case 'plataforma': return row.plataforma
        case 'bruto':      return row.ventas_bruto
        case 'comision':   return row.comision
        case 'neto':       return row.pago_neto
        case 'estado':     return row.estado
        case 'titular':    return row.titular_id ?? ''
        default:           return ''
      }
    }
  })

  const desdeStr = fechaDesde.toISOString().slice(0, 10)
  const hastaStr = fechaHasta.toISOString().slice(0, 10)

  useEffect(() => { const t = setTimeout(() => setBusquedaDebounced(busqueda.trim()), 400); return () => clearTimeout(t) }, [busqueda])

  const cargar = useCallback(async () => {
    setCargando(true)
    const [uber, glovo, je] = await Promise.all([
      supabase.from('uber_liquidaciones').select('id,marca,referencia_pago,fecha_deposito,fecha_inicio_periodo,fecha_fin_periodo,num_pedidos,ventas_bruto,comision_uber,promociones,pago_neto,estado,titular_id').gte('fecha_deposito', desdeStr).lte('fecha_deposito', hastaStr).order('fecha_deposito', { ascending: false }),
      supabase.from('glovo_liquidaciones').select('id,marca,numero_factura,fecha_factura,fecha_inicio_periodo,fecha_fin_periodo,ventas_bruto,comision_base,marketing,ingreso_colaborador,estado,titular_id').gte('fecha_factura', desdeStr).lte('fecha_factura', hastaStr).order('fecha_factura', { ascending: false }),
      supabase.from('justeat_liquidaciones').select('id,marca,numero_factura,fecha_factura,fecha_inicio_periodo,fecha_fin_periodo,total_ventas,comision_total,ingreso_colaborador,estado,titular_id').gte('fecha_factura', desdeStr).lte('fecha_factura', hastaStr).order('fecha_factura', { ascending: false }),
    ])
    const all: Liquidacion[] = [
      ...(uber.data || []).map((r: any) => ({ id: r.id, plataforma: 'uber' as const, marca: r.marca, fecha_deposito: r.fecha_deposito, fecha_inicio_periodo: r.fecha_inicio_periodo, fecha_fin_periodo: r.fecha_fin_periodo, num_pedidos: r.num_pedidos || 0, ventas_bruto: Number(r.ventas_bruto) || 0, comision: Math.abs(Number(r.comision_uber) || 0), promociones: Math.abs(Number(r.promociones) || 0), pago_neto: Number(r.pago_neto) || 0, estado: r.estado, titular_id: r.titular_id || null, referencia: r.referencia_pago })),
      ...(glovo.data || []).map((r: any) => ({ id: r.id, plataforma: 'glovo' as const, marca: r.marca, fecha_deposito: r.fecha_factura, fecha_inicio_periodo: r.fecha_inicio_periodo, fecha_fin_periodo: r.fecha_fin_periodo, num_pedidos: 0, ventas_bruto: Number(r.ventas_bruto) || 0, comision: Math.abs(Number(r.comision_base) || 0), promociones: Math.abs(Number(r.marketing) || 0), pago_neto: Number(r.ingreso_colaborador) || 0, estado: r.estado, titular_id: r.titular_id || null, referencia: r.numero_factura })),
      ...(je.data || []).map((r: any) => ({ id: r.id, plataforma: 'just_eat' as const, marca: r.marca, fecha_deposito: r.fecha_factura, fecha_inicio_periodo: r.fecha_inicio_periodo, fecha_fin_periodo: r.fecha_fin_periodo, num_pedidos: 0, ventas_bruto: Number(r.total_ventas) || 0, comision: Math.abs(Number(r.comision_total) || 0), promociones: 0, pago_neto: Number(r.ingreso_colaborador) || 0, estado: r.estado, titular_id: r.titular_id || null, referencia: r.numero_factura })),
    ].sort((a, b) => b.fecha_deposito.localeCompare(a.fecha_deposito))
    setTodasFilas(all)
    setMarcas([...new Set(all.map(r => r.marca))].sort())
    setCargando(false)
  }, [desdeStr, hastaStr, refreshTick])

  useEffect(() => { cargar() }, [cargar])

  const filasFiltradas = useMemo(() => {
    let arr = [...todasFilas]
    if (filtroPlataforma !== 'todas') arr = arr.filter(f => f.plataforma === filtroPlataforma)
    if (filtroMarca !== 'todas') arr = arr.filter(f => f.marca === filtroMarca)
    if (filtroCard === 'conciliadas') arr = arr.filter(f => f.estado === 'conciliada')
    if (filtroCard === 'pendientes') arr = arr.filter(f => f.estado !== 'conciliada')
    if (busquedaDebounced) { const q = busquedaDebounced.toLowerCase(); arr = arr.filter(f => f.marca.toLowerCase().includes(q) || f.referencia.toLowerCase().includes(q)) }
    return ms.applySorts(arr)
  }, [todasFilas, filtroPlataforma, filtroMarca, filtroCard, busquedaDebounced, ms])

  const totalPages = Math.max(1, Math.ceil(filasFiltradas.length / pageSize))
  const filasPagina = filasFiltradas.slice((page - 1) * pageSize, page * pageSize)

  const agregados = useMemo(() => {
    const base = todasFilas.filter(f => (filtroPlataforma === 'todas' || f.plataforma === filtroPlataforma) && (filtroMarca === 'todas' || f.marca === filtroMarca))
    const totalCount = base.length
    const conciliadas = base.filter(f => f.estado === 'conciliada')
    const pendientes = base.filter(f => f.estado !== 'conciliada')
    return {
      totalCount, totalNeto: base.reduce((s, f) => s + f.pago_neto, 0),
      conciliadasCount: conciliadas.length, conciliadasNeto: conciliadas.reduce((s, f) => s + f.pago_neto, 0),
      conciliadasPct: totalCount > 0 ? Math.round((conciliadas.length / totalCount) * 100) : 0,
      pendientesCount: pendientes.length, pendientesNeto: pendientes.reduce((s, f) => s + f.pago_neto, 0),
    }
  }, [todasFilas, filtroPlataforma, filtroMarca])

  const onFiltroCard = (v: FiltroCard) => { setFiltroCard(prev => prev === v ? null : v); updateUrl({ page: 1 }) }

  const handleFile = (plataforma: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''
    setSubiendo(true); setLogs([])
    try {
      if (plataforma === 'auto') {
        const texto = await file.text()
        const nombre = file.name.toLowerCase()
        if (nombre.endsWith('.csv')) {
          await importarUberResumen(file, texto)
        } else if (nombre.endsWith('.pdf') || nombre.endsWith('.txt')) {
          await importarGlovoPDF(file, texto)
        } else if (nombre.endsWith('.html') || nombre.endsWith('.htm') || nombre.endsWith('.doc')) {
          const { data, errores: ep } = parseJustEatHTML(texto)
          if (ep.length > 0 || !data) { setLogs([{ archivo: file.name, plataforma: 'Just Eat', nuevas: 0, duplicadas: 0, actualizadas: 0, errores: ep.length ? ep : ['No se pudo parsear'] }]); return }
          await importarJustEat(file, data)
        } else {
          setLogs([{ archivo: file.name, plataforma: 'Auto', nuevas: 0, duplicadas: 0, actualizadas: 0, errores: ['Formato no reconocido (.csv, .pdf, .html, .doc)'] }])
        }
      }
    } finally {
      setSubiendo(false)
      setRefreshTick(x => x + 1)
    }
  }

  const importarUberResumen = async (file: File, texto: string) => {
    const { items, errores: ep } = parseUberResumenCSV(texto)
    if (ep.length > 0 || items.length === 0) { setLogs([{ archivo: file.name, plataforma: 'Uber Eats (resumen)', nuevas: 0, duplicadas: 0, actualizadas: 0, errores: ep.length ? ep : ['Sin datos en el resumen'] }]); return }
    let nuevas = 0, duplicadas = 0, actualizadas = 0; const errores: string[] = []
    for (const item of items) {
      const campos = {
        plataforma: 'uber', marca: item.marca, referencia_pago: item.referencia_pago,
        fecha_deposito: item.fecha_deposito,
        fecha_inicio_periodo: item.fecha_inicio_periodo, fecha_fin_periodo: item.fecha_fin_periodo,
        num_pedidos: item.num_pedidos, ventas_bruto: item.ventas_bruto,
        promociones: item.promociones, comision_uber: item.comision_uber,
        pago_neto: item.pago_neto, estado: 'pendiente',
      }
      const { data: existe } = await supabase.from('uber_liquidaciones').select('id,pago_neto').eq('referencia_pago', item.referencia_pago).maybeSingle()
      if (existe) {
        await supabase.from('uber_liquidaciones').update(campos).eq('id', existe.id)
        actualizadas++
        continue
      }
      const { data: liq, error: el } = await supabase.from('uber_liquidaciones').insert(campos).select('id').single()
      if (el || !liq) { errores.push(`${item.marca}: ${el?.message}`); continue }
      await autoconciliar('uber_liquidaciones', liq.id, item.pago_neto, item.fecha_deposito, 5)
      nuevas++
    }
    setLogs([{ archivo: file.name, plataforma: 'Uber Eats (resumen)', nuevas, duplicadas, actualizadas, errores }])
  }

  const importarGlovoPDF = async (file: File, texto: string) => {
    const lines = texto.split('\n').map(l => l.trim()).filter(Boolean)
    const facMatch = texto.match(/Factura Nº:\s*(I\w+)/)
    const numero_factura = facMatch?.[1] || ''
    const marcaLine = lines.find(l => /TABERNA|RAMEN|COCINA|MISTER|PASTA|MILANESA|FRENCH|GRETA|GUISAR|NINJA|LONDON|KOREAN|ES TIEMPO|POSMODERNO|COMIDA CASERA/i.test(l))
    const marca = marcaLine?.replace(/\(PICO DE LA MALICIOSA\)/i, '').trim() || ''
    const periodoMatch = texto.match(/Servicio prestado entre\s+(\d{4}-\d{2}-\d{2})\s+y\s+(\d{4}-\d{2}-\d{2})/)
    const fechaMatch = texto.match(/Fecha:\s+(\d{4}-\d{2}-\d{2})/)
    const ingresoMatch = texto.match(/Ingreso a cuenta colaborador\s+(-?[\d,\.]+)\s*€/)
    const ventasMatch = texto.match(/\+\s+Productos\s+([\d,\.]+)\s*€/)
    const totalFacturaMatch = texto.match(/Total factura\s*\(IVA[^)]+\)\s+([\d,\.]+)\s*€/)
    if (!numero_factura) { setLogs([{ archivo: file.name, plataforma: 'Glovo', nuevas: 0, duplicadas: 0, actualizadas: 0, errores: ['No se encontró Nº Factura'] }]); return }
    const { data: existe } = await supabase.from('glovo_liquidaciones').select('id').eq('numero_factura', numero_factura).maybeSingle()
    if (existe) { setLogs([{ archivo: file.name, plataforma: 'Glovo', nuevas: 0, duplicadas: 1, actualizadas: 0, errores: [] }]); return }
    const ingreso = ingresoMatch ? Math.abs(numES(ingresoMatch[1])) : 0
    const { data: liq, error: el } = await supabase.from('glovo_liquidaciones').insert({ plataforma: 'glovo', marca: marca || 'Glovo', numero_factura, fecha_factura: fechaMatch?.[1] || new Date().toISOString().slice(0, 10), fecha_inicio_periodo: periodoMatch?.[1] || null, fecha_fin_periodo: periodoMatch?.[2] || null, ventas_bruto: ventasMatch ? numES(ventasMatch[1]) : 0, total_factura_iva: totalFacturaMatch ? numES(totalFacturaMatch[1]) : 0, ingreso_colaborador: ingreso, estado: 'pendiente' }).select('id').single()
    if (el || !liq) { setLogs([{ archivo: file.name, plataforma: 'Glovo', nuevas: 0, duplicadas: 0, actualizadas: 0, errores: [`Error: ${el?.message}`] }]); return }
    const conciliado = await autoconciliar('glovo_liquidaciones', liq.id, ingreso, fechaMatch?.[1] || '', 0)
    setLogs([{ archivo: file.name, plataforma: 'Glovo', nuevas: 1, duplicadas: 0, actualizadas: 0, errores: conciliado ? [] : ['Creada — sin match en banco, revisa manualmente'] }])
  }

  const importarJustEat = async (file: File, data: any) => {
    const { data: existe } = await supabase.from('justeat_liquidaciones').select('id').eq('numero_factura', data.numero_factura).maybeSingle()
    if (existe) { setLogs([{ archivo: file.name, plataforma: 'Just Eat', nuevas: 0, duplicadas: 1, actualizadas: 0, errores: [] }]); return }
    const { data: liq, error: el } = await supabase.from('justeat_liquidaciones').insert({ plataforma: 'just_eat', marca: data.marca, numero_factura: data.numero_factura, fecha_factura: data.fecha_factura, fecha_inicio_periodo: data.fecha_inicio_periodo, fecha_fin_periodo: data.fecha_fin_periodo, total_ventas: data.total_ventas, comision_total: data.comision_total, total_factura_iva: data.total_factura_iva, ingreso_colaborador: data.ingreso_colaborador, fecha_abono: data.fecha_abono, estado: 'pendiente' }).select('id').single()
    if (el || !liq) { setLogs([{ archivo: file.name, plataforma: 'Just Eat', nuevas: 0, duplicadas: 0, actualizadas: 0, errores: [`Error: ${el?.message}`] }]); return }
    const conciliado = await autoconciliar('justeat_liquidaciones', liq.id, data.ingreso_colaborador, data.fecha_abono || data.fecha_factura, 0)
    setLogs([{ archivo: file.name, plataforma: 'Just Eat', nuevas: 1, duplicadas: 0, actualizadas: 0, errores: conciliado ? [] : ['Creada — sin match en banco aún'] }])
  }

  const HEADERS: { label: string; col: SortCol; align: 'left'|'right'|'center' }[] = [
    { label: 'Fecha', col: 'fecha', align: 'left' },
    { label: 'Marca', col: 'marca', align: 'left' },
    { label: 'Plataforma', col: 'plataforma', align: 'left' },
    { label: 'Bruto', col: 'bruto', align: 'right' },
    { label: 'Comisión', col: 'comision', align: 'right' },
    { label: 'Neto', col: 'neto', align: 'right' },
    { label: 'Estado', col: 'estado', align: 'left' },
    { label: 'Titular', col: 'titular', align: 'left' },
  ]

  void T; void uberRef; void glovoRef; void jeRef; void cargando; void marcas; void totalPages; void onFiltroCard; void handleFile; void fmtDate; void fmtNumES; void FONT; void titulares

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <input type="file" accept=".csv,.pdf,.html,.htm,.doc,.txt" onChange={handleFile('auto')} disabled={subiendo} />
        <span style={{ marginLeft: 12 }}>
          <input type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ padding: '6px 10px', fontSize: 13 }} />
        </span>
        <span style={{ marginLeft: 12 }}>
          <ClearSortButton show={ms.showClearButton} onClear={ms.clearSorts} />
        </span>
      </div>
      {logs.length > 0 && (
        <div style={{ marginBottom: 16, padding: 12, background: CREMA, borderRadius: 8 }}>
          {logs.map((l, i) => (
            <div key={i} style={{ marginBottom: 4, fontSize: 13 }}>
              <strong>{l.archivo}</strong> — {l.plataforma}: {l.nuevas} nuevas, {l.duplicadas} duplicadas, {l.actualizadas} actualizadas
              {l.errores.length > 0 && <div style={{ color: GRANATE, fontSize: 12 }}>{l.errores.join('; ')}</div>}
            </div>
          ))}
        </div>
      )}
      <VentasPlatosFranjas fechaDesde={fechaDesde} fechaHasta={fechaHasta} />
      <div style={{ background: BLANCO, border: `0.5px solid ${BORDE_SUAVE}`, borderRadius: 14, overflow: 'hidden', marginTop: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
          <thead>
            <tr>
              {HEADERS.map(h => (
                <SortableHeader key={h.col} col={h.col} label={h.label}
                  sortIndex={ms.sortIndex(h.col)} sortDir={ms.sortDir(h.col)}
                  onToggle={ms.toggleSort} align={h.align} />
              ))}
            </tr>
          </thead>
          <tbody>
            {filasPagina.length === 0 ? (
              <tr><td colSpan={HEADERS.length} style={{ padding: '24px 16px', textAlign: 'center', color: GRIS }}>Sin resultados</td></tr>
            ) : filasPagina.map((f, idx) => {
              const isLast = idx === filasPagina.length - 1
              const tdBase: React.CSSProperties = { padding: '8px 16px', borderBottom: isLast ? 'none' : `0.5px solid ${CLARO}` }
              return (
                <tr key={f.id}>
                  <td style={{ ...tdBase, color: GRIS, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(f.fecha_deposito)}</td>
                  <td style={{ ...tdBase, color: INK }}>{f.marca}</td>
                  <td style={{ ...tdBase, color: OSC, fontSize: 12, textTransform: 'capitalize' }}>{f.plataforma.replace('_', ' ')}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 13 }}>{fmtNumES(f.ventas_bruto, 2)}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 13, color: ROJO }}>{fmtNumES(f.comision, 2)}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, color: VERDE }}>{fmtNumES(f.pago_neto, 2)}</td>
                  <td style={{ ...tdBase, fontSize: 12, color: f.estado === 'conciliada' ? VERDE : NAR, textTransform: 'capitalize' }}>{f.estado}</td>
                  <td style={{ ...tdBase, fontSize: 12, color: GRIS }}>{titulares.find(t => t.id === f.titular_id)?.nombre || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, fontSize: 13, color: GRIS }}>
        {filasFiltradas.length} liquidaciones · Neto total: {agregados.totalNeto.toFixed(2)}€
      </div>
    </div>
  )
}
