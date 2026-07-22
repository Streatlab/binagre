import { BLANCO } from '@/styles/neobrutal'
/**
 * uiSLFoco — acento oliva del kit SL (Ley Visual SL v2).
 *
 * El oliva es el tercer color, el de resalte. No es semáforo: sirve para
 * marcar lo que ENTRA (ingresos, entradas de caja) y para destacar el foco
 * de la semana. Rojo y naranja siguen siendo la llama de la marca.
 *
 * Regla: ninguna pantalla escribe estos colores a mano. Se importan de aquí.
 */
import type { ReactNode } from 'react'
import { C } from './uiSL'

export const OLIVA = {
  hondo: '#3D5219',   // fondos oscuros y chips activos
  medio: '#5C7A29',   // barras, líneas, valores
  claro: '#A8C464',   // sobre la llama (anillos, pastillas)
  soft:  '#EDF2E1',   // fondo de pastilla clara
  tinta: '#2C3B12',   // texto sobre oliva claro
} as const

/** Card oscura: el foco de la semana. Solo una por pantalla. */
export function KpiFoco({ label, valor, accion, onAccion, pie }: {
  label: string
  valor: ReactNode
  accion?: string
  onAccion?: () => void
  pie?: ReactNode
}) {
  return (
    <div style={{
      background: OLIVA.hondo, border: `1px solid ${OLIVA.hondo}`,
      borderRadius: 16, padding: '13px 15px', boxShadow: C.shadow,
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.9px', color: OLIVA.claro }}>
        {label.toUpperCase()}
      </div>
      <div className="slnum" style={{ fontSize: 27, fontWeight: 800, color: BLANCO, letterSpacing: '-1px' }}>
        {valor}
      </div>
      {accion && (
        <button
          onClick={onAccion}
          style={{
            alignSelf: 'flex-start', marginTop: 3, border: 'none', cursor: onAccion ? 'pointer' : 'default',
            background: OLIVA.claro, color: OLIVA.tinta, borderRadius: 999,
            padding: '3px 10px', fontFamily: "'Nunito', sans-serif", fontSize: 10.5, fontWeight: 900,
          }}
        >{accion}</button>
      )}
      {pie && <div style={{ fontSize: 11, fontWeight: 800, color: OLIVA.claro, marginTop: 2 }}>{pie}</div>}
    </div>
  )
}

/** Leyenda de colores de un gráfico. El color explica, no decora. */
export function Leyenda({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
      {items.map(i => (
        <span key={i.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 800, color: C.grisCl }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: i.color, display: 'inline-block' }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

/** Ranking con barra: quién se lleva más, sin leer los números. */
export function Ranking({ filas, fmt, pie }: {
  filas: Array<{ label: string; valor: number; color?: string }>
  fmt: (n: number) => string
  pie?: ReactNode
}) {
  const max = Math.max(...filas.map(f => f.valor), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {filas.map((f, i) => (
        <div key={f.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 800 }}>
            <span>{f.label}</span>
            <span className="slnum">{fmt(f.valor)}</span>
          </div>
          <div style={{ height: 7, background: C.track, borderRadius: 6, marginTop: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${(f.valor / max) * 100}%`, height: 7, borderRadius: 6,
              background: f.color ?? (i === 0 ? C.rojoSem : C.naranja),
            }} />
          </div>
        </div>
      ))}
      {pie && (
        <div style={{
          borderTop: `1px solid ${C.line}`, marginTop: 3, paddingTop: 9,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>{pie}</div>
      )}
    </div>
  )
}

/** Botón de acción en oliva (el foco, no la marca). */
export function BotonFoco({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: OLIVA.hondo, color: BLANCO, border: 'none', borderRadius: 999,
        padding: '5px 12px', cursor: onClick ? 'pointer' : 'default',
        fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 900,
      }}
    >{children}</button>
  )
}

/** Filtros en pastilla, con el activo en oliva hondo. */
export function ChipsFoco<T extends string>({ opciones, activo, onChange }: {
  opciones: Array<{ id: T; label: string; count?: number }>
  activo: T | null
  onChange: (id: T | null) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opciones.map(o => {
        const on = o.id === activo
        return (
          <button
            key={o.id}
            onClick={() => onChange(on ? null : o.id)}
            style={{
              padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${on ? 'transparent' : C.line}`,
              background: on ? OLIVA.hondo : C.card,
              color: on ? BLANCO : C.grisCl,
              fontFamily: "'Nunito', sans-serif", fontSize: 11.5, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {o.label}
            {o.count != null && <span className="slnum" style={{ fontSize: 10.5, opacity: 0.85 }}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Anillo de progreso sobre el hero (llama). El relleno va en oliva claro. */
export function AnilloHero({ pct, label }: { pct: number; label: string }) {
  const r = 38
  const c = 2 * Math.PI * r
  const on = Math.max(0, Math.min(100, pct)) / 100 * c
  return (
    <svg width={96} height={96} viewBox="0 0 96 96" aria-hidden="true">
      <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={11} />
      <circle
        cx="48" cy="48" r={r} fill="none" stroke={OLIVA.claro} strokeWidth={11} strokeLinecap="round"
        strokeDasharray={`${on} ${c - on}`} transform="rotate(-90 48 48)"
      />
      <text x="48" y="45" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="19" fontWeight="700" fill={BLANCO}>
        {Math.round(pct)}%
      </text>
      <text x="48" y="60" textAnchor="middle" fontFamily="Nunito, sans-serif" fontSize="9" fontWeight="800" fill="rgba(255,255,255,0.8)">
        {label}
      </text>
    </svg>
  )
}
