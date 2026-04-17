import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'

/* ═══════ TYPES ═══════ */

interface Proveedor { id: string; abv: string; nombre_completo: string; categoria: string | null; activo: boolean }
interface Canal { id: string; canal: string; comision_pct: number | null; coste_fijo: number | null; margen_deseado_pct?: number | null; activo?: boolean }
interface ConfigItem { id: string; clave: string; valor: string }

type Section = 'plataformas' | 'costes' | 'proveedores' | 'categorias' | 'unidades'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'plataformas', label: 'Plataformas' },
  { key: 'costes', label: 'Costes' },
  { key: 'proveedores', label: 'Proveedores/ABV' },
  { key: 'categorias', label: 'Categorías' },
  { key: 'unidades', label: 'Unidades' },
]

const inputCls = 'w-full bg-[#f5f5f5] border border-[#dddddd] rounded-lg px-3 py-2 text-sm text-[#1a1a1a] focus:outline-none focus:border-accent'
const btnPrimary = 'px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:brightness-110 transition'
const btnSecondary = 'px-4 py-2 text-sm text-[#555] border border-[#dddddd] rounded-lg hover:text-[#1a1a1a] hover:border-[#555] transition'

/* ═══════ MAIN ═══════ */

export default function Configuracion() {
  const [section, setSection] = useState<Section>('plataformas')
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey(k => k + 1)

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#1a1a1a] tracking-tight mb-5">Configuración</h2>
      <div className="flex gap-1 mb-5 bg-card border border-[#dddddd] rounded-lg p-1 w-fit flex-wrap">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${section === s.key ? 'bg-accent text-[#111]' : 'text-[#555] hover:text-[#1a1a1a]'}`}>
            {s.label}
          </button>
        ))}
      </div>
      {section === 'plataformas' && <SecPlataformas key={refreshKey} onRefresh={refresh} />}
      {section === 'costes' && <SecCostes key={refreshKey} onRefresh={refresh} />}
      {section === 'proveedores' && <SecProveedores key={refreshKey} onRefresh={refresh} />}
      {section === 'categorias' && <SecLista key={`c-${refreshKey}`} clave="categorias" label="Categoría" onRefresh={refresh} />}
      {section === 'unidades' && <SecLista key={`u-${refreshKey}`} clave="unidades" label="Unidad" onRefresh={refresh} />}
    </div>
  )
}

/* ═══════ PLATAFORMAS (config_canales) ═══════ */

function SecPlataformas({ onRefresh: _onRefresh }: { onRefresh: () => void }) {
  const [rows, setRows] = useState<Canal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase.from('config_canales').select('*').order('canal')
      if (!c) { setRows((data as Canal[]) ?? []); setLoading(false) }
    })()
    return () => { c = true }
  }, [])

  const update = async (id: string, field: string, val: string | boolean) => {
    const payload = typeof val === 'boolean' ? { [field]: val } : { [field]: parseFloat(val) || 0 }
    setSaving(true)
    await supabase.from('config_canales').update(payload).eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...payload } : r))
    setSaving(false)
  }

  if (loading) return <Loader />

  return (
    <div>
      {saving && <div className="text-xs text-[#1a1a1a] mb-2">Guardando…</div>}
      <div className="bg-card border border-[#dddddd] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-[#888] font-semibold bg-[#f5f5f5] border-b border-[#dddddd]">Canal</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-[#888] font-semibold bg-[#f5f5f5] border-b border-[#dddddd]">Comisión %</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-[#888] font-semibold bg-[#f5f5f5] border-b border-[#dddddd]">Coste Fijo €</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-[#888] font-semibold bg-[#f5f5f5] border-b border-[#dddddd]">Margen deseado %</th>
              <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider text-[#888] font-semibold bg-[#f5f5f5] border-b border-[#dddddd]">Activa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 text-[#1a1a1a] font-medium border-b border-[#dddddd]">{r.canal}</td>
                <td className="px-4 py-2.5 text-right border-b border-[#dddddd]">
                  <input type="number" step="0.1" defaultValue={r.comision_pct ?? 0}
                    onBlur={e => update(r.id, 'comision_pct', e.target.value)}
                    className="w-24 bg-[#f5f5f5] border border-[#dddddd] rounded px-2 py-1 text-sm text-[#1a1a1a] text-right" />
                </td>
                <td className="px-4 py-2.5 text-right border-b border-[#dddddd]">
                  <input type="number" step="0.01" defaultValue={r.coste_fijo ?? 0}
                    onBlur={e => update(r.id, 'coste_fijo', e.target.value)}
                    className="w-24 bg-[#f5f5f5] border border-[#dddddd] rounded px-2 py-1 text-sm text-[#1a1a1a] text-right" />
                </td>
                <td className="px-4 py-2.5 text-right border-b border-[#dddddd]">
                  <input type="number" step="0.1" defaultValue={r.margen_deseado_pct ?? 15}
                    onBlur={e => update(r.id, 'margen_deseado_pct', e.target.value)}
                    className="w-24 bg-[#f5f5f5] border border-[#dddddd] rounded px-2 py-1 text-sm text-[#1a1a1a] text-right" />
                </td>
                <td className="px-4 py-2.5 text-center border-b border-[#dddddd]">
                  <input type="checkbox" checked={r.activo ?? true}
                    onChange={e => update(r.id, 'activo', e.target.checked)}
                    className="accent-accent w-4 h-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════ COSTES ═══════ */

function SecCostes({ onRefresh: _onRefresh }: { onRefresh: () => void }) {
  const [estructura, setEstructura] = useState('30')
  const [margen, setMargen] = useState('15')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase.from('configuracion').select('*').in('clave', ['estructura_pct', 'margen_deseado_pct'])
      if (!c && data) {
        const e = (data as ConfigItem[]).find(x => x.clave === 'estructura_pct')
        const m = (data as ConfigItem[]).find(x => x.clave === 'margen_deseado_pct')
        if (e) setEstructura(e.valor)
        if (m) setMargen(m.valor)
        setLoading(false)
      }
    })()
    return () => { c = true }
  }, [])

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await supabase.from('configuracion').upsert([
        { clave: 'estructura_pct', valor: estructura },
        { clave: 'margen_deseado_pct', valor: margen },
      ], { onConflict: 'clave' })
      setMsg('Guardado')
    } catch (e: any) {
      setMsg('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loader />

  return (
    <div className="bg-card border border-[#dddddd] rounded-xl p-6 max-w-lg space-y-4">
      <div>
        <label className="block text-xs text-[#888] mb-1.5">Coste estructura (%)</label>
        <input type="number" step="0.1" value={estructura} onChange={e => setEstructura(e.target.value)} className={inputCls} />
        <p className="text-[11px] text-[#666] mt-1">Se aplica sobre PVP neto (sin IVA) en todas las recetas</p>
      </div>
      <div>
        <label className="block text-xs text-[#888] mb-1.5">Margen deseado (%)</label>
        <input type="number" step="0.1" value={margen} onChange={e => setMargen(e.target.value)} className={inputCls} />
        <p className="text-[11px] text-[#666] mt-1">Usado en fórmula de PVP recomendado</p>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button onClick={save} disabled={saving} className={btnPrimary + ' disabled:opacity-50'}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {msg && <span className={'text-xs ' + (msg.startsWith('Error') ? 'text-[#dc2626]' : 'text-[#16a34a]')}>{msg}</span>}
      </div>
    </div>
  )
}

/* ═══════ PROVEEDORES ═══════ */

function SecProveedores({ onRefresh }: { onRefresh: () => void }) {
  const [rows, setRows] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Proveedor | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase.from('config_proveedores').select('*').order('abv')
      if (!c) { setRows((data as Proveedor[]) ?? []); setLoading(false) }
    })()
    return () => { c = true }
  }, [])

  if (loading) return <Loader />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#888]">{rows.length} proveedores</span>
        <button onClick={() => setShowAdd(true)} className={btnPrimary + ' ml-auto'}>+ Añadir proveedor</button>
      </div>
      <div className="bg-card border border-[#dddddd] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-[#888] font-semibold bg-[#f5f5f5] border-b border-[#dddddd]">ABV</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-[#888] font-semibold bg-[#f5f5f5] border-b border-[#dddddd]">Nombre completo</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-[#888] font-semibold bg-[#f5f5f5] border-b border-[#dddddd]">Categoría</th>
              <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider text-[#888] font-semibold bg-[#f5f5f5] border-b border-[#dddddd]">Activo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} onClick={() => setEdit(r)} className="cursor-pointer">
                <td className="px-4 py-2.5 text-[#1a1a1a] font-mono text-xs font-bold border-b border-[#dddddd]">{r.abv}</td>
                <td className="px-4 py-2.5 text-[#1a1a1a] border-b border-[#dddddd]">{r.nombre_completo}</td>
                <td className="px-4 py-2.5 text-[#555] border-b border-[#dddddd]">{r.categoria ?? '—'}</td>
                <td className="px-4 py-2.5 text-center border-b border-[#dddddd]">
                  {r.activo ? <span className="text-[#16a34a]">●</span> : <span className="text-[#666]">○</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdd && <ProvModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onRefresh() }} />}
      {edit && <ProvModal existing={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onRefresh() }} />}
    </div>
  )
}

function ProvModal({ existing, onClose, onSaved }: { existing?: Proveedor; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!existing
  const [f, setF] = useState({ abv: existing?.abv ?? '', nombre_completo: existing?.nombre_completo ?? '', categoria: existing?.categoria ?? '', activo: existing?.activo ?? true })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.abv.trim() || !f.nombre_completo.trim()) { setErr('ABV y nombre son obligatorios'); return }
    setSaving(true)
    const payload = { abv: f.abv.trim().toUpperCase(), nombre_completo: f.nombre_completo.trim(), categoria: f.categoria || null, activo: f.activo }
    const { error } = isEdit
      ? await supabase.from('config_proveedores').update(payload).eq('id', existing!.id)
      : await supabase.from('config_proveedores').insert(payload)
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar proveedor' : 'Añadir proveedor'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="ABV" value={f.abv} onChange={v => setF(p => ({ ...p, abv: v }))} placeholder="MER" />
          <Field label="Nombre completo" value={f.nombre_completo} onChange={v => setF(p => ({ ...p, nombre_completo: v }))} placeholder="Mercadona" />
        </div>
        <Field label="Categoría" value={f.categoria} onChange={v => setF(p => ({ ...p, categoria: v }))} placeholder="Supermercado, Mayorista..." />
        <label className="flex items-center gap-2 text-sm text-[#555]">
          <input type="checkbox" checked={f.activo} onChange={e => setF(p => ({ ...p, activo: e.target.checked }))} className="accent-accent" /> Activo
        </label>
        {err && <p className="text-[#dc2626] text-sm">{err}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary + ' flex-1'}>Cancelar</button>
          <button type="submit" disabled={saving} className={btnPrimary + ' flex-1 disabled:opacity-50'}>
            {saving ? 'Guardando…' : isEdit ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ═══════ LISTA EDITABLE (categorias / unidades) ═══════ */

function SecLista({ clave, label, onRefresh }: { clave: string; label: string; onRefresh: () => void }) {
  const [items, setItems] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [nuevo, setNuevo] = useState('')

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase.from('configuracion').select('*').eq('clave', clave).single()
      if (!c) {
        const list = data?.valor ? JSON.parse(data.valor) : []
        setItems(Array.isArray(list) ? list : [])
        setLoading(false)
      }
    })()
    return () => { c = true }
  }, [clave])

  const persist = async (next: string[]) => {
    await supabase.from('configuracion').upsert({ clave, valor: JSON.stringify(next) }, { onConflict: 'clave' })
    onRefresh()
  }

  const add = async () => {
    if (!nuevo.trim()) return
    const next = [...items, nuevo.trim()]
    setItems(next)
    setNuevo('')
    await persist(next)
  }

  const remove = async (idx: number) => {
    const next = items.filter((_, i) => i !== idx)
    setItems(next)
    await persist(next)
  }

  if (loading) return <Loader />

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex gap-2">
        <input value={nuevo} onChange={e => setNuevo(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={`Nueva ${label.toLowerCase()}…`} className={inputCls} />
        <button onClick={add} className={btnPrimary}>+ Añadir</button>
      </div>
      <div className="bg-card border border-[#dddddd] rounded-xl overflow-hidden">
        {items.length === 0 ? (
          <div className="p-8 text-center text-[#666] text-sm">Sin items</div>
        ) : items.map((it, idx) => (
          <div key={idx} className="flex items-center justify-between px-4 py-2.5 border-b border-[#dddddd] last:border-b-0">
            <span className="text-[#1a1a1a] text-sm">{it}</span>
            <button onClick={() => remove(idx)} className="text-xs text-[#666] hover:text-[#dc2626] transition">Eliminar</button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════ SHARED ═══════ */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-[#dddddd] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#dddddd]">
          <h3 className="text-[#1a1a1a] font-semibold">{title}</h3>
          <button onClick={onClose} className="text-[#888] hover:text-[#1a1a1a] text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-[#888] mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </div>
  )
}

function Loader() {
  return (
    <div className="bg-card border border-[#dddddd] rounded-xl p-12 text-center">
      <div className="inline-block h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-[#888] text-sm mt-3">Cargando…</p>
    </div>
  )
}
