/**
 * Piezas sueltas de la app móvil.
 * Las pantallas del ERP se reutilizan tal cual (Outlet + movil-scope.css):
 * en móvil NO se pierde ningún dato.
 */
import { INK, BLANCO, AMA } from '@/mobile/mapaMovil'
import { CLARO } from '@/styles/neobrutal'

const OSW = 'Oswald, sans-serif'

export const card = {
  background: BLANCO, border: `3px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}`, padding: '1.1rem',
} as const

export function Eyebrow({ children, bg = AMA, color = INK }: { children: React.ReactNode; bg?: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW,
      fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '0.2rem 0.55rem',
    }}>{children}</span>
  )
}

export function Fila({ emoji, bg, titulo, desc, chip, chipBg, chipColor, onClick }: {
  emoji: string; bg?: string; titulo: string; desc: string
  chip?: string; chipBg?: string; chipColor?: string; onClick?: () => void
}) {
  return (
    <div onClick={onClick} style={{
      ...card, display: 'flex', gap: '1rem', alignItems: 'center', cursor: onClick ? 'pointer' : 'default',
    }}>
      <span style={{
        fontSize: '1.6rem', flexShrink: 0, width: '3rem', height: '3rem', border: `3px solid ${INK}`,
        background: bg || CLARO, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{emoji}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontFamily: OSW, fontWeight: 700, fontSize: '1.02rem', textTransform: 'uppercase', lineHeight: 1.15 }}>{titulo}</p>
        <p style={{ fontSize: '0.82rem', opacity: 0.55, marginTop: '0.1rem' }}>{desc}</p>
      </div>
      {chip
        ? <span style={{
            marginLeft: 'auto', background: chipBg || AMA, color: chipColor || INK, border: `2px solid ${INK}`,
            fontFamily: OSW, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em',
            textTransform: 'uppercase', padding: '0.25rem 0.5rem', whiteSpace: 'nowrap',
          }}>{chip}</span>
        : <span style={{ marginLeft: 'auto', opacity: 0.3, fontSize: '1.4rem', fontFamily: OSW }}>›</span>}
    </div>
  )
}

export { emojiDeRuta } from '@/mobile/mapaMovil'
