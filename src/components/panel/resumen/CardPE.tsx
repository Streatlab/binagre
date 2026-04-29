import { COLOR, OSWALD, LEXEND, card, lblSm, kpiSm, barTrack, fmtEur0, fmtEntero } from './tokens'

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
}

export default function CardPE({
  peBruto, peNeto, acumulado, pctProgreso,
  diaVerdeEstimado, facturacionDia, pedidosDia, tmActual,
  realFacDia, realPedDia,
}: Props) {
  const sem =
    pctProgreso >= 80 ? COLOR.verde :
    pctProgreso >= 50 ? COLOR.ambar : COLOR.rojo
  const falta = Math.max(0, peBruto - acumulado)
  const filled = Math.min(pctProgreso, 100)
  const remaining = Math.max(0, 100 - pctProgreso)

  return (
    <div style={card}>
      <div style={lblSm}>PUNTO DE EQUILIBRIO</div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
        <div>
          <div style={kpiSm}>{fmtEur0(peBruto)}</div>
          <div style={{ fontSize: 11, color: COLOR.textMut, fontFamily: LEXEND }}>
            bruto necesario · {fmtEur0(peNeto)} netos
          </div>
        </div>
        <div style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: sem }}>
          {pctProgreso}%
        </div>
      </div>

      <div style={{ ...barTrack, margin: '10px 0 4px' }}>
        <div style={{ height: '100%', width: `${filled}%`, background: sem, transition: 'width 0.5s ease' }} />
        <div style={{ height: '100%', width: `${remaining}%`, background: COLOR.rojo }} />
      </div>
      <div style={{ fontSize: 11, color: COLOR.textMut, display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND }}>
        <span>Llevamos {fmtEur0(acumulado)}</span>
        <span>Faltan {fmtEur0(falta)}</span>
      </div>

      <div style={{ marginTop: 14, paddingTop: 10, borderTop: `0.5px solid ${COLOR.borde}` }}>
        <Linea label="Día verde estimado" valor={diaVerdeEstimado ? `${diaVerdeEstimado.fecha} · ${diaVerdeEstimado.diaSemana}` : '—'} fuerte />
        <Linea label="Facturación / día"  valor={`${fmtEur0(facturacionDia)} bruto`} fuerte />
        <Linea label="Pedidos / día"      valor={`${fmtEntero(pedidosDia)} a ${fmtEur0(tmActual)}`} fuerte />
        <div style={{
          fontSize: 12,
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          color: COLOR.textMut,
          fontFamily: LEXEND,
        }}>
          <span>Real actual</span>
          <span>{fmtEur0(realFacDia)}/día · {fmtEntero(realPedDia)} ped/día</span>
        </div>
      </div>
    </div>
  )
}

function Linea({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div style={{
      fontSize: 12,
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 4,
      fontFamily: LEXEND,
    }}>
      <span style={{ color: COLOR.textMut }}>{label}</span>
      <span style={{ color: COLOR.textSec, fontWeight: fuerte ? 500 : 400 }}>{valor}</span>
    </div>
  )
}
