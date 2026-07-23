/**
 * Tesorería 13 semanas — previsión de caja semana a semana.
 * CANTERA ALEGRE v1.0 (área Tesorería · azul). Solo capa visual; lógica en
 * @/lib/finanzas/useTesoreria13Semanas.
 */
import React from 'react'
import { useTesoreria13Semanas, UMBRAL_VERDE, type SemanaTesoreria, type Estado, } from '@/lib/finanzas/useTesoreria13Semanas'
import { OSW, LEX, INK, CREMA, GRANATE, VERDE, ROJO, NAR, AMA, GRIS, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
import { fmtEur } from '@/lib/format'

const ESTADO_LABEL: Record<Estado, string> = { verde: 'Holgado', ambar: 'Ajustado', rojo: 'En números rojos' }
const ESTADO_COLOR: Record<Estado, string> = { verde: VERDE, ambar: AMA, rojo: ROJO }
const ESTADO_FG: Record<Estado, string> = { verde: BLANCO, ambar: INK, rojo: BLANCO }

export function Tesoreria13Semanas({ embedded = false }: { embedded?: boolean } = {}) {
  const {
    loading, error, saldoInicial, saldoInicialFuente,
    semanas, semanaCritica, saldoMinimo,
    gastosFijosCount, gastoOperativoSemanal,
    nominaSemanal, segSocialSemanal, nominasCount, segSocialCount,
  } = useTesoreria13Semanas()

  if (loading) {
    return <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando tesorería…</div>
  }
  if (error) {
    return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>
  }

  const estadoMinimo: Estado = semanaCritica?.estado ?? 'verde'

  const titular = estadoMinimo === 'rojo'
    ? 'Vas a entrar en números rojos en las próximas 13 semanas.'
    : estadoMinimo === 'ambar'
    ? 'Tu caja aguanta el mes, pero se ajusta.'
    : 'Tu caja aguanta holgada las 13 semanas.'

  const atencion = [
    semanaCritica ? `Semana más crítica: ${semanaCritica.semana}` : 'Sin semana crítica',
    `Nóminas ${fmtEur(nominaSemanal, { decimals: 0 })}/sem${nominasCount === 0 ? ' (sin nóminas cargadas)' : ''}`,
    `Seg. Social ${fmtEur(segSocialSemanal, { decimals: 0 })}/sem${segSocialCount === 0 ? ' (sin resúmenes cargados)' : ''}`,
    `Gasto operativo ${fmtEur(gastoOperativoSemanal, { decimals: 0 })}/sem`,
  ]

  return (
    <PantallaCantera embedded={embedded}>
      {/* 1 · Héroe del área Tesorería (azul) */}
      <HeroCantera
        area="tesoreria"
        periodo="Próximas 13 semanas"
        titular={titular}
        etiquetaDato="Saldo mínimo previsto"
        cifra={fmtEur(saldoMinimo, { decimals: 2, signed: true })}
        resumen={<>Saldo hoy <b>{fmtEur(saldoInicial, { decimals: 2 })}</b> ({saldoInicialFuente === 'extracto' ? 'extracto bancario real' : saldoInicialFuente === 'manual' ? 'saldo de banco manual' : 'sin saldo disponible, asumido 0 €'}). {ESTADO_LABEL[estadoMinimo]} · umbral verde {fmtEur(UMBRAL_VERDE, { decimals: 0 })}.</>}
        atencion={atencion}
      />

      {/* 2 · Plancha comparativa Saldo hoy / Semana crítica / Saldo mínimo */}
      <div>
        <SeccionLabel bg={AMA} color={INK}>Resumen de caja</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={INK} color={BLANCO} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Saldo hoy</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(saldoInicial, { decimals: 2 })}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={GRIS}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Semana más crítica</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 18, lineHeight: 1.15, marginTop: 6 }}>{semanaCritica ? semanaCritica.semana : '—'}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={ESTADO_COLOR[estadoMinimo]} color={ESTADO_FG[estadoMinimo]}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Saldo mínimo previsto</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(saldoMinimo, { decimals: 2, signed: true })}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{ESTADO_LABEL[estadoMinimo]}</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* 3 · Frase potente (color por significado, distinta del héroe azul) */}
      {estadoMinimo === 'rojo' ? (
        <FrasePotente significado="peligro">Adelanta cobros o retrasa gastos no imprescindibles antes de {semanaCritica ? semanaCritica.semana : 'la semana crítica'}.</FrasePotente>
      ) : estadoMinimo === 'ambar' ? (
        <FrasePotente significado="coste">El margen se ajusta: un imprevisto en {semanaCritica ? semanaCritica.semana : 'la semana crítica'} puede llevarte a números rojos.</FrasePotente>
      ) : (
        <FrasePotente significado="logro">La previsión se mantiene holgada las 13 semanas con el patrón actual de cobros y gastos.</FrasePotente>
      )}

      {/* Tabla de 13 semanas — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={GRANATE}>Previsión semana a semana</SeccionLabel>
        <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
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
                  <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.semana}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: VERDE, fontFamily: OSW, fontWeight: 600 }}>{fmtEur(s.entradas, { decimals: 2 })}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: NAR, fontFamily: OSW, fontWeight: 600 }}>{fmtEur(s.salidas, { decimals: 2 })}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 600, color: s.saldoSemana >= 0 ? VERDE : ROJO }}>{fmtEur(s.saldoSemana, { decimals: 2, signed: true })}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: s.saldoAcumulado >= 0 ? INK : ROJO }}>{fmtEur(s.saldoAcumulado, { decimals: 2, signed: true })}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <span style={{ background: ESTADO_COLOR[s.estado], color: ESTADO_FG[s.estado], border: `2px solid ${INK}`, padding: '3px 9px', fontSize: 11, fontFamily: OSW, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {ESTADO_LABEL[s.estado]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Papel>
        <div style={{ marginTop: 10, display: 'flex', gap: 18, flexWrap: 'wrap', fontFamily: LEX, fontSize: 12, color: GRIS }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: VERDE, border: `2px solid ${INK}`, display: 'inline-block' }} />Verde · saldo ≥ {fmtEur(UMBRAL_VERDE, { decimals: 0 })}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: AMA, border: `2px solid ${INK}`, display: 'inline-block' }} />Ámbar · entre 0 € y {fmtEur(UMBRAL_VERDE, { decimals: 0 })}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: ROJO, border: `2px solid ${INK}`, display: 'inline-block' }} />Rojo · saldo negativo</span>
        </div>
      </div>

      {gastosFijosCount === 0 && (
        <Papel ceja={AMA}>
          <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', color: INK, marginBottom: 6 }}>Gastos fijos sin cargar</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, lineHeight: 1.4 }}>
            La tabla de gastos fijos (alquileres, nóminas, suscripciones…) está vacía todavía, así que las salidas previstas solo reflejan
            el gasto operativo estimado por conciliación bancaria ({fmtEur(gastoOperativoSemanal, { decimals: 2 })}/semana). En cuanto se
            registren gastos fijos activos, esta previsión los sumará automáticamente.
          </div>
        </Papel>
      )}
    </PantallaCantera>
  )
}

export default Tesoreria13Semanas
