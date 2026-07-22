import { useEffect, useMemo, useState } from 'react'
import type { EPS } from './types'
import { fmtEurES, fmtES, fmtDateES, n } from './types'
import { supabase } from '@/lib/supabase'
import { INK, CREMA, OSW, VERDE, ROJO, AZUL, GRIS } from '@/styles/neobrutal'
import { th, thR, thC, td, tdNum, tdCod, zebra, bandEnUso, BAND, SUBT } from './estilosTabla'
import CabeceraEscandallo from './CabeceraEscandallo'

interface Props { epsList: EPS[]; busqueda?: string; onBuscar: (v: string) => void; onSelect: (eps: EPS) => void; onNew?: () => void }

type Filter = 'todos' | 'enuso' | 'sinuso'

export default function TabEPS({ epsList, busqueda = '', onBuscar, onSelect, onNew }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')
  const [ingsPorEps, setIngsPorEps] = useState<Record<string, string[]>>({})
  const [usosMap, setUsosMap] = useState<Record<string, number>>({})

  useEffect(() => {
    const load = async () => {
      const [{ data: epsLin }, { data: recLin }] = await Promise.all([
        supabase.from('eps_lineas').select('eps_id, ingrediente_nombre'),
        supabase.from('recetas_lineas').select('eps_id').not('eps_id', 'is', null),
      ])
      const map: Record<string, string[]> = {}
      for (const l of epsLin ?? []) {
        if (!l.eps_id) continue
        if (!map[l.eps_id]) map[l.eps_id] = []
        map[l.eps_id].push((l.ingrediente_nombre ?? '').toLowerCase())
      }
      const usos: Record<string, number> = {}
      for (const l of recLin ?? []) {
        if (l.eps_id) usos[String(l.eps_id)] = (usos[String(l.eps_id)] || 0) + 1
      }
      setIngsPorEps(map)
      setUsosMap(usos)
    }
    load()
  }, [epsList])

  const getUsos = (e: EPS) => usosMap[String(e.id)] ?? n(e.usos)

  const { total, enUso, sinUso, filtered } = useMemo(() => {
    const total = epsList.length
    const enUso = epsList.filter(e => getUsos(e) > 0).length
    const sinUso = total - enUso
    let filtered = epsList
    if (filter === 'enuso') filtered = epsList.filter(e => getUsos(e) > 0)
    else if (filter === 'sinuso') filtered = epsList.filter(e => getUsos(e) === 0)
    const q = busqueda.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter(e =>
        (e.nombre ?? '').toLowerCase().includes(q) ||
        (e.codigo ?? '').toLowerCase().includes(q) ||
        (e.categoria ?? '').toLowerCase().includes(q) ||
        (ingsPorEps[e.id] ?? []).some(ing => ing.includes(q))
      )
    }
    return { total, enUso, sinUso, filtered }
  }, [epsList, filter, busqueda, ingsPorEps, usosMap])

  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <CabeceraEscandallo
        titulo="EPS"
        busqueda={busqueda}
        onBuscar={onBuscar}
        onNew={onNew}
        nuevoLabel="+ Nueva EPS"
        pills={[
          { label: 'Total', value: total, active: filter === 'todos', onClick: () => setFilter('todos') },
          { label: 'En uso', value: enUso, color: VERDE, active: filter === 'enuso', onClick: () => toggle('enuso') },
          { label: 'Sin uso', value: sinUso, color: ROJO, active: filter === 'sinuso', onClick: () => toggle('sinuso') },
        ]}
      />

      {busqueda.trim() && (
        <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '.5px', textTransform: 'uppercase', color: GRIS }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{busqueda}"
        </div>
      )}

      <div style={{ background: CREMA, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}` }}>
        {!filtered.length ? (
          <p style={{ color: GRIS, fontFamily: OSW, textAlign: 'center', padding: 40, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase' }}>
            Sin EPS{filter !== 'todos' ? ' en este filtro' : ''}
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
                  <th style={thR}>RACIONES</th>
                  <th style={thC}>FECHA</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, idx) => {
                  const band = bandEnUso(getUsos(e) > 0)
                  const bg = zebra(idx)
                  return (
                    <tr key={e.id} onClick={() => onSelect(e)} style={{ cursor: 'pointer', background: bg }}>
                      <td style={{ ...tdCod, color: AZUL, borderLeft: `${BAND}px solid ${band}` }}>{e.codigo ?? ''}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{e.nombre}</td>
                      <td style={{ ...tdNum, color: SUBT }}>{fmtEurES(e.coste_tanda, 4)}</td>
                      <td style={tdNum}>{fmtEurES(e.coste_rac, 4)}</td>
                      <td style={tdNum}>{e.raciones ? fmtES(e.raciones, 0) : ''}</td>
                      <td style={{ ...td, textAlign: 'center', color: GRIS, fontSize: 13, fontFamily: OSW }}>{e.fecha ? fmtDateES(e.fecha) : ''}</td>
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
