import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useTheme, FONT } from '@/styles/tokens'
import { fmtEur } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import type { GastoRaw } from '@/hooks/useRunning'

interface Props { gastos: GastoRaw[] }

interface Presupuesto { categoria: string; tope: number }
interface Alerta {
  categoria: string
  gastado: number
  tope: number
  pct: number
  nivel: 'bad' | 'warn' | 'risk'
}

const COLOR = {
  bad:  '#A32D2D',
  warn: '#D97706',
  risk: '#CA8A04',
} as const

const ICONO = {
  bad:  '🔴',
  warn: '🟠',
  risk: '🟡',
} as const

const ETIQUETA = {
  bad:  'SUPERADO',
  warn: 'AL LÍMITE',
  risk: 'RIESGO',
} as const

export default function AlertasPresupuestoCard({ gastos }: Props) {
  const { T } = useTheme()
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const hoy = new Date()
    const anio = hoy.getFullYear()
    const mes = hoy.getMonth() + 1
    let cancel = false
    ;(async () => {
      const { data, error } = await supabase
        .from('presupuestos_mensuales')
        .select('categoria, tope')
        .eq('anio', anio)
        .eq('mes', mes)
      if (cancel) return
      if (error) { console.error(error); setLoading(false); return }
      setPresupuestos((data ?? []) as Presupuesto[])
      setLoading(false)
    })()
    return () => { cancel = true }
  }, [])

  const alertas = useMemo<Alerta[]>(() => {
    const hoy = new Date()
    const mes = hoy.getMonth() + 1
    const anio = hoy.getFullYear()
    const diaMes = hoy.getDate()
    const diasMes = new Date(anio, mes, 0).getDate()
    const pctDia = diaMes / diasMes

    const out: Alerta[] = []
    for (const p of presupuestos) {
      const gastado = gastos
        .filter(g => g.categoria === p.categoria && g.fecha?.startsWith(`${anio}-${String(mes).padStart(2, '0')}`))
        .reduce((s, g) => s + (Number(g.importe) || 0), 0)
      const pct = p.tope > 0 ? gastado / p.tope : 0
      let nivel: Alerta['nivel'] | null = null
      if (pct > 1) nivel = 'bad'
      else if (pct >= 0.9) nivel = 'warn'
      else if (pct >= 0.7 && pct > pctDia + 0.15) nivel = 'risk'
      if (nivel) out.push({ categoria: p.categoria, gastado, tope: p.tope, pct, nivel })
    }
    const orden = { bad: 0, warn: 1, risk: 2 }
    return out.sort((a, b) => orden[a.nivel] - orden[b.nivel] || b.pct - a.pct).slice(0, 4)
  }, [presupuestos, gastos])

  const wrap: CSSProperties = {
    backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 14,
    padding: '20px 22px', display: 'flex', flexDirection: 'column', height: '100%',
  }
  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 11, color: T.mut, letterSpacing: 1.3,
    textTransform: 'uppercase', fontWeight: 500, marginBottom: 14,
  }

  return (
    <div style={wrap}>
      <div style={labelStyle}>Alertas de presupuesto</div>
      {loading ? (
        <div style={{ flex: 1, color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>Cargando…</div>
      ) : presupuestos.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13, textAlign: 'center', padding: 12 }}>
          Sin presupuestos definidos para este mes
        </div>
      ) : alertas.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06C167', fontFamily: FONT.body, fontSize: 13, fontWeight: 500, textAlign: 'center', padding: 12 }}>
          ✓ Todas las categorías dentro del presupuesto
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alertas.map(a => (
            <div key={a.categoria} style={{
              padding: '10px 12px',
              border: `1px solid ${COLOR[a.nivel]}33`,
              background: `${COLOR[a.nivel]}11`,
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span>{ICONO[a.nivel]}</span>
                <span style={{ fontFamily: FONT.heading, fontSize: 10, color: COLOR[a.nivel], letterSpacing: 0.6, fontWeight: 600 }}>
                  {ETIQUETA[a.nivel]}
                </span>
                <span style={{ marginLeft: 'auto', fontFamily: FONT.heading, fontSize: 12, color: COLOR[a.nivel], fontWeight: 600 }}>
                  {Math.round(a.pct * 100)}%
                </span>
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.pri, fontWeight: 500 }}>
                {a.categoria}
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
                {fmtEur(a.gastado)} de {fmtEur(a.tope)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
