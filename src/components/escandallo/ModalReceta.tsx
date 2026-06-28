import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtNum, fmtEur, fmtPct } from '@/utils/format'
import { useConfig } from '@/hooks/useConfig'
import type { Ingrediente, EPS, Receta, RecetaLinea, CanalKey } from './types'
import { UNIDADES, thCls, tdCls, n } from './types'
import ModalIngrediente from './ModalIngrediente'
import ModalEPS from './ModalEPS'
import BuscadorItem from './BuscadorItem'

interface ConflictoItem { nombre: string; cantidad: number; unidad: string }

interface Props { receta: Receta | null; initialNombre?: string; ingredientes: Ingrediente[]; epsList: EPS[]; onClose: () => void; onSaved: () => void; onDelete?: () => void }

const labelStyle = (_isDark?: boolean): CSSProperties => ({
  fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase' as const, letterSpacing: '2px',
  color: 'var(--sl-text-muted)', marginBottom: 6,
})

const inputStyle: CSSProperties = {
  width: '100%', padding: '8px 12px', background: 'var(--sl-input-bg)',
  border: '1px solid var(--sl-border)', borderRadius: 4,
  fontFamily: 'Lexend, sans-serif', fontSize: 13, color: 'var(--sl-text-primary)',
  outline: 'none', transition: 'border-color 200ms',
}

const CHANNELS = [
  { id: 'uber',    label: 'Uber Eats', canalName: 'Uber Eats',     pvpKey: 'pvp_uber'    as CanalKey, color: '#06C167', fg: '#ffffff' },
  { id: 'glovo',   label: 'Glovo',     canalName: 'Glovo',         pvpKey: 'pvp_glovo'   as CanalKey, color: '#e8f442', fg: '#111111' },
  { id: 'je',      label: 'Just Eat',  canalName: 'Just Eat',      pvpKey: 'pvp_je'      as CanalKey, color: '#f5a623', fg: '#111111' },
  { id: 'web',     label: 'Web',       canalName: 'Web Propia',    pvpKey: 'pvp_web'     as CanalKey, color: '#ff6b70', fg: '#ffffff' },
  { id: 'directa', label: 'Directa',   canalName: 'Venta Directa', pvpKey: 'pvp_directa' as CanalKey, color: '#66aaff', fg: '#111111' },
]

const ALL_PVP_KEYS: CanalKey[] = ['pvp_uber', 'pvp_glovo', 'pvp_je', 'pvp_web', 'pvp_directa']

function colorAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function norm(v: number): number { return v > 1 ? v / 100 : v }

interface Waterfall {
  costePlatR: number; costeEstrR: number; costeTotalR: number; margenR: number; margenPctR: number; ivaRepercutido: number
  costePlatC: number; costeEstrC: number; costeTotalC: number; margenC: number; margenPctC: number; ivaSoportado: number
  pvpRecR: number; pvpRecC: number; factorK: number
}

function computeWaterfall(costeMP: number, pvp: number, comision: number, estructura: number, margenDeseado: number): Waterfall {
  const costePlatR = pvp * comision * 1.21
  const ingresoNetoR = pvp - costePlatR
  const costeEstrR = ingresoNetoR * estructura
  const costeTotalR = costeMP + costePlatR + costeEstrR
  const margenR = pvp - costeTotalR
  const margenPctR = pvp > 0 ? (margenR / pvp) * 100 : 0
  const ivaRepercutido = pvp > 0 ? (ingresoNetoR / 1.10) * 0.10 : 0

  const costePlatC = pvp * comision
  const ingresoNetoC = pvp - costePlatC
  const costeEstrC = ingresoNetoC * estructura
  const costeTotalC = costeMP + costePlatC + costeEstrC
  const margenC = pvp - costeTotalC
  const margenPctC = pvp > 0 ? (margenC / pvp) * 100 : 0
  const ivaSoportado = pvp * comision * 0.21

  const denomR = 1 - comision * 1.21 - estructura - margenDeseado
  const denomC = 1 - comision - estructura - margenDeseado
  const pvpRecR = denomR > 0 ? costeMP / denomR : 0
  const pvpRecC = denomC > 0 ? costeMP / denomC : 0
  const factorK = pvp > 0 && costeMP > 0 ? pvp / costeMP : 0

  return { costePlatR, costeEstrR, costeTotalR, margenR, margenPctR, ivaRepercutido, costePlatC, costeEstrC, costeTotalC, margenC, margenPctC, ivaSoportado, pvpRecR, pvpRecC, factorK }
}

export default function ModalReceta({ receta, initialNombre, ingredientes, epsList, onClose, onSaved, onDelete }: Props) {
  const cfg = useConfig()
  const todayISO = new Date().toISOString().split('T')[0]

  const [nombre, setNombre] = useState(receta?.nombre ?? initialNombre ?? '')
  const [categoria, setCategoria] = useState(receta?.categoria ?? '')
  const [raciones, setRaciones] = useState(receta?.raciones ?? 1)
  const [tamanoRac, setTamanoRac] = useState(receta?.tamano_rac ?? 0)
  const [unidad, setUnidad] = useState(receta?.unidad ?? 'Ración')
  const [fecha, setFecha] = useState(receta?.fecha ?? todayISO)
  const [fechaOriginal] = useState(receta?.fecha ?? todayISO)
  const [isDirty, setIsDirty] = useState(false)
  const [categorias, setCategorias] = useState<string[]>([])

  const [showDictar, setShowDictar] = useState(false)
  const [textoDictado, setTextoDictado] = useState('')
  const [loadingDictado, setLoadingDictado] = useState(false)
  const [conflictos, setConflictos] = useState<ConflictoItem[]>([])
  const [showConflictos, setShowConflictos] = useState(false)
  const [showModalCrearIng, setShowModalCrearIng] = useState<ConflictoItem | null>(null)
  const [showModalCrearEps, setShowModalCrearEps] = useState<ConflictoItem | null>(null)

  const [pvpCanal, setPvpCanal] = useState<Record<CanalKey, number>>(() => {
    const init = {} as Record<CanalKey, number>
    ALL_PVP_KEYS.forEach(k => { init[k] = n((receta as unknown as Record<string, number | null | undefined>)?.[k]) || 0 })
    return init
  })
  const didAutofillRef = useRef(false)
  const didTaperRef = useRef(false)

  const [canalesActivos, setCanalesActivos] = useState<string[]>(['uber', 'glovo', 'je'])
  const [lineas, setLineas] = useState<RecetaLinea[]>(
    receta ? [] : [{ linea: 1, tipo: 'ING', ingrediente_nombre: '', ingrediente_id: null, eps_id: null, cantidad: 1, unidad: 'Ud.', eur_ud_neta: 0 }]
  )
  const [saving, setSaving] = useState(false)
  const [loadingLineas, setLoadingLineas] = useState(!!receta)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleEliminar = async () => {
    if (!receta) return
    setDeleting(true)
    try {
      await supabase.from('recetas_lineas').delete().eq('receta_id', receta.id)
      await supabase.from('recetas').delete().eq('id', receta.id)
      onClose()
      ;(onDelete ?? onSaved)()
    } finally { setDeleting(false) }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.from('configuracion').select('valor').eq('clave', 'categorias_recetas').single()
        if (!cancelled && data?.valor) {
          const cats = JSON.parse(data.valor)
          setCategorias(Array.isArray(cats) ? cats : [])
        }
      } catch (e) { console.warn('Error cargando categorías:', e) }
    })()
    return () => { cancelled = true }
  }, [])

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

  // Táper por defecto como 1ª línea en receta nueva
  useEffect(() => {
    if (receta) return
    if (didTaperRef.current) return
    const taper = ingredientes.find(i => i.nombre === 'Tapper 1000 ml_ENV') || ingredientes.find(i => /_ENV$/.test(i.nombre ?? ''))
    if (!taper) return
    didTaperRef.current = true
    setLineas(prev => {
      if (prev.some(l => l.tipo === 'ENV')) return prev
      const taperLine: RecetaLinea = { linea: 1, tipo: 'ENV', ingrediente_nombre: taper.nombre, ingrediente_id: taper.id, eps_id: null, cantidad: 1, unidad: 'ud.', eur_ud_neta: n(taper.eur_min) || n(taper.eur_std) }
      return [taperLine, ...prev.filter(l => l.ingrediente_nombre !== '')]
    })
  }, [ingredientes, receta])

  useEffect(() => {
    if (showConflictos && conflictos.length === 0) {
      const t = setTimeout(() => setShowConflictos(false), 300)
      return () => clearTimeout(t)
    }
  }, [conflictos, showConflictos])

  const lineasCalc = useMemo(() => {
    const items = lineas.map(l => ({ ...l, eur_total: l.cantidad * l.eur_ud_neta }))
    const total = items.reduce((s, i) => s + i.eur_total, 0)
    return items.map(i => ({ ...i, pct_total: total > 0 ? i.eur_total / total : 0 }))
  }, [lineas])

  const costeTanda = useMemo(() => lineasCalc.reduce((s, l) => s + l.eur_total, 0), [lineasCalc])
  const costeMP = raciones > 0 ? costeTanda / raciones : 0

  const pesoTanda = useMemo(() => lineas.reduce((s, l) => {
    const u = (l.unidad || '').toLowerCase()
    if (u.startsWith('kg') || u.startsWith('l')) return s + l.cantidad * 1000
    if (u.startsWith('g') || u.startsWith('ml')) return s + l.cantidad
    return s
  }, 0), [lineas])
  const onRacionesChange = (v: number) => { setIsDirty(true); setRaciones(v); if (pesoTanda > 0 && v > 0) setTamanoRac(Math.round((pesoTanda / v) * 100) / 100) }
  const onTamanoChange = (v: number) => { setIsDirty(true); setTamanoRac(v); if (pesoTanda > 0 && v > 0) setRaciones(Math.max(1, Math.round(pesoTanda / v))) }

  // Autocompletar PVP real de cada canal con su PVP recomendado (solo una vez, si está vacío)
  useEffect(() => {
    if (didAutofillRef.current) return
    if (loadingLineas || costeMP <= 0) return
    if (!cfg.canales || cfg.canales.length === 0) return
    const estructura = norm(cfg.estructura_pct ?? 20)
    setPvpCanal(prev => {
      const next = { ...prev }
      let changed = false
      for (const ch of CHANNELS) {
        if ((next[ch.pvpKey] || 0) > 0) continue
        const cfgCanal = cfg.canales.find(c => c.canal === ch.canalName)
        const comision = norm(cfgCanal?.comision_pct ?? 0)
        const margenDeseado = norm(cfgCanal?.margen_deseado_pct ?? cfg.margen_deseado_pct ?? 0)
        const rec = computeWaterfall(costeMP, 0, comision, estructura, margenDeseado).pvpRecR
        if (rec > 0) { next[ch.pvpKey] = Math.round(rec * 100) / 100; changed = true }
      }
      return changed ? next : prev
    })
    didAutofillRef.current = true
  }, [loadingLineas, costeMP, cfg])

  const updateLinea = useCallback((idx: number, patch: Partial<RecetaLinea>) => {
    setIsDirty(true)
    setLineas(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }, [])
  const addLinea = () => { setIsDirty(true); setLineas(prev => [...prev, { linea: prev.length + 1, tipo: 'ING', ingrediente_nombre: '', ingrediente_id: null, eps_id: null, cantidad: 0, unidad: 'gr.', eur_ud_neta: 0 }]) }
  const changeTipo = (idx: number, tipo: 'ING' | 'EPS' | 'ENV') => updateLinea(idx, { tipo, ingrediente_nombre: '', ingrediente_id: null, eps_id: null, eur_ud_neta: 0, unidad: tipo === 'ENV' ? 'ud.' : 'gr.' })
  const envases = useMemo(() => ingredientes.filter(i => /_ENV$/.test(i.nombre ?? '')), [ingredientes])
  const masBaratos = useMemo(() => {
    const cnt: Record<string, number> = {}
    const best: Record<string, { id: string; precio: number }> = {}
    for (const i of ingredientes) {
      const baseKey = ((i.nombre_base || i.nombre || '') as string).toLowerCase().trim()
      if (!baseKey) continue
      cnt[baseKey] = (cnt[baseKey] || 0) + 1
      const precio = n(i.eur_min) || n(i.eur_std) || Infinity
      if (!best[baseKey] || precio < best[baseKey].precio) best[baseKey] = { id: i.id, precio }
    }
    const set = new Set<string>()
    for (const k in best) if (cnt[k] > 1) set.add(best[k].id)
    return set
  }, [ingredientes])
  const selectItem = (idx: number, val: string) => {
    const l = lineas[idx]
    if (l.tipo === 'ING' || l.tipo === 'ENV') {
      const ing = ingredientes.find(i => i.nombre === val)
      if (ing) updateLinea(idx, { ingrediente_nombre: ing.nombre, ingrediente_id: ing.id, eps_id: null, eur_ud_neta: n(ing.eur_min) || n(ing.eur_std), unidad: ing.ud_min ?? ing.ud_std ?? (l.tipo === 'ENV' ? 'ud.' : 'gr.') })
      else updateLinea(idx, { ingrediente_nombre: val, ingrediente_id: null, eps_id: null })
    } else {
      const ep = epsList.find(e => e.nombre === val)
      if (ep) updateLinea(idx, { ingrediente_nombre: ep.nombre, eps_id: ep.id, ingrediente_id: null, eur_ud_neta: n(ep.coste_rac), unidad: ep.unidad ?? 'Ración' })
      else updateLinea(idx, { ingrediente_nombre: val, eps_id: null, ingrediente_id: null })
    }
  }

  async function procesarDictado() {
    if (!textoDictado.trim()) return
    setLoadingDictado(true)
    try {
      let parsed: Array<{ nombre: string; cantidad: number; unidad: string }> = []
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
      if (!apiKey) { alert('La IA de dictado no esta activa. Anade las lineas a mano.'); setLoadingDictado(false); setShowDictar(false); return }
      if (apiKey) {
        try {
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001', max_tokens: 512,
              system: 'Eres un parser de ingredientes de cocina. Recibes texto libre en español con ingredientes y cantidades. Devuelve SOLO un JSON array sin markdown, sin explicación, sin backticks. Formato exacto: [{"nombre":"string","cantidad":number,"unidad":"string"}] Normaliza unidades: gramos→"g", mililitros→"ml", unidades→"ud", litros→"l", kilos→"kg". Si no hay unidad clara, usa "ud".',
              messages: [{ role: 'user', content: textoDictado }],
            }),
          })
          const data = await resp.json()
          const text: string = data.content?.[0]?.text ?? '[]'
          try { parsed = JSON.parse(text) } catch { parsed = [] }
        } catch { parsed = [] }
      }
      const lineasNuevas: RecetaLinea[] = []
      const noEncontrados: ConflictoItem[] = []
      for (const item of parsed) {
        const matchIng = ingredientes.find(i => i.nombre.toLowerCase().includes(item.nombre.toLowerCase()) || item.nombre.toLowerCase().includes(i.nombre.toLowerCase()))
        const matchEps = epsList.find(e => e.nombre.toLowerCase().includes(item.nombre.toLowerCase()) || item.nombre.toLowerCase().includes(e.nombre.toLowerCase()))
        if (matchIng) { lineasNuevas.push({ linea: 0, tipo: 'ING', ingrediente_id: matchIng.id, eps_id: null, ingrediente_nombre: matchIng.nombre, cantidad: item.cantidad, unidad: item.unidad, eur_ud_neta: n(matchIng.eur_min) || n(matchIng.eur_std) }) }
        else if (matchEps) { lineasNuevas.push({ linea: 0, tipo: 'EPS', ingrediente_id: null, eps_id: matchEps.id, ingrediente_nombre: matchEps.nombre, cantidad: item.cantidad, unidad: item.unidad, eur_ud_neta: n(matchEps.coste_rac) }) }
        else { noEncontrados.push(item) }
      }
      if (lineasNuevas.length > 0) { setIsDirty(true); setLineas(prev => [...prev, ...lineasNuevas]) }
      if (noEncontrados.length > 0) { setConflictos(noEncontrados); setShowConflictos(true) }
    } finally { setLoadingDictado(false); setShowDictar(false); setTextoDictado('') }
  }

  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      let rid = receta?.id
      const pvpRecord: Record<CanalKey, number> = { pvp_uber: pvpCanal.pvp_uber, pvp_glovo: pvpCanal.pvp_glovo, pvp_je: pvpCanal.pvp_je, pvp_web: pvpCanal.pvp_web, pvp_directa: pvpCanal.pvp_directa }
      const record = { nombre, categoria: categoria || null, raciones, tamano_rac: tamanoRac || null, unidad: unidad || null, fecha: isDirty ? todayISO : (fechaOriginal || null), coste_tanda: costeTanda, coste_rac: costeMP, ...pvpRecord }
      if (rid) { const { error } = await supabase.from('recetas').update(record).eq('id', rid); if (error) throw error }
      else { const { data, error } = await supabase.from('recetas').insert(record).select('id').single(); if (error) throw error; rid = data.id }
      await supabase.from('recetas_lineas').delete().eq('receta_id', rid)
      if (lineasCalc.length > 0) {
        const rows = lineasCalc.map((l, i) => ({ receta_id: rid, linea: i + 1, tipo: l.tipo, ingrediente_nombre: l.ingrediente_nombre, ingrediente_id: l.ingrediente_id, eps_id: l.eps_id, cantidad: l.cantidad, unidad: l.unidad, eur_ud_neta: l.eur_ud_neta }))
        const { error } = await supabase.from('recetas_lineas').insert(rows); if (error) throw error
      }
      onSaved()
    } catch (e: any) { alert('Error: ' + (e.message || 'Error desconocido')) }
    finally { setSaving(false) }
  }

  const channelData = canalesActivos.map(cid => {
    const ch = CHANNELS.find(c => c.id === cid)!
    const cfgCanal = cfg.canales.find(c => c.canal === ch.canalName)
    const comision = norm(cfgCanal?.comision_pct ?? 0)
    const estructura = norm(cfg.estructura_pct ?? 20)
    const margenDeseado = norm(cfgCanal?.margen_deseado_pct ?? cfg.margen_deseado_pct ?? 0)
    const w = computeWaterfall(costeMP, pvpCanal[ch.pvpKey] || 0, comision, estructura, margenDeseado)
    return { ch, comision, margenDeseado, w }
  })

  const getSemaforoColor = (margenEur: number, margenPct: number, margenDeseado: number): string => { if (margenEur < 0) return '#ff6b70'; if ((margenPct / 100) < margenDeseado) return '#f5a623'; return '#06C167' }
  const pvpRef = useRef<HTMLInputElement>(null)
  const btnSaveStyle: CSSProperties = { backgroundColor: 'var(--sl-btn-save-bg)', color: 'var(--sl-btn-save-text)', fontFamily: 'Oswald, sans-serif', letterSpacing: '1px', padding: '9px 24px', borderRadius: '5px', border: 'none', cursor: 'pointer', minHeight: '40px' }
  const btnCancelStyle: CSSProperties = { backgroundColor: 'var(--sl-btn-cancel-bg)', color: 'var(--sl-btn-cancel-text)', border: '1px solid var(--sl-btn-cancel-border)', fontFamily: 'Oswald, sans-serif', letterSpacing: '1px', padding: '9px 24px', borderRadius: '5px', cursor: 'pointer', minHeight: '40px' }
  const metricaCellStyle: CSSProperties = { width: '130px', padding: '8px 12px', textAlign: 'left', fontFamily: 'Oswald, sans-serif', color: 'var(--sl-text-muted)', fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase' }
  const channelBorderStyle = (chIdx: number, isRealCol: boolean): CSSProperties => { if (chIdx === 0 || !isRealCol) return {}; const color = channelData[chIdx].ch.color; return { borderLeft: `2px solid ${colorAlpha(color, 0.4)}` } }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
      <div className="relative bg-[var(--sl-card)] border-[3px] border-[#140f08] rounded-none w-full max-w-7xl my-8 shadow-[4px_4px_0_#140f08]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sl-border)]">
          <div>
            <h3 className="text-base font-semibold text-[var(--sl-text-primary)]" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{receta ? 'Editar Receta' : 'Nueva Receta'}</h3>
            {receta?.codigo && <p className="text-xs text-[var(--sl-text-muted)] mt-0.5 font-mono">{receta.codigo}</p>}
          </div>
          <button onClick={onClose} className="text-[var(--sl-text-muted)] hover:text-[var(--sl-text-primary)] transition text-lg leading-none">×</button>
        </div>
        <div className="p-5 space-y-5">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 160px' }}><label style={labelStyle()}>Categoría</label><select style={inputStyle} value={categoria} onChange={e => { setIsDirty(true); setCategoria(e.target.value) }}><option value="">Sin categoría</option>{categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
            <div style={{ flex: 1 }}><label style={labelStyle()}>Nombre</label><input style={inputStyle} value={nombre} onChange={e => { setIsDirty(true); setNombre(e.target.value) }} placeholder="Ej: Smash Burger" /></div>
            <div style={{ flex: '0 0 80px' }}><label style={labelStyle()}>Raciones</label><input type="number" min={1} step="1" style={inputStyle} value={raciones || ''} onChange={e => onRacionesChange(parseFloat(e.target.value) || 1)} /></div>
            <div style={{ flex: '0 0 80px' }}><label style={labelStyle()}>Tamaño rac</label><input type="number" min={0} step="any" style={inputStyle} value={tamanoRac || ''} onChange={e => onTamanoChange(parseFloat(e.target.value) || 0)} /></div>
            <div style={{ flex: '0 0 90px' }}><label style={labelStyle()}>Unidad</label><select style={inputStyle} value={unidad} onChange={e => { setIsDirty(true); setUnidad(e.target.value) }}>{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
            <div style={{ flex: '0 0 140px' }}><label style={labelStyle()}>Fecha</label><input type="date" style={inputStyle} value={fecha ?? ''} onChange={e => { setIsDirty(true); setFecha(e.target.value) }} /></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-[var(--sl-text-secondary)] uppercase tracking-wider">Líneas</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={addLinea} className="text-xs font-semibold hover:brightness-110 transition px-3 py-1 rounded-md" style={{ backgroundColor: 'var(--sl-btn-add-alt-bg)', color: 'var(--sl-btn-add-alt-text)' }}>+ Añadir línea</button>
                <button onClick={() => setShowDictar(true)} style={{ background: 'none', color: 'var(--sl-text-secondary)', border: '0.5px solid var(--sl-border)', borderRadius: 6, padding: '5px 12px', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', cursor: 'pointer' }}>⚡ DICTAR</button>
              </div>
            </div>
            {showDictar && (
              <div style={{ padding: 14, background: 'var(--sl-app)', border: '0.5px solid var(--sl-border)', borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-secondary)', marginBottom: 8 }}>Escribe o dicta ingredientes y/o EPS en lenguaje libre:</div>
                <textarea value={textoDictado} onChange={e => setTextoDictado(e.target.value)} placeholder="Ej: 200g tomate frito, 3 dientes ajo, 50ml aceite oliva..." style={{ background: 'var(--sl-input-edit)', border: '1px solid var(--sl-border)', color: 'var(--sl-text-primary)', fontFamily: 'Lexend, sans-serif', fontSize: 13, borderRadius: 8, padding: 10, width: '100%', boxSizing: 'border-box', height: 80, resize: 'none', outline: 'none' }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={procesarDictado} disabled={loadingDictado} style={{ background: '#B01D23', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', cursor: 'pointer', flex: 1, opacity: loadingDictado ? 0.6 : 1 }}>{loadingDictado ? 'PROCESANDO…' : 'PROCESAR'}</button>
                  <button onClick={() => { setShowDictar(false); setTextoDictado('') }} style={{ background: 'none', color: 'var(--sl-text-secondary)', border: '0.5px solid var(--sl-border)', borderRadius: 6, padding: '7px 12px', fontFamily: 'Oswald, sans-serif', fontSize: 10, cursor: 'pointer' }}>CANCELAR</button>
                </div>
              </div>
            )}
            {loadingLineas ? (
              <div className="flex justify-center py-8"><div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="border border-[var(--sl-border)] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: '900px' }}>
                    <thead><tr><th className={thCls + ' w-10'}>#</th><th className={thCls + ' w-20'}>Tipo</th><th className={thCls}>Nombre</th><th className={thCls + ' w-24 text-right'}>Cantidad</th><th className={thCls + ' w-20'}>Unidad</th><th className={thCls + ' w-28 text-right'}>€/ud neta</th><th className={thCls + ' w-24 text-right'}>€ total</th><th className={thCls + ' w-16 text-right'}>% total</th></tr></thead>
                    <tbody>
                      {!lineasCalc.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-[var(--sl-text-muted)] text-sm">Sin líneas</td></tr>}
                      {lineasCalc.map((l, idx) => {
                        const nameColor = l.tipo === 'EPS' ? 'var(--sl-eps)' : 'var(--sl-text-primary)'
                        return (
                          <tr key={idx}>
                            <td className={tdCls + ' text-[var(--sl-text-muted)]'}>{idx + 1}</td>
                            <td className={tdCls}><select className="w-full bg-transparent border-none outline-none text-sm" style={{ color: nameColor, fontWeight: 600 }} value={l.tipo} onChange={e => changeTipo(idx, e.target.value as 'ING' | 'EPS' | 'ENV')}><option value="ING">ING</option><option value="EPS">EPS</option><option value="ENV">ENV</option></select></td>
                            <td className={tdCls}><BuscadorItem value={l.ingrediente_nombre} opciones={l.tipo === 'ING' ? ingredientes.map(i => ({ id: i.id, nombre: i.nombre, barato: masBaratos.has(i.id) })) : l.tipo === 'ENV' ? envases.map(i => ({ id: i.id, nombre: i.nombre, tag: 'ENV' })) : epsList.map(e => ({ id: e.id, nombre: e.nombre, tag: 'EPS' }))} onSelect={v => selectItem(idx, v)} placeholder={l.tipo === 'ING' ? 'Ingrediente...' : l.tipo === 'ENV' ? 'Envase...' : 'EPS...'} inputClassName="w-full bg-transparent border-none outline-none text-sm placeholder:text-[var(--sl-text-muted)]" inputStyle={{ color: nameColor }} /></td>
                            <td className={tdCls + ' text-right'}><input type="number" min={0} step="any" className="w-full bg-transparent border-none outline-none text-sm text-[var(--sl-text-primary)] text-right" value={l.cantidad || ''} onChange={e => updateLinea(idx, { cantidad: parseFloat(e.target.value) || 0 })} /></td>
                            <td className={tdCls}><select className="w-full bg-transparent border-none outline-none text-sm text-[var(--sl-text-primary)]" value={l.unidad} onChange={e => updateLinea(idx, { unidad: e.target.value })}>{cfg.unidades.map(u => <option key={u} value={u}>{u}</option>)}</select></td>
                            <td className={tdCls + ' text-right'}><input type="number" min={0} step="0.0001" className="w-full bg-transparent border-none outline-none text-sm text-[var(--sl-text-primary)] text-right" value={l.eur_ud_neta || ''} onChange={e => updateLinea(idx, { eur_ud_neta: parseFloat(e.target.value) || 0 })} /></td>
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
                    <div><span className="text-[10px] text-[var(--sl-text-muted)] uppercase tracking-wide block">Coste MP / ración</span><span className="text-base font-bold text-[var(--sl-text-primary)]">{fmtNum(costeMP)}</span></div>
                  </div>
                  <span className="text-xs text-[var(--sl-text-muted)]">{raciones} raciones</span>
                </div>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-[var(--sl-text-secondary)] uppercase tracking-wider mb-3">Waterfall pricing por canal</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {CHANNELS.map(ch => {
                const isActive = canalesActivos.includes(ch.id)
                return (<button key={ch.id} onClick={() => setCanalesActivos(p => isActive ? p.filter(x => x !== ch.id) : [...p, ch.id])} style={{ backgroundColor: ch.color, color: ch.fg, fontFamily: 'Oswald, sans-serif', letterSpacing: '1px', opacity: isActive ? 1 : 0.35 }} className="text-xs font-medium px-3 py-1.5 rounded transition uppercase">{ch.label}</button>)
              })}
            </div>
            {canalesActivos.length === 0 ? (
              <div className="text-center py-8 text-[var(--sl-text-muted)]">Selecciona al menos un canal</div>
            ) : (
              <div className="border border-[var(--sl-border)] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--sl-thead)' }}>
                        <th style={{ ...metricaCellStyle, padding: '10px 12px' }}>MÉTRICA</th>
                        {channelData.map((d, idx) => (<th key={d.ch.id} colSpan={2} style={{ padding: '10px 10px', textAlign: 'center', fontFamily: 'Oswald, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', color: d.ch.color, textTransform: 'uppercase', ...channelBorderStyle(idx, true) }}>{d.ch.label}</th>))}
                      </tr>
                      <tr style={{ backgroundColor: 'var(--sl-thead)' }}>
                        <th />
                        {channelData.map((d, idx) => (<><th key={`${d.ch.id}-hr`} style={{ padding: '4px 10px', textAlign: 'right', fontSize: '9px', fontFamily: 'Oswald, sans-serif', color: 'var(--sl-text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', ...channelBorderStyle(idx, true) }}>real</th><th key={`${d.ch.id}-hc`} style={{ padding: '4px 10px', textAlign: 'right', fontSize: '9px', fontFamily: 'Oswald, sans-serif', color: 'var(--sl-text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>cash</th></>))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ backgroundColor: 'var(--sl-card-alt)' }}><td style={metricaCellStyle}>Coste MP</td>{channelData.map((d, idx) => (<><td key={`${d.ch.id}-mp-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: 'var(--sl-text-primary)', ...channelBorderStyle(idx, true) }}>{fmtEur(costeMP)}</td><td key={`${d.ch.id}-mp-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: 'var(--sl-text-muted)' }}>{fmtEur(costeMP)}</td></>))}</tr>
                      <tr style={{ backgroundColor: 'var(--sl-card-alt)' }}><td style={metricaCellStyle}>Coste plataforma</td>{channelData.map((d, idx) => (<><td key={`${d.ch.id}-pl-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: 'var(--sl-text-primary)', ...channelBorderStyle(idx, true) }}>{fmtEur(d.w.costePlatR)}</td><td key={`${d.ch.id}-pl-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: 'var(--sl-text-muted)' }}>{fmtEur(d.w.costePlatC)}</td></>))}</tr>
                      <tr style={{ backgroundColor: 'var(--sl-card-alt)' }}><td style={metricaCellStyle}>Coste estructura</td>{channelData.map((d, idx) => (<><td key={`${d.ch.id}-es-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: 'var(--sl-text-primary)', ...channelBorderStyle(idx, true) }}>{fmtEur(d.w.costeEstrR)}</td><td key={`${d.ch.id}-es-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: 'var(--sl-text-muted)' }}>{fmtEur(d.w.costeEstrC)}</td></>))}</tr>
                      <tr style={{ backgroundColor: 'var(--sl-card-alt)', borderTop: '2px solid var(--sl-border-strong)', borderBottom: '2px solid var(--sl-border-strong)' }}><td style={{ ...metricaCellStyle, fontWeight: 700, color: 'var(--sl-text-primary)' }}>Coste total</td>{channelData.map((d, idx) => (<><td key={`${d.ch.id}-tot-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '13px', fontWeight: 700, color: 'var(--sl-text-primary)', ...channelBorderStyle(idx, true) }}>{fmtEur(d.w.costeTotalR)}</td><td key={`${d.ch.id}-tot-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '13px', fontWeight: 700, color: 'var(--sl-text-muted)' }}>{fmtEur(d.w.costeTotalC)}</td></>))}</tr>
                    </tbody>
                    <tbody>
                      <tr style={{ backgroundColor: 'var(--sl-card)', borderTop: '2px solid var(--sl-border-strong)' }}><td style={metricaCellStyle}>Margen deseado</td>{channelData.map((d, idx) => (<><td key={`${d.ch.id}-md-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '11px', color: 'var(--sl-text-muted)', ...channelBorderStyle(idx, true) }}>{fmtPct(d.margenDeseado)}</td><td key={`${d.ch.id}-md-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '11px', color: 'var(--sl-text-muted)' }}>{fmtPct(d.margenDeseado)}</td></>))}</tr>
                      <tr style={{ backgroundColor: 'var(--sl-card)' }}><td style={metricaCellStyle}>PVP recomendado</td>{channelData.map((d, idx) => (<><td key={`${d.ch.id}-pr-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '12px', fontWeight: 500, color: 'var(--sl-text-primary)', ...channelBorderStyle(idx, true) }}>{fmtEur(d.w.pvpRecR)}</td><td key={`${d.ch.id}-pr-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '12px', fontWeight: 500, color: 'var(--sl-text-muted)' }}>{fmtEur(d.w.pvpRecC)}</td></>))}</tr>
                      <tr style={{ backgroundColor: 'var(--sl-card)' }}><td style={metricaCellStyle}>PVP real</td>{channelData.map((d, idx) => (<td key={`${d.ch.id}-pvp`} colSpan={2} style={{ padding: '6px 8px', ...channelBorderStyle(idx, true) }}><input ref={idx === 0 ? pvpRef : undefined} type="number" min={0} step="0.01" value={(pvpCanal[d.ch.pvpKey] || 0) > 0 ? pvpCanal[d.ch.pvpKey] : ''} onChange={e => { setIsDirty(true); const v = parseFloat(e.target.value) || 0; setPvpCanal(prev => ({ ...prev, [d.ch.pvpKey]: v })) }} placeholder="—" style={{ width: '100%', padding: '4px 8px', fontFamily: 'Oswald, sans-serif', fontSize: '14px', fontWeight: 700, textAlign: 'center', color: '#2a52a0', background: 'transparent', border: 'none', outline: 'none' }} /></td>))}</tr>
                    </tbody>
                    <tbody>
                      <tr style={{ borderTop: '2px solid var(--sl-border-strong)' }}><td style={metricaCellStyle}>Factor K</td>{channelData.map((d, idx) => (<td key={`${d.ch.id}-k`} colSpan={2} style={{ padding: '8px 10px', textAlign: 'center', fontFamily: 'Oswald, sans-serif', fontSize: '12px', fontWeight: 700, color: getSemaforoColor(d.w.margenR, d.w.margenPctR, d.margenDeseado), ...channelBorderStyle(idx, true) }}>{fmtNum(d.w.factorK)}</td>))}</tr>
                      <tr><td style={metricaCellStyle}>Margen €</td>{channelData.map((d, idx) => (<><td key={`${d.ch.id}-mg-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '12px', fontWeight: 600, color: 'var(--sl-text-primary)', ...channelBorderStyle(idx, true) }}>{fmtEur(d.w.margenR)}</td><td key={`${d.ch.id}-mg-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '12px', fontWeight: 600, color: 'var(--sl-text-muted)' }}>{fmtEur(d.w.margenC)}</td></>))}</tr>
                      <tr><td style={metricaCellStyle}>% Margen</td>{channelData.map((d, idx) => (<><td key={`${d.ch.id}-pct-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '13px', fontWeight: 700, color: getSemaforoColor(d.w.margenR, d.w.margenPctR, d.margenDeseado), ...channelBorderStyle(idx, true) }}>{fmtPct(d.w.margenPctR / 100)}</td><td key={`${d.ch.id}-pct-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: '13px', fontWeight: 700, color: getSemaforoColor(d.w.margenC, d.w.margenPctC, d.margenDeseado) }}>{fmtPct(d.w.margenPctC / 100)}</td></>))}</tr>
                    </tbody>
                    <tbody>
                      <tr style={{ backgroundColor: 'var(--sl-card-alt)' }}><td style={metricaCellStyle}>IVA repercutido</td>{channelData.map((d, idx) => (<><td key={`${d.ch.id}-ivr-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '11px', color: 'var(--sl-text-muted)', ...channelBorderStyle(idx, true) }}>{fmtEur(d.w.ivaRepercutido)}</td><td key={`${d.ch.id}-ivr-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '11px', color: 'var(--sl-text-muted)' }}>{fmtEur(d.w.ivaRepercutido)}</td></>))}</tr>
                      <tr style={{ backgroundColor: 'var(--sl-card-alt)' }}><td style={metricaCellStyle}>IVA soportado</td>{channelData.map((d, idx) => (<><td key={`${d.ch.id}-ivs-r`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '11px', color: 'var(--sl-text-muted)', ...channelBorderStyle(idx, true) }}>{d.comision === 0 ? '—' : fmtEur(d.w.ivaSoportado)}</td><td key={`${d.ch.id}-ivs-c`} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: '11px', color: 'var(--sl-text-muted)' }}>{d.comision === 0 ? '—' : fmtEur(d.w.ivaSoportado)}</td></>))}</tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[var(--sl-border)]">
          <div className="flex items-center gap-2">
            {receta && !confirmEliminar && (<button onClick={() => setConfirmEliminar(true)} style={{ background: 'transparent', border: '1px solid #B01D23', color: '#B01D23', padding: '10px 16px', borderRadius: '5px', fontFamily: 'Oswald, sans-serif', fontSize: '.78rem', letterSpacing: '1px', cursor: 'pointer', minHeight: '44px' }}>ELIMINAR</button>)}
            {receta && confirmEliminar && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#B01D23', fontFamily: 'Lexend, sans-serif' }}>¿Eliminar definitivamente?</span>
                <button onClick={handleEliminar} disabled={deleting} style={{ background: '#B01D23', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Oswald, sans-serif', fontSize: '.7rem', opacity: deleting ? 0.5 : 1 }}>{deleting ? 'ELIMINANDO…' : 'SÍ, ELIMINAR'}</button>
                <button onClick={() => setConfirmEliminar(false)} style={{ background: 'transparent', border: '1px solid var(--sl-btn-cancel-border)', color: 'var(--sl-btn-cancel-text)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Oswald, sans-serif', fontSize: '.7rem' }}>CANCELAR</button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} style={btnCancelStyle}>CANCELAR</button>
            <button onClick={handleSave} disabled={saving || !nombre.trim()} style={{ ...btnSaveStyle, opacity: (saving || !nombre.trim()) ? 0.5 : 1 }}>{saving ? 'GUARDANDO…' : 'GUARDAR'}</button>
          </div>
        </div>
        {showConflictos && conflictos.length > 0 && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, borderRadius: 16 }}>
            <div style={{ background: 'var(--sl-card)', border: '0.5px solid var(--sl-border)', borderRadius: 12, padding: 20, width: '90%', maxWidth: 460, maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', marginBottom: 12 }}>INGREDIENTES / EPS NO ENCONTRADOS</div>
              {conflictos.map((item, idx) => (
                <div key={idx} style={{ background: 'var(--sl-card-alt)', border: '0.5px solid var(--sl-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ background: '#f5a62322', color: '#f5a623', padding: '2px 8px', borderRadius: 99, fontFamily: 'Oswald, sans-serif', fontSize: 10 }}>⚠ NO ENCONTRADO</span>
                    <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: 'var(--sl-text-primary)', fontWeight: 500 }}>{item.nombre}</span>
                    <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-secondary)' }}>{item.cantidad} {item.unidad}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => { setConflictos(prev => prev.filter((_, i) => i !== idx)); setShowModalCrearIng({ nombre: item.nombre, cantidad: item.cantidad, unidad: item.unidad }) }} style={{ background: '#B01D23', color: '#ffffff', border: 'none', borderRadius: 6, padding: '6px 10px', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ CREAR ING</button>
                    <button onClick={() => { setConflictos(prev => prev.filter((_, i) => i !== idx)); setShowModalCrearEps({ nombre: item.nombre, cantidad: item.cantidad, unidad: item.unidad }) }} style={{ background: 'none', color: '#66aaff', border: '0.5px solid #66aaff', borderRadius: 6, padding: '6px 10px', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ CREAR EPS</button>
                    <select defaultValue="" onChange={e => { if (!e.target.value) return; const [tipo, id] = e.target.value.split('::'); if (tipo === 'ING') { const ing = ingredientes.find(i => i.id === id); if (ing) { setIsDirty(true); setLineas(prev => [...prev, { linea: prev.length + 1, tipo: 'ING', ingrediente_id: ing.id, eps_id: null, ingrediente_nombre: ing.nombre, cantidad: item.cantidad, unidad: item.unidad, eur_ud_neta: n(ing.eur_min) || n(ing.eur_std) }]); setConflictos(prev => prev.filter((_, i) => i !== idx)) } } else if (tipo === 'ENV') { const ing = ingredientes.find(i => i.id === id); if (ing) { setIsDirty(true); setLineas(prev => [...prev, { linea: prev.length + 1, tipo: 'ENV', ingrediente_id: ing.id, eps_id: null, ingrediente_nombre: ing.nombre, cantidad: 1, unidad: 'ud.', eur_ud_neta: n(ing.eur_min) || n(ing.eur_std) }]); setConflictos(prev => prev.filter((_, i) => i !== idx)) } } else { const ep = epsList.find(e => e.id === id); if (ep) { setIsDirty(true); setLineas(prev => [...prev, { linea: prev.length + 1, tipo: 'EPS', ingrediente_id: null, eps_id: ep.id, ingrediente_nombre: ep.nombre, cantidad: item.cantidad, unidad: item.unidad, eur_ud_neta: n(ep.coste_rac) }]); setConflictos(prev => prev.filter((_, i) => i !== idx)) } } }} style={{ background: 'var(--sl-input-edit)', border: '1px solid var(--sl-border)', color: 'var(--sl-text-primary)', fontFamily: 'Lexend, sans-serif', fontSize: 12, borderRadius: 6, padding: '6px 8px', flex: 1, minWidth: 120, cursor: 'pointer' }}>
                      <option value="">Elegir existente...</option>
                      <optgroup label="INGREDIENTES">{ingredientes.filter(i => !/_ENV$/.test(i.nombre ?? '')).map(i => <option key={i.id} value={`ING::${i.id}`}>{i.nombre}</option>)}</optgroup>
                      <optgroup label="EPS">{epsList.map(e => <option key={e.id} value={`EPS::${e.id}`}>{e.nombre}</option>)}</optgroup>
                      <optgroup label="ENVASES">{envases.map(i => <option key={i.id} value={`ENV::${i.id}`}>{i.nombre}</option>)}</optgroup>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    {showModalCrearIng && (<ModalIngrediente ingrediente={null} initialNombre={showModalCrearIng.nombre} onClose={() => setShowModalCrearIng(null)} onSaved={async () => { const itemRef = showModalCrearIng; setShowModalCrearIng(null); if (!itemRef) return; const { data } = await supabase.from('ingredientes').select('*').ilike('nombre_base', `%${itemRef.nombre}%`).order('id', { ascending: false }).limit(1); if (data?.[0]) { const ing = data[0] as Ingrediente; setIsDirty(true); setLineas(prev => [...prev, { linea: prev.length + 1, tipo: 'ING', ingrediente_id: ing.id, eps_id: null, ingrediente_nombre: ing.nombre, cantidad: itemRef.cantidad, unidad: itemRef.unidad, eur_ud_neta: n(ing.eur_min) || n(ing.eur_std) }]) } }} />)}
    {showModalCrearEps && (<ModalEPS eps={null} initialNombre={showModalCrearEps.nombre} ingredientes={ingredientes} onClose={() => setShowModalCrearEps(null)} onSaved={async () => { const itemRef = showModalCrearEps; setShowModalCrearEps(null); if (!itemRef) return; const { data } = await supabase.from('eps').select('*').ilike('nombre', `%${itemRef.nombre}%`).order('id', { ascending: false }).limit(1); if (data?.[0]) { const ep = data[0] as EPS; setIsDirty(true); setLineas(prev => [...prev, { linea: prev.length + 1, tipo: 'EPS', ingrediente_id: null, eps_id: ep.id, ingrediente_nombre: ep.nombre, cantidad: itemRef.cantidad, unidad: itemRef.unidad, eur_ud_neta: n(ep.coste_rac) }]) } }} />)}
    </>
  )
}
