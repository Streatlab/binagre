import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'

interface Marca {
  id: string
  nombre: string
  activa: boolean
  descripcion: string | null
}

const EMPTY_FORM = { nombre: '', activa: true, descripcion: '' }

export default function Marcas() {
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editData, setEditData] = useState<typeof EMPTY_FORM>(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase.from('marcas').select('*').order('nombre')
      if (e) throw e
      setMarcas((data ?? []) as Marca[])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('42P01') ? 'Tabla marcas no encontrada.' : `Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditData(EMPTY_FORM)
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(m: Marca) {
    setEditData({ nombre: m.nombre, activa: m.activa, descripcion: m.descripcion ?? '' })
    setEditId(m.id)
    setShowForm(true)
  }

  async function save() {
    if (!editData.nombre.trim()) return
    setSaving(true)
    const payload = { nombre: editData.nombre.trim(), activa: editData.activa, descripcion: editData.descripcion || null }
    if (editId) {
      await supabase.from('marcas').update(payload).eq('id', editId)
    } else {
      await supabase.from('marcas').insert(payload)
    }
    setShowForm(false)
    setEditId(null)
    setEditData(EMPTY_FORM)
    await loadData()
    setSaving(false)
  }

  async function toggleActiva(m: Marca) {
    await supabase.from('marcas').update({ activa: !m.activa }).eq('id', m.id)
    await loadData()
  }

  return (
    <div style={{ fontFamily: FONT.body, padding: '28px', background: 'var(--sl-app)', minHeight: '100vh', color: 'var(--sl-text-primary)' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', color: '#B01D23', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>MARCAS</h1>
          <span style={{ fontSize: 13, color: 'var(--sl-text-muted)' }}>Gestion de marcas del negocio</span>
        </div>
        <button onClick={openCreate}
          style={{ padding: '8px 18px', background: '#e8f442', color: '#111111', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Nueva marca
        </button>
      </div>

      {error && <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', borderRadius: 8, padding: '14px 18px', color: '#ffaaaa', fontSize: 13, marginBottom: 20 }}>{error}</div>}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--sl-overlay)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: 'var(--sl-modal-bg)', border: '1px solid var(--sl-border)', borderRadius: 12, padding: '28px', width: '100%', maxWidth: 420 }}>
            <h2 style={{ fontFamily: FONT.heading, fontSize: 16, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-primary)', margin: '0 0 20px' }}>
              {editId ? 'EDITAR MARCA' : 'NUEVA MARCA'}
            </h2>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', display: 'block', marginBottom: 4 }}>Nombre</label>
              <input type="text" value={editData.nombre} onChange={e => setEditData(p => ({ ...p, nombre: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', background: 'var(--sl-input-edit)', border: '1px solid var(--sl-border)', borderRadius: 6, color: 'var(--sl-text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', display: 'block', marginBottom: 4 }}>Descripcion</label>
              <input type="text" value={editData.descripcion ?? ''} onChange={e => setEditData(p => ({ ...p, descripcion: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', background: 'var(--sl-input-edit)', border: '1px solid var(--sl-border)', borderRadius: 6, color: 'var(--sl-text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="activa" checked={editData.activa} onChange={e => setEditData(p => ({ ...p, activa: e.target.checked }))} />
              <label htmlFor="activa" style={{ fontSize: 13, color: 'var(--sl-text-secondary)', cursor: 'pointer' }}>Activa</label>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setEditId(null) }}
                style={{ padding: '8px 16px', background: 'var(--sl-btn-cancel-bg)', border: '1px solid var(--sl-btn-cancel-border)', color: 'var(--sl-btn-cancel-text)', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={save} disabled={saving}
                style={{ padding: '8px 18px', background: '#B01D23', color: '#ffffff', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: 'var(--sl-text-muted)', fontSize: 13 }}>Cargando...</div> : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--sl-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--sl-thead)' }}>
                {['Nombre', 'Descripcion', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--sl-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {marcas.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '20px 14px', color: 'var(--sl-text-muted)', textAlign: 'center' }}>Sin marcas registradas aun</td></tr>
              ) : marcas.map((m, i) => (
                <tr key={m.id} style={{ background: i % 2 === 0 ? 'var(--sl-card)' : 'var(--sl-card-alt)', borderBottom: '1px solid var(--sl-border)', opacity: m.activa ? 1 : 0.5 }}>
                  <td style={{ padding: '12px 14px', color: 'var(--sl-text-primary)', fontWeight: 500 }}>{m.nombre}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--sl-text-muted)', fontSize: 12 }}>{m.descripcion ?? '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ background: m.activa ? '#1D9E7520' : '#B01D2320', color: m.activa ? '#1D9E75' : '#B01D23', border: `1px solid ${m.activa ? '#1D9E75' : '#B01D23'}`, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontFamily: FONT.heading, letterSpacing: '1px' }}>
                      {m.activa ? 'ACTIVA' : 'INACTIVA'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(m)}
                        style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--sl-border)', color: 'var(--sl-text-secondary)', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                      <button onClick={() => toggleActiva(m)}
                        style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${m.activa ? '#B01D23' : '#1D9E75'}`, color: m.activa ? '#B01D23' : '#1D9E75', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                        {m.activa ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
