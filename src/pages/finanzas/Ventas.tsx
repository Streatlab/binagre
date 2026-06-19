import { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react'
import { ChevronDown } from 'lucide-react'
import TabsPastilla from '@/components/ui/TabsPastilla'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import { supabase } from '@/lib/supabase'
import { fechaLocalStr } from '@/utils/fechaLocal'
import { fmtEur } from '@/utils/format'
import { COLOR, COLORS, OSWALD, LEXEND, CARDS } from '@/components/panel/resumen/tokens'

// Pareto Ventas ya existe como página; se monta aquí como pestaña sin tocar su lógica.
const ParetoVentas = lazy(() => import('@/pages/analytics/ParetoVentas'))

type Tab = 'resumen' | 'platos' | 'pareto'
const STORAGE_KEY = 'ventas:tab'

function loadTab(): Tab {
  try {
    const r = sessionStorage.getItem(STORAGE_KEY)
    if (r === 'resumen' || r === 'platos' || r === 'pareto') return r
    if (r === 'detalle') return 'resumen' // compat con el nombre anterior
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

// Filas de las vistas de pedidos por plato / franja (alimentadas por pedidos_plataforma).
interface PlatoRow {
  plataforma: string; marca: string; plato: string; fecha: string
  lineas: number; importe_bruto: number; promo: number
}
interface FranjaRow {
  plataforma: string; marca: string; fecha: string; hora: number
  pedidos: number; importe_bruto: number
}

const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES')
const fmtF = (s: string | null) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

// La BD guarda el código de plataforma ('uber'/'glovo'/'just_eat'). Estos mapas lo
// muestran con su nombre y colores canónicos de marca.
const NOMBRE_PLAT: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat', rushour: 'Rushour', desconocido: 'Desconocido',
}
// Pastilla de color por plataforma (estilo etiqueta de Facturación): fondo suave + texto legible.
const PILL_PLAT: Record<string, { bg: string; tx: string }> = {
  uber:     { bg: '#06C16722', tx: '#05833f' },
  glovo:    { bg: '#F2D20033', tx: '#8a7400' },
  just_eat: { bg: '#FF800022', tx: '#c25e00' },
  rushour:  { bg: '#1e223318', tx: '#1e2233' },
  desconocido: { bg: '#9aa0ad22', tx: '#6b7280' },
}
const nombrePlat = (p: string) => NOMBRE_PLAT[p] || p
const pillPlat = (p: string) => PILL_PLAT[p] || PILL_PLAT.desconocido

function PastillaPlataforma({ plataforma }: { plataforma: string }) {
  const c = pillPlat(plataforma)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 999,
      background: c.bg, color: c.tx,
      fontFamily: OSWALD, fontSize: 12, fontWeight: 600, letterSpacing: '0.3px',
      whiteSpace: 'nowrap',
    }}>{nombrePlat(plataforma)}</span>
  )
}

// ── Multi-selector (mismo patrón que Panel Global) ─────────────────────────
const dropdownBtn: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, border: '0.5px solid #d0c8bc',
  background: '#ffffff', fontSize: 13, fontFamily: 'Lexend, sans-serif', color: '#111111',
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', position: 'relative',
}
const menuStyle: React.CSSProperties = {
  position: 'absolute', top: 38, right: 0, background: '#ffffff', border: '0.5px solid #d0c8bc',
  borderRadius: 8, width: 260, fontSize: 12, color: '#3a4050', boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
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
              color: '#7a8090', cursor: 'pointer', borderBottom: '0.5px solid #ebe8e2',
            }}
            onClick={() => { onAll(); setOpen(false) }}
          >Todos</button>
          {options.length === 0 && (
            <div style={{ padding: '8px 12px', color: '#9aa0ad', fontFamily: 'Lexend, sans-serif', fontSize: 12 }}>Sin datos</div>
          )}
          {options.map(o => (
            <label key={o.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '2px 10px', cursor: 'pointer', lineHeight: 1.3,
              background: selected.includes(o.id) ? '#FF475715' : 'transparent',
              color: selected.includes(o.id) ? '#FF4757' : '#7a8090',
              fontFamily: 'Lexend, sans-serif', fontSize: 12, whiteSpace: 'nowrap',
            }}>
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => onToggle(o.id)} style={{ accentColor: '#FF4757' }} />
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
            {rows.map(r => (
              <tr key={r.id}>
                <td style={tdL}>{fmtF(r.fecha_inicio_periodo)} – {fmtF(r.fecha_fin_periodo)}</td>
                <td style={tdL}><PastillaPlataforma plataforma={r.plataforma} /></td>
                <td style={tdL}>{r.marca === 'SIN_MARCA' ? <span style={{ color: COLORS.mut, fontStyle: 'italic' }}>sin marca</span> : r.marca}</td>
                <td style={tdR}>{fmtEur(r.bruto)}</td>
                <td style={{ ...tdR, color: COLORS.ok }}>{fmtEur(r.neto)}</td>
                <td style={tdR}>{nf0(r.pedidos)}</td>
                <td style={tdR}>{fmtEur(r.ticket_medio)}</td>
                <td style={tdL}>{fmtF(r.fecha_pago)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── PESTAÑA "POR PLATO Y FRANJA" ────────────────────────────────────────────
// Lee de las vistas v_ventas_plato y v_ventas_franja (alimentadas por la ingesta de
// pedidos de Glovo/Uber/Sincro). Muestra el ranking de platos del periodo y las
// ventas por hora del día.

function MiniCards({ unidades, platos, horaPico }: { unidades: number; platos: number; horaPico: string }) {
  const cards = [
    { label: 'Unidades vendidas', value: nf0(unidades), color: COLORS.pri },
    { label: 'Platos distintos', value: nf0(platos), color: COLORS.pri },
    { label: 'Franja pico', value: horaPico, color: COLORS.redSL },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
      {cards.map(c => (
        <div key={c.label} style={{ ...CARDS.std }}>
          <div style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 500, letterSpacing: '1.5px', color: COLORS.mut, textTransform: 'uppercase' }}>{c.label}</div>
          <div style={{ fontFamily: OSWALD, fontSize: 30, fontWeight: 600, color: c.color, lineHeight: 1.05, marginTop: 6 }}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}

function FranjasHorarias({ rows }: { rows: FranjaRow[] }) {
  const porHora = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ hora: h, pedidos: 0 }))
    for (const r of rows) { if (r.hora >= 0 && r.hora < 24) arr[r.hora].pedidos += r.pedidos || 0 }
    return arr
  }, [rows])
  const max = Math.max(1, ...porHora.map(x => x.pedidos))

  return (
    <div style={{ ...CARDS.std, marginBottom: 14 }}>
      <div style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 500, letterSpacing: '1.5px', color: COLORS.mut, textTransform: 'uppercase', marginBottom: 14 }}>Ventas por franja horaria</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 150 }}>
        {porHora.map(b => (
          <div key={b.hora} title={`${String(b.hora).padStart(2, '0')}:00 · ${nf0(b.pedidos)} pedidos`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{
              width: '100%', height: `${(b.pedidos / max) * 100}%`, minHeight: b.pedidos > 0 ? 3 : 0,
              background: b.pedidos === max ? COLORS.redSL : '#d9b6b8', borderRadius: '3px 3px 0 0',
            }} />
            <span style={{ fontFamily: OSWALD, fontSize: 9, color: COLORS.mut }}>{b.hora % 2 === 0 ? b.hora : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RankingPlatos({ rows }: { rows: PlatoRow[] }) {
  const grouped = useMemo(() => {
    const m = new Map<string, { plato: string; plataforma: string; marca: string; unidades: number; importe: number }>()
    for (const r of rows) {
      const k = `${r.plato}|${r.plataforma}|${r.marca}`
      const g = m.get(k) || { plato: r.plato, plataforma: r.plataforma, marca: r.marca, unidades: 0, importe: 0 }
      g.unidades += r.lineas || 0
      g.importe += r.importe_bruto || 0
      m.set(k, g)
    }
    return Array.from(m.values()).sort((a, b) => b.unidades - a.unidades)
  }, [rows])

  const th: React.CSSProperties = { fontFamily: OSWALD, fontSize: 10, fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.mut, padding: '10px 12px', borderBottom: `0.5px solid ${COLORS.brd}`, whiteSpace: 'nowrap' }
  const tdL: React.CSSProperties = { fontFamily: LEXEND, fontSize: 13, color: COLORS.pri, padding: '9px 12px', borderBottom: `0.5px solid ${COLORS.brd}` }
  const tdR: React.CSSProperties = { ...tdL, fontFamily: OSWALD, fontWeight: 500, textAlign: 'right', whiteSpace: 'nowrap' }

  if (grouped.length === 0) return (
    <div style={{ ...CARDS.std, textAlign: 'center', padding: 36 }}>
      <div style={{ fontFamily: OSWALD, fontSize: 15, color: COLORS.mut, letterSpacing: 1 }}>Sin platos en este periodo</div>
      <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLORS.mut, marginTop: 6 }}>Sube los pedidos de Glovo / Uber / Sincro en Documentación → Bandeja</div>
    </div>
  )

  return (
    <div style={{ ...CARDS.std, padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', width: 44 }}>#</th>
              <th style={{ ...th, textAlign: 'left' }}>Plato</th>
              <th style={{ ...th, textAlign: 'left' }}>Plataforma</th>
              <th style={{ ...th, textAlign: 'left' }}>Marca</th>
              <th style={{ ...th, textAlign: 'right' }}>Unidades</th>
              <th style={{ ...th, textAlign: 'right' }}>Importe</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g, i) => (
              <tr key={`${g.plato}|${g.plataforma}|${g.marca}|${i}`}>
                <td style={{ ...tdR, textAlign: 'left', color: COLORS.mut }}>{i + 1}</td>
                <td style={tdL}>{g.plato}</td>
                <td style={tdL}><PastillaPlataforma plataforma={g.plataforma} /></td>
                <td style={tdL}>{!g.marca || g.marca === 'Sin marca' || g.marca === 'SIN_MARCA' ? <span style={{ color: COLORS.mut, fontStyle: 'italic' }}>sin marca</span> : g.marca}</td>
                <td style={tdR}>{nf0(g.unidades)}</td>
                <td style={tdR}>{fmtEur(g.importe)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TabPlatosFranja({ platos, franja, cargando }: { platos: PlatoRow[]; franja: FranjaRow[]; cargando: boolean }) {
  const resumen = useMemo(() => {
    const unidades = platos.reduce((a, r) => a + (r.lineas || 0), 0)
    const distintos = new Set(platos.map(r => r.plato)).size
    const porHora = Array.from({ length: 24 }, (_, h) => ({ hora: h, pedidos: 0 }))
    for (const r of franja) { if (r.hora >= 0 && r.hora < 24) porHora[r.hora].pedidos += r.pedidos || 0 }
    const pico = porHora.reduce((best, x) => (x.pedidos > best.pedidos ? x : best), { hora: -1, pedidos: 0 })
    const horaPico = pico.hora < 0 ? '—' : `${String(pico.hora).padStart(2, '0')}–${String((pico.hora + 1) % 24).padStart(2, '0')}h`
    return { unidades, distintos, horaPico }
  }, [platos, franja])

  if (cargando) return <div style={{ ...CARDS.std, textAlign: 'center', color: COLORS.mut, fontFamily: LEXEND, padding: 28 }}>Cargando…</div>

  return (
    <>
      <MiniCards unidades={resumen.unidades} platos={resumen.distintos} horaPico={resumen.horaPico} />
      <FranjasHorarias rows={franja} />
      <RankingPlatos rows={platos} />
    </>
  )
}

export default function Ventas() {
  const [tab, setTab] = useState<Tab>(loadTab())
  const cambiar = (t: Tab) => { setTab(t); try { sessionStorage.setItem(STORAGE_KEY, t) } catch { /* */ } }

  const [desde, setDesde] = useState<Date>(new Date())
  const [hasta, setHasta] = useState<Date>(new Date())
  const [rows, setRows] = useState<VentaRow[]>([])
  const [cargando, setCargando] = useState(true)

  // Datos de la pestaña "Por plato y franja".
  const [platos, setPlatos] = useState<PlatoRow[]>([])
  const [franja, setFranja] = useState<FranjaRow[]>([])
  const [cargandoPlatos, setCargandoPlatos] = useState(true)

  // Filtros (mismo patrón que Panel Global): marcas + canales/plataformas.
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

  // Pedidos por plato y por franja del periodo (pestaña Por plato y franja).
  useEffect(() => {
    let alive = true
    setCargandoPlatos(true)
    const d = fechaLocalStr(desde), h = fechaLocalStr(hasta)
    Promise.all([
      supabase.from('v_ventas_plato').select('*').gte('fecha', d).lte('fecha', h),
      supabase.from('v_ventas_franja').select('*').gte('fecha', d).lte('fecha', h),
    ]).then(([p, f]) => {
      if (!alive) return
      setPlatos((p.data as PlatoRow[]) ?? [])
      setFranja((f.data as FranjaRow[]) ?? [])
      setCargandoPlatos(false)
    })
    return () => { alive = false }
  }, [desde, hasta])

  // Opciones de los filtros: unión de lo que haya en ambas fuentes del periodo.
  const marcasOpts = useMemo(() => {
    const set = new Map<string, string>()
    const add = (m: string | undefined) => {
      const id = m || 'SIN_MARCA'
      const norm = id === 'SIN_MARCA' || id === 'Sin marca' ? 'SIN_MARCA' : id
      set.set(norm, norm === 'SIN_MARCA' ? 'Sin marca' : norm)
    }
    for (const r of rows) add(r.marca)
    for (const r of platos) add(r.marca)
    return Array.from(set, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [rows, platos])

  const canalesOpts = useMemo(() => {
    const presentes = Array.from(new Set([...rows.map(r => r.plataforma), ...platos.map(r => r.plataforma)]))
    const orden = ['uber', 'glovo', 'just_eat', 'rushour', 'desconocido']
    return presentes
      .sort((a, b) => orden.indexOf(a) - orden.indexOf(b))
      .map(p => ({ id: p, label: nombrePlat(p) }))
  }, [rows, platos])

  const coincideMarca = (m: string | undefined) => {
    if (marcasFiltro.length === 0) return true
    const id = !m || m === 'Sin marca' || m === 'SIN_MARCA' ? 'SIN_MARCA' : m
    return marcasFiltro.includes(id)
  }

  const rowsFiltradas = useMemo(() => rows.filter(r =>
    (canalesFiltro.length === 0 || canalesFiltro.includes(r.plataforma)) && coincideMarca(r.marca)
  ), [rows, canalesFiltro, marcasFiltro])

  const platosFiltrados = useMemo(() => platos.filter(r =>
    (canalesFiltro.length === 0 || canalesFiltro.includes(r.plataforma)) && coincideMarca(r.marca)
  ), [platos, canalesFiltro, marcasFiltro])

  const franjaFiltrada = useMemo(() => franja.filter(r =>
    (canalesFiltro.length === 0 || canalesFiltro.includes(r.plataforma)) && coincideMarca(r.marca)
  ), [franja, canalesFiltro, marcasFiltro])

  return (
    <div style={{ background: COLOR.bgPagina, padding: '24px 28px', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ color: COLORS.redSL, fontFamily: OSWALD, fontSize: 22, fontWeight: 600, letterSpacing: '3px', margin: 0, textTransform: 'uppercase' }}>VENTAS</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SelectorFechaUniversal nombreModulo="ventas" defaultOpcion="este_mes" onChange={(d, h) => { setDesde(d); setHasta(h) }} />
          <MultiSelect label="Todas las marcas" options={marcasOpts} selected={marcasFiltro}
            onToggle={id => setMarcasFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            onAll={() => setMarcasFiltro([])} />
          <MultiSelect label="Canales" options={canalesOpts} selected={canalesFiltro}
            onToggle={id => setCanalesFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            onAll={() => setCanalesFiltro([])} />
        </div>
      </div>

      {tab === 'resumen' && <CardsResumen rows={rowsFiltradas} />}

      <TabsPastilla
        tabs={[
          { id: 'resumen', label: 'Resumen ventas' },
          { id: 'platos', label: 'Por plato y franja' },
          { id: 'pareto', label: 'Pareto Ventas' },
        ]}
        activeId={tab}
        onChange={(id) => cambiar(id as Tab)}
      />

      <Suspense fallback={<div style={{ padding: 24, color: COLORS.mut, fontFamily: LEXEND }}>Cargando…</div>}>
        {tab === 'resumen' && <TablaDetalle rows={rowsFiltradas} cargando={cargando} />}
        {tab === 'platos' && <TabPlatosFranja platos={platosFiltrados} franja={franjaFiltrada} cargando={cargandoPlatos} />}
        {tab === 'pareto' && <ParetoVentas />}
      </Suspense>
    </div>
  )
}
