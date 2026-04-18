import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtNum, fmtEur } from '@/utils/format'
import { useConfig } from '@/hooks/useConfig'
import { calcWaterfall as calcWaterfallCh, type ConfigCanal as ConfigCanalWF } from '@/utils/calcWaterfall'
import type { Ingrediente, EPS, Receta, RecetaLinea, CanalKey } from './types'
import { UNIDADES, semaforoClasses, inputCls, thCls, tdCls, n, btnPrimary, btnSecondary } from './types'

interface Props { receta: Receta | null; ingredientes: Ingrediente[]; epsList: EPS[]; onClose: () => void; onSaved: () => void }

const CANAL_TO_KEY: Record<string, CanalKey> = {
  'Uber Eats': 'pvp_uber',
  'Glovo': 'pvp_glovo',
  'Just Eat': 'pvp_je',
  'Web Propia': 'pvp_web',
  'Web': 'pvp_web',
  'Venta Directa': 'pvp_directa',
  'Directa': 'pvp_directa',
}

export default function ModalReceta({ receta, ingredientes, epsList, onClose, onSaved }: Props) {
  const cfg = useConfig()
  const [nombre, setNombre] = useState(receta?.nombre ?? '')
  const [categoria, setCategoria] = useState(receta?.categoria ?? '')
  const [raciones, setRaciones] = useState(receta?.raciones ?? 1)
  const [tamanoRac, setTamanoRac] = useState(receta?.tamano_rac ?? 0)
  const [unidad, setUnidad] = useState(receta?.unidad ?? 'Ración')
  const [fecha, setFecha] = useState(receta?.fecha ?? '')
  const [pvps, setPvps] = useState<Record<CanalKey, number>>({
    pvp_uber: n(receta?.pvp_uber), pvp_glovo: n(receta?.pvp_glovo), pvp_je: n(receta?.pvp_je),
    pvp_web: n(receta?.pvp_web), pvp_directa: n(receta?.pvp_directa),
  })
  // Si es receta nueva, pre-poblar con una línea de envase (tipo ENV)
  const [lineas, setLineas] = useState<RecetaLinea[]>(
    receta ? [] : [{ linea: 1, tipo: 'ING', ingrediente_nombre: '', ingrediente_id: null, eps_id: null, cantidad: 1, unidad: 'Ud.', eur_ud_neta: 0 }]
  )
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

  const lineasCalc = useMemo(() => {
    const items = lineas.map(l => ({ ...l, eur_total: l.cantidad * l.eur_ud_neta }))
    const total = items.reduce((s, i) => s + i.eur_total, 0)
    return items.map(i => ({ ...i, pct_total: total > 0 ? (i.eur_total / total) * 100 : 0 }))
  }, [lineas])

  const costeTanda = useMemo(() => lineasCalc.reduce((s, l) => s + l.eur_total, 0), [lineasCalc])
  const costeMP = raciones > 0 ? costeTanda / raciones : 0

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
      if (ep) updateLinea(idx, { ingrediente_nombre: ep.nombre, eps_id: ep.id, ingrediente_id: null, eur_ud_neta: n(ep.coste_rac), unidad: ep.unidad ?? 'Ración' })
      else updateLinea(idx, { ingrediente_nombre: val, eps_id: null, ingrediente_id: null })
    }
  }

  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      let rid = receta?.id
      const record = {
        nombre, categoria: categoria || null, raciones,
        tamano_rac: tamanoRac || null, unidad: unidad || null, fecha: fecha || null,
        coste_tanda: costeTanda, coste_rac: costeMP, ...pvps,
      }
      if (rid) { const { error } = await supabase.from('recetas').update(record).eq('id', rid); if (error) throw error }
      else { const { data, error } = await supabase.from('recetas').insert(record).select('id').single(); if (error) throw error; rid = data.id }

      await supabase.from('recetas_lineas').delete().eq('receta_id', rid)
      if (lineasCalc.length > 0) {
        const rows = lineasCalc.map((l, i) => ({
          receta_id: rid, linea: i + 1, tipo: l.tipo, ingrediente_nombre: l.ingrediente_nombre,
          ingrediente_id: l.ingrediente_id, eps_id: l.eps_id, cantidad: l.cantidad, unidad: l.unidad,
          eur_ud_neta: l.eur_ud_neta,
        }))
        const { error } = await supabase.from('recetas_lineas').insert(rows); if (error) throw error
      }
      onSaved()
    } catch (e: any) { alert('Error: ' + (e.message || 'Error desconocido')) }
    finally { setSaving(false) }
  }

  /* ── Canales para waterfall — usan calcWaterfall unificado ── */
  const waterfallCanales = useMemo(() => {
    return cfg.canales.filter(c => c.activo !== false).map(c => {
      const pvpKey = CANAL_TO_KEY[c.canal] ?? 'pvp_uber'
      const pvp = pvps[pvpKey] ?? 0

      const canalAdaptado: ConfigCanalWF = {
        nombre: c.canal,
        comision_pct: c.comision_pct / 100,
        estructura_pct: cfg.estructura_pct / 100,
        margen_deseado_pct: (c.margen_deseado_pct ?? cfg.margen_deseado_pct) / 100,
      }

      const w = calcWaterfallCh(costeMP, pvp, canalAdaptado)

      return { canal: c, pvpKey, pvp, w, canalAdaptado }
    })
  }, [cfg, pvps, costeMP])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#484f66] border border-[#4a5270] rounded-xl w-full max-w-7xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#4a5270]">
          <div>
            <h3 className="text-base font-semibold text-[#f0f0ff]">{receta ? 'Editar Receta' : 'Nueva Receta'}</h3>
            {receta?.codigo && <p className="text-xs text-[#7080a8] mt-0.5 font-mono">{receta.codigo} · REC</p>}
          </div>
          <button onClick={onClose} className="text-[#7080a8] hover:text-[#f0f0ff] transition text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Cabecera: Nombre + Raciones + Tamaño + Unidad + Fecha + Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-[#c8d0e8] mb-1 uppercase tracking-wider">Nombre</label>
              <input className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Smash Burger" />
            </div>
            <div>
              <label className="block text-[11px] text-[#c8d0e8] mb-1 uppercase tracking-wider">Categoría</label>
              <input className={inputCls} value={categoria} onChange={e => setCategoria(e.target.value)} list="rec-cats" />
              <datalist id="rec-cats">{cfg.categorias.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="block text-[11px] text-[#c8d0e8] mb-1 uppercase tracking-wider">Raciones</label>
              <input type="number" min={1} step="1" className={inputCls} value={raciones || ''} onChange={e => setRaciones(parseFloat(e.target.value) || 1)} />
            </div>
            <div>
              <label className="block text-[11px] text-[#c8d0e8] mb-1 uppercase tracking-wider">Tamaño rac</label>
              <input type="number" min={0} step="any" className={inputCls} value={tamanoRac || ''} onChange={e => setTamanoRac(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="block text-[11px] text-[#c8d0e8] mb-1 uppercase tracking-wider">Unidad</label>
              <select className={inputCls} value={unidad} onChange={e => setUnidad(e.target.value)}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="block text-[11px] text-[#c8d0e8] mb-1 uppercase tracking-wider">Fecha</label>
              <input type="date" className={inputCls} value={fecha ?? ''} onChange={e => setFecha(e.target.value)} />
            </div>
          </div>

          {/* Líneas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-[#c8d0e8] uppercase tracking-wider">Líneas</p>
              <button onClick={addLinea} className="text-xs font-semibold text-[#1a1a1a] bg-accent hover:brightness-110 transition px-3 py-1 rounded-md">+ Añadir línea</button>
            </div>
            {loadingLineas ? (
              <div className="flex justify-center py-8"><div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="border border-[#4a5270] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: '900px' }}>
                    <thead>
                      <tr>
                        <th className={thCls + ' w-10'}>#</th><th className={thCls + ' w-20'}>Tipo</th><th className={thCls}>Nombre</th><th className={thCls + ' w-24 text-right'}>Cantidad</th><th className={thCls + ' w-20'}>Unidad</th><th className={thCls + ' w-28 text-right'}>€/ud neta</th><th className={thCls + ' w-24 text-right'}>€ total</th><th className={thCls + ' w-16 text-right'}>% total</th><th className={thCls + ' w-10'} />
                      </tr>
                    </thead>
                    <tbody>
                      {!lineasCalc.length && <tr><td colSpan={9} className="px-3 py-6 text-center text-[#8090b8] text-sm">Sin líneas</td></tr>}
                      {lineasCalc.map((l, idx) => (
                        <tr key={idx}>
                          <td className={tdCls + ' text-[#8090b8]'}>{idx + 1}</td>
                          <td className={tdCls}><select className="w-full bg-transparent border-none outline-none text-sm text-[#f0f0ff]" value={l.tipo} onChange={e => changeTipo(idx, e.target.value as 'ING' | 'EPS')}><option value="ING">ING</option><option value="EPS">EPS</option></select></td>
                          <td className={tdCls}>
                            <input list={`r-i-${idx}`} className="w-full bg-transparent border-none outline-none text-sm text-[#f0f0ff] placeholder:text-[#8090b8]" value={l.ingrediente_nombre} onChange={e => selectItem(idx, e.target.value)} placeholder={l.tipo === 'ING' ? 'Ingrediente...' : 'EPS...'} />
                            <datalist id={`r-i-${idx}`}>{l.tipo === 'ING' ? ingredientes.map(i => <option key={i.id} value={i.nombre} />) : epsList.map(e => <option key={e.id} value={e.nombre} />)}</datalist>
                          </td>
                          <td className={tdCls + ' text-right'}><input type="number" min={0} step="any" className="w-full bg-transparent border-none outline-none text-sm text-[#f0f0ff] text-right" value={l.cantidad || ''} onChange={e => updateLinea(idx, { cantidad: parseFloat(e.target.value) || 0 })} /></td>
                          <td className={tdCls}><select className="w-full bg-transparent border-none outline-none text-sm text-[#f0f0ff]" value={l.unidad} onChange={e => updateLinea(idx, { unidad: e.target.value })}>{cfg.unidades.map(u => <option key={u} value={u}>{u}</option>)}</select></td>
                          <td className={tdCls + ' text-right'}><input type="number" min={0} step="0.000001" className="w-full bg-transparent border-none outline-none text-sm text-[#f0f0ff] text-right" value={l.eur_ud_neta || ''} onChange={e => updateLinea(idx, { eur_ud_neta: parseFloat(e.target.value) || 0 })} /></td>
                          <td className={tdCls + ' text-right font-medium text-[#f0f0ff]'}>{fmtNum(l.eur_total, 4)}</td>
                          <td className={tdCls + ' text-right text-[#7080a8]'}>{fmtNum(l.pct_total, 1)}%</td>
                          <td className={tdCls}>
                            {idx === 0 ? (
                              <span className="text-[#7080a8] text-[10px]" title="Envase (no eliminable)">🔒</span>
                            ) : (
                              <button onClick={() => deleteLinea(idx)} className="text-[#8090b8] hover:text-[#dc2626] transition text-sm">×</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-3 py-3 border-t-2 border-accent/30 bg-accent/5">
                  <div className="flex items-center gap-6">
                    <div><span className="text-[10px] text-[#7080a8] uppercase tracking-wide block">Coste tanda</span><span className="text-sm font-bold text-[#f0f0ff]">{fmtNum(costeTanda, 4)} €</span></div>
                    <div><span className="text-[10px] text-[#7080a8] uppercase tracking-wide block">Coste MP / ración</span><span className="text-base font-bold text-[#f0f0ff]">{fmtNum(costeMP, 4)} €</span></div>
                  </div>
                  <span className="text-xs text-[#8090b8]">{raciones} raciones</span>
                </div>
              </div>
            )}
          </div>

          {/* Waterfall — layout vertical: 1 tarjeta por canal, Real/Cash dentro */}
          <div>
            <p className="text-[11px] text-[#c8d0e8] uppercase tracking-wider mb-3">Waterfall pricing por canal (Real / Cash)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {waterfallCanales.map(({ canal, pvpKey, pvp, w }) => {
                return (
                  <div key={canal.id || canal.canal} className="bg-[#2e3347] border border-[#4a5270] rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-[#2e3347] border-b border-[#4a5270]">
                      <p className="text-sm font-semibold text-[#f0f0ff]">{canal.canal}</p>
                      <p className="text-[10px] text-[#7080a8]">{canal.comision_pct}% comisión{canal.coste_fijo ? ` · +${canal.coste_fijo}€` : ''}</p>
                    </div>
                    <div className="grid grid-cols-2 text-[11px]">
                      <div className="bg-[#1e3a1e]/40 p-2 border-r border-[#4a5270]">
                        <p className="text-[9px] uppercase text-[#15803d] mb-1 font-semibold">Real</p>
                      </div>
                      <div className="bg-[#3a2a0a]/40 p-2">
                        <p className="text-[9px] uppercase text-[#c2410c] mb-1 font-semibold">Cash</p>
                      </div>
                    </div>
                    <WFRow label="Coste MP" real={w.real.coste_mp} cash={w.cash.coste_mp} />
                    <WFRow label="Coste estructura" real={w.real.coste_estructura} cash={w.cash.coste_estructura} />
                    <WFRow label="Coste plataforma" real={w.real.coste_plataforma} cash={w.cash.coste_plataforma} />
                    <WFRow label="Coste total" real={w.real.coste_total} cash={w.cash.coste_total} bold />
                    <div className="grid grid-cols-2 border-t border-[#4a5270]">
                      <div className="bg-[#1e3a1e]/30 p-2 text-[10px] text-[#c8d0e8] flex justify-between">
                        <span>Margen deseado</span><span>{fmtEur(w.real.margen_deseado, 2)}</span>
                      </div>
                      <div className="bg-[#3a2a0a]/30 p-2 text-[10px] text-[#c8d0e8] flex justify-between">
                        <span>Margen deseado</span><span>{fmtEur(w.cash.margen_deseado, 2)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 border-t border-[#4a5270]">
                      <div className="bg-[#1e3a1e]/30 p-2 text-[10px] text-[#f0f0ff] flex justify-between font-semibold">
                        <span>PVP rec.</span><span>{fmtEur(w.real.pvp_recomendado, 2)}</span>
                      </div>
                      <div className="bg-[#3a2a0a]/30 p-2 text-[10px] text-[#f0f0ff] flex justify-between font-semibold">
                        <span>PVP rec.</span><span>{fmtEur(w.cash.pvp_recomendado, 2)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 border-t border-[#4a5270]">
                      <div className="bg-[#1e3a1e]/30 p-2 text-[10px] text-[#f0f0ff] flex justify-between col-span-2">
                        <span>PVP real</span>
                        <input type="number" min={0} step="0.01" value={pvp || ''}
                          onChange={e => setPvps(p => ({ ...p, [pvpKey]: parseFloat(e.target.value) || 0 }))}
                          className="w-20 bg-[#2e3347] border border-[#555] rounded px-1 text-right text-[#f0f0ff] text-xs" />
                      </div>
                    </div>
                    <WFRow label="K multiplicador" real={w.real.factor_k} cash={w.cash.factor_k} suffix="×" fraction={2} />
                    <div className="grid grid-cols-2 border-t border-[#4a5270]">
                      <div className="bg-[#1e3a1e]/30 p-2 text-[10px] flex justify-between font-semibold">
                        <span className="text-[#c8d0e8]">Margen €</span>
                        <span className="text-[#f0f0ff]">{fmtEur(w.real.margen_eur, 2)}</span>
                      </div>
                      <div className="bg-[#3a2a0a]/30 p-2 text-[10px] flex justify-between font-semibold">
                        <span className="text-[#c8d0e8]">Margen €</span>
                        <span className="text-[#f0f0ff]">{fmtEur(w.cash.margen_eur, 2)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 border-t border-[#4a5270]">
                      <div className={'p-2 text-[10px] flex justify-between font-bold ' + semaforoClasses(w.real.margen_pct)}>
                        <span className="opacity-70">% Margen</span>
                        <span>{fmtNum(w.real.margen_pct, 2)}%</span>
                      </div>
                      <div className={'p-2 text-[10px] flex justify-between font-bold ' + semaforoClasses(w.cash.margen_pct)}>
                        <span className="opacity-70">% Margen</span>
                        <span>{fmtNum(w.cash.margen_pct, 2)}%</span>
                      </div>
                    </div>
                    <WFRow label="IVA repercutido" real={w.real.iva_repercutido} cash={w.cash.iva_repercutido} fraction={3} />
                    <WFRow label="IVA soportado" real={w.real.iva_soportado} cash={w.cash.iva_soportado} fraction={3} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[#4a5270]">
          <button onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || !nombre.trim()} className={btnPrimary + ' disabled:opacity-50'}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

function WFRow({ label, real, cash, bold, suffix, fraction = 2 }: { label: string; real: number; cash: number; bold?: boolean; suffix?: string; fraction?: number }) {
  const cls = 'p-2 text-[10px] flex justify-between' + (bold ? ' font-semibold' : '')
  return (
    <div className="grid grid-cols-2 border-t border-[#4a5270]">
      <div className={'bg-[#1e3a1e]/30 ' + cls}>
        <span className="text-[#c8d0e8]">{label}</span>
        <span className="text-[#f0f0ff]">{fmtNum(real, fraction)}{suffix ?? ' €'}</span>
      </div>
      <div className={'bg-[#3a2a0a]/30 ' + cls}>
        <span className="text-[#c8d0e8]">{label}</span>
        <span className="text-[#f0f0ff]">{fmtNum(cash, fraction)}{suffix ?? ' €'}</span>
      </div>
    </div>
  )
}
