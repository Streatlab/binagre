import { useState, useEffect, useMemo, Suspense, lazy } from 'react'
import TabsPastilla from '@/components/ui/TabsPastilla'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import { supabase } from '@/lib/supabase'
import { fechaLocalStr } from '@/utils/fechaLocal'
import { fmtEur } from '@/utils/format'
import { COLOR, COLORS, OSWALD, LEXEND, CARDS } from '@/components/panel/resumen/tokens'

// Pareto Ventas ya existe como página; se monta aquí como pestaña sin tocar su lógica.
const ParetoVentas = lazy(() => import('@/pages/analytics/ParetoVentas'))

type Tab = 'detalle' | 'pareto'
const STORAGE_KEY = 'ventas:tab'

function loadTab(): Tab {
  try { const r = sessionStorage.getItem(STORAGE_KEY); if (r === 'detalle' || r === 'pareto') return r } catch { /* */ }
  return 'detalle'
}

interface VentaRow {
  id: string
  fecha_inicio_periodo: string
  fecha_fin_periodo: string
  plataforma: string
  marca: string
  bruto: number
  neto: number
  pedidos: number
  ticket_medio: number
  ingreso_colaborador: number
  fecha_pago: string | null
}

const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES')
const fmtF = (s: string | null) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

// La BD guarda el código de plataforma ('uber'/'glovo'/'just_eat'). Estos mapas lo
// muestran con su nombre y color de marca correctos.
const NOMBRE_PLAT: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat', rushour: 'Rushour', desconocido: 'Desconocido',
}
const COLOR_PLAT: Record<string, string> = {
  uber: '#06C167', glovo: '#F2D200', just_eat: '#FF8000', rushour: '#1e2233', web: '#B01D23', directa: '#B01D23',
}
const nombrePlat = (p: string) => NOMBRE_PLAT[p] || p
const colorPlat = (p: string) => COLOR_PLAT[p] || COLORS.mut

function CardsResumen({ rows }: { rows: VentaRow[] }) {
  const t = useMemo(() => {
    const bruto = rows.reduce((a, r) => a + (r.bruto || 0), 0)
    const neto = rows.reduce((a, r) => a + (r.neto || 0), 0)
    const pedidos = rows.reduce((a, r) => a + (r.pedidos || 0), 0)
    const ticket = pedidos > 0 ? bruto / pedidos : 0
    const marcas = new Set(rows.map(r => r.marca).filter(m => m && m !== 'SIN_MARCA')).size
    return { bruto, neto, pedidos, ticket, marcas }
  }, [rows])

  const cards = [
    { label: 'Ventas (bruto)', value: fmtEur(t.bruto), color: COLORS.pri },
    { label: 'Te pagan (neto)', value: fmtEur(t.neto), color: COLORS.ok },
    { label: 'Pedidos', value: nf0(t.pedidos), color: COLORS.pri },
    { label: 'Ticket medio', value: fmtEur(t.ticket), color: COLORS.pri },
    { label: 'Marcas', value: t.marcas, color: COLORS.pri },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
      {cards.map(c => (
        <div key={c.label} style={{ ...CARDS.std }}>
          <div style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 500, letterSpacing: '1.5px', color: COLORS.mut, textTransform: 'uppercase' }}>{c.label}</div>
          <div style={{ fontFamily: OSWALD, fontSize: 30, fontWeight: 600, color: c.color, lineHeight: 1.05, marginTop: 6 }}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}

function TablaDetalle({ rows, cargando }: { rows: VentaRow[]; cargando: boolean }) {
  const th: React.CSSProperties = { fontFamily: OSWALD, fontSize: 10, fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.mut, padding: '10px 12px', borderBottom: `0.5px solid ${COLORS.brd}`, whiteSpace: 'nowrap' }
  const tdL: React.CSSProperties = { fontFamily: LEXEND, fontSize: 13, color: COLORS.pri, padding: '9px 12px', borderBottom: `0.5px solid ${COLORS.brd}` }
  const tdR: React.CSSProperties = { ...tdL, fontFamily: OSWALD, fontWeight: 500, textAlign: 'right', whiteSpace: 'nowrap' }

  if (cargando) return <div style={{ ...CARDS.std, textAlign: 'center', color: COLORS.mut, fontFamily: LEXEND, padding: 28 }}>Cargando…</div>
  if (rows.length === 0) return (
    <div style={{ ...CARDS.std, textAlign: 'center', padding: 36 }}>
      <div style={{ fontFamily: OSWALD, fontSize: 15, color: COLORS.mut, letterSpacing: 1 }}>Sin ventas en este periodo</div>
      <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLORS.mut, marginTop: 6 }}>Sube liquidaciones o resúmenes de plataforma en Documentación → Bandeja</div>
    </div>
  )

  return (
    <div style={{ ...CARDS.std, padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 820 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Periodo</th>
              <th style={{ ...th, textAlign: 'left' }}>Plataforma</th>
              <th style={{ ...th, textAlign: 'left' }}>Marca</th>
              <th style={{ ...th, textAlign: 'right' }}>Bruto</th>
              <th style={{ ...th, textAlign: 'right' }}>Neto (te pagan)</th>
              <th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
              <th style={{ ...th, textAlign: 'right' }}>Ticket</th>
              <th style={{ ...th, textAlign: 'left' }}>Pago</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const cp = colorPlat(r.plataforma)
              return (
                <tr key={r.id}>
                  <td style={tdL}>{fmtF(r.fecha_inicio_periodo)} – {fmtF(r.fecha_fin_periodo)}</td>
                  <td style={tdL}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: cp }} />{nombrePlat(r.plataforma)}</span></td>
                  <td style={tdL}>{r.marca === 'SIN_MARCA' ? <span style={{ color: COLORS.mut, fontStyle: 'italic' }}>sin marca</span> : r.marca}</td>
                  <td style={tdR}>{fmtEur(r.bruto)}</td>
                  <td style={{ ...tdR, color: COLORS.ok }}>{fmtEur(r.neto)}</td>
                  <td style={tdR}>{nf0(r.pedidos)}</td>
                  <td style={tdR}>{fmtEur(r.ticket_medio)}</td>
                  <td style={tdL}>{fmtF(r.fecha_pago)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Ventas() {
  const [tab, setTab] = useState<Tab>(loadTab())
  const cambiar = (t: Tab) => { setTab(t); try { sessionStorage.setItem(STORAGE_KEY, t) } catch { /* */ } }

  const [desde, setDesde] = useState<Date>(new Date())
  const [hasta, setHasta] = useState<Date>(new Date())
  const [rows, setRows] = useState<VentaRow[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let alive = true
    setCargando(true)
    const d = fechaLocalStr(desde), h = fechaLocalStr(hasta)
    // Solapamiento de periodos con el rango elegido
    supabase
      .from('ventas_plataforma')
      .select('id, fecha_inicio_periodo, fecha_fin_periodo, plataforma, marca, bruto, neto, pedidos, ticket_medio, ingreso_colaborador, fecha_pago')
      .lte('fecha_inicio_periodo', h)
      .gte('fecha_fin_periodo', d)
      .order('fecha_fin_periodo', { ascending: false })
      .then(({ data }) => { if (alive) { setRows((data as VentaRow[]) ?? []); setCargando(false) } })
    return () => { alive = false }
  }, [desde, hasta])

  return (
    <div style={{ background: COLOR.bgPagina, padding: '24px 28px', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ color: COLORS.redSL, fontFamily: OSWALD, fontSize: 22, fontWeight: 600, letterSpacing: '3px', margin: 0, textTransform: 'uppercase' }}>VENTAS</h2>
        <SelectorFechaUniversal nombreModulo="ventas" defaultOpcion="este_mes" onChange={(d, h) => { setDesde(d); setHasta(h) }} />
      </div>

      {tab === 'detalle' && <CardsResumen rows={rows} />}

      <TabsPastilla
        tabs={[{ id: 'detalle', label: 'Detalle ventas' }, { id: 'pareto', label: 'Pareto Ventas' }]}
        activeId={tab}
        onChange={(id) => cambiar(id as Tab)}
      />

      <Suspense fallback={<div style={{ padding: 24, color: COLORS.mut, fontFamily: LEXEND }}>Cargando…</div>}>
        {tab === 'detalle' && <TablaDetalle rows={rows} cargando={cargando} />}
        {tab === 'pareto' && <ParetoVentas />}
      </Suspense>
    </div>
  )
}
