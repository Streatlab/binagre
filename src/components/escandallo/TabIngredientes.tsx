import type { Ingrediente } from './types'
import { thCls, tdCls, fmt, fmtPct, n } from './types'

interface Props { ingredientes: Ingrediente[] }

export default function TabIngredientes({ ingredientes }: Props) {
  if (!ingredientes.length)
    return <div className="bg-card border border-border rounded-xl p-12 text-center"><p className="text-neutral-500 text-sm">Sin ingredientes</p></div>

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[2200px]">
          <thead className="bg-base/50 sticky top-0 z-10">
            <tr>
              <th className={thCls}>IDING</th>
              <th className={thCls}>Categoria</th>
              <th className={thCls}>Nombre Base</th>
              <th className={thCls}>ABV</th>
              <th className={thCls}>Nombre</th>
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
              <th className={thCls + ' text-right border-l border-border'}>EUR/STD</th>
              <th className={thCls}>UD/STD</th>
              <th className={thCls + ' text-right'}>EUR/MIN</th>
              <th className={thCls}>UD/MIN</th>
              <th className={thCls + ' border-l border-border'}>Tipo Merma</th>
              <th className={thCls + ' text-right'}>Merma%</th>
              <th className={thCls + ' text-right'}>Merma Ef.</th>
              <th className={thCls + ' text-right border-l border-border'}>C.Neto/STD</th>
              <th className={thCls}>UD/Neto STD</th>
              <th className={thCls + ' text-right'}>C.Neto/MIN</th>
              <th className={thCls}>UD/Neto MIN</th>
            </tr>
          </thead>
          <tbody>
            {ingredientes.map(i => {
              const isEps = i.abv === 'EPS'
              const nameCls = isEps ? 'text-[#1155CC] italic' : 'text-white font-medium'
              return (
                <tr key={i.id} className="border-t border-border hover:bg-white/[0.02] transition">
                  <td className={tdCls + ' text-neutral-500'}>{i.iding ?? '—'}</td>
                  <td className={tdCls}>{i.categoria ?? '—'}</td>
                  <td className={tdCls + ' ' + nameCls + ' max-w-[200px] truncate'}>{i.nombre_base ?? '—'}</td>
                  <td className={tdCls + ' text-accent font-mono text-xs'}>{i.abv ?? '—'}</td>
                  <td className={tdCls + ' max-w-[180px] truncate ' + (isEps ? 'text-[#1155CC] italic' : '')}>{i.nombre}</td>
                  <td className={tdCls}>{i.marca ?? '—'}</td>
                  <td className={tdCls}>{i.formato ?? '—'}</td>
                  <td className={tdCls + ' text-right'}>{fmt(i.uds)}</td>
                  <td className={tdCls}>{i.ud_std ?? '—'}</td>
                  <td className={tdCls}>{i.ud_min ?? '—'}</td>
                  <td className={tdCls + ' text-right'}>{n(i.usos) || '—'}</td>
                  <td className={tdCls + ' text-right text-neutral-500'}>{fmt(i.precio1)}</td>
                  <td className={tdCls + ' text-right text-neutral-500'}>{fmt(i.precio2)}</td>
                  <td className={tdCls + ' text-right text-neutral-500'}>{fmt(i.precio3)}</td>
                  <td className={tdCls + ' text-right text-accent font-medium'}>{fmt(i.precio_activo)}</td>
                  <td className={tdCls + ' text-right border-l border-border'}>{fmt(i.eur_std, 4)}</td>
                  <td className={tdCls + ' text-neutral-500 text-xs'}>{i.ud_std ?? '—'}</td>
                  <td className={tdCls + ' text-right'}>{fmt(i.eur_min, 6)}</td>
                  <td className={tdCls + ' text-neutral-500 text-xs'}>{i.ud_min ?? '—'}</td>
                  <td className={tdCls + ' border-l border-border text-xs'}>{i.tipo_merma ?? '—'}</td>
                  <td className={tdCls + ' text-right'}>{i.merma_pct != null ? fmtPct(i.merma_pct) : '—'}</td>
                  <td className={tdCls + ' text-right text-orange-400'}>{i.merma_ef != null ? fmt(i.merma_ef, 4) : '—'}</td>
                  <td className={tdCls + ' text-right text-accent border-l border-border'}>{fmt(i.coste_neto_std, 4)}</td>
                  <td className={tdCls + ' text-neutral-500 text-xs'}>{i.ud_neto_std ?? i.ud_std ?? '—'}</td>
                  <td className={tdCls + ' text-right text-accent'}>{fmt(i.coste_neto_min, 6)}</td>
                  <td className={tdCls + ' text-neutral-500 text-xs'}>{i.ud_neto_min ?? i.ud_min ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
