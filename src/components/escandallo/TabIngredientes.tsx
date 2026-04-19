import { useMemo, useState } from 'react'
import type { Ingrediente } from './types'
import { thCls, tdCls, fmt, fmtPct, n, getProveedor, semaforoUsos } from './types'
import { fmtNum } from '@/utils/format'

interface Props {
  ingredientes: Ingrediente[]
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

export default function TabIngredientes({ ingredientes, onSelect, onNew }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')

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
                  const usos = n(i.usos)
                  return (
                    <tr key={i.id} onClick={() => onSelect?.(i)}
                      className="cursor-pointer hover:bg-[var(--sl-thead)] transition-colors">
                      <td className={tdCls + ' sticky left-0 z-10 text-[var(--sl-text-muted)] font-mono text-xs'}>{i.iding ?? '—'}</td>
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{i.categoria ?? '—'}</td>
                      <td className={tdCls + ' sticky z-10 max-w-[220px] truncate ' + rowNameCls} style={{ left: 90 }}>{i.nombre_base ?? '—'}</td>
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
                      <td className={tdCls + ' text-right text-[var(--sl-text-muted)]'}>{fmt(i.precio1)}</td>
                      <td className={tdCls + ' text-right text-[var(--sl-text-muted)]'}>{fmt(i.precio2)}</td>
                      <td className={tdCls + ' text-right text-[var(--sl-text-muted)]'}>{fmt(i.precio3)}</td>
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)]'}>{fmt(i.ultimo_precio ?? i.precio_activo)}</td>
                      <td className={tdCls + ' text-center text-xs'}>
                        <span className="px-1.5 py-0.5 rounded bg-[var(--sl-border)] text-[var(--sl-text-secondary)]">{i.selector_precio ?? 'Último'}</span>
                      </td>
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)] font-semibold'}>{fmt(i.precio_activo)}</td>
                      <td className={tdCls + ' text-right'}>{fmtNum(i.eur_std)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{i.ud_std ?? '—'}</td>
                      <td className={tdCls + ' text-right'}>{fmtNum(i.eur_min)}</td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{i.ud_min ?? '—'}</td>
                      <td className={tdCls + ' text-xs text-[var(--sl-text-secondary)]'}>{i.tipo_merma ?? '—'}</td>
                      <td className={tdCls + ' text-right'}>{i.merma_pct != null ? fmtPct(i.merma_pct) : '—'}</td>
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
