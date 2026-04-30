/**
 * CardPE — Fixes 89-94
 * FIX 89: "Bruto necesario" con B mayúscula
 * FIX 90: ELIMINAR "9.610 € netos" del subtítulo
 * FIX 91: fmtPct(pct, 2) con 2 decimales
 * FIX 92: calcDiaVerde dinámico
 * FIX 93: unificar "Pedidos día / TM" en una línea
 * FIX 94: "Realidad hoy" con tooltip
 */
import type React from 'react'
import { fmtEur, fmtNum, fmtPct } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, card, lblSm, kpiSm, barTrack } from './tokens'

interface Props {
  peBruto: number
  peNeto: number
  acumulado: number
  pctProgreso: number
  diaVerdeEstimado: { fecha: string; diaSemana: string } | null
  facturacionDia: number
  pedidosDia: number
  tmActual: number
  realFacDia: number
  realPedDia: number
  año?: number
  mes?: number
}

function calcDiaVerde(
  facturadoActual: number,
  brutoNecesario: number,
  diaActual: number,
  diasMes: number
): { texto: string; color: string } {
  const pct = brutoNecesario > 0 ? (facturadoActual / brutoNecesario) * 100 : 0

  if (pct >= 100) {
    const velocidadDia = diaActual > 0 ? facturadoActual / diaActual : 0
    if (velocidadDia <= 0) return { texto: 'Alcanzado', color: '#1D9E75' }
    const diaAlcanzado = Math.ceil(brutoNecesario / velocidadDia)
    return { texto: `Día ${diaAlcanzado} · ✓ alcanzado`, color: '#1D9E75' }
  }

  if (facturadoActual === 0) {
    return { texto: 'Sin datos', color: '#7a8090' }
  }

  const velocidadDia = diaActual > 0 ? facturadoActual / diaActual : 0
  if (velocidadDia <= 0) return { texto: 'Sin datos', color: '#7a8090' }

  const diaVerdeEstimado = Math.ceil(brutoNecesario / velocidadDia)

  if (diaVerdeEstimado <= diasMes) {
    return { texto: `Día ${diaVerdeEstimado}`, color: '#1D9E75' }
  }

  const diasExtra = diaVerdeEstimado - diasMes
  return { texto: `+${diasExtra}d sobre mes`, color: '#1D9E75' }
}

function diasEnMes(año: number, mes: number): number {
  return new Date(año, mes, 0).getDate()
}

export default function CardPE({
  peBruto, acumulado, pctProgreso,
  facturacionDia, pedidosDia, tmActual,
  realFacDia, realPedDia,
  año, mes,
}: Props) {
  const sinDatos = peBruto <= 0

  const sem =
    pctProgreso >= 80 ? COLOR.verde :
    pctProgreso >= 50 ? COLOR.ambar : COLOR.rojo

  const falta = Math.max(0, peBruto - acumulado)
  const filled = Math.min(pctProgreso, 100)
  const remaining = Math.max(0, 100 - pctProgreso)

  const hoy = new Date()
  const añoActual = año ?? hoy.getFullYear()
  const mesActual = mes ?? (hoy.getMonth() + 1)
  const diaActual = hoy.getDate()
  const totalDiasMes = diasEnMes(añoActual, mesActual)

  // FIX 92: calcDiaVerde dinámico
  const diaVerdeCalc = calcDiaVerde(acumulado, peBruto, diaActual, totalDiasMes)

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <div style={lblSm}>PUNTO DE EQUILIBRIO</div>
        <span
          title="Facturación bruta mínima mensual para cubrir todos los gastos fijos. Calculado desde pe_parametros."
          style={{ fontSize: 11, color: COLOR.textMut, cursor: 'help', fontFamily: LEXEND }}
        >
          ⓘ
        </span>
      </div>

      {sinDatos ? (
        <div style={{ fontSize: 12, color: COLOR.textMut, fontFamily: LEXEND, fontStyle: 'italic', marginTop: 10 }}>
          Datos insuficientes — configura pe_parametros
        </div>
      ) : (
        <>
          {/* FIX 89: "Bruto necesario" (B mayúscula) */}
          {/* FIX 90: sin "X € netos" */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
            <div>
              <div style={kpiSm}>{fmtEur(peBruto, { showEuro: false, decimals: 0 })}</div>
              <div style={{ fontSize: 11, color: COLOR.textMut, fontFamily: LEXEND }}>
                Bruto necesario
              </div>
            </div>
            {/* FIX 91: fmtPct(pct, 2) */}
            <div style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: sem }}>
              {fmtPct(pctProgreso, 2)}
            </div>
          </div>

          <div style={{ ...barTrack, margin: '10px 0 4px' }}>
            <div style={{ height: '100%', width: `${filled}%`, background: sem, transition: 'width 0.5s ease' }} />
            <div style={{ height: '100%', width: `${remaining}%`, background: COLOR.rojo }} />
          </div>
          <div style={{ fontSize: 11, color: COLOR.textMut, display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND }}>
            <span>Llevamos {fmtEur(acumulado, { showEuro: false, decimals: 2 })}</span>
            <span>Faltan {fmtEur(falta, { showEuro: false, decimals: 2 })}</span>
          </div>

          <div style={{ marginTop: 14, paddingTop: 10, borderTop: `0.5px solid ${COLOR.borde}` }}>
            {/* FIX 92: día verde dinámico */}
            <Linea
              label="Día verde estimado"
              valor={<span style={{ color: diaVerdeCalc.color, fontWeight: 500 }}>{diaVerdeCalc.texto}</span>}
            />

            {/* FIX 93: "Pedidos día / TM" una sola línea */}
            <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: LEXEND }}>
              <span style={{ color: COLOR.textMut }}>Pedidos día / TM</span>
              <span>
                <span style={{ color: '#1E5BCC', fontWeight: 500 }}>{fmtNum(pedidosDia, 0)}</span>
                <span style={{ color: COLOR.textMut }}>{' / '}</span>
                <span style={{ color: '#F26B1F', fontWeight: 500 }}>{fmtEur(tmActual, { showEuro: false, decimals: 2 })}</span>
              </span>
            </div>

            {/* FIX 23+24+94: "Realidad hoy" con € y pedidos/día */}
            <div
              title="Lo que estamos facturando de media diaria en el periodo seleccionado"
              style={{
                fontSize: 12,
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 6,
                color: COLOR.textMut,
                fontFamily: LEXEND,
                cursor: 'help',
              }}
            >
              <span>Realidad hoy</span>
              <span>
                {fmtEur(realFacDia, { showEuro: true, decimals: 2 })}/día
                {realPedDia > 0 && <> · {fmtNum(realPedDia, 0)} ped/día</>}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Linea({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 12,
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 4,
      fontFamily: LEXEND,
    }}>
      <span style={{ color: COLOR.textMut }}>{label}</span>
      <span>{valor}</span>
    </div>
  )
}
