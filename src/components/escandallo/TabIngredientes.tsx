import type { Ingrediente } from './types'
import { thCls, tdCls, fmt, fmtPct, n } from './types'

interface Props { ingredientes: Ingrediente[] }

export default function TabIngredientes({ ingredientes }: Props) {
  if (!ingredientes.length)
    return <div className="bg-card border border-border rounded-xl p-12 text-center"><p className="text-neutral-500 text-sm">Sin ingredientes</p></div>

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px]">
          <thead className="bg-base/50">
            <tr>
              <th className={thCls}>IDING</th>
              <th className={thCls}>Nombre</th>
              <th className={thCls}>Categoría</th>
              <th className={thCls}>ABV</th>
              <th className={thCls}>Marca</th>
              <th className={thCls}>Formato</th>
              <th className={thCls + ' text-right'}>UDS</th>
              <th className={thCls}>UD STD</th>
              <th className={thCls}>UD MIN</th>
              <th className={thCls + ' text-right'}>Usos</th>
              <th className={thCls + ' text-right'}>Precio1</th>
              <th className={thCls + ' text-right'}>Precio2</th>
              <th className={thCls + ' text-right'}>Precio3</th>
              <th className={thCls + ' text-right'}>Activo</th>
              <th className={thCls + ' text-right'}>€/STD</th>
              <th className={thCls + ' text-right'}>€/MIN</th>
              <th className={thCls + ' text-right'}>Merma%</th>
              <th className={thCls + ' text-right'}>C.Neto/STD</th>
              <th className={thCls + ' text-right'}>C.Neto/MIN</th>
            </tr>
          </thead>
          <tbody>
            {ingredientes.map(i => (
              <tr key={i.id} className="border-t border-border hover:bg-white/[0.02] transition">
                <td className={tdCls + ' text-neutral-500'}>{i.iding ?? '—'}</td>
                <td className={tdCls + ' text-white font-medium max-w-[200px] truncate'}>{i.nombre}</td>
                <td className={tdCls}>{i.categoria ?? '—'}</td>
                <td className={tdCls}>{i.abv ?? '—'}</td>
                <td className={tdCls}>{i.marca ?? '—'}</td>
                <td className={tdCls}>{i.formato ?? '—'}</td>
                <td className={tdCls + ' text-right'}>{fmt(i.uds)}</td>
                <td className={tdCls}>{i.ud_std ?? '—'}</td>
                <td className={tdCls}>{i.ud_min ?? '—'}</td>
                <td className={tdCls + ' text-right'}>{n(i.usos)}</td>
                <td className={tdCls + ' text-right'}>{fmt(i.precio1)}</td>
                <td className={tdCls + ' text-right'}>{fmt(i.precio2)}</td>
                <td className={tdCls + ' text-right'}>{fmt(i.precio3)}</td>
                <td className={tdCls + ' text-right text-accent font-medium'}>{fmt(i.precio_activo)}</td>
                <td className={tdCls + ' text-right'}>{fmt(i.eur_std, 4)}</td>
                <td className={tdCls + ' text-right'}>{fmt(i.eur_min, 6)}</td>
                <td className={tdCls + ' text-right'}>{fmtPct(i.merma_pct)}</td>
                <td className={tdCls + ' text-right'}>{fmt(i.coste_neto_std, 4)}</td>
                <td className={tdCls + ' text-right'}>{fmt(i.coste_neto_min, 6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
