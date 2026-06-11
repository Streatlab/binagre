import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { fmtEur } from '@/utils/format'

interface DiaFact {
  fecha: string
  uber_pedidos: number | null
  uber_bruto: number | null
  glovo_pedidos: number | null
  glovo_bruto: number | null
  je_pedidos: number | null
  je_bruto: number | null
  web_pedidos: number | null
  web_bruto: number | null
  directa_pedidos: number | null
  directa_bruto: number | null
  total_pedidos: number | null
  total_bruto: number | null
}

interface KPI {
  canal: string
  color: string
  pedidos: number
  bruto: number
  mediaPedidos: number
  mediaBruto: number
}

function localDateStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function semanaAnterior(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - 7 * n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const CANALES = [
  { key: 'uber',    label: 'Uber Eats', color: '#06C167' },
  { key: 'glovo',   label: 'Glovo',     color: '#e8f442' },
  { key: 'je',      label: 'JustEat',   color: '#f5a623' },
  { key: 'web',     label: 'Web',       color: '#ff6b70' },
  { key: 'directa', label: 'Directa',   color: '#66aaff' },
]

export default function PulsoCocina() {
  const [hoy, setHoy] = useState<DiaFact | null>(null)
  const [medias, setMedias] = useState<Record<string, { pedidos: number; bruto: number }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const today = localDateStr()
        const { data: hoyData } = await supabase
          .from('facturacion_diario')
          .select('*')
          .eq('fecha', today)
          .maybeSingle()

        setHoy(hoyData as DiaFact | null)

        // Últimas 4 semanas, mismo día de semana
        const fechasRef = [1, 2, 3, 4].map(n => semanaAnterior(n))
        const { data: refData } = await supabase
          .from('facturacion_diario')
          .select('*')
          .in('fecha', fechasRef)

        const refs = (refData ?? []) as DiaFact[]
        const calc: Record<string, { pedidos: number; bruto: number }> = {}
        if (refs.length > 0) {
          for (const c of CANALES) {
            const pk = `${c.key}_pedidos` as keyof DiaFact
            const bk = `${c.key}_bruto` as keyof DiaFact
            const totalP = refs.reduce((s, r) => s + (Number(r[pk]) || 0), 0)
            const totalB = refs.reduce((s, r) => s + (Number(r[bk]) || 0), 0)
            calc[c.key] = { pedidos: totalP / refs.length, bruto: totalB / refs.length }
          }
        }
        setMedias(calc)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const kpis: KPI[] = CANALES.map(c => {
    const pk = `${c.key}_pedidos` as keyof DiaFact
    const bk = `${c.key}_bruto` as keyof DiaFact
    const media = medias[c.key] ?? { pedidos: 0, bruto: 0 }
    return {
      canal: c.label,
      color: c.color,
      pedidos: hoy ? Number(hoy[pk]) || 0 : 0,
      bruto: hoy ? Number(hoy[bk]) || 0 : 0,
      mediaPedidos: media.pedidos,
      mediaBruto: media.bruto,
    }
  })

  function delta(val: number, media: number): string {
    if (media === 0) return ''
    const pct = ((val - media) / media) * 100
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`
  }

  function deltaColor(val: number, media: number): string {
    if (media === 0) return '#777777'
    return val >= media ? '#22c55e' : '#B01D23'
  }

  return (
    <div style={{ backgroundColor: '#111111', minHeight: '100vh', padding: '1.5rem', fontFamily: FONT.body }}>
      <h1 style={{ fontFamily: FONT.heading, textTransform: 'uppercase', letterSpacing: 3, color: '#ffffff', fontSize: 22, marginBottom: 4 }}>
        Pulso Cocina
      </h1>
      <p style={{ color: '#777777', fontSize: 13, marginBottom: 24 }}>
        {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} — vs. media últimas 4 semanas
      </p>

      {error && (
        <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', color: '#ffaaaa', borderRadius: 8, padding: '1rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && <div style={{ color: '#777777', fontSize: 13 }}>Cargando...</div>}

      {!loading && !hoy && !error && (
        <div style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#777777' }}>
          Sin datos para hoy
        </div>
      )}

      {!loading && hoy && (
        <>
          {/* Total */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
            <div style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, padding: '1rem' }}>
              <div style={{ color: '#777777', fontSize: 11, fontFamily: FONT.heading, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Total Pedidos</div>
              <div style={{ color: '#ffffff', fontSize: 28, fontWeight: 700 }}>{hoy.total_pedidos ?? 0}</div>
            </div>
            <div style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, padding: '1rem' }}>
              <div style={{ color: '#777777', fontSize: 11, fontFamily: FONT.heading, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Total Bruto</div>
              <div style={{ color: '#e8f442', fontSize: 28, fontWeight: 700 }}>{fmtEur(hoy.total_bruto ?? 0)}</div>
            </div>
          </div>

          {/* Por canal */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {kpis.map(kpi => (
              <div key={kpi.canal} style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: kpi.color }} />
                  <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: '#cccccc' }}>{kpi.canal}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ color: '#777777', fontSize: 11, marginBottom: 2 }}>Pedidos</div>
                    <div style={{ color: '#ffffff', fontSize: 20, fontWeight: 700 }}>{kpi.pedidos}</div>
                    {kpi.mediaPedidos > 0 && (
                      <div style={{ fontSize: 11, color: deltaColor(kpi.pedidos, kpi.mediaPedidos) }}>
                        {delta(kpi.pedidos, kpi.mediaPedidos)} vs media
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#777777', fontSize: 11, marginBottom: 2 }}>Bruto</div>
                    <div style={{ color: kpi.color, fontSize: 16, fontWeight: 700 }}>{fmtEur(kpi.bruto)}</div>
                    {kpi.mediaBruto > 0 && (
                      <div style={{ fontSize: 11, color: deltaColor(kpi.bruto, kpi.mediaBruto) }}>
                        {delta(kpi.bruto, kpi.mediaBruto)} vs media
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
