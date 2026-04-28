// Festivos nacionales + Madrid 2026 y 2027 (hard-coded, fuente oficial BOE/CAM)
export const FESTIVOS_MADRID: string[] = [
  // 2026
  '2026-01-01', // Año Nuevo
  '2026-01-06', // Reyes Magos
  '2026-04-02', // Jueves Santo
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajo
  '2026-05-02', // Día de la Comunidad de Madrid
  '2026-05-15', // San Isidro Labrador (Madrid)
  '2026-08-15', // Asunción de la Virgen
  '2026-10-12', // Fiesta Nacional (Hispanidad)
  '2026-11-01', // Todos los Santos
  '2026-11-09', // La Almudena (Madrid)
  '2026-12-07', // puente Constitución (lunes)
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
  // 2027
  '2027-01-01', // Año Nuevo
  '2027-01-06', // Reyes Magos
  '2027-03-25', // Jueves Santo
  '2027-03-26', // Viernes Santo
  '2027-05-01', // Día del Trabajo
  '2027-05-03', // Día de la Comunidad de Madrid (traslado)
  '2027-05-15', // San Isidro Labrador
  '2027-08-16', // Asunción (traslado lunes)
  '2027-10-12', // Fiesta Nacional
  '2027-11-01', // Todos los Santos
  '2027-11-09', // La Almudena
  '2027-12-08', // Inmaculada Concepción
  '2027-12-25', // Navidad
]

export function esFestivo(fecha: string): boolean {
  return FESTIVOS_MADRID.includes(fecha)
}
