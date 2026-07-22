import { INK, LIMA } from '@/styles/neobrutal'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { fmtNum, fmtEur } from '@/utils/format'

interface PatronRow {
  plato: string
  canal: string
  marca: string
  precio: number
  unidades: number
  ingresos: number
  meses: number
  uds_mes: number
}

export default function TabPatronesPrecio() {
  const { T } = useTheme()
  const [rows, setRows] = useState<PatronRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    supabase.from('v_patrones_precio').select('*').order('plato')
      .then(({ data, error }) => {
        if (!error && data) setRows(data as PatronRow[])
        setLoading(false)
      })
  }, [])

  // Agrupar por plato+canal: comparar rendimiento a distintos precios
  const grupos = useMemo(() => {
    const map = new Map<string, PatronRow[]>()
    for (const r of rows) {
      if (busqueda && !r.plato.toLowerCase().includes(busqueda.toLowerCase())) continue
      const k = `${r.plato}|${r.canal}`
      map.set(k, [...(map.get(k) ?? []), r])
    }
    // Solo interesantes: platos probados a más de un precio
    return Array.from(map.values())
      .map(arr => arr.sort((a, b) => b.uds_mes - a.uds_mes))
      .sort((a, b) => b.length - a.length)
  }, [rows, busqueda])

  const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 12px', textAlign: 'left', background: INK, borderBottom: `1px solid ${T.brd}`, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: T.pri, borderBottom: `0.5px solid ${T.brd}`, fontFamily: FONT.body }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <input type="text" placeholder="Buscar plato..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: INK, color: T.pri, fontSize: 13, fontFamily: FONT.body, minWidth: 220 }} />
        <span style={{ color: T.mut, fontSize: 12, marginLeft: 'auto' }}>Cada fila = un precio probado. El que más vende al mes gana.</span>
      </div>

      <div style={{ ...cardStyle(T), padding: 0, overflow: 'auto' }}>
        {loading ? <div style={{ padding: 32, textAlign: 'center', color: T.mut }}>Cargando...</div> :
        grupos.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.mut }}>
            Aún no hay histórico de ventas por plato suficiente. En cuanto entren datos de ventas, aquí verás qué precio funciona mejor para cada plato y canal.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Plato</th><th style={th}>Canal</th><th style={th}>Marca</th>
              <th style={{ ...th, textAlign: 'right' }}>Precio</th>
              <th style={{ ...th, textAlign: 'right' }}>Uds/mes</th>
              <th style={{ ...th, textAlign: 'right' }}>Uds totales</th>
              <th style={{ ...th, textAlign: 'right' }}>Ingresos</th>
              <th style={{ ...th, textAlign: 'right' }}>Meses</th>
              <th style={th}></th>
            </tr></thead>
            <tbody>
              {grupos.flatMap(arr => arr.map((r, idx) => (
                <tr key={`${r.plato}-${r.canal}-${r.precio}`} style={{ background: idx === 0 && arr.length > 1 ? 'rgba(232,244,66,0.05)' : undefined }}>
                  <td style={{ ...td, fontWeight: idx === 0 ? 700 : 400, color: idx === 0 ? T.pri : T.mut }}>{idx === 0 ? r.plato : ''}</td>
                  <td style={{ ...td, color: T.mut }}>{r.canal}</td>
                  <td style={{ ...td, color: T.mut }}>{r.marca}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtEur(r.precio)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtNum(r.uds_mes)}</td>
                  <td style={{ ...td, textAlign: 'right', color: T.mut }}>{fmtNum(r.unidades)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtEur(r.ingresos)}</td>
                  <td style={{ ...td, textAlign: 'right', color: T.mut }}>{r.meses}</td>
                  <td style={td}>
                    {idx === 0 && arr.length > 1 && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#2a2a1a', color: LIMA, fontFamily: FONT.heading, textTransform: 'uppercase' }}>Precio ganador</span>
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
