/**
 * PanelGlobal2 — Copia REAL de Panel Global con estilo Lymon.
 *
 * - Datos 100% reales (Supabase facturacion_diario, vía usePanelGlobalData).
 * - Header funcional idéntico a Panel Global: selector de fecha + filtros marcas/canales.
 * - Una sola tab: Resumen.
 * - Look Lymon: oscuro #2d2d2e + lima #e8f442 + tomate #C8362A, Oswald mayúsculas.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import { usePanelGlobalData, fmtEur, fmtPct, fmtNum } from './usePanelGlobalData'

interface MarcaItem { id: string; nombre: string }

const C = {
  bg: '#2d2d2e', surface: '#3a3a3c', border: 'rgba(255,255,255,0.08)',
  text: '#ffffff', textMuted: '#a8a8aa',
  lime: '#e8f442', tomato: '#C8362A', leaf: '#7A8F5C',
}

const CANALES_DISPONIBLES = [
  { id: 'uber', label: 'Uber Eats' },
  { id: 'glovo', label: 'Glovo' },
  { id: 'je', label: 'Just Eat' },
  { id: 'web', label: 'Web' },
  { id: 'dir', label: 'Directa' },
]

function MultiSelectDark({
  label, options, selected, onToggle, onAll,
}: {
  label: string
  options: Array<{ id: string; label: string }>
  selected: string[]
  onToggle: (id: string) => void
  onAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function click(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])
  const displayLabel = selected.length === 0 || selected.length === options.length ? label : `${selected.length} sel.`
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        height: 40, padding: '0 14px', border: `1px solid ${C.border}`, borderRadius: 8,
        background: 'transparent', color: C.text, fontSize: 12, cursor: 'pointer',
        fontFamily: 'Oswald, sans-serif', fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>{displayLabel}</span>
        <ChevronDown size={12} strokeWidth={2.5} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 46, right: 0, background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 10, width: 240, zIndex: 100,
          maxHeight: 360, overflowY: 'auto', padding: '4px 0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <button onClick={() => { onAll(); setOpen(false) }} style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px',
            background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer',
            fontSize: 12, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase',
            letterSpacing: '0.06em', borderBottom: `1px solid ${C.border}`,
          }}>Todos</button>
          {options.map(o => {
            const on = selected.includes(o.id)
            return (
              <label key={o.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                cursor: 'pointer', fontSize: 13, color: on ? C.lime : C.textMuted,
                background: on ? 'rgba(232,244,66,0.06)' : 'transparent',
              }}>
                <input type="checkbox" checked={on} onChange={() => onToggle(o.id)} style={{ accentColor: C.lime }} />
                {o.label}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PanelGlobal2() {
  const [fechaDesde, setFechaDesde] = useState<Date>(() => new Date(2026, 3, 1))
  const [fechaHasta, setFechaHasta] = useState<Date>(() => new Date(2026, 3, 30))
  const [periodoLabel, setPeriodoLabel] = useState('Mes en curso')
  const [marcasFiltro, setMarcasFiltro] = useState<string[]>([])
  const [canalesFiltro, setCanalesFiltro] = useState<string[]>([])
  const [marcasDisp, setMarcasDisp] = useState<MarcaItem[]>([])

  useEffect(() => {
    supabase.from('marcas').select('id,nombre').eq('estado', 'activa').then(({ data }) => {
      if (data) setMarcasDisp(data as MarcaItem[])
    })
  }, [])

  const handleFecha = useCallback((desde: Date, hasta: Date, label: string) => {
    setFechaDesde(desde); setFechaHasta(hasta); setPeriodoLabel(label)
  }, [])

  const d = usePanelGlobalData(fechaDesde, fechaHasta, canalesFiltro)
  const marcasOpts = marcasDisp.map(m => ({ id: m.id, label: m.nombre }))
  const pedidosDia = d.diaMes > 0 ? Math.round(d.pedidos / d.diaMes) : 0
  const tiendaPct = d.canales.find(c => c.id === 'web')?.pct ?? 0

  return (
    <div style={{
      background: C.bg, minHeight: '100vh',
      fontFamily: 'Inter, -apple-system, sans-serif', color: C.text,
      fontSize: 14, lineHeight: 1.5, WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ padding: '32px 40px', maxWidth: 1320, margin: '0 auto' }}>

        {/* HEADER con filtros reales */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40, gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 600, color: C.lime, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
              {periodoLabel}
            </div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 42, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.05, textTransform: 'uppercase' }}>
              Panel Global 2
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <SelectorFechaUniversal nombreModulo="panel_global_2" defaultOpcion="mes_en_curso" onChange={handleFecha} />
            <MultiSelectDark label="Todas las marcas" options={marcasOpts} selected={marcasFiltro}
              onToggle={id => setMarcasFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
              onAll={() => setMarcasFiltro([])} />
            <MultiSelectDark label="Canales" options={CANALES_DISPONIBLES} selected={canalesFiltro}
              onToggle={id => setCanalesFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
              onAll={() => setCanalesFiltro([])} />
          </div>
        </div>

        {/* TAB única: Resumen */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 36 }}>
          <div style={{
            padding: '8px 20px', borderRadius: 999, background: C.lime, color: C.bg,
            fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 13,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>Resumen</div>
        </div>

        {d.loading ? (
          <div style={{ padding: 40, color: C.textMuted }}>Cargando datos del Panel Global…</div>
        ) : (
          <>
            {/* HERO */}
            <div style={{ marginBottom: 56, padding: '40px 0 36px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 56, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.02em', textTransform: 'uppercase', marginBottom: 20 }}>
                EL NEGOCIO VA{' '}
                <span style={{ color: d.deltaFacturacion >= 0 ? C.lime : C.tomato, display: 'inline-block', padding: '0 8px', background: d.deltaFacturacion >= 0 ? 'rgba(232,244,66,0.08)' : 'rgba(200,54,42,0.1)' }}>
                  {fmtPct(d.deltaFacturacion)}
                </span>{' '}vs periodo anterior.
              </div>
              <div style={{ fontSize: 18, color: C.textMuted, maxWidth: 800, lineHeight: 1.5 }}>
                Proyección de cierre <strong style={{ color: C.text, fontWeight: 600 }}>{fmtEur(d.proyeccionMes)}</strong>.
                Ticket medio {d.deltaTicket >= 0 ? 'sube' : 'cae'} {fmtPct(Math.abs(d.deltaTicket))} y margen está
                {' '}{d.deltaMargen >= 0 ? '+' : ''}{d.deltaMargen.toFixed(1)}pp {d.deltaMargen >= 0 ? 'sobre' : 'por debajo de'} objetivo.
              </div>
            </div>

            {/* KPIs */}
            <SectionLabel>Indicadores clave</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 56 }}>
              <KpiCard title="Facturación" value={fmtEur(d.facturacion)} delta={d.deltaFacturacion} sub={`vs ${fmtEur(d.facturacionAnt)}`} accent="lime" />
              <KpiCard title="Pedidos" value={fmtNum(d.pedidos)} delta={d.deltaPedidos} sub={`${pedidosDia} / día`} accent="default" />
              <KpiCard title="Ticket medio" value={fmtEur(d.ticketMedio, 2)} delta={d.deltaTicket} sub={`vs ${fmtEur(d.ticketAnt, 2)}`} accent="default" />
              <KpiCard title="Margen neto" value={`${d.margen.toFixed(1)}%`} delta={d.deltaMargen} deltaIsPP sub="objetivo 65%" accent="tomato" />
            </div>

            {/* ATENCIÓN */}
            <SectionLabel>Requiere tu atención</SectionLabel>
            <div style={{ background: C.surface, borderRadius: 16, overflow: 'hidden', marginBottom: 56 }}>
              <div style={{ padding: '20px 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumen del periodo</div>
              </div>
              <AlertRow marker={C.tomato} label="CUMPLIMIENTO" text={<>Estás al <strong>{d.cumplimiento.toFixed(0)}%</strong> del objetivo mensual de {fmtEur(d.objetivoMes)}</>} action="Objetivos →" last={false} />
              <AlertRow marker={C.lime} label="TICKET MEDIO" text={<>{d.deltaTicket < 0 ? 'Cae' : 'Sube'} <strong>{fmtPct(d.deltaTicket)}</strong> vs periodo anterior. Revisar combos.</>} action="Finanzas →" last={false} />
              <AlertRow marker={C.leaf} label="TIENDA ONLINE" text={<>Supone <strong>{tiendaPct.toFixed(1)}%</strong> del total. Objetivo: subirlo.</>} action="Detalle →" last={false} />
              <AlertRow marker={C.text} label="PROYECCIÓN" text={<>Cierre estimado en <strong>{fmtEur(d.proyeccionMes)}</strong> según ritmo actual</>} action="Proyección →" last={true} />
            </div>

            {/* PULSO */}
            <SectionLabel>Pulso del momento</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 56 }}>
              <div style={miniCard()}>
                <div style={miniLabel()}>Facturación 14 días</div>
                <div style={miniValue()}>{fmtEur(d.facturacion)}</div>
                <BarChart serie={d.serieDiaria} />
              </div>
              <div style={miniCard()}>
                <div style={miniLabel()}>Por canal · {periodoLabel}</div>
                <div style={miniValue()}>{fmtEur(d.canales.reduce((s, c) => s + c.bruto, 0))}</div>
                <div style={{ marginTop: 8 }}>
                  {d.canales.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '10px 0', borderBottom: i < d.canales.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: C.textMuted }}>{c.label}</span>
                        <strong style={{ fontVariantNumeric: 'tabular-nums', color: C.text }}>{fmtEur(c.bruto)}</strong>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(c.pct, 100)}%`, background: c.id === 'web' ? C.leaf : c.id === 'uber' ? C.lime : c.id === 'glovo' ? C.tomato : C.textMuted, borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Sub-componentes ─────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 700, color: C.lime, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20 }}>{children}</div>
}

function KpiCard({ title, value, delta, deltaIsPP, sub, accent }: {
  title: string; value: string; delta: number; deltaIsPP?: boolean; sub: string; accent: 'lime' | 'tomato' | 'default'
}) {
  const isUp = delta >= 0
  const borderColor = accent === 'lime' ? C.lime : accent === 'tomato' ? C.tomato : C.border
  const accentBg = accent === 'lime' ? 'rgba(232,244,66,0.04)' : accent === 'tomato' ? 'rgba(200,54,42,0.05)' : C.surface
  return (
    <div style={{ background: accentBg, border: `1px solid ${borderColor}`, borderRadius: 16, padding: '28px 26px', position: 'relative', overflow: 'hidden' }}>
      {accent !== 'default' && (
        <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: accent === 'lime' ? C.lime : C.tomato, opacity: 0.06, borderRadius: '0 16px 0 80px' }} />
      )}
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 16 }}>{title}</div>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 12, fontVariantNumeric: 'tabular-nums', color: C.text }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: C.textMuted }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', padding: '3px 10px', background: isUp ? 'rgba(122,143,92,0.18)' : 'rgba(200,54,42,0.18)', color: isUp ? C.leaf : C.tomato, fontWeight: 700, fontSize: 12, letterSpacing: '0.04em', borderRadius: 4, fontVariantNumeric: 'tabular-nums' }}>
          {isUp ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}{deltaIsPP ? 'pp' : '%'}
        </span>
        <span>{sub}</span>
      </div>
    </div>
  )
}

function AlertRow({ marker, label, text, action, last }: {
  marker: string; label: string; text: React.ReactNode; action: string; last: boolean
}) {
  return (
    <div style={{ padding: '20px 28px', borderBottom: last ? 'none' : `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ width: 4, height: 32, background: marker, borderRadius: 2, flexShrink: 0 }} />
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 700, color: marker, letterSpacing: '0.12em', minWidth: 130, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ flex: 1, fontSize: 14, color: C.text }}>{text}</div>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, color: C.lime, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{action}</div>
    </div>
  )
}

function BarChart({ serie }: { serie: { total: number; esPico: boolean }[] }) {
  const max = Math.max(...serie.map(s => s.total), 1)
  return (
    <div style={{ display: 'flex', gap: 5, height: 60, alignItems: 'flex-end', marginTop: 16 }}>
      {serie.map((s, i) => (
        <div key={i} style={{ flex: 1, height: `${Math.max((s.total / max) * 100, 4)}%`, background: s.esPico ? C.lime : 'rgba(255,255,255,0.16)', borderRadius: '3px 3px 0 0' }} />
      ))}
    </div>
  )
}

function miniCard(): React.CSSProperties {
  return { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px 26px' }
}
function miniLabel(): React.CSSProperties {
  return { fontFamily: 'Oswald, sans-serif', fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 8 }
}
function miniValue(): React.CSSProperties {
  return { fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', color: C.text, marginBottom: 8 }
}
