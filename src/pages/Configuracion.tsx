import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'

/* ═══════ TYPES ═══════ */

interface Proveedor { id: string; abv: string; nombre_completo: string; categoria: string | null; activo: boolean }
interface Canal { id: string; canal: string; comision_pct: number | null; coste_fijo: number | null }

type Section = 'proveedores' | 'canales'

/* ═══════ MAIN ═══════ */

export default function Configuracion() {
  const [section, setSection] = useState<Section>('proveedores')
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey(k => k + 1)

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Configuracion</h2>
      <div className="flex gap-1 mb-5 bg-card border border-border rounded-lg p-1 w-fit">
        {([['proveedores', 'Proveedores'], ['canales', 'Canales']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSection(k)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${section === k ? 'bg-accent text-black' : 'text-neutral-400 hover:text-white'}`}>{l}</button>
        ))}
      </div>
      {section === 'proveedores' && <SecProveedores key={refreshKey} onRefresh={refresh} />}
      {section === 'canales' && <SecCanales key={refreshKey} onRefresh={refresh} />}
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
      const { data } = await supabase.from('config_proveedores').select('id,abv,nombre_completo,categoria,activo').order('abv')
      if (!c) { setRows((data as Proveedor[]) ?? []); setLoading(false) }
    })()
    return () => { c = true }
  }, [])

  if (loading) return <Loader />

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-neutral-500">{rows.length} proveedores</span>
        <button onClick={() => setShowAdd(true)}
          className="ml-auto px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:brightness-110 transition">＋ Anadir</button>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-neutral-500 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left">ABV</th>
              <th className="px-4 py-3 text-left">Nombre completo</th>
              <th className="px-4 py-3 text-left">Categoria</th>
              <th className="px-4 py-3 text-center">Activo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(r => (
              <tr key={r.id} onClick={() => setEdit(r)} className="hover:bg-white/[0.03] cursor-pointer transition-colors">
                <td className="px-4 py-2.5 text-accent font-mono text-xs font-bold">{r.abv}</td>
                <td className="px-4 py-2.5 text-white">{r.nombre_completo}</td>
                <td className="px-4 py-2.5 text-neutral-400">{r.categoria ?? '—'}</td>
                <td className="px-4 py-2.5 text-center">{r.activo ? <span className="text-green-400">●</span> : <span className="text-neutral-600">○</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdd && <ProvModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onRefresh() }} />}
      {edit && <ProvModal existing={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onRefresh() }} />}
    </>
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
    <Modal title={isEdit ? 'Editar proveedor' : 'Anadir proveedor'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="ABV" value={f.abv} onChange={v => setF(p => ({ ...p, abv: v }))} placeholder="MER" />
          <Field label="Nombre completo" value={f.nombre_completo} onChange={v => setF(p => ({ ...p, nombre_completo: v }))} placeholder="Mercadona" />
        </div>
        <Field label="Categoria" value={f.categoria} onChange={v => setF(p => ({ ...p, categoria: v }))} placeholder="Supermercado, Mayorista..." />
        <label className="flex items-center gap-2 text-sm text-neutral-400">
          <input type="checkbox" checked={f.activo} onChange={e => setF(p => ({ ...p, activo: e.target.checked }))} className="accent-accent" /> Activo
        </label>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-neutral-400 border border-border hover:text-white transition">Cancelar</button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-accent text-black hover:brightness-110 transition disabled:opacity-50">
            {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ═══════ CANALES ═══════ */

function SecCanales({ onRefresh }: { onRefresh: () => void }) {
  const [rows, setRows] = useState<Canal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase.from('config_canales').select('id,canal,comision_pct,coste_fijo').order('canal')
      if (!c) { setRows((data as Canal[]) ?? []); setLoading(false) }
    })()
    return () => { c = true }
  }, [])

  const update = async (id: string, field: string, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    setSaving(true)
    await supabase.from('config_canales').update({ [field]: num }).eq('id', id)
    setSaving(false)
    onRefresh()
  }

  if (loading) return <Loader />

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {saving && <div className="text-xs text-accent px-4 py-1">Guardando...</div>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-neutral-500 text-xs uppercase tracking-wide">
            <th className="px-4 py-3 text-left">Canal</th>
            <th className="px-4 py-3 text-right">Comision %</th>
            <th className="px-4 py-3 text-right">Coste fijo (€)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(r => (
            <tr key={r.id}>
              <td className="px-4 py-2.5 text-white font-medium">{r.canal}</td>
              <td className="px-4 py-2.5 text-right">
                <input type="number" step="0.1" defaultValue={r.comision_pct ?? 0} onBlur={e => update(r.id, 'comision_pct', e.target.value)}
                  className="w-20 bg-base border border-border rounded px-2 py-1 text-sm text-white text-right" />
              </td>
              <td className="px-4 py-2.5 text-right">
                <input type="number" step="0.01" defaultValue={r.coste_fijo ?? 0} onBlur={e => update(r.id, 'coste_fijo', e.target.value)}
                  className="w-20 bg-base border border-border rounded px-2 py-1 text-sm text-white text-right" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ═══════ SHARED ═══════ */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-neutral-500 mb-1">{label}</label>
      <input type={type ?? 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm text-white" />
    </div>
  )
}

function Loader() {
  return (
    <div className="bg-card border border-border rounded-xl p-12 text-center">
      <div className="inline-block h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-neutral-500 text-sm mt-3">Cargando...</p>
    </div>
  )
}
