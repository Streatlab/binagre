// parser-resumen-plataforma.ts — Lee el RESUMEN MENSUAL de ventas de plataforma
// que se sube como PDF a mano (NO el resumen de correo). v1: Uber Eats.
// Glovo y Just Eat se añadirán con un ejemplo real de cada uno.
//
// Salida normalizada al esquema de la tabla ventas_plataforma (la que alimenta
// el módulo Ventas). plataforma usa los códigos que admite la tabla:
// 'uber' | 'glovo' | 'just_eat'. Devuelve null si el texto NO es un resumen,
// para que el motor siga con su flujo normal de factura.

export interface ResumenVentaPlataforma {
  plataforma: 'uber' | 'glovo' | 'just_eat'
  marca: string
  fecha_inicio_periodo: string // YYYY-MM-DD
  fecha_fin_periodo: string    // YYYY-MM-DD
  pedidos: number
  bruto: number                // Ventas (valor de los artículos vendidos)
  neto: number                 // Total neto (lo que te pagan)
  comision: number | null      // Tasas de mercado / precios de la plataforma (valor absoluto)
  marketing: number | null     // Gastos de marketing (valor absoluto)
  fecha_pago: string | null    // fecha de depósito más reciente, si aparece
  referencia: string | null    // nº de resumen
}

const MESES_EN: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

// "1.201,45 €" / "-350,20 €" → 1201.45 / 350.20 (valor absoluto)
function num(s: string | null | undefined): number | null {
  if (!s) return null
  const limpio = s.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(limpio)
  return Number.isFinite(n) ? Math.abs(n) : null
}

// "May 01-31, 2026" → { ini: '2026-05-01', fin: '2026-05-31' }
function periodoMensual(texto: string): { ini: string; fin: string } | null {
  // Formato "May 01-31, 2026" o "May 01 - 31, 2026"
  const m = texto.match(/([A-Za-z]{3})[a-z]*\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s+(\d{4})/)
  if (m) {
    const mes = MESES_EN[m[1].toLowerCase().slice(0, 3)]
    if (!mes) return null
    return { ini: `${m[4]}-${mes}-${m[2].padStart(2, '0')}`, fin: `${m[4]}-${mes}-${m[3].padStart(2, '0')}` }
  }
  return null
}

// "May 04, 2026" → "2026-05-04"
function fechaEN(s: string): string | null {
  const m = s.match(/([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})/)
  if (!m) return null
  const mes = MESES_EN[m[1].toLowerCase().slice(0, 3)]
  if (!mes) return null
  return `${m[3]}-${mes}-${m[2].padStart(2, '0')}`
}

function buscar(txt: string, re: RegExp): string | null {
  const m = txt.match(re)
  return m ? m[1] : null
}

// Marca del local: aparece SIEMPRE justo antes de la dirección ("Calle …",
// "Avenida …", "Plaza …", "C/ …"). Tomamos el texto inmediatamente anterior a la
// primera dirección y le quitamos "Resumen mensual" y el "Mes AAAA" del encabezado.
function extraerMarca(texto: string): string {
  const mDir = texto.match(/\b(?:Calle|Avenida|Av\.|Plaza|C\/)\s/i)
  if (!mDir || mDir.index === undefined || mDir.index <= 0) return 'SIN_MARCA'
  let antes = texto.slice(Math.max(0, mDir.index - 90), mDir.index).replace(/\s+/g, ' ').trim()
  antes = antes.replace(/.*resumen\s+mensual\s*/i, '')   // quita "…Resumen mensual "
  antes = antes.replace(/^[A-Za-z]{3,}\.?\s+\d{4}\s+/, '') // quita "May 2026 "
  antes = antes.replace(/^#?\d+\s+/, '')                   // quita un nº residual
  const palabras = antes.split(' ').filter(Boolean)
  const marca = palabras.slice(-6).join(' ').trim()
  return marca || 'SIN_MARCA'
}

// ── Uber Eats: "Resumen mensual unificado" ─────────────────────────────────
function parseUberResumen(texto: string): ResumenVentaPlataforma | null {
  const esUber = /uber/i.test(texto) || /tasas de mercado/i.test(texto) || /precios de uber/i.test(texto)
  const esResumen = /resumen\s+mensual/i.test(texto) && /total neto/i.test(texto)
  if (!esUber || !esResumen) return null

  const periodo = periodoMensual(texto)
  if (!periodo) return null

  // Ventas (39 Pedidos) 1.201,45 €
  const ventasLinea = texto.match(/ventas\s*\(\s*(\d+)\s*pedidos?\s*\)\s*([\d.,]+)\s*€/i)
  const pedidos = ventasLinea ? parseInt(ventasLinea[1], 10) : 0
  const bruto = ventasLinea ? num(ventasLinea[2]) : null

  // Total neto 466,61 €  (la cifra final del resumen mensual unificado)
  const neto = num(buscar(texto, /total neto\s*([\d.,]+)\s*€/i))

  // Tasas de mercado / Precios totales de Uber
  const comision = num(buscar(texto, /precios totales de uber\s*-?\s*([\d.,]+)/i))
    ?? num(buscar(texto, /tasas de mercado\s*-?\s*([\d.,]+)/i))
  const marketing = num(buscar(texto, /gastos totales de marketing\s*-?\s*([\d.,]+)/i))

  // Sin neto ni bruto, no es aprovechable.
  if (neto == null || bruto == null) return null

  const marca = extraerMarca(texto)

  // Nº de resumen como referencia.
  const referencia = buscar(texto, /n[úu]mero del resumen\s*#?\s*(\d+)/i)

  // Fecha de pago: el depósito más reciente "Depósito iniciado : May 25, 2026".
  const depositos = [...texto.matchAll(/dep[óo]sito iniciado\s*:?\s*([A-Za-z]{3}[a-z]*\s+\d{1,2},?\s+\d{4})/gi)]
  let fecha_pago: string | null = null
  for (const d of depositos) {
    const f = fechaEN(d[1])
    if (f && (!fecha_pago || f > fecha_pago)) fecha_pago = f
  }

  return {
    plataforma: 'uber',
    marca,
    fecha_inicio_periodo: periodo.ini,
    fecha_fin_periodo: periodo.fin,
    pedidos,
    bruto,
    neto,
    comision,
    marketing,
    fecha_pago,
    referencia,
  }
}

/**
 * Intenta interpretar el texto de un documento como un RESUMEN de ventas de
 * plataforma subido a mano. Devuelve null si no lo es (factura, extracto, etc.),
 * para que el motor siga su flujo normal.
 */
export function parseResumenPlataforma(texto: string | null | undefined): ResumenVentaPlataforma | null {
  if (!texto || texto.replace(/\s/g, '').length < 40) return null
  return parseUberResumen(texto)
  // TODO (punto 5 del plan): añadir parseGlovoResumen y parseJustEatResumen
}
