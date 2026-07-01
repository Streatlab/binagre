import { useMemo, useRef, useState } from 'react'
import type { Merma } from './types'
import { fmt, fmtPctFracES, n } from './types'
import { INK, CREMA, OSW, VERDE, ROJO, GRANATE, GRIS } from '@/styles/neobrutal'
import { th, thR, td, tdNum, tdCod, tdSub, zebra, bandEnUso, BAND } from './estilosTabla'
import CabeceraEscandallo from './CabeceraEscandallo'

interface Props {
  mermas: Merma[]
  busqueda?: string
  onBuscar: (v: string) => void
  onSelect?: (m: Merma) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

const usada = (m: Merma) => n((m as { usos?: number }).usos) > 0 || n(m.num_porciones) > 0

export default function TabMermas({ mermas, busqueda = '', onBuscar, onSelect, onNew }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const desplazar = (dx: number) => scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' })
  const irExtremo = (fin: boolean) => { const el = scrollRef.current; if (el) el.scrollTo({ left: fin ? el.scrollWidth : 0, behavior: 'smooth' }) }

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
      <CabeceraEscandallo
        titulo="Mermas"
        busqueda={busqueda}
        onBuscar={onBuscar}
        onNew={onNew}
        nuevoLabel="+ Nueva Merma"
        scroll={{ onInicio: () => irExtremo(false), onLeft: () => desplazar(-560), onRight: () => desplazar(560), onFin: () => irExtremo(true) }}
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

      <div style={{ background: CREMA, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}`, overflow: 'hidden' }}>
        {!filtered.length ? (
          <p style={{ color: GRIS, fontFamily: OSW, textAlign: 'center', padding: 40, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase' }}>
            Sin mermas{filter !== 'todos' ? ' en este filtro' : ''}
          </p>
        ) : (
          <div ref={scrollRef} style={{ overflowX: 'auto' }}>
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

void CREMA
