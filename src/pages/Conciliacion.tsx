import { useMemo, useState, useEffect, type CSSProperties } from 'react'
import { Search, Zap } from 'lucide-react'
import { fmtEur, fmtDate } from '@/utils/format'
import { useTheme, FONT, fmtFechaCorta } from '@/styles/tokens'
import { KpiCard } from '@/components/KpiCard'
import { useConciliacion } from '@/hooks/useConciliacion'
import type { Movimiento, CategoriaPyg } from '@/types/conciliacion'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'movimientos' | 'reglas'
type PeriodoKey = 'semana' | 'mes' | 'trim' | 'anio' | 'custom'
type FiltroRapido = 'sin_cat' | 'sin_doc' | 'ingreso' | 'gasto' | null

interface Regla {
  id: string
  patron: string
  categoria_id: string
  contraparte?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
    const lunes = new Date(hoy)
    lunes.setDate(d - ((hoy.getDay() + 6) % 7))
    lunes.setHours(0, 0, 0, 0)
    const dom = new Date(lunes)
    dom.setDate(lunes.getDate() + 6)
    dom.setHours(23, 59, 59, 999)
    return { desde: lunes, hasta: dom, label: 'Esta semana' }
  }
  if (key === 'trim') {
    const q = Math.floor(m / 3)
    return {
      desde: new Date(y, q * 3, 1),
      hasta: new Date(y, q * 3 + 3, 0, 23, 59, 59, 999),
      label: `T${q + 1} ${y}`,
    }
  }
  if (key === 'anio') {
    return { desde: new Date(y, 0, 1), hasta: new Date(y, 11, 31, 23, 59, 59, 999), label: `${y}` }
  }
  if (key === 'custom') {
    return { desde: new Date(y, m, 1), hasta: new Date(y, m + 1, 0, 23, 59, 59, 999), label: 'Personalizado' }
  }
  // mes
  return { desde: new Date(y, m, 1), hasta: new Date(y, m + 1, 0, 23, 59, 59, 999), label: 'Mes en curso' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function Conciliacion() {
  const { T } = useTheme()

  const [tab, setTab]         = useState<Tab>(loadTab())
  const [periodo, setPeriodo] = useState<PeriodoKey>('mes')
  const [customDesde, setCustomDesde] = useState('')
  const [customHasta, setCustomHasta] = useState('')

  const def = periodoRango('mes')
  const [periodoDesde, setPeriodoDesde]       = useState<Date>(def.desde)
  const [periodoHasta, setPeriodoHasta]       = useState<Date>(def.hasta)
  const [periodoLabelSFU, setPeriodoLabelSFU] = useState(def.label)

  const [catFiltro, setCatFiltro] = useState('todas')
  const [busqueda, setBusqueda]   = useState('')
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>(null)

  const [reglas, setReglas] = useState<Regla[]>([])

  const {
    movimientos: movimientosBD,
    insertMovimientos,
    updateCategoria,
    categorias: categoriasBD,
    loading: loadingBD,
  } = useConciliacion()

  /* — Dropdown groups — */
  const dropdownGroups = useMemo(() => {
    const ingresos = categoriasBD.filter(c => c.tipo_parent === 'ingreso')
    const gastos   = categoriasBD.filter(c => c.tipo_parent === 'gasto')
    return {
      ingresos,
      gastos,
      grupos: [...new Set(gastos.map(c => c.grupo).filter(Boolean))],
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

  /* — Filtrado por periodo — */
  const movimientosPeriodo = useMemo(() =>
    movimientosBD.filter(m => {
      const f = new Date(m.fecha + 'T00:00:00')
      return f >= periodoDesde && f <= periodoHasta
    }),
  [movimientosBD, periodoDesde, periodoHasta])

  /* — KPIs — */
  const kpis = useMemo(() => {
    const sinCat  = movimientosPeriodo.filter(m => !m.categoria).length
    const sinDoc  = movimientosPeriodo.filter(m => m.categoria && m.doc_estado === 'falta').length
    const ingreso = movimientosPeriodo.filter(m => (m.importe ?? 0) > 0).reduce((s, m) => s + (m.importe ?? 0), 0)
    const gasto   = movimientosPeriodo.filter(m => (m.importe ?? 0) < 0).reduce((s, m) => s + (m.importe ?? 0), 0)
    return { total: movimientosPeriodo.length, sinCat, sinDoc, pend: sinCat + sinDoc, ingreso, gasto }
  }, [movimientosPeriodo])

  /* — Filtrado tabla — */
  const movsFiltrados = useMemo(() => {
    let arr = movimientosPeriodo
    if (catFiltro !== 'todas') arr = arr.filter(m => m.categoria === catFiltro)
    if (busqueda) {
      const q = busqueda.toLowerCase()
      arr = arr.filter(m =>
        (m.concepto ?? '').toLowerCase().includes(q) ||
        (m.proveedor ?? '').toLowerCase().includes(q)
      )
    }
    if (filtroRapido === 'sin_cat') arr = arr.filter(m => !m.categoria)
    if (filtroRapido === 'sin_doc') arr = arr.filter(m => m.categoria && m.doc_estado === 'falta')
    if (filtroRapido === 'ingreso') arr = arr.filter(m => (m.importe ?? 0) > 0)
    if (filtroRapido === 'gasto')   arr = arr.filter(m => (m.importe ?? 0) < 0)
    return arr
  }, [movimientosPeriodo, catFiltro, busqueda, filtroRapido])

  const handleTabChange = (t: Tab) => { setTab(t); saveTab(t) }

  /* — Estilos — */
  const brd   = T.brd   ?? '#d0c8bc'
  const card  = T.card  ?? '#fff'
  const bg    = T.bg    ?? '#f5f3ef'
  const pri   = T.pri   ?? '#111'
  const sec   = T.sec   ?? '#484f66'
  const mut   = T.mut   ?? '#7a8090'
  const group = T.group ?? '#f5f3ef'

  return (
    <div style={{ background: bg, padding: '24px 28px', minHeight: '100vh' }}>

      {/* HEADER — spec B.1 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, letterSpacing: '3px', color: '#B01D23', textTransform: 'uppercase', margin: 0 }}>
          Conciliación
        </h1>

        {/* Selector de periodo */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['semana', 'mes', 'trim', 'anio'] as PeriodoKey[]).map(k => (
            <button key={k} onClick={() => aplicarPeriodo(k)}
              style={{ padding: '7px 14px', borderRadius: 8, border: `0.5px solid ${brd}`, background: periodo === k ? '#B01D23' : card, color: periodo === k ? '#fff' : sec, fontFamily: FONT.body, fontSize: 12, cursor: 'pointer' }}>
              {{ semana: 'Semana', mes: 'Mes', trim: 'Trimestre', anio: 'Año' }[k]}
            </button>
          ))}
          <input type="date" value={customDesde} onChange={e => setCustomDesde(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: `0.5px solid ${brd}`, background: card, fontFamily: FONT.body, fontSize: 12, color: pri, cursor: 'pointer' }} />
          <input type="date" value={customHasta} onChange={e => setCustomHasta(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: `0.5px solid ${brd}`, background: card, fontFamily: FONT.body, fontSize: 12, color: pri, cursor: 'pointer' }} />
          <button onClick={() => customDesde && customHasta && aplicarPeriodo('custom', customDesde, customHasta)}
            style={{ padding: '7px 12px', borderRadius: 8, border: `0.5px solid ${brd}`, background: periodo === 'custom' ? '#B01D23' : card, color: periodo === 'custom' ? '#fff' : sec, fontFamily: FONT.body, fontSize: 12, cursor: 'pointer' }}>
            Aplicar
          </button>
          <span style={{ fontFamily: FONT.body, fontSize: 12, color: mut }}>{periodoLabelSFU}</span>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['movimientos', 'reglas'] as Tab[]).map(t => (
          <button key={t} onClick={() => handleTabChange(t)}
            style={{ padding: '8px 18px', borderRadius: 8, border: t === tab ? 'none' : `0.5px solid ${brd}`, background: t === tab ? '#B01D23' : card, color: t === tab ? '#fff' : sec, fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }}>
            {{ movimientos: 'Movimientos', reglas: 'Reglas' }[t]}
          </button>
        ))}
      </div>

      {tab === 'movimientos' && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            <KpiCard label="Ingresos"   value={fmtEur(kpis.ingreso)}          delta={{ value: '', trend: 'neutral' }} />
            <KpiCard label="Gastos"     value={fmtEur(Math.abs(kpis.gasto))} delta={{ value: '', trend: 'neutral' }} />
            <KpiCard label="Pendientes" value={String(kpis.pend)}             delta={{ value: '', trend: 'neutral' }} />
            <KpiCard label="Movs"       value={String(kpis.total)}            delta={{ value: '', trend: 'neutral' }} />
          </div>

          {/* Filtros rápidos */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {([
              { k: 'sin_cat' as FiltroRapido, label: 'Sin categoría', color: '#E24B4A' },
              { k: 'sin_doc' as FiltroRapido, label: 'Sin doc',       color: '#F26B1F' },
              { k: 'ingreso' as FiltroRapido, label: 'Ingresos',      color: '#1D9E75' },
              { k: 'gasto'   as FiltroRapido, label: 'Gastos',        color: '#E24B4A' },
            ]).map(({ k, label, color }) => (
              <button key={k as string} onClick={() => setFiltroRapido(prev => prev === k ? null : k)}
                style={{ padding: '6px 14px', borderRadius: 8, border: `0.5px solid ${filtroRapido === k ? color : brd}`, background: filtroRapido === k ? color + '18' : card, color: filtroRapido === k ? color : sec, fontFamily: FONT.body, fontSize: 12, cursor: 'pointer', fontWeight: filtroRapido === k ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>

          {/* Barra búsqueda + filtro cat */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: mut }} />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar concepto o proveedor…"
                style={{ width: '100%', padding: '9px 14px 9px 30px', borderRadius: 8, border: `0.5px solid ${brd}`, background: card, fontFamily: FONT.body, fontSize: 13, color: pri, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, border: `0.5px solid ${brd}`, background: card, fontFamily: FONT.body, fontSize: 13, color: pri, cursor: 'pointer' }}>
              <option value="todas">Todas las categorías</option>
              {categoriasBD.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Tabla */}
          <div style={{ background: card, border: `0.5px solid ${brd}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 13 }}>
                <thead>
                  <tr>
                    {(['Fecha', 'Concepto', 'Proveedor', 'Importe', 'Categoría', 'Doc'] as const).map((h, i) => (
                      <th key={h} style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: mut, padding: '10px 12px', background: group, borderBottom: `0.5px solid ${brd}`, textAlign: i === 3 ? 'right' : i === 5 ? 'center' : 'left', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px 12px', textAlign: 'center', color: mut, fontFamily: FONT.body, fontSize: 13 }}>
                        Sin movimientos para los filtros seleccionados
                      </td>
                    </tr>
                  ) : movsFiltrados.map((m, idx) => {
                    const isLast = idx === movsFiltrados.length - 1
                    const tdStyle: CSSProperties = { padding: '9px 12px', borderBottom: isLast ? 'none' : `0.5px solid ${brd}`, color: pri, verticalAlign: 'middle' }
                    const catNombre = categoriasBD.find(c => c.id === m.categoria)?.nombre
                    return (
                      <tr key={m.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = group}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                        <td style={{ ...tdStyle, color: mut, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtFechaCorta(m.fecha)}</td>
                        <td style={{ ...tdStyle, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.concepto ?? ''}>{m.concepto}</td>
                        <td style={{ ...tdStyle, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: sec }} title={m.proveedor ?? ''}>{m.proveedor || '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: FONT.heading, fontSize: 14, fontWeight: 500, color: (m.importe ?? 0) >= 0 ? '#1D9E75' : '#E24B4A', whiteSpace: 'nowrap' }}>
                          {fmtEur(m.importe ?? 0)}
                        </td>
                        <td style={tdStyle}>
                          {catNombre
                            ? <span style={{ background: group, fontSize: 11, padding: '3px 9px', borderRadius: 4, border: `0.5px solid ${brd}`, color: sec }}>{catNombre}</span>
                            : <span style={{ background: '#E24B4A12', fontSize: 11, padding: '3px 9px', borderRadius: 4, border: '0.5px dashed #E24B4A60', color: '#E24B4A', fontStyle: 'italic' }}>sin categoría</span>
                          }
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {m.doc_estado === 'tiene'
                            ? <span style={{ fontSize: 18, color: '#1D9E75' }}>📎</span>
                            : m.doc_estado === 'no_requiere'
                            ? <span style={{ color: mut, fontSize: 12 }}>—</span>
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
        <div style={{ background: card, border: `0.5px solid ${brd}`, borderRadius: 14, padding: 40, textAlign: 'center', color: mut, fontFamily: FONT.body, fontSize: 14 }}>
          Gestión de reglas de categorización automática · Próximamente
        </div>
      )}
    </div>
  )
}
