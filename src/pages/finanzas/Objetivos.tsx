import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useTheme, cardStyle, semaforoColor, FONT, pageTitleStyle } from '@/styles/tokens'

interface ObjetivoGeneral { tipo: string; importe: number; id: string }
interface ObjetivoDia { dia: number; importe: number; id: string }
interface ObjetivoEspecifico {
  id: string
  nombre: string
  tipo: 'semanal' | 'mensual'
  fecha_desde: string
  fecha_hasta: string
  importe: number
  activo: boolean
}
interface VentaHistorico { label: string; real: number; objetivo: number }

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
  ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'][dia - 1]

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

  const [especificos, setEspecificos] = useState<ObjetivoEspecifico[]>([])
  const [showNuevo, setShowNuevo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState<'semanal' | 'mensual'>('semanal')
  const [nuevoDesde, setNuevoDesde] = useState('')
  const [nuevoHasta, setNuevoHasta] = useState('')
  const [nuevoImporte, setNuevoImporte] = useState('')
  const [savingNuevo, setSavingNuevo] = useState(false)

  const [histTipo, setHistTipo] = useState<'semanas' | 'meses' | 'anual'>('semanas')
  const [histAnio, setHistAnio] = useState<number>(new Date().getFullYear())
  const [ventas, setVentas] = useState<{ fecha: string; total_bruto: number }[]>([])

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('objetivos').select('*'),
      supabase.from('objetivos_dia_semana').select('*').order('dia'),
      supabase.from('objetivos_especificos').select('*').eq('activo', true).order('fecha_desde', { ascending: false }),
      supabase.from('facturacion_diario').select('fecha,total_bruto').order('fecha', { ascending: false }).limit(365),
    ]).then(([g, d, e, v]) => {
      if (g.data) setObjetivos(g.data.map((r: any) => ({ tipo: r.tipo, importe: Number(r.importe), id: r.id })))
      if (d.data) setDiasSemana(d.data.map((r: any) => ({ dia: r.dia, importe: Number(r.importe), id: r.id })))
      if (e.data) setEspecificos(e.data as ObjetivoEspecifico[])
      if (v.data) setVentas(v.data.map((r: any) => ({ fecha: r.fecha, total_bruto: Number(r.total_bruto) || 0 })))
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  const guardarObjetivo = async (id: string, tabla: 'objetivos' | 'objetivos_dia_semana') => {
    const val = parseFloat(editValue)
    if (isNaN(val)) return
    await supabase.from(tabla).update({ importe: val }).eq('id', id)
    if (tabla === 'objetivos') {
      setObjetivos(prev => prev.map(o => o.id === id ? { ...o, importe: val } : o))
    } else {
      setDiasSemana(prev => prev.map(o => o.id === id ? { ...o, importe: val } : o))
    }
    setEditingId(null)
  }

  async function saveNuevo() {
    const imp = parseFloat(nuevoImporte.replace(',', '.'))
    if (!nuevoNombre || !nuevoDesde || !nuevoHasta || isNaN(imp)) return
    setSavingNuevo(true)
    const { error: e } = await supabase.from('objetivos_especificos').insert({
      nombre: nuevoNombre, tipo: nuevoTipo,
      fecha_desde: nuevoDesde, fecha_hasta: nuevoHasta,
      importe: imp, activo: true,
    })
    if (!e) {
      setShowNuevo(false)
      setNuevoNombre(''); setNuevoDesde(''); setNuevoHasta(''); setNuevoImporte('')
      const { data } = await supabase.from('objetivos_especificos').select('*').eq('activo', true).order('fecha_desde', { ascending: false })
      if (data) setEspecificos(data as ObjetivoEspecifico[])
    }
    setSavingNuevo(false)
  }

  async function eliminarEspecifico(id: string) {
    await supabase.from('objetivos_especificos').update({ activo: false }).eq('id', id)
    setEspecificos(prev => prev.filter(e => e.id !== id))
  }

  const hoyStr = new Date().toISOString().slice(0, 10)
  const currentMonth = hoyStr.slice(0, 7)
  const currentYear = hoyStr.slice(0, 4)

  const weekStart = (() => {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const mon = new Date(now)
    mon.setDate(now.getDate() + diff)
    mon.setHours(0, 0, 0, 0)
    return mon.toISOString().slice(0, 10)
  })()

  const weekEnd = (() => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + 6)
    return d.toISOString().slice(0, 10)
  })()

  const objMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const o of objetivos) m[o.tipo] = o.importe
    return m
  }, [objetivos])

  const ventasSemana = useMemo(() =>
    ventas.filter(r => r.fecha >= weekStart && r.fecha <= weekEnd).reduce((a, r) => a + (r.total_bruto || 0), 0),
    [ventas, weekStart, weekEnd])

  const ventasMes = useMemo(() =>
    ventas.filter(r => r.fecha.startsWith(currentMonth)).reduce((a, r) => a + (r.total_bruto || 0), 0),
    [ventas, currentMonth])

  const ventasAno = useMemo(() =>
    ventas.filter(r => r.fecha.startsWith(currentYear)).reduce((a, r) => a + (r.total_bruto || 0), 0),
    [ventas, currentYear])

  const cumplimiento = [
    { label: `S${weekNum}`, real: ventasSemana, obj: objMap.semanal ?? 5000 },
    { label: hoy.toLocaleDateString('es-ES', { month: 'long' }), real: ventasMes, obj: objMap.mensual ?? 20000 },
    { label: `${hoy.getFullYear()}`, real: ventasAno, obj: objMap.anual ?? 240000 },
  ]

  const aniosDisponibles = useMemo(() => {
    const set = new Set(ventas.map(r => parseInt(r.fecha.slice(0, 4))))
    const arr = [...set].filter(y => !isNaN(y)).sort((a, b) => b - a)
    if (arr.length === 0) arr.push(new Date().getFullYear())
    return arr
  }, [ventas])

  const mondayStr = monday.toISOString().slice(0, 10)
  const sundayStr = sunday.toISOString().slice(0, 10)

  const historico = useMemo((): VentaHistorico[] => {
    const esAnioActual = histAnio === new Date().getFullYear()
    const ventasFiltAnio = ventas.filter(r => r.fecha.startsWith(String(histAnio)))
    if (histTipo === 'semanas') {
      const base = esAnioActual
        ? ventasFiltAnio.filter(r => r.fecha < mondayStr || r.fecha > sundayStr)
        : ventasFiltAnio
      const map = new Map<string, number>()
      for (const r of base) {
        const { year, week } = isoWeek(r.fecha)
        const key = `${year}-${String(week).padStart(2, '0')}`
        map.set(key, (map.get(key) || 0) + (r.total_bruto || 0))
      }
      return [...map.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 6)
        .map(([key, real]) => ({ label: `S${parseInt(key.split('-')[1])}`, real, objetivo: objMap.semanal ?? 5000 }))
    } else if (histTipo === 'anual') {
      const totalAnio = ventasFiltAnio.reduce((a, r) => a + (r.total_bruto || 0), 0)
      return [{ label: String(histAnio), real: totalAnio, objetivo: objMap.anual ?? 240000 }]
    } else {
      const currentMonthStr = hoy.toISOString().slice(0, 7)
      const base = esAnioActual
        ? ventasFiltAnio.filter(r => !r.fecha.startsWith(currentMonthStr))
        : ventasFiltAnio
      const map = new Map<string, number>()
      for (const r of base) {
        const m = r.fecha.slice(0, 7)
        map.set(m, (map.get(m) || 0) + (r.total_bruto || 0))
      }
      return [...map.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 6)
        .map(([key, real]) => {
          const [year, month] = key.split('-')
          const label = new Date(parseInt(year), parseInt(month) - 1, 1)
            .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
          return { label, real, objetivo: objMap.mensual ?? 20000 }
        })
    }
  }, [ventas, histTipo, histAnio, objMap, mondayStr, sundayStr])

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
    color: T.mut, margin: '24px 0 0',
  }

  const btnAdd = {
    padding: '6px 14px', borderRadius: 8, border: 'none',
    background: '#e8f442', color: '#1a1a00',
    fontFamily: FONT.body, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  }

  const btnCancelar = {
    padding: '5px 12px', borderRadius: 7, border: `0.5px solid ${T.brd}`,
    background: 'none', color: T.sec, fontFamily: FONT.body, fontSize: 12, cursor: 'pointer',
  }

  const btnGuardar = {
    padding: '5px 14px', borderRadius: 7, border: 'none',
    background: '#B01D23', color: '#ffffff', fontFamily: FONT.body, fontSize: 12, cursor: 'pointer',
  }

  if (loading) return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px', width: '100%', color: T.sec, fontFamily: FONT.body }}>
      Cargando…
    </div>
  )

  const tiposGenerales = [
    { tipo: 'diario', label: hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) },
    { tipo: 'semanal', label: `S${weekNum} · ${fmtShort(monday)} – ${fmtShort(sunday)}` },
    { tipo: 'mensual', label: hoy.toLocaleDateString('es-ES', { month: 'long' }).charAt(0).toUpperCase() + hoy.toLocaleDateString('es-ES', { month: 'long' }).slice(1) },
    { tipo: 'anual', label: String(hoy.getFullYear()) },
  ]

  return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px', width: '100%' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={pageTitleStyle(T)}>Objetivos</h1>
          <p style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, marginTop: 6 }}>
            Generales y específicos por período. El Dashboard los usa para calcular cumplimiento.
          </p>
        </div>
        <button style={btnAdd} onClick={() => setShowNuevo(p => !p)}>
          {showNuevo ? '✕ Cancelar' : '+ Nuevo objetivo específico'}
        </button>
      </div>

      {showNuevo && (
        <div style={{ ...cardStyle(T), border: `1px solid ${T.emphasis}`, marginBottom: 16 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: T.pri, marginBottom: 14 }}>
            Nuevo objetivo específico
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>Nombre</div>
              <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Ej. Semana Santa" style={{ ...inputStyle, width: 160 }} />
            </div>
            <div>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>Tipo</div>
              <select value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value as 'semanal' | 'mensual')} style={{ ...inputStyle }}>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
            <div>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>Desde</div>
              <input type="date" value={nuevoDesde} onChange={e => setNuevoDesde(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>Hasta</div>
              <input type="date" value={nuevoHasta} onChange={e => setNuevoHasta(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>Importe (€)</div>
              <input type="number" value={nuevoImporte} onChange={e => setNuevoImporte(e.target.value)} placeholder="0" style={{ ...inputStyle, width: 120, textAlign: 'right' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveNuevo} disabled={savingNuevo} style={btnGuardar}>{savingNuevo ? 'Guardando…' : 'Guardar'}</button>
              <button onClick={() => setShowNuevo(false)} style={btnCancelar}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div style={sectionLabel}>Objetivos generales</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, width: '100%', marginTop: 12 }}>
        {tiposGenerales.map(({ tipo, label }) => {
          const obj = objetivos.find(o => o.tipo === tipo)
          return (
            <div key={tipo} style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginBottom: 4 }}>{label}</div>
              {obj && editingId === obj.id ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    style={{ fontFamily: FONT.body, fontSize: 20, fontWeight: 700, color: T.pri, background: isDark ? '#3a4058' : '#fff', border: `1px solid ${T.brd}`, borderRadius: 8, padding: '4px 8px', width: '100%' }}
                    autoFocus
                  />
                  <button onClick={() => guardarObjetivo(obj.id, 'objetivos')} style={{ background: '#B01D23', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontFamily: FONT.heading, fontSize: 11, cursor: 'pointer' }}>OK</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: FONT.body, fontSize: 22, fontWeight: 700, color: T.pri }}>
                    {obj ? `${obj.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '— €'}
                  </div>
                  {obj && (
                    <button onClick={() => { setEditingId(obj.id); setEditValue(String(obj.importe)) }} style={{ background: 'none', border: `0.5px solid ${T.brd}`, borderRadius: 8, padding: '4px 12px', fontFamily: FONT.heading, fontSize: 11, color: T.sec, cursor: 'pointer' }}>Editar</button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ ...sectionLabel, marginTop: 28 }}>Objetivos por día de semana</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, width: '100%', marginTop: 12 }}>
        {[1,2,3,4,5,6,7].map(dia => {
          const diaData = diasSemana.find(d => d.dia === dia)
          const importe = diaData?.importe ?? 0
          const id = diaData?.id ?? `empty-${dia}`
          const finde = esFinde(dia)
          const festivo = esFestivo(dia)
          const bgColor = festivo ? '#f5a62318' : finde ? '#1D9E7518' : T.card
          const borderColor = festivo ? '#f5a623' : finde ? '#1D9E75' : T.brd
          const labelColor = festivo ? '#f5a623' : finde ? '#1D9E75' : T.mut
          return (
            <div key={dia} style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 12, padding: '14px 12px' }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', color: labelColor, textTransform: 'uppercase' }}>{getNombreDia(dia)}</div>
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 8 }}>{getFechaDia(dia)}</div>
              {diaData && editingId === id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    type="number"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    style={{ fontFamily: FONT.body, fontSize: 16, fontWeight: 700, color: T.pri, background: isDark ? '#3a4058' : '#fff', border: `1px solid ${T.brd}`, borderRadius: 8, padding: '4px 6px', width: '100%' }}
                    autoFocus
                  />
                  <button onClick={() => guardarObjetivo(id, 'objetivos_dia_semana')} style={{ background: '#B01D23', color: '#fff', border: 'none', borderRadius: 8, padding: '4px', fontFamily: FONT.heading, fontSize: 10, cursor: 'pointer' }}>OK</button>
                </div>
              ) : (
                <>
                  <div style={{ fontFamily: FONT.body, fontSize: 16, fontWeight: 700, color: T.pri, marginBottom: 8 }}>{importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
                  {diaData && (
                    <button onClick={() => { setEditingId(id); setEditValue(String(importe)) }} style={{ background: 'none', border: `0.5px solid ${borderColor}`, borderRadius: 8, padding: '3px 10px', fontFamily: FONT.heading, fontSize: 10, color: labelColor, cursor: 'pointer', width: '100%' }}>Editar</button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ ...sectionLabel, marginTop: 28 }}>Cumplimiento actual</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 12, marginBottom: 24 }}>
        {cumplimiento.map(c => {
          const pct = c.obj > 0 ? Math.round((c.real / c.obj) * 100) : 0
          const sc = semaforoColor(pct)
          const falta = Math.max(0, c.obj - c.real)
          return (
            <div key={c.label} style={cardStyle(T)}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>{c.label}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 20, fontWeight: 600, color: T.pri }}>{fmtEur(c.real)}</span>
                <span style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: sc }}>{pct}%</span>
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: sc, marginBottom: 6 }}>Faltan {fmtEur(falta)} de {fmtEur(c.obj)}</div>
              <div style={{ height: 5, background: T.brd, borderRadius: 3 }}>
                <div style={{ height: 5, borderRadius: 3, background: sc, width: `${Math.min(pct, 100)}%`, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )
        })}
      </div>

      {especificos.length > 0 && (
        <>
          <div style={sectionLabel}>Objetivos específicos activos</div>
          <div style={{ ...cardStyle(T), marginBottom: 24, marginTop: 12 }}>
            {especificos.map((e, idx) => (
              <div key={e.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderBottom: idx < especificos.length - 1 ? `0.5px solid ${T.brd}` : 'none',
                flexWrap: 'wrap', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: FONT.body, fontSize: 14, fontWeight: 500, color: T.pri }}>{e.nombre}</span>
                  <span style={{
                    fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: 99,
                    background: e.tipo === 'semanal' ? (isDark ? '#0a2e1a' : '#e1f5ee') : (isDark ? '#2a1500' : '#fff3e0'),
                    color: e.tipo === 'semanal' ? '#1D9E75' : '#f5a623',
                  }}>{e.tipo}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>
                    {new Date(e.fecha_desde).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – {new Date(e.fecha_hasta).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: T.pri }}>{fmtEur(e.importe)}</span>
                  <button onClick={() => eliminarEspecifico(e.id)} style={{ ...btnCancelar, fontSize: 11, padding: '3px 10px' }}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={sectionLabel}>Histórico de cumplimiento</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={histTipo} onChange={e => setHistTipo(e.target.value as 'semanas' | 'meses' | 'anual')} style={{ ...inputStyle, padding: '4px 10px', fontSize: 12 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 90px 90px 90px', gap: 8, padding: '6px 0 10px', borderBottom: `0.5px solid ${T.brd}`, fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut }}>
          <span>Período</span><span>Progreso</span>
          <span style={{ textAlign: 'right' }}>Real</span>
          <span style={{ textAlign: 'right' }}>Objetivo</span>
          <span style={{ textAlign: 'right' }}>Desviación</span>
        </div>
        {historico.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: FONT.body, fontSize: 13, color: T.mut }}>Sin datos históricos</div>
        )}
        {historico.map((h, idx) => {
          const pct = h.objetivo > 0 ? Math.round((h.real / h.objetivo) * 100) : 0
          const sc = semaforoColor(pct)
          const desv = h.real - h.objetivo
          const desvColor = desv >= 0 ? '#1D9E75' : '#E24B4A'
          const desvStr = (desv >= 0 ? '+' : '') + fmtEur(desv)
          return (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 90px 90px 90px', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: idx < historico.length - 1 ? `0.5px solid ${T.brd}` : 'none' }}>
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{h.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 5, background: T.brd, borderRadius: 3 }}>
                  <div style={{ height: 5, borderRadius: 3, background: sc, width: `${Math.min(pct, 100)}%` }} />
                </div>
                <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 600, color: sc, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
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
