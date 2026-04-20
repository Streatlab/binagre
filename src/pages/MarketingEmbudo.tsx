import { useTheme, FONT } from '@/styles/tokens'

export default function MarketingEmbudo() {
  const { T } = useTheme()
  return (
    <div style={{ background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px' }}>
      <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', textTransform: 'uppercase', color: T.emphasis, margin: 0, marginBottom: 8 }}>Embudo</h1>
      <p style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec }}>Próximamente — módulo en construcción</p>
    </div>
  )
}
