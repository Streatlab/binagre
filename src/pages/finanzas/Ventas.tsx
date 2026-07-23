import { BLANCO, BORDE_SUAVE, GRIS, INK, OSC, ROJO, ROSA_S, SHADOW, AZUL, VERDE, NAR, GRANATE, AMA } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SHADOW_DURA } from '@/components/kit/cantera'
import { VENTAS_CANAL_CHIP } from '@/styles/palettes'
import { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react'
import { ChevronDown } from 'lucide-react'
import TabsPastilla from '@/components/ui/TabsPastilla'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import { supabase } from '@/lib/supabase'
import { fechaLocalStr } from '@/utils/fechaLocal'
import { fmtEur } from '@/utils/format'
import { OSWALD, LEXEND } from '@/components/panel/resumen/tokens'

// Pareto Ventas ya existe como página; se monta aquí como pestaña sin tocar su lógica.
const ParetoVentas = lazy(() => import('@/pages/analytics/ParetoVentas'))
const PanelInteligenciaVentas = lazy(() => import('@/pages/finanzas/PanelInteligenciaVentas'))

type Tab = 'resumen' | 'detalle' | 'liquidaciones' | 'pareto'
const STORAGE_KEY = 'ventas:tab'

function loadTab(): Tab {
  try {
    const r = sessionStorage.getItem(STORAGE_KEY)
    if (r === 'resumen' || r === 'detalle' || r === 'liquidaciones' || r === 'pareto') return r
    if (r === 'platos') return 'detalle' // compat
  } catch { /* */ }
  return 'resumen'
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

// Fila que devuelve la RPC fn_detalle_ventas (agrupada por la dimensión elegida).
interface DetalleRow { etiqueta: string; plataforma: string; unidades: number; importe: number }

const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES')
const fmtF = (s: string | null) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

const NOMBRE_PLAT: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat', rushour: 'Rushour', desconocido: 'Desconocido',
}
const PILL_PLAT = VENTAS_CANAL_CHIP
const nombrePlat = (p: string) => NOMBRE_PLAT[p] || p
const pillPlat = (p: string) => PILL_PLAT[p] || PILL_PLAT.desconocido

function PastillaPlataforma({ plataforma }: { plataforma: string }) {
  const c = pillPlat(plataforma)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 0,
      background: c.bg, color: c.tx, fontFamily: OSWALD, fontSize: 12, fontWeight: 600,
      letterSpacing: '0.3px', whiteSpace: 'nowrap',
    }}>{nombrePlat(plataforma)}</span>
  )
}

// ── Multi-selector (mismo patrón que Panel Global) ─────────────────────────
const dropdownBtn: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 0, border: `0.5px solid ${BORDE_SUAVE}`,
  background: BLANCO, fontSize: 13, fontFamily: 'Lexend, sans-serif', color: INK,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', position: 'relative',
}
const menuStyle: React.CSSProperties = {
  position: 'absolute', top: 38, right: 0, background: BLANCO, border: `0.5px solid ${BORDE_SUAVE}`,
  borderRadius: 0, width: 260, fontSize: 12, color: OSC, boxShadow: SHADOW,
  zIndex: 100, maxHeight: 360, overflowY: 'auto', paddingTop: 2, paddingBottom: 2,
}

function MultiSelect({
  label, options, selected, onToggle, onAll,
}: {
  label: string
  options: Array<{ id: string; label: string }>
  selected: string[]
  onToggle: (id: string) => void
  onAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function click(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])
  const displayLabel = selected.length === 0 || selected.length === options.length ? label : `${selected.length} sel.`
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button style={dropdownBtn} onClick={() => setOpen(o => !o)}>
        <span>{displayLabel}</span>
        <ChevronDown size={11} strokeWidth={2.5} style={{ marginLeft: 4 }} />
      </button>
      {open && (
        <div style={menuStyle}>
          <button
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
              background: 'transparent', border: 'none', fontSize: 13, fontFamily: 'Lexend, sans-serif',
              color: GRIS, cursor: 'pointer', borderBottom: `0.5px solid ${BORDE_SUAVE}`,
            }}
            onClick={() => { onAll(); setOpen(false) }}
          >Todos</button>
          {options.length === 0 && (
            <div style={{ padding: '8px 12px', color: GRIS, fontFamily: 'Lexend, sans-serif', fontSize: 12 }}>Sin datos</div>
          )}
          {options.map(o => (
            <label key={o.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '2px 10px', cursor: 'pointer', lineHeight: 1.3,
              background: selected.includes(o.id) ? ROSA_S : 'transparent',
              color: selected.includes(o.id) ? ROJO : GRIS,
              fontFamily: 'Lexend, sans-serif', fontSize: 12, whiteSpace: 'nowrap',
            }}>
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => onToggle(o.id)} style={{ accentColor: ROJO }} />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

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
    { label: 'Ventas (bruto)', value: fmtEur(t.bruto), bg: AZUL },
    { label: 'Te pagan (neto)', value: fmtEur(t.neto), bg: VERDE },
    { label: 'Pedidos', value: nf0(t.pedidos), bg: NAR },
    { label: 'Ticket medio', value: fmtEur(t.ticket), bg: GRANATE },
    { label: 'Marcas', value: String(t.marcas), bg: AMA },
  ]
  return (
    <Plancha style={{ marginBottom: 14 }}>
      {cards.map((c, i) => (
        <PlanchaCelda key={c.label} bg={c.bg} first={i === 0}>
          <div style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{c.label}</div>
          <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 700, lineHeight: 1.05, marginTop: 6 }}>{c.value}</div>
        </PlanchaCelda>
      ))}
    </Plancha>
  )
}

function TablaResumen({ rows, cargando }: { rows: VentaRow[]; cargando: boolean }) {
  const th: React.CSSProperties = { fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: BLANCO, padding: '10px 12px', whiteSpace: 'nowrap' }
  const tdL: React.CSSProperties = { fontFamily: LEXEND, fontSize: 13, color: INK, padding: '9px 12px' }
  const tdR: React.CSSProperties = { ...tdL, fontFamily: OSWALD, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }

  if (cargando) return <Papel ceja={VERDE}><div style={{ textAlign: 'center', color: GRIS, fontFamily: LEXEND, padding: 10 }}>Cargando…</div></Papel>
  if (rows.length === 0) return (
    <Papel ceja={VERDE} style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: OSWALD, fontSize: 15, color: GRIS, letterSpacing: 1 }}>Sin ventas en este periodo</div>
      <div style={{ fontFamily: LEXEND, fontSize: 13, color: GRIS, marginTop: 6 }}>Sube liquidaciones o resúmenes de plataforma en Documentación → Bandeja</div>
    </Papel>
  )

  return (
    <Papel ceja={VERDE} pad="0" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEXEND, minWidth: 820 }}>
        <thead>
          <tr style={{ background: INK }}>
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
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom: `2px solid ${INK}` }}>
              <td style={tdL}>{fmtF(r.fecha_inicio_periodo)} – {fmtF(r.fecha_fin_periodo)}</td>
              <td style={tdL}><PastillaPlataforma plataforma={r.plataforma} /></td>
              <td style={tdL}>{r.marca === 'SIN_MARCA' ? <span style={{ color: GRIS, fontStyle: 'italic' }}>sin marca</span> : r.marca}</td>
              <td style={tdR}>{fmtEur(r.bruto)}</td>
              <td style={{ ...tdR, color: VERDE }}>{fmtEur(r.neto)}</td>
              <td style={tdR}>{nf0(r.pedidos)}</td>
              <td style={tdR}>{fmtEur(r.ticket_medio)}</td>
              <td style={tdL}>{fmtF(r.fecha_pago)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Papel>
  )
}

// ── PESTAÑA "DETALLE VENTAS" ────────────────────────────────────────────────
// Detalle granular de los pedidos (tabla pedidos_plataforma). El usuario elige por
// qué dimensión ver: plato, día, hora, marca, plataforma o tipo de línea. Y puede
// filtrar por tipo (solo platos, modificadores, cargos o bebidas). Todo vía la RPC
// fn_detalle_ventas, que agrupa en la BD y respeta los filtros de marca/canal de arriba.

const DIM_OPTS: Array<{ id: string; label: string }> = [
  { id: 'plato', label: 'Plato' },
  { id: 'dia', label: 'Día' },
  { id: 'hora', label: 'Hora' },
  { id: 'marca', label: 'Marca' },
  { id: 'plataforma', label: 'Plataforma' },
  { id: 'tipo', label: 'Tipo' },
]
const TIPO_OPTS: Array<{ id: string; label: string }> = [
  { id: '', label: 'Todo' },
  { id: 'plato', label: 'Solo platos' },
  { id: 'modificador', label: 'Modificadores' },
  { id: 'cargo', label: 'Cargos' },
  { id: 'bebida', label: 'Bebidas' },
]

function Pildora({ activo, children, onClick }: { activo: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 0, cursor: 'pointer',
      border: `2px solid ${INK}`,
      background: activo ? GRANATE : BLANCO,
      color: activo ? BLANCO : INK,
      boxShadow: activo ? SHADOW_DURA : 'none',
      fontFamily: OSWALD, fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', whiteSpace: 'nowrap',
    }}>{children}</button>
  )
}

function DetalleVentas({
  desde, hasta, marcasFiltro, canalesFiltro,
}: { desde: Date; hasta: Date; marcasFiltro: string[]; canalesFiltro: string[] }) {
  const [dim, setDim] = useState<string>('plato')
  const [tipo, setTipo] = useState<string>('')
  const [rows, setRows] = useState<DetalleRow[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let alive = true
    setCargando(true)
    const d = fechaLocalStr(desde), h = fechaLocalStr(hasta)
    const marcas = marcasFiltro.length ? marcasFiltro.map(m => (m === 'SIN_MARCA' ? 'Sin marca' : m)) : null
    const plats = canalesFiltro.length ? canalesFiltro : null
    supabase
      .rpc('fn_detalle_ventas', { p_desde: d, p_hasta: h, p_dim: dim, p_tipo: tipo || null, p_marcas: marcas, p_plats: plats })
      .then(({ data }) => { if (alive) { setRows((data as DetalleRow[]) ?? []); setCargando(false) } })
    return () => { alive = false }
  }, [desde, hasta, dim, tipo, marcasFiltro, canalesFiltro])

  const total = useMemo(() => ({
    unidades: rows.reduce((a, r) => a + (r.unidades || 0), 0),
    importe: rows.reduce((a, r) => a + (Number(r.importe) || 0), 0),
    items: rows.length,
  }), [rows])

  const maxU = Math.max(1, ...rows.map(r => r.unidades || 0))
  const dimLabel = DIM_OPTS.find(o => o.id === dim)?.label || 'Plato'
  const mostrarPlat = dim === 'plato' || dim === 'dia' || dim === 'hora'

  const th: React.CSSProperties = { fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: BLANCO, padding: '10px 12px', whiteSpace: 'nowrap' }
  const tdL: React.CSSProperties = { fontFamily: LEXEND, fontSize: 13, color: INK, padding: '9px 12px' }
  const tdR: React.CSSProperties = { ...tdL, fontFamily: OSWALD, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }

  return (
    <>
      {/* Mini-resumen del periodo */}
      <Plancha style={{ marginBottom: 14 }}>
        <PlanchaCelda bg={AZUL} first>
          <div style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Unidades</div>
          <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 700, lineHeight: 1.05, marginTop: 6 }}>{nf0(total.unidades)}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={NAR}>
          <div style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{dimLabel}s distintos</div>
          <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 700, lineHeight: 1.05, marginTop: 6 }}>{nf0(total.items)}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={VERDE}>
          <div style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Importe</div>
          <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 700, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(total.importe)}</div>
        </PlanchaCelda>
      </Plancha>

      {/* Selectores: ver por (dimensión) + filtro por tipo de línea — planos */}
      <div style={{ border: `2px solid ${INK}`, borderRadius: 0, padding: '12px 14px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 500, letterSpacing: '1.5px', color: GRIS, textTransform: 'uppercase', marginRight: 2 }}>Ver por</span>
          {DIM_OPTS.map(o => <Pildora key={o.id} activo={dim === o.id} onClick={() => setDim(o.id)}>{o.label}</Pildora>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 500, letterSpacing: '1.5px', color: GRIS, textTransform: 'uppercase', marginRight: 2 }}>Tipo</span>
          {TIPO_OPTS.map(o => <Pildora key={o.id || 'todo'} activo={tipo === o.id} onClick={() => setTipo(o.id)}>{o.label}</Pildora>)}
        </div>
      </div>

      {cargando ? (
        <Papel ceja={NAR}><div style={{ textAlign: 'center', color: GRIS, fontFamily: LEXEND, padding: 10 }}>Cargando…</div></Papel>
      ) : rows.length === 0 ? (
        <Papel ceja={NAR} style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: OSWALD, fontSize: 15, color: GRIS, letterSpacing: 1 }}>Sin datos en este periodo</div>
          <div style={{ fontFamily: LEXEND, fontSize: 13, color: GRIS, marginTop: 6 }}>Sube los pedidos de Glovo / Uber / Sincro en Documentación → Bandeja</div>
        </Papel>
      ) : (
        <Papel ceja={NAR} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEXEND, minWidth: 640 }}>
            <thead>
              <tr style={{ background: INK }}>
                <th style={{ ...th, textAlign: 'left', width: 44 }}>#</th>
                <th style={{ ...th, textAlign: 'left' }}>{dimLabel}</th>
                {mostrarPlat && <th style={{ ...th, textAlign: 'left' }}>Plataforma</th>}
                <th style={{ ...th, textAlign: 'right' }}>Unidades</th>
                <th style={{ ...th, textAlign: 'right' }}>Peso</th>
                <th style={{ ...th, textAlign: 'right' }}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.etiqueta}|${i}`} style={{ borderBottom: `2px solid ${INK}` }}>
                  <td style={{ ...tdR, textAlign: 'left', color: GRIS }}>{i + 1}</td>
                  <td style={tdL}>{dim === 'plataforma' ? <PastillaPlataforma plataforma={r.etiqueta} /> : (r.etiqueta || <span style={{ color: GRIS, fontStyle: 'italic' }}>sin valor</span>)}</td>
                  {mostrarPlat && <td style={tdL}><PastillaPlataforma plataforma={r.plataforma} /></td>}
                  <td style={tdR}>{nf0(r.unidades)}</td>
                  <td style={{ ...tdR, width: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <div style={{ height: 6, width: `${(r.unidades / maxU) * 60}px`, background: GRANATE }} />
                      <span style={{ color: GRIS, fontSize: 11 }}>{Math.round((r.unidades / total.unidades) * 100)}%</span>
                    </div>
                  </td>
                  <td style={tdR}>{Number(r.importe) ? fmtEur(Number(r.importe)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Papel>
      )}
    </>
  )
}

// ── PESTAÑA "LIQUIDACIONES" ─────────────────────────────────────────────────
// Lo que cada plataforma te liquida de verdad: ventas brutas, comisión, ads,
// promos y el pago neto que llega al banco. Lee la vista v_liquidaciones_plataforma
// (uber/glovo/just_eat normalizadas). Respeta los filtros de marca/canal de arriba.

interface LiqRow {
  id: string
  plataforma: string
  marca: string | null
  referencia: string | null
  fecha_inicio_periodo: string
  fecha_fin_periodo: string
  pedidos: number | null
  ventas_bruto: number | null
  comision: number | null
  ads: number | null
  promociones: number | null
  ajustes: number | null
  pago_neto: number | null
  fecha_cobro: string | null
  estado: string | null
  conciliacion_id: string | null
  doc_url: string | null
}

function Liquidaciones({
  desde, hasta, marcasFiltro, canalesFiltro,
}: { desde: Date; hasta: Date; marcasFiltro: string[]; canalesFiltro: string[] }) {
  const [rows, setRows] = useState<LiqRow[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let alive = true
    setCargando(true)
    const d = fechaLocalStr(desde), h = fechaLocalStr(hasta)
    supabase
      .from('v_liquidaciones_plataforma')
      .select('id, plataforma, marca, referencia, fecha_inicio_periodo, fecha_fin_periodo, pedidos, ventas_bruto, comision, ads, promociones, ajustes, pago_neto, fecha_cobro, estado, conciliacion_id, doc_url')
      .lte('fecha_inicio_periodo', h)
      .gte('fecha_fin_periodo', d)
      .order('fecha_fin_periodo', { ascending: false })
      .then(({ data }) => { if (alive) { setRows((data as LiqRow[]) ?? []); setCargando(false) } })
    return () => { alive = false }
  }, [desde, hasta])

  const rowsF = useMemo(() => rows.filter(r =>
    (canalesFiltro.length === 0 || canalesFiltro.includes(r.plataforma)) &&
    (marcasFiltro.length === 0 || marcasFiltro.includes(r.marca || 'SIN_MARCA'))
  ), [rows, canalesFiltro, marcasFiltro])

  const t = useMemo(() => {
    const bruto = rowsF.reduce((a, r) => a + (Number(r.ventas_bruto) || 0), 0)
    const comision = rowsF.reduce((a, r) => a + (Number(r.comision) || 0), 0)
    const adsPromo = rowsF.reduce((a, r) => a + (Number(r.ads) || 0) + (Number(r.promociones) || 0), 0)
    const neto = rowsF.reduce((a, r) => a + (Number(r.pago_neto) || 0), 0)
    const pedidos = rowsF.reduce((a, r) => a + (Number(r.pedidos) || 0), 0)
    const pctComision = bruto > 0 ? (comision / bruto) * 100 : 0
    const pctNeto = bruto > 0 ? (neto / bruto) * 100 : 0
    return { bruto, comision, adsPromo, neto, pedidos, pctComision, pctNeto }
  }, [rowsF])

  const pct = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

  const th: React.CSSProperties = { fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: BLANCO, padding: '10px 12px', whiteSpace: 'nowrap' }
  const tdL: React.CSSProperties = { fontFamily: LEXEND, fontSize: 13, color: INK, padding: '9px 12px' }
  const tdR: React.CSSProperties = { ...tdL, fontFamily: OSWALD, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }

  const cards = [
    { label: 'Ventas (bruto)', value: fmtEur(t.bruto), sub: `${nf0(t.pedidos)} pedidos`, bg: AZUL },
    { label: 'Comisión plataforma', value: fmtEur(t.comision), sub: `${pct(t.pctComision)} s/bruto`, bg: GRANATE },
    { label: 'Ads + Promos', value: fmtEur(t.adsPromo), sub: 'inversión en visibilidad', bg: NAR },
    { label: 'Pago neto (al banco)', value: fmtEur(t.neto), sub: 'lo que llega de verdad', bg: VERDE },
    { label: 'Te queda', value: pct(t.pctNeto), sub: 'de cada euro vendido', bg: AMA },
  ]

  return (
    <>
      <Plancha style={{ marginBottom: 14 }}>
        {cards.map((c, i) => (
          <PlanchaCelda key={c.label} bg={c.bg} first={i === 0}>
            <div style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{c.label}</div>
            <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 700, lineHeight: 1.05, marginTop: 6 }}>{c.value}</div>
            <div style={{ fontFamily: LEXEND, fontSize: 11, marginTop: 4, opacity: 0.85 }}>{c.sub}</div>
          </PlanchaCelda>
        ))}
      </Plancha>

      {cargando ? (
        <Papel ceja={GRANATE}><div style={{ textAlign: 'center', color: GRIS, fontFamily: LEXEND, padding: 10 }}>Cargando…</div></Papel>
      ) : rowsF.length === 0 ? (
        <Papel ceja={GRANATE} style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: OSWALD, fontSize: 15, color: GRIS, letterSpacing: 1 }}>Sin liquidaciones en este periodo</div>
          <div style={{ fontFamily: LEXEND, fontSize: 13, color: GRIS, marginTop: 6 }}>Pulsa “Recoger correo” en Documentación para importar los resúmenes de pago de las plataformas</div>
        </Papel>
      ) : (
        <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEXEND, minWidth: 980 }}>
            <thead>
              <tr style={{ background: INK }}>
                <th style={{ ...th, textAlign: 'left' }}>Periodo</th>
                <th style={{ ...th, textAlign: 'left' }}>Plataforma</th>
                <th style={{ ...th, textAlign: 'left' }}>Marca</th>
                <th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
                <th style={{ ...th, textAlign: 'right' }}>Bruto</th>
                <th style={{ ...th, textAlign: 'right' }}>Comisión</th>
                <th style={{ ...th, textAlign: 'right' }}>Ads+Promo</th>
                <th style={{ ...th, textAlign: 'right' }}>Neto</th>
                <th style={{ ...th, textAlign: 'right' }}>Te queda</th>
                <th style={{ ...th, textAlign: 'left' }}>Cobro</th>
                <th style={{ ...th, textAlign: 'center' }}>Doc</th>
              </tr>
            </thead>
            <tbody>
              {rowsF.map(r => {
                const bruto = Number(r.ventas_bruto) || 0
                const neto = Number(r.pago_neto) || 0
                const adsPromo = (Number(r.ads) || 0) + (Number(r.promociones) || 0)
                const pNeto = bruto > 0 ? (neto / bruto) * 100 : 0
                const sinMarca = !r.marca || r.marca === 'SIN_MARCA'
                return (
                  <tr key={r.id} style={{ borderBottom: `2px solid ${INK}`, background: sinMarca ? `${NAR}14` : 'transparent' }}>
                    <td style={tdL}>{fmtF(r.fecha_inicio_periodo)} – {fmtF(r.fecha_fin_periodo)}</td>
                    <td style={tdL}><PastillaPlataforma plataforma={r.plataforma} /></td>
                    <td style={tdL}>{sinMarca ? <span style={{ color: NAR, fontWeight: 600 }}>⚠ Marca sin detectar — revisar</span> : r.marca}</td>
                    <td style={tdR}>{r.pedidos != null ? nf0(r.pedidos) : '—'}</td>
                    <td style={tdR}>{fmtEur(bruto)}</td>
                    <td style={{ ...tdR, color: GRANATE }}>{r.comision != null ? fmtEur(Number(r.comision)) : '—'}</td>
                    <td style={{ ...tdR, color: adsPromo > 0 ? GRANATE : GRIS }}>{adsPromo > 0 ? fmtEur(adsPromo) : '—'}</td>
                    <td style={{ ...tdR, color: VERDE }}>{fmtEur(neto)}</td>
                    <td style={{ ...tdR, color: pNeto < 45 ? ROJO : INK }}>{bruto > 0 ? pct(pNeto) : '—'}</td>
                    <td style={tdL}>{fmtF(r.fecha_cobro)}</td>
                    <td style={{ ...tdL, textAlign: 'center' }}>
                      {r.doc_url
                        ? <a href={r.doc_url} target="_blank" rel="noopener noreferrer" style={{ color: GRANATE, textDecoration: 'none', fontFamily: OSWALD, fontWeight: 600 }}>ver</a>
                        : <span style={{ color: GRIS }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Papel>
      )}
    </>
  )
}

export function Ventas({ embedded = false }: { embedded?: boolean } = {}) {
  const [tab, setTab] = useState<Tab>(loadTab())
  const cambiar = (t: Tab) => { setTab(t); try { sessionStorage.setItem(STORAGE_KEY, t) } catch { /* */ } }

  const [desde, setDesde] = useState<Date>(new Date())
  const [hasta, setHasta] = useState<Date>(new Date())
  const [rows, setRows] = useState<VentaRow[]>([])
  const [cargando, setCargando] = useState(true)

  // Marcas/plataformas presentes en los pedidos del periodo (para poblar los filtros).
  const [marcasPed, setMarcasPed] = useState<string[]>([])
  const [platsPed, setPlatsPed] = useState<string[]>([])

  const [marcasFiltro, setMarcasFiltro] = useState<string[]>([])
  const [canalesFiltro, setCanalesFiltro] = useState<string[]>([])

  // Resúmenes de liquidación por periodo (pestaña Resumen).
  useEffect(() => {
    let alive = true
    setCargando(true)
    const d = fechaLocalStr(desde), h = fechaLocalStr(hasta)
    supabase
      .from('ventas_plataforma')
      .select('id, fecha_inicio_periodo, fecha_fin_periodo, plataforma, marca, bruto, neto, pedidos, ticket_medio, ingreso_colaborador, fecha_pago')
      .lte('fecha_inicio_periodo', h)
      .gte('fecha_fin_periodo', d)
      .order('fecha_fin_periodo', { ascending: false })
      .then(({ data }) => { if (alive) { setRows((data as VentaRow[]) ?? []); setCargando(false) } })
    return () => { alive = false }
  }, [desde, hasta])

  // Opciones de marca/plataforma para los filtros, desde los pedidos del periodo.
  useEffect(() => {
    let alive = true
    const d = fechaLocalStr(desde), h = fechaLocalStr(hasta)
    Promise.all([
      supabase.rpc('fn_detalle_ventas', { p_desde: d, p_hasta: h, p_dim: 'marca' }),
      supabase.rpc('fn_detalle_ventas', { p_desde: d, p_hasta: h, p_dim: 'plataforma' }),
    ]).then(([m, p]) => {
      if (!alive) return
      setMarcasPed(((m.data as DetalleRow[]) ?? []).map(r => r.etiqueta))
      setPlatsPed(((p.data as DetalleRow[]) ?? []).map(r => r.etiqueta))
    })
    return () => { alive = false }
  }, [desde, hasta])

  const marcasOpts = useMemo(() => {
    const set = new Map<string, string>()
    const add = (m: string | undefined) => {
      const id = !m || m === 'SIN_MARCA' || m === 'Sin marca' ? 'SIN_MARCA' : m
      set.set(id, id === 'SIN_MARCA' ? 'Sin marca' : id)
    }
    for (const r of rows) add(r.marca)
    for (const m of marcasPed) add(m)
    return Array.from(set, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [rows, marcasPed])

  const canalesOpts = useMemo(() => {
    const presentes = Array.from(new Set([...rows.map(r => r.plataforma), ...platsPed]))
    const orden = ['uber', 'glovo', 'just_eat', 'rushour', 'desconocido']
    return presentes.sort((a, b) => orden.indexOf(a) - orden.indexOf(b)).map(p => ({ id: p, label: nombrePlat(p) }))
  }, [rows, platsPed])

  const rowsFiltradas = useMemo(() => rows.filter(r =>
    (canalesFiltro.length === 0 || canalesFiltro.includes(r.plataforma)) &&
    (marcasFiltro.length === 0 || marcasFiltro.includes(r.marca || 'SIN_MARCA'))
  ), [rows, canalesFiltro, marcasFiltro])

  const totalesHero = useMemo(() => {
    const bruto = rowsFiltradas.reduce((a, r) => a + (r.bruto || 0), 0)
    const neto = rowsFiltradas.reduce((a, r) => a + (r.neto || 0), 0)
    const pedidos = rowsFiltradas.reduce((a, r) => a + (r.pedidos || 0), 0)
    const comision = bruto - neto
    const pctComision = bruto > 0 ? (comision / bruto) * 100 : 0
    return { bruto, neto, pedidos, comision, pctComision }
  }, [rowsFiltradas])

  const titular = totalesHero.bruto === 0
    ? 'Aún no hay ventas registradas en este periodo.'
    : <>Tus canales mueven <b>{fmtEur(totalesHero.bruto)}</b> en ventas brutas este periodo.</>

  const atencion = [
    `Bruto ${fmtEur(totalesHero.bruto)}`,
    totalesHero.bruto > 0 ? `Comisión plataformas ${totalesHero.pctComision.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%` : null,
    marcasFiltro.length > 0 ? `${marcasFiltro.length} marca${marcasFiltro.length > 1 ? 's' : ''} filtrada${marcasFiltro.length > 1 ? 's' : ''}` : null,
    canalesFiltro.length > 0 ? `${canalesFiltro.length} canal${canalesFiltro.length > 1 ? 'es' : ''} filtrado${canalesFiltro.length > 1 ? 's' : ''}` : null,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera embedded={embedded}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <SelectorFechaUniversal nombreModulo="ventas" defaultOpcion="este_mes" onChange={(d, h) => { setDesde(d); setHasta(h) }} />
        <MultiSelect label="Todas las marcas" options={marcasOpts} selected={marcasFiltro}
          onToggle={id => setMarcasFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
          onAll={() => setMarcasFiltro([])} />
        <MultiSelect label="Canales" options={canalesOpts} selected={canalesFiltro}
          onToggle={id => setCanalesFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
          onAll={() => setCanalesFiltro([])} />
      </div>

      {/* 1 · Héroe del área Ventas (verde) */}
      <HeroCantera
        area="ventas"
        periodo={`${fmtF(fechaLocalStr(desde))} – ${fmtF(fechaLocalStr(hasta))}`}
        titular={titular}
        etiquetaDato="Te pagan (neto)"
        cifra={fmtEur(totalesHero.neto)}
        resumen={<>{nf0(totalesHero.pedidos)} pedidos en el periodo.</>}
        atencion={atencion}
      />

      {/* 2 · Plancha comparativa de KPIs (pestaña Resumen) */}
      {tab === 'resumen' && <CardsResumen rows={rowsFiltradas} />}

      {/* 3 · Frase potente (coste · granate, distinto del héroe verde) */}
      {totalesHero.bruto > 0 && (
        <FrasePotente significado="coste">Las plataformas se quedan {totalesHero.pctComision.toLocaleString('es-ES', { maximumFractionDigits: 1 })}% de tus ventas brutas: cada punto que bajes es margen directo.</FrasePotente>
      )}

      <TabsPastilla
        tabs={[
          { id: 'resumen', label: 'Resumen ventas' },
          { id: 'detalle', label: 'Detalle ventas' },
          { id: 'liquidaciones', label: 'Liquidaciones' },
          { id: 'pareto', label: 'Pareto Ventas' },
        ]}
        activeId={tab}
        onChange={(id) => cambiar(id as Tab)}
      />

      <Suspense fallback={<div style={{ padding: 24, color: GRIS, fontFamily: LEXEND }}>Cargando…</div>}>
        {tab === 'resumen' && <TablaResumen rows={rowsFiltradas} cargando={cargando} />}
        {tab === 'detalle' && (
          <>
            <PanelInteligenciaVentas desde={desde} hasta={hasta} marcasFiltro={marcasFiltro} canalesFiltro={canalesFiltro} />
            <div style={{ height: 18 }} />
            <DetalleVentas desde={desde} hasta={hasta} marcasFiltro={marcasFiltro} canalesFiltro={canalesFiltro} />
          </>
        )}
        {tab === 'liquidaciones' && <Liquidaciones desde={desde} hasta={hasta} marcasFiltro={marcasFiltro} canalesFiltro={canalesFiltro} />}
        {tab === 'pareto' && <ParetoVentas />}
      </Suspense>
    </PantallaCantera>
  )
}

export default Ventas
