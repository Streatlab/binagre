import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface Cat {
  id: string
  nombre: string
  es_ingreso: boolean
  es_gasto: boolean
  orden: number
}

export default function CategoriasPanel() {
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState('')

  async function refetch() {
    const { data, error } = await supabase.from('categorias_contables').select('*').order('orden')
    if (error) throw error
    setCats((data ?? []) as Cat[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function togglePin(c: Cat, campo: 'es_ingreso' | 'es_gasto') {
    const { error } = await supabase.from('categorias_contables').update({ [campo]: !c[campo] }).eq('id', c.id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function renombrar(c: Cat, nombre: string) {
    const { error } = await supabase.from('categorias_contables').update({ nombre }).eq('id', c.id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function eliminar(c: Cat) {
    if (!confirm(`Eliminar "${c.nombre}"?`)) return
    const { error } = await supabase.from('categorias_contables').delete().eq('id', c.id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function añadir() {
    if (!nuevo.trim()) return
    const maxOrden = cats.reduce((m, c) => Math.max(m, c.orden), 0)
    const { error } = await supabase
      .from('categorias_contables')
      .insert({ nombre: nuevo.trim(), orden: maxOrden + 1, es_ingreso: true, es_gasto: false, tipo: 'ingreso' })
    if (error) { setError(error.message); return }
    setNuevo(''); await refetch()
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <BigCard title="Categorías de conciliación" count={`${cats.length}`}>
      <table className="w-full border-collapse text-[13.5px] mb-4">
        <thead>
          <tr>
            <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-left">Nombre</th>
            <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-center">Tipo</th>
            <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-right" style={{ width: '80px' }}>—</th>
          </tr>
        </thead>
        <tbody>
          {cats.map(c => (
            <tr key={c.id} className="border-b border-[#F0E8D5]">
              <td className="py-3.5 px-3.5">
                <InlineEdit value={c.nombre} type="text" onSubmit={(v) => renombrar(c, String(v))} />
              </td>
              <td className="py-3.5 px-3.5 text-center">
                <div className="inline-flex gap-2">
                  <button
                    onClick={() => togglePin(c, 'es_ingreso')}
                    className={`inline-flex items-center px-2.5 py-[3px] rounded-[5px] text-[10px] tracking-[0.06em] font-semibold uppercase transition ${c.es_ingreso ? 'bg-[#D4F0E0] text-[#027b4b]' : 'bg-transparent text-[#9E9588] border border-dashed border-[#DDD4BF] hover:border-[#22B573]'}`}
                  >Ingreso</button>
                  <button
                    onClick={() => togglePin(c, 'es_gasto')}
                    className={`inline-flex items-center px-2.5 py-[3px] rounded-[5px] text-[10px] tracking-[0.06em] font-semibold uppercase transition ${c.es_gasto ? 'bg-[#FCE0E2] text-[#B01D23]' : 'bg-transparent text-[#9E9588] border border-dashed border-[#DDD4BF] hover:border-[#B01D23]'}`}
                  >Gasto</button>
                </div>
              </td>
              <td className="py-3.5 px-3.5 text-right">
                <button onClick={() => eliminar(c)} className="text-[#9E9588] hover:text-[#B01D23] text-xs">Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && añadir()}
          placeholder="Nueva categoría..." className="flex-1 px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#B01D23]" />
        <button onClick={añadir} className="px-4 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E] tracking-[0.04em]">+ Nueva categoría</button>
      </div>
    </BigCard>
  )
}
