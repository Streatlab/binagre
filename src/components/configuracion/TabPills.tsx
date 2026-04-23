import { useIsDark } from '@/hooks/useIsDark'

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
  const isDark = useIsDark()

  const inactiveBg = isDark ? '#141414' : '#ffffff'
  const inactiveColor = isDark ? '#cccccc' : '#1A1A1A'
  const inactiveBorder = isDark ? '#2a2a2a' : '#E9E1D0'

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
              fontFamily: 'Oswald, sans-serif',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontWeight: isActive ? 600 : 500,
              background: isActive ? '#B01D23' : inactiveBg,
              color: isActive ? '#ffffff' : inactiveColor,
              border: `1px solid ${isActive ? '#B01D23' : inactiveBorder}`,
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
