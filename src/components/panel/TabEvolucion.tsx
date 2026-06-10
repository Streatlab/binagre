/**
 * TabEvolucion — Panel Global · pestaña Evolución
 */

import { COLORS, FONT, CARDS, lbl, kpiMid } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtNum } from '@/utils/format'
import type { RowFacturacion } from '@/components/panel/resumen/types'

interface Props { rowsAll: RowFacturacion[] }

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const COMISIONES: Record<string, number> = {
  uber: 0.30, glovo: 0.30, je: 0.30, web: 0.07, directa: 0.00,
}
const CANALES_IDS = ['uber', 'glovo', 'je', 'web', 'directa'] as const

function netoDeRow(r: RowFacturacion): number {
  return CANALES_IDS.reduce((s, c) => {
    const bruto = (r as Record<string, number>)[`${c}_bruto`] ?? 0
    return s + bruto * (1 - COMISIONES[c])
  }, 0)
}

function kpiCard(label: string, value: string, sub?: string, valueColor?: string) {
  return (
    <div style={{ ...CARDS.std, flex: 1, minWidth: 160 }}>
      <div style={lbl}>{label}</div>
      <div style={{ ...kpiMid, marginTop: 6, color: valueColor ?? COLORS.pri }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function TabEvolucion({ rowsAll }: Props) {
  if (!rowsAll.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body, fontSize: 14 }}>
        Sin datos históricos disponibles
      </div>
    )
  }

  // Agrupar por año-mes
  const mesMap: Record<string, { bruto: number; pedidos: number; neto: number }> = {}
  rowsAll.forEach(r => {
    const key = r.fecha.slice(0, 7) // YYYY-MM
    if (!mesMap[key]) mesMap[key] = { bruto: 0, pedidos: 0, neto: 0 }
    mesMap[key].bruto += r.total_bruto
    mesMap[key].pedidos += r.total_pedidos
    mesMap[key].neto += netoDeRow(r)
  })

  // Últimos 12 meses ordenados
  const todosMeses = Object.keys(mesMap).sort()
  const ultimos12 = todosMeses.slice(-12)

  // Mejor y peor mes (en bruto)
  const mejorMes = ultimos12.reduce((best, key) =>
    mesMap[key].bruto > mesMap[best].bruto ? key : best, ultimos12[0])
  const peorMes = ultimos12.reduce((worst, key) =>
    mesMap[key].bruto < mesMap[worst].bruto ? key : worst, ultimos12[0])

  // Mes actual (último en ultimos12)
  const mesActualKey = ultimos12[ultimos12.length - 1]
  const mesActual = mesMap[mesActualKey]

  // Mismo mes año anterior
  const [yActual, mActual] = mesActualKey.split('-')
  const mesAnteriorKey = `${parseInt(yActual) - 1}-${mActual}`
  const mesAnterior = mesMap[mesAnteriorKey]
  const tendenciaPct = mesAnterior && mesAnterior.bruto > 0
    ? ((mesActual.bruto - mesAnterior.bruto) / mesAnterior.bruto) * 100
    : null

  const maxBruto = Math.max(...ultimos12.map(k => mesMap[k].bruto), 1)

  const thStyle: React.CSSProperties = {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 11,
    letterSpacing: '1.5px',
    color: COLORS.mut,
    textTransform: 'uppercase',
    fontWeight: 500,
    padding: '8px 10px',
    textAlign: 'left',
    borderBottom: `1px solid ${COLORS.brd}`,
  }

  const tdStyle: React.CSSProperties = {
    fontFamily: FONT.body,
    fontSize: 13,
    color: COLORS.sec,
    padding: '8px 10px',
    borderBottom: `1px solid ${COLORS.group}`,
  }

  const tdR: React.CSSProperties = { ...tdStyle, textAlign: 'right' }

  function fmtMesKey(key: string): string {
    const [y, m] = key.split('-')
    return `${MESES_ES[parseInt(m, 10) - 1]} ${y}`
  }

  const tendenciaColor = tendenciaPct === null ? COLORS.mut
    : tendenciaPct >= 0 ? COLORS.ok : COLORS.err

  const tendenciaStr = tendenciaPct === null ? 'Sin datos año anterior'
    : `${tendenciaPct >= 0 ? '+' : ''}${tendenciaPct.toFixed(1)}%`

  return (
    <div style={{ paddingTop: 12 }}>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {kpiCard('Tendencia vs año ant.', tendenciaStr, fmtMesKey(mesActualKey), tendenciaColor)}
        {kpiCard('Mejor mes (12m)', fmtMesKey(mejorMes), fmtEur(mesMap[mejorMes].bruto))}
        {kpiCard('Peor mes (12m)', fmtMesKey(peorMes), fmtEur(mesMap[peorMes].bruto))}
      </div>

      {/* Gráfico de barras — evolución mensual */}
      <div style={{ ...CARDS.std, marginBottom: 14 }}>
        <div style={{ ...lbl, marginBottom: 16 }}>Evolución mensual — ventas brutas (últimos 12 meses)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, overflowX: 'auto' }}>
          {ultimos12.map(key => {
            const { bruto } = mesMap[key]
            const h = maxBruto > 0 ? Math.max(4, (bruto / maxBruto) * 108) : 4
            const isMejor = key === mejorMes
            const isPeor = key === peorMes
            const barColor = isMejor ? COLORS.ok : isPeor ? COLORS.err : COLORS.redSL
            const [, m] = key.split('-')
            return (
              <div key={key} style={{ flex: 1, minWidth: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: FONT.body, fontSize: 10, color: COLORS.mut, textAlign: 'center' }}>
                  {fmtEur(bruto).replace(' €', '')}
                </span>
                <div style={{ width: '100%', height: h, background: barColor, borderRadius: '3px 3px 0 0' }} />
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, color: COLORS.mut, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {MESES_ES[parseInt(m, 10) - 1]}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabla mensual */}
      <div style={CARDS.std}>
        <div style={{ ...lbl, marginBottom: 12 }}>Detalle mensual</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Mes</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Pedidos</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Bruto</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Neto est.</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Ticket medio</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>vs año ant.</th>
            </tr>
          </thead>
          <tbody>
            {[...ultimos12].reverse().map(key => {
              const { bruto, pedidos, neto } = mesMap[key]
              const ticket = pedidos > 0 ? bruto / pedidos : 0
              const [y, m] = key.split('-')
              const antKey = `${parseInt(y) - 1}-${m}`
              const ant = mesMap[antKey]
              const vsAnt = ant && ant.bruto > 0
                ? ((bruto - ant.bruto) / ant.bruto) * 100
                : null
              const isMejor = key === mejorMes
              const isPeor = key === peorMes
              return (
                <tr key={key} style={isMejor ? { background: COLORS.ok + '11' } : isPeor ? { background: COLORS.err + '11' } : undefined}>
                  <td style={tdStyle}>
                    {fmtMesKey(key)}
                    {isMejor && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.ok, fontFamily: 'Oswald, sans-serif' }}>MEJOR</span>}
                    {isPeor && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.err, fontFamily: 'Oswald, sans-serif' }}>PEOR</span>}
                  </td>
                  <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', color: COLORS.pri }}>{fmtNum(pedidos)}</td>
                  <td style={tdR}>{fmtEur(bruto)}</td>
                  <td style={{ ...tdR, color: COLORS.ok }}>{fmtEur(neto)}</td>
                  <td style={tdR}>{fmtEur(ticket)}</td>
                  <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', fontSize: 12, color: vsAnt === null ? COLORS.mut : vsAnt >= 0 ? COLORS.ok : COLORS.err }}>
                    {vsAnt === null ? '—' : `${vsAnt >= 0 ? '+' : ''}${vsAnt.toFixed(1)}%`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}
