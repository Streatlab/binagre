import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Ingrediente } from './types'
import { fmt, n, getProveedor } from './types'
import { useTheme, FONT, groupStyle } from '@/styles/tokens'
import { useEsMovil } from '@/hooks/useEsMovil'

interface Props {
  ingredientes: Ingrediente[]
  busqueda?: string
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

// Semáforo de usos: rojo 0 / amarillo 1-4 / verde 5+
function semaforoUsos(usos: number): string {
  if (usos === 0) return '#dc2626'
  if (usos <= 4) return '#f59e0b'
  return '#16a34a'
}

export default function TabIngredientes({ ingredientes, busqueda = '', onSelect, onNew }: Props) {
  const { T } = useTheme()
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
    fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase',
    color: T.mut, padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: `1px solid ${T.brd}`, background: T.card,
  }
  const tdStyle: CSSProperties = {
    fontFamily: FONT.body, fontSize: 13, color: T.pri, padding: '10px 12px',
    borderBottom: `0.5px solid ${T.brd}`, whiteSpace: 'nowrap',
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
          borderBottom: conBorde ? `0.5px solid ${T.brd}` : 'none',
          padding: '11px 13px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', gap: 10, cursor: 'pointer',
        }}
      >
        <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {i.nombre_base ?? i.nombre ?? '—'}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: semaforoUsos(usos), display: 'inline-block' }} />
          <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 700, color: T.accent }}>{fmt(i.precio_activo ?? i.ultimo_precio)}</span>
        </span>
      </button>
    )
  }

  const chevron = (open: boolean) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={open ? T.accent : T.mut} strokeWidth="2.5"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Counter label="TOTAL" value={total} active={filter === 'todos'} onClick={() => setFilter('todos')} />
        <Counter label="EN USO" value={enUso} valueClass="eps" active={filter === 'enuso'} onClick={() => toggle('enuso')} />
        <Counter label="SIN USO" value={sinUso} valueClass="rec" active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
        {onNew && (
          <button onClick={onNew} className="ds-btn-add ml-auto">+ Nuevo Ingrediente</button>
        )}
      </div>

      {busqueda.trim() && (
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{busqueda}"
        </div>
      )}

      {!filtered.length ? (
        <div style={groupStyle(T)}>
          <p style={{ color: T.mut, fontFamily: FONT.body, textAlign: 'center', padding: 40, fontSize: 13 }}>
            Sin ingredientes{filter !== 'todos' ? ' en este filtro' : ''}
          </p>
        </div>
      ) : movil ? (
        /* ===== MÓVIL: buscando = lista compacta; sin buscar = categorías desplegables ===== */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {busqueda.trim() ? (
            <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 11, overflow: 'hidden' }}>
              {filtered.map((i, idx) => filaCompacta(i, idx < filtered.length - 1))}
            </div>
          ) : (
            grupos.map(([cat, items]) => {
              const open = abiertos.has(cat)
              return (
                <div key={cat} style={{ background: T.card, border: `1px solid ${open ? T.accent : T.brd}`, borderRadius: 11, overflow: 'hidden' }}>
                  <button
                    onClick={() => toggleGrupo(cat)}
                    style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                      {chevron(open)}
                      <span style={{ fontFamily: FONT.body, fontSize: 13, fontWeight: 600, color: T.pri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                    </span>
                    <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.sec, background: T.group, padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>{items.length}</span>
                  </button>
                  {open && (
                    <div style={{ borderTop: `0.5px solid ${T.brd}` }}>
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
        <div style={groupStyle(T)}>
          <div style={{ overflowX: 'auto', borderRadius: 8, border: `0.5px solid ${T.brd}` }}>
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
                      <td style={{ ...tdStyle, color: T.accent, fontWeight: 600 }}>{i.iding ?? '—'}</td>
                      <td style={{ ...tdStyle, color: T.sec }}>{i.categoria ?? '—'}</td>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{i.nombre_base ?? '—'}</td>
                      <td style={{ ...tdStyle, fontFamily: FONT.heading, fontSize: 12, fontWeight: 700 }}>{i.abv ?? '—'}</td>
                      <td style={tdStyle}>{i.nombre}</td>
                      <td style={{ ...tdStyle, color: T.sec }}>{getProveedor(i.abv)}</td>
                      <td style={{ ...tdStyle, color: T.sec }}>{i.marca ?? '—'}</td>
                      <td style={{ ...tdStyle, color: T.sec }}>{i.formato ?? '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: semaforoUsos(usos), display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: T.pri }}>{usos}</span>
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(i.uds)}</td>
                      <td style={{ ...tdStyle, color: T.sec }}>{i.ud_std ?? '—'}</td>
                      <td style={{ ...tdStyle, color: T.sec }}>{i.ud_min ?? '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(i.precio_activo ?? i.ultimo_precio)}</td>
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

function Counter({ label, value, valueClass = '', active, onClick }: { label: string; value: number; valueClass?: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} type="button" className={'ds-counter' + (active ? ' active' : '')}>
      <div className="label">{label}</div>
      <div className={'value' + (valueClass ? ' ' + valueClass : '')}>{value}</div>
    </button>
  )
}
