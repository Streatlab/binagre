import { useTheme as useRootTheme, FONT } from '@/styles/tokens'

export interface FacturasTokens {
  accentRed: string
  accent: string
  base: string
  group: string
  card: string
  border: string
  text: string
  secondary: string
  muted: string
  input: string
  fontTitle: string
  fontUi: string
}

const ACCENT_RED = '#B01D23'

export function useFacturasTheme(): { T: FacturasTokens; isDark: boolean } {
  const { T, isDark } = useRootTheme()
  return {
    T: {
      accentRed: ACCENT_RED,
      accent: T.accent,
      base: T.bg,
      group: T.group,
      card: T.card,
      border: T.brd,
      text: T.pri,
      secondary: T.sec,
      muted: T.mut,
      input: T.inp,
      fontTitle: FONT.heading,
      fontUi: FONT.body,
    },
    isDark,
  }
}

export const ESTADO_COLOR: Record<string, string> = {
  asociada: '#1D9E75',
  pendiente_revision: '#BA7517',
  historica: '#7080a8',
  error: '#A32D2D',
  duplicada: '#7080a8',
  faltante: '#A32D2D',
  procesando: '#5a6880',
  pendiente_titular_manual: '#BA7517',
  sin_match: '#5a6880',
  ocr_fallido: '#A32D2D',
  drive_pendiente: '#BA7517',
}

export const ESTADO_NOMBRE: Record<string, string> = {
  asociada: 'Asociada',
  pendiente_revision: 'Pendiente',
  historica: 'Histórica',
  error: 'Error',
  duplicada: 'Duplicada',
  faltante: 'Faltante',
  procesando: 'Procesando',
  pendiente_titular_manual: 'Sin titular',
  sin_match: 'Sin match',
  ocr_fallido: 'OCR falló',
  drive_pendiente: 'Drive pendiente',
}
