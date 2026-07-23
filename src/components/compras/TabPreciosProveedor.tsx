import { INK } from '@/styles/neobrutal'
import { DARK_WASH_VERDE_BG, VERDE_POSITIVO } from '@/styles/palettes'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { fmtEur, fmtDate } from '@/utils/format'

interface PrecioRow {
  ingrediente_id: string
  ingrediente: string
  ud_std: string | null
  proveedor: string
  n_compras: number
  precio_medio: number
  precio_min: number
  precio_max: number
  ultimo_precio: number
  ultima_fecha: string
}

export default function TabPreciosProveedor() {
  const { T } = useTheme()
  const [rows, setRows] = useState<PrecioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    supabase.from('v_comparador_precios').select('*').order('ingrediente')
      .then(({ data, error }) => {
        if (!error && data) setRows(data as PrecioRow[])
        setLoading(false)
      })
  }, [])

  // Agrupar por ingrediente; el proveedor más barato gana
  const grupos = useMemo(() => {
    const map = new Map<string, PrecioRow[]>()
    for (const r of rows) {
      if (busqueda && !r.ingrediente.toLowerCase().includes(busqueda.toLowerCase())) continue
      const arr = map.get(r.ingrediente_id) ?? []
      arr.push(r)
      map.set(r.ingrediente_id, arr)
    }
    return Array.from(map.values()).map(arr => arr.sort((a, b) => a.precio_medio - b.precio_medio))
  }, [rows, busqueda])

  const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 12px', textAlign: 'left', background: INK, borderBottom: `1px solid ${T.brd}`, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: T.pri, borderBottom: `0.5px solid ${T.brd}`, fontFamily: FONT.body }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <input type="text" placeholder="Buscar ingrediente..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 0, border: `0.5px solid ${T.brd}`, background: INK, color: T.pri, fontSize: 13, fontFamily: FONT.body, minWidth: 220 }} />
        <span style={{ color: T.mut, fontSize: 12, marginLeft: 'auto' }}>Precios reales sacados de tus facturas · últimos 12 meses</span>
      </div>

      <div style={{ ...cardStyle(T), padding: 0, overflow: 'auto' }}>
        {loading ? <div style={{ padding: 32, textAlign: 'center', color: T.mut }}>Cargando...</div> :
        grupos.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.mut }}>
            Aún no hay precios registrados. Vincula compras a ingredientes en la pestaña Entradas y aquí aparecerá la comparativa automáticamente.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Ingrediente</th><th style={th}>Proveedor</th>
              <th style={{ ...th, textAlign: 'right' }}>Precio medio</th>
              <th style={{ ...th, textAlign: 'right' }}>Mín</th>
              <th style={{ ...th, textAlign: 'right' }}>Máx</th>
              <th style={{ ...th, textAlign: 'right' }}>Último</th>
              <th style={{ ...th, textAlign: 'right' }}>Compras</th>
              <th style={th}>Última</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {grupos.flatMap(arr => arr.map((r, idx) => (
                <tr key={r.ingrediente_id + r.proveedor} style={{ background: idx === 0 && arr.length > 1 ? 'rgba(76,175,80,0.06)' : undefined }}>
                  <td style={{ ...td, fontWeight: idx === 0 ? 700 : 400, color: idx === 0 ? T.pri : T.mut }}>
                    {idx === 0 ? r.ingrediente : ''}
                  </td>
                  <td style={td}>{r.proveedor}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtEur(r.precio_medio)}{r.ud_std ? `/${r.ud_std}` : ''}</td>
                  <td style={{ ...td, textAlign: 'right', color: T.mut }}>{fmtEur(r.precio_min)}</td>
                  <td style={{ ...td, textAlign: 'right', color: T.mut }}>{fmtEur(r.precio_max)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtEur(r.ultimo_precio)}</td>
                  <td style={{ ...td, textAlign: 'right', color: T.mut }}>{r.n_compras}</td>
                  <td style={{ ...td, color: T.mut }}>{fmtDate(r.ultima_fecha)}</td>
                  <td style={td}>
                    {idx === 0 && arr.length > 1 && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 0, background: DARK_WASH_VERDE_BG, color: VERDE_POSITIVO, fontFamily: FONT.heading, textTransform: 'uppercase' }}>Más barato</span>
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
