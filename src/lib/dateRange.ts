export type Periodo = '30d' | 'mes_curso' | '60d' | '90d' | 'custom'

export function rangoPeriodo(p: Periodo, custom?: [string, string]): [string, string] {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const start = new Date(today)
  if (p === '30d') start.setDate(today.getDate() - 30)
  else if (p === '60d') start.setDate(today.getDate() - 60)
  else if (p === '90d') start.setDate(today.getDate() - 90)
  else if (p === 'mes_curso') { start.setDate(1) }
  else if (p === 'custom' && custom) return custom
  return [fmt(start), fmt(today)]
}
