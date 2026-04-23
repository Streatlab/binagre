import type { CanalAbv } from '@/types/configuracion'
import { useIsDark } from '@/hooks/useIsDark'

const LABEL: Record<CanalAbv, string> = {
  UE: 'UE',
  GL: 'GL',
  JE: 'JE',
  WEB: 'WEB',
  DIR: 'DIR',
}

export function Ctag({ abv }: { abv: CanalAbv }) {
  const isDark = useIsDark()

  const styles: Record<CanalAbv, { bg: string; color: string }> = {
    UE:  { bg: '#06C167', color: '#ffffff' },
    GL:  { bg: '#e8f442', color: isDark ? '#1a1a00' : '#5c550d' },
    JE:  { bg: '#f5a623', color: '#ffffff' },
    WEB: { bg: '#B01D23', color: '#ffffff' },
    DIR: { bg: '#66aaff', color: '#ffffff' },
  }
  const s = styles[abv]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 5,
        fontSize: 10,
        letterSpacing: '0.06em',
        fontWeight: 700,
        textTransform: 'uppercase',
        background: s.bg,
        color: s.color,
        fontFamily: 'Oswald, sans-serif',
        marginRight: 4,
      }}
    >
      {LABEL[abv]}
    </span>
  )
}
