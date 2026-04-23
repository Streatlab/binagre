import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { fmtEur } from '@/utils/format'

const VERDE_OK = '#a0e080'
const ROJO_NEG = '#f47272'
const ACCENT   = '#e8f442'

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
  const { T, isDark } = useTheme()
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
      const hace30 = new Date(hoy); hace30.setDate(hace30.getDate() - 30)

      const [ultMov, provs, factMes, netoMes, netoMesAnt] = await Promise.all([
        supabase.from('conciliacion').select('fecha, importe').order('fecha', { ascending: false }).limit(1000),
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

      // Caja actual: suma acumulada de todos los movimientos (aproximación)
      const cajaActual = (ultMov.data ?? []).reduce((a: number, r: any) => a + Number(r.importe || 0), 0)

      const provisiones = (provs.data ?? []) as { tipo: string; importe: number }[]
      const ivaPendiente = provisiones.filter(p => p.tipo === 'IVA_TRIM').reduce((a, b) => a + Number(b.importe || 0), 0)
      const irpfPendiente = provisiones.filter(p => p.tipo === 'IRPF_ALQ').reduce((a, b) => a + Number(b.importe || 0), 0)

      // facturas pendientes: por ahora 0 hasta que exista sistema de facturas (batch 2B)
      const facturasPendientes = 0

      const brutoMesActual = (factMes.data ?? []).reduce((a: number, r: any) => a + Number(r.total_bruto || 0), 0)
      const netoMesActual  = (netoMes.data ?? []).reduce((a: number, r: any) => a + Number(r.importe || 0), 0)
      const netoMesAnterior = (netoMesAnt.data ?? []).reduce((a: number, r: any) => a + Number(r.importe || 0), 0)
      // Proxy neto últimos 30d: tomamos el neto del mes anterior (primer día a hoy-1)
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
  const cobrosPendientes = Math.max(0, s.brutoMesActual * 0.70 - s.netoMesActual) // ~30% comisión
  const proyeccion7d = (s.netoUlt30d / 30) * 7
  const prevision7d = dineroReal + cobrosPendientes + proyeccion7d

  const wrap: CSSProperties = {
    background: isDark ? '#484f66' : T.card,
    border: `1px solid ${T.brd}`,
    borderRadius: 14,
    padding: '22px 26px',
  }
  const title: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 12, color: T.mut,
    letterSpacing: 1.3, textTransform: 'uppercase', fontWeight: 500, marginBottom: 14,
  }
  const linea = (label: string, value: number, opts?: { negativo?: boolean; positivo?: boolean; muted?: boolean }): ReactElement => {
    const color = opts?.negativo ? ROJO_NEG : opts?.positivo ? VERDE_OK : opts?.muted ? T.mut : T.pri
    const prefix = opts?.negativo ? '−' : opts?.positivo ? '+' : ''
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', fontFamily: FONT.body, fontSize: 13 }}>
        <span style={{ color: opts?.muted ? T.mut : T.pri }}>{label}</span>
        <span style={{ color, fontFamily: FONT.heading, fontWeight: 500, letterSpacing: 0.3, fontVariantNumeric: 'tabular-nums' }}>
          {prefix}{fmtEur(Math.abs(value))}
        </span>
      </div>
    )
  }

  const totalLinea = (label: string, value: number, accent = false): ReactElement => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '10px 0 4px', borderTop: `1px solid ${T.brd}`, marginTop: 4,
      fontFamily: FONT.heading, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600,
    }}>
      <span style={{ color: accent ? ACCENT : T.pri }}>{label}</span>
      <span style={{
        color: accent ? ACCENT : T.pri, fontSize: 18,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {fmtEur(value)}
      </span>
    </div>
  )

  if (s.loading) {
    return (
      <div style={wrap}>
        <div style={title}>Cashflow real · hoy</div>
        <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>Cargando…</div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={title}>Cashflow real · hoy</div>
        <span
          title="Caja líquida banco, menos provisiones IVA + IRPF + facturas pendientes. Siempre con IVA (es caja real)."
          style={{ cursor: 'help', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}
        >
          ⓘ
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          {linea('Caja líquida banco', s.cajaActual)}
          {linea('Provisión IVA pendiente', s.ivaPendiente, { negativo: true })}
          {linea('Provisión IRPF alquiler', s.irpfPendiente, { negativo: true })}
          {linea('Facturas pendientes pagar', s.facturasPendientes, { negativo: true, muted: s.facturasPendientes === 0 })}
          {totalLinea('Dinero real disponible', dineroReal, true)}
        </div>
        <div>
          {linea('Dinero real disponible', dineroReal, { muted: true })}
          {linea('Cobros pendientes plataformas', cobrosPendientes, { positivo: true })}
          {linea('Proyección ingresos 7 días', proyeccion7d, { positivo: true })}
          <div style={{ height: 24 }} />
          {totalLinea('Previsión caja 7 días', prevision7d)}
        </div>
      </div>
    </div>
  )
}
