import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Merma } from './types'
import { fmt, fmtPctFracES, n } from './types'
import { useTheme, FONT, groupStyle } from '@/styles/tokens'

interface Props {
  mermas: Merma[]
  onSelect?: (m: Merma) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

export default function TabMermas({ mermas, onSelect, onNew }: Props) {
  const { T } = useTheme()
  const [filter, setFilter] = useState<Filter>('todos')

  const total = useMemo(() => mermas.length, [mermas])
  const enUso = useMemo(() => mermas.filter(m => n((m as { usos?: number }).usos) > 0 || n(m.num_porciones) > 0).length, [mermas])
  const sinUso = total - enUso
  const filtered = useMemo(() => {
    if (filter === 'enuso') return mermas.filter(m => n((m as { usos?: number }).usos) > 0 || n(m.num_porciones) > 0)
    if (filter === 'sinuso') return mermas.filter(m => !(n((m as { usos?: number }).usos) > 0 || n(m.num_porciones) > 0))
    return mermas
  }, [mermas, filter])
  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  const thStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: T.mut,
    padding: '10px 12px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderBottom: `1px solid ${T.brd}`,
    background: T.card,
  }

  const tdStyle: CSSProperties = {
    fontFamily: FONT.body,
    fontSize: 13,
    color: T.pri,
    padding: '10px 12px',
    borderBottom: `0.5px solid ${T.brd}`,
    whiteSpace: 'nowrap',
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Counter label="TOTAL" value={total} active={filter === 'todos'} onClick={() => setFilter('todos')} />
        <Counter label="EN USO" value={enUso} valueClass="eps" active={filter === 'enuso'} onClick={() => toggle('enuso')} />
        <Counter label="SIN USO" value={sinUso} valueClass="rec" active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
        {onNew && <button onClick={onNew} className="ds-btn-add ml-auto">+ Nueva Merma</button>}
      </div>

      <div style={groupStyle(T)}>
        {!filtered.length ? (
          <p style={{ color: T.mut, fontFamily: FONT.body, textAlign: 'center', padding: 40, fontSize: 13 }}>
            Sin mermas{filter !== 'todos' ? ' en este filtro' : ''}
          </p>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 8, border: `0.5px solid ${T.brd}` }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', minWidth: 'max-content' }}>
              <thead>
                <tr>
                  <th style={thStyle}>IDING</th>
                  <th style={thStyle}>NOMBRE BASE</th>
                  <th style={thStyle}>ABV</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>UDS</th>
                  <th style={thStyle}>UD STD</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>PRECIO TOTAL</th>
                  <th style={thStyle}>SP1 NOMBRE</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>SP1 PESO(G)</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>SP1 %</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>SP1 €</th>
                  <th style={thStyle}>SP2 NOMBRE</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>SP2 PESO(G)</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>SP2 %</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr
                    key={m.id}
                    onClick={() => onSelect?.(m)}
                    style={{ cursor: onSelect ? 'pointer' : 'default' }}
                  >
                    <td style={{ ...tdStyle, color: T.accent, fontWeight: 600 }}>{m.iding ?? '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{m.nombre_base ?? '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: FONT.heading, fontSize: 12, fontWeight: 700 }}>{m.abv ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(m.uds)}</td>
                    <td style={{ ...tdStyle, color: T.sec }}>{m.ud_std ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(m.precio_total)}</td>
                    <td style={{ ...tdStyle, color: T.sec }}>{m.sp1_nombre ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(m.sp1_peso_g, 0)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtPctFracES(m.sp1_pct, 1)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(m.sp1_euros)}</td>
                    <td style={{ ...tdStyle, color: T.sec }}>{m.sp2_nombre ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(m.sp2_peso_g, 0)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtPctFracES(m.sp2_pct, 1)}</td>
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

function Counter({ label, value, valueClass = '', active, onClick }: { label: string; value: number; valueClass?: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} type="button" className={'ds-counter' + (active ? ' active' : '')}>
      <div className="label">{label}</div>
      <div className={'value' + (valueClass ? ' ' + valueClass : '')}>{value}</div>
    </button>
  )
}
