import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'

function useIsDark() {
  const [isDark, setIsDark] = useState(document.documentElement.getAttribute('data-theme') === 'dark')
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark'))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

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
import { supabase } from '@/lib/supabase'
import { useConfig } from '@/hooks/useConfig'
import { MARCA_MAP } from './types'
import type { Ingrediente, Merma } from './types'

interface Props {
  ingrediente: Ingrediente | null
  onClose: () => void
  onSaved: () => void
  onOpenMerma?: (m: Merma | null) => void
  onDelete?: () => void
}

export default function ModalIngrediente({ ingrediente, onClose, onSaved, onOpenMerma, onDelete }: Props) {
  const isEdit = !!ingrediente
  const cfg = useConfig()
  const isDark = useIsDark()
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const handleEliminar = async () => {
    if (!ingrediente) return
    await supabase.from('ingredientes').delete().eq('id', ingrediente.id)
    onClose(); onDelete?.()
  }
  const [f, setF] = useState({
    iding: ingrediente?.iding ?? '',
    categoria: ingrediente?.categoria ?? '',
    nombre_base: ingrediente?.nombre_base ?? '',
    abv: ingrediente?.abv ?? '',
    nombre: ingrediente?.nombre ?? '',
    marca: ingrediente?.marca ?? '',
    formato: ingrediente?.formato ?? '',
    uds: ingrediente?.uds != null ? String(ingrediente.uds) : '',
    ud_std: ingrediente?.ud_std ?? 'Kg.',
    ud_min: ingrediente?.ud_min ?? 'gr.',
    precio1: ingrediente?.precio1 != null ? String(ingrediente.precio1) : '',
    precio2: ingrediente?.precio2 != null && ingrediente.precio2 !== 0 ? String(ingrediente.precio2) : '',
    precio3: ingrediente?.precio3 != null && ingrediente.precio3 !== 0 ? String(ingrediente.precio3) : '',
    ultimo_precio: ingrediente?.ultimo_precio != null ? String(ingrediente.ultimo_precio) : '',
    selector_precio: ingrediente?.selector_precio ?? 'ultimo',
    merma_pct: ingrediente?.merma_pct != null ? String(ingrediente.merma_pct) : '0',
    tipo_merma: ingrediente?.tipo_merma ?? null,
    activo: ingrediente?.activo ?? true,
    usos: ingrediente?.usos ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const set = (k: string, val: string | boolean | number | null) => setF(p => ({ ...p, [k]: val }))

  const onAbvChange = (v: string) => {
    const up = v.toUpperCase()
    const prov = cfg.proveedores.find(p => p.abv === up)
    const marcaFromCfg = prov?.marca_asociada || prov?.nombre_completo
    const mapped = marcaFromCfg || MARCA_MAP[up]
    setF(p => ({ ...p, abv: up, marca: mapped || p.marca }))
  }

  const onUdStdChange = (v: string) => {
    const lower = v.toLowerCase()
    let udMin = v
    if (lower.startsWith('kg')) udMin = 'gr.'
    else if (lower.startsWith('l')) udMin = 'ml.'
    else if (lower.startsWith('ud')) udMin = 'ud.'
    setF(p => ({ ...p, ud_std: v, ud_min: udMin }))
  }

  const p1 = parseFloat(f.precio1) || 0
  const p2 = parseFloat(f.precio2) || 0
  const p3 = parseFloat(f.precio3) || 0
  const ultimoAuto = p3 || p2 || p1
  const precios = [p1, p2, p3].filter(p => p > 0)
  const media = precios.length ? precios.reduce((a, b) => a + b, 0) / precios.length : 0
  const precioActivo = f.selector_precio === 'ultimo' ? ultimoAuto : media
  const udStdOptions = cfg.unidades_std?.length ? cfg.unidades_std : ['Kg.', 'L.', 'Ud.']

  const uds = parseFloat(f.uds) || 0
  const mermaPct = parseFloat(f.merma_pct) || 0
  const eurStd = uds > 0 ? precioActivo / uds : 0
  const factor = f.ud_std?.toLowerCase().startsWith('kg') || f.ud_std?.toLowerCase().startsWith('l') ? 1000 : (f.ud_std === 'Docena' ? 12 : 1)
  const eurMin = eurStd / factor
  const costeNetoStd = mermaPct > 0 && mermaPct < 100 ? eurStd / (1 - mermaPct / 100) : eurStd
  const costeNetoMin = costeNetoStd / factor

  const handleSave = async () => {
    setErr(null)
    if (!f.nombre_base.trim()) { setErr('Nombre base obligatorio'); return }

    // FIX 7: Técnica → Manual: confirmar borrado subproductos
    const originalTipoMerma = ingrediente?.tipo_merma
    if (originalTipoMerma === 'Tecnica' && f.tipo_merma === 'Manual') {
      const baseTrimPrev = f.nombre_base.trim()
      const eliminar = window.confirm(
        'Este ingrediente tiene subproductos creados (Limpio, pieles, porciones). ¿Deseas ELIMINAR los subproductos de Ingredientes?\n\nAceptar = eliminar subproductos\nCancelar = mantener subproductos'
      )
      if (eliminar) {
        await supabase.from('ingredientes').delete().eq('abv', 'MRM').ilike('nombre_base', `%${baseTrimPrev}%`)
      }
    }

    setSaving(true)
    try {
      const baseTrim = f.nombre_base.trim()
      const abvTrim = (f.abv || '').toUpperCase().trim()
      const nombreConcat = abvTrim ? `${baseTrim}_${abvTrim}` : baseTrim
      const payload = {
        iding: f.iding || null,
        categoria: f.categoria || null,
        nombre_base: baseTrim,
        abv: abvTrim || null,
        nombre: f.nombre.trim() || nombreConcat,
        marca: f.marca || null,
        formato: f.formato || null,
        uds: uds || null,
        ud_std: f.ud_std,
        ud_min: f.ud_min,
        precio1: p1 || null,
        precio2: p2 || null,
        precio3: p3 || null,
        ultimo_precio: ultimoAuto || null,
        selector_precio: f.selector_precio,
        precio_activo: precioActivo || null,
        eur_std: eurStd || null,
        eur_min: eurMin || null,
        merma_pct: mermaPct || null,
        tipo_merma: f.tipo_merma,
        coste_neto_std: costeNetoStd || null,
        coste_neto_min: costeNetoMin || null,
        activo: f.activo,
      }

      let ingId = ingrediente?.id
      if (ingId) {
        const { error } = await supabase.from('ingredientes').update(payload).eq('id', ingId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('ingredientes').insert(payload).select('id').single()
        if (error) throw error
        ingId = data.id
      }

      if (f.tipo_merma === 'Tecnica' && ingId) {
        const { data: existing } = await supabase
          .from('mermas')
          .select('*')
          .eq('iding', f.iding || '')
          .maybeSingle()
        if (existing) {
          // FIX 6: ya existe → abrir directamente
          if (onOpenMerma) { onOpenMerma(existing as Merma); return }
        } else {
          const mermaRecord = {
            iding: f.iding || null,
            categoria: f.categoria || null,
            nombre_base: f.nombre_base,
            abv: f.abv || null,
            nombre: f.nombre || f.nombre_base,
            marca: f.marca || null,
            formato: f.formato || null,
            uds: uds || null,
            ud_std: f.ud_std,
            precio_total: precioActivo || null,
          }
          const { data: nueva } = await supabase.from('mermas').insert(mermaRecord).select('*').single()
          if (nueva && onOpenMerma) {
            onOpenMerma(nueva as Merma)
            return
          }
        }
      }
      onSaved()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
      <div className="ds-modal w-full max-w-5xl my-8 shadow-2xl" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="ds-modal-title">{isEdit ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}</h3>
          </div>
          <button onClick={onClose} className="text-[var(--sl-text-muted)] hover:text-[var(--sl-text-primary)] transition text-lg leading-none">×</button>
        </div>

        <div className="space-y-4">
          {/* Identidad */}
          <div>
            <div className="ds-section-label">Identidad</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="ds-label">IDING</label>
                <input type="text" value={f.iding} onChange={e => set('iding', e.target.value)} placeholder="ING001" className="ds-input" />
              </div>
              <div>
                <label className="ds-label">Categoría</label>
                <select value={f.categoria} onChange={e => set('categoria', e.target.value)} className="ds-input">
                  {cfg.categorias.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="ds-label">Nombre Base</label>
                <input type="text" value={f.nombre_base} onChange={e => set('nombre_base', e.target.value)} placeholder="Tomate" className="ds-input" />
              </div>
              <div>
                <label className="ds-label">ABV</label>
                <select value={f.abv} onChange={e => onAbvChange(e.target.value)} className="ds-input">
                  {cfg.proveedores.map(p => <option key={p.abv} value={p.abv}>{p.abv}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div>
                <label className="ds-label">Nombre completo (auto)</label>
                <div className="ds-input-ro">
                  {f.nombre_base && f.abv ? `${f.nombre_base}_${f.abv}` : (f.nombre || '—')}
                </div>
              </div>
              <div>
                <label className="ds-label">Proveedor</label>
                <div className="ds-input-ro">
                  {cfg.proveedores.find(p => p.abv === f.abv.toUpperCase())?.nombre_completo || MARCA_MAP[f.abv.toUpperCase()] || '—'}
                </div>
              </div>
              <div>
                <label className="ds-label">Marca</label>
                <input type="text" value={f.marca} onChange={e => set('marca', e.target.value)} className="ds-input" />
              </div>
              <div>
                <label className="ds-label">Formato</label>
                <select value={f.formato} onChange={e => set('formato', e.target.value)} className="ds-input">
                  {cfg.formatos.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Unidades */}
          {/* Unidades y Precios */}
          <div>
            <div className="ds-section-label">Unidades y Precios</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="ds-label">Peso/Vol. por unidad</label>
                <input type="number" step="any" value={f.uds} onChange={e => set('uds', e.target.value)} placeholder="5" className="ds-input" />
              </div>
              <div>
                <label className="ds-label">UD STD</label>
                <select value={f.ud_std} onChange={e => onUdStdChange(e.target.value)} className="ds-input">
                  {udStdOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="ds-label">UD MIN</label>
                <div className="ds-input-ro">{f.ud_min}</div>
              </div>
              <div>
                <label className="ds-label">USOS</label>
                <div className="ds-input-ro">{f.usos}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="ds-label">Precio 1</label>
                <input type="number" step="0.01" value={f.precio1} onChange={e => set('precio1', e.target.value)} className="ds-input" />
              </div>
              <div>
                <label className="ds-label">Precio 2</label>
                <input type="number" step="0.01" value={f.precio2} onChange={e => set('precio2', e.target.value)} className="ds-input" />
              </div>
              <div>
                <label className="ds-label">Precio 3</label>
                <input type="number" step="0.01" value={f.precio3} onChange={e => set('precio3', e.target.value)} className="ds-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div>
                <label className="ds-label">Selector</label>
                <select value={f.selector_precio} onChange={e => set('selector_precio', e.target.value)} className="ds-input">
                  <option value="ultimo">Último</option>
                  <option value="media">Media</option>
                </select>
              </div>
              <div>
                <label className="ds-label-calc">Precio Activo</label>
                <div style={{ backgroundColor: isDark ? '#2d1515' : '#fff5f5', border: '1px solid #aa3030', color: isDark ? '#ffaaaa' : '#991b1b', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>{precioActivo.toFixed(2)}</div>
              </div>
              <div>
                <label className="ds-label-calc">EUR/STD</label>
                <div style={{ backgroundColor: isDark ? '#2d1515' : '#fff5f5', border: '1px solid #aa3030', color: isDark ? '#ffaaaa' : '#991b1b', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>{eurStd.toFixed(4)}</div>
              </div>
              <div>
                <label className="ds-label-calc">EUR/MIN</label>
                <div style={{ backgroundColor: isDark ? '#2d1515' : '#fff5f5', border: '1px solid #aa3030', color: isDark ? '#ffaaaa' : '#991b1b', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>{eurMin.toFixed(4)}</div>
              </div>
            </div>
          </div>

          {/* Merma */}
          <div>
            <div className="ds-section-label">Merma</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="ds-label">Tipo Merma</label>
                <select value={f.tipo_merma ?? 'Manual'} onChange={e => set('tipo_merma', e.target.value)} className="ds-input">
                  <option value="Manual">Manual</option>
                  <option value="Tecnica">Técnica</option>
                </select>
              </div>
              <div>
                <label className="ds-label">Merma %</label>
                <input type="number" step="0.1" value={f.merma_pct} onChange={e => set('merma_pct', e.target.value)} disabled={f.tipo_merma === 'Tecnica'} className="ds-input" style={f.tipo_merma === 'Tecnica' ? { opacity: 0.6 } : undefined} />
              </div>
              <div>
                <label className="ds-label-calc">C.Neto/STD</label>
                <div style={{ backgroundColor: isDark ? '#2d1515' : '#fff5f5', border: '1px solid #aa3030', color: isDark ? '#ffaaaa' : '#991b1b', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>{costeNetoStd.toFixed(4)}</div>
              </div>
              <div>
                <label className="ds-label-calc">C.Neto/MIN</label>
                <div style={{ backgroundColor: isDark ? '#2d1515' : '#fff5f5', border: '1px solid #aa3030', color: isDark ? '#ffaaaa' : '#991b1b', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>{costeNetoMin.toFixed(4)}</div>
              </div>
            </div>
          </div>

          {err && <p className="text-[#dc2626] text-sm">{err}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-[var(--sl-border)]">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isEdit && !confirmEliminar && (
              <button onClick={() => setConfirmEliminar(true)} style={{ background: 'transparent', border: '1px solid #B01D23', color: '#B01D23', padding: '10px 16px', borderRadius: '5px', fontFamily: 'Oswald', fontSize: '.78rem', letterSpacing: '1px', cursor: 'pointer', minHeight: '44px' }}>ELIMINAR</button>
            )}
            {confirmEliminar && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#B01D23', fontFamily: 'Lexend' }}>¿Eliminar definitivamente?</span>
                <button onClick={handleEliminar} style={{ background: '#B01D23', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Oswald', fontSize: '.7rem' }}>SÍ, ELIMINAR</button>
                <button onClick={() => setConfirmEliminar(false)} style={{ background: 'transparent', border: '1px solid #555e7a', color: '#c8d0e8', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Oswald', fontSize: '.7rem' }}>CANCELAR</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={btnCancelStyle}>CANCELAR</button>
            <button onClick={handleSave} disabled={saving} style={{ ...btnSaveStyle, opacity: saving ? 0.5 : 1 }}>
              {saving ? 'GUARDANDO…' : isEdit ? 'ACTUALIZAR' : 'GUARDAR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
