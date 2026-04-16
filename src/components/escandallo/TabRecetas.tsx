import type { Receta } from './types'
import { thCls, tdCls, fmt, semaforoClasses } from './types'

interface Props {
  recetasList: Receta[]
  onSelect: (receta: Receta) => void
}

/** Margen % Uber = (PVP/1.1 − coste_rac − PVP×0.30) / (PVP/1.1) */
function margenUber(r: Receta): number {
  const pvp = r.pvp_uber ?? 0
  if (pvp <= 0) return 0
  const neto = pvp / 1.1
  return ((neto - (r.coste_rac ?? 0) - pvp * 0.30) / neto) * 100
}

export default function TabRecetas({ recetasList, onSelect }: Props) {
  if (recetasList.length === 0)
    return <div className="bg-card border border-border rounded-xl p-12 text-center"><p className="text-neutral-500 text-sm">Sin recetas</p></div>

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-base/50">
            <tr>
              <th className={thCls}>Código</th>
              <th className={thCls}>Nombre</th>
              <th className={thCls + ' text-right'}>Coste/rac</th>
              <th className={thCls + ' text-right'}>PVP Uber</th>
              <th className={thCls + ' text-right'}>Margen %</th>
              <th className={thCls + ' text-center'}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {recetasList.map(r => {
              const m = margenUber(r)
              return (
                <tr
                  key={r.id}
                  onClick={() => onSelect(r)}
                  className="border-t border-border hover:bg-white/[0.03] transition cursor-pointer"
                >
                  <td className={tdCls + ' text-neutral-500'}>{r.codigo ?? '—'}</td>
                  <td className={tdCls + ' text-white font-medium'}>{r.nombre}</td>
                  <td className={tdCls + ' text-right'}>{fmt(r.coste_rac)}</td>
                  <td className={tdCls + ' text-right'}>{fmt(r.pvp_uber)}</td>
                  <td className={tdCls + ' text-right'}>{(r.pvp_uber ?? 0) > 0 ? m.toFixed(1) + '%' : '—'}</td>
                  <td className={tdCls + ' text-center'}>
                    {(r.pvp_uber ?? 0) > 0 ? (
                      <span className={'inline-block px-2 py-0.5 rounded-md text-xs font-semibold ' + semaforoClasses(m)}>
                        {m >= 15 ? 'OK' : m >= 10 ? 'Bajo' : 'Crítico'}
                      </span>
                    ) : <span className="text-neutral-600">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
