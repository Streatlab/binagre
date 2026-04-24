import { useTitular } from '@/contexts/TitularContext'
import { useTheme, FONT } from '@/styles/tokens'

export default function TitularSelector() {
  const { T } = useTheme()
  const { filtro, setFiltro, titulares } = useTitular()

  const botones = [
    { id: 'unificado', color: '#B01D23', label: 'SL' },
    ...titulares.map((t) => ({ id: t.id, color: t.color || '#B01D23', label: t.nombre })),
  ]

  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 3,
        padding: 3,
        backgroundColor: T.inp,
        borderRadius: 8,
        border: `0.5px solid ${T.brd}`,
      }}
    >
      {botones.map((b) => {
        const active = filtro === b.id
        return (
          <button
            key={b.id}
            onClick={() => setFiltro(b.id)}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: 6,
              backgroundColor: active ? '#FF4757' : 'transparent',
              color: active ? '#fff' : T.sec,
              fontFamily: FONT.heading,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {!active && b.id !== 'unificado' && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
            )}
            {b.label}
          </button>
        )
      })}
    </div>
  )
}
