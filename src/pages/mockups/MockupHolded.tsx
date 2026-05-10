/**
 * Mockup 2 · HOLDED — SaaS español limpio con identidad morada #635BFF
 *
 * Estructura propia (no overlay):
 * - Headline ejecutivo
 * - 4 KPI cards con icon badges morados, badge de variación
 * - Panel "Requiere tu atención" con 4 alertas
 * - 3 mini-paneles: pulso 14d / canales con barras / próximos pagos
 *
 * Datos reales desde useMockupData() (Supabase facturacion_diario)
 */

import { useMockupData, fmtEur, fmtPct, fmtNum } from './useMockupData'

const COLORS = {
  bg: '#F4F6F8',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  text: '#1F2937',
  textMuted: '#6B7280',
  textSubtle: '#9CA3AF',
  brand: '#635BFF',
  brandLight: '#EFEDFD',
  brandDark: '#5247E0',
  up: '#10B981',
  upBg: '#D1FAE5',
  down: '#EF4444',
  downBg: '#FEE2E2',
  amber: '#F59E0B',
  amberBg: '#FEF3C7',
  green: '#10B981',
  greenBg: '#D1FAE5',
}

export default function MockupHolded() {
  const d = useMockupData()

  if (d.loading) {
    return <div style={{ padding: 40, background: COLORS.bg, minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: COLORS.textMuted }}>Cargando datos del Panel Global...</div>
  }

  const periodoTitle = `${d.periodoLabel.charAt(0).toUpperCase() + d.periodoLabel.slice(1)} · Día ${d.diaMes} de ${d.totalDiasMes}`

  return (
    <div style={{
      background: COLORS.bg,
      minHeight: '100vh',
      fontFamily: 'Inter, -apple-system, sans-serif',
      color: COLORS.text,
      fontSize: 14,
      lineHeight: 1.5,
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Banner identificador */}
      <div style={{
        background: COLORS.brandLight,
        color: COLORS.brand,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.06em',
        padding: '6px 28px',
        borderBottom: `1px solid ${COLORS.border}`,
        textTransform: 'uppercase',
      }}>
        🎨 Mockup 2 · Holded · SaaS español limpio
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 1320, margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 24, gap: 14,
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.02em' }}>Panel global</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>{periodoTitle}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnStyle()}>📅 Mes en curso ▾</button>
            <button style={btnStyle()}>🏷️ Marcas ▾</button>
            <button style={btnStyle(true)}>+ Exportar</button>
          </div>
        </div>

        {/* HEADLINE */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 22, fontWeight: 600, lineHeight: 1.4,
            letterSpacing: '-0.01em', marginBottom: 6, color: COLORS.text,
          }}>
            El negocio va <span style={{ color: d.deltaFacturacion >= 0 ? COLORS.up : COLORS.down }}>
              {fmtPct(d.deltaFacturacion)}
            </span> vs mes anterior.<br />
            Proyección cierre mes: <strong>{fmtEur(d.proyeccionMes)}</strong>.
          </div>
          <div style={{ fontSize: 14, color: COLORS.textMuted }}>
            Ticket medio {d.deltaTicket >= 0 ? 'sube' : 'cae'} {fmtPct(Math.abs(d.deltaTicket))} y margen está {d.deltaMargen >= 0 ? '+' : ''}{d.deltaMargen.toFixed(1)} pp {d.deltaMargen >= 0 ? 'sobre' : 'por debajo de'} objetivo.
          </div>
        </div>

        {/* SECCIÓN: KPIs */}
        <Section label="Resumen del mes">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <KpiCard
              title="Facturación"
              value={fmtEur(d.facturacion)}
              badge={fmtPct(d.deltaFacturacion)}
              badgeUp={d.deltaFacturacion >= 0}
              sub={`vs. ${fmtEur(d.facturacionAnt)}`}
              icon="€"
              iconColor="green"
            />
            <KpiCard
              title="Pedidos"
              value={fmtNum(d.pedidos)}
              badge={fmtPct(d.deltaPedidos)}
              badgeUp={d.deltaPedidos >= 0}
              sub={`${d.diaMes > 0 ? Math.round(d.pedidos / d.diaMes) : 0}/día`}
              icon="📦"
              iconColor="brand"
            />
            <KpiCard
              title="Ticket medio"
              value={fmtEur(d.ticketMedio, 2)}
              badge={fmtPct(d.deltaTicket)}
              badgeUp={d.deltaTicket >= 0}
              sub={`vs. ${fmtEur(d.ticketAnt, 2)}`}
              icon="📊"
              iconColor="amber"
            />
            <KpiCard
              title="Margen bruto"
              value={`${d.margen.toFixed(1)}%`}
              badge={`${d.deltaMargen >= 0 ? '+' : ''}${d.deltaMargen.toFixed(1)}pp`}
              badgeUp={d.deltaMargen >= 0}
              sub="obj. 65%"
              icon="📉"
              iconColor="amber"
            />
          </div>
        </Section>

        {/* SECCIÓN: Atención */}
        <Section label="Requiere tu atención">
          <div style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            <PanelHeader title="4 alertas activas" action="Ver todas" />
            <AlertRow marker={COLORS.down} text={<><b>Cumplimiento mensual</b> está al {d.cumplimiento.toFixed(0)}% del objetivo</>} to="Objetivos →" last={false} />
            <AlertRow marker={COLORS.amber} text={<>Ticket medio {d.deltaTicket < 0 ? 'cae' : 'sube'} <b>{fmtPct(d.deltaTicket)}</b> vs mes anterior</>} to="Finanzas →" last={false} />
            <AlertRow marker={COLORS.up} text={<>Tienda online supone <b>{d.canales.find(c => c.id === 'web')?.pct.toFixed(1) ?? '0'}%</b> del total</>} to="Detalle →" last={false} />
            <AlertRow marker={COLORS.brand} text={<><b>Proyección</b> indica cierre en {fmtEur(d.proyeccionMes)}</>} to="Proyección →" last={true} />
          </div>
        </Section>

        {/* SECCIÓN: Pulso */}
        <Section label="Pulso del momento">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

            {/* Mini 1: serie 14 días */}
            <div style={miniPanelStyle}>
              <div style={miniTitle}>Facturación 14 días</div>
              <div style={miniValue}>{fmtEur(d.facturacion)}</div>
              <BarChart serie={d.serieDiaria} />
            </div>

            {/* Mini 2: por canal */}
            <div style={miniPanelStyle}>
              <div style={miniTitle}>Por canal</div>
              <div style={miniValue}>{d.periodoLabel}</div>
              {d.canales.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0', borderBottom: i < d.canales.length - 1 ? `1px solid #F3F4F6` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: COLORS.textMuted }}>{c.label}</span>
                    <strong style={{ fontVariantNumeric: 'tabular-nums', color: COLORS.text }}>{fmtEur(c.bruto)}</strong>
                  </div>
                  <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(c.pct, 100)}%`,
                      background: c.id === 'web' ? COLORS.green : COLORS.brand,
                      borderRadius: 2,
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Mini 3: próximos pagos (placeholder hasta tener datos) */}
            <div style={miniPanelStyle}>
              <div style={miniTitle}>Próximos pagos</div>
              <div style={miniValue}>{fmtEur(4380)}</div>
              <PayRow label="Mercadona" date="12 mayo" />
              <PayRow label="Makro" date="15 mayo" />
              <PayRow label="Alquiler" date="1 junio" />
              <PayRow label="Rushour" date="5 junio" last />
            </div>
          </div>
        </Section>

      </div>
    </div>
  )
}

/* ── Sub-componentes ─────────────────────────────────── */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: COLORS.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
      }}>{label}</div>
      {children}
    </div>
  )
}

function KpiCard({ title, value, badge, badgeUp, sub, icon, iconColor }: {
  title: string
  value: string
  badge: string
  badgeUp: boolean
  sub: string
  icon: string
  iconColor: 'green' | 'brand' | 'amber' | 'red'
}) {
  const iconBg = {
    green: COLORS.greenBg,
    brand: COLORS.brandLight,
    amber: COLORS.amberBg,
    red: COLORS.downBg,
  }[iconColor]
  const iconTone = {
    green: COLORS.green,
    brand: COLORS.brand,
    amber: COLORS.amber,
    red: COLORS.down,
  }[iconColor]
  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 12,
      padding: '20px 22px',
      transition: 'border-color 0.15s',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, fontSize: 13, color: COLORS.textMuted, fontWeight: 500,
      }}>
        <span>{title}</span>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: iconBg,
          color: iconTone, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700,
        }}>{icon}</div>
      </div>
      <div style={{
        fontSize: 30, fontWeight: 700, color: COLORS.text,
        letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 8,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div style={{ fontSize: 13, color: COLORS.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          background: badgeUp ? COLORS.upBg : COLORS.downBg,
          color: badgeUp ? '#047857' : '#B91C1C',
        }}>{badgeUp ? '↑' : '↓'} {badge.replace(/[+\-]/g, '').replace('%', '')}{badge.includes('%') ? '%' : badge.includes('pp') ? 'pp' : ''}</span>
        <span>{sub}</span>
      </div>
    </div>
  )
}

function PanelHeader({ title, action }: { title: string; action: string }) {
  return (
    <div style={{
      padding: '16px 22px', borderBottom: `1px solid #F3F4F6`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>{title}</div>
      <button style={btnStyle(false, 28, 12)}>{action}</button>
    </div>
  )
}

function AlertRow({ marker, text, to, last }: { marker: string; text: React.ReactNode; to: string; last: boolean }) {
  return (
    <div style={{
      padding: '14px 22px',
      borderBottom: last ? 'none' : `1px solid #F3F4F6`,
      display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: marker, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 14, color: '#374151' }}>{text}</div>
      <div style={{ fontSize: 13, color: COLORS.brand, fontWeight: 500 }}>{to}</div>
    </div>
  )
}

function BarChart({ serie }: { serie: { total: number; esPico: boolean }[] }) {
  const max = Math.max(...serie.map(s => s.total), 1)
  return (
    <div style={{ display: 'flex', gap: 4, height: 40, alignItems: 'flex-end' }}>
      {serie.map((s, i) => (
        <div key={i} style={{
          flex: 1,
          height: `${Math.max((s.total / max) * 100, 4)}%`,
          background: s.esPico ? COLORS.brand : '#E5E7EB',
          borderRadius: '3px 3px 0 0',
        }} />
      ))}
    </div>
  )
}

function PayRow({ label, date, last }: { label: string; date: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 13, padding: '8px 0',
      borderBottom: last ? 'none' : `1px solid #F3F4F6`,
    }}>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <strong style={{ color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>{date}</strong>
    </div>
  )
}

const miniPanelStyle: React.CSSProperties = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: '20px 22px',
}

const miniTitle: React.CSSProperties = {
  fontSize: 13, color: COLORS.textMuted, marginBottom: 6, fontWeight: 500,
}

const miniValue: React.CSSProperties = {
  fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
  marginBottom: 18, color: COLORS.text,
}

function btnStyle(primary = false, height = 36, fontSize = 13): React.CSSProperties {
  return {
    height,
    padding: '0 14px',
    border: `1px solid ${primary ? COLORS.brand : COLORS.border}`,
    borderRadius: 8,
    background: primary ? COLORS.brand : COLORS.surface,
    fontSize,
    color: primary ? '#FFFFFF' : '#4B5563',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  }
}
