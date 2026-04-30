/**
 * CardPE — Punto de Equilibrio
 * K.1: Tooltip en sublabel
 * K.2: Bruto sin €, % semáforo; ELIMINAR "netos"
 * K.3: Fallback "Datos insuficientes" si peParams no disponible
 * K.4: Día verde con ✓ si alcanzado; Facturación día sin "bruto"; Pedidos día azul+naranja; Real actual muted
 * K.5: Renombrar "Facturación / día" → "Facturación día" y "Pedidos / día" → "Pedidos día"
 */
import { fmtEur } from '@/lib/format'
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
}

export default function CardPE({
  peBruto, acumulado, pctProgreso,
  diaVerdeEstimado, facturacionDia, pedidosDia, tmActual,
  realFacDia, realPedDia,
}: Props) {
  const sinDatos = peBruto <= 0

  const sem =
    pctProgreso >= 80 ? COLOR.verde :
    pctProgreso >= 50 ? COLOR.ambar : COLOR.rojo

  const falta = Math.max(0, peBruto - acumulado)
  const filled = Math.min(pctProgreso, 100)
  const remaining = Math.max(0, 100 - pctProgreso)

  const alcanzado = pctProgreso >= 100

  return (
    <div style={card}>
      {/* K.1: Tooltip en sublabel */}
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
          {/* K.2: Bruto sin €, % semáforo. ELIMINAR "netos" */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
            <div>
              <div style={kpiSm}>{fmtEur(peBruto, { showEuro: false, decimals: 0 })}</div>
              <div style={{ fontSize: 11, color: COLOR.textMut, fontFamily: LEXEND }}>
                bruto necesario
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
            <span>Llevamos {fmtEur(acumulado, { showEuro: false, decimals: 0 })}</span>
            <span>Faltan {fmtEur(falta, { showEuro: false, decimals: 0 })}</span>
          </div>

          <div style={{ marginTop: 14, paddingTop: 10, borderTop: `0.5px solid ${COLOR.borde}` }}>
            {/* K.4: Día verde con ✓ si alcanzado */}
            <Linea
              label="Día verde estimado"
              valor={
                alcanzado
                  ? '✓ Alcanzado'
                  : diaVerdeEstimado
                    ? `${diaVerdeEstimado.fecha} · ${diaVerdeEstimado.diaSemana}`
                    : '—'
              }
              fuerte
              colorValor={alcanzado ? COLOR.verde : undefined}
            />

            {/* K.5: "Facturación día" sin "bruto" */}
            <Linea
              label="Facturación día"
              valor={`${fmtEur(facturacionDia, { showEuro: false, decimals: 0 })}`}
              fuerte
            />

            {/* K.4: Pedidos día con azul+naranja (pedidos en azul, TM en naranja) */}
            <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: LEXEND }}>
              <span style={{ color: COLOR.textMut }}>Pedidos día</span>
              <span>
                <span style={{ color: COLOR.directa, fontWeight: 500 }}>{fmtEur(pedidosDia, { showEuro: false, decimals: 0 })}</span>
                <span style={{ color: COLOR.textMut }}>{' a '}</span>
                <span style={{ color: COLOR.ambar, fontWeight: 500 }}>{fmtEur(tmActual, { showEuro: false, decimals: 0 })}</span>
              </span>
            </div>

            {/* K.4: Real actual muted */}
            <div style={{
              fontSize: 12,
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
              color: COLOR.textMut,
              fontFamily: LEXEND,
            }}>
              <span>Real actual</span>
              <span>{fmtEur(realFacDia, { showEuro: false, decimals: 0 })}/día · {fmtEur(realPedDia, { showEuro: false, decimals: 0 })} ped/día</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Linea({ label, valor, fuerte, colorValor }: {
  label: string
  valor: string
  fuerte?: boolean
  colorValor?: string
}) {
  return (
    <div style={{
      fontSize: 12,
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 4,
      fontFamily: LEXEND,
    }}>
      <span style={{ color: COLOR.textMut }}>{label}</span>
      <span style={{ color: colorValor ?? (fuerte ? COLOR.textSec : COLOR.textMut), fontWeight: fuerte ? 500 : 400 }}>
        {valor}
      </span>
    </div>
  )
}
