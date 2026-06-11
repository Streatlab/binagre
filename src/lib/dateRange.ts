export type Periodo = '30d' | 'mes_curso' | '60d' | '90d' | 'custom'

/** Devuelve YYYY-MM-DD en hora local (evita desfase UTC en zonas con offset negativo). */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function rangoPeriodo(p: Periodo, custom?: [string, string]): [string, string] {
  const today = new Date()
  const fmt = toLocalDateStr
  const start = new Date(today)
  if (p === '30d') start.setDate(today.getDate() - 30)
  else if (p === '60d') start.setDate(today.getDate() - 60)
  else if (p === '90d') start.setDate(today.getDate() - 90)
  else if (p === 'mes_curso') { start.setDate(1) }
  else if (p === 'custom' && custom) return custom
  return [fmt(start), fmt(today)]
}
