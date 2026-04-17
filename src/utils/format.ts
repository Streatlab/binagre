export const fmtEur = (v?: number | null) =>
  v != null ? v.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €' : ''

export const fmtNum = (v?: number | null, d=2) =>
  v != null ? v.toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d}) : ''

export const fmtPct = (v?: number | null) =>
  v != null ? (v*100).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+'%' : ''

export const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'}) : ''
