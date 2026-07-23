import { BLANCO, GRANATE, LIMA, VERDE } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { useIsMobile } from '@/hooks/useIsMobile'
import RutaPantalla from '@/components/ui/RutaPantalla'

interface Marca {
  id: string
  nombre: string
  activa: boolean
  descripcion: string | null
}

const EMPTY_FORM = { nombre: '', activa: true, descripcion: '' }

const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'
const NEO_CARD: CSSProperties = { border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW }

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

  const isMobile = useIsMobile()

  return (
    <div style={{ fontFamily: FONT.body, padding: isMobile ? '16px' : '28px', background: 'var(--neo-bg)', minHeight: '100vh', color: 'var(--sl-text-primary)' }}>
      <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <RutaPantalla niveles={['Marcas']} subtitulo="Gestion de marcas del negocio" />
        <button onClick={openCreate}
          style={{ padding: '10px 18px', minHeight: 44, background: LIMA, color: 'var(--sl-text-primary)', ...NEO_CARD, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 800, cursor: 'pointer' }}>
          + Nueva marca
        </button>
      </div>

      {error && <div style={{ backgroundColor: `${GRANATE}18`, ...NEO_CARD, padding: '14px 18px', color: GRANATE, fontSize: 13, marginBottom: 20 }}>{error}</div>}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--sl-overlay)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: 'var(--sl-modal-bg)', ...NEO_CARD, padding: isMobile ? '20px' : '28px', width: '90%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
            <h2 style={{ fontFamily: FONT.heading, fontSize: 16, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-primary)', fontWeight: 800, margin: '0 0 20px' }}>
              {editId ? 'EDITAR MARCA' : 'NUEVA MARCA'}
            </h2>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', display: 'block', marginBottom: 4 }}>Nombre</label>
              <input type="text" value={editData.nombre} onChange={e => setEditData(p => ({ ...p, nombre: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--sl-input-edit)', border: `3px solid ${NEO_INK}`, borderRadius: 0, color: 'var(--sl-text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', display: 'block', marginBottom: 4 }}>Descripcion</label>
              <input type="text" value={editData.descripcion ?? ''} onChange={e => setEditData(p => ({ ...p, descripcion: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--sl-input-edit)', border: `3px solid ${NEO_INK}`, borderRadius: 0, color: 'var(--sl-text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="activa" checked={editData.activa} onChange={e => setEditData(p => ({ ...p, activa: e.target.checked }))} />
              <label htmlFor="activa" style={{ fontSize: 13, color: 'var(--sl-text-secondary)', cursor: 'pointer' }}>Activa</label>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => { setShowForm(false); setEditId(null) }}
                style={{ padding: '10px 16px', minHeight: 44, background: 'var(--sl-btn-cancel-bg)', ...NEO_CARD, color: 'var(--sl-btn-cancel-text)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Cancelar</button>
              <button onClick={save} disabled={saving}
                style={{ padding: '10px 18px', minHeight: 44, background: GRANATE, color: BLANCO, ...NEO_CARD, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: 'var(--sl-text-muted)', fontSize: 13 }}>Cargando...</div> : (
        <div style={{ overflowX: 'auto', ...NEO_CARD }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--sl-thead)' }}>
                {['Nombre', 'Descripcion', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', fontWeight: 800, borderBottom: `3px solid ${NEO_INK}` }}>{h}</th>
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
                    <span style={{ background: m.activa ? `${VERDE}20` : `${GRANATE}20`, color: m.activa ? VERDE : GRANATE, border: `2px solid ${m.activa ? VERDE : GRANATE}`, padding: '3px 8px', borderRadius: 0, fontSize: 10, fontFamily: FONT.heading, fontWeight: 800, letterSpacing: '1px' }}>
                      {m.activa ? 'ACTIVA' : 'INACTIVA'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => openEdit(m)}
                        style={{ padding: '6px 12px', background: 'transparent', border: `2px solid ${NEO_INK}`, color: 'var(--sl-text-secondary)', borderRadius: 0, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Editar</button>
                      <button onClick={() => toggleActiva(m)}
                        style={{ padding: '6px 12px', background: 'transparent', border: `2px solid ${m.activa ? GRANATE : VERDE}`, color: m.activa ? GRANATE : VERDE, borderRadius: 0, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
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
