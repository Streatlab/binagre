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

  // Paletas dark-aware: en dark suave (rgba 0.22 fondo + color claro texto); en light sólido.
  const styles: Record<CanalAbv, { bg: string; color: string }> = {
    UE:  {
      bg: isDark ? 'rgba(6,193,103,0.22)' : '#06C167',
      color: isDark ? '#5DCAA5' : '#ffffff',
    },
    GL:  {
      bg: isDark ? 'rgba(232,244,66,0.22)' : '#e8f442',
      color: isDark ? '#e8f442' : '#5c550d',
    },
    JE:  {
      bg: isDark ? 'rgba(245,166,35,0.22)' : '#f5a623',
      color: isDark ? '#F5C36B' : '#ffffff',
    },
    WEB: {
      bg: isDark ? 'rgba(176,29,35,0.28)' : '#B01D23',
      color: isDark ? '#F09595' : '#ffffff',
    },
    DIR: {
      bg: isDark ? 'rgba(102,170,255,0.22)' : '#66aaff',
      color: isDark ? '#89B5DF' : '#ffffff',
    },
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
