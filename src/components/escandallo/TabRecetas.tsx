import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Receta } from './types'
import { fmtEurES, fmtES, fmtDateES, n, ESTRUCTURA_PCT } from './types'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, groupStyle, cardStyle, semaforoColor } from '@/styles/tokens'

interface Props { recetasList: Receta[]; busqueda?: string; onSelect: (r: Receta) => void; onNew?: () => void }

/** Margen% Uber = (PVP/1.1 − coste_rac − estructura(30%) − PVP×0.30) / (PVP/1.1) */
function margenUber(r: Receta): number {
  const pvp = n(r.pvp_uber)
  if (pvp <= 0) return 0
  const neto = pvp / 1.1
  const estructura = ESTRUCTURA_PCT * neto
  return ((neto - n(r.coste_rac) - estructura - pvp * 0.30) / neto) * 100
}

export default function TabRecetas({ recetasList, busqueda = '', onSelect, onNew }: Props) {
  const { T } = useTheme()
  const [ingsPorReceta, setIngsPorReceta] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('recetas_lineas').select('receta_id, ingrediente_nombre')
      const map: Record<string, string[]> = {}
      for (const l of data ?? []) {
        if (!l.receta_id) continue
        if (!map[l.receta_id]) map[l.receta_id] = []
        map[l.receta_id].push((l.ingrediente_nombre ?? '').toLowerCase())
      }
      setIngsPorReceta(map)
    }
    load()
  }, [recetasList])

  const filtered = useMemo(() => {
    let list = recetasList
    const q = busqueda.trim().toLowerCase()
    if (q) {
      list = list.filter(r =>
        (r.nombre ?? '').toLowerCase().includes(q) ||
        (r.codigo ?? '').toLowerCase().includes(q) ||
        (r.categoria ?? '').toLowerCase().includes(q) ||
        (ingsPorReceta[r.id] ?? []).some(ing => ing.includes(q))
      )
    }
    return list
  }, [recetasList, busqueda, ingsPorReceta])

  const thStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 10,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: T.mut,
    padding: '8px 10px',
    background: T.group,
    borderBottom: `0.5px solid ${T.brd}`,
    fontWeight: 400,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  }

  const tdStyle: CSSProperties = {
    fontFamily: FONT.body,
    fontSize: 13,
    color: T.pri,
    padding: '8px 10px',
    borderBottom: `0.5px solid ${T.brd}`,
    whiteSpace: 'nowrap',
  }

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ ...cardStyle(T), padding: '12px 16px', display: 'inline-flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', color: T.mut }}>TOTAL</span>
          <span style={{ fontFamily: FONT.heading, fontSize: 22, color: T.pri }}>{recetasList.length}</span>
        </div>
        {onNew && <button onClick={onNew} className="ds-btn-add" style={{ marginLeft: 'auto' }}>+ Nueva Receta</button>}
      </div>

      {busqueda.trim() && (
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{busqueda}"
        </div>
      )}

      <div style={groupStyle(T)}>
        {!filtered.length ? (
          <p style={{ color: T.mut, fontFamily: FONT.body, textAlign: 'center', padding: 40, fontSize: 13 }}>
            Sin recetas
          </p>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 8, border: `0.5px solid ${T.brd}` }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', width: '100%' }}>
              <thead>
                <tr>
                  <th style={thStyle}>CÓDIGO</th>
                  <th style={thStyle}>NOMBRE</th>
                  <th style={thStyle}>CATEGORÍA</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>RACIONES</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>TAMAÑO</th>
                  <th style={thStyle}>UNIDAD</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>COSTE TANDA</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>COSTE/RAC</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>PVP UE</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>MARGEN %</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>FECHA</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const m = margenUber(r)
                  const hasPvp = n(r.pvp_uber) > 0
                  const col = semaforoColor(m)
                  return (
                    <tr key={r.id} onClick={() => onSelect(r)} style={{ cursor: 'pointer' }}>
                      <td style={{ ...tdStyle, color: T.emphasis, fontWeight: 600 }}>{r.codigo ?? ''}</td>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{r.nombre}</td>
                      <td style={{ ...tdStyle, color: T.sec }}>{r.categoria ?? ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{r.raciones ? fmtES(r.raciones, 0) : ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{r.tamano_rac != null ? fmtES(r.tamano_rac) : ''}</td>
                      <td style={{ ...tdStyle, color: T.sec }}>{r.unidad ?? ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: T.sec }}>{fmtEurES(r.coste_tanda, 2)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmtEurES(r.coste_rac, 2)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{hasPvp ? fmtEurES(r.pvp_uber, 2) : ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {hasPvp ? (
                          <span style={{
                            background: col + '22',
                            color: col,
                            padding: '2px 8px',
                            borderRadius: 99,
                            fontFamily: FONT.heading,
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            {m.toFixed(2)}%
                          </span>
                        ) : ''}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: T.mut, fontSize: 12 }}>{r.fecha ? fmtDateES(r.fecha) : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
