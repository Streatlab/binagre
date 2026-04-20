import { useEffect, useMemo, useState } from 'react'
import type { Ingrediente } from './types'
import { thCls, tdCls, fmt, fmtPct, n, getProveedor } from './types'
import { fmtNum } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import { useConfig } from '@/hooks/useConfig'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  ingredientes: Ingrediente[]
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

const colorUsos = (usos: number, isDark: boolean) =>
  usos === 0 ? '#B01D23' :
  usos <= 4 ? (isDark ? '#e8f442' : '#f5a623') :
  '#06C167'

const normalizeSelector = (v?: string | null): string => {
  if (!v) return 'Último'
  if (v.toLowerCase() === 'ultimo' || v === 'Último') return 'Último'
  if (v.toLowerCase() === 'media') return 'Media'
  return v
}

const CAMPOS_NUMERICOS = ['precio1', 'precio2', 'precio3', 'uds', 'merma_pct', 'ultimo_precio']

export default function TabIngredientes({ ingredientes, onSelect, onNew }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')
  const [localIngs, setLocalIngs] = useState<Ingrediente[]>(ingredientes)
  const [usosMap, setUsosMap] = useState<Record<string, number>>({})
  const [editingCell, setEditingCell] = useState<{ id: string; campo: string } | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const cfg = useConfig()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => { setLocalIngs(ingredientes) }, [ingredientes])

  const recalcularUsos = async () => {
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

  useEffect(() => { recalcularUsos() }, [ingredientes])

  const categoriasUnicas = useMemo(() => {
    const s = new Set<string>()
    localIngs.forEach(i => { if (i.categoria) s.add(i.categoria) })
    cfg.categorias.forEach(c => s.add(c))
    return Array.from(s).filter(Boolean).sort()
  }, [localIngs, cfg.categorias])

  const abvUnicos = useMemo(() => {
    const s = new Set<string>()
    localIngs.forEach(i => { if (i.abv) s.add(i.abv) })
    cfg.proveedores.forEach(p => s.add(p.abv))
    return Array.from(s).filter(Boolean).sort()
  }, [localIngs, cfg.proveedores])

  const formatosUnicos = useMemo(() => {
    const s = new Set<string>()
    localIngs.forEach(i => { if (i.formato) s.add(i.formato) })
    cfg.formatos.forEach(f => s.add(f))
    return Array.from(s).filter(Boolean).sort()
  }, [localIngs, cfg.formatos])

  const udStdOptions = cfg.unidades_std?.length ? cfg.unidades_std : ['Kg.', 'L.', 'Ud.']
  const udMinOptions = cfg.unidades_min?.length ? cfg.unidades_min : ['gr.', 'ml.', 'ud.']

  const { total, enUso, sinUso, filtered } = useMemo(() => {
    const base = localIngs.filter(i =>
      i.abv !== 'EPS' && i.abv !== 'MRM' && (i as { tipo_merma?: string }).tipo_merma !== 'EPS'
    )
    const getUsos = (ing: Ingrediente) => usosMap[String(ing.id)] ?? n(ing.usos)
    const totalCount = base.length
    const enUsoCount = base.filter(i => getUsos(i) > 0).length
    let filteredList = base
    if (filter === 'enuso') filteredList = base.filter(i => getUsos(i) > 0)
    else if (filter === 'sinuso') filteredList = base.filter(i => getUsos(i) === 0)
    return { total: totalCount, enUso: enUsoCount, sinUso: totalCount - enUsoCount, filtered: filteredList }
  }, [localIngs, usosMap, filter])

  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  const startEdit = (e: React.MouseEvent, id: string, campo: string, valor: unknown) => {
    e.stopPropagation()
    setEditingCell({ id, campo })
    setEditingValue(valor == null ? '' : String(valor))
  }

  const saveEdit = async (id: string, campo: string, rawValor: string) => {
    let valor: string = rawValor
    if (campo === 'selector_precio') {
      if (valor === 'ultimo') valor = 'Último'
    }
    const isNum = CAMPOS_NUMERICOS.includes(campo)
    const parsed: string | number | null = isNum
      ? (valor === '' ? null : (parseFloat(valor) || 0))
      : (valor === '' ? null : valor)
    const update: Record<string, string | number | null> = { [campo]: parsed }
    await supabase.from('ingredientes').update(update).eq('id', id)
    setLocalIngs(prev => prev.map(ing => ing.id === id ? { ...ing, ...update } as Ingrediente : ing))
    setEditingCell(null)
    recalcularUsos()
  }

  const cancelEdit = () => setEditingCell(null)

  const isEditing = (i: Ingrediente, campo: string) =>
    editingCell?.id === i.id && editingCell.campo === campo

  const editInputStyle: React.CSSProperties = {
    background: isDark ? '#3a4058' : '#f0f0f0',
    border: '1px solid #e8f442',
    borderRadius: '3px',
    color: 'inherit',
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    padding: '2px 6px',
  }

  const editSelectStyle: React.CSSProperties = {
    background: isDark ? '#3a4058' : '#f0f0f0',
    border: '1px solid #e8f442',
    borderRadius: '3px',
    color: 'inherit',
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    padding: '2px 4px',
  }

  const renderInput = (id: string, campo: string, extraStyle?: React.CSSProperties) => (
    <input
      autoFocus
      type={CAMPOS_NUMERICOS.includes(campo) ? 'number' : 'text'}
      step={CAMPOS_NUMERICOS.includes(campo) ? 'any' : undefined}
      value={editingValue}
      onChange={e => setEditingValue(e.target.value)}
      onBlur={() => saveEdit(id, campo, editingValue)}
      onKeyDown={e => {
        if (e.key === 'Enter') saveEdit(id, campo, editingValue)
        if (e.key === 'Escape') cancelEdit()
      }}
      onClick={e => e.stopPropagation()}
      style={{ ...editInputStyle, ...extraStyle }}
    />
  )

  const renderSelect = (id: string, campo: string, opciones: string[]) => (
    <select
      autoFocus
      value={editingValue}
      onChange={e => { setEditingValue(e.target.value); saveEdit(id, campo, e.target.value) }}
      onBlur={() => cancelEdit()}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
      style={editSelectStyle}
    >
      <option value=""></option>
      {opciones.map(op => <option key={op} value={op}>{op}</option>)}
    </select>
  )

  // Sticky cell backgrounds — opaque per theme
  const stickyTdBg = isDark ? '#111111' : '#faf9f5'
  const stickyThBg = isDark ? '#1a1a1a' : '#f5f5f0'

  const stickyTdStyle = (left: number): React.CSSProperties => ({
    position: 'sticky',
    left,
    zIndex: 2,
    backgroundColor: stickyTdBg,
  })

  const stickyThStyle = (left: number): React.CSSProperties => ({
    position: 'sticky',
    left,
    zIndex: 30,
    backgroundColor: stickyThBg,
  })

  return (
    <div className="space-y-4">
      {/* Contadores + acciones */}
      <div className="flex flex-wrap items-center gap-4">
        <Counter label="TOTAL" value={total} active={filter === 'todos'} onClick={() => setFilter('todos')} />
        <Counter label="EN USO" value={enUso} valueClass="eps" active={filter === 'enuso'} onClick={() => toggle('enuso')} />
        <Counter label="SIN USO" value={sinUso} valueClass="rec" active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
        {onNew && (
          <button onClick={onNew} className="ds-btn-add ml-auto">+ Nuevo Ingrediente</button>
        )}
      </div>

      {!filtered.length ? (
        <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl p-12 text-center">
          <p className="text-[var(--sl-text-muted)] text-sm">Sin ingredientes{filter !== 'todos' ? ' en este filtro' : ''}</p>
        </div>
      ) : (
        <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl" style={{ overflow: 'visible' }}>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', borderRadius: 'inherit' }}>
            <table style={{ tableLayout: 'fixed', width: '2660px' }}>
              <colgroup>
                <col style={{ width: 90 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 55 }} />
                <col style={{ width: 210 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 55 }} />
                <col style={{ width: 65 }} />
                <col style={{ width: 65 }} />
                <col style={{ width: 55 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 75 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 65 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 65 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 75 }} />
                <col style={{ width: 75 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 75 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 75 }} />
              </colgroup>
              <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                <tr>
                  <th className={thCls} style={stickyThStyle(0)}>IDING</th>
                  <th className={thCls}>CATEGORIA</th>
                  <th className={thCls} style={stickyThStyle(90)}>NOMBRE BASE</th>
                  <th className={thCls}>ABV</th>
                  <th className={thCls}>NOMBRE</th>
                  <th className={thCls}>PROVEEDOR</th>
                  <th className={thCls}>MARCA</th>
                  <th className={thCls}>FORMATO</th>
                  <th className={thCls + ' text-right'}>UDS</th>
                  <th className={thCls}>UD STD</th>
                  <th className={thCls}>UD MIN</th>
                  <th className={thCls + ' text-center'}>USOS</th>
                  <th className={thCls + ' text-right'}>PRECIO1</th>
                  <th className={thCls + ' text-right'}>PRECIO2</th>
                  <th className={thCls + ' text-right'}>PRECIO3</th>
                  <th className={thCls + ' text-right'}>ÚLTIMO PRECIO</th>
                  <th className={thCls + ' text-center'}>SELECTOR</th>
                  <th className={thCls + ' text-right'}>ACTIVO</th>
                  <th className={thCls + ' text-right'}>EUR/STD</th>
                  <th className={thCls}>UD/STD</th>
                  <th className={thCls + ' text-right'}>EUR/MIN</th>
                  <th className={thCls}>UD/MIN</th>
                  <th className={thCls}>TIPO MERMA</th>
                  <th className={thCls + ' text-right'}>MERMA%</th>
                  <th className={thCls + ' text-right'}>MERMA EF.</th>
                  <th className={thCls + ' text-right'}>C.NETO/STD</th>
                  <th className={thCls}>UD/NETO STD</th>
                  <th className={thCls + ' text-right'}>C.NETO/MIN</th>
                  <th className={thCls}>UD/NETO MIN</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => {
                  const isEps = i.abv === 'EPS'
                  const rowNameCls = isEps ? 'text-[#66aaff] italic font-medium' : 'text-[var(--sl-text-primary)] font-medium'
                  const usos = usosMap[String(i.id)] ?? n(i.usos)
                  const mermaManual = i.tipo_merma === 'Manual'
                  const selectorDisplay = normalizeSelector(i.selector_precio)
                  return (
                    <tr key={i.id} className="hover:bg-[var(--sl-thead)] transition-colors">
                      {/* IDING — amarillo fijo, abre modal */}
                      <td
                        className={tdCls}
                        onClick={() => onSelect?.(i)}
                        style={{
                          ...stickyTdStyle(0),
                          cursor: 'pointer',
                          color: '#e8f442',
                          fontFamily: 'Oswald, sans-serif',
                          fontWeight: 600,
                        }}
                      >
                        {i.iding ?? '—'}
                      </td>

                      {/* CATEGORIA — select */}
                      <td
                        className={tdCls + ' text-[var(--sl-text-secondary)]'}
                        onClick={e => startEdit(e, i.id, 'categoria', i.categoria)}
                        style={{ cursor: 'text' }}
                      >
                        {isEditing(i, 'categoria')
                          ? renderSelect(i.id, 'categoria', categoriasUnicas)
                          : <span>{i.categoria ?? '—'}</span>}
                      </td>

                      {/* NOMBRE BASE — input text (sticky) */}
                      <td
                        className={tdCls + ' max-w-[220px] truncate ' + rowNameCls}
                        onClick={e => startEdit(e, i.id, 'nombre_base', i.nombre_base)}
                        style={{ ...stickyTdStyle(90), cursor: 'text' }}
                      >
                        {isEditing(i, 'nombre_base')
                          ? renderInput(i.id, 'nombre_base')
                          : <span>{i.nombre_base ?? '—'}</span>}
                      </td>

                      {/* ABV — select */}
                      <td
                        className={tdCls + ' text-[var(--sl-text-primary)] font-mono text-xs font-bold'}
                        onClick={e => startEdit(e, i.id, 'abv', i.abv)}
                        style={{ cursor: 'text' }}
                      >
                        {isEditing(i, 'abv')
                          ? renderSelect(i.id, 'abv', abvUnicos)
                          : <span>{i.abv ?? '—'}</span>}
                      </td>

                      {/* NOMBRE — display */}
                      <td className={tdCls + ' max-w-[180px] truncate ' + (isEps ? 'text-[#66aaff] italic' : 'text-[var(--sl-text-primary)]')}>
                        {i.nombre}
                      </td>

                      {/* PROVEEDOR — derived */}
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{getProveedor(i.abv)}</td>

                      {/* MARCA — input */}
                      <td
                        className={tdCls + ' text-[var(--sl-text-secondary)]'}
                        onClick={e => startEdit(e, i.id, 'marca', i.marca)}
                        style={{ cursor: 'text' }}
                      >
                        {isEditing(i, 'marca')
                          ? renderInput(i.id, 'marca')
                          : <span>{i.marca ?? '—'}</span>}
                      </td>

                      {/* FORMATO — select */}
                      <td
                        className={tdCls + ' text-[var(--sl-text-secondary)]'}
                        onClick={e => startEdit(e, i.id, 'formato', i.formato)}
                        style={{ cursor: 'text' }}
                      >
                        {isEditing(i, 'formato')
                          ? renderSelect(i.id, 'formato', formatosUnicos)
                          : <span>{i.formato ?? '—'}</span>}
                      </td>

                      {/* UDS — input number */}
                      <td
                        className={tdCls + ' text-right'}
                        onClick={e => startEdit(e, i.id, 'uds', i.uds)}
                        style={{ cursor: 'text' }}
                      >
                        {isEditing(i, 'uds')
                          ? renderInput(i.id, 'uds')
                          : <span>{fmt(i.uds)}</span>}
                      </td>

                      {/* UD STD — select */}
                      <td
                        className={tdCls + ' text-[var(--sl-text-secondary)]'}
                        onClick={e => startEdit(e, i.id, 'ud_std', i.ud_std)}
                        style={{ cursor: 'text' }}
                      >
                        {isEditing(i, 'ud_std')
                          ? renderSelect(i.id, 'ud_std', udStdOptions)
                          : <span>{i.ud_std ?? '—'}</span>}
                      </td>

                      {/* UD MIN — select */}
                      <td
                        className={tdCls + ' text-[var(--sl-text-secondary)]'}
                        onClick={e => startEdit(e, i.id, 'ud_min', i.ud_min)}
                        style={{ cursor: 'text' }}
                      >
                        {isEditing(i, 'ud_min')
                          ? renderSelect(i.id, 'ud_min', udMinOptions)
                          : <span>{i.ud_min ?? '—'}</span>}
                      </td>

                      {/* USOS — semáforo */}
                      <td
                        className={tdCls}
                        style={{ color: colorUsos(usos, isDark), fontWeight: 700, textAlign: 'center' }}
                      >
                        {usos}
                      </td>

                      {/* PRECIO1 — input number */}
                      <td
                        className={tdCls + ' text-right text-[var(--sl-text-muted)]'}
                        onClick={e => startEdit(e, i.id, 'precio1', i.precio1)}
                        style={{ cursor: 'text' }}
                      >
                        {isEditing(i, 'precio1')
                          ? renderInput(i.id, 'precio1')
                          : <span>{fmt(i.precio1)}</span>}
                      </td>

                      {/* PRECIO2 — input number */}
                      <td
                        className={tdCls + ' text-right text-[var(--sl-text-muted)]'}
                        onClick={e => startEdit(e, i.id, 'precio2', i.precio2)}
                        style={{ cursor: 'text' }}
                      >
                        {isEditing(i, 'precio2')
                          ? renderInput(i.id, 'precio2')
                          : <span>{fmt(i.precio2)}</span>}
                      </td>

                      {/* PRECIO3 — input number */}
                      <td
                        className={tdCls + ' text-right text-[var(--sl-text-muted)]'}
                        onClick={e => startEdit(e, i.id, 'precio3', i.precio3)}
                        style={{ cursor: 'text' }}
                      >
                        {isEditing(i, 'precio3')
                          ? renderInput(i.id, 'precio3')
                          : <span>{fmt(i.precio3)}</span>}
                      </td>

                      {/* ÚLTIMO PRECIO — display */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)]'}>
                        {fmt(i.ultimo_precio ?? i.precio_activo)}
                      </td>

                      {/* SELECTOR — select fijo */}
                      <td
                        className={tdCls + ' text-center text-xs'}
                        onClick={e => startEdit(e, i.id, 'selector_precio', selectorDisplay)}
                        style={{ cursor: 'text' }}
                      >
                        {isEditing(i, 'selector_precio')
                          ? renderSelect(i.id, 'selector_precio', ['Último', 'P1', 'P2', 'P3'])
                          : (
                            <span className="px-1.5 py-0.5 rounded bg-[var(--sl-border)] text-[var(--sl-text-secondary)]">
                              {selectorDisplay}
                            </span>
                          )}
                      </td>

                      {/* ACTIVO — display */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)] font-semibold'}>{fmt(i.precio_activo)}</td>

                      {/* EUR/STD — display */}
                      <td className={tdCls + ' text-right'}>{fmtNum(i.eur_std)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{i.ud_std ?? '—'}</td>

                      {/* EUR/MIN — display */}
                      <td className={tdCls + ' text-right'}>{fmtNum(i.eur_min)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{i.ud_min ?? '—'}</td>

                      {/* TIPO MERMA — select fijo */}
                      <td
                        className={tdCls + ' text-xs text-[var(--sl-text-secondary)]'}
                        onClick={e => startEdit(e, i.id, 'tipo_merma', i.tipo_merma)}
                        style={{ cursor: 'text' }}
                      >
                        {isEditing(i, 'tipo_merma')
                          ? renderSelect(i.id, 'tipo_merma', ['Manual', 'Tecnica'])
                          : <span>{i.tipo_merma ?? '—'}</span>}
                      </td>

                      {/* MERMA% — editable sólo si Manual */}
                      <td
                        className={tdCls + ' text-right'}
                        onClick={mermaManual ? e => startEdit(e, i.id, 'merma_pct', i.merma_pct) : undefined}
                        style={{ cursor: mermaManual ? 'text' : 'default' }}
                      >
                        {isEditing(i, 'merma_pct')
                          ? renderInput(i.id, 'merma_pct', { width: '60px', textAlign: 'right' })
                          : (
                            <span style={{ color: i.tipo_merma === 'Tecnica' ? '#7080a8' : undefined }}>
                              {i.merma_pct != null ? fmtPct(i.merma_pct) : '—'}
                            </span>
                          )}
                      </td>

                      {/* MERMA EF. */}
                      <td className={tdCls + ' text-right text-[#ea580c]'}>{i.merma_ef != null ? fmtNum(i.merma_ef) : '—'}</td>

                      {/* C.NETO/STD */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)]'}>{fmtNum(i.coste_neto_std)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{i.ud_neto_std ?? i.ud_std ?? '—'}</td>

                      {/* C.NETO/MIN */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)]'}>{fmtNum(i.coste_neto_min)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{i.ud_neto_min ?? i.ud_min ?? '—'}</td>
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
