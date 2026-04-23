import { useIVA } from '@/contexts/IVAContext'
import { useTheme, FONT } from '@/styles/tokens'

export default function IVAToggle() {
  const { modo, setModo } = useIVA()
  const { T, isDark } = useTheme()

  const wrap: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    background: isDark ? '#353a50' : '#e8e4d8',
    borderRadius: 8,
    padding: 2,
  }

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: active ? 600 : 500,
    background: active ? (isDark ? '#484f66' : '#fffbea') : 'transparent',
    color: active ? '#e8f442' : T.mut,
    transition: 'background 120ms, color 120ms',
  })

  return (
    <div style={wrap} title="Cambia entre ver cifras con o sin IVA">
      <button onClick={() => setModo('sin')} style={btn(modo === 'sin')}>Sin IVA</button>
      <button onClick={() => setModo('con')} style={btn(modo === 'con')}>Con IVA</button>
    </div>
  )
}
