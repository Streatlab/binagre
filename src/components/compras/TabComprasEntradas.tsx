import { BLANCO, GRANATE, INK } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { fmtNum, fmtEur, fmtDate } from '@/utils/format'

interface Linea {
  id: string
  descripcion: string
  cantidad: number
  unidad: string | null
  precio_unitario: number | null
  total_linea: number | null
  proveedor_nombre: string | null
  fecha: string | null
  ingrediente_id: string | null
}
interface Ing { id: string; nombre: string; ud_std: string | null }
interface MapRow { texto_producto: string; proveedor_nombre: string | null; ingrediente_id: string }

export default function TabComprasEntradas() {
  const { T } = useTheme()
  const [lineas, setLineas] = useState<Linea[]>([])
  const [ings, setIngs] = useState<Ing[]>([])
  const [mapa, setMapa] = useState<MapRow[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ descripcion: '', cantidad: '', unidad: 'ud', precio: '', proveedor: '', fecha: new Date().toISOString().split('T')[0], ingrediente_id: '' })

  const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: INK, color: T.pri, fontSize: 13, fontFamily: FONT.body }

  const cargar = async () => {
    setLoading(true)
    const [l, i, m] = await Promise.all([
      supabase.from('facturas_lineas').select('*').is('ingrediente_id', null).order('created_at', { ascending: false }).limit(200),
      supabase.from('ingredientes').select('id,nombre,ud_std').eq('activo', true).order('nombre'),
      supabase.from('producto_ingrediente_map').select('texto_producto,proveedor_nombre,ingrediente_id'),
    ])
    if (l.data) setLineas(l.data as Linea[])
    if (i.data) setIngs(i.data as Ing[])
    if (m.data) setMapa(m.data as MapRow[])
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const sugerencia = (l: Linea): string | null => {
    const txt = l.descripcion?.toLowerCase().trim()
    const hit = mapa.find(m => m.texto_producto === txt && (m.proveedor_nombre === l.proveedor_nombre || !m.proveedor_nombre))
    return hit?.ingrediente_id ?? null
  }

  const asignar = async (lineaId: string, ingredienteId: string) => {
    if (!ingredienteId) return
    await supabase.from('facturas_lineas').update({ ingrediente_id: ingredienteId }).eq('id', lineaId)
    cargar()
  }

  const crearLinea = async () => {
    if (!form.descripcion || !form.cantidad) return
    const cantidad = parseFloat(form.cantidad.replace(',', '.'))
    const precio = form.precio ? parseFloat(form.precio.replace(',', '.')) : null
    await supabase.from('facturas_lineas').insert({
      descripcion: form.descripcion, cantidad, unidad: form.unidad,
      precio_unitario: precio, total_linea: precio ? precio * cantidad : null,
      proveedor_nombre: form.proveedor || null, fecha: form.fecha,
      ingrediente_id: form.ingrediente_id || null, origen: 'manual',
    })
    setForm({ ...form, descripcion: '', cantidad: '', precio: '', ingrediente_id: '' })
    cargar()
  }

  const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 12px', textAlign: 'left', background: INK, borderBottom: `1px solid ${T.brd}`, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: T.pri, borderBottom: `0.5px solid ${T.brd}`, fontFamily: FONT.body }

  return (
    <div>
      <div style={{ ...cardStyle(T), padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: T.mut, fontFamily: FONT.heading, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Registrar compra (entra directa al stock)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="Producto (ej. Coca-Cola 33cl)" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} style={{ ...inp, minWidth: 220 }} />
          <input placeholder="Cant." value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} style={{ ...inp, width: 70 }} />
          <input placeholder="Ud" value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })} style={{ ...inp, width: 60 }} />
          <input placeholder="€/ud" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} style={{ ...inp, width: 80 }} />
          <input placeholder="Proveedor" value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} style={{ ...inp, width: 140 }} />
          <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={inp} />
          <select value={form.ingrediente_id} onChange={e => setForm({ ...form, ingrediente_id: e.target.value })} style={{ ...inp, maxWidth: 200 }}>
            <option value="">Vincular a ingrediente...</option>
            {ings.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
          <button onClick={crearLinea} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: GRANATE, color: BLANCO, fontFamily: FONT.heading, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>Añadir</button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: T.mut, fontFamily: FONT.heading, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
        Compras sin vincular a ingrediente ({lineas.length})
      </div>
      <div style={{ ...cardStyle(T), padding: 0, overflow: 'auto' }}>
        {loading ? <div style={{ padding: 32, textAlign: 'center', color: T.mut }}>Cargando...</div> :
        lineas.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: T.mut }}>Todo vinculado. El stock está al día.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Fecha</th><th style={th}>Producto</th><th style={th}>Proveedor</th>
              <th style={{ ...th, textAlign: 'right' }}>Cant.</th><th style={{ ...th, textAlign: 'right' }}>€/ud</th>
              <th style={{ ...th, textAlign: 'right' }}>Total</th><th style={th}>Vincular a</th>
            </tr></thead>
            <tbody>
              {lineas.map(l => {
                const sug = sugerencia(l)
                return (
                  <tr key={l.id}>
                    <td style={td}>{l.fecha ? fmtDate(l.fecha) : '—'}</td>
                    <td style={td}>{l.descripcion}</td>
                    <td style={{ ...td, color: T.mut }}>{l.proveedor_nombre || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtNum(l.cantidad)} {l.unidad || ''}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.precio_unitario != null ? fmtEur(l.precio_unitario) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.total_linea != null ? fmtEur(l.total_linea) : '—'}</td>
                    <td style={td}>
                      <select defaultValue={sug ?? ''} onChange={e => asignar(l.id, e.target.value)}
                        style={{ ...inp, maxWidth: 220, border: sug ? '1px solid #4caf50' : `0.5px solid ${T.brd}` }}>
                        <option value="">{sug ? 'Sugerido ↓ (elige para confirmar)' : 'Elegir ingrediente...'}</option>
                        {ings.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
