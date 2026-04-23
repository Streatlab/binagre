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

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  const catNombre = (id: string) => cats.find(c => c.id === id)?.nombre ?? '—'
  const catsFiltradas = cats.filter(c => fAsigna === 'ingreso' ? c.es_ingreso : c.es_gasto)

  return (
    <>
      <BigCard title="Reglas de asignación automática" count={`${reglas.length} reglas`}>
        <div className="mb-4 p-3 bg-[#FAF4E4] border border-[#E9E1D0] rounded-lg text-[12.5px] text-[#6E6656]">
          <strong className="text-[#1A1A1A]">Cómo usar patrones:</strong>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><code className="bg-white px-1.5 py-0.5 rounded border border-[#E9E1D0]">*uber*</code> — contiene "uber"</li>
            <li><code className="bg-white px-1.5 py-0.5 rounded border border-[#E9E1D0]">glov*</code> — empieza por "glov"</li>
            <li><code className="bg-white px-1.5 py-0.5 rounded border border-[#E9E1D0]">*eats</code> — termina en "eats"</li>
            <li><code className="bg-white px-1.5 py-0.5 rounded border border-[#E9E1D0]">factura?.pdf</code> — <code>?</code> = un carácter</li>
          </ul>
        </div>
        <table className="w-full border-collapse text-[13.5px] mb-3">
          <thead>
            <tr>
              <th className="py-3 px-3 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-left">Si concepto contiene</th>
              <th className="py-3 px-3 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-left">Asigna como</th>
              <th className="py-3 px-3 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-left">Categoría</th>
            </tr>
          </thead>
          <tbody>
            {reglas.map(r => (
              <tr key={r.id} onClick={() => open(r)} className="border-b border-[#F0E8D5] cursor-pointer hover:bg-[#FAF4E4]">
                <td className="py-3 px-3 font-mono text-[12.5px]">{r.patron}</td>
                <td className="py-3 px-3 capitalize">{r.asigna_como}</td>
                <td className="py-3 px-3">{catNombre(r.categoria_id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => open()} className="px-4 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E] tracking-[0.04em]">+ Nueva regla</button>
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
              className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm font-mono focus:outline-none focus:border-[#B01D23]" />
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
              className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm bg-white focus:outline-none focus:border-[#B01D23]">
              <option value="">—</option>
              {catsFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Field>
        </EditModal>
      )}
    </>
  )
}
