import { BLANCO, GRANATE, GRIS, INK, LIMA, VERDE, AMA, NAR, OSW, LEX } from '@/styles/neobrutal'
/**
 * PagosCobros — Módulo de gestión de cobros y pagos
 * Tabs: Calendario | Gastos Fijos | Historial
 * CANTERA ALEGRE v1.0 (área Tesorería · azul) en TabCalendario/TabGastos/TabHistorial —
 * cuerpos embebidos en TesoreriaPage. Solo capa visual, datos/lógica sin tocar.
 */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtDate } from '@/utils/format'
import { useIsMobile } from '@/hooks/useIsMobile'
import { FondoReserva } from '@/components/tesoreria/FondoReserva'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'
import RutaPantalla from '@/components/ui/RutaPantalla'
import TabsPastilla from '@/components/ui/TabsPastilla'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

// ─── Neobrutal ───────────────────────────────────────────────────────────────
const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'
const NEO_CARD: CSSProperties = { border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW }

// ─── Helpers de fecha ────────────────────────────────────────────────────────

function toLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}

/** Lunes de la semana que contiene d */
function getMondayOfWeek(d: Date): Date {
  const r = new Date(d)
  const dow = r.getDay() // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow
  r.setDate(r.getDate() + diff)
  return r
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface CalendarioItem {
  id: string
  fecha: Date
  tipo: 'COBRO' | 'PAGO'
  concepto: string
  importe: number
  estadoNomina?: 'COMPROMETIDO' | 'PAGADO'
}

interface GastoFijo {
  id: number
  concepto: string
  importe: number
  periodicidad: string
  proxima_fecha_pago: string
  activo: boolean
  estimado: boolean
  origen: string | null
  origen_ref: string | null
}

/**
 * LEY-PRUDENCIA-01 · Parte B: para las filas de gastos_fijos generadas desde una
 * nómina (origen='nomina'), resuelve si ya hay un pago confirmado cruzando con
 * nominas_pagos (motor real en api/_lib/matchNomina.ts, no se duplica aquí, solo
 * se lee). Sin pago confirmado → COMPROMETIDO (sale igual en la agenda: lo manda
 * la ley). Con pago confirmado → PAGADO.
 */
function estadoNominaDe(g: { origen: string | null; origen_ref: string | null }, nominasPagadas: Set<string>): 'COMPROMETIDO' | 'PAGADO' | undefined {
  if (g.origen !== 'nomina') return undefined
  const nominaId = g.origen_ref?.split(':')[1]
  return nominaId && nominasPagadas.has(nominaId) ? 'PAGADO' : 'COMPROMETIDO'
}

interface HistorialItem {
  id: string | number
  fecha: string
  concepto: string
  importe: number
  categoria: string
  tipo: string
}

interface FacturacionRow {
  fecha: string
  uber_bruto: number
  glovo_bruto: number
  je_bruto: number
  web_bruto: number
  directa_bruto: number
}

// ─── Reglas de cobro ─────────────────────────────────────────────────────────

function calcUberCobros(rows: FacturacionRow[], hoy: Date, hasta: Date): CalendarioItem[] {
  const semanas: Record<string, { lunes: Date; importe: number }> = {}
  for (const r of rows) {
    const d = new Date(r.fecha + 'T12:00:00')
    const lunes = getMondayOfWeek(d)
    const key = toLocalISO(lunes)
    if (!semanas[key]) semanas[key] = { lunes, importe: 0 }
    semanas[key].importe += Number(r.uber_bruto) || 0
  }
  const items: CalendarioItem[] = []
  for (const [, s] of Object.entries(semanas)) {
    if (s.importe <= 0) continue
    const fechaCobro = addDays(s.lunes, 7)
    if (fechaCobro > hasta) continue
    if (fechaCobro <= hoy) continue
    items.push({
      id: `uber-${toLocalISO(s.lunes)}`,
      fecha: fechaCobro,
      tipo: 'COBRO',
      concepto: `Uber Eats — semana ${toLocalISO(s.lunes)}`,
      importe: s.importe,
    })
  }
  return items
}

function calcGlovoCobros(rows: FacturacionRow[], hoy: Date, hasta: Date): CalendarioItem[] {
  const quincenas: Record<string, { fecha: Date; importe: number; qLabel: string }> = {}
  for (const r of rows) {
    const d = new Date(r.fecha + 'T12:00:00')
    const dia = d.getDate()
    const mes = d.getMonth()
    const anio = d.getFullYear()
    const qKey = dia <= 15 ? `${anio}-${mes}-1` : `${anio}-${mes}-2`
    if (!quincenas[qKey]) {
      const fechaCobro = dia <= 15
        ? new Date(anio, mes + 1, 5)
        : new Date(anio, mes + 1, 20)
      const label = dia <= 15
        ? `Glovo — 1–15 ${d.toLocaleString('es-ES', { month: 'long' })} ${anio}`
        : `Glovo — 16–fin ${d.toLocaleString('es-ES', { month: 'long' })} ${anio}`
      quincenas[qKey] = { fecha: fechaCobro, importe: 0, qLabel: label }
    }
    quincenas[qKey].importe += Number(r.glovo_bruto) || 0
  }
  const items: CalendarioItem[] = []
  for (const [key, q] of Object.entries(quincenas)) {
    if (q.importe <= 0) continue
    if (q.fecha > hasta) continue
    if (q.fecha <= hoy) continue
    items.push({
      id: `glovo-${key}`,
      fecha: q.fecha,
      tipo: 'COBRO',
      concepto: q.qLabel,
      importe: q.importe,
    })
  }
  return items
}

function calcJECobros(rows: FacturacionRow[], hoy: Date, hasta: Date): CalendarioItem[] {
  const quincenas: Record<string, { fecha: Date; importe: number; qLabel: string }> = {}
  for (const r of rows) {
    const d = new Date(r.fecha + 'T12:00:00')
    const dia = d.getDate()
    const mes = d.getMonth()
    const anio = d.getFullYear()
    const qKey = dia <= 15 ? `${anio}-${mes}-1` : `${anio}-${mes}-2`
    if (!quincenas[qKey]) {
      const fechaCobro = dia <= 15
        ? new Date(anio, mes, 20)
        : new Date(anio, mes + 1, 5)
      const label = dia <= 15
        ? `Just Eat — 1–15 ${d.toLocaleString('es-ES', { month: 'long' })} ${anio}`
        : `Just Eat — 16–fin ${d.toLocaleString('es-ES', { month: 'long' })} ${anio}`
      quincenas[qKey] = { fecha: fechaCobro, importe: 0, qLabel: label }
    }
    quincenas[qKey].importe += Number(r.je_bruto) || 0
  }
  const items: CalendarioItem[] = []
  for (const [key, q] of Object.entries(quincenas)) {
    if (q.importe <= 0) continue
    if (q.fecha > hasta) continue
    if (q.fecha <= hoy) continue
    items.push({
      id: `je-${key}`,
      fecha: q.fecha,
      tipo: 'COBRO',
      concepto: q.qLabel,
      importe: q.importe,
    })
  }
  return items
}

function calcGastosPagos(gastos: GastoFijo[], hoy: Date, hasta: Date, nominasPagadas: Set<string>): CalendarioItem[] {
  const items: CalendarioItem[] = []
  for (const g of gastos) {
    if (!g.activo) continue
    const base = new Date(g.proxima_fecha_pago + 'T12:00:00')
    const periodos: Date[] = []
    if (g.periodicidad === 'mensual') {
      for (let i = 0; i <= 3; i++) periodos.push(addMonths(base, i))
    } else if (g.periodicidad === 'semanal') {
      let cur = new Date(base)
      while (cur <= hasta) { periodos.push(new Date(cur)); cur = addDays(cur, 7) }
    } else if (g.periodicidad === 'anual') {
      periodos.push(base)
    } else {
      periodos.push(base)
    }
    for (const fecha of periodos) {
      if (fecha <= hoy) continue
      if (fecha > hasta) continue
      items.push({
        id: `gasto-${g.id}-${toLocalISO(fecha)}`,
        fecha,
        tipo: 'PAGO',
        concepto: g.concepto,
        importe: Number(g.importe),
        estadoNomina: estadoNominaDe(g, nominasPagadas),
      })
    }
  }
  return items
}

// ─── PDF — MARCO ÚNICO (src/lib/marcoDoc.ts) — APAISADO — documentoId finanzas.pagos_cobros ──

const AREA_PDF: M.Area = 'finanzas'

function construirPagosCobrosPDF(pagos: CalendarioItem[], cobros: CalendarioItem[], rec: M.Recursos, bn = false) {
  if (pagos.length === 0 && cobros.length === 0) return null
  const doc = M.nuevaHoja({ orientation: 'landscape' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA_PDF, bn)
  const cb = M.contentBox(doc)
  const totalPagos = pagos.reduce((s, i) => s + i.importe, 0)
  const totalCobros = cobros.reduce((s, i) => s + i.importe, 0)
  const meta = `Próximos 90 días · Pagos comprometidos ${fmtEur(totalPagos)} · Cobros previstos ${fmtEur(totalCobros)}`
  const nuevaPagina = () => { M.pintarEspina(doc, AREA_PDF, ctx, bn); return M.pintarCabecera(doc, ctx, { docNombre: 'Calendario de pagos y cobros', meta, area: AREA_PDF, bn }) }
  let y = nuevaPagina()

  const wFecha = 26, wImporte = 36
  const wConcepto = cb.w - wFecha - wImporte - 4
  const xFecha = cb.x0, xConcepto = cb.x0 + wFecha + 2, xImporte = cb.x1

  const pintarBloque = (titulo: string, items: CalendarioItem[], mostrarEstado: boolean) => {
    if (y > cb.bottom - 16) { doc.addPage(); y = nuevaPagina() }
    doc.setFillColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.roundedRect(cb.x0, y, cb.w, 7, M.R, M.R, 'F')
    M.fTitulo(doc, ctx, true); doc.setFontSize(10); doc.setTextColor(255, 255, 255)
    doc.text(titulo.toUpperCase(), cb.x0 + 3, y + 5)
    y += 9.5
    if (items.length === 0) {
      M.fDato(doc, ctx, false); doc.setFontSize(9); doc.setTextColor(...M.GRIS)
      doc.text('Sin movimientos en los próximos 90 días.', cb.x0 + 1.5, y + 3)
      y += 7
      return
    }
    const cabTabla = () => {
      doc.setFillColor(pal.soft[0], pal.soft[1], pal.soft[2]); doc.rect(cb.x0, y, cb.w, 5.5, 'F')
      M.fTitulo(doc, ctx, true); doc.setFontSize(7.5); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
      doc.text('FECHA', xFecha + 1.5, y + 3.8)
      doc.text(mostrarEstado ? 'CONCEPTO · ESTADO' : 'CONCEPTO', xConcepto, y + 3.8)
      doc.text('IMPORTE', xImporte, y + 3.8, { align: 'right' })
      y += 5.5
    }
    cabTabla()
    for (const it of items) {
      if (y > cb.bottom - 6) { doc.addPage(); y = nuevaPagina(); cabTabla() }
      doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.1); doc.line(cb.x0, y + 4.6, cb.x1, y + 4.6)
      M.fDato(doc, ctx, false); doc.setFontSize(8); doc.setTextColor(...M.TINTA)
      doc.text(it.fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }), xFecha + 1.5, y + 3.6)
      const conceptoTxt = mostrarEstado && it.estadoNomina ? `${it.concepto}  ·  ${it.estadoNomina}` : it.concepto
      doc.text(conceptoTxt, xConcepto, y + 3.6, { maxWidth: wConcepto })
      doc.setTextColor(...pal.acento); doc.text(fmtEur(it.importe), xImporte, y + 3.6, { align: 'right' })
      y += 4.8
    }
    y += 4
  }

  pintarBloque('Pagos comprometidos', pagos, true)
  pintarBloque('Cobros previstos (aún no han llegado)', cobros, false)

  const totalPag = doc.getNumberOfPages()
  for (let p = 1; p <= totalPag; p++) { doc.setPage(p); M.pintarPaginado(doc, p, totalPag, ctx) }
  return doc
}

// ─── Componente principal ────────────────────────────────────────────────────

type TabId = 'calendario' | 'gastos' | 'reserva' | 'historial'

const TABS: { id: TabId; label: string }[] = [
  { id: 'calendario', label: 'CALENDARIO' },
  { id: 'gastos', label: 'GASTOS FIJOS' },
  { id: 'reserva', label: 'FONDO & RESERVA' },
  { id: 'historial', label: 'HISTORIAL' },
]

const VALID_TABS: TabId[] = ['calendario', 'gastos', 'reserva', 'historial']

export default function PagosCobros() {
  const [tab, setTab] = useState<TabId>(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    return (q && VALID_TABS.includes(q as TabId)) ? (q as TabId) : 'calendario'
  })
  const [ordPend, setOrdPend] = useState(0)
  const isMobile = useIsMobile()

  // Nº de barridos pendientes (para avisar desde cualquier pestaña).
  useEffect(() => {
    supabase.from('v_reserva_panel').select('ordenes_pendientes').single()
      .then(({ data }) => setOrdPend(Number((data as { ordenes_pendientes?: number } | null)?.ordenes_pendientes ?? 0)))
  }, [])

  // Deep-link: la pestaña activa queda reflejada en la URL (refresh y botón atrás).
  function selectTab(id: TabId) {
    setTab(id)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', id)
    window.history.replaceState({}, '', url)
  }

  return (
    <div style={{ padding: isMobile ? '18px 12px' : '28px 28px', fontFamily: 'Lexend, sans-serif', color: 'var(--sl-text-primary)', minHeight: '100vh', backgroundColor: 'var(--neo-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <RutaPantalla niveles={['Tesorería', TABS.find(t => t.id === tab)?.label ?? '']} subtitulo="Calendario de cobros de plataformas y gestión de pagos" />
      </div>

      <TabsPastilla tabs={TABS.map(t => ({ id: t.id, label: t.label, badge: t.id === 'reserva' ? ordPend : undefined }))} activeId={tab} onChange={id => selectTab(id as TabId)} />

      <div style={{ height: 16 }} />

      {tab === 'calendario' && <TabCalendario />}
      {tab === 'gastos' && <TabGastos />}
      {tab === 'reserva' && <FondoReserva embedded />}
      {tab === 'historial' && <TabHistorial />}
    </div>
  )
}

// ─── Tab Calendario ──────────────────────────────────────────────────────────

export function TabCalendario() {
  const [pagos, setPagos] = useState<CalendarioItem[]>([])
  const [cobros, setCobros] = useState<CalendarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        const hasta = addDays(hoy, 90)
        const desdeFacturacion = addDays(hoy, -56)

        const { data: facData, error: facErr } = await supabase
          .from('facturacion_diario')
          .select('fecha, uber_bruto, glovo_bruto, je_bruto, web_bruto, directa_bruto')
          .gte('fecha', toLocalISO(desdeFacturacion))
          .lte('fecha', toLocalISO(hoy))
          .order('fecha', { ascending: true })

        if (facErr) throw facErr

        const { data: gastosData, error: gastosErr } = await supabase
          .from('gastos_fijos')
          .select('*')
          .eq('activo', true)

        if (gastosErr) throw gastosErr

        // Cruce de nóminas ya pagadas (ver estadoNominaDe): solo lee nominas_pagos,
        // no duplica el motor de matchNomina.ts.
        const { data: pagosData, error: pagosErr } = await supabase
          .from('nominas_pagos')
          .select('nomina_id')
          .eq('confirmado', true)

        if (pagosErr) throw pagosErr

        const rows: FacturacionRow[] = (facData || []) as FacturacionRow[]
        const gastos: GastoFijo[] = (gastosData || []) as GastoFijo[]
        const nominasPagadas = new Set(((pagosData || []) as Array<{ nomina_id: string }>).map(p => p.nomina_id))

        const cobrosCalc = [
          ...calcUberCobros(rows, hoy, hasta),
          ...calcGlovoCobros(rows, hoy, hasta),
          ...calcJECobros(rows, hoy, hasta),
        ]
        const pagosCalc = calcGastosPagos(gastos, hoy, hasta, nominasPagadas)
        cobrosCalc.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
        pagosCalc.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
        setCobros(cobrosCalc)
        setPagos(pagosCalc)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error cargando datos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // LEY-PRUDENCIA-01: los pagos comprometidos NUNCA se compensan con cobros
  // todavía no llegados. Cero KPI "Balance".
  const totalPagos = pagos.reduce((s, i) => s + i.importe, 0)
  const totalCobros = cobros.reduce((s, i) => s + i.importe, 0)

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMsg msg={error} />

  const titular = totalPagos > totalCobros
    ? 'Tienes más pagos comprometidos que cobros previstos a la vista.'
    : totalCobros > 0 ? 'Los cobros previstos superan tus pagos comprometidos.'
    : 'Sin movimientos previstos en los próximos 90 días.'

  const atencion = [
    `${pagos.length} pago${pagos.length !== 1 ? 's' : ''} programado${pagos.length !== 1 ? 's' : ''}`,
    `${cobros.length} cobro${cobros.length !== 1 ? 's' : ''} previsto${cobros.length !== 1 ? 's' : ''}`,
  ]

  return (
    <PantallaCantera embedded>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <BotonImprimir compacto documentoId="finanzas.pagos_cobros" titulo="Calendario de pagos y cobros" generarPdf={async opts => { const rec = await M.cargarRecursos(); return construirPagosCobrosPDF(pagos, cobros, rec, opts.bn) }} />
      </div>

      {/* 1 · Héroe del área Tesorería (azul) */}
      <HeroCantera
        area="tesoreria"
        periodo="Próximos 90 días"
        titular={titular}
        etiquetaDato="Pagos comprometidos"
        cifra={fmtEur(totalPagos)}
        resumen={<>Cobros previstos (aún no confirmados): <b>{fmtEur(totalCobros)}</b>. No se compensan con los pagos: solo cuentan cuando el banco los confirma.</>}
        atencion={atencion}
      />

      {/* 2 · Plancha comparativa pagos / cobros */}
      <div>
        <SeccionLabel bg={AMA} color={INK}>Resumen 90 días</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={GRANATE} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Pagos comprometidos</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(totalPagos)}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={VERDE}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Cobros previstos (aún no han llegado)</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(totalCobros)}</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* 3 · Frase potente (coste · distinta del héroe azul) */}
      <FrasePotente significado="coste">Los cobros previstos son solo planificación: no reduzcas gastos pensando que ese dinero ya está en el banco.</FrasePotente>

      {/* Pagos comprometidos — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={GRANATE}>Pagos comprometidos</SeccionLabel>
        <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 8, marginTop: -4 }}>Salidas conocidas, aunque todavía no hayan salido del banco.</div>
        {pagos.length === 0 ? (
          <Papel ceja={GRANATE}><div style={{ color: GRIS, fontFamily: LEX, fontSize: 13, textAlign: 'center' }}>No hay pagos comprometidos en los próximos 90 días.</div></Papel>
        ) : (
          <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX, minWidth: 560 }}>
              <thead>
                <tr style={{ background: INK }}>
                  {['Fecha', 'Concepto', 'Importe', 'Estado'].map(h => (
                    <th key={h} style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: BLANCO, padding: '10px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagos.map(item => (
                  <tr key={item.id} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {item.fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{item.concepto}</td>
                    <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {fmtEur(item.importe)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <EstadoNominaBadge estado={item.estadoNomina} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Papel>
        )}
      </div>

      {/* Cobros previstos: informativos, nunca compensan pagos — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={VERDE}>Cobros previstos (aún no han llegado)</SeccionLabel>
        <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 8, marginTop: -4 }}>Información de planificación. No es caja: solo cuentan cuando el banco los confirma.</div>
        {cobros.length === 0 ? (
          <Papel ceja={VERDE}><div style={{ color: GRIS, fontFamily: LEX, fontSize: 13, textAlign: 'center' }}>No hay cobros previstos en los próximos 90 días.</div></Papel>
        ) : (
          <Papel ceja={VERDE} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX, minWidth: 560 }}>
              <thead>
                <tr style={{ background: INK }}>
                  {['Fecha', 'Concepto', 'Importe estimado'].map(h => (
                    <th key={h} style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: BLANCO, padding: '10px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cobros.map(item => (
                  <tr key={item.id} style={{ borderBottom: `2px dashed ${GRIS}`, color: GRIS }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {item.fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{item.concepto}</td>
                    <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {fmtEur(item.importe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Papel>
        )}
      </div>
    </PantallaCantera>
  )
}

// ─── Tab Gastos Fijos ────────────────────────────────────────────────────────

const PERIODICIDADES = ['mensual', 'semanal', 'anual', 'trimestral']

interface FormGasto {
  concepto: string
  importe: string
  periodicidad: string
  proxima_fecha_pago: string
  estimado: boolean
}

const emptyForm: FormGasto = {
  concepto: '',
  importe: '',
  periodicidad: 'mensual',
  proxima_fecha_pago: '',
  estimado: false,
}

export function TabGastos() {
  const [gastos, setGastos] = useState<GastoFijo[]>([])
  const [nominasPagadas, setNominasPagadas] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormGasto>(emptyForm)
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  async function cargar() {
    setLoading(true)
    const [{ data }, { data: pagosData }] = await Promise.all([
      supabase.from('gastos_fijos').select('*').order('concepto', { ascending: true }),
      supabase.from('nominas_pagos').select('nomina_id').eq('confirmado', true),
    ])
    setGastos((data || []) as GastoFijo[])
    setNominasPagadas(new Set(((pagosData || []) as Array<{ nomina_id: string }>).map(p => p.nomina_id)))
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function guardar() {
    if (!form.concepto.trim() || !form.importe || !form.proxima_fecha_pago) return
    setSaving(true)
    const payload = {
      concepto: form.concepto.trim(),
      importe: parseFloat(form.importe.replace(',', '.')),
      periodicidad: form.periodicidad,
      proxima_fecha_pago: form.proxima_fecha_pago,
      activo: true,
      estimado: form.estimado,
    }
    let saveError: { message: string } | null = null
    if (editId !== null) {
      const res = await supabase.from('gastos_fijos').update(payload).eq('id', editId)
      saveError = res.error
    } else {
      const res = await supabase.from('gastos_fijos').insert(payload)
      saveError = res.error
    }
    setSaving(false)
    if (saveError) {
      showToast('Error al guardar: ' + saveError.message, false)
    } else {
      showToast(editId !== null ? 'Gasto actualizado' : 'Gasto añadido', true)
      setShowForm(false)
      setForm(emptyForm)
      setEditId(null)
      cargar()
    }
  }

  async function archivar(id: number) {
    const { error } = await supabase.from('gastos_fijos').update({ activo: false }).eq('id', id)
    if (error) showToast('Error al archivar: ' + error.message, false)
    else { showToast('Gasto archivado', true); cargar() }
  }

  function iniciarEdicion(g: GastoFijo) {
    setForm({
      concepto: g.concepto,
      importe: String(g.importe),
      periodicidad: g.periodicidad,
      proxima_fecha_pago: g.proxima_fecha_pago,
      estimado: !!g.estimado,
    })
    setEditId(g.id)
    setShowForm(true)
  }

  if (loading) return <LoadingSpinner />

  const gastosActivos = gastos.filter(g => g.activo)
  const titular = gastosActivos.length > 0 ? 'Tus gastos fijos programados.' : 'Aún no tienes gastos fijos registrados.'
  const atencion = [
    `${gastosActivos.length} activo${gastosActivos.length !== 1 ? 's' : ''}`,
    `${gastos.length - gastosActivos.length} archivado${(gastos.length - gastosActivos.length) !== 1 ? 's' : ''}`,
    `${gastosActivos.filter(g => g.periodicidad === 'mensual').length} mensuales`,
  ]

  return (
    <PantallaCantera embedded>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(v => !v) }}
          style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: 1, padding: '12px 20px', minHeight: 44, borderRadius: 0, border: `3px solid ${INK}`, boxShadow: SHADOW_DURA, cursor: 'pointer', backgroundColor: LIMA, color: INK, textTransform: 'uppercase' }}
        >
          + Añadir gasto fijo
        </button>
      </div>

      {/* 1 · Héroe del área Tesorería (azul) */}
      <HeroCantera
        area="tesoreria"
        titular={titular}
        etiquetaDato="Gastos fijos activos"
        cifra={String(gastosActivos.length)}
        resumen="Alquileres, nóminas, suscripciones y demás salidas recurrentes que alimentan la previsión de caja."
        atencion={atencion}
      />

      {toast && (
        <div style={{ padding: '10px 16px', border: `3px solid ${INK}`, background: toast.ok ? VERDE : GRANATE, color: BLANCO, fontFamily: LEX, fontSize: 13 }}>
          {toast.msg}
        </div>
      )}

      {showForm && (
        <Papel ceja={LIMA}>
          <h3 style={{ fontFamily: OSW, fontSize: 14, letterSpacing: 1.5, color: INK, margin: '0 0 16px', textTransform: 'uppercase' }}>
            {editId !== null ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, alignItems: 'end' }}>
            <InputField label="Concepto" value={form.concepto} onChange={v => setForm(f => ({ ...f, concepto: v }))} />
            <InputField label="Importe (€)" value={form.importe} onChange={v => setForm(f => ({ ...f, importe: v }))} type="number" />
            <div>
              <label style={{ display: 'block', fontFamily: OSW, fontSize: 11, letterSpacing: 1, color: GRIS, marginBottom: 6, textTransform: 'uppercase' }}>Periodicidad</label>
              <select
                value={form.periodicidad}
                onChange={e => setForm(f => ({ ...f, periodicidad: e.target.value }))}
                style={{ width: '100%', padding: '10px 10px', minHeight: 42, backgroundColor: BLANCO, border: `2px solid ${INK}`, borderRadius: 0, color: INK, fontSize: 13, fontFamily: LEX, boxSizing: 'border-box' }}
              >
                {PERIODICIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <InputField label="Próximo pago" value={form.proxima_fecha_pago} onChange={v => setForm(f => ({ ...f, proxima_fecha_pago: v }))} type="date" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, cursor: 'pointer', fontFamily: LEX, fontSize: 13, color: INK }}>
            <input
              type="checkbox"
              checked={form.estimado}
              onChange={e => setForm(f => ({ ...f, estimado: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: LIMA, cursor: 'pointer' }}
            />
            Importe estimado (pendiente de factura/confirmación)
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setShowForm(false); setForm(emptyForm); setEditId(null) }}
              style={{ fontFamily: OSW, fontSize: 12, fontWeight: 600, padding: '12px 16px', minHeight: 44, borderRadius: 0, border: `3px solid ${INK}`, backgroundColor: BLANCO, color: INK, cursor: 'pointer', textTransform: 'uppercase' }}
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={saving}
              style={{ fontFamily: OSW, fontSize: 12, fontWeight: 600, padding: '12px 20px', minHeight: 44, borderRadius: 0, border: `3px solid ${INK}`, boxShadow: SHADOW_DURA, backgroundColor: GRANATE, color: BLANCO, cursor: 'pointer', opacity: saving ? 0.6 : 1, textTransform: 'uppercase' }}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Papel>
      )}

      {/* Listado — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={NAR}>Listado de gastos fijos</SeccionLabel>
        <Papel ceja={NAR} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX, minWidth: 560 }}>
            <thead>
              <tr style={{ background: INK }}>
                {['Concepto', 'Importe', 'Periodicidad', 'Próximo pago', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: BLANCO, padding: '10px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gastos.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: GRIS, fontSize: 13 }}>
                    Sin gastos fijos registrados.
                  </td>
                </tr>
              )}
              {gastos.map(g => (
                <tr key={g.id} style={{ borderBottom: `2px solid ${INK}` }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {g.concepto}
                      <EstimadoBadge estimado={g.estimado} />
                      <EstadoNominaBadge estado={estadoNominaDe(g, nominasPagadas)} />
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtEur(g.importe)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: GRIS, textTransform: 'capitalize' }}>{g.periodicidad}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{fmtDate(g.proxima_fecha_pago)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', border: `2px solid ${INK}`, backgroundColor: g.activo ? VERDE : GRIS, color: BLANCO, fontFamily: OSW, letterSpacing: 1, textTransform: 'uppercase' }}>
                      {g.activo ? 'Activo' : 'Archivado'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => iniciarEdicion(g)}
                        style={{ fontSize: 12, fontFamily: OSW, padding: '8px 12px', minHeight: 36, borderRadius: 0, border: `2px solid ${INK}`, backgroundColor: BLANCO, color: INK, cursor: 'pointer', textTransform: 'uppercase' }}
                      >
                        Editar
                      </button>
                      {g.activo && (
                        <button
                          onClick={() => archivar(g.id)}
                          style={{ fontSize: 12, fontFamily: OSW, padding: '8px 12px', minHeight: 36, borderRadius: 0, border: `2px solid ${GRANATE}`, backgroundColor: BLANCO, color: GRANATE, cursor: 'pointer', textTransform: 'uppercase' }}
                        >
                          Archivar
                        </button>
                      )}
                    </div>
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

// ─── Tab Historial ───────────────────────────────────────────────────────────

type FiltroHistorial = 'todos' | 'ingreso' | 'pago'

export function TabHistorial() {
  const [movs, setMovs] = useState<HistorialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroHistorial>('todos')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const hoy = new Date()
      const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate())
      const { data } = await supabase
        .from('conciliacion')
        .select('id, fecha, concepto, importe, tipo, categoria')
        .gte('fecha', toLocalISO(desde))
        .in('tipo', ['pago', 'ingreso'])
        .order('fecha', { ascending: false })
        .limit(500)
      setMovs((data || []) as HistorialItem[])
      setLoading(false)
    }
    load()
  }, [])

  const filtrados = filtro === 'todos' ? movs : movs.filter(m => m.tipo === filtro)

  if (loading) return <LoadingSpinner />

  const totalIngresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Math.abs(Number(m.importe)), 0)
  const totalPagos = movs.filter(m => m.tipo === 'pago').reduce((s, m) => s + Math.abs(Number(m.importe)), 0)
  const neto = totalIngresos - totalPagos

  const titular = neto >= 0 ? 'El último mes cierra en positivo.' : 'El último mes cierra en negativo.'

  const atencion = [
    `${movs.length} movimiento${movs.length !== 1 ? 's' : ''} en el período`,
    `Ingresos ${fmtEur(totalIngresos)}`,
    `Pagos ${fmtEur(totalPagos)}`,
  ]

  const filtros = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {(['todos', 'ingreso', 'pago'] as FiltroHistorial[]).map(f => {
        const on = filtro === f
        return (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: 1, padding: '10px 14px', minHeight: 44,
              borderRadius: 0, border: `3px solid ${INK}`, cursor: 'pointer', textTransform: 'uppercase',
              backgroundColor: on ? LIMA : BLANCO, color: INK, boxShadow: on ? SHADOW_DURA : 'none',
            }}
          >
            {f === 'todos' ? 'Todos' : f === 'ingreso' ? 'Ingresos' : 'Pagos'}
          </button>
        )
      })}
    </div>
  )

  return (
    <PantallaCantera embedded>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{filtros}</div>

      {/* 1 · Héroe del área Tesorería (azul) */}
      <HeroCantera
        area="tesoreria"
        periodo="Último mes"
        titular={titular}
        etiquetaDato="Balance neto (ingresos − pagos)"
        cifra={fmtEur(neto)}
        atencion={atencion}
      />

      {/* 2 · Plancha comparativa ingresos / pagos */}
      <div>
        <SeccionLabel bg={AMA} color={INK}>Ingresos vs pagos</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={VERDE} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Ingresos</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(totalIngresos)}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={GRANATE}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Pagos</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(totalPagos)}</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* 3 · Frase potente (color por significado, distinta del héroe azul) */}
      {neto >= 0
        ? <FrasePotente significado="logro">Los ingresos del período superan a los pagos: la caja del último mes suma.</FrasePotente>
        : <FrasePotente significado="peligro">Los pagos superan a los ingresos del período: revisa qué está tirando del balance.</FrasePotente>}

      {/* Movimientos — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={NAR}>Movimientos ({filtrados.length})</SeccionLabel>
        <Papel ceja={NAR} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX, minWidth: 560 }}>
            <thead>
              <tr style={{ background: INK }}>
                {['Fecha', 'Concepto', 'Importe', 'Categoría', 'Tipo'].map(h => (
                  <th key={h} style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: BLANCO, padding: '10px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: GRIS, fontSize: 13 }}>
                    Sin movimientos en el período.
                  </td>
                </tr>
              )}
              {filtrados.map(m => (
                <tr key={m.id} style={{ borderBottom: `2px solid ${INK}` }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{fmtDate(m.fecha)}</td>
                  <td style={{ padding: '10px 12px' }}>{m.concepto}</td>
                  <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 700, color: m.tipo === 'ingreso' ? VERDE : GRANATE, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {m.tipo === 'pago' ? '-' : '+'}{fmtEur(Math.abs(Number(m.importe)))}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: GRIS, textTransform: 'capitalize' }}>{m.categoria || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <TipoBadge tipo={m.tipo === 'ingreso' ? 'COBRO' : 'PAGO'} />
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

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--sl-card)', ...NEO_CARD, padding: 'clamp(14px,3vw,24px)' }}>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--sl-text-muted)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(19px,5.5vw,26px)', fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  )
}

function EstimadoBadge({ estimado }: { estimado: boolean }) {
  return (
    <span style={{
      fontSize: 10,
      padding: '2px 7px',
      borderRadius: 0,
      border: `2px solid ${estimado ? LIMA : VERDE}`,
      backgroundColor: estimado ? `${LIMA}22` : `${VERDE}22`,
      color: estimado ? LIMA : VERDE,
      fontFamily: 'Oswald, sans-serif',
      fontWeight: 600,
      letterSpacing: 1,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {estimado ? '🟡 Estimado' : '🟢 Fijo'}
    </span>
  )
}

/** LEY-PRUDENCIA-01 · Parte B: estado de las filas de gastos_fijos que vienen de una nómina. */
function EstadoNominaBadge({ estado }: { estado?: 'COMPROMETIDO' | 'PAGADO' }) {
  if (!estado) return null
  const pagado = estado === 'PAGADO'
  return (
    <span style={{
      fontSize: 10,
      padding: '2px 7px',
      borderRadius: 0,
      border: `2px solid ${pagado ? VERDE : LIMA}`,
      backgroundColor: pagado ? `${VERDE}22` : `${LIMA}22`,
      color: pagado ? VERDE : LIMA,
      fontFamily: 'Oswald, sans-serif',
      fontWeight: 600,
      letterSpacing: 1,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      marginLeft: 6,
    }}>
      {pagado ? '🟢 Pagado' : '🟡 Comprometido'}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: 'COBRO' | 'PAGO' }) {
  const isCobro = tipo === 'COBRO'
  return (
    <span style={{
      fontSize: 11,
      padding: '3px 8px',
      borderRadius: 0,
      backgroundColor: isCobro ? `${VERDE}20` : `${GRANATE}20`,
      color: isCobro ? VERDE : GRANATE,
      fontFamily: 'Oswald, sans-serif',
      letterSpacing: 1,
    }}>
      {tipo}
    </span>
  )
}

function InputField({ label, value, onChange, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label style={{ display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: 1, color: 'var(--sl-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 10px', minHeight: 42, backgroundColor: 'var(--sl-input-edit)', border: '0.5px solid var(--sl-border)', borderRadius: 0, color: 'var(--sl-text-primary)', fontSize: 13, fontFamily: 'Lexend, sans-serif', boxSizing: 'border-box' }}
      />
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48, color: 'var(--sl-text-muted)', fontSize: 13 }}>
      Cargando...
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div style={{ padding: 24, borderRadius: 0, backgroundColor: `${GRANATE}20`, border: `1px solid ${GRANATE}`, color: GRANATE, fontSize: 13 }}>
      Error: {msg}
    </div>
  )
}
