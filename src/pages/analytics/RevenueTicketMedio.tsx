import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'

interface RawDiario {
  fecha: string; servicio: string
  uber_pedidos: number; uber_bruto: number
  glovo_pedidos: number; glovo_bruto: number
  je_pedidos: number; je_bruto: number
  web_pedidos: number; web_bruto: number
  directa_pedidos: number; directa_bruto: number
  total_pedidos: number; total_bruto: number
}

function isoWeek(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const y = d.getFullYear()
  const jan1 = new Date(y, 0, 1)
  return { year: y, week: Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7) }
}

const CANAL_COLORS: Record<string, string> = {
  'Uber Eats': '#06C167', 'Glovo': '#e8f442', 'Just Eat': '#f5a623',
  'Web': '#ff6b70', 'Directa': '#66aaff',
}

const labelStyle = { fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '2px', color: 'var(--sl-text-muted)', marginBottom: 6 }

export default function RevenueTicketMedio() {
  const [data, setData] = useState<RawDiario[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('facturacion_diario').select('*').order('fecha').then(({ data }) => {
      setData((data as RawDiario[]) ?? [])
      setLoading(false)
    })
  }, [])

  const hoy = new Date().toISOString().slice(0, 10)
  const mesActual = hoy.slice(0, 7)
  const mesAnterior = (() => {
    const d = new Date(hoy)
    d.setDate(1); d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 7)
  })()

  const mesDatos = useMemo(() => data.filter(r => r.fecha.startsWith(mesActual)), [data, mesActual])
  const mesAntDatos = useMemo(() => data.filter(r => r.fecha.startsWith(mesAnterior)), [data, mesAnterior])

  const totalVentasMes = mesDatos.reduce((s, r) => s + (r.total_bruto || 0), 0)
  const totalPedidosMes = mesDatos.reduce((s, r) => s + (r.total_pedidos || 0), 0)
  const ticketMedio = totalPedidosMes > 0 ? totalVentasMes / totalPedidosMes : 0
  const totalVentasAnt = mesAntDatos.reduce((s, r) => s + (r.total_bruto || 0), 0)
  const varMes = totalVentasAnt > 0 ? ((totalVentasMes - totalVentasAnt) / totalVentasAnt) * 100 : null

  const canalVentas = [
    { name: 'Uber Eats', bruto: mesDatos.reduce((s, r) => s + r.uber_bruto, 0) },
    { name: 'Glovo', bruto: mesDatos.reduce((s, r) => s + r.glovo_bruto, 0) },
    { name: 'Just Eat', bruto: mesDatos.reduce((s, r) => s + r.je_bruto, 0) },
    { name: 'Web', bruto: mesDatos.reduce((s, r) => s + r.web_bruto, 0) },
    { name: 'Directa', bruto: mesDatos.reduce((s, r) => s + r.directa_bruto, 0) },
  ].filter(c => c.bruto > 0).sort((a, b) => b.bruto - a.bruto)

  const canalTop = canalVentas[0]?.name ?? '—'

  // Weekly chart — last 12 weeks
  const weeklyData = useMemo(() => {
    const map = new Map<string, { label: string; ventas: number; pedidos: number; ticket: number }>()
    for (const r of data) {
      const { year, week } = isoWeek(r.fecha)
      const key = `${year}-${String(week).padStart(2, '0')}`
      const entry = map.get(key) ?? { label: `S${week}`, ventas: 0, pedidos: 0, ticket: 0 }
      entry.ventas += r.total_bruto || 0
      entry.pedidos += r.total_pedidos || 0
      map.set(key, entry)
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([, v]) => ({ ...v, ticket: v.pedidos > 0 ? v.ventas / v.pedidos : 0 }))
  }, [data])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--sl-text-muted)', fontFamily: 'Lexend, sans-serif' }}>Cargando…</div>

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 24, color: 'var(--sl-text-primary)', letterSpacing: '0.04em', marginBottom: 24 }}>REVENUE & TICKET MEDIO</h1>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Ventas mes actual', value: fmtEur(totalVentasMes), sub: varMes !== null ? `${varMes >= 0 ? '+' : ''}${varMes.toFixed(1)}% vs mes ant.` : undefined, subColor: varMes !== null ? (varMes >= 0 ? '#06C167' : '#ff6b70') : undefined },
          { label: 'Pedidos mes actual', value: String(Math.round(totalPedidosMes)), sub: undefined },
          { label: 'Ticket medio', value: fmtEur(ticketMedio), sub: undefined },
          { label: 'Canal top', value: canalTop, sub: canalVentas[0] ? fmtEur(canalVentas[0].bruto) : undefined },
        ].map(kpi => (
          <div key={kpi.label} style={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 10, padding: '16px 20px' }}>
            <div style={labelStyle}>{kpi.label}</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, color: 'var(--sl-text-primary)', fontWeight: 700 }}>{kpi.value}</div>
            {kpi.sub && <div style={{ fontSize: 11, color: kpi.subColor ?? 'var(--sl-text-muted)', fontFamily: 'Lexend, sans-serif', marginTop: 4 }}>{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* Evolución semanal */}
      <div style={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
        <div style={labelStyle}>Evolución semanal — últimas 12 semanas</div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={weeklyData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--sl-border)" />
            <XAxis dataKey="label" tick={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fill: 'var(--sl-text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, fill: 'var(--sl-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={40} />
            <Tooltip contentStyle={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 8, fontFamily: 'Lexend, sans-serif', fontSize: 12 }} formatter={(v: number) => fmtEur(v)} />
            <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#e8f442" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Ticket medio semanal + Canal breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 10, padding: '20px 24px' }}>
          <div style={labelStyle}>Ticket medio semanal</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sl-border)" />
              <XAxis dataKey="label" tick={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, fill: 'var(--sl-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, fill: 'var(--sl-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(1)}€`} width={44} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 8, fontFamily: 'Lexend, sans-serif', fontSize: 12 }} formatter={(v: number) => fmtEur(v)} />
              <Line type="monotone" dataKey="ticket" name="Ticket €" stroke="#66aaff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 10, padding: '20px 24px' }}>
          <div style={labelStyle}>Ventas por canal — mes actual</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={canalVentas} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sl-border)" />
              <XAxis dataKey="name" tick={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, fill: 'var(--sl-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, fill: 'var(--sl-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={40} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 8, fontFamily: 'Lexend, sans-serif', fontSize: 12 }} formatter={(v: number) => fmtEur(v)} />
              <Bar dataKey="bruto" name="Ventas" radius={[4, 4, 0, 0]}>
                {canalVentas.map((entry) => (
                  <rect key={entry.name} fill={CANAL_COLORS[entry.name] ?? '#e8f442'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
