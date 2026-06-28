import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Ingrediente } from './types'
import { fmt, fmtEurES, n, getProveedor } from './types'
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

  // Precio medio de lo filtrado (para fila TOTAL, sobre datos reales)
  const precioMedio = useMemo(() => {
    const vals = filtered.map(i => n(i.precio_activo ?? i.ultimo_precio)).filter(v => v > 0)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }, [filtered])

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

  // Cabecera tinta (texto crema), § patrón uso diario
  const thStyle: CSSProperties = {
    fontFamily: OSW, fontSize: 12, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase',
    color: CREMA, padding: '14px 12px', textAlign: 'right', whiteSpace: 'nowrap',
    background: INK, position: 'sticky', top: 0, borderRight: `2px solid #4a3f2c`,
  }
  const thL: CSSProperties = { ...thStyle, textAlign: 'left', paddingLeft: 16 }
  const thC: CSSProperties = { ...thStyle, textAlign: 'center' }

  // Celdas: separador negro 3px arriba, vertical tenue, fondo blanco (sin zebra lavada)
  const cBase: CSSProperties = {
    borderTop: `3px solid ${INK}`, borderRight: `2px solid rgba(20,15,8,.16)`,
    padding: '16px 12px', fontFamily: LEX, fontSize: 13.5, color: INK,
  }
  const cNum: CSSProperties = { ...cBase, fontFamily: OSW, fontWeight: 700, fontSize: 19, textAlign: 'right' }
  const cSec: CSSProperties = { ...cBase, color: '#3d362a', fontSize: 13, textAlign: 'right' }

  // Pastilla de usos como BLOQUE SÓLIDO (celda entera pintada, número blanco)
  const usoBlock = (usos: number): CSSProperties => ({
    background: semaforoUsos(usos), color: '#fff', textAlign: 'center',
    fontFamily: OSW, fontWeight: 700, fontSize: 21,
    borderTop: `3px solid ${INK}`, borderLeft: `3px solid ${INK}`, borderRight: `3px solid ${INK}`,
  })

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
        /* ===== ESCRITORIO: patrón Tabla Neobrutal de uso diario ===== */
        <div style={{ background: CREMA, border: `5px solid ${INK}`, boxShadow: '7px 7px 0 ' + INK }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', width: '100%', minWidth: 1180 }}>
              <thead>
                <tr>
                  <th style={thL}>Ingrediente</th>
                  <th style={thL}>ABV</th>
                  <th style={thStyle}>Categoría</th>
                  <th style={thStyle}>Marca</th>
                  <th style={thStyle}>Formato</th>
                  <th style={thC}>Usos</th>
                  <th style={thStyle}>Uds</th>
                  <th style={thStyle}>Ud std</th>
                  <th style={thStyle}>Ud min</th>
                  <th style={{ ...thStyle, borderRight: 'none' }}>Precio €</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => {
                  const usos = n(i.usos)
                  const lateral = semaforoUsos(usos)
                  return (
                    <tr
                      key={i.id}
                      onClick={() => onSelect?.(i)}
                      style={{ cursor: onSelect ? 'pointer' : 'default', background: '#fff' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fff7df')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                    >
                      {/* Ingrediente: banda lateral de estado + nombre + IDING·proveedor */}
                      <td style={{ ...cBase, borderLeft: `14px solid ${lateral}`, paddingLeft: 16 }}>
                        <div style={{ fontFamily: LEX, fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>{i.nombre_base ?? i.nombre ?? '—'}</div>
                        <div style={{ fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#5a4f3a', marginTop: 2 }}>
                          {(i.iding ?? '—')} · {getProveedor(i.abv) || '—'}
                        </div>
                      </td>
                      <td style={{ ...cBase, fontFamily: OSW, fontWeight: 700, fontSize: 13, color: AZUL }}>{i.abv ?? '—'}</td>
                      <td style={cSec}>{i.categoria ?? '—'}</td>
                      <td style={cSec}>{i.marca ?? '—'}</td>
                      <td style={cSec}>{i.formato ?? '—'}</td>
                      {/* USOS: bloque sólido de color, número blanco */}
                      <td style={usoBlock(usos)}>{usos}</td>
                      <td style={cNum}>{fmt(i.uds)}</td>
                      <td style={cSec}>{i.ud_std ?? '—'}</td>
                      <td style={cSec}>{i.ud_min ?? '—'}</td>
                      <td style={{ ...cNum, color: GRANATE, fontSize: 21, borderRight: 'none' }}>{fmt(i.precio_activo ?? i.ultimo_precio)}</td>
                    </tr>
                  )
                })}

                {/* FILA TOTAL en negro, KPI medio en caja amarilla */}
                <tr>
                  <td style={{ borderTop: `5px solid ${INK}`, background: INK, color: CREMA, fontFamily: OSW, fontWeight: 700, padding: 16, fontSize: 15, letterSpacing: '0.6px', textTransform: 'uppercase', borderLeft: `14px solid ${AMA}` }}>
                    {filtered.length} ingrediente{filtered.length !== 1 ? 's' : ''}
                  </td>
                  <td style={{ borderTop: `5px solid ${INK}`, background: INK }} colSpan={4} />
                  <td style={{ borderTop: `5px solid ${INK}`, background: INK, textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', background: AMA, color: INK, border: `2.5px solid ${CREMA}`, fontFamily: OSW, fontWeight: 700, fontSize: 16, padding: '3px 12px' }}>{enUso}/{total}</span>
                  </td>
                  <td style={{ borderTop: `5px solid ${INK}`, background: INK }} colSpan={3} />
                  <td style={{ borderTop: `5px solid ${INK}`, background: INK, textAlign: 'right', padding: '16px 12px' }}>
                    <span style={{ display: 'inline-block', background: AMA, color: INK, border: `2.5px solid ${CREMA}`, fontFamily: OSW, fontWeight: 700, fontSize: 16, padding: '3px 12px' }}>{fmtEurES(precioMedio)} med.</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Leyenda del semáforo */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', padding: '13px 18px', borderTop: `5px solid ${INK}`, background: CLARO, fontFamily: OSW, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: INK }}>
            <Leg color={VERDE} txt="5+ usos · sano" />
            <Leg color={NAR} txt="1–4 usos · vigilar" />
            <Leg color={ROJO} txt="0 usos · sobra" />
          </div>
        </div>
      )}
    </div>
  )
}

function Leg({ color, txt }: { color: string; txt: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 14, height: 14, background: color, border: `2.5px solid ${INK}`, display: 'inline-block' }} />
      {txt}
    </span>
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
