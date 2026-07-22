import { BLANCO, VERDE } from '@/styles/neobrutal'
/**
 * uiSL — primitivas visuales del skin SL (Ley Visual SL v2).
 * Escritas desde cero: no heredan nada de neobrutal.ts ni de tablaNeo.ts.
 *
 * v2 (jul-26) — todo lo nuevo es ADITIVO: las props añadidas son opcionales,
 * así que ningún componente que ya use la v1 se rompe.
 *   1. Hero  → anillo de progreso a objetivo + micrográfico de la serie.
 *   2. Atencion → banda de alerta con acción (nuevo).
 *   3. Kpi   → sparkline de tendencia + pastilla de delta.
 *   4. Euro  → waterfall "qué pasa con cada euro" (nuevo).
 *   5. InBar → barra inline dentro de una celda de tabla (nuevo).
 *   6. Nota  → botón de acción opcional.
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
      background: C.card, border: `1px solid ${C.line}`, borderRadius: 16,
      padding: 15, boxShadow: C.shadow, marginBottom: 14, ...style,
    }}>{children}</div>
  )
}

/* ── Cabecera de card ── */
export function CardHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 13 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.25px' }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: C.grisCl, fontWeight: 800, marginTop: 1 }}>{sub}</div>}
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

/* ══════════════════════════════════════════════════════════
   MEJORA 1 · Micrográfico y anillo de objetivo (piezas del Hero)
   ══════════════════════════════════════════════════════════ */

/** Barras finas sobre el degradado del hero. La última se resalta en blanco. */
function HeroSpark({ puntos }: { puntos: number[] }) {
  if (puntos.length < 2) return null
  const max = Math.max(...puntos, 1)
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 34, marginTop: 12, maxWidth: 300 }}>
      {puntos.map((v, i) => (
        <div key={i} style={{
          flex: 1,
          height: `${Math.max(6, (v / max) * 100)}%`,
          background: i === puntos.length - 1 ? BLANCO : 'rgba(255,255,255,0.28)',
          borderRadius: '3px 3px 0 0',
        }} />
      ))}
    </div>
  )
}

/** Anillo de progreso: cuánto llevas del objetivo. */
function Anillo({ pct, label }: { pct: number; label: string }) {
  const p = Math.max(0, Math.min(100, pct))
  const R = 44, CIRC = 2 * Math.PI * R
  return (
    <div style={{ position: 'relative', width: 104, height: 104, flexShrink: 0 }}>
      <svg width="104" height="104" viewBox="0 0 104 104" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="52" cy="52" r={R} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="11" />
        <circle
          cx="52" cy="52" r={R} fill="none" stroke={BLANCO} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - p / 100)}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      }}>
        <span className="slnum" style={{ fontSize: 21, fontWeight: 800, lineHeight: 1 }}>{Math.round(p)}%</span>
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.8px', opacity: 0.85, marginTop: 2 }}>{label}</span>
      </div>
    </div>
  )
}

/* ── Hero (degradado llama) ── */
export function Hero({ eyebrow, titular, valor, sub, right, spark, objetivo }: {
  eyebrow: string
  titular: string
  valor: string
  sub?: string
  right?: ReactNode
  /** v2 · serie para el micrográfico (p. ej. bruto por día del periodo) */
  spark?: number[]
  /** v2 · anillo de progreso a objetivo */
  objetivo?: { pct: number; label: string }
}) {
  return (
    <section style={{
      background: `linear-gradient(115deg, ${C.rojoDeep}, ${C.rojo} 45%, ${C.naranja})`,
      borderRadius: 20, padding: '20px 24px', color: BLANCO, marginBottom: 12,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 22, flexWrap: 'wrap', boxShadow: C.shadow, position: 'relative', overflow: 'hidden',
    }}>
      {/* halo decorativo */}
      <div style={{
        position: 'absolute', right: -40, top: -60, width: 220, height: 220,
        borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none',
      }} />
      <div style={{ minWidth: 250, position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '1.5px', opacity: 0.8 }}>{eyebrow}</div>
        <div style={{ fontSize: 16, fontWeight: 900, margin: '5px 0 9px' }}>{titular}</div>
        <div className="slnum" style={{ fontSize: 'clamp(30px,4.2vw,40px)', lineHeight: 1, letterSpacing: '-2px' }}>{valor}</div>
        {sub && <div style={{ fontSize: 12, opacity: 0.92, fontWeight: 800, marginTop: 8 }}>{sub}</div>}
        {spark && spark.length > 1 && <HeroSpark puntos={spark} />}
      </div>
      {(right || objetivo) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
          {right && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>{right}</div>
          )}
          {objetivo && <Anillo pct={objetivo.pct} label={objetivo.label} />}
        </div>
      )}
    </section>
  )
}

/** Píldora sobre el hero. `solid` la pone en blanco macizo (para el dato principal). */
export function HeroPill({ children, solid }: { children: ReactNode; solid?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: solid ? BLANCO : 'rgba(255,255,255,0.16)',
      border: `1px solid ${solid ? BLANCO : 'rgba(255,255,255,0.3)'}`,
      color: solid ? '#951218' : BLANCO,
      padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 800,
      whiteSpace: 'nowrap', backdropFilter: solid ? undefined : 'blur(4px)',
    }}>{children}</span>
  )
}

/* ══════════════════════════════════════════════════════════
   MEJORA 2 · Banda de atención — lo que está roto, arriba y con salida
   ══════════════════════════════════════════════════════════ */
export function Atencion({ tono = 'rojo', cifra, children, accion, onAccion }: {
  tono?: Tone
  /** Número grande a la izquierda. Opcional. */
  cifra?: string
  children: ReactNode
  /** Texto del botón. Si no se pasa, no se pinta botón. */
  accion?: string
  onAccion?: () => void
}) {
  const t = TONES[tono]
  return (
    <div style={{
      background: t.bg, border: `1px solid ${t.c}22`, borderRadius: 14,
      padding: '11px 14px', marginBottom: 12,
      display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap',
    }}>
      {cifra && (
        <span className="slnum" style={{ fontSize: 19, fontWeight: 800, color: t.c, whiteSpace: 'nowrap' }}>{cifra}</span>
      )}
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 800, color: t.c, lineHeight: 1.4, minWidth: 220 }}>
        {children}
      </span>
      {accion && (
        <button
          onClick={onAccion}
          style={{
            background: t.c, color: BLANCO, border: 'none', borderRadius: 999,
            padding: '8px 15px', fontFamily: "'Nunito', sans-serif",
            fontWeight: 900, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >{accion}</button>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   MEJORA 3 · KPI con tendencia
   ══════════════════════════════════════════════════════════ */

/** Sparkline de barras dentro de un KPI. */
function Spark({ puntos, color }: { puntos: number[]; color: string }) {
  if (puntos.length < 2) return null
  const max = Math.max(...puntos, 1)
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 20, marginTop: 9 }}>
      {puntos.map((v, i) => (
        <div key={i} style={{
          flex: 1,
          height: `${Math.max(8, (v / max) * 100)}%`,
          background: i === puntos.length - 1 ? color : C.track,
          borderRadius: '2px 2px 0 0',
        }} />
      ))}
    </div>
  )
}

export function Kpi({ icono, tono = 'neutro', label, valor, pie, spark, delta: deltaPill }: {
  icono: string
  tono?: Tone
  label: string
  valor: string
  pie?: ReactNode
  /** v2 · tendencia del KPI (una barra por periodo) */
  spark?: number[]
  /** v2 · pastilla arriba a la derecha (variación, objetivo, etc.) */
  delta?: ReactNode
}) {
  const t = TONES[tono]
  return (
    <Card style={{ marginBottom: 0, padding: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center',
          fontSize: 13, fontWeight: 900, background: t.bg, color: t.c, flexShrink: 0,
        }}>{icono}</div>
        {deltaPill}
      </div>
      <div style={{ fontSize: 10.5, color: C.grisCl, fontWeight: 900, letterSpacing: '0.7px', textTransform: 'uppercase', marginTop: 10 }}>{label}</div>
      <div className="slnum" style={{ fontSize: 25, margin: '3px 0 8px', letterSpacing: '-1.4px' }}>{valor}</div>
      {pie}
      {spark && <Spark puntos={spark} color={t.c} />}
    </Card>
  )
}

/* ── Rejilla de KPIs ── */
export function KpiGrid({ children, cols = 4 }: { children: ReactNode; cols?: number }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
      gap: 11, marginBottom: 12,
    }}>{children}</div>
  )
}

/* ══════════════════════════════════════════════════════════
   MEJORA 4 · Waterfall "qué pasa con cada euro"
   ══════════════════════════════════════════════════════════
   Ojo: necesita coste real. Mientras el escandallo no cubra la carta
   (mapeo plato→receta), pásale solo los tramos de los que haya dato
   y deja `frase` explicando qué falta. */
export interface TramoEuro {
  label: string
  importe: number
  color: string
  /** Texto claro del tramo en la barra si cabe. Por defecto blanco. */
  textoOscuro?: boolean
}
export function Euro({ base, tramos, frase }: {
  base: number
  tramos: TramoEuro[]
  frase?: ReactNode
}) {
  const total = tramos.reduce((s, t) => s + t.importe, 0) || 1
  return (
    <Card>
      <CardHead
        title="Qué pasa con cada euro que entra"
        sub={`Sobre los ${eur0(base)} facturados`}
        right={<Pill tone="neutro">Base {eur0(base)}</Pill>}
      />
      <div style={{ display: 'flex', height: 38, borderRadius: 11, overflow: 'hidden', gap: 2 }}>
        {tramos.map((t, i) => {
          const pct = (t.importe / total) * 100
          return (
            <div key={i} style={{
              flex: pct, background: t.color, display: 'flex', alignItems: 'center',
              justifyContent: 'center', minWidth: 0, overflow: 'hidden',
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 12,
              color: t.textoOscuro ? '#4a3a00' : BLANCO,
            }}>
              {pct >= 4 ? `${pct.toFixed(1)}%` : ''}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
        {tramos.map((t, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: C.gris }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color, display: 'block' }} />
            {t.label} {eur0(t.importe)}
          </span>
        ))}
      </div>
      {frase && (
        <div style={{
          marginTop: 12, background: C.ambarSoft, color: C.ambar, borderRadius: 12,
          padding: '11px 13px', fontSize: 12.5, fontWeight: 800, lineHeight: 1.5,
        }}>{frase}</div>
      )}
    </Card>
  )
}

/* ══════════════════════════════════════════════════════════
   MEJORA 5 · Barra inline dentro de una celda de tabla
   ══════════════════════════════════════════════════════════ */
export function InBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 5, background: C.track, borderRadius: 99, marginTop: 5, overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${Math.max(1, Math.min(100, pct))}%`, background: color, borderRadius: 99 }} />
    </div>
  )
}

/* ── Barra de progreso / peso ── */
export function Bar({ label, valor, pct, color }: { label: string; valor: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 900, marginBottom: 5, gap: 8 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span className="slnum" style={{ color: C.gris, flexShrink: 0, fontSize: 12 }}>{valor}</span>
      </div>
      <div style={{ height: 9, background: C.track, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   MEJORA 6 · Nota / insight, ahora con salida a la acción
   ══════════════════════════════════════════════════════════ */
export function Nota({ tono = 'verde', children, accion, onAccion }: {
  tono?: Tone
  children: ReactNode
  /** Texto del botón. Si no se pasa, la nota se comporta como en v1. */
  accion?: string
  onAccion?: () => void
}) {
  const t = TONES[tono]
  return (
    <div style={{
      marginTop: 13, padding: '11px 13px', borderRadius: 12, fontSize: 12.5, fontWeight: 800,
      background: t.bg, color: t.c, lineHeight: 1.5,
    }}>
      {children}
      {accion && (
        <button
          onClick={onAccion}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8,
            background: C.card, border: `1px solid ${t.c}`, color: t.c, borderRadius: 999,
            padding: '5px 11px', fontFamily: "'Nunito', sans-serif",
            fontSize: 11.5, fontWeight: 900, cursor: 'pointer',
          }}
        >{accion} →</button>
      )}
    </div>
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
  uber: VERDE, glovo: C.amarillo, je: C.naranja, web: C.rojo, dir: C.blu,
}
export const CANAL_LABEL: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat', web: 'Web', dir: 'Directa',
}
