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

const editInputStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid #e8f442',
  color: 'inherit',
  width: '100%',
  outline: 'none',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  padding: 0,
}

const editSelectStyle: React.CSSProperties = {
  ...editInputStyle,
  appearance: 'auto',
}

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

  const saveEdit = async (id: string, campo: string, valor: string) => {
    const isNum = ['precio1', 'precio2', 'precio3', 'uds', 'merma_pct', 'ultimo_precio'].includes(campo)
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

  const CellInput = ({ i, campo, type = 'text', display, className = tdCls, style }: {
    i: Ingrediente; campo: string; type?: 'text' | 'number'; display: React.ReactNode; className?: string; style?: React.CSSProperties
  }) => (
    <td
      className={className}
      style={style}
      onClick={e => startEdit(e, i.id, campo, (i as unknown as Record<string, unknown>)[campo])}
    >
      {isEditing(i, campo) ? (
        <input
          autoFocus
          type={type}
          step={type === 'number' ? 'any' : undefined}
          value={editingValue}
          onChange={e => setEditingValue(e.target.value)}
          onBlur={() => saveEdit(i.id, campo, editingValue)}
          onKeyDown={e => {
            if (e.key === 'Enter') saveEdit(i.id, campo, editingValue)
            if (e.key === 'Escape') cancelEdit()
          }}
          onClick={e => e.stopPropagation()}
          style={editInputStyle}
        />
      ) : display}
    </td>
  )

  const CellSelect = ({ i, campo, options, display, className = tdCls, style }: {
    i: Ingrediente; campo: string; options: string[]; display: React.ReactNode; className?: string; style?: React.CSSProperties
  }) => (
    <td
      className={className}
      style={style}
      onClick={e => startEdit(e, i.id, campo, (i as unknown as Record<string, unknown>)[campo])}
    >
      {isEditing(i, campo) ? (
        <select
          autoFocus
          value={editingValue}
          onChange={e => {
            const v = e.target.value
            setEditingValue(v)
            saveEdit(i.id, campo, v)
          }}
          onBlur={() => saveEdit(i.id, campo, editingValue)}
          onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
          onClick={e => e.stopPropagation()}
          style={editSelectStyle}
        >
          <option value=""></option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : display}
    </td>
  )

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
        <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl overflow-hidden">
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
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
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th className={thCls + ' sticky left-0 z-30 bg-[var(--sl-thead)]'}>IDING</th>
                  <th className={thCls}>CATEGORIA</th>
                  <th className={thCls + ' sticky z-30 bg-[var(--sl-thead)]'} style={{ left: 90 }}>NOMBRE BASE</th>
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
                  return (
                    <tr key={i.id} className="hover:bg-[var(--sl-thead)] transition-colors">
                      {/* IDING — único clic que abre modal */}
                      <td
                        className={tdCls + ' sticky left-0 z-10'}
                        onClick={() => onSelect?.(i)}
                        style={{ cursor: 'pointer', color: '#e8f442', fontFamily: 'Oswald, sans-serif', fontWeight: 600 }}
                      >
                        {i.iding ?? '—'}
                      </td>

                      {/* CATEGORIA — select */}
                      <CellSelect
                        i={i}
                        campo="categoria"
                        options={categoriasUnicas}
                        className={tdCls + ' text-[var(--sl-text-secondary)]'}
                        display={<span>{i.categoria ?? '—'}</span>}
                      />

                      {/* NOMBRE BASE — input text (sticky) */}
                      <CellInput
                        i={i}
                        campo="nombre_base"
                        className={tdCls + ' sticky z-10 max-w-[220px] truncate ' + rowNameCls}
                        style={{ left: 90 }}
                        display={<span>{i.nombre_base ?? '—'}</span>}
                      />

                      {/* ABV — select */}
                      <CellSelect
                        i={i}
                        campo="abv"
                        options={abvUnicos}
                        className={tdCls + ' text-[var(--sl-text-primary)] font-mono text-xs font-bold'}
                        display={<span>{i.abv ?? '—'}</span>}
                      />

                      {/* NOMBRE — display */}
                      <td className={tdCls + ' max-w-[180px] truncate ' + (isEps ? 'text-[#66aaff] italic' : 'text-[var(--sl-text-primary)]')}>
                        {i.nombre}
                      </td>

                      {/* PROVEEDOR — derived */}
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{getProveedor(i.abv)}</td>

                      {/* MARCA — input */}
                      <CellInput
                        i={i}
                        campo="marca"
                        className={tdCls + ' text-[var(--sl-text-secondary)]'}
                        display={<span>{i.marca ?? '—'}</span>}
                      />

                      {/* FORMATO — select */}
                      <CellSelect
                        i={i}
                        campo="formato"
                        options={formatosUnicos}
                        className={tdCls + ' text-[var(--sl-text-secondary)]'}
                        display={<span>{i.formato ?? '—'}</span>}
                      />

                      {/* UDS — input number */}
                      <CellInput
                        i={i}
                        campo="uds"
                        type="number"
                        className={tdCls + ' text-right'}
                        display={<span>{fmt(i.uds)}</span>}
                      />

                      {/* UD STD — select */}
                      <CellSelect
                        i={i}
                        campo="ud_std"
                        options={udStdOptions}
                        className={tdCls + ' text-[var(--sl-text-secondary)]'}
                        display={<span>{i.ud_std ?? '—'}</span>}
                      />

                      {/* UD MIN — select */}
                      <CellSelect
                        i={i}
                        campo="ud_min"
                        options={udMinOptions}
                        className={tdCls + ' text-[var(--sl-text-secondary)]'}
                        display={<span>{i.ud_min ?? '—'}</span>}
                      />

                      {/* USOS — semáforo */}
                      <td className={tdCls + ' text-center'} style={{ color: colorUsos(usos, isDark), fontWeight: 700 }}>
                        {usos}
                      </td>

                      {/* PRECIO1/2/3 — input number */}
                      <CellInput
                        i={i}
                        campo="precio1"
                        type="number"
                        className={tdCls + ' text-right text-[var(--sl-text-muted)]'}
                        display={<span>{fmt(i.precio1)}</span>}
                      />
                      <CellInput
                        i={i}
                        campo="precio2"
                        type="number"
                        className={tdCls + ' text-right text-[var(--sl-text-muted)]'}
                        display={<span>{fmt(i.precio2)}</span>}
                      />
                      <CellInput
                        i={i}
                        campo="precio3"
                        type="number"
                        className={tdCls + ' text-right text-[var(--sl-text-muted)]'}
                        display={<span>{fmt(i.precio3)}</span>}
                      />

                      {/* ÚLTIMO PRECIO — display */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)]'}>
                        {fmt(i.ultimo_precio ?? i.precio_activo)}
                      </td>

                      {/* SELECTOR — select fijo */}
                      <CellSelect
                        i={i}
                        campo="selector_precio"
                        options={['Último', 'P1', 'P2', 'P3']}
                        className={tdCls + ' text-center text-xs'}
                        display={
                          <span className="px-1.5 py-0.5 rounded bg-[var(--sl-border)] text-[var(--sl-text-secondary)]">
                            {i.selector_precio ?? 'Último'}
                          </span>
                        }
                      />

                      {/* ACTIVO — display */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)] font-semibold'}>{fmt(i.precio_activo)}</td>

                      {/* EUR/STD — display */}
                      <td className={tdCls + ' text-right'}>{fmtNum(i.eur_std)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{i.ud_std ?? '—'}</td>

                      {/* EUR/MIN — display */}
                      <td className={tdCls + ' text-right'}>{fmtNum(i.eur_min)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{i.ud_min ?? '—'}</td>

                      {/* TIPO MERMA — select fijo */}
                      <CellSelect
                        i={i}
                        campo="tipo_merma"
                        options={['Manual', 'Tecnica']}
                        className={tdCls + ' text-xs text-[var(--sl-text-secondary)]'}
                        display={<span>{i.tipo_merma ?? '—'}</span>}
                      />

                      {/* MERMA% — editable sólo si Manual */}
                      <td
                        className={tdCls + ' text-right'}
                        onClick={mermaManual ? e => startEdit(e, i.id, 'merma_pct', i.merma_pct) : undefined}
                        style={{ cursor: mermaManual ? 'pointer' : 'default' }}
                      >
                        {isEditing(i, 'merma_pct') ? (
                          <input
                            autoFocus
                            type="number"
                            step="any"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={() => saveEdit(i.id, 'merma_pct', editingValue)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit(i.id, 'merma_pct', editingValue)
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{ ...editInputStyle, width: '60px', textAlign: 'right' }}
                          />
                        ) : (
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
