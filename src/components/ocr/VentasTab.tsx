import { useState, useEffect, useCallback, useRef } from 'react'
import { FONT, useTheme } from '@/styles/tokens'
import { fmtEur, fmtDate } from '@/utils/format'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface UberLiquidacion {
  id: string
  marca: string
  referencia_pago: string
  fecha_deposito: string
  fecha_inicio_periodo: string | null
  fecha_fin_periodo: string | null
  num_pedidos: number
  ventas_bruto: number
  comision_uber: number
  promociones: number
  ads: number
  ajustes: number
  pago_neto: number
  estado: string
  plataforma: string
}

interface ImportLog {
  archivo: string
  nuevas: number
  duplicadas: number
  errores: string[]
}

// ─── Parser CSV Uber (CSV de detalle por pedido) ───────────────────────────────

function parseCsvUberDetalle(texto: string): {
  pedidos: Record<string, {
    marca: string
    codigo_establecimiento: string
    referencia_pago: string
    fecha_deposito: string
    fecha_inicio_periodo: string
    fecha_fin_periodo: string
    num_pedidos: number
    ventas_bruto: number
    comision_uber: number
    promociones: number
    ads: number
    ajustes: number
    pago_neto: number
    detalle: Array<{
      pedido_id: string
      workflow_id: string
      fecha_pedido: string
      hora_pedido: string
      modalidad: string
      canal: string
      estado_pedido: string
      ventas_con_iva: number
      promociones_con_iva: number
      tasa_servicio_con_iva: number
      otros_pagos: number
      pago_total: number
      fecha_pago: string
      link_factura_establecimiento: string
      link_factura_portier: string
    }>
  }>
  errores: string[]
} {
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  // Las primeras 2 líneas son cabeceras descriptivas + nombres cortos
  if (lineas.length < 3) return { pedidos: {}, errores: ['CSV vacío o formato incorrecto'] }

  // Línea 2 (índice 1) = nombres cortos de columnas
  const cabecera = lineas[1].split(',')
  const idx = (nombre: string) => cabecera.indexOf(nombre)

  // Índices de columnas clave
  const iId = idx('Id. del pedido')
  const iWorkflow = idx('Id. del flujo de trabajo')
  const iMarca = idx('Nombre de la tienda')
  const iCodigo = idx('Código del establecimiento')
  const iFecha = idx('Fecha del pedido')
  const iHora = idx('Hora a la que se aceptó el pedido')
  const iModalidad = idx('Modalidad de consumo')
  const iCanal = idx('Canal de pedidos')
  const iEstado = idx('Estado del pedido')
  const iVentas = idx('Ventas (con IVA)')
  const iPromos = idx('Promociones en artículos (con IVA)')
  const iTasa = idx('Tasa de servicio después del descuento (con IVA)')
  const iOtros = idx('Otros pagos (con IVA)')
  const iPago = idx('Pago total ')
  const iFechaPago = idx('Fecha de pago')
  const iRefPago = idx('Id. de referencia de ganancias')
  const iLinkEst = idx('Enlace de la factura del establecimiento al cliente')
  const iLinkPortier = idx('Enlace de Uber a la factura del establecimiento')

  if (iId === -1 || iPago === -1 || iRefPago === -1) {
    return { pedidos: {}, errores: ['No es un CSV de detalle Uber válido. Columnas esperadas no encontradas.'] }
  }

  const n = (v: string) => parseFloat(v?.replace(',', '.') || '0') || 0
  const fmtFecha = (v: string) => {
    if (!v) return ''
    // formato dd/mm/yy → yyyy-mm-dd
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/)
    if (m) {
      const anio = m[3].length === 2 ? `20${m[3]}` : m[3]
      return `${anio}-${m[2]}-${m[1]}`
    }
    return v
  }

  const grupos: Record<string, any> = {}
  const errores: string[] = []

  // Datos empiezan en línea 3 (índice 2)
  for (let i = 2; i < lineas.length; i++) {
    // Split respetando comillas
    const cols = lineas[i].split(',')
    if (cols.length < 10) continue

    const ref = cols[iRefPago]?.trim()
    const pedidoId = cols[iId]?.trim()
    const marca = cols[iMarca]?.trim()
    if (!ref || !marca) continue

    const key = `${ref}__${marca}`
    if (!grupos[key]) {
      grupos[key] = {
        marca,
        codigo_establecimiento: cols[iCodigo]?.trim() || '',
        referencia_pago: ref,
        fecha_deposito: fmtFecha(cols[iFechaPago]?.trim()),
        fecha_inicio_periodo: fmtFecha(cols[iFecha]?.trim()),
        fecha_fin_periodo: fmtFecha(cols[iFecha]?.trim()),
        num_pedidos: 0,
        ventas_bruto: 0,
        comision_uber: 0,
        promociones: 0,
        ads: 0,
        ajustes: 0,
        pago_neto: 0,
        detalle: [],
      }
    }

    const g = grupos[key]
    const fechaPedido = fmtFecha(cols[iFecha]?.trim())
    const pagoTotal = n(cols[iPago])
    const ventasIva = n(cols[iVentas])
    const promosIva = n(cols[iPromos])
    const tasaIva = n(cols[iTasa])
    const otrosPagos = n(cols[iOtros])

    // Actualizar rango fechas
    if (fechaPedido && fechaPedido < g.fecha_inicio_periodo) g.fecha_inicio_periodo = fechaPedido
    if (fechaPedido && fechaPedido > g.fecha_fin_periodo) g.fecha_fin_periodo = fechaPedido

    // Solo contar pedidos reales (no reembolsos/ajustes sin ID)
    if (pedidoId && pagoTotal !== 0) {
      g.num_pedidos++
      g.ventas_bruto += ventasIva
      g.comision_uber += tasaIva
      g.promociones += promosIva
      g.ads += otrosPagos
      g.pago_neto += pagoTotal
    }

    g.detalle.push({
      pedido_id: pedidoId || '',
      workflow_id: cols[iWorkflow]?.trim() || '',
      fecha_pedido: fechaPedido,
      hora_pedido: cols[iHora]?.trim() || '',
      modalidad: cols[iModalidad]?.trim() || '',
      canal: cols[iCanal]?.trim() || '',
      estado_pedido: cols[iEstado]?.trim() || '',
      ventas_con_iva: ventasIva,
      promociones_con_iva: promosIva,
      tasa_servicio_con_iva: tasaIva,
      otros_pagos: otrosPagos,
      pago_total: pagoTotal,
      fecha_pago: fmtFecha(cols[iFechaPago]?.trim()),
      link_factura_establecimiento: cols[iLinkEst]?.trim() || '',
      link_factura_portier: cols[iLinkPortier]?.trim() || '',
    })
  }

  return { pedidos: grupos, errores }
}

// ─── Componente principal ──────────────────────────────────────────────────────

interface Props {
  fechaDesde: Date
  fechaHasta: Date
}

export default function VentasTab({ fechaDesde, fechaHasta }: Props) {
  const { T } = useTheme()
  const inputRef = useRef<HTMLInputElement>(null)
  const [filas, setFilas] = useState<UberLiquidacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [log, setLog] = useState<ImportLog | null>(null)
  const [filtroPlataforma, setFiltroPlataforma] = useState<string>('todas')
  const [filtroMarca, setFiltroMarca] = useState<string>('todas')
  const [marcas, setMarcas] = useState<string[]>([])
  const [refreshTick, setRefreshTick] = useState(0)

  const desdeStr = fechaDesde.toISOString().slice(0, 10)
  const hastaStr = fechaHasta.toISOString().slice(0, 10)

  // ── Carga datos ─────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('uber_liquidaciones')
      .select('*')
      .gte('fecha_deposito', desdeStr)
      .lte('fecha_deposito', hastaStr)
      .order('fecha_deposito', { ascending: false })
    if (!error && data) {
      setFilas(data as UberLiquidacion[])
      const ms = [...new Set(data.map((r: any) => r.marca as string))].sort()
      setMarcas(ms)
    }
    setCargando(false)
  }, [desdeStr, hastaStr, refreshTick])

  useEffect(() => { cargar() }, [cargar])

  // ── Autoconciliar: busca ingreso banco con mismo importe ─────────────────────
  const autoconciliar = useCallback(async (liqId: string, pagoNeto: number, fechaDeposito: string) => {
    // Ventana ±3 días del depósito
    const d = new Date(fechaDeposito)
    const desde = new Date(d); desde.setDate(d.getDate() - 1)
    const hasta = new Date(d); hasta.setDate(d.getDate() + 3)

    const { data } = await supabase
      .from('conciliacion')
      .select('id, importe, fecha')
      .eq('tipo', 'ingreso')
      .gte('fecha', desde.toISOString().slice(0, 10))
      .lte('fecha', hasta.toISOString().slice(0, 10))
      .eq('importe', pagoNeto)
      .is('factura_id', null)
      .limit(1)

    if (data && data.length > 0) {
      const mov = data[0]
      await supabase.from('uber_liquidaciones').update({
        conciliacion_id: mov.id,
        estado: 'conciliada',
        updated_at: new Date().toISOString(),
      }).eq('id', liqId)
      // Marcar movimiento banco como tiene doc
      await supabase.from('conciliacion').update({ doc_estado: 'tiene' }).eq('id', mov.id)
      return true
    }
    return false
  }, [])

  // ── Subida e importación CSV ─────────────────────────────────────────────────
  const procesarCsv = useCallback(async (file: File) => {
    setSubiendo(true)
    setLog(null)
    const texto = await file.text()
    const { pedidos, errores: errParse } = parseCsvUberDetalle(texto)

    if (errParse.length > 0) {
      setLog({ archivo: file.name, nuevas: 0, duplicadas: 0, errores: errParse })
      setSubiendo(false)
      return
    }

    let nuevas = 0, duplicadas = 0
    const errores: string[] = []

    for (const key of Object.keys(pedidos)) {
      const g = pedidos[key]
      if (!g.referencia_pago || !g.marca) continue

      // Antiduplicados: comprobar si ya existe
      const { data: existe } = await supabase
        .from('uber_liquidaciones')
        .select('id, pago_neto, estado')
        .eq('referencia_pago', g.referencia_pago)
        .eq('marca', g.marca)
        .single()

      if (existe) {
        duplicadas++
        continue
      }

      // Insertar liquidación
      const { data: liq, error: errLiq } = await supabase
        .from('uber_liquidaciones')
        .insert({
          plataforma: 'uber',
          marca: g.marca,
          codigo_establecimiento: g.codigo_establecimiento,
          referencia_pago: g.referencia_pago,
          fecha_deposito: g.fecha_deposito,
          fecha_inicio_periodo: g.fecha_inicio_periodo,
          fecha_fin_periodo: g.fecha_fin_periodo,
          num_pedidos: g.num_pedidos,
          ventas_bruto: Math.round(g.ventas_bruto * 100) / 100,
          comision_uber: Math.round(g.comision_uber * 100) / 100,
          promociones: Math.round(g.promociones * 100) / 100,
          ads: Math.round(g.ads * 100) / 100,
          ajustes: Math.round(g.ajustes * 100) / 100,
          pago_neto: Math.round(g.pago_neto * 100) / 100,
          estado: 'pendiente',
        })
        .select('id')
        .single()

      if (errLiq || !liq) {
        errores.push(`Error en ${g.referencia_pago}: ${errLiq?.message}`)
        continue
      }

      // Insertar pedidos detalle (antiduplicados por pedido_id + referencia)
      const pedidosDetalle = g.detalle.filter((p: any) => p.pedido_id)
      if (pedidosDetalle.length > 0) {
        await supabase.from('uber_pedidos').upsert(
          pedidosDetalle.map((p: any) => ({
            liquidacion_id: liq.id,
            pedido_id: p.pedido_id,
            workflow_id: p.workflow_id,
            marca: g.marca,
            codigo_establecimiento: g.codigo_establecimiento,
            fecha_pedido: p.fecha_pedido,
            hora_pedido: p.hora_pedido || null,
            modalidad: p.modalidad,
            canal: p.canal,
            estado_pedido: p.estado_pedido,
            ventas_con_iva: p.ventas_con_iva,
            promociones_con_iva: p.promociones_con_iva,
            tasa_servicio_con_iva: p.tasa_servicio_con_iva,
            otros_pagos: p.otros_pagos,
            pago_total: p.pago_total,
            fecha_pago: p.fecha_pago,
            referencia_pago: g.referencia_pago,
            link_factura_establecimiento: p.link_factura_establecimiento,
            link_factura_portier: p.link_factura_portier,
          })),
          { onConflict: 'pedido_id,referencia_pago', ignoreDuplicates: true }
        )
      }

      // Intentar autoconciliar
      await autoconciliar(liq.id, g.pago_neto, g.fecha_deposito)
      nuevas++
    }

    setLog({ archivo: file.name, nuevas, duplicadas, errores })
    setSubiendo(false)
    setRefreshTick(x => x + 1)
  }, [autoconciliar])

  const handleArchivo = (files: FileList | null) => {
    if (!files) return
    const csv = Array.from(files).find(f => f.name.endsWith('.csv'))
    if (csv) procesarCsv(csv)
  }

  // ── Filtrado ─────────────────────────────────────────────────────────────────
  const filasFiltradas = filas.filter(f => {
    if (filtroPlataforma !== 'todas' && f.plataforma !== filtroPlataforma) return false
    if (filtroMarca !== 'todas' && f.marca !== filtroMarca) return false
    return true
  })

  // ── KPIs agregados ────────────────────────────────────────────────────────────
  const kpis = filasFiltradas.reduce((acc, f) => ({
    bruto: acc.bruto + f.ventas_bruto,
    comision: acc.comision + f.comision_uber,
    promos: acc.promos + f.promociones,
    neto: acc.neto + f.pago_neto,
    pedidos: acc.pedidos + f.num_pedidos,
    conciliadas: acc.conciliadas + (f.estado === 'conciliada' ? 1 : 0),
  }), { bruto: 0, comision: 0, promos: 0, neto: 0, pedidos: 0, conciliadas: 0 })

  // ── Estilos ───────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = { background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 14, padding: '18px 20px' }
  const lbl: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }
  const val: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 24, fontWeight: 600, color: T.pri, lineHeight: 1 }
  const sub: React.CSSProperties = { fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 4 }

  const PLATAFORMAS = [
    { id: 'todas', label: 'Todas' },
    { id: 'uber', label: 'Uber Eats' },
    { id: 'glovo', label: 'Glovo' },
    { id: 'just_eat', label: 'Just Eat' },
  ]

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Barra superior: subida + filtros ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>

        {/* Botón subir CSV */}
        <div
          onClick={() => inputRef.current?.click()}
          style={{ background: '#B01D23', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: subiendo ? 0.6 : 1, pointerEvents: subiendo ? 'none' : 'auto', flexShrink: 0 }}
        >
          <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { handleArchivo(e.target.files); if (inputRef.current) inputRef.current.value = '' }} />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff' }}>
            {subiendo ? 'Importando…' : 'Subir CSV ventas'}
          </span>
        </div>

        {/* Filtro plataforma */}
        <div style={{ display: 'flex', gap: 6 }}>
          {PLATAFORMAS.map(p => (
            <button key={p.id} onClick={() => setFiltroPlataforma(p.id)}
              style={{ padding: '8px 14px', borderRadius: 8, border: `0.5px solid ${filtroPlataforma === p.id ? '#B01D23' : T.brd}`, background: filtroPlataforma === p.id ? '#B01D2315' : T.card, color: filtroPlataforma === p.id ? '#B01D23' : T.sec, fontFamily: FONT.body, fontSize: 12, cursor: 'pointer', fontWeight: filtroPlataforma === p.id ? 600 : 400 }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Filtro marca */}
        {marcas.length > 1 && (
          <select value={filtroMarca} onChange={e => setFiltroMarca(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: T.card, color: T.pri, fontFamily: FONT.body, fontSize: 12, cursor: 'pointer' }}>
            <option value="todas">Todas las marcas</option>
            {marcas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        <div style={{ marginLeft: 'auto', fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
          {filasFiltradas.length} pagos · {kpis.conciliadas} conciliados
        </div>
      </div>

      {/* ── Log importación ────────────────────────────────────────────────────── */}
      {log && (
        <div style={{ background: log.errores.length > 0 ? '#fff5f5' : '#f0faf5', border: `0.5px solid ${log.errores.length > 0 ? '#B01D23' : '#1D9E75'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: log.errores.length > 0 ? '#B01D23' : '#1D9E75' }}>
            {log.archivo}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>
            {log.nuevas} pagos nuevos importados · {log.duplicadas} duplicados ignorados
            {log.errores.length > 0 && ` · ${log.errores.length} errores`}
          </div>
          {log.errores.map((e, i) => (
            <div key={i} style={{ fontFamily: FONT.body, fontSize: 11, color: '#B01D23' }}>{e}</div>
          ))}
        </div>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <div style={card}>
          <div style={lbl}>Ventas brutas</div>
          <div style={val}>{fmtEur(kpis.bruto)}</div>
          <div style={sub}>{kpis.pedidos} pedidos</div>
        </div>
        <div style={card}>
          <div style={lbl}>Comisión Uber</div>
          <div style={{ ...val, color: '#B01D23' }}>{fmtEur(Math.abs(kpis.comision))}</div>
          <div style={sub}>{kpis.bruto > 0 ? ((Math.abs(kpis.comision) / kpis.bruto) * 100).toFixed(1) : 0}% sobre bruto</div>
        </div>
        <div style={card}>
          <div style={lbl}>Promociones</div>
          <div style={{ ...val, color: '#F26B1F' }}>{fmtEur(Math.abs(kpis.promos))}</div>
          <div style={sub}>{kpis.bruto > 0 ? ((Math.abs(kpis.promos) / kpis.bruto) * 100).toFixed(1) : 0}% sobre bruto</div>
        </div>
        <div style={card}>
          <div style={lbl}>Neto cobrado</div>
          <div style={{ ...val, color: '#1D9E75' }}>{fmtEur(kpis.neto)}</div>
          <div style={sub}>{kpis.bruto > 0 ? ((kpis.neto / kpis.bruto) * 100).toFixed(1) : 0}% del bruto</div>
        </div>
        <div style={card}>
          <div style={lbl}>Ticket medio</div>
          <div style={val}>{kpis.pedidos > 0 ? fmtEur(kpis.bruto / kpis.pedidos) : '—'}</div>
          <div style={sub}>por pedido bruto</div>
        </div>
      </div>

      {/* ── Tabla de liquidaciones ────────────────────────────────────────────── */}
      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 14, overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: '32px', textAlign: 'center', fontFamily: FONT.body, fontSize: 13, color: T.mut }}>Cargando…</div>
        ) : filasFiltradas.length === 0 ? (
          <div style={{ padding: '48px 28px', textAlign: 'center' }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 15, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>Sin datos</div>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut }}>Sube un CSV de detalle de ganancias de Uber para empezar</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: FONT.body, fontSize: 12, minWidth: 900 }}>
              <thead>
                <tr>
                  {['Depósito', 'Marca', 'Plataforma', 'Periodo', 'Pedidos', 'Bruto', 'Comisión', 'Promos', 'Neto', 'Estado'].map(h => (
                    <th key={h} style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, padding: '10px 14px', background: T.group, borderBottom: `0.5px solid ${T.brd}`, textAlign: h === 'Pedidos' || h === 'Bruto' || h === 'Comisión' || h === 'Promos' || h === 'Neto' ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map((f, idx) => {
                  const isLast = idx === filasFiltradas.length - 1
                  const td: React.CSSProperties = { padding: '9px 14px', borderBottom: isLast ? 'none' : `0.5px solid ${T.brd}`, verticalAlign: 'middle' }
                  const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: FONT.heading, fontSize: 13, letterSpacing: '0.5px' }
                  const conciliada = f.estado === 'conciliada'
                  const plataformaLabel: Record<string, string> = { uber: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat' }
                  const plataformaColor: Record<string, string> = { uber: '#06C167', glovo: '#e8f442', just_eat: '#f5a623' }

                  return (
                    <tr key={f.id} style={{ background: 'transparent' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.group + '80'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <td style={{ ...td, color: T.mut, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(f.fecha_deposito)}</td>
                      <td style={{ ...td, color: T.pri, fontWeight: 500 }}>{f.marca}</td>
                      <td style={td}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: (plataformaColor[f.plataforma] || '#888') + '20', color: plataformaColor[f.plataforma] || T.mut, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase' }}>
                          {plataformaLabel[f.plataforma] || f.plataforma}
                        </span>
                      </td>
                      <td style={{ ...td, color: T.mut, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {f.fecha_inicio_periodo && f.fecha_fin_periodo
                          ? `${fmtDate(f.fecha_inicio_periodo)} → ${fmtDate(f.fecha_fin_periodo)}`
                          : '—'}
                      </td>
                      <td style={{ ...tdR, color: T.sec }}>{f.num_pedidos}</td>
                      <td style={{ ...tdR, color: T.pri }}>{fmtEur(f.ventas_bruto)}</td>
                      <td style={{ ...tdR, color: '#B01D23' }}>{fmtEur(Math.abs(f.comision_uber))}</td>
                      <td style={{ ...tdR, color: '#F26B1F' }}>{fmtEur(Math.abs(f.promociones))}</td>
                      <td style={{ ...tdR, color: '#1D9E75', fontWeight: 600 }}>{fmtEur(f.pago_neto)}</td>
                      <td style={td}>
                        {conciliada
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', background: '#1D9E7515', color: '#0F6E56' }}>✓ Conciliada</span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', background: '#F26B1F15', color: '#F26B1F' }}>Pendiente</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Nota plataformas futuras ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {['Glovo', 'Just Eat'].map(p => (
          <div key={p} style={{ padding: '8px 14px', borderRadius: 8, border: `0.5px dashed ${T.brd}`, background: 'transparent', fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
            {p} — próximamente
          </div>
        ))}
      </div>
    </div>
  )
}
