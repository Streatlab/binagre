import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'
import type { TipoCocina } from '@/types/configuracion'

export default function TabTiposCocina() {
  const [tipos, setTipos] = useState<TipoCocina[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState('')

  async function refetch() {
    const { data, error } = await supabase.from('tipos_cocina').select('*').order('orden')
    if (error) throw error
    setTipos((data ?? []) as TipoCocina[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function handleAdd() {
    if (!nuevo.trim()) return
    const maxOrden = tipos.reduce((m, t) => Math.max(m, t.orden), 0)
    const { error } = await supabase.from('tipos_cocina').insert({ nombre: nuevo.trim(), orden: maxOrden + 1 })
    if (error) { setError(error.message); return }
    setNuevo(''); await refetch()
  }

  async function handleDelete(t: TipoCocina) {
    if (!confirm(`Eliminar "${t.nombre}"?`)) return
    const { error } = await supabase.from('tipos_cocina').delete().eq('id', t.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  async function handleRename(t: TipoCocina, nombre: string) {
    const { error } = await supabase.from('tipos_cocina').update({ nombre }).eq('id', t.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <BigCard title="Tipos de cocina" count={`${tipos.length}`}>
      <div className="flex flex-wrap gap-2 mb-4">
        {tipos.map(t => (
          <span key={t.id} className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#FAF4E4] border border-[#E9E1D0] rounded-lg text-[12.5px] font-medium">
            <InlineEdit value={t.nombre} onSubmit={(v) => handleRename(t, String(v))} type="text" />
            <button onClick={() => handleDelete(t)} className="text-[#9E9588] cursor-pointer text-[15px] leading-none hover:text-[#B01D23] bg-transparent border-0">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Nuevo tipo de cocina..."
          className="flex-1 px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[12.5px] bg-white focus:outline-none focus:border-[#B01D23]"
        />
        <button onClick={handleAdd} className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E]">+ Añadir</button>
      </div>
    </BigCard>
  )
}
