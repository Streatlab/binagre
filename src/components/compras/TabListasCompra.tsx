import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { fmtNum, fmtEur, fmtDate } from '@/utils/format'

interface StockRow {
  id: string; nombre: string; ud_std: string | null
  stock_actual: number; stock_minimo: number; precio_ref: number; bajo_minimo: boolean
}
interface ItemLista { ingrediente_id: string; nombre: string; cantidad: number; unidad: string; precio_est: number }
interface Lista { id: string; nombre: string; fecha: string; total: number | null; items: ItemLista[] }

export default function TabListasCompra() {
  const { T } = useTheme()
  const [stock, setStock] = useState<StockRow[]>([])
  const [listas, setListas] = useState<Lista[]>([])
  const [propuesta, setPropuesta] = useState<ItemLista[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = async () => {
    setLoading(true)
    const [s, l] = await Promise.all([
      supabase.from('v_stock_real').select('*'),
      supabase.from('listas_compra').select('*').order('fecha', { ascending: false }).limit(20),
    ])
    if (s.data) setStock(s.data as StockRow[])
    if (l.data) setListas(l.data as Lista[])
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const generar = () => {
    const items: ItemLista[] = stock
      .filter(r => r.bajo_minimo)
      .map(r => ({
        ingrediente_id: r.id,
        nombre: r.nombre,
        cantidad: Math.max(r.stock_minimo - r.stock_actual, 0),
        unidad: r.ud_std ?? 'ud',
        precio_est: r.precio_ref ?? 0,
      }))
      .filter(i => i.cantidad > 0)
    setPropuesta(items)
  }

  const totalPropuesta = useMemo(() => propuesta.reduce((s, i) => s + i.cantidad * i.precio_est, 0), [propuesta])

  const guardar = async () => {
    if (propuesta.length === 0) return
    const hoy = new Date().toISOString().split('T')[0]
    await supabase.from('listas_compra').insert({
      nombre: `Lista ${fmtDate(hoy)}`, fecha: hoy, total: totalPropuesta, items: propuesta,
    })
    setPropuesta([])
    cargar()
  }

  const cambiarCantidad = (idx: number, v: string) => {
    const n = parseFloat(v.replace(',', '.'))
    setPropuesta(p => p.map((it, i) => i === idx ? { ...it, cantidad: isNaN(n) ? 0 : n } : it))
  }

  const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 12px', textAlign: 'left', background: '#0a0a0a', borderBottom: `1px solid ${T.brd}`, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: T.pri, borderBottom: `0.5px solid ${T.brd}`, fontFamily: FONT.body }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <button onClick={generar} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#B01D23', color: '#fff', fontFamily: FONT.heading, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>
          Generar lista desde stock
        </button>
        {propuesta.length > 0 && (
          <>
            <span style={{ color: T.sec, fontSize: 13 }}>{propuesta.length} artículos · estimado {fmtEur(totalPropuesta)}</span>
            <button onClick={guardar} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid #4caf50`, background: 'transparent', color: '#4caf50', fontFamily: FONT.heading, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', cursor: 'pointer' }}>
              Guardar lista
            </button>
          </>
        )}
      </div>

      {propuesta.length > 0 && (
        <div style={{ ...cardStyle(T), padding: 0, overflow: 'auto', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Ingrediente</th>
              <th style={{ ...th, textAlign: 'right' }}>A comprar</th>
              <th style={th}>Ud</th>
              <th style={{ ...th, textAlign: 'right' }}>€ estimado</th>
            </tr></thead>
            <tbody>
              {propuesta.map((it, idx) => (
                <tr key={it.ingrediente_id}>
                  <td style={td}>{it.nombre}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <input value={it.cantidad} onChange={e => cambiarCantidad(idx, e.target.value)}
                      style={{ width: 70, padding: '4px 6px', borderRadius: 6, border: `0.5px solid ${T.brd}`, background: '#1e1e1e', color: T.pri, textAlign: 'right' }} />
                  </td>
                  <td style={{ ...td, color: T.mut }}>{it.unidad}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtEur(it.cantidad * it.precio_est)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 12, color: T.mut, fontFamily: FONT.heading, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Listas guardadas</div>
      <div style={{ ...cardStyle(T), padding: 0, overflow: 'auto' }}>
        {loading ? <div style={{ padding: 32, textAlign: 'center', color: T.mut }}>Cargando...</div> :
        listas.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: T.mut }}>Sin listas guardadas todavía.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Nombre</th><th style={th}>Fecha</th>
              <th style={{ ...th, textAlign: 'right' }}>Artículos</th>
              <th style={{ ...th, textAlign: 'right' }}>Total estimado</th>
            </tr></thead>
            <tbody>
              {listas.map(l => (
                <tr key={l.id}>
                  <td style={td}>{l.nombre}</td>
                  <td style={{ ...td, color: T.mut }}>{fmtDate(l.fecha)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{Array.isArray(l.items) ? l.items.length : 0}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{l.total != null ? fmtEur(l.total) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
