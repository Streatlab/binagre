import { useMemo, useState } from 'react'
import type { EPS } from './types'
import { thCls, tdCls, fmtEurES, fmtES, fmtDateES, n, semaforoUsos, btnPrimary } from './types'

interface Props { epsList: EPS[]; onSelect: (eps: EPS) => void; onNew?: () => void }

type Filter = 'todos' | 'enuso' | 'sinuso'

export default function TabEPS({ epsList, onSelect, onNew }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')

  const { total, enUso, sinUso, filtered } = useMemo(() => {
    const total = epsList.length
    const enUso = epsList.filter(e => n(e.usos) > 0).length
    const sinUso = total - enUso
    let filtered = epsList
    if (filter === 'enuso') filtered = epsList.filter(e => n(e.usos) > 0)
    else if (filter === 'sinuso') filtered = epsList.filter(e => n(e.usos) === 0)
    return { total, enUso, sinUso, filtered }
  }, [epsList, filter])

  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Counter label="TOTAL" value={total} active={filter === 'todos'} onClick={() => setFilter('todos')} />
        <Counter label="EN USO" value={enUso} color="text-[#16a34a]" active={filter === 'enuso'} onClick={() => toggle('enuso')} />
        <Counter label="SIN USO" value={sinUso} color="text-[#dc2626]" active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
        {onNew && <button onClick={onNew} className={btnPrimary + ' ml-auto'}>+ Nueva EPS</button>}
      </div>

      {!filtered.length ? (
        <div className="bg-[#484f66] border border-[#4a5270] rounded-xl p-12 text-center">
          <p className="text-[#7080a8] text-sm">Sin EPS{filter !== 'todos' ? ' en este filtro' : ''}</p>
        </div>
      ) : (
        <div className="bg-[#484f66] border border-[#4a5270] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: '900px' }}>
              <thead>
                <tr>
                  <th className={thCls}>CÓDIGO</th>
                  <th className={thCls}>NOMBRE</th>
                  <th className={thCls + ' text-right'}>RACIONES</th>
                  <th className={thCls + ' text-right'}>TAMAÑO RAC</th>
                  <th className={thCls}>UNIDAD</th>
                  <th className={thCls + ' text-right'}>COSTE TANDA</th>
                  <th className={thCls + ' text-right'}>COSTE/RAC</th>
                  <th className={thCls + ' text-center'}>USOS</th>
                  <th className={thCls}>FECHA</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const usos = n(e.usos)
                  return (
                    <tr key={e.id} onClick={() => onSelect(e)} className="cursor-pointer">
                      <td className={tdCls + ' text-[#7080a8] font-mono text-xs'}>{e.codigo ?? ''}</td>
                      <td className={tdCls + ' text-[#66aaff] italic font-medium'}>{e.nombre}</td>
                      <td className={tdCls + ' text-right'}>{e.raciones ? fmtES(e.raciones, 0) : ''}</td>
                      <td className={tdCls + ' text-right'}>{e.tamano_rac != null ? fmtES(e.tamano_rac) : ''}</td>
                      <td className={tdCls + ' text-[#c8d0e8]'}>{e.unidad}</td>
                      <td className={tdCls + ' text-right text-[#f0f0ff]'}>{fmtEurES(e.coste_tanda, 4)}</td>
                      <td className={tdCls + ' text-right text-[#f0f0ff] font-semibold'}>{fmtEurES(e.coste_rac, 4)}</td>
                      <td className={tdCls + ' text-center'}>
                        <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ' + semaforoUsos(usos)}>{usos}</span>
                      </td>
                      <td className={tdCls + ' text-[#7080a8] text-xs'}>{e.fecha ? fmtDateES(e.fecha) : ''}</td>
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
