import type { Page } from 'playwright'
import type { ArchivoDescargado, FechaRango, Portal } from '../tipos.ts'
import { capturarDescarga, verificarSesion } from './base.ts'

/**
 * BBVA — exportación de movimientos (Excel) → pipeline de conciliación bancaria.
 * El Excel descargado lo parsea `api/_lib/parserBBVA.ts` vía
 * `/api/conciliacion/importar-emilio`.
 * Sesión vía storageState (`npm run login bbva`).
 *
 * AVISO: la banca online es el portal más frágil (2FA frecuente, anti-bot fuerte).
 * Es probable que la sesión caduque a menudo y haya que regenerarla.
 *
 * TODO(selector): confirmar URL de banca de empresa y los selectores de
 * "Exportar movimientos a Excel" con rango = _fecha.
 */
const URL_MOVIMIENTOS = 'https://web.bbva.es/'

export const bbva: Portal = {
  id: 'bbva',
  nombre: 'BBVA',
  urlLogin: 'https://web.bbva.es/',

  async descargar(page: Page, _fecha: FechaRango): Promise<ArchivoDescargado> {
    await page.goto(URL_MOVIMIENTOS, { waitUntil: 'domcontentloaded' })
    await verificarSesion(page, 'bbva')

    // TODO(selector): navegar a Cuentas → Movimientos, fijar rango = _fecha y exportar a Excel
    return capturarDescarga(page, async () => {
      await page.getByRole('button', { name: /exportar|descargar|excel|download/i }).first().click()
    })
  },
}
