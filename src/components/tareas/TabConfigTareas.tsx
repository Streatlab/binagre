import { useEffect, useState, useCallback } from 'react'
import { useTheme } from '@/styles/tokens'
import { supabase } from '@/lib/supabase'

interface TareaPeriodica {
  id: string
  nombre: string
  descripcion: string | null
  frecuencia: 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral'
  dia_esperado: number | null
  modulo_destino: string | null
  activa: boolean
  created_at: string
}

const FRECUENCIAS = ['diaria', 'semanal', 'quincenal', 'mensual', 'trimestral'] as const
const MODULOS = ['importador', 'conciliacion', 'general']

const EMPTY_FORM: Omit<TareaPeriodica, 'id' | 'created_at'> = {
  nombre: '',
  descripcion: '',
  frecuencia: 'mensual',
  dia_esperado: 1,
  modulo_destino: 'importador',
  activa: true,
}

export default function TabConfigTareas() {
  const { T } = useTheme()
  const [tareas, setTareas] = useState<TareaPeriodica[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<TareaPeriodica | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tareas_periodicas')
      .select('*')
      .order('created_at', { ascending: true })
    if (data) setTareas(data as TareaPeriodica[])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function abrirNueva() {
    setEditando(null)
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }

  function abrirEditar(t: TareaPeriodica) {
    setEditando(t)
    setForm({
      nombre: t.nombre,
      descripcion: t.descripcion ?? '',
      frecuencia: t.frecuencia,
      dia_esperado: t.dia_esperado ?? 1,
      modulo_destino: t.modulo_destino ?? 'importador',
      activa: t.activa,
    })
    setModalOpen(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) return
    setSaving(true)
    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion || null,
      frecuencia: form.frecuencia,
      dia_esperado: Number(form.dia_esperado) || 1,
      modulo_destino: form.modulo_destino || 'general',
      activa: form.activa,
    }
    if (editando) {
      await supabase.from('tareas_periodicas').update(payload).eq('id', editando.id)
    } else {
      await supabase.from('tareas_periodicas').insert(payload)
    }
    setSaving(false)
    setModalOpen(false)
    cargar()
  }

  async function toggleActiva(t: TareaPeriodica) {
    await supabase.from('tareas_periodicas').update({ activa: !t.activa }).eq('id', t.id)
    cargar()
  }

  const inputStyle: React.CSSProperties = {
    background: '#1e1e1e',
    border: `1px solid #2a2a2a`,
    borderRadius: 6,
    color: '#ffffff',
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: 'Lexend, sans-serif',
    width: '100%',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 11,
    color: '#cccccc',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 4,
    display: 'block',
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: T.sec }}>
          {tareas.length} tarea{tareas.length !== 1 ? 's' : ''} configurada{tareas.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={abrirNueva}
          style={{
            background: '#e8f442',
            color: '#111111',
            border: 'none',
            borderRadius: 6,
            padding: '7px 16px',
            fontSize: 12,
            fontFamily: 'Oswald, sans-serif',
            fontWeight: 600,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >+ Nueva tarea</button>
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#0a0a0a' }}>
              {['Nombre', 'Frecuencia', 'Día', 'Módulo', 'Estado', 'Acciones'].map(h => (
                <th
                  key={h}
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#cccccc',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: `1px solid #2a2a2a`,
                    whiteSpace: 'nowrap',
                  }}
                >{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tareas.map((t, idx) => (
              <tr
                key={t.id}
                style={{ background: idx % 2 === 0 ? '#111111' : '#141414', borderBottom: `1px solid #2a2a2a`, opacity: t.activa ? 1 : 0.5 }}
              >
                <td style={{ padding: '10px 12px', color: '#ffffff' }}>{t.nombre}</td>
                <td style={{ padding: '10px 12px', color: '#cccccc', textTransform: 'capitalize' }}>{t.frecuencia}</td>
                <td style={{ padding: '10px 12px', color: '#cccccc' }}>{t.dia_esperado ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: '#cccccc' }}>{t.modulo_destino ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: 4,
                    background: t.activa ? '#1D9E7522' : '#77777722',
                    color: t.activa ? '#1D9E75' : '#777',
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}>{t.activa ? 'Activa' : 'Inactiva'}</span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => abrirEditar(t)}
                      style={{ background: '#222', border: `1px solid #383838`, borderRadius: 5, color: '#ccc', padding: '4px 10px', fontSize: 11, fontFamily: 'Oswald, sans-serif', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase' }}
                    >Editar</button>
                    <button
                      onClick={() => toggleActiva(t)}
                      style={{ background: t.activa ? '#77777722' : '#1D9E7522', border: `1px solid #383838`, borderRadius: 5, color: t.activa ? '#777' : '#1D9E75', padding: '4px 10px', fontSize: 11, fontFamily: 'Oswald, sans-serif', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase' }}
                    >{t.activa ? 'Desactivar' : 'Activar'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal crear/editar */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{ backgroundColor: '#1a1a1a', border: `1px solid #383838`, borderRadius: 12, padding: 28, minWidth: 360, maxWidth: 520, width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: '#B01D23', fontWeight: 600 }}>
                {editando ? 'Editar tarea' : 'Nueva tarea periódica'}
              </span>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#777', fontSize: 18 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nombre</label>
                <input
                  style={inputStyle}
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Resumen mensual Uber"
                />
              </div>
              <div>
                <label style={labelStyle}>Descripción</label>
                <input
                  style={inputStyle}
                  value={form.descripcion ?? ''}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Frecuencia</label>
                  <select
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    value={form.frecuencia}
                    onChange={e => setForm(f => ({ ...f, frecuencia: e.target.value as typeof form.frecuencia }))}
                  >
                    {FRECUENCIAS.map(f => (
                      <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Día esperado</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={1}
                    max={31}
                    value={form.dia_esperado ?? 1}
                    onChange={e => setForm(f => ({ ...f, dia_esperado: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Módulo destino</label>
                <select
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  value={form.modulo_destino ?? 'importador'}
                  onChange={e => setForm(f => ({ ...f, modulo_destino: e.target.value }))}
                >
                  {MODULOS.map(m => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  id="activa-check"
                  type="checkbox"
                  checked={form.activa}
                  onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="activa-check" style={{ ...labelStyle, margin: 0, cursor: 'pointer' }}>Activa</label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: '#222', border: `1px solid #383838`, borderRadius: 6, color: '#ccc', padding: '8px 20px', fontSize: 12, fontFamily: 'Oswald, sans-serif', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase' }}
              >Cancelar</button>
              <button
                onClick={guardar}
                disabled={saving || !form.nombre.trim()}
                style={{ background: '#B01D23', color: '#ffffff', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 12, fontFamily: 'Oswald, sans-serif', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', textTransform: 'uppercase', opacity: saving ? 0.7 : 1 }}
              >{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
