/**
 * Break-even por marca y canal — Neobrutal Food-Pop (@/styles/neobrutal).
 * Break-even DESGLOSADO por combinación marca×canal (nunca global). Ver
 * src/pages/finanzas/PuntoEquilibrio.tsx para el punto de equilibrio global de la empresa.
 */
import React, { useMemo, useState } from 'react'
import { useBreakEvenCanal, computeBreakEvenKpis, CANAL_LABELS, } from '../../lib/finanzas/useBreakEvenCanal'
import type { CanalId, ComboBreakEven } from '../../lib/finanzas/useBreakEvenCanal'
import {
  OSW, LEX, INK, CREMA, SHADOW, BORDER_CARD, GRANATE, AMA, VERDE, ROJO, GRIS, CORP, eyebrow, BLANCO } from '@/styles/neobrutal'
import { fmtEur, fmtPct, fmtMes } from '@/lib/format'

type CanalFiltro = CanalId | 'all'

const corpKey = (canal: CanalId) => (canal === 'just_eat' ? 'je' : canal)
const canalColor = (canal: CanalId) => CORP[corpKey(canal)] ?? GRANATE

type Estado = 'encima' | 'debajo' | 'no_alcanzable' | 'sin_dato'

function estadoDeCombo(c: ComboBreakEven): Estado {
  if (c.margenContribPct == null) return 'sin_dato'
  if (!c.alcanzable) return 'no_alcanzable'
  if (c.gap != null && c.gap >= 0) return 'encima'
  return 'debajo'
}

const ESTADO_LABEL: Record<Estado, string> = {
  encima: 'Por encima',
  debajo: 'Por debajo',
  no_alcanzable: 'No alcanzable',
  sin_dato: 'Sin dato',
}

const estadoColor = (e: Estado): { bg: string; fg: string } => {
  switch (e) {
    case 'encima':        return { bg: VERDE, fg: BLANCO }
    case 'debajo':        return { bg: ROJO,  fg: BLANCO }
    case 'no_alcanzable': return { bg: ROJO,  fg: BLANCO }
    case 'sin_dato':      return { bg: GRIS,  fg: BLANCO }
  }
}

/** Orden ascendente por gap: no-alcanzables primero (peor situación posible),
 *  luego el resto de gaps de menor a mayor, y por último las filas sin dato. */
function ordenarPorGap(combos: ComboBreakEven[]): ComboBreakEven[] {
  const rank = (c: ComboBreakEven) => {
    if (c.margenContribPct == null) return 2 // sin dato → al final
    if (!c.alcanzable) return -1 // no alcanzable → primero (peor)
    return 0
  }
  return [...combos].sort((a, b) => {
    const ra = rank(a), rb = rank(b)
    if (ra !== rb) return ra - rb
    if (ra === 0) return (a.gap ?? 0) - (b.gap ?? 0)
    return b.bruto - a.bruto
  })
}

export function BreakEvenCanal({ embedded = false }: { embedded?: boolean } = {}) {
  const { loading, error, mesReferencia, combos, costesFijosTotalesMes, totalBrutoMes } = useBreakEvenCanal()
  const [filtroCanal, setFiltroCanal] = useState<CanalFiltro>('all')

  const kpis = useMemo(() => computeBreakEvenKpis(combos), [combos])

  const filtrados = useMemo(() => {
    const base = filtroCanal === 'all' ? combos : combos.filter(c => c.canal === filtroCanal)
    return ordenarPorGap(base)
  }, [combos, filtroCanal])

  const card: React.CSSProperties = { background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW }

  if (loading) {
    return <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando break-even…</div>
  }
  if (error) {
    return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>
  }

  return (
    <div style={{ fontFamily: LEX, padding: embedded ? 0 : 28, background: embedded ? 'transparent' : CREMA, minHeight: embedded ? 'auto' : '100vh', color: INK }}>

      {!embedded && (
        <div style={{ marginBottom: 20 }}>
          <span style={eyebrow(AMA, INK)}>FINANZAS</span>
          <h1 style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color: GRANATE, margin: '10px 0 6px' }}>
            BREAK-EVEN POR CANAL
          </h1>
          <span style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>
            {mesReferencia
              ? `Punto de equilibrio por marca y plataforma · ${fmtMes(mesReferencia.mes)} ${mesReferencia.año} · costes fijos del mes (equipo + alquiler): ${fmtEur(costesFijosTotalesMes, { decimals: 2 })}`
              : 'Sin datos de facturación por marca y canal para el año en curso.'}
          </span>
        </div>
      )}

      {combos.length === 0 ? (
        <div style={{ ...card, padding: 30, textAlign: 'center', color: GRIS, fontFamily: LEX }}>
          No hay combinaciones marca×canal con datos este año. {/* TODO fuente de datos: resumenes_plataforma_marca_mensual */}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div style={{ ...card, padding: '16px 20px', background: AMA }}>
              <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: INK, marginBottom: 6 }}>Break-even global</div>
              <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 30, lineHeight: 1, color: INK }}>{fmtEur(kpis.breakEvenGlobal, { decimals: 2 })}</div>
              <div style={{ fontFamily: LEX, fontSize: 12, color: INK, marginTop: 6 }}>
                Suma del break-even de las combinaciones que sí pueden alcanzarlo · ventas reales del periodo: {fmtEur(totalBrutoMes, { decimals: 2 })}
              </div>
            </div>

            <div style={{ ...card, padding: '16px 20px', background: ROJO }}>
              <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: BLANCO, marginBottom: 6 }}>Marca más lejos del equilibrio</div>
              {kpis.peorCombo ? (
                <>
                  <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, lineHeight: 1.1, color: BLANCO }}>
                    {kpis.peorCombo.marca} · {CANAL_LABELS[kpis.peorCombo.canal]}
                  </div>
                  <div style={{ fontFamily: LEX, fontSize: 12, color: BLANCO, marginTop: 6 }}>
                    {kpis.peorCombo.alcanzable && kpis.peorCombo.gap != null
                      ? `Gap: ${fmtEur(kpis.peorCombo.gap, { signed: true, decimals: 2 })}`
                      : 'No alcanzable con el margen de contribución actual'}
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: LEX, fontSize: 13, color: BLANCO }}>Sin datos suficientes</div>
              )}
            </div>

            <div style={{ ...card, padding: '16px 20px', background: VERDE }}>
              <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: BLANCO, marginBottom: 6 }}>Canal más rentable</div>
              {kpis.canalMasRentable ? (
                <>
                  <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 30, lineHeight: 1, color: BLANCO }}>
                    {CANAL_LABELS[kpis.canalMasRentable.canal]}
                  </div>
                  <div style={{ fontFamily: LEX, fontSize: 12, color: BLANCO, marginTop: 6 }}>
                    Margen de contribución medio: {fmtPct(kpis.canalMasRentable.margenMedioPct, 2)}
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: LEX, fontSize: 13, color: BLANCO }}>Sin datos suficientes</div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <select style={selectNeo} value={filtroCanal} onChange={e => setFiltroCanal(e.target.value as CanalFiltro)}>
              <option value="all">Todos los canales</option>
              {(Object.keys(CANAL_LABELS) as CanalId[]).map(c => (
                <option key={c} value={c}>{CANAL_LABELS[c]}</option>
              ))}
            </select>
          </div>

          <div style={{ ...card, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
              <thead>
                <tr style={{ background: INK }}>
                  {['Marca', 'Canal', 'Ventas reales', 'Break-even', 'Gap', 'Estado'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: GRIS, fontFamily: LEX }}>No hay combinaciones con este filtro.</td></tr>
                )}
                {filtrados.map((c, i) => {
                  const estado = estadoDeCombo(c)
                  const ec = estadoColor(estado)
                  return (
                    <tr key={`${c.marca}-${c.canal}-${i}`} style={{ borderBottom: `2px solid ${INK}` }}>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, whiteSpace: 'nowrap' }}>{c.marca}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontSize: 12, textTransform: 'uppercase', color: canalColor(c.canal) }}>{CANAL_LABELS[c.canal]}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtEur(c.bruto, { decimals: 2 })}</td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', color: c.alcanzable ? INK : ROJO }}>
                        {c.margenContribPct == null ? '—' : c.alcanzable ? fmtEur(c.breakEvenVentas, { decimals: 2 }) : 'No alcanzable'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', color: c.gap == null ? GRIS : c.gap >= 0 ? VERDE : ROJO }}>
                        {c.gap == null ? '—' : fmtEur(c.gap, { signed: true, decimals: 2 })}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: ec.bg, color: ec.fg, border: `2px solid ${INK}`, padding: '3px 9px', fontSize: 11, fontFamily: OSW, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          {ESTADO_LABEL[estado]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const selectNeo: React.CSSProperties = { background: BLANCO, border: `3px solid ${INK}`, color: INK, padding: '7px 12px', fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', outline: 'none' }

export default BreakEvenCanal
