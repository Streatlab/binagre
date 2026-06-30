import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Receta } from './types'
import { fmtEurES, fmtES, fmtDateES, n } from './types'
import { supabase } from '@/lib/supabase'
import { semaforoColor } from '@/styles/tokens'
import { calcNetoPorCanal, useConfigCanales } from '@/lib/panel/calcNetoPlataforma'
import { useConfig } from '@/hooks/useConfig'
import { INK, CREMA, CLARO, SHADOW, BORDER_CARD, OSW, LEX, AMA, VERDE, GRANATE, GRIS } from '@/styles/neobrutal'

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

  // Margen medio (solo recetas con PVP) para la fila total
  const margenMedio = useMemo(() => {
    const conPvp = filtered.filter(r => n(r.pvp_uber) > 0)
    if (!conPvp.length) return null
    const suma = conPvp.reduce((acc, r) => acc + margenUber(r, configCanales, estructura_pct), 0)
    return suma / conPvp.length
  }, [filtered, configCanales, estructura_pct])

  const th: CSSProperties = {
    fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
    color: CREMA, padding: '9px 12px', background: INK,
    textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0,
    borderRight: '2px solid #4a3f2c',
  }
  const td: CSSProperties = {
    fontFamily: LEX, fontSize: 13, color: INK, padding: '6px 11px',
    borderTop: `3px solid ${INK}`, borderRight: '2px solid rgba(20,15,8,.14)', whiteSpace: 'nowrap',
  }
  const num: CSSProperties = { ...td, textAlign: 'right', fontFamily: OSW, fontWeight: 700, fontSize: 17 }

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

      <div style={{ background: CREMA, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}` }}>
        {!filtered.length ? (
          <p style={{ color: GRIS, fontFamily: LEX, textAlign: 'center', padding: 40, fontSize: 13 }}>
            Sin recetas
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', width: '100%' }}>
              <thead>
                <tr>
                  <th style={th}>CÓDIGO</th>
                  <th style={th}>RECETA</th>
                  <th style={{ ...th, textAlign: 'right' }}>RACIONES</th>
                  <th style={{ ...th, textAlign: 'right' }}>TAMAÑO</th>
                  <th style={{ ...th, textAlign: 'right' }}>COSTE TANDA €</th>
                  <th style={{ ...th, textAlign: 'right' }}>COSTE/RAC €</th>
                  <th style={{ ...th, textAlign: 'right' }}>PVP UE €</th>
                  <th style={{ ...th, textAlign: 'center' }}>MARGEN %</th>
                  <th style={{ ...th, textAlign: 'center', borderRight: 'none' }}>FECHA</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const m = margenUber(r, configCanales, estructura_pct)
                  const hasPvp = n(r.pvp_uber) > 0
                  const col = semaforoColor(m)
                  const band = hasPvp ? col : GRIS
                  return (
                    <tr key={r.id} onClick={() => onSelect(r)} style={{ cursor: 'pointer', background: '#ffffff' }}>
                      <td style={{ ...td, color: GRANATE, fontFamily: OSW, fontWeight: 700, fontSize: 15, borderLeft: `14px solid ${band}` }}>{r.codigo ?? ''}</td>
                      <td style={td}>
                        <div style={{ fontFamily: LEX, fontSize: 16, fontWeight: 700, color: INK, lineHeight: 1.03, whiteSpace: 'normal' }}>{r.nombre}</div>
                        {(r.categoria || r.unidad) && (
                          <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, letterSpacing: '.4px', textTransform: 'uppercase', color: '#5a4f3a', marginTop: 1 }}>
                            {[r.categoria, r.unidad].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td style={num}>{r.raciones ? fmtES(r.raciones, 0) : ''}</td>
                      <td style={num}>{r.tamano_rac != null ? fmtES(r.tamano_rac) : ''}</td>
                      <td style={{ ...num, color: '#5a4f3a' }}>{fmtES(r.coste_tanda, 2)}</td>
                      <td style={num}>{fmtES(r.coste_rac, 2)}</td>
                      <td style={num}>{hasPvp ? fmtES(r.pvp_uber, 2) : ''}</td>
                      <td style={{ ...td, padding: 0, textAlign: 'center' }}>
                        {hasPvp ? (
                          <div style={{ background: col, color: '#ffffff', fontFamily: OSW, fontWeight: 700, fontSize: 20, padding: '7px 6px', borderLeft: `3px solid ${INK}`, borderRight: `3px solid ${INK}` }}>
                            {m.toFixed(0)}%
                          </div>
                        ) : <span style={{ fontFamily: OSW, color: GRIS, fontSize: 14 }}>—</span>}
                      </td>
                      <td style={{ ...td, textAlign: 'center', color: GRIS, fontSize: 12, fontFamily: OSW, borderRight: 'none' }}>{r.fecha ? fmtDateES(r.fecha) : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7} style={{ background: INK, color: CREMA, fontFamily: OSW, fontWeight: 700, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', padding: '9px 12px', borderTop: `5px solid ${INK}` }}>
                    {filtered.length} receta{filtered.length !== 1 ? 's' : ''} · margen medio Uber
                  </td>
                  <td style={{ background: INK, textAlign: 'center', borderTop: `5px solid ${INK}`, padding: 8 }}>
                    {margenMedio != null ? (
                      <span style={{ display: 'inline-block', background: AMA, color: INK, fontFamily: OSW, fontWeight: 700, fontSize: 18, border: `3px solid ${INK}`, padding: '6px 10px' }}>{margenMedio.toFixed(0)}%</span>
                    ) : <span style={{ color: CREMA, fontFamily: OSW }}>—</span>}
                  </td>
                  <td style={{ background: INK, borderTop: `5px solid ${INK}` }} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!!filtered.length && (
          <div style={{ background: CLARO, borderTop: `3px solid ${INK}`, padding: '10px 14px', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: INK }}>Margen Uber:</span>
            {[
              { c: semaforoColor(60), t: 'Sano · cubre gastos + margen (≥50%)' },
              { c: semaforoColor(20), t: 'Ajustado · cubre gastos (1–49%)' },
              { c: semaforoColor(0), t: 'Pierde dinero (≤0%)' },
            ].map((it, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: LEX, fontSize: 12, color: INK }}>
                <span style={{ width: 14, height: 14, background: it.c, border: `2px solid ${INK}`, display: 'inline-block' }} />
                {it.t}
              </span>
            ))}
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

// Tokens legacy importados y reservados para futuras pasadas de tabla.
void SHADOW; void BORDER_CARD; void fmtEurES
