import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { EditModal, Field } from '@/components/configuracion/EditModal'

interface Regla {
  id: string
  patron: string
  asigna_como: 'ingreso' | 'gasto'
  categoria_id: string
}

interface Cat {
  id: string
  nombre: string
  es_ingreso: boolean
  es_gasto: boolean
}

export default function ReglasPanel() {
  const [reglas, setReglas] = useState<Regla[]>([])
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Regla | null>(null)
  const [creating, setCreating] = useState(false)
  const [fPatron, setFPatron] = useState('')
  const [fAsigna, setFAsigna] = useState<'ingreso' | 'gasto'>('gasto')
  const [fCat, setFCat] = useState('')
  const [saving, setSaving] = useState(false)

  async function refetch() {
    const [r, c] = await Promise.all([
      supabase.from('reglas_conciliacion').select('id, patron, asigna_como, categoria_id, tipo_categoria'),
      supabase.from('categorias_contables').select('id, nombre, es_ingreso, es_gasto').order('orden'),
    ])
    if (r.error) throw r.error
    if (c.error) throw c.error
    const mapped = (r.data ?? []).map((x: any) => ({
      id: x.id,
      patron: x.patron,
      asigna_como: (x.asigna_como ?? x.tipo_categoria) as 'ingreso' | 'gasto',
      categoria_id: x.categoria_id,
    }))
    setReglas(mapped)
    setCats((c.data ?? []) as Cat[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  function open(r?: Regla) {
    if (r) { setEditing(r); setFPatron(r.patron); setFAsigna(r.asigna_como); setFCat(r.categoria_id) }
    else { setCreating(true); setFPatron(''); setFAsigna('gasto'); setFCat('') }
  }
  function close() { setEditing(null); setCreating(false); setFPatron(''); setFCat('') }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: any = {
        patron: fPatron.trim(),
        asigna_como: fAsigna,
        tipo_categoria: fAsigna,
        categoria_id: fCat,
      }
      const q = editing
        ? supabase.from('reglas_conciliacion').update(payload).eq('id', editing.id)
        : supabase.from('reglas_conciliacion').insert(payload)
      const { error } = await q; if (error) throw error
      await refetch(); close()
    } catch (e: any) { setError(e?.message ?? 'Error') } finally { setSaving(false) }
  }
  async function handleDelete() {
    if (!editing) return
    if (!confirm(`Eliminar regla "${editing.patron}"?`)) return
    const { error } = await supabase.from('reglas_conciliacion').delete().eq('id', editing.id)
    if (error) { setError(error.message); return }
    await refetch(); close()
  }

  if (loading) return <div className="p-6 text-[var(--sl-text-muted)]">Cargando...</div>
  if (error) return <div className="p-6 bg-[var(--sl-border-error)]/20 text-[var(--sl-border-error)] rounded-xl">{error}</div>

  const catNombre = (id: string) => cats.find(c => c.id === id)?.nombre ?? '—'
  const catsFiltradas = cats.filter(c => fAsigna === 'ingreso' ? c.es_ingreso : c.es_gasto)

  return (
    <>
      <BigCard title="Reglas de asignación automática" count={`${reglas.length} reglas`}>
        <div className="mb-4 p-3 bg-[var(--sl-hover)] border border-[var(--sl-border)] rounded-lg text-[12.5px] text-[var(--sl-text-secondary)]">
          <strong className="text-[var(--sl-text-primary)]">Cómo usar patrones:</strong>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><code className="bg-[var(--sl-card)] px-1.5 py-0.5 rounded border border-[var(--sl-border)]">*uber*</code> — contiene "uber"</li>
            <li><code className="bg-[var(--sl-card)] px-1.5 py-0.5 rounded border border-[var(--sl-border)]">glov*</code> — empieza por "glov"</li>
            <li><code className="bg-[var(--sl-card)] px-1.5 py-0.5 rounded border border-[var(--sl-border)]">*eats</code> — termina en "eats"</li>
            <li><code className="bg-[var(--sl-card)] px-1.5 py-0.5 rounded border border-[var(--sl-border)]">factura?.pdf</code> — <code>?</code> = un carácter</li>
          </ul>
        </div>
        <table className="sl-cfg-table">
          <thead>
            <tr>
              <th>Si concepto contiene</th>
              <th>Asigna como</th>
              <th>Categoría</th>
            </tr>
          </thead>
          <tbody>
            {reglas.map(r => (
              <tr key={r.id} onClick={() => open(r)} className="row-click">
                <td style={{ fontFamily: "ui-monospace,monospace", fontSize: 12.5 }}>{r.patron}</td>
                <td style={{ textTransform: "capitalize" }}>{r.asigna_como}</td>
                <td>{catNombre(r.categoria_id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => open()} className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--sl-btn-save-bg)] text-white hover:bg-[#901A1E] tracking-[0.04em]">+ Nueva regla</button>
      </BigCard>

      {(editing || creating) && (
        <EditModal
          title={editing ? 'Editar regla' : 'Nueva regla'}
          onSave={handleSave} onCancel={close}
          onDelete={editing ? handleDelete : undefined}
          saving={saving} canSave={!!fPatron.trim() && !!fCat}
        >
          <Field label="Patrón (wildcards * y ?)">
            <input value={fPatron} onChange={(e) => setFPatron(e.target.value)} placeholder="*uber*" autoFocus
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--sl-border-focus)]" />
          </Field>
          <Field label="Asignar como">
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={fAsigna === 'ingreso'} onChange={() => { setFAsigna('ingreso'); setFCat('') }} /> Ingreso
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={fAsigna === 'gasto'} onChange={() => { setFAsigna('gasto'); setFCat('') }} /> Gasto
              </label>
            </div>
          </Field>
          <Field label="Categoría">
            <select value={fCat} onChange={(e) => setFCat(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm bg-[var(--sl-card)] focus:outline-none focus:border-[var(--sl-border-focus)]">
              <option value="">—</option>
              {catsFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Field>
        </EditModal>
      )}
    </>
  )
}
