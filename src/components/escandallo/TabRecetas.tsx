import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Receta } from './types'
import { fmtEurES, fmtES, fmtDateES, n } from './types'
import { supabase } from '@/lib/supabase'
import { semaforoColor } from '@/styles/tokens'
import { calcNetoPorCanal, useConfigCanales } from '@/lib/panel/calcNetoPlataforma'
import { useConfig } from '@/hooks/useConfig'
import { INK, CLARO, SHADOW, BORDER_CARD, OSW, LEX, VERDE, GRANATE, GRIS } from '@/styles/neobrutal'

interface Props { recetasList: Receta[]; busqueda?: string; onSelect: (r: Receta) => void; onNew?: () => void }

/** Margen% Uber a nivel plato vía calcNetoPorCanal central (modo 'plato').
 *  Referencia fórmula: Notion 366c8b1f-6139-81a8-95a7-dd0abdf63a91
 */
function margenUber(r: Receta, configCanales: Record<string, any>, estructuraPct: number): number {
  const pvp = n(r.pvp_uber)
  if (pvp <= 0) return 0
  const { neto } = calcNetoPorCanal('uber', pvp, 1, { modo: 'plato', configCanales })
  if (neto <= 0) return 0
  const estr = estructuraPct > 1 ? estructuraPct / 100 : estructuraPct
  const estructura = estr * neto
  return ((neto - n(r.coste_rac) - estructura) / neto) * 100
}

export default function TabRecetas({ recetasList, busqueda = '', onSelect, onNew }: Props) {
  const configCanales = useConfigCanales()
  const { estructura_pct } = useConfig()
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
    fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
    color: INK, padding: '10px 12px', background: CLARO, borderBottom: `2px solid ${INK}`,
    textAlign: 'left', whiteSpace: 'nowrap',
  }
  const tdStyle: CSSProperties = {
    fontFamily: LEX, fontSize: 13, color: INK, padding: '10px 12px',
    borderBottom: `1px solid ${INK}1f`, whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ background: '#ffffff', border: `2px solid ${INK}`, padding: '10px 16px', display: 'inline-flex', flexDirection: 'column', minWidth: 110 }}>
          <span style={{ fontFamily: OSW, fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>TOTAL</span>
          <span style={{ fontFamily: OSW, fontSize: 26, fontWeight: 700, lineHeight: 1, color: INK }}>{recetasList.length}</span>
        </div>
        {onNew && <button onClick={onNew} style={btnNuevo}>+ Nueva Receta</button>}
      </div>

      {busqueda.trim() && (
        <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{busqueda}"
        </div>
      )}

      <div style={{ background: '#ffffff', border: BORDER_CARD, boxShadow: SHADOW }}>
        {!filtered.length ? (
          <p style={{ color: GRIS, fontFamily: LEX, textAlign: 'center', padding: 40, fontSize: 13 }}>
            Sin recetas
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
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
                  const m = margenUber(r, configCanales, estructura_pct)
                  const hasPvp = n(r.pvp_uber) > 0
                  const col = semaforoColor(m)
                  return (
                    <tr key={r.id} onClick={() => onSelect(r)} style={{ cursor: 'pointer' }}>
                      <td style={{ ...tdStyle, color: GRANATE, fontFamily: OSW, fontWeight: 700 }}>{r.codigo ?? ''}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{r.nombre}</td>
                      <td style={{ ...tdStyle, color: '#00000099' }}>{r.categoria ?? ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{r.raciones ? fmtES(r.raciones, 0) : ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{r.tamano_rac != null ? fmtES(r.tamano_rac) : ''}</td>
                      <td style={{ ...tdStyle, color: '#00000099' }}>{r.unidad ?? ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#00000099' }}>{fmtEurES(r.coste_tanda, 2)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: OSW, fontWeight: 700 }}>{fmtEurES(r.coste_rac, 2)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{hasPvp ? fmtEurES(r.pvp_uber, 2) : ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {hasPvp ? (
                          <span style={{
                            background: col + '22',
                            color: col,
                            padding: '2px 8px',
                            border: `1.5px solid ${INK}`,
                            fontFamily: OSW,
                            fontSize: 11,
                            fontWeight: 700,
                          }}>
                            {m.toFixed(2)}%
                          </span>
                        ) : ''}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: GRIS, fontSize: 12 }}>{r.fecha ? fmtDateES(r.fecha) : ''}</td>
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

const btnNuevo: CSSProperties = {
  marginLeft: 'auto', fontFamily: OSW, fontWeight: 700, fontSize: 13, letterSpacing: '1px',
  textTransform: 'uppercase', background: VERDE, color: '#ffffff', border: `2px solid ${INK}`,
  boxShadow: `3px 3px 0 ${INK}`, padding: '8px 16px', cursor: 'pointer', borderRadius: 0,
}
