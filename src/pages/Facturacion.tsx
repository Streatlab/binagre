import { Fragment, useEffect, useState, useMemo, type FormEvent, type CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import {
  useTheme,
  cardStyle,
  FONT,
  LAYOUT,
  kpiLabelStyle,
  kpiValueStyle,
  dropdownBtnStyle,
  dropdownMenuStyle,
  dropdownItemStyle,
  tabActiveStyle,
  tabInactiveStyle,
  fmtFechaCorta,
  pageTitleStyle,
} from '@/styles/tokens'
import { useCalendario, type TipoDia } from '@/contexts/CalendarioContext'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'

const fmtInt = (n: number) => Math.round(n).toLocaleString('es-ES')

interface AggRow {
  uber_pedidos: number; uber_bruto: number
  glovo_pedidos: number; glovo_bruto: number
  je_pedidos: number; je_bruto: number
  web_pedidos: number; web_bruto: number
  directa_pedidos: number; directa_bruto: number
  total_pedidos: number; total_bruto: number
}

interface RawDiario extends AggRow {
  id: number
  fecha: string
  servicio: string
}

interface SemanaGroup extends AggRow { year: number; week: number; periodo: string; dias: number }
interface MesGroup extends AggRow { anio: number; mes: number; dias: number; media_diaria: number; vs_anterior: number | null }

type Tab = 'diario' | 'semanas' | 'meses' | 'anual'
type CanalFilter = 'Todos' | 'Uber Eats' | 'Glovo' | 'Just Eat' | 'Web'

const COLS: { id: string; label: string; ped: keyof AggRow; bru: keyof AggRow; color: string; bg: string }[] = [
  { id: 'uber',  label: 'Uber Eats', ped: 'uber_pedidos',    bru: 'uber_bruto',    color: '#06C167', bg: '#06C16710' },
  { id: 'glovo', label: 'Glovo',     ped: 'glovo_pedidos',   bru: 'glovo_bruto',   color: '#8a7800', bg: '#e8f44210' },
  { id: 'je',    label: 'Just Eat',  ped: 'je_pedidos',      bru: 'je_bruto',      color: '#f5a623', bg: '#f5a62310' },
  { id: 'web',   label: 'Web',       ped: 'web_pedidos',     bru: 'web_bruto',     color: '#B01D23', bg: '#B01D2310' },
  { id: 'dir',   label: 'Directa',   ped: 'directa_pedidos', bru: 'directa_bruto', color: '#66aaff', bg: '#66aaff10' },
]

const TABS: { key: Tab; label: string }[] = [
  { key: 'diario', label: 'Diario' },
  { key: 'semanas', label: 'Semanas' },
  { key: 'meses', label: 'Meses' },
  { key: 'anual', label: 'Año' },
]
const MES_NOMBRE: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}

const SELECT_DIARIO = 'id,fecha,servicio,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,web_pedidos,web_bruto,directa_pedidos,directa_bruto,total_pedidos,total_bruto'

const today = () => new Date().toISOString().slice(0, 10)

function getPed(r: AggRow, c: CanalFilter): number {
  if (c === 'Todos') return r.total_pedidos
  const col = COLS.find(x => x.label === c)!
  return (r[col.ped] as number) || 0
}
function getBru(r: AggRow, c: CanalFilter): number {
  if (c === 'Todos') return r.total_bruto
  const col = COLS.find(x => x.label === c)!
  return (r[col.bru] as number) || 0
}

function aggregate(rows: RawDiario[]): AggRow {
  const a: AggRow = {
    uber_pedidos: 0, uber_bruto: 0, glovo_pedidos: 0, glovo_bruto: 0,
    je_pedidos: 0, je_bruto: 0, web_pedidos: 0, web_bruto: 0,
    directa_pedidos: 0, directa_bruto: 0,
    total_pedidos: 0, total_bruto: 0,
  }
  for (const r of rows) {
    for (const c of COLS) {
      ;(a[c.ped] as number) += (r[c.ped] as number) || 0
      ;(a[c.bru] as number) += (r[c.bru] as number) || 0
    }
    a.total_pedidos += r.total_pedidos || 0
    a.total_bruto += r.total_bruto || 0
  }
  return a
}

function isoWeek(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const y = d.getFullYear()
  const jan1 = new Date(y, 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return { year: y, week }
}

function weekBounds(year: number, week: number): [string, string] {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const w1Mon = new Date(jan4)
  w1Mon.setUTCDate(jan4.getUTCDate() - dow + 1)
  const mon = new Date(w1Mon)
  mon.setUTCDate(w1Mon.getUTCDate() + (week - 1) * 7)
  const sun = new Date(mon)
  sun.setUTCDate(mon.getUTCDate() + 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return [fmt(mon), fmt(sun)]
}

function buildSemanas(rows: RawDiario[]): SemanaGroup[] {
  const map = new Map<string, { rows: RawDiario[]; year: number; week: number }>()
  for (const r of rows) {
    const { year, week } = isoWeek(r.fecha)
    const key = `${year}-${week}`
    let entry = map.get(key)
    if (!entry) { entry = { rows: [], year, week }; map.set(key, entry) }
    entry.rows.push(r)
  }
  const result: SemanaGroup[] = []
  for (const { rows: wRows, year, week } of map.values()) {
    const agg = aggregate(wRows)
    const [from, to] = weekBounds(year, week)
    const dias = new Set(wRows.map(r => r.fecha)).size
    result.push({ year, week, periodo: `${from} → ${to}`, dias, ...agg })
  }
  return result.sort((a, b) => (a.year === b.year ? b.week - a.week : b.year - a.year))
}

function buildMeses(rows: RawDiario[]): MesGroup[] {
  const map = new Map<string, RawDiario[]>()
  for (const r of rows) {
    const key = r.fecha.slice(0, 7)
    let arr = map.get(key)
    if (!arr) { arr = []; map.set(key, arr) }
    arr.push(r)
  }
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const result: MesGroup[] = []
  let prevBruto: number | null = null
  for (const [key, mRows] of sorted) {
    const [yStr, mStr] = key.split('-')
    const anio = Number(yStr)
    const mes = Number(mStr)
    const agg = aggregate(mRows)
    const dias = new Set(mRows.map(r => r.fecha)).size
    const media_diaria = dias > 0 ? agg.total_bruto / dias : 0
    const vs_anterior = prevBruto !== null && prevBruto > 0 ? ((agg.total_bruto - prevBruto) / prevBruto) * 100 : null
    result.push({ anio, mes, dias, ...agg, media_diaria, vs_anterior })
    prevBruto = agg.total_bruto
  }
  return result.reverse()
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v)
    return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))]
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function TipoPill({ tipo }: { tipo: TipoDia }) {
  if (tipo === 'cerrado' || tipo === 'festivo' || tipo === 'vacaciones') {
    return <span style={{ backgroundColor: '#B01D23', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: FONT.heading, letterSpacing: 0.5, textTransform: 'uppercase' }}>CERRADO</span>
  }
  if (tipo === 'solo_comida') {
    return <span style={{ backgroundColor: '#e8f442', color: '#111', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: FONT.heading, letterSpacing: 0.5 }}>ALM</span>
  }
  if (tipo === 'solo_cena') {
    return <span style={{ backgroundColor: '#f5a623', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: FONT.heading, letterSpacing: 0.5 }}>CENA</span>
  }
  return null
}

export default function Facturacion() {
  const { T, isDark } = useTheme()
  const { tipoDia } = useCalendario()
  const [tab, setTab] = useState<Tab>('diario')
  const [canal] = useState<CanalFilter>('Todos')
  const [servicioFiltro, setServicioFiltro] = useState<string>('Todos')
  const [dropCanalOpen, setDropCanalOpen] = useState(false)
  const [canalFilterSelected, setCanalFilterSelected] = useState<string[]>(['Todos'])
  const [allData, setAllData] = useState<RawDiario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [weekFilter, setWeekFilter] = useState<{ year: number; week: number } | null>(null)
  const [editRow, setEditRow] = useState<RawDiario | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-drop-canal]')) setDropCanalOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const hoy = new Date()
  const dayOfWeek = hoy.getDay()
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(hoy); monday.setDate(hoy.getDate() + daysToMonday)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const weekNum = (() => {
    const d = new Date(hoy); const day = d.getDay()||7
    d.setDate(d.getDate()+4-day)
    const y = d.getFullYear()
    const jan1 = new Date(y,0,1)
    return Math.ceil(((d.getTime()-jan1.getTime())/86400000+1)/7)
  })()
  const mesNombre = hoy.toLocaleDateString('es-ES',{month:'long'}).replace(/^\w/,c=>c.toUpperCase())
  const fmtCorto = (d: Date) => d.toLocaleDateString('es-ES',{day:'numeric',month:'short'})

  const KPI_LABELS = {
    hoy: new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }).replace(/^\w/, c => c.toUpperCase()),
    semana: `S${weekNum} · ${fmtCorto(monday)} – ${fmtCorto(sunday)}`,
    mes: mesNombre,
    anio: `${hoy.getFullYear()}`,
  }

  const refresh = () => setRefreshKey(k => k + 1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const { data, error: e } = await supabase
          .from('facturacion_diario')
          .select(SELECT_DIARIO)
          .order('fecha', { ascending: false })
        if (e) throw e
        if (!cancelled) setAllData((data as RawDiario[]) ?? [])
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refreshKey])

  const drillWeek = (year: number, week: number) => {
    setWeekFilter({ year, week })
    setTab('diario')
  }
  const clearWeekFilter = () => setWeekFilter(null)

  const todayStr = today()
  const currentIso = isoWeek(todayStr)
  const currentMonth = todayStr.slice(0, 7)
  const currentYear = todayStr.slice(0, 4)

  const filteredData = useMemo(() =>
    servicioFiltro === 'Todos' ? allData : allData.filter(r => r.servicio === servicioFiltro),
    [allData, servicioFiltro]
  )

  const kpiHoy = useMemo(() => {
    const rows = filteredData.filter(r => r.fecha === todayStr)
    const a = aggregate(rows)
    return { pedidos: getPed(a, canal), bruto: getBru(a, canal) }
  }, [filteredData, canal, todayStr])

  const kpiSemana = useMemo(() => {
    const rows = filteredData.filter(r => {
      const w = isoWeek(r.fecha)
      return w.year === currentIso.year && w.week === currentIso.week
    })
    const a = aggregate(rows)
    return { pedidos: getPed(a, canal), bruto: getBru(a, canal) }
  }, [filteredData, canal, currentIso.year, currentIso.week])

  const kpiMes = useMemo(() => {
    const rows = filteredData.filter(r => r.fecha.startsWith(currentMonth))
    const a = aggregate(rows)
    return { pedidos: getPed(a, canal), bruto: getBru(a, canal) }
  }, [filteredData, canal, currentMonth])

  const kpiAnio = useMemo(() => {
    const rows = filteredData.filter(r => r.fecha.startsWith(currentYear))
    const a = aggregate(rows)
    return { pedidos: getPed(a, canal), bruto: getBru(a, canal) }
  }, [filteredData, canal, currentYear])

  return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontFamily: FONT.heading, ...LAYOUT.pageTitle, margin: 0 }}>FACTURACIÓN</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Servicio: izquierda */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['Todos', 'ALM', 'CENAS'].map(s => (
              <button key={s} onClick={() => setServicioFiltro(s)}
                style={servicioFiltro === s
                  ? { background: '#B01D23', color: '#ffffff', border: 'none', borderRadius: 8, padding: '6px 14px', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', cursor: 'pointer', fontWeight: 500 }
                  : { background: 'none', color: T.sec, border: `0.5px solid ${T.brd}`, borderRadius: 8, padding: '6px 14px', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', cursor: 'pointer', fontWeight: 500 }
                }>
                {s}
              </button>
            ))}
          </div>
          {/* Canales: derecha */}
          <div style={{ position: 'relative' }} data-drop-canal="canales">
            <button onClick={e => { e.stopPropagation(); setDropCanalOpen(p => !p) }} style={dropdownBtnStyle(T)}>
              <span>{canalFilterSelected.length >= 5 ? 'Canales' : canalFilterSelected.length === 1 ? canalFilterSelected[0] : `${canalFilterSelected.length} canales`}</span><ChevronDown size={11} strokeWidth={2.5} style={{ marginLeft: 4 }} />
            </button>
            {dropCanalOpen && (
              <div style={dropdownMenuStyle(T)}>
                {['Todos', 'Uber Eats', 'Glovo', 'Just Eat', 'Web', 'Directa'].map(c => (
                  <label key={c} style={dropdownItemStyle(T)}>
                    <input type="checkbox" checked={canalFilterSelected.includes(c)} onChange={() => {
                      if (c === 'Todos') setCanalFilterSelected(['Todos'])
                      else {
                        const filtered = canalFilterSelected.filter(x => x !== 'Todos')
                        const updated = filtered.includes(c) ? filtered.filter(x => x !== c) : [...filtered, c]
                        setCanalFilterSelected(updated.length === 0 ? ['Todos'] : updated.length === 5 ? ['Todos'] : updated)
                      }
                    }} style={{ width: 13, height: 13 }} />
                    {c}
                  </label>
                ))}
              </div>
            )}
          </div>
          {/* SelectorFechaUniversal */}
          <SelectorFechaUniversal
            nombreModulo="facturacion"
            onChange={() => { /* fecha universal: para futura integración */ }}
          />
        </div>
      </div>

      {/* TABS conmutador */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); if (t.key !== 'diario') clearWeekFilter() }}
              style={tab === t.key ? tabActiveStyle(isDark) : tabInactiveStyle(T)}>
              {t.label}
            </button>
          ))}
        </div>
        {weekFilter && (
          <button onClick={clearWeekFilter}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'rgba(176,29,35,0.08)', color: T.pri, fontFamily: FONT.body, fontSize: 12, fontWeight: 500, borderRadius: 8, border: `0.5px solid rgba(176,29,35,0.3)`, cursor: 'pointer' }}>
            S{weekFilter.week} &times;
          </button>
        )}
      </div>

      {loading ? <Loader T={T} /> : error ? <ErrorBox T={T} msg={error} onRetry={refresh} /> : (
        <>
          {tab === 'diario' && <TabDiario allData={filteredData} canal={canal} weekFilter={weekFilter} onRefresh={refresh} onEdit={setEditRow} onAdd={() => setShowAdd(true)} tipoDia={tipoDia} />}
          {tab === 'semanas' && <TabSemanas allData={filteredData} canal={canal} onDrill={drillWeek} />}
          {tab === 'meses' && <TabMeses allData={filteredData} canal={canal} />}
          {tab === 'anual' && <TabAnual allData={filteredData} canal={canal} />}
        </>
      )}

      {showAdd && <DayModal allData={allData} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); refresh() }} />}
      {editRow && <DayModal allData={allData} existing={editRow} onClose={() => setEditRow(null)} onSaved={() => { setEditRow(null); refresh() }} />}
    </div>
  )
}

interface DiarioProps {
  allData: RawDiario[]; canal: CanalFilter
  weekFilter: { year: number; week: number } | null
  onRefresh: () => void; onEdit: (r: RawDiario) => void; onAdd: () => void
  tipoDia: (fecha: string) => TipoDia
}

function TabDiario({ allData, canal, weekFilter, onEdit, onAdd, tipoDia }: DiarioProps) {
  const { T } = useTheme()
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [mesFilter, setMesFilter] = useState(currentMonth)

  const rows = useMemo(() => {
    let data = allData
    if (weekFilter) {
      const [from, to] = weekBounds(weekFilter.year, weekFilter.week)
      data = data.filter(r => r.fecha >= from && r.fecha <= to)
    }
    if (mesFilter !== 'todos') {
      data = data.filter(r => r.fecha.startsWith(mesFilter))
    }
    return [...data].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.servicio.localeCompare(b.servicio))
  }, [allData, weekFilter, mesFilter])

  const mesesDisponibles = useMemo(() => {
    const set = new Set(allData.map(r => r.fecha.slice(0, 7)))
    return [...set].sort().reverse()
  }, [allData])

  const totals = useMemo(() => aggregate(rows), [rows])

  const exportar = () => {
    const headers = ['Fecha', 'Servicio', 'UE Ped', 'UE Bruto', 'GL Ped', 'GL Bruto', 'JE Ped', 'JE Bruto', 'Web Ped', 'Web Bruto', 'Dir Ped', 'Dir Bruto', 'Total Ped', 'Total Bruto']
    const csvRows = rows.map(r => [r.fecha, r.servicio, r.uber_pedidos, r.uber_bruto, r.glovo_pedidos, r.glovo_bruto, r.je_pedidos, r.je_bruto, r.web_pedidos, r.web_bruto, r.directa_pedidos, r.directa_bruto, r.total_pedidos, r.total_bruto])
    downloadCSV('facturacion_diario.csv', headers, csvRows)
  }

  if (allData.length === 0) return <EmptyState T={T} label="Sin datos de facturacion diaria" onAdd={onAdd} />

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <select value={mesFilter} onChange={e => setMesFilter(e.target.value)}
          style={{ background: T.inp, color: T.pri, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: '6px 12px', fontSize: 13, fontFamily: FONT.body, cursor: 'pointer' }}>
          <option value="todos">Todos los meses</option>
          {mesesDisponibles.map(m => {
            const [y, mm] = m.split('-')
            return <option key={m} value={m}>{MES_NOMBRE[Number(mm)]} {y}</option>
          })}
        </select>
        <button onClick={exportar}
          style={{ padding: '6px 14px', fontSize: 11, color: T.sec, background: 'none', border: `0.5px solid ${T.brd}`, borderRadius: 10, cursor: 'pointer', fontFamily: FONT.heading, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500 }}>
          Exportar CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16, alignItems: 'stretch' }}>
        <MiniKpi label="Facturación Bruta" valor={fmtEur(getBru(totals, canal))} />
        <MiniKpi label="Pedidos" valor={fmtInt(getPed(totals, canal))} />
        <MiniKpi label="TM" valor={getPed(totals, canal) > 0 ? fmtEur(getBru(totals, canal) / getPed(totals, canal)) : '—'} />
        <MiniKpi label="Facturación Diaria" valor={(() => { const d = new Set(rows.map(r => r.fecha)).size; return d > 0 ? fmtEur(getBru(totals, canal) / d) : '—' })()} />
        <button onClick={onAdd}
          style={{ padding: '0 22px', borderRadius: 10, background: '#B01D23', color: '#ffffff', border: 'none', cursor: 'pointer', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          + Añadir día
        </button>
      </div>

      <DiarioTable rows={rows} totals={totals} onEdit={onEdit} tipoDia={tipoDia} />
    </>
  )
}

function DiarioTable({ rows, totals, onEdit, tipoDia }: { rows: RawDiario[]; totals: AggRow; onEdit: (r: RawDiario) => void; tipoDia: (fecha: string) => TipoDia }) {
  const { T } = useTheme()
  return (
    <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse', tableLayout: 'auto', minWidth: 'max-content' }}>
          <thead>
            <tr style={{ borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
              <th rowSpan={2} style={{ padding: '10px 10px', textAlign: 'left', color: T.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400, fontFamily: FONT.heading, verticalAlign: 'middle', position: 'sticky', left: 0, zIndex: 5 }}>Fecha</th>
              <th rowSpan={2} style={{ padding: '10px 10px', textAlign: 'left', color: T.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400, fontFamily: FONT.heading, verticalAlign: 'middle' }}>Serv.</th>
              {COLS.map(c => (
                <th key={c.label} colSpan={2} style={{ padding: '8px 10px', textAlign: 'center', background: c.bg, borderRight: `0.5px solid ${T.brd}`, color: c.color, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>
                  {c.label}
                </th>
              ))}
              <th colSpan={2} style={{ padding: '8px 10px', textAlign: 'center', background: T.group, color: T.pri, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Total</th>
            </tr>
            <tr style={{ borderBottom: `0.5px solid ${T.brd}`, background: T.group, color: T.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px' }}>
              {COLS.map(c => (
                <Fragment key={c.label}>
                  <th style={{ padding: '6px 8px', textAlign: 'center', background: c.bg, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400, fontFamily: FONT.heading, color: T.mut }}>Ped</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', background: c.bg, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400, fontFamily: FONT.heading, color: T.mut }}>€</th>
                </Fragment>
              ))}
              <th style={{ padding: '6px 8px', textAlign: 'center', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400, fontFamily: FONT.heading, color: T.mut }}>Ped</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', background: T.group, fontWeight: 400, fontFamily: FONT.heading, color: T.mut }}>€</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const tipo = tipoDia(r.fecha)
              const esCerrado = tipo === 'cerrado' || tipo === 'festivo' || tipo === 'vacaciones'
              return (
              <tr key={r.id} onClick={() => onEdit(r)} style={{ borderBottom: `0.5px solid ${T.brd}`, cursor: 'pointer', opacity: esCerrado ? 0.7 : 1 }}>
                <td style={{ padding: '8px 10px', textAlign: 'left', color: T.pri, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.body, position: 'sticky', left: 0, zIndex: 5, background: 'var(--sl-app)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {fmtFechaCorta(r.fecha)}
                    <TipoPill tipo={tipo} />
                  </div>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'left', borderRight: `0.5px solid ${T.brd}` }}><ServicioBadge s={r.servicio} /></td>
                {COLS.map(c => {
                  const p = (r[c.ped] as number) || 0
                  const b = (r[c.bru] as number) || 0
                  return (
                    <Fragment key={c.label}>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: p > 0 ? T.pri : T.mut, borderRight: `0.5px solid ${T.brd}`, background: c.bg, fontFamily: FONT.body, fontSize: 13 }}>{p > 0 ? Math.round(p) : <Dash T={T} />}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: b > 0 ? T.pri : T.mut, borderRight: `0.5px solid ${T.brd}`, background: c.bg, fontFamily: FONT.body, fontSize: 13 }}>{b > 0 ? fmtEur(b) : <Dash T={T} />}</td>
                    </Fragment>
                  )
                })}
                <td style={{ padding: '8px 10px', textAlign: 'center', color: T.pri, fontWeight: 500, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.body, fontSize: 13 }}>{fmtInt(r.total_pedidos)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: T.pri, fontWeight: 600, fontFamily: FONT.body, fontSize: 13 }}>{fmtEur(r.total_bruto)}</td>
              </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `1px solid ${T.brd}`, background: T.group, fontWeight: 600 }}>
              <td style={{ padding: '10px 10px', textAlign: 'left', color: T.pri, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', position: 'sticky', left: 0, zIndex: 5, background: T.group }} colSpan={2}>Total</td>
              {COLS.map(c => (
                <Fragment key={c.label}>
                  <td style={{ padding: '10px 10px', textAlign: 'center', color: c.color, borderRight: `0.5px solid ${T.brd}`, background: c.bg, fontFamily: FONT.heading, fontSize: 12, fontWeight: 600 }}>{fmtInt(totals[c.ped] as number)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: c.color, borderRight: `0.5px solid ${T.brd}`, background: c.bg, fontFamily: FONT.heading, fontSize: 12, fontWeight: 600 }}>{fmtEur(totals[c.bru] as number)}</td>
                </Fragment>
              ))}
              <td style={{ padding: '10px 10px', textAlign: 'center', color: T.pri, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.heading, fontSize: 12, fontWeight: 600 }}>{fmtInt(totals.total_pedidos)}</td>
              <td style={{ padding: '10px 10px', textAlign: 'right', color: T.pri, fontFamily: FONT.heading, fontSize: 12, fontWeight: 600 }}>{fmtEur(totals.total_bruto)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function TabSemanas({ allData, canal, onDrill }: { allData: RawDiario[]; canal: CanalFilter; onDrill: (y: number, w: number) => void }) {
  const { T } = useTheme()
  const rows = useMemo(() => buildSemanas(allData).slice(0, 12), [allData])
  const totals = useMemo(() => aggregate(allData), [allData])

  const exportar = () => {
    const headers = ['Semana', 'Periodo', 'Dias', 'UE', 'Glovo', 'JE', 'Web', 'Directa', 'Total Ped', 'Total Bruto']
    const csvRows = rows.map(r => [`S${r.week}`, r.periodo, r.dias, r.uber_bruto, r.glovo_bruto, r.je_bruto, r.web_bruto, r.directa_bruto, r.total_pedidos, r.total_bruto])
    downloadCSV('facturacion_semanas.csv', headers, csvRows)
  }

  if (rows.length === 0) return <EmptyState T={T} label="Sin datos semanales" />

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={exportar}
          style={{ padding: '6px 14px', fontSize: 11, color: T.sec, background: 'none', border: `0.5px solid ${T.brd}`, borderRadius: 10, cursor: 'pointer', fontFamily: FONT.heading, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500 }}>
          Exportar CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <MiniKpi label="Semanas" valor={String(rows.length)} />
        <MiniKpi label="Facturación Bruta" valor={fmtEur(getBru(totals, canal))} />
        <MiniKpi label="Pedidos" valor={fmtInt(getPed(totals, canal))} />
      </div>

      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse', tableLayout: 'auto', minWidth: 'max-content' }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
                <th style={{ padding: '10px 10px', textAlign: 'left', color: T.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400, fontFamily: FONT.heading }}>Sem</th>
                <th style={{ padding: '10px 10px', textAlign: 'left', color: T.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400, fontFamily: FONT.heading }}>Periodo</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', color: T.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400, fontFamily: FONT.heading }}>Días</th>
                {COLS.map(c => (
                  <th key={c.label} style={{ padding: '10px 10px', textAlign: 'center', background: c.bg, borderRight: `0.5px solid ${T.brd}`, color: c.color, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>{c.label}</th>
                ))}
                <th style={{ padding: '10px 10px', textAlign: 'right', background: T.group, color: T.pri, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={`${r.year}-${r.week}`} onClick={() => onDrill(r.year, r.week)} style={{ borderBottom: `0.5px solid ${T.brd}`, cursor: 'pointer' }}>
                  <td style={{ padding: '8px 10px', textAlign: 'left', color: T.pri, fontWeight: 500, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.body }}>S{r.week}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'left', color: T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.body }}>{r.periodo}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.body, fontSize: 13 }}>{r.dias}</td>
                  {COLS.map(c => (
                    <td key={c.label} style={{ padding: '8px 10px', textAlign: 'right', color: (r[c.bru] as number) > 0 ? T.pri : T.mut, borderRight: `0.5px solid ${T.brd}`, background: c.bg, fontFamily: FONT.body, fontSize: 13 }}>
                      {(r[c.bru] as number) > 0 ? fmtEur(r[c.bru] as number) : <Dash T={T} />}
                    </td>
                  ))}
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: T.pri, fontWeight: 600, fontFamily: FONT.body, fontSize: 13 }}>{fmtEur(r.total_bruto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `1px solid ${T.brd}`, background: T.group, fontWeight: 600 }}>
                <td style={{ padding: '10px 10px', textAlign: 'left', color: T.pri, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase' }} colSpan={3}>Total</td>
                {COLS.map(c => (
                  <td key={c.label} style={{ padding: '10px 10px', textAlign: 'right', color: c.color, borderRight: `0.5px solid ${T.brd}`, background: c.bg, fontFamily: FONT.heading, fontSize: 12, fontWeight: 600 }}>
                    {fmtEur(totals[c.bru] as number)}
                  </td>
                ))}
                <td style={{ padding: '10px 10px', textAlign: 'right', color: T.pri, fontFamily: FONT.heading, fontSize: 12, fontWeight: 600 }}>{fmtEur(totals.total_bruto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p style={{ fontSize: 10, color: T.mut, marginTop: 8, fontFamily: FONT.body }}>Haz clic en una semana para ver el detalle diario</p>
    </>
  )
}

function TabMeses({ allData, canal }: { allData: RawDiario[]; canal: CanalFilter }) {
  const { T } = useTheme()
  const allRows = useMemo(() => buildMeses(allData), [allData])

  const years = useMemo(() => {
    const s = new Set(allRows.map(r => r.anio))
    return [...s].sort((a, b) => b - a)
  }, [allRows])

  const [selYear, setSelYear] = useState(new Date().getFullYear())
  useEffect(() => { if (years.length > 0 && !years.includes(selYear)) setSelYear(years[0]) }, [years, selYear])

  const rows = useMemo(() => allRows.filter(r => r.anio === selYear), [allRows, selYear])

  const yearTotal = useMemo(() => {
    const a = aggregate(allData.filter(r => r.fecha.startsWith(String(selYear))))
    const dias = new Set(allData.filter(r => r.fecha.startsWith(String(selYear))).map(r => r.fecha)).size
    return { ...a, dias }
  }, [allData, selYear])

  const exportar = () => {
    const headers = ['Mes', 'Dias', 'UE', 'Glovo', 'JE', 'Web', 'Directa', 'Total Ped', 'Total Bruto', 'Media Diaria', 'vs Anterior']
    const csvRows = rows.map(r => {
      const vs = r.vs_anterior !== null ? r.vs_anterior.toFixed(1) + '%' : ''
      return [MES_NOMBRE[r.mes], r.dias, r.uber_bruto, r.glovo_bruto, r.je_bruto, r.web_bruto, r.directa_bruto, r.total_pedidos, r.total_bruto, r.media_diaria.toFixed(2), vs]
    })
    downloadCSV(`facturacion_meses_${selYear}.csv`, headers, csvRows)
  }

  if (allRows.length === 0) return <EmptyState T={T} label="Sin datos mensuales" />

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {years.length > 1 && (
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
            style={{ background: T.inp, color: T.pri, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: '6px 12px', fontSize: 13, fontFamily: FONT.body, cursor: 'pointer' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <button onClick={exportar}
          style={{ padding: '6px 14px', fontSize: 11, color: T.sec, background: 'none', border: `0.5px solid ${T.brd}`, borderRadius: 10, cursor: 'pointer', fontFamily: FONT.heading, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500 }}>
          Exportar CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <MiniKpi label="Facturación Bruta" valor={fmtEur(getBru(yearTotal, canal))} />
        <MiniKpi label="Pedidos" valor={fmtInt(getPed(yearTotal, canal))} />
        <MiniKpi label="Facturación Diaria" valor={yearTotal.dias > 0 ? fmtEur(getBru(yearTotal, canal) / yearTotal.dias) : '—'} />
      </div>

      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse', tableLayout: 'auto', minWidth: 'max-content' }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
                <th style={{ padding: '10px 10px', textAlign: 'left', color: T.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400, fontFamily: FONT.heading }}>Mes</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', color: T.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400, fontFamily: FONT.heading }}>Días</th>
                {COLS.map(c => (
                  <th key={c.label} style={{ padding: '10px 10px', textAlign: 'center', background: c.bg, borderRight: `0.5px solid ${T.brd}`, color: c.color, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>{c.label}</th>
                ))}
                <th style={{ padding: '10px 10px', textAlign: 'right', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400, fontFamily: FONT.heading, color: T.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px' }}>Media/día</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', background: T.group, fontWeight: 400, fontFamily: FONT.heading, color: T.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px' }}>vs Anterior</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.mes} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                  <td style={{ padding: '8px 10px', textAlign: 'left', color: T.pri, fontWeight: 500, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.body }}>{MES_NOMBRE[r.mes]}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.body, fontSize: 13 }}>{r.dias}</td>
                  {COLS.map(c => (
                    <td key={c.label} style={{ padding: '8px 10px', textAlign: 'right', color: (r[c.bru] as number) > 0 ? T.pri : T.mut, borderRight: `0.5px solid ${T.brd}`, background: c.bg, fontFamily: FONT.body, fontSize: 13 }}>
                      {(r[c.bru] as number) > 0 ? fmtEur(r[c.bru] as number) : <Dash T={T} />}
                    </td>
                  ))}
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.body, fontSize: 13 }}>{r.dias > 0 ? fmtEur(r.media_diaria) : '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{r.vs_anterior !== null ? <DesvBadge pct={r.vs_anterior} /> : <Dash T={T} />}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `1px solid ${T.brd}`, background: T.group, fontWeight: 600 }}>
                <td style={{ padding: '10px 10px', textAlign: 'left', color: T.pri, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase' }}>{selYear} Total</td>
                <td style={{ padding: '10px 10px', textAlign: 'center', color: T.pri, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.heading, fontSize: 12, fontWeight: 600 }}>{yearTotal.dias}</td>
                {COLS.map(c => (
                  <td key={c.label} style={{ padding: '10px 10px', textAlign: 'right', color: c.color, borderRight: `0.5px solid ${T.brd}`, background: c.bg, fontFamily: FONT.heading, fontSize: 12, fontWeight: 600 }}>
                    {fmtEur(yearTotal[c.bru] as number)}
                  </td>
                ))}
                <td style={{ padding: '10px 10px', textAlign: 'right', color: T.pri, borderRight: `0.5px solid ${T.brd}`, fontFamily: FONT.heading, fontSize: 12, fontWeight: 600 }}>
                  {yearTotal.dias > 0 ? fmtEur(getBru(yearTotal, canal) / yearTotal.dias) : '—'}
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right' }} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}

interface FormFields {
  uber_pedidos: string; uber_bruto: string
  glovo_pedidos: string; glovo_bruto: string
  je_ped: string; je_bru: string
  web_pedidos: string; web_bruto: string
  directa_ped: string; directa_bru: string
}

const FORM_COLS: { label: string; ped: keyof FormFields; bru: keyof FormFields }[] = [
  { label: 'Uber Eats',     ped: 'uber_pedidos',  bru: 'uber_bruto' },
  { label: 'Glovo',         ped: 'glovo_pedidos', bru: 'glovo_bruto' },
  { label: 'Web',           ped: 'web_pedidos',   bru: 'web_bruto' },
  { label: 'Venta Directa', ped: 'directa_ped',   bru: 'directa_bru' },
]

// ─── MODAL AÑADIR/EDITAR DÍA ───────────────────────────────────────────────
function DayModal({ allData, existing, onClose, onSaved }: { allData: RawDiario[]; existing?: RawDiario; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!existing
  const [fecha, setFecha] = useState(existing?.fecha ?? new Date().toISOString().slice(0, 10))
  // Modo: 'TODO' | 'ALM' | 'CENAS' | 'CENAS_ALM'
  const [servicio, setServicio] = useState(existing?.servicio ?? 'TODO')
  const [fields, setFields] = useState<FormFields>(() => {
    if (!existing) return {
      uber_pedidos: '', uber_bruto: '', glovo_pedidos: '', glovo_bruto: '',
      je_ped: '', je_bru: '', web_pedidos: '', web_bruto: '',
      directa_ped: '0', directa_bru: '0.00',
    }
    return {
      uber_pedidos: String(existing.uber_pedidos || ''), uber_bruto: String(existing.uber_bruto || ''),
      glovo_pedidos: String(existing.glovo_pedidos || ''), glovo_bruto: String(existing.glovo_bruto || ''),
      je_ped: String(existing.je_pedidos || ''), je_bru: String(existing.je_bruto || ''),
      web_pedidos: String(existing.web_pedidos || ''), web_bruto: String(existing.web_bruto || ''),
      directa_ped: String(existing.directa_pedidos || 0), directa_bru: String(existing.directa_bruto || 0),
    }
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { T, isDark } = useTheme()

  const [jeItems, setJeItems] = useState<number[]>(existing && (existing.je_bruto ?? 0) > 0 ? [existing.je_bruto] : [])
  const [jeInput, setJeInput] = useState('')

  useEffect(() => {
    const total = jeItems.reduce((a, b) => a + b, 0)
    setFields(f => ({ ...f, je_ped: String(jeItems.length), je_bru: total.toFixed(2) }))
  }, [jeItems])

  const set = (k: keyof FormFields, v: string) => setFields(p => ({ ...p, [k]: v }))

  // Fila ALM del mismo día (para modo CENAS_ALM)
  const filaAlm = useMemo(() =>
    allData.find(r => r.fecha === fecha && r.servicio === 'ALM'),
    [allData, fecha]
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!fecha) { setFormError('Selecciona una fecha'); return }

    // ── Modo CENAS_ALM: calcula CENAS = total - ALM ──
    if (servicio === 'CENAS_ALM') {
      if (!filaAlm) {
        setFormError('No hay datos de ALM para este día. Introduce primero el almuerzo.')
        return
      }
      const uber_bru_total = parseFloat(fields.uber_bruto) || 0
      const glovo_bru_total = parseFloat(fields.glovo_bruto) || 0
      const je_bru_total = parseFloat(fields.je_bru) || 0
      const web_bru_total = parseFloat(fields.web_bruto) || 0
      const directa_bru_total = parseFloat(fields.directa_bru) || 0
      const uber_ped_total = Math.round(parseFloat(fields.uber_pedidos) || 0)
      const glovo_ped_total = Math.round(parseFloat(fields.glovo_pedidos) || 0)
      const je_ped_total = Math.round(parseFloat(fields.je_ped) || 0)
      const web_ped_total = Math.round(parseFloat(fields.web_pedidos) || 0)
      const directa_ped_total = Math.round(parseFloat(fields.directa_ped) || 0)

      const uber_bru_cena = Math.max(0, uber_bru_total - (filaAlm.uber_bruto || 0))
      const glovo_bru_cena = Math.max(0, glovo_bru_total - (filaAlm.glovo_bruto || 0))
      const je_bru_cena = Math.max(0, je_bru_total - (filaAlm.je_bruto || 0))
      const web_bru_cena = Math.max(0, web_bru_total - (filaAlm.web_bruto || 0))
      const directa_bru_cena = Math.max(0, directa_bru_total - (filaAlm.directa_bruto || 0))
      const uber_ped_cena = Math.max(0, uber_ped_total - (filaAlm.uber_pedidos || 0))
      const glovo_ped_cena = Math.max(0, glovo_ped_total - (filaAlm.glovo_pedidos || 0))
      const je_ped_cena = Math.max(0, je_ped_total - (filaAlm.je_pedidos || 0))
      const web_ped_cena = Math.max(0, web_ped_total - (filaAlm.web_pedidos || 0))
      const directa_ped_cena = Math.max(0, directa_ped_total - (filaAlm.directa_pedidos || 0))

      const tot_ped = uber_ped_cena + glovo_ped_cena + je_ped_cena + web_ped_cena + directa_ped_cena
      const tot_bru = uber_bru_cena + glovo_bru_cena + je_bru_cena + web_bru_cena + directa_bru_cena

      if (tot_ped === 0 && tot_bru === 0) {
        setFormError('El total introducido es igual o menor al ALM ya registrado. Revisa los datos.')
        return
      }

      const payload = {
        fecha, servicio: 'CENAS',
        uber_pedidos: uber_ped_cena, uber_bruto: parseFloat(uber_bru_cena.toFixed(2)),
        glovo_pedidos: glovo_ped_cena, glovo_bruto: parseFloat(glovo_bru_cena.toFixed(2)),
        je_pedidos: je_ped_cena, je_bruto: parseFloat(je_bru_cena.toFixed(2)),
        web_pedidos: web_ped_cena, web_bruto: parseFloat(web_bru_cena.toFixed(2)),
        directa_pedidos: directa_ped_cena, directa_bruto: parseFloat(directa_bru_cena.toFixed(2)),
        total_pedidos: tot_ped, total_bruto: parseFloat(tot_bru.toFixed(2)),
      }
      setSaving(true)
      const { error } = await supabase.from('facturacion_diario').insert(payload)
      setSaving(false)
      if (error) { setFormError(error.message); return }
      onSaved()
      return
    }

    // ── Modo normal (TODO / ALM / CENAS) ──
    const uber_ped = Math.round(parseFloat(fields.uber_pedidos) || 0)
    const uber_bru = parseFloat(fields.uber_bruto) || 0
    const glovo_ped = Math.round(parseFloat(fields.glovo_pedidos) || 0)
    const glovo_bru = parseFloat(fields.glovo_bruto) || 0
    const je_ped = Math.round(parseFloat(fields.je_ped) || 0)
    const je_bru = parseFloat(fields.je_bru) || 0
    const web_ped = Math.round(parseFloat(fields.web_pedidos) || 0)
    const web_bru = parseFloat(fields.web_bruto) || 0
    const directa_ped = Math.round(parseFloat(fields.directa_ped) || 0)
    const directa_bru = parseFloat(fields.directa_bru) || 0
    const tot_ped = uber_ped + glovo_ped + je_ped + web_ped + directa_ped
    const tot_bru = uber_bru + glovo_bru + je_bru + web_bru + directa_bru
    if (tot_ped === 0 && tot_bru === 0) { setFormError('Introduce datos en al menos un canal'); return }
    const payload = {
      fecha, servicio,
      uber_pedidos: uber_ped, uber_bruto: uber_bru,
      glovo_pedidos: glovo_ped, glovo_bruto: glovo_bru,
      je_pedidos: je_ped, je_bruto: je_bru,
      web_pedidos: web_ped, web_bruto: web_bru,
      directa_pedidos: directa_ped, directa_bruto: directa_bru,
      total_pedidos: tot_ped, total_bruto: tot_bru,
    }
    setSaving(true)
    const { error } = isEdit
      ? await supabase.from('facturacion_diario').update(payload).eq('id', existing!.id)
      : await supabase.from('facturacion_diario').insert(payload)
    setSaving(false)
    if (error) { setFormError(error.message); return }
    onSaved()
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar este día?')) return
    const { error } = await supabase.from('facturacion_diario').delete().eq('id', existing!.id)
    if (error) { setFormError(error.message); return }
    onSaved()
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    background: isDark ? '#3a4058' : '#ffffff',
    color: T.pri,
    border: `1px solid ${isDark ? '#4a5270' : '#cccccc'}`,
    borderRadius: 8, padding: '8px 12px',
    fontSize: 13, fontFamily: FONT.body, outline: 'none',
  }

  const CANAL_COLORS: Record<string, { bg: string; border: string; label: string }> = {
    'Uber Eats':     { bg: '#06C16712', border: '#06C167', label: '#06C167' },
    'Glovo':         { bg: isDark ? '#e8f44212' : '#8a780012', border: isDark ? '#e8f442' : '#8a7800', label: isDark ? '#e8f442' : '#8a7800' },
    'Web':           { bg: '#B01D2312', border: '#B01D23', label: '#B01D23' },
    'Venta Directa': { bg: '#66aaff12', border: '#66aaff', label: '#66aaff' },
  }

  const renderCanalCard = (c: typeof FORM_COLS[number]) => {
    const cc = CANAL_COLORS[c.label]
    return (
      <div key={c.label} style={{ background: cc?.bg ?? `${T.group}55`, border: `1px solid ${cc?.border ?? T.brd}`, borderRadius: 10, padding: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 10, color: cc?.label ?? T.sec, fontFamily: FONT.heading, letterSpacing: 1, textTransform: 'uppercase' }}>{c.label}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: T.sec, marginBottom: 4 }}>Pedidos</label>
            <input type="number" min="0" placeholder="0" value={fields[c.ped]} onChange={e => set(c.ped, e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: T.sec, marginBottom: 4 }}>Bruto (EUR)</label>
            <input type="number" min="0" step="0.01" placeholder="0.00" value={fields[c.bru]} onChange={e => set(c.bru, e.target.value)} style={inputStyle} />
          </div>
        </div>
      </div>
    )
  }

  // Botones servicio
  const SERVICIOS: { key: string; label: string; tooltip?: string }[] = [
    { key: 'TODO',      label: 'TODOS' },
    { key: 'ALM',       label: 'ALM' },
    { key: 'CENAS',     label: 'CENAS' },
    { key: 'CENAS_ALM', label: 'CENAS/ALM', tooltip: 'Introduce el total del día y se calcula CENAS restando el ALM ya guardado' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 16 }} onClick={onClose}>
      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `0.5px solid ${T.brd}` }}>
          <h3 style={{ color: T.pri, fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, margin: 0 }}>{isEdit ? 'EDITAR DÍA' : 'AÑADIR DÍA'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.sec, fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: 0 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* FECHA + SERVICIO — nueva distribución */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            {/* Fecha: 43% del ancho (~20% menos que antes) */}
            <div style={{ flex: '0 0 43%' }}>
              <label style={{ display: 'block', fontSize: 11, color: T.sec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: FONT.heading }}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
            </div>
            {/* Botones servicio: ocupan el resto */}
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: T.sec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: FONT.heading }}>Servicio</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {SERVICIOS.map(s => {
                  const isActive = servicio === s.key
                  const isCenasAlm = s.key === 'CENAS_ALM'
                  const disabled = isCenasAlm && isEdit
                  return (
                    <button
                      key={s.key}
                      type="button"
                      title={s.tooltip}
                      disabled={disabled}
                      onClick={() => !disabled && setServicio(s.key)}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        borderRadius: 8,
                        fontSize: 10,
                        fontWeight: 600,
                        border: isActive ? 'none' : `0.5px solid ${T.brd}`,
                        background: isActive
                          ? (isCenasAlm ? '#7c3aed' : '#B01D23')
                          : 'none',
                        color: isActive ? '#ffffff' : (disabled ? T.mut : T.sec),
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontFamily: FONT.heading,
                        letterSpacing: '0.5px',
                        opacity: disabled ? 0.4 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
              {/* Aviso modo CENAS_ALM */}
              {servicio === 'CENAS_ALM' && (
                <p style={{ fontSize: 10, color: filaAlm ? '#16a34a' : '#f5a623', marginTop: 6, fontFamily: FONT.body }}>
                  {filaAlm
                    ? `ALM encontrado: ${fmtEur(filaAlm.total_bruto)} · ${filaAlm.total_pedidos} ped. Introduce el total del día.`
                    : `⚠ No hay ALM registrado para ${fecha}. Guarda primero el almuerzo.`}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {FORM_COLS.slice(0, 2).map(renderCanalCard)}
          </div>

          <div style={{ background: '#f5a62312', border: '1px solid #f5a623', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: 2, color: '#f5a623', textTransform: 'uppercase' }}>Just Eat</span>
              {jeItems.length > 0 && (
                <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>
                  {jeItems.length} pedido{jeItems.length !== 1 ? 's' : ''} · {jeItems.reduce((a, b) => a + b, 0).toFixed(2)} €
                </span>
              )}
            </div>
            {jeItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {jeItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: T.card, border: `0.5px solid ${T.brd}` }}>
                    <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{item.toFixed(2)} €</span>
                    <button type="button" onClick={() => setJeItems(p => p.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" step="0.01" min="0" placeholder="Importe (€)"
                value={jeInput} onChange={e => setJeInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const v = parseFloat(jeInput)
                    if (v > 0) { setJeItems(p => [...p, v]); setJeInput('') }
                  }
                }}
                style={{ ...inputStyle, flex: 1, width: 'auto', padding: '6px 10px' }} />
              <button type="button"
                onClick={() => { const v = parseFloat(jeInput); if (v > 0) { setJeItems(p => [...p, v]); setJeInput('') } }}
                style={{ padding: '6px 14px', borderRadius: 8, background: '#f5a623', color: '#ffffff', border: 'none', cursor: 'pointer', fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, flexShrink: 0 }}>+</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {FORM_COLS.slice(2).map(renderCanalCard)}
          </div>

          {formError && <p style={{ color: '#dc2626', fontSize: 12, margin: 0 }}>{formError}</p>}
          <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
            {isEdit && (
              <button type="button" onClick={handleDelete}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: `1px solid #B01D23`, background: 'none', color: '#B01D23', cursor: 'pointer', fontFamily: FONT.body }}>
                Eliminar
              </button>
            )}
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: `0.5px solid ${T.brd}`, background: 'none', color: T.sec, cursor: 'pointer', fontFamily: FONT.body }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', background: '#B01D23', color: '#ffffff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: FONT.body, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MiniKpi({ label, valor }: { label: string; valor: string }) {
  const { T } = useTheme()
  return (
    <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: T.pri }}>{valor}</div>
    </div>
  )
}

function Loader({ T }: { T: any }) {
  return (
    <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, padding: 48, textAlign: 'center' }}>
      <p style={{ color: T.sec, fontSize: 13, margin: 0, fontFamily: FONT.body }}>Cargando…</p>
    </div>
  )
}

function ErrorBox({ T, msg, onRetry }: { T: any; msg: string; onRetry: () => void }) {
  return (
    <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, padding: 32, textAlign: 'center' }}>
      <p style={{ color: '#dc2626', fontSize: 13, fontFamily: FONT.body }}>{msg}</p>
      <button onClick={onRetry} style={{ marginTop: 12, fontSize: 12, color: T.pri, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontFamily: FONT.body }}>Reintentar</button>
    </div>
  )
}

function EmptyState({ T, label, onAdd }: { T: any; label: string; onAdd?: () => void }) {
  return (
    <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, padding: 48, textAlign: 'center' }}>
      <p style={{ color: T.sec, fontSize: 13, margin: 0, fontFamily: FONT.body }}>{label}</p>
      {onAdd && (
        <button onClick={onAdd}
          style={{ marginTop: 16, padding: '8px 22px', borderRadius: 10, background: '#B01D23', color: '#ffffff', border: 'none', cursor: 'pointer', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', fontWeight: 600, textTransform: 'uppercase' }}>
          + Añadir día
        </button>
      )}
    </div>
  )
}

function ServicioBadge({ s }: { s: string }) {
  const color = s === 'ALM' ? '#d97706' : s === 'CENAS' ? '#7c3aed' : '#6b7280'
  const bg = `${color}18`
  return (
    <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: bg, color, fontFamily: FONT.heading, letterSpacing: '0.5px' }}>{s}</span>
  )
}

function DesvBadge({ pct }: { pct: number }) {
  const pos = pct >= 0
  const color = pos ? '#16a34a' : '#dc2626'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: `${color}18`, color, fontFamily: FONT.body }}>
      {pos ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function Dash({ T }: { T: any }) {
  return <span style={{ color: T.mut }}>—</span>
}

/* ─── TAB ANUAL ─── */

interface AnualYear { anio: number; bruto: number; pedidos: number; mediaMensual: number; mediaTicket: number }

function TabAnual({ allData, canal }: { allData: RawDiario[]; canal: CanalFilter }) {
  const { T } = useTheme()

  const years = useMemo<AnualYear[]>(() => {
    const byYear = new Map<number, { bruto: number; pedidos: number }>()
    for (const r of allData) {
      const y = parseInt(r.fecha.slice(0, 4))
      if (!byYear.has(y)) byYear.set(y, { bruto: 0, pedidos: 0 })
      const cur = byYear.get(y)!
      cur.bruto += getBru(r, canal)
      cur.pedidos += getPed(r, canal)
    }
    return [...byYear.entries()].sort((a, b) => b[0] - a[0]).map(([anio, v]) => ({
      anio,
      bruto: v.bruto,
      pedidos: v.pedidos,
      mediaMensual: v.bruto / 12,
      mediaTicket: v.pedidos > 0 ? v.bruto / v.pedidos : 0,
    }))
  }, [allData, canal])

  const maxBruto = Math.max(...years.map(y => y.bruto), 1)

  const thS: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase',
    color: T.mut, padding: '10px 14px', textAlign: 'left', background: '#0a0a0a',
    borderBottom: `0.5px solid ${T.brd}`,
  }
  const tdS: CSSProperties = {
    padding: '12px 14px', fontSize: 13, fontFamily: FONT.body, color: T.pri,
    borderBottom: `0.5px solid ${T.brd}`,
  }

  return (
    <div>
      {/* 4 cards grandes */}
      {years.length > 0 && (() => {
        const cur = years[0]
        const prev = years[1]
        const delta = prev ? ((cur.bruto - prev.bruto) / prev.bruto) * 100 : null
        const deltaTicket = prev && prev.mediaTicket > 0 ? ((cur.mediaTicket - prev.mediaTicket) / prev.mediaTicket) * 100 : null
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5" style={{ marginBottom: 20 }}>
            {[
              { label: `Facturación ${cur.anio}`, value: fmtEur(cur.bruto), delta, positive: true, color: '#e8f442' },
              { label: 'Media mensual', value: fmtEur(cur.mediaMensual), delta: null, positive: true, color: T.pri },
              { label: 'Pedidos totales', value: Math.round(cur.pedidos).toLocaleString('es-ES'), delta: null, positive: true, color: T.pri },
              { label: 'Ticket medio', value: fmtEur(cur.mediaTicket), delta: deltaTicket, positive: true, color: T.pri },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>{kpi.label}</div>
                <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: kpi.color }}>{kpi.value}</div>
                {kpi.delta != null && (
                  <div style={{ fontFamily: FONT.body, fontSize: 12, color: kpi.delta >= 0 ? '#1D9E75' : '#E24B4A', marginTop: 4 }}>
                    {kpi.delta >= 0 ? '▲' : '▼'} {Math.abs(kpi.delta).toFixed(1)}% vs {cur.anio - 1}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })()}

      {/* Tabla comparativa por año */}
      <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thS}>Año</th>
              <th style={{ ...thS, textAlign: 'right' }}>Facturación bruta</th>
              <th style={{ ...thS }}>vs año anterior</th>
              <th style={{ ...thS, textAlign: 'right' }}>Media mensual</th>
              <th style={{ ...thS, textAlign: 'right' }}>Pedidos</th>
              <th style={{ ...thS, textAlign: 'right' }}>Ticket medio</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y, idx) => {
              const prev = years[idx + 1]
              const delta = prev ? ((y.bruto - prev.bruto) / prev.bruto) * 100 : null
              const barW = `${Math.round((y.bruto / maxBruto) * 100)}%`
              return (
                <tr key={y.anio}>
                  <td style={{ ...tdS, fontFamily: FONT.heading, color: '#e8f442', fontWeight: 600 }}>{y.anio}</td>
                  <td style={{ ...tdS, textAlign: 'right' }}>
                    <div style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: T.pri, marginBottom: 4 }}>{fmtEur(y.bruto)}</div>
                    <div style={{ height: 4, background: T.brd, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: 4, width: barW, background: '#e8f442', borderRadius: 2 }} />
                    </div>
                  </td>
                  <td style={tdS}>
                    {delta != null ? (
                      <span style={{ fontFamily: FONT.heading, fontSize: 12, color: delta >= 0 ? '#1D9E75' : '#E24B4A', fontWeight: 600 }}>
                        {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                      </span>
                    ) : <span style={{ color: T.mut }}>—</span>}
                  </td>
                  <td style={{ ...tdS, textAlign: 'right', color: T.sec }}>{fmtEur(y.mediaMensual)}</td>
                  <td style={{ ...tdS, textAlign: 'right', color: T.sec }}>{Math.round(y.pedidos).toLocaleString('es-ES')}</td>
                  <td style={{ ...tdS, textAlign: 'right', color: T.sec }}>{fmtEur(y.mediaTicket)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
