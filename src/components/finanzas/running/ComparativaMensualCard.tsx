import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useTheme, FONT } from '@/styles/tokens'
import { fmtEur } from '@/utils/format'
import { supabase } from '@/lib/supabase'

const VERDE = '#06C167'
const ROJO  = '#B01D23'
const NARANJA = '#E8440A'

const MESES_CORTO = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
const MESES_LARGO = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

interface MesData {
  key: string         // 'YYYY-MM'
  label: string       // 'NOV'
  ingresos: number
  gastos: number
  resultado: number
  anio: number
  mes: number
}

function fmtISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ComparativaMensualCard() {
  const { T } = useTheme()
  const [data, setData] = useState<MesData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const hoy = new Date()
    // Construir las claves de los últimos 6 meses
    const meses: MesData[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      meses.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: MESES_CORTO[d.getMonth()],
        ingresos: 0, gastos: 0, resultado: 0,
        anio: d.getFullYear(), mes: d.getMonth() + 1,
      })
    }
    const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1)
    const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)

    let cancel = false
    ;(async () => {
      const aniosUnicos = Array.from(new Set(meses.map(m => m.anio)))
      const [ing, gas] = await Promise.all([
        supabase.from('ingresos_mensuales')
          .select('anio, mes, tipo, importe')
          .in('anio', aniosUnicos)
          .eq('tipo', 'bruto'),
        supabase.from('gastos')
          .select('fecha, importe')
          .gte('fecha', fmtISO(desde)).lte('fecha', fmtISO(hasta)),
      ])
      if (cancel) return
      if (ing.error || gas.error) {
        console.error(ing.error ?? gas.error)
        setLoading(false); return
      }

      const indexMap = new Map(meses.map((m, i) => [m.key, i]))
      for (const r of (ing.data ?? []) as { anio: number; mes: number; importe: number | string }[]) {
        const k = `${r.anio}-${String(r.mes).padStart(2, '0')}`
        const idx = indexMap.get(k)
        if (idx !== undefined) meses[idx].ingresos += Number(r.importe ?? 0)
      }
      for (const r of (gas.data ?? []) as { fecha: string; importe: number | string }[]) {
        const k = r.fecha?.slice(0, 7)
        const idx = k ? indexMap.get(k) : undefined
        if (idx !== undefined) meses[idx].gastos += Number(r.importe ?? 0)
      }
      meses.forEach(m => { m.resultado = m.ingresos - m.gastos })
      setData(meses)
      setLoading(false)
    })()
    return () => { cancel = true }
  }, [])

  const stats = useMemo(() => {
    if (data.length === 0) return null
    const conDatos = data.filter(d => d.ingresos > 0 || d.gastos > 0)
    if (conDatos.length === 0) return null
    const mejor = conDatos.reduce((best, m) => m.resultado > best.resultado ? m : best, conDatos[0])
    const peor  = conDatos.reduce((worst, m) => m.resultado < worst.resultado ? m : worst, conDatos[0])
    const media = conDatos.reduce((s, m) => s + m.resultado, 0) / conDatos.length
    return { mejor, peor, media }
  }, [data])

  const wrap: CSSProperties = {
    backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 14,
    padding: '20px 22px', display: 'flex', flexDirection: 'column', height: '100%',
  }
  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 11, color: T.mut, letterSpacing: 1.3,
    textTransform: 'uppercase', fontWeight: 500, marginBottom: 14,
  }
  const miniLabel: CSSProperties = { fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 2 }

  return (
    <div style={wrap}>
      <div style={labelStyle}>Comparativa · últimos 6 meses</div>

      {loading ? (
        <div style={{ flex: 1, color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>Cargando…</div>
      ) : data.length === 0 ? (
        <div style={{ flex: 1, color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Sin datos</div>
      ) : (
        <>
          <div style={{ width: '100%', height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.brd} vertical={false} />
                <XAxis dataKey="label" stroke={T.mut} tick={{ fontSize: 10, fill: T.mut, fontFamily: FONT.body }} axisLine={false} tickLine={false} />
                <YAxis stroke={T.mut} tick={{ fontSize: 9, fill: T.mut, fontFamily: FONT.body }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ backgroundColor: T.card, border: `1px solid ${T.brd}`, color: T.pri, fontFamily: FONT.body, borderRadius: 6, fontSize: 11 }}
                  formatter={(v) => fmtEur(Number(v))}
                />
                <Bar dataKey="ingresos" name="Ingresos" fill={VERDE} radius={[2, 2, 0, 0]} />
                <Bar dataKey="gastos"   name="Gastos"   fill={NARANJA} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ height: 1, background: T.brd, margin: '14px 0 12px' }} />

          {stats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={miniLabel}>Mejor mes</span>
                <span style={{ fontFamily: FONT.heading, fontSize: 12, color: VERDE, fontWeight: 600 }}>
                  {MESES_LARGO[stats.mejor.mes - 1].slice(0, 3)} · +{fmtEur(stats.mejor.resultado)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={miniLabel}>Peor mes</span>
                <span style={{ fontFamily: FONT.heading, fontSize: 12, color: stats.peor.resultado < 0 ? ROJO : T.pri, fontWeight: 600 }}>
                  {MESES_LARGO[stats.peor.mes - 1].slice(0, 3)} · {stats.peor.resultado >= 0 ? '+' : ''}{fmtEur(stats.peor.resultado)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={miniLabel}>Media mensual</span>
                <span style={{ fontFamily: FONT.heading, fontSize: 12, color: T.pri, fontWeight: 600 }}>
                  {stats.media >= 0 ? '+' : ''}{fmtEur(stats.media)}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>Sin datos comparables</div>
          )}
        </>
      )}
    </div>
  )
}
