import { AZUL_CL, BLANCO, GRANATE, LIMA, NAR, VERDE } from '@/styles/neobrutal'
import type { CanalAbv } from '@/types/configuracion'
import { useIsDark } from '@/hooks/useIsDark'
import { STATUSTAG, TABCOSTES_MANUAL_FG_DARK, TABCOSTES_AUTO_FG_DARK, CTAG_LIMA_TXT_LIGHT } from '@/styles/palettes'

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
      bg: isDark ? 'rgba(6,193,103,0.22)' : VERDE,
      color: isDark ? STATUSTAG.ok.fgDark : BLANCO,
    },
    GL:  {
      bg: isDark ? 'rgba(232,244,66,0.22)' : LIMA,
      color: isDark ? LIMA : CTAG_LIMA_TXT_LIGHT,
    },
    JE:  {
      bg: isDark ? 'rgba(245,166,35,0.22)' : NAR,
      color: isDark ? STATUSTAG.cocina.fgDark : BLANCO,
    },
    WEB: {
      bg: isDark ? 'rgba(176,29,35,0.28)' : GRANATE,
      color: isDark ? TABCOSTES_MANUAL_FG_DARK : BLANCO,
    },
    DIR: {
      bg: isDark ? 'rgba(102,170,255,0.22)' : AZUL_CL,
      color: isDark ? TABCOSTES_AUTO_FG_DARK : BLANCO,
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
