import { useState, useEffect, useMemo, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import {
  useTheme,
  cardStyle,
  semaforoColor,
  FONT,
} from '@/styles/tokens'

// ─── TIPOS ───────────────────────────────────────────────────

interface ObjetivoGeneral {
  id: string
  tipo: 'diario' | 'semanal' | 'mensual' | 'anual'
  importe: number
  updated_at: string
}

interface ObjetivoEspecifico {
  id: string
  nombre: string
  tipo: 'semanal' | 'mensual'
  fecha_desde: string
  fecha_hasta: string
  importe: number
  activo: boolean
}

interface VentaHistorico {
  label: string
  real: number
  objetivo: number
}

// ─── CONSTANTES ──────────────────────────────────────────────

const TIPO_ORDER: ObjetivoGeneral['tipo'][] = ['diario', 'semanal', 'mensual', 'anual']

const TIPO_LABEL: Record<string, string> = {
  diario: 'Diario', semanal: 'Semanal', mensual: 'Mensual', anual: 'Anual',
}

const TIPO_DESC: Record<string, string> = {
  diario:  'Ventas por día natural',
  semanal: 'Lunes a domingo',
  mensual: 'Mes natural completo',
  anual:   'Año natural 2026',
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────

export default function Objetivos() {
  const { T, isDark } = useTheme()

  // Estado generales
  const [generales, setGenerales] = useState<ObjetivoGeneral[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  // Estado específicos
  const [especificos, setEspecificos] = useState<ObjetivoEspecifico[]>([])
  const [showNuevo, setShowNuevo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState<'semanal' | 'mensual'>('semanal')
  const [nuevoDesde, setNuevoDesde] = useState('')
  const [nuevoHasta, setNuevoHasta] = useState('')
  const [nuevoImporte, setNuevoImporte] = useState('')
  const [savingNuevo, setSavingNuevo] = useState(false)

  // Histórico
  const [histTipo, setHistTipo] = useState<'semanas' | 'meses'>('semanas')
  const [ventas, setVentas] = useState<{ fecha: string; total_bruto: number }[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [g, e, v] = await Promise.all([
        supabase.from('objetivos').select('*').order('tipo'),
        supabase.from('objetivos_especificos').select('*').eq('activo', true).order('fecha_desde', { ascending: false }),
        supabase.from('facturacion_diario').select('fecha,total_bruto').order('fecha', { ascending: false }).limit(365),
      ])
      if (g.error) throw g.error
      if (e.error) throw e.error
      setGenerales((g.data as ObjetivoGeneral[]) ?? [])
      setEspecificos((e.data as ObjetivoEspecifico[]) ?? [])
      setVentas((v.data as { fecha: string; total_bruto: number }[]) ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }

  // ─── GENERALES: edición ──────────────────────────────────

  function startEdit(o: ObjetivoGeneral) {
    setEditingId(o.id)
    setEditValue(o.importe.toString())
  }

  function cancelEdit() { setEditingId(null); setEditValue('') }

  async function saveEdit(id: string) {
    const val = parseFloat(editValue.replace(',', '.'))
    if (isNaN(val) || val < 0) return
    setSaving(true)
    const { error: e } = await supabase
      .from('objetivos')
      .update({ importe: val, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!e) {
      setGenerales(prev => prev.map(o => o.id === id ? { ...o, importe: val } : o))
      setSavedId(id)
      setTimeout(() => setSavedId(null), 2000)
    }
    setSaving(false)
    setEditingId(null)
  }

  // ─── ESPECÍFICOS: crear ───────────────────────────────────

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
      loadAll()
    }
    setSavingNuevo(false)
  }

  async function eliminarEspecifico(id: string) {
    await supabase.from('objetivos_especificos').update({ activo: false }).eq('id', id)
    setEspecificos(prev => prev.filter(e => e.id !== id))
  }

  // ─── CUMPLIMIENTO ACTUAL ──────────────────────────────────

  const hoy = new Date().toISOString().slice(0, 10)
  const currentMonth = hoy.slice(0, 7)
  const currentYear = hoy.slice(0, 4)

  function startOfWeek(): string {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const mon = new Date(now)
    mon.setDate(now.getDate() + diff)
    mon.setHours(0, 0, 0, 0)
    return mon.toISOString().slice(0, 10)
  }

  const weekStart = startOfWeek()
  const weekEnd = (() => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + 6)
    return d.toISOString().slice(0, 10)
  })()

  const objMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const o of generales) m[o.tipo] = o.importe
    return m
  }, [generales])

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
    { label: `Semanal — S${getWeekNum(hoy)}`, real: ventasSemana, obj: objMap.semanal ?? 5000 },
    { label: `Mensual — ${new Date().toLocaleDateString('es-ES', { month: 'long' })}`, real: ventasMes, obj: objMap.mensual ?? 20000 },
    { label: `Anual — ${currentYear}`, real: ventasAno, obj: objMap.anual ?? 240000 },
  ]

  // ─── HISTÓRICO ────────────────────────────────────────────

  const historico = useMemo((): VentaHistorico[] => {
    if (histTipo === 'semanas') {
      const map = new Map<string, number>()
      for (const r of ventas) {
        const { year, week } = isoWeek(r.fecha)
        const key = `${year}-${String(week).padStart(2, '0')}`
        map.set(key, (map.get(key) || 0) + (r.total_bruto || 0))
      }
      return [...map.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(1, 13)
        .map(([key, real]) => ({
          label: `S${parseInt(key.split('-')[1])}`,
          real,
          objetivo: objMap.semanal ?? 5000,
        }))
    } else {
      const map = new Map<string, number>()
      for (const r of ventas) {
        const m = r.fecha.slice(0, 7)
        map.set(m, (map.get(m) || 0) + (r.total_bruto || 0))
      }
      return [...map.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(1, 7)
        .map(([key, real]) => {
          const [year, month] = key.split('-')
          const label = new Date(parseInt(year), parseInt(month) - 1, 1)
            .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
          return { label, real, objetivo: objMap.mensual ?? 20000 }
        })
    }
  }, [ventas, histTipo, objMap])

  // ─── HELPERS ──────────────────────────────────────────────

  function isoWeek(dateStr: string): { year: number; week: number } {
    const d = new Date(dateStr + 'T12:00:00')
    const day = d.getDay() || 7
    d.setDate(d.getDate() + 4 - day)
    const y = d.getFullYear()
    const jan1 = new Date(y, 0, 1)
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
    return { year: y, week }
  }

  function getWeekNum(dateStr: string): number {
    return isoWeek(dateStr).week
  }

  // ─── ESTILOS ──────────────────────────────────────────────

  const inputStyle: CSSProperties = {
    background: isDark ? '#3a4058' : '#ffffff',
    border: `1px solid ${isDark ? '#4a5270' : '#cccccc'}`,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 13,
    borderRadius: 8,
    padding: '6px 10px',
  }

  const btnEditar: CSSProperties = {
    padding: '5px 12px', borderRadius: 7,
    border: `0.5px solid ${T.brd}`,
    background: 'none', color: T.sec,
    fontFamily: FONT.body, fontSize: 12, cursor: 'pointer',
  }

  const btnGuardar: CSSProperties = {
    padding: '5px 14px', borderRadius: 7,
    border: 'none', background: '#B01D23',
    color: '#ffffff', fontFamily: FONT.body,
    fontSize: 12, cursor: 'pointer',
  }

  const btnCancelar: CSSProperties = {
    padding: '5px 12px', borderRadius: 7,
    border: `0.5px solid ${T.brd}`,
    background: 'none', color: T.sec,
    fontFamily: FONT.body, fontSize: 12, cursor: 'pointer',
  }

  const btnAdd: CSSProperties = {
    padding: '6px 14px', borderRadius: 8,
    border: 'none', background: '#e8f442',
    color: '#1a1a00', fontFamily: FONT.body,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  }

  const sectionLabel: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10,
    letterSpacing: '2px', textTransform: 'uppercase' as const,
    color: T.mut, margin: '20px 0 10px',
  }

  // ─── RENDER ───────────────────────────────────────────────

  if (loading) return <div style={{ padding: 32, color: T.sec, fontFamily: FONT.body }}>Cargando…</div>
  if (error) return <div style={{ padding: 32, color: '#E24B4A', fontFamily: FONT.body }}>{error}</div>

  const sorted = TIPO_ORDER.map(t => generales.find(o => o.tipo === t)).filter(Boolean) as ObjetivoGeneral[]

  return (
    <div style={{ maxWidth: 900 }}>

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', textTransform: 'uppercase', color: T.emphasis, margin: 0 }}>
            Objetivos
          </h1>
          <p style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, marginTop: 6 }}>
            Generales y específicos por período. El Dashboard los usa para calcular cumplimiento.
          </p>
        </div>
        <button style={btnAdd} onClick={() => setShowNuevo(p => !p)}>
          {showNuevo ? '✕ Cancelar' : '+ Nuevo objetivo específico'}
        </button>
      </div>

      {/* Formulario nuevo objetivo específico */}
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

      {/* Objetivos generales */}
      <div style={sectionLabel}>Objetivos generales</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 24 }}>
        {sorted.map(o => {
          const isEditing = editingId === o.id
          const isSaved = savedId === o.id
          const lastUpdate = new Date(o.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
          return (
            <div key={o.id} style={cardStyle(T)}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 4 }}>
                {TIPO_LABEL[o.tipo]}
              </div>
              {!isEditing ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: T.pri }}>
                      {fmtEur(o.importe)}
                    </div>
                    <button onClick={() => startEdit(o)} style={btnEditar}>Editar</button>
                  </div>
                  {isSaved && <div style={{ fontFamily: FONT.body, fontSize: 11, color: '#1D9E75', marginTop: 4 }}>✓ Guardado</div>}
                </>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                    <input
                      type="number"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(o.id); if (e.key === 'Escape') cancelEdit() }}
                      autoFocus
                      style={{ ...inputStyle, width: '100%', textAlign: 'right', fontSize: 16, fontWeight: 600 }}
                    />
                    <span style={{ fontFamily: FONT.heading, fontSize: 16, color: T.sec }}>€</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => saveEdit(o.id)} disabled={saving} style={{ ...btnGuardar, flex: 1 }}>
                      {saving ? '…' : 'Guardar'}
                    </button>
                    <button onClick={cancelEdit} style={btnCancelar}>Cancelar</button>
                  </div>
                </div>
              )}
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 8 }}>
                {TIPO_DESC[o.tipo]} · Actualizado {lastUpdate}
              </div>
            </div>
          )
        })}
      </div>

      {/* Cumplimiento actual */}
      <div style={sectionLabel}>Cumplimiento actual</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 24 }}>
        {cumplimiento.map(c => {
          const pct = c.obj > 0 ? Math.round((c.real / c.obj) * 100) : 0
          const sc = semaforoColor(pct)
          const falta = Math.max(0, c.obj - c.real)
          return (
            <div key={c.label} style={cardStyle(T)}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>
                {c.label}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 20, fontWeight: 600, color: T.pri }}>{fmtEur(c.real)}</span>
                <span style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: sc }}>{pct}%</span>
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: sc, marginBottom: 6 }}>
                Faltan {fmtEur(falta)} de {fmtEur(c.obj)}
              </div>
              <div style={{ height: 5, background: T.brd, borderRadius: 3 }}>
                <div style={{ height: 5, borderRadius: 3, background: sc, width: `${Math.min(pct, 100)}%`, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Objetivos específicos activos */}
      {especificos.length > 0 && (
        <>
          <div style={sectionLabel}>Objetivos específicos activos</div>
          <div style={{ ...cardStyle(T), marginBottom: 24 }}>
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
                  }}>
                    {e.tipo}
                  </span>
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

      {/* Histórico */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={sectionLabel}>Histórico de cumplimiento</div>
        <select
          value={histTipo}
          onChange={e => setHistTipo(e.target.value as 'semanas' | 'meses')}
          style={{
            ...inputStyle,
            padding: '4px 10px',
            fontSize: 12,
          }}
        >
          <option value="semanas">Por semanas</option>
          <option value="meses">Por meses</option>
        </select>
      </div>

      <div style={cardStyle(T)}>
        {/* Header tabla */}
        <div style={{
          display: 'grid', gridTemplateColumns: '140px 1fr 90px 90px 90px',
          gap: 8, padding: '6px 0 10px',
          borderBottom: `0.5px solid ${T.brd}`,
          fontFamily: FONT.heading, fontSize: 9,
          letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut,
        }}>
          <span>Período</span>
          <span>Progreso</span>
          <span style={{ textAlign: 'right' }}>Real</span>
          <span style={{ textAlign: 'right' }}>Objetivo</span>
          <span style={{ textAlign: 'right' }}>Desviación</span>
        </div>

        {historico.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: FONT.body, fontSize: 13, color: T.mut }}>
            Sin datos históricos
          </div>
        )}

        {historico.map((h, idx) => {
          const pct = h.objetivo > 0 ? Math.round((h.real / h.objetivo) * 100) : 0
          const sc = semaforoColor(pct)
          const desv = h.real - h.objetivo
          const desvColor = desv >= 0 ? '#1D9E75' : '#E24B4A'
          const desvStr = (desv >= 0 ? '+' : '') + fmtEur(desv)
          return (
            <div key={idx} style={{
              display: 'grid', gridTemplateColumns: '140px 1fr 90px 90px 90px',
              gap: 8, alignItems: 'center',
              padding: '10px 0',
              borderBottom: idx < historico.length - 1 ? `0.5px solid ${T.brd}` : 'none',
            }}>
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

      <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 16 }}>
        El histórico excluye la semana/mes actual. Los cambios en objetivos se reflejan inmediatamente en el Dashboard.
      </div>

    </div>
  )
}
