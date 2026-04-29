import React from 'react'
import { SUBTABS } from '@/components/panel/resumen/tokens'

interface SubTabItem {
  id: string
  label: string
}

interface SubTabsInversoProps {
  tabs: SubTabItem[]
  activeId: string
  onChange: (id: string) => void
  prefijoLbl?: string
}

export default function SubTabsInverso({ tabs, activeId, onChange, prefijoLbl }: SubTabsInversoProps) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {prefijoLbl && (
        <span style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '1.5px',
          color: '#7a8090',
          textTransform: 'uppercase',
          marginRight: 2,
        }}>
          {prefijoLbl}
        </span>
      )}
      {tabs.map(tab => (
        <button
          key={tab.id}
          style={tab.id === activeId ? SUBTABS.active : SUBTABS.inactive}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
