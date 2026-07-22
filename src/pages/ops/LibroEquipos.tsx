import { BLANCO, GRIS, INK, ROJO_S } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { COLORS, COLOR } from '@/components/panel/resumen/tokens'


const BG_OPS = INK
interface Equipo {
  id: string
  nombre: string
  tipo: string | null
  estado: string | null
  temp_min: number | null
  temp_max: number | null
  descripcion: string | null
  activo: boolean
  created_at: string
}

interface Mantenimiento {
  id: string
  equipo_id: string
  descripcion: string | null
  coste: number | null
  fecha: string
  created_at: string
}

const EMPTY_EQUIPO: Omit<Equipo, 'id' | 'created_at'> = {
  nombre: '', tipo: '', estado: 'activo', temp_min: null, temp_max: null, descripcion: '', activo: true,
}

function fmtFecha(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function fmtEurLocal(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function LibroEquipos() {
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editData, setEditData] = useState<typeof EMPTY_EQUIPO & { id?: string }>(EMPTY_EQUIPO)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data: eqs, error: e1 } = await supabase.from('equipos').select('*').order('nombre')
      if (e1) throw e1
      const { data: mants, error: e2 } = await supabase.from('mantenimientos_equipos').select('*').order('fecha', { ascending: false })
      if (e2) throw e2
      setEquipos((eqs ?? []) as Equipo[])
      setMantenimientos((mants ?? []) as Mantenimiento[])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('42P01') ? 'Tabla equipos no encontrada.' : `Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  async function saveEquipo() {
    setSaving(true)
    const payload = {
      nombre: editData.nombre, tipo: editData.tipo || null, estado: editData.estado || null,
      temp_min: editData.temp_min, temp_max: editData.temp_max,
      descripcion: editData.descripcion || null, activo: editData.activo,
    }
    if (editData.id) {
      await supabase.from('equipos').update(payload).eq('id', editData.id)
    } else {
      await supabase.from('equipos').insert(payload)
    }
    setShowForm(false)
    setEditData(EMPTY_EQUIPO)
    await loadData()
    setSaving(false)
  }

  async function toggleActivo(eq: Equipo) {
    await supabase.from('equipos').update({ activo: !eq.activo }).eq('id', eq.id)
    await loadData()
  }

  const selectedEquipo = equipos.find(e => e.id === selectedId)
  const eqMantenimientos = mantenimientos.filter(m => m.equipo_id === selectedId)
  const costAcum = eqMantenimientos.reduce((s, m) => s + (m.coste ?? 0), 0)

  return (
    <div style={{ fontFamily: FONT.body, padding: '28px', background: BG_OPS, minHeight: '100vh', color: BLANCO }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', color: COLORS.redSL, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>LIBRO EQUIPOS</h1>
          <span style={{ fontSize: 13, color: COLOR.textMut }}>Gestión y mantenimiento de equipos</span>
        </div>
        <button onClick={() => { setEditData(EMPTY_EQUIPO); setShowForm(true) }}
          style={{ padding: '8px 18px', background: COLORS.glovo, color: BG_OPS, border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Añadir equipo
        </button>
      </div>

      {error && <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', borderRadius: 8, padding: '14px 18px', color: ROJO_S, fontSize: 13, marginBottom: 20 }}>{error}</div>}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: INK, border: '1px solid #2a2a2a', borderRadius: 12, padding: '28px', width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontFamily: FONT.heading, fontSize: 16, letterSpacing: '2px', textTransform: 'uppercase', color: BLANCO, margin: '0 0 20px' }}>
              {editData.id ? 'EDITAR EQUIPO' : 'NUEVO EQUIPO'}
            </h2>
            {[
              { label: 'Nombre', key: 'nombre', type: 'text' },
              { label: 'Tipo', key: 'tipo', type: 'text' },
              { label: 'Estado', key: 'estado', type: 'text' },
              { label: 'Temp. mín. (°C)', key: 'temp_min', type: 'number' },
              { label: 'Temp. máx. (°C)', key: 'temp_max', type: 'number' },
              { label: 'Descripción', key: 'descripcion', type: 'text' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLOR.textMut, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type}
                  value={(editData as Record<string, unknown>)[f.key] as string ?? ''}
                  onChange={e => setEditData(p => ({ ...p, [f.key]: f.type === 'number' ? (e.target.value ? parseFloat(e.target.value) : null) : e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', background: INK, border: '1px solid #2a2a2a', borderRadius: 6, color: BLANCO, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setEditData(EMPTY_EQUIPO) }}
                style={{ padding: '8px 16px', background: INK, border: '1px solid #383838', color: GRIS, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={saveEquipo} disabled={saving}
                style={{ padding: '8px 18px', background: COLORS.redSL, color: BLANCO, border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: COLOR.textMut, fontSize: 13 }}>Cargando…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedId ? '1fr 1fr' : '1fr', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {equipos.map(eq => {
                const mants = mantenimientos.filter(m => m.equipo_id === eq.id)
                const coste = mants.reduce((s, m) => s + (m.coste ?? 0), 0)
                return (
                  <div key={eq.id} onClick={() => setSelectedId(eq.id === selectedId ? null : eq.id)}
                    style={{ background: selectedId === eq.id ? '#1a1f2e' : INK, border: `1px solid ${selectedId === eq.id ? COLORS.redSL : INK}`, borderRadius: 10, padding: '16px 18px', cursor: 'pointer', opacity: eq.activo ? 1 : 0.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div>
                        <div style={{ fontFamily: FONT.heading, fontSize: 15, letterSpacing: '1px', color: BLANCO, marginBottom: 4 }}>{eq.nombre}</div>
                        <div style={{ fontSize: 12, color: COLOR.textMut }}>
                          {eq.tipo && <span style={{ marginRight: 10 }}>{eq.tipo}</span>}
                          {eq.temp_min !== null && eq.temp_max !== null && <span>Rango: {eq.temp_min}°C – {eq.temp_max}°C</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ background: (eq.estado === 'activo' || eq.activo) ? '#1D9E7520' : '#B01D2320', color: (eq.estado === 'activo' || eq.activo) ? COLORS.ok : COLORS.redSL, border: `1px solid ${(eq.estado === 'activo' || eq.activo) ? COLORS.ok : COLORS.redSL}`, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontFamily: FONT.heading, letterSpacing: '1px' }}>
                          {eq.estado ?? (eq.activo ? 'ACTIVO' : 'INACTIVO')}
                        </span>
                        <button onClick={e => { e.stopPropagation(); setEditData({ ...eq }); setShowForm(true) }}
                          style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #383838', color: GRIS, borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                        <button onClick={e => { e.stopPropagation(); toggleActivo(eq) }}
                          style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${eq.activo ? COLORS.redSL : COLORS.ok}`, color: eq.activo ? COLORS.redSL : COLORS.ok, borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                          {eq.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12, color: '#555555' }}>
                      <span>{mants.length} mantenimiento{mants.length !== 1 ? 's' : ''}</span>
                      <span>Coste acum.: {fmtEurLocal(coste)}</span>
                    </div>
                  </div>
                )
              })}
              {equipos.length === 0 && <div style={{ color: COLOR.textMut, fontSize: 13 }}>Sin equipos registrados aún.</div>}
            </div>
          </div>

          {selectedEquipo && (
            <div style={{ background: INK, border: '1px solid #2a2a2a', borderRadius: 10, padding: '20px' }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', color: COLOR.textMut, marginBottom: 12 }}>
                HISTORIAL — {selectedEquipo.nombre}
              </div>
              <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
                <div style={{ background: INK, borderRadius: 8, padding: '12px 16px', flex: 1 }}>
                  <div style={{ fontSize: 11, color: COLOR.textMut, marginBottom: 4, fontFamily: FONT.heading, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Coste Acumulado</div>
                  <div style={{ fontFamily: FONT.heading, fontSize: 22, color: BLANCO }}>{fmtEurLocal(costAcum)}</div>
                </div>
              </div>
              {eqMantenimientos.length === 0 ? (
                <div style={{ color: '#555555', fontSize: 13 }}>Sin mantenimientos registrados.</div>
              ) : eqMantenimientos.map(m => (
                <div key={m.id} style={{ borderBottom: '1px solid #222222', padding: '10px 0', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ color: GRIS }}>{m.descripcion ?? '—'}</span>
                    <span style={{ color: COLOR.textMut, whiteSpace: 'nowrap' }}>{fmtFecha(m.fecha)}</span>
                  </div>
                  {m.coste !== null && <div style={{ color: COLORS.glovo, fontSize: 12, marginTop: 2 }}>{fmtEurLocal(m.coste)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
