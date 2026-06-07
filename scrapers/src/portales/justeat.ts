import type { Page } from 'playwright'
import type { ArchivoDescargado, FechaRango, Portal } from '../tipos.ts'
import { capturarDescarga, verificarSesion } from './base.ts'

/**
 * Just Eat Partner Hub — reporte de pedidos/facturación.
 * Sesión vía storageState (`npm run login justeat`).
 *
 * TODO(selector): verificar URL y selectores contra el portal real.
 * Nota: el parser Just Eat del ERP está en estado stub — al subir el primer
 * reporte real, completar `api/_lib/parsers/justEatParser.ts`.
 */
const URL_REPORTES = 'https://partner.just-eat.es/'

export const justeat: Portal = {
  id: 'justeat',
  nombre: 'Just Eat Partner Hub',
  urlLogin: 'https://partner.just-eat.es/',

  async descargar(page: Page, _fecha: FechaRango): Promise<ArchivoDescargado> {
    await page.goto(URL_REPORTES, { waitUntil: 'domcontentloaded' })
    await verificarSesion(page, 'justeat')

    // TODO(selector): navegar a Informes, fijar rango = _fecha y exportar
    return capturarDescarga(page, async () => {
      await page.getByRole('button', { name: /descargar|download|export|exportar/i }).first().click()
    })
  },
}
