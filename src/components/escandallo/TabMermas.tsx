import { useMemo, useState } from 'react'
import type { Merma } from './types'
import { thCls, tdCls, fmt, fmtPct, n } from './types'
import { fmtNum } from '@/utils/format'

interface Props {
  mermas: Merma[]
  onSelect?: (m: Merma) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

export default function TabMermas({ mermas, onSelect, onNew }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')
  const total = useMemo(() => mermas.length, [mermas])
  // Usos como proxy: si tiene porciones calculadas o num_porciones > 0 se considera en uso
  const enUso = useMemo(() => mermas.filter(m => n((m as any).usos) > 0 || n(m.num_porciones) > 0).length, [mermas])
  const sinUso = total - enUso
  const filtered = useMemo(() => {
    if (filter === 'enuso') return mermas.filter(m => n((m as any).usos) > 0 || n(m.num_porciones) > 0)
    if (filter === 'sinuso') return mermas.filter(m => !(n((m as any).usos) > 0 || n(m.num_porciones) > 0))
    return mermas
  }, [mermas, filter])
  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Counter label="TOTAL" value={total} active={filter === 'todos'} onClick={() => setFilter('todos')} />
        <Counter label="EN USO" value={enUso} valueClass="eps" active={filter === 'enuso'} onClick={() => toggle('enuso')} />
        <Counter label="SIN USO" value={sinUso} valueClass="rec" active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
        {onNew && <button onClick={onNew} className="ds-btn-add ml-auto">+ Nueva Merma</button>}
      </div>

      {!filtered.length ? (
        <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl p-12 text-center">
          <p className="text-[var(--sl-text-muted)] text-sm">Sin mermas{filter !== 'todos' ? ' en este filtro' : ''}</p>
        </div>
      ) : (
        <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl overflow-hidden">
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <table style={{ tableLayout: 'fixed', width: '2500px' }}>
              <colgroup>
                <col style={{ width: 90 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 55 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 55 }} />
                <col style={{ width: 65 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 75 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 55 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 75 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 55 }} />
                <col style={{ width: 75 }} />
                <col style={{ width: 75 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 75 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 85 }} />
              </colgroup>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th className={thCls + ' sticky left-0 z-30 bg-[var(--sl-thead)]'}>IDING</th>
                  <th className={thCls}>CATEGORIA</th>
                  <th className={thCls + ' sticky z-30 bg-[var(--sl-thead)]'} style={{ left: 90 }}>NOMBRE BASE</th>
                  <th className={thCls}>ABV</th>
                  <th className={thCls}>NOMBRE</th>
                  <th className={thCls}>MARCA</th>
                  <th className={thCls}>FORMATO</th>
                  <th className={thCls + ' text-right'}>UDS</th>
                  <th className={thCls}>UD STD</th>
                  <th className={thCls + ' text-right'}>PRECIO TOTAL</th>
                  <th className={thCls}>SP1 NOMBRE</th>
                  <th className={thCls + ' text-right'}>SP1 PESO(g)</th>
                  <th className={thCls + ' text-right'}>SP1 %</th>
                  <th className={thCls + ' text-right'}>SP1 €</th>
                  <th className={thCls + ' text-center'}>SP1 VAL.</th>
                  <th className={thCls}>SP2 NOMBRE</th>
                  <th className={thCls + ' text-right'}>SP2 PESO(g)</th>
                  <th className={thCls + ' text-right'}>SP2 %</th>
                  <th className={thCls + ' text-right'}>SP2 €</th>
                  <th className={thCls + ' text-center'}>SP2 VAL.</th>
                  <th className={thCls + ' text-right'}>% DESCARTE</th>
                  <th className={thCls + ' text-right'}>% MERMA</th>
                  <th className={thCls + ' text-right'}>% LIMPIO</th>
                  <th className={thCls + ' text-right'}>€ PIEZA LIMPIA</th>
                  <th className={thCls + ' text-right'}>€/KG NETO</th>
                  <th className={thCls + ' text-right'}>NETO (UD)</th>
                  <th className={thCls + ' text-right'}>NUM PORC.</th>
                  <th className={thCls + ' text-right'}>PESO PORC.(g)</th>
                  <th className={thCls + ' text-right'}>€/PORCION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} onClick={() => onSelect?.(m)} className="cursor-pointer hover:bg-[var(--sl-thead)] transition-colors">
                    <td className={tdCls + ' sticky left-0 z-10 text-[var(--sl-text-muted)] font-mono text-xs'}>{m.iding ?? '—'}</td>
                    <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{m.categoria ?? '—'}</td>
                    <td className={tdCls + ' sticky z-10 text-[var(--sl-text-primary)] font-medium max-w-[220px] truncate'} style={{ left: 90 }}>{m.nombre_base ?? '—'}</td>
                    <td className={tdCls + ' text-[var(--sl-text-primary)] font-mono text-xs font-bold'}>{m.abv ?? '—'}</td>
                    <td className={tdCls + ' max-w-[180px] truncate'}>{m.nombre}</td>
                    <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{m.marca ?? '—'}</td>
                    <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{m.formato ?? '—'}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.uds)}</td>
                    <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{m.ud_std ?? '—'}</td>
                    <td className={tdCls + ' text-right text-[var(--sl-text-primary)] font-medium'}>{fmt(m.precio_total)}</td>
                    <td className={tdCls + ' text-[var(--sl-text-secondary)] text-xs'}>{m.sp1_nombre ?? '—'}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.sp1_peso_g, 2)}</td>
                    <td className={tdCls + ' text-right'}>{m.sp1_pct != null ? fmtNum(m.sp1_pct * 100, 1) + '%' : ''}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.sp1_euros)}</td>
                    <td className={tdCls + ' text-center text-xs'}>{m.sp1_valorable ? <span className="text-[#16a34a]">Sí</span> : <span className="text-[var(--sl-text-muted)]">No</span>}</td>
                    <td className={tdCls + ' text-[var(--sl-text-secondary)] text-xs'}>{m.sp2_nombre ?? '—'}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.sp2_peso_g, 2)}</td>
                    <td className={tdCls + ' text-right'}>{m.sp2_pct != null ? fmtNum(m.sp2_pct * 100, 1) + '%' : ''}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.sp2_euros)}</td>
                    <td className={tdCls + ' text-center text-xs'}>{m.sp2_valorable ? <span className="text-[#16a34a]">Sí</span> : <span className="text-[var(--sl-text-muted)]">No</span>}</td>
                    <td className={tdCls + ' text-right'}>{fmtPct(m.pct_descarte)}</td>
                    <td className={tdCls + ' text-right text-[#ea580c]'}>{m.pct_merma != null ? fmtNum(m.pct_merma * 100, 1) + '%' : ''}</td>
                    <td className={tdCls + ' text-right text-[#16a34a]'}>{m.pct_limpio != null ? fmtNum(m.pct_limpio * 100, 1) + '%' : ''}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.eur_pieza_limpia, 4)}</td>
                    <td className={tdCls + ' text-right text-[var(--sl-text-primary)]'}>{fmt(m.eur_kg_neto, 4)}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.neto_kg, 3)}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.num_porciones, 0)}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.peso_porcion_g, 2)}</td>
                    <td className={tdCls + ' text-right text-[var(--sl-text-primary)] font-medium'}>{fmt(m.eur_porcion, 4)}</td>
                  </tr>
                ))}
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
