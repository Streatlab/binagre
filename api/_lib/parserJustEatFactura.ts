// parserJustEatFactura — Lee una FACTURA de Just Eat (archivo .doc que en realidad
// es HTML) y la normaliza a ventas_plataforma. Just Eat factura por quincenas.
// VERIFICADO con 3 facturas reales (may-jun 2026): el bruto = "Total de ventas",
// el neto = "Recibirás de Just Eat" (ya con comisión, gastos de usuario, gastos de
// gestión, Top Rank y ajustes descontados). Just Eat no tiene Prime/Promo.

export interface VentaPlataformaParseada {
  plataforma: 'uber' | 'glovo' | 'just_eat'
  marcaRaw: string            // nombre del local tal cual viene; se mapea a marca después
  fecha_inicio_periodo: string // YYYY-MM-DD
  fecha_fin_periodo: string    // YYYY-MM-DD
  pedidos: number
  bruto: number
  neto: number
  fecha_pago: string | null
  referencia: string | null
  pedidos_prime?: number       // solo Glovo/Uber
  pedidos_promo?: number       // solo Glovo/Uber
  comision_eur?: number
  promo_eur?: number
}

const MESES_ES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

function importe(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.replace(/\./g, '').replace(',', '.').match(/-?\d+\.?\d*/)
  return m ? parseFloat(m[0]) : null
}

function fechaLarga(d: string, mes: string, y: string): string | null {
  const mm = MESES_ES[mes.toLowerCase()]
  if (!mm) return null
  return `${y}-${String(mm).padStart(2, '0')}-${String(parseInt(d, 10)).padStart(2, '0')}`
}

// Convierte el HTML de la factura a texto plano por líneas (sin depender de libs).
function htmlALineas(html: string): string[] {
  const txt = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|tr|td|th|br|h[1-6]|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&euro;/gi, '€')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ')
  return txt.split('\n').map((l) => l.trim()).filter(Boolean)
}

// Devuelve la venta parseada, o null si el HTML no es una factura de Just Eat.
export function parseFacturaJustEat(html: string | null | undefined): VentaPlataformaParseada | null {
  if (!html) return null
  if (!/just\s*eat/i.test(html)) return null

  const lineas = htmlALineas(html)
  const full = lineas.join('\n')

  // Periodo: "1 mayo 2026 - 15 mayo 2026"
  const per = full.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s*[-–]\s*(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (!per) return null
  const ini = fechaLarga(per[1], per[2], per[3])
  const fin = fechaLarga(per[4], per[5], per[6])
  if (!ini || !fin) return null

  // Total de ventas (bruto) y Recibirás de Just Eat (neto)
  const bruto = importe((full.match(/Total de ventas\s*\n?\s*([\d.,]+)/i) || [])[1])
  const neto = importe((full.match(/Recibir[aá]s de Just Eat\s*\n?\s*([-\d.,]+)/i) || [])[1])
  if (bruto == null || neto == null) return null

  // Nº de pedidos
  const ped = (full.match(/N[uú]mero de pedidos\s*\n?\s*(\d+)/i) || [])[1]
  const pedidos = ped ? parseInt(ped, 10) : 0

  // Marca (local): primera línea no vacía tras el periodo que no sea dirección/etiqueta
  let marcaRaw = ''
  const idxPer = lineas.findIndex((l) => /\d{1,2}\s+\w+\s+\d{4}\s*[-–]/.test(l))
  for (let i = idxPer + 1; i < Math.min(idxPer + 4, lineas.length); i++) {
    const l = lineas[i]
    if (l && !/^\d/.test(l) && !/madrid|resumen|tu factura/i.test(l)) { marcaRaw = l; break }
  }

  // Fecha de pago: "Será abonado antes del 22 mayo 2026"
  let fecha_pago: string | null = null
  const fp = full.match(/abonado antes del\s*\n?\s*(\d{1,2})\s+(\w+)\s+(\d{4})/i)
  if (fp) fecha_pago = fechaLarga(fp[1], fp[2], fp[3])

  const ref = (full.match(/N[ºo°]\s*Factura\s*\n?\s*(\d+)/i) || [])[1] || null

  // Comisión = "Total incluido IVA" de la factura de Just Eat (verificado en las
  // 3 facturas reales: 223,61 / 505,22 / 579,01)
  const com = importe((full.match(/Total incluido IVA\s*\n\s*([\d.,]+)/i) || [])[1])

  return {
    plataforma: 'just_eat',
    marcaRaw: marcaRaw || 'DESCONOCIDA',
    fecha_inicio_periodo: ini,
    fecha_fin_periodo: fin,
    pedidos,
    bruto,
    neto,
    fecha_pago,
    referencia: ref,
    ...(com != null ? { comision_eur: com } : {}),
  } as VentaPlataformaParseada
}
