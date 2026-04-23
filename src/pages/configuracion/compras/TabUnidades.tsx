import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface Fmt { id: string; nombre: string }
interface Rel { id: string; unidad_estandar: string; unidad_minima: string; factor: number; orden: number }

export default function TabUnidades() {
  const [formatos, setFormatos] = useState<Fmt[]>([])
  const [relaciones, setRelaciones] = useState<Rel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newFmt, setNewFmt] = useState('')
  const [newEst, setNewEst] = useState('')
  const [newMin, setNewMin] = useState('')

  async function refetch() {
    const [f, r] = await Promise.all([
      supabase.from('config_formatos').select('*').order('nombre'),
      supabase.from('unidades_relacion').select('*').order('orden'),
    ])
    if (f.error) throw f.error
    if (r.error) throw r.error
    setFormatos((f.data ?? []) as Fmt[])
    setRelaciones(((r.data ?? []) as unknown as Rel[]).map(x => ({ ...x, factor: Number(x.factor) || 1 })))
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function addFmt() {
    if (!newFmt.trim()) return
    const { error } = await supabase.from('config_formatos').insert({ nombre: newFmt.trim() })
    if (error) { setError(error.message); return }
    setNewFmt(''); await refetch()
  }
  async function delFmt(id: string) {
    if (!confirm('Eliminar?')) return
    const { error } = await supabase.from('config_formatos').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function renFmt(id: string, n: string) {
    const { error } = await supabase.from('config_formatos').update({ nombre: n.trim() }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  async function addRel() {
    if (!newEst.trim() || !newMin.trim()) return
    const maxOrden = relaciones.reduce((m, r) => Math.max(m, r.orden ?? 0), 0)
    const { error } = await supabase
      .from('unidades_relacion')
      .insert({ unidad_estandar: newEst.trim(), unidad_minima: newMin.trim(), factor: 1, orden: maxOrden + 1 })
    if (error) { setError(error.message); return }
    setNewEst(''); setNewMin(''); await refetch()
  }
  async function delRel(id: string) {
    if (!confirm('Eliminar?')) return
    const { error } = await supabase.from('unidades_relacion').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function updRel(id: string, campo: string, valor: string | number) {
    const { error } = await supabase.from('unidades_relacion').update({ [campo]: valor }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <div className="grid grid-cols-2 gap-3.5">
      <BigCard title="Formatos de compra" count={`${formatos.length}`}>
        <div className="space-y-2 mb-4">
          {formatos.map(f => (
            <div key={f.id} className="flex items-center justify-between px-4 py-3 bg-[#FAF4E4] border border-[#E9E1D0] rounded-lg hover:border-[#B01D23]">
              <div className="flex-1"><InlineEdit value={f.nombre} type="text" onSubmit={(v) => renFmt(f.id, String(v))} /></div>
              <button onClick={() => delFmt(f.id)} className="text-[#9E9588] hover:text-[#B01D23] text-[18px] leading-none">×</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newFmt} onChange={(e) => setNewFmt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addFmt()}
            placeholder="Nuevo formato de compra..." className="flex-1 px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#B01D23]" />
          <button onClick={addFmt} className="px-4 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E] tracking-[0.04em]">+ Añadir</button>
        </div>
      </BigCard>

      <BigCard title="Unidades estándar y mínimas" count={`${relaciones.length}`}>
        <div className="space-y-2 mb-4">
          {relaciones.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 bg-[#FAF4E4] border border-[#E9E1D0] rounded-lg hover:border-[#B01D23]">
              <div style={{ width: '100px' }}>
                <InlineEdit value={r.unidad_estandar} type="text" onSubmit={(v) => updRel(r.id, 'unidad_estandar', String(v))} />
              </div>
              <span className="text-[#9E9588] text-sm">↔</span>
              <div style={{ width: '100px' }}>
                <InlineEdit value={r.unidad_minima} type="text" onSubmit={(v) => updRel(r.id, 'unidad_minima', String(v))} />
              </div>
              <div className="flex-1" />
              <button onClick={() => delRel(r.id)} className="text-[#9E9588] hover:text-[#B01D23] text-[18px] leading-none">×</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newEst} onChange={(e) => setNewEst(e.target.value)} placeholder="Estándar (ej: Kg)"
            className="flex-1 px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#B01D23]" />
          <input value={newMin} onChange={(e) => setNewMin(e.target.value)} placeholder="Mínima (ej: gr)"
            className="flex-1 px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#B01D23]" />
          <button onClick={addRel} className="px-4 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E] tracking-[0.04em]">+ Añadir</button>
        </div>
      </BigCard>
    </div>
  )
}
