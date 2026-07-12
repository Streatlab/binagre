/**
 * uiSL — primitivas visuales del skin SL (Ley Visual SL v1).
 * Escritas desde cero: no heredan nada de neobrutal.ts ni de tablaNeo.ts.
 */
import type { CSSProperties, ReactNode } from 'react'

/* ── Tokens (leen las variables CSS de .sl-skin) ── */
export const C = {
  rojo: 'var(--slx-rojo)',
  rojoDeep: 'var(--slx-rojo-deep)',
  naranja: 'var(--slx-naranja)',
  amarillo: 'var(--slx-amarillo)',
  ink: 'var(--slx-ink)',
  canvas: 'var(--slx-canvas)',
  card: 'var(--slx-card)',
  line: 'var(--slx-line)',
  gris: 'var(--slx-gris)',
  grisCl: 'var(--slx-gris-cl)',
  track: 'var(--slx-track)',
  verde: 'var(--slx-verde)',
  verdeSoft: 'var(--slx-verde-soft)',
  rojoSem: 'var(--slx-rojo-sem)',
  rojoSoft: 'var(--slx-rojo-soft)',
  ambar: 'var(--slx-ambar)',
  ambarSoft: 'var(--slx-ambar-soft)',
  blu: 'var(--slx-blu)',
  bluSoft: 'var(--slx-blu-soft)',
  shadow: 'var(--slx-shadow)',
} as const

/* ── Formato de cifras ── */
export const eur0 = (n: number) =>
  `${Math.round(n).toLocaleString('es-ES')} €`
export const eur2 = (n: number) =>
  `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
export const num0 = (n: number) => Math.round(n).toLocaleString('es-ES')
export const pct1 = (n: number) =>
  `${n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
export const delta = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '▲' : '▼'} ${Math.abs(n).toFixed(1)}%`

/* ── Número mono ── */
export function Num({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span className="slnum" style={style}>{children}</span>
}

/* ── Card ── */
export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.line}`, borderRadius: 18,
      padding: 18, boxShadow: C.shadow, marginBottom: 16, ...style,
    }}>{children}</div>
  )
}

/* ── Cabecera de card ── */
export function CardHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.2px' }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: C.grisCl, fontWeight: 700, marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  )
}

/* ── Píldora semántica ── */
export type Tone = 'verde' | 'rojo' | 'ambar' | 'blu' | 'neutro'
const TONES: Record<Tone, { c: string; bg: string }> = {
  verde:  { c: C.verde,   bg: C.verdeSoft },
  rojo:   { c: C.rojoSem, bg: C.rojoSoft },
  ambar:  { c: C.ambar,   bg: C.ambarSoft },
  blu:    { c: C.blu,     bg: C.bluSoft },
  neutro: { c: C.gris,    bg: C.track },
}
export function Pill({ tone = 'neutro', dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  const t = TONES[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px',
      borderRadius: 999, fontSize: 11, fontWeight: 800, color: t.c, background: t.bg,
      whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: t.c, display: 'inline-block' }} />}
      {children}
    </span>
  )
}

/* ── Hero (degradado llama) ── */
export function Hero({ eyebrow, titular, valor, sub, right }: {
  eyebrow: string; titular: string; valor: string; sub?: string; right?: ReactNode
}) {
  return (
    <section style={{
      background: `linear-gradient(115deg, ${C.rojoDeep}, ${C.rojo} 45%, ${C.naranja})`,
      borderRadius: 22, padding: '26px 28px', color: '#fff', marginBottom: 16,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      gap: 24, flexWrap: 'wrap', boxShadow: C.shadow,
    }}>
      <div style={{ minWidth: 260 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1.4px', opacity: 0.85 }}>{eyebrow}</div>
        <div style={{ fontSize: 19, fontWeight: 900, margin: '6px 0 12px' }}>{titular}</div>
        <div className="slnum" style={{ fontSize: 'clamp(30px,4.4vw,42px)', lineHeight: 1 }}>{valor}</div>
        {sub && <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 700, marginTop: 8 }}>{sub}</div>}
      </div>
      {right && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>{right}</div>
      )}
    </section>
  )
}

/** Píldora blanca sobre el hero. */
export function HeroPill({ children }: { children: ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fff',
      color: '#951218', padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

/* ── KPI ── */
export function Kpi({ icono, tono = 'neutro', label, valor, pie }: {
  icono: string; tono?: Tone; label: string; valor: string; pie?: ReactNode
}) {
  const t = TONES[tono]
  return (
    <Card style={{ marginBottom: 0 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center',
        fontSize: 15, fontWeight: 900, marginBottom: 12, background: t.bg, color: t.c,
      }}>{icono}</div>
      <div style={{ fontSize: 11, color: C.grisCl, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{label}</div>
      <div className="slnum" style={{ fontSize: 28, margin: '4px 0 10px' }}>{valor}</div>
      {pie}
    </Card>
  )
}

/* ── Rejilla de KPIs ── */
export function KpiGrid({ children, cols = 4 }: { children: ReactNode; cols?: number }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
      gap: 14, marginBottom: 16,
    }}>{children}</div>
  )
}

/* ── Barra de progreso / peso ── */
export function Bar({ label, valor, pct, color }: { label: string; valor: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, marginBottom: 6, gap: 8 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span className="slnum" style={{ color: C.gris, flexShrink: 0 }}>{valor}</span>
      </div>
      <div style={{ height: 10, background: C.track, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRadius: 6 }} />
      </div>
    </div>
  )
}

/* ── Nota / insight ── */
export function Nota({ tono = 'verde', children }: { tono?: Tone; children: ReactNode }) {
  const t = TONES[tono]
  return (
    <div style={{
      marginTop: 16, padding: 12, borderRadius: 12, fontSize: 12, fontWeight: 800,
      background: t.bg, color: t.c, lineHeight: 1.45,
    }}>{children}</div>
  )
}

/* ── Estado vacío ── */
export function Vacio({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: C.grisCl, fontSize: 13, fontWeight: 700 }}>{children}</div>
  )
}

/* ── Gráfico de línea con área (SVG puro, sin dependencias) ── */
export function LineaArea({ puntos, etiquetas, alto = 190, color = C.rojo, fmt = num0 }: {
  puntos: number[]; etiquetas: string[]; alto?: number; color?: string; fmt?: (n: number) => string
}) {
  if (puntos.length === 0) return <Vacio>Sin datos en el periodo.</Vacio>
  const W = 620, H = alto, P = { l: 8, r: 8, t: 14, b: 8 }
  const max = Math.max(...puntos, 1) * 1.12
  const min = Math.min(...puntos, 0)
  const ix = W - P.l - P.r, iy = H - P.t - P.b
  const X = (i: number) => P.l + (puntos.length <= 1 ? ix / 2 : (ix * i) / (puntos.length - 1))
  const Y = (v: number) => P.t + iy * (1 - (v - min) / (max - min || 1))
  const linea = puntos.map((v, i) => `${X(i)},${Y(v)}`).join(' ')
  const area = `${X(0)},${H - P.b} ${linea} ${X(puntos.length - 1)},${H - P.b}`
  const ultimo = puntos[puntos.length - 1]
  const gid = `slgrad${Math.round(max)}`
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: alto, overflow: 'visible' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gid})`} />
        <polyline points={linea} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={X(puntos.length - 1)} cy={Y(ultimo)} r={5.5} fill={C.card} stroke={color} strokeWidth={3} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.grisCl, marginTop: 6 }}>
        {etiquetas.map((e, i) => <span key={i} className="slnum" style={{ fontWeight: 500 }}>{e}</span>)}
      </div>
      <div style={{ fontSize: 11, color: C.grisCl, fontWeight: 700, marginTop: 4 }}>
        Máximo del periodo: <span className="slnum">{fmt(Math.max(...puntos))}</span>
      </div>
    </div>
  )
}

/* ── Gráfico de barras verticales ── */
export function Barras({ datos, alto = 200, fmt = num0 }: {
  datos: Array<{ label: string; valor: number; color?: string }>
  alto?: number
  fmt?: (n: number) => string
}) {
  if (datos.length === 0) return <Vacio>Sin datos.</Vacio>
  const max = Math.max(...datos.map(x => x.valor), 1)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: alto, padding: '0 2px' }}>
        {datos.map((x, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6, height: '100%' }}>
            <span className="slnum" style={{ fontSize: 10, color: C.gris }}>{fmt(x.valor)}</span>
            <div style={{
              width: '100%', maxWidth: 46, borderRadius: '8px 8px 4px 4px',
              height: `${Math.max(2, (x.valor / max) * (alto - 34))}px`,
              background: x.color ?? C.rojo,
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {datos.map((x, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 800, color: C.grisCl, textTransform: 'uppercase' }}>{x.label}</div>
        ))}
      </div>
    </div>
  )
}

/* ── Colores de canal (marca) ── */
export const CANAL_COLOR: Record<string, string> = {
  uber: '#06C167', glovo: C.amarillo, je: C.naranja, web: C.rojo, dir: C.blu,
}
export const CANAL_LABEL: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat', web: 'Web', dir: 'Directa',
}
