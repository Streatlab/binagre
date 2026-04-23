import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { EditModal, Field } from '@/components/configuracion/EditModal'
import type { CategoriaContable } from '@/types/configuracion'

export default function CategoriasContablesPanel() {
  const [cats, setCats] = useState<CategoriaContable[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CategoriaContable | null>(null)
  const [creatingTipo, setCreatingTipo] = useState<'ingreso' | 'gasto' | null>(null)
  const [formNombre, setFormNombre] = useState('')
  const [formTipo, setFormTipo] = useState<'ingreso' | 'gasto'>('ingreso')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const { data, error } = await supabase.from('categorias_contables').select('*').order('orden')
    if (error) throw error
    setCats((data ?? []) as unknown as CategoriaContable[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  function openEdit(c: CategoriaContable) { setEditing(c); setFormNombre(c.nombre); setFormTipo(c.tipo) }
  function openNew(t: 'ingreso' | 'gasto') { setCreatingTipo(t); setFormNombre(''); setFormTipo(t) }
  function close() { setEditing(null); setCreatingTipo(null); setFormNombre('') }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('categorias_contables').update({ nombre: formNombre.trim(), tipo: formTipo }).eq('id', editing.id)
        if (error) throw error
      } else {
        const maxOrden = cats.filter(c => c.tipo === formTipo).reduce((m, c) => Math.max(m, c.orden), 0)
        const { error } = await supabase.from('categorias_contables').insert({ nombre: formNombre.trim(), tipo: formTipo, orden: maxOrden + 1 })
        if (error) throw error
      }
      await refetch(); close()
    } catch (e: any) { setError(e?.message ?? 'Error') } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!editing) return
    if (!confirm(`Eliminar "${editing.nombre}"?`)) return
    const { error } = await supabase.from('categorias_contables').delete().eq('id', editing.id)
    if (error) { setError(error.message); return }
    await refetch(); close()
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  const ingresos = cats.filter(c => c.tipo === 'ingreso')
  const gastos = cats.filter(c => c.tipo === 'gasto')

  return (
    <>
      <div className="grid grid-cols-2 gap-3.5">
        <BigCard title="Ingresos" count={`${ingresos.length}`}>
          <table className="w-full text-[13.5px] border-collapse mb-3">
            <thead>
              <tr>
                <th className="py-3 px-3 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Nombre</th>
              </tr>
            </thead>
            <tbody>
              {ingresos.map(c => (
                <tr key={c.id} onClick={() => openEdit(c)} className="border-b border-[#F0E8D5] cursor-pointer hover:bg-[#FAF4E4]">
                  <td className="py-3 px-3">{c.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => openNew('ingreso')} className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E]">+ Nueva categoría</button>
        </BigCard>

        <BigCard title="Gastos" count={`${gastos.length}`}>
          <table className="w-full text-[13.5px] border-collapse mb-3">
            <thead>
              <tr><th className="py-3 px-3 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Nombre</th></tr>
            </thead>
            <tbody>
              {gastos.map(c => (
                <tr key={c.id} onClick={() => openEdit(c)} className="border-b border-[#F0E8D5] cursor-pointer hover:bg-[#FAF4E4]">
                  <td className="py-3 px-3">{c.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => openNew('gasto')} className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E]">+ Nueva categoría</button>
        </BigCard>
      </div>

      {(editing || creatingTipo) && (
        <EditModal
          title={editing ? 'Editar categoría' : `Nueva categoría ${creatingTipo}`}
          onSave={handleSave}
          onCancel={close}
          onDelete={editing ? handleDelete : undefined}
          saving={saving}
          canSave={!!formNombre.trim()}
        >
          <Field label="Nombre">
            <input value={formNombre} onChange={(e) => setFormNombre(e.target.value)} className="w-full px-3 py-2 border border-[#E9E1D0] rounded-lg text-sm" autoFocus />
          </Field>
          <Field label="Tipo">
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={formTipo === 'ingreso'} onChange={() => setFormTipo('ingreso')} /> Ingreso
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={formTipo === 'gasto'} onChange={() => setFormTipo('gasto')} /> Gasto
              </label>
            </div>
          </Field>
        </EditModal>
      )}
    </>
  )
}
