/**
 * GET /api/informes/cron
 *
 * Endpoint llamado por Vercel Cron cada hora.
 * Decide qué informes enviar según día/hora actual y los despacha.
 *
 * Configuración en vercel.json:
 *   { "crons": [{ "path": "/api/informes/cron", "schedule": "*\/30 * * * *" }] }
 *
 * Ejecutándose cada 30 min, comprueba si toca algún informe ahora.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { calcularInforme, type TipoInforme } from '../_lib/informes-calculo.js'
import { despacharInforme } from '../_lib/informes-envio.js'
import { supabaseAdmin } from '../_lib/supabase-admin.js'

interface VentanaInforme {
  tipo: TipoInforme
  // Función que decide si toca enviar AHORA
  toca: (now: Date) => boolean
}

// España (Madrid) — ajuste manual UTC+1/+2 según DST
function horaMadrid(d: Date): { dia: number; hora: number; minuto: number; diaMes: number } {
  const fmt = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
  })
  const partes = fmt.formatToParts(d)
  const hh = Number(partes.find(p => p.type === 'hour')?.value || 0)
  const mm = Number(partes.find(p => p.type === 'minute')?.value || 0)
  const diaMes = Number(partes.find(p => p.type === 'day')?.value || 1)
  // Para el día de la semana, usamos getUTCDay con offset
  const offset = (new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Madrid' })).getTime() - new Date(d.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()) / 3600000
  const localDay = new Date(d.getTime() + offset * 3600000).getUTCDay()
  return { dia: localDay, hora: hh, minuto: mm, diaMes }
}

const VENTANAS: VentanaInforme[] = [
  // Cierre diario: Lun-Sáb a las 23:30 (entre 23:30 y 23:59)
  {
    tipo: 'cierre_diario',
    toca: (n) => {
      const { dia, hora, minuto } = horaMadrid(n)
      return dia >= 1 && dia <= 6 && hora === 23 && minuto >= 30
    },
  },
  // Cobros lunes: Lunes 09:00-09:29
  {
    tipo: 'cobros_lunes',
    toca: (n) => {
      const { dia, hora, minuto } = horaMadrid(n)
      return dia === 1 && hora === 9 && minuto < 30
    },
  },
  // Cierre semanal: Domingo 23:30-23:59
  {
    tipo: 'cierre_semanal',
    toca: (n) => {
      const { dia, hora, minuto } = horaMadrid(n)
      return dia === 0 && hora === 23 && minuto >= 30
    },
  },
  // Cierre mensual: Día 1 del mes, 09:00-09:29
  {
    tipo: 'cierre_mensual',
    toca: (n) => {
      const { hora, minuto, diaMes } = horaMadrid(n)
      return diaMes === 1 && hora === 9 && minuto < 30
    },
  },
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron envía cabecera Authorization con el secreto CRON_SECRET
  const auth = req.headers.authorization || ''
  const secret = process.env.CRON_SECRET || ''
  if (secret && auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const ahora = new Date()
  const tocan = VENTANAS.filter(v => v.toca(ahora)).map(v => v.tipo)

  if (tocan.length === 0) {
    return res.status(200).json({ ok: true, ahora: ahora.toISOString(), mensaje: 'Ningún informe toca ahora' })
  }

  // Filtrar solo los que están activos en config
  const { data: configs } = await supabaseAdmin
    .from('notif_config')
    .select('tipo, activo')
    .in('tipo', tocan)
  const activos = (configs || []).filter(c => c.activo).map(c => c.tipo)

  const resultados: any[] = []
  for (const tipo of activos) {
    try {
      const contenido = await calcularInforme(tipo)
      const r = await despacharInforme(tipo, contenido)
      resultados.push({ tipo, ...r })
    } catch (err) {
      resultados.push({ tipo, error: (err as Error).message })
    }
  }

  return res.status(200).json({ ok: true, ahora: ahora.toISOString(), tocan, activos, resultados })
}
