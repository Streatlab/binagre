/**
 * TabFormatoNumeros.tsx — Tanda C4: decimales por defecto del helper global fmtNum
 * (src/utils/format.ts), configurable en vez de fijo. fmtEur/fmtPct NO se tocan: son
 * moneda/porcentaje con reglas fijas (RULES.md §format). Clave `formato_numeros` en
 * `configuracion`, cargada una vez al arrancar la app (contexts/ConfigContext.tsx).
 */
import { GRANATE } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { setDecimalesNum, fmtNum } from '@/utils/format'

const DEFAULT_DECIMALES = 4

export default function TabFormatoNumeros() {
  const { T } = useTheme()
  const [id, setId] = useState<string | null>(null)
  const [decimales, setDecimales] = useState(DEFAULT_DECIMALES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const { data, error } = await supabase.from('configuracion').select('id, valor').eq('clave', 'formato_numeros').maybeSingle()
    if (error) throw error
    if (data) {
      setId(data.id)
      const n = parseFloat(String(data.valor))
      setDecimales(Number.isFinite(n) ? n : DEFAULT_DECIMALES)
    } else {
      setId(null)
      setDecimales(DEFAULT_DECIMALES)
    }
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function guardar(n: number) {
    const valor = String(n)
    const { error } = id
      ? await supabase.from('configuracion').update({ valor }).eq('id', id)
      : await supabase.from('configuracion').upsert({ clave: 'formato_numeros', valor }, { onConflict: 'clave' })
    if (error) { setError(error.message); return }
    setError(null)
    setDecimales(n)
    setDecimalesNum(n)
    await refetch()
  }

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando…</div>

  return (
    <ConfigGroupCard title="Formato de números" padded>
      {error && (
        <div style={{ margin: '0 0 12px', padding: '8px 12px', background: GRANATE + '20', color: GRANATE, borderRadius: 8, fontFamily: FONT.body, fontSize: 12.5 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
        <select
          value={decimales}
          onChange={(e) => guardar(parseInt(e.target.value, 10))}
          style={{
            fontFamily: FONT.heading, fontSize: 20, fontWeight: 500, color: T.pri,
            background: T.inp, border: `0.5px solid ${T.brd}`, borderRadius: 6, padding: '6px 12px', outline: 'none', cursor: 'pointer',
          }}
        >
          {[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} decimales</option>)}
        </select>
        <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec }}>
          Ejemplo: {fmtNum(1234.56789)}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: T.mut, fontFamily: FONT.body, maxWidth: 560 }}>
        Decimales por defecto de las cantidades del Escandallo (fmtNum): kg, litros,
        unidades, coste por ración... No afecta a euros (siempre 2 decimales con € y
        coma decimal) ni a porcentajes (siempre 2 decimales con %), que tienen reglas
        fijas de contabilidad. Se aplica de inmediato en toda la app tras guardar.
      </p>
    </ConfigGroupCard>
  )
}
