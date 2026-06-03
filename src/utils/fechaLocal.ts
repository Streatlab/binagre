/**
 * Formatea una Date a 'YYYY-MM-DD' en hora LOCAL (no UTC).
 * Evita el desfase de un día que produce toISOString() cuando la zona horaria
 * es UTC+1/+2 (España) y la hora local es anterior a medianoche UTC.
 */
export function fechaLocalStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
