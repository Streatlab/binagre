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

  const thStyle: CSSProperties = {
    fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
    color: CREMA, padding: '13px 14px', textAlign: 'left', whiteSpace: 'nowrap',
    background: INK, position: 'sticky', top: 0, borderRight: `1px solid rgba(252,239,214,.20)`,
  }
  const tdStyle: CSSProperties = {
    fontFamily: LEX, fontSize: 13.5, color: INK, padding: '12px 14px', whiteSpace: 'nowrap',
    borderBottom: `2px solid ${INK}`, borderRight: `1px solid rgba(20,15,8,.14)`,
  }
  // texto secundario LEGIBLE (INK con peso, no gris lavado)
  const sec: CSSProperties = { color: INK, opacity: 0.78 }

  // Pastilla sólida
  const pill = (bg: string, fg = '#fff'): CSSProperties => ({
    fontFamily: OSW, fontWeight: 700, fontSize: 12, letterSpacing: '0.5px',
    background: bg, color: fg, border: `2px solid ${INK}`, padding: '3px 9px',
    display: 'inline-block',
  })
  // Pastilla de usos (color = semáforo)
  const usoPill = (usos: number): CSSProperties => ({
    fontFamily: OSW, fontWeight: 700, fontSize: 14, minWidth: 40, textAlign: 'center',
    border: `2px solid ${INK}`, padding: '2px 8px', color: '#fff', background: semaforoUsos(usos),
    display: 'inline-block',
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
          borderBottom: conBorde ? `1px solid ${INK}1f` : 'none',
          padding: '11px 13px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', gap: 10, cursor: 'pointer',
        }}
      >
        <span style={{ fontFamily: LEX, fontSize: 13, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {i.nombre_base ?? i.nombre ?? '—'}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ width: 9, height: 9, background: semaforoUsos(usos), display: 'inline-block', border: `1.5px solid ${INK}` }} />
          <span style={{ fontFamily: OSW, fontSize: 14, fontWeight: 700, color: GRANATE }}>{fmt(i.precio_activo ?? i.ultimo_precio)}</span>
        </span>
      </button>
    )
  }

  const chevron = (open: boolean) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.5"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )

  // ===== Tira de filtros (apoyo, no protagonista): chips contadores sólidos =====
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
        <div style={{ background: '#fff', border: `4px solid ${INK}`, boxShadow: SHADOW }}>
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
        /* ===== ESCRITORIO: la TABLA es la protagonista (100% ancho, §6.2) ===== */
        <div style={{ background: '#fff', border: `4px solid ${INK}`, boxShadow: SHADOW }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', width: '100%', minWidth: 1180 }}>
              <thead>
                <tr>
                  <th style={thStyle}>IDING</th>
                  <th style={thStyle}>CATEGORÍA</th>
                  <th style={thStyle}>NOMBRE BASE</th>
                  <th style={thStyle}>ABV</th>
                  <th style={thStyle}>NOMBRE</th>
                  <th style={thStyle}>PROVEEDOR</th>
                  <th style={thStyle}>MARCA</th>
                  <th style={thStyle}>FORMATO</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>USOS</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>UDS</th>
                  <th style={thStyle}>UD STD</th>
                  <th style={thStyle}>UD MIN</th>
                  <th style={{ ...thStyle, textAlign: 'right', borderRight: 'none' }}>PRECIO</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i, idx) => {
                  const usos = n(i.usos)
                  const zebra = idx % 2 === 1 ? '#fbf6ea' : '#ffffff'
                  return (
                    <tr
                      key={i.id}
                      onClick={() => onSelect?.(i)}
                      style={{ cursor: onSelect ? 'pointer' : 'default', background: zebra }}
                      onMouseEnter={e => (e.currentTarget.style.background = AMA)}
                      onMouseLeave={e => (e.currentTarget.style.background = zebra)}
                    >
                      <td style={tdStyle}><span style={pill(GRANATE)}>{i.iding ?? '—'}</span></td>
                      <td style={{ ...tdStyle, ...sec }}>{i.categoria ?? '—'}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, fontSize: 14 }}>{i.nombre_base ?? '—'}</td>
                      <td style={{ ...tdStyle, fontFamily: OSW, fontWeight: 700, fontSize: 13, color: AZUL }}>{i.abv ?? '—'}</td>
                      <td style={tdStyle}>{i.nombre}</td>
                      <td style={{ ...tdStyle, ...sec }}>{getProveedor(i.abv)}</td>
                      <td style={{ ...tdStyle, ...sec }}>{i.marca ?? '—'}</td>
                      <td style={{ ...tdStyle, ...sec }}>{i.formato ?? '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><span style={usoPill(usos)}>{usos}</span></td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: OSW, fontWeight: 600 }}>{fmt(i.uds)}</td>
                      <td style={{ ...tdStyle, ...sec }}>{i.ud_std ?? '—'}</td>
                      <td style={{ ...tdStyle, ...sec }}>{i.ud_min ?? '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: OSW, fontWeight: 700, fontSize: 16, color: GRANATE, borderRight: 'none' }}>{fmt(i.precio_activo ?? i.ultimo_precio)}</td>
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
