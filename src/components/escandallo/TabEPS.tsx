import { useMemo } from 'react'
import type { EPS } from './types'
import { thCls, tdCls, fmtEurES, fmtES, fmtDateES, n, semaforoUsos, btnPrimary } from './types'

interface Props { epsList: EPS[]; onSelect: (eps: EPS) => void; onNew?: () => void }

export default function TabEPS({ epsList, onSelect, onNew }: Props) {
  const { total, enUso, sinUso } = useMemo(() => {
    const total = epsList.length
    const enUso = epsList.filter(e => n(e.usos) > 0).length
    return { total, enUso, sinUso: total - enUso }
  }, [epsList])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Counter label="TOTAL" value={total} />
        <Counter label="EN USO" value={enUso} color="text-green-400" />
        <Counter label="SIN USO" value={sinUso} color="text-red-400" />
        {onNew && <button onClick={onNew} className={btnPrimary + ' ml-auto'}>+ Nueva EPS</button>}
      </div>

      {!epsList.length ? (
        <div className="bg-card border border-[#333] rounded-xl p-12 text-center">
          <p className="text-[#888] text-sm">Sin EPS</p>
        </div>
      ) : (
        <div className="bg-card border border-[#333] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: '1000px' }}>
              <thead>
                <tr>
                  <th className={thCls}>CÓDIGO</th>
                  <th className={thCls}>NOMBRE</th>
                  <th className={thCls}>CATEGORÍA</th>
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
                {epsList.map(e => {
                  const usos = n(e.usos)
                  return (
                    <tr key={e.id} onClick={() => onSelect(e)} className="cursor-pointer">
                      <td className={tdCls + ' text-[#888] font-mono text-xs'}>{e.codigo ?? '—'}</td>
                      <td className={tdCls + ' text-[#4a9eff] italic font-medium'}>{e.nombre}</td>
                      <td className={tdCls + ' text-[#aaa]'}>{e.categoria ?? '—'}</td>
                      <td className={tdCls + ' text-right'}>{e.raciones ? fmtES(e.raciones, 0) : ''}</td>
                      <td className={tdCls + ' text-right'}>{e.tamano_rac != null ? fmtES(e.tamano_rac) : ''}</td>
                      <td className={tdCls + ' text-[#aaa]'}>{e.unidad}</td>
                      <td className={tdCls + ' text-right text-[#ddd]'}>{fmtEurES(e.coste_tanda, 4)}</td>
                      <td className={tdCls + ' text-right text-accent font-semibold'}>{fmtEurES(e.coste_rac, 4)}</td>
                      <td className={tdCls + ' text-center'}>
                        <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ' + semaforoUsos(usos)}>{usos}</span>
                      </td>
                      <td className={tdCls + ' text-[#888] text-xs'}>{e.fecha ? fmtDateES(e.fecha) : ''}</td>
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

function Counter({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card border border-[#333] rounded-lg px-4 py-2">
      <div className="text-[10px] text-[#888] uppercase tracking-wider">{label}</div>
      <div className={'text-lg font-bold tabular-nums ' + color}>{value}</div>
    </div>
  )
}
