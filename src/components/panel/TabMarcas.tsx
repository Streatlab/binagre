/**
 * TabMarcas — Panel Global · pestaña Marcas
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS, BAR, lbl, kpiMid, kpiSm } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtNum } from '@/utils/format'
import type { RowFacturacion } from '@/components/panel/resumen/types'
import { resolverNeto } from '@/lib/panel/netoResolver'
import { useNetoContext } from '@/lib/panel/useNetoContext'

// RowFacturacion extended with optional servicio
type RowConServicio = RowFacturacion & { servicio?: string | null }

interface Marca { id: string; nombre: string }

interface Props { rows: RowConServicio[]; fechaDesde: Date; fechaHasta: Date }

// LEY-NETO-01: el neto se resuelve siempre con resolverNeto, nunca con comisiones fijas.
const CANALES = [
  { id: 'uber',  bk: 'uber_bruto',    pk: 'uber_pedidos' },
  { id: 'glovo', bk: 'glovo_bruto',   pk: 'glovo_pedidos' },
  { id: 'je',    bk: 'je_bruto',      pk: 'je_pedidos' },
  { id: 'web',   bk: 'web_bruto',     pk: 'web_pedidos' },
  { id: 'dir',   bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

function kpiCard(label: string, value: string, sub?: string) {
  return (
    <div style={{ ...CARDS.std, flex: 1, minWidth: 160 }}>
      <div style={lbl}>{label}</div>
      <div style={{ ...kpiMid, marginTop: 6, color: COLORS.pri }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

const MARCA_COLORS = [
  COLORS.redSL, COLORS.uber, COLORS.je, COLORS.directa, COLORS.warn,
]

export default function TabMarcas({ rows, fechaDesde, fechaHasta }: Props) {
  const [marcasDisp, setMarcasDisp] = useState<Marca[]>([])
  const { configCanales: config, marcasPorCanal } = useNetoContext()

  useEffect(() => {
    supabase.from('marcas').select('id, nombre').eq('activa', true).then(({ data }) => {
      if (data) setMarcasDisp(data as Marca[])
    })
  }, [])

  if (!rows.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body, fontSize: 14 }}>
        Sin datos para el período seleccionado
      </div>
    )
  }

  // Check if any row has servicio data
  const hayServicio = rows.some(r => r.servicio != null && r.servicio !== '')

  if (!hayServicio) {
    // Show summary using marcasDisp if available, otherwise just totals
    const totalBruto = rows.reduce((s, r) => s + r.total_bruto, 0)
    const totalPedidos = rows.reduce((s, r) => s + r.total_pedidos, 0)
    const ticketMedio = totalPedidos > 0 ? totalBruto / totalPedidos : 0

    return (
      <div style={{ paddingTop: 12 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
          {kpiCard('Ventas brutas', fmtEur(totalBruto))}
          {kpiCard('Pedidos totales', fmtNum(totalPedidos))}
          {kpiCard('Ticket medio', fmtEur(ticketMedio))}
        </div>
        <div style={{ ...CARDS.std, textAlign: 'center', padding: 40, color: COLORS.mut, fontFamily: FONT.body, fontSize: 14 }}>
          Sin datos de marca en este período — el campo <em>servicio</em> no está informado en las filas cargadas.
          {marcasDisp.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ ...lbl, marginBottom: 10 }}>Marcas activas registradas</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {marcasDisp.map((m, i) => (
                  <span key={m.id} style={{
                    padding: '4px 10px', borderRadius: 8,
                    background: MARCA_COLORS[i % MARCA_COLORS.length] + '22',
                    color: MARCA_COLORS[i % MARCA_COLORS.length],
                    fontFamily: FONT.body, fontSize: 13,
                    border: `1px solid ${MARCA_COLORS[i % MARCA_COLORS.length]}44`,
                  }}>
                    {m.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Neto por canal AGREGADO del periodo (resolverNeto una vez por canal, como
  // Finanzas/Resumen → el total cuadra). Después se prorratea el neto de cada
  // canal entre las franjas según su cuota de bruto en ese canal (sin
  // sobre-atribuir la liquidación real de canal a cada franja).
  const nDias = new Set(rows.filter(r => r.total_bruto > 0).map(r => r.fecha)).size || 1
  const netoRatioCanal: Record<string, number> = {}
  for (const c of CANALES) {
    const bruto = rows.reduce((s, r) => s + ((r as unknown as Record<string, number>)[c.bk] ?? 0), 0)
    const pedidos = rows.reduce((s, r) => s + ((r as unknown as Record<string, number>)[c.pk] ?? 0), 0)
    const { neto } = resolverNeto(c.id, bruto, pedidos, {
      modo: 'agregado_canal', marcasPorCanal, fechaDesde, fechaHasta,
      configCanales: config, diasConDatos: nDias,
    })
    netoRatioCanal[c.id] = bruto > 0 ? neto / bruto : 0
  }

  const marcaMap: Record<string, { pedidos: number; bruto: number; neto: number }> = {}
  rows.forEach(r => {
    const key = r.servicio ?? 'Sin marca'
    const e = (marcaMap[key] ??= { pedidos: 0, bruto: 0, neto: 0 })
    e.pedidos += r.total_pedidos
    e.bruto += r.total_bruto
    for (const c of CANALES) {
      const b = (r as unknown as Record<string, number>)[c.bk] ?? 0
      e.neto += b * netoRatioCanal[c.id]
    }
  })

  const marcaList = Object.entries(marcaMap)
    .map(([nombre, s]) => ({ nombre, pedidos: s.pedidos, bruto: s.bruto, neto: s.neto }))
    .sort((a, b) => b.bruto - a.bruto)

  const totalBruto = marcaList.reduce((s, m) => s + m.bruto, 0)
  const totalPedidos = marcaList.reduce((s, m) => s + m.pedidos, 0)

  const marcaMasVentas = marcaList[0]
  const marcaMejorTicket = [...marcaList].sort((a, b) => {
    const ta = a.pedidos > 0 ? a.bruto / a.pedidos : 0
    const tb = b.pedidos > 0 ? b.bruto / b.pedidos : 0
    return tb - ta
  })[0]

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
        {kpiCard('Marca más ventas', marcaMasVentas?.nombre ?? '—', fmtEur(marcaMasVentas?.bruto ?? 0))}
        {kpiCard('Mejor ticket medio', marcaMejorTicket?.nombre ?? '—',
          marcaMejorTicket && marcaMejorTicket.pedidos > 0
            ? fmtEur(marcaMejorTicket.bruto / marcaMejorTicket.pedidos)
            : '—'
        )}
        {kpiCard('Marcas con ventas en el periodo', fmtNum(marcaList.length))}
      </div>

      {/* % ventas por marca — barra horizontal */}
      <div style={{ ...CARDS.std, marginBottom: 14 }}>
        <div style={{ ...lbl, marginBottom: 14 }}>% ventas por marca</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {marcaList.map((m, i) => {
            const pct = totalBruto > 0 ? (m.bruto / totalBruto) * 100 : 0
            const color = MARCA_COLORS[i % MARCA_COLORS.length]
            return (
              <div key={m.nombre}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.sec }}>{m.nombre}</span>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, color: COLORS.pri }}>
                    {fmtEur(m.bruto)}{' '}
                    <span style={{ color: COLORS.mut, fontSize: 11 }}>({pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div style={BAR.track}>
                  <div style={{ width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 400ms ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabla desglose por marca */}
      <div style={CARDS.std}>
        <div style={{ ...lbl, marginBottom: 12 }}>Desglose por marca</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Marca</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Pedidos</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Bruto</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Neto est.</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Margen est.</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>% total</th>
            </tr>
          </thead>
          <tbody>
            {marcaList.map((m, i) => {
              const pct = totalBruto > 0 ? (m.bruto / totalBruto) * 100 : 0
              const margen = m.bruto > 0 ? (m.neto / m.bruto) * 100 : 0
              const color = MARCA_COLORS[i % MARCA_COLORS.length]
              return (
                <tr key={m.nombre}>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10,
                      borderRadius: '50%', background: color,
                      marginRight: 8, verticalAlign: 'middle',
                    }} />
                    {m.nombre}
                  </td>
                  <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', color: COLORS.pri }}>
                    {fmtNum(m.pedidos)}
                  </td>
                  <td style={tdR}>{fmtEur(m.bruto)}</td>
                  <td style={{ ...tdR, color: COLORS.ok }}>{fmtEur(m.neto)}</td>
                  <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', fontSize: 12, color: margen >= 70 ? COLORS.ok : COLORS.warn }}>
                    {margen.toFixed(0)}%
                  </td>
                  <td style={tdR}>
                    <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12 }}>{pct.toFixed(1)}%</span>
                  </td>
                </tr>
              )
            })}
            {(() => {
              const netoTot = marcaList.reduce((s, m) => s + m.neto, 0)
              const margenTot = totalBruto > 0 ? (netoTot / totalBruto) * 100 : 0
              return (
                <tr style={{ background: COLORS.group }}>
                  <td style={{ ...tdStyle, fontFamily: 'Oswald, sans-serif', fontWeight: 600, color: COLORS.pri }}>TOTAL</td>
                  <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', fontWeight: 600, color: COLORS.pri }}>{fmtNum(totalPedidos)}</td>
                  <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', fontWeight: 600, color: COLORS.pri }}>{fmtEur(totalBruto)}</td>
                  <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', fontWeight: 600, color: COLORS.ok }}>{fmtEur(netoTot)}</td>
                  <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', fontWeight: 600, color: COLORS.pri }}>{margenTot.toFixed(0)}%</td>
                  <td style={{ ...tdR, fontFamily: 'Oswald, sans-serif', fontWeight: 600 }}>100%</td>
                </tr>
              )
            })()}
          </tbody>
        </table>
      </div>

    </div>
  )
}
