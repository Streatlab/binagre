import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import type { EPS, Receta } from './types'
import { fmtES, fmtEurES, fmtDateES, n } from './types'
import { INK, CREMA, CLARO, SHADOW, BORDER_CARD, OSW, LEX, AMA, GRANATE, AZUL, GRIS } from '@/styles/neobrutal'

interface Props {
  epsList: EPS[]
  recetasList: Receta[]
  busqueda?: string
  onOpenEps: (eps: EPS) => void
  onOpenReceta: (r: Receta) => void
}

type Kind = 'EPS' | 'REC'
type FiltroKind = 'todos' | 'eps' | 'recetas'

export default function TabIndice({ epsList, recetasList, busqueda = '', onOpenEps, onOpenReceta }: Props) {
  const [filtro, setFiltro] = useState<FiltroKind>('todos')
  const [usosMap, setUsosMap] = useState<Record<string, number>>({})
  const [ingsPorEps, setIngsPorEps] = useState<Record<string, string[]>>({})
  const [ingsPorReceta, setIngsPorReceta] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const load = async () => {
      const [{ data: recLin }, { data: epsLin }] = await Promise.all([
        supabase.from('recetas_lineas').select('receta_id, eps_id, ingrediente_id, ingrediente_nombre'),
        supabase.from('eps_lineas').select('eps_id, ingrediente_nombre'),
      ])
      const usos: Record<string, number> = {}
      const recMap: Record<string, string[]> = {}
      for (const l of recLin ?? []) {
        if (l.eps_id) usos[String(l.eps_id)] = (usos[String(l.eps_id)] || 0) + 1
        if (l.ingrediente_id) usos[String(l.ingrediente_id)] = (usos[String(l.ingrediente_id)] || 0) + 1
        if (l.receta_id) {
          if (!recMap[l.receta_id]) recMap[l.receta_id] = []
          recMap[l.receta_id].push((l.ingrediente_nombre ?? '').toLowerCase())
        }
      }
      const epsMap: Record<string, string[]> = {}
      for (const l of epsLin ?? []) {
        if (!l.eps_id) continue
        if (!epsMap[l.eps_id]) epsMap[l.eps_id] = []
        epsMap[l.eps_id].push((l.ingrediente_nombre ?? '').toLowerCase())
      }
      setUsosMap(usos)
      setIngsPorEps(epsMap)
      setIngsPorReceta(recMap)
    }
    load()
  }, [epsList, recetasList])

  const allRows = useMemo(() => {
    const eps = epsList.map(e => ({ kind: 'EPS' as Kind, data: e }))
    const rec = recetasList.map(r => ({ kind: 'REC' as Kind, data: r }))
    return [...eps, ...rec]
  }, [epsList, recetasList])

  const rows = useMemo(() => {
    let list = allRows
    if (filtro === 'eps') list = list.filter(r => r.kind === 'EPS')
    else if (filtro === 'recetas') list = list.filter(r => r.kind === 'REC')
    const q = busqueda.trim().toLowerCase()
    if (q) {
      list = list.filter(row => {
        const d = row.data
        if ((d.nombre ?? '').toLowerCase().includes(q)) return true
        if ((d.codigo ?? '').toLowerCase().includes(q)) return true
        if ((d.categoria ?? '').toLowerCase().includes(q)) return true
        const ings = row.kind === 'EPS' ? ingsPorEps[d.id] : ingsPorReceta[d.id]
        return (ings ?? []).some(ing => ing.includes(q))
      })
    }
    return list
  }, [allRows, filtro, busqueda, ingsPorEps, ingsPorReceta])

  const countEps = allRows.filter(r => r.kind === 'EPS').length
  const countRec = allRows.filter(r => r.kind === 'REC').length

  const thStyle: CSSProperties = {
    fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
    color: CREMA, padding: '9px 12px', background: INK, borderBottom: `2px solid ${INK}`,
    textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0,
  }
  const tdStyle: CSSProperties = {
    fontFamily: LEX, fontSize: 13, color: INK, padding: '6px 11px',
    borderBottom: `1px solid ${INK}1f`, whiteSpace: 'nowrap',
  }

  const btns: { key: FiltroKind; label: string; val: number }[] = [
    { key: 'todos', label: 'TOTAL', val: allRows.length },
    { key: 'eps', label: 'EPS', val: countEps },
    { key: 'recetas', label: 'RECETAS', val: countRec },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {btns.map(b => {
          const on = filtro === b.key
          return (
            <button key={b.key} type="button" onClick={() => setFiltro(b.key)} style={{
              cursor: 'pointer', textAlign: 'left', minWidth: 110, padding: '10px 16px', borderRadius: 0,
              background: on ? AMA : '#ffffff', border: `2px solid ${INK}`,
              boxShadow: on ? `3px 3px 0 ${INK}` : 'none', transition: 'all 120ms',
            }}>
              <div style={{ fontFamily: OSW, fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: on ? INK : GRIS }}>{b.label}</div>
              <div style={{ fontFamily: OSW, fontSize: 26, fontWeight: 700, lineHeight: 1, color: INK }}>{b.val}</div>
            </button>
          )
        })}
      </div>

      {busqueda.trim() && (
        <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>
          {rows.length} resultado{rows.length !== 1 ? 's' : ''} para "{busqueda}"
        </div>
      )}

      <div style={{ background: '#ffffff', border: BORDER_CARD, boxShadow: SHADOW }}>
        {!rows.length ? (
          <p style={{ color: GRIS, fontFamily: LEX, textAlign: 'center', padding: 40, fontSize: 13 }}>
            Sin resultados
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', width: '100%' }}>
              <thead>
                <tr>
                  <th style={thStyle}>CÓDIGO</th>
                  <th style={thStyle}>NOMBRE</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>COSTE TANDA</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>COSTE/RAC</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>USOS</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>RACIONES</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>FECHA</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>PVP REAL</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const isEps = row.kind === 'EPS'
                  const d = row.data
                  const pvp = isEps ? 0 : n((d as Receta).pvp_uber)
                  const usos = usosMap[String(d.id)] ?? (isEps ? n((d as EPS).usos) : 0)
                  const fecha = 'fecha' in d ? d.fecha : null
                  const codeColor = isEps ? AZUL : GRANATE
                  return (
                    <tr
                      key={`${row.kind}-${d.id}`}
                      onClick={() => isEps ? onOpenEps(d as EPS) : onOpenReceta(d as Receta)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ ...tdStyle, color: codeColor, fontFamily: OSW, fontWeight: 700 }}>{d.codigo ?? ''}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{d.nombre}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#5a4f3a' }}>{fmtEurES(d.coste_tanda, 2)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: OSW, fontWeight: 700 }}>{fmtEurES(d.coste_rac, isEps ? 4 : 2)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: usos > 0 ? INK : GRIS }}>{usos}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{d.raciones ? fmtES(d.raciones, 0) : ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: GRIS, fontSize: 12 }}>{fecha ? fmtDateES(fecha) : ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{!isEps && pvp > 0 ? fmtEurES(pvp, 2) : ''}</td>
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
