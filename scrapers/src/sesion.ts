import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DIR_SESIONES } from './config.ts'
import type { PlataformaId } from './tipos.ts'

/** Nombre del GitHub Secret / variable de entorno por portal. */
const ENV_KEY: Record<PlataformaId, string> = {
  uber: 'UBER_STORAGE_STATE',
  glovo: 'GLOVO_STORAGE_STATE',
  justeat: 'JUSTEAT_STORAGE_STATE',
  rushour: 'RUSHOUR_STORAGE_STATE',
  bbva: 'BBVA_STORAGE_STATE',
}

export function envKeySesion(portal: PlataformaId): string {
  return ENV_KEY[portal]
}

/**
 * Devuelve el storageState (objeto Playwright) de un portal.
 * Prioridad: variable de entorno (base64 JSON) → fichero local `.sesiones/<portal>.json`.
 * Devuelve `undefined` si no hay sesión guardada.
 */
export async function cargarSesion(portal: PlataformaId): Promise<unknown | undefined> {
  const b64 = process.env[ENV_KEY[portal]]
  if (b64) {
    try {
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))
    } catch {
      throw new Error(`El secret ${ENV_KEY[portal]} no es un storageState válido (base64 de JSON)`)
    }
  }
  const fichero = path.join(DIR_SESIONES, `${portal}.json`)
  try {
    return JSON.parse(await fs.readFile(fichero, 'utf-8'))
  } catch {
    return undefined
  }
}

/** Guarda el storageState en `.sesiones/<portal>.json` y devuelve la ruta. */
export async function guardarSesion(portal: PlataformaId, state: unknown): Promise<string> {
  await fs.mkdir(DIR_SESIONES, { recursive: true })
  const fichero = path.join(DIR_SESIONES, `${portal}.json`)
  await fs.writeFile(fichero, JSON.stringify(state, null, 2), 'utf-8')
  return fichero
}
