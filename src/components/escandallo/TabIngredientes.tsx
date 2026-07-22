import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Ingrediente } from './types'
import { fmt, fmtPct, n, getProveedor } from './types'
import { fmtNum } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import { useMultiSort } from '@/hooks/useMultiSort'
import { INK, CREMA, CLARO, OSW, VERDE, ROJO, NAR, GRANATE, GRIS, AMA, AMA_S } from '@/styles/neobrutal'
import { th, thR, thC, td, tdNum, tdSub, tdCod, zebra, bandUsos, BAND } from './estilosTabla'
import CabeceraEscandallo, { btnSecundarioEsc } from './CabeceraEscandallo'

interface Props {
  ingredientes: Ingrediente[]
  busqueda?: string
  onBuscar: (v: string) => void
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
  /** Abre el editor de categorías de ingredientes (fuente única, compartida con Config). */
  onOpenCategorias?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'
const PAGE_SIZE = 60

const colorUsos = (usos: number) => bandUsos(usos)
const esUltimo = (sel?: string | null) => !/media/i.test(sel ?? 'Último')
const labelSelector = (sel?: string | null) => (esUltimo(sel) ? 'Último' : 'Media')

/** Valores derivados (precio activo, eur/std…) — se reutiliza en tbody Y en la ordenación. */
function derivar(i: Ingrediente, usos: number) {
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
  return { p1, p2, p3, ultimoAuto, precioActivo, eurStd, eurMin, costeNetoStd, costeNetoMin, usos }
}

export default function TabIngredientes({ ingredientes, busqueda = '', onBuscar, onSelect, onNew, onOpenCategorias }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')
  const [usosMap, setUsosMap] = useState<Record<string, number>>({})
  const [page, setPage] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const desplazar = (dx: number) => scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' })
  const irExtremo = (fin: boolean) => { const el = scrollRef.current; if (el) el.scrollTo({ left: fin ? el.scrollWidth : 0, behavior: 'smooth' }) }

  const getUsos = (ing: Ingrediente) => usosMap[String(ing.id)] ?? n(ing.usos)

  // B2: contador de usos con UNA query agregada (no N+1), reutilizado por todas las filas.
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

  // B8: ordenación multi-criterio canónica (mismo hook que las tablas de Papeleo).
  const GETTERS: Record<string, (i: Ingrediente) => string | number> = useMemo(() => ({
    iding: i => i.iding ?? '', categoria: i => i.categoria ?? '', nombre_base: i => i.nombre_base ?? '',
    abv: i => i.abv ?? '', nombre: i => i.nombre ?? '', proveedor: i => getProveedor(i.abv) ?? '',
    marca: i => i.marca ?? '', formato: i => i.formato ?? '', uds: i => n(i.uds), ud_std: i => i.ud_std ?? '',
    ud_min: i => i.ud_min ?? '', usos: i => getUsos(i), precio1: i => n(i.precio1), precio2: i => n(i.precio2),
    precio3: i => n(i.precio3), ultimo: i => derivar(i, getUsos(i)).ultimoAuto, selector: i => labelSelector(i.selector_precio),
    activo: i => derivar(i, getUsos(i)).precioActivo, eur_std: i => derivar(i, getUsos(i)).eurStd,
    eur_min: i => derivar(i, getUsos(i)).eurMin, merma: i => n(i.merma_pct), merma_ef: i => n(i.merma_ef),
    cneto_std: i => derivar(i, getUsos(i)).costeNetoStd, cneto_min: i => derivar(i, getUsos(i)).costeNetoMin,
  }), [usosMap])
  const sort = useMultiSort<Ingrediente>({ getValue: (row, col) => GETTERS[col]?.(row) })

  const { total, enUso, sinUso, filtered } = useMemo(() => {
    const base = ingredientes.filter(i =>
      i.abv !== 'EPS' && i.abv !== 'MRM' && (i as { tipo_merma?: string }).tipo_merma !== 'EPS'
    )
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
    return { total: totalCount, enUso: enUsoCount, sinUso: totalCount - enUsoCount, filtered: sort.applySorts(filteredList) }
  }, [ingredientes, usosMap, filter, busqueda, sort.sortsKey])

  // B3: paginación en cliente — solo se pinta la página actual (evita 989×29 celdas de golpe).
  const nPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, nPages - 1)
  useEffect(() => { setPage(0) }, [filter, busqueda, sort.sortsKey])
  const visibles = filtered.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE)

  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  const stickyIding = (usos: number, bg: string): CSSProperties => ({
    ...tdCod, color: GRANATE, position: 'sticky', left: 0, zIndex: 4, background: bg,
    borderLeft: `${BAND}px solid ${colorUsos(usos)}`, borderRight: `2px solid ${INK}`, cursor: 'pointer',
  })
  const thIding: CSSProperties = { ...th, position: 'sticky', left: 0, zIndex: 30, borderRight: `2px solid ${INK}`, cursor: 'pointer' }

  // Encabezado ordenable con el look neobrutal del Escandallo (reusa el hook de Papeleo).
  const SortTh = ({ col, label, base = th }: { col: string; label: ReactNode; base?: CSSProperties }) => (
    <th style={{ ...base, cursor: 'pointer', userSelect: 'none' }} onClick={() => sort.toggleSort(col)} title="Pulsa para ordenar">
      {label}{sort.sortIndicator(col)}
    </th>
  )
  const tip = (v: ReactNode): string | undefined => (typeof v === 'string' ? v : undefined)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <CabeceraEscandallo
        titulo="Ingredientes"
        busqueda={busqueda}
        onBuscar={onBuscar}
        onNew={onNew}
        nuevoLabel="+ Nuevo"
        scroll={{ onInicio: () => irExtremo(false), onLeft: () => desplazar(-620), onRight: () => desplazar(620), onFin: () => irExtremo(true) }}
        extra={onOpenCategorias && <button onClick={onOpenCategorias} style={btnSecundarioEsc}>Categorías</button>}
        pills={[
          { label: 'Total', value: total, active: filter === 'todos', onClick: () => setFilter('todos') },
          { label: 'En uso', value: enUso, color: VERDE, active: filter === 'enuso', onClick: () => toggle('enuso') },
          { label: 'Sin uso', value: sinUso, color: ROJO, active: filter === 'sinuso', onClick: () => toggle('sinuso') },
        ]}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {busqueda.trim() && (
          <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '.5px', textTransform: 'uppercase', color: GRIS }}>
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{busqueda}"
          </span>
        )}
        {sort.showClearButton && (
          <button onClick={sort.clearSorts} style={{ fontFamily: OSW, fontWeight: 700, fontSize: 11, letterSpacing: '.5px', textTransform: 'uppercase', background: 'var(--sl-card)', border: `2px solid ${INK}`, padding: '4px 10px', cursor: 'pointer', color: INK }}>✕ Limpiar orden</button>
        )}
      </div>

      {!filtered.length ? (
        <div style={{ background: CREMA, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}`, padding: 40, textAlign: 'center' }}>
          <p style={{ color: GRIS, fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', margin: 0 }}>Sin ingredientes{filter !== 'todos' ? ' en este filtro' : ''}</p>
        </div>
      ) : (
        <div style={{ background: CREMA, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}`, overflow: 'hidden' }}>
          <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 320px)', width: '100%' }}>
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
                  <SortTh col="iding" label="IDING" base={thIding} />
                  <SortTh col="categoria" label="CATEGORÍA" />
                  <SortTh col="nombre_base" label="NOMBRE BASE" />
                  <SortTh col="abv" label="ABV" />
                  <SortTh col="nombre" label="NOMBRE" />
                  <SortTh col="proveedor" label="PROVEEDOR" />
                  <SortTh col="marca" label="MARCA" />
                  <SortTh col="formato" label="FORMATO" />
                  <SortTh col="uds" label="UDS" base={thR} />
                  <SortTh col="ud_std" label="UD STD" />
                  <SortTh col="ud_min" label="UD MIN" />
                  <SortTh col="usos" label="USOS" base={thC} />
                  <SortTh col="precio1" label="PRECIO 1" base={thR} />
                  <SortTh col="precio2" label="PRECIO 2" base={thR} />
                  <SortTh col="precio3" label="PRECIO 3" base={thR} />
                  <SortTh col="ultimo" label="ÚLTIMO" base={thR} />
                  <SortTh col="selector" label="SELECTOR" base={thC} />
                  <SortTh col="activo" label="ACTIVO" base={thR} />
                  <SortTh col="eur_std" label="EUR/STD" base={thR} />
                  <th style={th}>UD/STD</th>
                  <SortTh col="eur_min" label="EUR/MIN" base={thR} />
                  <th style={th}>UD/MIN</th>
                  <th style={th}>TIPO MERMA</th>
                  <SortTh col="merma" label="MERMA %" base={thR} />
                  <SortTh col="merma_ef" label="MERMA EF." base={thR} />
                  <SortTh col="cneto_std" label="C.NETO/STD" base={thR} />
                  <th style={th}>UD/NETO STD</th>
                  <SortTh col="cneto_min" label="C.NETO/MIN" base={thR} />
                  <th style={th}>UD/NETO MIN</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((i, idx) => {
                  const usos = getUsos(i)
                  const bg = zebra(idx)
                  const d = derivar(i, usos)
                  const cell: CSSProperties = { ...td, background: bg }
                  const numCell: CSSProperties = { ...tdNum, background: bg }
                  const subCell: CSSProperties = { ...tdSub, background: bg }
                  // A3: campo vacío/por revisar → fondo ámbar suave + aviso.
                  const vacio = (v: unknown) => v == null || String(v).trim() === '' || n(v as number) === 0
                  const amber = (baseSt: CSSProperties, malo: boolean): CSSProperties => malo ? { ...baseSt, background: AMA_S } : baseSt
                  const rev = (v: ReactNode, malo: boolean) => malo ? <span title="Falta por completar">⚠ {v}</span> : v
                  const catV = vacio(i.categoria), formV = vacio(i.formato), udStdV = vacio(i.ud_std), udsV = vacio(i.uds)
                  return (
                    <tr key={i.id} onClick={() => onSelect?.(i)} style={{ cursor: 'pointer' }}>
                      <td style={stickyIding(usos, bg)} title={i.iding ?? undefined}>{i.iding ?? '—'}</td>
                      <td style={amber(subCell, catV)} title={tip(i.categoria)}>{rev(i.categoria ?? '—', catV)}</td>
                      <td style={{ ...cell, fontWeight: 700 }} title={tip(i.nombre_base)}>{i.nombre_base ?? '—'}</td>
                      <td style={{ ...tdCod, background: bg, color: '#2D5BFF' }}>{i.abv ?? '—'}</td>
                      <td style={cell} title={tip(i.nombre)}>{i.nombre}</td>
                      <td style={{ ...cell, color: '#5a4f3a' }} title={getProveedor(i.abv) || undefined}>{getProveedor(i.abv) || '—'}</td>
                      <td style={{ ...cell, color: '#5a4f3a' }} title={tip(i.marca)}>{i.marca ?? '—'}</td>
                      <td style={amber({ ...cell, color: '#5a4f3a' }, formV)} title={tip(i.formato)}>{rev(i.formato ?? '—', formV)}</td>
                      <td style={amber(numCell, udsV)}>{udsV ? '⚠' : fmt(i.uds)}</td>
                      <td style={amber(subCell, udStdV)}>{rev(i.ud_std ?? '—', udStdV)}</td>
                      <td style={subCell}>{i.ud_min ?? '—'}</td>
                      <td style={{ ...cell, textAlign: 'center', fontFamily: OSW, fontWeight: 700, fontSize: 16, color: colorUsos(usos) }}>{usos}</td>
                      <td style={{ ...numCell, color: '#5a4f3a' }}>{d.p1 ? fmt(d.p1) : '—'}</td>
                      <td style={{ ...numCell, color: '#5a4f3a' }}>{d.p2 ? fmt(d.p2) : '—'}</td>
                      <td style={{ ...numCell, color: '#5a4f3a' }}>{d.p3 ? fmt(d.p3) : '—'}</td>
                      <td style={numCell}>{d.ultimoAuto ? fmt(d.ultimoAuto) : '—'}</td>
                      <td style={{ ...cell, textAlign: 'center' }}>
                        <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '0.5px', background: CLARO, border: `2px solid ${INK}`, padding: '2px 8px', color: INK }}>{labelSelector(i.selector_precio)}</span>
                      </td>
                      <td style={{ ...numCell, color: GRANATE }}>{d.precioActivo ? fmt(d.precioActivo) : '—'}</td>
                      <td style={numCell}>{d.eurStd ? fmtNum(d.eurStd) : '—'}</td>
                      <td style={subCell}>{i.ud_std ?? '—'}</td>
                      <td style={numCell}>{d.eurMin ? fmtNum(d.eurMin) : '—'}</td>
                      <td style={subCell}>{i.ud_min ?? '—'}</td>
                      <td style={{ ...subCell, color: '#5a4f3a' }}>{i.tipo_merma ?? '—'}</td>
                      <td style={{ ...numCell, color: i.tipo_merma === 'Tecnica' ? GRIS : INK }}>{i.merma_pct != null ? fmtPct(i.merma_pct) : '—'}</td>
                      <td style={{ ...numCell, color: NAR }}>{i.merma_ef != null ? fmtNum(i.merma_ef) : '—'}</td>
                      <td style={numCell}>{d.costeNetoStd ? fmtNum(d.costeNetoStd) : '—'}</td>
                      <td style={subCell}>{i.ud_neto_std ?? i.ud_std ?? '—'}</td>
                      <td style={numCell}>{d.costeNetoMin ? fmtNum(d.costeNetoMin) : '—'}</td>
                      <td style={subCell}>{i.ud_neto_min ?? i.ud_min ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* B3: paginador */}
          {nPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '10px', borderTop: `3px solid ${INK}`, background: CREMA }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pageSafe === 0} style={pagBtn(pageSafe === 0)}>◀ Anterior</button>
              <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, color: INK }}>
                Página {pageSafe + 1} de {nPages} <span style={{ color: GRIS, fontWeight: 400 }}>· {filtered.length} ingredientes</span>
              </span>
              <button onClick={() => setPage(p => Math.min(nPages - 1, p + 1))} disabled={pageSafe >= nPages - 1} style={pagBtn(pageSafe >= nPages - 1)}>Siguiente ▶</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const pagBtn = (disabled: boolean): CSSProperties => ({
  fontFamily: OSW, fontWeight: 700, fontSize: 12, letterSpacing: '.5px', textTransform: 'uppercase',
  background: disabled ? 'transparent' : AMA, color: INK, border: `2px solid ${INK}`,
  boxShadow: disabled ? 'none' : `2px 2px 0 ${INK}`, padding: '6px 12px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
})
