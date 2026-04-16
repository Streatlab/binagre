import { useMemo } from 'react'
import type { Ingrediente } from './types'
import { thCls, tdCls, fmt, fmtPct, n, getProveedor, semaforoUsos, btnPrimary } from './types'

interface Props {
  ingredientes: Ingrediente[]
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
}

export default function TabIngredientes({ ingredientes, onSelect, onNew }: Props) {
  const { total, enUso, sinUso } = useMemo(() => {
    const total = ingredientes.length
    const enUso = ingredientes.filter(i => n(i.usos) > 0).length
    return { total, enUso, sinUso: total - enUso }
  }, [ingredientes])

  return (
    <div className="space-y-4">
      {/* Contadores + acciones */}
      <div className="flex flex-wrap items-center gap-4">
        <Counter label="TOTAL" value={total} />
        <Counter label="EN USO" value={enUso} color="text-green-400" />
        <Counter label="SIN USO" value={sinUso} color="text-red-400" />
        {onNew && (
          <button onClick={onNew} className={btnPrimary + ' ml-auto'}>+ Nuevo Ingrediente</button>
        )}
      </div>

      {!ingredientes.length ? (
        <div className="bg-card border border-[#333] rounded-xl p-12 text-center">
          <p className="text-[#888] text-sm">Sin ingredientes</p>
        </div>
      ) : (
        <div className="bg-card border border-[#333] rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-240px)] overflow-y-auto">
            <table className="w-full" style={{ minWidth: '2700px' }}>
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className={thCls + ' sticky left-0 z-30 bg-[#1f1f1f]'} style={{ minWidth: 90 }}>IDING</th>
                  <th className={thCls}>CATEGORIA</th>
                  <th className={thCls + ' sticky z-30 bg-[#1f1f1f]'} style={{ left: 90, minWidth: 220 }}>NOMBRE BASE</th>
                  <th className={thCls}>ABV</th>
                  <th className={thCls}>NOMBRE</th>
                  <th className={thCls}>PROVEEDOR</th>
                  <th className={thCls}>MARCA</th>
                  <th className={thCls}>FORMATO</th>
                  <th className={thCls + ' text-right'}>UDS</th>
                  <th className={thCls}>UD STD</th>
                  <th className={thCls}>UD MIN</th>
                  <th className={thCls + ' text-center'}>USOS</th>
                  <th className={thCls + ' text-right'}>PRECIO1</th>
                  <th className={thCls + ' text-right'}>PRECIO2</th>
                  <th className={thCls + ' text-right'}>PRECIO3</th>
                  <th className={thCls + ' text-right'}>ÚLTIMO PRECIO</th>
                  <th className={thCls + ' text-center'}>SELECTOR</th>
                  <th className={thCls + ' text-right'}>ACTIVO</th>
                  <th className={thCls + ' text-right'}>EUR/STD</th>
                  <th className={thCls}>UD/STD</th>
                  <th className={thCls + ' text-right'}>EUR/MIN</th>
                  <th className={thCls}>UD/MIN</th>
                  <th className={thCls}>TIPO MERMA</th>
                  <th className={thCls + ' text-right'}>MERMA%</th>
                  <th className={thCls + ' text-right'}>MERMA EF.</th>
                  <th className={thCls + ' text-right'}>C.NETO/STD</th>
                  <th className={thCls}>UD/NETO STD</th>
                  <th className={thCls + ' text-right'}>C.NETO/MIN</th>
                  <th className={thCls}>UD/NETO MIN</th>
                </tr>
              </thead>
              <tbody>
                {ingredientes.map(i => {
                  const isEps = i.abv === 'EPS'
                  const rowNameCls = isEps ? 'text-[#1155CC] italic font-medium' : 'text-white font-medium'
                  const usos = n(i.usos)
                  return (
                    <tr key={i.id} onClick={() => onSelect?.(i)}
                      className="cursor-pointer">
                      <td className={tdCls + ' sticky left-0 z-10 text-[#888] font-mono text-xs'}>{i.iding ?? '—'}</td>
                      <td className={tdCls + ' text-[#aaa]'}>{i.categoria ?? '—'}</td>
                      <td className={tdCls + ' sticky z-10 max-w-[220px] truncate ' + rowNameCls} style={{ left: 90 }}>{i.nombre_base ?? '—'}</td>
                      <td className={tdCls + ' text-accent font-mono text-xs font-bold'}>{i.abv ?? '—'}</td>
                      <td className={tdCls + ' max-w-[180px] truncate ' + (isEps ? 'text-[#1155CC] italic' : 'text-[#ddd]')}>{i.nombre}</td>
                      <td className={tdCls + ' text-[#aaa]'}>{getProveedor(i.abv)}</td>
                      <td className={tdCls + ' text-[#aaa]'}>{i.marca ?? '—'}</td>
                      <td className={tdCls + ' text-[#aaa]'}>{i.formato ?? '—'}</td>
                      <td className={tdCls + ' text-right'}>{fmt(i.uds)}</td>
                      <td className={tdCls + ' text-[#aaa]'}>{i.ud_std ?? '—'}</td>
                      <td className={tdCls + ' text-[#aaa]'}>{i.ud_min ?? '—'}</td>
                      <td className={tdCls + ' text-center'}>
                        <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ' + semaforoUsos(usos)}>
                          {usos}
                        </span>
                      </td>
                      <td className={tdCls + ' text-right text-[#888]'}>{fmt(i.precio1)}</td>
                      <td className={tdCls + ' text-right text-[#888]'}>{fmt(i.precio2)}</td>
                      <td className={tdCls + ' text-right text-[#888]'}>{fmt(i.precio3)}</td>
                      <td className={tdCls + ' text-right text-[#ddd]'}>{fmt(i.ultimo_precio ?? i.precio_activo)}</td>
                      <td className={tdCls + ' text-center text-xs'}>
                        <span className="px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[#aaa]">{i.selector_precio ?? 'Último'}</span>
                      </td>
                      <td className={tdCls + ' text-right text-accent font-semibold'}>{fmt(i.precio_activo)}</td>
                      <td className={tdCls + ' text-right'}>{fmt(i.eur_std, 4)}</td>
                      <td className={tdCls + ' text-[#888] text-xs'}>{i.ud_std ?? '—'}</td>
                      <td className={tdCls + ' text-right'}>{fmt(i.eur_min, 6)}</td>
                      <td className={tdCls + ' text-[#888] text-xs'}>{i.ud_min ?? '—'}</td>
                      <td className={tdCls + ' text-xs text-[#aaa]'}>{i.tipo_merma ?? '—'}</td>
                      <td className={tdCls + ' text-right'}>{i.merma_pct != null ? fmtPct(i.merma_pct) : '—'}</td>
                      <td className={tdCls + ' text-right text-orange-400'}>{i.merma_ef != null ? fmt(i.merma_ef, 4) : '—'}</td>
                      <td className={tdCls + ' text-right text-accent'}>{fmt(i.coste_neto_std, 4)}</td>
                      <td className={tdCls + ' text-[#888] text-xs'}>{i.ud_neto_std ?? i.ud_std ?? '—'}</td>
                      <td className={tdCls + ' text-right text-accent'}>{fmt(i.coste_neto_min, 6)}</td>
                      <td className={tdCls + ' text-[#888] text-xs'}>{i.ud_neto_min ?? i.ud_min ?? '—'}</td>
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
