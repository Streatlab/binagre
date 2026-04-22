import { useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { fmtEur } from '@/utils/format'
import { useTheme, FONT } from '@/styles/tokens'
import { KpiCard } from '@/components/KpiCard'
import type { Movimiento, Categoria } from '@/types/conciliacion'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
}

const COLORES_CAT = ['#FF4757', '#06C167', '#B01D23', '#f5a623', '#66aaff', '#a66aff', '#ff6aaa', '#6affaa']

function isoWeekStr(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const w = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return `S${w}`
}

function fmtFechaCorta(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function ResumenDashboard({ movimientos, categorias }: Props) {
  const { T } = useTheme()

  const catById = useMemo(() => {
    const map: Record<string, Categoria> = {}
    for (const c of categorias) map[c.id] = c
    return map
  }, [categorias])

  const totalGastos = useMemo(
    () => movimientos.filter(m => m.importe < 0).reduce((a, m) => a + Math.abs(m.importe), 0),
    [movimientos]
  )
  const totalIngresos = useMemo(
    () => movimientos.filter(m => m.importe > 0).reduce((a, m) => a + m.importe, 0),
    [movimientos]
  )

  const categoriaTop = useMemo(() => {
    const tot: Record<string, number> = {}
    for (const m of movimientos) {
      if (m.importe < 0 && m.categoria_id) {
        tot[m.categoria_id] = (tot[m.categoria_id] ?? 0) + Math.abs(m.importe)
      }
    }
    const entries = Object.entries(tot).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return { nombre: '—', total: 0 }
    const [catId, total] = entries[0]
    return { nombre: catById[catId]?.nombre ?? '—', total }
  }, [movimientos, catById])

  const mayorGasto = useMemo(() => {
    const gastos = movimientos.filter(m => m.importe < 0)
    if (gastos.length === 0) return { concepto: '—', importe: 0 }
    const top = gastos.reduce((prev, m) => m.importe < prev.importe ? m : prev)
    return { concepto: top.concepto, importe: Math.abs(top.importe) }
  }, [movimientos])

  const ratio = totalGastos > 0 ? totalIngresos / totalGastos : 0

  const datosSemana = useMemo(() => {
    const map: Record<string, { semana: string; ingresos: number; gastos: number; orden: number }> = {}
    for (const m of movimientos) {
      const s = isoWeekStr(m.fecha)
      if (!map[s]) {
        const d = new Date(m.fecha + 'T12:00:00')
        map[s] = { semana: s, ingresos: 0, gastos: 0, orden: d.getTime() }
      } else if (new Date(m.fecha + 'T12:00:00').getTime() < map[s].orden) {
        map[s].orden = new Date(m.fecha + 'T12:00:00').getTime()
      }
      if (m.importe >= 0) map[s].ingresos += m.importe
      else map[s].gastos += Math.abs(m.importe)
    }
    return Object.values(map).sort((a, b) => a.orden - b.orden).map(({ orden, ...rest }) => { void orden; return rest })
  }, [movimientos])

  const datosCategoria = useMemo(() => {
    const tot: Record<string, number> = {}
    for (const m of movimientos) {
      if (m.importe < 0 && m.categoria_id) {
        tot[m.categoria_id] = (tot[m.categoria_id] ?? 0) + Math.abs(m.importe)
      }
    }
    return Object.entries(tot)
      .map(([catId, total]) => ({ nombre: catById[catId]?.nombre ?? catId, total }))
      .sort((a, b) => b.total - a.total)
  }, [movimientos, catById])

  const datosBalance = useMemo(() => {
    const sorted = [...movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha))
    let acc = 0
    const byDate: Record<string, number> = {}
    for (const m of sorted) {
      acc += m.importe
      byDate[m.fecha] = acc
    }
    return Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, balance]) => ({ fecha: fmtFechaCorta(fecha), balance: Math.round(balance) }))
  }, [movimientos])

  const tooltipStyle = {
    backgroundColor: T.card,
    border: `1px solid ${T.brd}`,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 12,
  }

  const cardWrap: React.CSSProperties = {
    background: T.card,
    border: `0.5px solid ${T.brd}`,
    borderRadius: 10,
    padding: 16,
  }

  const panelTitle: React.CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 12,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: T.mut,
    margin: '0 0 14px 0',
    fontWeight: 500,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 3 KPIs secundarios */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <KpiCard
          label="Categoría top gasto"
          value={categoriaTop.nombre}
          delta={{ value: fmtEur(categoriaTop.total), trend: 'neutral' }}
          accent="info"
        />
        <KpiCard
          label="Mayor gasto puntual"
          value={fmtEur(mayorGasto.importe)}
          delta={{ value: mayorGasto.concepto, trend: 'neutral' }}
          accent="danger"
        />
        <KpiCard
          label="Ratio ing/gast"
          value={ratio.toFixed(2)}
          delta={{ value: ratio >= 1 ? 'Saludable' : 'Alerta', trend: ratio >= 1 ? 'up' : 'down' }}
          accent={ratio >= 1 ? 'success' : 'danger'}
        />
      </div>

      {/* Fila 2: Barras + Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 16 }}>
        <div style={cardWrap}>
          <h3 style={panelTitle}>Ingresos vs gastos por semana</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={datosSemana}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.brd} />
              <XAxis dataKey="semana" stroke={T.mut} style={{ fontFamily: FONT.body, fontSize: 11 }} />
              <YAxis stroke={T.mut} style={{ fontFamily: FONT.body, fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtEur(Number(v))} />
              <Legend wrapperStyle={{ fontFamily: FONT.body, fontSize: 11, color: T.sec }} />
              <Bar dataKey="ingresos" fill="#06C167" name="Ingresos" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" fill="#B01D23" name="Gastos" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={cardWrap}>
          <h3 style={panelTitle}>Gastos por categoría</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={datosCategoria}
                dataKey="total"
                nameKey="nombre"
                cx="50%" cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
              >
                {datosCategoria.map((_, i) => (
                  <Cell key={i} fill={COLORES_CAT[i % COLORES_CAT.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, n) => {
                  const num = Number(v)
                  return [
                    `${fmtEur(num)} (${totalGastos > 0 ? ((num / totalGastos) * 100).toFixed(1) : '0'}%)`,
                    String(n),
                  ]
                }}
              />
              <Legend wrapperStyle={{ fontFamily: FONT.body, fontSize: 10, color: T.sec }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fila 3: Línea balance */}
      <div style={cardWrap}>
        <h3 style={panelTitle}>Evolución del balance</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={datosBalance}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.brd} />
            <XAxis dataKey="fecha" stroke={T.mut} style={{ fontFamily: FONT.body, fontSize: 11 }} />
            <YAxis stroke={T.mut} style={{ fontFamily: FONT.body, fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtEur(Number(v))} />
            <ReferenceLine y={0} stroke={T.mut} strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#FF4757"
              strokeWidth={2}
              dot={{ fill: '#FF4757', r: 3 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
