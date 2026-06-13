import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { toLocalDateStr } from '@/lib/dateRange'
import { COLORS, COLOR } from '@/components/panel/resumen/tokens'
import { fmtEur } from '@/utils/format'


const BG_OPS = '#111111'
interface Pedido {
  id: string
  fecha: string
  proveedor: string
  descripcion: string | null
  coste: number | null
  estado: string | null
}

const ESTADOS = ['pendiente', 'enviado', 'recibido', 'cancelado']

function estadoColor(estado: string | null): string {
  switch (estado) {
    case 'recibido': return COLORS.ok
    case 'enviado': return '#f5a623'
    case 'cancelado': return COLOR.textMut
    default: return COLORS.glovo
  }
}

export default function PedidosMenaje() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    fecha: toLocalDateStr(new Date()),
    proveedor: '',
    descripcion: '',
    coste: '',
    estado: 'pendiente',
  })

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('pedidos_menaje')
        .select('id,fecha,proveedor,descripcion,coste,estado')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err
      setPedidos((data ?? []) as Pedido[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function guardar() {
    if (!form.proveedor.trim()) return
    setSaving(true)
    const { error: err } = await supabase.from('pedidos_menaje').insert({
      fecha: form.fecha,
      proveedor: form.proveedor.trim(),
      descripcion: form.descripcion.trim() || null,
      coste: form.coste ? parseFloat(form.coste) : null,
      estado: form.estado,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm({ fecha: toLocalDateStr(new Date()), proveedor: '', descripcion: '', coste: '', estado: 'pendiente' })
    setShowForm(false)
    await cargar()
  }

  async function cambiarEstado(id: string, estado: string) {
    const { error: err } = await supabase.from('pedidos_menaje').update({ estado }).eq('id', id)
    if (err) { setError(err.message); return }
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado } : p))
  }

  return (
    <div style={{ backgroundColor: BG_OPS, minHeight: '100vh', padding: '1.5rem', fontFamily: FONT.body }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: FONT.heading, textTransform: 'uppercase', letterSpacing: 3, color: '#ffffff', fontSize: 22, margin: 0 }}>
          Pedidos Menaje
        </h1>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{ backgroundColor: COLORS.glovo, color: BG_OPS, border: 'none', borderRadius: 6, padding: '0.5rem 1.25rem', fontFamily: FONT.heading, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}
        >
          + Nuevo pedido
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', color: '#ffaaaa', borderRadius: 8, padding: '1rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {showForm && (
        <div style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, padding: '1rem', marginBottom: 24 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: COLOR.textMut, marginBottom: 12 }}>
            Nuevo Pedido
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {[
              { key: 'fecha', label: 'Fecha', type: 'date' },
              { key: 'proveedor', label: 'Proveedor *', type: 'text' },
              { key: 'descripcion', label: 'Descripcion', type: 'text' },
              { key: 'coste', label: 'Coste (€)', type: 'number' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 11, color: COLOR.textMut, marginBottom: 4 }}>{f.label}</div>
                <input
                  type={f.type}
                  value={form[f.key as keyof typeof form] as string}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', backgroundColor: '#1e1e1e', border: '1px solid #2a2a2a', color: '#ffffff', padding: '0.5rem', borderRadius: 6, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, color: COLOR.textMut, marginBottom: 4 }}>Estado</div>
              <select
                value={form.estado}
                onChange={e => setForm(prev => ({ ...prev, estado: e.target.value }))}
                style={{ width: '100%', backgroundColor: '#1e1e1e', border: '1px solid #2a2a2a', color: '#ffffff', padding: '0.5rem', borderRadius: 6 }}
              >
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={guardar} disabled={saving} style={{ backgroundColor: COLORS.redSL, color: '#ffffff', border: 'none', borderRadius: 6, padding: '0.5rem 1.25rem', fontFamily: FONT.heading, fontSize: 12, cursor: 'pointer' }}>
              Guardar
            </button>
            <button onClick={() => setShowForm(false)} style={{ backgroundColor: '#222222', border: '1px solid #383838', color: '#cccccc', borderRadius: 6, padding: '0.5rem 1.25rem', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: COLOR.textMut, fontSize: 13 }}>Cargando...</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #2a2a2a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#0a0a0a' }}>
                {['Fecha', 'Proveedor', 'Descripcion', 'Coste', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: COLOR.textMut, borderBottom: '1px solid #2a2a2a' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '20px 14px', color: COLOR.textMut, textAlign: 'center' }}>Sin pedidos</td></tr>
              ) : pedidos.map((p, i) => (
                <tr key={p.id} style={{ backgroundColor: i % 2 === 0 ? BG_OPS : '#141414', borderBottom: '1px solid #2a2a2a' }}>
                  <td style={{ padding: '10px 14px', color: '#cccccc' }}>{p.fecha}</td>
                  <td style={{ padding: '10px 14px', color: '#ffffff', fontWeight: 500 }}>{p.proveedor}</td>
                  <td style={{ padding: '10px 14px', color: '#cccccc' }}>{p.descripcion ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: COLORS.glovo }}>{p.coste !== null ? fmtEur(p.coste) : '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <select
                      value={p.estado ?? 'pendiente'}
                      onChange={e => cambiarEstado(p.id, e.target.value)}
                      style={{
                        backgroundColor: estadoColor(p.estado) + '22',
                        border: `1px solid ${estadoColor(p.estado)}`,
                        color: estadoColor(p.estado),
                        padding: '3px 8px', borderRadius: 10,
                        fontFamily: FONT.heading, fontSize: 11, letterSpacing: 1,
                        cursor: 'pointer',
                      }}
                    >
                      {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
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
