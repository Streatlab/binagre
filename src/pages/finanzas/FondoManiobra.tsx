/**
 * Fondo de Maniobra — FM y NOF (Necesidades Operativas de Fondos).
 * CANTERA ALEGRE v1.0 (área Tesorería · azul). Solo capa visual; datos vía useFondoManiobra.
 */
import React, { useMemo } from 'react'
import { useFondoManiobra } from '@/lib/finanzas/useFondoManiobra'
import { OSW, LEX, INK, CREMA, GRANATE, AMA, VERDE, ROJO, NAR, GRIS, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
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

export function FondoManiobra({ embedded = false }: { embedded?: boolean } = {}) {
  const {
    loading, error,
    caja, cajaOrigen,
    cobrosPendientes, cobrosPendientesCount,
    activoCorriente,
    pasivoCorrienteFacturas, pasivoCorrienteFacturasCount,
    fondoManiobra, nof,
    deudaCuotasUltimos12Meses, deudaCuotas,
    mesRiesgo,
  } = useFondoManiobra()

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

  const fmPositivo = fondoManiobra >= 0
  const nofPositivo = nof >= 0

  const titular = mesRiesgo
    ? <>Se te viene un valle de tesorería en <b style={{ textTransform: 'capitalize' }}>{labelMes(mesRiesgo.mes)}</b>.</>
    : fmPositivo ? 'Tu fondo de maniobra cubre el pasivo corriente.' : 'El pasivo corriente no está cubierto.'

  const atencion = [
    `NOF ${fmtEur(nof, { decimals: 0 })}`,
    mesRiesgo ? `Riesgo: ${labelMes(mesRiesgo.mes)}` : 'Sin mes de riesgo detectado',
    `Cobros pendientes (${cobrosPendientesCount})`,
    `Facturas vivas (${pasivoCorrienteFacturasCount})`,
  ]

  return (
    <PantallaCantera embedded={embedded}>
      {/* 1 · Héroe del área Tesorería (azul) */}
      <HeroCantera
        area="tesoreria"
        titular={titular}
        etiquetaDato="Fondo de maniobra actual"
        cifra={fmtEur(fondoManiobra, { decimals: 0 })}
        resumen={mesRiesgo
          ? <>Las ventas proyectadas ({fmtEur(mesRiesgo.ventasMes, { decimals: 0 })}) superan al mes anterior, pero la caja proyectada cae a <b>{fmtEur(mesRiesgo.cajaProyectada, { decimals: 0 })}</b>.</>
          : <>NOF (necesidades operativas de fondos): <b>{fmtEur(nof, { decimals: 0 })}</b>.</>}
        atencion={atencion}
      />

      {/* 2 · Plancha comparativa FM / NOF / Mes de riesgo */}
      <div>
        <SeccionLabel bg={AMA} color={INK}>Salud financiera actual</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={fmPositivo ? VERDE : ROJO} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Fondo de maniobra</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(fondoManiobra, { decimals: 0 })}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{fmPositivo ? 'Cubre el pasivo corriente' : 'No cubre el pasivo corriente'}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={nofPositivo ? VERDE : ROJO}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>NOF actual</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(nof, { decimals: 0 })}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>Cobros pendientes − pasivo corriente</div>
          </PlanchaCelda>
          <PlanchaCelda bg={mesRiesgo ? ROJO : VERDE}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Mes de riesgo (próx. 6 meses)</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: mesRiesgo ? 20 : 24, lineHeight: 1.05, marginTop: 6, textTransform: 'capitalize' }}>{mesRiesgo ? labelMes(mesRiesgo.mes) : 'Ninguno detectado'}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{mesRiesgo ? 'Ventas suben, caja proyectada negativa' : 'La caja proyectada se mantiene positiva'}</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* 3 · Frase potente (color por significado, distinta del héroe azul) */}
      {mesRiesgo ? (
        <FrasePotente significado="peligro">Revisa cobros pendientes y facturas sin procesar antes de {labelMes(mesRiesgo.mes)}.</FrasePotente>
      ) : (
        <FrasePotente significado="logro">El fondo de maniobra cubre las obligaciones a corto: la caja proyectada no cae mientras dure el patrón actual.</FrasePotente>
      )}

      {/* Desglose Activo corriente vs Pasivo corriente — papel (sin sombra) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
        <div>
          <SeccionLabel bg={VERDE}>Activo corriente</SeccionLabel>
          <Papel ceja={VERDE} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
              <tbody>
                <tr style={{ borderBottom: `2px solid ${INK}` }}>
                  <td style={tdStyle}>
                    Caja
                    {cajaOrigen === 'extracto' && <span style={{ marginLeft: 6, color: VERDE, fontSize: 11 }}>(extracto real)</span>}
                    {cajaOrigen === 'manual' && <span style={{ marginLeft: 6, color: GRIS, fontSize: 11 }}>(manual, sin extracto)</span>}
                    {cajaOrigen === 'sin_datos' && <span style={{ marginLeft: 6, color: GRIS, fontSize: 11 }}>(sin dato)</span>}
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
          </Papel>
        </div>

        <div>
          <SeccionLabel bg={GRANATE}>Pasivo corriente</SeccionLabel>
          <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
              <tbody>
                <tr style={{ borderBottom: `2px solid ${INK}` }}>
                  <td style={tdStyle}>
                    Facturas de proveedor vivas sin conciliar <span style={{ color: GRIS, fontSize: 11 }}>({pasivoCorrienteFacturasCount})</span>
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
          </Papel>
        </div>
      </div>

      {/* Deuda financiera (referencia) — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={NAR}>Deuda financiera (referencia)</SeccionLabel>
        <Papel ceja={NAR} pad="0" style={{ overflowX: 'auto' }}>
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
        </Papel>
        <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 8 }}>
          Total cuotas pagadas (últimas {deudaOrdenada.length} filas, máx. 24): <strong style={{ color: INK }}>{fmtEur(deudaCuotasUltimos12Meses, { decimals: 0 })}</strong>.
          No incluido en el pasivo corriente — TODO fuente de datos: no hay saldo vivo de deuda en BD, solo cuotas ya pagadas.
        </div>
      </div>
    </PantallaCantera>
  )
}

const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '10px 12px' }

export default FondoManiobra
