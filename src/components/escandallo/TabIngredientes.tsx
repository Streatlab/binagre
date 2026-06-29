import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Ingrediente } from './types'
import { fmt, fmtPct, n, getProveedor } from './types'
import { useEsMovil } from '@/hooks/useEsMovil'
import { INK, CREMA, CLARO, SHADOW, BORDER_CARD, OSW, LEX, AMA, VERDE, ROJO, NAR, AZUL, GRANATE, GRIS } from '@/styles/neobrutal'

interface Props {
  ingredientes: Ingrediente[]
  busqueda?: string
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

// Semáforo de usos (solo móvil, banda lateral): ROJO 0 / NARANJA 1-4 / VERDE 5+
function semaforoUsos(usos: number): string {
  if (usos === 0) return ROJO
  if (usos <= 4) return NAR
  return VERDE
}

// Color estable por categoría (determinista por nombre)
const CAT_PALETTE = ['#2D5BFF', '#0FB86B', '#FF6A1A', '#B01D23', '#7A3FF2', '#0FA3B1', '#C2185B', '#5D4037', '#00897B', '#3949AB', '#8D6E00', '#D81B60']
function colorCategoria(cat: string): string {
  const s = (cat ?? '').trim()
  if (!s) return GRIS
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return CAT_PALETTE[h % CAT_PALETTE.length]
}

const ELL: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

export default function TabIngredientes({ ingredientes, busqueda = '', onSelect, onNew }: Props) {
  const movil = useEsMovil()
  const [filter, setFilter] = useState<Filter>('todos')
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  const { total, enUso, sinUso, filtered } = useMemo(() => {
    const base = ingredientes.filter(i =>
      i.abv !== 'EPS' && i.abv !== 'MRM' && (i as { tipo_merma?: string }).tipo_merma !== 'EPS'
    )
    const getUsos = (ing: Ingrediente) => n(ing.usos)
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
  }, [ingredientes, filter, busqueda])

  // Agrupación por categoría (móvil)
  const grupos = useMemo(() => {
    const m = new Map<string, Ingrediente[]>()
    for (const i of filtered) {
      const k = (i.categoria ?? '').trim() || 'Sin categoría'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(i)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.nombre_base ?? a.nombre ?? '').localeCompare(b.nombre_base ?? b.nombre ?? '', 'es'))
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [filtered])

  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)
  const toggleGrupo = (k: string) => setAbiertos(prev => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k); else next.add(k)
    return next
  })

  // ===== Tipografía alineada al Panel Global / Resumen =====
  // Cabecera: fondo tinta, texto crema, Oswald uppercase
  const th: CSSProperties = {
    fontFamily: OSW, fontSize: 11.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
    color: CREMA, padding: '11px 14px', textAlign: 'left', whiteSpace: 'nowrap',
    background: INK, position: 'sticky', top: 0,
  }
  const thR: CSSProperties = { ...th, textAlign: 'right' }
  const thC: CSSProperties = { ...th, textAlign: 'center' }
  // Celda base: Lexend, separador tenue
  const cell: CSSProperties = {
    padding: '10px 14px', borderTop: `1px solid ${INK}1a`, fontFamily: LEX, fontSize: 14, color: INK, verticalAlign: 'middle',
  }
  const cTxt: CSSProperties = { ...cell, fontSize: 13, ...ELL }
  const cNum: CSSProperties = { ...cell, textAlign: 'right', fontFamily: OSW, fontWeight: 600, fontSize: 13.5, color: INK, whiteSpace: 'nowrap' }

  // Fila compacta de 1 línea (móvil): nombre + precio. Tap = ficha.
  const filaCompacta = (i: Ingrediente, conBorde: boolean) => {
    const usos = n(i.usos)
    return (
      <button
        key={i.id}
        onClick={() => onSelect?.(i)}
        style={{
          textAlign: 'left', width: '100%', background: 'transparent', border: 'none',
          borderLeft: `10px solid ${semaforoUsos(usos)}`,
          borderBottom: conBorde ? `2px solid ${INK}` : 'none',
          padding: '12px 13px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', gap: 10, cursor: 'pointer',
        }}
      >
        <span style={{ fontFamily: LEX, fontSize: 14, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {i.nombre_base ?? i.nombre ?? '—'}
        </span>
        <span style={{ fontFamily: OSW, fontSize: 16, fontWeight: 700, color: GRANATE, flexShrink: 0 }}>{fmt(i.precio_activo ?? i.ultimo_precio)}</span>
      </button>
    )
  }

  const chevron = (open: boolean) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.5"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )

  // ===== SHELL neobrutal (mismo lenguaje que el modal): crema + borde 4px + cabecera AMA =====
  return (
    <div style={{ background: CREMA, border: `4px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, borderRadius: 0 }}>

      {/* Cabecera AMA con título + pastillas-filtro + Nuevo */}
      <div style={{ background: AMA, borderBottom: `4px solid ${INK}`, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1, letterSpacing: '-0.5px', textTransform: 'uppercase', color: INK }}>Ingredientes</span>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <Pill label="Total"   value={total}  bg={INK}   fg={CREMA} active={filter === 'todos'}  onClick={() => setFilter('todos')} />
            <Pill label="En uso"  value={enUso}  bg={VERDE} fg="#fff"  active={filter === 'enuso'}  onClick={() => toggle('enuso')} />
            <Pill label="Sin uso" value={sinUso} bg={ROJO}  fg="#fff"  active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
          </div>
        </div>
        {onNew && (
          <button onClick={onNew} style={{
            fontFamily: OSW, fontWeight: 700, fontSize: 14, letterSpacing: '1px', textTransform: 'uppercase',
            background: VERDE, color: '#fff', border: `2px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`,
            padding: '10px 22px', cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: 0,
          }}>+ Nuevo</button>
        )}
      </div>

      {/* Cuerpo */}
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {busqueda.trim() && (
          <div style={{ fontFamily: LEX, fontSize: 13, color: '#6b5d45' }}>
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{busqueda}"
          </div>
        )}

        {!filtered.length ? (
          <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: SHADOW }}>
            <p style={{ color: GRIS, fontFamily: LEX, textAlign: 'center', padding: 40, fontSize: 13 }}>
              Sin ingredientes{filter !== 'todos' ? ' en este filtro' : ''}
            </p>
          </div>
        ) : movil ? (
          /* ===== MÓVIL ===== */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {busqueda.trim() ? (
              <div style={{ background: '#ffffff', border: BORDER_CARD, boxShadow: SHADOW, overflow: 'hidden' }}>
                {filtered.map((i, idx) => filaCompacta(i, idx < filtered.length - 1))}
              </div>
            ) : (
              grupos.map(([cat, items]) => {
                const open = abiertos.has(cat)
                return (
                  <div key={cat} style={{ background: '#ffffff', border: `2px solid ${INK}`, boxShadow: open ? SHADOW : 'none', overflow: 'hidden' }}>
                    <button
                      onClick={() => toggleGrupo(cat)}
                      style={{ width: '100%', background: open ? CLARO : '#fff', border: 'none', cursor: 'pointer',
                        padding: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        {chevron(open)}
                        <span style={{ width: 11, height: 11, background: colorCategoria(cat), border: `1.5px solid ${INK}`, flexShrink: 0 }} />
                        <span style={{ fontFamily: OSW, fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                      </span>
                      <span style={{ fontFamily: OSW, fontSize: 12, fontWeight: 700, color: INK, background: CLARO, border: `1.5px solid ${INK}`, padding: '2px 9px', flexShrink: 0 }}>{items.length}</span>
                    </button>
                    {open && (
                      <div style={{ borderTop: `2px solid ${INK}` }}>
                        {items.map((i, idx) => filaCompacta(i, idx < items.length - 1))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        ) : (
          /* ===== ESCRITORIO: tabla como bloque neobrutal ===== */
          <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: SHADOW }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: 1760 }}>
                <colgroup>
                  <col style={{ width: 220 }} />
                  <col style={{ width: 200 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 60 }} />
                  <col style={{ width: 64 }} />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 84 }} />
                  <col style={{ width: 84 }} />
                  <col style={{ width: 84 }} />
                  <col style={{ width: 96 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 84 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 100 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={th}>Ingrediente</th>
                    <th style={th}>Proveedor</th>
                    <th style={th}>Categoría</th>
                    <th style={th}>Formato</th>
                    <th style={thC}>Usos</th>
                    <th style={thR}>Uds</th>
                    <th style={th}>Ud std</th>
                    <th style={th}>Ud min</th>
                    <th style={thR}>Precio 1</th>
                    <th style={thR}>Precio 2</th>
                    <th style={thR}>Precio 3</th>
                    <th style={thR}>P. activo €</th>
                    <th style={thR}>EUR / STD</th>
                    <th style={thR}>EUR / MIN</th>
                    <th style={thR}>Merma %</th>
                    <th style={thR}>C. neto STD</th>
                    <th style={thR}>C. neto MIN</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i, idx) => {
                    const usos = n(i.usos)
                    const cc = colorCategoria(i.categoria ?? '')
                    const zebra = idx % 2 ? '#fbf8f1' : '#ffffff'
                    return (
                      <tr
                        key={i.id}
                        onClick={() => onSelect?.(i)}
                        style={{ cursor: onSelect ? 'pointer' : 'default', background: zebra }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#faf4e6')}
                        onMouseLeave={e => (e.currentTarget.style.background = zebra)}
                      >
                        <td style={{ ...cell, ...ELL }}>
                          <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '0.4px', color: GRIS, marginRight: 7 }}>{i.iding ?? ''}</span>
                          <span style={{ fontFamily: LEX, fontSize: 15, fontWeight: 700, color: INK }}>{i.nombre_base ?? i.nombre ?? '—'}</span>
                        </td>
                        <td style={{ ...cell, ...ELL }}>
                          <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12.5, color: AZUL }}>{i.abv ?? '—'}</span>
                          <span style={{ fontFamily: LEX, fontSize: 13, color: '#5a4f3a' }}> · {getProveedor(i.abv) || '—'}{i.marca ? ' · ' + i.marca : ''}</span>
                        </td>
                        <td style={cell}>
                          <span style={{ display: 'inline-block', maxWidth: '100%', background: cc + '26', border: `1.5px solid ${cc}`, color: INK, fontFamily: LEX, fontSize: 12.5, fontWeight: 600, padding: '3px 9px', ...ELL }}>{i.categoria ?? '—'}</span>
                        </td>
                        <td style={cTxt}>{i.formato ?? '—'}</td>
                        <td style={{ ...cell, textAlign: 'center', fontFamily: OSW, fontWeight: 700, fontSize: 16, color: usos === 0 ? GRIS : INK }}>{usos}</td>
                        <td style={{ ...cell, textAlign: 'right', fontFamily: OSW, fontWeight: 700, fontSize: 15, color: INK }}>{fmt(i.uds)}</td>
                        <td style={cTxt}>{i.ud_std ?? '—'}</td>
                        <td style={cTxt}>{i.ud_min ?? '—'}</td>
                        <td style={cNum}>{i.precio1 ? fmt(i.precio1) : '—'}</td>
                        <td style={cNum}>{i.precio2 ? fmt(i.precio2) : '—'}</td>
                        <td style={cNum}>{i.precio3 ? fmt(i.precio3) : '—'}</td>
                        <td style={{ ...cell, textAlign: 'right', fontFamily: OSW, fontWeight: 700, fontSize: 17, letterSpacing: '-0.5px', color: GRANATE, whiteSpace: 'nowrap' }}>{fmt(i.precio_activo ?? i.ultimo_precio)}</td>
                        <td style={cNum}>{i.eur_std ? fmt(i.eur_std) : '—'}</td>
                        <td style={cNum}>{i.eur_min ? fmt(i.eur_min) : '—'}</td>
                        <td style={{ ...cNum, color: i.merma_pct ? NAR : GRIS }}>{i.merma_pct ? fmtPct(i.merma_pct) : '—'}</td>
                        <td style={cNum}>{i.coste_neto_std ? fmt(i.coste_neto_std) : '—'}</td>
                        <td style={cNum}>{i.coste_neto_min ? fmt(i.coste_neto_min) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Pill({ label, value, bg, fg, active, onClick }: { label: string; value: number; bg: string; fg: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} type="button" style={{
      cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 8,
      background: bg, color: fg, border: `2px solid ${INK}`, boxShadow: active ? `3px 3px 0 ${INK}` : 'none',
      padding: '7px 14px', borderRadius: 0,
      outline: active ? `3px solid ${AMA}` : 'none', outlineOffset: '-3px',
      transition: 'all 120ms',
    }}>
      <span style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: fg, opacity: 0.92 }}>{label}</span>
      <span style={{ fontFamily: OSW, fontSize: 20, fontWeight: 700, lineHeight: 1, color: fg }}>{value}</span>
    </button>
  )
}
