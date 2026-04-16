import type { Ingrediente } from './types'
import { thCls, tdCls, fmt, fmtPct } from './types'

interface Props {
  ingredientes: Ingrediente[]
}

export default function TabIngredientes({ ingredientes }: Props) {
  if (ingredientes.length === 0)
    return <div className="bg-card border border-border rounded-xl p-12 text-center"><p className="text-neutral-500 text-sm">Sin ingredientes</p></div>

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-base/50">
            <tr>
              <th className={thCls}>Código</th>
              <th className={thCls}>Nombre</th>
              <th className={thCls}>Categoría</th>
              <th className={thCls}>Proveedor</th>
              <th className={thCls + ' text-right'}>€/STD</th>
              <th className={thCls}>Ud.STD</th>
              <th className={thCls + ' text-right'}>€/MIN</th>
              <th className={thCls}>Ud.MIN</th>
              <th className={thCls + ' text-right'}>Merma %</th>
              <th className={thCls + ' text-right'}>Usos</th>
            </tr>
          </thead>
          <tbody>
            {ingredientes.map(i => (
              <tr key={i.id} className="border-t border-border hover:bg-white/[0.02] transition">
                <td className={tdCls + ' text-neutral-500'}>{i.iding ?? '—'}</td>
                <td className={tdCls + ' text-white font-medium'}>{i.nombre}</td>
                <td className={tdCls}>{i.categoria ?? '—'}</td>
                <td className={tdCls}>{i.marca ?? '—'}</td>
                <td className={tdCls + ' text-right'}>{fmt(i.eur_std, 4)}</td>
                <td className={tdCls}>{i.ud_std}</td>
                <td className={tdCls + ' text-right'}>{fmt(i.eur_min, 6)}</td>
                <td className={tdCls}>{i.ud_min}</td>
                <td className={tdCls + ' text-right'}>{fmtPct(i.merma_pct)}</td>
                <td className={tdCls + ' text-right'}>{i.usos ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
