import { GRANATE, AMA, AMA_S, VERDE, VERDE_S, OSW, LEX, pill } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PantallaCantera, HeroCantera, Papel } from '@/components/kit/cantera'

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

  if (loading) {
    return (
      <PantallaCantera embedded>
        <Papel ceja={GRANATE}><div style={{ padding: 12, fontFamily: LEX, fontSize: 13 }}>Cargando…</div></Papel>
      </PantallaCantera>
    )
  }
  if (error) {
    return (
      <PantallaCantera embedded>
        <Papel ceja={GRANATE}><div style={{ padding: 12, fontFamily: LEX, fontSize: 13, color: GRANATE, fontWeight: 600 }}>{error}</div></Papel>
      </PantallaCantera>
    )
  }
  if (!row) return null

  const esManual = row.coste_estructura_fuente === 'manual' && row.coste_estructura_override != null
  const valorEfectivo = row.coste_estructura_override ?? parseFloat(row.valor ?? '30') ?? 30
  const cifraStr = `${valorEfectivo.toFixed(2).replace('.', ',')}%`

  return (
    <PantallaCantera embedded>
      <HeroCantera
        area="equipo"
        titular="Así calculas el coste de estructura"
        etiquetaDato={esManual ? 'Valor manual' : 'Calculado desde Running'}
        cifra={cifraStr}
        resumen={esManual
          ? 'Valor manual sobrescribiendo el cálculo. Pulsa el número para volver al cálculo del módulo Running.'
          : 'Se recalcula automáticamente desde el módulo Running. Pulsa el número para sobrescribirlo a mano.'}
      />

      <Papel ceja={GRANATE}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
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
                  fontFamily: OSW,
                  fontSize: 36,
                  fontWeight: 700,
                  color: GRANATE,
                  lineHeight: 1,
                  width: '100%',
                  background: 'transparent',
                  border: `2px solid ${GRANATE}`,
                  borderRadius: 0,
                  padding: '2px 6px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div
                onClick={() => { setDraft(String(valorEfectivo).replace('.', ',')); setEditing(true) }}
                style={{
                  fontFamily: OSW,
                  fontSize: 36,
                  fontWeight: 700,
                  color: GRANATE,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                {cifraStr}
              </div>
            )}
          </div>
          <span style={pill(esManual ? AMA_S : VERDE_S, esManual ? AMA : VERDE)}>
            {esManual ? 'Manual' : 'Calculado desde Running'}
          </span>
          {esManual && (
            <button
              onClick={resetRunning}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                color: GRANATE,
                fontFamily: OSW,
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
              }}
            >Volver al valor del Running</button>
          )}
        </div>
      </Papel>
    </PantallaCantera>
  )
}
