import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente, EPS, Receta, RecetaLinea, CanalKey } from './types'
import { CANALES, UNIDADES, semaforoClasses, inputCls, thCls, tdCls, fmt, n } from './types'

interface Props { receta: Receta | null; ingredientes: Ingrediente[]; epsList: EPS[]; onClose: () => void; onSaved: () => void }

export default function ModalReceta({ receta, ingredientes, epsList, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(receta?.nombre ?? '')
  const [raciones, setRaciones] = useState(receta?.raciones ?? 1)
  const [tamanoRac, setTamanoRac] = useState(receta?.tamano_rac ?? 0)
  const [pvps, setPvps] = useState<Record<CanalKey, number>>({
    pvp_uber: n(receta?.pvp_uber), pvp_glovo: n(receta?.pvp_glovo), pvp_je: n(receta?.pvp_je),
    pvp_web: n(receta?.pvp_web), pvp_directa: n(receta?.pvp_directa),
  })
  const [lineas, setLineas] = useState<RecetaLinea[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingLineas, setLoadingLineas] = useState(!!receta)

  useEffect(() => {
    if (!receta) return
    let cancelled = false
    ;(async () => {
      setLoadingLineas(true)
      const { data } = await supabase.from('recetas_lineas').select('*').eq('receta_id', receta.id).order('linea')
      if (!cancelled && data) setLineas(data.map((d: any) => ({
        linea: d.linea ?? 0, tipo: d.tipo ?? 'ING', ingrediente_nombre: d.ingrediente_nombre ?? '',
        ingrediente_id: d.ingrediente_id ?? null, eps_id: d.eps_id ?? null,
        cantidad: d.cantidad ?? 0, unidad: d.unidad ?? 'gr.', eur_ud_neta: d.eur_ud_neta ?? 0,
      })))
      if (!cancelled) setLoadingLineas(false)
    })()
    return () => { cancelled = true }
  }, [receta])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
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
    return CANALES.filter(c => n(pvps[c.key]) > 0).map(c => {
      const pvp = n(pvps[c.key])
      const com = c.comision
      const neto = pvp / 1.1

      // Real
      const costeEstrR = 0.36 * neto
      const costePlatR = pvp * com
      const costeTotalR = costeMP + costeEstrR + costePlatR

      // Cash
      const costePlatC = pvp * com * 1.21
      const costeTotalC = costeMP + costeEstrR + costePlatC

      // PVP recomendado
      const denom = 1 - 0.36 - com - 0.15
      const pvpRec = denom > 0 ? (costeMP * 1.1) / denom : 0

      // K
      const k = costeMP > 0 ? pvp / costeMP : 0

      // Margen
      const margenR = neto - costeTotalR
      const margenC = neto - costeTotalC
      const pctMargenR = neto > 0 ? (margenR / neto) * 100 : 0
      const pctMargenC = neto > 0 ? (margenC / neto) * 100 : 0

      // IVA neto = (PVP − PVP×com%×1.21)/1.1×0.1 − (PVP×com%×0.21)
      const ivaNeto = ((pvp - pvp * com * 1.21) / 1.1) * 0.1 - (pvp * com * 0.21)

      // Provisión IVA/ped = PVP × com% × 0.21
      const provIva = pvp * com * 0.21

      return {
        ...c, pvp,
        rows: [
          { label: 'Coste MP', real: costeMP, cash: costeMP },
          { label: 'Coste estructura (36%)', real: costeEstrR, cash: costeEstrR },
          { label: 'Coste plataforma', real: costePlatR, cash: costePlatC },
          { label: 'Coste total', real: costeTotalR, cash: costeTotalC, bold: true },
          { label: 'Margen deseado', real: 0.15, cash: 0.15, isPctOnly: true },
          { label: 'PVP recomendado', real: pvpRec, cash: null, accent: true },
          { label: 'PVP real', real: pvp, cash: null },
          { label: 'K (multiplicador)', real: k, cash: null, isK: true },
          { label: 'Margen €', real: margenR, cash: margenC, bold: true },
          { label: '% Margen', real: pctMargenR, cash: pctMargenC, isPct: true, semaforo: true },
          { label: 'IVA neto', real: ivaNeto, cash: null },
          { label: 'Provisión IVA/ped', real: provIva, cash: null },
        ],
      }
    })
  }, [pvps, costeMP])

  /* ── Handlers ── */
  const updateLinea = useCallback((idx: number, patch: Partial<RecetaLinea>) => {
    setLineas(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }, [])
  const addLinea = () => setLineas(prev => [...prev, { linea: prev.length + 1, tipo: 'ING', ingrediente_nombre: '', ingrediente_id: null, eps_id: null, cantidad: 0, unidad: 'gr.', eur_ud_neta: 0 }])
  const deleteLinea = (idx: number) => setLineas(prev => prev.filter((_, i) => i !== idx))

  const changeTipo = (idx: number, tipo: 'ING' | 'EPS') => updateLinea(idx, { tipo, ingrediente_nombre: '', ingrediente_id: null, eps_id: null, eur_ud_neta: 0, unidad: 'gr.' })

  const selectItem = (idx: number, val: string) => {
    const l = lineas[idx]
    if (l.tipo === 'ING') {
      const ing = ingredientes.find(i => i.nombre === val)
      if (ing) updateLinea(idx, { ingrediente_nombre: ing.nombre, ingrediente_id: ing.id, eps_id: null, eur_ud_neta: n(ing.eur_min) || n(ing.eur_std), unidad: ing.ud_min ?? ing.ud_std ?? 'gr.' })
      else updateLinea(idx, { ingrediente_nombre: val, ingrediente_id: null, eps_id: null })
    } else {
      const ep = epsList.find(e => e.nombre === val)
      if (ep) updateLinea(idx, { ingrediente_nombre: ep.nombre, eps_id: ep.id, ingrediente_id: null, eur_ud_neta: n(ep.coste_rac), unidad: ep.unidad ?? 'gr.' })
      else updateLinea(idx, { ingrediente_nombre: val, eps_id: null, ingrediente_id: null })
    }
  }

  /* ── Guardar ── */
  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      let rid = receta?.id
      const record = { nombre, raciones, tamano_rac: tamanoRac || null, coste_tanda: costeTanda, coste_rac: costeMP, ...pvps }
      if (rid) { const { error } = await supabase.from('recetas').update(record).eq('id', rid); if (error) throw error }
      else { const { data, error } = await supabase.from('recetas').insert(record).select('id').single(); if (error) throw error; rid = data.id }

      await supabase.from('recetas_lineas').delete().eq('receta_id', rid)
      if (lineasCalc.length > 0) {
        const rows = lineasCalc.map((l, i) => ({
          receta_id: rid, linea: i + 1, tipo: l.tipo, ingrediente_nombre: l.ingrediente_nombre,
          ingrediente_id: l.ingrediente_id, eps_id: l.eps_id, cantidad: l.cantidad, unidad: l.unidad,
          eur_ud_neta: l.eur_ud_neta, eur_total: l.eur_total, pct_total: l.pct_total,
        }))
        const { error } = await supabase.from('recetas_lineas').insert(rows); if (error) throw error
      }
      onSaved()
    } catch (e: any) { alert('Error: ' + (e.message || 'Error desconocido')) }
    finally { setSaving(false) }
  }

  /* ── Render helpers ── */
  const wfTh = 'px-2 py-1.5 text-[9px] uppercase tracking-wider text-neutral-500 font-medium text-right whitespace-nowrap'
  const wfTd = 'px-2 py-1.5 text-xs tabular-nums text-right whitespace-nowrap'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-7xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-white">{receta ? 'Editar Receta' : 'Nueva Receta'}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition text-lg leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Nombre + Raciones + Tamaño */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-500 mb-1.5">Nombre</label>
              <input className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Smash Burger" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Raciones</label>
              <input type="number" min={1} step="1" className={inputCls} value={raciones || ''} onChange={e => setRaciones(parseFloat(e.target.value) || 1)} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Tamaño ración</label>
              <input type="number" min={0} step="any" className={inputCls} value={tamanoRac || ''} onChange={e => setTamanoRac(parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          {/* PVPs */}
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">PVP por canal</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {CANALES.map(c => (
                <div key={c.key}>
                  <label className="block text-[10px] text-neutral-600 mb-1">{c.label}</label>
                  <div className="relative">
                    <input type="number" min={0} step="0.01" className={inputCls + ' pr-6'} value={pvps[c.key] || ''} onChange={e => setPvps(p => ({ ...p, [c.key]: parseFloat(e.target.value) || 0 }))} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-600">€</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Líneas */}
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
                        <th className={thCls + ' w-10'}>#</th><th className={thCls + ' w-20'}>Tipo</th><th className={thCls}>Nombre</th><th className={thCls + ' w-24'}>Cantidad</th><th className={thCls + ' w-20'}>Unidad</th><th className={thCls + ' w-24'}>€/ud</th><th className={thCls + ' w-24 text-right'}>€ Total</th><th className={thCls + ' w-16 text-right'}>%</th><th className={thCls + ' w-10'} />
                      </tr>
                    </thead>
                    <tbody>
                      {!lineasCalc.length && <tr><td colSpan={9} className="px-3 py-6 text-center text-neutral-600 text-sm">Sin líneas</td></tr>}
                      {lineasCalc.map((l, idx) => (
                        <tr key={idx} className="border-t border-border hover:bg-white/[0.02] transition">
                          <td className={tdCls + ' text-neutral-600'}>{idx + 1}</td>
                          <td className={tdCls}><select className="w-full bg-transparent border-none outline-none text-sm text-white" value={l.tipo} onChange={e => changeTipo(idx, e.target.value as 'ING' | 'EPS')}><option value="ING">ING</option><option value="EPS">EPS</option></select></td>
                          <td className={tdCls}>
                            <input list={`r-i-${idx}`} className="w-full bg-transparent border-none outline-none text-sm text-white placeholder:text-neutral-600" value={l.ingrediente_nombre} onChange={e => selectItem(idx, e.target.value)} placeholder={l.tipo === 'ING' ? 'Ingrediente…' : 'EPS…'} />
                            <datalist id={`r-i-${idx}`}>{l.tipo === 'ING' ? ingredientes.map(i => <option key={i.id} value={i.nombre} />) : epsList.map(e => <option key={e.id} value={e.nombre} />)}</datalist>
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
                    <div><span className="text-[10px] text-neutral-500 uppercase tracking-wide block">Coste tanda</span><span className="text-sm font-bold text-white tabular-nums">{costeTanda.toFixed(4)} €</span></div>
                    <div><span className="text-[10px] text-neutral-500 uppercase tracking-wide block">Coste MP / ración</span><span className="text-base font-bold text-accent tabular-nums">{costeMP.toFixed(4)} €</span></div>
                  </div>
                  <span className="text-xs text-neutral-600">{raciones} raciones</span>
                </div>
              </div>
            )}
          </div>

          {/* Waterfall */}
          {waterfall.length > 0 && (
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Waterfall por canal</p>
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-base/50">
                      <tr>
                        <th className={wfTh + ' text-left'}>Concepto</th>
                        {waterfall.map(w => (<>
                          <th key={w.key + '-r'} className={wfTh + ' border-l border-border'}>{w.label} Real</th>
                          <th key={w.key + '-c'} className={wfTh}>{w.label} Cash</th>
                        </>))}
                      </tr>
                    </thead>
                    <tbody>
                      {waterfall[0]?.rows.map((_, ri) => (
                        <tr key={ri} className="border-t border-border hover:bg-white/[0.02] transition">
                          <td className="px-2 py-1.5 text-[11px] text-neutral-400 whitespace-nowrap font-medium">{waterfall[0].rows[ri].label}</td>
                          {waterfall.map(w => {
                            const row = w.rows[ri]

                            // % Margen con semáforo
                            if (row.isPct && row.semaforo) {
                              return (<>
                                <td key={w.key + '-r'} className={wfTd + ' border-l border-border'}>
                                  <span className={'inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ' + semaforoClasses(row.real)}>{row.real.toFixed(1)}%</span>
                                </td>
                                <td key={w.key + '-c'} className={wfTd}>
                                  <span className={'inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ' + semaforoClasses(row.cash ?? 0)}>{(row.cash ?? 0).toFixed(1)}%</span>
                                </td>
                              </>)
                            }

                            // Margen deseado 15%
                            if (row.isPctOnly) {
                              return (<>
                                <td key={w.key + '-r'} colSpan={2} className={wfTd + ' border-l border-border text-center text-neutral-500'}>15%</td>
                              </>)
                            }

                            // K multiplicador
                            if (row.isK) {
                              return (<>
                                <td key={w.key + '-r'} colSpan={2} className={wfTd + ' border-l border-border text-center font-medium text-white'}>{costeMP > 0 ? row.real.toFixed(2) + '×' : '—'}</td>
                              </>)
                            }

                            // Filas normales Real / Cash
                            const cls = wfTd + (row.bold ? ' font-semibold text-white' : ' text-neutral-300') + (row.accent ? ' text-accent font-semibold' : '')
                            return (<>
                              <td key={w.key + '-r'} className={cls + ' border-l border-border'}>{fmt(row.real)} €</td>
                              <td key={w.key + '-c'} className={cls}>{row.cash !== null ? fmt(row.cash) + ' €' : '—'}</td>
                            </>)
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
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
