/**
 * TabFormatoNumeros.tsx — Tanda C4: decimales por defecto del helper global fmtNum
 * (src/utils/format.ts), configurable en vez de fijo. fmtEur/fmtPct NO se tocan: son
 * moneda/porcentaje con reglas fijas (RULES.md §format). Clave `formato_numeros` en
 * `configuracion`, cargada una vez al arrancar la app (contexts/ConfigContext.tsx).
 */
import { GRANATE, NAR, OSW, LEX } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PantallaCantera, HeroCantera, Papel } from '@/components/kit/cantera'
import { setDecimalesNum, fmtNum } from '@/utils/format'

const DEFAULT_DECIMALES = 4

export default function TabFormatoNumeros() {
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

  if (loading) {
    return (
      <PantallaCantera embedded>
        <Papel ceja={NAR}><div style={{ padding: 12, fontFamily: LEX, fontSize: 13 }}>Cargando…</div></Papel>
      </PantallaCantera>
    )
  }

  return (
    <PantallaCantera embedded>
      <HeroCantera
        area="equipo"
        titular="Así redondeas las cantidades del Escandallo"
        etiquetaDato="Decimales por defecto (fmtNum)"
        cifra={decimales}
        resumen={`Ejemplo con la config actual: ${fmtNum(1234.56789)}`}
      />

      <Papel ceja={NAR}>
        {error && (
          <div style={{ margin: '0 0 12px', padding: '8px 12px', border: `2px solid ${GRANATE}`, color: GRANATE, fontFamily: LEX, fontWeight: 600, fontSize: 12.5 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
          <select
            value={decimales}
            onChange={(e) => guardar(parseInt(e.target.value, 10))}
            style={{
              fontFamily: OSW, fontSize: 18, fontWeight: 700, color: NAR,
              background: 'transparent', border: `2px solid ${NAR}`, borderRadius: 0, padding: '8px 12px', outline: 'none', cursor: 'pointer',
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} decimales</option>)}
          </select>
        </div>
        <p style={{ margin: 0, fontSize: 12, fontFamily: LEX, maxWidth: 560, lineHeight: 1.5 }}>
          Decimales por defecto de las cantidades del Escandallo (fmtNum): kg, litros,
          unidades, coste por ración... No afecta a euros (siempre 2 decimales con € y
          coma decimal) ni a porcentajes (siempre 2 decimales con %), que tienen reglas
          fijas de contabilidad. Se aplica de inmediato en toda la app tras guardar.
        </p>
      </Papel>
    </PantallaCantera>
  )
}
