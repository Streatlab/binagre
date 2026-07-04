import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { fmtEur } from '@/utils/format'

interface PricingRow {
  receta_id: string
  nombre: string
  marca: string | null
  coste_rac: number
  margen_objetivo_pct: number
  canal: string
  pvp: number | null
  margen_actual_pct: number | null
  food_cost_pct: number | null
  pvp_sugerido: number
}

const CANAL_LABEL: Record<string, string> = { uber: 'Uber Eats', glovo: 'Glovo', justeat: 'Just Eat', web: 'Web' }

export default function TabPricingGen() {
  const { T } = useTheme()
  const [rows, setRows] = useState<PricingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [canal, setCanal] = useState('')

  useEffect(() => {
    supabase.from('v_pricing_canales').select('*').order('nombre')
      .then(({ data, error }) => {
        if (!error && data) setRows(data as PricingRow[])
        setLoading(false)
      })
  }, [])

  const filtrados = useMemo(() => rows.filter(r => {
    if (canal && r.canal !== canal) return false
    if (busqueda && !r.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  }), [rows, busqueda, canal])

  const semaforo = (fc: number | null) => {
    if (fc == null) return { txt: 'Sin PVP', bg: '#2a2a2a', color: T.mut }
    if (fc <= 30) return { txt: 'Sano', bg: '#1a2a1a', color: '#4caf50' }
    if (fc <= 38) return { txt: 'Justo', bg: '#2a2a1a', color: '#e8f442' }
    return { txt: 'Pierde margen', bg: '#2a1a1a', color: '#e24b4a' }
  }

  const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 12px', textAlign: 'left', background: '#0a0a0a', borderBottom: `1px solid ${T.brd}`, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: T.pri, borderBottom: `0.5px solid ${T.brd}`, fontFamily: FONT.body }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Buscar plato..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: '#1e1e1e', color: T.pri, fontSize: 13, fontFamily: FONT.body, minWidth: 200 }} />
        <select value={canal} onChange={e => setCanal(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: '#1e1e1e', color: T.pri, fontSize: 13, fontFamily: FONT.body }}>
          <option value="">Todos los canales</option>
          {Object.entries(CANAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span style={{ color: T.mut, fontSize: 12, marginLeft: 'auto' }}>PVP sugerido = coste real ÷ margen objetivo de la marca</span>
      </div>

      <div style={{ ...cardStyle(T), padding: 0, overflow: 'auto' }}>
        {loading ? <div style={{ padding: 32, textAlign: 'center', color: T.mut }}>Cargando...</div> :
        filtrados.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: T.mut }}>Sin recetas con coste calculado.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Plato</th><th style={th}>Marca</th><th style={th}>Canal</th>
              <th style={{ ...th, textAlign: 'right' }}>Coste</th>
              <th style={{ ...th, textAlign: 'right' }}>PVP actual</th>
              <th style={{ ...th, textAlign: 'right' }}>Food cost</th>
              <th style={{ ...th, textAlign: 'right' }}>PVP sugerido</th>
              <th style={th}>Estado</th>
            </tr></thead>
            <tbody>
              {filtrados.map(r => {
                const s = semaforo(r.food_cost_pct)
                const subir = r.pvp != null && r.pvp_sugerido > r.pvp + 0.05
                return (
                  <tr key={r.receta_id + r.canal}>
                    <td style={{ ...td, fontWeight: 600 }}>{r.nombre}</td>
                    <td style={{ ...td, color: T.mut }}>{r.marca || '—'}</td>
                    <td style={td}>{CANAL_LABEL[r.canal] || r.canal}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtEur(r.coste_rac)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{r.pvp != null ? fmtEur(r.pvp) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: s.color }}>{r.food_cost_pct != null ? `${r.food_cost_pct}%` : '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: subir ? '#e8f442' : T.pri }}>{fmtEur(r.pvp_sugerido)}{subir ? ' ↑' : ''}</td>
                    <td style={td}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color, fontFamily: FONT.heading, textTransform: 'uppercase' }}>{s.txt}</span>
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
