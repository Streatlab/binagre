import { useMemo, useState, useEffect, type CSSProperties } from 'react'
import { Search, Zap } from 'lucide-react'
import { fmtEur, fmtDate } from '@/utils/format'
import { useTheme, FONT, fmtFechaCorta } from '@/styles/tokens'
import { KpiCard } from '@/components/KpiCard'
import { useConciliacion } from '@/hooks/useConciliacion'
import type { Movimiento, CategoriaPyg } from '@/types/conciliacion'

// ─── tipos ────────────────────────────────────────────────────────────────────

type Tab = 'movimientos' | 'reglas'
type PeriodoKey = 'semana' | 'mes' | 'trim' | 'anio' | 'custom'
type FiltroRapido = 'sin_cat' | 'sin_doc' | 'ingreso' | 'gasto' | null

interface Regla {
  id: string
  patron: string
  categoria_id: string
  contraparte?: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function loadTab(): Tab {
  try { return (sessionStorage.getItem('conciliacion:tab') as Tab) || 'movimientos' }
  catch { return 'movimientos' }
}
function saveTab(t: Tab) {
  try { sessionStorage.setItem('conciliacion:tab', t) } catch { /* noop */ }
}

function periodoRango(key: PeriodoKey): { desde: Date; hasta: Date; label: string } {
  const hoy = new Date()
  const y = hoy.getFullYear(), m = hoy.getMonth(), d = hoy.getDate()
  if (key === 'semana') {
    const lunes = new Date(hoy); lunes.setDate(d - ((hoy.getDay() + 6) % 7)); lunes.setHours(0,0,0,0)
    const dom = new Date(lunes); dom.setDate(lunes.getDate() + 6); dom.setHours(23,59,59,999)
    return { desde: lunes, hasta: dom, label: 'Esta semana' }
  }
  if (key === 'mes') {
    return { desde: new Date(y, m, 1), hasta: new Date(y, m + 1, 0, 23, 59, 59, 999), label: 'Mes en curso' }
  }
  if (key === 'trim') {
    const q = Math.floor(m / 3)
    return { desde: new Date(y, q * 3, 1), hasta: new Date(y, q * 3 + 3, 0, 23, 59, 59, 999), label: `T${q + 1} ${y}` }
  }
  if (key === 'anio') {
    return { desde: new Date(y, 0, 1), hasta: new Date(y, 11, 31, 23, 59, 59, 999), label: `${y}` }
  }
  return { desde: new Date(y, m, 1), hasta: new Date(y, m + 1, 0, 23, 59, 59, 999), label: 'Mes en curso' }
}

// ─── componente ───────────────────────────────────────────────────────────────

export default function Conciliacion() {
  const { T } = useTheme()

  const [tab, setTab]           = useState<Tab>(loadTab())
  const [periodo, setPeriodo]   = useState<PeriodoKey>('mes')
  const [customDesde, setCustomDesde] = useState<string>('')
  const [customHasta, setCustomHasta] = useState<string>('')

  const { desde: defDesde, hasta: defHasta, label: defLabel } = periodoRango('mes')

  const [periodoDesde, setPeriodoDesde] = useState<Date>(() => {
    return defDesde
  })
  const [periodoHasta, setPeriodoHasta] = useState<Date>(() => {
    return defHasta
  })
  const [periodoLabelSFU, setPeriodoLabelSFU] = useState('Mes en curso')
  const [catFiltro, setCatFiltro] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [filtroCard, setFiltroCard] = useState<'pendientes' | 'ingreso' | 'gasto' | null>(null)

  type FiltroRapido = 'sin_cat' | 'sin_doc' | 'ingreso' | 'gasto' | null
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>(null)
  const [modalGastoOpen, setModalGastoOpen] = useState(false)

  const [importResult, setImportResult] = useState<{ insertados: number; duplicados: number; omitidos: number } | null>(null)

  const [reglas, setReglas] = useState<Regla[]>([])
  const {
    movimientos: movimientosBD,
    insertMovimientos,
    updateCategoria,
    categorias: categoriasBD,
    loading: loadingBD,
  } = useConciliacion()

  /* — Agrupación para el dropdown: Ingresos arriba, gastos por `grupo` — */
  const dropdownGroups = useMemo(() => {
    const ingresos = categoriasBD.filter(c => c.tipo_parent === 'ingreso')
    const gastos   = categoriasBD.filter(c => c.tipo_parent === 'gasto')
    const grupos   = [...new Set(gastos.map(c => c.grupo).filter(Boolean))]
    return {
      ingresos,
      gastos,
      grupos,
      porGrupo: (g: string) => gastos.filter(c => c.grupo === g),
    }
  }, [categoriasBD])

  /* — Cambio de periodo — */
  const aplicarPeriodo = (key: PeriodoKey, cd?: string, ch?: string) => {
    if (key === 'custom' && cd && ch) {
      setPeriodoDesde(new Date(cd + 'T00:00:00'))
      setPeriodoHasta(new Date(ch + 'T23:59:59'))
      setPeriodoLabelSFU(`${cd} → ${ch}`)
    } else {
      const r = periodoRango(key)
      setPeriodoDesde(r.desde)
      setPeriodoHasta(r.hasta)
      setPeriodoLabelSFU(r.label)
    }
    setPeriodo(key)
  }

  /* — Movimientos filtrados por periodo — */
  const movimientosPeriodo = useMemo(() =>
    movimientosBD.filter(m => {
      const f = new Date(m.fecha + 'T00:00:00')
      return f >= periodoDesde && f <= periodoHasta
    }),
  [movimientosBD, periodoDesde, periodoHasta])

  /* — KPIs — */
  const kpis = useMemo(() => {
    const total   = movimientosPeriodo.length
    const sinCat  = movimientosPeriodo.filter(m => !m.categoria_id).length
    const sinDoc  = movimientosPeriodo.filter(m => m.categoria_id && m.doc_estado === 'falta').length
    const pend    = sinCat + sinDoc
    const ingreso = movimientosPeriodo.filter(m => (m.importe ?? 0) > 0).reduce((s, m) => s + (m.importe ?? 0), 0)
    const gasto   = movimientosPeriodo.filter(m => (m.importe ?? 0) < 0).reduce((s, m) => s + (m.importe ?? 0), 0)
    return { total, sinCat, sinDoc, pend, ingreso, gasto }
  }, [movimientosPeriodo])

  /* — Filtrado tabla — */
  const movsFiltrados = useMemo(() => {
    let arr = movimientosPeriodo
    if (catFiltro !== 'todas') arr = arr.filter(m => m.categoria_id === catFiltro)
    if (busqueda) {
      const q = busqueda.toLowerCase()
      arr = arr.filter(m =>
        (m.concepto ?? '').toLowerCase().includes(q) ||
        (m.contraparte ?? '').toLowerCase().includes(q)
      )
    }
    if (filtroRapido === 'sin_cat') arr = arr.filter(m => !m.categoria_id)
    if (filtroRapido === 'sin_doc') arr = arr.filter(m => m.categoria_id && m.doc_estado === 'falta')
    if (filtroRapido === 'ingreso') arr = arr.filter(m => (m.importe ?? 0) > 0)
    if (filtroRapido === 'gasto')   arr = arr.filter(m => (m.importe ?? 0) < 0)
    return arr
  }, [movimientosPeriodo, catFiltro, busqueda, filtroRapido])

  const handleTabChange = (t: Tab) => { setTab(t); saveTab(t) }

  /* — estilos locales — */
  const s: Record<string, CSSProperties> = {
    page:   { background: T.bg, padding: '24px 28px', minHeight: '100vh' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
    h1:     { fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, letterSpacing: '3px', color: '#B01D23', textTransform: 'uppercase', margin: 0 },
    tabs:   { display: 'flex', gap: 8, marginBottom: 20 },
    tab:    (active: boolean) => ({
      padding: '8px 18px', borderRadius: 8, border: 'none',
      background: active ? '#B01D23' : T.card, color: active ? '#fff' : T.sec,
      fontFamily: FONT.body, fontSize: 13, cursor: 'pointer',
      border: active ? 'none' : `0.5px solid ${T.brd}`,
    } as CSSProperties),
    kpis: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 },
    toolbar: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
    input:   { flex: 1, minWidth: 200, padding: '9px 14px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: T.card, fontFamily: FONT.body, fontSize: 13, color: T.pri, outline: 'none' },
    select:  { padding: '9px 12px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: T.card, fontFamily: FONT.body, fontSize: 13, color: T.pri, cursor: 'pointer' },
    table:   { width: '100%', borderCollapse: 'collapse' as const, fontFamily: FONT.body, fontSize: 13 },
    th:      { fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase' as const, color: T.mut, padding: '10px 12px', background: T.group, borderBottom: `0.5px solid ${T.brd}`, textAlign: 'left' as const, whiteSpace: 'nowrap' as const },
    td:      { padding: '9px 12px', borderBottom: `0.5px solid ${T.brd}`, color: T.pri, verticalAlign: 'middle' as const },
    card:    { background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 14, overflow: 'hidden' },
  }

  return (
    <div style={s.page}>

      {/* HEADER — spec B.1 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={s.h1}>Conciliación</h1>

        {/* Selector periodo */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['semana','mes','trim','anio'] as PeriodoKey[]).map(k => (
            <button key={k} onClick={() => aplicarPeriodo(k)}
              style={{ padding: '7px 14px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: periodo === k ? '#B01D23' : T.card, color: periodo === k ? '#fff' : T.sec, fontFamily: FONT.body, fontSize: 12, cursor: 'pointer' }}>
              {{ semana: 'Semana', mes: 'Mes', trim: 'Trimestre', anio: 'Año' }[k]}
            </button>
          ))}
          <input type="date" value={customDesde} onChange={e => setCustomDesde(e.target.value)}
            style={{ ...s.select, fontSize: 12 }} />
          <input type="date" value={customHasta} onChange={e => setCustomHasta(e.target.value)}
            style={{ ...s.select, fontSize: 12 }} />
          <button onClick={() => customDesde && customHasta && aplicarPeriodo('custom', customDesde, customHasta)}
            style={{ padding: '7px 12px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: periodo === 'custom' ? '#B01D23' : T.card, color: periodo === 'custom' ? '#fff' : T.sec, fontFamily: FONT.body, fontSize: 12, cursor: 'pointer' }}>
            Aplicar
          </button>
          <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>{periodoLabelSFU}</span>
        </div>
      </div>

      {/* TABS */}
      <div style={s.tabs}>
        {(['movimientos', 'reglas'] as Tab[]).map(t => (
          <button key={t} onClick={() => handleTabChange(t)} style={s.tab(tab === t)}>
            {{ movimientos: 'Movimientos', reglas: 'Reglas' }[t]}
          </button>
        ))}
      </div>

      {tab === 'movimientos' && (
        <>
          {/* KPIs */}
          <div style={s.kpis}>
            <KpiCard label="Ingresos"   value={fmtEur(kpis.ingreso)} color="#1D9E75" />
            <KpiCard label="Gastos"     value={fmtEur(Math.abs(kpis.gasto))} color="#E24B4A" />
            <KpiCard label="Pendientes" value={String(kpis.pend)} color="#F26B1F"
              sub={`${kpis.sinCat} sin cat · ${kpis.sinDoc} sin doc`} />
            <KpiCard label="Total movs" value={String(kpis.total)} />
          </div>

          {/* Filtros rápidos */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {([
              { k: 'sin_cat', label: 'Sin categoría', color: '#E24B4A' },
              { k: 'sin_doc', label: 'Sin doc', color: '#F26B1F' },
              { k: 'ingreso', label: 'Ingresos', color: '#1D9E75' },
              { k: 'gasto',   label: 'Gastos',   color: '#E24B4A' },
            ] as { k: FiltroRapido; label: string; color: string }[]).map(({ k, label, color }) => (
              <button key={k as string} onClick={() => setFiltroRapido(prev => prev === k ? null : k)}
                style={{ padding: '6px 14px', borderRadius: 8, border: `0.5px solid ${filtroRapido === k ? color : T.brd}`, background: filtroRapido === k ? color + '18' : T.card, color: filtroRapido === k ? color : T.sec, fontFamily: FONT.body, fontSize: 12, cursor: 'pointer', fontWeight: filtroRapido === k ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>

          {/* Barra búsqueda + filtro cat */}
          <div style={s.toolbar}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.mut }} />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar concepto o contraparte…"
                style={{ ...s.input, paddingLeft: 30 }} />
            </div>
            <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={s.select}>
              <option value="todas">Todas las categorías</option>
              {categoriasBD.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Tabla */}
          <div style={s.card}>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Fecha</th>
                    <th style={s.th}>Concepto</th>
                    <th style={s.th}>Contraparte</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Importe</th>
                    <th style={s.th}>Categoría</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Doc</th>
                  </tr>
                </thead>
                <tbody>
                  {movsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...s.td, textAlign: 'center', color: T.mut, padding: '40px 12px' }}>
                        Sin movimientos para los filtros seleccionados
                      </td>
                    </tr>
                  ) : movsFiltrados.map((m, idx) => {
                    const isLast = idx === movsFiltrados.length - 1
                    const tdStyle = { ...s.td, borderBottom: isLast ? 'none' : `0.5px solid ${T.brd}` }
                    const catNombre = categoriasBD.find(c => c.id === m.categoria_id)?.nombre
                    return (
                      <tr key={m.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.group}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                        <td style={{ ...tdStyle, color: T.mut, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtFechaCorta(m.fecha)}</td>
                        <td style={{ ...tdStyle, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.concepto ?? ''}>{m.concepto}</td>
                        <td style={{ ...tdStyle, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.sec }} title={m.contraparte ?? ''}>{m.contraparte || '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: FONT.heading, fontSize: 14, fontWeight: 500, color: (m.importe ?? 0) >= 0 ? '#1D9E75' : '#E24B4A', whiteSpace: 'nowrap' }}>
                          {fmtEur(m.importe ?? 0)}
                        </td>
                        <td style={tdStyle}>
                          {catNombre ? (
                            <span style={{ background: T.group, fontSize: 11, padding: '3px 9px', borderRadius: 4, border: `0.5px solid ${T.brd}`, color: T.sec }}>{catNombre}</span>
                          ) : (
                            <span style={{ background: '#E24B4A12', fontSize: 11, padding: '3px 9px', borderRadius: 4, border: '0.5px dashed #E24B4A60', color: '#E24B4A', fontStyle: 'italic' }}>sin categoría</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {m.doc_estado === 'tiene'
                            ? <span title="Tiene documento" style={{ fontSize: 18, color: '#1D9E75' }}>📎</span>
                            : m.doc_estado === 'no_requiere'
                            ? <span style={{ color: T.mut, fontSize: 12 }}>—</span>
                            : <span style={{ fontSize: 16, color: '#F26B1F', fontWeight: 600 }}>✕</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'reglas' && (
        <div style={{ ...s.card, padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 14 }}>
          Gestión de reglas de categorización automática · Próximamente
        </div>
      )}
    </div>
  )
}
