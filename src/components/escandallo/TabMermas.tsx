import type { Merma } from './types'
import { thCls, tdCls, fmt, fmtPct } from './types'

interface Props {
  mermas: Merma[]
}

export default function TabMermas({ mermas }: Props) {
  if (mermas.length === 0)
    return <div className="bg-card border border-border rounded-xl p-12 text-center"><p className="text-neutral-500 text-sm">Sin mermas</p></div>

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-base/50">
            <tr>
              <th className={thCls}>Nombre</th>
              <th className={thCls}>Ud.STD</th>
              <th className={thCls + ' text-right'}>Precio Total</th>
              <th className={thCls + ' text-right'}>% Merma</th>
              <th className={thCls + ' text-right'}>% Limpio</th>
              <th className={thCls + ' text-right'}>€/Kg Neto</th>
              <th className={thCls + ' text-right'}>Nº Porciones</th>
              <th className={thCls + ' text-right'}>€/Porción</th>
            </tr>
          </thead>
          <tbody>
            {mermas.map(m => (
              <tr key={m.id} className="border-t border-border hover:bg-white/[0.02] transition">
                <td className={tdCls + ' text-white font-medium'}>{m.nombre}</td>
                <td className={tdCls}>{m.ud_std ?? '—'}</td>
                <td className={tdCls + ' text-right'}>{fmt(m.precio_total)}</td>
                <td className={tdCls + ' text-right'}>{fmtPct(m.pct_merma)}</td>
                <td className={tdCls + ' text-right'}>{fmtPct(m.pct_limpio)}</td>
                <td className={tdCls + ' text-right'}>{fmt(m.eur_kg_neto, 4)}</td>
                <td className={tdCls + ' text-right'}>{m.num_porciones ?? 0}</td>
                <td className={tdCls + ' text-right text-accent font-medium'}>{fmt(m.eur_porcion, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
