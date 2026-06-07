import { chromium } from 'playwright'
import type { BrowserContextOptions } from 'playwright'
import { PORTALES_ACTIVOS } from './config.ts'
import { PORTALES } from './portales/index.ts'
import { ayerMadrid } from './portales/base.ts'
import { cargarSesion } from './sesion.ts'
import { importar } from './importar.ts'
import type { ResultadoPortal } from './tipos.ts'

/**
 * Orquestador diario. Recorre los portales activos:
 *   1. Carga la sesión (storageState).
 *   2. Descarga el reporte de ayer.
 *   3. Lo reenvía al endpoint de importación del ERP.
 * Un fallo en un portal NO detiene a los demás. Termina en rojo si hubo algún fallo.
 */
async function main(): Promise<void> {
  const fecha = ayerMadrid()
  const resultados: ResultadoPortal[] = []

  const browser = await chromium.launch({ headless: true })
  try {
    for (const id of PORTALES_ACTIVOS) {
      const portal = PORTALES[id]
      if (!portal) {
        resultados.push({ portal: id, ok: false, mensaje: 'Portal desconocido' })
        continue
      }

      try {
        const storageState = await cargarSesion(id)
        if (!storageState) {
          throw new Error(`Sin sesión guardada — ejecuta \`npm run login ${id}\``)
        }

        const context = await browser.newContext({
          storageState: storageState as BrowserContextOptions['storageState'],
          acceptDownloads: true,
        })
        try {
          const page = await context.newPage()
          const archivo = await portal.descargar(page, fecha)
          const importResp = await importar(id, archivo)
          resultados.push({ portal: id, ok: true, archivo: archivo.nombre, importResp })
        } finally {
          await context.close()
        }
      } catch (err) {
        resultados.push({ portal: id, ok: false, mensaje: (err as Error).message })
      }
    }
  } finally {
    await browser.close()
  }

  console.log(JSON.stringify({ fecha, resultados }, null, 2))

  const fallos = resultados.filter((r) => !r.ok)
  if (fallos.length > 0) {
    console.error(`\n${fallos.length} portal(es) con fallo: ${fallos.map((f) => f.portal).join(', ')}`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
