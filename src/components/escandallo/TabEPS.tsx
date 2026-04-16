import type { EPS } from './types'
import { thCls, tdCls, fmt } from './types'

interface Props {
  epsList: EPS[]
  onSelect: (eps: EPS) => void
}

export default function TabEPS({ epsList, onSelect }: Props) {
  if (epsList.length === 0)
    return <div className="bg-card border border-border rounded-xl p-12 text-center"><p className="text-neutral-500 text-sm">Sin EPS</p></div>

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-base/50">
            <tr>
              <th className={thCls}>Código</th>
              <th className={thCls}>Nombre</th>
              <th className={thCls + ' text-right'}>Raciones</th>
              <th className={thCls + ' text-right'}>Tamaño Rac</th>
              <th className={thCls}>Unidad</th>
              <th className={thCls + ' text-right'}>Coste tanda</th>
              <th className={thCls + ' text-right'}>Coste/rac</th>
            </tr>
          </thead>
          <tbody>
            {epsList.map(e => (
              <tr
                key={e.id}
                onClick={() => onSelect(e)}
                className="border-t border-border hover:bg-white/[0.03] transition cursor-pointer"
              >
                <td className={tdCls + ' text-neutral-500'}>{e.codigo ?? '—'}</td>
                <td className={tdCls + ' text-white font-medium'}>{e.nombre}</td>
                <td className={tdCls + ' text-right'}>{e.raciones ?? 0}</td>
                <td className={tdCls + ' text-right'}>{e.tamano_rac ?? '—'}</td>
                <td className={tdCls}>{e.unidad}</td>
                <td className={tdCls + ' text-right'}>{fmt(e.coste_tanda, 4)}</td>
                <td className={tdCls + ' text-right text-accent font-medium'}>{fmt(e.coste_rac, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
