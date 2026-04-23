import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface ConfigRow {
  id: string
  clave: string
  valor: string
  coste_estructura_override: number | null
  coste_estructura_fuente: 'running' | 'manual'
}

export default function TabCostes() {
  const [row, setRow] = useState<ConfigRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const { data, error } = await supabase
      .from('configuracion')
      .select('id, clave, valor, coste_estructura_override, coste_estructura_fuente')
      .eq('clave', 'estructura_pct')
      .maybeSingle()
    if (error) throw error
    if (!data) {
      // crear row si no existe
      const { data: inserted, error: insErr } = await supabase
        .from('configuracion')
        .insert({ clave: 'estructura_pct', valor: '30' })
        .select('id, clave, valor, coste_estructura_override, coste_estructura_fuente')
        .single()
      if (insErr) throw insErr
      setRow(inserted as unknown as ConfigRow)
    } else {
      setRow(data as unknown as ConfigRow)
    }
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function handleOverride(valor: number | string) {
    if (!row) return
    const num = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(',', '.'))
    if (!Number.isFinite(num)) return
    const { error } = await supabase
      .from('configuracion')
      .update({ coste_estructura_override: num, coste_estructura_fuente: 'manual', valor: String(num) })
      .eq('id', row.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  async function resetRunning() {
    if (!row) return
    const { error } = await supabase
      .from('configuracion')
      .update({ coste_estructura_override: null, coste_estructura_fuente: 'running' })
      .eq('id', row.id)
    if (error) { setError(error.message); return }
    await refetch()
  }

  if (loading) return <div className="p-6 text-[var(--sl-text-muted)]">Cargando...</div>
  if (error) return <div className="p-6 bg-[var(--sl-border-error)]/20 text-[var(--sl-border-error)] rounded-xl">{error}</div>
  if (!row) return null

  const esManual = row.coste_estructura_fuente === 'manual' && row.coste_estructura_override != null
  const valorEfectivo = row.coste_estructura_override ?? parseFloat(row.valor ?? '30') ?? 30

  return (
    <BigCard title="Coste estructura">
      <div className="flex items-center gap-4">
        <div style={{ width: '180px' }}>
          <InlineEdit value={valorEfectivo} type="percent" onSubmit={handleOverride} min={0} max={100} step={0.01} />
        </div>
        <span className="text-[11px] uppercase tracking-[0.14em] font-medium" style={{ color: esManual ? '#B01D23' : '#9E9588' }}>
          {esManual ? 'Manual *' : 'Calculado desde Running *'}
        </span>
        {esManual && (
          <button onClick={resetRunning} className="ml-auto text-xs text-[var(--sl-text-calc)] hover:underline">
            Volver a valor del Running
          </button>
        )}
      </div>
      <p className="mt-4 text-[11px] text-[var(--sl-text-muted)]">
        * El valor por defecto se calcula desde una celda del módulo Running. Puedes sobrescribirlo manualmente editando el campo.
      </p>
    </BigCard>
  )
}
