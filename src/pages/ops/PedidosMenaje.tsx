import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'

type EstadoPedido = 'PEDIDO' | 'RECIBIDO' | 'CANCELADO'

interface PedidoMenaje {
  id: string
  item: string
  cantidad: number
  proveedor: string | null
  estado: EstadoPedido
  fecha_pedido: string
  fecha_recepcion: string | null
  notas: string | null
  importe: number | null
}

const ESTADO_COLORS: Record<EstadoPedido, { bg: string; text: string }> = {
  PEDIDO:    { bg: '#f5a62320', text: '#f5a623' },
  RECIBIDO:  { bg: '#1D9E7520', text: '#1D9E75' },
  CANCELADO: { bg: '#B01D2320', text: '#B01D23' },
}

function fmtFecha(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function fmtEurLocal(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

const EMPTY_FORM = { item: '', cantidad: '1', proveedor: '', importe: '', fecha_pedido: new Date().toISOString().split('T')[0], notas: '' }

export default function PedidosMenaje() {
  const [pedidos, setPedidos] = useState<PedidoMenaje[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase.from('pedidos_menaje').select('*').order('fecha_pedido', { ascending: false })
      if (e) throw e
      setPedidos((data ?? []) as PedidoMenaje[])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('42P01') ? 'Tabla pedidos_menaje no encontrada.' : `Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  async function addPedido() {
    if (!form.item.trim()) return
    setSaving(true)
    const { error: e } = await supabase.from('pedidos_menaje').insert({
      item: form.item.trim(),
      cantidad: parseFloat(form.cantidad) || 1,
      proveedor: form.proveedor || null,
      importe: form.importe ? parseFloat(form.importe) : null,
      estado: 'PEDIDO' as EstadoPedido,
      fecha_pedido: form.fecha_pedido,
      notas: form.notas || null,
    })
    if (!e) { setForm(EMPTY_FORM); setShowForm(false); await loadData() }
    setSaving(false)
  }

  async function cambiarEstado(id: string, nuevoEstado: EstadoPedido) {
    setUpdatingId(id)
    const extra: Record<string, unknown> = {}
    if (nuevoEstado === 'RECIBIDO') extra.fecha_recepcion = new Date().toISOString().split('T')[0]
    await supabase.from('pedidos_menaje').update({ estado: nuevoEstado, ...extra }).eq('id', id)
    await loadData()
    setUpdatingId(null)
  }

  const kpiPedidos = pedidos.filter(p => p.estado === 'PEDIDO').length
  const kpiImporte = pedidos.filter(p => p.estado === 'PEDIDO').reduce((s, p) => s + (p.importe ?? 0), 0)

  return (
    <div style={{ fontFamily: FONT.body, padding: '28px', background: '#111111', minHeight: '100vh', color: '#ffffff' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', color: '#B01D23', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>PEDIDOS MENAJE</h1>
          <span style={{ fontSize: 13, color: '#777777' }}>Gestión de pedidos de menaje y material</span>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          style={{ padding: '8px 18px', background: '#e8f442', color: '#111111', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Nuevo pedido
        </button>
      </div>

      {error && <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', borderRadius: 8, padding: '14px 18px', color: '#ffaaaa', fontSize: 13, marginBottom: 20 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: '#777777', marginBottom: 6 }}>Pedidos Pendientes</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 600, color: '#f5a623' }}>{kpiPedidos}</div>
        </div>
        <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: '#777777', marginBottom: 6 }}>Importe Pendiente</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 600, color: '#ffffff' }}>{fmtEurLocal(kpiImporte)}</div>
        </div>
      </div>

      {showForm && (
        <div style={{ background: '#141414', border: '1px solid #383838', borderRadius: 10, padding: '20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[
              { label: 'Ítem', key: 'item', type: 'text', flex: 2 },
              { label: 'Cantidad', key: 'cantidad', type: 'number', flex: 1 },
              { label: 'Proveedor', key: 'proveedor', type: 'text', flex: 2 },
              { label: 'Importe (€)', key: 'importe', type: 'number', flex: 1 },
              { label: 'Fecha Pedido', key: 'fecha_pedido', type: 'date', flex: 1 },
              { label: 'Notas', key: 'notas', type: 'text', flex: 2 },
            ].map(f => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: f.flex, minWidth: 120 }}>
                <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#777777' }}>{f.label}</label>
                <input type={f.type} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ padding: '8px 10px', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6, color: '#ffffff', fontSize: 13 }} />
              </div>
            ))}
            <button onClick={addPedido} disabled={saving}
              style={{ padding: '8px 18px', background: '#B01D23', color: '#ffffff', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 14px', background: '#222222', border: '1px solid #383838', color: '#cccccc', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: '#777777', fontSize: 13 }}>Cargando…</div> : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #2a2a2a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0a0a0a' }}>
                {['Ítem', 'Cantidad', 'Proveedor', 'Importe', 'Estado', 'F. Pedido', 'F. Recepción', 'Notas', 'Acción'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#777777', fontWeight: 600, borderBottom: '1px solid #2a2a2a', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '20px 14px', color: '#777777', textAlign: 'center' }}>Sin pedidos aún</td></tr>
              ) : pedidos.map((p, i) => {
                const ec = ESTADO_COLORS[p.estado] ?? ESTADO_COLORS.PEDIDO
                return (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? '#111111' : '#141414', borderBottom: '1px solid #1e1e1e' }}>
                    <td style={{ padding: '10px 14px', color: '#ffffff', fontWeight: 500 }}>{p.item}</td>
                    <td style={{ padding: '10px 14px', color: '#cccccc' }}>{p.cantidad}</td>
                    <td style={{ padding: '10px 14px', color: '#cccccc' }}>{p.proveedor ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#cccccc' }}>{fmtEurLocal(p.importe)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: ec.bg, color: ec.text, border: `1px solid ${ec.text}`, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontFamily: FONT.heading, letterSpacing: '1px' }}>{p.estado}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#777777', whiteSpace: 'nowrap' }}>{fmtFecha(p.fecha_pedido)}</td>
                    <td style={{ padding: '10px 14px', color: '#777777', whiteSpace: 'nowrap' }}>{fmtFecha(p.fecha_recepcion)}</td>
                    <td style={{ padding: '10px 14px', color: '#777777', fontSize: 12, maxWidth: 150 }}>{p.notas ?? '—'}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      {p.estado === 'PEDIDO' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => cambiarEstado(p.id, 'RECIBIDO')} disabled={updatingId === p.id}
                            style={{ padding: '3px 8px', background: '#1D9E7520', border: '1px solid #1D9E75', color: '#1D9E75', borderRadius: 4, fontSize: 10, cursor: 'pointer', fontFamily: FONT.heading }}>
                            Recibido
                          </button>
                          <button onClick={() => cambiarEstado(p.id, 'CANCELADO')} disabled={updatingId === p.id}
                            style={{ padding: '3px 8px', background: '#B01D2320', border: '1px solid #B01D23', color: '#B01D23', borderRadius: 4, fontSize: 10, cursor: 'pointer', fontFamily: FONT.heading }}>
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
