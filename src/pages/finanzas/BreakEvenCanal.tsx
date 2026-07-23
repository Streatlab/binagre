/**
 * Break-even por marca y canal — CANTERA ALEGRE v1.0 (área Resultados · amarillo).
 * Break-even DESGLOSADO por combinación marca×canal (nunca global). Ver
 * src/pages/finanzas/PuntoEquilibrio.tsx para el punto de equilibrio global de la empresa.
 * Solo capa visual; datos vía useBreakEvenCanal.
 */
import React, { useMemo, useState } from 'react'
import { useBreakEvenCanal, computeBreakEvenKpis, CANAL_LABELS, } from '../../lib/finanzas/useBreakEvenCanal'
import type { CanalId, ComboBreakEven } from '../../lib/finanzas/useBreakEvenCanal'
import { OSW, LEX, INK, CREMA, GRANATE, AMA, VERDE, ROJO, GRIS, CORP, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
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

  if (loading) {
    return <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando break-even…</div>
  }
  if (error) {
    return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>
  }

  const filtros = (
    <select style={selectNeo} value={filtroCanal} onChange={e => setFiltroCanal(e.target.value as CanalFiltro)}>
      <option value="all">Todos los canales</option>
      {(Object.keys(CANAL_LABELS) as CanalId[]).map(c => (
        <option key={c} value={c}>{CANAL_LABELS[c]}</option>
      ))}
    </select>
  )

  if (combos.length === 0) {
    return (
      <PantallaCantera embedded={embedded}>
        <Papel ceja={AMA}><div style={{ color: GRIS, fontFamily: LEX }}>No hay combinaciones marca×canal con datos este año.</div></Papel>
      </PantallaCantera>
    )
  }

  const pctVsBreakEven = kpis.breakEvenGlobal > 0 ? ((totalBrutoMes / kpis.breakEvenGlobal) - 1) * 100 : null

  const titular = kpis.peorCombo
    ? <>La combinación más lejos del equilibrio es <b>{kpis.peorCombo.marca}</b> en <b>{CANAL_LABELS[kpis.peorCombo.canal]}</b>.</>
    : 'Break-even por marca y canal del periodo.'

  const atencion = [
    kpis.peorCombo ? `Peor: ${kpis.peorCombo.marca} · ${CANAL_LABELS[kpis.peorCombo.canal]}` : null,
    kpis.canalMasRentable ? `Canal más rentable: ${CANAL_LABELS[kpis.canalMasRentable.canal]}` : null,
    mesReferencia ? `Costes fijos del mes: ${fmtEur(costesFijosTotalesMes, { decimals: 2 })}` : null,
    `Ventas reales: ${fmtEur(totalBrutoMes, { decimals: 2 })}`,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera embedded={embedded}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{filtros}</div>

      {/* 1 · Héroe del área Resultados (amarillo) */}
      <HeroCantera
        area="eeff"
        periodo={mesReferencia ? `${fmtMes(mesReferencia.mes)} ${mesReferencia.año}` : undefined}
        titular={titular}
        etiquetaDato="Break-even global · suma de combinaciones alcanzables"
        cifra={fmtEur(kpis.breakEvenGlobal, { decimals: 2 })}
        variacionPct={pctVsBreakEven}
        resumen={<>Ventas reales del periodo: <b>{fmtEur(totalBrutoMes, { decimals: 2 })}</b>.</>}
        atencion={atencion}
      />

      {/* 2 · Plancha comparativa */}
      <div>
        <SeccionLabel bg={AMA} color={INK}>Comparativa de break-even</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={AMA} color={INK} first>
            <div style={etq}>Break-even global</div>
            <div style={cifra(22)}>{fmtEur(kpis.breakEvenGlobal, { decimals: 2 })}</div>
            <div style={sub}>ventas reales {fmtEur(totalBrutoMes, { decimals: 2 })}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={ROJO}>
            <div style={etq}>Marca más lejos del equilibrio</div>
            {kpis.peorCombo ? (
              <>
                <div style={cifra(20)}>{kpis.peorCombo.marca} · {CANAL_LABELS[kpis.peorCombo.canal]}</div>
                <div style={sub}>{kpis.peorCombo.alcanzable && kpis.peorCombo.gap != null ? `Gap ${fmtEur(kpis.peorCombo.gap, { signed: true, decimals: 2 })}` : 'No alcanzable con el margen actual'}</div>
              </>
            ) : <div style={sub}>Sin datos suficientes</div>}
          </PlanchaCelda>
          <PlanchaCelda bg={VERDE}>
            <div style={etq}>Canal más rentable</div>
            {kpis.canalMasRentable ? (
              <>
                <div style={cifra(22)}>{CANAL_LABELS[kpis.canalMasRentable.canal]}</div>
                <div style={sub}>margen medio {fmtPct(kpis.canalMasRentable.margenMedioPct, 2)}</div>
              </>
            ) : <div style={sub}>Sin datos suficientes</div>}
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* 3 · Frase potente */}
      {kpis.peorCombo && (
        kpis.peorCombo.alcanzable
          ? <FrasePotente significado="coste">Cierra el gap de {kpis.peorCombo.marca} en {CANAL_LABELS[kpis.peorCombo.canal]}: es la combinación que más te aleja del equilibrio.</FrasePotente>
          : <FrasePotente significado="coste">{kpis.peorCombo.marca} en {CANAL_LABELS[kpis.peorCombo.canal]} no es alcanzable con el margen de contribución actual: revisa precio o comisión antes de seguir invirtiendo ahí.</FrasePotente>
      )}

      {/* Detalle por combinación */}
      <div>
        <SeccionLabel bg={GRANATE}>Detalle por combinación</SeccionLabel>
        <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
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
        </Papel>
      </div>
    </PantallaCantera>
  )
}

const etq: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }
const cifra = (size: number): React.CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: size, lineHeight: 1.15, marginTop: 6, textTransform: 'uppercase' })
const sub: React.CSSProperties = { fontFamily: LEX, fontSize: 12, marginTop: 4 }

const selectNeo: React.CSSProperties = { background: BLANCO, border: `2px solid ${INK}`, borderRadius: 0, color: INK, padding: '7px 12px', fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', outline: 'none' }

export default BreakEvenCanal
