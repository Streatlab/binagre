/**
 * GET /api/informes/cron
 *
 * Endpoint llamado por Vercel Cron. Decide qué informes enviar según
 * día/hora actual en Madrid y los despacha.
 *
 * Los crons de vercel.json se programan en UTC. Para cubrir invierno (UTC+1)
 * y verano (UTC+2) cada informe tiene DOS disparos UTC; la ventana horaria
 * de Madrid de aquí abajo filtra y solo uno de los dos coincide.
 *
 * Horarios Madrid:
 *  - resumen_manana: todos los días 08:00 (email)
 *  - cobros_lunes:   lunes 09:00
 *  - cierre_mensual: día 1, 09:00
 *  - pulso:          todos los días 16:30 (WhatsApp)
 *  - cierre_diario:  lun-sáb 23:29 (WhatsApp)
 *  - cierre_semanal: domingo 23:30
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

// España (Madrid) — hora local real vía Intl (cubre DST automáticamente)
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
  // Resumen de la mañana: todos los días, 08:00-08:29
  {
    tipo: 'resumen_manana',
    toca: (n) => {
      const { hora, minuto } = horaMadrid(n)
      return hora === 8 && minuto < 30
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
  // Cierre mensual: Día 1 del mes, 09:00-09:29
  {
    tipo: 'cierre_mensual',
    toca: (n) => {
      const { hora, minuto, diaMes } = horaMadrid(n)
      return diaMes === 1 && hora === 9 && minuto < 30
    },
  },
  // Pulso de la tarde: todos los días, 16:30-16:59
  {
    tipo: 'pulso',
    toca: (n) => {
      const { hora, minuto } = horaMadrid(n)
      return hora === 16 && minuto >= 30
    },
  },
  // Cierre diario: Lun-Sáb 23:00-23:59 (disparo a las 23:29)
  {
    tipo: 'cierre_diario',
    toca: (n) => {
      const { dia, hora } = horaMadrid(n)
      return dia >= 1 && dia <= 6 && hora === 23
    },
  },
  // Cierre semanal: Domingo 23:00-23:59 (disparo a las 23:30)
  {
    tipo: 'cierre_semanal',
    toca: (n) => {
      const { dia, hora } = horaMadrid(n)
      return dia === 0 && hora === 23
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

  // Filtrar solo los que están activos en config y que NO se hayan enviado ya hoy
  // (protección anti-duplicados si el cron se ejecuta dos veces en la ventana)
  const { data: configs } = await supabaseAdmin
    .from('notif_config')
    .select('tipo, activo, ultima_ejecucion')
    .in('tipo', tocan)
  const activos = (configs || [])
    .filter(c => c.activo)
    .filter(c => {
      if (!c.ultima_ejecucion) return true
      const ult = new Date(c.ultima_ejecucion)
      // Si el último envío fue hace menos de 2 horas, no repetir
      return ahora.getTime() - ult.getTime() > 2 * 3600 * 1000
    })
    .map(c => c.tipo as TipoInforme)

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
