import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'
import type { TipoCocina } from '@/types/configuracion'

interface TipoConCount extends TipoCocina { count_marcas: number }

export default function TabTiposCocina() {
  const [tipos, setTipos] = useState<TipoConCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState('')

  async function refetch() {
    const { data: t, error } = await supabase.from('tipos_cocina').select('*').order('orden')
    if (error) throw error
    const { data: m } = await supabase.from('marcas').select('tipo_cocina_id')
    const countMap = new Map<string, number>()
    for (const x of (m ?? []) as any[]) {
      if (x.tipo_cocina_id) countMap.set(x.tipo_cocina_id, (countMap.get(x.tipo_cocina_id) ?? 0) + 1)
    }
    setTipos(((t ?? []) as TipoCocina[]).map(x => ({ ...x, count_marcas: countMap.get(x.id) ?? 0 })))
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
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
  async function handleDelete(t: TipoConCount) {
    if (t.count_marcas > 0) { alert(`"${t.nombre}" usado por ${t.count_marcas} marca(s). No se puede eliminar.`); return }
    if (!confirm(`Eliminar "${t.nombre}"?`)) return
    const { error } = await supabase.from('tipos_cocina').delete().eq('id', t.id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function handleRename(t: TipoConCount, nombre: string) {
    const { error } = await supabase.from('tipos_cocina').update({ nombre }).eq('id', t.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <BigCard title="Tipos de cocina" count={`${tipos.length}`}>
      <div className="space-y-2 mb-4">
        {tipos.map(t => (
          <div key={t.id} className="flex items-center justify-between px-4 py-3 bg-[#FAF4E4] border border-[#E9E1D0] rounded-lg hover:border-[#B01D23] transition-colors">
            <div className="flex-1">
              <InlineEdit value={t.nombre} type="text" onSubmit={(v) => handleRename(t, String(v))} />
            </div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#9E9588] mr-4">
              {t.count_marcas} marca{t.count_marcas !== 1 ? 's' : ''}
            </div>
            <button
              onClick={() => handleDelete(t)}
              disabled={t.count_marcas > 0}
              className="text-[#9E9588] hover:text-[#B01D23] text-[18px] leading-none disabled:opacity-30 disabled:cursor-not-allowed"
              title={t.count_marcas > 0 ? 'Usado por marcas' : 'Eliminar'}
            >×</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Nuevo tipo de cocina..."
          className="flex-1 px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#B01D23]"
        />
        <button onClick={handleAdd} className="px-4 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E] tracking-[0.04em]">+ Añadir</button>
      </div>
    </BigCard>
  )
}
