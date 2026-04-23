import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'

interface ConfigRow {
  id: string
  clave: string
  valor: string
  coste_estructura_override: number | null
  coste_estructura_fuente: 'running' | 'manual'
}

export default function TabCostes() {
  const { T, isDark } = useTheme()
  const [row, setRow] = useState<ConfigRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

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
    setEditing(false)
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

  const tagBg = esManual
    ? (isDark ? 'rgba(176,29,35,0.28)' : '#FCEBEB')
    : (isDark ? 'rgba(102,160,214,0.22)' : '#E6F1FB')
  const tagFg = esManual
    ? (isDark ? '#F09595' : '#A32D2D')
    : (isDark ? '#89B5DF' : '#0C447C')

  return (
    <ConfigGroupCard title="Coste estructura" padded>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ width: 200 }}>
          {editing ? (
            <input
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const n = parseFloat(draft.replace(',', '.'))
                if (Number.isFinite(n)) handleOverride(n)
                else setEditing(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const n = parseFloat(draft.replace(',', '.'))
                  if (Number.isFinite(n)) handleOverride(n)
                  else setEditing(false)
                } else if (e.key === 'Escape') {
                  setEditing(false)
                }
              }}
              min={0}
              max={100}
              step={0.01}
              autoFocus
              style={{
                fontFamily: FONT.heading,
                fontSize: 36,
                fontWeight: 500,
                color: T.pri,
                lineHeight: 1,
                width: '100%',
                background: 'transparent',
                border: `1px solid ${T.brd}`,
                borderRadius: 6,
                padding: '2px 6px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <div
              onClick={() => { setDraft(String(valorEfectivo).replace('.', ',')); setEditing(true) }}
              style={{
                fontFamily: FONT.heading,
                fontSize: 36,
                fontWeight: 500,
                color: T.pri,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              {valorEfectivo.toFixed(2).replace('.', ',')}%
            </div>
          )}
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '5px 14px',
            borderRadius: 5,
            fontFamily: FONT.heading,
            fontSize: 11,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            fontWeight: 600,
            background: tagBg,
            color: tagFg,
          }}
        >
          {esManual ? 'Manual' : 'Calculado desde Running'}
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
          >Volver al valor del Running</button>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: T.mut, fontFamily: FONT.body, maxWidth: 560 }}>
        {esManual
          ? 'Valor manual sobrescribiendo el cálculo. Pulsa arriba para volver al cálculo del módulo Running.'
          : 'Se recalcula automáticamente desde el módulo Running. Edita el campo para sobrescribir manualmente.'}
      </p>
    </ConfigGroupCard>
  )
}
