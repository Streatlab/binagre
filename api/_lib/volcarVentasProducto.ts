// volcarVentasProducto — Punto de entrada para documentos de DETALLE POR PRODUCTO.
// Lo llama procesarArchivo cuando detecta un CSV de tipo sold_products (Sincro) o
// detalle de artículos de Uber. Escribe en ventas_plato (real) y ventas_franja.
// Idempotente: upsert por clave natural.
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseSincroCSV, agruparPorPlato, agruparPorFranja } from './parserSincroProductos.js'
import type { ProcesarResultado, ArchivoEntrada } from './procesarArchivo.js'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

async function mapearMarca(supabase: SupabaseClient, pista: string): Promise<string | null> {
  const { data } = await supabase.from('marcas').select('nombre')
  const marcas = (data || []) as { nombre: string }[]
  const raw = norm(pista)
  let mejor: string | null = null; let mejorLen = 0
  for (const m of marcas) {
    const n = norm(m.nombre)
    if (n && (raw.includes(n) || n.includes(raw)) && n.length > mejorLen) {
      mejor = m.nombre; mejorLen = n.length
    }
  }
  return mejor
}

// Detecta si el CSV es un sold_products de Sincro por su fingerprint de columnas.
// El CSV de Sincro no tiene cabecera; se detecta por contenido.
export function esSincroCsv(text: string): boolean {
  const primera = text.split('\n')[0] || ''
  // La primera columna es un pedido numérico y la cuarta es Glovo/JustEat/Uber
  const cols = primera.split(';')
  if (cols.length < 12) return false
  return /^\d{6,}$/.test(cols[0]?.trim()) &&
    /^(Glovo|JustEat|Uber)$/i.test(cols[3]?.trim()) &&
    /^\d{4}-\d{2}-\d{2}/.test(cols[11]?.trim() || '')
}

export async function intentarVentaProducto(
  supabase: SupabaseClient, file: ArchivoEntrada,
): Promise<ProcesarResultado | null> {
  try {
    const ext = (file.nombre.toLowerCase().split('.').pop() || '').trim()
    if (ext !== 'csv') return null

    const text = file.buffer.toString('utf8')

    // Sincro: sold_products
    if (esSincroCsv(text)) {
      const lineas = parseSincroCSV(text)
      if (!lineas.length) return null

      // Marca: desde la dirección de la primera línea
      const dir = lineas.find(l => l.direccion)?.direccion || ''
      const marca = await mapearMarca(supabase, dir)
      if (!marca) {
        return {
          estado: 'lectura_manual', archivo: file.nombre, tipo_documento: 'resumen_ventas',
          motivo: `Sincro sold_products: marca no identificada (dirección: "${dir}")`,
        }
      }

      const platos = agruparPorPlato(lineas, marca)
      const franjas = agruparPorFranja(lineas, marca)

      // Upsert ventas_plato (UNIQUE: canal, marca, plato, mes, año)
      let platosOk = 0
      for (const p of platos) {
        const { error } = await supabase.from('ventas_plato').upsert({
          canal: p.canal, marca: p.marca, plato: p.plato, mes: p.mes,
          ['año']: p.anio, unidades: p.unidades,
          ingresos_brutos: Math.round(p.ingresos_brutos * 100) / 100,
          precio_medio: Math.round(p.precio_medio * 100) / 100,
          estimado: false, origen: 'sincro', updated_at: new Date().toISOString(),
        }, { onConflict: 'canal,marca,plato,mes,año' })
        if (!error) platosOk++
      }

      // Upsert ventas_franja (UNIQUE: canal, marca, fecha, hora)
      let franjasOk = 0
      for (const f of franjas) {
        const { error } = await supabase.from('ventas_franja').upsert({
          canal: f.canal, marca: f.marca, fecha: f.fecha,
          hora: f.hora, dia_semana: f.dia_semana,
          pedidos: f.pedidos, unidades: f.unidades,
          importe: Math.round(f.importe * 100) / 100,
          fuente: 'sincro', updated_at: new Date().toISOString(),
        }, { onConflict: 'canal,marca,fecha,hora' })
        if (!error) franjasOk++
      }

      return {
        estado: 'ok', archivo: file.nombre, tipo_documento: 'resumen_ventas',
        motivo: `Sincro sold_products · ${marca} · ${platosOk} platos reales + ${franjasOk} franjas horarias`,
      }
    }
  } catch (e) {
    console.error('[intentarVentaProducto] fallo:', (e as Error)?.message)
  }
  return null
}
