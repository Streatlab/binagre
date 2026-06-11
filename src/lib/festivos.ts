// Festivos España 2026 — nacionales + Comunidad de Madrid
function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export const FESTIVOS_2026: string[] = [
  '2026-01-01', // Año nuevo
  '2026-01-06', // Reyes
  '2026-04-02', // Jueves Santo (Madrid)
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Trabajo
  '2026-05-02', // Comunidad de Madrid
  '2026-08-15', // Asunción
  '2026-10-12', // Hispanidad
  '2026-12-08', // Inmaculada
  '2026-12-25', // Navidad
]

export function esFestivo(fecha: Date): boolean {
  return FESTIVOS_2026.includes(toDateStr(fecha))
}

export function esFinDeSemana(fecha: Date): boolean {
  const d = fecha.getDay()
  return d === 0 || d === 6
}

export function siguienteDiaHabil(fecha: Date): Date {
  const f = new Date(fecha)
  f.setDate(f.getDate() + 1)
  while (esFinDeSemana(f) || esFestivo(f)) {
    f.setDate(f.getDate() + 1)
  }
  return f
}

export function fechaCobroUber(semanaLunes: Date): Date {
  const lunes = new Date(semanaLunes)
  lunes.setDate(lunes.getDate() + 7)
  if (esFinDeSemana(lunes) || esFestivo(lunes)) return siguienteDiaHabil(lunes)
  return lunes
}

export function fechaCobroGlovo(fechaVenta: Date): Date {
  const dia = fechaVenta.getDate()
  const mes = fechaVenta.getMonth()
  const anio = fechaVenta.getFullYear()
  const candidato = dia <= 15
    ? new Date(anio, mes + 1, 5)
    : new Date(anio, mes + 1, 20)
  if (esFinDeSemana(candidato) || esFestivo(candidato)) return siguienteDiaHabil(candidato)
  return candidato
}

export function fechaCobroJustEat(fechaVenta: Date): Date {
  const dia = fechaVenta.getDate()
  const mes = fechaVenta.getMonth()
  const anio = fechaVenta.getFullYear()
  const candidato = dia <= 15
    ? new Date(anio, mes, 20)
    : new Date(anio, mes + 1, 5)
  if (esFinDeSemana(candidato) || esFestivo(candidato)) return siguienteDiaHabil(candidato)
  return candidato
}
