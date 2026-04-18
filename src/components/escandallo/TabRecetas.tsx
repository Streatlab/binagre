import { useMemo, useState } from 'react'
import type { Receta } from './types'
import { thCls, tdCls, fmtEurES, fmtES, fmtPctES, fmtDateES, semaforoClasses, n, ESTRUCTURA_PCT } from './types'

interface Props { recetasList: Receta[]; onSelect: (r: Receta) => void; onNew?: () => void }

type Filter = 'todos' | 'conpvp' | 'sinpvp'

/** Margen% Uber = (PVP/1.1 − coste_rac − estructura(30%) − PVP×0.30) / (PVP/1.1) */
function margenUber(r: Receta): number {
  const pvp = n(r.pvp_uber)
  if (pvp <= 0) return 0
  const neto = pvp / 1.1
  const estructura = ESTRUCTURA_PCT * neto
  return ((neto - n(r.coste_rac) - estructura - pvp * 0.30) / neto) * 100
}

export default function TabRecetas({ recetasList, onSelect, onNew }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')
  const total = useMemo(() => recetasList.length, [recetasList])
  const conPvp = useMemo(() => recetasList.filter(r => n(r.pvp_uber) > 0).length, [recetasList])
  const filtered = useMemo(() => {
    if (filter === 'conpvp') return recetasList.filter(r => n(r.pvp_uber) > 0)
    if (filter === 'sinpvp') return recetasList.filter(r => n(r.pvp_uber) === 0)
    return recetasList
  }, [recetasList, filter])
  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Counter label="TOTAL" value={total} active={filter === 'todos'} onClick={() => setFilter('todos')} />
        <Counter label="CON PVP" value={conPvp} valueClass="eps" active={filter === 'conpvp'} onClick={() => toggle('conpvp')} />
        <Counter label="SIN PVP" value={total - conPvp} valueClass="rec" active={filter === 'sinpvp'} onClick={() => toggle('sinpvp')} />
        {onNew && <button onClick={onNew} className="ds-btn-add ml-auto">+ Nueva Receta</button>}
      </div>

      {!filtered.length ? (
        <div className="bg-[#484f66] border border-[#4a5270] rounded-xl p-12 text-center">
          <p className="text-[#7080a8] text-sm">Sin recetas{filter !== 'todos' ? ' en este filtro' : ''}</p>
        </div>
      ) : (
        <div className="bg-[#484f66] border border-[#4a5270] rounded-xl overflow-hidden">
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <table style={{ tableLayout: 'auto', width: '100%' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th className={thCls}>CÓDIGO</th>
                  <th className={thCls} style={{ minWidth: 200 }}>NOMBRE</th>
                  <th className={thCls}>CATEGORÍA</th>
                  <th className={thCls + ' text-right'}>RACIONES</th>
                  <th className={thCls + ' text-right'}>TAMAÑO RAC</th>
                  <th className={thCls}>UNIDAD</th>
                  <th className={thCls + ' text-right'}>COSTE TANDA</th>
                  <th className={thCls + ' text-right'}>COSTE/RAC</th>
                  <th className={thCls + ' text-right'}>PVP UE</th>
                  <th className={thCls + ' text-center'}>MARGEN% UE</th>
                  <th className={thCls}>FECHA</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const m = margenUber(r)
                  const hasPvp = n(r.pvp_uber) > 0
                  return (
                    <tr key={r.id} onClick={() => onSelect(r)} className="cursor-pointer">
                      <td className={tdCls + ' ds-rec-name font-mono text-xs'}>{r.codigo ?? ''}</td>
                      <td className={tdCls + ' ds-rec-name'}>{r.nombre}</td>
                      <td className={tdCls + ' text-[#c8d0e8]'}>{r.categoria ?? ''}</td>
                      <td className={tdCls + ' text-right'}>{r.raciones ? fmtES(r.raciones, 0) : ''}</td>
                      <td className={tdCls + ' text-right'}>{r.tamano_rac != null ? fmtES(r.tamano_rac) : ''}</td>
                      <td className={tdCls + ' text-[#c8d0e8]'}>{r.unidad ?? ''}</td>
                      <td className={tdCls + ' text-right text-[#f0f0ff]'}>{fmtEurES(r.coste_tanda, 2)}</td>
                      <td className={tdCls + ' text-right text-[#f0f0ff] font-semibold'}>{fmtEurES(r.coste_rac, 2)}</td>
                      <td className={tdCls + ' text-right'}>{hasPvp ? fmtEurES(r.pvp_uber, 2) : ''}</td>
                      <td className={tdCls + ' text-center'}>
                        {hasPvp ? (
                          <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold ' + semaforoClasses(m)}>
                            {fmtPctES(m, 2)}
                          </span>
                        ) : ''}
                      </td>
                      <td className={tdCls + ' text-[#7080a8] text-xs'}>{r.fecha ? fmtDateES(r.fecha) : ''}</td>
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
