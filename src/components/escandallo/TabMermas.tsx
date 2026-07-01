import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Merma } from './types'
import { fmt, fmtPctFracES, n } from './types'
import { INK, CREMA, SHADOW, BORDER_CARD, OSW, LEX, AMA, VERDE, ROJO, GRANATE, GRIS } from '@/styles/neobrutal'
import { th, thR, td, tdNum, tdCod, tdSub, zebra, bandEnUso, BAND } from './estilosTabla'

interface Props {
  mermas: Merma[]
  busqueda?: string
  onSelect?: (m: Merma) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

const usada = (m: Merma) => n((m as { usos?: number }).usos) > 0 || n(m.num_porciones) > 0

export default function TabMermas({ mermas, busqueda = '', onSelect, onNew }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')

  const total = useMemo(() => mermas.length, [mermas])
  const enUso = useMemo(() => mermas.filter(usada).length, [mermas])
  const sinUso = total - enUso
  const filtered = useMemo(() => {
    let list = mermas
    if (filter === 'enuso') list = mermas.filter(usada)
    else if (filter === 'sinuso') list = mermas.filter(m => !usada(m))
    const q = busqueda.trim().toLowerCase()
    if (q) {
      list = list.filter(m =>
        (m.nombre ?? '').toLowerCase().includes(q) ||
        (m.nombre_base ?? '').toLowerCase().includes(q) ||
        (m.abv ?? '').toLowerCase().includes(q) ||
        (m.categoria ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [mermas, filter, busqueda])
  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <Counter label="TOTAL" value={total} active={filter === 'todos'} onClick={() => setFilter('todos')} />
        <Counter label="EN USO" value={enUso} color={VERDE} active={filter === 'enuso'} onClick={() => toggle('enuso')} />
        <Counter label="SIN USO" value={sinUso} color={ROJO} active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
        {onNew && <button onClick={onNew} style={btnNuevo}>+ Nueva Merma</button>}
      </div>

      {busqueda.trim() && (
        <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{busqueda}"
        </div>
      )}

      <div style={{ background: CREMA, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}` }}>
        {!filtered.length ? (
          <p style={{ color: GRIS, fontFamily: LEX, textAlign: 'center', padding: 40, fontSize: 13 }}>
            Sin mermas{filter !== 'todos' ? ' en este filtro' : ''}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', minWidth: 'max-content' }}>
              <thead>
                <tr>
                  <th style={th}>IDING</th>
                  <th style={th}>NOMBRE BASE</th>
                  <th style={th}>ABV</th>
                  <th style={thR}>UDS</th>
                  <th style={th}>UD STD</th>
                  <th style={thR}>PRECIO TOTAL</th>
                  <th style={th}>SP1 NOMBRE</th>
                  <th style={thR}>SP1 PESO(G)</th>
                  <th style={thR}>SP1 %</th>
                  <th style={thR}>SP1 €</th>
                  <th style={th}>SP2 NOMBRE</th>
                  <th style={thR}>SP2 PESO(G)</th>
                  <th style={thR}>SP2 %</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => {
                  const band = bandEnUso(usada(m))
                  const bg = zebra(idx)
                  return (
                    <tr
                      key={m.id}
                      onClick={() => onSelect?.(m)}
                      style={{ cursor: onSelect ? 'pointer' : 'default', background: bg }}
                    >
                      <td style={{ ...tdCod, color: GRANATE, borderLeft: `${BAND}px solid ${band}` }}>{m.iding ?? '—'}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{m.nombre_base ?? '—'}</td>
                      <td style={{ ...tdCod, fontSize: 14 }}>{m.abv ?? '—'}</td>
                      <td style={tdNum}>{fmt(m.uds)}</td>
                      <td style={tdSub}>{m.ud_std ?? '—'}</td>
                      <td style={tdNum}>{fmt(m.precio_total)}</td>
                      <td style={{ ...td, color: '#5a4f3a' }}>{m.sp1_nombre ?? '—'}</td>
                      <td style={tdNum}>{fmt(m.sp1_peso_g, 0)}</td>
                      <td style={tdNum}>{fmtPctFracES(m.sp1_pct, 1)}</td>
                      <td style={tdNum}>{fmt(m.sp1_euros)}</td>
                      <td style={{ ...td, color: '#5a4f3a' }}>{m.sp2_nombre ?? '—'}</td>
                      <td style={tdNum}>{fmt(m.sp2_peso_g, 0)}</td>
                      <td style={tdNum}>{fmtPctFracES(m.sp2_pct, 1)}</td>
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

function Counter({ label, value, color, active, onClick }: { label: string; value: number; color?: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} type="button" style={{
      cursor: 'pointer', textAlign: 'left', minWidth: 110, padding: '10px 16px', borderRadius: 0,
      background: active ? AMA : '#ffffff', border: `2px solid ${INK}`,
      boxShadow: active ? `3px 3px 0 ${INK}` : 'none', transition: 'all 120ms',
    }}>
      <div style={{ fontFamily: OSW, fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: active ? INK : GRIS }}>{label}</div>
      <div style={{ fontFamily: OSW, fontSize: 26, fontWeight: 700, lineHeight: 1, color: color ?? INK }}>{value}</div>
    </button>
  )
}

void SHADOW; void BORDER_CARD; void CREMA
