import { useMemo, useState } from 'react'
import type { Merma } from './types'
import { thCls, tdCls, fmt, fmtPct, n, btnPrimary } from './types'

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
        <Counter label="EN USO" value={enUso} color="text-green-600" active={filter === 'enuso'} onClick={() => toggle('enuso')} />
        <Counter label="SIN USO" value={sinUso} color="text-red-600" active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
        {onNew && <button onClick={onNew} className={btnPrimary + ' ml-auto'}>+ Nueva Merma</button>}
      </div>

      {!filtered.length ? (
        <div className="bg-[#484f66] border border-[#4a5270] rounded-xl p-12 text-center">
          <p className="text-[#7080a8] text-sm">Sin mermas{filter !== 'todos' ? ' en este filtro' : ''}</p>
        </div>
      ) : (
        <div className="bg-[#484f66] border border-[#4a5270] rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-240px)] overflow-y-auto">
            <table className="w-full" style={{ minWidth: '2400px' }}>
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className={thCls + ' sticky left-0 z-30 bg-[#2e3347]'} style={{ minWidth: 90 }}>IDING</th>
                  <th className={thCls}>CATEGORIA</th>
                  <th className={thCls + ' sticky z-30 bg-[#2e3347]'} style={{ left: 90, minWidth: 220 }}>NOMBRE BASE</th>
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
                  <tr key={m.id} onClick={() => onSelect?.(m)} className="cursor-pointer hover:bg-[#353a50] transition-colors">
                    <td className={tdCls + ' sticky left-0 z-10 text-[#7080a8] font-mono text-xs'}>{m.iding ?? '—'}</td>
                    <td className={tdCls + ' text-[#c8d0e8]'}>{m.categoria ?? '—'}</td>
                    <td className={tdCls + ' sticky z-10 text-[#f0f0ff] font-medium max-w-[220px] truncate'} style={{ left: 90 }}>{m.nombre_base ?? '—'}</td>
                    <td className={tdCls + ' text-[#f0f0ff] font-mono text-xs font-bold'}>{m.abv ?? '—'}</td>
                    <td className={tdCls + ' max-w-[180px] truncate'}>{m.nombre}</td>
                    <td className={tdCls + ' text-[#c8d0e8]'}>{m.marca ?? '—'}</td>
                    <td className={tdCls + ' text-[#c8d0e8]'}>{m.formato ?? '—'}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.uds)}</td>
                    <td className={tdCls + ' text-[#c8d0e8]'}>{m.ud_std ?? '—'}</td>
                    <td className={tdCls + ' text-right text-[#f0f0ff] font-medium'}>{fmt(m.precio_total)}</td>
                    <td className={tdCls + ' text-[#c8d0e8] text-xs'}>{m.sp1_nombre ?? '—'}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.sp1_peso_g, 0)}</td>
                    <td className={tdCls + ' text-right'}>{m.sp1_pct != null ? (m.sp1_pct * 100).toFixed(1) + '%' : '—'}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.sp1_euros)}</td>
                    <td className={tdCls + ' text-center text-xs'}>{m.sp1_valorable ? <span className="text-[#16a34a]">Sí</span> : <span className="text-[#8090b8]">No</span>}</td>
                    <td className={tdCls + ' text-[#c8d0e8] text-xs'}>{m.sp2_nombre ?? '—'}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.sp2_peso_g, 0)}</td>
                    <td className={tdCls + ' text-right'}>{m.sp2_pct != null ? (m.sp2_pct * 100).toFixed(1) + '%' : '—'}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.sp2_euros)}</td>
                    <td className={tdCls + ' text-center text-xs'}>{m.sp2_valorable ? <span className="text-[#16a34a]">Sí</span> : <span className="text-[#8090b8]">No</span>}</td>
                    <td className={tdCls + ' text-right'}>{fmtPct(m.pct_descarte)}</td>
                    <td className={tdCls + ' text-right text-[#ea580c]'}>{m.pct_merma != null ? (m.pct_merma * 100).toFixed(1) + '%' : '—'}</td>
                    <td className={tdCls + ' text-right text-[#16a34a]'}>{m.pct_limpio != null ? (m.pct_limpio * 100).toFixed(1) + '%' : '—'}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.eur_pieza_limpia, 4)}</td>
                    <td className={tdCls + ' text-right text-[#f0f0ff]'}>{fmt(m.eur_kg_neto, 4)}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.neto_kg, 3)}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.num_porciones, 0)}</td>
                    <td className={tdCls + ' text-right'}>{fmt(m.peso_porcion_g, 0)}</td>
                    <td className={tdCls + ' text-right text-[#f0f0ff] font-medium'}>{fmt(m.eur_porcion, 4)}</td>
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

function Counter({ label, value, color = 'text-[#f0f0ff]', active, onClick }: { label: string; value: number; color?: string; active?: boolean; onClick?: () => void }) {
  const base = 'bg-[#484f66] border rounded-lg px-4 py-2 transition-colors cursor-pointer select-none'
  const cls = active ? base + ' border-accent' : base + ' border-[#4a5270] hover:border-[#6070a0]'
  return (
    <button onClick={onClick} type="button" className={cls}>
      <div className="text-[10px] text-[#7080a8] uppercase tracking-wider">{label}</div>
      <div className={'text-lg font-bold tabular-nums ' + color}>{value}</div>
    </button>
  )
}
