/**
 * Lógica pura de las horas de «posponer» del botón Resolver pendientes.
 * Vive aparte del componente para poder cubrirla con tests: la regla de las
 * bandas prohibidas la marcó el prompt en mayúsculas («PROHIBIDO ofrecer horas
 * dentro de esas bandas» — cuando trabajan robots, cartero, informes y
 * WhatsApp) y un descuido futuro no puede colar una hora encima de ellas.
 * Hora local = hora Madrid (app de un solo usuario operando desde España).
 */

export const HORAS_FIJAS = ['03:00', '11:00', '13:00', '23:30'] as const

export interface BandaProhibida { desde: string; hasta: string; motivo: string }

export const BANDAS_PROHIBIDAS: BandaProhibida[] = [
  { desde: '01:50', hasta: '02:10', motivo: 'verificación nocturna' },
  { desde: '04:00', hasta: '07:15', motivo: 'robots, cartero e informes' },
  { desde: '14:15', hasta: '15:45', motivo: 'corte de turno' },
  { desde: '21:15', hasta: '22:45', motivo: 'corte de turno y WhatsApp' },
]

export function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => Number(n) || 0)
  return h * 60 + m
}

/** Devuelve el motivo de la banda con la que choca la hora, o null si es válida. */
export function bandaQueChoca(hhmm: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return 'formato de hora inválido'
  const [h, m] = hhmm.split(':').map(Number)
  if (h > 23 || m > 59) return 'formato de hora inválido' // 25:00, 12:99… no son horas reales
  const t = aMinutos(hhmm)
  for (const b of BANDAS_PROHIBIDAS) {
    if (t >= aMinutos(b.desde) && t <= aMinutos(b.hasta)) return b.motivo
  }
  return null
}

/**
 * Próxima ocurrencia de esa hora: hoy si aún no ha pasado, si no mañana.
 * `ahora` es inyectable para poder testear sin depender del reloj.
 */
export function proximaOcurrencia(hhmm: string, ahora: Date = new Date()): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const objetivo = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), h, m, 0, 0)
  if (objetivo.getTime() <= ahora.getTime()) objetivo.setDate(objetivo.getDate() + 1)
  return objetivo
}
