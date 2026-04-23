import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface Relacion {
  id: string
  unidad_estandar: string
  unidad_minima: string
  factor: number
  orden: number
}

export default function TabUnidades() {
  const [formatos, setFormatos] = useState<string[]>([])
  const [relaciones, setRelaciones] = useState<Relacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newFmt, setNewFmt] = useState('')
  const [newEst, setNewEst] = useState('')
  const [newMin, setNewMin] = useState('')
  const [newFactor, setNewFactor] = useState('1')

  async function refetch() {
    const [f, r] = await Promise.all([
      supabase.from('configuracion').select('valor').eq('clave', 'formatos_compra').maybeSingle(),
      supabase.from('unidades_relacion').select('*').order('orden'),
    ])
    if (f.error) throw f.error
    if (r.error) throw r.error
    let parsed: string[] = []
    if (f.data?.valor) {
      try { parsed = JSON.parse(f.data.valor) as string[] } catch { parsed = [] }
    }
    setFormatos(Array.isArray(parsed) ? parsed : [])
    setRelaciones(((r.data ?? []) as unknown as Relacion[]).map(x => ({ ...x, factor: Number(x.factor) || 1 })))
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function persistFmts(next: string[]) {
    const { error } = await supabase
      .from('configuracion')
      .upsert({ clave: 'formatos_compra', valor: JSON.stringify(next) }, { onConflict: 'clave' })
    if (error) setError(error.message)
  }
  async function addFmt() {
    const v = newFmt.trim()
    if (!v || formatos.includes(v)) { setNewFmt(''); return }
    const next = [...formatos, v]
    setFormatos(next); setNewFmt('')
    await persistFmts(next)
  }
  async function delFmt(idx: number) {
    if (!confirm('Eliminar?')) return
    const next = formatos.filter((_, i) => i !== idx)
    setFormatos(next)
    await persistFmts(next)
  }

  async function addRel() {
    if (!newEst.trim() || !newMin.trim()) return
    const factor = parseFloat(newFactor.replace(',', '.')) || 1
    const maxOrden = relaciones.reduce((m, x) => Math.max(m, x.orden ?? 0), 0)
    const { error } = await supabase.from('unidades_relacion').insert({
      unidad_estandar: newEst.trim(),
      unidad_minima: newMin.trim(),
      factor,
      orden: maxOrden + 1,
    })
    if (error) { setError(error.message); return }
    setNewEst(''); setNewMin(''); setNewFactor('1')
    await refetch()
  }
  async function delRel(id: string) {
    if (!confirm('Eliminar relación?')) return
    const { error } = await supabase.from('unidades_relacion').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }
  async function updateRel(id: string, campo: string, valor: string | number) {
    const { error } = await supabase.from('unidades_relacion').update({ [campo]: valor }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <div className="space-y-3.5">
      <BigCard title="Formatos de compra" count={`${formatos.length}`}>
        <div className="flex flex-wrap gap-2 mb-4">
          {formatos.map((f, idx) => (
            <span key={`${f}-${idx}`} className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#FAF4E4] border border-[#E9E1D0] rounded-lg text-[12.5px] font-medium">
              {f}
              <button onClick={() => delFmt(idx)} className="text-[#9E9588] text-[15px] leading-none hover:text-[#B01D23] bg-transparent border-0">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newFmt} onChange={(e) => setNewFmt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addFmt()} placeholder="Nuevo formato de compra..." className="flex-1 px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[12.5px] bg-white focus:outline-none focus:border-[#B01D23]" />
          <button onClick={addFmt} className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E]">+ Añadir</button>
        </div>
      </BigCard>

      <BigCard title="Unidades estándar y mínimas" count={`${relaciones.length}`}>
        <table className="w-full text-[13.5px] border-collapse mb-3">
          <thead>
            <tr>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Unidad estándar</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Unidad mínima</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-right">Factor</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-right">—</th>
            </tr>
          </thead>
          <tbody>
            {relaciones.map(r => (
              <tr key={r.id} className="border-b border-[#F0E8D5]">
                <td className="py-3.5 px-3.5"><InlineEdit value={r.unidad_estandar} type="text" onSubmit={(v) => updateRel(r.id, 'unidad_estandar', String(v))} /></td>
                <td className="py-3.5 px-3.5"><InlineEdit value={r.unidad_minima} type="text" onSubmit={(v) => updateRel(r.id, 'unidad_minima', String(v))} /></td>
                <td className="py-3.5 px-3.5 text-right"><InlineEdit value={r.factor} type="number" align="right" onSubmit={(v) => updateRel(r.id, 'factor', typeof v === 'number' ? v : parseFloat(String(v)))} /></td>
                <td className="py-3.5 px-3.5 text-right">
                  <button onClick={() => delRel(r.id)} className="text-[#9E9588] text-xs hover:text-[#D63A49] hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2 items-end">
          <div className="flex-1"><label className="block text-[11px] tracking-[0.14em] uppercase text-[#9E9588] mb-1">Estándar</label><input value={newEst} onChange={(e) => setNewEst(e.target.value)} placeholder="Kg" className="w-full px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[12.5px] bg-white" /></div>
          <div className="flex-1"><label className="block text-[11px] tracking-[0.14em] uppercase text-[#9E9588] mb-1">Mínima</label><input value={newMin} onChange={(e) => setNewMin(e.target.value)} placeholder="gr" className="w-full px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[12.5px] bg-white" /></div>
          <div style={{ width: '100px' }}><label className="block text-[11px] tracking-[0.14em] uppercase text-[#9E9588] mb-1">Factor</label><input value={newFactor} onChange={(e) => setNewFactor(e.target.value)} className="w-full px-3 py-2 border border-dashed border-[#E9E1D0] rounded-lg text-[12.5px] bg-white text-right" /></div>
          <button onClick={addRel} className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#B01D23] text-white hover:bg-[#901A1E]">+ Añadir</button>
        </div>
        <p className="mt-3 text-[11px] text-[#9E9588]">Factor = cuántas unidades mínimas caben en una estándar. Ej: 1 Kg = 1000 gr → factor 1000.</p>
      </BigCard>
    </div>
  )
}
