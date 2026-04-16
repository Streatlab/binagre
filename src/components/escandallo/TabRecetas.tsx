import { useMemo } from 'react'
import type { Receta } from './types'
import { thCls, tdCls, fmt, semaforoClasses, n, ESTRUCTURA_PCT, btnPrimary } from './types'

interface Props { recetasList: Receta[]; onSelect: (r: Receta) => void; onNew?: () => void }

/** Margen% Uber = (PVP/1.1 − coste_rac − estructura(30%) − PVP×0.30) / (PVP/1.1) */
function margenUber(r: Receta): number {
  const pvp = n(r.pvp_uber)
  if (pvp <= 0) return 0
  const neto = pvp / 1.1
  const estructura = ESTRUCTURA_PCT * neto
  return ((neto - n(r.coste_rac) - estructura - pvp * 0.30) / neto) * 100
}

export default function TabRecetas({ recetasList, onSelect, onNew }: Props) {
  const total = useMemo(() => recetasList.length, [recetasList])
  const conPvp = useMemo(() => recetasList.filter(r => n(r.pvp_uber) > 0).length, [recetasList])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Counter label="TOTAL" value={total} />
        <Counter label="CON PVP" value={conPvp} color="text-green-400" />
        <Counter label="SIN PVP" value={total - conPvp} color="text-red-400" />
        {onNew && <button onClick={onNew} className={btnPrimary + ' ml-auto'}>+ Nueva Receta</button>}
      </div>

      {!recetasList.length ? (
        <div className="bg-card border border-[#333] rounded-xl p-12 text-center">
          <p className="text-[#888] text-sm">Sin recetas</p>
        </div>
      ) : (
        <div className="bg-card border border-[#333] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: '1100px' }}>
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
                  <th className={thCls + ' text-right'}>PVP UE</th>
                  <th className={thCls + ' text-center'}>MARGEN% UE</th>
                  <th className={thCls}>FECHA</th>
                </tr>
              </thead>
              <tbody>
                {recetasList.map(r => {
                  const m = margenUber(r)
                  const hasPvp = n(r.pvp_uber) > 0
                  return (
                    <tr key={r.id} onClick={() => onSelect(r)} className="cursor-pointer">
                      <td className={tdCls + ' text-[#888] font-mono text-xs'}>{r.codigo ?? '—'}</td>
                      <td className={tdCls + ' text-white font-medium'}>{r.nombre}</td>
                      <td className={tdCls + ' text-[#aaa]'}>{r.categoria ?? '—'}</td>
                      <td className={tdCls + ' text-right'}>{r.raciones ?? 0}</td>
                      <td className={tdCls + ' text-right'}>{fmt(r.tamano_rac)}</td>
                      <td className={tdCls + ' text-[#aaa]'}>{r.unidad ?? '—'}</td>
                      <td className={tdCls + ' text-right text-[#ddd]'}>{fmt(r.coste_tanda, 4)}</td>
                      <td className={tdCls + ' text-right text-accent font-semibold'}>{fmt(r.coste_rac, 4)}</td>
                      <td className={tdCls + ' text-right'}>{fmt(r.pvp_uber)}</td>
                      <td className={tdCls + ' text-center'}>
                        {hasPvp ? (
                          <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold ' + semaforoClasses(m)}>
                            {m.toFixed(1)}%
                          </span>
                        ) : <span className="text-[#666]">—</span>}
                      </td>
                      <td className={tdCls + ' text-[#888] text-xs'}>{r.fecha ?? '—'}</td>
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
