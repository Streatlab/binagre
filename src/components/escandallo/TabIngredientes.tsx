import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Ingrediente } from './types'
import { fmt, fmtPct, n, getProveedor } from './types'
import { fmtNum } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import { INK, CREMA, CLARO, OSW, VERDE, ROJO, NAR, GRANATE, GRIS } from '@/styles/neobrutal'
import { th, thR, thC, td, tdNum, tdSub, tdCod, zebra, bandUsos, BAND } from './estilosTabla'
import CabeceraEscandallo from './CabeceraEscandallo'

interface Props {
  ingredientes: Ingrediente[]
  busqueda?: string
  onBuscar: (v: string) => void
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

const colorUsos = (usos: number) => bandUsos(usos)
const esUltimo = (sel?: string | null) => !/media/i.test(sel ?? 'Último')
const labelSelector = (sel?: string | null) => (esUltimo(sel) ? 'Último' : 'Media')

export default function TabIngredientes({ ingredientes, busqueda = '', onBuscar, onSelect, onNew }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')
  const [usosMap, setUsosMap] = useState<Record<string, number>>({})
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const desplazar = (dx: number) => scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' })
  const irExtremo = (fin: boolean) => { const el = scrollRef.current; if (el) el.scrollTo({ left: fin ? el.scrollWidth : 0, behavior: 'smooth' }) }

  useEffect(() => {
    const load = async () => {
      const [{ data: epsL }, { data: recL }] = await Promise.all([
        supabase.from('eps_lineas').select('ingrediente_id'),
        supabase.from('recetas_lineas').select('ingrediente_id'),
      ])
      const conteo: Record<string, number> = {}
      ;[...(epsL ?? []), ...(recL ?? [])].forEach((u: { ingrediente_id: string | null }) => {
        if (!u.ingrediente_id) return
        const id = String(u.ingrediente_id)
        conteo[id] = (conteo[id] ?? 0) + 1
      })
      setUsosMap(conteo)
    }
    load()
  }, [ingredientes])

  const { total, enUso, sinUso, filtered } = useMemo(() => {
    const base = ingredientes.filter(i =>
      i.abv !== 'EPS' && i.abv !== 'MRM' && (i as { tipo_merma?: string }).tipo_merma !== 'EPS'
    )
    const getUsos = (ing: Ingrediente) => usosMap[String(ing.id)] ?? n(ing.usos)
    const totalCount = base.length
    const enUsoCount = base.filter(i => getUsos(i) > 0).length
    let filteredList = base
    if (filter === 'enuso') filteredList = base.filter(i => getUsos(i) > 0)
    else if (filter === 'sinuso') filteredList = base.filter(i => getUsos(i) === 0)
    const q = busqueda.trim().toLowerCase()
    if (q) {
      filteredList = filteredList.filter(i =>
        (i.nombre ?? '').toLowerCase().includes(q) ||
        (i.nombre_base ?? '').toLowerCase().includes(q) ||
        (i.categoria ?? '').toLowerCase().includes(q) ||
        (i.abv ?? '').toLowerCase().includes(q) ||
        (i.marca ?? '').toLowerCase().includes(q) ||
        (i.formato ?? '').toLowerCase().includes(q)
      )
    }
    return { total: totalCount, enUso: enUsoCount, sinUso: totalCount - enUsoCount, filtered: filteredList }
  }, [ingredientes, usosMap, filter, busqueda])

  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  // IDING sticky (columna congelada) con su banda de estado
  const stickyIding = (usos: number, bg: string): CSSProperties => ({
    ...tdCod, color: GRANATE, position: 'sticky', left: 0, zIndex: 4, background: bg,
    borderLeft: `${BAND}px solid ${colorUsos(usos)}`, borderRight: `2px solid ${INK}`, cursor: 'pointer',
  })
  const thIding: CSSProperties = { ...th, position: 'sticky', left: 0, zIndex: 30, borderRight: `2px solid ${INK}` }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <CabeceraEscandallo
        titulo="Ingredientes"
        busqueda={busqueda}
        onBuscar={onBuscar}
        onNew={onNew}
        nuevoLabel="+ Nuevo"
        scroll={{ onInicio: () => irExtremo(false), onLeft: () => desplazar(-620), onRight: () => desplazar(620), onFin: () => irExtremo(true) }}
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

      {!filtered.length ? (
        <div style={{ background: CREMA, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}`, padding: 40, textAlign: 'center' }}>
          <p style={{ color: GRIS, fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', margin: 0 }}>Sin ingredientes{filter !== 'todos' ? ' en este filtro' : ''}</p>
        </div>
      ) : (
        <div style={{ background: CREMA, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}`, overflow: 'hidden' }}>
          <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)', width: '100%' }}>
            <table style={{ tableLayout: 'fixed', width: '2968px', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: 96 }} /><col style={{ width: 175 }} /><col style={{ width: 210 }} /><col style={{ width: 60 }} />
                <col style={{ width: 250 }} /><col style={{ width: 140 }} /><col style={{ width: 120 }} /><col style={{ width: 120 }} />
                <col style={{ width: 60 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} /><col style={{ width: 60 }} />
                <col style={{ width: 90 }} /><col style={{ width: 90 }} /><col style={{ width: 90 }} /><col style={{ width: 95 }} />
                <col style={{ width: 92 }} /><col style={{ width: 90 }} /><col style={{ width: 85 }} /><col style={{ width: 85 }} />
                <col style={{ width: 85 }} /><col style={{ width: 75 }} /><col style={{ width: 100 }} /><col style={{ width: 85 }} />
                <col style={{ width: 85 }} /><col style={{ width: 100 }} /><col style={{ width: 95 }} /><col style={{ width: 100 }} /><col style={{ width: 95 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={thIding}>IDING</th>
                  <th style={th}>CATEGORÍA</th>
                  <th style={th}>NOMBRE BASE</th>
                  <th style={th}>ABV</th>
                  <th style={th}>NOMBRE</th>
                  <th style={th}>PROVEEDOR</th>
                  <th style={th}>MARCA</th>
                  <th style={th}>FORMATO</th>
                  <th style={thR}>UDS</th>
                  <th style={th}>UD STD</th>
                  <th style={th}>UD MIN</th>
                  <th style={thC}>USOS</th>
                  <th style={thR}>PRECIO 1</th>
                  <th style={thR}>PRECIO 2</th>
                  <th style={thR}>PRECIO 3</th>
                  <th style={thR}>ÚLTIMO</th>
                  <th style={thC}>SELECTOR</th>
                  <th style={thR}>ACTIVO</th>
                  <th style={thR}>EUR/STD</th>
                  <th style={th}>UD/STD</th>
                  <th style={thR}>EUR/MIN</th>
                  <th style={th}>UD/MIN</th>
                  <th style={th}>TIPO MERMA</th>
                  <th style={thR}>MERMA %</th>
                  <th style={thR}>MERMA EF.</th>
                  <th style={thR}>C.NETO/STD</th>
                  <th style={th}>UD/NETO STD</th>
                  <th style={thR}>C.NETO/MIN</th>
                  <th style={th}>UD/NETO MIN</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i, idx) => {
                  const usos = usosMap[String(i.id)] ?? n(i.usos)
                  const bg = zebra(idx)
                  const p1 = n(i.precio1), p2 = n(i.precio2), p3 = n(i.precio3)
                  const ultimoAuto = p3 || p2 || p1
                  const preciosArr = [p1, p2, p3].filter(p => p > 0)
                  const media = preciosArr.length ? preciosArr.reduce((a, b) => a + b, 0) / preciosArr.length : 0
                  const precioActivo = esUltimo(i.selector_precio) ? ultimoAuto : media
                  const udsN = n(i.uds)
                  const mermaN = n(i.merma_pct)
                  const eurStd = udsN > 0 ? precioActivo / udsN : 0
                  const ud = (i.ud_std ?? '').toLowerCase()
                  const factor = ud.startsWith('kg') || ud.startsWith('l') ? 1000 : (i.ud_std === 'Docena' ? 12 : 1)
                  const eurMin = eurStd / factor
                  const costeNetoStd = mermaN > 0 && mermaN < 100 ? eurStd / (1 - mermaN / 100) : eurStd
                  const costeNetoMin = costeNetoStd / factor
                  const cell: CSSProperties = { ...td, background: bg }
                  const numCell: CSSProperties = { ...tdNum, background: bg }
                  const subCell: CSSProperties = { ...tdSub, background: bg }
                  return (
                    <tr key={i.id} onClick={() => onSelect?.(i)} style={{ cursor: 'pointer' }}>
                      <td style={stickyIding(usos, bg)}>{i.iding ?? '—'}</td>
                      <td style={subCell}>{i.categoria ?? '—'}</td>
                      <td style={{ ...cell, fontWeight: 700 }}>{i.nombre_base ?? '—'}</td>
                      <td style={{ ...tdCod, background: bg, color: '#2D5BFF' }}>{i.abv ?? '—'}</td>
                      <td style={cell}>{i.nombre}</td>
                      <td style={{ ...cell, color: '#5a4f3a' }}>{getProveedor(i.abv) || '—'}</td>
                      <td style={{ ...cell, color: '#5a4f3a' }}>{i.marca ?? '—'}</td>
                      <td style={{ ...cell, color: '#5a4f3a' }}>{i.formato ?? '—'}</td>
                      <td style={numCell}>{fmt(i.uds)}</td>
                      <td style={subCell}>{i.ud_std ?? '—'}</td>
                      <td style={subCell}>{i.ud_min ?? '—'}</td>
                      <td style={{ ...cell, textAlign: 'center', fontFamily: OSW, fontWeight: 700, fontSize: 16, color: colorUsos(usos) }}>{usos}</td>
                      <td style={{ ...numCell, color: '#5a4f3a' }}>{p1 ? fmt(p1) : '—'}</td>
                      <td style={{ ...numCell, color: '#5a4f3a' }}>{p2 ? fmt(p2) : '—'}</td>
                      <td style={{ ...numCell, color: '#5a4f3a' }}>{p3 ? fmt(p3) : '—'}</td>
                      <td style={numCell}>{ultimoAuto ? fmt(ultimoAuto) : '—'}</td>
                      <td style={{ ...cell, textAlign: 'center' }}>
                        <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '0.5px', background: CLARO, border: `2px solid ${INK}`, padding: '2px 8px', color: INK }}>{labelSelector(i.selector_precio)}</span>
                      </td>
                      <td style={{ ...numCell, color: GRANATE }}>{precioActivo ? fmt(precioActivo) : '—'}</td>
                      <td style={numCell}>{eurStd ? fmtNum(eurStd) : '—'}</td>
                      <td style={subCell}>{i.ud_std ?? '—'}</td>
                      <td style={numCell}>{eurMin ? fmtNum(eurMin) : '—'}</td>
                      <td style={subCell}>{i.ud_min ?? '—'}</td>
                      <td style={{ ...subCell, color: '#5a4f3a' }}>{i.tipo_merma ?? '—'}</td>
                      <td style={{ ...numCell, color: i.tipo_merma === 'Tecnica' ? GRIS : INK }}>{i.merma_pct != null ? fmtPct(i.merma_pct) : '—'}</td>
                      <td style={{ ...numCell, color: NAR }}>{i.merma_ef != null ? fmtNum(i.merma_ef) : '—'}</td>
                      <td style={numCell}>{costeNetoStd ? fmtNum(costeNetoStd) : '—'}</td>
                      <td style={subCell}>{i.ud_neto_std ?? i.ud_std ?? '—'}</td>
                      <td style={numCell}>{costeNetoMin ? fmtNum(costeNetoMin) : '—'}</td>
                      <td style={subCell}>{i.ud_neto_min ?? i.ud_min ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
