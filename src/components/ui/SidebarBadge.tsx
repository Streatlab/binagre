import { BLANCO, INK } from '@/styles/neobrutal'
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
        padding: '0 5px',
        borderRadius: 0,
        border: `2px solid ${INK}`,
        background: '#FF2E63',
        color: BLANCO,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'Oswald, sans-serif',
        marginLeft: 8,
      }}
    >
      {count}
    </span>
  )
}
