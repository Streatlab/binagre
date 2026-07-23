/**
 * RoiCanal — ROI por canal de venta (inversión/comisión vs retorno real cobrado).
 * CANTERA ALEGRE v1.0 (área Resultados · amarillo). Solo capa visual; datos vía useRoiCanal.
 */
import React, { useState } from 'react'
import { useRoiCanal, MESES_ROI, type PeriodoRoi, type CanalRoi } from '@/lib/finanzas/useRoiCanal'
import { OSW, LEX, INK, CREMA, GRANATE, AMA, VERDE, ROJO, NAR, GRIS, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'
import { fmtEur } from '@/lib/format'

/** Formato "veces": 1 decimal, coma es_ES, sufijo "x". Sin datos → "—". */
const fmtRoi = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'x'
const fmtPedidos = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })

export function RoiCanal({ embedded = false }: { embedded?: boolean } = {}) {
  const [periodo, setPeriodo] = useState<PeriodoRoi>('ultimo_mes')
  const año = new Date().getFullYear()
  const { loading, error, canales, mejor, peor, roiMedio } = useRoiCanal(periodo, año)
  const hayEmpate = !!mejor && !!peor && mejor.plataforma === peor.plataforma

  if (loading) return <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando ROI por canal…</div>
  if (error) return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>

  const filtros = (
    <div style={{ display: 'flex', gap: 8 }}>
      {(['ultimo_mes', 'año_actual'] as PeriodoRoi[]).map(p => {
        const on = periodo === p
        return (
          <button key={p} onClick={() => setPeriodo(p)} style={{
            padding: '8px 16px', border: `2px solid ${INK}`, borderRadius: 0,
            background: on ? GRANATE : BLANCO, color: on ? BLANCO : INK,
            boxShadow: on ? SHADOW_DURA : 'none',
            fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
          }}>{p === 'ultimo_mes' ? 'Último mes' : 'Año en curso'}</button>
        )
      })}
    </div>
  )

  if (canales.length === 0) {
    return (
      <PantallaCantera embedded={embedded}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{filtros}</div>
        <Papel ceja={AMA}><div style={{ color: GRIS, fontFamily: LEX }}>No hay ventas cargadas para {año}.</div></Papel>
      </PantallaCantera>
    )
  }

  const titular = !mejor || !peor
    ? 'ROI por canal del periodo.'
    : hayEmpate ? 'Un único canal concentra tus ventas este periodo.'
    : <>Tu dinero rinde más por <b>{mejor.label}</b> que por <b>{peor.label}</b>.</>

  const atencion = [
    mejor ? `Mejor: ${mejor.label} ${fmtRoi(mejor.roi)}` : null,
    peor && !hayEmpate ? `Peor: ${peor.label} ${fmtRoi(peor.roi)}` : null,
    `ROI medio ${fmtRoi(roiMedio)}`,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera embedded={embedded}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{filtros}</div>

      {/* 1 · Héroe del área Resultados (amarillo) */}
      <HeroCantera
        area="eeff"
        periodo={periodo === 'ultimo_mes' ? 'Último mes' : `Año ${año}`}
        titular={titular}
        etiquetaDato="ROI medio ponderado · retorno / inversión"
        cifra={fmtRoi(roiMedio)}
        resumen={mejor && peor && !hayEmpate ? <>Cada euro que dejas en <b>{peor.label}</b> vuelve peor que en <b>{mejor.label}</b>.</> : undefined}
        atencion={atencion}
      />

      {/* 2 · Plancha comparativa mejor / peor / medio */}
      <div>
        <SeccionLabel bg={AMA} color={INK}>Comparativa de canales</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={VERDE} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Mejor canal</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6, textTransform: 'uppercase' }}>{mejor ? mejor.label : '—'}</div>
            <div style={{ fontFamily: OSW, fontSize: 18, fontWeight: 700, marginTop: 4 }}>{mejor ? fmtRoi(mejor.roi) : '—'}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={ROJO}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Peor canal</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6, textTransform: 'uppercase' }}>{peor ? peor.label : '—'}</div>
            <div style={{ fontFamily: OSW, fontSize: 18, fontWeight: 700, marginTop: 4 }}>{peor ? fmtRoi(peor.roi) : '—'}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={AMA} color={INK}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>ROI medio ponderado</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtRoi(roiMedio)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>retorno total / inversión total</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* 3 · Frase potente (oportunidad · rosa, distinta del héroe amarillo) */}
      {mejor && peor && !hayEmpate && (
        <FrasePotente significado="oportunidad">Empuja pedidos hacia {mejor.label}: cada venta que muevas de {peor.label} rinde más sin vender más.</FrasePotente>
      )}

      {/* Detalle por canal — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={GRANATE}>Detalle por canal</SeccionLabel>
        <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
            <thead>
              <tr style={{ background: INK }}>
                {['Canal', 'Bruto', 'Inversión (comis.+fees+promo)', 'Retorno (neto cobrado)', 'ROI', 'Pedidos'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : 'right', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {canales.map(c => {
                const esMejor = mejor?.plataforma === c.plataforma
                const esPeor = !hayEmpate && peor?.plataforma === c.plataforma
                const banda = esMejor ? VERDE : esPeor ? ROJO : 'transparent'
                return (
                  <tr key={c.plataforma} style={{ borderBottom: `2px solid ${INK}`, borderLeft: `6px solid ${banda}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textTransform: 'uppercase', color: c.color, whiteSpace: 'nowrap' }}>
                      {c.label}
                      {periodo === 'ultimo_mes' && c.mesUsado && (
                        <span style={{ display: 'block', fontFamily: LEX, fontSize: 10, textTransform: 'none', fontWeight: 400, color: GRIS }}>{MESES_ROI[c.mesUsado]}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtEur(c.bruto)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', color: NAR }}>{fmtEur(c.inversion)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', color: VERDE }}>{fmtEur(c.retorno)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtRoi(c.roi)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: LEX, textAlign: 'right', whiteSpace: 'nowrap', color: GRIS }}>{fmtPedidos(c.pedidos)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Papel>
      </div>

      {/* Referencia configurada — papel */}
      <div>
        <SeccionLabel bg={NAR}>Referencia configurada</SeccionLabel>
        <Papel ceja={NAR}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {canales.map((c: CanalRoi) => (
              <div key={c.plataforma} style={{ fontFamily: LEX, fontSize: 12, color: INK, borderLeft: `3px solid ${c.color}`, paddingLeft: 10 }}>
                <div style={{ fontFamily: OSW, fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: c.color }}>{c.label}</div>
                <div style={{ color: GRIS, marginTop: 2 }}>
                  {c.refComisionPct !== null ? `${c.refComisionPct.toLocaleString('es-ES', { maximumFractionDigits: 0 })}% comisión` : 'Sin comisión configurada'}
                  {c.refFijoEur ? ` · ${fmtEur(c.refFijoEur)} fijo` : ''}
                  {c.refFeePeriodoEur ? ` · ${fmtEur(c.refFeePeriodoEur)} fee periodo` : ''}
                </div>
              </div>
            ))}
          </div>
        </Papel>
      </div>
    </PantallaCantera>
  )
}

export default RoiCanal
