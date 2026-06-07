import type { Page } from 'playwright'
import type { ArchivoDescargado, FechaRango, Portal } from '../tipos.ts'
import { capturarDescarga, verificarSesion } from './base.ts'

/**
 * Uber Eats Manager — reporte de pagos/ventas.
 * Sesión vía storageState; el login con 2FA se hace una vez (`npm run login uber`).
 *
 * TODO(selector): la UI de Uber cambia con frecuencia. Verificar URL y selectores
 * contra el portal real con `npm run login uber` y el inspector de Playwright.
 */
const URL_REPORTES = 'https://merchants.ubereats.com/manager/reports'

export const uber: Portal = {
  id: 'uber',
  nombre: 'Uber Eats Manager',
  urlLogin: 'https://merchants.ubereats.com/',

  async descargar(page: Page, _fecha: FechaRango): Promise<ArchivoDescargado> {
    await page.goto(URL_REPORTES, { waitUntil: 'domcontentloaded' })
    await verificarSesion(page, 'uber')

    // TODO(selector): seleccionar tipo de reporte (Pagos) y rango = _fecha.desde.._fecha.hasta
    // TODO(selector): disparar la exportación/descarga
    return capturarDescarga(page, async () => {
      await page.getByRole('button', { name: /descargar|download|export|exportar/i }).first().click()
    })
  },
}
