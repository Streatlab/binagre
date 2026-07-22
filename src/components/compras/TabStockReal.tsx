import { BLANCO, GRANATE, INK, ROJO } from '@/styles/neobrutal'
import { DARK_WASH_VERDE_BG, DARK_WASH_ROJO_BG, VERDE_POSITIVO } from '@/styles/palettes'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { fmtNum, fmtEur } from '@/utils/format'

interface StockRow {
  id: string
  iding: string
  nombre: string
  categoria: string | null
  ud_std: string | null
  stock_actual: number
  stock_minimo: number
  precio_ref: number
  valor_stock: number
  bajo_minimo: boolean
}

export default function TabStockReal() {
  const { T } = useTheme()
  const [rows, setRows] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [soloBajo, setSoloBajo] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [nuevoValor, setNuevoValor] = useState('')

  const cargar = () => {
    setLoading(true)
    supabase.from('v_stock_real').select('*').order('nombre')
      .then(({ data, error }) => {
        if (!error && data) setRows(data as StockRow[])
        setLoading(false)
      })
  }
  useEffect(cargar, [])

  const filtrados = useMemo(() => rows.filter(r => {
    if (soloBajo && !r.bajo_minimo) return false
    if (busqueda && !r.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  }), [rows, busqueda, soloBajo])

  const valorTotal = useMemo(() => rows.reduce((s, r) => s + (r.valor_stock || 0), 0), [rows])
  const nBajo = useMemo(() => rows.filter(r => r.bajo_minimo).length, [rows])

  const guardarConteo = async (r: StockRow) => {
    const v = parseFloat(nuevoValor.replace(',', '.'))
    if (isNaN(v)) { setEditando(null); return }
    await supabase.from('inventario_movimientos').insert({
      ingrediente_id: r.id, tipo: 'ajuste_conteo', cantidad: v, unidad: r.ud_std,
      ref_tipo: 'conteo', nota: 'Conteo manual desde Stock Real',
    })
    setEditando(null); setNuevoValor(''); cargar()
  }

  const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 12px', textAlign: 'left', background: INK, borderBottom: `1px solid ${T.brd}`, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: T.pri, borderBottom: `0.5px solid ${T.brd}`, fontFamily: FONT.body }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ ...cardStyle(T), padding: '14px 20px', minWidth: 180 }}>
          <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.heading, textTransform: 'uppercase', letterSpacing: '1px' }}>Valor stock</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.pri, fontFamily: FONT.heading }}>{fmtEur(valorTotal)}</div>
        </div>
        <div style={{ ...cardStyle(T), padding: '14px 20px', minWidth: 180 }}>
          <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.heading, textTransform: 'uppercase', letterSpacing: '1px' }}>Bajo mínimo</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: nBajo > 0 ? ROJO : VERDE_POSITIVO, fontFamily: FONT.heading }}>{nBajo}</div>
        </div>
        <div style={{ ...cardStyle(T), padding: '14px 20px', minWidth: 180 }}>
          <div style={{ fontSize: 11, color: T.mut, fontFamily: FONT.heading, textTransform: 'uppercase', letterSpacing: '1px' }}>Referencias</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.pri, fontFamily: FONT.heading }}>{rows.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Buscar ingrediente..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: INK, color: T.pri, fontSize: 13, fontFamily: FONT.body, minWidth: 220 }} />
        <button onClick={() => setSoloBajo(!soloBajo)}
          style={{ padding: '6px 14px', borderRadius: 6, border: `0.5px solid ${T.brd}`, background: soloBajo ? GRANATE : 'transparent', color: soloBajo ? BLANCO : T.sec, fontSize: 12, fontFamily: FONT.heading, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>
          Solo bajo mínimo
        </button>
      </div>

      <div style={{ ...cardStyle(T), padding: 0, overflow: 'auto' }}>
        {loading ? <div style={{ padding: 32, textAlign: 'center', color: T.mut }}>Cargando...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Ingrediente</th><th style={th}>Categoría</th>
              <th style={{ ...th, textAlign: 'right' }}>Stock</th>
              <th style={{ ...th, textAlign: 'right' }}>Mínimo</th>
              <th style={th}>Ud</th>
              <th style={{ ...th, textAlign: 'right' }}>Valor</th>
              <th style={th}>Estado</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {filtrados.map(r => (
                <tr key={r.id} style={{ background: r.bajo_minimo ? 'rgba(226,75,74,0.06)' : undefined }}>
                  <td style={td}>{r.nombre}</td>
                  <td style={{ ...td, color: T.mut }}>{r.categoria || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>
                    {editando === r.id ? (
                      <input autoFocus value={nuevoValor} onChange={e => setNuevoValor(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') guardarConteo(r); if (e.key === 'Escape') setEditando(null) }}
                        style={{ width: 70, padding: '4px 6px', borderRadius: 6, border: `1px solid ${GRANATE}`, background: INK, color: T.pri, textAlign: 'right' }} />
                    ) : fmtNum(r.stock_actual)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: T.mut }}>{fmtNum(r.stock_minimo)}</td>
                  <td style={{ ...td, color: T.mut }}>{r.ud_std || ''}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtEur(r.valor_stock)}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: r.bajo_minimo ? DARK_WASH_ROJO_BG : DARK_WASH_VERDE_BG, color: r.bajo_minimo ? ROJO : VERDE_POSITIVO, fontFamily: FONT.heading, textTransform: 'uppercase' }}>
                      {r.bajo_minimo ? 'Reponer' : 'OK'}
                    </span>
                  </td>
                  <td style={td}>
                    <button onClick={() => { setEditando(r.id); setNuevoValor(String(r.stock_actual)) }}
                      style={{ padding: '3px 10px', borderRadius: 6, border: `0.5px solid ${T.brd}`, background: 'transparent', color: T.sec, fontSize: 11, cursor: 'pointer' }}>
                      Contar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
