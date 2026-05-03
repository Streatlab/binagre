const LOCALE = 'es-ES'

export const fmtEur = (v?: number | string | null): string => {
  const n = (v != null && v !== '') ? Number(v) : null
  if (n == null || isNaN(n)) return ''
  const [int, dec] = n.toFixed(2).split('.')
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec + ' €'
}

/** Número formateado en es-ES SIN símbolo de euro, sin decimales por defecto */
export const fmtNumES = (v?: number | string | null, decimales = 0): string => {
  const n = (v != null && v !== '') ? Number(v) : null
  if (n == null || isNaN(n)) return '—'
  const fixed = n.toFixed(decimales)
  const [int, dec] = fixed.split('.')
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decimales > 0 && dec !== undefined ? intFmt + ',' + dec : intFmt
}

export const fmtNum = (v?: number | string | null, d = 4): string => {
  const n = (v != null && v !== '') ? Number(v) : null
  if (n == null || isNaN(n)) return ''
  const fixed = n.toFixed(d)
  const [int, dec] = fixed.split('.')
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dec !== undefined ? intFmt + ',' + dec : intFmt
}

export const fmtPct = (v?: number | string | null) => {
  const n = v != null ? Number(v) : null
  return n != null && !isNaN(n) ? (n*100).toLocaleString(LOCALE,{minimumFractionDigits:2,maximumFractionDigits:2})+'%' : ''
}

export const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'}) : ''

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function fmtFechaES(fecha?: string | Date | null): string {
  if (!fecha) return ''
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MESES_ES[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtFechaRelativa(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const hh = d.toTimeString().slice(0, 5)
  if (now.toDateString() === d.toDateString()) return `Hoy ${hh}`
  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  if (y.toDateString() === d.toDateString()) return `Ayer ${hh}`
  return fmtDate(iso)
}
