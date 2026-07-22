import type { ReactNode } from 'react'
import { useIsDark } from '@/hooks/useIsDark'
import { STATUSTAG, TABCOSTES_MANUAL_BG_DARK, TABCOSTES_MANUAL_BG_LIGHT, TABCOSTES_MANUAL_FG_DARK, TABCOSTES_MANUAL_FG_LIGHT, TABCOSTES_AUTO_BG_DARK, TABCOSTES_AUTO_BG_LIGHT, TABCOSTES_AUTO_FG_DARK, TABCOSTES_AUTO_FG_LIGHT } from '@/styles/palettes'

type Variant =
  | 'ok' | 'off'
  | 'admin' | 'gestor' | 'cocina'
  | 'fijo' | 'var' | 'pers' | 'mkt'

export function StatusTag({
  variant,
  children,
}: {
  variant: Variant
  children: ReactNode
}) {
  const isDark = useIsDark()

  const styles: Record<Variant, { bg: string; color: string }> = {
    ok:     { bg: isDark ? STATUSTAG.ok.bgDark : STATUSTAG.ok.bgLight, color: isDark ? STATUSTAG.ok.fgDark : STATUSTAG.ok.fgLight },
    off:    { bg: isDark ? STATUSTAG.off.bgDark : STATUSTAG.off.bgLight, color: isDark ? STATUSTAG.off.fgDark : STATUSTAG.off.fgLight },
    admin:  { bg: isDark ? TABCOSTES_MANUAL_BG_DARK : TABCOSTES_MANUAL_BG_LIGHT, color: isDark ? TABCOSTES_MANUAL_FG_DARK : TABCOSTES_MANUAL_FG_LIGHT },
    gestor: { bg: isDark ? TABCOSTES_AUTO_BG_DARK : TABCOSTES_AUTO_BG_LIGHT, color: isDark ? TABCOSTES_AUTO_FG_DARK : TABCOSTES_AUTO_FG_LIGHT },
    cocina: { bg: isDark ? STATUSTAG.cocina.bgDark : STATUSTAG.cocina.bgLight, color: isDark ? STATUSTAG.cocina.fgDark : STATUSTAG.cocina.fgLight },
    fijo:   { bg: isDark ? STATUSTAG.fijo.bgDark : STATUSTAG.fijo.bgLight, color: isDark ? STATUSTAG.fijo.fgDark : STATUSTAG.fijo.fgLight },
    var:    { bg: isDark ? STATUSTAG.var.bgDark : STATUSTAG.var.bgLight, color: isDark ? STATUSTAG.var.fgDark : STATUSTAG.var.fgLight },
    pers:   { bg: isDark ? STATUSTAG.pers.bgDark : STATUSTAG.pers.bgLight, color: isDark ? STATUSTAG.pers.fgDark : STATUSTAG.pers.fgLight },
    mkt:    { bg: isDark ? STATUSTAG.mkt.bgDark : STATUSTAG.mkt.bgLight, color: isDark ? STATUSTAG.mkt.fgDark : STATUSTAG.mkt.fgLight },
  }
  const s = styles[variant]

  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '5px 14px',
        borderRadius: 5,
        fontSize: 11,
        letterSpacing: '0.06em',
        fontWeight: 600,
        textTransform: 'uppercase',
        background: s.bg,
        color: s.color,
        fontFamily: 'Oswald, sans-serif',
      }}
    >
      {children}
    </span>
  )
}
