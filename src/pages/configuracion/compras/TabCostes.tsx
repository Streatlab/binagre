import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

export default function TabCostes() {
  const [coste, setCoste] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const { data, error } = await supabase
      .from('configuracion')
      .select('valor')
      .eq('clave', 'estructura_pct')
      .maybeSingle()
    if (error) throw error
    setCoste(data?.valor ? parseFloat(data.valor) : 0)
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function handleUpdate(v: number | string) {
    const num = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    if (!Number.isFinite(num)) return
    const { error } = await supabase
      .from('configuracion')
      .upsert({ clave: 'estructura_pct', valor: String(num) }, { onConflict: 'clave' })
    if (error) { setError(error.message); return }
    await refetch()
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <BigCard title="Coste estructura">
      <div className="flex items-center gap-3">
        <span className="text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium">Coste estructura</span>
        <div style={{ width: '160px' }}>
          <InlineEdit value={coste} type="percent" onSubmit={handleUpdate} min={0} max={100} step={0.01} />
        </div>
      </div>
      <p className="mt-3 text-[12px] text-[#6E6656]">Se aplica sobre PVP neto (sin IVA) en todas las recetas.</p>
    </BigCard>
  )
}
