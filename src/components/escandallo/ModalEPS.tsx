import type { CSSProperties } from 'react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente, EPS, EPSLinea } from './types'
import { UNIDADES, inputCls, thCls, tdCls, n } from './types'
import { fmtNum, fmtEur } from '@/utils/format'
import ModalIngrediente from './ModalIngrediente'
import { parsearIngredientesConClaude } from '@/utils/dictado'

const btnSaveStyle: CSSProperties = {
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
const btnCancelStyle: CSSProperties = {
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
  const [raciones, setRaciones] = useState(eps?.raciones ?? 1)
  const [tamanoRac, setTamanoRac] = useState(eps?.tamano_rac ?? 0)
  const [unidad, setUnidad] = useState(eps?.unidad ?? 'gr.')
  const [fecha, setFecha] = useState(eps?.fecha ?? todayISO)
  const [fechaOriginal] = useState(eps?.fecha ?? todayISO)
  const [isDirty, setIsDirty] = useState(false)

  // Dictado
  const [showDictar, setShowDictar] = useState(false)
  const [textoDictado, setTextoDictado] = useState('')
  const [loadingDictado, setLoadingDictado] = useState(false)
  const [conflictos, setConflictos] = useState<ConflictoItem[]>([])
  const [showConflictos, setShowConflictos] = useState(false)
  const [showModalCrearIng, setShowModalCrearIng] = useState<ConflictoItem | null>(null)

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

  const selectIngrediente = (idx: number, val: string) => {
    setIsDirty(true)
    const ing = ingredientes.find(i => i.nombre === val)
    if (ing) updateLinea(idx, {
      ingrediente_nombre: ing.nombre,
      ingrediente_id: ing.id,
      eur_ud_neta: n(ing.eur_min) || n(ing.eur_std),
      unidad: ing.ud_min ?? ing.ud_std ?? 'gr.',
    })
    else updateLinea(idx, { ingrediente_nombre: val, ingrediente_id: null })
  }

  async function procesarDictado() {
    if (!textoDictado.trim()) return
    setLoadingDictado(true)
    try {
      const parsed = await parsearIngredientesConClaude(textoDictado)
      const lineasNuevas: EPSLinea[] = []
      const noEncontrados: ConflictoItem[] = []

      for (const item of parsed) {
        const matchIng = ingredientes.find(i =>
          i.nombre.toLowerCase().includes(item.nombre.toLowerCase()) ||
          item.nombre.toLowerCase().includes(i.nombre.toLowerCase())
        )
        if (matchIng) {
          lineasNuevas.push({
            linea: 0,
            ingrediente_id: matchIng.id,
            ingrediente_nombre: matchIng.nombre,
            cantidad: item.cantidad,
            unidad: item.unidad,
            eur_ud_neta: n(matchIng.eur_min) || n(matchIng.eur_std),
          })
        } else {
          noEncontrados.push(item)
        }
      }

      if (lineasNuevas.length > 0) {
        setIsDirty(true)
        setLineas(prev => [...prev, ...lineasNuevas])
      }
      if (noEncontrados.length > 0) {
        setConflictos(noEncontrados)
        setShowConflictos(true)
      }
    } finally {
      setLoadingDictado(false)
      setShowDictar(false)
      setTextoDictado('')
    }
  }

  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      let epsId = eps?.id
      const record = {
        nombre,
        raciones,
        tamano_rac: tamanoRac || null,
        coste_tanda: costeTanda,
        coste_rac: costeRac,
        unidad,
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

  const labelCls = 'block text-[11px] text-[var(--sl-text-muted)] mb-1 uppercase tracking-wider'

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
        <div className="relative bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl w-full max-w-5xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sl-border)]">
            <div>
              <h3 className="text-base font-semibold text-[var(--sl-text-primary)]">{eps ? 'Editar EPS' : 'Nueva EPS'}</h3>
              {eps?.codigo && <p className="text-xs text-[var(--sl-text-muted)] mt-0.5 font-mono">{eps.codigo} · EPS</p>}
            </div>
            <button onClick={onClose} className="text-[var(--sl-text-muted)] hover:text-[var(--sl-text-primary)] transition text-xl leading-none">×</button>
          </div>

          <div className="p-5 space-y-5">
            {/* Cabecera: NOMBRE | RAC. | TAM.RAC | UD. | FECHA */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 3 }}>
                <label className={labelCls}>Nombre</label>
                <input className={inputCls} value={nombre} onChange={e => { setIsDirty(true); setNombre(e.target.value) }} placeholder="Ej: Salsa brava" />
              </div>
              <div style={{ flex: 1 }}>
                <label className={labelCls}>Rac.</label>
                <input type="number" min={1} step="1" className={inputCls} value={raciones || ''} onChange={e => { setIsDirty(true); setRaciones(parseFloat(e.target.value) || 1) }} />
              </div>
              <div style={{ flex: 1 }}>
                <label className={labelCls}>Tam.Rac</label>
                <input type="number" min={0} step="any" className={inputCls} value={tamanoRac || ''} onChange={e => { setIsDirty(true); setTamanoRac(parseFloat(e.target.value) || 0) }} />
              </div>
              <div style={{ flex: 1 }}>
                <label className={labelCls}>Ud.</label>
                <select className={inputCls} value={unidad} onChange={e => { setIsDirty(true); setUnidad(e.target.value) }}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ flex: 1.5 }}>
                <label className={labelCls}>Fecha</label>
                <input type="date" className={inputCls} value={fecha ?? ''} onChange={e => { setIsDirty(true); setFecha(e.target.value) }} />
              </div>
            </div>

            {/* Líneas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-[var(--sl-text-muted)] uppercase tracking-wider">Líneas</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={addLinea}
                    className="text-xs font-semibold hover:brightness-110 transition px-3 py-1 rounded-md"
                    style={{ backgroundColor: 'var(--sl-btn-add-alt-bg)', color: 'var(--sl-btn-add-alt-text)' }}
                  >
                    + Añadir línea
                  </button>
                  <button
                    onClick={() => setShowDictar(true)}
                    style={{ background: 'none', color: 'var(--sl-text-secondary)', border: '0.5px solid var(--sl-border)', borderRadius: 6, padding: '5px 12px', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', cursor: 'pointer' }}
                  >
                    ⚡ DICTAR
                  </button>
                </div>
              </div>

              {/* Panel DICTAR */}
              {showDictar && (
                <div style={{ padding: 14, background: 'var(--sl-app)', border: '0.5px solid var(--sl-border)', borderRadius: 8, marginBottom: 8 }}>
                  <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-secondary)', marginBottom: 8 }}>
                    Escribe o dicta ingredientes en lenguaje libre:
                  </div>
                  <textarea
                    value={textoDictado}
                    onChange={e => setTextoDictado(e.target.value)}
                    placeholder="Ej: 200g tomate frito, 3 dientes ajo, 50ml aceite oliva..."
                    style={{ background: 'var(--sl-input-edit)', border: '1px solid var(--sl-border)', color: 'var(--sl-text-primary)', fontFamily: 'Lexend, sans-serif', fontSize: 13, borderRadius: 8, padding: 10, width: '100%', boxSizing: 'border-box', height: 80, resize: 'none', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={procesarDictado}
                      disabled={loadingDictado}
                      style={{ background: '#B01D23', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', cursor: 'pointer', flex: 1, opacity: loadingDictado ? 0.6 : 1 }}
                    >
                      {loadingDictado ? 'PROCESANDO…' : 'PROCESAR'}
                    </button>
                    <button
                      onClick={() => { setShowDictar(false); setTextoDictado('') }}
                      style={{ background: 'none', color: 'var(--sl-text-secondary)', border: '0.5px solid var(--sl-border)', borderRadius: 6, padding: '7px 12px', fontFamily: 'Oswald, sans-serif', fontSize: 10, cursor: 'pointer' }}
                    >
                      CANCELAR
                    </button>
                  </div>
                </div>
              )}

              {loadingLineas ? (
                <div className="flex justify-center py-8"><div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="border border-[var(--sl-border)] rounded-lg overflow-hidden">
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
                        {!lineasCalc.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-[var(--sl-text-muted)] text-sm">Sin líneas — añade ingredientes</td></tr>}
                        {lineasCalc.map((l, idx) => (
                          <tr key={idx}>
                            <td className={tdCls + ' text-[var(--sl-text-muted)]'}>{idx + 1}</td>
                            <td className={tdCls}>
                              <input list={`eps-ing-${idx}`} className="w-full bg-transparent border-none outline-none text-sm text-[var(--sl-text-primary)] placeholder:text-[var(--sl-text-secondary)]" value={l.ingrediente_nombre} onChange={e => selectIngrediente(idx, e.target.value)} placeholder="Buscar ingrediente…" />
                              <datalist id={`eps-ing-${idx}`}>{ingredientes.map(i => <option key={i.id} value={i.nombre} />)}</datalist>
                            </td>
                            <td className={tdCls + ' text-right'}><input type="number" min={0} step="any" className="w-full bg-transparent border-none outline-none text-sm text-[var(--sl-text-primary)] text-right" value={l.cantidad || ''} onChange={e => updateLinea(idx, { cantidad: parseFloat(e.target.value) || 0 })} /></td>
                            <td className={tdCls}><select className="w-full bg-transparent border-none outline-none text-sm text-[var(--sl-text-primary)]" value={l.unidad} onChange={e => updateLinea(idx, { unidad: e.target.value })}>{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}</select></td>
                            <td className={tdCls + ' text-right'}><input type="number" min={0} step="0.000001" className="w-full bg-transparent border-none outline-none text-sm text-[var(--sl-text-primary)] text-right" value={l.eur_ud_neta || ''} onChange={e => updateLinea(idx, { eur_ud_neta: parseFloat(e.target.value) || 0 })} /></td>
                            <td className={tdCls + ' text-right font-medium text-[var(--sl-text-primary)]'}>{fmtNum(l.eur_total)}</td>
                            <td className={tdCls + ' text-right text-[var(--sl-text-muted)]'}>{fmtNum(l.pct_total)}%</td>
                            <td className={tdCls}><button onClick={() => deleteLinea(idx)} className="text-[var(--sl-text-muted)] hover:text-[#dc2626] transition text-sm">×</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between px-3 py-3 border-t-2 border-accent/40 bg-accent/5">
                    <div className="flex items-center gap-6">
                      <div>
                        <span className="text-[10px] text-[var(--sl-text-muted)] uppercase tracking-wide block">Coste tanda</span>
                        <span className="text-sm font-bold text-[var(--sl-text-primary)]">{fmtEur(costeTanda)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--sl-text-muted)] uppercase tracking-wide block">Coste ración</span>
                        <span className="text-base font-bold text-[var(--sl-text-primary)]">{fmtNum(costeRac)}</span>
                      </div>
                    </div>
                    <span className="text-xs text-[var(--sl-text-muted)]">{raciones} raciones</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[var(--sl-border)]">
            <div className="flex items-center gap-2">
              {eps && !confirmEliminar && (
                <button
                  onClick={() => setConfirmEliminar(true)}
                  style={{ background: 'transparent', border: '1px solid #B01D23', color: '#B01D23', padding: '10px 16px', borderRadius: '5px', fontFamily: 'Oswald, sans-serif', fontSize: '.78rem', letterSpacing: '1px', cursor: 'pointer', minHeight: '44px' }}
                >
                  ELIMINAR
                </button>
              )}
              {eps && confirmEliminar && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#B01D23', fontFamily: 'Lexend, sans-serif' }}>¿Eliminar definitivamente?</span>
                  <button onClick={handleEliminar} disabled={deleting} style={{ background: '#B01D23', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Oswald, sans-serif', fontSize: '.7rem', opacity: deleting ? 0.5 : 1 }}>
                    {deleting ? 'ELIMINANDO…' : 'SÍ, ELIMINAR'}
                  </button>
                  <button onClick={() => setConfirmEliminar(false)} style={{ background: 'transparent', border: '1px solid var(--sl-btn-cancel-border)', color: 'var(--sl-btn-cancel-text)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Oswald, sans-serif', fontSize: '.7rem' }}>
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
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, borderRadius: 16 }}>
              <div style={{ background: 'var(--sl-card)', border: '0.5px solid var(--sl-border)', borderRadius: 12, padding: 20, width: '90%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sl-text-muted)', marginBottom: 12 }}>
                  INGREDIENTES NO ENCONTRADOS
                </div>
                {conflictos.map((item, idx) => (
                  <div key={idx} style={{ background: 'var(--sl-card-alt)', border: '0.5px solid var(--sl-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ background: '#f5a62322', color: '#f5a623', padding: '2px 8px', borderRadius: 99, fontFamily: 'Oswald, sans-serif', fontSize: 10 }}>⚠ NO ENCONTRADO</span>
                      <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: 'var(--sl-text-primary)', fontWeight: 500 }}>{item.nombre}</span>
                      <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-secondary)' }}>{item.cantidad} {item.unidad}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => {
                          setConflictos(prev => prev.filter((_, i) => i !== idx))
                          setShowModalCrearIng({ nombre: item.nombre, cantidad: item.cantidad, unidad: item.unidad })
                        }}
                        style={{ background: '#e8f442', color: '#1a1a00', border: 'none', borderRadius: 6, padding: '6px 10px', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        + CREAR ING
                      </button>
                      <select
                        defaultValue=""
                        onChange={e => {
                          if (!e.target.value) return
                          const ing = ingredientes.find(i => i.id === e.target.value)
                          if (ing) {
                            setIsDirty(true)
                            setLineas(prev => [...prev, {
                              linea: prev.length + 1,
                              ingrediente_id: ing.id,
                              ingrediente_nombre: ing.nombre,
                              cantidad: item.cantidad,
                              unidad: item.unidad,
                              eur_ud_neta: n(ing.eur_min) || n(ing.eur_std),
                            }])
                            setConflictos(prev => prev.filter((_, i) => i !== idx))
                          }
                        }}
                        style={{ background: 'var(--sl-input-edit)', border: '1px solid var(--sl-border)', color: 'var(--sl-text-primary)', fontFamily: 'Lexend, sans-serif', fontSize: 12, borderRadius: 6, padding: '6px 8px', flex: 1, cursor: 'pointer' }}
                      >
                        <option value="">Elegir existente...</option>
                        {ingredientes.map(i => (
                          <option key={i.id} value={i.id}>{i.nombre}</option>
                        ))}
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
                eur_ud_neta: n(ing.eur_min) || n(ing.eur_std),
              }])
            }
          }}
        />
      )}
    </>
  )
}
