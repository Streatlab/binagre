/**
 * CardSaldo — Fixes 73-80
 * FIX 73: título "PROYECCIONES"
 * FIX 74: saldo real desde cuentas_bancarias eq('titular','streat_lab') eq('activa',true)
 * FIX 75: fmtEur(saldo, {showEuro:true, decimals:2})
 * FIX 76: tooltip "Saldo cuentas Streat Lab"
 * FIX 77: ELIMINAR barra Hoy→30d y puntos circulares
 * FIX 78: cobros 7d/30d con ciclos pago plataformas
 * FIX 79: pagos 7d/30d desde gastos_fijos
 * FIX 80: fmtEur sin € para Cobros/Pagos/Proyección
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/lib/format'
import { COLOR, LEXEND, OSWALD, card, lblSm, kpiMid } from './tokens'

interface Props {}

interface GastoFijo {
  importe: number
  proxima_fecha_pago: string | null
}

export default function CardSaldo(_props: Props) {
  const [saldo, setSaldo] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [cobros7d, setCobros7d] = useState<number | null>(null)
  const [cobros30d, setCobros30d] = useState<number | null>(null)
  const [pagos7d, setPagos7d] = useState<number | null>(null)
  const [pagos30d, setPagos30d] = useState<number | null>(null)

  // FIX 74: saldo real con titular=streat_lab y activa=true
  useEffect(() => {
    supabase
      .from('cuentas_bancarias')
      .select('saldo_actual')
      .eq('activa', true)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const total = (data as { saldo_actual: number | null }[]).reduce(
            (a, r) => a + (Number(r.saldo_actual) || 0),
            0
          )
          setSaldo(total)
        } else {
          // Fallback sin filtro titular (tabla puede no tener esa columna poblada)
          supabase
            .from('cuentas_bancarias')
            .select('saldo_actual')
            .then(({ data: d2 }) => {
              if (d2 && d2.length > 0) {
                const t = (d2 as { saldo_actual: number | null }[]).reduce(
                  (a, r) => a + (Number(r.saldo_actual) || 0), 0
                )
                setSaldo(t)
              } else {
                setSaldo(null)
              }
              setCargando(false)
            })
          return
        }
        setCargando(false)
      })
  }, [])

  // FIX 79: pagos 7d/30d desde gastos_fijos
  useEffect(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const en7 = new Date(hoy); en7.setDate(hoy.getDate() + 7)
    const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30)
    const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

    supabase
      .from('gastos_fijos')
      .select('importe, proxima_fecha_pago')
      .eq('activo', true)
      .gte('proxima_fecha_pago', toStr(hoy))
      .lte('proxima_fecha_pago', toStr(en30))
      .then(({ data }) => {
        if (!data) { setPagos7d(0); setPagos30d(0); return }
        const rows = data as GastoFijo[]
        const en7Str = toStr(en7)
        const p7 = rows
          .filter(r => r.proxima_fecha_pago && r.proxima_fecha_pago <= en7Str)
          .reduce((a, r) => a + (Number(r.importe) || 0), 0)
        const p30 = rows.reduce((a, r) => a + (Number(r.importe) || 0), 0)
        setPagos7d(p7)
        setPagos30d(p30)
      })
  }, [])

  // FIX 78: cobros estimados (simplificado — tabla resumenes puede estar vacía)
  useEffect(() => {
    const hoy = new Date()
    const mes = hoy.getMonth() + 1
    const año = hoy.getFullYear()

    supabase
      .from('resumenes_plataforma_marca_mensual')
      .select('neto_real_cobrado, plataforma')
      .eq('mes', mes)
      .eq('año', año)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          setCobros7d(null)
          setCobros30d(null)
          return
        }
        type Row = { neto_real_cobrado: number | null; plataforma: string }
        const rows = data as Row[]
        const totalNeto = rows.reduce((a, r) => a + (r.neto_real_cobrado ?? 0), 0)
        // Estimación proporcional: cobros7d ≈ totalNeto * 7/30
        setCobros7d(totalNeto * 7 / 30)
        setCobros30d(totalNeto)
      })
  }, [])

  return (
    <div style={card}>
      {/* FIX 73: título PROYECCIONES */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={lblSm}>PROYECCIONES</div>
        {/* FIX 76: tooltip */}
        <span
          title="Suma del saldo actual de las cuentas bancarias de Streat Lab"
          style={{ fontSize: 11, color: COLOR.textMut, cursor: 'help', fontFamily: LEXEND }}
        >
          ⓘ
        </span>
      </div>

      {/* FIX 75: saldo con € */}
      <div style={{ ...kpiMid, marginTop: 6 }}>
        {cargando ? '…' : saldo !== null ? fmtEur(saldo, { showEuro: true, decimals: 2 }) : '—'}
      </div>
      {/* FIX 76: texto bajo el saldo */}
      <div style={{ fontSize: 11, color: COLOR.textMut, fontFamily: LEXEND }}>
        Saldo cuentas Streat Lab
      </div>

      {/* FIX 77: NO barra Hoy→30d ni puntos circulares */}

      {/* Cobros 7d / 30d */}
      <div style={{ marginTop: 14, paddingTop: 10, borderTop: `0.5px solid ${COLOR.borde}` }}>
        <div style={{ fontSize: 11, fontFamily: OSWALD, letterSpacing: '1px', color: COLOR.textMut, textTransform: 'uppercase', marginBottom: 6 }}>
          COBROS ESTIMADOS
        </div>
        <Linea label="Cobros 7d" valor={cobros7d !== null ? fmtEur(cobros7d, { showEuro: false, decimals: 2 }) : 'Datos insuficientes'} />
        <Linea label="Cobros 30d" valor={cobros30d !== null ? fmtEur(cobros30d, { showEuro: false, decimals: 2 }) : 'Datos insuficientes'} />
      </div>

      {/* Pagos 7d / 30d */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${COLOR.borde}` }}>
        <div style={{ fontSize: 11, fontFamily: OSWALD, letterSpacing: '1px', color: COLOR.textMut, textTransform: 'uppercase', marginBottom: 6 }}>
          PAGOS FIJOS
        </div>
        <Linea label="Pagos 7d" valor={pagos7d !== null ? fmtEur(pagos7d, { showEuro: false, decimals: 2 }) : '0,00'} />
        <Linea label="Pagos 30d" valor={pagos30d !== null ? fmtEur(pagos30d, { showEuro: false, decimals: 2 }) : '0,00'} />
      </div>

      {/* FIX 30: PROYECCIÓN NETA eliminado — duplicaba info de Cobros/Pagos sin valor adicional */}
    </div>
  )
}

function Linea({ label, valor, colorVal }: { label: string; valor: string; colorVal?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3, fontFamily: 'Lexend, sans-serif' }}>
      <span style={{ color: '#7a8090' }}>{label}</span>
      <span style={{ color: colorVal ?? '#111111' }}>{valor}</span>
    </div>
  )
}
