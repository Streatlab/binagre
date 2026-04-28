import React from 'react'

interface SidebarBadgeProps {
  count: number
}

export default function SidebarBadge({ count }: SidebarBadgeProps) {
  return (
    <span
      style={{
        display: count > 0 ? 'inline-flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 6px',
        borderRadius: 9,
        background: '#E24B4A',
        color: '#ffffff',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'Lexend, sans-serif',
        marginLeft: 8,
      }}
    >
      {count}
    </span>
  )
}
