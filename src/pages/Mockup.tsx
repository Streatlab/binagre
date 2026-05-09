/**
 * Mockup — Versión visual estática del Panel Global
 * Estilo: Binagre nativo + Posthog (sombras duras, bordes 2px, neobrutalismo)
 * Datos hardcodeados de demo. Solo para evaluación visual.
 */

export default function Mockup() {
  return (
    <div style={{
      background: '#f5f3ef',
      minHeight: '100vh',
      padding: '32px',
      fontFamily: 'Lexend, Inter, -apple-system, sans-serif',
      color: '#0a0a0a',
      fontSize: 14,
      lineHeight: 1.5,
    }}>
      {/* HEADER */}
      <div style={{
        height: 60,
        background: '#f5f3ef',
        borderBottom: '2px solid #0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32,
        marginLeft: -32,
        marginRight: -32,
        marginTop: -32,
        padding: '0 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: 22,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}>Mockup</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Mayo 2026 · Día 9 de 31</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnStyle()}>Mes en curso</button>
          <button style={btnStyle()}>Marcas</button>
          <button style={btnStyle(true)}>Exportar</button>
        </div>
      </div>

      {/* HEADLINE */}
      <section style={{ marginBottom: 32 }}>
        <div style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: '0.005em',
          marginBottom: 8,
          textTransform: 'uppercase',
        }}>
          El negocio va <span style={{ color: '#1D9E75' }}>+18%</span> vs abril<br />
          Proyección cierre mes: 38.200 €
        </div>
        <div style={{ fontSize: 15, color: '#4b5563', maxWidth: 720 }}>
          Ticket medio cae 4,7% y margen está 2,6 pp por debajo de objetivo. Tienda online sigue creciendo y Think Paladar va a buen ritmo.
        </div>
      </section>

      {/* KPIs */}
      <section style={{ marginBottom: 32 }}>
        <div style={labelStyle}>Resumen del mes</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KpiCard
            title="Facturación"
            value="28.450 €"
            badge="+18%"
            badgeUp
            sub="vs abril"
            shadow="#B01D23"
          />
          <KpiCard
            title="Pedidos"
            value="1.842"
            badge="+9%"
            badgeUp
            sub="61/día"
            shadow="#0a0a0a"
          />
          <KpiCard
            title="Ticket medio"
            value="15,44 €"
            badge="−4,7%"
            sub="vs abril"
            shadow="#e8f442"
          />
          <KpiCard
            title="Margen bruto"
            value="62,4%"
            badge="−2,6pp"
            sub="obj. 65%"
            shadow="#1e2233"
          />
        </div>
      </section>

      {/* ATENCIÓN */}
      <section style={{ marginBottom: 32 }}>
        <div style={labelStyle}>
          Requiere tu atención
          <span style={tagStyle}>4 alertas</span>
        </div>
        <div style={panelStyle}>
          <Row marker="#B01D23" text={<><b>3 facturas</b> pendientes de matching</>} action="Conciliación →" />
          <Row marker="#e8f442" text={<>Ticket medio Glovo cae a <b>13,80 €</b> · revisar combos</>} action="Finanzas →" />
          <Row marker="#1D9E75" text={<>Tienda online ya supone <b>18%</b> del total (+5pp)</>} action="Detalle →" />
          <Row marker="#1e2233" text={<><b>Think Paladar</b>: KPI mes 2 alcanzado al 87%</>} action="Marketing →" last />
        </div>
      </section>

      {/* PULSO */}
      <section>
        <div style={labelStyle}>Pulso del momento</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          {/* Bars */}
          <div style={miniStyle}>
            <div style={miniTitleStyle}>Facturación 14 días</div>
            <div style={miniValueStyle}>28.450 €</div>
            <div style={{ display: 'flex', gap: 4, height: 40, alignItems: 'flex-end' }}>
              {[
                { h: 45 }, { h: 62 }, { h: 58 }, { h: 71 }, { h: 68 },
                { h: 80, c: '#1e2233' }, { h: 92, c: '#B01D23' },
                { h: 55 }, { h: 64 }, { h: 70 },
                { h: 82, c: '#1e2233' }, { h: 88, c: '#B01D23' },
                { h: 95, c: '#e8f442' }, { h: 100 },
              ].map((b, i) => (
                <div key={i} style={{
                  flex: 1,
                  height: `${b.h}%`,
                  background: b.c || '#f0ede5',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '2px 2px 0 0',
                }} />
              ))}
            </div>
          </div>

          {/* Por canal */}
          <div style={miniStyle}>
            <div style={miniTitleStyle}>Por canal</div>
            <div style={miniValueStyle}>Mes en curso</div>
            <DistRow label="Uber Eats" value="12.420 €" />
            <DistRow label="Glovo" value="8.180 €" />
            <DistRow label="Just Eat" value="2.700 €" />
            <DistRow label="Tienda online" value="5.150 €" last />
          </div>

          {/* Próximos pagos */}
          <div style={miniStyle}>
            <div style={miniTitleStyle}>Próximos pagos</div>
            <div style={miniValueStyle}>4.380 €</div>
            <DistRow label="Mercadona" value="12 mayo" />
            <DistRow label="Makro" value="15 mayo" />
            <DistRow label="Alquiler" value="1 junio" />
            <DistRow label="Rushour" value="5 junio" last />
          </div>
        </div>
      </section>
    </div>
  )
}

/* ── Sub-componentes ─────────────────────────────────── */

function KpiCard({ title, value, badge, sub, badgeUp, shadow }: {
  title: string
  value: string
  badge: string
  sub: string
  badgeUp?: boolean
  shadow: string
}) {
  return (
    <div style={{
      background: '#fff',
      border: '2px solid #0a0a0a',
      borderRadius: 8,
      padding: '18px 20px',
      boxShadow: `3px 3px 0 ${shadow}`,
    }}>
      <div style={kpiTitleStyle}>{title}</div>
      <div style={kpiValueStyle}>{value}</div>
      <div style={{ fontSize: 12, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          border: '1.5px solid #0a0a0a',
          background: badgeUp ? '#d4f4e2' : '#fde0e2',
          color: badgeUp ? '#0a0a0a' : '#B01D23',
        }}>{badge}</span>
        <span>{sub}</span>
      </div>
    </div>
  )
}

function Row({ marker, text, action, last }: {
  marker: string
  text: React.ReactNode
  action: string
  last?: boolean
}) {
  return (
    <div style={{
      padding: '16px 22px',
      borderBottom: last ? 'none' : '1px solid #e8e4dc',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      cursor: 'pointer',
    }}>
      <div style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: marker,
        border: '2px solid #0a0a0a',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, fontSize: 14, color: '#374151' }}>{text}</div>
      <div style={{
        fontSize: 13,
        color: '#B01D23',
        fontWeight: 600,
        fontFamily: 'Oswald, sans-serif',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>{action}</div>
    </div>
  )
}

function DistRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      padding: '7px 0',
      borderBottom: last ? 'none' : '1px dashed #e8e4dc',
    }}>
      <span style={{ color: '#4b5563' }}>{label}</span>
      <b style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#0a0a0a' }}>{value}</b>
    </div>
  )
}

/* ── Estilos compartidos ─────────────────────────────── */

const labelStyle: React.CSSProperties = {
  fontFamily: 'Oswald, sans-serif',
  fontSize: 12,
  fontWeight: 700,
  color: '#0a0a0a',
  marginBottom: 14,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const tagStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 700,
  fontFamily: 'Oswald, sans-serif',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  background: '#e8f442',
  color: '#0a0a0a',
  border: '1.5px solid #0a0a0a',
}

const panelStyle: React.CSSProperties = {
  background: '#fff',
  border: '2px solid #0a0a0a',
  borderRadius: 8,
  boxShadow: '3px 3px 0 #0a0a0a',
  overflow: 'hidden',
}

const kpiTitleStyle: React.CSSProperties = {
  fontFamily: 'Oswald, sans-serif',
  fontSize: 11,
  color: '#4b5563',
  marginBottom: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
}

const kpiValueStyle: React.CSSProperties = {
  fontFamily: 'Oswald, sans-serif',
  fontSize: 32,
  fontWeight: 700,
  letterSpacing: '0.005em',
  lineHeight: 1,
  marginBottom: 10,
  fontVariantNumeric: 'tabular-nums',
  color: '#0a0a0a',
}

const miniStyle: React.CSSProperties = {
  background: '#fff',
  border: '2px solid #0a0a0a',
  borderRadius: 8,
  padding: '18px 20px',
  boxShadow: '3px 3px 0 #0a0a0a',
}

const miniTitleStyle: React.CSSProperties = {
  fontFamily: 'Oswald, sans-serif',
  fontSize: 11,
  color: '#4b5563',
  marginBottom: 6,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
}

const miniValueStyle: React.CSSProperties = {
  fontFamily: 'Oswald, sans-serif',
  fontSize: 24,
  fontWeight: 700,
  letterSpacing: '0.005em',
  marginBottom: 16,
}

function btnStyle(primary = false): React.CSSProperties {
  return {
    height: 36,
    padding: '0 14px',
    border: '2px solid #0a0a0a',
    borderRadius: 6,
    background: primary ? '#1e2233' : '#fff',
    fontSize: 13,
    color: primary ? '#fff' : '#0a0a0a',
    cursor: 'pointer',
    fontFamily: 'Lexend, sans-serif',
    fontWeight: 600,
    boxShadow: primary ? '2px 2px 0 #B01D23' : '2px 2px 0 #0a0a0a',
  }
}
