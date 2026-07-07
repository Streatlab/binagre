/**
 * Fondo de Maniobra — FM y NOF (Necesidades Operativas de Fondos).
 * Estética Neobrutal Food-Pop (@/styles/neobrutal), estilo de referencia:
 * src/pages/ops/ReclamacionReembolsos.tsx (hero KPIs + tabla cabecera INK + pastillas de estado).
 */
import React, { useMemo } from 'react'
import { useFondoManiobra } from '@/lib/finanzas/useFondoManiobra'
import {
  OSW, LEX, INK, CREMA, SHADOW, BORDER_CARD,
  GRANATE, AMA, VERDE, ROJO, NAR, GRIS, eyebrow,
} from '@/styles/neobrutal'
import { fmtEur, fmtDate } from '@/lib/format'

const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function labelMes(mesKey: string): string {
  const [y, m] = mesKey.split('-').map(Number)
  if (!y || !m) return mesKey
  return `${MESES_LARGO[m - 1]} ${y}`
}

export default function FondoManiobra() {
  const {
    loading, error,
    caja, cajaOrigenBD,
    cobrosPendientes, cobrosPendientesCount,
    activoCorriente,
    pasivoCorrienteFacturas, pasivoCorrienteFacturasCount,
    fondoManiobra, nof,
    deudaCuotasUltimos12Meses, deudaCuotas,
    mesRiesgo,
  } = useFondoManiobra()

  const card: React.CSSProperties = { background: '#fff', border: BORDER_CARD, boxShadow: SHADOW }

  const fmColor = fondoManiobra >= 0 ? VERDE : ROJO
  const nofColor = nof >= 0 ? VERDE : ROJO
  const riesgoColor = mesRiesgo ? ROJO : VERDE

  const deudaOrdenada = useMemo(
    () => [...deudaCuotas].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
    [deudaCuotas]
  )

  if (loading) {
    return (
      <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px' }}>
        Cargando fondo de maniobra…
      </div>
    )
  }
  if (error) {
    return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>
  }

  return (
    <div style={{ fontFamily: LEX, padding: 28, background: CREMA, minHeight: '100vh', color: INK }}>

      <div style={{ marginBottom: 20 }}>
        <span style={eyebrow(NAR, '#fff')}>FINANZAS</span>
        <h1 style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color: GRANATE, margin: '10px 0 6px' }}>
          FONDO DE MANIOBRA
        </h1>
        <span style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>
          FM = activo corriente − pasivo corriente · NOF = necesidades operativas de fondos (versión operativa, sin caja)
        </span>
      </div>

      {/* Hero KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ ...card, padding: '16px 20px', background: fmColor }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', marginBottom: 6 }}>Fondo de maniobra actual</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, color: '#fff' }}>{fmtEur(fondoManiobra, { decimals: 0 })}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: '#fff', marginTop: 6 }}>
            {fondoManiobra >= 0 ? 'Cubre el pasivo corriente' : 'No cubre el pasivo corriente'}
          </div>
        </div>
        <div style={{ ...card, padding: '16px 20px', background: nofColor }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', marginBottom: 6 }}>NOF actual</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, color: '#fff' }}>{fmtEur(nof, { decimals: 0 })}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: '#fff', marginTop: 6 }}>
            Cobros pendientes − pasivo corriente (sin stock)
          </div>
        </div>
        <div style={{ ...card, padding: '16px 20px', background: riesgoColor }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', marginBottom: 6 }}>Mes de riesgo (próx. 6 meses)</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: mesRiesgo ? 26 : 34, lineHeight: 1, color: '#fff', textTransform: 'capitalize' }}>
            {mesRiesgo ? labelMes(mesRiesgo.mes) : 'Ninguno detectado'}
          </div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: '#fff', marginTop: 6 }}>
            {mesRiesgo ? 'Ventas suben pero la caja proyectada es negativa' : 'La caja proyectada se mantiene positiva'}
          </div>
        </div>
      </div>

      {/* Alerta de mes de riesgo */}
      {mesRiesgo && (
        <div style={{ ...card, background: ROJO, color: '#fff', padding: '16px 20px', marginBottom: 20, borderColor: INK }}>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 15, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
            Alerta: caja negativa en un mes de ventas crecientes
          </div>
          <div style={{ fontFamily: LEX, fontSize: 13, lineHeight: 1.6 }}>
            En <strong style={{ textTransform: 'capitalize' }}>{labelMes(mesRiesgo.mes)}</strong> las ventas proyectadas
            ({fmtEur(mesRiesgo.ventasMes, { decimals: 0 })}) superan al mes anterior ({fmtEur(mesRiesgo.ventasMesAnterior, { decimals: 0 })}),
            pero la caja proyectada cae a <strong>{fmtEur(mesRiesgo.cajaProyectada, { decimals: 0 })}</strong>.
            Revisa cobros pendientes y facturas sin procesar antes de ese mes.
          </div>
        </div>
      )}

      {/* Desglose Activo corriente vs Pasivo corriente */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
            <thead>
              <tr style={{ background: INK }}>
                <th colSpan={2} style={thStyle}>Activo corriente</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: `2px solid ${INK}` }}>
                <td style={tdStyle}>
                  Caja
                  {!cajaOrigenBD && <span style={{ marginLeft: 6, color: GRIS, fontSize: 11 }}>(sin dato — TODO)</span>}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: OSW, fontWeight: 700 }}>{fmtEur(caja, { decimals: 0 })}</td>
              </tr>
              <tr style={{ borderBottom: `2px solid ${INK}` }}>
                <td style={tdStyle}>Cobros pendientes de plataformas <span style={{ color: GRIS, fontSize: 11 }}>({cobrosPendientesCount})</span></td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: OSW, fontWeight: 700 }}>{fmtEur(cobrosPendientes, { decimals: 0 })}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontFamily: OSW, fontWeight: 700, textTransform: 'uppercase', fontSize: 12 }}>Total activo corriente</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: OSW, fontWeight: 700, fontSize: 16 }}>{fmtEur(activoCorriente, { decimals: 0 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
            <thead>
              <tr style={{ background: INK }}>
                <th colSpan={2} style={thStyle}>Pasivo corriente</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: `2px solid ${INK}` }}>
                <td style={tdStyle}>
                  Facturas de proveedor sin procesar/conciliar <span style={{ color: GRIS, fontSize: 11 }}>({pasivoCorrienteFacturasCount})</span>
                  <div style={{ color: GRIS, fontSize: 11, marginTop: 2 }}>Proxy: no existe tabla de cuentas por pagar dedicada</div>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: OSW, fontWeight: 700 }}>{fmtEur(pasivoCorrienteFacturas, { decimals: 0 })}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontFamily: OSW, fontWeight: 700, textTransform: 'uppercase', fontSize: 12 }}>Total pasivo corriente</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: OSW, fontWeight: 700, fontSize: 16 }}>{fmtEur(pasivoCorrienteFacturas, { decimals: 0 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Deuda financiera (referencia) */}
      <div style={{ marginBottom: 12 }}>
        <span style={eyebrow(AMA, INK)}>DEUDA FINANCIERA (REFERENCIA)</span>
      </div>
      <div style={{ ...card, overflowX: 'auto', marginBottom: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
          <thead>
            <tr style={{ background: INK }}>
              {['Fecha', 'Categoría', 'Importe de cuota'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deudaOrdenada.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 30, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Sin cuotas de préstamo registradas en conciliación.</td></tr>
            )}
            {deudaOrdenada.map((c, i) => (
              <tr key={i} style={{ borderBottom: `2px solid ${INK}` }}>
                <td style={tdStyle}>{fmtDate(c.fecha)}</td>
                <td style={{ ...tdStyle, fontFamily: OSW, fontSize: 12, color: GRIS }}>{c.categoria}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: OSW, fontWeight: 700 }}>{fmtEur(c.importe, { decimals: 0 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 4 }}>
        Total cuotas pagadas (últimas {deudaOrdenada.length} filas, máx. 24): <strong style={{ color: INK }}>{fmtEur(deudaCuotasUltimos12Meses, { decimals: 0 })}</strong>.
        No incluido en el pasivo corriente — TODO fuente de datos: no hay saldo vivo de deuda en BD, solo cuotas ya pagadas.
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '10px 12px' }
