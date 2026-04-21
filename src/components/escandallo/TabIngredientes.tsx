import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Ingrediente } from './types'
import { fmt, n, getProveedor } from './types'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, groupStyle } from '@/styles/tokens'

interface Props {
  ingredientes: Ingrediente[]
  busqueda?: string
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

export default function TabIngredientes({ ingredientes, busqueda = '', onSelect, onNew }: Props) {
  const { T } = useTheme()
  const [filter, setFilter] = useState<Filter>('todos')
  const [usosMap, setUsosMap] = useState<Record<string, number>>({})

  useEffect(() => {
    const recalcular = async () => {
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
    recalcular()
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

  const exportCSV = () => {
    const headers = ['IDING', 'Categoría', 'Nombre Base', 'ABV', 'Nombre', 'Proveedor', 'Marca', 'Formato', 'UDS', 'UD STD', 'UD MIN', 'Precio']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      headers.map(esc).join(';'),
      ...filtered.map(i => [
        i.iding, i.categoria, i.nombre_base, i.abv, i.nombre,
        getProveedor(i.abv), i.marca, i.formato,
        fmt(i.uds), i.ud_std, i.ud_min,
        fmt(i.precio_activo ?? i.ultimo_precio),
      ].map(esc).join(';')),
    ]
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'ingredientes.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const thStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: T.mut,
    padding: '10px 12px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderBottom: `1px solid ${T.brd}`,
    background: T.card,
  }

  const tdStyle: CSSProperties = {
    fontFamily: FONT.body,
    fontSize: 13,
    color: T.pri,
    padding: '10px 12px',
    borderBottom: `0.5px solid ${T.brd}`,
    whiteSpace: 'nowrap',
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Counter label="TOTAL" value={total} active={filter === 'todos'} onClick={() => setFilter('todos')} />
        <Counter label="EN USO" value={enUso} valueClass="eps" active={filter === 'enuso'} onClick={() => toggle('enuso')} />
        <Counter label="SIN USO" value={sinUso} valueClass="rec" active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
        <button onClick={exportCSV} style={{ marginLeft: onNew ? 0 : 'auto', background: '#222', border: '1px solid #383838', color: '#cccccc', borderRadius: 6, padding: '6px 12px', fontFamily: 'Oswald, sans-serif', fontSize: 11, letterSpacing: '0.5px', cursor: 'pointer' }}>
          ↓ CSV
        </button>
        {onNew && (
          <button onClick={onNew} className="ds-btn-add ml-auto">+ Nuevo Ingrediente</button>
        )}
      </div>

      {busqueda.trim() && (
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{busqueda}"
        </div>
      )}

      <div style={groupStyle(T)}>
        {!filtered.length ? (
          <p style={{ color: T.mut, fontFamily: FONT.body, textAlign: 'center', padding: 40, fontSize: 13 }}>
            Sin ingredientes{filter !== 'todos' ? ' en este filtro' : ''}
          </p>
        ) : (
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
                  <th style={{ ...thStyle, textAlign: 'right' }}>UDS</th>
                  <th style={thStyle}>UD STD</th>
                  <th style={thStyle}>UD MIN</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>PRECIO</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => (
                  <tr
                    key={i.id}
                    onClick={() => onSelect?.(i)}
                    style={{ cursor: onSelect ? 'pointer' : 'default' }}
                  >
                    <td style={{ ...tdStyle, color: T.accent, fontWeight: 600 }}>{i.iding ?? '—'}</td>
                    <td style={{ ...tdStyle, color: T.sec }}>{i.categoria ?? '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{i.nombre_base ?? '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: FONT.heading, fontSize: 12, fontWeight: 700 }}>{i.abv ?? '—'}</td>
                    <td style={tdStyle}>{i.nombre}</td>
                    <td style={{ ...tdStyle, color: T.sec }}>{getProveedor(i.abv)}</td>
                    <td style={{ ...tdStyle, color: T.sec }}>{i.marca ?? '—'}</td>
                    <td style={{ ...tdStyle, color: T.sec }}>{i.formato ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(i.uds)}</td>
                    <td style={{ ...tdStyle, color: T.sec }}>{i.ud_std ?? '—'}</td>
                    <td style={{ ...tdStyle, color: T.sec }}>{i.ud_min ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(i.precio_activo ?? i.ultimo_precio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
