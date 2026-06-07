import type { Page } from 'playwright'
import type { ArchivoDescargado, FechaRango, Portal } from '../tipos.ts'
import { capturarDescarga, verificarSesion } from './base.ts'

/**
 * Glovo Partners — reporte de liquidaciones/ventas.
 * Sesión vía storageState (`npm run login glovo`).
 *
 * TODO(selector): verificar URL y selectores contra el portal real.
 */
const URL_REPORTES = 'https://partners.glovoapp.com/'

export const glovo: Portal = {
  id: 'glovo',
  nombre: 'Glovo Partners',
  urlLogin: 'https://partners.glovoapp.com/',

  async descargar(page: Page, _fecha: FechaRango): Promise<ArchivoDescargado> {
    await page.goto(URL_REPORTES, { waitUntil: 'domcontentloaded' })
    await verificarSesion(page, 'glovo')

    // TODO(selector): navegar a Facturación/Liquidaciones, fijar rango = _fecha y exportar
    return capturarDescarga(page, async () => {
      await page.getByRole('button', { name: /descargar|download|export|exportar/i }).first().click()
    })
  },
}
