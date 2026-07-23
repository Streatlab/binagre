import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { EPS, Receta } from './types'
import { fmtES, fmtEurES, fmtDateES, n } from './types'
import { INK, CREMA, OSW, GRANATE, AZUL, GRIS } from '@/styles/neobrutal'
import { th, thR, thC, td, tdNum, tdCod, zebra, BAND, SUBT } from './estilosTabla'
import CabeceraEscandallo from './CabeceraEscandallo'

interface Props {
  epsList: EPS[]
  recetasList: Receta[]
  busqueda?: string
  onBuscar: (v: string) => void
  onOpenEps: (eps: EPS) => void
  onOpenReceta: (r: Receta) => void
}

type Kind = 'EPS' | 'REC'
type FiltroKind = 'todos' | 'eps' | 'recetas'

export default function TabIndice({ epsList, recetasList, busqueda = '', onBuscar, onOpenEps, onOpenReceta }: Props) {
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
  const set = (f: FiltroKind) => setFiltro(prev => prev === f ? 'todos' : f)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <CabeceraEscandallo
        titulo="Índice"
        busqueda={busqueda}
        onBuscar={onBuscar}
        pills={[
          { label: 'Total', value: allRows.length, active: filtro === 'todos', onClick: () => setFiltro('todos') },
          { label: 'EPS', value: countEps, color: AZUL, active: filtro === 'eps', onClick: () => set('eps') },
          { label: 'Recetas', value: countRec, color: GRANATE, active: filtro === 'recetas', onClick: () => set('recetas') },
        ]}
      />

      {busqueda.trim() && (
        <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '.5px', textTransform: 'uppercase', color: GRIS }}>
          {rows.length} resultado{rows.length !== 1 ? 's' : ''} para "{busqueda}"
        </div>
      )}

      <div style={{ background: CREMA, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}` }}>
        {!rows.length ? (
          <p style={{ color: GRIS, fontFamily: OSW, textAlign: 'center', padding: 40, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase' }}>
            Sin resultados
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', width: '100%' }}>
              <thead>
                <tr>
                  <th style={th}>CÓDIGO</th>
                  <th style={th}>NOMBRE</th>
                  <th style={thR}>COSTE TANDA</th>
                  <th style={thR}>COSTE/RAC</th>
                  <th style={thC}>USOS</th>
                  <th style={thR}>RACIONES</th>
                  <th style={thC}>FECHA</th>
                  <th style={thR}>PVP REAL</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const isEps = row.kind === 'EPS'
                  const d = row.data
                  const pvp = isEps ? 0 : n((d as Receta).pvp_uber)
                  const usos = usosMap[String(d.id)] ?? (isEps ? n((d as EPS).usos) : 0)
                  const fecha = 'fecha' in d ? d.fecha : null
                  const codeColor = isEps ? AZUL : GRANATE
                  const bg = zebra(idx)
                  return (
                    <tr
                      key={`${row.kind}-${d.id}`}
                      onClick={() => isEps ? onOpenEps(d as EPS) : onOpenReceta(d as Receta)}
                      style={{ cursor: 'pointer', background: bg }}
                    >
                      <td style={{ ...tdCod, color: codeColor, borderLeft: `${BAND}px solid ${codeColor}` }}>{d.codigo ?? ''}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{d.nombre}</td>
                      <td style={{ ...tdNum, color: SUBT }}>{fmtEurES(d.coste_tanda, 2)}</td>
                      <td style={tdNum}>{fmtEurES(d.coste_rac, isEps ? 4 : 2)}</td>
                      <td style={{ ...td, textAlign: 'center', fontFamily: OSW, fontWeight: 700, color: usos > 0 ? INK : GRIS }}>{usos}</td>
                      <td style={tdNum}>{d.raciones ? fmtES(d.raciones, 0) : ''}</td>
                      <td style={{ ...td, textAlign: 'center', color: GRIS, fontSize: 13, fontFamily: OSW }}>{fecha ? fmtDateES(fecha) : ''}</td>
                      <td style={{ ...tdNum, fontWeight: 700 }}>{!isEps && pvp > 0 ? fmtEurES(pvp, 2) : ''}</td>
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

void CREMA
