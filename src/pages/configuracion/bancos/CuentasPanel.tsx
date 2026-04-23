import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'
import { fmtEur } from '@/lib/format'

interface Cuenta {
  id: string
  alias: string | null
  banco: string | null
  numero_cuenta: string | null
  iban: string | null
  iban_mask: string | null
  swift: string | null
  saldo: number | null
  activa: boolean
  es_principal: boolean
}

export default function CuentasPanel() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const { data, error } = await supabase.from('cuentas_bancarias').select('*').order('alias')
    if (error) throw error
    setCuentas((data ?? []) as unknown as Cuenta[])
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function update(id: string, campo: string, valor: string | number) {
    const { error } = await supabase.from('cuentas_bancarias').update({ [campo]: valor }).eq('id', id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  const saldoTotal = cuentas.reduce((n, c) => n + Number(c.saldo ?? 0), 0)

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3.5">
        <div className="bg-white rounded-xl px-[26px] py-6 border border-[#E9E1D0]">
          <div className="text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium mb-3">Saldo total</div>
          <div className="text-[32px] font-extrabold leading-none tracking-[-0.02em] text-[#1A1A1A]">{fmtEur(saldoTotal)}</div>
          <div className="text-xs text-[#9E9588] mt-2">{cuentas.length} cuenta{cuentas.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <BigCard title="Cuentas bancarias" count={`${cuentas.length}`}>
        <table className="w-full text-[13.5px] border-collapse">
          <thead>
            <tr>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Alias</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Banco</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Nº cuenta</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">IBAN</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">SWIFT</th>
              <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map(c => (
              <tr key={c.id} className="border-b border-[#F0E8D5]">
                <td className="py-3.5 px-3.5"><InlineEdit value={c.alias} type="text" onSubmit={(v) => update(c.id, 'alias', String(v))} /></td>
                <td className="py-3.5 px-3.5"><InlineEdit value={c.banco} type="text" onSubmit={(v) => update(c.id, 'banco', String(v))} /></td>
                <td className="py-3.5 px-3.5"><InlineEdit value={c.numero_cuenta} type="text" onSubmit={(v) => update(c.id, 'numero_cuenta', String(v))} /></td>
                <td className="py-3.5 px-3.5 font-mono text-[12px]"><InlineEdit value={c.iban ?? c.iban_mask} type="text" onSubmit={(v) => update(c.id, 'iban', String(v))} /></td>
                <td className="py-3.5 px-3.5 font-mono text-[12px]"><InlineEdit value={c.swift} type="text" onSubmit={(v) => update(c.id, 'swift', String(v))} /></td>
                <td className="py-3.5 px-3.5 text-right">
                  <InlineEdit value={c.saldo} type="currency" align="right"
                    onSubmit={(v) => update(c.id, 'saldo', typeof v === 'number' ? v : parseFloat(String(v)))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </BigCard>
    </>
  )
}
