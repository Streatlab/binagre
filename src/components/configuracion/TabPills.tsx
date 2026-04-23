import { useTheme, FONT } from '@/styles/tokens'

interface Tab {
  id: string
  label: string
}

export function TabPills({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
}) {
  const { T } = useTheme()

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
      {tabs.map(t => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: FONT.heading,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontWeight: isActive ? 600 : 500,
              background: isActive ? '#B01D23' : T.card,
              color: isActive ? '#ffffff' : T.sec,
              border: `0.5px solid ${isActive ? '#B01D23' : T.brd}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
