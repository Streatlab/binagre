import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { EPS } from './types'
import { fmtEurES, fmtES, fmtDateES, n } from './types'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, groupStyle } from '@/styles/tokens'

interface Props { epsList: EPS[]; busqueda?: string; onSelect: (eps: EPS) => void; onNew?: () => void }

type Filter = 'todos' | 'enuso' | 'sinuso'

export default function TabEPS({ epsList, busqueda = '', onSelect, onNew }: Props) {
  const { T, isDark } = useTheme()
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

  const btnActive: CSSProperties = {
    background: T.emphasis,
    color: isDark ? '#1a1a00' : '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1.5px',
    cursor: 'pointer',
  }
  const btnInactive: CSSProperties = {
    background: 'none',
    color: T.sec,
    border: `0.5px solid ${T.brd}`,
    borderRadius: 8,
    padding: '8px 16px',
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1.5px',
    cursor: 'pointer',
  }

  const btns: { key: Filter; label: string; val: number; onClick: () => void }[] = [
    { key: 'todos', label: 'TOTAL', val: total, onClick: () => setFilter('todos') },
    { key: 'enuso', label: 'EN USO', val: enUso, onClick: () => toggle('enuso') },
    { key: 'sinuso', label: 'SIN USO', val: sinUso, onClick: () => toggle('sinuso') },
  ]

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {btns.map(b => (
          <button
            key={b.key}
            type="button"
            onClick={b.onClick}
            style={filter === b.key ? btnActive : btnInactive}
          >
            {b.label} <span style={{ fontSize: 16, fontWeight: 600 }}>{b.val}</span>
          </button>
        ))}
        {onNew && <button onClick={onNew} className="ds-btn-add" style={{ marginLeft: 'auto' }}>+ Nueva EPS</button>}
      </div>

      {busqueda.trim() && (
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{busqueda}"
        </div>
      )}

      <div style={groupStyle(T)}>
        {!filtered.length ? (
          <p style={{ color: T.mut, fontFamily: FONT.body, textAlign: 'center', padding: 40, fontSize: 13 }}>
            Sin EPS{filter !== 'todos' ? ' en este filtro' : ''}
          </p>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 8, border: `0.5px solid ${T.brd}` }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', width: '100%' }}>
              <thead>
                <tr>
                  <th style={thStyle}>CÓDIGO</th>
                  <th style={thStyle}>NOMBRE</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>COSTE TANDA</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>COSTE/RAC</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>RACIONES</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>FECHA</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} onClick={() => onSelect(e)} style={{ cursor: 'pointer' }}>
                    <td style={{ ...tdStyle, color: '#66aaff', fontWeight: 600 }}>{e.codigo ?? ''}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{e.nombre}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: T.sec }}>{fmtEurES(e.coste_tanda, 4)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmtEurES(e.coste_rac, 4)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{e.raciones ? fmtES(e.raciones, 0) : ''}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: T.mut, fontSize: 12 }}>{e.fecha ? fmtDateES(e.fecha) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
