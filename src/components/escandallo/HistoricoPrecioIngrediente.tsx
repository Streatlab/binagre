/**
 * T-F4-04 — HistoricoPrecioIngrediente
 * Gráfico + tabla evolución precio últimos 12 meses por ingrediente.
 * Usa recharts (ya en deps).
 */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'

interface PrecioRow {
  id: string
  fecha: string
  precio_unitario: number
  proveedor: string
}

interface Props {
  ingredienteId: string
}

// Colores por proveedor (hasta 6)
const PROVEEDOR_COLORS = ['#B01D23', '#66aaff', '#1D9E75', '#f5a623', '#e8f442', '#cc77ff']

export function HistoricoPrecioIngrediente({ ingredienteId }: Props) {
  const { T } = useTheme()
  const [rows, setRows] = useState<PrecioRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fecha12m = new Date()
    fecha12m.setMonth(fecha12m.getMonth() - 12)
    ;(async () => {
      const { data } = await supabase
        .from('precios_ingredientes')
        .select('id, fecha, precio_unitario, proveedor')
        .eq('ingrediente_id', ingredienteId)
        .gte('fecha', fecha12m.toISOString().slice(0, 10))
        .order('fecha', { ascending: true })
      if (!cancelled) {
        setRows((data as PrecioRow[]) ?? [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [ingredienteId])

  if (loading) {
    return <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, padding: '8px 0' }}>Cargando histórico...</div>
  }
  if (!rows.length) {
    return (
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, padding: '8px 0' }}>
        Sin histórico de precios. Usa "Vincular con compra" para registrar precios.
      </div>
    )
  }

  // Proveedores únicos
  const proveedores = [...new Set(rows.map(r => r.proveedor))]
  const colorMap = Object.fromEntries(proveedores.map((p, i) => [p, PROVEEDOR_COLORS[i % PROVEEDOR_COLORS.length]]))

  // Agrupar por fecha para recharts
  type ChartPoint = { fecha: string; [key: string]: string | number }
  const byFecha: Record<string, ChartPoint> = {}
  for (const r of rows) {
    if (!byFecha[r.fecha]) byFecha[r.fecha] = { fecha: r.fecha }
    byFecha[r.fecha][r.proveedor] = r.precio_unitario
  }
  const chartData = Object.values(byFecha).sort((a, b) => a.fecha.localeCompare(b.fecha))

  const cardStyle: CSSProperties = {
    background: T.card,
    border: `0.5px solid ${T.brd}`,
    borderRadius: 10,
    padding: '16px 18px',
    marginTop: 16,
  }
  const labelStyle: CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: T.mut,
    marginBottom: 12,
  }
  const thStyle: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px',
    textTransform: 'uppercase', color: T.mut, padding: '6px 10px',
    textAlign: 'left', background: '#0a0a0a', borderBottom: `1px solid ${T.brd}`,
  }
  const tdStyle: CSSProperties = {
    fontFamily: FONT.body, fontSize: 12, color: T.pri,
    padding: '6px 10px', borderBottom: `0.5px solid ${T.brd}`,
  }

  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Histórico de precios — últimos 12 meses</div>

      {/* Gráfico */}
      <div style={{ height: 200, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.brd} />
            <XAxis
              dataKey="fecha"
              tick={{ fontSize: 10, fill: T.mut, fontFamily: FONT.body }}
              tickFormatter={v => {
                const d = new Date(v + 'T12:00:00')
                return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
              }}
            />
            <YAxis tick={{ fontSize: 10, fill: T.mut, fontFamily: FONT.body }} tickFormatter={v => `${v}€`} />
            <Tooltip
              contentStyle={{ background: '#1a1a1a', border: `1px solid ${T.brd}`, borderRadius: 6, fontFamily: FONT.body, fontSize: 12 }}
              formatter={(value) => [`${Number(value ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 4 })} €`]}
            />
            {proveedores.length > 1 && <Legend wrapperStyle={{ fontFamily: FONT.body, fontSize: 11 }} />}
            {proveedores.map(prov => (
              <Line
                key={prov}
                type="monotone"
                dataKey={prov}
                stroke={colorMap[prov]}
                strokeWidth={2}
                dot={{ r: 3, fill: colorMap[prov] }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla últimas entradas */}
      <div style={{ overflowX: 'auto', maxHeight: 200, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Proveedor</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Precio/ud</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().slice(0, 40).map(r => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.fecha}</td>
                <td style={{ ...tdStyle, color: colorMap[r.proveedor] }}>{r.proveedor}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {r.precio_unitario.toLocaleString('es-ES', { minimumFractionDigits: 4 })} €
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
