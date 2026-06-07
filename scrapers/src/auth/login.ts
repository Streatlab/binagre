import { chromium } from 'playwright'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { PORTALES } from '../portales/index.ts'
import { guardarSesion, envKeySesion } from '../sesion.ts'
import type { PlataformaId } from '../tipos.ts'

/**
 * Genera la sesión (storageState) de un portal.
 * Abre un navegador VISIBLE para que Rubén inicie sesión a mano (incluido el 2FA),
 * guarda las cookies en `.sesiones/<portal>.json` e imprime el valor en base64
 * listo para pegar como GitHub Secret.
 *
 * Uso:  npm run login uber   (o glovo | justeat | rushour | bbva)
 */
async function main(): Promise<void> {
  const id = process.argv[2] as PlataformaId
  const portal = PORTALES[id]
  if (!portal) {
    console.error(`Portal inválido. Usa uno de: ${Object.keys(PORTALES).join(', ')}`)
    process.exit(1)
  }

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  await page.goto(portal.urlLogin, { waitUntil: 'domcontentloaded' })

  console.log(`\n▶ Inicia sesión en ${portal.nombre} en la ventana abierta (incluye el 2FA).`)
  const rl = createInterface({ input: stdin, output: stdout })
  await rl.question('Cuando el login esté COMPLETO, pulsa ENTER aquí para guardar la sesión... ')
  rl.close()

  const state = await context.storageState()
  const fichero = await guardarSesion(id, state)
  await browser.close()

  const b64 = Buffer.from(JSON.stringify(state)).toString('base64')
  console.log(`\n✔ Sesión guardada en ${fichero}`)
  console.log(`\nGitHub Secret → ${envKeySesion(id)} (pega el base64 de abajo):\n`)
  console.log(b64)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
