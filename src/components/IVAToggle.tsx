import { useIVA } from '@/contexts/IVAContext'
import { useTheme, FONT } from '@/styles/tokens'

const ROJO_ACTIVO = '#C4372C'
const ROJO_HOVER  = '#A52D24'

export default function IVAToggle() {
  const { modo, setModo } = useIVA()
  const { T } = useTheme()

  const wrap: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0,
    background: 'transparent',
    border: `1px solid ${T.brd}`,
    borderRadius: 999,
    padding: 3,
  }

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '6px 18px',
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    fontFamily: FONT.body,
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    background: active ? ROJO_ACTIVO : 'transparent',
    color: active ? '#ffffff' : T.pri,
    transition: 'background 120ms, color 120ms',
  })

  return (
    <div style={wrap} title="Cambia entre ver cifras con o sin IVA">
      <button
        onClick={() => setModo('sin')}
        style={btn(modo === 'sin')}
        onMouseEnter={e => { if (modo !== 'sin') (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,55,44,0.08)' }}
        onMouseLeave={e => { if (modo !== 'sin') (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        onFocus={e => { if (modo === 'sin') (e.currentTarget as HTMLButtonElement).style.background = ROJO_HOVER }}
        onBlur={e => { if (modo === 'sin') (e.currentTarget as HTMLButtonElement).style.background = ROJO_ACTIVO }}
      >
        Sin IVA
      </button>
      <button
        onClick={() => setModo('con')}
        style={btn(modo === 'con')}
        onMouseEnter={e => { if (modo !== 'con') (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,55,44,0.08)' }}
        onMouseLeave={e => { if (modo !== 'con') (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        onFocus={e => { if (modo === 'con') (e.currentTarget as HTMLButtonElement).style.background = ROJO_HOVER }}
        onBlur={e => { if (modo === 'con') (e.currentTarget as HTMLButtonElement).style.background = ROJO_ACTIVO }}
      >
        Con IVA
      </button>
    </div>
  )
}
