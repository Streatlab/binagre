import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface CategoriaReceta { id: string; nombre: string; orden: number }

export default function TabCategorias() {
  const [recetas, setRecetas] = useState<CategoriaReceta[]>([])
  const [ingredientes, setIngredientes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newRec, setNewRec] = useState('')
  const [newIng, setNewIng] = useState('')

  async function refetch() {
    const [r, i] = await Promise.all([
      supabase.from('categorias_recetas').select('*').order('orden'),
      supabase.from('configuracion').select('valor').eq('clave', 'categorias').maybeSingle(),
    ])
    if (r.error) throw r.error
    if (i.error) throw i.error
    setRecetas((r.data ?? []) as CategoriaReceta[])
    let parsed: string[] = []
    if (i.data?.valor) {
      try { parsed = JSON.parse(i.data.valor) as string[] } catch { parsed = [] }
    }
    setIngredientes(Array.isArray(parsed) ? parsed : [])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  // Recetas (tabla)
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
  async function renameRec(id: string, n: string) {
    const { error } = await supabase.from('categorias_recetas').update({ nombre: n.trim() }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  // Ingredientes (JSON en configuracion.categorias)
  async function persistIng(next: string[]) {
    const { error } = await supabase
      .from('configuracion')
      .upsert({ clave: 'categorias', valor: JSON.stringify(next) }, { onConflict: 'clave' })
    if (error) setError(error.message)
  }
  async function addIng() {
    const v = newIng.trim()
    if (!v || ingredientes.includes(v)) { setNewIng(''); return }
    const next = [...ingredientes, v]
    setIngredientes(next); setNewIng('')
    await persistIng(next)
  }
  async function delIng(idx: number) {
    if (!confirm('Eliminar?')) return
    const next = ingredientes.filter((_, i) => i !== idx)
    setIngredientes(next)
    await persistIng(next)
  }
  async function renameIng(idx: number, n: string) {
    const v = n.trim()
    if (!v) return
    const next = ingredientes.map((x, i) => i === idx ? v : x)
    setIngredientes(next)
    await persistIng(next)
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <div className="grid grid-cols-2 gap-3.5">
      <BigCard title="Categorías de recetas" count={`${recetas.length}`}>
        <div className="flex flex-wrap gap-2 mb-4">
          {recetas.map(c => (
            <span key={c.id} className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#FAF4E4] border border-[#E9E1D0] rounded-lg text-[12.5px] font-medium">
              <InlineEdit value={c.nombre} type="text" onSubmit={(v) => renameRec(c.id, String(v))} />
              <button onClick={() => delRec(c.id)} className="text-[#9E9588] text-[15px] leading-none hover:text-[#B01D23] bg-transparent border-0">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newRec} onChange={(e) => setNewRec(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRec()} placeholder="Nueva categoría de receta..." className="flex-1 px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[12.5px] bg-white focus:outline-none focus:border-[#B01D23]" />
          <button onClick={addRec} className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E]">+ Añadir</button>
        </div>
        <p className="mt-3 text-[11px] text-[#9E9588]">Se usa en Escandallo y en Cocina / Fichas Técnicas.</p>
      </BigCard>

      <BigCard title="Categorías de ingredientes" count={`${ingredientes.length}`}>
        <div className="flex flex-wrap gap-2 mb-4">
          {ingredientes.map((c, idx) => (
            <span key={`${c}-${idx}`} className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#FAF4E4] border border-[#E9E1D0] rounded-lg text-[12.5px] font-medium">
              <InlineEdit value={c} type="text" onSubmit={(v) => renameIng(idx, String(v))} />
              <button onClick={() => delIng(idx)} className="text-[#9E9588] text-[15px] leading-none hover:text-[#B01D23] bg-transparent border-0">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newIng} onChange={(e) => setNewIng(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addIng()} placeholder="Nueva categoría de ingrediente..." className="flex-1 px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[12.5px] bg-white focus:outline-none focus:border-[#B01D23]" />
          <button onClick={addIng} className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E]">+ Añadir</button>
        </div>
        <p className="mt-3 text-[11px] text-[#9E9588]">Se usa en Escandallo al clasificar ingredientes.</p>
      </BigCard>
    </div>
  )
}
