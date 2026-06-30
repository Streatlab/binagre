/**
 * TabFinanzas — Panel Global · pestaña Finanzas (estilo neobrutal Food-Pop)
 */

import { INK, CREMA, OSW, LEX, VERDE, ROJO, NAR, GRIS, CORP, BORDER_CARD, SHADOW, d, eyebrow } from '@/styles/neobrutal'
import { tablaNeo, theadNeo, thNeo, thNeoR, tdNeo, tdNeoR, filaAlt, dotNeo, totalRow, tdTotal, tdTotalR, vacioNeo } from '@/styles/tablaNeo'
import { fmtEur } from '@/utils/format'

interface Row {
  fecha: string
  uber_bruto: number; uber_pedidos: number
  glovo_bruto: number; glovo_pedidos: number
  je_bruto: number; je_pedidos: number
  web_bruto: number; web_pedidos: number
  directa_bruto: number; directa_pedidos: number
  total_bruto: number; total_pedidos: number
}

interface Props { rows: Row[] }

// Comisiones por canal según WATERFALL canónico
const COMISIONES: Record<string, number> = {
  uber: 0.30,
  glovo: 0.30,
  je: 0.30,
  web: 0.07,
  directa: 0.00,
}

const CANALES = [
  { id: 'uber',    label: 'Uber Eats', color: CORP.uber },
  { id: 'glovo',   label: 'Glovo',     color: CORP.glovo },
  { id: 'je',      label: 'Just Eat',  color: CORP.je },
  { id: 'web',     label: 'Web',       color: CORP.web },
  { id: 'directa', label: 'Directa',   color: CORP.dir },
] as const

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function kpiCard(label: string, value: string, sub?: string) {
  return (
    <div style={{ flex: 1, minWidth: 160, background: CREMA, border: BORDER_CARD, boxShadow: SHADOW, padding: '14px 16px' }}>
      <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>{label}</div>
      <div style={{ ...d('30px'), marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const tituloSec: React.CSSProperties = { marginBottom: 12 }

export default function TabFinanzas({ rows }: Props) {
  if (!rows.length) {
    return <div style={{ ...vacioNeo, marginTop: 12 }}>Sin datos para el período seleccionado</div>
  }

  // Totales globales
  const totalBruto = rows.reduce((s, r) => s + r.total_bruto, 0)

  // Comisiones y neto por canal
  const canalStats = CANALES.map(c => {
    const bruto = rows.reduce((s, r) => s + (r[`${c.id}_bruto` as keyof Row] as number), 0)
    const comision = bruto * COMISIONES[c.id]
    const neto = bruto - comision
    const pct = totalBruto > 0 ? (bruto / totalBruto) * 100 : 0
    return { ...c, bruto, comision, neto, pct }
  })

  const totalComision = canalStats.reduce((s, c) => s + c.comision, 0)
  const totalNeto     = totalBruto - totalComision
  const margenPct     = totalBruto > 0 ? (totalNeto / totalBruto) * 100 : 0

  // Evolución mensual
  const mesMap: Record<string, { bruto: number; neto: number }> = {}
  rows.forEach(r => {
    const key = r.fecha.slice(0, 7) // YYYY-MM
    if (!mesMap[key]) mesMap[key] = { bruto: 0, neto: 0 }
    const comCanales = CANALES.reduce((s, c) => {
      const b = r[`${c.id}_bruto` as keyof Row] as number
      return s + b * COMISIONES[c.id]
    }, 0)
    mesMap[key].bruto += r.total_bruto
    mesMap[key].neto  += r.total_bruto - comCanales
  })
  const meses = Object.keys(mesMap).sort()
  const mostrarEvolucion = meses.length > 1

  return (
    <div style={{ paddingTop: 12 }}>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
        {kpiCard('Ingresos brutos', fmtEur(totalBruto))}
        {kpiCard('Comisiones est.', fmtEur(totalComision), `${(totalComision / totalBruto * 100).toFixed(1)}% del bruto`)}
        {kpiCard('Ingresos netos', fmtEur(totalNeto))}
        {kpiCard('Margen est.', `${margenPct.toFixed(1)}%`, 'neto / bruto')}
      </div>

      {/* Desglose por canal */}
      <div style={{ marginBottom: 28 }}>
        <div style={tituloSec}><span style={eyebrow(CREMA)}>Desglose por canal</span></div>
        <table style={tablaNeo}>
          <thead style={theadNeo}>
            <tr>
              <th style={thNeo}>Canal</th>
              <th style={thNeoR}>Bruto</th>
              <th style={thNeoR}>Comisión</th>
              <th style={thNeoR}>Neto</th>
              <th style={thNeoR}>% total</th>
            </tr>
          </thead>
          <tbody>
            {canalStats.map((c, i) => (
              <tr key={c.id} style={filaAlt(i)}>
                <td style={tdNeo}>
                  <span style={dotNeo(c.color)} />
                  {c.label}
                </td>
                <td style={tdNeoR}>{fmtEur(c.bruto)}</td>
                <td style={{ ...tdNeoR, color: ROJO }}>{fmtEur(c.comision)}</td>
                <td style={{ ...tdNeoR, color: VERDE }}>{fmtEur(c.neto)}</td>
                <td style={tdNeoR}>{c.pct.toFixed(1)}%</td>
              </tr>
            ))}
            {/* Totales */}
            <tr style={totalRow}>
              <td style={tdTotal}>TOTAL</td>
              <td style={tdTotalR}>{fmtEur(totalBruto)}</td>
              <td style={{ ...tdTotalR, color: ROJO }}>{fmtEur(totalComision)}</td>
              <td style={{ ...tdTotalR, color: VERDE }}>{fmtEur(totalNeto)}</td>
              <td style={tdTotalR}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Evolución mensual — solo si hay más de 1 mes */}
      {mostrarEvolucion && (
        <div>
          <div style={tituloSec}><span style={eyebrow(CREMA)}>Evolución mensual</span></div>
          <table style={tablaNeo}>
            <thead style={theadNeo}>
              <tr>
                <th style={thNeo}>Mes</th>
                <th style={thNeoR}>Bruto</th>
                <th style={thNeoR}>Neto est.</th>
                <th style={thNeoR}>Margen</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((key, i) => {
                const { bruto, neto } = mesMap[key]
                const margen = bruto > 0 ? (neto / bruto) * 100 : 0
                const [y, m] = key.split('-')
                const label = `${MESES_ES[parseInt(m, 10) - 1]} ${y}`
                return (
                  <tr key={key} style={filaAlt(i)}>
                    <td style={tdNeo}>{label}</td>
                    <td style={tdNeoR}>{fmtEur(bruto)}</td>
                    <td style={{ ...tdNeoR, color: VERDE }}>{fmtEur(neto)}</td>
                    <td style={{ ...tdNeoR, color: margen >= 70 ? VERDE : NAR }}>{margen.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
