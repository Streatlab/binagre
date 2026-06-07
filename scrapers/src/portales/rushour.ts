import type { Page } from 'playwright'
import type { ArchivoDescargado, FechaRango, Portal } from '../tipos.ts'
import { capturarDescarga, verificarSesion } from './base.ts'

/**
 * Rushour — factura del plan (software/agregador, gasto CTR-SW, no venta).
 * Sesión vía storageState (`npm run login rushour`).
 *
 * TODO(selector): confirmar URL real del portal de facturación de Rushour y los
 * selectores de descarga de la última factura.
 */
const URL_FACTURAS = 'https://app.rushour.io/'

export const rushour: Portal = {
  id: 'rushour',
  nombre: 'Rushour',
  urlLogin: 'https://app.rushour.io/',

  async descargar(page: Page, _fecha: FechaRango): Promise<ArchivoDescargado> {
    await page.goto(URL_FACTURAS, { waitUntil: 'domcontentloaded' })
    await verificarSesion(page, 'rushour')

    // TODO(selector): abrir Facturas y descargar la última (PDF)
    return capturarDescarga(page, async () => {
      await page.getByRole('button', { name: /descargar|download|factura|invoice/i }).first().click()
    })
  },
}
