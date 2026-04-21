import { useEffect, useMemo, useState } from 'react'
import type { EPS } from './types'
import { thCls, tdCls, fmtEurES, fmtES, fmtDateES, n, semaforoUsos } from './types'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'

interface Props { epsList: EPS[]; busqueda?: string; onSelect: (eps: EPS) => void; onNew?: () => void }

type Filter = 'todos' | 'enuso' | 'sinuso'

export default function TabEPS({ epsList, busqueda = '', onSelect, onNew }: Props) {
  const { T } = useTheme()
  const [filter, setFilter] = useState<Filter>('todos')
  const [ingsPorEps, setIngsPorEps] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('eps_lineas').select('eps_id, ingrediente_nombre')
      const map: Record<string, string[]> = {}
      for (const l of data ?? []) {
        if (!l.eps_id) continue
        if (!map[l.eps_id]) map[l.eps_id] = []
        map[l.eps_id].push((l.ingrediente_nombre ?? '').toLowerCase())
      }
      setIngsPorEps(map)
    }
    load()
  }, [epsList])

  const { total, enUso, sinUso, filtered } = useMemo(() => {
    const total = epsList.length
    const enUso = epsList.filter(e => n(e.usos) > 0).length
    const sinUso = total - enUso
    let filtered = epsList
    if (filter === 'enuso') filtered = epsList.filter(e => n(e.usos) > 0)
    else if (filter === 'sinuso') filtered = epsList.filter(e => n(e.usos) === 0)
    const q = busqueda.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter(e =>
        (e.nombre ?? '').toLowerCase().includes(q) ||
        (e.codigo ?? '').toLowerCase().includes(q) ||
        (e.categoria ?? '').toLowerCase().includes(q) ||
        (ingsPorEps[e.id] ?? []).some(ing => ing.includes(q))
      )
    }
    return { total, enUso, sinUso, filtered }
  }, [epsList, filter, busqueda, ingsPorEps])

  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Counter label="TOTAL" value={total} active={filter === 'todos'} onClick={() => setFilter('todos')} />
        <Counter label="EN USO" value={enUso} valueClass="eps" active={filter === 'enuso'} onClick={() => toggle('enuso')} />
        <Counter label="SIN USO" value={sinUso} valueClass="rec" active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
        {onNew && <button onClick={onNew} className="ds-btn-add ml-auto">+ Nueva EPS</button>}
      </div>

      {busqueda.trim() && (
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{busqueda}"
        </div>
      )}

      {!filtered.length ? (
        <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl p-12 text-center">
          <p className="text-[var(--sl-text-muted)] text-sm">Sin EPS{filter !== 'todos' ? ' en este filtro' : ''}</p>
        </div>
      ) : (
        <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl overflow-hidden">
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <table style={{ tableLayout: 'fixed', width: '910px' }}>
              <colgroup>
                <col style={{ width: 85 }} />
                <col style={{ width: 250 }} />
                <col style={{ width: 75 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 65 }} />
                <col style={{ width: 105 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 65 }} />
                <col style={{ width: 75 }} />
              </colgroup>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th className={thCls}>CÓDIGO</th>
                  <th className={thCls}>NOMBRE</th>
                  <th className={thCls + ' text-right'}>RACIONES</th>
                  <th className={thCls + ' text-right'}>TAMAÑO RAC</th>
                  <th className={thCls}>UNIDAD</th>
                  <th className={thCls + ' text-right'}>COSTE TANDA</th>
                  <th className={thCls + ' text-right'}>COSTE/RAC</th>
                  <th className={thCls + ' text-center'}>USOS</th>
                  <th className={thCls}>FECHA</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const usos = n(e.usos)
                  return (
                    <tr key={e.id} onClick={() => onSelect(e)} className="cursor-pointer">
                      <td className={tdCls + ' ds-eps-name font-mono text-xs'}>{e.codigo ?? ''}</td>
                      <td className={tdCls + ' ds-eps-name'}>{e.nombre}</td>
                      <td className={tdCls + ' text-right'}>{e.raciones ? fmtES(e.raciones, 0) : ''}</td>
                      <td className={tdCls + ' text-right'}>{e.tamano_rac != null ? fmtES(e.tamano_rac) : ''}</td>
                      <td className={tdCls + ' text-[var(--sl-text-secondary)]'}>{e.unidad}</td>
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)]'}>{fmtEurES(e.coste_tanda, 4)}</td>
                      <td className={tdCls + ' text-right text-[var(--sl-text-primary)] font-semibold'}>{fmtEurES(e.coste_rac, 4)}</td>
                      <td className={tdCls + ' text-center'}>
                        <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ' + semaforoUsos(usos)}>{usos}</span>
                      </td>
                      <td className={tdCls + ' text-[var(--sl-text-muted)] text-xs'}>{e.fecha ? fmtDateES(e.fecha) : ''}</td>
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
