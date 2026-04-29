import { COLOR, OSWALD, LEXEND, cardBig, lbl, lblXs, lblSm, barTrack, fmtEur0, colorPrimeCost } from './tokens'

interface Props {
  ebitda: number
  ebitdaPct: number
  deltaPp: number | null
  netosEstimados: number
  netosReales: number
  totalGastos: number
  resultadoLimpio: number
  primeCostPct: number
}

export default function CardResultadoPeriodo({
  ebitda, ebitdaPct, deltaPp,
  netosEstimados, netosReales, totalGastos, resultadoLimpio,
  primeCostPct,
}: Props) {
  const colorEbitda = ebitda >= 0 ? COLOR.verde : COLOR.rojo
  const flecha = (deltaPp ?? 0) >= 0 ? '▲' : '▼'
  const colorDelta = (deltaPp ?? 0) >= 0 ? COLOR.verde : COLOR.rojo

  const pc = colorPrimeCost(primeCostPct)
  const pcCapped = Math.min(100, Math.max(0, primeCostPct))

  return (
    <div style={cardBig}>
      <div style={lbl}>RESULTADO PERIODO</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: colorEbitda }}>
            {fmtEur0(ebitda)}
          </div>
          <div style={lblXs}>EBITDA</div>
        </div>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, color: colorEbitda }}>
            {ebitdaPct.toFixed(0)}%
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: colorEbitda, textTransform: 'uppercase', fontWeight: 500 }}>
            % S/NETOS · BANDA 10-13%
          </div>
        </div>
      </div>

      {deltaPp !== null && (
        <div style={{ fontSize: 12, color: colorDelta, margin: '10px 0 16px', fontFamily: LEXEND }}>
          {flecha} {Math.abs(deltaPp).toFixed(1)} pp vs anterior
        </div>
      )}

      <div style={{ borderTop: `0.5px solid ${COLOR.borde}`, paddingTop: 12 }}>
        <Linea label="Netos estimados" valor={fmtEur0(netosEstimados)} />
        <Linea label="Netos reales factura" valor={fmtEur0(netosReales)} />
        <Linea label="Total gastos periodo" valor={fmtEur0(totalGastos)} />
        <Linea label="Resultado limpio" valor={fmtEur0(resultadoLimpio)} colorVal={COLOR.verde} weight={500} />
      </div>

      <div style={{ borderTop: `0.5px solid ${COLOR.borde}`, paddingTop: 12, marginTop: 12 }}>
        <div style={{ ...lblSm, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={lblSm}>PRIME COST</span>
          <span style={{ ...lblSm, color: pc.color }}>{primeCostPct.toFixed(0)}%</span>
        </div>
        <div style={{ ...barTrack, marginBottom: 4 }}>
          <div style={{ height: '100%', width: `${pcCapped}%`, background: pc.color, transition: 'width 0.5s ease' }} />
          <div style={{ height: '100%', width: `${100 - pcCapped}%`, background: COLOR.bordeClaro }} />
        </div>
        <div style={{ fontSize: 11, color: COLOR.textMut, display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND }}>
          <span>Banda sector 55-65%</span>
          <span style={{ color: pc.color }}>{pc.estado}</span>
        </div>
      </div>
    </div>
  )
}

function Linea({ label, valor, colorVal, weight }: { label: string; valor: string; colorVal?: string; weight?: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, fontFamily: LEXEND }}>
      <span style={{ color: COLOR.textMut }}>{label}</span>
      <span style={{ color: colorVal ?? COLOR.textPri, fontWeight: weight ?? 400 }}>{valor}</span>
    </div>
  )
}
