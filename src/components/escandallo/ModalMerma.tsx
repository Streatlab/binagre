import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { INK, AMA, CREMA, AZUL, GRANATE, GRIS, OSW, LEX, BLANCO } from '@/styles/neobrutal'

const btnSaveStyle: CSSProperties = {
  backgroundColor: AMA, color: INK, fontFamily: OSW, fontWeight: 700, letterSpacing: '1px',
  textTransform: 'uppercase', padding: '11px 28px', borderRadius: 0, border: `2px solid ${INK}`,
  boxShadow: `3px 3px 0 ${INK}`, cursor: 'pointer', minHeight: 44, fontSize: 14,
}
const btnCancelStyle: CSSProperties = {
  backgroundColor: BLANCO, color: INK, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 700,
  letterSpacing: '1px', textTransform: 'uppercase', padding: '11px 28px', borderRadius: 0, cursor: 'pointer', minHeight: 44, fontSize: 14,
}
import { supabase } from '@/lib/supabase'
import { fmtNum, fmtEur, fmtPct } from '@/utils/format'
import { useConfig } from '@/hooks/useConfig'
import { MARCA_MAP } from './types'
import type { Merma } from './types'

interface Props {
  merma: Merma | null
  onClose: () => void
  onSaved: () => void
  onDelete?: () => void
}

const inputCls = 'w-full bg-white border-[2px] border-[#140f08] rounded-none px-3 py-2 text-sm text-[#140f08] placeholder:text-[#9a8f78] focus:outline-none focus:border-[#2D5BFF]'
const labelCls = 'block text-[11px] text-[#140f08] mb-1 uppercase tracking-wider'

export default function ModalMerma({ merma, onClose, onSaved, onDelete }: Props) {
  const isEdit = !!merma
  const cfg = useConfig()
  const [f, setF] = useState({
    iding: merma?.iding ?? '',
    categoria: merma?.categoria ?? '',
    nombre_base: merma?.nombre_base ?? '',
    abv: merma?.abv ?? '',
    nombre: merma?.nombre ?? '',
    marca: merma?.marca ?? '',
    formato: merma?.formato ?? '',
    uds: merma?.uds != null ? String(merma.uds) : '',
    ud_std: merma?.ud_std ?? 'Kg.',
    precio_total: merma?.precio_total != null ? String(merma.precio_total) : '',
    sp1_nombre: merma?.sp1_nombre ?? '',
    sp1_peso_g: merma?.sp1_peso_g != null ? String(merma.sp1_peso_g) : '',
    sp1_euros: merma?.sp1_euros != null ? String(merma.sp1_euros) : '',
    sp1_valorable: merma?.sp1_valorable ?? false,
    sp2_nombre: merma?.sp2_nombre ?? '',
    sp2_peso_g: merma?.sp2_peso_g != null ? String(merma.sp2_peso_g) : '',
    sp2_euros: merma?.sp2_euros != null ? String(merma.sp2_euros) : '',
    sp2_valorable: merma?.sp2_valorable ?? false,
    sp1_eur_kg_mercado: (merma as any)?.sp1_eur_kg_mercado != null ? String((merma as any).sp1_eur_kg_mercado) : '',
    sp2_eur_kg_mercado: (merma as any)?.sp2_eur_kg_mercado != null ? String((merma as any).sp2_eur_kg_mercado) : '',
    num_porciones: merma?.num_porciones != null ? String(merma.num_porciones) : '',
    peso_porcion_g: merma?.peso_porcion_g != null ? String(merma.peso_porcion_g) : '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleEliminar = async () => {
    if (!merma) return
    setDeleting(true)
    try {
      await supabase.from('mermas').delete().eq('id', merma.id)
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

  const set = (k: string, val: string | boolean) => setF(p => ({ ...p, [k]: val }))
  const onAbvChange = (v: string) => {
    const up = v.toUpperCase()
    setF(p => ({ ...p, abv: up, marca: MARCA_MAP[up] || p.marca }))
  }

  const uds = parseFloat(f.uds) || 0
  const udStdLower = (f.ud_std ?? '').toLowerCase()
  const factor = (udStdLower.startsWith('kg') || udStdLower.startsWith('l')) ? 1000 : 1
  const totalG = uds * factor
  const sp1g = parseFloat(f.sp1_peso_g) || 0
  const sp2g = parseFloat(f.sp2_peso_g) || 0
  const sp1Pct = totalG > 0 ? sp1g / totalG : 0
  const sp2Pct = totalG > 0 ? sp2g / totalG : 0
  const pctMerma = sp1Pct + sp2Pct
  const pctLimpio = 1 - pctMerma
  const precioTotal = parseFloat(f.precio_total) || 0
  const netoKg = (totalG * pctLimpio) / 1000
  const eurKgNeto = netoKg > 0 ? precioTotal / netoKg : 0
  const eurPiezaLimpia = precioTotal * pctLimpio
  const numPorc = parseFloat(f.num_porciones) || 0
  const eurPorcion = numPorc > 0 ? eurPiezaLimpia / numPorc : 0

  const sp1EurosAuto = totalG > 0 ? (precioTotal / totalG) * sp1g : 0
  const sp1MercadoVal = parseFloat(f.sp1_eur_kg_mercado) || 0
  const sp1EurosFinal = sp1MercadoVal > 0 ? (sp1MercadoVal / 1000) * sp1g : sp1EurosAuto
  const sp2EurosAuto = totalG > 0 ? (precioTotal / totalG) * sp2g : 0
  const sp2MercadoVal = parseFloat(f.sp2_eur_kg_mercado) || 0
  const sp2EurosFinal = sp2MercadoVal > 0 ? (sp2MercadoVal / 1000) * sp2g : sp2EurosAuto
  const pctDescarte = (!f.sp1_valorable ? sp1Pct : 0) + (!f.sp2_valorable ? sp2Pct : 0)
  const pctUtilizable = (f.sp1_valorable ? sp1Pct : 0) + (f.sp2_valorable ? sp2Pct : 0)

  const handleSave = async () => {
    setErr(null)
    if (!f.nombre_base.trim()) { setErr('Nombre base obligatorio'); return }
    setSaving(true)
    try {
      const payload = {
        iding: f.iding || null,
        categoria: f.categoria || null,
        nombre_base: f.nombre_base.trim(),
        abv: f.abv || null,
        nombre: f.nombre.trim() || f.nombre_base.trim(),
        marca: f.marca || null,
        formato: f.formato || null,
        uds: uds || null,
        ud_std: f.ud_std,
        precio_total: precioTotal || null,
        sp1_nombre: f.sp1_nombre || null,
        sp1_peso_g: sp1g || null,
        sp1_pct: sp1Pct || null,
        sp1_eur_kg_mercado: parseFloat(f.sp1_eur_kg_mercado) || null,
        sp1_euros: sp1EurosFinal || null,
        sp1_valorable: f.sp1_valorable,
        sp2_nombre: f.sp2_nombre || null,
        sp2_peso_g: sp2g || null,
        sp2_pct: sp2Pct || null,
        sp2_eur_kg_mercado: parseFloat(f.sp2_eur_kg_mercado) || null,
        sp2_euros: sp2EurosFinal || null,
        sp2_valorable: f.sp2_valorable,
        pct_descarte: pctDescarte || null,
        pct_merma: pctMerma || null,
        pct_limpio: pctLimpio || null,
        eur_pieza_limpia: eurPiezaLimpia || null,
        eur_kg_neto: eurKgNeto || null,
        neto_kg: netoKg || null,
        num_porciones: numPorc || null,
        peso_porcion_g: parseFloat(f.peso_porcion_g) || null,
        eur_porcion: eurPorcion || null,
      }

      let mermaId = merma?.id
      if (mermaId) {
        const { error } = await supabase.from('mermas').update(payload).eq('id', mermaId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('mermas').insert(payload).select('id').single()
        if (error) throw error
        mermaId = data.id
      }

      const abv = f.abv.toUpperCase() || 'XXX'
      const ingBase = f.nombre_base

      const nombreLimpio = `${ingBase}_Limpio_${abv}_MRM`
      await upsertIngrediente({
        iding: f.iding ? `${f.iding}_LIMPIO` : null,
        categoria: f.categoria || null,
        nombre_base: nombreLimpio,
        abv: 'MRM',
        nombre: nombreLimpio,
        marca: 'Cocina Interna',
        formato: 'Limpio',
        uds: netoKg || null,
        ud_std: 'Kg.',
        ud_min: 'gr.',
        precio_activo: eurKgNeto || 0,
        eur_std: eurKgNeto || 0,
        eur_min: eurKgNeto / 1000 || 0,
        tipo_merma: 'Manual',
        merma_pct: 0,
        coste_neto_std: eurKgNeto || 0,
        coste_neto_min: eurKgNeto / 1000 || 0,
      })

      const pesoPorc = parseFloat(f.peso_porcion_g) || 0
      if (numPorc > 0 && pesoPorc > 0) {
        const nombrePorcion = `${ingBase}_Porcion_${abv}_MRM`
        const eurStdPorc = eurPorcion / (pesoPorc / 1000)
        await upsertIngrediente({
          iding: f.iding ? `${f.iding}_PORCION` : null,
          categoria: f.categoria || null,
          nombre_base: nombrePorcion,
          abv: 'MRM',
          nombre: nombrePorcion,
          marca: 'Cocina Interna',
          formato: 'Porcion',
          uds: pesoPorc / 1000,
          ud_std: 'Kg.',
          ud_min: 'gr.',
          precio_activo: eurPorcion,
          eur_std: eurStdPorc,
          eur_min: eurStdPorc / 1000,
          coste_neto_std: eurStdPorc,
          coste_neto_min: eurStdPorc / 1000,
          tipo_merma: 'Manual',
          merma_pct: 0,
        })
      }

      if (f.sp1_valorable && f.sp1_nombre) {
        const nombreSp1 = `${ingBase}_${f.sp1_nombre}_${abv}_MRM`
        await upsertIngrediente({
          iding: f.iding ? `${f.iding}_${f.sp1_nombre.toUpperCase().slice(0, 3)}` : null,
          categoria: f.categoria || null,
          nombre_base: nombreSp1,
          abv: 'MRM',
          nombre: nombreSp1,
          marca: 'Cocina Interna',
          formato: 'Subproducto',
          uds: sp1g / 1000 || null,
          ud_std: 'Kg.',
          ud_min: 'gr.',
          precio_activo: parseFloat(f.sp1_euros) || 0,
        })
      }

      if (f.sp2_valorable && f.sp2_nombre) {
        const nombreSp2 = `${ingBase}_${f.sp2_nombre}_${abv}_MRM`
        await upsertIngrediente({
          iding: f.iding ? `${f.iding}_${f.sp2_nombre.toUpperCase().slice(0, 3)}` : null,
          categoria: f.categoria || null,
          nombre_base: nombreSp2,
          abv: 'MRM',
          nombre: nombreSp2,
          marca: 'Cocina Interna',
          formato: 'Subproducto',
          uds: sp2g / 1000 || null,
          ud_std: 'Kg.',
          ud_min: 'gr.',
          precio_activo: parseFloat(f.sp2_euros) || 0,
        })
      }

      if (f.iding) {
        await supabase.from('ingredientes').update({
          merma_pct: pctMerma * 100,
          tipo_merma: 'Tecnica',
          coste_neto_std: eurKgNeto,
          coste_neto_min: eurKgNeto / 1000,
        }).eq('iding', f.iding)
      }

      onSaved()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const nombreCompleto = f.nombre_base && f.abv ? `${f.nombre_base}_${f.abv}` : (f.nombre || f.nombre_base || '—')

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-5xl my-8" style={{ background: CREMA, maxHeight: '92vh', overflowY: 'auto', border: `4px solid ${INK}`, borderRadius: 0, boxShadow: `6px 6px 0 ${INK}` }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '20px 24px', borderBottom: `4px solid ${INK}`, background: AMA }}>
          <div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1, letterSpacing: '-0.5px', textTransform: 'uppercase', color: INK }}>{isEdit ? 'Editar merma' : 'Nueva merma'}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ background: BLANCO, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: INK, padding: '3px 10px' }}>{nombreCompleto}</span>
              {f.abv && <span style={{ background: AZUL, color: BLANCO, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', padding: '3px 10px' }}>{f.abv}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: BLANCO, border: `2px solid ${INK}`, width: 36, height: 36, fontSize: 20, lineHeight: 1, cursor: 'pointer', color: INK, flexShrink: 0 }}>×</button>
        </div>

        <div className="p-5 space-y-4">
          <Section title="Identidad">
            <div className="grid grid-cols-5 gap-2">
              <Field label="IDING" value={f.iding} onChange={v => set('iding', v)} />
              <Field label="Categoría" value={f.categoria} onChange={v => set('categoria', v)} list="mcats" />
              <datalist id="mcats">{cfg.categorias.map(c => <option key={c} value={c} />)}</datalist>
              <Field label="Nombre Base" value={f.nombre_base} onChange={v => set('nombre_base', v)} />
              <Field label="ABV" value={f.abv} onChange={onAbvChange} />
              <Field label="Formato" value={f.formato} onChange={v => set('formato', v)} />
            </div>
            <div className="grid grid-cols-5 gap-2 mt-2">
              <Field label="Precio Total" type="number" step="0.01" value={f.precio_total} onChange={v => set('precio_total', v)} />
              <Field label="UDS" type="number" value={f.uds} onChange={v => set('uds', v)} />
              <SelectField label="UD STD" value={f.ud_std} onChange={v => set('ud_std', v)} options={cfg.unidades} />
              <Field label="Peso Total (g)" value={fmtNum(totalG)} onChange={() => {}} disabled />
              <Field label="Neto Kg" value={fmtNum(netoKg)} onChange={() => {}} disabled highlight />
            </div>
          </Section>

          <div className="bg-[#FCEFD6] border-[3px] border-[#140f08] rounded-none p-4 space-y-3">
            <div style={{ fontFamily: OSW, fontSize: '11px', color: GRIS, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Subproductos</div>
            <div className="grid grid-cols-6 gap-2 items-end">
              <Field label="Nombre SP1" value={f.sp1_nombre} onChange={v => set('sp1_nombre', v)} />
              <Field label="Peso SP1 (g)" type="number" value={f.sp1_peso_g} onChange={v => set('sp1_peso_g', v)} />
              <Field label="% SP1" value={fmtPct(sp1Pct)} onChange={() => {}} disabled />
              <Field label="€/Kg Mercado" type="number" step="0.01" value={f.sp1_eur_kg_mercado} onChange={v => set('sp1_eur_kg_mercado', v)} />
              <Field label="€ SP1" value={fmtEur(sp1EurosFinal)} placeholder="auto" onChange={() => {}} disabled highlight />
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-[#140f08]">
                  <input type="checkbox" checked={f.sp1_valorable} onChange={e => set('sp1_valorable', e.target.checked)} className="accent-[#140f08] w-4 h-4" />
                  Valorable
                </label>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2 items-end">
              <Field label="Nombre SP2" value={f.sp2_nombre} onChange={v => set('sp2_nombre', v)} />
              <Field label="Peso SP2 (g)" type="number" value={f.sp2_peso_g} onChange={v => set('sp2_peso_g', v)} />
              <Field label="% SP2" value={fmtPct(sp2Pct)} onChange={() => {}} disabled />
              <Field label="€/Kg Mercado" type="number" step="0.01" value={f.sp2_eur_kg_mercado} onChange={v => set('sp2_eur_kg_mercado', v)} />
              <Field label="€ SP2" value={fmtEur(sp2EurosFinal)} placeholder="auto" onChange={() => {}} disabled highlight />
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-[#140f08]">
                  <input type="checkbox" checked={f.sp2_valorable} onChange={e => set('sp2_valorable', e.target.checked)} className="accent-[#140f08] w-4 h-4" />
                  Valorable
                </label>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Field label="Num Porciones" type="number" value={f.num_porciones} onChange={v => set('num_porciones', v)} />
              <Field label="Peso Porción (g)" type="number" value={f.peso_porcion_g} onChange={v => set('peso_porcion_g', v)} />
              <Field label="€/Porción" value={fmtEur(eurPorcion)} onChange={() => {}} disabled highlight />
              <div />
            </div>
            <div style={{ borderTop: `2px solid ${INK}`, paddingTop: '8px', fontFamily: OSW, fontSize: '11px', color: GRIS, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Cálculos</div>
            <div className="grid grid-cols-7 gap-2">
              <Field label="% Descarte" value={fmtPct(pctDescarte)} onChange={() => {}} disabled style={{ maxWidth: '100px' }} />
              <Field label="% Utilizable" value={fmtPct(pctUtilizable)} onChange={() => {}} disabled style={{ maxWidth: '100px' }} />
              <Field label="% Merma" value={fmtPct(pctMerma)} onChange={() => {}} disabled style={{ maxWidth: '100px' }} />
              <Field label="% Limpio" value={fmtPct(pctLimpio)} onChange={() => {}} disabled style={{ maxWidth: '100px' }} />
              <Field label="€/Kg Neto" value={fmtNum(eurKgNeto)} onChange={() => {}} disabled highlight />
              <Field label="EUR/MIN" value={fmtNum(eurKgNeto / 1000)} onChange={() => {}} disabled highlight />
              <Field label="€/Pieza Limpia" value={fmtEur(eurPiezaLimpia)} onChange={() => {}} disabled />
            </div>
          </div>

          {err && <p className="text-[#FF1E27] text-sm">{err}</p>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 24px', borderTop: `4px solid ${INK}`, background: BLANCO, position: 'sticky', bottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isEdit && !confirmEliminar && (
              <button onClick={() => setConfirmEliminar(true)} style={{ background: 'transparent', border: `2px solid ${GRANATE}`, color: GRANATE, padding: '11px 18px', borderRadius: 0, fontFamily: OSW, fontWeight: 700, fontSize: '.78rem', letterSpacing: '1px', cursor: 'pointer', minHeight: 44 }}>ELIMINAR</button>
            )}
            {isEdit && confirmEliminar && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: GRANATE, fontFamily: LEX }}>¿Eliminar definitivamente?</span>
                <button onClick={handleEliminar} disabled={deleting} style={{ background: GRANATE, color: BLANCO, border: `2px solid ${INK}`, padding: '7px 12px', borderRadius: 0, cursor: 'pointer', fontFamily: OSW, fontWeight: 700, fontSize: '.7rem', opacity: deleting ? 0.5 : 1 }}>{deleting ? 'ELIMINANDO…' : 'SÍ, ELIMINAR'}</button>
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

async function upsertIngrediente(row: Record<string, unknown>) {
  const nombre = row.nombre_base as string
  const { data: existing } = await supabase
    .from('ingredientes')
    .select('id')
    .eq('nombre_base', nombre)
    .maybeSingle()
  if (existing) {
    await supabase.from('ingredientes').update(row).eq('id', existing.id)
  } else {
    await supabase.from('ingredientes').insert(row)
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#FCEFD6] border-[3px] border-[#140f08] rounded-none p-4">
      <h4 className="text-[11px] uppercase tracking-wider text-[#140f08] font-semibold mb-3" style={{ fontFamily: OSW, letterSpacing: '1px' }}>{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, type, step, disabled, highlight, list, placeholder, style }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; step?: string; disabled?: boolean; highlight?: boolean; list?: string; placeholder?: string; style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <label className={labelCls} style={{ fontFamily: OSW, letterSpacing: '1px' }}>{label}</label>
      <input
        type={type ?? 'text'} step={step} value={value} onChange={e => onChange(e.target.value)}
        disabled={disabled} list={list} placeholder={placeholder}
        className={inputCls + (disabled ? ' opacity-70' : '')}
        style={{ fontFamily: LEX, ...(highlight ? { backgroundColor: AMA, color: INK, fontWeight: 700, borderColor: INK } : {}) }}
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className={labelCls} style={{ fontFamily: OSW, letterSpacing: '1px' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={inputCls} style={{ fontFamily: LEX }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
