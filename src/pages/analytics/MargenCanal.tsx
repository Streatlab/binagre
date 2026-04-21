import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { supabase } from '@/lib/supabase'
import { useConfig } from '@/hooks/useConfig'
import { fmtEur, fmtPct } from '@/utils/format'

interface RawDiario {
  fecha: string
  uber_bruto: number; glovo_bruto: number; je_bruto: number
  web_bruto: number; directa_bruto: number
  uber_pedidos: number; glovo_pedidos: number; je_pedidos: number
  web_pedidos: number; directa_pedidos: number
  total_bruto: number
}

const CANALES_DEF = [
  { key: 'uber',    label: 'Uber Eats', bruKey: 'uber_bruto',    pedKey: 'uber_pedidos',    cfgNombre: 'Uber Eats',     color: '#06C167' },
  { key: 'glovo',   label: 'Glovo',     bruKey: 'glovo_bruto',   pedKey: 'glovo_pedidos',   cfgNombre: 'Glovo',         color: '#e8f442' },
  { key: 'je',      label: 'Just Eat',  bruKey: 'je_bruto',      pedKey: 'je_pedidos',      cfgNombre: 'Just Eat',      color: '#f5a623' },
  { key: 'web',     label: 'Web',       bruKey: 'web_bruto',     pedKey: 'web_pedidos',     cfgNombre: 'Web Propia',    color: '#ff6b70' },
  { key: 'directa', label: 'Directa',   bruKey: 'directa_bruto', pedKey: 'directa_pedidos', cfgNombre: 'Venta Directa', color: '#66aaff' },
] as const

const labelStyle = { fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '2px', color: 'var(--sl-text-muted)', marginBottom: 6 }

export default function MargenCanal() {
  const [data, setData] = useState<RawDiario[]>([])
  const [loading, setLoading] = useState(true)
  const cfg = useConfig()

  useEffect(() => {
    supabase.from('facturacion_diario').select('*').order('fecha').then(({ data: d }) => {
      setData((d as RawDiario[]) ?? [])
      setLoading(false)
    })
  }, [])

  const mesActual = new Date().toISOString().slice(0, 7)
  const mesDatos = useMemo(() => data.filter(r => r.fecha.startsWith(mesActual)), [data, mesActual])

  const canalStats = useMemo(() => CANALES_DEF.map(c => {
    const bruto = mesDatos.reduce((s, r) => s + ((r[c.bruKey] as number) || 0), 0)
    const pedidos = mesDatos.reduce((s, r) => s + ((r[c.pedKey] as number) || 0), 0)
    const cfgCanal = cfg.canales.find(cc => cc.canal === c.cfgNombre)
    const comision = cfgCanal?.comision_pct ?? 0
    const estructura = cfg.estructura_pct ?? 0
    const costeComision = bruto * comision * 1.21
    const ingresoNeto = bruto - costeComision
    const costeEstructura = ingresoNeto * estructura
    const margenEur = ingresoNeto - costeEstructura
    const margenPct = bruto > 0 ? (margenEur / bruto) * 100 : 0
    const ticket = pedidos > 0 ? bruto / pedidos : 0
    return { ...c, bruto, pedidos, costeComision, ingresoNeto, costeEstructura, margenEur, margenPct, ticket }
  }).filter(c => c.bruto > 0), [mesDatos, cfg])

  const totalBruto = canalStats.reduce((s, c) => s + c.bruto, 0)

  if (loading || cfg.loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--sl-text-muted)', fontFamily: 'Lexend, sans-serif' }}>Cargando…</div>

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 24, color: 'var(--sl-text-primary)', letterSpacing: '0.04em', marginBottom: 24 }}>MARGEN POR CANAL</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {canalStats.map(c => (
          <div key={c.key} style={{ backgroundColor: 'var(--sl-card)', border: `1px solid ${c.color}33`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ ...labelStyle, color: c.color }}>{c.label}</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, color: 'var(--sl-text-primary)', fontWeight: 700 }}>{fmtEur(c.bruto)}</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
              <span style={{ fontSize: 11, color: c.margenPct >= 15 ? '#06C167' : c.margenPct >= 5 ? '#f5a623' : '#ff6b70', fontFamily: 'Lexend, sans-serif', fontWeight: 700 }}>
                {fmtPct(c.margenPct / 100)} margen
              </span>
              <span style={{ fontSize: 11, color: 'var(--sl-text-muted)', fontFamily: 'Lexend, sans-serif' }}>{fmtEur(c.ticket)} ticket</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 10, padding: '20px 24px' }}>
          <div style={labelStyle}>Ventas brutas por canal</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={canalStats} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sl-border)" />
              <XAxis dataKey="label" tick={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, fill: 'var(--sl-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, fill: 'var(--sl-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={40} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 8, fontFamily: 'Lexend, sans-serif', fontSize: 12 }} formatter={(v: number) => fmtEur(v)} />
              <Bar dataKey="bruto" name="Ventas" radius={[4, 4, 0, 0]}>
                {canalStats.map(c => <Cell key={c.key} fill={c.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 10, padding: '20px 24px' }}>
          <div style={labelStyle}>% Margen neto por canal</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={canalStats} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sl-border)" />
              <XAxis dataKey="label" tick={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, fill: 'var(--sl-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, fill: 'var(--sl-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(0)}%`} width={36} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 8, fontFamily: 'Lexend, sans-serif', fontSize: 12 }} formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Bar dataKey="margenPct" name="Margen %" radius={[4, 4, 0, 0]}>
                {canalStats.map(c => <Cell key={c.key} fill={c.margenPct >= 15 ? '#06C167' : c.margenPct >= 5 ? '#f5a623' : '#ff6b70'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--sl-thead)' }}>
              {['Canal', 'Ventas brutas', '% Cuota', 'Coste comisión', 'Ingreso neto', 'Coste estructura', 'Margen €', '% Margen', 'Pedidos', 'Ticket'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Canal' ? 'left' : 'right', fontFamily: 'Oswald, sans-serif', fontSize: 10, color: 'var(--sl-text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {canalStats.map((c, i) => (
              <tr key={c.key} style={{ borderTop: '1px solid var(--sl-border)', backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--sl-card-alt)' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'Oswald, sans-serif', fontSize: 13, color: c.color, fontWeight: 700 }}>{c.label}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-primary)' }}>{fmtEur(c.bruto)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-muted)' }}>{fmtPct(totalBruto > 0 ? c.bruto / totalBruto : 0)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#ff6b70' }}>{fmtEur(c.costeComision)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-primary)' }}>{fmtEur(c.ingresoNeto)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-muted)' }}>{fmtEur(c.costeEstructura)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--sl-text-primary)' }}>{fmtEur(c.margenEur)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 700, color: c.margenPct >= 15 ? '#06C167' : c.margenPct >= 5 ? '#f5a623' : '#ff6b70' }}>{fmtPct(c.margenPct / 100)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-muted)' }}>{Math.round(c.pedidos)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-muted)' }}>{fmtEur(c.ticket)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {canalStats.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: 'var(--sl-text-muted)', fontFamily: 'Lexend, sans-serif' }}>Sin datos para el mes actual</div>}
      </div>
    </div>
  )
}
