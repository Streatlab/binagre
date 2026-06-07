import type { Page } from 'playwright'

export type PlataformaId = 'uber' | 'glovo' | 'justeat' | 'rushour' | 'bbva'

export interface ArchivoDescargado {
  buffer: Buffer
  nombre: string
  mimeType: string
}

export interface FechaRango {
  /** YYYY-MM-DD del primer día a extraer (por defecto, ayer en hora de Madrid). */
  desde: string
  /** YYYY-MM-DD del último día a extraer. */
  hasta: string
}

export interface Portal {
  id: PlataformaId
  nombre: string
  /** URL de login del portal, usada por el script de login para generar la sesión. */
  urlLogin: string
  /** Descarga el reporte del rango indicado y devuelve el archivo en memoria. */
  descargar(page: Page, fecha: FechaRango): Promise<ArchivoDescargado>
}

export interface ResultadoPortal {
  portal: PlataformaId
  ok: boolean
  archivo?: string
  mensaje?: string
  importResp?: unknown
}
