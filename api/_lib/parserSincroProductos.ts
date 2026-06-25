// parserSincroProductos — Lee el CSV "sold_products" de Sincro (separador ";").
// VERIFICADO con archivo real: 2.815 líneas / 538 pedidos, may 2026, Glovo+JustEat.
// Columnas (sin cabecera): pedido_id; id_plataforma; tipo; canal; direccion; cliente;
//   col6; cantidad; producto; origen; descuento; fecha_hora; precio_linea; total_pedido; col14
//
// Produce:
//   1. Agrupación por (canal, marca, plato, mes, año) → ventas_plato (real, estimado=false)
//   2. Agrupación por (canal, marca, fecha, hora, dia_semana) → ventas_franja
//
// Reglas:
//   - "Promos", "Gastos de envío", "Descuento", "Cobro de la plataforma" → líneas financieras, IGNORAR
//   - Producto en mayúsculas + ".." → modificador (se guarda como plato propio, precio=0)
//   - precio_linea < 0 → descuento/promo, IGNORAR para unidades/importe
//   - Marca: no viene en el CSV. Se mapea desde la dirección contra la BD.
//   - Canal: "JustEat" → normalizar a "just_eat"; "Glovo" → "glovo"

export interface LineaSincro {
  pedidoId: string
  canal: string       // 'glovo' | 'just_eat' | 'uber' | ...
  direccion: string
  cantidad: number
  producto: string
  fechaHora: string  // 'YYYY-MM-DD HH:MM:SS'
  precioLinea: number
  totalPedido: number
  esModificador: boolean
  esLineasFinanciera: boolean
}

export interface VentaPlato {
  canal: string; marca: string; plato: string; mes: number; anio: number
  unidades: number; ingresos_brutos: number; precio_medio: number
  estimado: boolean; origen: string
}

export interface VentaFranja {
  canal: string; marca: string; fecha: string; hora: number; dia_semana: number
  pedidos: number; unidades: number; importe: number; fuente: string
}

const FINANCIERAS = /^(Promos|Gastos de env[ií]o|Descuento|Cobro de la plataforma)/i
const MODIFICADOR_PAT = /^[A-ZÁÉÍÓÚÜÑ0-9 .,()\-]{4,}\.\.$|^LA PREFIERO/i

function normCanal(raw: string): string {
  const c = raw.trim().toLowerCase()
  if (c === 'justeat' || c === 'just eat' || c === 'just_eat') return 'just_eat'
  if (c === 'glovo') return 'glovo'
  if (c === 'uber' || c === 'uber eats') return 'uber'
  return c
}

export function parseSincroCSV(csvText: string): LineaSincro[] {
  const lineas: LineaSincro[] = []
  for (const rawLine of csvText.split('\n')) {
    const cols = rawLine.split(';')
    if (cols.length < 13) continue
    const precioLinea = parseFloat(cols[12]) || 0
    const producto = cols[8]?.trim() || ''
    if (!producto) continue
    lineas.push({
      pedidoId: cols[0]?.trim() || '',
      canal: normCanal(cols[3] || ''),
      direccion: cols[4]?.trim() || '',
      cantidad: parseInt(cols[7]) || 1,
      producto,
      fechaHora: cols[11]?.trim() || '',
      precioLinea,
      totalPedido: parseFloat(cols[13]) || 0,
      esModificador: MODIFICADOR_PAT.test(producto) || precioLinea === 0,
      esLineasFinanciera: FINANCIERAS.test(producto),
    })
  }
  return lineas
}

export function agruparPorPlato(lineas: LineaSincro[], marcaNombre: string): VentaPlato[] {
  const mapa = new Map<string, VentaPlato>()
  for (const l of lineas) {
    if (l.esLineasFinanciera) continue
    const dt = new Date(l.fechaHora.replace(' ', 'T') + 'Z')
    const mes = dt.getUTCMonth() + 1
    const anio = dt.getUTCFullYear()
    const key = `${l.canal}||${marcaNombre}||${l.producto}||${mes}||${anio}`
    const prev = mapa.get(key)
    const precio = l.esModificador ? 0 : Math.max(0, l.precioLinea)
    if (prev) {
      prev.unidades += l.cantidad
      prev.ingresos_brutos += precio * l.cantidad
    } else {
      mapa.set(key, {
        canal: l.canal, marca: marcaNombre, plato: l.producto,
        mes, anio, unidades: l.cantidad, ingresos_brutos: precio * l.cantidad,
        precio_medio: 0, estimado: false, origen: 'sincro',
      })
    }
  }
  for (const v of mapa.values()) {
    v.precio_medio = v.unidades > 0 ? v.ingresos_brutos / v.unidades : 0
  }
  return [...mapa.values()]
}

export function agruparPorFranja(lineas: LineaSincro[], marcaNombre: string): VentaFranja[] {
  const pedidosFranja = new Map<string, Set<string>>()
  const mapa = new Map<string, VentaFranja>()
  for (const l of lineas) {
    if (l.esLineasFinanciera || !l.fechaHora) continue
    const dt = new Date(l.fechaHora.replace(' ', 'T') + 'Z')
    const fecha = l.fechaHora.slice(0, 10)
    const hora = dt.getUTCHours()
    const dia_semana = dt.getUTCDay() === 0 ? 6 : dt.getUTCDay() - 1
    const key = `${l.canal}||${marcaNombre}||${fecha}||${hora}`
    if (!pedidosFranja.has(key)) pedidosFranja.set(key, new Set())
    pedidosFranja.get(key)!.add(l.pedidoId)
    const prev = mapa.get(key)
    const precio = l.esModificador ? 0 : Math.max(0, l.precioLinea)
    if (prev) {
      prev.unidades += l.cantidad
      prev.importe += precio * l.cantidad
    } else {
      mapa.set(key, {
        canal: l.canal, marca: marcaNombre, fecha, hora, dia_semana,
        pedidos: 0, unidades: l.cantidad, importe: precio * l.cantidad, fuente: 'sincro',
      })
    }
  }
  for (const [key, v] of mapa.entries()) {
    v.pedidos = pedidosFranja.get(key)?.size || 0
  }
  return [...mapa.values()]
}
