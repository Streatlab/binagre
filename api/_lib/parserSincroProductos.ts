// parserSincroProductos — Lee el CSV "sold_products" de Sinqro (gestor de pedidos).
// VERIFICADO al céntimo con 20260705151609_sold_products_3976805.csv (jun-jul 2026)
// contra la verdad cargada y comprobada en BD el 05/07/2026:
//   franjas glovo 195 filas = 8.900,71 € · justeat 104 filas = 4.436,81 €
//   platos  glovo jun 9.767,77 / jul 1.471,23 · justeat jun 3.781,54 / jul 655,27
//
// COLUMNAS (separador ';', SIN cabecera):
//   0 id_pedido · 3 canal (Glovo|JustEat|Uber) · 4 dirección local · 7 cantidad
//   8 nombre línea · 11 fecha_hora "YYYY-MM-DD HH:MM:SS" EN UTC · 12 TOTAL de la línea
//
// REGLAS CANÓNICAS (no cambiar sin re-verificar contra BD):
//   · col 12 es el TOTAL de la línea (2 uds → ya multiplicado). NUNCA multiplicar por cantidad.
//   · Hora en UTC → convertir a Europe/Madrid (verano +2 / invierno +1).
//   · canal en BD: 'glovo' | 'justeat' | 'uber' (sin guion bajo).
//   · marca: Sinqro no la trae → '' (cadena vacía), igual que la verdad cargada.
//   · ventas_plato: TODAS las líneas menos las llamadas exactamente 'Promos' (Glovo).
//     'Descuento' y 'Gastos de envío' (JustEat) SÍ cuentan (así cuadra el bruto).
//   · ventas_franja: TODAS las líneas sin excepción, agrupadas por fecha+hora Madrid.
//   · dia_semana: 0=domingo … 6=sábado (convención de la BD; isodow rompe el CHECK).

export interface VentaPlato {
  canal: string
  marca: string
  plato: string
  mes: number
  anio: number
  unidades: number
  importe: number
}

export interface VentaFranja {
  canal: string
  marca: string
  fecha: string            // YYYY-MM-DD (hora Madrid)
  hora: number             // 0-23 (hora Madrid)
  dia_semana: number       // 0=domingo … 6=sábado
  pedidos: number
  unidades: number
  importe: number
}

export interface SincroResultado {
  ventas_plato: VentaPlato[]
  ventas_franja: VentaFranja[]
  canales: string[]
  errores: string[]
}

const CANAL_MAP: Record<string, string> = {
  glovo: 'glovo', justeat: 'justeat', 'just eat': 'justeat',
  uber: 'uber', ubereats: 'uber', 'uber eats': 'uber',
}

// 'YYYY-MM-DD HH:MM:SS' en UTC → 'YYYY-MM-DD HH:MM:SS' en Europe/Madrid
const FMT_MADRID = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
})
function utcAMadrid(fechaHoraUtc: string): string | null {
  const d = new Date(fechaHoraUtc.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return null
  return FMT_MADRID.format(d).replace(',', '')
}
function dowDeFecha(fechaISO: string): number {
  return new Date(fechaISO + 'T12:00:00Z').getUTCDay() // 0=domingo
}

export function parseSincroProductos(csvText: string): SincroResultado {
  const lineas = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  if (lineas[0]?.charCodeAt(0) === 0xFEFF) lineas[0] = lineas[0].slice(1)

  const platosMap = new Map<string, VentaPlato>()
  const franjasMap = new Map<string, VentaFranja & { _pedidos: Set<string> }>()
  const errores: string[] = []
  const canalesSet = new Set<string>()

  for (let i = 0; i < lineas.length; i++) {
    const cols = lineas[i].split(';')
    if (cols.length < 13) continue

    const idPedido = cols[0]?.trim() || ''
    const canal = CANAL_MAP[(cols[3] || '').toLowerCase().trim()]
    const nombre = cols[8]?.trim() || ''
    const fechaHoraUtc = cols[11]?.trim() || ''
    if (!canal || !nombre || !fechaHoraUtc) continue

    // col 12 = TOTAL de la línea (ya multiplicado por cantidad)
    const importeLinea = parseFloat((cols[12] || '0').replace(',', '.')) || 0
    let cantidad = parseInt(cols[7]?.trim() || '1', 10)
    if (isNaN(cantidad) || cantidad < 1) cantidad = 1

    const madrid = utcAMadrid(fechaHoraUtc)
    if (!madrid) { errores.push(`fila ${i}: fecha inválida "${fechaHoraUtc}"`); continue }
    const fecha = madrid.slice(0, 10)
    const hora = parseInt(madrid.slice(11, 13), 10)
    const mes = parseInt(madrid.slice(5, 7), 10)
    const anio = parseInt(madrid.slice(0, 4), 10)

    canalesSet.add(canal)

    // ── ventas_franja: TODAS las líneas ──
    const kf = `${canal}||${fecha}||${hora}`
    if (!franjasMap.has(kf)) {
      franjasMap.set(kf, {
        canal, marca: '', fecha, hora, dia_semana: dowDeFecha(fecha),
        pedidos: 0, unidades: 0, importe: 0, _pedidos: new Set(),
      })
    }
    const vf = franjasMap.get(kf)!
    vf._pedidos.add(idPedido)
    vf.pedidos = vf._pedidos.size
    vf.unidades += cantidad
    vf.importe += importeLinea

    // ── ventas_plato: todo menos las líneas 'Promos' (Glovo) ──
    if (nombre === 'Promos') continue
    const kp = `${canal}||${nombre}||${anio}||${mes}`
    if (!platosMap.has(kp)) {
      platosMap.set(kp, { canal, marca: '', plato: nombre, mes, anio, unidades: 0, importe: 0 })
    }
    const vp = platosMap.get(kp)!
    vp.unidades += cantidad
    vp.importe += importeLinea
  }

  const franjas: VentaFranja[] = []
  for (const f of franjasMap.values()) {
    const { _pedidos, ...clean } = f
    void _pedidos
    franjas.push({ ...clean, importe: Math.round(clean.importe * 100) / 100 })
  }
  const platos = Array.from(platosMap.values()).map(p => ({ ...p, importe: Math.round(p.importe * 100) / 100 }))

  return { ventas_plato: platos, ventas_franja: franjas, canales: Array.from(canalesSet), errores }
}
