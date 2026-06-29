import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { INK, AMA, CREMA, GRANATE, NAR, VERDE, AZUL, GRIS, OSW, LEX } from '@/styles/neobrutal'

const btnSaveStyle: CSSProperties = {
  backgroundColor: AMA, color: INK, fontFamily: OSW, fontWeight: 700, letterSpacing: '1px',
  textTransform: 'uppercase', padding: '11px 28px', borderRadius: 0, border: `2px solid ${INK}`,
  boxShadow: `3px 3px 0 ${INK}`, cursor: 'pointer', minHeight: 44, fontSize: 14,
}
const btnCancelStyle: CSSProperties = {
  backgroundColor: '#ffffff', color: INK, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 700,
  letterSpacing: '1px', textTransform: 'uppercase', padding: '11px 28px', borderRadius: 0, cursor: 'pointer', minHeight: 44, fontSize: 14,
}
const labelStyle: CSSProperties = { display: 'block', fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: '#6b5d45', marginBottom: 5 }
const roBox: CSSProperties = { background: CREMA, border: `2px solid ${INK}`, borderRadius: 0, padding: '9px 12px', fontSize: 14, color: INK, fontFamily: LEX, minHeight: 42, display: 'flex', alignItems: 'center' }
const calcBox: CSSProperties = { background: AMA, border: `2px solid ${INK}`, borderRadius: 0, padding: '9px 12px', fontSize: 15, color: INK, fontWeight: 700, fontFamily: OSW, letterSpacing: '-0.3px', minHeight: 42, display: 'flex', alignItems: 'center' }
const inputCls = 'w-full bg-white border-[2px] border-[#140f08] rounded-none px-3 py-2.5 text-[14px] text-[#140f08] focus:outline-none focus:border-[#2D5BFF]'

function Block({ tag, bg, fg = INK, children, style }: { tag: string; bg: string; fg?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}`, padding: '16px 18px', ...style }}>
      <div style={{ display: 'inline-block', background: bg, color: fg, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 700, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 12px', marginBottom: 16 }}>{tag}</div>
      {children}
    </div>
  )
}

import { supabase } from '@/lib/supabase'
import { fmtNum } from '@/utils/format'
import { useConfig } from '@/hooks/useConfig'
import { MARCA_MAP } from './types'
import type { Ingrediente, Merma } from './types'

async function generarCodigoIding(prefijo: string): Promise<string> {
  const { data } = await supabase.from('ingredientes').select('iding')
  const nums = new Set<number>()
  ;(data ?? []).forEach((r: { iding?: string | null }) => {
    const m = String(r.iding ?? '').match(new RegExp('^' + prefijo + '(\\d+)$'))
    if (m) nums.add(parseInt(m[1], 10))
  })
  let i = 1
  while (nums.has(i)) i++
  return prefijo + String(i).padStart(3, '0')
}

const ALERGENOS_14 = [
  'Gluten', 'Lácteos', 'Huevo', 'Pescado', 'Crustáceos', 'Moluscos', 'Frutos secos',
  'Cacahuetes', 'Soja', 'Apio', 'Mostaza', 'Sésamo', 'Sulfitos', 'Altramuces',
]

interface Props {
  ingrediente: Ingrediente | null
  initialNombre?: string
  onClose: () => void
  onSaved: () => void
  onDelete?: () => void
  onOpenMerma?: (m: Merma | null) => void
}

export default function ModalIngrediente({ ingrediente, initialNombre, onClose, onSaved, onDelete, onOpenMerma }: Props) {
  const isEdit = !!ingrediente
  const cfg = useConfig()
  const [f, setF] = useState({
    iding: ingrediente?.iding ?? '',
    categoria: ingrediente?.categoria ?? '',
    nombre_base: ingrediente?.nombre_base ?? initialNombre ?? '',
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
  const [alergenos, setAlergenos] = useState<string[]>(
    Array.isArray((ingrediente as any)?.alergenos) ? (ingrediente as any).alergenos : []
  )
  const [saving, setSaving] = useState(false)
  const [alergSugiriendo, setAlergSugiriendo] = useState(false)
  const [errAlerg, setErrAlerg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const toggleAlergeno = (a: string) =>
    setAlergenos(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])

  const buscarAlergenosMemoria = async () => {
    const nb = f.nombre_base.trim()
    if (!nb || alergenos.length > 0) return
    const { data } = await supabase.from('alergenos_memoria').select('alergenos').eq('nombre_base', nb.toLowerCase()).maybeSingle()
    if (data?.alergenos && Array.isArray(data.alergenos) && data.alergenos.length) setAlergenos(data.alergenos as string[])
  }

  const sugerirAlergenosIA = async () => {
    const nb = f.nombre_base.trim()
    if (!nb) return
    setAlergSugiriendo(true)
    setErrAlerg(null)
    try {
      const { data } = await supabase.from('alergenos_memoria').select('alergenos').eq('nombre_base', nb.toLowerCase()).maybeSingle()
      if (data?.alergenos && Array.isArray(data.alergenos) && data.alergenos.length) { setAlergenos(data.alergenos as string[]); return }
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
      if (!apiKey) { setErrAlerg('Sugerencia por IA no disponible (sin configurar). Marca a mano.'); return }
      if (apiKey) {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 256,
            system: 'Eres experto en seguridad alimentaria. Dado el nombre de un alimento, devuelve SOLO un JSON array con los alergenos presentes habitualmente, elegidos EXACTAMENTE de esta lista: ' + JSON.stringify(ALERGENOS_14) + '. Sin markdown, sin texto extra, sin backticks. Si no tiene ninguno devuelve [].',
            messages: [{ role: 'user', content: nb }],
          }),
        })
        const d = await resp.json()
        const txt: string = d.content?.[0]?.text ?? '[]'
        try { const arr = JSON.parse(txt); if (Array.isArray(arr)) setAlergenos(arr.filter((a: string) => ALERGENOS_14.includes(a))) } catch { /* noop */ }
      }
    } finally { setAlergSugiriendo(false) }
  }

  const handleEliminar = async () => {
    if (!ingrediente) return
    setDeleting(true)
    try {
      await supabase.from('ingredientes').delete().eq('id', ingrediente.id)
      onClose()
      ;(onDelete ?? onSaved)()
    } finally {
      setDeleting(false)
    }
  }

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
      let idingFinal = f.iding
      if (!idingFinal) idingFinal = await generarCodigoIding('ING')
      const baseTrim = f.nombre_base.trim()
      const abvTrim = (f.abv || '').toUpperCase().trim()
      const nombreConcat = abvTrim ? `${baseTrim}_${abvTrim}` : baseTrim
      const payload = {
        iding: idingFinal || null,
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
        alergenos: alergenos,
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
          .eq('iding', idingFinal || '')
          .maybeSingle()
        if (existing) {
          if (onOpenMerma) { onOpenMerma(existing as Merma); return }
        } else {
          const mermaRecord = {
            iding: idingFinal || null,
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
      if (f.nombre_base.trim()) {
        await supabase.from('alergenos_memoria').upsert({ nombre_base: f.nombre_base.trim().toLowerCase(), alergenos, updated_at: new Date().toISOString() }, { onConflict: 'nombre_base' })
      }
      onSaved()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const nombreCompleto = f.nombre_base && f.abv ? `${f.nombre_base}_${f.abv}` : (f.nombre || '—')
  const proveedorNombre = cfg.proveedores.find(p => p.abv === f.abv.toUpperCase())?.nombre_completo || MARCA_MAP[f.abv.toUpperCase()] || '—'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-6xl my-8" style={{ background: CREMA, maxHeight: '92vh', overflowY: 'auto', border: `4px solid ${INK}`, borderRadius: 0, boxShadow: `6px 6px 0 ${INK}` }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '20px 24px', borderBottom: `4px solid ${INK}`, background: AMA }}>
          <div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1, letterSpacing: '-0.5px', textTransform: 'uppercase', color: INK }}>{isEdit ? 'Editar ingrediente' : 'Nuevo ingrediente'}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ background: '#fff', border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: INK, padding: '3px 10px' }}>{nombreCompleto}</span>
              {f.abv && <span style={{ background: AZUL, color: '#fff', border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', padding: '3px 10px' }}>{f.abv} · {proveedorNombre}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#fff', border: `2px solid ${INK}`, width: 36, height: 36, fontSize: 20, lineHeight: 1, cursor: 'pointer', color: INK, flexShrink: 0 }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* IDENTIDAD */}
          <Block tag="Identidad" bg={AMA}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label style={labelStyle}>IDING</label>
                <input type="text" value={f.iding} onChange={e => set('iding', e.target.value)} placeholder="ING001" className={inputCls} style={{ fontFamily: LEX }} />
              </div>
              <div>
                <label style={labelStyle}>Categoría</label>
                <select value={f.categoria} onChange={e => set('categoria', e.target.value)} className={inputCls} style={{ fontFamily: LEX }}>
                  {cfg.categorias.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Nombre base</label>
                <input type="text" value={f.nombre_base} onChange={e => set('nombre_base', e.target.value)} onBlur={buscarAlergenosMemoria} placeholder="Tomate" className={inputCls} style={{ fontFamily: LEX }} />
              </div>
              <div>
                <label style={labelStyle}>ABV (proveedor)</label>
                <select value={f.abv} onChange={e => onAbvChange(e.target.value)} className={inputCls} style={{ fontFamily: LEX }}>
                  {cfg.proveedores.map(p => <option key={p.abv} value={p.abv}>{p.abv}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div>
                <label style={labelStyle}>Nombre completo (auto)</label>
                <div style={roBox}>{nombreCompleto}</div>
              </div>
              <div>
                <label style={labelStyle}>Proveedor</label>
                <div style={roBox}>{proveedorNombre}</div>
              </div>
              <div>
                <label style={labelStyle}>Marca</label>
                <input type="text" value={f.marca} onChange={e => set('marca', e.target.value)} className={inputCls} style={{ fontFamily: LEX }} />
              </div>
              <div>
                <label style={labelStyle}>Formato</label>
                <select value={f.formato} onChange={e => set('formato', e.target.value)} className={inputCls} style={{ fontFamily: LEX }}>
                  {cfg.formatos.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </Block>

          {/* UNIDADES Y PRECIOS */}
          <Block tag="Unidades y precios" bg={AZUL} fg="#fff">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label style={labelStyle}>Peso/Vol. por unidad</label>
                <input type="number" step="any" value={f.uds} onChange={e => set('uds', e.target.value)} placeholder="5" className={inputCls} style={{ fontFamily: LEX }} />
              </div>
              <div>
                <label style={labelStyle}>UD STD</label>
                <select value={f.ud_std} onChange={e => onUdStdChange(e.target.value)} className={inputCls} style={{ fontFamily: LEX }}>
                  {udStdOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>UD MIN</label>
                <div style={roBox}>{f.ud_min}</div>
              </div>
              <div>
                <label style={labelStyle}>Usos</label>
                <div style={roBox}>{f.usos}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label style={labelStyle}>Precio 1</label>
                <input type="number" step="0.01" value={f.precio1} onChange={e => set('precio1', e.target.value)} className={inputCls} style={{ fontFamily: LEX }} />
              </div>
              <div>
                <label style={labelStyle}>Precio 2</label>
                <input type="number" step="0.01" value={f.precio2} onChange={e => set('precio2', e.target.value)} className={inputCls} style={{ fontFamily: LEX }} />
              </div>
              <div>
                <label style={labelStyle}>Precio 3</label>
                <input type="number" step="0.01" value={f.precio3} onChange={e => set('precio3', e.target.value)} className={inputCls} style={{ fontFamily: LEX }} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div>
                <label style={labelStyle}>Selector</label>
                <select value={f.selector_precio} onChange={e => set('selector_precio', e.target.value)} className={inputCls} style={{ fontFamily: LEX }}>
                  <option value="ultimo">Último</option>
                  <option value="media">Media</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Precio activo</label>
                <div style={calcBox}>{fmtNum(precioActivo)}</div>
              </div>
              <div>
                <label style={labelStyle}>EUR / STD</label>
                <div style={calcBox}>{fmtNum(eurStd)}</div>
              </div>
              <div>
                <label style={labelStyle}>EUR / MIN</label>
                <div style={calcBox}>{fmtNum(eurMin)}</div>
              </div>
            </div>
          </Block>

          {/* MERMA + ALÉRGENOS lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Block tag="Merma" bg={NAR} fg="#fff">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Tipo merma</label>
                  <select value={f.tipo_merma ?? 'Manual'} onChange={e => set('tipo_merma', e.target.value)} className={inputCls} style={{ fontFamily: LEX }}>
                    <option value="Manual">Manual</option>
                    <option value="Tecnica">Técnica</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Merma %</label>
                  <input type="number" step="0.1" value={f.merma_pct} onChange={e => set('merma_pct', e.target.value)} disabled={f.tipo_merma === 'Tecnica'} className={inputCls} style={{ fontFamily: LEX, ...(f.tipo_merma === 'Tecnica' ? { opacity: 0.6 } : {}) }} />
                </div>
                <div>
                  <label style={labelStyle}>C. neto / STD</label>
                  <div style={calcBox}>{fmtNum(costeNetoStd)}</div>
                </div>
                <div>
                  <label style={labelStyle}>C. neto / MIN</label>
                  <div style={calcBox}>{fmtNum(costeNetoMin)}</div>
                </div>
              </div>
            </Block>

            <Block tag="Alérgenos" bg={GRANATE} fg="#fff">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, marginTop: -6 }}>
                <button type="button" onClick={sugerirAlergenosIA} disabled={alergSugiriendo || !f.nombre_base.trim()} style={{ background: '#fff', border: `2px solid ${INK}`, color: INK, borderRadius: 0, padding: '5px 12px', fontFamily: OSW, fontWeight: 700, fontSize: 10, letterSpacing: '1px', cursor: 'pointer', opacity: (alergSugiriendo || !f.nombre_base.trim()) ? 0.5 : 1 }}>{alergSugiriendo ? 'SUGIRIENDO…' : '⚡ SUGERIR (IA)'}</button>
                {errAlerg && <span style={{ fontSize: 12, color: NAR, fontFamily: LEX }}>{errAlerg}</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {ALERGENOS_14.map(a => {
                  const on = alergenos.includes(a)
                  return (
                    <button key={a} type="button" onClick={() => toggleAlergeno(a)}
                      style={{ padding: '6px 12px', borderRadius: 0, fontFamily: LEX, fontSize: 13, cursor: 'pointer', border: `2px solid ${INK}`, background: on ? GRANATE : '#fff', color: on ? '#fff' : INK, transition: 'all 120ms' }}>
                      {a}
                    </button>
                  )
                })}
              </div>
              <p style={{ fontSize: 12, color: GRIS, marginTop: 10, fontFamily: LEX }}>
                Los alérgenos marcados se trasladan a toda EPS y receta que use este ingrediente.
              </p>
            </Block>
          </div>

          {err && <p style={{ color: '#FF1E27', fontFamily: LEX, fontSize: 14, fontWeight: 600 }}>{err}</p>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 24px', borderTop: `4px solid ${INK}`, background: '#fff', position: 'sticky', bottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isEdit && !confirmEliminar && (
              <button onClick={() => setConfirmEliminar(true)} style={{ background: 'transparent', border: `2px solid ${GRANATE}`, color: GRANATE, padding: '11px 18px', borderRadius: 0, fontFamily: OSW, fontWeight: 700, fontSize: '.78rem', letterSpacing: '1px', cursor: 'pointer', minHeight: 44 }}>ELIMINAR</button>
            )}
            {isEdit && confirmEliminar && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: GRANATE, fontFamily: LEX }}>¿Eliminar definitivamente?</span>
                <button onClick={handleEliminar} disabled={deleting} style={{ background: GRANATE, color: '#fff', border: `2px solid ${INK}`, padding: '7px 12px', borderRadius: 0, cursor: 'pointer', fontFamily: OSW, fontWeight: 700, fontSize: '.7rem', opacity: deleting ? 0.5 : 1 }}>{deleting ? 'ELIMINANDO…' : 'SÍ, ELIMINAR'}</button>
                <button onClick={() => setConfirmEliminar(false)} style={{ background: 'transparent', border: `2px solid ${INK}`, color: INK, padding: '7px 12px', borderRadius: 0, cursor: 'pointer', fontFamily: OSW, fontWeight: 700, fontSize: '.7rem' }}>CANCELAR</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
