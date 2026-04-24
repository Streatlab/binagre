import { useTitular } from '@/contexts/TitularContext'
import { useTheme, FONT } from '@/styles/tokens'

export default function TitularSelector() {
  const { T } = useTheme()
  const { filtro, setFiltro, titulares } = useTitular()

  const botones = [
    { id: 'unificado', color: '#B01D23', label: 'Unificado' },
    ...titulares.map((t) => ({ id: t.id, color: t.color || '#B01D23', label: t.nombre })),
  ]

  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        backgroundColor: T.bg,
        borderRadius: 10,
        border: `1px solid ${T.brd}`,
      }}
    >
      {botones.map((b) => {
        const active = filtro === b.id
        return (
          <button
            key={b.id}
            onClick={() => setFiltro(b.id)}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: 7,
              backgroundColor: active ? b.color : 'transparent',
              color: active ? '#fff' : T.pri,
              fontFamily: FONT.heading,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {b.label}
          </button>
        )
      })}
    </div>
  )
}
