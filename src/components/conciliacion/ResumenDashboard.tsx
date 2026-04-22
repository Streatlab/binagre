import { useMemo } from 'react'
import {
  LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { fmtEur } from '@/utils/format'
import { useTheme, FONT } from '@/styles/tokens'
import { KpiCard } from '@/components/KpiCard'
import type { Movimiento, Categoria } from '@/types/conciliacion'

interface Datos {
  ingresos: Movimiento[]
  gastos: Movimiento[]
  sumIng: number
  sumGst: number
  balance: number
  pendientes: number
}

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
  datos: Datos
  periodoLabel: string
}

/* ═══════════════════════════════════════════════════════════
   SUBCOMPONENTES: BarraCategoria + TotalFila
   ═══════════════════════════════════════════════════════════ */

function BarraCategoria({ nombre, valor, maximo, color }: { nombre: string; valor: number; maximo: number; color: string }) {
  const { T } = useTheme()
  const pct = maximo > 0 ? (valor / maximo) * 100 : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.pri }}>{nombre}</span>
        <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>{fmtEur(valor)}</span>
      </div>
      <div style={{ height: 6, backgroundColor: T.bg, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function TotalFila({ label, valor, color }: { label: string; valor: number; color: string }) {
  const { T } = useTheme()
  return (
    <div style={{
      marginTop: 12,
      paddingTop: 12,
      borderTop: `1px solid ${T.brd}`,
      display: 'flex',
      justifyContent: 'space-between',
    }}>
      <span style={{ fontFamily: FONT.heading, fontSize: 11, color: T.mut, textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</span>
      <span style={{ fontFamily: FONT.heading, fontSize: 14, color, fontWeight: 700 }}>{fmtEur(valor)}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════ */

export function ResumenDashboard({ movimientos, categorias, datos, periodoLabel }: Props) {
  const { T } = useTheme()

  const agruparPorCategoria = (movs: Movimiento[]) => {
    const map = new Map<string, number>()
    movs.forEach(m => {
      const catId = m.categoria_id ?? 'sin_cat'
      map.set(catId, (map.get(catId) ?? 0) + Math.abs(m.importe))
    })
    return Array.from(map.entries())
      .map(([id, total]) => ({
        id,
        nombre: categorias.find(c => c.id === id)?.nombre ?? 'Sin categoría',
        total,
      }))
      .sort((a, b) => b.total - a.total)
  }

  const categoriasConIngresos = useMemo(() => agruparPorCategoria(datos.ingresos), [datos.ingresos, categorias])
  const categoriasConGastos   = useMemo(() => agruparPorCategoria(datos.gastos),   [datos.gastos,   categorias])
  const maxFlujo = Math.max(
    ...categoriasConIngresos.map(c => c.total),
    ...categoriasConGastos.map(c => c.total),
    1,
  )

  /* — Evolución 3 líneas (31 días) — */
  const datosEvolucion = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(12, 0, 0, 0)
    const dias: { fecha: string; ingresos: number; gastos: number; saldo: number }[] = []
    let saldoAcum = 0
    for (let i = 30; i >= 0; i--) {
      const d = new Date(hoy)
      d.setDate(d.getDate() - i)
      const y = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const iso = `${y}-${mm}-${dd}`
      const movsDia = movimientos.filter(m => m.fecha === iso)
      const ing = movsDia.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0)
      const gst = Math.abs(movsDia.filter(m => m.importe < 0).reduce((s, m) => s + m.importe, 0))
      saldoAcum += ing - gst
      dias.push({
        fecha: d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        ingresos: Math.round(ing),
        gastos: Math.round(gst),
        saldo: Math.round(saldoAcum),
      })
    }
    return dias
  }, [movimientos])

  const cardWrap: React.CSSProperties = {
    background: T.card,
    border: `1px solid ${T.brd}`,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  }

  const sectionTitle: React.CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 14,
    color: T.pri,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: 16,
    fontWeight: 600,
  }

  const tooltipStyle = {
    backgroundColor: T.card,
    border: `1px solid ${T.brd}`,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 12,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* 3 KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KpiCard
          label="Ingresos"
          period={periodoLabel}
          value={fmtEur(datos.sumIng)}
          accent="success"
        />
        <KpiCard
          label="Gastos"
          period={periodoLabel}
          value={fmtEur(datos.sumGst)}
          accent="danger"
        />
        <KpiCard
          label="Balance neto"
          period={periodoLabel}
          value={fmtEur(datos.balance)}
          accent={datos.balance >= 0 ? 'default' : 'danger'}
        />
      </div>

      {/* FLUJO DE CAJA */}
      <div style={cardWrap}>
        <h3 style={sectionTitle}>Flujo de caja</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {/* Entradas */}
          <div>
            <div style={{ fontFamily: FONT.heading, fontSize: 12, color: '#06C167', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12, fontWeight: 600 }}>
              Entradas
            </div>
            {categoriasConIngresos.length === 0 && <div style={{ color: T.mut, fontSize: 12 }}>Sin ingresos</div>}
            {categoriasConIngresos.map(c => (
              <BarraCategoria key={c.id} nombre={c.nombre} valor={c.total} maximo={maxFlujo} color="#06C167" />
            ))}
            <TotalFila label="Total entradas" valor={datos.sumIng} color="#06C167" />
          </div>

          {/* Salidas */}
          <div>
            <div style={{ fontFamily: FONT.heading, fontSize: 12, color: '#B01D23', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12, fontWeight: 600 }}>
              Salidas
            </div>
            {categoriasConGastos.length === 0 && <div style={{ color: T.mut, fontSize: 12 }}>Sin gastos</div>}
            {categoriasConGastos.map(c => (
              <BarraCategoria key={c.id} nombre={c.nombre} valor={c.total} maximo={maxFlujo} color="#B01D23" />
            ))}
            <TotalFila label="Total salidas" valor={datos.sumGst} color="#B01D23" />
          </div>

          {/* Saldo */}
          <div>
            <div style={{ fontFamily: FONT.heading, fontSize: 12, color: T.mut, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12, fontWeight: 600 }}>
              Saldo
            </div>
            <div style={{
              padding: 24,
              borderRadius: 10,
              backgroundColor: T.bg,
              border: `1px solid ${T.brd}`,
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: FONT.heading,
                fontSize: 32,
                fontWeight: 700,
                color: datos.balance >= 0 ? T.pri : '#B01D23',
                lineHeight: 1.1,
              }}>
                {fmtEur(datos.balance)}
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {datos.balance >= 0 ? 'Positivo' : 'Negativo'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EVOLUCIÓN 3 LÍNEAS */}
      <div style={{ ...cardWrap, marginBottom: 0 }}>
        <h3 style={sectionTitle}>Evolución: Ingresos · Gastos · Saldo</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={datosEvolucion}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.brd} />
            <XAxis dataKey="fecha" stroke={T.mut} tick={{ fontSize: 11, fontFamily: FONT.body }} interval="preserveStartEnd" />
            <YAxis stroke={T.mut} tick={{ fontSize: 11, fontFamily: FONT.body }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtEur(Number(v))} />
            <Legend wrapperStyle={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }} />
            <ReferenceLine y={0} stroke={T.mut} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#06C167" strokeWidth={2}   dot={false} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="gastos"   name="Gastos"   stroke="#B01D23" strokeWidth={2}   dot={false} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="saldo"    name="Saldo"    stroke={T.accent} strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
