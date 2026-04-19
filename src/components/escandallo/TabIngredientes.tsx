import { useMemo, useState, useEffect } from 'react'
import type { Ingrediente } from './types'
import { thCls, tdCls, fmt, n, getProveedor, semaforoUsos } from './types'
import { fmtNum } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import { useConfig } from '@/hooks/useConfig'

interface Props {
  ingredientes: Ingrediente[]
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
  onInlineUpdate?: (id: string, patch: Partial<Ingrediente>) => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

const INPUT_STYLE: React.CSSProperties = {
  background: 'transparent', border: 'none', borderBottom: '1px solid #e8f442',
  color: 'inherit', width: '100%', outline: 'none', fontFamily: 'inherit', fontSize: 'inherit', padding: 0,
}

const SELECT_STYLE: React.CSSProperties = {
  background: 'transparent', border: 'none', borderBottom: '1px solid #e8f442',
  color: 'inherit', width: '100%', outline: 'none', fontFamily: 'inherit', fontSize: 'inherit', cursor: 'pointer',
}

function colorUsos(usos: number, isDark: boolean): string {
  if (usos === 0) return '#B01D23'
  if (usos <= 4) return isDark ? '#e8f442' : '#f5a623'
  return '#06C167'
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
  const cfg = useConfig()
  const [filter, setFilter] = useState<Filter>('todos')
  const [isDark, setIsDark] = useState(document.documentElement.getAttribute('data-theme') === 'dark')
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark'))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // Local copy so inline edits reflect immediately
  const [localIng, setLocalIng] = useState<Ingrediente[]>(ingredientes)
  useEffect(() => { setLocalIng(ingredientes) }, [ingredientes])

  const [editingCell, setEditingCell] = useState<{ id: string; campo: string } | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const handleCellSave = async (id: string, campo: string, valor: string) => {
    setEditingCell(null)
    const numVal = parseFloat(valor.replace(',', '.'))
    const parsed = valor === '' || isNaN(numVal) ? valor : numVal
    const patch: Record<string, any> = { [campo]: parsed }

    // Recalc derived fields when price or merma changes
    const ing = localIng.find(i => i.id === id)
    if (ing && (campo === 'precio1' || campo === 'precio2' || campo === 'precio3' || campo === 'merma_pct' || campo === 'uds' || campo === 'ud_std' || campo === 'selector_precio')) {
      const newIng = { ...ing, ...patch } as Ingrediente
      Object.assign(patch, recalcFromIng(newIng))
    }

    const { error } = await supabase.from('ingredientes').update(patch).eq('id', id)
    if (!error) {
      setLocalIng(prev => prev.map(ing => ing.id === id ? { ...ing, ...patch } : ing))
      onInlineUpdate?.(id, patch as Partial<Ingrediente>)
    }
  }

  const startEdit = (e: React.MouseEvent, id: string, campo: string, valor: any) => {
    e.stopPropagation()
    setEditingCell({ id, campo })
    setEditingValue(String(valor ?? ''))
  }

  // Inline-editable cell component (closure)
  const CeldaEditable = ({
    id, campo, valor, tipo = 'text', opciones,
  }: { id: string; campo: string; valor: any; tipo?: 'text' | 'number' | 'select'; opciones?: string[] }) => {
    const isEditing = editingCell?.id === id && editingCell?.campo === campo
    if (isEditing) {
      if (tipo === 'select' && opciones) {
        return (
          <select autoFocus value={editingValue}
            onChange={e => setEditingValue(e.target.value)}
            onBlur={() => handleCellSave(id, campo, editingValue)}
            style={SELECT_STYLE}>
            {opciones.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
        )
      }
      return (
        <input autoFocus type={tipo} value={editingValue}
          onChange={e => setEditingValue(e.target.value)}
          onBlur={() => handleCellSave(id, campo, editingValue)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleCellSave(id, campo, editingValue)
            if (e.key === 'Escape') setEditingCell(null)
          }}
          style={INPUT_STYLE} />
      )
    }
    return (
      <span onClick={e => startEdit(e, id, campo, valor)}
        style={{ cursor: 'text', display: 'block', minWidth: '40px', minHeight: '20px' }}>
        {valor ?? '—'}
      </span>
    )
  }

  const { total, enUso, sinUso, filtered } = useMemo(() => {
    const base = localIng.filter(i =>
      i.abv !== 'EPS' && i.abv !== 'MRM' && (i as any).tipo_merma !== 'EPS'
    )
    const total = base.length
    const enUso = base.filter(i => n(i.usos) > 0).length
    let filtered = base
    if (filter === 'enuso') filtered = base.filter(i => n(i.usos) > 0)
    else if (filter === 'sinuso') filtered = base.filter(i => n(i.usos) === 0)
    return { total, enUso, sinUso: total - enUso, filtered }
  }, [localIng, filter])

  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  const abvOpts = cfg.proveedores.map(p => p.abv)

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
                  <th className={thCls}>CATEGORIA ✎</th>
                  <th className={thCls} style={{ position: 'sticky', left: 90, zIndex: 3, backgroundColor: isDark ? '#0a0a0a' : '#f9fafb' }}>NOMBRE BASE ✎</th>
                  <th className={thCls}>ABV ✎</th>
                  <th className={thCls}>NOMBRE</th>
                  <th className={thCls}>PROVEEDOR</th>
                  <th className={thCls}>MARCA ✎</th>
                  <th className={thCls}>FORMATO ✎</th>
                  <th className={thCls + ' text-right'}>UDS ✎</th>
                  <th className={thCls}>UD STD ✎</th>
                  <th className={thCls}>UD MIN ✎</th>
                  <th className={thCls + ' text-center'}>USOS</th>
                  <th className={thCls + ' text-right'}>PRECIO1 ✎</th>
                  <th className={thCls + ' text-right'}>PRECIO2 ✎</th>
                  <th className={thCls + ' text-right'}>PRECIO3 ✎</th>
                  <th className={thCls + ' text-right'}>ÚLTIMO PRECIO</th>
                  <th className={thCls + ' text-center'}>SELECTOR ✎</th>
                  <th className={thCls + ' text-right'}>ACTIVO</th>
                  <th className={thCls + ' text-right'}>EUR/STD</th>
                  <th className={thCls}>UD/STD</th>
                  <th className={thCls + ' text-right'}>EUR/MIN</th>
                  <th className={thCls}>UD/MIN</th>
                  <th className={thCls}>TIPO MERMA ✎</th>
                  <th className={thCls + ' text-right'}>MERMA% ✎</th>
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

                      {/* IDING — abre modal */}
                      <td className={tdCls} style={{ position: 'sticky', left: 0, zIndex: 2, backgroundColor: isDark ? '#111111' : '#ffffff', cursor: 'pointer', color: '#e8f442', fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: '12px' }}
                        onClick={e => { e.stopPropagation(); onSelect?.(i) }}>
                        {i.iding ?? '—'}
                      </td>

                      {/* CATEGORIA */}
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>
                        <CeldaEditable id={i.id} campo="categoria" valor={i.categoria} tipo="select" opciones={cfg.categorias} />
                      </td>

                      {/* NOMBRE BASE */}
                      <td className={tdCls + ' max-w-[220px] truncate ' + rowNameCls} style={{ position: 'sticky', left: 90, zIndex: 2, backgroundColor: isDark ? '#111111' : '#ffffff' }}>
                        <CeldaEditable id={i.id} campo="nombre_base" valor={i.nombre_base} tipo="text" />
                      </td>

                      {/* ABV */}
                      <td className={tdCls + ' text-[var(--sl-text-primary)] font-mono text-xs font-bold'}>
                        <CeldaEditable id={i.id} campo="abv" valor={i.abv} tipo="select" opciones={abvOpts} />
                      </td>

                      {/* NOMBRE (auto, readonly) */}
                      <td className={tdCls + ' max-w-[180px] truncate ' + (isEps ? 'text-[#66aaff] italic' : 'text-[var(--sl-text-primary)]')}>{i.nombre}</td>

                      {/* PROVEEDOR (derivado, readonly) */}
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{getProveedor(i.abv)}</td>

                      {/* MARCA */}
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>
                        <CeldaEditable id={i.id} campo="marca" valor={i.marca} tipo="text" />
                      </td>

                      {/* FORMATO */}
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>
                        <CeldaEditable id={i.id} campo="formato" valor={i.formato} tipo="select" opciones={cfg.formatos} />
                      </td>

                      {/* UDS */}
                      <td className={tdCls + ' text-right'}>
                        <CeldaEditable id={i.id} campo="uds" valor={i.uds != null ? fmt(i.uds) : null} tipo="number" />
                      </td>

                      {/* UD STD */}
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>
                        <CeldaEditable id={i.id} campo="ud_std" valor={i.ud_std} tipo="select" opciones={cfg.unidades_std?.length ? cfg.unidades_std : ['Kg.', 'L.', 'Ud.']} />
                      </td>

                      {/* UD MIN */}
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>
                        <CeldaEditable id={i.id} campo="ud_min" valor={i.ud_min} tipo="select" opciones={cfg.unidades_min?.length ? cfg.unidades_min : ['gr.', 'ml.', 'ud.']} />
                      </td>

                      {/* USOS — semáforo, readonly */}
                      <td className={tdCls} style={{ textAlign: 'center', color: colorUsos(usos, isDark), fontWeight: 700 }}>
                        {usos}
                      </td>

                      {/* PRECIO1 */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-muted)]'}>
                        <CeldaEditable id={i.id} campo="precio1" valor={i.precio1 != null ? fmt(i.precio1) : null} tipo="number" />
                      </td>

                      {/* PRECIO2 */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-muted)]'}>
                        <CeldaEditable id={i.id} campo="precio2" valor={i.precio2 != null ? fmt(i.precio2) : null} tipo="number" />
                      </td>

                      {/* PRECIO3 */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-muted)]'}>
                        <CeldaEditable id={i.id} campo="precio3" valor={i.precio3 != null ? fmt(i.precio3) : null} tipo="number" />
                      </td>

                      {/* ÚLTIMO PRECIO (calculado, readonly) */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)]'}>{fmt(i.ultimo_precio ?? i.precio_activo)}</td>

                      {/* SELECTOR */}
                      <td className={tdCls + ' text-center text-xs'}>
                        <CeldaEditable id={i.id} campo="selector_precio" valor={i.selector_precio === 'ultimo' ? 'Último' : (i.selector_precio ?? 'Último')} tipo="select" opciones={['ultimo', 'media']} />
                      </td>

                      {/* PRECIO ACTIVO (calculado, readonly) */}
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)] font-semibold'}>{fmt(i.precio_activo)}</td>

                      {/* EUR/STD (calculado, readonly) */}
                      <td className={tdCls + ' text-right'}>{fmtNum(i.eur_std)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{i.ud_std ?? '—'}</td>

                      {/* EUR/MIN (calculado, readonly) */}
                      <td className={tdCls + ' text-right'}>{fmtNum(i.eur_min)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{i.ud_min ?? '—'}</td>

                      {/* TIPO MERMA */}
                      <td className={tdCls + ' text-xs text-[var(--sl-text-secondary)]'}>
                        <CeldaEditable id={i.id} campo="tipo_merma" valor={i.tipo_merma} tipo="select" opciones={['Manual', 'Tecnica']} />
                      </td>

                      {/* MERMA % — editable solo si Manual */}
                      <td className={tdCls + ' text-right'}>
                        {i.tipo_merma === 'Tecnica' ? (
                          <span style={{ color: isDark ? '#7080a8' : '#9ca3af' }}>{i.merma_pct ?? 0}</span>
                        ) : (
                          <CeldaEditable id={i.id} campo="merma_pct" valor={i.merma_pct} tipo="number" />
                        )}
                      </td>

                      {/* MERMA EF., C.NETO (calculados, readonly) */}
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
