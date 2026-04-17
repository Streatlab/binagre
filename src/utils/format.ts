const LOCALE = 'es-ES'

export const fmtEur = (v?: number | string | null): string => {
  const n = (v != null && v !== '') ? Number(v) : null
  if (n == null || isNaN(n)) return ''
  return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'
}

export const fmtNum = (v?: number | string | null, d = 2): string => {
  const n = (v != null && v !== '') ? Number(v) : null
  if (n == null || isNaN(n)) return ''
  return n.toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export const fmtPct = (v?: number | string | null) => {
  const n = v != null ? Number(v) : null
  return n != null && !isNaN(n) ? (n*100).toLocaleString(LOCALE,{minimumFractionDigits:2,maximumFractionDigits:2})+'%' : ''
}

export const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'}) : ''
