import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useTheme, cardStyle, semaforoColor, FONT, pageTitleStyle } from '@/styles/tokens'

interface ObjetivoGeneral { tipo: string; importe: number; id: string }
interface ObjetivoDia { dia: number; importe: number; id: string }

const hoy = new Date()
const lunes = new Date(hoy)
lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))

const monday = new Date(hoy)
const dayOfWeek = hoy.getDay()
const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
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

const getNombreDia = (dia: number) =>
  ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'][dia - 1]

const getFechaDia = (dia: number) => {
  const d = new Date(lunes)
  d.setDate(lunes.getDate() + dia - 1)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const esFinde = (dia: number) => dia >= 5

const FESTIVOS_2026 = [
  '2026-01-01', '2026-01-06', '2026-03-19', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-02', '2026-05-15', '2026-07-25', '2026-08-15',
  '2026-10-12', '2026-11-01', '2026-11-09', '2026-12-08', '2026-12-25',
]

const esFestivo = (dia: number) => {
  const d = new Date(lunes)
  d.setDate(lunes.getDate() + dia - 1)
  return FESTIVOS_2026.includes(d.toISOString().split('T')[0])
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

  const guardarDiaSemana = async (id: string, val: number) => {
    await supabase.from('objetivos_dia_semana').update({ importe: val }).eq('id', id)
    setDiasSemana(prev => prev.map(o => o.id === id ? { ...o, importe: val } : o))
    setEditingId(null)
  }

  const guardarObjetivo = async (id: string, val: number) => {
    await supabase.from('objetivos').update({ importe: val }).eq('id', id)
    setObjetivos(prev => prev.map(o => o.id === id ? { ...o, importe: val } : o))
    setEditingId(null)
  }

  const handleGuardar = (id: string, tipo: 'dia' | 'objetivo') => {
    const v = parseFloat(editValue.replace(',', '.'))
    if (isNaN(v)) { setEditingId(null); return }
    if (tipo === 'dia') guardarDiaSemana(id, v)
    else guardarObjetivo(id, v)
  }

  // Objetivo semanal = override de tabla objetivos.tipo='semanal' o suma días
  const objSemanalObj = objetivos.find(o => o.tipo === 'semanal')
  const objMensualObj = objetivos.find(o => o.tipo === 'mensual')
  const objAnualObj = objetivos.find(o => o.tipo === 'anual')

  const sumaSemana = useMemo(() => diasSemana.reduce((a, d) => a + d.importe, 0), [diasSemana])
  const objSemanal = objSemanalObj?.importe ?? sumaSemana

  const sumaMes = useMemo(() => {
    const ano = hoy.getFullYear()
    const mes = hoy.getMonth()
    const diasEnMes = new Date(ano, mes + 1, 0).getDate()
    let total = 0
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = new Date(ano, mes, d)
      const diaSemana = fecha.getDay() === 0 ? 7 : fecha.getDay()
      const obj = diasSemana.find(ds => ds.dia === diaSemana)
      total += obj?.importe || 0
    }
    return total
  }, [diasSemana])
  const objMensual = objMensualObj?.importe ?? sumaMes

  const sumaAno = useMemo(() => {
    const ano = hoy.getFullYear()
    const esBisiesto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
    const diasAno = esBisiesto ? 366 : 365
    let total = 0
    const inicioAno = new Date(ano, 0, 1)
    for (let i = 0; i < diasAno; i++) {
      const f = new Date(inicioAno)
      f.setDate(inicioAno.getDate() + i)
      const diaSemana = f.getDay() === 0 ? 7 : f.getDay()
      const obj = diasSemana.find(ds => ds.dia === diaSemana)
      total += obj?.importe || 0
    }
    return total
  }, [diasSemana])
  const objAnual = objAnualObj?.importe ?? sumaAno

  const hoyStr = hoy.toISOString().slice(0, 10)
  const diaSemanaHoy = hoy.getDay() === 0 ? 7 : hoy.getDay()
  const objHoy = diasSemana.find(d => d.dia === diaSemanaHoy)?.importe || 0

  const ventasHoy = useMemo(() => ventas.filter(r => r.fecha === hoyStr).reduce((a, r) => a + r.total_bruto, 0), [ventas, hoyStr])

  const weekStart = monday.toISOString().slice(0, 10)
  const weekEnd = sunday.toISOString().slice(0, 10)
  const ventasSemana = useMemo(() => ventas.filter(r => r.fecha >= weekStart && r.fecha <= weekEnd).reduce((a, r) => a + r.total_bruto, 0), [ventas, weekStart, weekEnd])

  const currentMonth = hoyStr.slice(0, 7)
  const ventasMes = useMemo(() => ventas.filter(r => r.fecha.startsWith(currentMonth)).reduce((a, r) => a + r.total_bruto, 0), [ventas, currentMonth])

  const currentYear = hoyStr.slice(0, 4)
  const ventasAno = useMemo(() => ventas.filter(r => r.fecha.startsWith(currentYear)).reduce((a, r) => a + r.total_bruto, 0), [ventas, currentYear])

  const cumplimiento = [
    { label: `HOY · ${hoy.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}`, real: ventasHoy, obj: objHoy },
    { label: `S${weekNum}`, real: ventasSemana, obj: objSemanal },
    { label: hoy.toLocaleDateString('es-ES', { month: 'long' }).toUpperCase(), real: ventasMes, obj: objMensual },
    { label: `${hoy.getFullYear()}`, real: ventasAno, obj: objAnual },
  ]

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
      return [...base]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 14)
        .map(r => {
          const d = new Date(r.fecha + 'T12:00:00')
          const diaSemana = d.getDay() === 0 ? 7 : d.getDay()
          const obj = diasSemana.find(ds => ds.dia === diaSemana)?.importe || 0
          return { label: d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }), real: r.total_bruto, objetivo: obj }
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
      return [...map.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 12)
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
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .map(([key, real]) => {
        const [year, month] = key.split('-')
        const label = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
        return { label, real, objetivo: objMensual }
      })
  }, [ventas, histTipo, histAnio, diasSemana, objSemanal, objMensual, objAnual, mondayStr, sundayStr, hoyStr])

  const inputStyle = {
    background: isDark ? '#3a4058' : '#ffffff',
    border: `1px solid ${isDark ? '#4a5270' : '#cccccc'}`,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 13,
    borderRadius: 8,
    padding: '6px 10px',
  }

  const sectionLabel: React.CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10,
    letterSpacing: '2px', textTransform: 'uppercase',
    color: T.mut, margin: '20px 0 10px',
  }

  if (loading) return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px', width: '100%', color: T.sec, fontFamily: FONT.body }}>
      Cargando…
    </div>
  )

  const renderGeneralCard = (label: string, importe: number, id: string, tipo: 'objetivo' | 'dia') => {
    const isEditing = editingId === id
    return (
      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>{label}</div>
        {isEditing ? (
          <input
            type="number"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => handleGuardar(id, tipo)}
            onKeyDown={e => { if (e.key === 'Enter') handleGuardar(id, tipo); if (e.key === 'Escape') setEditingId(null) }}
            autoFocus
            style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: T.pri, background: isDark ? '#3a4058' : '#fff', border: `1px solid ${T.brd}`, borderRadius: 6, padding: '3px 6px', width: '100%' }}
          />
        ) : (
          <div
            onClick={() => { setEditingId(id); setEditValue(String(importe)) }}
            style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: T.pri, cursor: 'pointer', lineHeight: 1.2 }}
          >
            {fmtEur(importe)}
          </div>
        )}
      </div>
    )
  }

  // Obtener IDs de objetivos para edición (crear si no existen)
  const getOrCreateObjId = (tipo: string): string => {
    const existing = objetivos.find(o => o.tipo === tipo)
    return existing?.id ?? `pending-${tipo}`
  }

  return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px', width: '100%' }}>

      <div style={{ marginBottom: 20 }}>
        <h1 style={pageTitleStyle(T)}>Objetivos</h1>
      </div>

      {/* Cards generales: SEMANAL · MENSUAL · ANUAL editables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {renderGeneralCard(`S${weekNum} · ${fmtShort(monday)} – ${fmtShort(sunday)}`, objSemanal, getOrCreateObjId('semanal'), 'objetivo')}
        {renderGeneralCard(hoy.toLocaleDateString('es-ES', { month: 'long' }).toUpperCase(), objMensual, getOrCreateObjId('mensual'), 'objetivo')}
        {renderGeneralCard(String(hoy.getFullYear()), objAnual, getOrCreateObjId('anual'), 'objetivo')}
      </div>

      {/* Días de semana */}
      <div style={sectionLabel}>Objetivos por día de semana</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {[1,2,3,4,5,6,7].map(dia => {
          const diaData = diasSemana.find(d => d.dia === dia)
          const importe = diaData?.importe ?? 0
          const id = diaData?.id ?? `empty-${dia}`
          const finde = esFinde(dia)
          const festivo = esFestivo(dia)
          const bgColor = festivo ? '#f5a62318' : finde ? '#1D9E7518' : T.card
          const borderColor = festivo ? '#f5a623' : finde ? '#1D9E75' : T.brd
          const labelColor = festivo ? '#f5a623' : finde ? '#1D9E75' : T.mut
          const isEditing = editingId === id
          return (
            <div key={dia} style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 10, padding: '10px 10px' }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', color: labelColor, textTransform: 'uppercase' }}>{getNombreDia(dia)}</div>
              <div style={{ fontFamily: FONT.body, fontSize: 10, color: T.mut, marginBottom: 6 }}>{getFechaDia(dia)}</div>
              {isEditing && diaData ? (
                <input
                  type="number"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => handleGuardar(id, 'dia')}
                  onKeyDown={e => { if (e.key === 'Enter') handleGuardar(id, 'dia'); if (e.key === 'Escape') setEditingId(null) }}
                  autoFocus
                  style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: T.pri, background: isDark ? '#3a4058' : '#fff', border: `1px solid ${T.brd}`, borderRadius: 6, padding: '3px 5px', width: '100%' }}
                />
              ) : (
                <div
                  onClick={() => { if (diaData) { setEditingId(id); setEditValue(String(importe)) } }}
                  style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: T.pri, cursor: diaData ? 'pointer' : 'default', lineHeight: 1.2 }}
                >
                  {fmtEur(importe)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Cumplimiento */}
      <div style={sectionLabel}>Cumplimiento actual</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 16 }}>
        {cumplimiento.map(c => {
          const pct = c.obj > 0 ? Math.round((c.real / c.obj) * 100) : 0
          const sc = semaforoColor(pct)
          const falta = Math.max(0, c.obj - c.real)
          return (
            <div key={c.label} style={cardStyle(T)}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>{c.label}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: T.pri }}>{fmtEur(c.real)}</span>
                <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: sc }}>{pct}%</span>
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: sc, marginBottom: 6 }}>Faltan {fmtEur(falta)} de {fmtEur(c.obj)}</div>
              <div style={{ height: 5, background: T.brd, borderRadius: 3 }}>
                <div style={{ height: 5, borderRadius: 3, background: sc, width: `${Math.min(pct, 100)}%`, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Histórico */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ ...sectionLabel, margin: 0 }}>Histórico de cumplimiento</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={histTipo} onChange={e => setHistTipo(e.target.value as any)} style={{ ...inputStyle, padding: '4px 10px', fontSize: 12 }}>
            <option value="dias">Por días</option>
            <option value="semanas">Por semanas</option>
            <option value="meses">Por meses</option>
            <option value="anual">Todo el año</option>
          </select>
          <select value={histAnio} onChange={e => setHistAnio(parseInt(e.target.value))} style={{ ...inputStyle, padding: '4px 10px', fontSize: 12 }}>
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
          const incumplidoColor = '#E24B4A'
          const desv = h.real - h.objetivo
          const desvColor = desv >= 0 ? '#1D9E75' : '#E24B4A'
          const desvStr = (desv >= 0 ? '+' : '') + fmtEur(desv)
          return (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px 100px 100px', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: idx < historico.length - 1 ? `0.5px solid ${T.brd}` : 'none' }}>
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{h.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 8, background: T.brd, borderRadius: 4, display: 'flex', overflow: 'hidden' }}>
                  <div style={{ height: 8, background: sc, width: `${pctCap}%` }} />
                  <div style={{ height: 8, background: incumplidoColor, width: `${100 - pctCap}%` }} />
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
