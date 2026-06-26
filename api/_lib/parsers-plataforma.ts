// parsers-plataforma.ts — Lectura de "resúmenes de pago" de plataformas que
// llegan al buzón facturasstreat@gmail.com en el CUERPO del correo (no adjunto).
// v1: Uber Eats. Glovo y Just Eat se añaden con un ejemplo real de cada uno.
//
// Salida normalizada al esquema de *_liquidaciones (uber/glovo/justeat).
//
// ⚠️  UBER BLOQUEADO 22-jun-2026:
//     El parser de correo Uber generaba datos FALSOS (referencias inventadas,
//     ads/promos sin fuente real). Se bloqueó tras detectar 33 filas falsas en
//     uber_liquidaciones. La fuente real de Uber es el PDF de resumen mensual
//     → parserUberResumenMensual.ts (ya activo en el motor de la bandeja).
//     Reactivar parseUber() SOLO cuando tengamos un correo real de ejemplo
//     y validemos que los patrones extraen los campos correctamente.

export interface LiquidacionPlataforma {
  plataforma: 'uber' | 'glovo' | 'justeat'
  tabla: 'uber_liquidaciones' | 'glovo_liquidaciones' | 'justeat_liquidaciones'
  marca: string
  referencia_pago: string
  fecha_deposito: string       // YYYY-MM-DD (estimada por reglas de cobro)
  fecha_inicio_periodo: string // YYYY-MM-DD
  fecha_fin_periodo: string    // YYYY-MM-DD
  num_pedidos: number | null
  ventas_bruto: number | null
  comision_uber: number | null
  promociones: number | null
  otros_cargos_promo: number | null
  ads: number | null
  ajustes: number | null
  pago_neto: number | null
  estado: string
}

// "1.234,56 €" / "-42,30 €" → 1234.56 / 42.30 (siempre valor absoluto)
function num(s: string | null | undefined): number | null {
  if (!s) return null
  const limpio = s.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(limpio)
  return Number.isFinite(n) ? Math.abs(n) : null
}

// "6/8/26" (M/D/YY) → "2026-06-08"
function fechaUS(s: string): string | null {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (!m) return null
  const mes = m[1].padStart(2, '0')
  const dia = m[2].padStart(2, '0')
  let anio = m[3]
  if (anio.length === 2) anio = '20' + anio
  return `${anio}-${mes}-${dia}`
}

// Próximo lunes posterior a una fecha (regla de cobro Uber: periodo lun-dom,
// pago el lunes siguiente). Si la fecha ya es lunes, devuelve el lunes siguiente.
function lunesSiguiente(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = d.getUTCDay() // 0=domingo … 1=lunes
  const sumar = ((8 - dow) % 7) || 7
  d.setUTCDate(d.getUTCDate() + sumar)
  return d.toISOString().slice(0, 10)
}

// HTML → texto plano simple (conserva labels y números).
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&euro;/gi, '€')
    .replace(/&amp;/gi, '&')
    .replace(/&aacute;/gi, 'á').replace(/&iacute;/gi, 'í').replace(/&oacute;/gi, 'ó')
    .replace(/\s+/g, ' ')
    .trim()
}

function buscar(txt: string, re: RegExp): string | null {
  const m = txt.match(re)
  return m ? m[1] : null
}

// ⚠️ BLOQUEADO 22-jun-2026 — ver cabecera del archivo para contexto.
// Los correos de Uber no tienen el formato esperado por las regex de abajo,
// por lo que el parser devolvía datos con referencias inventadas y cifras
// incorrectas. Devuelve null hasta que se valide con un correo real.
function parseUber(_texto: string, _asunto: string): LiquidacionPlataforma | null {
  return null
}

/**
 * Intenta interpretar un correo como liquidación de plataforma.
 * Devuelve null si no lo es (factura normal, newsletter, etc.).
 */
export function parseLiquidacionPlataforma(
  textoPlano: string | null | undefined,
  html: string | null | undefined,
  asunto: string | null | undefined,
): LiquidacionPlataforma | null {
  const texto = `${textoPlano || ''}\n${stripHtml(html || '')}`.trim()
  const subj = asunto || ''
  if (!texto) return null
  return parseUber(texto, subj)
}
