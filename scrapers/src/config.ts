import type { PlataformaId } from './tipos.ts'

/** Base URL del ERP donde viven los endpoints de importación. */
export const IMPORT_BASE = process.env.IMPORT_BASE ?? 'https://binagre.vercel.app'

/** Secreto opcional para autenticar la importación (cabecera x-scraper-secret). */
export const IMPORT_SECRET = process.env.IMPORT_SECRET ?? ''

/** Portales activos (coma-separados en SCRAPER_PORTALES). Por defecto, todos. */
export const PORTALES_ACTIVOS: PlataformaId[] = (process.env.SCRAPER_PORTALES ?? 'uber,glovo,justeat,rushour,bbva')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean) as PlataformaId[]

/**
 * Endpoint de importación por portal.
 * Uber/Glovo/JustEat/Rushour comparten el pipeline de plataformas;
 * BBVA usa el de conciliación bancaria.
 */
export const ENDPOINT_IMPORT: Record<PlataformaId, string> = {
  uber: '/api/importar/plataforma',
  glovo: '/api/importar/plataforma',
  justeat: '/api/importar/plataforma',
  rushour: '/api/importar/plataforma',
  bbva: '/api/conciliacion/importar-emilio',
}

/** Directorio donde se guardan/cargan los storageState (cookies) en local. */
export const DIR_SESIONES = process.env.SCRAPER_SESIONES_DIR ?? '.sesiones'
