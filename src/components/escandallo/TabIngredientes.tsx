import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Ingrediente } from './types'
import { fmt, n, getProveedor } from './types'
import { useEsMovil } from '@/hooks/useEsMovil'
import { INK, CREMA, CLARO, SHADOW, BORDER_CARD, OSW, LEX, AMA, VERDE, ROJO, NAR, AZUL, GRANATE, GRIS } from '@/styles/neobrutal'

interface Props {
  ingredientes: Ingrediente[]
  busqueda?: string
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

// Semáforo de usos: ROJO 0 / NARANJA 1-4 / VERDE 5+
function semaforoUsos(usos: number): string {
  if (usos === 0) return ROJO
  if (usos <= 4) return NAR
  return VERDE
}

// Color estable por categoría (cada categoría su color, determinista por nombre)
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

  // Cabecera tinta (texto crema)
  const thStyle: CSSProperties = {
    fontFamily: OSW, fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase',
    color: CREMA, padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap',
    background: INK, position: 'sticky', top: 0, borderRight: `2px solid #4a3f2c`,
  }
  const thL: CSSProperties = { ...thStyle, textAlign: 'left', paddingLeft: 14 }
  const thC: CSSProperties = { ...thStyle, textAlign: 'center' }

  // Celdas compactas, separador tenue, texto legible
  const cBase: CSSProperties = {
    borderTop: `1px solid rgba(20,15,8,.14)`, borderRight: `1px solid rgba(20,15,8,.10)`,
    padding: '7px 10px', fontFamily: LEX, fontSize: 14, color: INK,
  }
  const cNum: CSSProperties = { ...cBase, fontFamily: OSW, fontWeight: 700, fontSize: 17, textAlign: 'right' }
  const cTxt: CSSProperties = { ...cBase, fontSize: 14, textAlign: 'left', ...ELL }

  // Fila compacta de 1 línea (móvil): nombre + semáforo + precio. Tap = ficha.
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

  // Tira de filtros: chips contadores sólidos
  const Chips = (
    <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', gap: 0, border: `3px solid ${INK}`, boxShadow: SHADOW, background: '#fff' }}>
      <Chip label="TOTAL" value={total} bg={INK} fg={CREMA} active={filter === 'todos'} onClick={() => setFilter('todos')} />
      <Chip label="EN USO" value={enUso} bg={VERDE} fg="#fff" active={filter === 'enuso'} onClick={() => toggle('enuso')} />
      <Chip label="SIN USO" value={sinUso} bg={ROJO} fg="#fff" active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
      <div style={{ flex: 1, minWidth: 12 }} />
      {onNew && (
        <button onClick={onNew} style={{
          fontFamily: OSW, fontWeight: 700, fontSize: 14, letterSpacing: '1px', textTransform: 'uppercase',
          background: VERDE, color: '#fff', border: 'none', borderLeft: `3px solid ${INK}`,
          padding: '0 22px', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>+ Nuevo</button>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Chips}

      {busqueda.trim() && (
        <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{busqueda}"
        </div>
      )}

      {!filtered.length ? (
        <div style={{ background: '#fff', border: `5px solid ${INK}`, boxShadow: '7px 7px 0 ' + INK }}>
          <p style={{ color: GRIS, fontFamily: LEX, textAlign: 'center', padding: 40, fontSize: 13 }}>
            Sin ingredientes{filter !== 'todos' ? ' en este filtro' : ''}
          </p>
        </div>
      ) : movil ? (
        /* ===== MÓVIL: buscando = lista compacta; sin buscar = categorías desplegables ===== */
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
                    style={{ width: '100%', background: open ? CREMA : 'transparent', border: 'none', cursor: 'pointer',
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
        /* ===== ESCRITORIO: Tabla Neobrutal compacta, zebra, color por categoría ===== */
        <div style={{ background: CREMA, border: `5px solid ${INK}`, boxShadow: '7px 7px 0 ' + INK, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: 1040 }}>
              <colgroup>
                <col style={{ width: 230 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 64 }} />
                <col style={{ width: 78 }} />
                <col style={{ width: 78 }} />
                <col style={{ width: 78 }} />
                <col style={{ width: 104 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={thL}>Ingrediente</th>
                  <th style={thL}>Proveedor</th>
                  <th style={thL}>Categoría</th>
                  <th style={thL}>Marca</th>
                  <th style={thL}>Formato</th>
                  <th style={thC}>Usos</th>
                  <th style={thStyle}>Uds</th>
                  <th style={thL}>Ud std</th>
                  <th style={thL}>Ud min</th>
                  <th style={{ ...thStyle, borderRight: 'none' }}>Precio €</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i, idx) => {
                  const usos = n(i.usos)
                  const lateral = semaforoUsos(usos)
                  const zebra = idx % 2 ? '#fbf4e3' : '#ffffff'
                  return (
                    <tr
                      key={i.id}
                      onClick={() => onSelect?.(i)}
                      style={{ cursor: onSelect ? 'pointer' : 'default', background: zebra }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fff3cf')}
                      onMouseLeave={e => (e.currentTarget.style.background = zebra)}
                    >
                      {/* Ingrediente: banda fina de estado + nombre + IDING */}
                      <td style={{ ...cBase, borderLeft: `6px solid ${lateral}`, paddingLeft: 12, ...ELL }}>
                        <div style={{ fontFamily: LEX, fontSize: 14, fontWeight: 700, lineHeight: 1.15, ...ELL }}>{i.nombre_base ?? i.nombre ?? '—'}</div>
                        <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#7a6f59', marginTop: 1, ...ELL }}>{i.iding ?? '—'}</div>
                      </td>
                      {/* Proveedor: ABV + nombre completo debajo */}
                      <td style={{ ...cBase, ...ELL }}>
                        <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, color: AZUL }}>{i.abv ?? '—'}</div>
                        <div style={{ fontFamily: LEX, fontSize: 12, color: '#5a4f3a', marginTop: 1, ...ELL }}>{getProveedor(i.abv) || '—'}</div>
                      </td>
                      {/* Categoría: punto de color + nombre */}
                      <td style={cTxt}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, maxWidth: '100%' }}>
                          <span style={{ width: 10, height: 10, background: colorCategoria(i.categoria ?? ''), border: `1.5px solid ${INK}`, flexShrink: 0 }} />
                          <span style={ELL}>{i.categoria ?? '—'}</span>
                        </span>
                      </td>
                      <td style={cTxt}>{i.marca ?? '—'}</td>
                      <td style={cTxt}>{i.formato ?? '—'}</td>
                      {/* USOS: punto de color + número (sin bloque rojo) */}
                      <td style={{ ...cNum, textAlign: 'center', fontSize: 16 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: lateral, flexShrink: 0 }} />
                          {usos}
                        </span>
                      </td>
                      <td style={cNum}>{fmt(i.uds)}</td>
                      <td style={cTxt}>{i.ud_std ?? '—'}</td>
                      <td style={cTxt}>{i.ud_min ?? '—'}</td>
                      <td style={{ ...cNum, color: GRANATE, fontSize: 18, borderRight: 'none' }}>{fmt(i.precio_activo ?? i.ultimo_precio)}</td>
                    </tr>
                  )
                })}

                {/* FILA TOTAL en negro: solo recuento */}
                <tr>
                  <td colSpan={10} style={{ borderTop: `4px solid ${INK}`, background: INK, color: CREMA, fontFamily: OSW, fontWeight: 700, padding: '10px 14px', fontSize: 14, letterSpacing: '0.6px', textTransform: 'uppercase', borderLeft: `8px solid ${AMA}` }}>
                    {filtered.length} ingrediente{filtered.length !== 1 ? 's' : ''}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ label, value, bg, fg, active, onClick }: { label: string; value: number; bg: string; fg: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} type="button" style={{
      cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 10,
      background: bg, color: fg, border: 'none', borderRight: `3px solid ${INK}`,
      padding: '14px 20px',
      outline: active ? `3px solid ${AMA}` : 'none', outlineOffset: '-3px',
      transition: 'all 120ms',
    }}>
      <span style={{ fontFamily: OSW, fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: fg, opacity: 0.92 }}>{label}</span>
      <span style={{ fontFamily: OSW, fontSize: 28, fontWeight: 700, lineHeight: 1, color: fg }}>{value}</span>
    </button>
  )
}
