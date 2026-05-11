/**
 * Mockup 10 · Estilo LYMON + ROJO BINAGRE
 *
 * Clon exacto del MockupLymon pero con el rojo Binagre #B01D23 metido
 * como acento principal junto al lima y el tomate.
 *
 * Estilo:
 * - Fondo oscuro #2d2d2e
 * - Amarillo lima #e8f442 como acento secundario
 * - Rojo Binagre #B01D23 como acento principal de marca
 * - Tomate vintage #C8362A para alertas
 * - Titulares Oswald muy bold mayúsculas
 *
 * Datos reales desde useMockupData() (Supabase facturacion_diario)
 */

import { useMockupData, fmtEur, fmtPct, fmtNum } from './useMockupData'

const C = {
  bg: '#2d2d2e',
  surface: '#3a3a3c',
  surfaceLight: '#454547',
  border: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  textMuted: '#a8a8aa',
  textSubtle: '#6c6c6e',
  // Acentos
  lime: '#e8f442',
  limeDark: '#c4cf2e',
  redSL: '#B01D23',
  redSLDark: '#8E1219',
  tomato: '#C8362A',
  tomatoDark: '#A82A20',
  cream: '#F5EFE6',
  leaf: '#7A8F5C',
  // Estados
  up: '#7A8F5C',
  down: '#B01D23',
}

export default function MockupLymonBinagre() {
  const d = useMockupData()

  if (d.loading) {
    return (
      <div style={{
        padding: 40, background: C.bg, minHeight: '100vh',
        fontFamily: 'Inter, sans-serif', color: C.textMuted,
      }}>
        Cargando datos del Panel Global...
      </div>
    )
  }

  const periodoTitle = `${d.periodoLabel.toUpperCase()} · DÍA ${d.diaMes} DE ${d.totalDiasMes}`
  const pedidosDia = d.diaMes > 0 ? Math.round(d.pedidos / d.diaMes) : 0

  return (
    <div style={{
      background: C.bg,
      minHeight: '100vh',
      fontFamily: 'Inter, -apple-system, sans-serif',
      color: C.text,
      fontSize: 14,
      lineHeight: 1.5,
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Banner identificador con rojo Binagre */}
      <div style={{
        background: C.redSL,
        color: C.lime,
        fontFamily: 'Oswald, sans-serif',
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.1em',
        padding: '8px 32px',
        textTransform: 'uppercase',
        borderBottom: `2px solid ${C.bg}`,
      }}>
        🍅 Mockup 10 · Lymon + Rojo Binagre · oscuro + lima + rojo SL
      </div>

      <div style={{ padding: '32px 40px', maxWidth: 1320, margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 48, gap: 20,
        }}>
          <div>
            <div style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: 12, fontWeight: 600,
              color: C.lime, letterSpacing: '0.15em',
              textTransform: 'uppercase', marginBottom: 8,
            }}>{periodoTitle}</div>
            <div style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: 42, fontWeight: 700,
              letterSpacing: '-0.01em', lineHeight: 1.05,
              textTransform: 'uppercase',
            }}>
              Panel <span style={{ color: C.redSL }}>Global</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btn()}>Mes en curso</button>
            <button style={btn()}>Marcas</button>
            <button style={btn('redSL')}>Exportar</button>
          </div>
        </div>

        {/* HERO HEADLINE */}
        <div style={{
          marginBottom: 56,
          padding: '40px 0 36px',
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            left: -40, top: '40%',
            width: 6, height: 80,
            background: C.redSL,
            borderRadius: '0 3px 3px 0',
          }} />

          <div style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: 56, fontWeight: 700,
            lineHeight: 1.08, letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}>
            EL NEGOCIO VA{' '}
            <span style={{
              color: d.deltaFacturacion >= 0 ? C.lime : C.redSL,
              display: 'inline-block',
              padding: '0 8px',
              background: d.deltaFacturacion >= 0 ? 'rgba(232,244,66,0.08)' : 'rgba(176,29,35,0.12)',
            }}>{fmtPct(d.deltaFacturacion)}</span>
            {' '}vs mes anterior.
          </div>
          <div style={{
            fontSize: 18, color: C.textMuted,
            maxWidth: 800, lineHeight: 1.5,
          }}>
            Proyección de cierre <strong style={{ color: C.text, fontWeight: 600 }}>{fmtEur(d.proyeccionMes)}</strong>.
            Ticket medio {d.deltaTicket >= 0 ? 'sube' : 'cae'} {fmtPct(Math.abs(d.deltaTicket))} y margen está
            {' '}{d.deltaMargen >= 0 ? '+' : ''}{d.deltaMargen.toFixed(1)}pp {d.deltaMargen >= 0 ? 'sobre' : 'por debajo de'} objetivo.
          </div>
        </div>

        {/* KPIs */}
        <SectionLabel>Indicadores clave</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 56 }}>
          <KpiCard title="Facturación" value={fmtEur(d.facturacion)} delta={d.deltaFacturacion} sub={`vs ${fmtEur(d.facturacionAnt)}`} accent="redSL" />
          <KpiCard title="Pedidos" value={fmtNum(d.pedidos)} delta={d.deltaPedidos} sub={`${pedidosDia} / día`} accent="lime" />
          <KpiCard title="Ticket medio" value={fmtEur(d.ticketMedio, 2)} delta={d.deltaTicket} sub={`vs ${fmtEur(d.ticketAnt, 2)}`} accent="default" />
          <KpiCard title="Margen bruto" value={`${d.margen.toFixed(1)}%`} delta={d.deltaMargen} deltaIsPP sub="objetivo 65%" accent="tomato" />
        </div>

        {/* ATENCIÓN */}
        <SectionLabel>Requiere tu atención</SectionLabel>
        <div style={{
          background: C.surface, borderRadius: 16, overflow: 'hidden',
          marginBottom: 56, borderLeft: `4px solid ${C.redSL}`,
        }}>
          <div style={{
            padding: '20px 28px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{
                background: C.redSL, color: C.text, padding: '4px 10px', borderRadius: 4,
                fontSize: 14, fontFamily: 'Oswald, sans-serif', fontWeight: 700, letterSpacing: '0.08em',
              }}>4</span>
              Alertas activas
            </div>
            <button style={btn(false, 32, 12)}>Ver todas</button>
          </div>
          <AlertRow marker={C.redSL} label="CUMPLIMIENTO" text={<>Estás al <strong>{d.cumplimiento.toFixed(0)}%</strong> del objetivo mensual de {fmtEur(d.objetivoMes)}</>} action="Objetivos →" last={false} />
          <AlertRow marker={C.lime} label="TICKET MEDIO" text={<>{d.deltaTicket < 0 ? 'Cae' : 'Sube'} <strong>{fmtPct(d.deltaTicket)}</strong> vs mes anterior. Revisar combos.</>} action="Finanzas →" last={false} />
          <AlertRow marker={C.leaf} label="TIENDA ONLINE" text={<>Supone <strong>{(d.canales.find(c => c.id === 'web')?.pct ?? 0).toFixed(1)}%</strong> del total. Tendencia al alza.</>} action="Detalle →" last={false} />
          <AlertRow marker={C.tomato} label="PROYECCIÓN" text={<>Cierre estimado en <strong>{fmtEur(d.proyeccionMes)}</strong> según ritmo actual</>} action="Proyección →" last={true} />
        </div>

        {/* PULSO */}
        <SectionLabel>Pulso del momento</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 16, marginBottom: 56 }}>

          <div style={miniCard('redSL')}>
            <div style={miniLabel()}>Facturación 14 días</div>
            <div style={miniValue()}>{fmtEur(d.facturacion)}</div>
            <BarChart serie={d.serieDiaria} />
          </div>

          <div style={miniCard()}>
            <div style={miniLabel()}>Por canal · {d.periodoLabel}</div>
            <div style={miniValue()}>{fmtEur(d.canales.reduce((s, c) => s + c.bruto, 0))}</div>
            <div style={{ marginTop: 8 }}>
              {d.canales.map((c, i) => (
                <div key={c.id} style={{
                  display: 'flex', flexDirection: 'column', gap: 5,
                  padding: '10px 0',
                  borderBottom: i < d.canales.length - 1 ? `1px solid ${C.border}` : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: C.textMuted }}>{c.label}</span>
                    <strong style={{ fontVariantNumeric: 'tabular-nums', color: C.text }}>{fmtEur(c.bruto)}</strong>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(c.pct, 100)}%`,
                      background: c.id === 'web' ? C.leaf : c.id === 'uber' ? C.redSL : c.id === 'glovo' ? C.lime : C.tomato,
                      borderRadius: 2,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={miniCard()}>
            <div style={miniLabel()}>Próximos pagos</div>
            <div style={miniValue()}>{fmtEur(4380)}</div>
            <PayRow label="Mercadona" date="12 mayo" urgent />
            <PayRow label="Makro" date="15 mayo" urgent />
            <PayRow label="Alquiler" date="1 junio" />
            <PayRow label="Rushour" date="5 junio" last />
          </div>
        </div>

      </div>
    </div>
  )
}

/* ─── Sub-componentes ─────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 700,
      color: C.lime, letterSpacing: '0.15em',
      textTransform: 'uppercase', marginBottom: 20,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ width: 24, height: 2, background: C.redSL }} />
      {children}
    </div>
  )
}

function KpiCard({ title, value, delta, deltaIsPP, sub, accent }: {
  title: string; value: string; delta: number; deltaIsPP?: boolean; sub: string
  accent: 'redSL' | 'lime' | 'tomato' | 'default'
}) {
  const isUp = delta >= 0
  const accentColor = accent === 'redSL' ? C.redSL : accent === 'lime' ? C.lime : accent === 'tomato' ? C.tomato : null
  const borderColor = accentColor ?? C.border
  const accentBg = accent === 'redSL' ? 'rgba(176,29,35,0.06)' : accent === 'lime' ? 'rgba(232,244,66,0.04)' : accent === 'tomato' ? 'rgba(200,54,42,0.05)' : C.surface
  return (
    <div style={{ background: accentBg, border: `1px solid ${borderColor}`, borderRadius: 16, padding: '28px 26px', position: 'relative', overflow: 'hidden' }}>
      {accentColor && <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: accentColor, opacity: 0.08, borderRadius: '0 16px 0 80px' }} />}
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 16 }}>{title}</div>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 12, fontVariantNumeric: 'tabular-nums', color: C.text }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: C.textMuted }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', padding: '3px 10px', background: isUp ? 'rgba(122,143,92,0.18)' : 'rgba(176,29,35,0.2)', color: isUp ? C.leaf : C.redSL, fontWeight: 700, fontSize: 12, letterSpacing: '0.04em', borderRadius: 4, fontVariantNumeric: 'tabular-nums' }}>
          {isUp ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}{deltaIsPP ? 'pp' : '%'}
        </span>
        <span>{sub}</span>
      </div>
    </div>
  )
}

function AlertRow({ marker, label, text, action, last }: { marker: string; label: string; text: React.ReactNode; action: string; last: boolean }) {
  return (
    <div style={{ padding: '20px 28px', borderBottom: last ? 'none' : `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 18, cursor: 'pointer' }}>
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
        <div key={i} style={{ flex: 1, height: `${Math.max((s.total / max) * 100, 4)}%`, background: s.esPico ? C.redSL : 'rgba(255,255,255,0.16)', borderRadius: '3px 3px 0 0' }} />
      ))}
    </div>
  )
}

function PayRow({ label, date, urgent, last }: { label: string; date: string; urgent?: boolean; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '10px 0', borderBottom: last ? 'none' : `1px solid ${C.border}` }}>
      <span style={{ color: C.textMuted }}>{label}</span>
      <strong style={{
        fontVariantNumeric: 'tabular-nums',
        padding: '2px 8px',
        background: urgent ? 'rgba(176,29,35,0.2)' : 'transparent',
        color: urgent ? '#ffb3b3' : C.text,
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 700,
      }}>{date}</strong>
    </div>
  )
}

function miniCard(accent?: 'redSL'): React.CSSProperties {
  return {
    background: C.surface,
    border: `1px solid ${accent === 'redSL' ? C.redSL : C.border}`,
    borderRadius: 16,
    padding: '24px 26px',
    boxShadow: accent === 'redSL' ? `0 0 0 4px rgba(176,29,35,0.08)` : 'none',
  }
}

function miniLabel(): React.CSSProperties {
  return { fontFamily: 'Oswald, sans-serif', fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 8 }
}

function miniValue(): React.CSSProperties {
  return { fontFamily: 'Oswald, sans-serif', fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', color: C.text, marginBottom: 8 }
}

function btn(variant: 'redSL' | false = false, height = 40, fontSize = 12): React.CSSProperties {
  const isPrimary = variant === 'redSL'
  return {
    height, padding: '0 18px',
    border: `1px solid ${isPrimary ? C.redSL : C.border}`,
    borderRadius: 8,
    background: isPrimary ? C.redSL : 'transparent',
    fontSize,
    color: C.text,
    cursor: 'pointer',
    fontFamily: 'Oswald, sans-serif',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    transition: 'all 0.15s',
  }
}
