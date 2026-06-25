import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Tokens ──────────────────────────────────────────────────────────────────
const GRANATE  = '#B01D23'
const CREMA    = '#FCEFD6'
const INK      = '#0a0a0a'
const BLANCO   = '#fff'
const VERDE    = '#0FB86B'
const AMBER    = '#FFC400'

const fmtEur = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const fmtNum = (v: number | null | undefined, dec = 2) =>
  v == null ? '—' : v.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec })

// ── Types ────────────────────────────────────────────────────────────────────
interface RoiFila {
  canal: string
  marca: string
  periodo: string
  ventas_brutas: number
  ventas_netas: number
  pedidos_total: number
  ads_eur: number
  promo_eur: number
  cupones_eur: number
  inversion_total: number
  retorno_por_euro: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function mesLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }).toUpperCase()
}

function RetornoBadge({ v }: { v: number | null }) {
  if (v == null) return <span style={{ color: '#aaa', fontSize: 13 }}>Sin datos</span>
  const color = v >= 3 ? VERDE : v >= 1.5 ? AMBER : GRANATE
  return (
    <span style={{ background: color, color: '#fff', borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontSize: 13 }}>
      {fmtNum(v)}x
    </span>
  )
}

// ── Component ────────────────────────────────────────────────────────────────
export default function RoiPromociones() {
  const [filas, setFilas]       = useState<RoiFila[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtroCanal, setFiltroCanal] = useState<string>('todos')
  const [filtroMarca, setFiltroMarca] = useState<string>('todas')

  useEffect(() => {
    supabase
      .from('roi_promociones')
      .select('*')
      .order('periodo', { ascending: false })
      .then(({ data }) => {
        setFilas((data as unknown as RoiFila[]) ?? [])
        setLoading(false)
      })
  }, [])

  const canales = ['todos', ...Array.from(new Set(filas.map(f => f.canal)))]
  const marcas  = ['todas', ...Array.from(new Set(filas.map(f => f.marca)))]

  const filtradas = filas.filter(f =>
    (filtroCanal === 'todos' || f.canal === filtroCanal) &&
    (filtroMarca === 'todas' || f.marca === filtroMarca)
  )

  // KPIs globales
  const invTotal   = filtradas.reduce((a, f) => a + Number(f.inversion_total ?? 0), 0)
  const netasTotal = filtradas.reduce((a, f) => a + Number(f.ventas_netas ?? 0), 0)
  const retGlobal  = invTotal > 0 ? netasTotal / invTotal : null
  const sinDatos   = invTotal === 0

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto', fontFamily: 'Lexend, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 28, color: INK, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
          ROI Promociones
        </h1>
        <p style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
          ¿Cuánto te devuelve cada euro invertido en ads, promos y cupones?
        </p>
      </div>

      {/* Aviso sin datos de inversión */}
      {sinDatos && !loading && (
        <div style={{ background: CREMA, border: `2px solid ${AMBER}`, borderRadius: 8, padding: '12px 18px', marginBottom: 20, fontSize: 14, color: '#6b5d45' }}>
          ⚠️ <strong>Sin datos de inversión todavía.</strong> Las columnas ads_eur, promo_eur y cupones_eur están a 0 en todas las filas.
          Cuando importes los datos reales de plataformas, este módulo se actualizará solo.
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Inversión total" value={fmtEur(invTotal)} sub={sinDatos ? 'Sin datos aún' : undefined} color={GRANATE} />
        <KpiCard label="Ventas netas (periodo)" value={fmtEur(netasTotal)} color={INK} />
        <KpiCard
          label="Retorno global"
          value={retGlobal != null ? `${fmtNum(retGlobal)}x` : '—'}
          sub={sinDatos ? 'Necesita inversión > 0' : undefined}
          color={retGlobal == null ? '#aaa' : retGlobal >= 2 ? VERDE : GRANATE}
        />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <Filtro label="Canal" value={filtroCanal} options={canales} onChange={setFiltroCanal} />
        <Filtro label="Marca" value={filtroMarca} options={marcas} onChange={setFiltroMarca} />
      </div>

      {/* Tabla */}
      {loading ? (
        <p style={{ color: '#888', fontSize: 14 }}>Cargando...</p>
      ) : filtradas.length === 0 ? (
        <p style={{ color: '#888', fontSize: 14 }}>Sin filas para el filtro seleccionado.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: `2px solid ${INK}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: INK, color: BLANCO }}>
                {['Periodo', 'Canal', 'Marca', 'Ventas brutas', 'Ventas netas', 'Pedidos', 'Ads', 'Promo', 'Cupones', 'Inversión total', 'Retorno'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: 12, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? BLANCO : '#fafaf7', borderBottom: '1px solid #e8e0d0' }}>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{mesLabel(f.periodo)}</td>
                  <td style={{ padding: '8px 12px' }}><PillCanal canal={f.canal} /></td>
                  <td style={{ padding: '8px 12px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.marca}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtEur(Number(f.ventas_brutas))}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{fmtEur(Number(f.ventas_netas))}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{f.pedidos_total}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: Number(f.ads_eur) > 0 ? GRANATE : '#bbb' }}>{fmtEur(Number(f.ads_eur))}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: Number(f.promo_eur) > 0 ? GRANATE : '#bbb' }}>{fmtEur(Number(f.promo_eur))}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: Number(f.cupones_eur) > 0 ? GRANATE : '#bbb' }}>{fmtEur(Number(f.cupones_eur))}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: Number(f.inversion_total) > 0 ? GRANATE : '#bbb' }}>{fmtEur(Number(f.inversion_total))}</td>
                  <td style={{ padding: '8px 12px' }}><RetornoBadge v={f.retorno_por_euro != null ? Number(f.retorno_por_euro) : null} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Nota metodológica */}
      <div style={{ marginTop: 20, fontSize: 12, color: '#999', lineHeight: 1.6 }}>
        <strong>Nota:</strong> Retorno = ventas netas ÷ inversión (ads + promos + cupones). 
        El umbral "rentable" queda pendiente de definir con Rubén. 
        Los datos de prime/promo por pedido vendrán de <code>estadisticas_prime_promo</code> cuando se completen.
      </div>
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ background: BLANCO, border: `2px solid ${INK}`, borderRadius: 8, padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: '#888', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'Oswald, sans-serif', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Filtro({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ border: `2px solid ${INK}`, borderRadius: 6, padding: '4px 10px', fontSize: 13, fontFamily: 'Lexend, sans-serif', background: BLANCO, cursor: 'pointer' }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function PillCanal({ canal }: { canal: string }) {
  const MAP: Record<string, { bg: string; label: string }> = {
    uber:     { bg: '#000', label: 'Uber' },
    glovo:    { bg: '#FFC244', label: 'Glovo' },
    just_eat: { bg: '#FF8000', label: 'Just Eat' },
    web:      { bg: '#2D5BFF', label: 'Web' },
  }
  const cfg = MAP[canal] ?? { bg: '#888', label: canal }
  return (
    <span style={{ background: cfg.bg, color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}
