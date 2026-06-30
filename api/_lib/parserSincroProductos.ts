// parserSincroProductos — Lee el CSV "sold_products" de Sincro (gestor de pedidos).
// VERIFICADO con 20260625130142_sold_products_3976805.csv (may-jun 2026).
//
// COLUMNAS (separador ';', SIN cabecera):
//   0  id_pedido_interno
//   1  id_pedido_plataforma  (ej. "729 | 101639281727")
//   2  tipo                  ("Delivery")
//   3  canal                 ("Glovo" | "JustEat" | "Uber")
//   4  dirección/local       (→ para mapear a marca)
//   5  cliente               ("No facilitada" generalmente)
//   6  vacío
//   7  cantidad              (int)
//   8  nombre_producto_o_modificador
//   9  categoría             ("External platforms")
//   10 descuento
//   11 fecha_hora            "YYYY-MM-DD HH:MM:SS"
//   12 precio_línea          (€ del producto o modificador)
//   13 total_pedido          (€ total)
//   14 neto_pedido           (€ neto)
//
// DISTINCIÓN plato vs modificador:
//   - Modificadores: texto en MAYÚSCULAS, empieza por "Tamaño", "LA ", "Sin ", "Con ", "Extra ", "Añadir "
//   - Platos: cualquier otra cosa con nombre y precio > 0
//   - Filas con precio = 0 son notas/instrucciones, no se cuentan
//
// SALIDA:
//   - VentaPlato[]: para ventas_plato (platos reales, origen 'sincro', estimado=false)
//   - VentaModificador[]: para ventas_plato con flag modificador=true (o tabla aparte si se crea)
//   - VentaFranja[]: para ventas_franja (hora/día/canal/marca)

export interface VentaPlato {
  canal: string            // 'glovo' | 'just_eat' | 'uber'
  marca: string            // nombre canónico de marcas (mapeo externo)
  marcaRaw: string         // dirección/local crudo para mapeo
  plato: string
  es_modificador: boolean
  mes: number
  anio: number
  unidades: number
  importe: number
  origen: 'sincro'
  estimado: false
}

export interface VentaFranja {
  canal: string
  marca: string
  marcaRaw: string
  fecha: string            // YYYY-MM-DD
  hora: number             // 0-23
  dia_semana: number       // 0=lunes … 6=domingo
  pedidos: number          // nº pedidos distintos en esa franja
  unidades: number
  importe: number
}

export interface SincroResultado {
  ventas_plato: VentaPlato[]
  ventas_franja: VentaFranja[]
  canales: string[]
  marcas_raw: string[]
  errores: string[]
}

const CANAL_MAP: Record<string, string> = {
  glovo: 'glovo',
  justeat: 'just_eat',
  'just eat': 'just_eat',
  uber: 'uber',
  ubereats: 'uber',
  'uber eats': 'uber',
}

function normCanal(s: string): string {
  return CANAL_MAP[s.toLowerCase().trim()] || s.toLowerCase().trim()
}

function esMod(nombre: string): boolean {
  return (
    nombre === nombre.toUpperCase() && nombre.length > 2 ||
    /^(Tamaño|LA |Sin |Con |Extra |Añadir )/i.test(nombre)
  )
}

export function parseSincroProductos(csvText: string): SincroResultado {
  const lineas = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  // Quitar BOM si existe
  if (lineas[0]?.charCodeAt(0) === 0xFEFF) lineas[0] = lineas[0].slice(1)

  // Acumuladores por (canal, localRaw, plato, año, mes)
  const platosMap = new Map<string, VentaPlato>()
  // Acumuladores por (canal, localRaw, fecha, hora, dia)
  const franjasMap = new Map<string, VentaFranja & { _pedidos: Set<string> }>()

  const errores: string[] = []
  const canalesSet = new Set<string>()
  const marcasRawSet = new Set<string>()

  for (let i = 0; i < lineas.length; i++) {
    const cols = lineas[i].split(';')
    if (cols.length < 13) continue

    const idPedido = cols[0]?.trim() || ''
    const canal = normCanal(cols[3]?.trim() || '')
    const localRaw = cols[4]?.trim() || ''
    const nombre = cols[8]?.trim() || ''
    const fechaHora = cols[11]?.trim() || ''
    const precioStr = cols[12]?.replace(',', '.').trim() || '0'
    const totalStr = cols[13]?.replace(',', '.').trim() || '0'
    let cantidad = parseInt(cols[7]?.trim() || '1', 10)
    if (isNaN(cantidad)) cantidad = 1

    if (!nombre || !fechaHora) continue

    const precio = parseFloat(precioStr) || 0
    // Ignorar filas sin precio (notas/instrucciones) que no sean modificadores
    if (precio === 0 && !esMod(nombre)) continue

    let dt: Date
    try {
      dt = new Date(fechaHora.replace(' ', 'T'))
      if (isNaN(dt.getTime())) throw new Error('invalid')
    } catch {
      errores.push(`fila ${i}: fecha inválida "${fechaHora}"`)
      continue
    }

    const mes = dt.getMonth() + 1
    const anio = dt.getFullYear()
    const hora = dt.getHours()
    const diaSemana = dt.getDay() === 0 ? 6 : dt.getDay() - 1 // 0=lunes
    const fecha = fechaHora.slice(0, 10)
    const esModificador = esMod(nombre)

    canalesSet.add(canal)
    marcasRawSet.add(localRaw)

    // Ignorar líneas de Promos/Descuento/Gastos de envío (no son platos reales)
    if (/^(Promos|Descuento|Gastos de envío)/i.test(nombre)) continue

    // ── ventas_plato ──
    const kp = `${canal}||${localRaw}||${nombre}||${anio}||${mes}`
    if (!platosMap.has(kp)) {
      platosMap.set(kp, {
        canal, marcaRaw: localRaw, marca: '', plato: nombre,
        es_modificador: esModificador, mes, anio,
        unidades: 0, importe: 0, origen: 'sincro', estimado: false,
      })
    }
    const vp = platosMap.get(kp)!
    vp.unidades += cantidad
    vp.importe += precio * cantidad

    // ── ventas_franja ──
    const kf = `${canal}||${localRaw}||${fecha}||${hora}||${diaSemana}`
    if (!franjasMap.has(kf)) {
      franjasMap.set(kf, {
        canal, marcaRaw: localRaw, marca: '', fecha, hora, dia_semana: diaSemana,
        pedidos: 0, unidades: 0, importe: 0, _pedidos: new Set(),
      })
    }
    const vf = franjasMap.get(kf)!
    vf._pedidos.add(idPedido)
    vf.pedidos = vf._pedidos.size
    vf.unidades += cantidad
    vf.importe += precio * cantidad
  }

  // Limpiar _pedidos antes de devolver
  const franjasClean: VentaFranja[] = []
  for (const f of franjasMap.values()) {
    const { _pedidos, ...clean } = f
    franjasClean.push(clean)
  }

  return {
    ventas_plato: Array.from(platosMap.values()),
    ventas_franja: franjasClean,
    canales: Array.from(canalesSet),
    marcas_raw: Array.from(marcasRawSet),
    errores,
  }
}
