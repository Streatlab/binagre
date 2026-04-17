// de-DE usa punto de miles y coma decimal igual que es-ES, pero agrupa desde 1.000 (es-ES solo desde 10.000 en algunos navegadores)
const LOCALE = 'de-DE'

export const fmtEur = (v?: number | string | null) => {
  const n = v != null ? Number(v) : null
  return n != null && !isNaN(n) ? n.toLocaleString(LOCALE,{minimumFractionDigits:2,maximumFractionDigits:2})+' €' : ''
}

export const fmtNum = (v?: number | string | null, d=2) => {
  const n = v != null ? Number(v) : null
  return n != null && !isNaN(n) ? n.toLocaleString(LOCALE,{minimumFractionDigits:d,maximumFractionDigits:d}) : ''
}

export const fmtPct = (v?: number | string | null) => {
  const n = v != null ? Number(v) : null
  return n != null && !isNaN(n) ? (n*100).toLocaleString(LOCALE,{minimumFractionDigits:2,maximumFractionDigits:2})+'%' : ''
}

export const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'}) : ''
