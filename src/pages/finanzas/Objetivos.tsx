import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useTheme, cardStyle, semaforoColor, FONT, pageTitleStyle } from '@/styles/tokens'

interface ObjetivoGeneral { tipo: string; importe: number; id: string }
interface ObjetivoDia { dia: number; importe: number; id: string }

const hoy = new Date()
const dayOfWeek = hoy.getDay()
const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
const monday = new Date(hoy)
monday.setDate(hoy.getDate() + daysToMonday)
const sunday = new Date(monday)
sunday.setDate(monday.getDate() + 6)

const fmtShort = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
const weekNum = (() => {
  const d = new Date(hoy)
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const y = d.getFullYear()
  const jan1 = new Date(y, 0, 1)
  return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
})()

const NOMBRES_DIA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']

const fechaDia = (dia: number) => {
  const d = new Date(monday)
  d.setDate(monday.getDate() + dia - 1)
  return d
}

const FESTIVOS_2026 = [
  '2026-01-01', '2026-01-06', '2026-03-19', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-02', '2026-05-15', '2026-07-25', '2026-08-15',
  '2026-10-12', '2026-11-01', '2026-11-09', '2026-12-08', '2026-12-25',
]

const esFinde = (dia: number) => dia >= 5
const esFestivo = (dia: number) => FESTIVOS_2026.includes(fechaDia(dia).toISOString().split('T')[0])
const esHoy = (dia: number) => fechaDia(dia).toDateString() === hoy.toDateString()

function isoWeek(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const y = d.getFullYear()
  const jan1 = new Date(y, 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return { year: y, week }
}

export default function Objetivos() {
  const { T, isDark } = useTheme()

  const [objetivos, setObjetivos] = useState<ObjetivoGeneral[]>([])
  const [diasSemana, setDiasSemana] = useState<ObjetivoDia[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const [histTipo, setHistTipo] = useState<'dias' | 'semanas' | 'meses' | 'anual'>('semanas')
  const [histAnio, setHistAnio] = useState<number>(new Date().getFullYear())
  const [ventas, setVentas] = useState<{ fecha: string; total_bruto: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('objetivos').select('*'),
      supabase.from('objetivos_dia_semana').select('*').order('dia'),
      supabase.from('facturacion_diario').select('fecha,total_bruto').order('fecha', { ascending: false }).limit(2000),
    ]).then(([g, d, v]) => {
      if (g.data) setObjetivos(g.data.map((r: any) => ({ tipo: r.tipo, importe: Number(r.importe), id: r.id })))
      if (d.data) setDiasSemana(d.data.map((r: any) => ({ dia: r.dia, importe: Number(r.importe), id: r.id })))
      if (v.data) setVentas(v.data.map((r: any) => ({ fecha: r.fecha, total_bruto: Number(r.total_bruto) || 0 })))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

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

  // Cálculos
  const hoyStr = hoy.toISOString().slice(0, 10)
  const diaSemanaHoy = hoy.getDay() === 0 ? 7 : hoy.getDay()
  const objHoy = diasSemana.find(d => d.dia === diaSemanaHoy)?.importe || 0

  const ventasHoy = useMemo(() => ventas.filter(r => r.fecha === hoyStr).reduce((a, r) => a + r.total_bruto, 0), [ventas, hoyStr])

  const weekStart = monday.toISOString().slice(0, 10)
  const weekEnd = sunday.toISOString().slice(0, 10)
  const ventasSemana = useMemo(() => ventas.filter(r => r.fecha >= weekStart && r.fecha <= weekEnd).reduce((a, r) => a + r.total_bruto, 0), [ventas, weekStart, weekEnd])

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

  // Objetivos: override o suma de días
  const sumaSemana = useMemo(() => diasSemana.reduce((a, d) => a + d.importe, 0), [diasSemana])
  const objSemanalOverride = objetivos.find(o => o.tipo === 'semanal')?.importe
  // Siempre priorizar la suma de los días de semana; el override solo se usa si el usuario ha editado explícitamente y la suma es 0
  const objSemanal = sumaSemana > 0 ? sumaSemana : (objSemanalOverride ?? 0)

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
  }, [diasSemana])
  const objMensualOverride = objetivos.find(o => o.tipo === 'mensual')?.importe
  const objMensual = sumaMes > 0 ? sumaMes : (objMensualOverride ?? 0)

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
  }, [diasSemana])
  const objAnualOverride = objetivos.find(o => o.tipo === 'anual')?.importe
  const objAnual = sumaAno > 0 ? sumaAno : (objAnualOverride ?? 0)

  // Histórico
  const aniosDisponibles = useMemo(() => {
    const set = new Set(ventas.map(r => parseInt(r.fecha.slice(0, 4))))
    const arr = [...set].filter(y => !isNaN(y)).sort((a, b) => b - a)
    if (arr.length === 0) arr.push(new Date().getFullYear())
    return arr
  }, [ventas])

  const mondayStr = monday.toISOString().slice(0, 10)
  const sundayStr = sunday.toISOString().slice(0, 10)

  const historico = useMemo(() => {
    const esAnioActual = histAnio === new Date().getFullYear()
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
  }, [ventas, histTipo, histAnio, diasSemana, objSemanal, objMensual, objAnual, mondayStr, sundayStr, hoyStr])

  if (loading) return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px', color: T.sec, fontFamily: FONT.body }}>Cargando…</div>
  )

  // Helpers de render
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

  const renderInlineEdit = (id: string, currentVal: number, onSave: (v: number) => void, color: string = T.pri) => {
    if (editingId === id) {
      return (
        <input
          type="number"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => { const v = parseFloat(editValue.replace(',', '.')); if (!isNaN(v)) onSave(v); else setEditingId(null) }}
          onKeyDown={e => {
            if (e.key === 'Enter') { const v = parseFloat(editValue.replace(',', '.')); if (!isNaN(v)) onSave(v); else setEditingId(null) }
            if (e.key === 'Escape') setEditingId(null)
          }}
          autoFocus
          style={{ fontFamily: FONT.heading, fontSize: 'inherit', fontWeight: 600, color, background: isDark ? '#3a4058' : '#fff', border: `1px solid ${T.brd}`, borderRadius: 6, padding: '2px 6px', width: 90, textAlign: 'right' }}
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

  const renderPeriodRow = (titulo: string, sub: string, real: number, obj: number, pct: number, color: string, editId: string, onSave: (v: number) => void) => {
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
          Faltan <span style={{ color, fontWeight: 500 }}>{fmtEur(falta)}</span> de {renderInlineEdit(editId, obj, onSave)}
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

  return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px', width: '100%' }}>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={pageTitleStyle(T)}>Objetivos — S{weekNum}</h1>
        <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>{fmtShort(monday)} — {fmtShort(sunday)} {hoy.getFullYear()}</span>
      </div>

      {/* DOS CARDS PRINCIPALES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* IZQUIERDA: Hero HOY + 3 periodos editables */}
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

          {renderPeriodRow('Semanal', `S${weekNum}`, ventasSemana, objSemanal, pctSem, colSem, 'obj-semanal', (v) => saveObjetivoGeneral('semanal', v))}
          {renderPeriodRow('Mensual', hoy.toLocaleDateString('es-ES', { month: 'long' }), ventasMes, objMensual, pctMes, colMes, 'obj-mensual', (v) => saveObjetivoGeneral('mensual', v))}
          {renderPeriodRow('Anual', String(hoy.getFullYear()), ventasAno, objAnual, pctAno, colAno, 'obj-anual', (v) => saveObjetivoGeneral('anual', v))}
        </div>

        {/* DERECHA: Semana vertical L-D */}
        <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', color: T.mut, textTransform: 'uppercase' }}>Objetivo por día · S{weekNum}</span>
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
              const hoyFlag = esHoy(dia)

              let rowBg = 'transparent'
              let rowBorderLeft = '3px solid transparent'
              let diaColor = T.sec
              if (festivo) { rowBg = '#f5a62310'; rowBorderLeft = '3px solid #f5a623'; diaColor = '#f5a623' }
              else if (finde) { rowBg = '#1D9E7510'; rowBorderLeft = '3px solid #1D9E75'; diaColor = '#1D9E75' }
              // HOY: mantiene fondo finde/festivo pero sobrescribe borde y añade ring
              const hoyRing = hoyFlag ? `inset 0 0 0 1.5px #FF4757` : 'none'
              if (hoyFlag) {
                rowBorderLeft = '3px solid #FF4757'
                // NO tocar rowBg: mantiene el del finde/festivo si aplica
                // NO tocar diaColor: mantiene color finde/festivo para coherencia
              }

              const fecha = fechaDia(dia)
              const fechaStr = `${fecha.getDate()} ${fecha.toLocaleDateString('es-ES', { month: 'short' })}`
              const editId = `dia-${dia}`

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
                  boxShadow: hoyRing,
                  position: 'relative',
                }}>
                  <div>
                    <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', color: hoyFlag ? '#FF4757' : diaColor, textTransform: 'uppercase', fontWeight: hoyFlag ? 700 : 500 }}>
                      {NOMBRES_DIA[dia - 1]}
                    </div>
                    <div style={{ fontFamily: FONT.body, fontSize: 10, color: hoyFlag ? '#FF4757' : T.mut, marginTop: 1, fontWeight: hoyFlag ? 600 : 400 }}>
                      {fechaStr}{hoyFlag ? ' · HOY' : ''}
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
                        style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: hoyFlag ? 700 : 600, color: hoyFlag ? '#FF4757' : T.pri, background: isDark ? '#3a4058' : '#fff', border: `1px solid ${T.brd}`, borderRadius: 6, padding: '3px 6px', width: 80, textAlign: 'right' }}
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
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px 100px 100px', gap: 8, padding: '6px 0 10px', borderBottom: `0.5px solid ${T.brd}`, fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut }}>
          <span>Período</span>
          <span>Cumplido · Pendiente</span>
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
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px 100px 100px', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: idx < historico.length - 1 ? `0.5px solid ${T.brd}` : 'none' }}>
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{h.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 8, background: T.brd, borderRadius: 4, display: 'flex', overflow: 'hidden' }}>
                  <div style={{ height: 8, background: sc, width: `${pctCap}%` }} />
                  <div style={{ height: 8, background: INCUMPLIDO, width: `${100 - pctCap}%` }} />
                </div>
                <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 600, color: sc, minWidth: 40, textAlign: 'right' }}>{pct}%</span>
              </div>
              <span style={{ fontFamily: FONT.body, fontSize: 13, fontWeight: 500, color: T.pri, textAlign: 'right' }}>{fmtEur(h.real)}</span>
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, textAlign: 'right' }}>{fmtEur(h.objetivo)}</span>
              <span style={{ fontFamily: FONT.body, fontSize: 13, fontWeight: 500, color: desvColor, textAlign: 'right' }}>{desvStr}</span>
            </div>
          )
        })}
      </div>

    </div>
  )
}
