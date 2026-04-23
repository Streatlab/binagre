import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { rangoPeriodo } from '@/lib/dateRange'
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

type Platform = 'UE' | 'GL' | 'JE'

const COLOR: Record<string, string> = {
  UE: '#22B573', GL: '#DCCF2A', JE: '#E89A2B', WEB: '#C94E5A', DIR: '#6AA0D6',
}
const LABEL: Record<string, string> = {
  UE: 'Uber Eats', GL: 'Glovo', JE: 'Just Eat', WEB: 'Web', DIR: 'Directa',
}

function colorPorNombre(n: string): string {
  const s = n.toLowerCase()
  if (s.includes('uber')) return '#22B573'
  if (s.includes('glovo')) return '#DCCF2A'
  if (s.includes('just')) return '#E89A2B'
  if (s.includes('web') || s.includes('rushour')) return '#C94E5A'
  return '#6AA0D6'
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2).replace('.', ',') + '%'
}

function matchCanal(c: ConfigCanal, key: Platform): boolean {
  const s = c.canal.toLowerCase()
  if (key === 'UE') return s.includes('uber')
  if (key === 'GL') return s.includes('glovo')
  if (key === 'JE') return s.includes('just')
  return false
}

export default function TabCanales() {
  const [canales, setCanales] = useState<ConfigCanal[]>([])
  const [tms, setTms] = useState<Record<Platform, number>>({ UE: 0, GL: 0, JE: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const [cRes, fRes] = await Promise.all([
      supabase.from('config_canales').select('*').order('comision_pct', { ascending: false }),
      supabase.from('v_facturacion_marca').select('*').gte('fecha', rangoPeriodo('30d')[0]).lte('fecha', rangoPeriodo('30d')[1]),
    ])
    if (cRes.error) throw cRes.error
    if (fRes.error) throw fRes.error

    setCanales(((cRes.data ?? []) as unknown as ConfigCanal[]).map(c => ({
      ...c,
      comision_pct: Number(c.comision_pct) || 0,
      coste_fijo: Number(c.coste_fijo) || 0,
      margen_obj_pct: Number(c.margen_obj_pct) || 0,
    })))

    const fact = (fRes.data ?? []) as any[]
    const sum = (k: string) => fact.reduce((a, x) => a + Number(x[k] ?? 0), 0)
    const totalPedidos = fact.reduce((a, x) => a + Number(x.total_pedidos ?? 0), 0)
    const ventas = { UE: sum('ue_bruto'), GL: sum('gl_bruto'), JE: sum('je_bruto') }
    const totalVentas = ventas.UE + ventas.GL + ventas.JE
    const TM_FALLBACK = 20
    const nextTms: Record<Platform, number> = { UE: TM_FALLBACK, GL: TM_FALLBACK, JE: TM_FALLBACK }
    if (totalVentas > 0 && totalPedidos > 0) {
      const pedUE = totalPedidos * (ventas.UE / totalVentas)
      const pedGL = totalPedidos * (ventas.GL / totalVentas)
      const pedJE = totalPedidos * (ventas.JE / totalVentas)
      if (pedUE > 0) nextTms.UE = ventas.UE / pedUE
      if (pedGL > 0) nextTms.GL = ventas.GL / pedGL
      if (pedJE > 0) nextTms.JE = ventas.JE / pedJE
    }
    setTms(nextTms)
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

  const comisionNeta = useMemo<Record<Platform, number>>(() => {
    const calc = (key: Platform): number => {
      const c = canales.find(x => matchCanal(x, key))
      if (!c) return NaN
      const tm = tms[key]
      if (tm <= 0) return c.comision_pct
      return c.comision_pct + (c.coste_fijo / tm) * 100
    }
    return { UE: calc('UE'), GL: calc('GL'), JE: calc('JE') }
  }, [canales, tms])

  const mejorCanal: Platform = useMemo(() => {
    const vals: [Platform, number][] = [
      ['UE', comisionNeta.UE],
      ['GL', comisionNeta.GL],
      ['JE', comisionNeta.JE],
    ]
    return vals.filter(([, v]) => Number.isFinite(v)).sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'UE'
  }, [comisionNeta])

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando canales…</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  const margenNetoMejor = 100 - (comisionNeta[mejorCanal] ?? 0)

  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 mb-5">
        <div className="bg-white rounded-xl px-[26px] py-6 border border-[#E9E1D0]">
          <div className="text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium mb-3">Comisión óptima neta</div>
          <div className="space-y-2">
            {(['UE','GL','JE'] as const).map(k => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-[13px] font-medium" style={{ color: COLOR[k] }}>{LABEL[k]}</span>
                <span className="text-[18px] font-extrabold tabular-nums" style={{ color: COLOR[k] }}>
                  {fmtPct(comisionNeta[k])}
                </span>
              </div>
            ))}
          </div>
          <div className="text-xs text-[#9E9588] mt-3">real sobre ticket medio últimos 30 días</div>
        </div>

        <div className="bg-white rounded-xl px-[26px] py-6 border border-[#E9E1D0]">
          <div className="text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium mb-3">Mejor margen plataforma</div>
          <div className="text-[38px] font-extrabold leading-none tracking-[-0.02em]" style={{ color: COLOR[mejorCanal] }}>
            {LABEL[mejorCanal]}
          </div>
          <div className="text-[13px] text-[#6E6656] mt-3">
            margen neto real: <strong className="tabular-nums">{fmtPct(margenNetoMejor)}</strong>
          </div>
        </div>
      </div>

      <BigCard title="Canales de venta" count={`${canales.length}`}>
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-left">Canal</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-right">Comisión</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-right">Coste fijo</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-right">Margen deseado</th>
            </tr>
          </thead>
          <tbody>
            {canales.map(c => (
              <tr key={c.id} className="border-b border-[#F0E8D5]">
                <td className="py-3.5 px-3.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ backgroundColor: colorPorNombre(c.canal) }} />
                  <strong>{c.canal}</strong>
                </td>
                <td className="py-3.5 px-3.5 text-right">
                  <InlineEdit value={c.comision_pct} type="percent" align="right" min={0} max={100} step={0.01}
                    onSubmit={(v) => update(c.id, 'comision_pct', typeof v === 'number' ? v : parseFloat(String(v)))} />
                </td>
                <td className="py-3.5 px-3.5 text-right">
                  <InlineEdit value={c.coste_fijo} type="currency" align="right" min={0} step={0.01}
                    onSubmit={(v) => update(c.id, 'coste_fijo', typeof v === 'number' ? v : parseFloat(String(v)))} />
                </td>
                <td className="py-3.5 px-3.5 text-right">
                  <InlineEdit value={c.margen_obj_pct} type="percent" align="right" min={0} max={100} step={0.01}
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
