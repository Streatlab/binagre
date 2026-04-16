import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente, EPS, EPSLinea } from './types'
import { UNIDADES, inputCls, thCls, tdCls, n } from './types'

interface Props { eps: EPS | null; ingredientes: Ingrediente[]; onClose: () => void; onSaved: () => void }

export default function ModalEPS({ eps, ingredientes, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(eps?.nombre ?? '')
  const [raciones, setRaciones] = useState(eps?.raciones ?? 1)
  const [tamanoRac, setTamanoRac] = useState(eps?.tamano_rac ?? 0)
  const [unidad, setUnidad] = useState(eps?.unidad ?? 'gr.')
  const [fecha, setFecha] = useState(eps?.fecha ?? '')
  const [lineas, setLineas] = useState<EPSLinea[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingLineas, setLoadingLineas] = useState(!!eps)

  useEffect(() => {
    if (!eps) return
    let cancelled = false
    ;(async () => {
      setLoadingLineas(true)
      const { data } = await supabase.from('eps_lineas').select('*').eq('eps_id', eps.id).order('linea')
      if (!cancelled && data) setLineas(data.map((d: any) => ({
        linea: d.linea ?? 0, ingrediente_nombre: d.ingrediente_nombre ?? '', ingrediente_id: d.ingrediente_id ?? null,
        cantidad: d.cantidad ?? 0, unidad: d.unidad ?? 'gr.', eur_ud_neta: d.eur_ud_neta ?? 0,
      })))
      if (!cancelled) setLoadingLineas(false)
    })()
    return () => { cancelled = true }
  }, [eps])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const lineasCalc = useMemo(() => {
    const items = lineas.map(l => ({ ...l, eur_total: l.cantidad * l.eur_ud_neta }))
    const total = items.reduce((s, i) => s + i.eur_total, 0)
    return items.map(i => ({ ...i, pct_total: total > 0 ? (i.eur_total / total) * 100 : 0 }))
  }, [lineas])

  const costeTanda = useMemo(() => lineasCalc.reduce((s, l) => s + l.eur_total, 0), [lineasCalc])
  const costeRac = raciones > 0 ? costeTanda / raciones : 0

  const updateLinea = useCallback((idx: number, patch: Partial<EPSLinea>) => {
    setLineas(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }, [])
  const addLinea = () => setLineas(prev => [...prev, { linea: prev.length + 1, ingrediente_nombre: '', ingrediente_id: null, cantidad: 0, unidad: 'gr.', eur_ud_neta: 0 }])
  const deleteLinea = (idx: number) => setLineas(prev => prev.filter((_, i) => i !== idx))

  const selectIngrediente = (idx: number, val: string) => {
    const ing = ingredientes.find(i => i.nombre === val)
    if (ing) updateLinea(idx, { ingrediente_nombre: ing.nombre, ingrediente_id: ing.id, eur_ud_neta: n(ing.eur_min) || n(ing.eur_std), unidad: ing.ud_min ?? ing.ud_std ?? 'gr.' })
    else updateLinea(idx, { ingrediente_nombre: val, ingrediente_id: null })
  }

  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      let epsId = eps?.id
      const record = { nombre, raciones, tamano_rac: tamanoRac || null, coste_tanda: costeTanda, coste_rac: costeRac, unidad, fecha: fecha || null }
      if (epsId) { const { error } = await supabase.from('eps').update(record).eq('id', epsId); if (error) throw error }
      else { const { data, error } = await supabase.from('eps').insert(record).select('id').single(); if (error) throw error; epsId = data.id }

      await supabase.from('eps_lineas').delete().eq('eps_id', epsId)
      if (lineasCalc.length > 0) {
        const rows = lineasCalc.map((l, i) => ({ eps_id: epsId, linea: i + 1, ingrediente_nombre: l.ingrediente_nombre, ingrediente_id: l.ingrediente_id, cantidad: l.cantidad, unidad: l.unidad, eur_ud_neta: l.eur_ud_neta, eur_total: l.eur_total, pct_total: l.pct_total }))
        const { error } = await supabase.from('eps_lineas').insert(rows); if (error) throw error
      }
      onSaved()
    } catch (e: any) { alert('Error: ' + (e.message || 'Error desconocido')) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-white">{eps ? 'Editar EPS' : 'Nueva EPS'}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition text-lg leading-none">✕</button>
        </div>
        <div className="p-5 space-y-5">
          {/* Campos */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-neutral-500 mb-1.5">Nombre</label>
              <input className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Salsa brava" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Raciones</label>
              <input type="number" min={1} step="1" className={inputCls} value={raciones || ''} onChange={e => setRaciones(parseFloat(e.target.value) || 1)} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Tamaño ración</label>
              <input type="number" min={0} step="any" className={inputCls} value={tamanoRac || ''} onChange={e => setTamanoRac(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Unidad</label>
              <select className={inputCls} value={unidad} onChange={e => setUnidad(e.target.value)}>{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}</select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Fecha</label>
              <input type="date" className={inputCls} value={fecha} onChange={e => setFecha(e.target.value)} />
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
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-base/50">
                      <tr>
                        <th className={thCls + ' w-10'}>#</th><th className={thCls}>Ingrediente</th><th className={thCls + ' w-24'}>Cantidad</th><th className={thCls + ' w-20'}>Unidad</th><th className={thCls + ' w-24'}>€/ud</th><th className={thCls + ' w-24 text-right'}>€ Total</th><th className={thCls + ' w-16 text-right'}>%</th><th className={thCls + ' w-10'} />
                      </tr>
                    </thead>
                    <tbody>
                      {!lineasCalc.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-600 text-sm">Sin líneas — añade ingredientes</td></tr>}
                      {lineasCalc.map((l, idx) => (
                        <tr key={idx} className="border-t border-border hover:bg-white/[0.02] transition">
                          <td className={tdCls + ' text-neutral-600'}>{idx + 1}</td>
                          <td className={tdCls}>
                            <input list={`eps-ing-${idx}`} className="w-full bg-transparent border-none outline-none text-sm text-white placeholder:text-neutral-600" value={l.ingrediente_nombre} onChange={e => selectIngrediente(idx, e.target.value)} placeholder="Buscar ingrediente…" />
                            <datalist id={`eps-ing-${idx}`}>{ingredientes.map(i => <option key={i.id} value={i.nombre} />)}</datalist>
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
                    <div><span className="text-[10px] text-neutral-500 uppercase tracking-wide block">Coste ración</span><span className="text-base font-bold text-accent tabular-nums">{costeRac.toFixed(4)} €</span></div>
                  </div>
                  <span className="text-xs text-neutral-600">{raciones} raciones</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 border border-border rounded-lg hover:text-white transition">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !nombre.trim()} className="px-5 py-2 text-sm font-semibold bg-accent text-black rounded-lg hover:brightness-110 transition disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
