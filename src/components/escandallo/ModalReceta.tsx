import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtNum, fmtEur, fmtPct } from '@/utils/format'
import { useConfig } from '@/hooks/useConfig'
import { calcWaterfall, type ConfigCanal, type FilaWaterfall } from '@/utils/calcWaterfall'
import type { Ingrediente, EPS, Receta, RecetaLinea, CanalKey } from './types'
import { UNIDADES, inputCls, thCls, tdCls, n } from './types'

interface Props { receta: Receta | null; ingredientes: Ingrediente[]; epsList: EPS[]; onClose: () => void; onSaved: () => void }

// Colores fijos por canal (no cambian con el tema — son marca)
const CHANNELS = [
  { id: 'uber',    label: 'Uber Eats', canalName: 'Uber Eats',     pvpKey: 'pvp_uber'    as CanalKey, color: '#06C167', fg: '#ffffff' },
  { id: 'glovo',   label: 'Glovo',     canalName: 'Glovo',         pvpKey: 'pvp_glovo'   as CanalKey, color: '#e8f442', fg: '#1a1a1a' },
  { id: 'je',      label: 'Just Eat',  canalName: 'Just Eat',      pvpKey: 'pvp_je'      as CanalKey, color: '#f5a623', fg: '#111111' },
  { id: 'web',     label: 'Web',       canalName: 'Web Propia',    pvpKey: 'pvp_web'     as CanalKey, color: '#ff6b70', fg: '#ffffff' },
  { id: 'directa', label: 'Directa',   canalName: 'Venta Directa', pvpKey: 'pvp_directa' as CanalKey, color: '#66aaff', fg: '#111111' },
]

const ALL_PVP_KEYS: CanalKey[] = ['pvp_uber', 'pvp_glovo', 'pvp_je', 'pvp_web', 'pvp_directa']

// Hex → rgba al 40%
function colorAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// Normaliza % (acepta 30 ó 0.30)
function norm(v: number): number {
  return v > 1 ? v / 100 : v
}


export default function ModalReceta({ receta, ingredientes, epsList, onClose, onSaved }: Props) {
  const cfg = useConfig()
  const [nombre, setNombre] = useState(receta?.nombre ?? '')
  const [raciones, setRaciones] = useState(receta?.raciones ?? 1)
  const [tamanoRac, setTamanoRac] = useState(receta?.tamano_rac ?? 0)
  const [unidad, setUnidad] = useState(receta?.unidad ?? 'Ración')
  const [fecha, setFecha] = useState(receta?.fecha ?? '')

  // PVP único — el mismo valor propaga a todos los canales
  const [pvpGlobal, setPvpGlobal] = useState<number>(() => {
    const saved = ALL_PVP_KEYS.map(k => n((receta as unknown as Record<string, number | null | undefined>)?.[k])).filter(v => v > 0)
    return saved.length > 0 ? saved[0] : 0
  })

  const [canalesActivos, setCanalesActivos] = useState<string[]>(['uber', 'glovo', 'je'])
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
    return items.map(i => ({ ...i, pct_total: total > 0 ? i.eur_total / total : 0 }))
  }, [lineas])

  const costeTanda = useMemo(() => lineasCalc.reduce((s, l) => s + l.eur_total, 0), [lineasCalc])
  const costeMP = raciones > 0 ? costeTanda / raciones : 0

  const updateLinea = useCallback((idx: number, patch: Partial<RecetaLinea>) => {
    setLineas(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }, [])
  const addLinea = () => setLineas(prev => [...prev, { linea: prev.length + 1, tipo: 'ING', ingrediente_nombre: '', ingrediente_id: null, eps_id: null, cantidad: 0, unidad: 'gr.', eur_ud_neta: 0 }])
  const changeTipo = (idx: number, tipo: 'ING' | 'EPS') => updateLinea(idx, { tipo, ingrediente_nombre: '', ingrediente_id: null, eps_id: null, eur_ud_neta: 0, unidad: 'gr.' })
  const selectItem = (idx: number, val: string) => {
    const ing = ingredientes.find(i => i.nombre === val)
    if (ing) {
      updateLinea(idx, { tipo: 'ING', ingrediente_nombre: ing.nombre, ingrediente_id: ing.id, eps_id: null, eur_ud_neta: n(ing.eur_min) || n(ing.eur_std), unidad: ing.ud_min ?? ing.ud_std ?? 'gr.' })
    } else {
      const ep = epsList.find(e => e.nombre === val)
      if (ep) {
        updateLinea(idx, { tipo: 'EPS', ingrediente_nombre: ep.nombre, eps_id: ep.id, ingrediente_id: null, eur_ud_neta: n(ep.coste_rac), unidad: ep.unidad ?? 'Ración' })
      } else {
        updateLinea(idx, { ingrediente_nombre: val, ingrediente_id: null, eps_id: null })
      }
    }
  }

  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      let rid = receta?.id
      const pvpRecord: Record<CanalKey, number> = {
        pvp_uber: pvpGlobal, pvp_glovo: pvpGlobal, pvp_je: pvpGlobal, pvp_web: pvpGlobal, pvp_directa: pvpGlobal,
      }
      const record = {
        nombre, raciones,
        tamano_rac: tamanoRac || null, unidad: unidad || null, fecha: fecha || null,
        coste_tanda: costeTanda, coste_rac: costeMP, ...pvpRecord,
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

  // Datos por canal activo
  const channelData = canalesActivos.map(cid => {
    const ch = CHANNELS.find(c => c.id === cid)!
    const cfgCanal = cfg.canales.find(c => c.canal === ch.canalName)
    const comision = norm(cfgCanal?.comision_pct ?? 0)
    const estructura = norm(cfg.estructura_pct ?? 0)
    const margenDeseado = norm(cfgCanal?.margen_deseado_pct ?? cfg.margen_deseado_pct ?? 0)
    const canal: ConfigCanal = { nombre: ch.canalName, comision_pct: comision, estructura_pct: estructura, margen_deseado_pct: margenDeseado }
    const w = calcWaterfall(costeMP, pvpGlobal, canal)
    return { ch, comision, margenDeseado, w }
  })

  const getSemaforoColor = (pct: number): string => {
    // pct is 0-1, convert to 0-100 for threshold comparison
    const pct100 = pct * 100
    if (pct100 >= 65) return '#06C167'
    if (pct100 >= 50) return '#f5a623'
    return '#B01D23'
  }

  const pvpRef = useRef<HTMLInputElement>(null)

  const btnSaveStyle: CSSProperties = {
    backgroundColor: 'var(--sl-btn-save-bg)', color: 'var(--sl-btn-save-text)',
    fontFamily: 'Oswald, sans-serif', letterSpacing: '1px', padding: '9px 24px',
    borderRadius: '5px', border: 'none', cursor: 'pointer', minHeight: '40px',
  }
  const btnCancelStyle: CSSProperties = {
    backgroundColor: 'var(--sl-btn-cancel-bg)', color: 'var(--sl-btn-cancel-text)',
    border: '1px solid var(--sl-btn-cancel-border)',
    fontFamily: 'Oswald, sans-serif', letterSpacing: '1px', padding: '9px 24px',
    borderRadius: '5px', cursor: 'pointer', minHeight: '40px',
  }

  // Celdas waterfall
  const metricaCellStyle: CSSProperties = {
    width: '130px', padding: '8px 12px', textAlign: 'left',
    fontFamily: 'Oswald, sans-serif', color: 'var(--sl-text-muted)',
    fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase',
  }

  // Border left on the first (real) column of each non-first channel
  const channelBorderStyle = (chIdx: number, isRealCol: boolean): CSSProperties => {
    if (chIdx === 0 || !isRealCol) return {}
    return { borderLeft: `2px solid #1a1f2e` }
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
          {/* Cabecera */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm text-[var(--sl-text-secondary)] mb-1 uppercase tracking-wider">Nombre</label>
              <input className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Smash Burger" />
            </div>
            <div className="w-24">
              <label className="block text-sm text-[var(--sl-text-secondary)] mb-1 uppercase tracking-wider">Raciones</label>
              <input type="number" min={1} step="1" className={inputCls} value={raciones || ''} onChange={e => setRaciones(parseFloat(e.target.value) || 1)} />
            </div>
            <div className="w-28">
              <label className="block text-sm text-[var(--sl-text-secondary)] mb-1 uppercase tracking-wider">Tamaño rac</label>
              <input type="number" min={0} step="any" className={inputCls} value={tamanoRac || ''} onChange={e => setTamanoRac(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="w-24">
              <label className="block text-sm text-[var(--sl-text-secondary)] mb-1 uppercase tracking-wider">Unidad</label>
              <select className={inputCls} value={unidad} onChange={e => setUnidad(e.target.value)}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="w-32">
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
                        <th className={thCls + ' w-10'}>#</th><th className={thCls}>Ingrediente / EPS</th><th className={thCls + ' w-24 text-right'}>Cantidad</th><th className={thCls + ' w-20'}>Unidad</th><th className={thCls + ' w-28 text-right'}>€/ud neta</th><th className={thCls + ' w-24 text-right'}>€ total</th><th className={thCls + ' w-16 text-right'}>% total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!lineasCalc.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-[var(--sl-text-muted)] text-sm">Sin líneas</td></tr>}
                      {lineasCalc.map((l, idx) => {
                        const allItems = [
                          ...epsList.map(e => ({ nombre: e.nombre, tipo: 'EPS' as const, id: e.id, badge: 'EPS' })),
                          ...ingredientes.map(i => ({ nombre: i.nombre, tipo: 'ING' as const, id: i.id, badge: i.abv || 'ING' }))
                        ].sort((a, b) => {
                          if (a.tipo !== b.tipo) return a.tipo === 'EPS' ? -1 : 1
                          return a.nombre.localeCompare(b.nombre)
                        })
                        const selected = allItems.find(item => item.nombre === l.ingrediente_nombre)
                        return (
                          <tr key={idx}>
                            <td className={tdCls + ' text-[var(--sl-text-muted)]'}>{idx + 1}</td>
                            <td className={tdCls}>
                              <div className="flex items-center gap-2">
                                <input list={`r-all-${idx}`} className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-[var(--sl-text-muted)]" value={l.ingrediente_nombre} onChange={e => selectItem(idx, e.target.value)} placeholder="Ingrediente o EPS..." />
                                {l.ingrediente_nombre && (
                                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap" style={{ backgroundColor: selected?.tipo === 'EPS' ? '#66aaff' : '#c8d0e8', color: selected?.tipo === 'EPS' ? '#fff' : '#111' }}>
                                    {selected?.badge}
                                  </span>
                                )}
                                <datalist id={`r-all-${idx}`}>{allItems.map(item => <option key={`${item.tipo}-${item.id}`} value={item.nombre} />)}</datalist>
                              </div>
                            </td>
                            <td className={tdCls + ' text-right'}><input type="number" min={0} step="any" className="w-full bg-transparent border-none outline-none text-sm text-[var(--sl-text-primary)] text-right" value={l.cantidad || ''} onChange={e => updateLinea(idx, { cantidad: parseFloat(e.target.value) || 0 })} /></td>
                            <td className={tdCls}><select className="w-full bg-transparent border-none outline-none text-sm text-[var(--sl-text-primary)]" value={l.unidad} onChange={e => updateLinea(idx, { unidad: e.target.value })}>{cfg.unidades.map(u => <option key={u} value={u}>{u}</option>)}</select></td>
                            <td className={tdCls + ' text-right'}><input type="number" min={0} step="0.0001" className="w-full bg-transparent border-none outline-none text-sm text-[var(--sl-text-primary)] text-right" value={l.eur_ud_neta ? Number(l.eur_ud_neta).toFixed(2) : ''} onChange={e => updateLinea(idx, { eur_ud_neta: parseFloat(e.target.value) || 0 })} /></td>
                            <td className={tdCls + ' text-right font-medium text-[var(--sl-text-primary)]'}>{fmtEur(l.eur_total)}</td>
                            <td className={tdCls + ' text-right text-[var(--sl-text-muted)]'}>{fmtPct(l.pct_total)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-3 py-3 border-t-2 border-accent/30 bg-accent/5">
                  <div className="flex items-center gap-6">
                    <div><span className="text-[10px] text-[var(--sl-text-muted)] uppercase tracking-wide block">Coste tanda</span><span className="text-sm font-bold text-[var(--sl-text-primary)]">{fmtEur(costeTanda)}</span></div>
                    <div><span className="text-[10px] text-[var(--sl-text-muted)] uppercase tracking-wide block">Coste MP / ración</span><span className="text-base font-bold text-[var(--sl-text-primary)]">{Number(costeMP ?? 0).toFixed(2)}</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Waterfall */}
          <div>
            <p className="text-sm text-[var(--sl-text-secondary)] uppercase tracking-wider mb-3">Waterfall pricing por canal</p>

            {/* Toggles */}
            <div className="flex flex-wrap gap-2 mb-4">
              {CHANNELS.map(ch => {
                const isActive = canalesActivos.includes(ch.id)
                return (
                  <button
                    key={ch.id}
                    onClick={() => setCanalesActivos(p => isActive ? p.filter(x => x !== ch.id) : [...p, ch.id])}
                    style={{
                      backgroundColor: ch.color,
                      color: ch.fg,
                      fontFamily: 'Oswald, sans-serif',
                      letterSpacing: '1px',
                      opacity: isActive ? 1 : 0.35,
                    }}
                    className="text-xs font-medium px-3 py-1.5 rounded transition uppercase"
                  >
                    {ch.label}
                  </button>
                )
              })}
            </div>

            {/* Tabla */}
            {canalesActivos.length === 0 ? (
              <div className="text-center py-8 text-[var(--sl-text-muted)]">Selecciona al menos un canal</div>
            ) : (
              <div className="border border-[var(--sl-border)] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                    {/* Encabezados */}
                    <thead>
                      <tr style={{ backgroundColor: 'var(--sl-thead)' }}>
                        <th style={{ ...metricaCellStyle, padding: '10px 12px' }}>MÉTRICA</th>
                        {channelData.map((d, idx) => (
                          <th key={d.ch.id} colSpan={2} style={{
                            padding: '10px 10px',
                            textAlign: 'center',
                            fontFamily: 'Oswald, sans-serif',
                            fontSize: '12px',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            color: d.ch.color,
                            textTransform: 'uppercase',
                            ...channelBorderStyle(idx, true),
                          }}>
                            {d.ch.label}
                          </th>
                        ))}
                      </tr>
                      <tr style={{ backgroundColor: 'var(--sl-thead)' }}>
                        <th />
                        {channelData.map((d, idx) => (
                          <>
                            <th key={`${d.ch.id}-hr`} style={{ padding: '4px 10px', textAlign: 'right', fontSize: '9px', fontFamily: 'Oswald, sans-serif', color: 'var(--sl-text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', ...channelBorderStyle(idx, true) }}>real</th>
                            <th key={`${d.ch.id}-hc`} style={{ padding: '4px 10px', textAlign: 'right', fontSize: '9px', fontFamily: 'Oswald, sans-serif', color: 'var(--sl-text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>cash</th>
                          </>
                        ))}
                      </tr>
                    </thead>

                    {/* GRUPO COSTES */}
                    <tbody>
                      <tr style={{ backgroundColor: 'var(--sl-card-alt)' }}>
                        <td style={metricaCellStyle}>Coste MP</td>
                        {channelData.map((d, idx) => (
                          <td key={`${d.ch.id}-mp`} colSpan={2} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '14px', fontWeight: 700, color: 'var(--sl-text-primary)', ...channelBorderStyle(idx, true) }}>{fmtEur(costeMP)}</td>
                        ))}
                      </tr>
                      <tr style={{ backgroundColor: 'var(--sl-card-alt)' }}>
                        <td style={metricaCellStyle}>Coste plataforma</td>
                        {channelData.map((d, idx) => (
                          <>
                            <td key={`${d.ch.id}-pl-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: 'var(--sl-text-primary)', ...channelBorderStyle(idx, true) }}>{fmtEur(d.w.real.coste_plataforma)}</td>
                            <td key={`${d.ch.id}-pl-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: 'var(--sl-text-muted)' }}>{fmtEur(d.w.cash.coste_plataforma)}</td>
                          </>
                        ))}
                      </tr>
                      <tr style={{ backgroundColor: 'var(--sl-card-alt)' }}>
                        <td style={metricaCellStyle}>Coste estructura</td>
                        {channelData.map((d, idx) => (
                          <>
                            <td key={`${d.ch.id}-es-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: 'var(--sl-text-primary)', ...channelBorderStyle(idx, true) }}>{fmtEur(d.w.real.coste_estructura)}</td>
                            <td key={`${d.ch.id}-es-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: 'var(--sl-text-muted)' }}>{fmtEur(d.w.cash.coste_estructura)}</td>
                          </>
                        ))}
                      </tr>
                      <tr style={{ backgroundColor: 'var(--sl-card-alt)', borderTop: '2px solid var(--sl-border-strong)', borderBottom: '2px solid var(--sl-border-strong)' }}>
                        <td style={{ ...metricaCellStyle, fontWeight: 700, color: 'var(--sl-text-primary)' }}>Coste total</td>
                        {channelData.map((d, idx) => (
                          <>
                            <td key={`${d.ch.id}-tot-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '13px', fontWeight: 700, color: 'var(--sl-text-primary)', ...channelBorderStyle(idx, true) }}>{fmtEur(d.w.real.coste_total)}</td>
                            <td key={`${d.ch.id}-tot-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '13px', fontWeight: 700, color: 'var(--sl-text-muted)' }}>{fmtEur(d.w.cash.coste_total)}</td>
                          </>
                        ))}
                      </tr>
                    </tbody>

                    {/* GRUPO PRECIO */}
                    <tbody>
                      <tr style={{ backgroundColor: 'var(--sl-card)', borderTop: '2px solid var(--sl-border-strong)' }}>
                        <td style={metricaCellStyle}>Margen deseado</td>
                        {channelData.map((d, idx) => (
                          <>
                            <td key={`${d.ch.id}-md-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '11px', color: 'var(--sl-text-muted)', ...channelBorderStyle(idx, true) }}>{fmtPct(d.margenDeseado)}</td>
                            <td key={`${d.ch.id}-md-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '11px', color: 'var(--sl-text-muted)' }}>{fmtPct(d.margenDeseado)}</td>
                          </>
                        ))}
                      </tr>
                      <tr style={{ backgroundColor: 'var(--sl-card)' }}>
                        <td style={metricaCellStyle}>PVP recomendado</td>
                        {channelData.map((d, idx) => (
                          <>
                            <td key={`${d.ch.id}-pr-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '12px', fontWeight: 500, color: 'var(--sl-text-primary)', ...channelBorderStyle(idx, true) }}>{fmtEur(d.w.real.pvp_recomendado)}</td>
                            <td key={`${d.ch.id}-pr-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '12px', fontWeight: 500, color: 'var(--sl-text-muted)' }}>{fmtEur(d.w.cash.pvp_recomendado)}</td>
                          </>
                        ))}
                      </tr>
                      <tr style={{ backgroundColor: 'var(--sl-card)' }}>
                        <td style={metricaCellStyle}>PVP real</td>
                        {channelData.map((d, idx) => (
                          <td key={`${d.ch.id}-pvp`} colSpan={2} style={{ padding: '6px 8px', ...channelBorderStyle(idx, true) }}>
                            <input
                              ref={idx === 0 ? pvpRef : undefined}
                              type="number"
                              min={0}
                              step="0.01"
                              value={pvpGlobal > 0 ? pvpGlobal : ''}
                              onChange={e => setPvpGlobal(parseFloat(e.target.value) || 0)}
                              placeholder="—"
                              style={{
                                width: '100%',
                                padding: '4px 8px',
                                fontFamily: 'Oswald, sans-serif',
                                fontSize: '14px',
                                fontWeight: 700,
                                textAlign: 'center',
                                color: '#2a52a0',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>

                    {/* GRUPO RESULTADO */}
                    <tbody>
                      <tr style={{ borderTop: '2px solid var(--sl-border-strong)' }}>
                        <td style={metricaCellStyle}>Factor K</td>
                        {channelData.map((d, idx) => (
                          <td key={`${d.ch.id}-k`} colSpan={2} style={{ padding: '8px 10px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: '11px', color: 'var(--sl-text-muted)', ...channelBorderStyle(idx, true) }}>
                            {fmtNum(d.w.real.factor_k)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td style={metricaCellStyle}>Margen €</td>
                        {channelData.map((d, idx) => (
                          <>
                            <td key={`${d.ch.id}-mg-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '12px', fontWeight: 600, color: 'var(--sl-text-primary)', ...channelBorderStyle(idx, true) }}>{fmtEur(d.w.real.margen_eur)}</td>
                            <td key={`${d.ch.id}-mg-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '12px', fontWeight: 600, color: 'var(--sl-text-muted)' }}>{fmtEur(d.w.cash.margen_eur)}</td>
                          </>
                        ))}
                      </tr>
                      <tr>
                        <td style={metricaCellStyle}>% Margen</td>
                        {channelData.map((d, idx) => (
                          <>
                            <td key={`${d.ch.id}-pct-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '13px', fontWeight: 700, color: getSemaforoColor(d.w.real.margen_pct), ...channelBorderStyle(idx, true) }}>
                              {fmtPct(d.w.real.margen_pct / 100)}
                            </td>
                            <td key={`${d.ch.id}-pct-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '13px', fontWeight: 700, color: getSemaforoColor(d.w.cash.margen_pct) }}>
                              {fmtPct(d.w.cash.margen_pct / 100)}
                            </td>
                          </>
                        ))}
                      </tr>
                    </tbody>

                    {/* GRUPO IVA */}
                    <tbody>
                      <tr style={{ backgroundColor: 'var(--sl-card-alt)' }}>
                        <td style={metricaCellStyle}>IVA repercutido</td>
                        {channelData.map((d, idx) => (
                          <td key={`${d.ch.id}-ivr`} colSpan={2} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '11px', color: 'var(--sl-text-muted)', ...channelBorderStyle(idx, true) }}>{fmtEur(d.w.real.iva_repercutido)}</td>
                        ))}
                      </tr>
                      <tr style={{ backgroundColor: 'var(--sl-card-alt)' }}>
                        <td style={metricaCellStyle}>IVA soportado</td>
                        {channelData.map((d, idx) => (
                          <td key={`${d.ch.id}-ivs`} colSpan={2} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '11px', color: 'var(--sl-text-muted)', ...channelBorderStyle(idx, true) }}>{d.comision === 0 ? '—' : fmtEur(d.w.real.iva_soportado)}</td>
                        ))}
                      </tr>
                    </tbody>
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
