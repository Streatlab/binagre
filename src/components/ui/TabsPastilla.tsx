import React from 'react'
import { TABS_PILL } from '@/components/panel/resumen/tokens'

interface TabItem {
  id: string
  label: string
  badge?: number
}

interface TabsPastillaProps {
  tabs: TabItem[]
  activeId: string
  onChange: (id: string) => void
}

export default function TabsPastilla({ tabs, activeId, onChange }: TabsPastillaProps) {
  return (
    <div style={TABS_PILL.container}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          style={tab.id === activeId ? TABS_PILL.active : TABS_PILL.inactive}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.badge != null && tab.badge > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 16,
              height: 16,
              padding: '0 5px',
              borderRadius: 8,
              background: '#E24B4A',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 600,
              fontFamily: 'Lexend',
              marginLeft: 6,
            }}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
