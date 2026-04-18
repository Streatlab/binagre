import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'

/* ═══════ TYPES ═══════ */

interface Proveedor { id: string; abv: string; nombre_completo: string; categoria: string | null; marca_asociada?: string | null; activo: boolean }
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

const inputCls = 'w-full bg-[#2e3347] border border-[#4a5270] rounded-lg px-3 py-2 text-sm text-[#f0f0ff] focus:outline-none focus:border-accent'
const inputSmCls = 'w-24 bg-[#2e3347] border border-[#4a5270] rounded px-2 py-1 text-sm text-[#f0f0ff] text-right'
const btnPrimary = 'px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:brightness-110 transition'
const btnSecondary = 'px-4 py-2 text-sm text-[#c8d0e8] border border-[#4a5270] rounded-lg hover:text-[#f0f0ff] hover:border-[#555] transition'
const thCfg = 'px-4 py-3 text-left text-[11px] uppercase tracking-wider text-[#7080a8] font-semibold bg-[#353a50] border-b border-[#4a5270]'
const rowCls = (idx: number) => idx % 2 === 0 ? 'bg-[#484f66]' : 'bg-[#404558]'
const tdCfg = 'px-4 py-2.5 border-b border-[#3e4460]'

const CANAL_ORDER = ['Uber Eats', 'Glovo', 'Just Eat', 'Web Propia', 'Venta Directa']

/* ═══════ MAIN ═══════ */

export default function Configuracion() {
  const [section, setSection] = useState<Section>('plataformas')
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey(k => k + 1)

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#f0f0ff] tracking-tight mb-5">Configuración</h2>
      <div className="flex gap-1 mb-5 bg-[#484f66] border border-[#4a5270] rounded-lg p-1 w-fit flex-wrap">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${section === s.key ? 'bg-accent text-[#111]' : 'text-[#c8d0e8] hover:text-[#f0f0ff]'}`}>
            {s.label}
          </button>
        ))}
      </div>
      {section === 'plataformas' && <SecPlataformas key={refreshKey} />}
      {section === 'costes' && <SecCostes key={refreshKey} />}
      {section === 'proveedores' && <SecProveedores key={refreshKey} onRefresh={refresh} />}
      {section === 'categorias' && <SecCategorias key={`c-${refreshKey}`} onRefresh={refresh} />}
      {section === 'unidades' && <SecUnidades key={`u-${refreshKey}`} onRefresh={refresh} />}
    </div>
  )
}

/* ═══════ PLATAFORMAS ═══════ */

function SecPlataformas() {
  const [rows, setRows] = useState<Canal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase.from('config_canales').select('*')
      if (!c) {
        const sorted = ((data as Canal[]) ?? []).sort((a, b) => {
          const ia = CANAL_ORDER.indexOf(a.canal)
          const ib = CANAL_ORDER.indexOf(b.canal)
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        })
        setRows(sorted)
        setLoading(false)
      }
    })()
    return () => { c = true }
  }, [])

  const update = async (id: string, field: string, displayVal: string) => {
    let numVal = parseFloat(displayVal) || 0
    if (field === 'comision_pct') numVal = numVal / 100
    await supabase.from('config_canales').update({ [field]: numVal }).eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: numVal } : r))
  }

  if (loading) return <Loader />

  return (
    <div className="bg-[#484f66] border border-[#4a5270] rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={thCfg}>Canal</th>
            <th className={thCfg + ' text-right'}>Comisión %</th>
            <th className={thCfg + ' text-right'}>Coste Fijo €</th>
            <th className={thCfg + ' text-right'}>Margen deseado %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id} className={rowCls(idx)}>
              <td className={tdCfg + ' text-[#f0f0ff] font-medium'}>{r.canal}</td>
              <td className={tdCfg + ' text-right'}>
                <input type="number" step="0.1" defaultValue={Math.round((r.comision_pct ?? 0) * 100 * 10) / 10}
                  onBlur={e => update(r.id, 'comision_pct', e.target.value)} className={inputSmCls} />
              </td>
              <td className={tdCfg + ' text-right'}>
                <input type="number" step="0.01" defaultValue={r.coste_fijo ?? 0}
                  onBlur={e => update(r.id, 'coste_fijo', e.target.value)} className={inputSmCls} />
              </td>
              <td className={tdCfg + ' text-right'}>
                <input type="number" step="0.1" defaultValue={r.margen_deseado_pct ?? 15}
                  onBlur={e => update(r.id, 'margen_deseado_pct', e.target.value)} className={inputSmCls} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ═══════ COSTES ═══════ */

function SecCostes() {
  const [estructura, setEstructura] = useState('30')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase.from('configuracion').select('*').eq('clave', 'estructura_pct').maybeSingle()
      if (!c) {
        if (data) setEstructura((data as ConfigItem).valor)
        setLoading(false)
      }
    })()
    return () => { c = true }
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      await supabase.from('configuracion').upsert({ clave: 'estructura_pct', valor: estructura }, { onConflict: 'clave' })
      setMsg('Guardado')
    } catch (e: any) { setMsg('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <Loader />

  return (
    <div className="bg-[#484f66] border border-[#4a5270] rounded-xl p-6 max-w-lg space-y-4">
      <div>
        <label className="block text-xs text-[#7080a8] mb-1.5">Coste estructura (%)</label>
        <input type="number" step="0.1" value={estructura} onChange={e => setEstructura(e.target.value)} className={inputCls} />
        <p className="text-[11px] text-[#8090b8] mt-1">Se aplica sobre PVP neto (sin IVA) en todas las recetas</p>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button onClick={save} disabled={saving} className={btnPrimary + ' disabled:opacity-50'}>{saving ? 'Guardando…' : 'Guardar'}</button>
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

  const load = async () => {
    const { data } = await supabase.from('config_proveedores').select('*').order('abv')
    setRows((data as Proveedor[]) ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleDelete = async (id: string, abv: string) => {
    if (!confirm(`¿Eliminar proveedor ${abv}?`)) return
    await supabase.from('config_proveedores').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return <Loader />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#7080a8]">{rows.length} proveedores</span>
        <button onClick={() => setShowAdd(true)} className={btnPrimary + ' ml-auto'}>+ Añadir proveedor</button>
      </div>
      <div className="bg-[#484f66] border border-[#4a5270] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr>
            <th className={thCfg}>Categoría</th>
            <th className={thCfg}>ABV</th>
            <th className={thCfg}>Nombre</th>
            <th className={thCfg}>Marca Principal</th>
            <th className={thCfg + ' text-center'} style={{ width: 80 }}></th>
          </tr></thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id} onClick={() => setEdit(r)} className={'cursor-pointer hover:bg-[#353a50] ' + rowCls(idx)}>
                <td className={tdCfg + ' text-[#c8d0e8]'}>{r.categoria ?? '—'}</td>
                <td className={tdCfg + ' text-[#f0f0ff] font-mono text-xs font-bold'}>{r.abv}</td>
                <td className={tdCfg + ' text-[#f0f0ff]'}>{r.nombre_completo}</td>
                <td className={tdCfg + ' text-[#c8d0e8]'}>{r.marca_asociada ?? '—'}</td>
                <td className={tdCfg + ' text-center'}>
                  <button onClick={e => { e.stopPropagation(); handleDelete(r.id, r.abv) }} className="text-xs text-[#8090b8] hover:text-[#dc2626] transition">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdd && <ProvModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); onRefresh() }} />}
      {edit && <ProvModal existing={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); onRefresh() }} />}
    </div>
  )
}

function ProvModal({ existing, onClose, onSaved }: { existing?: Proveedor; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!existing
  const [f, setF] = useState({ abv: existing?.abv ?? '', nombre_completo: existing?.nombre_completo ?? '', categoria: existing?.categoria ?? '', marca_asociada: existing?.marca_asociada ?? '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.abv.trim() || !f.nombre_completo.trim()) { setErr('ABV y nombre son obligatorios'); return }
    setSaving(true)
    const payload = { abv: f.abv.trim().toUpperCase(), nombre_completo: f.nombre_completo.trim(), categoria: f.categoria || null, marca_asociada: f.marca_asociada || null, activo: true }
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
          <CfgField label="ABV" value={f.abv} onChange={v => setF(p => ({ ...p, abv: v }))} placeholder="MER" />
          <CfgField label="Nombre" value={f.nombre_completo} onChange={v => setF(p => ({ ...p, nombre_completo: v }))} placeholder="Mercadona" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CfgField label="Categoría" value={f.categoria} onChange={v => setF(p => ({ ...p, categoria: v }))} placeholder="Supermercado" />
          <CfgField label="Marca Principal" value={f.marca_asociada} onChange={v => setF(p => ({ ...p, marca_asociada: v }))} placeholder="Hacendado" />
        </div>
        {err && <p className="text-[#dc2626] text-sm">{err}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary + ' flex-1'}>Cancelar</button>
          <button type="submit" disabled={saving} className={btnPrimary + ' flex-1 disabled:opacity-50'}>{saving ? 'Guardando…' : isEdit ? 'Actualizar' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ═══════ CATEGORÍAS ═══════ */

function SecCategorias({ onRefresh }: { onRefresh: () => void }) {
  return <EditableList clave="categorias" colLabel="Categoría" placeholder="Nueva categoría…" onRefresh={onRefresh} />
}

/* ═══════ UNIDADES (3 columnas) ═══════ */

function SecUnidades({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <EditableList clave="formatos_compra" colLabel="Formatos de Compra" placeholder="Nuevo formato…" onRefresh={onRefresh} />
      <EditableList clave="unidades_estandar" colLabel="Unidades Estándar" placeholder="Nueva unidad…" onRefresh={onRefresh} />
      <EditableList clave="unidades_minimas" colLabel="Unidades Mínimas" placeholder="Nueva unidad mín…" onRefresh={onRefresh} />
    </div>
  )
}

/* ═══════ EDITABLE LIST (shared for categorías + unidades) ═══════ */

function EditableList({ clave, colLabel, placeholder, onRefresh }: { clave: string; colLabel: string; placeholder: string; onRefresh: () => void }) {
  const [items, setItems] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [nuevo, setNuevo] = useState('')

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase.from('configuracion').select('*').eq('clave', clave).maybeSingle()
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
    setItems(next); setNuevo('')
    await persist(next)
  }

  const remove = async (idx: number) => {
    const next = items.filter((_, i) => i !== idx)
    setItems(next)
    await persist(next)
  }

  if (loading) return <Loader />

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={nuevo} onChange={e => setNuevo(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder} className={inputCls} />
        <button onClick={add} className={btnPrimary} style={{ whiteSpace: 'nowrap' }}>+</button>
      </div>
      <div className="bg-[#484f66] border border-[#4a5270] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr>
            <th className={thCfg}>{colLabel}</th>
            <th className={thCfg + ' text-right'} style={{ width: 70 }}></th>
          </tr></thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={2} className="p-6 text-center text-[#8090b8] text-sm">Sin items</td></tr>
            ) : items.map((it, idx) => (
              <tr key={idx} className={rowCls(idx)}>
                <td className={tdCfg + ' text-[#f0f0ff]'}>{it}</td>
                <td className={tdCfg + ' text-right'}>
                  <button onClick={() => remove(idx)} className="text-xs text-[#8090b8] hover:text-[#dc2626] transition">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════ SHARED ═══════ */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#484f66] border border-[#4a5270] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#4a5270]">
          <h3 className="text-[#f0f0ff] font-semibold">{title}</h3>
          <button onClick={onClose} className="text-[#7080a8] hover:text-[#f0f0ff] text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function CfgField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-[#7080a8] mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </div>
  )
}

function Loader() {
  return (
    <div className="bg-[#484f66] border border-[#4a5270] rounded-xl p-12 text-center">
      <div className="inline-block h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-[#7080a8] text-sm mt-3">Cargando…</p>
    </div>
  )
}
