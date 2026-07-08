// productosVendidos — Lee un CSV simple de productos vendidos (Sinqro / Rushour):
//   columnas nombre + cantidad + precio (con o sin prefijo "csv.").
// Va a lineas_producto_operativa como ranking (sin pedido). Marca = 'AGREGADO'.

import type { SupabaseClient } from '@supabase/supabase-js'

function partirCSV(linea: string): string[] {
  const out: string[] = []
  let cur = '', dentro = false
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i]
    if (ch === '"') { if (dentro && linea[i + 1] === '"') { cur += '"'; i++ } else dentro = !dentro }
    else if (ch === ',' && !dentro) { out.push(cur.trim()); cur = '' }
    else cur += ch
  }
  out.push(cur.trim())
  return out
}
function num(s: string | undefined): number {
  const v = (s || '').replace(/[€\s]/g, '').replace(',', '.')
  const n = parseFloat(v); return isNaN(n) ? 0 : n
}
const norm = (s: string) => s.toLowerCase().replace(/^csv\./, '').replace(/["\s]/g, '')

export function esProductosVendidos(texto: string): boolean {
  const p0 = (texto.split('\n')[0] || '')
  const cols = partirCSV(p0).map(norm)
  const tieneNombre = cols.some(c => c.includes('nombre') || c.includes('producto') || c.includes('articulo') || c === 'name' || c === 'product')
  const tieneCant = cols.some(c => c.includes('cantidad') || c.includes('unidades') || c === 'qty' || c === 'quantity' || c.includes('vendidas'))
  return tieneNombre && tieneCant && cols.length <= 6
}

export async function procesarProductosVendidos(supabase: SupabaseClient, texto: string, nombreArchivo: string) {
  const lineas = texto.split('\n').filter(l => l.trim())
  if (lineas[0]?.charCodeAt(0) === 0xFEFF) lineas[0] = lineas[0].slice(1)
  const cols = partirCSV(lineas[0]).map(norm)
  const iN = cols.findIndex(c => c.includes('nombre') || c.includes('producto') || c.includes('articulo') || c === 'name' || c === 'product')
  const iC = cols.findIndex(c => c.includes('cantidad') || c.includes('unidades') || c === 'qty' || c === 'quantity' || c.includes('vendidas'))
  const iP = cols.findIndex(c => c.includes('precio') || c.includes('importe') || c === 'price' || c.includes('total'))

  const hoy = new Date().toISOString().slice(0, 10)
  const origen = /sinqro|sinq/i.test(nombreArchivo) ? 'sinqro' : /rushour|rush/i.test(nombreArchivo) ? 'rushour' : 'productos_agregado'
  const rows: any[] = []
  for (const linea of lineas.slice(1)) {
    const c = partirCSV(linea)
    const producto = (c[iN] || '').replace(/^"|"$/g, '').trim()
    if (!producto) continue
    const cant = iC >= 0 ? num(c[iC]) || 1 : 1
    const precio = iP >= 0 ? num(c[iP]) : null
    rows.push({
      plataforma: origen, marca: 'AGREGADO', pedido_ref: `${origen}_${hoy}_${producto}`.slice(0, 300),
      fecha: hoy, hora: null, producto, cantidad: cant,
      precio_unit: precio, importe: precio != null ? Math.round(precio * cant * 100) / 100 : null,
      es_prime: false, origen,
    })
  }
  for (let i = 0; i < rows.length; i += 200)
    await supabase.from('lineas_producto_operativa').upsert(rows.slice(i, i + 200), { onConflict: 'plataforma,pedido_ref,producto' })
  return { productos: rows.length, origen }
}
