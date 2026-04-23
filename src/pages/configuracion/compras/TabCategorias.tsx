import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface Cat { id: string; nombre: string; orden: number }

export default function TabCategorias() {
  const [recetas, setRecetas] = useState<Cat[]>([])
  const [ingredientes, setIngredientes] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newRec, setNewRec] = useState('')
  const [newIng, setNewIng] = useState('')

  async function refetch() {
    const [r, i] = await Promise.all([
      supabase.from('categorias_recetas').select('*').order('orden'),
      supabase.from('categorias_ingredientes_config').select('*').order('orden'),
    ])
    if (r.error) throw r.error
    if (i.error) throw i.error
    setRecetas((r.data ?? []) as Cat[])
    setIngredientes((i.data ?? []) as Cat[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function addRec() {
    if (!newRec.trim()) return
    const maxOrden = recetas.reduce((m, c) => Math.max(m, c.orden ?? 0), 0)
    const { error } = await supabase.from('categorias_recetas').insert({ nombre: newRec.trim(), orden: maxOrden + 1 })
    if (error) { setError(error.message); return }
    setNewRec(''); await refetch()
  }
  async function delRec(id: string) {
    if (!confirm('Eliminar?')) return
    const { error } = await supabase.from('categorias_recetas').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function renRec(id: string, n: string) {
    const { error } = await supabase.from('categorias_recetas').update({ nombre: n.trim() }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  async function addIng() {
    if (!newIng.trim()) return
    const maxOrden = ingredientes.reduce((m, c) => Math.max(m, c.orden ?? 0), 0)
    const { error } = await supabase.from('categorias_ingredientes_config').insert({ nombre: newIng.trim(), orden: maxOrden + 1 })
    if (error) { setError(error.message); return }
    setNewIng(''); await refetch()
  }
  async function delIng(id: string) {
    if (!confirm('Eliminar?')) return
    const { error } = await supabase.from('categorias_ingredientes_config').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function renIng(id: string, n: string) {
    const { error } = await supabase.from('categorias_ingredientes_config').update({ nombre: n.trim() }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <div className="grid grid-cols-2 gap-3.5">
      <BigCard title="Categorías de recetas" count={`${recetas.length}`}>
        <div className="space-y-2 mb-4">
          {recetas.map(c => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-[#FAF4E4] border border-[#E9E1D0] rounded-lg hover:border-[#B01D23]">
              <div className="flex-1"><InlineEdit value={c.nombre} type="text" onSubmit={(v) => renRec(c.id, String(v))} /></div>
              <button onClick={() => delRec(c.id)} className="text-[#9E9588] hover:text-[#B01D23] text-[18px] leading-none">×</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newRec} onChange={(e) => setNewRec(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRec()}
            placeholder="Nueva categoría de receta..." className="flex-1 px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#B01D23]" />
          <button onClick={addRec} className="px-4 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E] tracking-[0.04em]">+ Añadir</button>
        </div>
      </BigCard>

      <BigCard title="Categorías de ingredientes" count={`${ingredientes.length}`}>
        <div className="space-y-2 mb-4">
          {ingredientes.map(c => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-[#FAF4E4] border border-[#E9E1D0] rounded-lg hover:border-[#B01D23]">
              <div className="flex-1"><InlineEdit value={c.nombre} type="text" onSubmit={(v) => renIng(c.id, String(v))} /></div>
              <button onClick={() => delIng(c.id)} className="text-[#9E9588] hover:text-[#B01D23] text-[18px] leading-none">×</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newIng} onChange={(e) => setNewIng(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addIng()}
            placeholder="Nueva categoría de ingrediente..." className="flex-1 px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#B01D23]" />
          <button onClick={addIng} className="px-4 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E] tracking-[0.04em]">+ Añadir</button>
        </div>
      </BigCard>
    </div>
  )
}
