/**
 * festivos.ts — Días festivos nacionales + Comunidad de Madrid 2026
 * Lee la tabla `festivos` de Supabase en runtime. Si está vacía o hay error,
 * usa el fallback hardcodeado.
 */

export const FESTIVOS_2026: string[] = [
  '2026-01-01', // Año Nuevo
  '2026-01-06', // Reyes Magos
  '2026-04-02', // Jueves Santo
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajador
  '2026-05-02', // Comunidad de Madrid
  '2026-08-15', // Asunción de la Virgen
  '2026-10-12', // Fiesta Nacional
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
]

function toDateStr(d: Date): string {
  // YYYY-MM-DD sin UTC shift
  return d.toLocaleDateString('sv')
}

export function siguienteDiaHabil(fecha: Date, festivos: Set<string> = new Set(FESTIVOS_2026)): Date {
  const f = new Date(fecha)
  while (f.getDay() === 0 || f.getDay() === 6 || festivos.has(toDateStr(f))) {
    f.setDate(f.getDate() + 1)
  }
  return f
}

export function fechaCobroUber(semanaLunes: Date, festivos: Set<string> = new Set(FESTIVOS_2026)): Date {
  // Uber: semana L-D → paga el lunes siguiente; si festivo → siguiente día hábil
  const lunes = new Date(semanaLunes)
  lunes.setDate(lunes.getDate() + 7)
  return siguienteDiaHabil(lunes, festivos)
}

export function fechaCobroGlovo(fecha: Date, festivos: Set<string> = new Set(FESTIVOS_2026)): Date {
  // 1-15 → día 5 mes sig; 16-fin → día 20 mes sig
  const mes = fecha.getMonth()
  const anio = fecha.getFullYear()
  const dia = fecha.getDate()
  if (dia <= 15) {
    return siguienteDiaHabil(new Date(anio, mes + 1, 5), festivos)
  } else {
    return siguienteDiaHabil(new Date(anio, mes + 1, 20), festivos)
  }
}

export function fechaCobroJustEat(fecha: Date, festivos: Set<string> = new Set(FESTIVOS_2026)): Date {
  // 1-15 → día 20 mismo mes; 16-fin → día 5 mes sig
  const mes = fecha.getMonth()
  const anio = fecha.getFullYear()
  const dia = fecha.getDate()
  if (dia <= 15) {
    return siguienteDiaHabil(new Date(anio, mes, 20), festivos)
  } else {
    return siguienteDiaHabil(new Date(anio, mes + 1, 5), festivos)
  }
}
