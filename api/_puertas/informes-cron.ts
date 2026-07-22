/**
 * GET /api/informes/cron
 *
 * Endpoint llamado por Vercel Cron. Decide qué informes enviar según
 * día/hora actual en Madrid y los despacha.
 *
 * Consolidado (jul 2026):
 *  - resumen_manana: todos los días 08:00 (email). Los LUNES incluye además los
 *    cobros de la semana, y el DÍA 1 de mes incluye el cierre mensual — todo en
 *    el mismo correo, sin envíos extra a las 09:00.
 *  - pulso:          todos los días 16:30 (WhatsApp)
 *  - cierre_diario:  lun-sáb 23:29 (WhatsApp)
 *  - cierre_semanal: domingo 23:30 — lleva el cierre del propio domingo + la semana
 *
 * Los crons de vercel.json se programan en UTC, ajustados a hora de VERANO. En el
 * cambio de hora se desplazan 1h: por eso, la VÍSPERA del cambio, este endpoint
 * añade a los informes un aviso para reajustar (ver esVisperaCambioHora).
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

// ── Aviso de cambio de hora ────────────────────────────────────────────────
// Devuelve la fecha (Madrid) de un Date como {y,m,day}
function madridYMD(d: Date): { y: number; m: number; day: number } {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
  const [y, m, day] = s.split('-').map(Number)
  return { y, m, day }
}
// Día (1-31) del último domingo del mes m (1-12) del año y
function ultimoDomingo(y: number, m: number): number {
  const ultDia = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const dowUlt = new Date(Date.UTC(y, m - 1, ultDia)).getUTCDay() // 0=domingo
  return ultDia - dowUlt
}
// ¿Mañana (Madrid) es el último domingo de marzo o de octubre? = cambio de hora en la UE
function esVisperaCambioHora(ahora: Date): boolean {
  const manana = new Date(ahora.getTime() + 24 * 3600 * 1000)
  const { y, m, day } = madridYMD(manana)
  if (m !== 3 && m !== 10) return false
  return day === ultimoDomingo(y, m)
}
const LINEA_AVISO_DST = [
  '',
  '━━━━━━━━━━━━━━━━━',
  '⏰ *OJO: mañana cambia la hora en España.*',
  'Los informes están fijados a hora de verano; avisa a Claude para',
  'reajustar los horarios (o pasar a Vercel Pro y dejarlo clavado todo el año).',
].join('\n')

const VENTANAS: VentanaInforme[] = [
  // Resumen de la mañana: todos los días, 08:00-08:29 (los lunes lleva cobros; el día 1, cierre mensual)
  {
    tipo: 'resumen_manana',
    toca: (n) => {
      const { hora, minuto } = horaMadrid(n)
      return hora === 8 && minuto < 30
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
  // Cierre semanal: Domingo 23:00-23:59 (disparo a las 23:30) — incluye el cierre del domingo
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

  const avisoDST = esVisperaCambioHora(ahora)

  const resultados: any[] = []
  for (const tipo of activos) {
    try {
      const contenido = await calcularInforme(tipo)
      if (avisoDST) {
        contenido.contenido_whatsapp += `\n${LINEA_AVISO_DST}`
        contenido.contenido_email += `\n${LINEA_AVISO_DST}`
      }
      const r = await despacharInforme(tipo, contenido)
      resultados.push({ tipo, ...r })
    } catch (err) {
      resultados.push({ tipo, error: (err as Error).message })
    }
  }

  return res.status(200).json({ ok: true, ahora: ahora.toISOString(), tocan, activos, aviso_cambio_hora: avisoDST, resultados })
}
