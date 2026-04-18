import { useMemo, useState } from 'react'
import type { Ingrediente } from './types'
import { thCls, tdCls, fmt, fmtPct, n, getProveedor, semaforoUsos } from './types'

interface Props {
  ingredientes: Ingrediente[]
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

export default function TabIngredientes({ ingredientes, onSelect, onNew }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')

  const { total, enUso, sinUso, filtered } = useMemo(() => {
    const total = ingredientes.length
    const enUso = ingredientes.filter(i => n(i.usos) > 0).length
    let filtered = ingredientes
    if (filter === 'enuso') filtered = ingredientes.filter(i => n(i.usos) > 0)
    else if (filter === 'sinuso') filtered = ingredientes.filter(i => n(i.usos) === 0)
    return { total, enUso, sinUso: total - enUso, filtered }
  }, [ingredientes, filter])

  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  return (
    <div className="space-y-4">
      {/* Contadores + acciones */}
      <div className="flex flex-wrap items-center gap-4">
        <Counter label="TOTAL" value={total} active={filter === 'todos'} onClick={() => setFilter('todos')} />
        <Counter label="EN USO" value={enUso} valueClass="eps" active={filter === 'enuso'} onClick={() => toggle('enuso')} />
        <Counter label="SIN USO" value={sinUso} valueClass="rec" active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
        {onNew && (
          <button onClick={onNew} className="ds-btn-add ml-auto">+ Nuevo Ingrediente</button>
        )}
      </div>

      {!filtered.length ? (
        <div className="bg-[#484f66] border border-[#4a5270] rounded-xl p-12 text-center">
          <p className="text-[#7080a8] text-sm">Sin ingredientes{filter !== 'todos' ? ' en este filtro' : ''}</p>
        </div>
      ) : (
        <div className="bg-[#484f66] border border-[#4a5270] rounded-xl overflow-hidden">
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <table style={{ tableLayout: 'auto', width: '100%' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th className={thCls + ' sticky left-0 z-30 bg-[#2e3347]'}>IDING</th>
                  <th className={thCls}>CATEGORIA</th>
                  <th className={thCls + ' sticky z-30 bg-[#2e3347]'} style={{ left: 90, minWidth: 200 }}>NOMBRE BASE</th>
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
                {filtered.map(i => {
                  const isEps = i.abv === 'EPS'
                  const rowNameCls = isEps ? 'text-[#66aaff] italic font-medium' : 'text-[#f0f0ff] font-medium'
                  const usos = n(i.usos)
                  return (
                    <tr key={i.id} onClick={() => onSelect?.(i)}
                      className="cursor-pointer hover:bg-[#353a50] transition-colors">
                      <td className={tdCls + ' sticky left-0 z-10 text-[#7080a8] font-mono text-xs'}>{i.iding ?? '—'}</td>
                      <td className={tdCls + ' text-[#c8d0e8]'}>{i.categoria ?? '—'}</td>
                      <td className={tdCls + ' sticky z-10 max-w-[220px] truncate ' + rowNameCls} style={{ left: 90 }}>{i.nombre_base ?? '—'}</td>
                      <td className={tdCls + ' text-[#f0f0ff] font-mono text-xs font-bold'}>{i.abv ?? '—'}</td>
                      <td className={tdCls + ' max-w-[180px] truncate ' + (isEps ? 'text-[#66aaff] italic' : 'text-[#f0f0ff]')}>{i.nombre}</td>
                      <td className={tdCls + ' text-[#c8d0e8]'}>{getProveedor(i.abv)}</td>
                      <td className={tdCls + ' text-[#c8d0e8]'}>{i.marca ?? '—'}</td>
                      <td className={tdCls + ' text-[#c8d0e8]'}>{i.formato ?? '—'}</td>
                      <td className={tdCls + ' text-right'}>{fmt(i.uds)}</td>
                      <td className={tdCls + ' text-[#c8d0e8]'}>{i.ud_std ?? '—'}</td>
                      <td className={tdCls + ' text-[#c8d0e8]'}>{i.ud_min ?? '—'}</td>
                      <td className={tdCls + ' text-center'}>
                        <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ' + semaforoUsos(usos)}>
                          {usos}
                        </span>
                      </td>
                      <td className={tdCls + ' text-right text-[#7080a8]'}>{fmt(i.precio1)}</td>
                      <td className={tdCls + ' text-right text-[#7080a8]'}>{fmt(i.precio2)}</td>
                      <td className={tdCls + ' text-right text-[#7080a8]'}>{fmt(i.precio3)}</td>
                      <td className={tdCls + ' text-right text-[#f0f0ff]'}>{fmt(i.ultimo_precio ?? i.precio_activo)}</td>
                      <td className={tdCls + ' text-center text-xs'}>
                        <span className="px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[#c8d0e8]">{i.selector_precio ?? 'Último'}</span>
                      </td>
                      <td className={tdCls + ' text-right text-[#f0f0ff] font-semibold'}>{fmt(i.precio_activo)}</td>
                      <td className={tdCls + ' text-right'}>{fmt(i.eur_std, 4)}</td>
                      <td className={tdCls + ' text-[#7080a8] text-xs'}>{i.ud_std ?? '—'}</td>
                      <td className={tdCls + ' text-right'}>{fmt(i.eur_min, 6)}</td>
                      <td className={tdCls + ' text-[#7080a8] text-xs'}>{i.ud_min ?? '—'}</td>
                      <td className={tdCls + ' text-xs text-[#c8d0e8]'}>{i.tipo_merma ?? '—'}</td>
                      <td className={tdCls + ' text-right'}>{i.merma_pct != null ? fmtPct(i.merma_pct) : '—'}</td>
                      <td className={tdCls + ' text-right text-[#ea580c]'}>{i.merma_ef != null ? fmt(i.merma_ef, 4) : '—'}</td>
                      <td className={tdCls + ' text-right text-[#f0f0ff]'}>{fmt(i.coste_neto_std, 4)}</td>
                      <td className={tdCls + ' text-[#7080a8] text-xs'}>{i.ud_neto_std ?? i.ud_std ?? '—'}</td>
                      <td className={tdCls + ' text-right text-[#f0f0ff]'}>{fmt(i.coste_neto_min, 6)}</td>
                      <td className={tdCls + ' text-[#7080a8] text-xs'}>{i.ud_neto_min ?? i.ud_min ?? '—'}</td>
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
