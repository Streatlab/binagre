import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { InlineEdit } from '@/components/configuracion/InlineEdit'

interface ConfigRow {
  id: string
  clave: string
  valor: string
  coste_estructura_override: number | null
  coste_estructura_fuente: 'running' | 'manual'
}

export default function TabCostes() {
  const { T } = useTheme()
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

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: '#B01D2320', color: '#B01D23', borderRadius: 10, fontFamily: FONT.body }}>
        {error}
      </div>
    )
  }
  if (!row) return null

  const esManual = row.coste_estructura_fuente === 'manual' && row.coste_estructura_override != null
  const valorEfectivo = row.coste_estructura_override ?? parseFloat(row.valor ?? '30') ?? 30

  return (
    <ConfigGroupCard title="Coste estructura" padded>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 180 }}>
          <InlineEdit value={valorEfectivo} type="percent" onSubmit={handleOverride} min={0} max={100} step={0.01} />
        </div>
        <span
          style={{
            fontFamily: FONT.heading,
            fontSize: 11,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontWeight: 600,
            color: esManual ? '#B01D23' : T.mut,
          }}
        >
          {esManual ? 'Manual *' : 'Calculado desde Running *'}
        </span>
        {esManual && (
          <button
            onClick={resetRunning}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: '#B01D23',
              fontFamily: FONT.heading,
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >Volver a valor del Running</button>
        )}
      </div>
      <p style={{ marginTop: 14, fontSize: 12, color: T.mut, fontFamily: FONT.body }}>
        * El valor por defecto se calcula desde una celda del módulo Running. Puedes sobrescribirlo manualmente editando el campo.
      </p>
    </ConfigGroupCard>
  )
}
