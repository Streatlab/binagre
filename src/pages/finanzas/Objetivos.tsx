import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useTheme, cardStyle, semaforoColor, FONT, pageTitleStyle, tabActiveStyle, tabInactiveStyle, tabsContainerStyle } from '@/styles/tokens'
import { useCalendario } from '@/contexts/CalendarioContext'

interface ObjetivoGeneral { tipo: string; importe: number; id: string }
interface ObjetivoDia { dia: number; importe: number; id: string }
interface ObjetivoPresupuesto { id: string; categoria_codigo: string; anio: number; mes: number; importe: number }

// ─── ISO week helpers ──────────────────────────────────────────────────────────
function getISOWeek(d: Date): { year: number; week: number } {
  const dd = new Date(d)
  const day = dd.getDay() || 7
  dd.setDate(dd.getDate() + 4 - day)
  const y = dd.getFullYear()
  const jan1 = new Date(y, 0, 1)
  const week = Math.ceil(((dd.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return { year: y, week }
}

function mondayOfWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4)
  const day = jan4.getDay() || 7
  const firstMonday = new Date(jan4)
  firstMonday.setDate(jan4.getDate() - day + 1)
  const result = new Date(firstMonday)
  result.setDate(firstMonday.getDate() + (week - 1) * 7)
  return result
}

function isoWeek(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr + 'T12:00:00')
  return getISOWeek(d)
}

const fmtShort = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

const NOMBRES_DIA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']

const FESTIVOS_2026 = [
  '2026-01-01', '2026-01-06', '2026-03-19', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-02', '2026-05-15', '2026-07-25', '2026-08-15',
  '2026-10-12', '2026-11-01', '2026-11-09', '2026-12-08', '2026-12-25',
]

// ─── Presupuestos: categorías agrupadas ────────────────────────────────────────
const PRESUPUESTO_GRUPOS: { grupo: string; label: string; codigos: { codigo: string; nombre: string }[] }[] = [
  {
    grupo: 'PRODUCTO',
    label: 'Producto (COGS)',
    codigos: [
      { codigo: 'PRD-MP',  nombre: 'Materia prima' },
      { codigo: 'PRD-BEB', nombre: 'Bebidas' },
      { codigo: 'PRD-PCK', nombre: 'Packaging' },
      { codigo: 'PRD-MER', nombre: 'Mermas y roturas' },
    ],
  },
  {
    grupo: 'EQUIPO',
    label: 'Equipo (Labor)',
    codigos: [
      { codigo: 'EQP-NOM', nombre: 'Sueldos empleados nómina' },
      { codigo: 'EQP-SS',  nombre: 'Seguridad Social' },
      { codigo: 'EQP-RUB', nombre: 'Sueldo socio Rubén' },
      { codigo: 'EQP-EMI', nombre: 'Sueldo socio Emilio' },
      { codigo: 'EQP-GES', nombre: 'Gestoría laboral' },
      { codigo: 'EQP-FOR', nombre: 'Formación e incentivos' },
    ],
  },
  {
    grupo: 'LOCAL',
    label: 'Local (Occupancy)',
    codigos: [
      { codigo: 'LOC-ALQ', nombre: 'Alquiler local' },
      { codigo: 'LOC-SUM', nombre: 'Suministros' },
      { codigo: 'LOC-LIM', nombre: 'Limpieza' },
      { codigo: 'LOC-MTO', nombre: 'Mantenimiento y reparaciones' },
      { codigo: 'LOC-NET', nombre: 'Internet y telefonía' },
      { codigo: 'LOC-COM', nombre: 'Comunidad' },
      { codigo: 'LOC-IRP', nombre: 'IRPF retención alquiler' },
    ],
  },
  {
    grupo: 'CONTROLABLES',
    label: 'Controlables (OPEX)',
    codigos: [
      { codigo: 'CTR-MKT', nombre: 'Marketing y publicidad' },
      { codigo: 'CTR-SW',  nombre: 'Software y suscripciones' },
      { codigo: 'CTR-SEG', nombre: 'Seguros' },
      { codigo: 'CTR-GEF', nombre: 'Gestoría fiscal/contable' },
      { codigo: 'CTR-LIC', nombre: 'Licencias y tasas' },
      { codigo: 'CTR-TRP', nombre: 'Transporte y logística' },
      { codigo: 'CTR-BNK', nombre: 'Banco (comisiones, embargos)' },
      { codigo: 'CTR-OTR', nombre: 'Otros gastos' },
    ],
  },
]

const ALL_CODIGOS = PRESUPUESTO_GRUPOS.flatMap(g => g.codigos.map(c => c.codigo))
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ─── Component ────────────────────────────────────────────────────────────────
export default function Objetivos() {
  const { T, isDark } = useTheme()
  const { diasCerradosSemana, diasOperativosEnRango, tipoDia } = useCalendario()

  // Tab state
  const [activeTab, setActiveTab] = useState<'objetivos' | 'presupuestos'>('objetivos')

  // Week navigation (offset from current ISO week)
  const hoy = useMemo(() => new Date(), [])
  const [weekOffset, setWeekOffset] = useState(0)

  const { year: curYear, week: curWeek } = useMemo(() => getISOWeek(hoy), [hoy])
  const displayWeekNum = useMemo(() => {
    let w = curWeek + weekOffset
    let y = curYear
    if (w < 1) { y--; const jan4prev = new Date(y, 0, 4); const d2 = jan4prev.getDay() || 7; const fm = new Date(jan4prev); fm.setDate(jan4prev.getDate() - d2 + 1); const weeksInYear = getISOWeek(new Date(y, 11, 28)).week; w = weeksInYear + w }
    else { const weeksInYear = getISOWeek(new Date(y, 11, 28)).week; if (w > weeksInYear) { w = w - weeksInYear; y++ } }
    return { week: w, year: y }
  }, [curWeek, curYear, weekOffset])

  const monday = useMemo(() => mondayOfWeek(displayWeekNum.year, displayWeekNum.week), [displayWeekNum])
  const sunday = useMemo(() => { const d = new Date(monday); d.setDate(d.getDate() + 6); return d }, [monday])

  const weekLabel = useMemo(() => {
    const mondayFmt = monday.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
    return `S${displayWeekNum.week} — ${mondayFmt}`
  }, [monday, displayWeekNum.week])

  const isCurrentWeek = weekOffset === 0

  const fechaDia = useCallback((dia: number) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + dia - 1)
    return d
  }, [monday])

  const esFinde = (dia: number) => dia >= 5
  const esFestivo = (dia: number) => FESTIVOS_2026.includes(fechaDia(dia).toISOString().split('T')[0])
  const esHoy = (dia: number) => fechaDia(dia).toDateString() === hoy.toDateString()

  // Data states
  const [objetivos, setObjetivos] = useState<ObjetivoGeneral[]>([])
  const [diasSemana, setDiasSemana] = useState<ObjetivoDia[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const [histTipo, setHistTipo] = useState<'dias' | 'semanas' | 'meses' | 'anual'>('semanas')
  const [histAnio, setHistAnio] = useState<number>(hoy.getFullYear())
  const [ventas, setVentas] = useState<{ fecha: string; total_bruto: number }[]>([])
  const [loading, setLoading] = useState(true)

  // Presupuestos state
  const [presAnio, setPresAnio] = useState(hoy.getFullYear())
  const [presData, setPresData] = useState<ObjetivoPresupuesto[]>([])
  const [presLoading, setPresLoading] = useState(false)
  const [presEditing, setPresEditing] = useState<string | null>(null) // key = `${codigo}-${mes}`
  const [presEditVal, setPresEditVal] = useState('')
  const [presSaving, setPresSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('objetivos').select('*').in('tipo', ['diario','semanal','mensual','anual']),
      supabase.from('objetivos_dia_semana').select('*').order('dia'),
      supabase.from('facturacion_diario').select('fecha,total_bruto').order('fecha', { ascending: false }).limit(2000),
    ]).then(([g, d, v]) => {
      if (g.data) setObjetivos(g.data.map((r: any) => ({ tipo: r.tipo, importe: Number(r.importe), id: r.id })))
      if (d.data) setDiasSemana(d.data.map((r: any) => ({ dia: r.dia, importe: Number(r.importe), id: r.id })))
      if (v.data) setVentas(v.data.map((r: any) => ({ fecha: r.fecha, total_bruto: Number(r.total_bruto) || 0 })))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const loadPresupuestos = useCallback(async (anio: number) => {
    setPresLoading(true)
    const { data } = await supabase
      .from('objetivos')
      .select('id,categoria_codigo,anio,mes,importe')
      .eq('tipo', 'presupuesto')
      .eq('anio', anio)
      .in('categoria_codigo', ALL_CODIGOS)
    setPresData((data ?? []).map((r: any) => ({ id: r.id, categoria_codigo: r.categoria_codigo, anio: r.anio, mes: r.mes, importe: Number(r.importe) })))
    setPresLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'presupuestos') loadPresupuestos(presAnio)
  }, [activeTab, presAnio, loadPresupuestos])

  // ─── Save objetivo general ────────────────────────────────────────────────
  const saveObjetivoGeneral = async (tipo: string, val: number) => {
    const existing = objetivos.find(o => o.tipo === tipo)
    if (existing) {
      await supabase.from('objetivos').update({ importe: val }).eq('id', existing.id)
      setObjetivos(prev => prev.map(o => o.id === existing.id ? { ...o, importe: val } : o))
    } else {
      const { data } = await supabase.from('objetivos').insert({ tipo, importe: val }).select()
      if (data && data[0]) setObjetivos(prev => [...prev, { tipo, importe: val, id: data[0].id }])
    }
    setEditingId(null)
  }

  const deleteObjetivoGeneral = async (tipo: string) => {
    const existing = objetivos.find(o => o.tipo === tipo)
    if (existing) {
      await supabase.from('objetivos').delete().eq('id', existing.id)
      setObjetivos(prev => prev.filter(o => o.id !== existing.id))
    }
    setEditingId(null)
  }

  const saveDiaSemana = async (dia: number, val: number) => {
    const existing = diasSemana.find(d => d.dia === dia)
    if (existing) {
      await supabase.from('objetivos_dia_semana').update({ importe: val }).eq('id', existing.id)
      setDiasSemana(prev => prev.map(o => o.id === existing.id ? { ...o, importe: val } : o))
    } else {
      const { data } = await supabase.from('objetivos_dia_semana').insert({ dia, importe: val }).select()
      if (data && data[0]) setDiasSemana(prev => [...prev, { dia, importe: val, id: data[0].id }])
    }
    setEditingId(null)
  }

  // ─── Save presupuesto cell ────────────────────────────────────────────────
  const savePresupuesto = async (codigo: string, mes: number, val: number) => {
    setPresSaving(true)
    const existing = presData.find(p => p.categoria_codigo === codigo && p.mes === mes && p.anio === presAnio)
    if (existing) {
      await supabase.from('objetivos').update({ importe: val, updated_at: new Date().toISOString() }).eq('id', existing.id)
      setPresData(prev => prev.map(p => p.id === existing.id ? { ...p, importe: val } : p))
    } else {
      const { data } = await supabase.from('objetivos').insert({ tipo: 'presupuesto', categoria_codigo: codigo, anio: presAnio, mes, importe: val }).select()
      if (data && data[0]) setPresData(prev => [...prev, { id: data[0].id, categoria_codigo: codigo, anio: presAnio, mes, importe: val }])
    }
    setPresEditing(null)
    setPresSaving(false)
  }

  const copiarAnioAnterior = async () => {
    const anioAnt = presAnio - 1
    const { data } = await supabase.from('objetivos').select('*').eq('tipo', 'presupuesto').eq('anio', anioAnt).in('categoria_codigo', ALL_CODIGOS)
    if (!data || data.length === 0) { alert(`No hay datos de presupuesto para ${anioAnt}`); return }
    setPresSaving(true)
    for (const row of data) {
      const existing = presData.find(p => p.categoria_codigo === row.categoria_codigo && p.mes === row.mes)
      if (existing) {
        await supabase.from('objetivos').update({ importe: row.importe, updated_at: new Date().toISOString() }).eq('id', existing.id)
      } else {
        await supabase.from('objetivos').insert({ tipo: 'presupuesto', categoria_codigo: row.categoria_codigo, anio: presAnio, mes: row.mes, importe: row.importe })
      }
    }
    await loadPresupuestos(presAnio)
    setPresSaving(false)
  }

  // ─── Calculations ─────────────────────────────────────────────────────────
  const hoyStr = hoy.toISOString().slice(0, 10)
  const diaSemanaHoy = hoy.getDay() === 0 ? 7 : hoy.getDay()
  const objHoy = diasSemana.find(d => d.dia === diaSemanaHoy)?.importe || 0

  const ventasHoy = useMemo(() => ventas.filter(r => r.fecha === hoyStr).reduce((a, r) => a + r.total_bruto, 0), [ventas, hoyStr])

  const weekStart = useMemo(() => monday.toISOString().slice(0, 10), [monday])
  const weekEnd = useMemo(() => sunday.toISOString().slice(0, 10), [sunday])

  const ventasSemana = useMemo(() => ventas.filter(r => r.fecha >= weekStart && r.fecha <= weekEnd).reduce((a, r) => a + r.total_bruto, 0), [ventas, weekStart, weekEnd])

  // Banner avisos calendario
  const nDiasCerradosSemana = useMemo(() => diasCerradosSemana(monday), [diasCerradosSemana, monday])
  const diasOperativosSemana = useMemo(() => diasOperativosEnRango(monday, sunday), [diasOperativosEnRango, monday, sunday])

  const ventasPorDiaSemana = useMemo(() => {
    const map: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
    for (const r of ventas) {
      if (r.fecha >= weekStart && r.fecha <= weekEnd) {
        const d = new Date(r.fecha + 'T12:00:00')
        const ds = d.getDay() === 0 ? 7 : d.getDay()
        map[ds] += r.total_bruto
      }
    }
    return map
  }, [ventas, weekStart, weekEnd])

  const currentMonth = hoyStr.slice(0, 7)
  const ventasMes = useMemo(() => ventas.filter(r => r.fecha.startsWith(currentMonth)).reduce((a, r) => a + r.total_bruto, 0), [ventas, currentMonth])

  const currentYear = hoyStr.slice(0, 4)
  const ventasAno = useMemo(() => ventas.filter(r => r.fecha.startsWith(currentYear)).reduce((a, r) => a + r.total_bruto, 0), [ventas, currentYear])

  const sumaSemana = useMemo(() => diasSemana.reduce((a, d) => a + d.importe, 0), [diasSemana])
  const objSemanalOverride = objetivos.find(o => o.tipo === 'semanal')?.importe
  const objSemanal = objSemanalOverride !== undefined ? objSemanalOverride : sumaSemana

  const sumaMes = useMemo(() => {
    const ano = hoy.getFullYear()
    const mes = hoy.getMonth()
    const diasEnMes = new Date(ano, mes + 1, 0).getDate()
    let total = 0
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = new Date(ano, mes, d)
      const ds = fecha.getDay() === 0 ? 7 : fecha.getDay()
      total += diasSemana.find(x => x.dia === ds)?.importe || 0
    }
    return total
  }, [diasSemana, hoy])
  const objMensualOverride = objetivos.find(o => o.tipo === 'mensual')?.importe
  const objMensual = objMensualOverride !== undefined ? objMensualOverride : sumaMes

  const sumaAno = useMemo(() => {
    const ano = hoy.getFullYear()
    const esBis = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
    const dAno = esBis ? 366 : 365
    let total = 0
    const ini = new Date(ano, 0, 1)
    for (let i = 0; i < dAno; i++) {
      const f = new Date(ini)
      f.setDate(ini.getDate() + i)
      const ds = f.getDay() === 0 ? 7 : f.getDay()
      total += diasSemana.find(x => x.dia === ds)?.importe || 0
    }
    return total
  }, [diasSemana, hoy])
  const objAnualOverride = objetivos.find(o => o.tipo === 'anual')?.importe
  const objAnual = objAnualOverride !== undefined ? objAnualOverride : sumaAno

  // ─── Histórico ────────────────────────────────────────────────────────────
  const aniosDisponibles = useMemo(() => {
    const set = new Set(ventas.map(r => parseInt(r.fecha.slice(0, 4))))
    const arr = [...set].filter(y => !isNaN(y)).sort((a, b) => b - a)
    if (arr.length === 0) arr.push(hoy.getFullYear())
    return arr
  }, [ventas, hoy])

  const mondayStr = useMemo(() => { const d = mondayOfWeek(curYear, curWeek); return d.toISOString().slice(0, 10) }, [curYear, curWeek])
  const sundayStr = useMemo(() => { const d = mondayOfWeek(curYear, curWeek); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10) }, [curYear, curWeek])

  const historico = useMemo(() => {
    const esAnioActual = histAnio === hoy.getFullYear()
    const ventasFiltAnio = ventas.filter(r => r.fecha.startsWith(String(histAnio)))

    if (histTipo === 'dias') {
      const base = esAnioActual ? ventasFiltAnio.filter(r => r.fecha !== hoyStr) : ventasFiltAnio
      return [...base].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 14).map(r => {
        const d = new Date(r.fecha + 'T12:00:00')
        const ds = d.getDay() === 0 ? 7 : d.getDay()
        return { label: d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }), real: r.total_bruto, objetivo: diasSemana.find(x => x.dia === ds)?.importe || 0 }
      })
    }

    if (histTipo === 'semanas') {
      const base = esAnioActual ? ventasFiltAnio.filter(r => r.fecha < mondayStr || r.fecha > sundayStr) : ventasFiltAnio
      const map = new Map<string, number>()
      for (const r of base) {
        const { year, week } = isoWeek(r.fecha)
        const key = `${year}-${String(week).padStart(2, '0')}`
        map.set(key, (map.get(key) || 0) + r.total_bruto)
      }
      return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12)
        .map(([key, real]) => ({ label: `S${parseInt(key.split('-')[1])}`, real, objetivo: objSemanal }))
    }

    if (histTipo === 'anual') {
      const total = ventasFiltAnio.reduce((a, r) => a + r.total_bruto, 0)
      return [{ label: String(histAnio), real: total, objetivo: objAnual }]
    }

    const currentMonthStr = hoy.toISOString().slice(0, 7)
    const base = esAnioActual ? ventasFiltAnio.filter(r => !r.fecha.startsWith(currentMonthStr)) : ventasFiltAnio
    const map = new Map<string, number>()
    for (const r of base) {
      const m = r.fecha.slice(0, 7)
      map.set(m, (map.get(m) || 0) + r.total_bruto)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([key, real]) => {
      const [y, mm] = key.split('-')
      const label = new Date(parseInt(y), parseInt(mm) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      return { label, real, objetivo: objMensual }
    })
  }, [ventas, histTipo, histAnio, diasSemana, objSemanal, objMensual, objAnual, mondayStr, sundayStr, hoyStr, hoy])

  if (loading) return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px', color: T.sec, fontFamily: FONT.body }}>Cargando…</div>
  )

  // ─── Render helpers ───────────────────────────────────────────────────────
  const pctHoy = objHoy > 0 ? Math.round((ventasHoy / objHoy) * 100) : 0
  const pctSem = objSemanal > 0 ? Math.round((ventasSemana / objSemanal) * 100) : 0
  const pctMes = objMensual > 0 ? Math.round((ventasMes / objMensual) * 100) : 0
  const pctAno = objAnual > 0 ? Math.round((ventasAno / objAnual) * 100) : 0
  const colHoy = semaforoColor(pctHoy)
  const colSem = semaforoColor(pctSem)
  const colMes = semaforoColor(pctMes)
  const colAno = semaforoColor(pctAno)
  const INCUMPLIDO = '#E24B4A'

  const editableNumberStyle = (color: string = T.pri) => ({
    color,
    fontWeight: 600 as const,
    cursor: 'pointer',
    borderBottom: `1px dashed ${T.mut}`,
    paddingBottom: 1,
  })

  const renderInlineEdit = (id: string, currentVal: number, onSave: (v: number) => void, onReset?: () => void, color: string = T.pri) => {
    const commit = () => {
      const trimmed = editValue.trim()
      if (trimmed === '' && onReset) { onReset(); return }
      const v = parseFloat(trimmed.replace(',', '.'))
      if (!isNaN(v)) onSave(v)
      else setEditingId(null)
    }
    if (editingId === id) {
      return (
        <input
          type="number"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditingId(null)
          }}
          autoFocus
          placeholder="vacío = reset"
          style={{ fontFamily: FONT.heading, fontSize: 'inherit', fontWeight: 600, color, background: isDark ? '#3a4058' : '#fff', border: `1px solid ${T.brd}`, borderRadius: 6, padding: '2px 6px', width: 110, textAlign: 'right' }}
        />
      )
    }
    return (
      <span
        onClick={() => { setEditingId(id); setEditValue(String(currentVal)) }}
        style={editableNumberStyle(color)}
      >
        {fmtEur(currentVal)}
      </span>
    )
  }

  const renderPeriodRow = (titulo: string, sub: string, real: number, obj: number, pct: number, color: string, editId: string, onSave: (v: number) => void, onReset?: () => void) => {
    const pctCap = Math.min(pct, 100)
    const falta = Math.max(0, obj - real)
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', color: T.mut, textTransform: 'uppercase' }}>
            {titulo} <span style={{ color: T.mut, fontWeight: 400, opacity: 0.7 }}>— {sub}</span>
          </span>
          <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color }}>{pct}%</span>
        </div>
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, marginBottom: 6 }}>
          Faltan <span style={{ color, fontWeight: 500 }}>{fmtEur(falta)}</span> de {renderInlineEdit(editId, obj, onSave, onReset)}
        </div>
        <div style={{ height: 4, background: T.brd, borderRadius: 2, display: 'flex', overflow: 'hidden' }}>
          <div style={{ height: 4, background: color, width: `${pctCap}%`, transition: 'width 0.4s ease' }} />
          <div style={{ height: 4, background: INCUMPLIDO, width: `${100 - pctCap}%` }} />
        </div>
      </div>
    )
  }

  const inputSelectStyle = {
    background: isDark ? '#3a4058' : '#ffffff',
    border: `1px solid ${isDark ? '#4a5270' : '#cccccc'}`,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 12,
    borderRadius: 8,
    padding: '4px 10px',
    cursor: 'pointer',
  }

  const sectionLabel = {
    fontFamily: FONT.heading, fontSize: 10,
    letterSpacing: '2px', textTransform: 'uppercase' as const,
    color: T.mut, margin: '24px 0 10px',
  }

  // ─── Presupuestos helpers ─────────────────────────────────────────────────
  const getPresVal = (codigo: string, mes: number) =>
    presData.find(p => p.categoria_codigo === codigo && p.mes === mes)?.importe ?? 0

  const totalMes = (mes: number) =>
    ALL_CODIGOS.reduce((a, c) => a + getPresVal(c, mes), 0)

  const totalCodigo = (codigo: string) =>
    Array.from({ length: 12 }, (_, i) => i + 1).reduce((a, m) => a + getPresVal(codigo, m), 0)

  const totalAnual = () =>
    ALL_CODIGOS.reduce((a, c) => a + totalCodigo(c), 0)

  const commitPresEdit = (codigo: string, mes: number) => {
    const v = parseFloat(presEditVal.replace(',', '.'))
    if (!isNaN(v) && v >= 0) savePresupuesto(codigo, mes, v)
    else setPresEditing(null)
  }

  // ─── Tabs UI ──────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'objetivos', label: 'Objetivos de venta' },
    { key: 'presupuestos', label: 'Presupuesto de gastos' },
  ]

  return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px', width: '100%' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={pageTitleStyle(T)}>Objetivos</h1>
        {activeTab === 'objetivos' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              style={{ background: 'transparent', border: `1px solid ${T.brd}`, color: T.sec, borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: FONT.heading, fontSize: 14, lineHeight: 1 }}
            >‹</button>
            <span style={{ fontFamily: FONT.heading, fontSize: 13, color: T.pri, minWidth: 130, textAlign: 'center' }}>{weekLabel}</span>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              disabled={isCurrentWeek}
              style={{ background: 'transparent', border: `1px solid ${isCurrentWeek ? T.brd : T.brd}`, color: isCurrentWeek ? T.mut : T.sec, borderRadius: 6, padding: '3px 10px', cursor: isCurrentWeek ? 'default' : 'pointer', fontFamily: FONT.heading, fontSize: 14, lineHeight: 1, opacity: isCurrentWeek ? 0.4 : 1 }}
            >›</button>
          </div>
        )}
      </div>

      {/* TABS */}
      <div style={tabsContainerStyle()}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'objetivos' | 'presupuestos')}
            style={activeTab === tab.key ? tabActiveStyle(isDark) : tabInactiveStyle(T)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: OBJETIVOS ═══ */}
      {activeTab === 'objetivos' && (
        <>
          {/* BANNER aviso días cerrados semana */}
          {nDiasCerradosSemana > 0 && (() => {
            const objAjustado = objMensual > 0 && diasOperativosSemana > 0
              ? objMensual / (diasOperativosEnRango(
                  new Date(monday.getFullYear(), monday.getMonth(), 1),
                  new Date(monday.getFullYear(), monday.getMonth() + 1, 0),
                ) || 1) * diasOperativosSemana
              : null
            return (
              <div style={{ backgroundColor: '#e8f442', color: '#111111', padding: '10px 16px', borderRadius: 8, marginBottom: 12, fontFamily: FONT.heading, fontSize: 13, letterSpacing: 0.5 }}>
                Esta semana hay {nDiasCerradosSemana} día{nDiasCerradosSemana > 1 ? 's' : ''} cerrado{nDiasCerradosSemana > 1 ? 's' : ''}, objetivo ajustado a {objAjustado != null ? fmtEur(objAjustado) : '—'}
              </div>
            )
          })()}

          {/* DOS CARDS PRINCIPALES */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* IZQUIERDA: Hero HOY + 3 periodos */}
            <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', color: T.mut, textTransform: 'uppercase', marginBottom: 4 }}>
                Ventas · Hoy {hoy.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }).toUpperCase()}
              </div>
              <div style={{ fontFamily: FONT.heading, fontSize: 36, fontWeight: 700, color: T.pri, lineHeight: 1, letterSpacing: '-0.5px', marginBottom: 6 }}>
                {fmtEur(ventasHoy)}
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 12, fontWeight: 500, color: colHoy, marginBottom: 22 }}>
                {pctHoy >= 100 ? '▲' : '▼'} {pctHoy}% del objetivo diario · {fmtEur(objHoy)}
              </div>
              {renderPeriodRow('Semanal', weekLabel, ventasSemana, objSemanal, pctSem, colSem, 'obj-semanal', (v) => saveObjetivoGeneral('semanal', v), () => deleteObjetivoGeneral('semanal'))}
              {renderPeriodRow('Mensual', hoy.toLocaleDateString('es-ES', { month: 'long' }), ventasMes, objMensual, pctMes, colMes, 'obj-mensual', (v) => saveObjetivoGeneral('mensual', v), () => deleteObjetivoGeneral('mensual'))}
              {renderPeriodRow('Anual', String(hoy.getFullYear()), ventasAno, objAnual, pctAno, colAno, 'obj-anual', (v) => saveObjetivoGeneral('anual', v), () => deleteObjetivoGeneral('anual'))}
            </div>

            {/* DERECHA: Semana vertical L-D */}
            <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', color: T.mut, textTransform: 'uppercase' }}>Objetivo por día</span>
                <span style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', color: T.mut, textTransform: 'uppercase', opacity: 0.7 }}>click editar</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[1,2,3,4,5,6,7].map((dia, idx) => {
                  const diaData = diasSemana.find(d => d.dia === dia)
                  const importe = diaData?.importe ?? 0
                  const ventasDia = ventasPorDiaSemana[dia] || 0
                  const pct = importe > 0 ? Math.round((ventasDia / importe) * 100) : 0
                  const pctCap = Math.min(pct, 100)
                  const col = '#1D9E75'
                  const finde = esFinde(dia)
                  const festivo = esFestivo(dia)
                  const hoyFlag = esHoy(dia) && isCurrentWeek
                  const fechaDiaD = fechaDia(dia)
                  const fechaDiaStr = `${fechaDiaD.getFullYear()}-${String(fechaDiaD.getMonth()+1).padStart(2,'0')}-${String(fechaDiaD.getDate()).padStart(2,'0')}`
                  const tipoDiaActual = tipoDia(fechaDiaStr)
                  const esCerradoCalendario = tipoDiaActual === 'cerrado' || tipoDiaActual === 'festivo' || tipoDiaActual === 'vacaciones'

                  let rowBg = 'transparent'
                  let rowBorderLeft = '3px solid transparent'
                  let diaColor = T.sec
                  if (festivo) { rowBg = '#f5a62310'; rowBorderLeft = '3px solid #f5a623'; diaColor = '#f5a623' }
                  else if (finde) { rowBg = '#1D9E7510'; rowBorderLeft = '3px solid #1D9E75'; diaColor = '#1D9E75' }

                  // HOY: borde amarillo grueso, sin ring rojo
                  if (hoyFlag) {
                    rowBorderLeft = '3px solid #e8f442'
                  }

                  const fecha = fechaDia(dia)
                  const fechaStr = `${fecha.getDate()} ${fecha.toLocaleDateString('es-ES', { month: 'short' })}`
                  const editId = `dia-${dia}`
                  void esCerradoCalendario // used below

                  return (
                    <div key={dia} style={{
                      display: 'grid',
                      gridTemplateColumns: '70px 1fr 90px',
                      alignItems: 'center',
                      gap: 14,
                      padding: hoyFlag ? '12px 14px' : '10px 14px',
                      margin: '0 -14px',
                      background: rowBg,
                      borderLeft: rowBorderLeft,
                      borderBottom: idx < 6 ? `0.5px solid ${T.brd}` : 'none',
                      borderRadius: hoyFlag ? 8 : 0,
                      position: 'relative',
                    }}>
                      <div>
                        <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', color: hoyFlag ? '#e8f442' : diaColor, textTransform: 'uppercase', fontWeight: hoyFlag ? 700 : 500 }}>
                          {NOMBRES_DIA[dia - 1]}
                        </div>
                        <div style={{ fontFamily: FONT.body, fontSize: 10, color: hoyFlag ? '#e8f442' : T.mut, marginTop: 1, fontWeight: hoyFlag ? 600 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {fechaStr}{hoyFlag ? ' · HOY' : ''}
                          {esCerradoCalendario && <span style={{ backgroundColor: '#B01D23', color: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 9, fontFamily: FONT.heading, letterSpacing: 0.5 }}>CERRADO</span>}
                          {tipoDiaActual === 'solo_comida' && <span style={{ backgroundColor: '#e8f442', color: '#111', padding: '1px 5px', borderRadius: 3, fontSize: 9, fontFamily: FONT.heading, letterSpacing: 0.5 }}>ALM</span>}
                          {tipoDiaActual === 'solo_cena' && <span style={{ backgroundColor: '#f5a623', color: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 9, fontFamily: FONT.heading, letterSpacing: 0.5 }}>CENA</span>}
                        </div>
                      </div>
                      <div style={{ height: 5, background: T.brd, borderRadius: 3, display: 'flex', overflow: 'hidden' }}>
                        {importe > 0 ? (
                          <>
                            <div style={{ height: 5, background: col, width: `${pctCap}%`, transition: 'width 0.4s ease' }} />
                            <div style={{ height: 5, background: INCUMPLIDO, width: `${100 - pctCap}%` }} />
                          </>
                        ) : null}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {editingId === editId ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => { const v = parseFloat(editValue.replace(',', '.')); if (!isNaN(v)) saveDiaSemana(dia, v); else setEditingId(null) }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { const v = parseFloat(editValue.replace(',', '.')); if (!isNaN(v)) saveDiaSemana(dia, v); else setEditingId(null) }
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            autoFocus
                            style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: hoyFlag ? 700 : 600, color: hoyFlag ? '#e8f442' : T.pri, background: isDark ? '#3a4058' : '#fff', border: `1px solid ${T.brd}`, borderRadius: 6, padding: '3px 6px', width: 80, textAlign: 'right' }}
                          />
                        ) : (
                          <span
                            onClick={() => { setEditingId(editId); setEditValue(String(importe)) }}
                            style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: hoyFlag ? 700 : 600, color: T.pri, cursor: 'pointer' }}
                          >
                            {fmtEur(importe)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>

          {/* HISTÓRICO */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ ...sectionLabel, margin: 0 }}>Histórico de cumplimiento</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={histTipo} onChange={e => setHistTipo(e.target.value as any)} style={inputSelectStyle}>
                <option value="dias">Por días</option>
                <option value="semanas">Por semanas</option>
                <option value="meses">Por meses</option>
                <option value="anual">Todo el año</option>
              </select>
              <select value={histAnio} onChange={e => setHistAnio(parseInt(e.target.value))} style={inputSelectStyle}>
                {aniosDisponibles.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div style={cardStyle(T)}>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px 100px 100px 90px', gap: 8, padding: '6px 0 10px', borderBottom: `0.5px solid ${T.brd}`, fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut }}>
              <span>Período</span>
              <span>Cumplido · Pendiente</span>
              <span style={{ textAlign: 'right' }}>% Real</span>
              <span style={{ textAlign: 'right' }}>Real</span>
              <span style={{ textAlign: 'right' }}>Objetivo</span>
              <span style={{ textAlign: 'right' }}>Desviación</span>
            </div>
            {historico.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: FONT.body, fontSize: 13, color: T.mut }}>Sin datos históricos</div>
            )}
            {historico.map((h, idx) => {
              const pct = h.objetivo > 0 ? Math.round((h.real / h.objetivo) * 100) : 0
              const pctCap = Math.min(pct, 100)
              const sc = semaforoColor(pct)
              const desv = h.real - h.objetivo
              const desvColor = desv >= 0 ? '#1D9E75' : '#E24B4A'
              const desvStr = (desv >= 0 ? '+' : '') + fmtEur(desv)
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px 100px 100px 90px', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: idx < historico.length - 1 ? `0.5px solid ${T.brd}` : 'none' }}>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{h.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 8, background: T.brd, borderRadius: 4, display: 'flex', overflow: 'hidden' }}>
                      <div style={{ height: 8, background: sc, width: `${pctCap}%` }} />
                      <div style={{ height: 8, background: INCUMPLIDO, width: `${100 - pctCap}%` }} />
                    </div>
                  </div>
                  <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 600, color: sc, textAlign: 'right' }}>{pct}%</span>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, fontWeight: 500, color: T.pri, textAlign: 'right' }}>{fmtEur(h.real)}</span>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, textAlign: 'right' }}>{fmtEur(h.objetivo)}</span>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, fontWeight: 500, color: desvColor, textAlign: 'right' }}>{desvStr}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ═══ TAB: PRESUPUESTOS ═══ */}
      {activeTab === 'presupuestos' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <select
              value={presAnio}
              onChange={e => setPresAnio(parseInt(e.target.value))}
              style={inputSelectStyle}
            >
              {[hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={copiarAnioAnterior}
              disabled={presSaving}
              style={{ background: '#222', color: T.sec, border: `1px solid #383838`, borderRadius: 6, padding: '5px 14px', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: presSaving ? 'default' : 'pointer', opacity: presSaving ? 0.5 : 1 }}
            >
              Copiar año anterior
            </button>
            {presSaving && <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>Guardando…</span>}
          </div>

          {presLoading ? (
            <div style={{ color: T.mut, fontFamily: FONT.body, padding: '24px 0' }}>Cargando presupuesto…</div>
          ) : (
            PRESUPUESTO_GRUPOS.map(grupo => {
              // Totals per group per month
              const totalGrupoMes = (mes: number) => grupo.codigos.reduce((a, c) => a + getPresVal(c.codigo, mes), 0)
              const totalGrupoAnual = () => grupo.codigos.reduce((a, c) => a + totalCodigo(c.codigo), 0)

              return (
                <div key={grupo.grupo} style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#e8f442', marginBottom: 8 }}>
                    {grupo.label}
                  </div>
                  <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 10, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                      <thead>
                        <tr style={{ background: '#0a0a0a' }}>
                          <th style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 12px', textAlign: 'left', position: 'sticky', left: 0, background: '#0a0a0a', zIndex: 1, minWidth: 160 }}>Categoría</th>
                          {MESES.map((m, i) => (
                            <th key={m} style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: T.mut, padding: '8px 6px', textAlign: 'right', minWidth: 72 }}>{m}</th>
                          ))}
                          <th style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: T.mut, padding: '8px 10px', textAlign: 'right', minWidth: 90 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.codigos.map(cat => (
                          <tr key={cat.codigo} style={{ borderTop: `1px solid ${T.brd}` }}>
                            <td style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, padding: '7px 12px', position: 'sticky', left: 0, background: T.card, zIndex: 1 }}>
                              <span style={{ fontFamily: FONT.heading, fontSize: 10, color: '#e8f442', marginRight: 6 }}>{cat.codigo}</span>
                              {cat.nombre}
                            </td>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => {
                              const cellKey = `${cat.codigo}-${mes}`
                              const val = getPresVal(cat.codigo, mes)
                              const isEditing = presEditing === cellKey
                              return (
                                <td key={mes} style={{ padding: '4px 6px', textAlign: 'right' }}>
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      value={presEditVal}
                                      onChange={e => setPresEditVal(e.target.value)}
                                      onBlur={() => commitPresEdit(cat.codigo, mes)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') commitPresEdit(cat.codigo, mes)
                                        if (e.key === 'Escape') setPresEditing(null)
                                      }}
                                      autoFocus
                                      style={{ fontFamily: FONT.heading, fontSize: 11, color: T.pri, background: '#1e1e1e', border: `1px solid #e8f442`, borderRadius: 4, padding: '3px 5px', width: 66, textAlign: 'right' }}
                                    />
                                  ) : (
                                    <span
                                      onClick={() => { setPresEditing(cellKey); setPresEditVal(String(val)) }}
                                      style={{ fontFamily: FONT.heading, fontSize: 11, color: val > 0 ? T.pri : T.mut, cursor: 'pointer', display: 'block', padding: '3px 2px', borderRadius: 3 }}
                                      title="Clic para editar"
                                    >
                                      {val > 0 ? fmtEur(val) : '—'}
                                    </span>
                                  )}
                                </td>
                              )
                            })}
                            <td style={{ fontFamily: FONT.heading, fontSize: 11, color: '#e8f442', padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>
                              {fmtEur(totalCodigo(cat.codigo))}
                            </td>
                          </tr>
                        ))}
                        {/* Subtotal row per group */}
                        <tr style={{ borderTop: `2px solid ${T.brd}`, background: '#0d0d0d' }}>
                          <td style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', color: '#e8f442', padding: '8px 12px', textTransform: 'uppercase', position: 'sticky', left: 0, background: '#0d0d0d', zIndex: 1 }}>
                            Total {grupo.label.split(' ')[0]}
                          </td>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
                            <td key={mes} style={{ fontFamily: FONT.heading, fontSize: 11, color: '#e8f442', padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>
                              {fmtEur(totalGrupoMes(mes))}
                            </td>
                          ))}
                          <td style={{ fontFamily: FONT.heading, fontSize: 12, color: '#e8f442', padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                            {fmtEur(totalGrupoAnual())}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )}

          {/* Grand total row */}
          {!presLoading && (
            <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 10, overflow: 'auto', marginTop: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <tbody>
                  <tr style={{ background: '#111' }}>
                    <td style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', color: '#e8f442', padding: '10px 12px', textTransform: 'uppercase', minWidth: 160 }}>Total gastos {presAnio}</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
                      <td key={mes} style={{ fontFamily: FONT.heading, fontSize: 11, color: T.pri, padding: '10px 6px', textAlign: 'right', fontWeight: 600, minWidth: 72 }}>
                        {fmtEur(totalMes(mes))}
                      </td>
                    ))}
                    <td style={{ fontFamily: FONT.heading, fontSize: 13, color: '#e8f442', padding: '10px 10px', textAlign: 'right', fontWeight: 700, minWidth: 90 }}>
                      {fmtEur(totalAnual())}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
