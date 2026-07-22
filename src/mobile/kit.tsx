import { BLANCO, GRANATE, INK, NAR_S } from '@/styles/neobrutal'
/**
 * Sistema visual de la app móvil Binagre.
 * Estructura y DENSIDAD copiadas de Delasalud (tarjetas grandes, todo en rem,
 * una columna, mucho aire). Piel: Neobrutal Food-Pop de Streat Lab.
 */
import type { CSSProperties } from 'react'

export const OSW = 'Oswald, sans-serif'
export const LEX = 'Lexend, sans-serif'

export const T = {
  ink: INK,
  crema: NAR_S,
  crema2: '#F3D9A8',
  blanco: '#FFFDF7',
  track: '#ecdcb8',
  ama: '#FFC400',
  verde: '#0FB86B',
  nar: '#FF6A1A',
  azul: '#2D5BFF',
  rosa: '#FF2E63',
  rojo: '#FF1E27',
  granate: GRANATE,
  gris: '#7d7060',
}

export const sombra = `4px 4px 0 ${T.ink}`
export const sombraSm = `3px 3px 0 ${T.ink}`

export const card: CSSProperties = {
  background: T.blanco,
  border: `3px solid ${T.ink}`,
  boxShadow: sombra,
  padding: '1rem',
}

export const eyebrow = (bg: string, color = T.ink): CSSProperties => ({
  display: 'inline-block',
  background: bg,
  color,
  border: `2px solid ${T.ink}`,
  fontFamily: OSW,
  fontWeight: 600,
  fontSize: '0.68rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  padding: '0.2rem 0.5rem',
})

export const titulo: CSSProperties = {
  fontFamily: OSW,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '-0.01em',
  lineHeight: 1,
}

export const cifra: CSSProperties = {
  fontFamily: OSW,
  fontWeight: 700,
  lineHeight: 0.92,
  letterSpacing: '-0.03em',
}

/** Tarjeta de navegación grande (patrón Delasalud: emoji + título + descripción + ›) */
export function FilaNav({ emoji, label, desc, color, onClick, pendiente }: {
  emoji: string; label: string; desc?: string; color?: string; onClick: () => void; pendiente?: boolean
}) {
  return (
    <button onClick={onClick} style={{
      ...card, display: 'flex', gap: '0.9rem', alignItems: 'center', width: '100%',
      textAlign: 'left', cursor: 'pointer', borderRadius: 0, marginBottom: '0.75rem',
    }}>
      <span style={{
        fontSize: '1.6rem', flexShrink: 0, width: '2.9rem', height: '2.9rem',
        border: `3px solid ${T.ink}`, background: color || T.crema2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{emoji}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ ...titulo, display: 'block', fontSize: '1rem', color: T.ink }}>{label}</b>
        {desc && <span style={{ display: 'block', fontFamily: LEX, fontSize: '0.8rem', color: T.gris, marginTop: '0.15rem' }}>{desc}</span>}
      </span>
      {pendiente
        ? <span style={{ ...eyebrow(T.granate, BLANCO), fontSize: '0.6rem' }}>Pend</span>
        : <span style={{ ...titulo, fontSize: '1.4rem', opacity: 0.35 }}>›</span>}
    </button>
  )
}

/** KPI grande */
export function Kpi({ label, valor, delta, color }: { label: string; valor: string; delta?: string; color?: string }) {
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: T.gris }}>{label}</span>
      <span style={{ ...cifra, fontSize: '1.9rem', color: color || T.ink }}>{valor}</span>
      {delta && <span style={{ fontFamily: LEX, fontSize: '0.75rem', fontWeight: 600, color: color || T.gris }}>{delta}</span>}
    </div>
  )
}

/** Barra de canal / progreso */
export function Barra({ nombre, valor, pct, color, izq, der }: {
  nombre: string; valor: string; pct: number; color: string; izq?: string; der?: string
}) {
  return (
    <div style={{ ...card, marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
        <span style={{ ...titulo, fontSize: '0.95rem' }}>{nombre}</span>
        <span style={{ ...cifra, fontSize: '1.05rem' }}>{valor}</span>
      </div>
      <div style={{ height: '0.95rem', border: `2px solid ${T.ink}`, background: T.track, position: 'relative', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, display: 'block' }} />
      </div>
      {(izq || der) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontFamily: LEX, fontSize: '0.75rem', fontWeight: 600, color: T.gris }}>
          <span>{izq}</span><span>{der}</span>
        </div>
      )}
    </div>
  )
}
