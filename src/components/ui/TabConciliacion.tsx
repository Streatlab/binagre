import React from 'react'
import { useTheme, tabActiveStyle, tabInactiveStyle, tabsContainerStyle } from '@/styles/tokens'

interface TabsProps {
  tabs: Array<{ id: string; label: string }>
  activeId: string
  onChange: (id: string) => void
}

export default function TabConciliacion({ tabs, activeId, onChange }: TabsProps) {
  const { T, isDark } = useTheme()

  return (
    <div style={tabsContainerStyle()}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          style={tab.id === activeId ? tabActiveStyle(isDark) : tabInactiveStyle(T)}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
