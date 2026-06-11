/**
 * MarketingEmbudo v1 — datos REALES de facturacion_diario
 * Sin llamadas a IA. Sin mocks. Sin costes externos.
 * Ticket medio: visible (columna total_pedidos existe en BD).
 */

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, CANALES } from '@/styles/tokens'
import { fmtEur } from '@/lib/format'
import { COLORS, CARDS, lbl, kpiMid, OSWALD, LEXEND } from '@/components/panel/resumen/tokens'

// ── Tipos ────────────────────────────────────────────────────
interface RowFD {
  fecha: string
  uber_pedidos: number; uber_bruto: number
  glovo_pedidos: number; glovo_bruto: number
  je_pedidos: number; je_bruto: number
  web_pedidos: number; web_bruto: number
  directa_pedidos: number; directa_bruto: number
  total_pedidos: number; total_bruto: number
}

type Periodo = '7d' | '30d' | '90d' | 'año'

const PERIODO_OPTS: Array<{ id: Periodo; label: string }> = [
  { id: '7d', label: 'Últimos 7 días' },
  { id: '30d', label: 'Últimos 30 días' },
  { id: '90d', label: 'Últimos 90 días' },
  { id: 'año', label: 'Este año' },
]

function periodoDesde(p: Periodo): string {
  const d = new Date()
  if (p === '7d') d.setDate(d.getDate() - 6)
  else if (p === '30d') d.setDate(d.getDate() - 29)
  else if (p === '90d') d.setDate(d.getDate() - 89)
  else d.setMonth(0, 1)
  return d.toISOString().slice(0, 10)
}

// ── Sub-componentes ──────────────────────────────────────────
interface CanalStats {
  id: string
  label: string
  color: string
  bruto: number
  pedidos: number
  pct: number
  ticket: number | null
}

function CardCanal({ c, maxBruto }: { c: CanalStats; maxBruto: number }) {
  const barW = maxBruto > 0 ? Math.max(4, (c.bruto / maxBruto) * 100) : 4
  const isGlovo = c.id === 'glovo'

  return (
    <div style={{ ...CARDS.std, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Label + badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{
          fontFamily: OSWALD,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: isGlovo ? '#3a3a00' : c.color,
        }}>
          {c.label}
        </div>
        <div style={{
          fontFamily: OSWALD,
          fontSize: 10,
          fontWeight: 500,
          padding: '2px 8px',
          borderRadius: 4,
          background: c.color + '22',
          color: isGlovo ? '#3a3a00' : c.color,
        }}>
          {c.pct.toFixed(1)}%
        </div>
      </div>

      {/* Bruto */}
      <div>
        <div style={{ ...kpiMid, color: COLORS.pri }}>{fmtEur(c.bruto)}</div>
        <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLORS.mut, marginTop: 2 }}>facturación bruta</div>
      </div>

      {/* Barra proporcional */}
      <div style={{ height: 6, borderRadius: 3, background: COLORS.group, overflow: 'hidden' }}>
        <div style={{ width: `${barW}%`, height: '100%', background: c.color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>

      {/* Pedidos + ticket */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 15, fontWeight: 600, color: COLORS.pri }}>{c.pedidos.toLocaleString('es-ES')}</div>
          <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLORS.mut }}>pedidos</div>
        </div>
        {c.ticket !== null && (
          <div>
            <div style={{ fontFamily: OSWALD, fontSize: 15, fontWeight: 600, color: COLORS.sec }}>{fmtEur(c.ticket)}</div>
            <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLORS.mut }}>ticket medio</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────
export default function MarketingEmbudo() {
  const { T } = useTheme()
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [rows, setRows] = useState<RowFD[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const desde = periodoDesde(periodo)
    supabase
      .from('facturacion_diario')
      .select('fecha,uber_pedidos,uber_bruto,glovo_pedidos,glovo_bruto,je_pedidos,je_bruto,web_pedidos,web_bruto,directa_pedidos,directa_bruto,total_pedidos,total_bruto')
      .gte('fecha', desde)
      .order('fecha', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setRows((data ?? []) as RowFD[])
        setLoading(false)
      })
  }, [periodo])

  const stats = useMemo<CanalStats[]>(() => {
    const totales = {
      uber: { bruto: 0, pedidos: 0 },
      glovo: { bruto: 0, pedidos: 0 },
      je: { bruto: 0, pedidos: 0 },
      web: { bruto: 0, pedidos: 0 },
      dir: { bruto: 0, pedidos: 0 },
    }
    rows.forEach(r => {
      totales.uber.bruto += r.uber_bruto ?? 0
      totales.uber.pedidos += r.uber_pedidos ?? 0
      totales.glovo.bruto += r.glovo_bruto ?? 0
      totales.glovo.pedidos += r.glovo_pedidos ?? 0
      totales.je.bruto += r.je_bruto ?? 0
      totales.je.pedidos += r.je_pedidos ?? 0
      totales.web.bruto += r.web_bruto ?? 0
      totales.web.pedidos += r.web_pedidos ?? 0
      totales.dir.bruto += r.directa_bruto ?? 0
      totales.dir.pedidos += r.directa_pedidos ?? 0
    })
    const totalBruto = Object.values(totales).reduce((s, v) => s + v.bruto, 0)
    return CANALES.map(c => {
      const t = totales[c.id as keyof typeof totales]
      return {
        id: c.id,
        label: c.label,
        color: c.color,
        bruto: t.bruto,
        pedidos: t.pedidos,
        pct: totalBruto > 0 ? (t.bruto / totalBruto) * 100 : 0,
        ticket: t.pedidos > 0 ? t.bruto / t.pedidos : null,
      }
    }).sort((a, b) => b.bruto - a.bruto)
  }, [rows])

  const totalBruto = stats.reduce((s, c) => s + c.bruto, 0)
  const totalPedidos = stats.reduce((s, c) => s + c.pedidos, 0)
  const ticketTotal = totalPedidos > 0 ? totalBruto / totalPedidos : null
  const maxBruto = Math.max(...stats.map(c => c.bruto), 1)

  return (
    <div style={{ background: T.bg, padding: '24px 28px', minHeight: '100vh' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', textTransform: 'uppercase', color: COLORS.redSL, margin: 0 }}>
            Embudo de Canales
          </h1>
          <p style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, margin: '4px 0 0' }}>
            Distribución real de facturación por canal de venta
          </p>
        </div>
        {/* Selector de periodo */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PERIODO_OPTS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setPeriodo(opt.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: periodo === opt.id ? `1.5px solid ${COLORS.redSL}` : `0.5px solid ${COLORS.brd}`,
                background: periodo === opt.id ? COLORS.redSL : COLORS.card,
                color: periodo === opt.id ? '#ffffff' : COLORS.sec,
                fontFamily: OSWALD,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.5px',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Estado */}
      {error && (
        <div style={{ background: '#FCEBEB', border: `1px solid ${COLORS.err}`, color: '#A32D2D', padding: 16, borderRadius: 8, fontFamily: FONT.body, fontSize: 13, marginBottom: 16 }}>
          Error cargando datos: {error}
        </div>
      )}

      {loading && !error && (
        <div style={{ padding: 40, color: COLORS.mut, fontFamily: FONT.body, fontSize: 14 }}>Cargando datos reales...</div>
      )}

      {!loading && !error && (
        <>
          {/* Totales globales */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ ...CARDS.std, flex: 1, minWidth: 160 }}>
              <div style={lbl}>Total bruto</div>
              <div style={{ ...kpiMid, marginTop: 6 }}>{fmtEur(totalBruto)}</div>
            </div>
            <div style={{ ...CARDS.std, flex: 1, minWidth: 160 }}>
              <div style={lbl}>Total pedidos</div>
              <div style={{ ...kpiMid, marginTop: 6 }}>{totalPedidos.toLocaleString('es-ES')}</div>
            </div>
            {ticketTotal !== null && (
              <div style={{ ...CARDS.std, flex: 1, minWidth: 160 }}>
                <div style={lbl}>Ticket medio global</div>
                <div style={{ ...kpiMid, marginTop: 6 }}>{fmtEur(ticketTotal)}</div>
              </div>
            )}
            <div style={{ ...CARDS.std, flex: 1, minWidth: 160 }}>
              <div style={lbl}>Días con datos</div>
              <div style={{ ...kpiMid, marginTop: 6 }}>{rows.length.toLocaleString('es-ES')}</div>
            </div>
          </div>

          {/* Cards por canal */}
          {rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: COLORS.mut, fontFamily: FONT.body, fontSize: 14 }}>
              Sin datos para el periodo seleccionado
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {stats.map(c => (
                <CardCanal key={c.id} c={c} maxBruto={maxBruto} />
              ))}
            </div>
          )}

          {/* Nota honesta sobre datos faltantes */}
          {rows.length > 0 && (
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginTop: 16, fontStyle: 'italic' }}>
              Datos desde <code>facturacion_diario</code>. Ticket medio calculado sobre pedidos registrados por canal.
              No se muestran conversiones ni embudos de marketing — requieren integración externa no implementada.
            </div>
          )}
        </>
      )}
    </div>
  )
}
