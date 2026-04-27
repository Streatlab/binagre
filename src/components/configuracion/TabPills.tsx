import { useTheme, tabActiveStyle, tabInactiveStyle, tabsContainerStyle } from '@/styles/tokens'

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
  const { T, isDark } = useTheme()

  return (
    <div style={{ ...tabsContainerStyle(), flexWrap: 'wrap' }}>
      {tabs.map(t => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={isActive ? tabActiveStyle(isDark) : tabInactiveStyle(T)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
