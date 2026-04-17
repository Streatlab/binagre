import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtNum } from '@/utils/format'
import { useConfig } from '@/hooks/useConfig'
import { MARCA_MAP } from './types'
import type { Ingrediente, Merma } from './types'

interface Props {
  ingrediente: Ingrediente | null
  onClose: () => void
  onSaved: () => void
  onOpenMerma?: (m: Merma | null) => void
}

const inputCls = 'w-full bg-[#484f66] border border-[#4a5270] rounded-lg px-3 py-2 text-sm text-[#f0f0ff] placeholder:text-[#7a84a8] focus:outline-none focus:border-[#1a1a1a]'
const labelCls = 'block text-[11px] text-[#7080a8] mb-1 uppercase tracking-wider'
const btnPrimary = 'px-4 py-2 bg-[#B01D23] text-accent text-sm font-semibold rounded-lg hover:brightness-110 transition'
const btnSecondary = 'px-4 py-2 text-sm text-[#c8d0e8] border border-[#4a5270] rounded-lg hover:text-[#f0f0ff] hover:border-[#6070a0] transition'

export default function ModalIngrediente({ ingrediente, onClose, onSaved, onOpenMerma }: Props) {
  const isEdit = !!ingrediente
  const cfg = useConfig()
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
    precio2: ingrediente?.precio2 != null ? String(ingrediente.precio2) : '',
    precio3: ingrediente?.precio3 != null ? String(ingrediente.precio3) : '',
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

  // ABV autocompleta proveedor/marca: primero config_proveedores, fallback a MARCA_MAP
  const onAbvChange = (v: string) => {
    const up = v.toUpperCase()
    const prov = cfg.proveedores.find(p => p.abv === up)
    const marcaFromCfg = prov?.marca_asociada || prov?.nombre_completo
    const mapped = marcaFromCfg || MARCA_MAP[up]
    setF(p => ({ ...p, abv: up, marca: mapped || p.marca }))
  }

  // UD STD → UD MIN automático (Kg→gr, L→ml, Ud→ud)
  const onUdStdChange = (v: string) => {
    const lower = v.toLowerCase()
    let udMin = v
    if (lower.startsWith('kg')) udMin = 'gr.'
    else if (lower.startsWith('l')) udMin = 'ml.'
    else if (lower.startsWith('ud')) udMin = 'ud.'
    setF(p => ({ ...p, ud_std: v, ud_min: udMin }))
  }

  // Calcular precio activo según selector
  const p1 = parseFloat(f.precio1) || 0
  const p2 = parseFloat(f.precio2) || 0
  const p3 = parseFloat(f.precio3) || 0
  const ultimo = parseFloat(f.ultimo_precio) || 0
  const precios = [p1, p2, p3].filter(p => p > 0)
  const media = precios.length ? precios.reduce((a, b) => a + b, 0) / precios.length : 0
  const precioActivo = f.selector_precio === 'ultimo' ? (ultimo || precios[precios.length - 1] || 0) : media

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
    setSaving(true)
    try {
      // Nombre concatenado NombreBase_ABV según FIX 2.8
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
        ultimo_precio: ultimo || null,
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

      // Logica Tipo Merma "Tecnica" -> crear entrada en mermas si no existe
      if (f.tipo_merma === 'Tecnica' && ingId) {
        const { data: existing } = await supabase
          .from('mermas')
          .select('*')
          .eq('iding', f.iding || '')
          .maybeSingle()
        if (!existing) {
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
      <div className="bg-[#484f66] border border-[#4a5270] rounded-xl w-full max-w-5xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#4a5270]">
          <div>
            <h3 className="text-base font-semibold text-[#f0f0ff]">{isEdit ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}</h3>
            {f.iding && <p className="text-xs text-[#7080a8] mt-0.5 font-mono">{f.iding}</p>}
          </div>
          <button onClick={onClose} className="text-[#7080a8] hover:text-[#f0f0ff] transition text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Identidad */}
          <Section title="Identidad">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="IDING" value={f.iding} onChange={v => set('iding', v)} placeholder="ING001" />
              <SelectField label="Categoría" value={f.categoria} onChange={v => set('categoria', v)} options={cfg.categorias} />
              <Field label="Nombre Base" value={f.nombre_base} onChange={v => set('nombre_base', v)} placeholder="Tomate" />
              <SelectField label="ABV" value={f.abv} onChange={onAbvChange} options={cfg.proveedores.map(p => p.abv)} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Nombre completo (auto)</label>
                <div className="w-full bg-[#353a50] border border-[#4a5270] rounded-lg px-3 py-2 text-sm text-[#f0f0ff]">
                  {f.nombre_base && f.abv ? `${f.nombre_base}_${f.abv}` : (f.nombre || '—')}
                </div>
              </div>
              <Field label="Proveedor" value={cfg.proveedores.find(p => p.abv === f.abv.toUpperCase())?.nombre_completo || MARCA_MAP[f.abv.toUpperCase()] || ''} onChange={() => {}} disabled />
              <Field label="Marca" value={f.marca} onChange={v => set('marca', v)} />
              <SelectField label="Formato" value={f.formato} onChange={v => set('formato', v)} options={cfg.formatos} />
            </div>
          </Section>

          {/* Unidades */}
          <Section title="Unidades">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Peso/Vol. por unidad (UD STD)" type="number" value={f.uds} onChange={v => set('uds', v)} placeholder="5" />
              <SelectField label="UD STD" value={f.ud_std} onChange={onUdStdChange} options={['Kg.', 'L.', 'Ud.']} />
              <div>
                <label className={labelCls}>UD MIN (auto)</label>
                <div className="w-full bg-[#353a50] border border-[#4a5270] rounded-lg px-3 py-2 text-sm text-[#c8d0e8]">{f.ud_min}</div>
              </div>
              <Field label="USOS" value={String(f.usos)} onChange={() => {}} disabled />
            </div>
          </Section>

          {/* Precios */}
          <Section title="Precios">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Precio 1" type="number" value={f.precio1} onChange={v => set('precio1', v)} step="0.01" />
              <Field label="Precio 2" type="number" value={f.precio2} onChange={v => set('precio2', v)} step="0.01" />
              <Field label="Precio 3" type="number" value={f.precio3} onChange={v => set('precio3', v)} step="0.01" />
              <Field label="Último Precio" type="number" value={f.ultimo_precio} onChange={v => set('ultimo_precio', v)} step="0.01" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Selector</label>
                <select value={f.selector_precio} onChange={e => set('selector_precio', e.target.value)} className={inputCls}>
                  <option value="ultimo">Último</option>
                  <option value="media">Media</option>
                </select>
              </div>
              <Field label="Precio Activo" value={fmtNum(precioActivo, 4)} onChange={() => {}} disabled highlight />
              <Field label="EUR/STD" value={fmtNum(eurStd, 4)} onChange={() => {}} disabled />
              <Field label="EUR/MIN" value={fmtNum(eurMin, 6)} onChange={() => {}} disabled />
            </div>
          </Section>

          {/* Merma */}
          <Section title="Merma">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Tipo Merma</label>
                <select value={f.tipo_merma ?? ''} onChange={e => set('tipo_merma', e.target.value || null)} className={inputCls}>
                  <option value="">—</option>
                  <option value="Manual">Manual</option>
                  <option value="Tecnica">Técnica (abrirá modal de merma)</option>
                </select>
              </div>
              <Field label="Merma %" type="number" value={f.merma_pct} onChange={v => set('merma_pct', v)} step="0.1" disabled={f.tipo_merma === 'Tecnica'} />
              <Field label="C.Neto/STD" value={fmtNum(costeNetoStd, 4)} onChange={() => {}} disabled />
              <Field label="C.Neto/MIN" value={fmtNum(costeNetoMin, 6)} onChange={() => {}} disabled />
            </div>
          </Section>

          {/* Estado */}
          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 text-sm text-[#c8d0e8]">
              <input type="checkbox" checked={f.activo} onChange={e => set('activo', e.target.checked)} className="accent-accent w-4 h-4" />
              Ingrediente activo
            </label>
          </div>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#2a2a2a] border border-[#4a5270] rounded-lg p-4">
      <h4 className="text-[11px] uppercase tracking-wider text-[#7080a8] font-semibold mb-3">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type, step, disabled, highlight, list }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; step?: string; disabled?: boolean; highlight?: boolean; list?: string
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type={type ?? 'text'} step={step} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled} list={list}
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
