import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/lib/format'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface ConfigCanal {
  id: string
  canal: string
  comision_pct: number
  coste_fijo: number
  margen_obj_pct: number
  activo: boolean
}

function colorByNombre(n: string): string {
  const s = n.toLowerCase()
  if (s.includes('uber')) return '#22B573'
  if (s.includes('glovo')) return '#DCCF2A'
  if (s.includes('just')) return '#E89A2B'
  if (s.includes('web') || s.includes('rushour')) return '#C94E5A'
  return '#6AA0D6'
}

export default function TabCanales() {
  const [canales, setCanales] = useState<ConfigCanal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const { data, error } = await supabase
      .from('config_canales')
      .select('*')
      .order('comision_pct', { ascending: false })
    if (error) throw error
    setCanales(((data ?? []) as unknown as ConfigCanal[]).map(c => ({
      ...c,
      comision_pct: Number(c.comision_pct) || 0,
      coste_fijo: Number(c.coste_fijo) || 0,
      margen_obj_pct: Number(c.margen_obj_pct) || 0,
    })))
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function update(id: string, campo: string, valor: number) {
    const { error } = await supabase.from('config_canales').update({ [campo]: valor }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  const kpis = useMemo(() => {
    const activos = canales.filter(c => c.activo)
    const conCom = canales.filter(c => c.comision_pct > 0)
    const mediaComision = conCom.length > 0
      ? conCom.reduce((a, c) => a + c.comision_pct, 0) / conCom.length
      : 0
    const mejorMargen = canales
      .filter(c => ['uber', 'glovo', 'just'].some(k => c.canal.toLowerCase().includes(k)))
      .sort((a, b) => a.comision_pct - b.comision_pct)[0]
    const margenNeto = mejorMargen ? 100 - mejorMargen.comision_pct : 0
    const fijos = canales.filter(c => c.coste_fijo > 0)
    const tarifaFijaMedia = fijos.length > 0 ? fijos.reduce((a, c) => a + c.coste_fijo, 0) / fijos.length : 0
    return { activos, mediaComision, mejorCanal: mejorMargen, margenNeto, tarifaFijaMedia }
  }, [canales])

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando canales…</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <>
      <KpiGrid>
        <KpiCard
          label="Comisión media"
          value={`${kpis.mediaComision.toFixed(2).replace('.', ',')}%`}
          sub="ponderada canales con comisión"
        />
        <KpiCard
          label="Mejor margen plataforma"
          value={kpis.mejorCanal?.canal ?? '—'}
          sub={kpis.mejorCanal ? `${kpis.margenNeto.toFixed(2).replace('.', ',')}% neto · solo UE/GL/JE` : 'sin datos'}
          subTone="pos"
        />
        <KpiCard
          label="Tarifa fija promedio"
          value={fmtEur(kpis.tarifaFijaMedia)}
          sub="por pedido"
        />
      </KpiGrid>

      <BigCard title="Canales de venta" count={`${canales.length} canales`}>
        <table className="w-full text-[13.5px] border-collapse">
          <thead>
            <tr>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Canal</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-right">Comisión</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-right">Coste fijo</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-right">Margen deseado</th>
            </tr>
          </thead>
          <tbody>
            {canales.map(c => (
              <tr key={c.id} className="border-b border-[#F0E8D5]">
                <td className="py-3.5 px-3.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ backgroundColor: colorByNombre(c.canal) }} />
                  <strong>{c.canal}</strong>
                </td>
                <td className="py-3.5 px-3.5 text-right">
                  <InlineEdit value={c.comision_pct} type="percent" align="right" min={0} max={100}
                    onSubmit={(v) => update(c.id, 'comision_pct', typeof v === 'number' ? v : parseFloat(String(v)))} />
                </td>
                <td className="py-3.5 px-3.5 text-right">
                  <InlineEdit value={c.coste_fijo} type="currency" align="right" min={0}
                    onSubmit={(v) => update(c.id, 'coste_fijo', typeof v === 'number' ? v : parseFloat(String(v)))} />
                </td>
                <td className="py-3.5 px-3.5 text-right">
                  <InlineEdit value={c.margen_obj_pct} type="percent" align="right" min={0} max={100}
                    onSubmit={(v) => update(c.id, 'margen_obj_pct', typeof v === 'number' ? v : parseFloat(String(v)))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </BigCard>
    </>
  )
}
