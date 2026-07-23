import { BLANCO, GRANATE, GRIS, INK, NAR, VERDE } from '@/styles/neobrutal'
import { ERROR_BANNER_BG, ERROR_BANNER_BORDE } from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { toLocalDateStr } from '@/lib/dateRange'
import { COLORS } from '@/components/panel/resumen/tokens'
import { fmtEur } from '@/utils/format'
import { HeroCantera, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

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
    case 'recibido': return VERDE
    case 'enviado': return NAR
    case 'cancelado': return GRIS
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

  const pendientes = pedidos.filter(p => (p.estado ?? 'pendiente') === 'pendiente')
  const enviados = pedidos.filter(p => p.estado === 'enviado')

  const titularHero = pedidos.length === 0
    ? 'Aún no hay pedidos de menaje.'
    : pendientes.length > 0
      ? `${pendientes.length} ${pendientes.length === 1 ? 'pedido pendiente' : 'pedidos pendientes'} de gestionar.`
      : 'Sin pedidos pendientes de gestionar.'

  const atencionHero = [
    pendientes.length > 0 ? `${pendientes.length} pendientes` : null,
    enviados.length > 0 ? `${enviados.length} enviados` : null,
    `${pedidos.length} en total`,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>

      {/* Acción propia */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowForm(f => !f)}
          style={{ padding: '9px 18px', background: COLORS.glovo, color: INK, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Nuevo pedido
        </button>
      </div>

      {/* 1 · Héroe del área Operaciones (naranja) */}
      <HeroCantera
        area="ops"
        titular={titularHero}
        atencion={atencionHero}
      />

      {error && <Papel ceja={ERROR_BANNER_BORDE} style={{ background: ERROR_BANNER_BG, border: `1px solid ${ERROR_BANNER_BORDE}`, color: COLORS.redSL }}>{error}</Papel>}

      {/* 3 · Frase potente */}
      {!loading && pedidos.length > 0 && (
        pendientes.length > 0
          ? <FrasePotente significado="coste">Hay pedidos sin enviar: revísalos para no quedarte sin menaje.</FrasePotente>
          : <FrasePotente significado="logro">Todos los pedidos están enviados o recibidos.</FrasePotente>
      )}

      {showForm && (
        <Papel ceja={GRANATE}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              { key: 'fecha', label: 'Fecha', type: 'date' },
              { key: 'proveedor', label: 'Proveedor *', type: 'text' },
              { key: 'descripcion', label: 'Descripción', type: 'text' },
              { key: 'coste', label: 'Coste (€)', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 150 }}>
                <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key as keyof typeof form] as string}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontFamily: FONT.body, fontSize: 13 }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 150 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Estado</label>
              <select
                value={form.estado}
                onChange={e => setForm(prev => ({ ...prev, estado: e.target.value }))}
                style={{ padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontFamily: FONT.body, fontSize: 13 }}
              >
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={guardar} disabled={saving}
              style={{ padding: '9px 18px', background: COLORS.redSL, color: BLANCO, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '9px 14px', background: BLANCO, border: `3px solid ${INK}`, color: GRIS, fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </Papel>
      )}

      {loading ? (
        <div style={{ color: GRIS, fontSize: 13 }}>Cargando…</div>
      ) : (
        <div>
          <SeccionLabel bg={GRANATE}>Pedidos</SeccionLabel>
          <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: INK }}>
                  {['Fecha', 'Proveedor', 'Descripción', 'Coste', 'Estado'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: BLANCO, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedidos.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '20px 14px', color: GRIS, textAlign: 'center' }}>Sin pedidos</td></tr>
                ) : pedidos.map(p => (
                  <tr key={p.id} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: '10px 14px', color: GRIS, whiteSpace: 'nowrap' }}>{fmtFechaTabla(p.fecha)}</td>
                    <td style={{ padding: '10px 14px', color: INK, fontWeight: 500 }}>{p.proveedor}</td>
                    <td style={{ padding: '10px 14px', color: GRIS }}>{p.descripcion ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: INK, textAlign: 'right' }}>{p.coste !== null ? fmtEur(p.coste) : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <select
                        value={p.estado ?? 'pendiente'}
                        onChange={e => cambiarEstado(p.id, e.target.value)}
                        style={{
                          backgroundColor: BLANCO,
                          border: `2px solid ${estadoColor(p.estado)}`,
                          color: estadoColor(p.estado),
                          padding: '3px 8px',
                          fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px',
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
          </Papel>
        </div>
      )}
    </PantallaCantera>
  )
}

function fmtFechaTabla(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}
