// Festivos nacionales + Madrid 2026 y 2027 (hard-coded, fuente oficial BOE/CAM/Ayto. Madrid)
// Mapa fecha -> nombre del festivo, para mostrar el nombre al señalarlo.
export const FESTIVOS_MADRID_NOMBRE: Record<string, string> = {
  // 2026 — Comunidad de Madrid (12) + locales ciudad de Madrid (San Isidro, La Almudena)
  '2026-01-01': 'Año Nuevo',
  '2026-01-06': 'Epifanía del Señor (Reyes)',
  '2026-04-02': 'Jueves Santo',
  '2026-04-03': 'Viernes Santo',
  '2026-05-01': 'Fiesta del Trabajo',
  '2026-05-02': 'Día de la Comunidad de Madrid',
  '2026-05-15': 'San Isidro Labrador (local Madrid)',
  '2026-08-15': 'Asunción de la Virgen',
  '2026-10-12': 'Fiesta Nacional de España',
  '2026-11-02': 'Todos los Santos (traslado)',
  '2026-11-09': 'Ntra. Sra. de la Almudena (local Madrid)',
  '2026-12-07': 'Día de la Constitución (traslado)',
  '2026-12-08': 'Inmaculada Concepción',
  '2026-12-25': 'Natividad del Señor',
  // 2027
  '2027-01-01': 'Año Nuevo',
  '2027-01-06': 'Epifanía del Señor (Reyes)',
  '2027-03-25': 'Jueves Santo',
  '2027-03-26': 'Viernes Santo',
  '2027-05-01': 'Fiesta del Trabajo',
  '2027-05-03': 'Día de la Comunidad de Madrid (traslado)',
  '2027-05-15': 'San Isidro Labrador (local Madrid)',
  '2027-08-16': 'Asunción de la Virgen (traslado)',
  '2027-10-12': 'Fiesta Nacional de España',
  '2027-11-01': 'Todos los Santos',
  '2027-11-09': 'Ntra. Sra. de la Almudena (local Madrid)',
  '2027-12-08': 'Inmaculada Concepción',
  '2027-12-25': 'Natividad del Señor',
}

export const FESTIVOS_MADRID: string[] = Object.keys(FESTIVOS_MADRID_NOMBRE)

export function esFestivo(fecha: string): boolean {
  return fecha in FESTIVOS_MADRID_NOMBRE
}

export function nombreFestivo(fecha: string): string | null {
  return FESTIVOS_MADRID_NOMBRE[fecha] ?? null
}
