import { BLANCO, GRANATE } from '@/styles/neobrutal'
/** Hero grande estilo Panel Global — parte del kit oficial Neobrutal Alegre. */
import type { ReactNode } from 'react'
import { AMA, INK, CREMA, VERDE, NARANJA, OSW, BORDER, BORDER_FINO, SHADOW, SHADOW_MINI } from '@/styles/kit'

export function Resaltado({ children, bg = NARANJA }: { children: ReactNode; bg?: string }) {
  return <span style={{ background: bg, padding: '0 6px', border: BORDER_FINO }}>{children}</span>
}

export default function HeroTocho(props: {
  claim?: string
  periodo?: string
  titular: ReactNode
  etiquetaDato?: string
  dato?: string
  delta?: string
  deltaPositivo?: boolean
  netoTexto?: string
  extra?: ReactNode
}) {
  const { claim = 'COMER BIEN. AQUÍ Y AHORA.', periodo, titular, etiquetaDato, dato, delta, deltaPositivo = true, netoTexto, extra } = props
  return (
    <div style={{ background: AMA, border: BORDER, boxShadow: SHADOW, padding: 16 }}>
      <span style={{ background: BLANCO, border: BORDER_FINO, padding: '2px 10px', fontFamily: OSW, fontSize: 11, letterSpacing: '0.1em' }}>{claim}</span>
      {periodo && <span style={{ background: INK, color: CREMA, border: BORDER_FINO, padding: '2px 10px', fontFamily: OSW, fontSize: 11, letterSpacing: '0.1em', marginLeft: 6 }}>{periodo}</span>}
      <div style={{ fontFamily: OSW, fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, lineHeight: 1.12, marginTop: 10, textTransform: 'uppercase' }}>{titular}</div>
      {etiquetaDato && <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '0.12em', marginTop: 10 }}>{etiquetaDato}</div>}
      {(dato || delta) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {dato && <span style={{ fontFamily: OSW, fontSize: 'clamp(30px, 5vw, 44px)', fontWeight: 700, lineHeight: 1.05 }}>{dato}</span>}
          {delta && <span style={{ background: deltaPositivo ? VERDE : GRANATE, color: BLANCO, border: BORDER_FINO, padding: '3px 9px', fontFamily: OSW, fontSize: 14, fontWeight: 700 }}>{delta}</span>}
        </div>
      )}
      {netoTexto && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: VERDE, border: BORDER, boxShadow: SHADOW_MINI, padding: '7px 13px', marginTop: 10, color: BLANCO, fontFamily: OSW, fontWeight: 700 }}>
          {netoTexto}
        </div>
      )}
      {extra}
    </div>
  )
}
