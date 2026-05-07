import { useMultiSort } from '@/hooks/useMultiSort'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FONT, useTheme } from '@/styles/tokens'
import { fmtDate, fmtNumES } from '@/utils/format'
import { supabase } from '@/lib/supabase'

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
type SortDir = 'asc' | 'desc'
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

function numES(v: string): number {
  const s = (v || '0').trim().replace(/\s/g,'')
  if (s.includes(',') && s.includes('.')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }
  if (s.includes(',')) return parseFloat(s.replace(',', '.')) || 0
  return parseFloat(s) || 0
}

function parseUberCSV(texto: string) {
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  if (lineas.length < 3) return { grupos: {}, errores: ['CSV vacío'] }
  const cab = lineas[1].split(',')
  const i = (n: string) => cab.indexOf(n)
  const iId = i('Id. del pedido'), iPago = i('Pago total '), iRef = i('Id. de referencia de ganancias')
  const iMarca = i('Nombre de la tienda'), iCodigo = i('Código del establecimiento')
  const iFecha = i('Fecha del pedido'), iHora = i('Hora a la que se aceptó el pedido')
  const iModalidad = i('Modalidad de consumo'), iCanal = i('Canal de pedidos'), iEstado = i('Estado del pedido')
  const iVentas = i('Ventas (con IVA)'), iPromos = i('Promociones en artículos (con IVA)')
  const iTasa = i('Tasa de servicio después del descuento (con IVA)'), iOtros = i('Otros pagos (con IVA)')
  const iFechaPago = i('Fecha de pago')
  const iLinkEst = i('Enlace de la factura del establecimiento al cliente')
  const iLinkPortier = i('Enlace de Uber a la factura del establecimiento')
  const iWorkflow = i('Id. del flujo de trabajo')
  if (iId === -1 || iPago === -1 || iRef === -1) return { grupos: {}, errores: ['No es CSV detalle Uber'] }
  const n = (v: string) => parseFloat((v || '0').replace(',', '.')) || 0
  const grupos: Record<string, any> = {}
  for (let li = 2; li < lineas.length; li++) {
    const cols = lineas[li].split(',')
    if (cols.length < 10) continue
    const ref = cols[iRef]?.trim(), marca = cols[iMarca]?.trim()
    if (!ref || !marca) continue
    const key = `${ref}__${marca}`
    if (!grupos[key]) grupos[key] = { marca, codigo_establecimiento: cols[iCodigo]?.trim() || '', referencia_pago: ref, fecha_deposito: fmtFechaCSV(cols[iFechaPago]?.trim()), fecha_inicio_periodo: fmtFechaCSV(cols[iFecha]?.trim()), fecha_fin_periodo: fmtFechaCSV(cols[iFecha]?.trim()), num_pedidos: 0, ventas_bruto: 0, comision_uber: 0, promociones: 0, ads: 0, pago_neto: 0, detalle: [] }
    const g = grupos[key]
    const fp = fmtFechaCSV(cols[iFecha]?.trim())
    if (fp && fp < g.fecha_inicio_periodo) g.fecha_inicio_periodo = fp
    if (fp && fp > g.fecha_fin_periodo) g.fecha_fin_periodo = fp
    const pedidoId = cols[iId]?.trim(), pagoTotal = n(cols[iPago])
    if (pedidoId && pagoTotal !== 0) { g.num_pedidos++; g.ventas_bruto += n(cols[iVentas]); g.comision_uber += n(cols[iTasa]); g.promociones += n(cols[iPromos]); g.ads += n(cols[iOtros]); g.pago_neto += pagoTotal }
    g.detalle.push({ pedido_id: pedidoId || '', workflow_id: cols[iWorkflow]?.trim() || '', fecha_pedido: fp, hora_pedido: cols[iHora]?.trim() || '', modalidad: cols[iModalidad]?.trim() || '', canal: cols[iCanal]?.trim() || '', estado_pedido: cols[iEstado]?.trim() || '', ventas_con_iva: n(cols[iVentas]), promociones_con_iva: n(cols[iPromos]), tasa_servicio_con_iva: n(cols[iTasa]), otros_pagos: n(cols[iOtros]), pago_total: pagoTotal, fecha_pago: fmtFechaCSV(cols[iFechaPago]?.trim()), link_factura_establecimiento: cols[iLinkEst]?.trim() || '', link_factura_portier: cols[iLinkPortier]?.trim() || '' })
  }
  return { grupos, errores: [] }
}

function parseUberResumenCSV(texto: string): { items: any[]; errores: string[] } {
  const lineas = texto.split('\n').map(l => l.replace(/\r$/, '')).filter(Boolean)
  if (lineas.length < 2) return { items: [], errores: ['CSV vacío'] }
  const cab = lineas[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ' '))
  const findCol = (...names: string[]) => {
    for (const n of names) {
      const idx = cab.indexOf(n.toLowerCase().trim())
      if (idx !== -1) return idx
    }
    return -1
  }
  const iMarca = findCol('store name', 'nombre de la tienda', 'nombre del restaurante')
  const iRef = findCol('payment reference', 'id. de referencia de ganancias', 'id de referencia de ganancias')
  const iPago = findCol('pago total', 'pago neto', 'net payout', 'total payout', 'total payment')
  const iFecha = findCol('payment date', 'fecha de pago')
  const iVentas = findCol('ventas (con iva)', 'ventas con iva', 'sales (incl. vat)')
  const iVentasSinIva = findCol('ventas (sin iva)', 'ventas sin iva', 'sales (excl. vat)')
  const iTasa = findCol('tasa de servicio después del descuento (con iva)', 'tasa de servicio (con iva)', 'service fee (incl. vat)')
  const iPromos = findCol('promociones en artículos (con iva)', 'promociones (con iva)', 'item promotions (incl. vat)')
  const iCodigo = findCol('código del establecimiento', 'store id', 'restaurant id', 'id. del restaurante', 'id. del establecimiento')
  const iPedidos = findCol('cantidad de pedidos', 'pedidos liquidados', 'order count', 'orders')
  if (iMarca === -1 || iRef === -1 || iPago === -1) {
    return { items: [], errores: [`Formato CSV resumen no reconocido (marca=${iMarca}, ref=${iRef}, pago=${iPago})`] }
  }
  const items: any[] = []
  for (let li = 1; li < lineas.length; li++) {
    const cols = lineas[li].split(',')
    if (cols.length < 3) continue
    const ref = cols[iRef]?.trim(), marca = cols[iMarca]?.trim()
    if (!ref || !marca) continue
    const pagoNeto = numES(cols[iPago]?.trim() || '0')
    const fecha = iFecha !== -1 ? fmtFechaCSV(cols[iFecha]?.trim() || '') : ''
    const ventasBruto = iVentas !== -1 ? numES(cols[iVentas]?.trim() || '0') : (iVentasSinIva !== -1 ? numES(cols[iVentasSinIva]?.trim() || '0') : 0)
    const comision = iTasa !== -1 ? numES(cols[iTasa]?.trim() || '0') : 0
    const promos = iPromos !== -1 ? numES(cols[iPromos]?.trim() || '0') : 0
    const codigo = iCodigo !== -1 ? cols[iCodigo]?.trim() || '' : ''
    const pedidos = iPedidos !== -1 ? parseInt(cols[iPedidos]?.trim() || '0', 10) || 0 : 0
    items.push({ referencia_pago: ref, marca, pago_neto: pagoNeto, fecha_deposito: fecha, ventas_bruto: ventasBruto, comision_uber: comision, promociones: promos, codigo_establecimiento: codigo, num_pedidos: pedidos })
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
  const [sortCol, setSortCol] = useState<SortCol>('fecha')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaDebounced, setBusquedaDebounced] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const { sorts: ventaSorts, handleSort: multiHandleSort, sortIndicator: sortInd, applySorts: applyVentasSorts } = useMultiSort<Liquidacion, SortCol>({
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
    const PLAT_LABEL: Record<string, string> = { uber: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat' }
    arr.sort((a, b) => {
      let va: any, vb: any
      if (sortCol === 'fecha') { va = a.fecha_deposito; vb = b.fecha_deposito }
      else if (sortCol === 'marca') { va = a.marca; vb = b.marca }
      else if (sortCol === 'plataforma') { va = PLAT_LABEL[a.plataforma]; vb = PLAT_LABEL[b.plataforma] }
      else if (sortCol === 'bruto') { va = a.ventas_bruto; vb = b.ventas_bruto }
      else if (sortCol === 'comision') { va = a.comision; vb = b.comision }
      else if (sortCol === 'neto') { va = a.pago_neto; vb = b.pago_neto }
      else if (sortCol === 'estado') { va = a.estado; vb = b.estado }
      else if (sortCol === 'titular') { va = titulares.find(t => t.id === a.titular_id)?.nombre || ''; vb = titulares.find(t => t.id === b.titular_id)?.nombre || '' }
      else { va = a.fecha_deposito; vb = b.fecha_deposito }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return applyVentasSorts(arr)
  }, [todasFilas, filtroPlataforma, filtroMarca, filtroCard, busquedaDebounced, sortCol, sortDir, titulares, applyVentasSorts])

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

  function handleSort(col: SortCol) {
    multiHandleSort(col)
  }
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
          const lineas = texto.split('\n').filter(Boolean)
          const cab1 = (lineas[0] || '').replace(/^\uFEFF/, '').toLowerCase()
          const cab2 = (lineas[1] || '').toLowerCase()
          const esDetalle = cab2.includes('id. del pedido') || cab1.includes('id. del pedido')
          const esResumen = cab1.includes('store name') || cab1.includes('nombre de la tienda') || cab1.includes('nombre del restaurante') || cab1.includes('payment reference') || cab1.includes('id. de referencia de ganancias') || cab1.includes('pago neto') || cab1.includes('net payout') || cab1.includes('pago total')
          if (esDetalle) {
            await importarUberDetalle(file, texto)
          } else if (esResumen) {
            await importarUberResumen(file, texto)
          } else {
            setLogs([{ archivo: file.name, plataforma: 'Auto', nuevas: 0, duplicadas: 0, actualizadas: 0, errores: ['Formato CSV no reconocido. Verifica que sea un CSV de Uber Eats.'] }])
          }
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

  const importarUberDetalle = async (file: File, texto: string) => {
    const { grupos, errores: ep } = parseUberCSV(texto)
    if (ep.length > 0) { setLogs([{ archivo: file.name, plataforma: 'Uber Eats', nuevas: 0, duplicadas: 0, actualizadas: 0, errores: ep }]); return }
    let nuevas = 0, duplicadas = 0, actualizadas = 0; const errores: string[] = []
    for (const key of Object.keys(grupos)) {
      const g = (grupos as Record<string, any>)[key]
      const { data: existe } = await supabase.from('uber_liquidaciones').select('id').eq('referencia_pago', g.referencia_pago).eq('marca', g.marca).maybeSingle()
      if (existe) {
        duplicadas++
        const det = g.detalle.filter((p: any) => p.pedido_id)
        if (det.length > 0) { await supabase.from('uber_pedidos').upsert(det.map((p: any) => ({ liquidacion_id: existe.id, pedido_id: p.pedido_id, workflow_id: p.workflow_id, marca: g.marca, codigo_establecimiento: g.codigo_establecimiento, fecha_pedido: p.fecha_pedido, hora_pedido: p.hora_pedido || null, modalidad: p.modalidad, canal: p.canal, estado_pedido: p.estado_pedido, ventas_con_iva: p.ventas_con_iva, promociones_con_iva: p.promociones_con_iva, tasa_servicio_con_iva: p.tasa_servicio_con_iva, otros_pagos: p.otros_pagos, pago_total: p.pago_total, fecha_pago: p.fecha_pago, referencia_pago: g.referencia_pago, link_factura_establecimiento: p.link_factura_establecimiento, link_factura_portier: p.link_factura_portier })), { onConflict: 'pedido_id,referencia_pago', ignoreDuplicates: true }); actualizadas++ }
        continue
      }
      const { data: liq, error: el } = await supabase.from('uber_liquidaciones').insert({ plataforma: 'uber', marca: g.marca, codigo_establecimiento: g.codigo_establecimiento, referencia_pago: g.referencia_pago, fecha_deposito: g.fecha_deposito, fecha_inicio_periodo: g.fecha_inicio_periodo, fecha_fin_periodo: g.fecha_fin_periodo, num_pedidos: g.num_pedidos, ventas_bruto: Math.round(g.ventas_bruto * 100) / 100, comision_uber: Math.round(g.comision_uber * 100) / 100, promociones: Math.round(g.promociones * 100) / 100, ads: Math.round(g.ads * 100) / 100, pago_neto: Math.round(g.pago_neto * 100) / 100, estado: 'pendiente' }).select('id').single()
      if (el || !liq) { errores.push(`Error ${g.referencia_pago}: ${el?.message}`); continue }
      const det = g.detalle.filter((p: any) => p.pedido_id)
      if (det.length > 0) await supabase.from('uber_pedidos').upsert(det.map((p: any) => ({ liquidacion_id: liq.id, pedido_id: p.pedido_id, workflow_id: p.workflow_id, marca: g.marca, codigo_establecimiento: g.codigo_establecimiento, fecha_pedido: p.fecha_pedido, hora_pedido: p.hora_pedido || null, modalidad: p.modalidad, canal: p.canal, estado_pedido: p.estado_pedido, ventas_con_iva: p.ventas_con_iva, promociones_con_iva: p.promociones_con_iva, tasa_servicio_con_iva: p.tasa_servicio_con_iva, otros_pagos: p.otros_pagos, pago_total: p.pago_total, fecha_pago: p.fecha_pago, referencia_pago: g.referencia_pago, link_factura_establecimiento: p.link_factura_establecimiento, link_factura_portier: p.link_factura_portier })), { onConflict: 'pedido_id,referencia_pago', ignoreDuplicates: true })
      await autoconciliar('uber_liquidaciones', liq.id, g.pago_neto, g.fecha_deposito, 5)
      nuevas++
    }
    setLogs([{ archivo: file.name, plataforma: 'Uber Eats (detalle)', nuevas, duplicadas, actualizadas, errores }])
  }

  const importarUberResumen = async (file: File, texto: string) => {
    const { items, errores: ep } = parseUberResumenCSV(texto)
    if (ep.length > 0 || items.length === 0) { setLogs([{ archivo: file.name, plataforma: 'Uber Eats (resumen)', nuevas: 0, duplicadas: 0, actualizadas: 0, errores: ep.length ? ep : ['Sin datos en el resumen'] }]); return }
    let nuevas = 0, duplicadas = 0, actualizadas = 0; const errores: string[] = []
    for (const item of items) {
      const { data: existe } = await supabase.from('uber_liquidaciones').select('id,pago_neto').eq('referencia_pago', item.referencia_pago).eq('marca', item.marca).maybeSingle()
      const payload: any = { pago_neto: item.pago_neto }
      if (item.fecha_deposito) payload.fecha_deposito = item.fecha_deposito
      if (item.ventas_bruto) payload.ventas_bruto = item.ventas_bruto
      if (item.comision_uber) payload.comision_uber = item.comision_uber
      if (item.promociones) payload.promociones = item.promociones
      if (item.codigo_establecimiento) payload.codigo_establecimiento = item.codigo_establecimiento
      if (item.num_pedidos) payload.num_pedidos = item.num_pedidos
      if (existe) {
        if (Math.abs(Number(existe.pago_neto) - item.pago_neto) > 0.01) {
          await supabase.from('uber_liquidaciones').update(payload).eq('id', existe.id)
          actualizadas++
        } else { duplicadas++ }
        continue
      }
      const { data: liq, error: el } = await supabase.from('uber_liquidaciones').insert({ plataforma: 'uber', marca: item.marca, referencia_pago: item.referencia_pago, fecha_deposito: item.fecha_deposito || new Date().toISOString().slice(0,10), pago_neto: item.pago_neto, ventas_bruto: item.ventas_bruto || 0, comision_uber: item.comision_uber || 0, promociones: item.promociones || 0, codigo_establecimiento: item.codigo_establecimiento || '', num_pedidos: item.num_pedidos || 0, estado: 'pendiente' }).select('id').single()
      if (el || !liq) { errores.push(`Error ${item.referencia_pago}: ${el?.message}`); continue }
      if (item.fecha_deposito) await autoconciliar('uber_liquidaciones', liq.id, item.pago_neto, item.fecha_deposito, 5)
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

  const cardStyle = (filtro: FiltroCard, isActive: boolean): React.CSSProperties => ({
    background: '#fff', border: isActive ? '1px solid #FF4757' : '0.5px solid #d0c8bc',
    borderRadius: 14, padding: '18px 20px', cursor: 'pointer',
    boxShadow: isActive ? '0 0 0 3px #FF475715' : 'none', transition: 'border-color 0.15s, box-shadow 0.15s'
  })

  const PLAT_COLOR: Record<string, string> = { uber: '#06C167', glovo: '#FFC244', just_eat: '#f5a623' }
  const PLAT_LABEL: Record<string, string> = { uber: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat' }
  const PLATS = [{ id: 'todas', label: 'Todas' }, { id: 'uber', label: 'Uber Eats' }, { id: 'glovo', label: 'Glovo' }, { id: 'just_eat', label: 'Just Eat' }]

  const HEADERS: { label: string; col: SortCol; align: 'left' | 'right' | 'center' }[] = [
    { label: 'Fecha', col: 'fecha', align: 'left' },
    { label: 'Marca', col: 'marca', align: 'left' },
    { label: 'Plataforma', col: 'plataforma', align: 'left' },
    { label: 'Periodo', col: 'fecha', align: 'left' },
    { label: 'Bruto', col: 'bruto', align: 'right' },
    { label: 'Comisión', col: 'comision', align: 'right' },
    { label: 'Neto', col: 'neto', align: 'right' },
    { label: 'Estado', col: 'estado', align: 'left' },
    { label: 'Titular', col: 'titular', align: 'left' },
  ]

  const desde = (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, filasFiltradas.length)
  const isFirst = page === 1, isLastPage = page === totalPages
  const btnBase: React.CSSProperties = { background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 8, padding: '6px 12px', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', cursor: 'pointer' }
  const btnDis: React.CSSProperties = { ...btnBase, opacity: 0.35, cursor: 'default' }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        <div onClick={() => onFiltroCard(null)} style={cardStyle(null, filtroCard === null)}>
          <div style={{ marginBottom: 8 }}><span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Total ventas</span></div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#111' }}>{agregados.totalCount}</div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4 }}>{fmtNumES(agregados.totalNeto, 2)}</div>
        </div>
        <div onClick={() => onFiltroCard('conciliadas')} style={cardStyle('conciliadas', filtroCard === 'conciliadas')}>
          <div style={{ marginBottom: 8 }}><span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Conciliadas</span></div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#1D9E75' }}>{agregados.conciliadasCount}</div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4 }}>{agregados.conciliadasPct}% · {fmtNumES(agregados.conciliadasNeto, 2)}</div>
        </div>
        <div onClick={() => onFiltroCard('pendientes')} style={cardStyle('pendientes', filtroCard === 'pendientes')}>
          <div style={{ marginBottom: 8 }}><span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase' }}>Pendientes</span></div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: '#F26B1F' }}>{agregados.pendientesCount}</div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#7a8090', marginTop: 4 }}>Sin match · {fmtNumES(agregados.pendientesNeto, 2)}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input ref={uberRef} type="file" accept=".csv,.pdf,.html,.htm,.doc,.txt" style={{ display: 'none' }} onChange={handleFile('auto')} />
          <div onClick={() => !subiendo && uberRef.current?.click()}
            style={{ background: subiendo ? '#888' : '#B01D23', borderRadius: 10, padding: '10px 14px', cursor: subiendo ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, flex: 1, justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff' }}>{subiendo ? 'Importando…' : 'Subir liquidación'}</span>
          </div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: '#7a8090', textAlign: 'center' }}>CSV Uber · PDF Glovo · DOC Just Eat</div>
        </div>
      </div>

      {logs.map((log, i) => (
        <div key={i} style={{ background: log.errores.length > 0 ? '#fff5f5' : '#f0faf5', border: `0.5px solid ${log.errores.length > 0 ? '#B01D23' : '#1D9E75'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: log.errores.length > 0 ? '#B01D23' : '#1D9E75', marginBottom: 3 }}>{log.plataforma} · {log.archivo}</div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#3a4050' }}>{log.nuevas} nuevos · {log.duplicadas} duplicados · {log.actualizadas} actualizados</div>
          {log.errores.map((e, j) => <div key={j} style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#B01D23', marginTop: 2 }}>{e}</div>)}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); updateUrl({ page: 1 }) }} placeholder="Buscar marca o referencia…" style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
          {busqueda && <button onClick={() => { setBusqueda(''); updateUrl({ page: 1 }) }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: '#f5f3ef', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 14, color: '#7a8090', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>}
        </div>
        {PLATS.map(p => (
          <button key={p.id} onClick={() => { setFiltroPlataforma(p.id); updateUrl({ page: 1 }) }}
            style={{ padding: '10px 14px', borderRadius: 10, border: `0.5px solid ${filtroPlataforma === p.id ? '#B01D23' : '#d0c8bc'}`, background: filtroPlataforma === p.id ? '#B01D2312' : '#fff', color: filtroPlataforma === p.id ? '#B01D23' : '#3a4050', fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer', fontWeight: filtroPlataforma === p.id ? 600 : 400 }}>
            {p.label}
          </button>
        ))}
        {marcas.length > 1 && (
          <select value={filtroMarca} onChange={e => { setFiltroMarca(e.target.value); updateUrl({ page: 1 }) }} style={{ padding: '10px 14px', borderRadius: 10, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#111', cursor: 'pointer' }}>
            <option value="todas">Todas las marcas</option>
            {marcas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>Cargando…</div>
        ) : filasPagina.length === 0 ? (
          <div style={{ padding: '48px 28px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: '#7a8090', letterSpacing: 1, marginBottom: 8 }}>Sin datos</div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>Sube una liquidación para empezar</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', minWidth: 960, fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
              <colgroup>
                <col style={{ width: 90 }} /><col /><col style={{ width: 110 }} /><col style={{ width: 160 }} />
                <col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} />
                <col style={{ width: 120 }} /><col style={{ width: 90 }} />
              </colgroup>
              <thead>
                <tr>
                  {HEADERS.map((h, hi) => {
                    const isActive = ventaSorts.some(s => s.col === h.col) && !(h.label === 'Periodo' && hi === 3)
                    const clickable = h.label !== 'Periodo'
                    return (
                      <th key={h.label + hi} onClick={() => clickable && handleSort(h.col)}
                        style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', color: isActive && clickable ? '#FF4757' : '#7a8090', textTransform: 'uppercase', textAlign: h.align, padding: '10px 16px', background: '#f5f3ef', borderBottom: '0.5px solid #d0c8bc', whiteSpace: 'nowrap', cursor: clickable ? 'pointer' : 'default', userSelect: 'none' }}>
                        {h.label}{clickable ? sortInd(h.col) : ''}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filasPagina.map((f, idx) => {
                  const isLast = idx === filasPagina.length - 1
                  const tdBase: React.CSSProperties = { padding: '8px 16px', borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2', verticalAlign: 'middle', lineHeight: 1.4 }
                  const color = PLAT_COLOR[f.plataforma] || '#888'
                  const titNombre = titulares.find(t => t.id === f.titular_id)?.nombre?.toLowerCase() || ''
                  const isRuben = titNombre.includes('rubén') || titNombre.includes('ruben')
                  const isEmilio = titNombre.includes('emilio')
                  return (
                    <tr key={f.id} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f5f3ef60'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                      <td style={{ ...tdBase, color: '#7a8090', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(f.fecha_deposito)}</td>
                      <td style={{ ...tdBase, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.marca}</td>
                      <td style={tdBase}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: color + '22', color, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase' }}>{PLAT_LABEL[f.plataforma]}</span></td>
                      <td style={{ ...tdBase, color: '#7a8090', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.fecha_inicio_periodo && f.fecha_fin_periodo ? `${fmtDate(f.fecha_inicio_periodo)} → ${fmtDate(f.fecha_fin_periodo)}` : '—'}</td>
                      <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 500, color: '#111', whiteSpace: 'nowrap' }}>{fmtNumES(f.ventas_bruto, 2)}</td>
                      <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 500, color: '#E24B4A', whiteSpace: 'nowrap' }}>{fmtNumES(f.comision, 2)}</td>
                      <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 500, color: '#1D9E75', whiteSpace: 'nowrap' }}>{fmtNumES(f.pago_neto, 2)}</td>
                      <td style={tdBase}>{f.estado === 'conciliada' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', fontWeight: 500, textTransform: 'uppercase', background: '#1D9E7515', color: '#0F6E56' }}>Conciliada</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', fontWeight: 500, textTransform: 'uppercase', background: '#F26B1F15', color: '#F26B1F' }}>Pendiente</span>}</td>
                      <td style={tdBase}>{isRuben ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#F26B1F15', color: '#F26B1F', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F26B1F', flexShrink: 0 }} />Rubén</span> : isEmilio ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#1E5BCC15', color: '#1E5BCC', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1E5BCC', flexShrink: 0 }} />Emilio</span> : <span style={{ color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 12 }}>—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {filasFiltradas.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#fafaf7', borderTop: '0.5px solid #d0c8bc' }}>
            <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090' }}>{`Mostrando ${desde.toLocaleString('es-ES')}–${hasta.toLocaleString('es-ES')} de ${filasFiltradas.length.toLocaleString('es-ES')} liquidaciones`}</span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, color: '#7a8090', textTransform: 'uppercase' }}>Filas:</label>
                <select value={pageSize} onChange={e => updateUrl({ page: 1, size: Number(e.target.value) as PageSize })} style={{ padding: '6px 10px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: '#fff', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>{PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                <button style={isFirst ? btnDis : btnBase} disabled={isFirst} onClick={() => !isFirst && updateUrl({ page: 1 })}>Primera</button>
                <button style={isFirst ? btnDis : btnBase} disabled={isFirst} onClick={() => !isFirst && updateUrl({ page: page - 1 })}>‹ Anterior</button>
                <span style={{ ...btnBase, cursor: 'default' }}>{`Página ${page} de ${totalPages}`}</span>
                <button style={isLastPage ? btnDis : btnBase} disabled={isLastPage} onClick={() => !isLastPage && updateUrl({ page: page + 1 })}>Siguiente ›</button>
                <button style={isLastPage ? btnDis : btnBase} disabled={isLastPage} onClick={() => !isLastPage && updateUrl({ page: totalPages })}>Última</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
