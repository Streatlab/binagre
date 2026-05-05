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

// ─── Paleta Conciliación (calco exacto) ───────────────────────
const C = {
  bg:     '#f5f3ef',
  card:   '#ffffff',
  brd:    '#d0c8bc',
  text:   '#111111',
  muted:  '#7a8090',
  hover:  '#f5f3ef60',
  rowBrd: '#ebe8e2',
  active: '#B01D23',
}

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
type SortDir = 'asc' | 'desc'
type SortCol = 'fecha' | 'serv' | 'uber' | 'glovo' | 'je' | 'web' | 'dir' | 'total'

const COLS: { id: string; label: string; ped: keyof AggRow; bru: keyof AggRow; color: string; bg: string }[] = [
  { id: 'uber',  label: 'Uber Eats', ped: 'uber_pedidos',    bru: 'uber_bruto',    color: '#06C167', bg: '#06C16712' },
  { id: 'glovo', label: 'Glovo',     ped: 'glovo_pedidos',   bru: 'glovo_bruto',   color: '#8a7800', bg: '#e8f44218' },
  { id: 'je',    label: 'Just Eat',  ped: 'je_pedidos',      bru: 'je_bruto',      color: '#f5a623', bg: '#f5a62312' },
  { id: 'web',   label: 'Web',       ped: 'web_pedidos',     bru: 'web_bruto',     color: '#B01D23', bg: '#B01D2312' },
  { id: 'dir',   label: 'Directa',   ped: 'directa_pedidos', bru: 'directa_bruto', color: '#66aaff', bg: '#66aaff12' },
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
    return <span style={{ backgroundColor: '#B01D23', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontFamily: 'Oswald, sans-serif', letterSpacing: 0.5, textTransform: 'uppercase' }}>CERRADO</span>
  }
  if (tipo === 'solo_comida') {
    return <span style={{ backgroundColor: '#e8f442', color: '#111', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontFamily: 'Oswald, sans-serif', letterSpacing: 0.5 }}>ALM</span>
  }
  if (tipo === 'solo_cena') {
    return <span style={{ backgroundColor: '#f5a623', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontFamily: 'Oswald, sans-serif', letterSpacing: 0.5 }}>CENA</span>
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

  const drillWeek = (year: number, week: number) => { setWeekFilter({ year, week }); setTab('diario') }
  const clearWeekFilter = () => setWeekFilter(null)

  const todayStr = today()
  const currentIso = isoWeek(todayStr)
  const currentMonth = todayStr.slice(0, 7)
  const currentYear = todayStr.slice(0, 4)

  const filteredData = useMemo(() =>
    servicioFiltro === 'Todos' ? allData : allData.filter(r => r.servicio === servicioFiltro),
    [allData, servicioFiltro]
  )

  // ─── Estilos Conciliación calco ───────────────────────────
  const tabBtnStyle = (active: boolean): CSSProperties => ({
    padding: '7px 18px', borderRadius: 8, fontFamily: 'Oswald, sans-serif',
    fontSize: 11, fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase',
    border: active ? 'none' : `0.5px solid ${C.brd}`,
    background: active ? C.active : C.card,
    color: active ? '#fff' : C.muted,
    cursor: 'pointer',
  })

  const servicioBtn = (active: boolean): CSSProperties => ({
    padding: '6px 14px', borderRadius: 8, fontFamily: 'Oswald, sans-serif',
    fontSize: 11, fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase',
    border: active ? 'none' : `0.5px solid ${C.brd}`,
    background: active ? C.active : C.card,
    color: active ? '#fff' : C.muted,
    cursor: 'pointer',
  })

  return (
    <div style={{ background: C.bg, padding: '24px 28px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ color: '#B01D23', fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 600, letterSpacing: '3px', margin: 0, textTransform: 'uppercase' }}>
          FACTURACIÓN
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {['Todos', 'ALM', 'CENAS'].map(s => (
            <button key={s} onClick={() => setServicioFiltro(s)} style={servicioBtn(servicioFiltro === s)}>{s}</button>
          ))}
          <div style={{ position: 'relative' }} data-drop-canal="canales">
            <button onClick={e => { e.stopPropagation(); setDropCanalOpen(p => !p) }}
              style={{ padding: '6px 12px', borderRadius: 8, fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', border: `0.5px solid ${C.brd}`, background: C.card, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>{canalFilterSelected.length >= 5 ? 'Canales' : canalFilterSelected.length === 1 ? canalFilterSelected[0] : `${canalFilterSelected.length} canales`}</span>
              <ChevronDown size={11} strokeWidth={2.5} />
            </button>
            {dropCanalOpen && (
              <div style={{ position: 'absolute', top: '110%', right: 0, background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 10, padding: '6px 0', zIndex: 20, minWidth: 150, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                {['Todos', 'Uber Eats', 'Glovo', 'Just Eat', 'Web', 'Directa'].map(c => (
                  <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: C.text }}>
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
          <SelectorFechaUniversal nombreModulo="facturacion" onChange={() => {}} />
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key !== 'diario') clearWeekFilter() }}
            style={tabBtnStyle(tab === t.key)}>
            {t.label}
          </button>
        ))}
        {weekFilter && (
          <button onClick={clearWeekFilter}
            style={{ padding: '6px 12px', background: '#B01D2312', color: C.active, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, borderRadius: 8, border: `0.5px solid #B01D2330`, cursor: 'pointer' }}>
            S{weekFilter.week} ×
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 14, padding: 48, textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: C.muted }}>Cargando…</div>
      ) : error ? (
        <div style={{ background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
          <p style={{ color: '#E24B4A', fontSize: 13, fontFamily: 'Lexend, sans-serif' }}>{error}</p>
          <button onClick={refresh} style={{ marginTop: 12, fontSize: 12, color: C.text, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'Lexend, sans-serif' }}>Reintentar</button>
        </div>
      ) : (
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
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [mesFilter, setMesFilter] = useState(currentMonth)
  const [sortCol, setSortCol] = useState<SortCol>('fecha')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const rows = useMemo(() => {
    let data = allData
    if (weekFilter) {
      const [from, to] = weekBounds(weekFilter.year, weekFilter.week)
      data = data.filter(r => r.fecha >= from && r.fecha <= to)
    }
    if (mesFilter !== 'todos') {
      data = data.filter(r => r.fecha.startsWith(mesFilter))
    }
    const sorted = [...data].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0
      if (sortCol === 'fecha') { va = a.fecha; vb = b.fecha }
      else if (sortCol === 'serv') { va = a.servicio; vb = b.servicio }
      else if (sortCol === 'uber') { va = a.uber_bruto; vb = b.uber_bruto }
      else if (sortCol === 'glovo') { va = a.glovo_bruto; vb = b.glovo_bruto }
      else if (sortCol === 'je') { va = a.je_bruto; vb = b.je_bruto }
      else if (sortCol === 'web') { va = a.web_bruto; vb = b.web_bruto }
      else if (sortCol === 'dir') { va = a.directa_bruto; vb = b.directa_bruto }
      else if (sortCol === 'total') { va = a.total_bruto; vb = b.total_bruto }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
    return sorted
  }, [allData, weekFilter, mesFilter, sortCol, sortDir])

  const mesesDisponibles = useMemo(() => {
    const set = new Set(allData.map(r => r.fecha.slice(0, 7)))
    return [...set].sort().reverse()
  }, [allData])

  const totals = useMemo(() => aggregate(rows), [rows])

  // Subtotal por fecha (dias con >1 fila)
  const fechaCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.fecha, (m.get(r.fecha) ?? 0) + 1)
    return m
  }, [rows])

  const subtotalPorFecha = useMemo(() => {
    const m = new Map<string, AggRow>()
    for (const [fecha, count] of fechaCount) {
      if (count > 1) {
        const filas = allData.filter(r => r.fecha === fecha)
        m.set(fecha, aggregate(filas))
      }
    }
    return m
  }, [allData, fechaCount])

  // Agrupar por fecha para insertar fila DÍA ANTES de las filas del día
  const rowsConSubtotal = useMemo(() => {
    type Item = { type: 'subtotal'; fecha: string; agg: AggRow } | { type: 'row'; r: RawDiario }
    const result: Item[] = []
    let lastFecha = ''
    for (const r of rows) {
      if (r.fecha !== lastFecha) {
        const count = fechaCount.get(r.fecha) ?? 1
        if (count > 1) {
          result.push({ type: 'subtotal', fecha: r.fecha, agg: subtotalPorFecha.get(r.fecha)! })
        }
        lastFecha = r.fecha
      }
      result.push({ type: 'row', r })
    }
    return result
  }, [rows, fechaCount, subtotalPorFecha])

  const exportar = () => {
    const headers = ['Fecha', 'Servicio', 'UE Ped', 'UE Bruto', 'GL Ped', 'GL Bruto', 'JE Ped', 'JE Bruto', 'Web Ped', 'Web Bruto', 'Dir Ped', 'Dir Bruto', 'Total Ped', 'Total Bruto']
    const csvRows = rows.map(r => [r.fecha, r.servicio, r.uber_pedidos, r.uber_bruto, r.glovo_pedidos, r.glovo_bruto, r.je_pedidos, r.je_bruto, r.web_pedidos, r.web_bruto, r.directa_pedidos, r.directa_bruto, r.total_pedidos, r.total_bruto])
    downloadCSV('facturacion_diario.csv', headers, csvRows)
  }

  if (allData.length === 0) return (
    <div style={{ background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 14, padding: 48, textAlign: 'center' }}>
      <p style={{ color: C.muted, fontSize: 13, margin: 0, fontFamily: 'Lexend, sans-serif' }}>Sin datos de facturación diaria</p>
      <button onClick={onAdd} style={{ marginTop: 16, padding: '8px 22px', borderRadius: 10, background: '#B01D23', color: '#ffffff', border: 'none', cursor: 'pointer', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', fontWeight: 600, textTransform: 'uppercase' }}>+ Añadir día</button>
    </div>
  )

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const arrow = (col: SortCol) => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const thStyle = (col: SortCol, align: 'left' | 'right' | 'center' = 'left'): CSSProperties => ({
    fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px',
    textTransform: 'uppercase', textAlign: align,
    color: sortCol === col ? '#B01D23' : C.muted,
    padding: '10px 12px', background: C.bg, borderBottom: `0.5px solid ${C.brd}`,
    whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
  })

  const thColorStyle = (col: SortCol, color: string, bg: string, align: 'left' | 'right' | 'center' = 'center'): CSSProperties => ({
    ...thStyle(col, align),
    background: bg,
    color: sortCol === col ? color : `${color}99`,
  })

  const tdBase: CSSProperties = {
    padding: '9px 12px', fontSize: 13, fontFamily: 'Lexend, sans-serif',
    color: C.text, borderBottom: `0.5px solid ${C.rowBrd}`,
    whiteSpace: 'nowrap', verticalAlign: 'middle',
  }

  return (
    <>
      {/* Filtros + KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        {[
          { label: 'Facturación Bruta', valor: fmtInt(Math.round(getBru(totals, canal))) },
          { label: 'Pedidos', valor: fmtInt(getPed(totals, canal)) },
          { label: 'Ticket Medio', valor: getPed(totals, canal) > 0 ? fmtInt(Math.round(getBru(totals, canal) / getPed(totals, canal))) : '—' },
          { label: 'Media Diaria', valor: (() => { const d = new Set(rows.map(r => r.fecha)).size; return d > 0 ? fmtInt(Math.round(getBru(totals, canal) / d)) : '—' })() },
        ].map(k => (
          <div key={k.label} style={{ background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: '0.5px', color: C.text }}>{k.valor}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={mesFilter} onChange={e => setMesFilter(e.target.value)}
          style={{ padding: '9px 14px', borderRadius: 10, border: `0.5px solid ${C.brd}`, background: C.card, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: C.text, cursor: 'pointer' }}>
          <option value="todos">Todos los meses</option>
          {mesesDisponibles.map(m => {
            const [y, mm] = m.split('-')
            return <option key={m} value={m}>{MES_NOMBRE[Number(mm)]} {y}</option>
          })}
        </select>
        <button onClick={exportar}
          style={{ padding: '9px 18px', borderRadius: 10, border: `0.5px solid ${C.brd}`, background: C.card, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: C.muted, cursor: 'pointer', fontWeight: 500 }}>
          Exportar CSV
        </button>
        <button onClick={onAdd}
          style={{ padding: '9px 18px', borderRadius: 10, background: '#B01D23', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '1.5px', fontWeight: 600, textTransform: 'uppercase' }}>
          + Añadir día
        </button>
      </div>

      {/* Tabla */}
      <div style={{ background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, whiteSpace: 'nowrap', minWidth: 900 }}>
            <thead>
              <tr>
                <th onClick={() => handleSort('fecha')} style={thStyle('fecha')} rowSpan={2}>Fecha{arrow('fecha')}</th>
                <th onClick={() => handleSort('serv')} style={thStyle('serv')} rowSpan={2}>Serv.{arrow('serv')}</th>
                {COLS.map(c => (
                  <th key={c.id} colSpan={2} onClick={() => handleSort(c.id as SortCol)}
                    style={thColorStyle(c.id as SortCol, c.color, c.bg, 'center')}>
                    {c.label}{arrow(c.id as SortCol)}
                  </th>
                ))}
                <th colSpan={2} onClick={() => handleSort('total')}
                  style={{ ...thStyle('total', 'center'), background: C.bg, color: sortCol === 'total' ? '#B01D23' : C.muted }}>
                  Total{arrow('total')}
                </th>
              </tr>
              <tr>
                {COLS.map(c => (
                  <Fragment key={c.id}>
                    <th style={{ padding: '6px 10px', textAlign: 'center', background: c.bg, borderBottom: `0.5px solid ${C.brd}`, fontFamily: 'Oswald, sans-serif', fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.muted, fontWeight: 400 }}>Ped</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', background: c.bg, borderBottom: `0.5px solid ${C.brd}`, fontFamily: 'Oswald, sans-serif', fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.muted, fontWeight: 400 }}>Bruto</th>
                  </Fragment>
                ))}
                <th style={{ padding: '6px 10px', textAlign: 'center', background: C.bg, borderBottom: `0.5px solid ${C.brd}`, fontFamily: 'Oswald, sans-serif', fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.muted, fontWeight: 400 }}>Ped</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', background: C.bg, borderBottom: `0.5px solid ${C.brd}`, fontFamily: 'Oswald, sans-serif', fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.muted, fontWeight: 400 }}>Bruto</th>
              </tr>
            </thead>
            <tbody>
              {rowsConSubtotal.map((item, idx) => {
                if (item.type === 'subtotal') {
                  const sub = item.agg
                  return (
                    <tr key={`sub-${item.fecha}`} style={{ background: C.bg }}>
                      <td style={{ ...tdBase, color: C.muted, fontSize: 11, borderBottom: `0.5px solid ${C.rowBrd}`, fontFamily: 'Oswald, sans-serif', letterSpacing: '1px' }}>
                        {fmtFechaCorta(item.fecha)}
                      </td>
                      <td style={{ ...tdBase, borderBottom: `0.5px solid ${C.rowBrd}` }}>
                        <span style={{ fontSize: 9, fontFamily: 'Oswald, sans-serif', letterSpacing: '1.5px', textTransform: 'uppercase', color: C.muted, background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 4, padding: '2px 6px' }}>DÍA</span>
                      </td>
                      {COLS.map(c => {
                        const p = (sub[c.ped] as number) || 0
                        const b = (sub[c.bru] as number) || 0
                        return (
                          <Fragment key={c.id}>
                            <td style={{ ...tdBase, textAlign: 'center', background: c.bg, color: p > 0 ? c.color : C.muted, fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 600 }}>{p > 0 ? Math.round(p) : '—'}</td>
                            <td style={{ ...tdBase, textAlign: 'right', background: c.bg, color: b > 0 ? c.color : C.muted, fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 600 }}>{b > 0 ? fmtEur(b) : '—'}</td>
                          </Fragment>
                        )
                      })}
                      <td style={{ ...tdBase, textAlign: 'center', color: C.text, fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 700 }}>{fmtInt(sub.total_pedidos)}</td>
                      <td style={{ ...tdBase, textAlign: 'right', color: C.text, fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 700 }}>{fmtEur(sub.total_bruto)}</td>
                    </tr>
                  )
                }

                const { r } = item
                const tipo = tipoDia(r.fecha)
                const esCerrado = tipo === 'cerrado' || tipo === 'festivo' || tipo === 'vacaciones'
                const isLast = idx === rowsConSubtotal.length - 1

                return (
                  <tr key={r.id} onClick={() => onEdit(r)}
                    style={{ cursor: 'pointer', opacity: esCerrado ? 0.6 : 1 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.hover }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                    <td style={{ ...tdBase, color: C.muted, fontSize: 12, borderBottom: isLast ? 'none' : `0.5px solid ${C.rowBrd}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {fmtFechaCorta(r.fecha)}
                        <TipoPill tipo={tipo} />
                      </div>
                    </td>
                    <td style={{ ...tdBase, borderBottom: isLast ? 'none' : `0.5px solid ${C.rowBrd}` }}>
                      <ServicioBadge s={r.servicio} />
                    </td>
                    {COLS.map(c => {
                      const p = (r[c.ped] as number) || 0
                      const b = (r[c.bru] as number) || 0
                      return (
                        <Fragment key={c.id}>
                          <td style={{ ...tdBase, textAlign: 'center', color: p > 0 ? C.text : C.muted, background: c.bg, borderBottom: isLast ? 'none' : `0.5px solid ${C.rowBrd}` }}>{p > 0 ? Math.round(p) : '—'}</td>
                          <td style={{ ...tdBase, textAlign: 'right', color: b > 0 ? C.text : C.muted, background: c.bg, borderBottom: isLast ? 'none' : `0.5px solid ${C.rowBrd}` }}>{b > 0 ? fmtEur(b) : '—'}</td>
                        </Fragment>
                      )
                    })}
                    <td style={{ ...tdBase, textAlign: 'center', fontWeight: 500, borderBottom: isLast ? 'none' : `0.5px solid ${C.rowBrd}` }}>{fmtInt(r.total_pedidos)}</td>
                    <td style={{ ...tdBase, textAlign: 'right', fontWeight: 600, borderBottom: isLast ? 'none' : `0.5px solid ${C.rowBrd}` }}>{fmtEur(r.total_bruto)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: C.bg }}>
                <td style={{ padding: '10px 12px', color: C.muted, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', borderTop: `0.5px solid ${C.brd}` }} colSpan={2}>Total</td>
                {COLS.map(c => (
                  <Fragment key={c.id}>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: c.color, background: c.bg, fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 600, borderTop: `0.5px solid ${C.brd}` }}>{fmtInt(totals[c.ped] as number)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: c.color, background: c.bg, fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 600, borderTop: `0.5px solid ${C.brd}` }}>{fmtEur(totals[c.bru] as number)}</td>
                  </Fragment>
                ))}
                <td style={{ padding: '10px 12px', textAlign: 'center', color: C.text, fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 600, borderTop: `0.5px solid ${C.brd}` }}>{fmtInt(totals.total_pedidos)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: C.text, fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 600, borderTop: `0.5px solid ${C.brd}` }}>{fmtEur(totals.total_bruto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}

function TabSemanas({ allData, canal, onDrill }: { allData: RawDiario[]; canal: CanalFilter; onDrill: (y: number, w: number) => void }) {
  const rows = useMemo(() => buildSemanas(allData).slice(0, 12), [allData])
  const totals = useMemo(() => aggregate(allData), [allData])

  const exportar = () => {
    const headers = ['Semana', 'Periodo', 'Dias', 'UE', 'Glovo', 'JE', 'Web', 'Directa', 'Total Ped', 'Total Bruto']
    const csvRows = rows.map(r => [`S${r.week}`, r.periodo, r.dias, r.uber_bruto, r.glovo_bruto, r.je_bruto, r.web_bruto, r.directa_bruto, r.total_pedidos, r.total_bruto])
    downloadCSV('facturacion_semanas.csv', headers, csvRows)
  }

  const thS: CSSProperties = { fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.muted, padding: '10px 12px', background: C.bg, borderBottom: `0.5px solid ${C.brd}`, whiteSpace: 'nowrap' }
  const tdS: CSSProperties = { padding: '9px 12px', fontSize: 13, fontFamily: 'Lexend, sans-serif', color: C.text, borderBottom: `0.5px solid ${C.rowBrd}`, whiteSpace: 'nowrap' }

  if (rows.length === 0) return <div style={{ background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 14, padding: 48, textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: C.muted }}>Sin datos semanales</div>

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        {[
          { label: 'Semanas', valor: String(rows.length) },
          { label: 'Facturación Bruta', valor: fmtInt(Math.round(getBru(totals, canal))) },
          { label: 'Pedidos', valor: fmtInt(getPed(totals, canal)) },
        ].map(k => (
          <div key={k.label} style={{ background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, color: C.text }}>{k.valor}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={exportar} style={{ padding: '9px 18px', borderRadius: 10, border: `0.5px solid ${C.brd}`, background: C.card, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: C.muted, cursor: 'pointer' }}>Exportar CSV</button>
      </div>
      <div style={{ background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th style={thS}>Sem</th>
                <th style={thS}>Periodo</th>
                <th style={{ ...thS, textAlign: 'center' }}>Días</th>
                {COLS.map(c => <th key={c.id} style={{ ...thS, background: c.bg, color: `${c.color}99`, textAlign: 'right' }}>{c.label}</th>)}
                <th style={{ ...thS, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.year}-${r.week}`} onClick={() => onDrill(r.year, r.week)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.hover }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                  <td style={{ ...tdS, fontFamily: 'Oswald, sans-serif', fontWeight: 600, borderBottom: idx === rows.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>S{r.week}</td>
                  <td style={{ ...tdS, color: C.muted, borderBottom: idx === rows.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>{r.periodo}</td>
                  <td style={{ ...tdS, textAlign: 'center', color: C.muted, borderBottom: idx === rows.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>{r.dias}</td>
                  {COLS.map(c => (
                    <td key={c.id} style={{ ...tdS, textAlign: 'right', background: c.bg, color: (r[c.bru] as number) > 0 ? C.text : C.muted, borderBottom: idx === rows.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>
                      {(r[c.bru] as number) > 0 ? fmtEur(r[c.bru] as number) : '—'}
                    </td>
                  ))}
                  <td style={{ ...tdS, textAlign: 'right', fontWeight: 600, borderBottom: idx === rows.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>{fmtEur(r.total_bruto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: C.bg }}>
                <td style={{ padding: '10px 12px', color: C.muted, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', borderTop: `0.5px solid ${C.brd}` }} colSpan={3}>Total</td>
                {COLS.map(c => (
                  <td key={c.id} style={{ padding: '10px 12px', textAlign: 'right', color: c.color, background: c.bg, fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 600, borderTop: `0.5px solid ${C.brd}` }}>{fmtEur(totals[c.bru] as number)}</td>
                ))}
                <td style={{ padding: '10px 12px', textAlign: 'right', color: C.text, fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 600, borderTop: `0.5px solid ${C.brd}` }}>{fmtEur(totals.total_bruto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p style={{ fontSize: 10, color: C.muted, marginTop: 8, fontFamily: 'Lexend, sans-serif' }}>Haz clic en una semana para ver el detalle diario</p>
    </>
  )
}

function TabMeses({ allData, canal }: { allData: RawDiario[]; canal: CanalFilter }) {
  const allRows = useMemo(() => buildMeses(allData), [allData])
  const years = useMemo(() => { const s = new Set(allRows.map(r => r.anio)); return [...s].sort((a, b) => b - a) }, [allRows])
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
    const csvRows = rows.map(r => { const vs = r.vs_anterior !== null ? r.vs_anterior.toFixed(1) + '%' : ''; return [MES_NOMBRE[r.mes], r.dias, r.uber_bruto, r.glovo_bruto, r.je_bruto, r.web_bruto, r.directa_bruto, r.total_pedidos, r.total_bruto, r.media_diaria.toFixed(2), vs] })
    downloadCSV(`facturacion_meses_${selYear}.csv`, headers, csvRows)
  }

  const thS: CSSProperties = { fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.muted, padding: '10px 12px', background: C.bg, borderBottom: `0.5px solid ${C.brd}`, whiteSpace: 'nowrap' }
  const tdS: CSSProperties = { padding: '9px 12px', fontSize: 13, fontFamily: 'Lexend, sans-serif', color: C.text, borderBottom: `0.5px solid ${C.rowBrd}`, whiteSpace: 'nowrap' }

  if (allRows.length === 0) return <div style={{ background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 14, padding: 48, textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: C.muted }}>Sin datos mensuales</div>

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        {[
          { label: 'Facturación Bruta', valor: fmtInt(Math.round(getBru(yearTotal, canal))) },
          { label: 'Pedidos', valor: fmtInt(getPed(yearTotal, canal)) },
          { label: 'Media Diaria', valor: yearTotal.dias > 0 ? fmtInt(Math.round(getBru(yearTotal, canal) / yearTotal.dias)) : '—' },
        ].map(k => (
          <div key={k.label} style={{ background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, color: C.text }}>{k.valor}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        {years.length > 1 && (
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
            style={{ padding: '9px 14px', borderRadius: 10, border: `0.5px solid ${C.brd}`, background: C.card, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: C.text, cursor: 'pointer' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <button onClick={exportar} style={{ padding: '9px 18px', borderRadius: 10, border: `0.5px solid ${C.brd}`, background: C.card, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: C.muted, cursor: 'pointer' }}>Exportar CSV</button>
      </div>
      <div style={{ background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th style={thS}>Mes</th>
                <th style={{ ...thS, textAlign: 'center' }}>Días</th>
                {COLS.map(c => <th key={c.id} style={{ ...thS, background: c.bg, color: `${c.color}99`, textAlign: 'right' }}>{c.label}</th>)}
                <th style={{ ...thS, textAlign: 'right' }}>Media/día</th>
                <th style={{ ...thS, textAlign: 'right' }}>vs Anterior</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.mes} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.hover }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                  <td style={{ ...tdS, fontFamily: 'Oswald, sans-serif', fontWeight: 600, borderBottom: idx === rows.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>{MES_NOMBRE[r.mes]}</td>
                  <td style={{ ...tdS, textAlign: 'center', color: C.muted, borderBottom: idx === rows.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>{r.dias}</td>
                  {COLS.map(c => (
                    <td key={c.id} style={{ ...tdS, textAlign: 'right', background: c.bg, color: (r[c.bru] as number) > 0 ? C.text : C.muted, borderBottom: idx === rows.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>
                      {(r[c.bru] as number) > 0 ? fmtEur(r[c.bru] as number) : '—'}
                    </td>
                  ))}
                  <td style={{ ...tdS, textAlign: 'right', color: C.muted, borderBottom: idx === rows.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>{r.dias > 0 ? fmtEur(r.media_diaria) : '—'}</td>
                  <td style={{ ...tdS, textAlign: 'right', borderBottom: idx === rows.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>{r.vs_anterior !== null ? <DesvBadge pct={r.vs_anterior} /> : <span style={{ color: C.muted }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: C.bg }}>
                <td style={{ padding: '10px 12px', color: C.muted, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', borderTop: `0.5px solid ${C.brd}` }} colSpan={2}>{selYear} Total</td>
                {COLS.map(c => (
                  <td key={c.id} style={{ padding: '10px 12px', textAlign: 'right', color: c.color, background: c.bg, fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 600, borderTop: `0.5px solid ${C.brd}` }}>{fmtEur(yearTotal[c.bru] as number)}</td>
                ))}
                <td style={{ padding: '10px 12px', textAlign: 'right', color: C.text, fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 600, borderTop: `0.5px solid ${C.brd}` }}>{yearTotal.dias > 0 ? fmtEur(getBru(yearTotal, canal) / yearTotal.dias) : '—'}</td>
                <td style={{ padding: '10px 12px', borderTop: `0.5px solid ${C.brd}` }} />
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

function DayModal({ allData, existing, onClose, onSaved }: { allData: RawDiario[]; existing?: RawDiario; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!existing
  const [fecha, setFecha] = useState(existing?.fecha ?? new Date().toISOString().slice(0, 10))
  const [servicio, setServicio] = useState(existing?.servicio ?? 'TODO')
  const [fields, setFields] = useState<FormFields>(() => {
    if (!existing) return { uber_pedidos: '', uber_bruto: '', glovo_pedidos: '', glovo_bruto: '', je_ped: '', je_bru: '', web_pedidos: '', web_bruto: '', directa_ped: '0', directa_bru: '0.00' }
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

  const filaAlm = useMemo(() =>
    allData.find(r => r.fecha === fecha && r.servicio === 'ALM' && r.id !== existing?.id),
    [allData, fecha, existing?.id]
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!fecha) { setFormError('Selecciona una fecha'); return }

    if (servicio === 'CENAS_ALM') {
      if (!filaAlm) { setFormError('No hay fila ALM para este día. Introduce primero el almuerzo.'); return }
      const ub = Math.max(0, (parseFloat(fields.uber_bruto)||0) - (filaAlm.uber_bruto||0))
      const gb = Math.max(0, (parseFloat(fields.glovo_bruto)||0) - (filaAlm.glovo_bruto||0))
      const jb = Math.max(0, (parseFloat(fields.je_bru)||0) - (filaAlm.je_bruto||0))
      const wb = Math.max(0, (parseFloat(fields.web_bruto)||0) - (filaAlm.web_bruto||0))
      const db = Math.max(0, (parseFloat(fields.directa_bru)||0) - (filaAlm.directa_bruto||0))
      const up = Math.max(0, (Math.round(parseFloat(fields.uber_pedidos)||0)) - (filaAlm.uber_pedidos||0))
      const gp = Math.max(0, (Math.round(parseFloat(fields.glovo_pedidos)||0)) - (filaAlm.glovo_pedidos||0))
      const jp = Math.max(0, (Math.round(parseFloat(fields.je_ped)||0)) - (filaAlm.je_pedidos||0))
      const wp = Math.max(0, (Math.round(parseFloat(fields.web_pedidos)||0)) - (filaAlm.web_pedidos||0))
      const dp = Math.max(0, (Math.round(parseFloat(fields.directa_ped)||0)) - (filaAlm.directa_pedidos||0))
      const tp = up + gp + jp + wp + dp
      const tb = ub + gb + jb + wb + db
      if (tp === 0 && tb === 0) { setFormError('El total es igual o menor al ALM registrado.'); return }
      const payload = { fecha, servicio: 'CENAS', uber_pedidos: up, uber_bruto: parseFloat(ub.toFixed(2)), glovo_pedidos: gp, glovo_bruto: parseFloat(gb.toFixed(2)), je_pedidos: jp, je_bruto: parseFloat(jb.toFixed(2)), web_pedidos: wp, web_bruto: parseFloat(wb.toFixed(2)), directa_pedidos: dp, directa_bruto: parseFloat(db.toFixed(2)), total_pedidos: tp, total_bruto: parseFloat(tb.toFixed(2)) }
      setSaving(true)
      if (isEdit) { const { error: de } = await supabase.from('facturacion_diario').delete().eq('id', existing!.id); if (de) { setSaving(false); setFormError(de.message); return } }
      const { error } = await supabase.from('facturacion_diario').insert(payload)
      setSaving(false)
      if (error) { setFormError(error.message); return }
      onSaved(); return
    }

    const up = Math.round(parseFloat(fields.uber_pedidos)||0); const ub = parseFloat(fields.uber_bruto)||0
    const gp = Math.round(parseFloat(fields.glovo_pedidos)||0); const gb = parseFloat(fields.glovo_bruto)||0
    const jp = Math.round(parseFloat(fields.je_ped)||0); const jb = parseFloat(fields.je_bru)||0
    const wp = Math.round(parseFloat(fields.web_pedidos)||0); const wb = parseFloat(fields.web_bruto)||0
    const dp = Math.round(parseFloat(fields.directa_ped)||0); const db = parseFloat(fields.directa_bru)||0
    const tp = up + gp + jp + wp + dp; const tb = ub + gb + jb + wb + db
    if (tp === 0 && tb === 0) { setFormError('Introduce datos en al menos un canal'); return }
    const payload = { fecha, servicio, uber_pedidos: up, uber_bruto: ub, glovo_pedidos: gp, glovo_bruto: gb, je_pedidos: jp, je_bruto: jb, web_pedidos: wp, web_bruto: wb, directa_pedidos: dp, directa_bruto: db, total_pedidos: tp, total_bruto: tb }
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
    width: '100%', background: isDark ? '#3a4058' : '#fff', color: isDark ? '#fff' : '#111',
    border: `1px solid ${isDark ? '#4a5270' : '#ccc'}`, borderRadius: 8, padding: '8px 12px',
    fontSize: 13, fontFamily: 'Lexend, sans-serif', outline: 'none',
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
      <div key={c.label} style={{ background: cc?.bg ?? '#f5f5f5', border: `1px solid ${cc?.border ?? '#ccc'}`, borderRadius: 10, padding: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 10, color: cc?.label ?? '#666', fontFamily: 'Oswald, sans-serif', letterSpacing: 1, textTransform: 'uppercase' }}>{c.label}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label style={{ display: 'block', fontSize: 10, color: '#7a8090', marginBottom: 4 }}>Pedidos</label><input type="number" min="0" placeholder="0" value={fields[c.ped]} onChange={e => set(c.ped, e.target.value)} style={inputStyle} /></div>
          <div><label style={{ display: 'block', fontSize: 10, color: '#7a8090', marginBottom: 4 }}>Bruto (EUR)</label><input type="number" min="0" step="0.01" placeholder="0.00" value={fields[c.bru]} onChange={e => set(c.bru, e.target.value)} style={inputStyle} /></div>
        </div>
      </div>
    )
  }

  const SERVICIOS = [
    { key: 'TODO', label: 'TODOS' },
    { key: 'ALM', label: 'ALM' },
    { key: 'CENAS', label: 'CENAS' },
    { key: 'CENAS_ALM', label: 'CENAS/ALM' },
  ]

  const cardBg = isDark ? '#1e2233' : '#fff'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 16 }} onClick={onClose}>
      <div style={{ background: cardBg, border: `0.5px solid ${isDark ? '#3a4058' : '#d0c8bc'}`, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `0.5px solid ${isDark ? '#3a4058' : '#d0c8bc'}` }}>
          <h3 style={{ color: isDark ? '#fff' : '#111', fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '2px' }}>{isEdit ? 'EDITAR DÍA' : 'AÑADIR DÍA'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7a8090', fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: 0 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 43%' }}>
              <label style={{ display: 'block', fontSize: 11, color: '#7a8090', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Oswald, sans-serif' }}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#7a8090', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Oswald, sans-serif' }}>Servicio</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {SERVICIOS.map(s => {
                  const isActive = servicio === s.key
                  const isCenasAlm = s.key === 'CENAS_ALM'
                  return (
                    <button key={s.key} type="button" onClick={() => setServicio(s.key)}
                      style={{ flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 10, fontWeight: 600, border: isActive ? 'none' : '0.5px solid #d0c8bc', background: isActive ? (isCenasAlm ? '#7c3aed' : '#B01D23') : (isDark ? '#2a3048' : '#fff'), color: isActive ? '#fff' : '#7a8090', cursor: 'pointer', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {FORM_COLS.slice(0, 2).map(renderCanalCard)}
          </div>
          <div style={{ background: '#f5a62312', border: '1px solid #f5a623', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: 2, color: '#f5a623', textTransform: 'uppercase' }}>Just Eat</span>
              {jeItems.length > 0 && <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#7a8090' }}>{jeItems.length} pedido{jeItems.length !== 1 ? 's' : ''} · {jeItems.reduce((a, b) => a + b, 0).toFixed(2)} €</span>}
            </div>
            {jeItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {jeItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: cardBg, border: '0.5px solid #d0c8bc' }}>
                    <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>{item.toFixed(2)} €</span>
                    <button type="button" onClick={() => setJeItems(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" step="0.01" min="0" placeholder="Importe (€)" value={jeInput} onChange={e => setJeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = parseFloat(jeInput); if (v > 0) { setJeItems(p => [...p, v]); setJeInput('') } } }}
                style={{ ...inputStyle, flex: 1, width: 'auto', padding: '6px 10px' }} />
              <button type="button" onClick={() => { const v = parseFloat(jeInput); if (v > 0) { setJeItems(p => [...p, v]); setJeInput('') } }}
                style={{ padding: '6px 14px', borderRadius: 8, background: '#f5a623', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, flexShrink: 0 }}>+</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {FORM_COLS.slice(2).map(renderCanalCard)}
          </div>
          {formError && <p style={{ color: '#E24B4A', fontSize: 12, margin: 0, fontFamily: 'Lexend, sans-serif' }}>{formError}</p>}
          <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
            {isEdit && (
              <button type="button" onClick={handleDelete} style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid #B01D23', background: 'none', color: '#B01D23', cursor: 'pointer', fontFamily: 'Lexend, sans-serif' }}>Eliminar</button>
            )}
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '0.5px solid #d0c8bc', background: 'none', color: '#7a8090', cursor: 'pointer', fontFamily: 'Lexend, sans-serif' }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', background: '#B01D23', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Lexend, sans-serif', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ServicioBadge({ s }: { s: string }) {
  const color = s === 'ALM' ? '#d97706' : s === 'CENAS' ? '#7c3aed' : '#6b7280'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', fontWeight: 500, textTransform: 'uppercase', background: `${color}15`, color }}>
      {s === 'TODO' ? 'TODOS' : s}
    </span>
  )
}

function DesvBadge({ pct }: { pct: number }) {
  const pos = pct >= 0
  const color = pos ? '#1D9E75' : '#E24B4A'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: `${color}18`, color, fontFamily: 'Lexend, sans-serif' }}>
      {pos ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

interface AnualYear { anio: number; bruto: number; pedidos: number; mediaMensual: number; mediaTicket: number }

function TabAnual({ allData, canal }: { allData: RawDiario[]; canal: CanalFilter }) {
  const years = useMemo<AnualYear[]>(() => {
    const byYear = new Map<number, { bruto: number; pedidos: number }>()
    for (const r of allData) {
      const y = parseInt(r.fecha.slice(0, 4))
      if (!byYear.has(y)) byYear.set(y, { bruto: 0, pedidos: 0 })
      const cur = byYear.get(y)!
      cur.bruto += getBru(r, canal); cur.pedidos += getPed(r, canal)
    }
    return [...byYear.entries()].sort((a, b) => b[0] - a[0]).map(([anio, v]) => ({
      anio, bruto: v.bruto, pedidos: v.pedidos,
      mediaMensual: v.bruto / 12,
      mediaTicket: v.pedidos > 0 ? v.bruto / v.pedidos : 0,
    }))
  }, [allData, canal])

  const maxBruto = Math.max(...years.map(y => y.bruto), 1)

  const thS: CSSProperties = { fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.muted, padding: '10px 14px', textAlign: 'left', background: C.bg, borderBottom: `0.5px solid ${C.brd}` }
  const tdS: CSSProperties = { padding: '12px 14px', fontSize: 13, fontFamily: 'Lexend, sans-serif', color: C.text, borderBottom: `0.5px solid ${C.rowBrd}` }

  return (
    <div>
      {years.length > 0 && (() => {
        const cur = years[0]; const prev = years[1]
        const delta = prev ? ((cur.bruto - prev.bruto) / prev.bruto) * 100 : null
        const deltaTicket = prev && prev.mediaTicket > 0 ? ((cur.mediaTicket - prev.mediaTicket) / prev.mediaTicket) * 100 : null
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: `Facturación ${cur.anio}`, value: fmtInt(Math.round(cur.bruto)), delta, color: C.text },
              { label: 'Media mensual', value: fmtInt(Math.round(cur.mediaMensual)), delta: null, color: C.text },
              { label: 'Pedidos totales', value: Math.round(cur.pedidos).toLocaleString('es-ES'), delta: null, color: C.text },
              { label: 'Ticket medio', value: fmtInt(Math.round(cur.mediaTicket)), delta: deltaTicket, color: C.text },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>{kpi.label}</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 600, lineHeight: 1, color: kpi.color }}>{kpi.value}</div>
                {kpi.delta != null && (
                  <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: kpi.delta >= 0 ? '#1D9E75' : '#E24B4A', marginTop: 4 }}>
                    {kpi.delta >= 0 ? '▲' : '▼'} {Math.abs(kpi.delta).toFixed(1)}% vs {cur.anio - 1}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })()}
      <div style={{ background: C.card, border: `0.5px solid ${C.brd}`, borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={thS}>Año</th>
              <th style={{ ...thS, textAlign: 'right' }}>Facturación bruta</th>
              <th style={thS}>vs año anterior</th>
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
                <tr key={y.anio} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.hover }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                  <td style={{ ...tdS, fontFamily: 'Oswald, sans-serif', color: '#B01D23', fontWeight: 600, borderBottom: idx === years.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>{y.anio}</td>
                  <td style={{ ...tdS, textAlign: 'right', borderBottom: idx === years.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>
                    <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{fmtEur(y.bruto)}</div>
                    <div style={{ height: 4, background: C.brd, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: 4, width: barW, background: '#B01D23', borderRadius: 2 }} />
                    </div>
                  </td>
                  <td style={{ ...tdS, borderBottom: idx === years.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>
                    {delta != null ? <DesvBadge pct={delta} /> : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ ...tdS, textAlign: 'right', color: C.muted, borderBottom: idx === years.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>{fmtEur(y.mediaMensual)}</td>
                  <td style={{ ...tdS, textAlign: 'right', color: C.muted, borderBottom: idx === years.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>{Math.round(y.pedidos).toLocaleString('es-ES')}</td>
                  <td style={{ ...tdS, textAlign: 'right', color: C.muted, borderBottom: idx === years.length - 1 ? 'none' : `0.5px solid ${C.rowBrd}` }}>{fmtEur(y.mediaTicket)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
