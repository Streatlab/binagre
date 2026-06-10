/**
 * TabFinanzas — Panel Global · pestaña Finanzas
 */

import { COLORS, FONT, CARDS, lbl, kpiMid } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtNum } from '@/utils/format'

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
  { id: 'uber',    label: 'Uber Eats', color: COLORS.uber },
  { id: 'glovo',   label: 'Glovo',     color: COLORS.glovo },
  { id: 'je',      label: 'Just Eat',  color: COLORS.je },
  { id: 'web',     label: 'Web',       color: COLORS.web },
  { id: 'directa', label: 'Directa',   color: COLORS.directa },
] as const

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function kpiCard(label: string, value: string, sub?: string) {
  return (
    <div style={{ ...CARDS.std, flex: 1, minWidth: 160 }}>
      <div style={lbl}>{label}</div>
      <div style={{ ...kpiMid, marginTop: 6, color: COLORS.pri }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function TabFinanzas({ rows }: Props) {
  if (!rows.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body, fontSize: 14 }}>
        Sin datos para el período seleccionado
      </div>
    )
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
  // Margen estimado: neto / bruto × 100 (sobre el bruto, tras comisiones)
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

  return (
    <div style={{ paddingTop: 12 }}>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {kpiCard('Ingresos brutos', fmtEur(totalBruto))}
        {kpiCard('Comisiones est.', fmtEur(totalComision), `${(totalComision / totalBruto * 100).toFixed(1)}% del bruto`)}
        {kpiCard('Ingresos netos', fmtEur(totalNeto))}
        {kpiCard('Margen est.', `${margenPct.toFixed(1)}%`, 'neto / bruto')}
      </div>

      {/* Desglose por canal */}
      <div style={{ ...CARDS.std, marginBottom: 14 }}>
        <div style={{ ...lbl, marginBottom: 12 }}>Desglose por canal</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Canal</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Bruto</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Comisión</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Neto</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>% total</th>
            </tr>
          </thead>
          <tbody>
            {canalStats.map(c => (
              <tr key={c.id}>
                <td style={tdStyle}>
                  <span style={{
                    display: 'inline-block',
                    width: 10, height: 10,
                    borderRadius: '50%',
                    background: c.color,
                    marginRight: 8,
                    verticalAlign: 'middle',
                  }} />
                  {c.label}
                </td>
                <td style={tdR}>{fmtEur(c.bruto)}</td>
                <td style={{ ...tdR, color: COLORS.err }}>{fmtEur(c.comision)}</td>
                <td style={{ ...tdR, color: COLORS.ok }}>{fmtEur(c.neto)}</td>
                <td style={tdR}>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12 }}>
                    {c.pct.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
            {/* Totales */}
            <tr style={{ background: COLORS.group }}>
              <td style={{ ...tdStyle, fontFamily: 'Oswald, sans-serif', fontWeight: 600, color: COLORS.pri }}>TOTAL</td>
              <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', fontWeight: 600, color: COLORS.pri }}>{fmtEur(totalBruto)}</td>
              <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', fontWeight: 600, color: COLORS.err }}>{fmtEur(totalComision)}</td>
              <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', fontWeight: 600, color: COLORS.ok }}>{fmtEur(totalNeto)}</td>
              <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', fontWeight: 600 }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Evolución mensual — solo si hay más de 1 mes */}
      {mostrarEvolucion && (
        <div style={CARDS.std}>
          <div style={{ ...lbl, marginBottom: 12 }}>Evolución mensual</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Mes</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Bruto</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Neto est.</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Margen</th>
              </tr>
            </thead>
            <tbody>
              {meses.map(key => {
                const { bruto, neto } = mesMap[key]
                const margen = bruto > 0 ? (neto / bruto) * 100 : 0
                const [y, m] = key.split('-')
                const label = `${MESES_ES[parseInt(m, 10) - 1]} ${y}`
                return (
                  <tr key={key}>
                    <td style={tdStyle}>{label}</td>
                    <td style={tdR}>{fmtEur(bruto)}</td>
                    <td style={{ ...tdR, color: COLORS.ok }}>{fmtEur(neto)}</td>
                    <td style={tdR}>
                      <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, color: margen >= 70 ? COLORS.ok : COLORS.warn }}>
                        {margen.toFixed(1)}%
                      </span>
                    </td>
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
