import { Fragment, useEffect, useState, useMemo, type FormEvent, type CSSProperties } from 'react'
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
  canalHeaderStyle,
  pageTitleStyle,
} from '@/styles/tokens'

// Pedidos siempre enteros
const fmtInt = (n: number) => Math.round(n).toLocaleString('es-ES')

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface AggRow {
  uber_pedidos: number; uber_bruto: number
  glovo_pedidos: number; glovo_bruto: number
  je_pedidos: number; je_bruto: number
  web_pedidos: number; web_bruto: number
  total_pedidos: number; total_bruto: number
}

interface RawDiario extends AggRow {
  id: number
  fecha: string
  servicio: string
  directa_pedidos: number
  directa_bruto: number
}

interface SemanaGroup extends AggRow {
  year: number; week: number; periodo: string; dias: number
}

interface MesGroup extends AggRow {
  anio: number; mes: number; dias: number
  media_diaria: number; vs_anterior: number | null
}

type Tab = 'diario' | 'semanas' | 'meses'
type CanalFilter = 'Todos' | 'Uber Eats' | 'Glovo' | 'Just Eat' | 'Web'

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const COLS: { id: string; label: string; ped: keyof AggRow; bru: keyof AggRow }[] = [
  { id: 'uber',  label: 'Uber Eats', ped: 'uber_pedidos',  bru: 'uber_bruto' },
  { id: 'glovo', label: 'Glovo',     ped: 'glovo_pedidos', bru: 'glovo_bruto' },
  { id: 'je',    label: 'Just Eat',  ped: 'je_pedidos',    bru: 'je_bruto' },
  { id: 'web',   label: 'Web',       ped: 'web_pedidos',   bru: 'web_bruto' },
]

const SERVICIOS = ['ALM', 'CENAS'] as const
const TABS: { key: Tab; label: string }[] = [
  { key: 'diario', label: 'Diario' },
  { key: 'semanas', label: 'Semanas' },
  { key: 'meses', label: 'Meses' },
]
const MES_NOMBRE: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}

const SELECT_DIARIO =
  'id,fecha,servicio,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,web_pedidos,web_bruto,directa_pedidos,directa_bruto,total_pedidos,total_bruto'

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const today = () => new Date().toISOString().slice(0, 10)

/* — canal-aware accessors — */

function getPed(r: AggRow, c: CanalFilter): number {
  if (c === 'Todos') return r.total_pedidos
  const col = COLS.find(x => x.label === c)!
  return r[col.ped] as number || 0
}
function getBru(r: AggRow, c: CanalFilter): number {
  if (c === 'Todos') return r.total_bruto
  const col = COLS.find(x => x.label === c)!
  return r[col.bru] as number || 0
}

/* — aggregation — */

function aggregate(rows: RawDiario[]): AggRow {
  const a: AggRow = {
    uber_pedidos: 0, uber_bruto: 0, glovo_pedidos: 0, glovo_bruto: 0,
    je_pedidos: 0, je_bruto: 0, web_pedidos: 0, web_bruto: 0,
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

/* — ISO week — */

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

/* — build groups — */

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
    const vs_anterior = prevBruto !== null && prevBruto > 0
      ? ((agg.total_bruto - prevBruto) / prevBruto) * 100
      : null
    result.push({ anio, mes, dias, ...agg, media_diaria, vs_anterior })
    prevBruto = agg.total_bruto
  }
  return result.reverse()
}

/* — CSV export — */

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

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function Facturacion() {
  const { T, isDark } = useTheme()
  const [tab, setTab] = useState<Tab>('diario')
  const [canal, _setCanal] = useState<CanalFilter>('Todos')
  const [servicioFiltro, setServicioFiltro] = useState<string>('Todos')
  const [dropCanalOpen, setDropCanalOpen] = useState(false)
  const [canalFilterSelected, setCanalFilterSelected] = useState<string[]>(['Todos'])
  const [allData, setAllData] = useState<RawDiario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  /* cross-tab state */
  const [weekFilter, setWeekFilter] = useState<{ year: number; week: number } | null>(null)
  const [editRow, setEditRow] = useState<RawDiario | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  /* Click fuera cierra dropdown canal */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-drop-canal]')) setDropCanalOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  /* Cálculos de fecha para KPI labels */
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
    hoy:     new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }).replace(/^\w/, c => c.toUpperCase()),
    semana:  `S${weekNum} · ${fmtCorto(monday)} – ${fmtCorto(sunday)}`,
    mes:     mesNombre,
    anio:    `${hoy.getFullYear()}`,
  }

  const refresh = () => setRefreshKey(k => k + 1)

  /* single query for everything */
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

  /* navigate from semana → diario */
  const drillWeek = (year: number, week: number) => {
    setWeekFilter({ year, week })
    setTab('diario')
  }
  const clearWeekFilter = () => setWeekFilter(null)

  /* KPIs from allData filtrado por servicio */
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
      <h2 style={{ fontFamily: FONT.heading, ...LAYOUT.pageTitle }}>
        Facturación
      </h2>

      {/* Global KPIs */}
      {!loading && !error && (
        <div style={LAYOUT.kpiGrid}>
          {[
            { label: KPI_LABELS.hoy,    valor: kpiHoy.bruto,    pedidos: kpiHoy.pedidos },
            { label: KPI_LABELS.semana, valor: kpiSemana.bruto, pedidos: kpiSemana.pedidos },
            { label: KPI_LABELS.mes,    valor: kpiMes.bruto,    pedidos: kpiMes.pedidos },
            { label: KPI_LABELS.anio,   valor: kpiAnio.bruto,   pedidos: kpiAnio.pedidos },
          ].map((k, idx) => (
            <div key={idx} style={cardStyle(T)}>
              <div style={{ ...kpiLabelStyle(T), marginBottom:8 }}>
                {k.label}
              </div>
              <div style={{ ...kpiValueStyle(T), marginBottom:4 }}>
                {fmtEur(k.valor)}
              </div>
              <div style={{ fontFamily:FONT.body, fontSize:12, color:T.sec }}>
                {fmtInt(k.pedidos)} pedidos
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar: Tabs + Filtros */}
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:10, marginBottom:18 }}>
        <div style={{ display:'flex', gap:4, background:T.card, border:`0.5px solid ${T.brd}`, borderRadius:10, padding:4 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key !== 'diario') clearWeekFilter() }}
              style={tab === t.key ? tabActiveStyle(isDark) : tabInactiveStyle(T)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Botones servicio */}
        <div style={{ display:'flex', gap:4 }}>
          {['Todos', 'ALM', 'CENAS'].map(s => (
            <button
              key={s}
              onClick={() => setServicioFiltro(s)}
              style={servicioFiltro === s
                ? { background: T.emphasis, color: isDark ? '#1a1a00' : '#ffffff', border: 'none', borderRadius: 8, padding: '6px 14px', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', cursor: 'pointer', fontWeight: 500 }
                : { background: 'none', color: T.sec, border: `0.5px solid ${T.brd}`, borderRadius: 8, padding: '6px 14px', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', cursor: 'pointer', fontWeight: 500 }
              }
            >
              {s}
            </button>
          ))}
        </div>

        {/* Dropdown canal multi-select */}
        <div style={{ position:'relative' }} data-drop-canal="canales">
          <button
            onClick={e => { e.stopPropagation(); setDropCanalOpen(p => !p) }}
            style={dropdownBtnStyle(T)}
          >
            {canalFilterSelected.length === 5 ? 'Todos los canales' : canalFilterSelected.length === 1 ? canalFilterSelected[0] : `${canalFilterSelected.length} canales`} ▾
          </button>
          {dropCanalOpen && (
            <div style={dropdownMenuStyle(T)}>
              {['Todos', 'Uber Eats', 'Glovo', 'Just Eat', 'Web', 'Directa'].map(c => (
                <label key={c} style={dropdownItemStyle(T)}>
                  <input
                    type="checkbox"
                    checked={canalFilterSelected.includes(c)}
                    onChange={() => {
                      if (c === 'Todos') {
                        setCanalFilterSelected(['Todos'])
                      } else {
                        const filtered = canalFilterSelected.filter(x => x !== 'Todos')
                        const updated = filtered.includes(c) ? filtered.filter(x => x !== c) : [...filtered, c]
                        setCanalFilterSelected(updated.length === 0 ? ['Todos'] : updated.length === 5 ? ['Todos'] : updated)
                      }
                    }}
                    style={{ width:13, height:13 }}
                  />
                  {c}
                </label>
              ))}
            </div>
          )}
        </div>

        {weekFilter && (
          <button
            onClick={clearWeekFilter}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', background:isDark?'rgba(232,244,66,0.12)':'rgba(176,29,35,0.08)', color:T.pri, fontFamily:FONT.body, fontSize:12, fontWeight:500, borderRadius:8, border:`0.5px solid ${isDark?'rgba(232,244,66,0.3)':'rgba(176,29,35,0.3)'}`, cursor:'pointer' }}
          >
            S{weekFilter.week} &times;
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? <Loader /> : error ? <ErrorBox msg={error} onRetry={refresh} /> : (
        <>
          {tab === 'diario' && (
            <TabDiario
              allData={filteredData} canal={canal} weekFilter={weekFilter}
              onRefresh={refresh} onEdit={setEditRow} onAdd={() => setShowAdd(true)}
            />
          )}
          {tab === 'semanas' && <TabSemanas allData={filteredData} canal={canal} onDrill={drillWeek} />}
          {tab === 'meses' && <TabMeses allData={filteredData} canal={canal} />}
        </>
      )}

      {/* Modals */}
      {showAdd && (
        <DayModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); refresh() }} />
      )}
      {editRow && (
        <DayModal
          existing={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => { setEditRow(null); refresh() }}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB: DIARIO
   ═══════════════════════════════════════════════════════════ */

interface DiarioProps {
  allData: RawDiario[]; canal: CanalFilter
  weekFilter: { year: number; week: number } | null
  onRefresh: () => void; onEdit: (r: RawDiario) => void; onAdd: () => void
}

function TabDiario({ allData, canal, weekFilter, onRefresh: _, onEdit, onAdd }: DiarioProps) {
  const { T, isDark } = useTheme()
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [mesFilter, setMesFilter] = useState(currentMonth)

  /* apply weekFilter first, then mesFilter */
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

  const showBreakdown = canal === 'Todos'

  const exportar = () => {
    const headers = showBreakdown
      ? ['Fecha', 'Servicio', 'UE Ped', 'UE Bruto', 'GL Ped', 'GL Bruto', 'JE Ped', 'JE Bruto', 'Web Ped', 'Web Bruto', 'Total Ped', 'Total Bruto']
      : ['Fecha', 'Servicio', 'Pedidos', 'Bruto']
    const csvRows = rows.map(r => showBreakdown
      ? [r.fecha, r.servicio, r.uber_pedidos, r.uber_bruto, r.glovo_pedidos, r.glovo_bruto, r.je_pedidos, r.je_bruto, r.web_pedidos, r.web_bruto, r.total_pedidos, r.total_bruto]
      : [r.fecha, r.servicio, getPed(r, canal), getBru(r, canal)],
    )
    downloadCSV('facturacion_diario.csv', headers, csvRows)
  }

  if (allData.length === 0) return <EmptyState label="Sin datos de facturacion diaria" onAdd={onAdd} />

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={mesFilter} onChange={e => setMesFilter(e.target.value)}
          style={{ background:T.inp, color:T.pri, border:`0.5px solid ${T.brd}`, borderRadius:8, padding:'6px 10px', fontSize:13, fontFamily:FONT.body, cursor:'pointer' }}>
          <option value="todos">Todos los meses</option>
          {mesesDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={exportar}
          style={{ padding:'6px 12px', fontSize:12, color:T.sec, background:'none', border:`0.5px solid ${T.brd}`, borderRadius:8, cursor:'pointer', fontFamily:FONT.body }}>
          Exportar CSV
        </button>
        <button onClick={onAdd}
          className="ml-auto px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:brightness-110 transition">
          ＋ Anadir dia
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <MiniKpi label="Facturación Bruta" valor={fmtEur(getBru(totals, canal))} />
        <MiniKpi label="Pedidos" valor={fmtInt(getPed(totals, canal))} />
        <MiniKpi label="TM" valor={getPed(totals, canal) > 0 ? fmtEur(getBru(totals, canal) / getPed(totals, canal)) : '—'} />
        <MiniKpi label="Facturación Diaria" valor={(() => { const d = new Set(rows.map(r => r.fecha)).size; return d > 0 ? fmtEur(getBru(totals, canal) / d) : '—' })()} />
      </div>

      {/* Table */}
      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse', tableLayout: 'auto', minWidth: 'max-content' }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${T.brd}`, color: T.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400 }}>Fecha</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400 }}>Serv.</th>
                {COLS.map(c => (
                  <Fragment key={c.label}>
                    <th style={{ ...canalHeaderStyle(c.id, isDark), padding: '8px 10px', textAlign: 'right', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400 }}>Ped</th>
                    <th style={{ ...canalHeaderStyle(c.id, isDark), padding: '8px 10px', textAlign: 'right', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400 }}>€</th>
                  </Fragment>
                ))}
                <th style={{ padding: '8px 10px', textAlign: 'right', color: T.pri, background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 600 }}>Ped</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', color: T.pri, background: T.group, fontWeight: 600 }}>€</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} onClick={() => onEdit(r)} style={{ borderBottom: `0.5px solid ${T.brd}`, cursor: 'pointer' }}>
                  <td style={{ padding: '8px 10px', textAlign: 'left', color: T.pri, borderRight: `0.5px solid ${T.brd}` }}>{fmtFechaCorta(r.fecha)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'left', borderRight: `0.5px solid ${T.brd}` }}><ServicioBadge s={r.servicio} /></td>
                  {COLS.map(c => {
                    const p = (r[c.ped] as number) || 0
                    const b = (r[c.bru] as number) || 0
                    return (
                      <Fragment key={c.label}>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: p > 0 ? T.pri : T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>
                          {p > 0 ? Math.round(p) : <Dash />}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: b > 0 ? T.pri : T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>
                          {b > 0 ? fmtEur(b) : <Dash />}
                        </td>
                      </Fragment>
                    )
                  })}
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: T.pri, fontWeight: 500, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>{fmtInt(r.total_pedidos)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: T.pri, fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{fmtEur(r.total_bruto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `0.5px solid ${T.brd}`, background: `${T.emphasis}22`, fontWeight: 600 }}>
                <td style={{ padding: '8px 10px', textAlign: 'left', color: T.pri, borderRight: `0.5px solid ${T.brd}` }} colSpan={2}>TOTAL</td>
                {COLS.map(c => (
                  <Fragment key={c.label}>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>{fmtInt(totals[c.ped] as number)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>{fmtEur(totals[c.bru] as number)}</td>
                  </Fragment>
                ))}
                <td style={{ padding: '8px 10px', textAlign: 'right', color: T.pri, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>{fmtInt(totals.total_pedidos)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: T.pri, fontFamily: 'monospace', fontSize: 13 }}>{fmtEur(totals.total_bruto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB: SEMANAS
   ═══════════════════════════════════════════════════════════ */

function TabSemanas({ allData, canal, onDrill }: { allData: RawDiario[]; canal: CanalFilter; onDrill: (y: number, w: number) => void }) {
  const { T, isDark } = useTheme()
  const rows = useMemo(() => buildSemanas(allData).slice(0, 12), [allData])
  const totals = useMemo(() => aggregate(allData), [allData])
  const showBreakdown = canal === 'Todos'

  const exportar = () => {
    const headers = showBreakdown
      ? ['Semana', 'Periodo', 'Dias', 'UE', 'Glovo', 'JE', 'Web', 'Total Ped', 'Total Bruto']
      : ['Semana', 'Periodo', 'Dias', 'Pedidos', 'Bruto']
    const csvRows = rows.map(r => showBreakdown
      ? [`S${r.week}`, r.periodo, r.dias, r.uber_bruto, r.glovo_bruto, r.je_bruto, r.web_bruto, r.total_pedidos, r.total_bruto]
      : [`S${r.week}`, r.periodo, r.dias, getPed(r, canal), getBru(r, canal)],
    )
    downloadCSV('facturacion_semanas.csv', headers, csvRows)
  }

  if (rows.length === 0) return <EmptyState label="Sin datos semanales" />

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <MiniKpi label="Semanas" valor={String(rows.length)} />
        <MiniKpi label="Facturación Bruta" valor={fmtEur(getBru(totals, canal))} />
        <MiniKpi label="Pedidos" valor={fmtInt(getPed(totals, canal))} />
        <button onClick={exportar}
          style={{ marginLeft:'auto', padding:'6px 12px', fontSize:12, color:T.sec, background:'none', border:`0.5px solid ${T.brd}`, borderRadius:8, cursor:'pointer', fontFamily:FONT.body }}>
          Exportar CSV
        </button>
      </div>

      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse', tableLayout: 'auto', minWidth: 'max-content' }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${T.brd}`, color: T.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400 }}>Sem</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400 }}>Periodo</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400 }}>Dias</th>
                {COLS.map(c => (
                  <th key={c.label} style={{ ...canalHeaderStyle(c.id, isDark), padding: '8px 10px', textAlign: 'right', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400 }}>€</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={`${r.year}-${r.week}`} onClick={() => onDrill(r.year, r.week)} style={{ borderBottom: `0.5px solid ${T.brd}`, cursor: 'pointer' }}>
                  <td style={{ padding: '8px 10px', textAlign: 'left', color: T.pri, fontWeight: 500, borderRight: `0.5px solid ${T.brd}` }}>S{r.week}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'left', color: T.sec, borderRight: `0.5px solid ${T.brd}` }}>{r.periodo}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>{r.dias}</td>
                  {COLS.map(c => (
                    <td key={c.label} style={{ padding: '8px 10px', textAlign: 'right', color: (r[c.bru] as number) > 0 ? T.pri : T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>
                      {(r[c.bru] as number) > 0 ? fmtEur(r[c.bru] as number) : <Dash />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `0.5px solid ${T.brd}`, background: `${T.emphasis}22`, fontWeight: 600 }}>
                <td style={{ padding: '8px 10px', textAlign: 'left', color: T.pri, borderRight: `0.5px solid ${T.brd}` }} colSpan={3}>TOTAL</td>
                {COLS.map(c => (
                  <td key={c.label} style={{ padding: '8px 10px', textAlign: 'right', color: T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>
                    {fmtEur(totals[c.bru] as number)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="text-[10px] text-[var(--sl-text-secondary)] mt-2">Haz clic en una semana para ver el detalle diario</p>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB: MESES
   ═══════════════════════════════════════════════════════════ */

function TabMeses({ allData, canal }: { allData: RawDiario[]; canal: CanalFilter }) {
  const { T, isDark } = useTheme()
  const allRows = useMemo(() => buildMeses(allData), [allData])

  const years = useMemo(() => {
    const s = new Set(allRows.map(r => r.anio))
    return [...s].sort((a, b) => b - a)
  }, [allRows])

  const [selYear, setSelYear] = useState(new Date().getFullYear())
  useEffect(() => {
    if (years.length > 0 && !years.includes(selYear)) setSelYear(years[0])
  }, [years, selYear])

  const rows = useMemo(() => allRows.filter(r => r.anio === selYear).reverse(), [allRows, selYear])
  const showBreakdown = canal === 'Todos'

  const yearTotal = useMemo(() => {
    const a = aggregate(allData.filter(r => r.fecha.startsWith(String(selYear))))
    const dias = new Set(allData.filter(r => r.fecha.startsWith(String(selYear))).map(r => r.fecha)).size
    return { ...a, dias }
  }, [allData, selYear])

  const exportar = () => {
    const headers = showBreakdown
      ? ['Mes', 'Dias', 'UE', 'Glovo', 'JE', 'Web', 'Total Ped', 'Total Bruto', 'Media Diaria', 'vs Anterior']
      : ['Mes', 'Dias', 'Pedidos', 'Bruto', 'Media Diaria', 'vs Anterior']
    const csvRows = rows.map(r => {
      const vs = r.vs_anterior !== null ? r.vs_anterior.toFixed(1) + '%' : ''
      return showBreakdown
        ? [MES_NOMBRE[r.mes], r.dias, r.uber_bruto, r.glovo_bruto, r.je_bruto, r.web_bruto, r.total_pedidos, r.total_bruto, r.media_diaria.toFixed(2), vs]
        : [MES_NOMBRE[r.mes], r.dias, getPed(r, canal), getBru(r, canal), r.media_diaria.toFixed(2), vs]
    })
    downloadCSV(`facturacion_meses_${selYear}.csv`, headers, csvRows)
  }

  if (allRows.length === 0) return <EmptyState label="Sin datos mensuales" />

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {years.length > 1 && (
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
            style={{ background:T.inp, color:T.pri, border:`0.5px solid ${T.brd}`, borderRadius:8, padding:'6px 10px', fontSize:13, fontFamily:FONT.body, cursor:'pointer' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <MiniKpi label="Facturación Bruta" valor={fmtEur(getBru(yearTotal, canal))} />
        <MiniKpi label="Pedidos" valor={fmtInt(getPed(yearTotal, canal))} />
        <MiniKpi label="Facturación Diaria" valor={yearTotal.dias > 0 ? fmtEur(getBru(yearTotal, canal) / yearTotal.dias) : '—'} />
        <button onClick={exportar}
          style={{ marginLeft:'auto', padding:'6px 12px', fontSize:12, color:T.sec, background:'none', border:`0.5px solid ${T.brd}`, borderRadius:8, cursor:'pointer', fontFamily:FONT.body }}>
          Exportar CSV
        </button>
      </div>

      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse', tableLayout: 'auto', minWidth: 'max-content' }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${T.brd}`, color: T.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400 }}>Mes</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400 }}>Dias</th>
                {COLS.map(c => (
                  <th key={c.label} style={{ ...canalHeaderStyle(c.id, isDark), padding: '8px 10px', textAlign: 'right', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400 }}>€</th>
                ))}
                <th style={{ padding: '8px 10px', textAlign: 'right', background: T.group, borderRight: `0.5px solid ${T.brd}`, fontWeight: 400 }}>Media/dia</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', background: T.group, fontWeight: 400 }}>vs Anterior</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.mes} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                  <td style={{ padding: '8px 10px', textAlign: 'left', color: T.pri, fontWeight: 500, borderRight: `0.5px solid ${T.brd}` }}>{MES_NOMBRE[r.mes]}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>{r.dias}</td>
                  {COLS.map(c => (
                    <td key={c.label} style={{ padding: '8px 10px', textAlign: 'right', color: (r[c.bru] as number) > 0 ? T.pri : T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>
                      {(r[c.bru] as number) > 0 ? fmtEur(r[c.bru] as number) : <Dash />}
                    </td>
                  ))}
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>
                    {r.dias > 0 ? fmtEur(r.media_diaria) : '—'}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    {r.vs_anterior !== null ? <DesvBadge pct={r.vs_anterior} /> : <Dash />}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `0.5px solid ${T.brd}`, background: `${T.emphasis}22`, fontWeight: 600 }}>
                <td style={{ padding: '8px 10px', textAlign: 'left', color: T.pri, borderRight: `0.5px solid ${T.brd}` }}>{selYear} TOTAL</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>{yearTotal.dias}</td>
                {COLS.map(c => (
                  <td key={c.label} style={{ padding: '8px 10px', textAlign: 'right', color: T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>
                    {fmtEur(yearTotal[c.bru] as number)}
                  </td>
                ))}
                <td style={{ padding: '8px 10px', textAlign: 'right', color: T.sec, borderRight: `0.5px solid ${T.brd}`, fontFamily: 'monospace', fontSize: 13 }}>
                  {yearTotal.dias > 0 ? fmtEur(getBru(yearTotal, canal) / yearTotal.dias) : '—'}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   MODAL: ADD / EDIT DAY
   ═══════════════════════════════════════════════════════════ */

interface FormFields {
  uber_pedidos: string; uber_bruto: string
  glovo_pedidos: string; glovo_bruto: string
  je_ped: string; je_bru: string
  web_pedidos: string; web_bruto: string
  directa_ped: string; directa_bru: string
}

const FORM_COLS: { label: string; ped: keyof FormFields; bru: keyof FormFields; color?: string }[] = [
  { label: 'Uber Eats',     ped: 'uber_pedidos',  bru: 'uber_bruto' },
  { label: 'Glovo',         ped: 'glovo_pedidos', bru: 'glovo_bruto' },
  { label: 'Web',           ped: 'web_pedidos',   bru: 'web_bruto' },
  { label: 'Venta Directa', ped: 'directa_ped',   bru: 'directa_bru', color: '#66aaff' },
]

function DayModal({ existing, onClose, onSaved }: { existing?: RawDiario; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!existing
  const [fecha, setFecha] = useState(existing?.fecha ?? '')
  const [servicio, setServicio] = useState(existing?.servicio ?? 'ALM')
  const [fields, setFields] = useState<FormFields>(() => {
    if (!existing) return {
      uber_pedidos: '',  uber_bruto: '',
      glovo_pedidos: '', glovo_bruto: '',
      je_ped: '',        je_bru: '',
      web_pedidos: '',   web_bruto: '',
      directa_ped: '0',  directa_bru: '0.00',
    }
    return {
      uber_pedidos: String(existing.uber_pedidos || ''),   uber_bruto: String(existing.uber_bruto || ''),
      glovo_pedidos: String(existing.glovo_pedidos || ''), glovo_bruto: String(existing.glovo_bruto || ''),
      je_ped: String(existing.je_pedidos || ''),           je_bru: String(existing.je_bruto || ''),
      web_pedidos: String(existing.web_pedidos || ''),     web_bruto: String(existing.web_bruto || ''),
      directa_ped: String(existing.directa_pedidos || 0),  directa_bru: String(existing.directa_bruto || 0),
    }
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const { T, isDark } = useTheme()

  const [jeItems, setJeItems] = useState<number[]>(
    existing && (existing.je_bruto ?? 0) > 0 ? [existing.je_bruto] : []
  )
  const [jeInput, setJeInput] = useState('')

  useEffect(() => {
    const total = jeItems.reduce((a, b) => a + b, 0)
    setFields(f => ({ ...f, je_ped: String(jeItems.length), je_bru: total.toFixed(2) }))
  }, [jeItems])

  const set = (k: keyof FormFields, v: string) => setFields(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!fecha) { setFormError('Selecciona una fecha'); return }

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
      uber_pedidos: uber_ped,       uber_bruto: uber_bru,
      glovo_pedidos: glovo_ped,     glovo_bruto: glovo_bru,
      je_pedidos: je_ped,           je_bruto: je_bru,
      web_pedidos: web_ped,         web_bruto: web_bru,
      directa_pedidos: directa_ped, directa_bruto: directa_bru,
      total_pedidos: tot_ped,       total_bruto: tot_bru,
    }

    setSaving(true)
    const { error } = isEdit
      ? await supabase.from('facturacion_diario').update(payload).eq('id', existing!.id)
      : await supabase.from('facturacion_diario').insert(payload)
    setSaving(false)

    if (error) { setFormError(error.message); return }
    onSaved()
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    background: isDark ? '#3a4058' : '#ffffff',
    color: T.pri,
    border: `1px solid ${isDark ? '#4a5270' : '#cccccc'}`,
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    fontFamily: FONT.body,
    outline: 'none',
  }

  const renderCanalCard = (c: typeof FORM_COLS[number]) => (
    <div key={c.label} style={{ background: `${T.group}55`, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 10, ...(c.color ? { color: c.color, fontFamily: FONT.heading, letterSpacing: 1, textTransform: 'uppercase' } : { color: T.sec, fontFamily: FONT.heading, letterSpacing: 1, textTransform: 'uppercase' }) }}>{c.label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: T.sec, marginBottom: 4 }}>Pedidos</label>
          <input type="number" min="0" placeholder="0" value={fields[c.ped]}
            onChange={e => set(c.ped, e.target.value)}
            style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: T.sec, marginBottom: 4 }}>Bruto (EUR)</label>
          <input type="number" min="0" step="0.01" placeholder="0.00" value={fields[c.bru]}
            onChange={e => set(c.bru, e.target.value)}
            style={inputStyle} />
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 16 }} onClick={onClose}>
      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `0.5px solid ${T.brd}` }}>
          <h3 style={{ color: T.pri, fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, margin: 0 }}>{isEdit ? 'EDITAR DÍA' : 'AÑADIR DÍA'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.sec, fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: 0 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: T.sec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: FONT.heading }}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: T.sec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: FONT.heading }}>Servicio</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {SERVICIOS.map(s => (
                  <button key={s} type="button" onClick={() => setServicio(s)}
                    style={servicio === s
                      ? { flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: T.emphasis, color: isDark ? '#1a1a00' : '#ffffff', cursor: 'pointer', fontFamily: FONT.heading }
                      : { flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `0.5px solid ${T.brd}`, background: 'none', color: T.sec, cursor: 'pointer', fontFamily: FONT.heading }
                    }>{s}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Uber + Glovo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {FORM_COLS.slice(0, 2).map(renderCanalCard)}
          </div>

          {/* Just Eat accumulator */}
          <div style={{ background: `${T.group}55`, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: 14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
              <span style={{ fontFamily: FONT.heading, fontSize:11, letterSpacing:2, color:'#f5a623', textTransform:'uppercase' }}>Just Eat</span>
              {jeItems.length > 0 && (
                <span style={{ fontFamily: FONT.body, fontSize:12, color: T.sec }}>
                  {jeItems.length} pedido{jeItems.length !== 1 ? 's' : ''} · {jeItems.reduce((a,b)=>a+b,0).toFixed(2)} €
                </span>
              )}
            </div>

            {jeItems.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap: 6, marginBottom: 12 }}>
                {jeItems.map((item, idx) => (
                  <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', borderRadius: 8, background: T.card, border: `0.5px solid ${T.brd}` }}>
                    <span style={{ fontFamily: FONT.body, fontSize:13, color: T.pri }}>{item.toFixed(2)} €</span>
                    <button type="button" onClick={() => setJeItems(p => p.filter((_,i) => i !== idx))}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#E24B4A', fontSize:18, lineHeight:1, padding:'0 4px' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="number" step="0.01" min="0"
                placeholder="Importe (€)"
                value={jeInput}
                onChange={e => setJeInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const v = parseFloat(jeInput)
                    if (v > 0) { setJeItems(p => [...p, v]); setJeInput('') }
                  }
                }}
                style={{ ...inputStyle, flex: 1, width: 'auto' }}
              />
              <button
                type="button"
                onClick={() => {
                  const v = parseFloat(jeInput)
                  if (v > 0) { setJeItems(p => [...p, v]); setJeInput('') }
                }}
                style={{ padding: '8px 16px', borderRadius: 8, background: T.emphasis, color: isDark ? '#1a1a00' : '#ffffff', border: 'none', cursor: 'pointer', fontFamily: FONT.heading, fontSize: 14, fontWeight: 600 }}
              >+</button>
            </div>

            {jeItems.length > 0 && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: `${T.emphasis}22`, border: `0.5px solid ${T.emphasis}`, display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontFamily: FONT.heading, fontSize:11, letterSpacing:1, color:'#f5a623', textTransform:'uppercase' }}>Total</span>
                <span style={{ fontFamily: FONT.heading, fontSize:13, fontWeight:600, color: T.pri }}>
                  {jeItems.reduce((a,b)=>a+b,0).toFixed(2)} €
                </span>
              </div>
            )}
          </div>

          {/* Web + Venta Directa */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {FORM_COLS.slice(2).map(renderCanalCard)}
          </div>

          {formError && <p style={{ color: '#dc2626', fontSize: 12, margin: 0 }}>{formError}</p>}
          <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: `0.5px solid ${T.brd}`, background: 'none', color: T.sec, cursor: 'pointer', fontFamily: FONT.body, transition: 'color 150ms' }}
              onMouseEnter={e => e.currentTarget.style.color = T.pri}
              onMouseLeave={e => e.currentTarget.style.color = T.sec}>Cancelar</button>
            <button type="submit" disabled={saving}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', background: T.emphasis, color: isDark ? '#1a1a00' : '#ffffff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: FONT.body, opacity: saving ? 0.6 : 1, transition: 'opacity 150ms' }}>
              {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MICRO-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function MiniKpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="bg-[var(--sl-card)] border border-border rounded-lg px-3 py-2">
      <p className="text-[10px] text-[var(--sl-text-secondary)] uppercase">{label}</p>
      <p className="text-sm font-bold text-[var(--sl-text-primary)]">{valor}</p>
    </div>
  )
}

function Loader() {
  return (
    <div className="bg-[var(--sl-card)] border border-border rounded-xl p-12 text-center">
      <div className="inline-block h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-[var(--sl-text-secondary)] text-sm mt-3">Cargando...</p>
    </div>
  )
}

function ErrorBox({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="bg-[var(--sl-card)] border border-border rounded-xl p-8 text-center">
      <p className="text-[#dc2626] text-sm">{msg}</p>
      <button onClick={onRetry} className="mt-3 text-xs text-[var(--sl-text-primary)] underline hover:no-underline">Reintentar</button>
    </div>
  )
}

function EmptyState({ label, onAdd }: { label: string; onAdd?: () => void }) {
  return (
    <div className="bg-[var(--sl-card)] border border-border rounded-xl p-12 text-center">
      <p className="text-[var(--sl-text-secondary)] text-sm">{label}</p>
      {onAdd && (
        <button onClick={onAdd}
          className="mt-4 px-5 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:brightness-110 transition">
          ＋ Anadir
        </button>
      )}
    </div>
  )
}

function ServicioBadge({ s }: { s: string }) {
  return (
    <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${
      s === 'ALM' ? 'bg-amber-500/10 text-[#d97706]' : 'bg-indigo-500/10 text-indigo-400'
    }`}>{s}</span>
  )
}

function DesvBadge({ pct }: { pct: number }) {
  const pos = pct >= 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      pos ? 'bg-green-500/10 text-[#16a34a]' : 'bg-red-500/10 text-[#dc2626]'
    }`}>{pos ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>
  )
}

function Dash() {
  return <span className="text-[var(--sl-text-secondary)]">—</span>
}
