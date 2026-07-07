/**
 * RoiCanal — ROI por canal de venta (inversión/comisión vs retorno real cobrado).
 * Estética Neobrutal Food-Pop (@/styles/neobrutal). Módulo autocontenido.
 */
import React, { useState } from 'react'
import { useRoiCanal, MESES_ROI, type PeriodoRoi, type CanalRoi } from '@/lib/finanzas/useRoiCanal'
import {
  OSW, LEX, INK, CREMA, SHADOW, BORDER_CARD,
  GRANATE, AMA, VERDE, ROJO, NAR, GRIS, eyebrow,
} from '@/styles/neobrutal'
import { fmtEur } from '@/lib/format'

/** Formato "veces": 1 decimal, coma es_ES, sufijo "x". Sin datos → "—". */
const fmtRoi = (n: number | null) =>
  n === null
    ? '—'
    : n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'x'

const fmtPedidos = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })

export default function RoiCanal() {
  const [periodo, setPeriodo] = useState<PeriodoRoi>('ultimo_mes')
  const año = new Date().getFullYear()
  const { loading, error, canales, mejor, peor, roiMedio } = useRoiCanal(periodo, año)

  const hayEmpate = !!mejor && !!peor && mejor.plataforma === peor.plataforma
  const card: React.CSSProperties = { background: '#fff', border: BORDER_CARD, boxShadow: SHADOW }

  if (loading) {
    return (
      <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px' }}>
        Cargando ROI por canal…
      </div>
    )
  }
  if (error) {
    return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>
  }

  return (
    <div style={{ fontFamily: LEX, padding: 28, background: CREMA, minHeight: '100vh', color: INK }}>

      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span style={eyebrow(NAR, '#fff')}>FINANZAS</span>
          <h1 style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color: GRANATE, margin: '10px 0 6px' }}>
            ROI POR CANAL
          </h1>
          <span style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>
            Retorno real cobrado frente a lo que se queda cada plataforma · {año}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['ultimo_mes', 'año_actual'] as PeriodoRoi[]).map(p => (
            <button key={p} onClick={() => setPeriodo(p)} style={{
              padding: '8px 16px', border: `3px solid ${INK}`,
              background: periodo === p ? GRANATE : '#fff', color: periodo === p ? '#fff' : INK,
              boxShadow: periodo === p ? SHADOW : 'none',
              fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
            }}>
              {p === 'ultimo_mes' ? 'Último mes' : 'Año en curso'}
            </button>
          ))}
        </div>
      </div>

      {canales.length === 0 ? (
        <div style={{ ...card, padding: 30, textAlign: 'center', color: GRIS, fontFamily: LEX }}>
          No hay ventas cargadas para {año}.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div style={{ ...card, padding: '16px 20px', background: VERDE }}>
              <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', marginBottom: 6 }}>Mejor canal</div>
              <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1, color: '#fff', textTransform: 'uppercase' }}>{mejor ? mejor.label : '—'}</div>
              <div style={{ fontFamily: LEX, fontSize: 13, color: '#fff', marginTop: 6 }}>{mejor ? fmtRoi(mejor.roi) : 'Sin datos de ROI'}</div>
            </div>
            <div style={{ ...card, padding: '16px 20px', background: ROJO }}>
              <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff', marginBottom: 6 }}>Peor canal</div>
              <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1, color: '#fff', textTransform: 'uppercase' }}>{peor ? peor.label : '—'}</div>
              <div style={{ fontFamily: LEX, fontSize: 13, color: '#fff', marginTop: 6 }}>{peor ? fmtRoi(peor.roi) : 'Sin datos de ROI'}</div>
            </div>
            <div style={{ ...card, padding: '16px 20px', background: AMA }}>
              <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: INK, marginBottom: 6 }}>ROI medio ponderado</div>
              <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1, color: INK }}>{fmtRoi(roiMedio)}</div>
              <div style={{ fontFamily: LEX, fontSize: 13, color: INK, marginTop: 6 }}>retorno total / inversión total</div>
            </div>
          </div>

          <div style={{ ...card, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
              <thead>
                <tr style={{ background: INK }}>
                  {['Canal', 'Bruto', 'Inversión (comis.+fees+promo)', 'Retorno (neto cobrado)', 'ROI', 'Pedidos'].map((h, i) => (
                    <th key={h} style={{
                      padding: '10px 12px', textAlign: i === 0 ? 'left' : 'right', fontFamily: OSW, fontSize: 11,
                      letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>{h}</th>
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
                          <span style={{ display: 'block', fontFamily: LEX, fontSize: 10, textTransform: 'none', fontWeight: 400, color: GRIS }}>
                            {MESES_ROI[c.mesUsado]}
                          </span>
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
          </div>

          <div style={{ ...card, marginTop: 18, padding: '14px 18px' }}>
            <span style={eyebrow(NAR, '#fff')}>REFERENCIA CONFIGURADA</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 12 }}>
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
          </div>
        </>
      )}
    </div>
  )
}
