import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'

interface Reunion {
  id: string
  titulo: string
  fecha: string
  acta: string | null
  acuerdos: string | null
  hecho: boolean
  created_at: string
}

function fmtFecha(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const EMPTY_FORM = { titulo: '', fecha: new Date().toISOString().split('T')[0], acta: '', acuerdos: '' }

export default function ReunionesEquipo() {
  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('reuniones_equipo').select('*').order('hecho').order('fecha', { ascending: false })
      if (e) throw e
      setReuniones((data ?? []) as Reunion[])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('42P01') ? 'Tabla reuniones_equipo no encontrada.' : `Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  async function addReunion() {
    if (!form.titulo.trim()) return
    setSaving(true)
    const { error: e } = await supabase.from('reuniones_equipo').insert({
      titulo: form.titulo.trim(),
      fecha: form.fecha,
      acta: form.acta || null,
      acuerdos: form.acuerdos || null,
      hecho: false,
    })
    if (!e) { setForm(EMPTY_FORM); setShowForm(false); await loadData() }
    setSaving(false)
  }

  async function toggleHecho(r: Reunion) {
    await supabase.from('reuniones_equipo').update({ hecho: !r.hecho }).eq('id', r.id)
    await loadData()
  }

  const pendientes = reuniones.filter(r => !r.hecho)
  const hechas = reuniones.filter(r => r.hecho)

  const ReunionCard = ({ r }: { r: Reunion }) => (
    <div style={{ background: r.hecho ? '#0f0f0f' : '#141414', border: `1px solid ${r.hecho ? '#1a1a1a' : '#2a2a2a'}`, borderRadius: 10, overflow: 'hidden', opacity: r.hecho ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }}
        onClick={() => setExpanded(prev => prev === r.id ? null : r.id)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.hecho ? '#1D9E75' : '#f5a623', flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: FONT.heading, fontSize: 14, letterSpacing: '1px', color: '#ffffff', marginBottom: 2 }}>{r.titulo}</div>
            <div style={{ fontSize: 12, color: '#777777' }}>{fmtFecha(r.fecha)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ background: r.hecho ? '#1D9E7520' : '#f5a62320', color: r.hecho ? '#1D9E75' : '#f5a623', border: `1px solid ${r.hecho ? '#1D9E75' : '#f5a623'}`, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontFamily: FONT.heading, letterSpacing: '1px' }}>
            {r.hecho ? 'CERRADA' : 'PENDIENTE'}
          </span>
          <span style={{ color: '#555555', fontSize: 14 }}>{expanded === r.id ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded === r.id && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid #1e1e1e' }}>
          {r.acta && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: '#777777', marginBottom: 6 }}>Acta</div>
              <p style={{ margin: 0, fontSize: 13, color: '#cccccc', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.acta}</p>
            </div>
          )}
          {r.acuerdos && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: '#777777', marginBottom: 6 }}>Acuerdos</div>
              <p style={{ margin: 0, fontSize: 13, color: '#cccccc', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.acuerdos}</p>
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <button onClick={() => toggleHecho(r)}
              style={{ padding: '6px 14px', background: r.hecho ? '#222222' : '#1D9E7520', border: `1px solid ${r.hecho ? '#383838' : '#1D9E75'}`, color: r.hecho ? '#cccccc' : '#1D9E75', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase' }}>
              {r.hecho ? 'Reabrir' : 'Marcar como cerrada'}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ fontFamily: FONT.body, padding: '28px', background: '#111111', minHeight: '100vh', color: '#ffffff' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', color: '#B01D23', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>REUNIONES EQUIPO</h1>
          <span style={{ fontSize: 13, color: '#777777' }}>Actas y acuerdos de reuniones</span>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          style={{ padding: '8px 18px', background: '#e8f442', color: '#111111', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Nueva reunión
        </button>
      </div>

      {error && <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', borderRadius: 8, padding: '14px 18px', color: '#ffaaaa', fontSize: 13, marginBottom: 20 }}>{error}</div>}

      {showForm && (
        <div style={{ background: '#141414', border: '1px solid #383838', borderRadius: 10, padding: '20px', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#777777', display: 'block', marginBottom: 4 }}>Título</label>
              <input type="text" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6, color: '#ffffff', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#777777', display: 'block', marginBottom: 4 }}>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6, color: '#ffffff', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          {[
            { label: 'Acta', key: 'acta' },
            { label: 'Acuerdos', key: 'acuerdos' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#777777', display: 'block', marginBottom: 4 }}>{f.label}</label>
              <textarea rows={4} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6, color: '#ffffff', fontSize: 13, resize: 'vertical', fontFamily: FONT.body, boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addReunion} disabled={saving}
              style={{ padding: '8px 18px', background: '#B01D23', color: '#ffffff', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 14px', background: '#222222', border: '1px solid #383838', color: '#cccccc', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: '#777777', fontSize: 13 }}>Cargando…</div> : (
        <>
          {pendientes.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: '#f5a623', marginBottom: 12 }}>
                ACUERDOS PENDIENTES ({pendientes.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendientes.map(r => <ReunionCard key={r.id} r={r} />)}
              </div>
            </div>
          )}
          {hechas.length > 0 && (
            <div>
              <div style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: '#555555', marginBottom: 12 }}>
                REUNIONES CERRADAS ({hechas.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {hechas.map(r => <ReunionCard key={r.id} r={r} />)}
              </div>
            </div>
          )}
          {reuniones.length === 0 && <div style={{ color: '#777777', fontSize: 13 }}>Sin reuniones registradas aún.</div>}
        </>
      )}
    </div>
  )
}
