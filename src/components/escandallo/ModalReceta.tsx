import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente, EPS, Receta, RecetaLinea, CanalKey } from './types'
import { CANALES, UNIDADES, semaforoClasses, inputCls, thCls, tdCls, fmt } from './types'

interface Props {
  receta: Receta | null
  ingredientes: Ingrediente[]
  epsList: EPS[]
  onClose: () => void
  onSaved: () => void
}

export default function ModalReceta({ receta, ingredientes, epsList, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(receta?.nombre ?? '')
  const [raciones, setRaciones] = useState(receta?.raciones ?? 1)
  const [pvps, setPvps] = useState<Record<CanalKey, number>>({
    pvp_uber: receta?.pvp_uber ?? 0,
    pvp_glovo: receta?.pvp_glovo ?? 0,
    pvp_je: receta?.pvp_je ?? 0,
    pvp_web: receta?.pvp_web ?? 0,
    pvp_directa: receta?.pvp_directa ?? 0,
  })
  const [lineas, setLineas] = useState<RecetaLinea[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingLineas, setLoadingLineas] = useState(!!receta)

  useEffect(() => {
    if (!receta) return
    let cancelled = false
    ;(async () => {
      setLoadingLineas(true)
      const { data } = await supabase
        .from('recetas_lineas').select('*').eq('receta_id', receta.id).order('linea')
      if (!cancelled && data) {
        setLineas(data.map((d: any) => ({
          linea: d.linea ?? 0, tipo: d.tipo ?? 'ING',
          ingrediente_nombre: d.ingrediente_nombre ?? '', ingrediente_id: d.ingrediente_id ?? null,
          eps_id: d.eps_id ?? null, cantidad: d.cantidad ?? 0, unidad: d.unidad ?? 'gr.', eur_ud_neta: d.eur_ud_neta ?? 0,
        })))
      }
      if (!cancelled) setLoadingLineas(false)
    })()
    return () => { cancelled = true }
  }, [receta])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  /* ── Cálculos líneas ── */
  const lineasCalc = useMemo(() => {
    const items = lineas.map(l => ({ ...l, eur_total: l.cantidad * l.eur_ud_neta }))
    const total = items.reduce((s, i) => s + i.eur_total, 0)
    return items.map(i => ({ ...i, pct_total: total > 0 ? (i.eur_total / total) * 100 : 0 }))
  }, [lineas])

  const costeTanda = useMemo(() => lineasCalc.reduce((s, l) => s + l.eur_total, 0), [lineasCalc])
  const costeMP = raciones > 0 ? costeTanda / raciones : 0

  /* ── Waterfall ── */
  const waterfall = useMemo(() => {
    return CANALES.map(c => {
      const pvp = pvps[c.key] ?? 0
      const com = c.comision
      const neto = pvp / 1.1

      // Real
      const costeMPR = costeMP
      const costeEstrR = 0.36 * neto
      const costePlatR = pvp * com
      const costeTotalR = costeMPR + costeEstrR + costePlatR
      const margenDeseadoR = 0.15 * neto
      const pvpRecDenom = 1 - 0.36 - com - 0.15
      const pvpRecomendado = pvpRecDenom > 0 ? (costeMP * 1.1) / pvpRecDenom : 0
      const k = costeMP > 0 ? pvp / costeMP : 0
      const margenEur = neto - costeTotalR
      const margenPct = neto > 0 ? (margenEur / neto) * 100 : 0
      const ivaNeto = pvp - neto
      const provisionIva = ivaNeto - costeMP * 0.10

      // Cash (×1.21)
      const costeMPC = costeMP * 1.21
      const costeEstrC = costeEstrR * 1.21
      const costePlatC = costePlatR * 1.21
      const costeTotalC = costeMPC + costeEstrC + costePlatC
      const margenDeseadoC = margenDeseadoR * 1.21
      const pvpRecomendadoC = pvpRecomendado * 1.21
      const pvpRealC = pvp * 1.21
      const margenEurC = margenEur * 1.21
      const ivaNetoC = ivaNeto * 1.21

      return {
        ...c, pvp,
        rows: [
          { label: 'Coste MP', real: costeMPR, cash: costeMPC },
          { label: 'Coste estructura (36%)', real: costeEstrR, cash: costeEstrC },
          { label: 'Coste plataforma', real: costePlatR, cash: costePlatC },
          { label: 'Coste total', real: costeTotalR, cash: costeTotalC, bold: true },
          { label: 'Margen deseado 15%', real: margenDeseadoR, cash: margenDeseadoC },
          { label: 'PVP recomendado', real: pvpRecomendado, cash: pvpRecomendadoC, accent: true },
          { label: 'PVP real', real: pvp, cash: pvpRealC, editable: true },
          { label: 'K (multiplicador)', real: k, cash: k, isK: true },
          { label: 'Margen €', real: margenEur, cash: margenEurC, bold: true },
          { label: '% Margen', real: margenPct, cash: margenPct, isPct: true, semaforo: true },
          { label: 'IVA neto', real: ivaNeto, cash: ivaNetoC },
          { label: 'Provisión IVA/ped', real: provisionIva, cash: null },
        ],
      }
    })
  }, [pvps, costeMP])

  /* ── Handlers líneas ── */
  const updateLinea = useCallback((idx: number, patch: Partial<RecetaLinea>) => {
    setLineas(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }, [])

  const addLinea = () => {
    setLineas(prev => [...prev, { linea: prev.length + 1, tipo: 'ING', ingrediente_nombre: '', ingrediente_id: null, eps_id: null, cantidad: 0, unidad: 'gr.', eur_ud_neta: 0 }])
  }

  const deleteLinea = (idx: number) => setLineas(prev => prev.filter((_, i) => i !== idx))

  const changeTipo = (idx: number, tipo: 'ING' | 'EPS') => {
    updateLinea(idx, { tipo, ingrediente_nombre: '', ingrediente_id: null, eps_id: null, eur_ud_neta: 0, unidad: 'gr.' })
  }

  const selectItem = (idx: number, nombre: string) => {
    const l = lineas[idx]
    if (l.tipo === 'ING') {
      const ing = ingredientes.find(i => i.nombre === nombre)
      if (ing) updateLinea(idx, { ingrediente_nombre: ing.nombre, ingrediente_id: ing.id, eps_id: null, eur_ud_neta: ing.eur_min ?? ing.eur_std ?? 0, unidad: ing.ud_min ?? ing.ud_std ?? 'gr.' })
      else updateLinea(idx, { ingrediente_nombre: nombre, ingrediente_id: null, eps_id: null })
    } else {
      const ep = epsList.find(e => e.nombre === nombre)
      if (ep) updateLinea(idx, { ingrediente_nombre: ep.nombre, eps_id: ep.id, ingrediente_id: null, eur_ud_neta: ep.coste_rac ?? 0, unidad: ep.unidad ?? 'gr.' })
      else updateLinea(idx, { ingrediente_nombre: nombre, eps_id: null, ingrediente_id: null })
    }
  }

  /* ── Guardar ── */
  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      let recetaId = receta?.id
      const record = { nombre, raciones, coste_tanda: costeTanda, coste_rac: costeMP, ...pvps }

      if (recetaId) {
        const { error } = await supabase.from('recetas').update(record).eq('id', recetaId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('recetas').insert(record).select('id').single()
        if (error) throw error
        recetaId = data.id
      }

      await supabase.from('recetas_lineas').delete().eq('receta_id', recetaId)
      if (lineasCalc.length > 0) {
        const rows = lineasCalc.map((l, i) => ({
          receta_id: recetaId, linea: i + 1, tipo: l.tipo,
          ingrediente_nombre: l.ingrediente_nombre, ingrediente_id: l.ingrediente_id,
          eps_id: l.eps_id, cantidad: l.cantidad, unidad: l.unidad,
          eur_ud_neta: l.eur_ud_neta, eur_total: l.eur_total, pct_total: l.pct_total,
        }))
        const { error } = await supabase.from('recetas_lineas').insert(rows)
        if (error) throw error
      }
      onSaved()
    } catch (e: any) {
      alert('Error guardando receta: ' + (e.message || 'Error desconocido'))
    } finally {
      setSaving(false)
    }
  }

  /* ── Render ── */
  const wfTh = 'px-2 py-1.5 text-[9px] uppercase tracking-wider text-neutral-500 font-medium text-right whitespace-nowrap'
  const wfTd = 'px-2 py-1.5 text-xs text-neutral-300 tabular-nums text-right whitespace-nowrap'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-7xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-white">{receta ? 'Editar Receta' : 'Nueva Receta'}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition text-lg leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Nombre + Raciones */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-xs text-neutral-500 mb-1.5">Nombre</label>
              <input className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Smash Burger Classic" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Raciones</label>
              <input type="number" min={1} step="1" className={inputCls} value={raciones || ''} onChange={e => setRaciones(parseFloat(e.target.value) || 1)} />
            </div>
          </div>

          {/* PVPs por canal */}
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">PVP por canal</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {CANALES.map(c => (
                <div key={c.key}>
                  <label className="block text-[10px] text-neutral-600 mb-1">{c.label}</label>
                  <div className="relative">
                    <input type="number" min={0} step="0.01" className={inputCls + ' pr-6'} value={pvps[c.key] || ''} onChange={e => setPvps(prev => ({ ...prev, [c.key]: parseFloat(e.target.value) || 0 }))} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-600">€</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla de líneas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-neutral-500 uppercase tracking-wide">Líneas</p>
              <button onClick={addLinea} className="text-xs font-semibold text-accent hover:brightness-110 transition px-3 py-1 rounded-lg border border-accent/30 hover:bg-accent/5">+ Añadir línea</button>
            </div>
            {loadingLineas ? (
              <div className="flex justify-center py-8"><div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-base/50">
                      <tr>
                        <th className={thCls + ' w-10'}>#</th>
                        <th className={thCls + ' w-20'}>Tipo</th>
                        <th className={thCls}>Nombre</th>
                        <th className={thCls + ' w-24'}>Cantidad</th>
                        <th className={thCls + ' w-20'}>Unidad</th>
                        <th className={thCls + ' w-24'}>€/ud</th>
                        <th className={thCls + ' w-24 text-right'}>€ Total</th>
                        <th className={thCls + ' w-16 text-right'}>%</th>
                        <th className={thCls + ' w-10'} />
                      </tr>
                    </thead>
                    <tbody>
                      {lineasCalc.length === 0 && (
                        <tr><td colSpan={9} className="px-3 py-6 text-center text-neutral-600 text-sm">Sin líneas — añade ingredientes o EPS</td></tr>
                      )}
                      {lineasCalc.map((l, idx) => (
                        <tr key={idx} className="border-t border-border hover:bg-white/[0.02] transition">
                          <td className={tdCls + ' text-neutral-600'}>{idx + 1}</td>
                          <td className={tdCls}>
                            <select className="w-full bg-transparent border-none outline-none text-sm text-white" value={l.tipo} onChange={e => changeTipo(idx, e.target.value as 'ING' | 'EPS')}>
                              <option value="ING">ING</option><option value="EPS">EPS</option>
                            </select>
                          </td>
                          <td className={tdCls}>
                            <input list={`rec-item-${idx}`} className="w-full bg-transparent border-none outline-none text-sm text-white placeholder:text-neutral-600" value={l.ingrediente_nombre} onChange={e => selectItem(idx, e.target.value)} placeholder={l.tipo === 'ING' ? 'Buscar ingrediente…' : 'Buscar EPS…'} />
                            <datalist id={`rec-item-${idx}`}>
                              {l.tipo === 'ING' ? ingredientes.map(i => <option key={i.id} value={i.nombre} />) : epsList.map(e => <option key={e.id} value={e.nombre} />)}
                            </datalist>
                          </td>
                          <td className={tdCls}><input type="number" min={0} step="any" className="w-full bg-transparent border-none outline-none text-sm text-white tabular-nums text-right" value={l.cantidad || ''} onChange={e => updateLinea(idx, { cantidad: parseFloat(e.target.value) || 0 })} /></td>
                          <td className={tdCls}><select className="w-full bg-transparent border-none outline-none text-sm text-white" value={l.unidad} onChange={e => updateLinea(idx, { unidad: e.target.value })}>{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}</select></td>
                          <td className={tdCls}><input type="number" min={0} step="0.000001" className="w-full bg-transparent border-none outline-none text-sm text-white tabular-nums text-right" value={l.eur_ud_neta || ''} onChange={e => updateLinea(idx, { eur_ud_neta: parseFloat(e.target.value) || 0 })} /></td>
                          <td className={tdCls + ' text-right font-medium text-white'}>{l.eur_total.toFixed(4)}</td>
                          <td className={tdCls + ' text-right text-neutral-500'}>{l.pct_total.toFixed(1)}%</td>
                          <td className={tdCls}><button onClick={() => deleteLinea(idx)} className="text-neutral-600 hover:text-red-400 transition text-sm">✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-3 py-3 border-t-2 border-accent/30 bg-accent/5">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wide block">Coste tanda</span>
                      <span className="text-sm font-bold text-white tabular-nums">{costeTanda.toFixed(4)} €</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wide block">Coste MP / ración</span>
                      <span className="text-base font-bold text-accent tabular-nums">{costeMP.toFixed(4)} €</span>
                    </div>
                  </div>
                  <span className="text-xs text-neutral-600">{raciones} raciones</span>
                </div>
              </div>
            )}
          </div>

          {/* Waterfall por canal */}
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Waterfall por canal</p>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-base/50">
                    <tr>
                      <th className={wfTh + ' text-left'} />
                      {waterfall.map(w => (
                        <th key={w.key} colSpan={2} className={'px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-center border-l border-border ' + (w.pvp > 0 ? 'text-white' : 'text-neutral-600')}>
                          {w.label}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th className={wfTh + ' text-left'}>Concepto</th>
                      {waterfall.map(w => (
                        <>{/* eslint-disable-next-line react/jsx-key */}
                          <th key={w.key + '-r'} className={wfTh + ' border-l border-border'}>Real</th>
                          <th key={w.key + '-c'} className={wfTh}>Cash</th>
                        </>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {waterfall[0]?.rows.map((_, ri) => (
                      <tr key={ri} className="border-t border-border hover:bg-white/[0.02] transition">
                        <td className="px-2 py-1.5 text-[11px] text-neutral-400 whitespace-nowrap font-medium">{waterfall[0].rows[ri].label}</td>
                        {waterfall.map(w => {
                          const row = w.rows[ri]
                          const cellCls = wfTd +
                            (row.bold ? ' font-semibold text-white' : '') +
                            (row.accent ? ' text-accent font-semibold' : '')

                          if (row.isPct && row.semaforo) {
                            const pct = row.real
                            return (
                              <td key={w.key + '-r'} colSpan={2} className={wfTd + ' text-center border-l border-border'}>
                                {w.pvp > 0 ? (
                                  <span className={'inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ' + semaforoClasses(pct)}>
                                    {pct.toFixed(1)}%
                                  </span>
                                ) : <span className="text-neutral-600">—</span>}
                              </td>
                            )
                          }

                          if (row.isK) {
                            return (
                              <td key={w.key + '-r'} colSpan={2} className={wfTd + ' text-center border-l border-border font-medium text-white'}>
                                {w.pvp > 0 && costeMP > 0 ? row.real.toFixed(2) + '×' : '—'}
                              </td>
                            )
                          }

                          return (<>
                            <td key={w.key + '-r'} className={cellCls + ' border-l border-border'}>
                              {w.pvp > 0 ? fmt(row.real) + ' €' : '—'}
                            </td>
                            <td key={w.key + '-c'} className={cellCls}>
                              {w.pvp > 0 && row.cash !== null ? fmt(row.cash) + ' €' : '—'}
                            </td>
                          </>)
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 border border-border rounded-lg hover:text-white transition">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !nombre.trim()} className="px-5 py-2 text-sm font-semibold bg-accent text-black rounded-lg hover:brightness-110 transition disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
