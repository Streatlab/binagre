import type { Merma } from './types'
import { thCls, tdCls, fmt, fmtPct } from './types'

interface Props { mermas: Merma[] }

export default function TabMermas({ mermas }: Props) {
  if (!mermas.length)
    return <div className="bg-card border border-border rounded-xl p-12 text-center"><p className="text-neutral-500 text-sm">Sin mermas</p></div>

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1800px]">
          <thead className="bg-base/50">
            <tr>
              <th className={thCls}>IDING</th>
              <th className={thCls}>Nombre</th>
              <th className={thCls + ' text-right'}>UDS</th>
              <th className={thCls}>UD STD</th>
              <th className={thCls + ' text-right'}>Precio Total</th>
              <th className={thCls}>SP1 Nombre</th>
              <th className={thCls + ' text-right'}>SP1 Peso(g)</th>
              <th className={thCls + ' text-right'}>SP1%</th>
              <th className={thCls + ' text-right'}>SP1 €</th>
              <th className={thCls}>SP1 Val.</th>
              <th className={thCls}>SP2 Nombre</th>
              <th className={thCls + ' text-right'}>SP2 Peso(g)</th>
              <th className={thCls + ' text-right'}>SP2%</th>
              <th className={thCls + ' text-right'}>SP2 €</th>
              <th className={thCls}>SP2 Val.</th>
              <th className={thCls + ' text-right'}>%SP1</th>
              <th className={thCls + ' text-right'}>%SP2</th>
              <th className={thCls + ' text-right'}>%Descarte</th>
              <th className={thCls + ' text-right'}>%Merma</th>
              <th className={thCls + ' text-right'}>%Limpio</th>
              <th className={thCls + ' text-right'}>€ Pieza Limpia</th>
              <th className={thCls + ' text-right'}>€/Kg Neto</th>
              <th className={thCls + ' text-right'}>Neto(Kg)</th>
              <th className={thCls + ' text-right'}>Nº Porciones</th>
              <th className={thCls + ' text-right'}>Peso Porción</th>
              <th className={thCls + ' text-right'}>€/Porción</th>
            </tr>
          </thead>
          <tbody>
            {mermas.map(m => (
              <tr key={m.id} className="border-t border-border hover:bg-white/[0.02] transition">
                <td className={tdCls + ' text-neutral-500'}>{m.iding ?? '—'}</td>
                <td className={tdCls + ' text-white font-medium max-w-[180px] truncate'}>{m.nombre}</td>
                <td className={tdCls + ' text-right'}>{fmt(m.uds)}</td>
                <td className={tdCls}>{m.ud_std ?? '—'}</td>
                <td className={tdCls + ' text-right'}>{fmt(m.precio_total)}</td>
                <td className={tdCls}>{m.sp1_nombre ?? '—'}</td>
                <td className={tdCls + ' text-right'}>{fmt(m.sp1_peso_g)}</td>
                <td className={tdCls + ' text-right'}>{fmtPct(m.sp1_pct)}</td>
                <td className={tdCls + ' text-right'}>{fmt(m.sp1_euros)}</td>
                <td className={tdCls}>{m.sp1_valorable ? 'Sí' : 'No'}</td>
                <td className={tdCls}>{m.sp2_nombre ?? '—'}</td>
                <td className={tdCls + ' text-right'}>{fmt(m.sp2_peso_g)}</td>
                <td className={tdCls + ' text-right'}>{fmtPct(m.sp2_pct)}</td>
                <td className={tdCls + ' text-right'}>{fmt(m.sp2_euros)}</td>
                <td className={tdCls}>{m.sp2_valorable ? 'Sí' : 'No'}</td>
                <td className={tdCls + ' text-right'}>{fmtPct(m.pct_sp1)}</td>
                <td className={tdCls + ' text-right'}>{fmtPct(m.pct_sp2)}</td>
                <td className={tdCls + ' text-right'}>{fmtPct(m.pct_descarte)}</td>
                <td className={tdCls + ' text-right'}>{fmtPct(m.pct_merma)}</td>
                <td className={tdCls + ' text-right'}>{fmtPct(m.pct_limpio)}</td>
                <td className={tdCls + ' text-right'}>{fmt(m.eur_pieza_limpia)}</td>
                <td className={tdCls + ' text-right'}>{fmt(m.eur_kg_neto, 4)}</td>
                <td className={tdCls + ' text-right'}>{fmt(m.neto_kg, 3)}</td>
                <td className={tdCls + ' text-right'}>{fmt(m.num_porciones)}</td>
                <td className={tdCls + ' text-right'}>{fmt(m.peso_porcion_g)}</td>
                <td className={tdCls + ' text-right text-accent font-medium'}>{fmt(m.eur_porcion, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
