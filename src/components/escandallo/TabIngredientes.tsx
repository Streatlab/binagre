import { useMemo, useState, useEffect } from 'react'
import type { Ingrediente } from './types'
import { thCls, tdCls, fmt, fmtPct, n, getProveedor, semaforoUsos } from './types'
import { fmtNum } from '@/utils/format'
import { supabase } from '@/lib/supabase'

interface Props {
  ingredientes: Ingrediente[]
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
  onInlineUpdate?: (id: string, patch: Partial<Ingrediente>) => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

const INLINE_STYLE = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid #e8f442',
  color: 'inherit',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  outline: 'none',
  padding: '0',
  textAlign: 'right' as const,
}

function recalcFromIng(ing: Ingrediente): Partial<Ingrediente> {
  const p1 = Number(ing.precio1) || 0
  const p2 = Number(ing.precio2) || 0
  const p3 = Number(ing.precio3) || 0
  const ultimoAuto = p3 || p2 || p1
  const precios = [p1, p2, p3].filter(p => p > 0)
  const media = precios.length ? precios.reduce((a, b) => a + b, 0) / precios.length : 0
  const precioActivo = (ing.selector_precio ?? 'ultimo') === 'ultimo' ? ultimoAuto : media
  const uds = Number(ing.uds) || 0
  const mermaPct = Number(ing.merma_pct) || 0
  const udStd = ing.ud_std ?? ''
  const factor = udStd.toLowerCase().startsWith('kg') || udStd.toLowerCase().startsWith('l') ? 1000 : (udStd === 'Docena' ? 12 : 1)
  const eurStd = uds > 0 ? precioActivo / uds : 0
  const eurMin = eurStd / factor
  const costeNetoStd = mermaPct > 0 && mermaPct < 100 ? eurStd / (1 - mermaPct / 100) : eurStd
  const costeNetoMin = costeNetoStd / factor
  return {
    ultimo_precio: ultimoAuto || undefined,
    precio_activo: precioActivo || undefined,
    eur_std: eurStd || undefined,
    eur_min: eurMin || undefined,
    coste_neto_std: costeNetoStd || undefined,
    coste_neto_min: costeNetoMin || undefined,
  }
}

export default function TabIngredientes({ ingredientes, onSelect, onNew, onInlineUpdate }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')
  const [isDark, setIsDark] = useState(document.documentElement.getAttribute('data-theme') === 'dark')
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark'))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const [editingCell, setEditingCell] = useState<{ id: string; campo: string } | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const { total, enUso, sinUso, filtered } = useMemo(() => {
    const base = ingredientes.filter(i =>
      i.abv !== 'EPS' && i.abv !== 'MRM' && (i as any).tipo_merma !== 'EPS'
    )
    const total = base.length
    const enUso = base.filter(i => n(i.usos) > 0).length
    let filtered = base
    if (filter === 'enuso') filtered = base.filter(i => n(i.usos) > 0)
    else if (filter === 'sinuso') filtered = base.filter(i => n(i.usos) === 0)
    return { total, enUso, sinUso: total - enUso, filtered }
  }, [ingredientes, filter])

  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  const handleCellClick = (e: React.MouseEvent, id: string, campo: string, valorActual: any) => {
    e.stopPropagation()
    setEditingCell({ id, campo })
    setEditingValue(String(valorActual ?? ''))
  }

  const handleCellSave = async () => {
    if (!editingCell) return
    const { id, campo } = editingCell
    setEditingCell(null)

    const raw = editingValue.trim()
    const numVal = parseFloat(raw.replace(',', '.'))
    const patch: Record<string, any> = {}
    patch[campo] = isNaN(numVal) ? raw : numVal

    // Recalc campos derivados si cambia precio o merma
    const ing = filtered.find(i => i.id === id)
    if (ing && (campo === 'precio1' || campo === 'precio2' || campo === 'precio3' || campo === 'merma_pct')) {
      const newIng = { ...ing, ...patch } as Ingrediente
      const recalc = recalcFromIng(newIng)
      Object.assign(patch, recalc)
    }

    const { error } = await supabase.from('ingredientes').update(patch).eq('id', id)
    if (!error) {
      onInlineUpdate?.(id, patch as Partial<Ingrediente>)
    }
    setEditingValue('')
  }

  const editInput = (id: string, campo: string) =>
    editingCell?.id === id && editingCell?.campo === campo

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
                  <th className={thCls} style={{ position: 'sticky', left: 0, zIndex: 3, backgroundColor: isDark ? '#0a0a0a' : '#f9fafb' }}>IDING</th>
                  <th className={thCls}>CATEGORIA</th>
                  <th className={thCls} style={{ position: 'sticky', left: 90, zIndex: 3, backgroundColor: isDark ? '#0a0a0a' : '#f9fafb' }}>NOMBRE BASE</th>
                  <th className={thCls}>ABV</th>
                  <th className={thCls}>NOMBRE</th>
                  <th className={thCls}>PROVEEDOR</th>
                  <th className={thCls}>MARCA</th>
                  <th className={thCls}>FORMATO</th>
                  <th className={thCls + ' text-right'}>UDS</th>
                  <th className={thCls}>UD STD</th>
                  <th className={thCls}>UD MIN</th>
                  <th className={thCls + ' text-center'}>USOS</th>
                  <th className={thCls + ' text-right'} title="Click para editar">PRECIO1 ✎</th>
                  <th className={thCls + ' text-right'} title="Click para editar">PRECIO2 ✎</th>
                  <th className={thCls + ' text-right'} title="Click para editar">PRECIO3 ✎</th>
                  <th className={thCls + ' text-right'}>ÚLTIMO PRECIO</th>
                  <th className={thCls + ' text-center'}>SELECTOR</th>
                  <th className={thCls + ' text-right'}>ACTIVO</th>
                  <th className={thCls + ' text-right'}>EUR/STD</th>
                  <th className={thCls}>UD/STD</th>
                  <th className={thCls + ' text-right'}>EUR/MIN</th>
                  <th className={thCls}>UD/MIN</th>
                  <th className={thCls}>TIPO MERMA</th>
                  <th className={thCls + ' text-right'} title="Click para editar">MERMA% ✎</th>
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
                  const usos = n(i.usos)
                  return (
                    <tr key={i.id} onClick={() => onSelect?.(i)}
                      className="cursor-pointer hover:bg-[var(--sl-thead)] transition-colors">
                      <td className={tdCls + ' text-[var(--sl-text-muted)] font-mono text-xs'} style={{ position: 'sticky', left: 0, zIndex: 2, backgroundColor: isDark ? '#111111' : '#ffffff' }}>{i.iding ?? '—'}</td>
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{i.categoria ?? '—'}</td>
                      <td className={tdCls + ' max-w-[220px] truncate ' + rowNameCls} style={{ position: 'sticky', left: 90, zIndex: 2, backgroundColor: isDark ? '#111111' : '#ffffff' }}>{i.nombre_base ?? '—'}</td>
                      <td className={tdCls + ' text-[var(--sl-text-primary)] font-mono text-xs font-bold'}>{i.abv ?? '—'}</td>
                      <td className={tdCls + ' max-w-[180px] truncate ' + (isEps ? 'text-[#66aaff] italic' : 'text-[var(--sl-text-primary)]')}>{i.nombre}</td>
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{getProveedor(i.abv)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{i.marca ?? '—'}</td>
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{i.formato ?? '—'}</td>
                      <td className={tdCls + ' text-right'}>{fmt(i.uds)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{i.ud_std ?? '—'}</td>
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{i.ud_min ?? '—'}</td>
                      <td className={tdCls + ' text-center'}>
                        <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ' + semaforoUsos(usos)}>
                          {usos}
                        </span>
                      </td>

                      {/* PRECIO1 — editable inline */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-muted)]'}
                        style={{ cursor: 'text' }}
                        onClick={e => handleCellClick(e, i.id, 'precio1', i.precio1)}>
                        {editInput(i.id, 'precio1') ? (
                          <input autoFocus value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={e => { if (e.key === 'Enter') handleCellSave(); if (e.key === 'Escape') setEditingCell(null) }}
                            style={INLINE_STYLE} />
                        ) : fmt(i.precio1)}
                      </td>

                      {/* PRECIO2 — editable inline */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-muted)]'}
                        style={{ cursor: 'text' }}
                        onClick={e => handleCellClick(e, i.id, 'precio2', i.precio2)}>
                        {editInput(i.id, 'precio2') ? (
                          <input autoFocus value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={e => { if (e.key === 'Enter') handleCellSave(); if (e.key === 'Escape') setEditingCell(null) }}
                            style={INLINE_STYLE} />
                        ) : fmt(i.precio2)}
                      </td>

                      {/* PRECIO3 — editable inline */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-muted)]'}
                        style={{ cursor: 'text' }}
                        onClick={e => handleCellClick(e, i.id, 'precio3', i.precio3)}>
                        {editInput(i.id, 'precio3') ? (
                          <input autoFocus value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={e => { if (e.key === 'Enter') handleCellSave(); if (e.key === 'Escape') setEditingCell(null) }}
                            style={INLINE_STYLE} />
                        ) : fmt(i.precio3)}
                      </td>

                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)]'}>{fmt(i.ultimo_precio ?? i.precio_activo)}</td>
                      <td className={tdCls + ' text-center text-xs'}>
                        <span className="px-1.5 py-0.5 rounded bg-[var(--sl-border)] text-[var(--sl-text-secondary)]">{i.selector_precio === 'ultimo' ? 'Último' : (i.selector_precio ?? 'Último')}</span>
                      </td>
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)] font-semibold'}>{fmt(i.precio_activo)}</td>
                      <td className={tdCls + ' text-right'}>{fmtNum(i.eur_std)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{i.ud_std ?? '—'}</td>
                      <td className={tdCls + ' text-right'}>{fmtNum(i.eur_min)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{i.ud_min ?? '—'}</td>
                      <td className={tdCls + ' text-xs text-[var(--sl-text-secondary)]'}>{i.tipo_merma ?? '—'}</td>

                      {/* MERMA% — editable inline (solo si tipo_merma !== Tecnica) */}
                      <td className={tdCls + ' text-right'}
                        style={{ cursor: i.tipo_merma === 'Tecnica' ? 'default' : 'text' }}
                        onClick={e => { if (i.tipo_merma !== 'Tecnica') { handleCellClick(e, i.id, 'merma_pct', i.merma_pct) } else { e.stopPropagation() } }}>
                        {editInput(i.id, 'merma_pct') ? (
                          <input autoFocus value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={e => { if (e.key === 'Enter') handleCellSave(); if (e.key === 'Escape') setEditingCell(null) }}
                            style={INLINE_STYLE} />
                        ) : (i.merma_pct != null ? fmtPct(i.merma_pct) : '—')}
                      </td>

                      <td className={tdCls + ' text-right text-[#ea580c]'}>{i.merma_ef != null ? fmtNum(i.merma_ef) : '—'}</td>
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)]'}>{fmtNum(i.coste_neto_std)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{i.ud_neto_std ?? i.ud_std ?? '—'}</td>
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
