import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtNum } from '@/utils/format'
import { useConfig } from '@/hooks/useConfig'
import { MARCA_MAP } from './types'
import type { Merma } from './types'

interface Props {
  merma: Merma | null
  onClose: () => void
  onSaved: () => void
}

const inputCls = 'w-full bg-[#3a4058] border border-[#4a5270] rounded-lg px-3 py-2 text-sm text-[#f0f0ff] placeholder:text-[#8090b8] focus:outline-none focus:border-accent'
const labelCls = 'block text-[11px] text-[#7080a8] mb-1 uppercase tracking-wider'
const btnPrimary = 'px-4 py-2 bg-accent text-[#111] text-sm font-semibold rounded-lg hover:brightness-110 transition'
const btnSecondary = 'px-4 py-2 text-sm text-[#c8d0e8] border border-[#4a5270] rounded-lg hover:text-[#f0f0ff] hover:border-[#6070a0] transition'

export default function ModalMerma({ merma, onClose, onSaved }: Props) {
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

  // Cálculos derivados
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
  const sp1EurosFinal = f.sp1_eur_kg_mercado ? (parseFloat(f.sp1_eur_kg_mercado) / 1000) * sp1g : sp1EurosAuto
  const sp2EurosAuto = totalG > 0 ? (precioTotal / totalG) * sp2g : 0
  const sp2EurosFinal = f.sp2_eur_kg_mercado ? (parseFloat(f.sp2_eur_kg_mercado) / 1000) * sp2g : sp2EurosAuto
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

      // Auto-generacion ingredientes derivados _Limpio_ABV_MRM y subproductos valorables
      const abv = f.abv.toUpperCase() || 'XXX'
      const ingBase = f.nombre_base

      // _Limpio_ABV_MRM
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

      // _Porcion_ABV_MRM si numPorc > 0
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

      // SP1 Valorable
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

      // SP2 Valorable
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

      // Actualizar merma_pct del ingrediente original
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
      <div className="border border-[#4a5270] rounded-xl w-full max-w-4xl my-8 shadow-2xl" style={{ background: '#484f66' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#4a5270]">
          <div>
            <h3 className="text-base font-semibold text-[#f0f0ff]">{isEdit ? 'Editar Merma' : 'Nueva Merma'}</h3>
          </div>
          <button onClick={onClose} className="text-[#7080a8] hover:text-[#f0f0ff] transition text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">
          <Section title="Identidad">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="IDING" value={f.iding} onChange={v => set('iding', v)} style={{ maxWidth: '120px' }} />
              <Field label="Categoría" value={f.categoria} onChange={v => set('categoria', v)} list="mcats" />
              <datalist id="mcats">{cfg.categorias.map(c => <option key={c} value={c} />)}</datalist>
              <Field label="Nombre Base" value={f.nombre_base} onChange={v => set('nombre_base', v)} style={{ maxWidth: '200px' }} />
              <Field label="ABV" value={f.abv} onChange={onAbvChange} style={{ maxWidth: '120px' }} />
              <Field label="Nombre" value={f.nombre} onChange={v => set('nombre', v)} style={{ maxWidth: '200px' }} />
              <Field label="Marca" value={f.marca} onChange={v => set('marca', v)} />
              <Field label="Formato" value={f.formato} onChange={v => set('formato', v)} />
              <Field label="Precio Total" type="number" step="0.01" value={f.precio_total} onChange={v => set('precio_total', v)} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <Field label="UDS" type="number" value={f.uds} onChange={v => set('uds', v)} style={{ maxWidth: '120px' }} />
              <SelectField label="UD STD" value={f.ud_std} onChange={v => set('ud_std', v)} options={cfg.unidades} />
              <Field label="Total gramos" value={fmtNum(totalG, 0)} onChange={() => {}} disabled style={{ maxWidth: '120px' }} />
              <Field label="Neto Kg" value={fmtNum(netoKg, 3)} onChange={() => {}} disabled highlight style={{ maxWidth: '120px' }} />
            </div>
          </Section>

          <Section title="Subproducto 1 (SP1)">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
              <Field label="Nombre SP1" value={f.sp1_nombre} onChange={v => set('sp1_nombre', v)} />
              <Field label="Peso (g)" type="number" value={f.sp1_peso_g} onChange={v => set('sp1_peso_g', v)} />
              <Field label="%" value={fmtNum(sp1Pct * 100, 1) + '%'} onChange={() => {}} disabled />
              <Field label="€/Kg Mercado" type="number" step="0.01" value={f.sp1_eur_kg_mercado} onChange={v => set('sp1_eur_kg_mercado', v)} />
              <Field label="€ SP1" value={fmtNum(sp1EurosFinal, 4)} placeholder="auto" onChange={() => {}} disabled highlight />
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-[#c8d0e8]">
                  <input type="checkbox" checked={f.sp1_valorable} onChange={e => set('sp1_valorable', e.target.checked)} className="accent-accent w-4 h-4" />
                  Valorable
                </label>
              </div>
            </div>
          </Section>

          <Section title="Subproducto 2 (SP2)">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
              <Field label="Nombre SP2" value={f.sp2_nombre} onChange={v => set('sp2_nombre', v)} />
              <Field label="Peso (g)" type="number" value={f.sp2_peso_g} onChange={v => set('sp2_peso_g', v)} />
              <Field label="%" value={fmtNum(sp2Pct * 100, 1) + '%'} onChange={() => {}} disabled />
              <Field label="€/Kg Mercado" type="number" step="0.01" value={f.sp2_eur_kg_mercado} onChange={v => set('sp2_eur_kg_mercado', v)} />
              <Field label="€ SP2" value={fmtNum(sp2EurosFinal, 4)} placeholder="auto" onChange={() => {}} disabled highlight />
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-[#c8d0e8]">
                  <input type="checkbox" checked={f.sp2_valorable} onChange={e => set('sp2_valorable', e.target.checked)} className="accent-accent w-4 h-4" />
                  Valorable
                </label>
              </div>
            </div>
          </Section>

          <Section title="Porciones">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Num Porciones" type="number" value={f.num_porciones} onChange={v => set('num_porciones', v)} />
              <Field label="Peso Porción (g)" type="number" value={f.peso_porcion_g} onChange={v => set('peso_porcion_g', v)} />
              <Field label="€/Porción" value={fmtNum(eurPorcion, 4)} onChange={() => {}} disabled highlight />
              <Field label="€/Pieza Limpia" value={fmtNum(eurPiezaLimpia, 4)} onChange={() => {}} disabled />
            </div>
          </Section>

          <Section title="Cálculos">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="% Descarte" value={fmtNum(pctDescarte * 100, 2) + '%'} onChange={() => {}} disabled />
              <Field label="% Utilizable" value={fmtNum(pctUtilizable * 100, 2) + '%'} onChange={() => {}} disabled />
              <Field label="% Merma" value={fmtNum(pctMerma * 100, 2) + '%'} onChange={() => {}} disabled />
              <Field label="% Limpio" value={fmtNum(pctLimpio * 100, 2) + '%'} onChange={() => {}} disabled />
              <Field label="€/Kg Neto" value={fmtNum(eurKgNeto, 4)} onChange={() => {}} disabled highlight />
              <Field label="Neto Kg" value={fmtNum(netoKg, 3)} onChange={() => {}} disabled />
            </div>
          </Section>

          {err && <p className="text-[#dc2626] text-sm">{err}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[#4a5270]">
          <button onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className={btnPrimary + ' disabled:opacity-50'}>
            {saving ? 'Guardando…' : isEdit ? 'Actualizar' : 'Guardar'}
          </button>
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
    <div className="bg-[#404558] border border-[#4a5270] rounded-lg p-4">
      <h4 className="text-[11px] uppercase tracking-wider text-[#7080a8] font-semibold mb-3">{title}</h4>
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
      <label className={labelCls}>{label}</label>
      <input
        type={type ?? 'text'} step={step} value={value} onChange={e => onChange(e.target.value)}
        disabled={disabled} list={list} placeholder={placeholder}
        className={inputCls + (disabled ? ' opacity-60' : '') + (highlight ? ' text-[#f0f0ff] font-bold' : '')}
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
