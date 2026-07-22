// PUERTA 3/4 — /api/operaciones/*  (POS, punto de equilibrio, equipo, nóminas)
// Única Serverless Function para Operaciones. Los handlers reales viven en
// api/_puertas/*. Las URLs antiguas (/api/pos/*, /api/pe/*, /api/equipo/*,
// /api/nominas/*) siguen funcionando vía rewrites en vercel.json.
// REGLA PERMANENTE: ninguna función API nueva como archivo suelto — siempre un
// handler en _puertas + una rama aquí.
// FIX 22-jul: en los rewrites de Vercel, req.url dentro de la función conserva la
// URL ORIGINAL (p.ej. /api/equipo/subir), no el destino (/api/operaciones/equipo/subir).
// El parser antiguo solo quitaba el prefijo /api/operaciones/ → toda URL antigua
// reescrita llegaba como ['api','equipo','subir'] y caía en 404. Mismo fallo que
// ya se corrigió en la puerta papeleo el 20-jul. Ahora normaliza ambos formatos.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import posPedidos from '../_puertas/pos-pedidos.js'
import peAction from '../_puertas/pe-action.js'
import equipoReintentarDrive from '../_puertas/equipo-reintentar-drive.js'
import equipoReprocessRevision from '../_puertas/equipo-reprocess-revision.js'
import equipoSubir from '../_puertas/equipo-subir.js'
import equipoRevisionResolver from '../_puertas/equipo-revision-resolver.js'
import equipoPdfFirmado from '../_puertas/equipo-pdf-firmado.js'
import nominasSubir from '../_puertas/nominas-subir.js'
import nominasIdAction from '../_puertas/nominas-id-action.js'
import nominasResumenSubir from '../_puertas/nominas-resumen-subir.js'
import nominasSegsocialSubir from '../_puertas/nominas-segsocial-subir.js'
import nominasBarrido from '../_puertas/nominas-barrido.js'

// Config unificada: subidas de documentos hasta 20mb y lecturas con IA de hasta 60s.
export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

function segmentos(req: VercelRequest): string[] {
  const pathname = (req.url || '').split('?')[0]
  let segs = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (segs[0] === 'api') segs = segs.slice(1)          // URL original de un rewrite
  if (segs[0] === 'operaciones') segs = segs.slice(1)  // URL directa a la puerta
  return segs
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const [a, b, c, d] = segmentos(req)

  if (a === 'pos' && b === 'pedidos') return posPedidos(req, res)

  if (a === 'pe' && b) {
    req.query.action = b
    return peAction(req, res)
  }

  if (a === 'equipo') {
    if (b === 'reintentar-drive') return equipoReintentarDrive(req, res)
    if (b === 'reprocess-revision') return equipoReprocessRevision(req, res)
    if (b === 'subir') return equipoSubir(req, res)
    if (b === 'pdf-firmado') return equipoPdfFirmado(req, res)
    if (b === 'revision' && c && d === 'resolver') {
      req.query.id = c
      return equipoRevisionResolver(req, res)
    }
  }

  if (a === 'nominas') {
    if (b === 'subir') return nominasSubir(req, res)
    if (b === 'resumen' && c === 'subir') return nominasResumenSubir(req, res)
    if (b === 'segsocial' && c === 'subir') return nominasSegsocialSubir(req, res)
    if (b === 'barrido') return nominasBarrido(req, res)
    if (b && c) {
      req.query.id = b
      req.query.action = c
      return nominasIdAction(req, res)
    }
  }

  return res.status(404).json({ error: `Ruta no encontrada en puerta operaciones: ${a || '(vacía)'}` })
}
