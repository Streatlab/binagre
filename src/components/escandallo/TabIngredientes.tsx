import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Ingrediente } from './types'
import { fmt, n, getProveedor } from './types'
import { useEsMovil } from '@/hooks/useEsMovil'
import { INK, CREMA, CLARO, SHADOW, BORDER_CARD, OSW, LEX, AMA, VERDE, ROJO, GRANATE, GRIS } from '@/styles/neobrutal'

interface Props {
  ingredientes: Ingrediente[]
  busqueda?: string
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

// Semáforo de usos: rojo 0 / amarillo 1-4 / verde 5+
function semaforoUsos(usos: number): string {
  if (usos === 0) return ROJO
  if (usos <= 4) return AMA
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
    color: CREMA, padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: `2px solid ${INK}`, background: INK, position: 'sticky', top: 0,
  }
  const tdStyle: CSSProperties = {
    fontFamily: LEX, fontSize: 13, color: INK, padding: '10px 12px',
    borderBottom: `1px solid ${INK}1f`, whiteSpace: 'nowrap',
  }

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
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: semaforoUsos(usos), display: 'inline-block', border: `1px solid ${INK}` }} />
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <Counter label="TOTAL" value={total} active={filter === 'todos'} onClick={() => setFilter('todos')} />
        <Counter label="EN USO" value={enUso} color={VERDE} active={filter === 'enuso'} onClick={() => toggle('enuso')} />
        <Counter label="SIN USO" value={sinUso} color={ROJO} active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
        {onNew && (
          <button onClick={onNew} style={btnNuevo}>+ Nuevo Ingrediente</button>
        )}
      </div>

      {busqueda.trim() && (
        <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{busqueda}"
        </div>
      )}

      {!filtered.length ? (
        <div style={{ background: '#ffffff', border: BORDER_CARD, boxShadow: SHADOW }}>
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
        /* ===== ESCRITORIO: tabla completa ===== */
        <div style={{ background: '#ffffff', border: BORDER_CARD, boxShadow: SHADOW }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', width: '100%' }}>
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
                  <th style={{ ...thStyle, textAlign: 'right' }}>PRECIO</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => {
                  const usos = n(i.usos)
                  return (
                    <tr key={i.id} onClick={() => onSelect?.(i)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
                      <td style={{ ...tdStyle, color: GRANATE, fontFamily: OSW, fontWeight: 700 }}>{i.iding ?? '—'}</td>
                      <td style={{ ...tdStyle, color: '#00000099' }}>{i.categoria ?? '—'}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{i.nombre_base ?? '—'}</td>
                      <td style={{ ...tdStyle, fontFamily: OSW, fontSize: 12, fontWeight: 700 }}>{i.abv ?? '—'}</td>
                      <td style={tdStyle}>{i.nombre}</td>
                      <td style={{ ...tdStyle, color: '#00000099' }}>{getProveedor(i.abv)}</td>
                      <td style={{ ...tdStyle, color: '#00000099' }}>{i.marca ?? '—'}</td>
                      <td style={{ ...tdStyle, color: '#00000099' }}>{i.formato ?? '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: semaforoUsos(usos), display: 'inline-block', flexShrink: 0, border: `1px solid ${INK}` }} />
                          <span style={{ fontFamily: OSW, fontWeight: 700, color: INK }}>{usos}</span>
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(i.uds)}</td>
                      <td style={{ ...tdStyle, color: '#00000099' }}>{i.ud_std ?? '—'}</td>
                      <td style={{ ...tdStyle, color: '#00000099' }}>{i.ud_min ?? '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: OSW, fontWeight: 700 }}>{fmt(i.precio_activo ?? i.ultimo_precio)}</td>
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
