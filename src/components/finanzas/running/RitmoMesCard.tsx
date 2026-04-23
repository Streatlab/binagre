import { useEffect, useState, type CSSProperties } from 'react'
import { useTheme, FONT } from '@/styles/tokens'
import { fmtEur } from '@/utils/format'
import { supabase } from '@/lib/supabase'

interface State {
  facturadoHoy: number
  facturadoMismoDiaMesPasado: number
  totalMesPasado: number
  loading: boolean
}

const VERDE = '#06C167'
const ROJO  = '#B01D23'

function fmtISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function RitmoMesCard() {
  const { T } = useTheme()
  const [state, setState] = useState<State>({
    facturadoHoy: 0, facturadoMismoDiaMesPasado: 0, totalMesPasado: 0, loading: true,
  })

  useEffect(() => {
    const hoy = new Date()
    const anio = hoy.getFullYear()
    const mes = hoy.getMonth()
    const diaActual = hoy.getDate()
    const inicioMes = new Date(anio, mes, 1)
    const inicioMesPasado = new Date(anio, mes - 1, 1)
    const finMesPasado = new Date(anio, mes, 0)
    const mismoDiaMesPasado = new Date(anio, mes - 1, Math.min(diaActual, finMesPasado.getDate()))

    let cancel = false
    ;(async () => {
      const [act, antParcial, antTotal] = await Promise.all([
        supabase.from('facturacion_diario').select('total_bruto').gte('fecha', fmtISO(inicioMes)).lte('fecha', fmtISO(hoy)),
        supabase.from('facturacion_diario').select('total_bruto').gte('fecha', fmtISO(inicioMesPasado)).lte('fecha', fmtISO(mismoDiaMesPasado)),
        supabase.from('facturacion_diario').select('total_bruto').gte('fecha', fmtISO(inicioMesPasado)).lte('fecha', fmtISO(finMesPasado)),
      ])
      if (cancel) return
      if (act.error || antParcial.error || antTotal.error) {
        console.error(act.error ?? antParcial.error ?? antTotal.error)
        setState(s => ({ ...s, loading: false })); return
      }
      const sum = (rows: { total_bruto: number | string | null }[] | null) =>
        (rows ?? []).reduce((s, r) => s + Number(r.total_bruto ?? 0), 0)
      setState({
        facturadoHoy: sum(act.data as any),
        facturadoMismoDiaMesPasado: sum(antParcial.data as any),
        totalMesPasado: sum(antTotal.data as any),
        loading: false,
      })
    })()
    return () => { cancel = true }
  }, [])

  const hoy = new Date()
  const anio = hoy.getFullYear()
  const mes = hoy.getMonth() + 1
  const diaActual = hoy.getDate()
  const diasMes = new Date(anio, mes, 0).getDate()
  const proyeccion = diaActual > 0 ? (state.facturadoHoy * diasMes) / diaActual : 0
  const deltaPct = state.facturadoMismoDiaMesPasado > 0
    ? ((state.facturadoHoy - state.facturadoMismoDiaMesPasado) / state.facturadoMismoDiaMesPasado) * 100
    : 0
  const proyeccionMejor = state.totalMesPasado > 0 ? proyeccion > state.totalMesPasado : true
  const proyeccionColor = state.totalMesPasado === 0 ? T.pri : (proyeccionMejor ? VERDE : ROJO)
  const deltaSym = deltaPct > 0.5 ? '▲' : deltaPct < -0.5 ? '▼' : '·'
  const deltaColor = deltaPct > 0.5 ? VERDE : deltaPct < -0.5 ? ROJO : T.mut

  const wrap: CSSProperties = {
    backgroundColor: T.card, border: `1px solid ${T.brd}`, borderRadius: 14,
    padding: '20px 22px', display: 'flex', flexDirection: 'column', height: '100%',
  }
  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 11, color: T.mut, letterSpacing: 1.3,
    textTransform: 'uppercase', fontWeight: 500, marginBottom: 14,
  }
  const miniLabel: CSSProperties = { fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 2 }
  const miniValue: CSSProperties = { fontFamily: FONT.heading, fontSize: 14, color: T.pri, fontWeight: 500 }

  return (
    <div style={wrap}>
      <div style={labelStyle}>Ritmo del mes</div>
      {state.loading ? (
        <div style={{ flex: 1, color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>Cargando…</div>
      ) : (
        <>
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 4 }}>Proyección de cierre</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 30, fontWeight: 600, color: proyeccionColor, lineHeight: 1, letterSpacing: '-0.01em' }}>
            ≈ {fmtEur(proyeccion)}
          </div>
          {state.totalMesPasado > 0 && (
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 4 }}>
              vs cierre mes anterior {fmtEur(state.totalMesPasado)}
            </div>
          )}

          <div style={{ height: 1, background: T.brd, margin: '14px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={miniLabel}>Día del mes</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={miniValue}>{diaActual} de {diasMes}</span>
                <div style={{ flex: 1, height: 4, background: T.bg, borderRadius: 2, overflow: 'hidden', maxWidth: 120 }}>
                  <div style={{ height: '100%', width: `${(diaActual / diasMes) * 100}%`, background: T.sec, borderRadius: 2 }} />
                </div>
              </div>
            </div>

            <div>
              <div style={miniLabel}>Facturado a hoy</div>
              <div style={miniValue}>{fmtEur(state.facturadoHoy)}</div>
            </div>

            <div>
              <div style={miniLabel}>vs mismo día mes pasado</div>
              <div style={{ ...miniValue, color: deltaColor }}>
                {deltaSym} {Math.abs(Math.round(deltaPct))}%
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
