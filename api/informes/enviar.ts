/**
 * POST /api/informes/enviar
 *
 * Body: { tipo: 'cierre_diario' | 'cobros_lunes' | 'cierre_semanal' | 'cierre_mensual' }
 *
 * Calcula el informe del tipo indicado y lo envía a todos los destinatarios
 * activos por los canales configurados.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { calcularInforme, type TipoInforme } from '../_lib/informes-calculo.js'
import { despacharInforme } from '../_lib/informes-envio.js'

const TIPOS_VALIDOS: TipoInforme[] = ['cierre_diario', 'cobros_lunes', 'cierre_semanal', 'cierre_mensual']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = (req.body || {}) as { tipo?: string }
  const tipo = body.tipo as TipoInforme | undefined

  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de informe inválido', validos: TIPOS_VALIDOS })
  }

  try {
    const contenido = await calcularInforme(tipo)
    const resultado = await despacharInforme(tipo, contenido)
    return res.status(200).json({
      tipo,
      enviados: resultado.enviados,
      fallidos: resultado.fallidos,
      detalle: resultado.detalle,
    })
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message })
  }
}
