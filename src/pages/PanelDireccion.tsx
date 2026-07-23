import { BLANCO, GRANATE, LIMA, VERDE } from '@/styles/neobrutal'
import { useEffect, useState, useMemo, useCallback, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNum } from '@/utils/format'
import RutaPantalla from '@/components/ui/RutaPantalla'
import { HeroCantera, PantallaCantera, Plancha, PlanchaCelda, Papel, FrasePotente, SeccionLabel } from '@/components/kit/cantera'

// ── types ────────────────────────────────────────────────────────────────────

interface DiarioRow {
  fecha: string
  total_pedidos: number
  total_bruto: number
}

interface KpiCobertura {
  pct_cobertura: string | number
  movimientos_total: number
  movimientos_con_factura: number
}

interface GastoFijo {
  id: number
  concepto: string
  importe: number
  periodicidad: string
  proxima_fecha_pago: string | null
  activo: boolean
}

interface SemanaStats {
  label: string
  ventas: number
  pedidos: number
  ticket: number
  variacion: number | null
}

interface Alerta {
  nivel: 'roja' | 'amarilla' | 'verde'
  texto: string
}

// ── helpers ──────────────────────────────────────────────────────────────────

function toLocalStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekBounds(offsetWeeks: number): { desde: string; hasta: string } {
  const now = new Date()
  const dow = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - dow + 1 + offsetWeeks * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { desde: toLocalStr(monday), hasta: toLocalStr(sunday) }
}

function isoWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const y = d.getFullYear()
  const jan1 = new Date(y, 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return `Sem ${week}/${y}`
}

// ── styles constantes ────────────────────────────────────────────────────────

const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'
const NEO_CARD: CSSProperties = { border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW }

const cardStyle: CSSProperties = {
  background: 'var(--sl-card-alt)',
  ...NEO_CARD,
  padding: 'clamp(14px,3vw,20px)',
}

const labelStyle = {
  fontFamily: 'Oswald, sans-serif',
  fontSize: 10,
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  color: 'var(--sl-text-muted)',
  marginBottom: 6,
} as const

const bigStyle = {
  fontFamily: 'Oswald, sans-serif',
  fontSize: 'clamp(20px,6vw,28px)',
  fontWeight: 700,
  lineHeight: 1.1,
  color: 'var(--sl-text-primary)',
} as const

const mutedStyle = { color: 'var(--sl-text-muted)', fontSize: 11, fontFamily: 'Lexend, sans-serif' } as const

// ── component ─────────────────────────────────────────────────────────────────

export default function PanelDireccion() {
  const [diario, setDiario] = useState<DiarioRow[]>([])
  const [cobertura, setCobertura] = useState<KpiCobertura | null>(null)
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([])
  const [objetivoMensual, setObjetivoMensual] = useState<number>(20000)
  const [loading, setLoading] = useState(true)
  const [ahora, setAhora] = useState(new Date())

  useEffect(() => {
    const iv = setInterval(() => setAhora(new Date()), 60000)
    return () => clearInterval(iv)
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    const hace30 = new Date()
    hace30.setDate(hace30.getDate() - 30)
    const desde30 = toLocalStr(hace30)

    const [
      { data: rowsDiario },
      { data: rowsKpi },
      { data: rowsGastos },
      { data: rowsObj },
    ] = await Promise.all([
      supabase
        .from('facturacion_diario')
        .select('fecha,total_pedidos,total_bruto')
        .gte('fecha', desde30)
        .order('fecha', { ascending: true }),
      supabase.from('v_kpi_cobertura_conciliacion').select('*').limit(1),
      supabase
        .from('gastos_fijos')
        .select('id,concepto,importe,periodicidad,proxima_fecha_pago,activo')
        .eq('activo', true),
      supabase
        .from('objetivos')
        .select('tipo,importe')
        .eq('tipo', 'mensual')
        .limit(1),
    ])

    if (rowsDiario) setDiario(rowsDiario as DiarioRow[])
    if (rowsKpi && rowsKpi.length > 0) setCobertura(rowsKpi[0] as KpiCobertura)
    if (rowsGastos) setGastosFijos(rowsGastos as GastoFijo[])
    if (rowsObj && rowsObj.length > 0) {
      const val = Number((rowsObj[0] as { tipo: string; importe: number }).importe)
      if (val > 0) setObjetivoMensual(val)
    }

    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── derivados ──────────────────────────────────────────────────────────────

  const hoyStr = toLocalStr(new Date())
  const mesActual = hoyStr.slice(0, 7)

  const semActual = useMemo(() => getWeekBounds(0), [])
  const semAnterior = useMemo(() => getWeekBounds(-1), [])

  const rowsSemActual = useMemo(
    () => diario.filter(r => r.fecha >= semActual.desde && r.fecha <= semActual.hasta),
    [diario, semActual]
  )
  const rowsSemAnterior = useMemo(
    () => diario.filter(r => r.fecha >= semAnterior.desde && r.fecha <= semAnterior.hasta),
    [diario, semAnterior]
  )

  const ventasSemActual = useMemo(
    () => rowsSemActual.reduce((a, r) => a + (r.total_bruto || 0), 0),
    [rowsSemActual]
  )
  const ventasSemAnterior = useMemo(
    () => rowsSemAnterior.reduce((a, r) => a + (r.total_bruto || 0), 0),
    [rowsSemAnterior]
  )
  const pedidosSemActual = useMemo(
    () => rowsSemActual.reduce((a, r) => a + (r.total_pedidos || 0), 0),
    [rowsSemActual]
  )
  const pedidosSemAnterior = useMemo(
    () => rowsSemAnterior.reduce((a, r) => a + (r.total_pedidos || 0), 0),
    [rowsSemAnterior]
  )

  const ticketSemActual = pedidosSemActual > 0 ? ventasSemActual / pedidosSemActual : 0
  const ticketSemAnterior = pedidosSemAnterior > 0 ? ventasSemAnterior / pedidosSemAnterior : 0

  const varVentas =
    ventasSemAnterior > 0
      ? ((ventasSemActual - ventasSemAnterior) / ventasSemAnterior) * 100
      : null
  const varTicket =
    ticketSemAnterior > 0
      ? ((ticketSemActual - ticketSemAnterior) / ticketSemAnterior) * 100
      : null

  const pctCobertura = cobertura ? parseFloat(String(cobertura.pct_cobertura)) : null

  const hoyDate = new Date()
  const finMes = new Date(hoyDate.getFullYear(), hoyDate.getMonth() + 1, 0)
  const diasFinMes = Math.ceil((finMes.getTime() - hoyDate.getTime()) / 86400000)

  const ventasMes = useMemo(
    () => diario.filter(r => r.fecha.startsWith(mesActual)).reduce((a, r) => a + (r.total_bruto || 0), 0),
    [diario, mesActual]
  )
  const diasTranscurridos = hoyDate.getDate()
  const mediaDiaria = diasTranscurridos > 0 ? ventasMes / diasTranscurridos : 0
  const proyeccionMes = ventasMes + mediaDiaria * diasFinMes

  // tabla últimas 4 semanas (memoized con función pura)
  const tablaUlt4Semanas = useMemo((): SemanaStats[] => {
    return Array.from({ length: 4 }, (_, idx) => {
      const offset = -idx
      const sem = getWeekBounds(offset)
      const rows = diario.filter(r => r.fecha >= sem.desde && r.fecha <= sem.hasta)
      const ventas = rows.reduce((a, r) => a + (r.total_bruto || 0), 0)
      const pedidos = rows.reduce((a, r) => a + (r.total_pedidos || 0), 0)
      const ticket = pedidos > 0 ? ventas / pedidos : 0
      const prevSem = getWeekBounds(offset - 1)
      const rowsPrev = diario.filter(r => r.fecha >= prevSem.desde && r.fecha <= prevSem.hasta)
      const ventasPrev = rowsPrev.reduce((a, r) => a + (r.total_bruto || 0), 0)
      const variacion = ventasPrev > 0 ? ((ventas - ventasPrev) / ventasPrev) * 100 : null
      return { label: isoWeekLabel(sem.desde), ventas, pedidos, ticket, variacion }
    })
  }, [diario])

  // gastos vencidos / próximos
  const hoyMs = new Date().setHours(0, 0, 0, 0)
  const en7diasMs = hoyMs + 7 * 86400000

  const gastosVencidos = gastosFijos.filter(g => {
    if (!g.proxima_fecha_pago) return false
    return new Date(g.proxima_fecha_pago + 'T00:00:00').getTime() < hoyMs
  })
  const gastosPróximos = gastosFijos.filter(g => {
    if (!g.proxima_fecha_pago) return false
    const t = new Date(g.proxima_fecha_pago + 'T00:00:00').getTime()
    return t >= hoyMs && t <= en7diasMs
  })

  const sinVentasHoy = !diario.some(r => r.fecha === hoyStr && (r.total_bruto || 0) > 0)

  // ── alertas ────────────────────────────────────────────────────────────────

  const alertas = useMemo((): Alerta[] => {
    const list: Alerta[] = []

    if (varVentas !== null) {
      if (varVentas <= -15) {
        list.push({ nivel: 'roja', texto: `Ventas caen ${Math.abs(varVentas).toFixed(1)}% vs semana anterior` })
      } else if (varVentas <= -5) {
        list.push({ nivel: 'amarilla', texto: `Ventas caen ${Math.abs(varVentas).toFixed(1)}% vs semana anterior` })
      }
    }

    if (pctCobertura !== null) {
      if (pctCobertura < 50) {
        list.push({ nivel: 'roja', texto: `Cobertura conciliación crítica: ${pctCobertura.toFixed(1)}%` })
      } else if (pctCobertura < 80) {
        list.push({ nivel: 'amarilla', texto: `Cobertura conciliación baja: ${pctCobertura.toFixed(1)}%` })
      }
    }

    for (const g of gastosVencidos) {
      list.push({ nivel: 'roja', texto: `Gasto vencido: ${g.concepto} (${fmtEur(g.importe)}) — venció ${g.proxima_fecha_pago}` })
    }

    for (const g of gastosPróximos) {
      list.push({ nivel: 'amarilla', texto: `Gasto próximo: ${g.concepto} (${fmtEur(g.importe)}) — vence ${g.proxima_fecha_pago}` })
    }

    if (sinVentasHoy) {
      list.push({ nivel: 'amarilla', texto: 'Sin registros de ventas para hoy' })
    }

    return list
  }, [varVentas, pctCobertura, gastosVencidos, gastosPróximos, sinVentasHoy])

  const estadoGlobal: 'verde' | 'amarillo' | 'rojo' = useMemo(() => {
    if (alertas.some(a => a.nivel === 'roja')) return 'rojo'
    if (alertas.some(a => a.nivel === 'amarilla')) return 'amarillo'
    return 'verde'
  }, [alertas])

  // ── render helpers ─────────────────────────────────────────────────────────

  function renderDelta(pct: number | null) {
    if (pct === null) return <span style={mutedStyle}>—</span>
    const color = pct >= 0 ? VERDE : GRANATE
    const arrow = pct >= 0 ? '▲' : '▼'
    return (
      <span style={{ color, fontSize: 12, fontFamily: 'Lexend, sans-serif' }}>
        {arrow} {Math.abs(pct).toFixed(1)}%
      </span>
    )
  }

  function renderBarraProgreso(pct: number) {
    const color = pct >= 80 ? VERDE : pct >= 50 ? LIMA : GRANATE
    return (
      <div style={{ height: 8, background: 'var(--sl-border)', borderRadius: 0, marginTop: 8 }}>
        <div style={{ height: 8, width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 0, transition: 'width 0.4s' }} />
      </div>
    )
  }

  function renderAlerta(a: Alerta, i: number) {
    const bgMap = { roja: NEO_INK, amarilla: NEO_INK, verde: NEO_INK }
    const borderMap = { roja: GRANATE, amarilla: LIMA, verde: VERDE }
    const iconoMap = { roja: '❌', amarilla: '⚠️', verde: '✓' }
    return (
      <div key={i} style={{
        background: bgMap[a.nivel],
        border: `2px solid ${borderMap[a.nivel]}`,
        borderRadius: 0, padding: '10px 16px',
        display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8,
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>{iconoMap[a.nivel]}</span>
        <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: BLANCO, lineHeight: 1.4 }}>
          {a.texto}
        </span>
      </div>
    )
  }

  const fechaHoraStr =
    ahora.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) +
    ' · ' +
    ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  const colorEstado = estadoGlobal === 'rojo' ? GRANATE : estadoGlobal === 'amarillo' ? LIMA : VERDE
  const labelEstado = estadoGlobal === 'rojo' ? 'ROJO' : estadoGlobal === 'amarillo' ? 'AMARILLO' : 'VERDE'

  const heroTitular = estadoGlobal === 'rojo'
    ? 'Hay frentes abiertos que necesitan atención hoy.'
    : estadoGlobal === 'amarillo'
      ? 'El negocio va, pero hay un par de cosas que vigilar.'
      : 'Todo en orden: sin alertas activas esta semana.'
  const heroAtencion = alertas.length > 0
    ? alertas.slice(0, 4).map(a => a.texto)
    : ['Sin alertas activas']
  const fraseTop = alertas[0] ?? null
  const fraseSignificado = fraseTop
    ? (fraseTop.nivel === 'roja' ? 'peligro' : 'coste') as const
    : 'logro' as const
  const fraseTexto = fraseTop
    ? fraseTop.texto
    : 'Semana sin alertas: ventas, conciliación y gastos fijos dentro de rango.'

  if (loading) {
    return (
      <PantallaCantera>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--sl-text-muted)', fontSize: 14, fontFamily: 'Lexend, sans-serif' }}>
          Cargando Panel de Dirección…
        </div>
      </PantallaCantera>
    )
  }

  return (
    <PantallaCantera>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <RutaPantalla niveles={['Panel de dirección']} subtitulo={fechaHoraStr} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--sl-card-alt)', border: `3px solid ${colorEstado}`, borderRadius: 0, boxShadow: NEO_SHADOW, padding: '8px 18px',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: colorEstado, flexShrink: 0 }} />
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, color: colorEstado, letterSpacing: '1.5px' }}>
              ESTADO {labelEstado}
            </span>
          </div>

          <button
            onClick={cargar}
            style={{
              background: GRANATE, color: BLANCO, border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW,
              padding: '12px 20px', minHeight: 44, fontFamily: 'Oswald, sans-serif', fontSize: 13,
              letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* ── HÉROE (tinta · área Equipo/Dirección) ── */}
      <HeroCantera
        area="equipo"
        periodo={mesActual}
        titular={heroTitular}
        etiquetaDato="Ventas esta semana"
        cifra={fmtEur(ventasSemActual)}
        variacionPct={varVentas}
        resumen={<>Proyección de mes <b>{fmtEur(proyeccionMes)}</b> sobre objetivo {fmtEur(objetivoMensual)}.</>}
        atencion={heroAtencion}
      />

      {/* ── KPIs PRINCIPALES: plancha sólida pegada, sin sombra ── */}
      <Plancha>
        <PlanchaCelda first>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.65 }}>Ticket medio semana</div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{ticketSemActual > 0 ? fmtEur(ticketSemActual) : '—'}</div>
          <div style={{ marginTop: 6 }}>{renderDelta(varTicket)}</div>
        </PlanchaCelda>
        <PlanchaCelda>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.65 }}>Cobertura conciliación</div>
          <div style={{
            fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6,
            color: pctCobertura !== null ? (pctCobertura >= 80 ? VERDE : pctCobertura >= 50 ? LIMA : GRANATE) : undefined,
          }}>
            {pctCobertura !== null ? `${pctCobertura.toFixed(1)}%` : '—'}
          </div>
          {pctCobertura !== null && renderBarraProgreso(pctCobertura)}
          {cobertura && (
            <div style={{ ...mutedStyle, marginTop: 6 }}>
              {fmtNum(cobertura.movimientos_con_factura)} / {fmtNum(cobertura.movimientos_total)} movimientos
            </div>
          )}
        </PlanchaCelda>
        <PlanchaCelda>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.65 }}>Días hasta fin de mes</div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{diasFinMes} días</div>
          <div style={{ marginTop: 8 }}>
            <div style={mutedStyle}>Ventas mes: <span style={{ color: 'var(--sl-btn-cancel-text)' }}>{fmtEur(ventasMes)}</span></div>
            <div style={{ ...mutedStyle, marginTop: 3 }}>Objetivo: <span style={{ color: 'var(--sl-btn-cancel-text)' }}>{fmtEur(objetivoMensual)}</span></div>
            <div style={{ height: 5, background: 'var(--sl-border)', borderRadius: 0, marginTop: 6 }}>
              <div style={{
                height: 5,
                width: `${Math.min(objetivoMensual > 0 ? (ventasMes / objetivoMensual) * 100 : 0, 100)}%`,
                background: GRANATE, borderRadius: 0,
              }} />
            </div>
          </div>
        </PlanchaCelda>
      </Plancha>

      {/* ── FRASE POTENTE (1 por pantalla, distinta del héroe tinta) ── */}
      <FrasePotente significado={fraseSignificado}>{fraseTexto}</FrasePotente>

      {/* ── PANEL DE ALERTAS — papel sin sombra ── */}
      <div>
        <SeccionLabel bg={colorEstado} color={colorEstado === LIMA ? NEO_INK : BLANCO}>Panel de alertas</SeccionLabel>
        <Papel ceja={colorEstado}>
          {alertas.length === 0 ? (
            <div style={{
              background: NEO_INK, border: `2px solid ${VERDE}`, borderRadius: 0,
              padding: '10px 16px', display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ fontSize: 14 }}>✓</span>
              <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: VERDE }}>
                Todo en orden
              </span>
            </div>
          ) : (
            alertas.map((a, i) => renderAlerta(a, i))
          )}
        </Papel>
      </div>

      {/* ── RESUMEN SEMANAL — papel sin sombra ── */}
      <div>
        <SeccionLabel bg={NEO_INK} color={BLANCO}>Resumen semanal — últimas 4 semanas</SeccionLabel>
        <Papel ceja={NEO_INK} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lexend, sans-serif', fontSize: 13, minWidth: 520 }}>
            <thead>
              <tr>
                {['Semana', 'Ventas brutas', 'Pedidos', 'Ticket medio', 'Variación %'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px',
                    textAlign: h === 'Semana' ? 'left' : 'right',
                    fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px',
                    textTransform: 'uppercase', color: 'var(--sl-text-muted)',
                    borderBottom: '1px solid var(--sl-border)', whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tablaUlt4Semanas.map((sem, i) => (
                <tr key={i}>
                  <td style={{
                    padding: '10px 12px',
                    color: i === 0 ? LIMA : 'var(--sl-text-primary)',
                    borderBottom: '1px solid var(--sl-border)',
                    fontWeight: i === 0 ? 600 : 400, whiteSpace: 'nowrap',
                  }}>
                    {sem.label}{i === 0 ? ' ★' : ''}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--sl-text-primary)', borderBottom: '1px solid var(--sl-border)', fontFamily: 'Oswald, sans-serif', whiteSpace: 'nowrap' }}>
                    {fmtEur(sem.ventas)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--sl-btn-cancel-text)', borderBottom: '1px solid var(--sl-border)' }}>
                    {Math.round(sem.pedidos).toLocaleString('es-ES')}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--sl-btn-cancel-text)', borderBottom: '1px solid var(--sl-border)', whiteSpace: 'nowrap' }}>
                    {sem.ticket > 0 ? fmtEur(sem.ticket) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid var(--sl-border)', whiteSpace: 'nowrap' }}>
                    {sem.variacion === null
                      ? <span style={{ color: 'var(--sl-text-muted)' }}>—</span>
                      : <span style={{ color: sem.variacion >= 0 ? VERDE : GRANATE }}>
                          {sem.variacion >= 0 ? '▲' : '▼'} {Math.abs(sem.variacion).toFixed(1)}%
                        </span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Papel>
      </div>

    </PantallaCantera>
  )
}
