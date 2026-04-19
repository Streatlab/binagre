import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtNum } from '@/utils/format'
import { useConfig, calcWaterfall } from '@/hooks/useConfig'
import type { Ingrediente, EPS, Receta, RecetaLinea, CanalKey } from './types'
import { UNIDADES, inputCls, thCls, tdCls, n } from './types'

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

const CHANNEL_DEFS = [
  { id: 'uber',    label: 'Uber Eats', pvpKey: 'pvp_uber' as CanalKey,    activeColor: 'var(--sl-uber)',   activeText: '#ffffff', color: 'var(--sl-uber-text)' },
  { id: 'glovo',   label: 'Glovo',     pvpKey: 'pvp_glovo' as CanalKey,   activeColor: 'var(--sl-yellow)', activeText: '#111111', color: 'var(--sl-glovo-text)' },
  { id: 'je',      label: 'Just Eat',  pvpKey: 'pvp_je' as CanalKey,      activeColor: 'var(--sl-je)',     activeText: '#111111', color: 'var(--sl-je-text)' },
  { id: 'web',     label: 'Web',       pvpKey: 'pvp_web' as CanalKey,     activeColor: 'var(--sl-red)',    activeText: '#ffffff', color: 'var(--sl-web)' },
  { id: 'directa', label: 'Directa',   pvpKey: 'pvp_directa' as CanalKey, activeColor: 'var(--sl-direct)', activeText: '#111111', color: 'var(--sl-direct-text)' },
]

const ALL_PVP_KEYS: CanalKey[] = ['pvp_uber', 'pvp_glovo', 'pvp_je', 'pvp_web', 'pvp_directa']

type MetricType = 'normal' | 'highlight' | 'small' | 'bold_ro' | 'pvp_input' | 'bold' | 'semaforo' | 'muted'

interface Metric {
  key: string
  label: string
  type: MetricType
}

interface Grupo {
  key: string
  bgColor: string
  metrics: Metric[]
}

const GRUPOS: Grupo[] = [
  {
    key: 'costes',
    bgColor: 'var(--sl-card-alt)',
    metrics: [
      { key: 'coste_mp',         label: 'Coste MP',         type: 'normal' },
      { key: 'coste_plat',       label: 'Coste plataforma', type: 'normal' },
      { key: 'coste_estructura', label: 'Coste estructura', type: 'normal' },
      { key: 'coste_total',      label: 'Coste total',      type: 'highlight' },
    ],
  },
  {
    key: 'precio',
    bgColor: 'var(--sl-card)',
    metrics: [
      { key: 'margen_deseado', label: 'Margen deseado',  type: 'small' },
      { key: 'pvp_rec',        label: 'PVP recomendado', type: 'bold_ro' },
      { key: 'pvp_real',       label: 'PVP real',        type: 'pvp_input' },
    ],
  },
  {
    key: 'resultado',
    bgColor: 'var(--sl-card)',
    metrics: [
      { key: 'k',          label: 'Factor K',  type: 'small' },
      { key: 'margen_eur', label: 'Margen €',  type: 'bold' },
      { key: 'pct_margen', label: '% Margen',  type: 'semaforo' },
    ],
  },
  {
    key: 'iva',
    bgColor: 'var(--sl-card-alt)',
    metrics: [
      { key: 'iva_rep', label: 'IVA repercutido', type: 'muted' },
      { key: 'iva_sop', label: 'IVA soportado',   type: 'muted' },
    ],
  },
]

export default function ModalReceta({ receta, ingredientes, epsList, onClose, onSaved }: Props) {
  const cfg = useConfig()
  const [nombre, setNombre] = useState(receta?.nombre ?? '')
  const [raciones, setRaciones] = useState(receta?.raciones ?? 1)
  const [tamanoRac, setTamanoRac] = useState(receta?.tamano_rac ?? 0)
  const [unidad, setUnidad] = useState(receta?.unidad ?? 'Ración')
  const [fecha, setFecha] = useState(receta?.fecha ?? '')
  const [pvps, setPvps] = useState<Record<CanalKey, number>>({
    pvp_uber: n(receta?.pvp_uber), pvp_glovo: n(receta?.pvp_glovo), pvp_je: n(receta?.pvp_je),
    pvp_web: n(receta?.pvp_web), pvp_directa: n(receta?.pvp_directa),
  })
  const [pvpManual, setPvpManual] = useState<Set<CanalKey>>(() => {
    const s = new Set<CanalKey>()
    ALL_PVP_KEYS.forEach(k => { if (n((receta as unknown as Record<string, number | null | undefined>)?.[k]) > 0) s.add(k) })
    return s
  })
  const [canalesActivos, setCanalesActivos] = useState<string[]>(['uber', 'glovo'])
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

  const setPvpForChannel = (key: CanalKey, val: number) => {
    setPvps(prev => {
      const next = { ...prev, [key]: val }
      ALL_PVP_KEYS.forEach(k => {
        if (k !== key && !pvpManual.has(k)) next[k] = val
      })
      return next
    })
    setPvpManual(prev => {
      const s = new Set(prev)
      s.add(key)
      return s
    })
  }

  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      let rid = receta?.id
      const record = {
        nombre, raciones,
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

  const channelData = canalesActivos.map(cid => {
    const def = CHANNEL_DEFS.find(d => d.id === cid)!
    const canal = cfg.canales.find(c => CANAL_TO_KEY[c.canal] === def.pvpKey)
    const pvp = pvps[def.pvpKey] ?? 0
    const w = canal ? calcWaterfall(costeMP, pvp, canal.comision_pct, canal.coste_fijo || 0, cfg.estructura_pct, canal.margen_deseado_pct ?? cfg.margen_deseado_pct) : null
    return { def, canal, pvp, w }
  })

  const getMetricValues = (metricKey: string, ch: typeof channelData[0]): { real: number; cash: number } => {
    const w = ch.w
    if (!w) return { real: 0, cash: 0 }
    switch (metricKey) {
      case 'coste_mp':         return { real: w.costeMP,          cash: w.costeMP }
      case 'coste_plat':       return { real: w.costePlatR,       cash: w.costePlatC }
      case 'coste_estructura': return { real: w.costeEstructura,  cash: w.costeEstructura }
      case 'coste_total':      return { real: w.costeTotalR,      cash: w.costeTotalC }
      case 'margen_deseado':   return { real: w.margenDeseadoR,   cash: w.margenDeseadoC }
      case 'pvp_rec':          return { real: w.pvpRecR,          cash: w.pvpRecC }
      case 'pvp_real':         return { real: ch.pvp,             cash: ch.pvp }
      case 'k':                return { real: w.k,                cash: w.k }
      case 'margen_eur':       return { real: w.margenR,          cash: w.margenC }
      case 'pct_margen':       return { real: w.pctMargenR,       cash: w.pctMargenC }
      case 'iva_rep':          return { real: w.ivaRepercutido,   cash: w.ivaRepercutido }
      case 'iva_sop':          return { real: w.ivaSoportado,     cash: w.ivaSoportado }
      default: return { real: 0, cash: 0 }
    }
  }

  const getCellStyle = (type: MetricType): React.CSSProperties => {
    const base: React.CSSProperties = { padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif' }
    switch (type) {
      case 'normal':    return { ...base, color: 'var(--sl-text-primary)',   fontSize: '12px' }
      case 'highlight': return { ...base, color: 'var(--sl-text-primary)',   fontSize: '13px', fontFamily: 'Oswald, sans-serif', fontWeight: 700, letterSpacing: '0.5px', backgroundColor: 'var(--sl-thead)' }
      case 'small':     return { ...base, color: 'var(--sl-text-muted)',     fontSize: '11px' }
      case 'bold_ro':   return { ...base, color: 'var(--sl-text-primary)',   fontSize: '14px', fontFamily: 'Oswald, sans-serif', fontWeight: 700, backgroundColor: 'var(--sl-input-ro)' }
      case 'pvp_input': return { ...base, padding: '4px 6px', backgroundColor: 'rgba(232,244,66,0.15)' }
      case 'bold':      return { ...base, color: 'var(--sl-text-primary)',   fontSize: '13px', fontFamily: 'Oswald, sans-serif', fontWeight: 700 }
      case 'semaforo':  return { ...base, fontSize: '16px', fontFamily: 'Oswald, sans-serif', fontWeight: 700 }
      case 'muted':     return { ...base, color: 'var(--sl-text-muted)',     fontSize: '11px' }
    }
  }

  const getSemaforoColor = (pct: number): string => {
    if (pct > 15) return '#06C167'
    if (pct >= 5) return '#e8f442'
    return '#ff6b70'
  }

  const renderPvpInput = (pvpKey: CanalKey) => {
    const val = pvps[pvpKey] ?? 0
    return (
      <input
        type="number"
        min={0}
        step="0.01"
        value={val > 0 ? val : ''}
        onChange={e => setPvpForChannel(pvpKey, parseFloat(e.target.value) || 0)}
        placeholder="—"
        style={{
          width: '100%',
          padding: '4px 8px',
          fontFamily: 'Oswald, sans-serif',
          fontWeight: 700,
          fontSize: '14px',
          textAlign: 'right',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--sl-text-primary)',
        }}
      />
    )
  }

  const renderValue = (metric: Metric, val: number, pvpKey: CanalKey, isReal: boolean) => {
    if (metric.type === 'pvp_input') {
      if (isReal) return renderPvpInput(pvpKey)
      return <span style={{ color: val > 0 ? 'var(--sl-text-primary)' : 'var(--sl-text-muted)', fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '14px' }}>{val > 0 ? fmtNum(val) : '—'}</span>
    }
    if (metric.type === 'semaforo') {
      return <span style={{ color: getSemaforoColor(val) }}>{fmtNum(val)}%</span>
    }
    if (metric.type === 'small' || metric.type === 'muted') {
      return <span>{val > 0 ? fmtNum(val) : '—'}</span>
    }
    return <span>{fmtNum(val)}</span>
  }

  const btnSaveStyle: React.CSSProperties = {
    backgroundColor: 'var(--sl-btn-save-bg)',
    color: 'var(--sl-btn-save-text)',
    fontFamily: 'Oswald, sans-serif',
    letterSpacing: '1px',
    padding: '9px 24px',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
    minHeight: '40px',
  }
  const btnCancelStyle: React.CSSProperties = {
    backgroundColor: 'var(--sl-btn-cancel-bg)',
    color: 'var(--sl-btn-cancel-text)',
    border: '1px solid var(--sl-btn-cancel-border)',
    fontFamily: 'Oswald, sans-serif',
    letterSpacing: '1px',
    padding: '9px 24px',
    borderRadius: '5px',
    cursor: 'pointer',
    minHeight: '40px',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl w-full max-w-7xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sl-border)]">
          <div>
            <h3 className="text-base font-semibold text-[var(--sl-text-primary)]">{receta ? 'Editar Receta' : 'Nueva Receta'}</h3>
            {receta?.codigo && <p className="text-xs text-[var(--sl-text-muted)] mt-0.5 font-mono">{receta.codigo}</p>}
          </div>
          <button onClick={onClose} className="text-[var(--sl-text-muted)] hover:text-[var(--sl-text-primary)] transition text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Cabecera: Nombre + Raciones + Tamaño + Unidad + Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm text-[var(--sl-text-secondary)] mb-1 uppercase tracking-wider">Nombre</label>
              <input className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Smash Burger" />
            </div>
            <div>
              <label className="block text-sm text-[var(--sl-text-secondary)] mb-1 uppercase tracking-wider">Raciones</label>
              <input type="number" min={1} step="1" className={inputCls} value={raciones || ''} onChange={e => setRaciones(parseFloat(e.target.value) || 1)} />
            </div>
            <div>
              <label className="block text-sm text-[var(--sl-text-secondary)] mb-1 uppercase tracking-wider">Tamaño rac</label>
              <input type="number" min={0} step="any" className={inputCls} value={tamanoRac || ''} onChange={e => setTamanoRac(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="block text-sm text-[var(--sl-text-secondary)] mb-1 uppercase tracking-wider">Unidad</label>
              <select className={inputCls} value={unidad} onChange={e => setUnidad(e.target.value)}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--sl-text-secondary)] mb-1 uppercase tracking-wider">Fecha</label>
              <input type="date" className={inputCls} value={fecha ?? ''} onChange={e => setFecha(e.target.value)} />
            </div>
          </div>

          {/* Líneas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-[var(--sl-text-secondary)] uppercase tracking-wider">Líneas</p>
              <button onClick={addLinea} className="text-xs font-semibold hover:brightness-110 transition px-3 py-1 rounded-md" style={{ backgroundColor: 'var(--sl-btn-add-alt-bg)', color: 'var(--sl-btn-add-alt-text)' }}>+ Añadir línea</button>
            </div>
            {loadingLineas ? (
              <div className="flex justify-center py-8"><div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="border border-[var(--sl-border)] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: '900px' }}>
                    <thead>
                      <tr>
                        <th className={thCls + ' w-10'}>#</th><th className={thCls + ' w-20'}>Tipo</th><th className={thCls}>Nombre</th><th className={thCls + ' w-24 text-right'}>Cantidad</th><th className={thCls + ' w-20'}>Unidad</th><th className={thCls + ' w-28 text-right'}>€/ud neta</th><th className={thCls + ' w-24 text-right'}>€ total</th><th className={thCls + ' w-16 text-right'}>% total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!lineasCalc.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-[var(--sl-text-muted)] text-sm">Sin líneas</td></tr>}
                      {lineasCalc.map((l, idx) => {
                        const nameColor = l.tipo === 'EPS' ? 'var(--sl-eps)' : 'var(--sl-text-primary)'
                        return (
                          <tr key={idx}>
                            <td className={tdCls + ' text-[var(--sl-text-muted)]'}>{idx + 1}</td>
                            <td className={tdCls}>
                              <select
                                className="w-full bg-transparent border-none outline-none text-sm"
                                style={{ color: nameColor, fontWeight: 600 }}
                                value={l.tipo}
                                onChange={e => changeTipo(idx, e.target.value as 'ING' | 'EPS')}
                              >
                                <option value="ING">ING</option>
                                <option value="EPS">EPS</option>
                              </select>
                            </td>
                            <td className={tdCls}>
                              <input
                                list={`r-i-${idx}`}
                                className="w-full bg-transparent border-none outline-none text-sm placeholder:text-[var(--sl-text-muted)]"
                                style={{ color: nameColor }}
                                value={l.ingrediente_nombre}
                                onChange={e => selectItem(idx, e.target.value)}
                                placeholder={l.tipo === 'ING' ? 'Ingrediente...' : 'EPS...'}
                              />
                              <datalist id={`r-i-${idx}`}>{l.tipo === 'ING' ? ingredientes.map(i => <option key={i.id} value={i.nombre} />) : epsList.map(e => <option key={e.id} value={e.nombre} />)}</datalist>
                            </td>
                            <td className={tdCls + ' text-right'}><input type="number" min={0} step="any" className="w-full bg-transparent border-none outline-none text-sm text-[var(--sl-text-primary)] text-right" value={l.cantidad || ''} onChange={e => updateLinea(idx, { cantidad: parseFloat(e.target.value) || 0 })} /></td>
                            <td className={tdCls}><select className="w-full bg-transparent border-none outline-none text-sm text-[var(--sl-text-primary)]" value={l.unidad} onChange={e => updateLinea(idx, { unidad: e.target.value })}>{cfg.unidades.map(u => <option key={u} value={u}>{u}</option>)}</select></td>
                            <td className={tdCls + ' text-right'}><input type="number" min={0} step="0.000001" className="w-full bg-transparent border-none outline-none text-sm text-[var(--sl-text-primary)] text-right" value={l.eur_ud_neta || ''} onChange={e => updateLinea(idx, { eur_ud_neta: parseFloat(e.target.value) || 0 })} /></td>
                            <td className={tdCls + ' text-right font-medium text-[var(--sl-text-primary)]'}>{fmtNum(l.eur_total)}</td>
                            <td className={tdCls + ' text-right text-[var(--sl-text-muted)]'}>{fmtNum(l.pct_total)}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-3 py-3 border-t-2 border-accent/30 bg-accent/5">
                  <div className="flex items-center gap-6">
                    <div><span className="text-[10px] text-[var(--sl-text-muted)] uppercase tracking-wide block">Coste tanda</span><span className="text-sm font-bold text-[var(--sl-text-primary)]">{fmtNum(costeTanda)} €</span></div>
                    <div><span className="text-[10px] text-[var(--sl-text-muted)] uppercase tracking-wide block">Coste MP / ración</span><span className="text-base font-bold text-[var(--sl-text-primary)]">{fmtNum(costeMP)} €</span></div>
                  </div>
                  <span className="text-xs text-[var(--sl-text-muted)]">{raciones} raciones</span>
                </div>
              </div>
            )}
          </div>

          {/* Waterfall — toggles + tabla rediseñada */}
          <div>
            <p className="text-sm text-[var(--sl-text-secondary)] uppercase tracking-wider mb-3">Waterfall pricing por canal</p>

            {/* Botones toggle */}
            <div className="flex flex-wrap gap-2 mb-4">
              {CHANNEL_DEFS.map(ch => {
                const isActive = canalesActivos.includes(ch.id)
                return (
                  <button
                    key={ch.id}
                    onClick={() => setCanalesActivos(p => isActive ? p.filter(x => x !== ch.id) : [...p, ch.id])}
                    style={{
                      backgroundColor: isActive ? ch.activeColor : 'var(--sl-input-edit)',
                      color: isActive ? ch.activeText : 'var(--sl-text-muted)',
                      fontFamily: 'Oswald, sans-serif',
                      letterSpacing: '1px',
                    }}
                    className="text-xs font-medium px-3 py-1.5 rounded transition uppercase"
                  >
                    {ch.label}
                  </button>
                )
              })}
            </div>

            {/* Tabla waterfall */}
            {canalesActivos.length === 0 ? (
              <div className="text-center py-8 text-[var(--sl-text-muted)]">Selecciona al menos un canal</div>
            ) : (
              <div className="border border-[var(--sl-border)] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: canalesActivos.length * 200 + 160 + 'px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--sl-thead)' }}>
                        <th style={{ width: '160px', padding: '10px 14px', textAlign: 'left', fontFamily: 'Oswald, sans-serif', color: 'var(--sl-text-muted)', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', borderRight: '2px solid var(--sl-border-strong)' }}>
                          Métrica
                        </th>
                        {channelData.map((ch, cidx) => {
                          const isLast = cidx === channelData.length - 1
                          return (
                            <th key={ch.def.id} colSpan={2} style={{
                              padding: '10px 6px',
                              textAlign: 'center',
                              fontFamily: 'Oswald, sans-serif',
                              fontSize: '13px',
                              fontWeight: 700,
                              letterSpacing: '1.5px',
                              color: ch.def.color,
                              textTransform: 'uppercase',
                              borderRight: isLast ? 'none' : '2px solid var(--sl-border-strong)',
                            }}>
                              {ch.def.label}
                              <div style={{ fontSize: '9px', fontWeight: 400, letterSpacing: '1px', color: 'var(--sl-text-muted)', marginTop: '3px' }}>REAL · CASH</div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    {GRUPOS.map((grupo, gIdx) => {
                      const isLastGroup = gIdx === GRUPOS.length - 1
                      return (
                        <tbody key={grupo.key}>
                          {grupo.metrics.map((m, mIdx) => {
                            const isLastInGroup = mIdx === grupo.metrics.length - 1
                            const rowStyle: React.CSSProperties = { backgroundColor: grupo.bgColor }
                            if (isLastInGroup && !isLastGroup) {
                              rowStyle.borderBottom = '2px solid var(--sl-border-strong)'
                            }
                            const cellBaseStyle = getCellStyle(m.type)
                            return (
                              <tr key={m.key} style={rowStyle}>
                                <td style={{
                                  width: '160px',
                                  padding: '8px 14px',
                                  fontFamily: 'Oswald, sans-serif',
                                  color: 'var(--sl-text-muted)',
                                  fontSize: '11px',
                                  letterSpacing: '1px',
                                  textTransform: 'uppercase',
                                  borderRight: '2px solid var(--sl-border-strong)',
                                }}>
                                  {m.label}
                                </td>
                                {channelData.map((ch, cidx) => {
                                  const vals = getMetricValues(m.key, ch)
                                  const isLast = cidx === channelData.length - 1
                                  const tdStyle: React.CSSProperties = {
                                    ...cellBaseStyle,
                                    borderRight: isLast ? 'none' : '2px solid var(--sl-border-strong)',
                                  }
                                  return (
                                    <React.Fragment key={ch.def.id}>
                                      <td style={tdStyle}>
                                        {renderValue(m, vals.real, ch.def.pvpKey, true)}
                                      </td>
                                      <td style={tdStyle}>
                                        {renderValue(m, vals.cash, ch.def.pvpKey, false)}
                                      </td>
                                    </React.Fragment>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      )
                    })}
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--sl-border)]">
          <button onClick={onClose} style={btnCancelStyle}>CANCELAR</button>
          <button onClick={handleSave} disabled={saving || !nombre.trim()} style={{ ...btnSaveStyle, opacity: (saving || !nombre.trim()) ? 0.5 : 1 }}>
            {saving ? 'GUARDANDO…' : 'GUARDAR'}
          </button>
        </div>
      </div>
    </div>
  )
}
