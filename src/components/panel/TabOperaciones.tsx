/**
 * TabOperaciones — Panel Global · pestaña Operaciones
 */

import { COLORS, FONT, CARDS, BAR, lbl, kpiMid, kpiSm } from '@/components/panel/resumen/tokens'
import { fmtNum, fmtEur } from '@/utils/format'

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

const CANALES = [
  { id: 'uber',    label: 'Uber Eats', color: COLORS.uber },
  { id: 'glovo',   label: 'Glovo',     color: COLORS.glovo },
  { id: 'je',      label: 'Just Eat',  color: COLORS.je },
  { id: 'web',     label: 'Web',       color: COLORS.web },
  { id: 'directa', label: 'Directa',   color: COLORS.directa },
] as const

const DIAS_SEM = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function kpiCard(label: string, value: string, sub?: string) {
  return (
    <div style={{ ...CARDS.std, flex: 1, minWidth: 160 }}>
      <div style={lbl}>{label}</div>
      <div style={{ ...kpiMid, marginTop: 6, color: COLORS.pri }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function TabOperaciones({ rows }: Props) {
  if (!rows.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body, fontSize: 14 }}>
        Sin datos para el período seleccionado
      </div>
    )
  }

  // KPIs
  const totalPedidos = rows.reduce((s, r) => s + r.total_pedidos, 0)
  const totalBruto   = rows.reduce((s, r) => s + r.total_bruto, 0)
  const ticketMedio  = totalPedidos > 0 ? totalBruto / totalPedidos : 0
  const pedidoMasAlto = Math.max(...rows.map(r => r.total_pedidos))
  const diaMasPedidos = rows.reduce((best, r) => r.total_pedidos > best.total_pedidos ? r : best, rows[0])

  // Mix de canales (pedidos)
  const mixCanales = CANALES.map(c => {
    const pedidos = rows.reduce((s, r) => s + (r[`${c.id}_pedidos` as keyof Row] as number), 0)
    const pct = totalPedidos > 0 ? (pedidos / totalPedidos) * 100 : 0
    return { ...c, pedidos, pct }
  })

  // Pedidos por día de semana (0=domingo en JS, reordenamos a lunes=0)
  const porDiaSem = [0, 0, 0, 0, 0, 0, 0]
  rows.forEach(r => {
    const d = new Date(r.fecha + 'T12:00:00')
    const dow = (d.getDay() + 6) % 7 // lunes=0 … domingo=6
    porDiaSem[dow] += r.total_pedidos
  })
  const maxDiaSem = Math.max(...porDiaSem, 1)

  // Top 5 días por pedidos
  const top5 = [...rows]
    .sort((a, b) => b.total_pedidos - a.total_pedidos)
    .slice(0, 5)

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

  return (
    <div style={{ paddingTop: 12 }}>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {kpiCard('Pedidos totales', fmtNum(totalPedidos))}
        {kpiCard('Ticket medio', fmtEur(ticketMedio))}
        {kpiCard('Día más alto', fmtNum(pedidoMasAlto) + ' ped.', 'pico del período')}
        {kpiCard('Mejor día', diaMasPedidos.fecha.slice(8, 10) + '/' + diaMasPedidos.fecha.slice(5, 7), fmtNum(diaMasPedidos.total_pedidos) + ' pedidos')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flexWrap: 'wrap' }}>

        {/* Mix de canales */}
        <div style={CARDS.std}>
          <div style={{ ...lbl, marginBottom: 14 }}>Mix de canales — pedidos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mixCanales.map(c => (
              <div key={c.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.sec }}>{c.label}</span>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, color: COLORS.pri }}>
                    {fmtNum(c.pedidos)} <span style={{ color: COLORS.mut, fontSize: 11 }}>({c.pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div style={BAR.track}>
                  <div style={{
                    width: `${c.pct}%`,
                    background: c.color,
                    borderRadius: 4,
                    transition: 'width 400ms ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pedidos por día de semana */}
        <div style={CARDS.std}>
          <div style={{ ...lbl, marginBottom: 14 }}>Pedidos por día de semana</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
            {porDiaSem.map((v, i) => {
              const h = maxDiaSem > 0 ? Math.max(4, (v / maxDiaSem) * 88) : 4
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontFamily: FONT.body, fontSize: 10, color: COLORS.mut }}>
                    {fmtNum(v)}
                  </span>
                  <div style={{
                    width: '100%',
                    height: h,
                    background: COLORS.redSL,
                    borderRadius: '3px 3px 0 0',
                  }} />
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, color: COLORS.mut, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {DIAS_SEM[i]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Top 5 días */}
      <div style={{ ...CARDS.std, marginTop: 14 }}>
        <div style={{ ...lbl, marginBottom: 12 }}>Top 5 días por pedidos</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Fecha</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Pedidos</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Bruto</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Ticket</th>
            </tr>
          </thead>
          <tbody>
            {top5.map((r, i) => {
              const ticket = r.total_pedidos > 0 ? r.total_bruto / r.total_pedidos : 0
              const [y, m, d] = r.fecha.split('-')
              return (
                <tr key={r.fecha}>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, color: COLORS.mut }}>
                      {i + 1}
                    </span>
                  </td>
                  <td style={tdStyle}>{d}/{m}/{y}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'Oswald, sans-serif', color: COLORS.pri }}>
                    {fmtNum(r.total_pedidos)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtEur(r.total_bruto)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtEur(ticket)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}
