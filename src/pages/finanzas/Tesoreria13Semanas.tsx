/**
 * Tesorería 13 semanas — previsión de caja semana a semana.
 * Estética Neobrutal Food-Pop (@/styles/neobrutal).
 * Lógica de proyección en @/lib/finanzas/useTesoreria13Semanas.
 */
import React from 'react'
import {
  useTesoreria13Semanas, UMBRAL_VERDE,
  type SemanaTesoreria, type Estado,
} from '@/lib/finanzas/useTesoreria13Semanas'
import {
  OSW, LEX, INK, CREMA, SHADOW, BORDER_CARD,
  GRANATE, VERDE, ROJO, NAR, AMA, GRIS, eyebrow,
} from '@/styles/neobrutal'
import { fmtEur } from '@/lib/format'

const ESTADO_LABEL: Record<Estado, string> = { verde: 'Holgado', ambar: 'Ajustado', rojo: 'En números rojos' }
const ESTADO_COLOR: Record<Estado, string> = { verde: VERDE, ambar: AMA, rojo: ROJO }
const ESTADO_FG: Record<Estado, string> = { verde: '#fff', ambar: INK, rojo: '#fff' }

export default function Tesoreria13Semanas() {
  const {
    loading, error, saldoInicial, saldoInicialFuente,
    semanas, semanaCritica, saldoMinimo,
    gastosFijosCount, gastoOperativoSemanal,
    nominaSemanal, segSocialSemanal, nominasCount, segSocialCount,
  } = useTesoreria13Semanas()

  const card: React.CSSProperties = { background: '#fff', border: BORDER_CARD, boxShadow: SHADOW }

  if (loading) {
    return <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando tesorería…</div>
  }
  if (error) {
    return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>
  }

  const estadoMinimo: Estado = semanaCritica?.estado ?? 'verde'

  return (
    <div style={{ fontFamily: LEX, padding: 28, background: CREMA, minHeight: '100vh', color: INK }}>

      <div style={{ marginBottom: 20 }}>
        <span style={eyebrow(GRANATE, '#fff')}>FINANZAS</span>
        <h1 style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color: GRANATE, margin: '10px 0 6px' }}>
          TESORERÍA 13 SEMANAS
        </h1>
        <span style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>Previsión de caja semana a semana, desde el próximo lunes</span>
      </div>

      {/* Hero KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Saldo hoy</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, color: INK }}>{fmtEur(saldoInicial, { decimals: 2 })}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 6 }}>
            {saldoInicialFuente === 'extracto' ? 'Extracto bancario real'
              : saldoInicialFuente === 'manual' ? 'Saldo de banco manual'
              : 'Sin saldo disponible · asumido 0 €'}
          </div>
        </div>
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Semana más crítica</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, lineHeight: 1.15, color: INK }}>{semanaCritica ? semanaCritica.semana : '—'}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 6 }}>Punto más bajo del saldo acumulado previsto</div>
        </div>
        <div style={{ ...card, padding: '16px 20px', background: ESTADO_COLOR[estadoMinimo] }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: ESTADO_FG[estadoMinimo], marginBottom: 6 }}>Saldo mínimo previsto</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, color: ESTADO_FG[estadoMinimo] }}>{fmtEur(saldoMinimo, { decimals: 2, signed: true })}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: ESTADO_FG[estadoMinimo], marginTop: 6 }}>{ESTADO_LABEL[estadoMinimo]} · umbral verde {fmtEur(UMBRAL_VERDE, { decimals: 0 })}</div>
        </div>
      </div>

      {/* Tabla de 13 semanas */}
      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
          <thead>
            <tr style={{ background: INK }}>
              {['Semana', 'Entradas', 'Salidas', 'Saldo semana', 'Saldo acumulado', 'Estado'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Semana' ? 'left' : 'right', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semanas.map((s: SemanaTesoreria) => (
              <tr key={s.index} style={{ borderBottom: `2px solid ${INK}`, borderLeft: `6px solid ${ESTADO_COLOR[s.estado]}` }}>
                <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, whiteSpace: 'nowrap', background: '#fff' }}>{s.semana}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: VERDE, fontFamily: OSW, fontWeight: 600, background: '#fff' }}>{fmtEur(s.entradas, { decimals: 2 })}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: NAR, fontFamily: OSW, fontWeight: 600, background: '#fff' }}>{fmtEur(s.salidas, { decimals: 2 })}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 600, color: s.saldoSemana >= 0 ? VERDE : ROJO, background: '#fff' }}>{fmtEur(s.saldoSemana, { decimals: 2, signed: true })}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: s.saldoAcumulado >= 0 ? INK : ROJO, background: '#fff' }}>{fmtEur(s.saldoAcumulado, { decimals: 2, signed: true })}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', background: '#fff' }}>
                  <span style={{ background: ESTADO_COLOR[s.estado], color: ESTADO_FG[s.estado], border: `2px solid ${INK}`, padding: '3px 9px', fontSize: 11, fontFamily: OSW, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {ESTADO_LABEL[s.estado]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 18, flexWrap: 'wrap', fontFamily: LEX, fontSize: 12, color: GRIS }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: VERDE, border: `2px solid ${INK}`, display: 'inline-block' }} />Verde · saldo ≥ {fmtEur(UMBRAL_VERDE, { decimals: 0 })}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: AMA, border: `2px solid ${INK}`, display: 'inline-block' }} />Ámbar · entre 0 € y {fmtEur(UMBRAL_VERDE, { decimals: 0 })}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: ROJO, border: `2px solid ${INK}`, display: 'inline-block' }} />Rojo · saldo negativo</span>
      </div>

      <div style={{ marginTop: 14, ...card, padding: '12px 16px', display: 'flex', gap: 22, flexWrap: 'wrap', fontFamily: LEX, fontSize: 12 }}>
        <span style={{ color: GRIS }}>Desglose salidas/semana:</span>
        <span>Nóminas <strong style={{ color: INK }}>{fmtEur(nominaSemanal, { decimals: 2 })}</strong> {nominasCount === 0 && <em style={{ color: GRIS }}>(sin nóminas cargadas)</em>}</span>
        <span>Seguridad Social <strong style={{ color: INK }}>{fmtEur(segSocialSemanal, { decimals: 2 })}</strong> {segSocialCount === 0 && <em style={{ color: GRIS }}>(sin resúmenes cargados)</em>}</span>
        <span>Gasto operativo <strong style={{ color: INK }}>{fmtEur(gastoOperativoSemanal, { decimals: 2 })}</strong></span>
      </div>

      {gastosFijosCount === 0 && (
        <div style={{ marginTop: 18, border: `3px dashed ${INK}`, padding: '14px 18px', background: '#fff', boxShadow: SHADOW }}>
          <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', color: INK, marginBottom: 6 }}>Gastos fijos sin cargar</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, lineHeight: 1.4 }}>
            La tabla de gastos fijos (alquileres, nóminas, suscripciones…) está vacía todavía, así que las salidas previstas solo reflejan
            el gasto operativo estimado por conciliación bancaria ({fmtEur(gastoOperativoSemanal, { decimals: 2 })}/semana). En cuanto se
            registren gastos fijos activos, esta previsión los sumará automáticamente.
          </div>
        </div>
      )}
    </div>
  )
}
