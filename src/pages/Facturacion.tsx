import { Fragment, useEffect, useState, useMemo, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'

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

const COLS: { label: string; ped: keyof AggRow; bru: keyof AggRow }[] = [
  { label: 'Uber Eats', ped: 'uber_pedidos', bru: 'uber_bruto' },
  { label: 'Glovo',     ped: 'glovo_pedidos', bru: 'glovo_bruto' },
  { label: 'Just Eat',  ped: 'je_pedidos',    bru: 'je_bruto' },
  { label: 'Web',       ped: 'web_pedidos',   bru: 'web_bruto' },
]

const CANAL_OPTIONS: CanalFilter[] = ['Todos', 'Uber Eats', 'Glovo', 'Just Eat', 'Web']
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
  'id,fecha,servicio,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,web_pedidos,web_bruto,total_pedidos,total_bruto'

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const eur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
const num = (n: number) => n.toLocaleString('es-ES')
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
  const [tab, setTab] = useState<Tab>('diario')
  const [canal, setCanal] = useState<CanalFilter>('Todos')
  const [allData, setAllData] = useState<RawDiario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  /* cross-tab state */
  const [weekFilter, setWeekFilter] = useState<{ year: number; week: number } | null>(null)
  const [editRow, setEditRow] = useState<RawDiario | null>(null)
  const [showAdd, setShowAdd] = useState(false)

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

  /* KPIs from allData */
  const todayStr = today()
  const currentIso = isoWeek(todayStr)
  const currentMonth = todayStr.slice(0, 7)
  const currentYear = todayStr.slice(0, 4)

  const kpiHoy = useMemo(() => {
    const rows = allData.filter(r => r.fecha === todayStr)
    const a = aggregate(rows)
    return { pedidos: getPed(a, canal), bruto: getBru(a, canal) }
  }, [allData, canal, todayStr])

  const kpiSemana = useMemo(() => {
    const rows = allData.filter(r => {
      const w = isoWeek(r.fecha)
      return w.year === currentIso.year && w.week === currentIso.week
    })
    const a = aggregate(rows)
    return { pedidos: getPed(a, canal), bruto: getBru(a, canal) }
  }, [allData, canal, currentIso.year, currentIso.week])

  const kpiMes = useMemo(() => {
    const rows = allData.filter(r => r.fecha.startsWith(currentMonth))
    const a = aggregate(rows)
    return { pedidos: getPed(a, canal), bruto: getBru(a, canal) }
  }, [allData, canal, currentMonth])

  const kpiAnio = useMemo(() => {
    const rows = allData.filter(r => r.fecha.startsWith(currentYear))
    const a = aggregate(rows)
    return { pedidos: getPed(a, canal), bruto: getBru(a, canal) }
  }, [allData, canal, currentYear])

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#f0f0ff] mb-4">Facturacion</h2>

      {/* Global KPIs */}
      {!loading && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <KpiCard label="Hoy" valor={eur(kpiHoy.bruto)} sub={`${num(kpiHoy.pedidos)} pedidos`} />
          <KpiCard label="Semana actual" valor={eur(kpiSemana.bruto)} sub={`${num(kpiSemana.pedidos)} pedidos`} />
          <KpiCard label="Mes actual" valor={eur(kpiMes.bruto)} sub={`${num(kpiMes.pedidos)} pedidos`} />
          <KpiCard label={`Ano ${currentYear}`} valor={eur(kpiAnio.bruto)} sub={`${num(kpiAnio.pedidos)} pedidos`} />
        </div>
      )}

      {/* Toolbar: Tabs + Canal filter */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 bg-[#484f66] border border-border rounded-lg p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key !== 'diario') clearWeekFilter() }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-[#B01D23] text-[#f0f0ff]' : 'text-[#c8d0e8] hover:text-[#f0f0ff]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          value={canal}
          onChange={e => setCanal(e.target.value as CanalFilter)}
          className="bg-base border border-border rounded-lg px-3 py-2 text-sm text-[#f0f0ff]"
        >
          {CANAL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {weekFilter && (
          <button
            onClick={clearWeekFilter}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-[#f0f0ff] text-xs font-medium rounded-lg border border-accent/30"
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
              allData={allData} canal={canal} weekFilter={weekFilter}
              onRefresh={refresh} onEdit={setEditRow} onAdd={() => setShowAdd(true)}
            />
          )}
          {tab === 'semanas' && <TabSemanas allData={allData} canal={canal} onDrill={drillWeek} />}
          {tab === 'meses' && <TabMeses allData={allData} canal={canal} />}
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
  const [mesFilter, setMesFilter] = useState('todos')

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
          className="bg-base border border-border rounded-lg px-3 py-2 text-sm text-[#f0f0ff]">
          <option value="todos">Todos los meses</option>
          {mesesDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={exportar} className="px-3 py-2 text-xs text-[#c8d0e8] border border-border rounded-lg hover:text-[#f0f0ff] transition">
          Exportar CSV
        </button>
        <button onClick={onAdd}
          className="ml-auto px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:brightness-110 transition">
          ＋ Anadir dia
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <MiniKpi label="Bruto" valor={eur(getBru(totals, canal))} />
        <MiniKpi label="Pedidos" valor={num(getPed(totals, canal))} />
        <MiniKpi label="Ticket medio" valor={getPed(totals, canal) > 0 ? eur(getBru(totals, canal) / getPed(totals, canal)) : '—'} />
        <MiniKpi label="Media diaria" valor={(() => { const d = new Set(rows.map(r => r.fecha)).size; return d > 0 ? eur(getBru(totals, canal) / d) : '—' })()} />
      </div>

      {/* Table */}
      <div className="bg-[#484f66] border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              {showBreakdown ? (
                <>
                  <tr className="border-b border-border text-[#c8d0e8] text-xs uppercase tracking-wide">
                    <th rowSpan={2} className="px-3 py-2 text-left sticky left-0 bg-[#484f66] z-10">Fecha</th>
                    <th rowSpan={2} className="px-3 py-2 text-left">Serv.</th>
                    {COLS.map(c => (
                      <th key={c.label} colSpan={2} className="px-2 py-2 text-center border-l border-border">{c.label}</th>
                    ))}
                    <th colSpan={2} className="px-2 py-2 text-center border-l border-border text-[#f0f0ff] font-bold">Total</th>
                  </tr>
                  <tr className="border-b border-border text-[#c8d0e8] text-[10px] uppercase tracking-wider">
                    {COLS.map(c => (
                      <Fragment key={c.label}>
                        <th className="px-2 py-1.5 text-right border-l border-border">Ped</th>
                        <th className="px-2 py-1.5 text-right">€</th>
                      </Fragment>
                    ))}
                    <th className="px-2 py-1.5 text-right border-l border-border">Ped</th>
                    <th className="px-2 py-1.5 text-right">€</th>
                  </tr>
                </>
              ) : (
                <tr className="border-b border-border text-[#c8d0e8] text-xs uppercase tracking-wide">
                  <th className="px-3 py-2 text-left sticky left-0 bg-[#484f66] z-10">Fecha</th>
                  <th className="px-3 py-2 text-left">Serv.</th>
                  <th className="px-3 py-2 text-right">Pedidos</th>
                  <th className="px-3 py-2 text-right">Bruto</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(r => (
                <tr key={r.id} onClick={() => onEdit(r)}
                  className="hover:bg-[#484f66]/[0.03] transition-colors cursor-pointer">
                  <td className="px-3 py-2 text-[#f0f0ff] sticky left-0 bg-[#484f66]">{r.fecha}</td>
                  <td className="px-3 py-2"><ServicioBadge s={r.servicio} /></td>
                  {showBreakdown ? (
                    <>
                      {COLS.map(c => {
                        const p = (r[c.ped] as number) || 0
                        const b = (r[c.bru] as number) || 0
                        return (
                          <Fragment key={c.label}>
                            <td className="px-2 py-2 text-right text-[#c8d0e8] tabular-nums border-l border-border">
                              {p > 0 ? p : <Dash />}
                            </td>
                            <td className="px-2 py-2 text-right text-neutral-300 tabular-nums">
                              {b > 0 ? eur(b) : <Dash />}
                            </td>
                          </Fragment>
                        )
                      })}
                      <td className="px-2 py-2 text-right text-[#f0f0ff] font-medium tabular-nums border-l border-border">{num(r.total_pedidos)}</td>
                      <td className="px-2 py-2 text-right text-[#f0f0ff] font-semibold tabular-nums">{eur(r.total_bruto)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-right text-[#f0f0ff] tabular-nums">{num(getPed(r, canal))}</td>
                      <td className="px-3 py-2 text-right text-[#f0f0ff] font-medium tabular-nums">{eur(getBru(r, canal))}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-accent/30 bg-accent/5 font-semibold">
                <td className="px-3 py-2.5 text-[#f0f0ff] sticky left-0 bg-[#484f66]" colSpan={2}>TOTAL</td>
                {showBreakdown ? (
                  <>
                    {COLS.map(c => (
                      <Fragment key={c.label}>
                        <td className="px-2 py-2.5 text-right text-neutral-300 tabular-nums border-l border-border">{num(totals[c.ped] as number)}</td>
                        <td className="px-2 py-2.5 text-right text-neutral-200 tabular-nums">{eur(totals[c.bru] as number)}</td>
                      </Fragment>
                    ))}
                    <td className="px-2 py-2.5 text-right text-[#f0f0ff] tabular-nums border-l border-border">{num(totals.total_pedidos)}</td>
                    <td className="px-2 py-2.5 text-right text-[#f0f0ff] tabular-nums">{eur(totals.total_bruto)}</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2.5 text-right text-[#f0f0ff] tabular-nums">{num(getPed(totals, canal))}</td>
                    <td className="px-3 py-2.5 text-right text-[#f0f0ff] tabular-nums">{eur(getBru(totals, canal))}</td>
                  </>
                )}
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
  const rows = useMemo(() => buildSemanas(allData), [allData])
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
        <MiniKpi label="Bruto" valor={eur(getBru(totals, canal))} />
        <MiniKpi label="Pedidos" valor={num(getPed(totals, canal))} />
        <button onClick={exportar} className="ml-auto px-3 py-2 text-xs text-[#c8d0e8] border border-border rounded-lg hover:text-[#f0f0ff] transition">
          Exportar CSV
        </button>
      </div>

      <div className="bg-[#484f66] border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-border text-[#c8d0e8] text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Sem</th>
                <th className="px-4 py-3 text-left">Periodo</th>
                <th className="px-3 py-3 text-right">Dias</th>
                <th className="px-4 py-3 text-right">Pedidos</th>
                <th className="px-4 py-3 text-right">Bruto</th>
                {showBreakdown && COLS.map(c => (
                  <th key={c.label} className="px-3 py-3 text-right border-l border-border">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(r => {
                const ped = getPed(r, canal)
                const bru = getBru(r, canal)
                return (
                  <tr key={`${r.year}-${r.week}`} onClick={() => onDrill(r.year, r.week)}
                    className="hover:bg-[#484f66]/[0.03] transition-colors cursor-pointer">
                    <td className="px-4 py-2.5 text-[#f0f0ff] font-medium">S{r.week}</td>
                    <td className="px-4 py-2.5 text-[#c8d0e8]">{r.periodo}</td>
                    <td className="px-3 py-2.5 text-right text-[#c8d0e8] tabular-nums">{r.dias}</td>
                    <td className="px-4 py-2.5 text-right text-[#f0f0ff] tabular-nums">{num(ped)}</td>
                    <td className="px-4 py-2.5 text-right text-[#f0f0ff] font-medium tabular-nums">{eur(bru)}</td>
                    {showBreakdown && COLS.map(c => (
                      <td key={c.label} className="px-3 py-2.5 text-right text-[#c8d0e8] tabular-nums border-l border-border">
                        {(r[c.bru] as number) > 0 ? eur(r[c.bru] as number) : <Dash />}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-accent/30 bg-accent/5 font-semibold">
                <td className="px-4 py-2.5 text-[#f0f0ff]" colSpan={3}>TOTAL</td>
                <td className="px-4 py-2.5 text-right text-[#f0f0ff] tabular-nums">{num(getPed(totals, canal))}</td>
                <td className="px-4 py-2.5 text-right text-[#f0f0ff] tabular-nums">{eur(getBru(totals, canal))}</td>
                {showBreakdown && COLS.map(c => (
                  <td key={c.label} className="px-3 py-2.5 text-right text-neutral-300 tabular-nums border-l border-border">
                    {eur(totals[c.bru] as number)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="text-[10px] text-[#c8d0e8] mt-2">Haz clic en una semana para ver el detalle diario</p>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB: MESES
   ═══════════════════════════════════════════════════════════ */

function TabMeses({ allData, canal }: { allData: RawDiario[]; canal: CanalFilter }) {
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
            className="bg-base border border-border rounded-lg px-3 py-2 text-sm text-[#f0f0ff]">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <MiniKpi label="Bruto anual" valor={eur(getBru(yearTotal, canal))} />
        <MiniKpi label="Pedidos" valor={num(getPed(yearTotal, canal))} />
        <MiniKpi label="Media diaria" valor={yearTotal.dias > 0 ? eur(getBru(yearTotal, canal) / yearTotal.dias) : '—'} />
        <button onClick={exportar} className="ml-auto px-3 py-2 text-xs text-[#c8d0e8] border border-border rounded-lg hover:text-[#f0f0ff] transition">
          Exportar CSV
        </button>
      </div>

      <div className="bg-[#484f66] border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-border text-[#c8d0e8] text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Mes</th>
                <th className="px-3 py-3 text-right">Dias</th>
                <th className="px-4 py-3 text-right">Pedidos</th>
                <th className="px-4 py-3 text-right">Bruto</th>
                {showBreakdown && COLS.map(c => (
                  <th key={c.label} className="px-3 py-3 text-right border-l border-border">{c.label}</th>
                ))}
                <th className="px-4 py-3 text-right border-l border-border">Media/dia</th>
                <th className="px-4 py-3 text-right border-l border-border">vs Anterior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(r => {
                const ped = getPed(r, canal)
                const bru = getBru(r, canal)
                return (
                  <tr key={r.mes} className="hover:bg-[#484f66]/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-[#f0f0ff] font-medium">{MES_NOMBRE[r.mes]}</td>
                    <td className="px-3 py-2.5 text-right text-[#c8d0e8] tabular-nums">{r.dias}</td>
                    <td className="px-4 py-2.5 text-right text-[#f0f0ff] tabular-nums">{num(ped)}</td>
                    <td className="px-4 py-2.5 text-right text-[#f0f0ff] font-medium tabular-nums">{eur(bru)}</td>
                    {showBreakdown && COLS.map(c => (
                      <td key={c.label} className="px-3 py-2.5 text-right text-[#c8d0e8] tabular-nums border-l border-border">
                        {(r[c.bru] as number) > 0 ? eur(r[c.bru] as number) : <Dash />}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right text-[#c8d0e8] tabular-nums border-l border-border">
                      {r.dias > 0 ? eur(r.media_diaria) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right border-l border-border">
                      {r.vs_anterior !== null ? <DesvBadge pct={r.vs_anterior} /> : <Dash />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-accent/30 bg-accent/5 font-semibold">
                <td className="px-4 py-2.5 text-[#f0f0ff]">{selYear} TOTAL</td>
                <td className="px-3 py-2.5 text-right text-[#c8d0e8] tabular-nums">{yearTotal.dias}</td>
                <td className="px-4 py-2.5 text-right text-[#f0f0ff] tabular-nums">{num(getPed(yearTotal, canal))}</td>
                <td className="px-4 py-2.5 text-right text-[#f0f0ff] tabular-nums">{eur(getBru(yearTotal, canal))}</td>
                {showBreakdown && COLS.map(c => (
                  <td key={c.label} className="px-3 py-2.5 text-right text-neutral-300 tabular-nums border-l border-border">
                    {eur(yearTotal[c.bru] as number)}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right text-[#c8d0e8] tabular-nums border-l border-border">
                  {yearTotal.dias > 0 ? eur(getBru(yearTotal, canal) / yearTotal.dias) : '—'}
                </td>
                <td className="px-4 py-2.5 border-l border-border" />
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
  je_pedidos: string; je_bruto: string
  web_pedidos: string; web_bruto: string
}

const FORM_COLS: { label: string; ped: keyof FormFields; bru: keyof FormFields }[] = [
  { label: 'Uber Eats', ped: 'uber_pedidos', bru: 'uber_bruto' },
  { label: 'Glovo',     ped: 'glovo_pedidos', bru: 'glovo_bruto' },
  { label: 'Just Eat',  ped: 'je_pedidos',    bru: 'je_bruto' },
  { label: 'Web',       ped: 'web_pedidos',   bru: 'web_bruto' },
]

function DayModal({ existing, onClose, onSaved }: { existing?: RawDiario; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!existing
  const [fecha, setFecha] = useState(existing?.fecha ?? '')
  const [servicio, setServicio] = useState(existing?.servicio ?? 'ALM')
  const [fields, setFields] = useState<FormFields>(() => {
    if (!existing) return { uber_pedidos: '', uber_bruto: '', glovo_pedidos: '', glovo_bruto: '', je_pedidos: '', je_bruto: '', web_pedidos: '', web_bruto: '' }
    return {
      uber_pedidos: String(existing.uber_pedidos || ''), uber_bruto: String(existing.uber_bruto || ''),
      glovo_pedidos: String(existing.glovo_pedidos || ''), glovo_bruto: String(existing.glovo_bruto || ''),
      je_pedidos: String(existing.je_pedidos || ''), je_bruto: String(existing.je_bruto || ''),
      web_pedidos: String(existing.web_pedidos || ''), web_bruto: String(existing.web_bruto || ''),
    }
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const set = (k: keyof FormFields, v: string) => setFields(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!fecha) { setFormError('Selecciona una fecha'); return }

    const uber_ped = parseInt(fields.uber_pedidos) || 0
    const uber_bru = parseFloat(fields.uber_bruto) || 0
    const glovo_ped = parseInt(fields.glovo_pedidos) || 0
    const glovo_bru = parseFloat(fields.glovo_bruto) || 0
    const je_ped = parseInt(fields.je_pedidos) || 0
    const je_bru = parseFloat(fields.je_bruto) || 0
    const web_ped = parseInt(fields.web_pedidos) || 0
    const web_bru = parseFloat(fields.web_bruto) || 0
    const tot_ped = uber_ped + glovo_ped + je_ped + web_ped
    const tot_bru = uber_bru + glovo_bru + je_bru + web_bru

    if (tot_ped === 0 && tot_bru === 0) { setFormError('Introduce datos en al menos un canal'); return }

    const payload = {
      fecha, servicio,
      uber_pedidos: uber_ped, uber_bruto: uber_bru,
      glovo_pedidos: glovo_ped, glovo_bruto: glovo_bru,
      je_pedidos: je_ped, je_bruto: je_bru,
      web_pedidos: web_ped, web_bruto: web_bru,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#484f66] border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-[#f0f0ff] font-semibold">{isEdit ? 'Editar dia' : 'Anadir dia'}</h3>
          <button onClick={onClose} className="text-[#c8d0e8] hover:text-[#f0f0ff] text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#c8d0e8] mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full bg-base border border-border rounded-lg px-3 py-2.5 text-sm text-[#f0f0ff]" />
            </div>
            <div>
              <label className="block text-xs text-[#c8d0e8] mb-1">Servicio</label>
              <div className="flex gap-1">
                {SERVICIOS.map(s => (
                  <button key={s} type="button" onClick={() => setServicio(s)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      servicio === s ? 'bg-accent text-black' : 'bg-base border border-border text-[#c8d0e8] hover:text-[#f0f0ff]'
                    }`}>{s}</button>
                ))}
              </div>
            </div>
          </div>
          {FORM_COLS.map(c => (
            <div key={c.label} className="bg-base/50 border border-border rounded-lg p-3">
              <p className="text-xs text-[#c8d0e8] font-medium mb-2">{c.label}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-[#c8d0e8] mb-0.5">Pedidos</label>
                  <input type="number" min="0" placeholder="0" value={fields[c.ped]}
                    onChange={e => set(c.ped, e.target.value)}
                    className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm text-[#f0f0ff]" />
                </div>
                <div>
                  <label className="block text-[10px] text-[#c8d0e8] mb-0.5">Bruto (EUR)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={fields[c.bru]}
                    onChange={e => set(c.bru, e.target.value)}
                    className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm text-[#f0f0ff]" />
                </div>
              </div>
            </div>
          ))}
          {formError && <p className="text-[#dc2626] text-sm">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm text-[#c8d0e8] border border-border hover:text-[#f0f0ff] transition">Cancelar</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-accent text-black hover:brightness-110 transition disabled:opacity-50">
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

function KpiCard({ label, valor, sub }: { label: string; valor: string; sub: string }) {
  return (
    <div className="bg-[#484f66] border border-border rounded-xl p-4">
      <p className="text-xs text-[#c8d0e8] uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-[#f0f0ff] mt-1">{valor}</p>
      <p className="text-xs text-[#c8d0e8] mt-0.5">{sub}</p>
    </div>
  )
}

function MiniKpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="bg-[#484f66] border border-border rounded-lg px-3 py-2">
      <p className="text-[10px] text-[#c8d0e8] uppercase">{label}</p>
      <p className="text-sm font-bold text-[#f0f0ff]">{valor}</p>
    </div>
  )
}

function Loader() {
  return (
    <div className="bg-[#484f66] border border-border rounded-xl p-12 text-center">
      <div className="inline-block h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-[#c8d0e8] text-sm mt-3">Cargando...</p>
    </div>
  )
}

function ErrorBox({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="bg-[#484f66] border border-border rounded-xl p-8 text-center">
      <p className="text-[#dc2626] text-sm">{msg}</p>
      <button onClick={onRetry} className="mt-3 text-xs text-[#f0f0ff] underline hover:no-underline">Reintentar</button>
    </div>
  )
}

function EmptyState({ label, onAdd }: { label: string; onAdd?: () => void }) {
  return (
    <div className="bg-[#484f66] border border-border rounded-xl p-12 text-center">
      <p className="text-[#c8d0e8] text-sm">{label}</p>
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
  return <span className="text-[#c8d0e8]">—</span>
}
