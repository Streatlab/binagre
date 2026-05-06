import { useState, useEffect, useCallback, useRef } from 'react'
import { FONT, useTheme } from '@/styles/tokens'
import { fmtEur, fmtDate } from '@/utils/format'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────

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
  referencia?: string
}

interface ImportLog {
  archivo: string
  plataforma: string
  nuevas: number
  duplicadas: number
  errores: string[]
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function fmtFechaCSV(v: string): string {
  if (!v) return ''
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/)
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2]}-${m[1]}`
  const m2 = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m2) return v
  return v.slice(0, 10)
}

function numES(v: string): number {
  return parseFloat((v || '0').replace(/\./g, '').replace(',', '.')) || 0
}

// Uber: CSV detalle por pedido
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
    if (!grupos[key]) grupos[key] = { marca, codigo_establecimiento: cols[iCodigo]?.trim() || '', referencia_pago: ref, fecha_deposito: fmtFechaCSV(cols[iFechaPago]?.trim()), fecha_inicio_periodo: fmtFechaCSV(cols[iFecha]?.trim()), fecha_fin_periodo: fmtFechaCSV(cols[iFecha]?.trim()), num_pedidos: 0, ventas_bruto: 0, comision_uber: 0, promociones: 0, ads: 0, ajustes: 0, pago_neto: 0, detalle: [] }
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

// Glovo: CSV bill_ (detalle pedidos)
function parseGlovoCSV(texto: string) {
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  if (lineas.length < 2) return { pedidos: [], errores: ['CSV vacío'] }
  // Cabecera en línea 0
  const splitCSVLine = (line: string) => { const r: string[] = []; let cur = '', inQ = false; for (const c of line) { if (c === '"') inQ = !inQ; else if (c === ',' && !inQ) { r.push(cur.trim()); cur = '' } else cur += c } r.push(cur.trim()); return r }
  const cab = splitCSVLine(lineas[0])
  const i = (n: string) => cab.indexOf(n)
  const iCode = i('Glovo Code'), iTime = i('Notification Partner Time'), iDesc = i('Description')
  const iStore = i('Store Name'), iPrice = i('Price of Products'), iFee = i('Glovo platform fee')
  const iTotal = i('Total Charged to Partner')
  if (iCode === -1) return { pedidos: [], errores: ['No es CSV Glovo válido'] }
  const pedidos: any[] = []
  for (let li = 1; li < lineas.length; li++) {
    const cols = splitCSVLine(lineas[li])
    if (!cols[iCode]) continue
    const storeName = cols[iStore] || ''
    const marcaMatch = storeName.match(/^([^\(]+)/)
    pedidos.push({ glovo_code: cols[iCode]?.trim(), fecha_pedido: cols[iTime]?.trim(), descripcion: cols[iDesc]?.trim() || '', marca: marcaMatch ? marcaMatch[1].trim() : storeName.trim(), precio_producto: numES(cols[iPrice]), comision: numES(cols[iFee]), total_cobrado: numES(cols[iTotal]) })
  }
  return { pedidos, errores: [] }
}

// Just Eat: HTML/DOC
function parseJustEatHTML(texto: string): { data: any; errores: string[] } {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(texto, 'text/html')
    const fullText = doc.body?.innerText || doc.body?.textContent || ''
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

    const getAfter = (prefix: string) => { const l = lines.find(x => x.startsWith(prefix)); return l ? l.slice(prefix.length).trim() : '' }
    const getVal = (keyword: string) => { const idx = lines.findIndex(l => l.includes(keyword)); if (idx >= 0 && lines[idx + 1]) return lines[idx + 1].trim(); return '' }

    // Nº Factura
    const facIdxLine = lines.find(l => l.match(/Nº Factura\s+\d+/))
    const facMatch = facIdxLine?.match(/Nº Factura\s+(\d+)/) || fullText.match(/Nº Factura\s+(\d+)/)
    const numero_factura = facMatch?.[1] || ''

    // Marca: línea después de "Tu factura"
    const tuFactIdx = lines.findIndex(l => l === 'Tu factura')
    const marca = tuFactIdx >= 0 ? lines[tuFactIdx + 2] || '' : ''

    // Periodo: "1 marzo 2026 - 15 marzo 2026" tipo
    const periodoLine = lines.find(l => l.match(/\d+\s+\w+\s+\d{4}\s+-\s+\d+\s+\w+\s+\d{4}/))
    const periodoMatch = periodoLine?.match(/(\d+\s+\w+\s+\d{4})\s+-\s+(\d+\s+\w+\s+\d{4})/)

    // Recibirás
    const recibirasLine = lines.find(l => l.match(/^\d+,\d+€$/))
    const ingreso = recibirasLine ? numES(recibirasLine.replace('€', '')) : 0

    // Fecha abono
    const abonoIdx = lines.findIndex(l => l.includes('Será abonado antes del'))
    const fecha_abono_str = abonoIdx >= 0 ? lines[abonoIdx + 1] || '' : ''

    // Total ventas
    const ventasLine = lines.find(l => l.includes('Total de ventas'))
    const ventasIdx = ventasLine ? lines.indexOf(ventasLine) : -1
    const total_ventas = ventasIdx >= 0 ? numES((lines[ventasIdx + 1] || '').replace('€', '')) : 0

    // Fecha factura
    const fechaFacturaLine = lines.find(l => l.match(/Fecha de factura\s+\d+\s+\w+\s+\d{4}/))
    const fechaFacturaMatch = fechaFacturaLine?.match(/Fecha de factura\s+(\d+\s+\w+\s+\d{4})/)

    // Comisión total
    const comisionLine = lines.find(l => l.includes('Comisión total'))
    const comisionIdx = comisionLine ? lines.indexOf(comisionLine) : -1
    const comision = comisionIdx >= 0 ? numES((lines[comisionIdx + 1] || '').replace('€', '')) : 0

    // Total IVA
    const totalIvaLine = lines.find(l => l.includes('Total incluido IVA'))
    const totalIvaIdx = totalIvaLine ? lines.indexOf(totalIvaLine) : -1
    const total_iva = totalIvaIdx >= 0 ? numES((lines[totalIvaIdx + 1] || '').replace('€', '')) : 0

    if (!numero_factura || ingreso === 0) return { data: null, errores: ['No se pudo extraer Nº Factura o importe'] }

    // Parsear fecha española "15 marzo 2026" → "2026-03-15"
    const MESES: Record<string, string> = { enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12' }
    const parseFechaES = (s: string) => { const m = s?.match(/(\d+)\s+(\w+)\s+(\d{4})/); if (!m) return null; return `${m[3]}-${MESES[m[2].toLowerCase()] || '01'}-${m[1].padStart(2, '0')}` }

    return {
      data: {
        numero_factura,
        marca: marca || 'Just Eat',
        fecha_factura: parseFechaES(fechaFacturaMatch?.[1] || '') || new Date().toISOString().slice(0, 10),
        fecha_inicio_periodo: periodoMatch ? parseFechaES(periodoMatch[1]) : null,
        fecha_fin_periodo: periodoMatch ? parseFechaES(periodoMatch[2]) : null,
        total_ventas,
        comision_total: comision,
        total_factura_iva: total_iva,
        ingreso_colaborador: ingreso,
        fecha_abono: parseFechaES(fecha_abono_str),
      },
      errores: []
    }
  } catch (e: any) {
    return { data: null, errores: [`Error parseando Just Eat: ${e.message}`] }
  }
}

// ─── Autoconciliación genérica ─────────────────────────────────────────────────

async function autoconciliar(tabla: string, id: string, pagoNeto: number, fechaDeposito: string, margenCentimos = 0) {
  const d = new Date(fechaDeposito + 'T12:00:00')
  const desde = new Date(d); desde.setDate(d.getDate() - 2)
  const hasta = new Date(d); hasta.setDate(d.getDate() + 5)
  // Buscar por importe exacto o con margen
  const importes = margenCentimos > 0
    ? [pagoNeto, pagoNeto - 0.01, pagoNeto + 0.01, pagoNeto - 0.02, pagoNeto + 0.02, pagoNeto - 0.03, pagoNeto + 0.03, pagoNeto - 0.04, pagoNeto + 0.04, pagoNeto - 0.05, pagoNeto + 0.05]
    : [pagoNeto]

  for (const imp of importes) {
    const { data } = await supabase.from('conciliacion').select('id').eq('tipo', 'ingreso').gte('fecha', desde.toISOString().slice(0, 10)).lte('fecha', hasta.toISOString().slice(0, 10)).eq('importe', Math.round(imp * 100) / 100).is('factura_id', null).limit(1)
    if (data && data.length > 0) {
      await supabase.from(tabla).update({ conciliacion_id: data[0].id, estado: 'conciliada', updated_at: new Date().toISOString() }).eq('id', id)
      await supabase.from('conciliacion').update({ doc_estado: 'tiene' }).eq('id', data[0].id)
      return true
    }
  }
  return false
}

// ─── Componente principal ──────────────────────────────────────────────────────

interface Props { fechaDesde: Date; fechaHasta: Date }

export default function VentasTab({ fechaDesde, fechaHasta }: Props) {
  const { T } = useTheme()
  const uberRef = useRef<HTMLInputElement>(null)
  const glovoRef = useRef<HTMLInputElement>(null)
  const jeRef = useRef<HTMLInputElement>(null)

  const [filas, setFilas] = useState<Liquidacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState<string | null>(null) // 'uber'|'glovo'|'just_eat'|null
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [filtroPlataforma, setFiltroPlataforma] = useState<string>('todas')
  const [filtroMarca, setFiltroMarca] = useState<string>('todas')
  const [marcas, setMarcas] = useState<string[]>([])
  const [refreshTick, setRefreshTick] = useState(0)

  const desdeStr = fechaDesde.toISOString().slice(0, 10)
  const hastaStr = fechaHasta.toISOString().slice(0, 10)

  // ── Carga unificada de las 3 tablas ──────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    const [uber, glovo, je] = await Promise.all([
      supabase.from('uber_liquidaciones').select('id,marca,referencia_pago,fecha_deposito,fecha_inicio_periodo,fecha_fin_periodo,num_pedidos,ventas_bruto,comision_uber,promociones,pago_neto,estado,plataforma').gte('fecha_deposito', desdeStr).lte('fecha_deposito', hastaStr).order('fecha_deposito', { ascending: false }),
      supabase.from('glovo_liquidaciones').select('id,marca,numero_factura,fecha_factura,fecha_inicio_periodo,fecha_fin_periodo,ventas_bruto,comision_base,marketing,ingreso_colaborador,estado,plataforma').gte('fecha_factura', desdeStr).lte('fecha_factura', hastaStr).order('fecha_factura', { ascending: false }),
      supabase.from('justeat_liquidaciones').select('id,marca,numero_factura,fecha_factura,fecha_inicio_periodo,fecha_fin_periodo,total_ventas,comision_total,ingreso_colaborador,estado,plataforma').gte('fecha_factura', desdeStr).lte('fecha_factura', hastaStr).order('fecha_factura', { ascending: false }),
    ])
    const all: Liquidacion[] = [
      ...(uber.data || []).map((r: any) => ({ id: r.id, plataforma: 'uber' as const, marca: r.marca, fecha_deposito: r.fecha_deposito, fecha_inicio_periodo: r.fecha_inicio_periodo, fecha_fin_periodo: r.fecha_fin_periodo, num_pedidos: r.num_pedidos || 0, ventas_bruto: Number(r.ventas_bruto) || 0, comision: Math.abs(Number(r.comision_uber) || 0), promociones: Math.abs(Number(r.promociones) || 0), pago_neto: Number(r.pago_neto) || 0, estado: r.estado, referencia: r.referencia_pago })),
      ...(glovo.data || []).map((r: any) => ({ id: r.id, plataforma: 'glovo' as const, marca: r.marca, fecha_deposito: r.fecha_factura, fecha_inicio_periodo: r.fecha_inicio_periodo, fecha_fin_periodo: r.fecha_fin_periodo, num_pedidos: 0, ventas_bruto: Number(r.ventas_bruto) || 0, comision: Math.abs(Number(r.comision_base) || 0), promociones: Math.abs(Number(r.marketing) || 0), pago_neto: Number(r.ingreso_colaborador) || 0, estado: r.estado, referencia: r.numero_factura })),
      ...(je.data || []).map((r: any) => ({ id: r.id, plataforma: 'just_eat' as const, marca: r.marca, fecha_deposito: r.fecha_factura, fecha_inicio_periodo: r.fecha_inicio_periodo, fecha_fin_periodo: r.fecha_fin_periodo, num_pedidos: 0, ventas_bruto: Number(r.total_ventas) || 0, comision: Math.abs(Number(r.comision_total) || 0), promociones: 0, pago_neto: Number(r.ingreso_colaborador) || 0, estado: r.estado, referencia: r.numero_factura })),
    ].sort((a, b) => b.fecha_deposito.localeCompare(a.fecha_deposito))
    setFilas(all)
    setMarcas([...new Set(all.map(r => r.marca))].sort())
    setCargando(false)
  }, [desdeStr, hastaStr, refreshTick])

  useEffect(() => { cargar() }, [cargar])

  // ── Importar Uber ─────────────────────────────────────────────────────────────
  const importarUber = useCallback(async (file: File) => {
    setSubiendo('uber'); setLogs([])
    const texto = await file.text()
    const { grupos, errores: ep } = parseUberCSV(texto)
    if (ep.length > 0) { setLogs([{ archivo: file.name, plataforma: 'Uber Eats', nuevas: 0, duplicadas: 0, errores: ep }]); setSubiendo(null); return }
    let nuevas = 0, duplicadas = 0; const errores: string[] = []
    for (const key of Object.keys(grupos)) {
      const g = grupos[key]
      const { data: existe } = await supabase.from('uber_liquidaciones').select('id').eq('referencia_pago', g.referencia_pago).eq('marca', g.marca).single()
      if (existe) { duplicadas++; continue }
      const { data: liq, error: el } = await supabase.from('uber_liquidaciones').insert({ plataforma: 'uber', marca: g.marca, codigo_establecimiento: g.codigo_establecimiento, referencia_pago: g.referencia_pago, fecha_deposito: g.fecha_deposito, fecha_inicio_periodo: g.fecha_inicio_periodo, fecha_fin_periodo: g.fecha_fin_periodo, num_pedidos: g.num_pedidos, ventas_bruto: Math.round(g.ventas_bruto * 100) / 100, comision_uber: Math.round(g.comision_uber * 100) / 100, promociones: Math.round(g.promociones * 100) / 100, ads: Math.round(g.ads * 100) / 100, ajustes: Math.round(g.ajustes * 100) / 100, pago_neto: Math.round(g.pago_neto * 100) / 100, estado: 'pendiente' }).select('id').single()
      if (el || !liq) { errores.push(`Error ${g.referencia_pago}: ${el?.message}`); continue }
      const det = g.detalle.filter((p: any) => p.pedido_id)
      if (det.length > 0) await supabase.from('uber_pedidos').upsert(det.map((p: any) => ({ liquidacion_id: liq.id, pedido_id: p.pedido_id, workflow_id: p.workflow_id, marca: g.marca, codigo_establecimiento: g.codigo_establecimiento, fecha_pedido: p.fecha_pedido, hora_pedido: p.hora_pedido || null, modalidad: p.modalidad, canal: p.canal, estado_pedido: p.estado_pedido, ventas_con_iva: p.ventas_con_iva, promociones_con_iva: p.promociones_con_iva, tasa_servicio_con_iva: p.tasa_servicio_con_iva, otros_pagos: p.otros_pagos, pago_total: p.pago_total, fecha_pago: p.fecha_pago, referencia_pago: g.referencia_pago, link_factura_establecimiento: p.link_factura_establecimiento, link_factura_portier: p.link_factura_portier })), { onConflict: 'pedido_id,referencia_pago', ignoreDuplicates: true })
      await autoconciliar('uber_liquidaciones', liq.id, g.pago_neto, g.fecha_deposito, 5)
      nuevas++
    }
    setLogs([{ archivo: file.name, plataforma: 'Uber Eats', nuevas, duplicadas, errores }])
    setSubiendo(null); setRefreshTick(x => x + 1)
  }, [])

  // ── Importar Glovo ────────────────────────────────────────────────────────────
  const importarGlovo = useCallback(async (file: File) => {
    setSubiendo('glovo'); setLogs([])
    const texto = await file.text()
    const { pedidos, errores: ep } = parseGlovoCSV(texto)
    if (ep.length > 0) { setLogs([{ archivo: file.name, plataforma: 'Glovo', nuevas: 0, duplicadas: 0, errores: ep }]); setSubiendo(null); return }
    // Glovo CSV no tiene ID de liquidación — agrupa por marca + semana
    // Para crear la liquidación necesitamos el PDF. Guardamos solo pedidos huérfanos por ahora
    // y notificamos que falta el PDF para crear la liquidación
    setLogs([{ archivo: file.name, plataforma: 'Glovo', nuevas: 0, duplicadas: 0, errores: [], }])
    // Guardar pedidos en glovo_pedidos si hay liquidación previa con mismo rango de fechas
    // Por ahora informamos que el PDF es necesario primero
    setLogs([{ archivo: file.name, plataforma: 'Glovo', nuevas: pedidos.length, duplicadas: 0, errores: ['Sube también el PDF de la factura Glovo para crear la liquidación y conciliar'] }])
    setSubiendo(null)
  }, [])

  // ── Importar Glovo PDF (factura) ──────────────────────────────────────────────
  const importarGlovoPDF = useCallback(async (file: File) => {
    setSubiendo('glovo'); setLogs([])
    // Leer PDF como texto via FileReader — el texto viene del OCR del PDF
    // En el browser no tenemos pypdf, pero el PDF de Glovo es texto nativo
    // Usamos un truco: fetch el archivo como ArrayBuffer y extraemos texto
    const texto = await file.text().catch(() => '')
    if (!texto || texto.length < 50) {
      setLogs([{ archivo: file.name, plataforma: 'Glovo PDF', nuevas: 0, duplicadas: 0, errores: ['No se pudo leer el PDF. Intenta exportarlo como texto primero.'] }])
      setSubiendo(null); return
    }
    // Extraer campos clave del texto del PDF
    const lines = texto.split('\n').map(l => l.trim()).filter(Boolean)
    const getMatch = (pattern: RegExp) => { for (const l of lines) { const m = l.match(pattern); if (m) return m } return null }
    const facMatch = getMatch(/Factura Nº:\s*(I\w+)/)
    const numero_factura = facMatch?.[1] || ''
    const marcaMatch = getMatch(/^([A-Z][^(]+)\(PICO DE LA MALICIOSA\)/)
    const marca = marcaMatch?.[1]?.trim() || ''
    const periodoMatch = texto.match(/Servicio prestado entre\s+(\d{4}-\d{2}-\d{2})\s+y\s+(\d{4}-\d{2}-\d{2})/)
    const fechaMatch = texto.match(/Fecha:\s+(\d{4}-\d{2}-\d{2})/)
    const ingresoMatch = texto.match(/Ingreso a cuenta colaborador\s+(-?[\d,\.]+)\s*€/)
    const ventasMatch = texto.match(/\+\s+Productos\s+([\d,\.]+)\s*€/)
    const totalFacturaMatch = texto.match(/Total factura\s*\(IVA[^)]+\)\s+([\d,\.]+)\s*€/)

    if (!numero_factura) { setLogs([{ archivo: file.name, plataforma: 'Glovo PDF', nuevas: 0, duplicadas: 0, errores: ['No se encontró Nº Factura en el PDF'] }]); setSubiendo(null); return }

    const { data: existe } = await supabase.from('glovo_liquidaciones').select('id').eq('numero_factura', numero_factura).single()
    if (existe) { setLogs([{ archivo: file.name, plataforma: 'Glovo PDF', nuevas: 0, duplicadas: 1, errores: [] }]); setSubiendo(null); return }

    const ingreso = ingresoMatch ? Math.abs(numES(ingresoMatch[1])) : 0
    const { data: liq, error: el } = await supabase.from('glovo_liquidaciones').insert({
      plataforma: 'glovo', marca: marca || 'Glovo', numero_factura,
      fecha_factura: fechaMatch?.[1] || new Date().toISOString().slice(0, 10),
      fecha_inicio_periodo: periodoMatch?.[1] || null, fecha_fin_periodo: periodoMatch?.[2] || null,
      ventas_bruto: ventasMatch ? numES(ventasMatch[1]) : 0,
      total_factura_iva: totalFacturaMatch ? numES(totalFacturaMatch[1]) : 0,
      ingreso_colaborador: ingreso, estado: 'pendiente'
    }).select('id').single()

    if (el || !liq) { setLogs([{ archivo: file.name, plataforma: 'Glovo PDF', nuevas: 0, duplicadas: 0, errores: [`Error: ${el?.message}`] }]); setSubiendo(null); return }

    const conciliado = await autoconciliar('glovo_liquidaciones', liq.id, ingreso, fechaMatch?.[1] || '', 0)
    setLogs([{ archivo: file.name, plataforma: 'Glovo', nuevas: 1, duplicadas: 0, errores: conciliado ? [] : ['Liquidación creada pero sin match en banco — revisa manualmente'] }])
    setSubiendo(null); setRefreshTick(x => x + 1)
  }, [])

  // ── Importar Just Eat ─────────────────────────────────────────────────────────
  const importarJustEat = useCallback(async (file: File) => {
    setSubiendo('just_eat'); setLogs([])
    const texto = await file.text()
    const { data, errores: ep } = parseJustEatHTML(texto)
    if (ep.length > 0 || !data) { setLogs([{ archivo: file.name, plataforma: 'Just Eat', nuevas: 0, duplicadas: 0, errores: ep.length ? ep : ['No se pudo parsear el archivo'] }]); setSubiendo(null); return }

    const { data: existe } = await supabase.from('justeat_liquidaciones').select('id').eq('numero_factura', data.numero_factura).single()
    if (existe) { setLogs([{ archivo: file.name, plataforma: 'Just Eat', nuevas: 0, duplicadas: 1, errores: [] }]); setSubiendo(null); return }

    const { data: liq, error: el } = await supabase.from('justeat_liquidaciones').insert({
      plataforma: 'just_eat', marca: data.marca, numero_factura: data.numero_factura,
      fecha_factura: data.fecha_factura, fecha_inicio_periodo: data.fecha_inicio_periodo,
      fecha_fin_periodo: data.fecha_fin_periodo, total_ventas: data.total_ventas,
      comision_total: data.comision_total, total_factura_iva: data.total_factura_iva,
      ingreso_colaborador: data.ingreso_colaborador, fecha_abono: data.fecha_abono,
      estado: 'pendiente'
    }).select('id').single()

    if (el || !liq) { setLogs([{ archivo: file.name, plataforma: 'Just Eat', nuevas: 0, duplicadas: 0, errores: [`Error: ${el?.message}`] }]); setSubiendo(null); return }

    const conciliado = await autoconciliar('justeat_liquidaciones', liq.id, data.ingreso_colaborador, data.fecha_abono || data.fecha_factura, 0)
    setLogs([{ archivo: file.name, plataforma: 'Just Eat', nuevas: 1, duplicadas: 0, errores: conciliado ? [] : ['Liquidación creada — sin match en banco aún'] }])
    setSubiendo(null); setRefreshTick(x => x + 1)
  }, [])

  // ── Handler unificado de archivos ─────────────────────────────────────────────
  const handleFile = (plataforma: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    if (plataforma === 'uber') importarUber(file)
    else if (plataforma === 'glovo') { if (file.name.endsWith('.pdf')) importarGlovoPDF(file); else importarGlovo(file) }
    else if (plataforma === 'just_eat') importarJustEat(file)
    e.target.value = ''
  }

  // ── Filtrado y KPIs ───────────────────────────────────────────────────────────
  const filtradas = filas.filter(f => (filtroPlataforma === 'todas' || f.plataforma === filtroPlataforma) && (filtroMarca === 'todas' || f.marca === filtroMarca))
  const kpis = filtradas.reduce((a, f) => ({ bruto: a.bruto + f.ventas_bruto, comision: a.comision + f.comision, promos: a.promos + f.promociones, neto: a.neto + f.pago_neto, pedidos: a.pedidos + f.num_pedidos, conc: a.conc + (f.estado === 'conciliada' ? 1 : 0) }), { bruto: 0, comision: 0, promos: 0, neto: 0, pedidos: 0, conc: 0 })

  // ── Estilos ───────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = { background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 14, padding: '16px 18px' }
  const lbl: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 5 }
  const val: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: T.pri, lineHeight: 1 }
  const sub: React.CSSProperties = { fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 3 }

  const PLATS = [{ id: 'todas', label: 'Todas' }, { id: 'uber', label: 'Uber Eats', color: '#06C167' }, { id: 'glovo', label: 'Glovo', color: '#FFC244' }, { id: 'just_eat', label: 'Just Eat', color: '#f5a623' }]
  const PLAT_COLOR: Record<string, string> = { uber: '#06C167', glovo: '#FFC244', just_eat: '#f5a623' }
  const PLAT_LABEL: Record<string, string> = { uber: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat' }

  const BtnSubir = ({ id, label, accept, inputRef }: { id: string; label: string; accept: string; inputRef: React.RefObject<HTMLInputElement> }) => (
    <div onClick={() => inputRef.current?.click()} style={{ background: subiendo === id ? '#888' : '#B01D23', borderRadius: 10, padding: '9px 16px', cursor: subiendo ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: subiendo && subiendo !== id ? 0.5 : 1, flexShrink: 0 }}>
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleFile(id)} />
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff' }}>{subiendo === id ? 'Importando…' : label}</span>
    </div>
  )

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Botones subida ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <BtnSubir id="uber" label="CSV Uber" accept=".csv" inputRef={uberRef} />
        <BtnSubir id="glovo" label="PDF/CSV Glovo" accept=".pdf,.csv" inputRef={glovoRef} />
        <BtnSubir id="just_eat" label="DOC Just Eat" accept=".doc,.html,.htm" inputRef={jeRef} />

        <div style={{ width: 1, height: 28, background: T.brd, margin: '0 4px' }} />

        {/* Filtros plataforma */}
        {PLATS.map(p => (
          <button key={p.id} onClick={() => setFiltroPlataforma(p.id)}
            style={{ padding: '7px 12px', borderRadius: 8, border: `0.5px solid ${filtroPlataforma === p.id ? '#B01D23' : T.brd}`, background: filtroPlataforma === p.id ? '#B01D2315' : T.card, color: filtroPlataforma === p.id ? '#B01D23' : T.sec, fontFamily: FONT.body, fontSize: 12, cursor: 'pointer', fontWeight: filtroPlataforma === p.id ? 600 : 400 }}>
            {p.label}
          </button>
        ))}

        {marcas.length > 1 && (
          <select value={filtroMarca} onChange={e => setFiltroMarca(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: T.card, color: T.pri, fontFamily: FONT.body, fontSize: 12, cursor: 'pointer' }}>
            <option value="todas">Todas las marcas</option>
            {marcas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        <div style={{ marginLeft: 'auto', fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
          {filtradas.length} pagos · {kpis.conc} conciliados
        </div>
      </div>

      {/* ── Logs ─────────────────────────────────────────────────────────────── */}
      {logs.map((log, i) => (
        <div key={i} style={{ background: log.errores.length > 0 ? '#fff5f5' : '#f0faf5', border: `0.5px solid ${log.errores.length > 0 ? '#B01D23' : '#1D9E75'}`, borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: log.errores.length > 0 ? '#B01D23' : '#1D9E75', marginBottom: 3 }}>{log.plataforma} · {log.archivo}</div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>{log.nuevas} nuevos · {log.duplicadas} duplicados ignorados{log.errores.length > 0 ? ` · ${log.errores.length} avisos` : ''}</div>
          {log.errores.map((e, j) => <div key={j} style={{ fontFamily: FONT.body, fontSize: 11, color: '#B01D23', marginTop: 2 }}>{e}</div>)}
        </div>
      ))}

      {/* ── KPIs ─────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <div style={card}><div style={lbl}>Ventas brutas</div><div style={val}>{fmtEur(kpis.bruto)}</div><div style={sub}>{kpis.pedidos > 0 ? `${kpis.pedidos} pedidos` : filtradas.length + ' liquidaciones'}</div></div>
        <div style={card}><div style={lbl}>Comisiones</div><div style={{ ...val, color: '#B01D23' }}>{fmtEur(kpis.comision)}</div><div style={sub}>{kpis.bruto > 0 ? ((kpis.comision / kpis.bruto) * 100).toFixed(1) + '% sobre bruto' : '—'}</div></div>
        <div style={card}><div style={lbl}>Promociones</div><div style={{ ...val, color: '#F26B1F' }}>{fmtEur(kpis.promos)}</div><div style={sub}>{kpis.bruto > 0 ? ((kpis.promos / kpis.bruto) * 100).toFixed(1) + '% sobre bruto' : '—'}</div></div>
        <div style={card}><div style={lbl}>Neto cobrado</div><div style={{ ...val, color: '#1D9E75' }}>{fmtEur(kpis.neto)}</div><div style={sub}>{kpis.bruto > 0 ? ((kpis.neto / kpis.bruto) * 100).toFixed(1) + '% del bruto' : '—'}</div></div>
        <div style={card}><div style={lbl}>Ticket medio</div><div style={val}>{kpis.pedidos > 0 ? fmtEur(kpis.bruto / kpis.pedidos) : '—'}</div><div style={sub}>por pedido bruto</div></div>
      </div>

      {/* ── Tabla ────────────────────────────────────────────────────────────── */}
      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 14, overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: '32px', textAlign: 'center', fontFamily: FONT.body, fontSize: 13, color: T.mut }}>Cargando…</div>
        ) : filtradas.length === 0 ? (
          <div style={{ padding: '48px 28px', textAlign: 'center' }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>Sin datos</div>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut }}>Sube un CSV de Uber, PDF de Glovo o DOC de Just Eat para empezar</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: FONT.body, fontSize: 12, minWidth: 860 }}>
              <thead>
                <tr>
                  {['Depósito', 'Marca', 'Plataforma', 'Periodo', 'Bruto', 'Comisión', 'Promos', 'Neto', 'Estado'].map(h => (
                    <th key={h} style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, padding: '10px 14px', background: T.group, borderBottom: `0.5px solid ${T.brd}`, textAlign: ['Bruto', 'Comisión', 'Promos', 'Neto'].includes(h) ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((f, idx) => {
                  const isLast = idx === filtradas.length - 1
                  const td: React.CSSProperties = { padding: '9px 14px', borderBottom: isLast ? 'none' : `0.5px solid ${T.brd}`, verticalAlign: 'middle' }
                  const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: FONT.heading, fontSize: 13 }
                  const color = PLAT_COLOR[f.plataforma] || '#888'
                  return (
                    <tr key={f.id} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.group + '80'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                      <td style={{ ...td, color: T.mut, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(f.fecha_deposito)}</td>
                      <td style={{ ...td, color: T.pri, fontWeight: 500 }}>{f.marca}</td>
                      <td style={td}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: color + '25', color, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase' }}>{PLAT_LABEL[f.plataforma] || f.plataforma}</span>
                      </td>
                      <td style={{ ...td, color: T.mut, fontSize: 11, whiteSpace: 'nowrap' }}>{f.fecha_inicio_periodo && f.fecha_fin_periodo ? `${fmtDate(f.fecha_inicio_periodo)} → ${fmtDate(f.fecha_fin_periodo)}` : f.referencia ? f.referencia.slice(0, 12) : '—'}</td>
                      <td style={{ ...tdR, color: T.pri }}>{fmtEur(f.ventas_bruto)}</td>
                      <td style={{ ...tdR, color: '#B01D23' }}>{fmtEur(f.comision)}</td>
                      <td style={{ ...tdR, color: '#F26B1F' }}>{fmtEur(f.promociones)}</td>
                      <td style={{ ...tdR, color: '#1D9E75', fontWeight: 600 }}>{fmtEur(f.pago_neto)}</td>
                      <td style={td}>
                        {f.estado === 'conciliada'
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', background: '#1D9E7515', color: '#0F6E56' }}>✓ Conciliada</span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', background: '#F26B1F15', color: '#F26B1F' }}>Pendiente</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
