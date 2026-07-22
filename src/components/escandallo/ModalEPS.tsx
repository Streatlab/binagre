import type { CSSProperties } from 'react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente, EPS, EPSLinea } from './types'
import { UNIDADES, n, precioNeto } from './types'
import { fmtNum, fmtEur } from '@/utils/format'
import { INK, AMA, GRANATE, GRIS, NAR, OSW, LEX, BLANCO, NAR_S } from '@/styles/neobrutal'
import ModalIngrediente from './ModalIngrediente'
import MicDictado from './MicDictado'
import BuscadorItem from './BuscadorItem'
import type { BuscadorOpcion } from './BuscadorItem'

const btnSaveStyle: CSSProperties = {
  backgroundColor: AMA,
  color: INK,
  fontFamily: OSW,
  fontWeight: 700,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  padding: '9px 24px',
  borderRadius: '0',
  border: `2px solid ${INK}`,
  boxShadow: `3px 3px 0 ${INK}`,
  cursor: 'pointer',
  minHeight: '40px',
}
const btnCancelStyle: CSSProperties = {
  backgroundColor: BLANCO,
  color: INK,
  border: `2px solid ${INK}`,
  fontFamily: OSW,
  fontWeight: 700,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  padding: '9px 24px',
  borderRadius: '0',
  cursor: 'pointer',
  minHeight: '40px',
}

const inputCls = 'w-full bg-white border-[2px] border-ink rounded-none px-3 py-2 text-sm text-ink placeholder:text-gris focus:outline-none focus:border-azul'
const labelCls = 'block text-[11px] text-ink mb-1 uppercase tracking-wider'
const thCls = 'px-3 py-2 text-left text-[10px] uppercase tracking-wider text-ink font-semibold border-b-[2px] border-ink bg-crema'
const tdCls = 'px-3 py-2 text-sm border-b border-ink/20'

interface ConflictoItem { nombre: string; cantidad: number; unidad: string }

interface Props {
  eps: EPS | null
  initialNombre?: string
  ingredientes: Ingrediente[]
  onClose: () => void
  onSaved: () => void
  onDelete?: () => void
}

export default function ModalEPS({ eps, initialNombre, ingredientes, onClose, onSaved, onDelete }: Props) {
  const todayISO = new Date().toISOString().split('T')[0]

  const [nombre, setNombre] = useState(eps?.nombre ?? initialNombre ?? '')
  const [categoria, setCategoria] = useState((eps as any)?.categoria ?? '')
  const [categorias, setCategorias] = useState<string[]>([])
  const [raciones, setRaciones] = useState(eps?.raciones ?? 1)
  const [tamanoRac, setTamanoRac] = useState(eps?.tamano_rac ?? 0)
  const [unidad, setUnidad] = useState(eps?.unidad ?? 'gr.')
  const [fecha, setFecha] = useState(eps?.fecha ?? todayISO)
  const [fechaOriginal] = useState(eps?.fecha ?? todayISO)
  const [preparacion, setPreparacion] = useState(eps?.preparacion ?? '')
  const [isDirty, setIsDirty] = useState(false)

  // Dictado
  const [showDictar, setShowDictar] = useState(false)
  const [textoDictado, setTextoDictado] = useState('')
  const [loadingDictado, setLoadingDictado] = useState(false)
  const [errDictado, setErrDictado] = useState<string | null>(null)
  const [conflictos, setConflictos] = useState<ConflictoItem[]>([])
  const [showConflictos, setShowConflictos] = useState(false)
  const [showModalCrearIng, setShowModalCrearIng] = useState<ConflictoItem | null>(null)
  const [showModalCrearEps, setShowModalCrearEps] = useState<ConflictoItem | null>(null)

  const [todosIngredientes, setTodosIngredientes] = useState<any[]>([])
  const [todasEps, setTodasEps] = useState<any[]>([])

  const [lineas, setLineas] = useState<EPSLinea[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingLineas, setLoadingLineas] = useState(!!eps)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleEliminar = async () => {
    if (!eps) return
    setDeleting(true)
    try {
      await supabase.from('eps_lineas').delete().eq('eps_id', eps.id)
      await supabase.from('eps').delete().eq('id', eps.id)
      onClose()
      ;(onDelete ?? onSaved)()
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    supabase.from('ingredientes').select('*').then(({ data }) => { if (data) setTodosIngredientes(data) })
    supabase.from('eps').select('id,nombre,coste_rac').then(({ data }) => { if (data) setTodasEps(data) })
    supabase.from('configuracion').select('valor').eq('clave', 'categorias_eps').single()
      .then(({ data }) => {
        if (data?.valor) {
          try { const c = JSON.parse(data.valor); if (Array.isArray(c)) setCategorias(c) } catch { /* noop */ }
        }
      })
  }, [])

  useEffect(() => {
    if (!eps) return
    let cancelled = false
    ;(async () => {
      setLoadingLineas(true)
      const { data, error } = await supabase
        .from('eps_lineas')
        .select('*')
        .eq('eps_id', eps.id)
        .order('linea')
      if (error) console.error('Error cargando eps_lineas:', error)
      if (!cancelled && data) setLineas(data.map((d: any) => ({
        linea: d.linea ?? 0,
        ingrediente_nombre: d.ingrediente_nombre ?? '',
        ingrediente_id: d.ingrediente_id ?? null,
        cantidad: d.cantidad ?? 0,
        unidad: d.unidad ?? 'gr.',
        eur_ud_neta: d.eur_ud_neta ?? 0,
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

  useEffect(() => {
    if (showConflictos && conflictos.length === 0) {
      const t = setTimeout(() => setShowConflictos(false), 300)
      return () => clearTimeout(t)
    }
  }, [conflictos, showConflictos])

  const lineasCalc = useMemo(() => {
    const items = lineas.map(l => ({ ...l, eur_total: l.cantidad * l.eur_ud_neta }))
    const total = items.reduce((s, i) => s + i.eur_total, 0)
    return items.map(i => ({ ...i, pct_total: total > 0 ? (i.eur_total / total) * 100 : 0 }))
  }, [lineas])

  const costeTanda = useMemo(() => lineasCalc.reduce((s, l) => s + l.eur_total, 0), [lineasCalc])
  const costeRac = raciones > 0 ? costeTanda / raciones : 0

  const pesoTanda = useMemo(() => lineas.reduce((s, l) => {
    const u = (l.unidad || '').toLowerCase()
    if (u.startsWith('kg') || u.startsWith('l')) return s + l.cantidad * 1000
    if (u.startsWith('g') || u.startsWith('ml')) return s + l.cantidad
    return s
  }, 0), [lineas])
  const onRacionesChange = (v: number) => { setIsDirty(true); setRaciones(v); if (pesoTanda > 0 && v > 0) setTamanoRac(Math.round((pesoTanda / v) * 100) / 100) }
  const onTamanoChange = (v: number) => { setIsDirty(true); setTamanoRac(v); if (pesoTanda > 0 && v > 0) setRaciones(Math.max(1, Math.round(pesoTanda / v))) }

  const updateLinea = useCallback((idx: number, patch: Partial<EPSLinea>) => {
    setIsDirty(true)
    setLineas(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }, [])

  const addLinea = () => {
    setIsDirty(true)
    setLineas(prev => [...prev, { linea: prev.length + 1, ingrediente_nombre: '', ingrediente_id: null, cantidad: 0, unidad: 'gr.', eur_ud_neta: 0 }])
  }

  const deleteLinea = (idx: number) => {
    setIsDirty(true)
    setLineas(prev => prev.filter((_, i) => i !== idx))
  }

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

  const opcionesLineaEps = useMemo<BuscadorOpcion[]>(() => [
    ...ingredientes.map(i => ({ id: i.id, nombre: i.nombre, barato: masBaratos.has(i.id) })),
    ...todasEps.map((ep: any) => ({ id: 'e' + ep.id, nombre: ep.nombre, tag: 'EPS' })),
  ], [ingredientes, todasEps, masBaratos])

  const selectIngrediente = (idx: number, val: string) => {
    setIsDirty(true)
    const ing = ingredientes.find(i => i.nombre === val)
    if (ing) { updateLinea(idx, {
      ingrediente_nombre: ing.nombre,
      ingrediente_id: ing.id,
      eur_ud_neta: precioNeto(ing),
      unidad: ing.ud_min ?? ing.ud_std ?? 'gr.',
    }); return }
    const ep = todasEps.find((x: any) => x.nombre === val)
    if (ep) { updateLinea(idx, { ingrediente_nombre: ep.nombre, ingrediente_id: null, eur_ud_neta: n(ep.coste_rac), unidad: 'Ración' }); return }
    updateLinea(idx, { ingrediente_nombre: val, ingrediente_id: null })
  }

  async function procesarDictado() {
    if (!textoDictado.trim()) return
    setLoadingDictado(true)
    setErrDictado(null)
    let huboError = false
    try {
      let parsed: Array<{ nombre: string; cantidad: number; unidad: string }> = []
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
      if (!apiKey) { setErrDictado('La IA de dictado no esta activa. Anade las lineas a mano.'); huboError = true; return }
      if (apiKey) {
        try {
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 512,
              system: 'Eres un parser de ingredientes de cocina. Recibes texto libre en español con ingredientes y cantidades. Devuelve SOLO un JSON array sin markdown, sin explicación, sin backticks. Formato exacto: [{"nombre":"string","cantidad":number,"unidad":"string"}] Normaliza unidades: gramos→"g", mililitros→"ml", unidades→"ud", litros→"l", kilos→"kg". Si no hay unidad clara, usa "ud".',
              messages: [{ role: 'user', content: textoDictado }],
            }),
          })
          const data = await resp.json()
          const text: string = data.content?.[0]?.text ?? '[]'
          try { parsed = JSON.parse(text) } catch { parsed = [] }
        } catch { parsed = [] }
      }

      const lineasNuevas: EPSLinea[] = []
      const noEncontrados: ConflictoItem[] = []

      for (const item of parsed) {
        const matchIng = todosIngredientes.find((i: any) =>
          i.nombre?.toLowerCase().includes(item.nombre.toLowerCase()) ||
          item.nombre.toLowerCase().includes(i.nombre?.toLowerCase() ?? '')
        )
        if (matchIng) {
          lineasNuevas.push({ linea: 0, ingrediente_id: matchIng.id, ingrediente_nombre: matchIng.nombre, cantidad: item.cantidad, unidad: item.unidad, eur_ud_neta: precioNeto(matchIng) })
          continue
        }
        const matchEps = todasEps.find((e: any) =>
          e.nombre?.toLowerCase().includes(item.nombre.toLowerCase()) ||
          item.nombre.toLowerCase().includes(e.nombre?.toLowerCase() ?? '')
        )
        if (matchEps) {
          lineasNuevas.push({ linea: 0, ingrediente_id: null, ingrediente_nombre: matchEps.nombre, cantidad: item.cantidad, unidad: item.unidad, eur_ud_neta: n(matchEps.coste_rac) })
          continue
        }
        noEncontrados.push(item)
      }

      if (lineasNuevas.length > 0) {
        setIsDirty(true)
        setLineas(prev => [...prev, ...lineasNuevas])
      }
      if (noEncontrados.length > 0) {
        setConflictos(noEncontrados)
        setShowConflictos(true)
      }
      if (lineasNuevas.length === 0 && noEncontrados.length === 0) {
        setErrDictado('No se reconocio ningun ingrediente. Reformula el texto.')
        huboError = true
      }
    } finally {
      setLoadingDictado(false)
      if (!huboError) { setShowDictar(false); setTextoDictado('') }
    }
  }

  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      let epsId = eps?.id
      const record = {
        nombre,
        categoria: categoria || null,
        raciones,
        tamano_rac: tamanoRac || null,
        coste_tanda: costeTanda,
        coste_rac: costeRac,
        unidad,
        preparacion: preparacion || null,
        fecha: isDirty ? todayISO : (fechaOriginal || null),
      }
      if (epsId) {
        const { error } = await supabase.from('eps').update(record).eq('id', epsId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('eps').insert(record).select('id').single()
        if (error) throw error
        epsId = data.id
      }

      await supabase.from('eps_lineas').delete().eq('eps_id', epsId)
      if (lineasCalc.length > 0) {
        const rows = lineasCalc.map((l, i) => ({
          eps_id: epsId,
          linea: i + 1,
          ingrediente_nombre: l.ingrediente_nombre,
          ingrediente_id: l.ingrediente_id,
          cantidad: l.cantidad,
          unidad: l.unidad,
          eur_ud_neta: l.eur_ud_neta,
        }))
        const { error } = await supabase.from('eps_lineas').insert(rows)
        if (error) throw error
      }
      onSaved()
    } catch (e: any) {
      alert('Error: ' + (e.message || 'Error desconocido'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
        <div className="relative bg-crema border-[4px] border-ink rounded-none w-full max-w-5xl my-8 shadow-[6px_6px_0_var(--color-ink)]" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b-[4px] border-ink bg-ama">
            <div>
              <h3 className="text-ink" style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1, letterSpacing: '-0.5px', textTransform: 'uppercase' }}>{eps ? 'Editar EPS' : 'Nueva EPS'}</h3>
              {eps?.codigo && <p className="text-xs text-gris mt-0.5 font-mono">{eps.codigo} · EPS</p>}
            </div>
            <button onClick={onClose} style={{ background: BLANCO, border: `2px solid ${INK}`, width: 36, height: 36, fontSize: 20, lineHeight: 1, cursor: 'pointer', color: INK, flexShrink: 0 }}>×</button>
          </div>

          <div className="p-5 space-y-5">
            {/* Cabecera: CATEGORÍA | NOMBRE | RAC. | TAM.RAC | UD. | FECHA */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1.5 }}>
                <label className={labelCls} style={{ fontFamily: OSW, letterSpacing: '1px' }}>Categoría</label>
                <select className={inputCls} style={{ fontFamily: LEX }} value={categoria} onChange={e => { setIsDirty(true); setCategoria(e.target.value) }}>
                  <option value="">Sin categoría</option>
                  {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div style={{ flex: 3 }}>
                <label className={labelCls} style={{ fontFamily: OSW, letterSpacing: '1px' }}>Nombre</label>
                <input className={inputCls} style={{ fontFamily: LEX }} value={nombre} onChange={e => { setIsDirty(true); setNombre(e.target.value) }} placeholder="Ej: Salsa brava" />
              </div>
              <div style={{ flex: 1 }}>
                <label className={labelCls} style={{ fontFamily: OSW, letterSpacing: '1px' }}>Rac.</label>
                <input type="number" min={1} step="1" className={inputCls} style={{ fontFamily: LEX }} value={raciones || ''} onChange={e => onRacionesChange(parseFloat(e.target.value) || 1)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className={labelCls} style={{ fontFamily: OSW, letterSpacing: '1px' }}>Tam.Rac</label>
                <input type="number" min={0} step="any" className={inputCls} style={{ fontFamily: LEX }} value={tamanoRac || ''} onChange={e => onTamanoChange(parseFloat(e.target.value) || 0)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className={labelCls} style={{ fontFamily: OSW, letterSpacing: '1px' }}>Ud.</label>
                <select className={inputCls} style={{ fontFamily: LEX }} value={unidad} onChange={e => { setIsDirty(true); setUnidad(e.target.value) }}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ flex: 1.5 }}>
                <label className={labelCls} style={{ fontFamily: OSW, letterSpacing: '1px' }}>Fecha</label>
                <input type="date" className={inputCls} style={{ fontFamily: LEX }} value={fecha ?? ''} onChange={e => { setIsDirty(true); setFecha(e.target.value) }} />
              </div>
            </div>

            {/* Líneas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-ink uppercase tracking-wider" style={{ fontFamily: OSW, letterSpacing: '1px' }}>Líneas</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={addLinea}
                    className="text-xs hover:brightness-105 transition px-3 py-1 rounded-none"
                    style={{ backgroundColor: AMA, color: INK, fontFamily: OSW, fontWeight: 700, letterSpacing: '0.5px', border: `2px solid ${INK}`, boxShadow: `2px 2px 0 ${INK}` }}
                  >
                    + Añadir línea
                  </button>
                  <button
                    onClick={() => { setShowDictar(true); setErrDictado(null) }}
                    style={{ background: BLANCO, color: INK, border: `2px solid ${INK}`, borderRadius: 0, padding: '5px 12px', fontFamily: OSW, fontWeight: 700, fontSize: 10, letterSpacing: '1px', cursor: 'pointer' }}
                  >
                    ⚡ DICTAR
                  </button>
                </div>
              </div>

              {/* Panel DICTAR */}
              {showDictar && (
                <div style={{ padding: 14, background: NAR_S, border: `3px solid ${INK}`, borderRadius: 0, marginBottom: 8 }}>
                  <div style={{ fontFamily: LEX, fontSize: 12, color: INK, marginBottom: 8 }}>
                    Escribe o dicta ingredientes en lenguaje libre:
                  </div>
                  <textarea
                    value={textoDictado}
                    onChange={e => setTextoDictado(e.target.value)}
                    placeholder="Ej: 200g tomate frito, 3 dientes ajo, 50ml aceite oliva..."
                    style={{ background: BLANCO, border: `2px solid ${INK}`, color: INK, fontFamily: LEX, fontSize: 13, borderRadius: 0, padding: 10, width: '100%', boxSizing: 'border-box', height: 80, resize: 'none', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <MicDictado onTexto={t => setTextoDictado(prev => (prev ? prev + ' ' : '') + t)} />
                    <button
                      onClick={procesarDictado}
                      disabled={loadingDictado}
                      style={{ background: GRANATE, color: BLANCO, border: `2px solid ${INK}`, borderRadius: 0, padding: '7px 16px', fontFamily: OSW, fontWeight: 700, fontSize: 10, letterSpacing: '1px', cursor: 'pointer', flex: 1, opacity: loadingDictado ? 0.6 : 1 }}
                    >
                      {loadingDictado ? 'PROCESANDO…' : 'PROCESAR'}
                    </button>
                    <button
                      onClick={() => { setShowDictar(false); setTextoDictado('') }}
                      style={{ background: BLANCO, color: INK, border: `2px solid ${INK}`, borderRadius: 0, padding: '7px 12px', fontFamily: OSW, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}
                    >
                      CANCELAR
                    </button>
                  </div>
                  {errDictado && <div style={{ marginTop: 8, fontFamily: LEX, fontSize: 12, color: NAR }}>{errDictado}</div>}
                </div>
              )}

              {loadingLineas ? (
                <div className="flex justify-center py-8"><div className="h-5 w-5 border-2 border-ink border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="border-[3px] border-ink rounded-none overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full" style={{ minWidth: '800px' }}>
                      <thead>
                        <tr>
                          <th className={thCls + ' w-10'}>#</th>
                          <th className={thCls}>Ingrediente</th>
                          <th className={thCls + ' w-24 text-right'}>Cantidad</th>
                          <th className={thCls + ' w-20'}>Unidad</th>
                          <th className={thCls + ' w-28 text-right'}>€/ud neta</th>
                          <th className={thCls + ' w-28 text-right'}>€ total</th>
                          <th className={thCls + ' w-16 text-right'}>%</th>
                          <th className={thCls + ' w-10'} />
                        </tr>
                      </thead>
                      <tbody>
                        {!lineasCalc.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-gris text-sm">Sin líneas — añade ingredientes</td></tr>}
                        {lineasCalc.map((l, idx) => (
                          <tr key={idx}>
                            <td className={tdCls + ' text-gris'}>{idx + 1}</td>
                            <td className={tdCls}>
                              <BuscadorItem
                                value={l.ingrediente_nombre}
                                opciones={opcionesLineaEps}
                                onSelect={v => selectIngrediente(idx, v)}
                                placeholder="Buscar ingrediente o EPS…"
                                inputClassName="w-full bg-transparent border-none outline-none text-sm text-ink placeholder:text-gris"
                              />
                            </td>
                            <td className={tdCls + ' text-right'}><input type="number" min={0} step="any" className="w-full bg-transparent border-none outline-none text-sm text-ink text-right" value={l.cantidad || ''} onChange={e => updateLinea(idx, { cantidad: parseFloat(e.target.value) || 0 })} /></td>
                            <td className={tdCls}><select className="w-full bg-transparent border-none outline-none text-sm text-ink" value={l.unidad} onChange={e => updateLinea(idx, { unidad: e.target.value })}>{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}</select></td>
                            <td className={tdCls + ' text-right'}><input type="number" min={0} step="0.000001" className="w-full bg-transparent border-none outline-none text-sm text-ink text-right" value={l.eur_ud_neta || ''} onChange={e => updateLinea(idx, { eur_ud_neta: parseFloat(e.target.value) || 0 })} /></td>
                            <td className={tdCls + ' text-right font-medium text-ink'}>{fmtNum(l.eur_total)}</td>
                            <td className={tdCls + ' text-right text-gris'}>{fmtNum(l.pct_total)}%</td>
                            <td className={tdCls}><button onClick={() => deleteLinea(idx)} className="text-gris hover:text-rojo transition text-sm">×</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between px-3 py-3 border-t-[3px] border-ink bg-crema">
                    <div className="flex items-center gap-6">
                      <div>
                        <span className="text-[10px] text-gris uppercase tracking-wide block">Coste tanda</span>
                        <span className="text-sm font-bold text-ink">{fmtEur(costeTanda)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gris uppercase tracking-wide block">Coste ración</span>
                        <span className="text-base font-bold text-ink">{fmtNum(costeRac)}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gris">{raciones} raciones</span>
                  </div>
                </div>
              )}
            </div>

            {/* Preparación */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-ink uppercase tracking-wider" style={{ fontFamily: OSW, letterSpacing: '1px' }}>Preparación</p>
              </div>
              <textarea
                value={preparacion}
                onChange={e => { setIsDirty(true); setPreparacion(e.target.value) }}
                placeholder="Escribe los pasos de elaboración de esta EP…"
                rows={8}
                className="w-full bg-white border-[2px] border-ink rounded-none px-3 py-2 text-[13px] text-ink placeholder:text-gris focus:outline-none focus:border-azul font-sans"
                style={{ resize: 'vertical', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t-[4px] border-ink">
            <div className="flex items-center gap-2">
              {eps && !confirmEliminar && (
                <button
                  onClick={() => setConfirmEliminar(true)}
                  style={{ background: 'transparent', border: `2px solid ${GRANATE}`, color: GRANATE, padding: '10px 16px', borderRadius: '0', fontFamily: OSW, fontWeight: 700, fontSize: '.78rem', letterSpacing: '1px', cursor: 'pointer', minHeight: '44px' }}
                >
                  ELIMINAR
                </button>
              )}
              {eps && confirmEliminar && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: GRANATE, fontFamily: LEX }}>¿Eliminar definitivamente?</span>
                  <button onClick={handleEliminar} disabled={deleting} style={{ background: GRANATE, color: BLANCO, border: `2px solid ${INK}`, padding: '6px 12px', borderRadius: '0', cursor: 'pointer', fontFamily: OSW, fontWeight: 700, fontSize: '.7rem', opacity: deleting ? 0.5 : 1 }}>
                    {deleting ? 'ELIMINANDO…' : 'SÍ, ELIMINAR'}
                  </button>
                  <button onClick={() => setConfirmEliminar(false)} style={{ background: 'transparent', border: `2px solid ${INK}`, color: INK, padding: '6px 12px', borderRadius: '0', cursor: 'pointer', fontFamily: OSW, fontWeight: 700, fontSize: '.7rem' }}>
                    CANCELAR
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onClose} style={btnCancelStyle}>CANCELAR</button>
              <button onClick={handleSave} disabled={saving || !nombre.trim()} style={{ ...btnSaveStyle, opacity: (saving || !nombre.trim()) ? 0.5 : 1 }}>
                {saving ? 'GUARDANDO…' : 'GUARDAR'}
              </button>
            </div>
          </div>

          {/* Overlay conflictos */}
          {showConflictos && conflictos.length > 0 && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, borderRadius: 0 }}>
              <div style={{ background: BLANCO, border: `3px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}`, borderRadius: 0, padding: 20, width: '90%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: INK, marginBottom: 12 }}>
                  INGREDIENTES NO ENCONTRADOS
                </div>
                {conflictos.map((item, idx) => (
                  <div key={idx} style={{ background: NAR_S, border: `2px solid ${INK}`, borderRadius: 0, padding: '10px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ background: NAR, color: BLANCO, padding: '2px 8px', borderRadius: 0, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 700, fontSize: 10 }}>⚠ NO ENCONTRADO</span>
                      <span style={{ fontFamily: LEX, fontSize: 13, color: INK, fontWeight: 500 }}>{item.nombre}</span>
                      <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>{item.cantidad} {item.unidad}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          setConflictos(prev => prev.filter((_, i) => i !== idx))
                          setShowModalCrearIng({ nombre: item.nombre, cantidad: item.cantidad, unidad: item.unidad })
                        }}
                        style={{ background: GRANATE, color: BLANCO, border: `2px solid ${INK}`, borderRadius: 0, padding: '6px 10px', fontFamily: OSW, fontWeight: 700, fontSize: 10, letterSpacing: '1px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        + CREAR ING
                      </button>
                      <button
                        onClick={() => { setConflictos(prev => prev.filter((_, i) => i !== idx)); setShowModalCrearEps({ nombre: item.nombre, cantidad: item.cantidad, unidad: item.unidad }) }}
                        style={{ background: BLANCO, color: INK, border: `2px solid ${INK}`, borderRadius: 0, padding: '6px 10px', fontFamily: OSW, fontWeight: 700, fontSize: 10, letterSpacing: '1px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        + CREAR EPS
                      </button>
                      <select
                        defaultValue=""
                        onChange={e => {
                          if (!e.target.value) return
                          const [type, id] = e.target.value.split(':')
                          if (type === 'ing') {
                            const ing = todosIngredientes.find((i: any) => i.id === id)
                            if (ing) {
                              setIsDirty(true)
                              setLineas(prev => [...prev, { linea: prev.length + 1, ingrediente_id: ing.id, ingrediente_nombre: ing.nombre, cantidad: item.cantidad, unidad: item.unidad, eur_ud_neta: precioNeto(ing) }])
                              setConflictos(prev => prev.filter((_, i) => i !== idx))
                            }
                          } else if (type === 'eps') {
                            const ep = todasEps.find((e: any) => e.id === id)
                            if (ep) {
                              setIsDirty(true)
                              setLineas(prev => [...prev, { linea: prev.length + 1, ingrediente_id: null, ingrediente_nombre: ep.nombre, cantidad: item.cantidad, unidad: item.unidad, eur_ud_neta: n(ep.coste_rac) }])
                              setConflictos(prev => prev.filter((_, i) => i !== idx))
                            }
                          }
                        }}
                        style={{ background: BLANCO, border: `2px solid ${INK}`, color: INK, fontFamily: LEX, fontSize: 12, borderRadius: 0, padding: '6px 8px', flex: 1, cursor: 'pointer' }}
                      >
                        <option value="">Elegir existente...</option>
                        {todosIngredientes.length > 0 && (
                          <optgroup label="Ingredientes">
                            {todosIngredientes.map((i: any) => (
                              <option key={i.id} value={`ing:${i.id}`}>{i.nombre}</option>
                            ))}
                          </optgroup>
                        )}
                        {todasEps.length > 0 && (
                          <optgroup label="EPS">
                            {todasEps.map((e: any) => (
                              <option key={e.id} value={`eps:${e.id}`}>{e.nombre}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal crear ingrediente (nested, sibling del backdrop para z-index correcto) */}
      {showModalCrearIng && (
        <ModalIngrediente
          ingrediente={null}
          initialNombre={showModalCrearIng.nombre}
          onClose={() => setShowModalCrearIng(null)}
          onSaved={async () => {
            const itemRef = showModalCrearIng
            setShowModalCrearIng(null)
            if (!itemRef) return
            const { data } = await supabase
              .from('ingredientes')
              .select('*')
              .ilike('nombre_base', `%${itemRef.nombre}%`)
              .order('id', { ascending: false })
              .limit(1)
            if (data?.[0]) {
              const ing = data[0] as Ingrediente
              setIsDirty(true)
              setLineas(prev => [...prev, {
                linea: prev.length + 1,
                ingrediente_id: ing.id,
                ingrediente_nombre: ing.nombre,
                cantidad: itemRef.cantidad,
                unidad: itemRef.unidad,
                eur_ud_neta: precioNeto(ing),
              }])
            }
          }}
        />
      )}

      {/* Modal crear EPS anidada (recursivo) */}
      {showModalCrearEps && (
        <ModalEPS
          eps={null}
          initialNombre={showModalCrearEps.nombre}
          ingredientes={ingredientes}
          onClose={() => setShowModalCrearEps(null)}
          onSaved={async () => {
            const itemRef = showModalCrearEps
            setShowModalCrearEps(null)
            if (!itemRef) return
            const { data } = await supabase
              .from('eps')
              .select('*')
              .ilike('nombre', `%${itemRef.nombre}%`)
              .order('id', { ascending: false })
              .limit(1)
            if (data?.[0]) {
              const ep = data[0] as any
              setIsDirty(true)
              setLineas(prev => [...prev, {
                linea: prev.length + 1,
                ingrediente_id: null,
                ingrediente_nombre: ep.nombre,
                cantidad: itemRef.cantidad,
                unidad: itemRef.unidad,
                eur_ud_neta: n(ep.coste_rac),
              }])
            }
          }}
        />
      )}
    </>
  )
}
