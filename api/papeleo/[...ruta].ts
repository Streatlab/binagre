// PUERTA 1/4 — /api/papeleo/*  (facturas, OCR, conciliación, importación de plataformas)
// Única Serverless Function para todo Papeleo. Los handlers reales viven en
// api/_puertas/* (los archivos con _ no cuentan para el límite de funciones del
// plan Hobby de Vercel). Las URLs antiguas (/api/facturas, /api/titulares, ...)
// siguen funcionando vía rewrites en vercel.json.
// REGLA PERMANENTE: ninguna función API nueva como archivo suelto — siempre un
// handler en _puertas + una rama aquí.
// FIX 20-jul: en los rewrites de Vercel, req.url dentro de la función conserva la
// URL ORIGINAL (p.ej. /api/facturas), no el destino (/api/papeleo/facturas).
// El parser antiguo solo quitaba el prefijo /api/papeleo/ → toda URL antigua
// reescrita llegaba como ['api','facturas'] y caía en 404 ("puerta papeleo: api").
// Era la causa real del "catch-all no captura el 2º segmento". Ahora el parser
// normaliza ambos formatos.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import facturasIndex from '../_puertas/facturas-index.js'
import facturasId from '../_puertas/facturas-id.js'
import facturasIdAction from '../_puertas/facturas-id-action.js'
import bootstrapOcr from '../_puertas/bootstrap-ocr.js'
import checklists from '../_puertas/checklists.js'
import debugTexto from '../_puertas/debug-texto.js'
import ocrCleanup from '../_puertas/ocr-cleanup.js'
import titulares from '../_puertas/titulares.js'
import conciliacionImportarEmilio from '../_puertas/conciliacion-importar-emilio.js'
import importarPlataforma from '../_puertas/importar-plataforma.js'
import escandalloAuto from '../_puertas/escandallo-auto.js'
import imprimir from '../_puertas/imprimir.js'

// Config unificada: el máximo que necesita cualquier handler de esta puerta
// (facturas-index: uploads 20mb + reprocesados largos de hasta 300s).
export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 300,
}

function segmentos(req: VercelRequest): string[] {
  const pathname = (req.url || '').split('?')[0]
  let segs = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (segs[0] === 'api') segs = segs.slice(1)      // URL original de un rewrite
  if (segs[0] === 'papeleo') segs = segs.slice(1)  // URL directa a la puerta
  return segs
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const [a, b, c] = segmentos(req)

  if (a === 'facturas') {
    if (!b) return facturasIndex(req, res)
    if (!c) { req.query.id = b; return facturasId(req, res) }
    req.query.id = b
    req.query.action = c
    return facturasIdAction(req, res)
  }
  if (a === 'bootstrap-ocr') return bootstrapOcr(req, res)
  if (a === 'checklists') return checklists(req, res)
  if (a === 'debug-texto') return debugTexto(req, res)
  if (a === 'ocr-cleanup') return ocrCleanup(req, res)
  if (a === 'ocr-queue') { req.query.fn = 'queue'; return ocrCleanup(req, res) }
  if (a === 'titulares') return titulares(req, res)
  if (a === 'imprimir') return imprimir(req, res)
  if (a === 'conciliacion' && b === 'importar-emilio') return conciliacionImportarEmilio(req, res)
  if (a === 'conciliacion' && (req.query.ruta2 === 'importar-emilio')) return conciliacionImportarEmilio(req, res)
  if (a === 'importar' && (b === 'plataforma' || !b)) return importarPlataforma(req, res)
  if (a === 'escandallo-auto') {
    if (b) req.query.action = b
    return escandalloAuto(req, res)
  }

  return res.status(404).json({ error: `Ruta no encontrada en puerta papeleo: ${a || '(vacía)'}` })
}
