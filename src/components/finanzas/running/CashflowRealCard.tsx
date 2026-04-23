import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { fmtEur } from '@/utils/format'

const VERDE_OK = '#10B981'
const ROJO_NEG = '#C4372C'

interface Props {
  periodoDesde: Date
  periodoHasta: Date
}

interface State {
  loading: boolean
  cajaActual: number
  ivaPendiente: number
  irpfPendiente: number
  facturasPendientes: number
  brutoMesActual: number
  netoMesActual: number
  netoUlt30d: number
}

function fmtISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export default function CashflowRealCard({ periodoDesde, periodoHasta }: Props) {
  const { T } = useTheme()
  const [s, setS] = useState<State>({
    loading: true,
    cajaActual: 0,
    ivaPendiente: 0,
    irpfPendiente: 0,
    facturasPendientes: 0,
    brutoMesActual: 0,
    netoMesActual: 0,
    netoUlt30d: 0,
  })

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const hoy = new Date()
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)

      const [ultMov, provs, factMes, netoMes, netoMesAnt] = await Promise.all([
        supabase.from('conciliacion').select('fecha, importe').order('fecha', { ascending: false }).limit(5000),
        supabase.from('provisiones').select('tipo, importe, estado').eq('estado', 'pendiente'),
        supabase.from('facturacion_diario').select('total_bruto')
          .gte('fecha', fmtISO(inicioMes)).lte('fecha', fmtISO(hoy)),
        supabase.from('ingresos_mensuales').select('importe')
          .eq('tipo', 'neto').eq('anio', hoy.getFullYear()).eq('mes', hoy.getMonth() + 1),
        supabase.from('ingresos_mensuales').select('importe')
          .eq('tipo', 'neto').eq('anio', hoy.getFullYear())
          .lt('mes', hoy.getMonth() + 1).gte('mes', hoy.getMonth() === 0 ? 12 : hoy.getMonth()),
      ])
      if (cancel) return

      const cajaActual = (ultMov.data ?? []).reduce((a: number, r: any) => a + Number(r.importe || 0), 0)

      const provisiones = (provs.data ?? []) as { tipo: string; importe: number }[]
      const ivaPendiente = provisiones.filter(p => p.tipo === 'IVA_TRIM').reduce((a, b) => a + Number(b.importe || 0), 0)
      const irpfPendiente = provisiones.filter(p => p.tipo === 'IRPF_ALQ').reduce((a, b) => a + Number(b.importe || 0), 0)

      const facturasPendientes = 0
      const brutoMesActual = (factMes.data ?? []).reduce((a: number, r: any) => a + Number(r.total_bruto || 0), 0)
      const netoMesActual  = (netoMes.data ?? []).reduce((a: number, r: any) => a + Number(r.importe || 0), 0)
      const netoMesAnterior = (netoMesAnt.data ?? []).reduce((a: number, r: any) => a + Number(r.importe || 0), 0)
      const netoUlt30d = netoMesAnterior

      setS({
        loading: false,
        cajaActual,
        ivaPendiente: Math.max(0, ivaPendiente),
        irpfPendiente,
        facturasPendientes,
        brutoMesActual,
        netoMesActual,
        netoUlt30d,
      })
    })()
    return () => { cancel = true }
  }, [periodoDesde.getTime(), periodoHasta.getTime()])

  const dineroReal = s.cajaActual - s.ivaPendiente - s.irpfPendiente - s.facturasPendientes
  const cobrosPendientes = Math.max(0, s.brutoMesActual * 0.70 - s.netoMesActual)
  const proyeccion7d = (s.netoUlt30d / 30) * 7
  const prevision7d = dineroReal + cobrosPendientes + proyeccion7d

  const wrap: CSSProperties = {
    background: T.card,
    border: `1px solid ${T.brd}`,
    borderRadius: 14,
    padding: '22px 26px',
  }
  const title: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 12, color: T.mut,
    letterSpacing: 1.3, textTransform: 'uppercase', fontWeight: 500,
  }

  const linea = (
    label: string,
    value: number,
    opts?: { negativo?: boolean; positivo?: boolean; muted?: boolean },
  ): ReactElement => {
    const color = opts?.negativo ? ROJO_NEG : opts?.positivo ? VERDE_OK : opts?.muted ? T.mut : T.pri
    const prefix = opts?.negativo ? '−' : opts?.positivo ? '+' : ''
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '6px 0', fontFamily: FONT.body, fontSize: 13,
      }}>
        <span style={{ color: T.mut, fontSize: 12, letterSpacing: 0.2 }}>{label}</span>
        <span style={{ color, fontFamily: FONT.heading, fontWeight: 500, letterSpacing: 0.3, fontVariantNumeric: 'tabular-nums' }}>
          {prefix}{fmtEur(Math.abs(value))}
        </span>
      </div>
    )
  }

  const totalLinea = (
    label: string,
    value: number,
    opts?: { positivoNegativo?: boolean },
  ): ReactElement => {
    const signo = value >= 0 ? 'pos' : 'neg'
    const color = !opts?.positivoNegativo
      ? T.pri
      : signo === 'pos' ? VERDE_OK : ROJO_NEG
    const prefix = opts?.positivoNegativo && value !== 0
      ? (signo === 'pos' ? '+' : '−')
      : ''
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '12px 0 0', borderTop: `1px solid ${T.brd}`, marginTop: 8,
      }}>
        <span style={{
          fontFamily: FONT.heading, fontSize: 11, color: T.pri,
          letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600,
        }}>
          {label}
        </span>
        <span style={{
          color, fontFamily: FONT.heading, fontWeight: 600, fontSize: 20,
          letterSpacing: 0.3, fontVariantNumeric: 'tabular-nums',
        }}>
          {prefix}{fmtEur(Math.abs(value))}
        </span>
      </div>
    )
  }

  if (s.loading) {
    return (
      <div style={wrap}>
        <div style={title}>Cashflow real · hoy</div>
        <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 12, marginTop: 8 }}>Cargando…</div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div style={title}>Cashflow real · hoy</div>
        <span
          title="Caja líquida banco, menos provisiones IVA + IRPF + facturas pendientes. Siempre con IVA (es caja real)."
          style={{ cursor: 'help', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}
        >
          ⓘ
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
        <div>
          {linea('Caja líquida banco', s.cajaActual)}
          {linea('Provisión IVA pendiente', s.ivaPendiente, { negativo: true })}
          {linea('Provisión IRPF alquiler', s.irpfPendiente, { negativo: true })}
          {linea('Facturas pendientes pagar', s.facturasPendientes, { negativo: s.facturasPendientes > 0, muted: s.facturasPendientes === 0 })}
          {totalLinea('Dinero real disponible', dineroReal, { positivoNegativo: true })}
        </div>
        <div>
          {linea('Dinero real disponible', dineroReal, { muted: true })}
          {linea('Cobros pendientes plataformas', cobrosPendientes, { positivo: cobrosPendientes > 0, muted: cobrosPendientes === 0 })}
          {linea('Proyección ingresos 7 días', proyeccion7d, { positivo: proyeccion7d > 0, muted: proyeccion7d === 0 })}
          <div style={{ padding: '6px 0', fontSize: 11, color: T.mut, fontStyle: 'italic' }}>
            Proyección media últimos 30 días × 7
          </div>
          {totalLinea('Previsión caja 7 días', prevision7d, { positivoNegativo: true })}
        </div>
      </div>
    </div>
  )
}
