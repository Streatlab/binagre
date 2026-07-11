// uberArticuloProducto — Lee el "detalle de ganancias a nivel de artículo" de Uber
// y lo convierte en lineas_producto_operativa (producto, cantidad, precio, IVA incl.)
// por pedido. Se reconoce por: "Id. del pedido" + "Nombre del artículo" + "Precio unitario".

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarMarca, type MarcaCanonica } from './normalizarMarca.js'

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

export function esDetalleArticuloUber(texto: string): boolean {
  const p = (texto.split('\n')[0] || '')
  return /Id\. del pedido/i.test(p) && /Nombre del art[ií]culo/i.test(p) && /Precio unitario/i.test(p)
}

interface Ln { plataforma: string; marca: string; pedido_ref: string; fecha: string | null; hora: number | null; producto: string; cantidad: number; precio_unit: number | null; importe: number | null; es_prime: boolean; origen: string; tipo_linea: string }

// Clasifica la descripción libre de "otros pagos" en un tipo_linea consultable.
// Ads = marketing, nunca se mezcla con el neto estructural del producto.
function tipoDeOtrosPagos(desc: string): string {
  const d = desc.toLowerCase()
  if (/anuncio|ads/.test(d)) return 'ads'
  if (/promoci[oó]n/.test(d)) return 'promocion'
  if (/uber ?one|prime/.test(d)) return 'prime'
  return 'otros'
}

export async function procesarDetalleArticuloUber(supabase: SupabaseClient, texto: string) {
  const { data: marcasCanonicasData } = await supabase.from('marcas').select('nombre')
  const marcasCanonicas: MarcaCanonica[] = marcasCanonicasData ?? []

  const lineas = texto.split('\n').filter(l => l.trim())
  if (lineas[0]?.charCodeAt(0) === 0xFEFF) lineas[0] = lineas[0].slice(1)
  const hdr = partirCSV(lineas[0])
  const ix = (re: RegExp) => hdr.findIndex(h => re.test(h))
  const ixAny = (res: RegExp[]) => { for (const re of res) { const i = hdr.findIndex(h => re.test(h)); if (i !== -1) return i }; return -1 }
  const iId = ix(/^Id\. del pedido$/i), iUuid = ix(/^Id\. del flujo de trabajo$/i), iMarca = ix(/^Nombre de la tienda$/i)
  const iFecha = ix(/^Fecha del pedido$/i), iHora = ix(/^Hora a la que se acept/i)
  const iProd = ix(/^Nombre del art[ií]culo$/i), iCant = ix(/^Cantidad final$/i)
  const iCantSol = ix(/^Cantidad solicitada$/i), iPrecio = ix(/^Precio unitario$/i)
  const iConIva = ix(/^Ventas \(con IVA\)$/i), iPrime = ix(/membres[ií]a de Uber/i)
  // Líneas sin artículo (tarifas / ads / promo) llevan su propia descripción.
  // Nombre de columna no confirmado con un export real: sondeo tolerante,
  // falla seguro (0 líneas de otros pagos) si ninguna cabecera coincide.
  const iOtrosDesc = ixAny([/^descripci[oó]n de otros pagos$/i, /otros pagos/i])

  const acc = new Map<string, Ln>()
  for (const linea of lineas.slice(1)) {
    const c = partirCSV(linea)
    const producto = (c[iProd] || '').trim()
    const uuid = iUuid >= 0 ? (c[iUuid] || '').trim() : ''
    const idCorto = (c[iId] || '').trim()
    const ref = uuid || idCorto
    let hora: number | null = null
    const hs = (c[iHora] || '').trim()
    if (/^\d{1,2}:/.test(hs)) hora = parseInt(hs.slice(0, 2), 10)
    let fecha: string | null = null
    const fs = (c[iFecha] || '').trim() // dd/mm/yy
    const mf = fs.match(/(\d{2})\/(\d{2})\/(\d{2,4})/)
    if (mf) { const yy = mf[3].length === 2 ? '20' + mf[3] : mf[3]; fecha = `${yy}-${mf[2]}-${mf[1]}` }
    const prime = /uber one/i.test(c[iPrime] || '')
    const imp = iConIva >= 0 ? (num(c[iConIva]) || null) : null
    const marca = normalizarMarca((c[iMarca] || '').trim() || 'Sin marca', marcasCanonicas)

    if (!producto) {
      // Fila sin artículo: tarifa/ads/promo. Se guarda como línea propia,
      // separada del neto estructural, si trae descripción de "otros pagos".
      const otrosDesc = iOtrosDesc >= 0 ? (c[iOtrosDesc] || '').trim() : ''
      if (!otrosDesc || !ref) continue
      const tipo = tipoDeOtrosPagos(otrosDesc)
      const keyOtros = `${ref}||__otros__${otrosDesc}`
      const yaOtros = acc.get(keyOtros)
      if (yaOtros) {
        if (imp != null) yaOtros.importe = (yaOtros.importe || 0) + imp
      } else {
        acc.set(keyOtros, {
          plataforma: 'uber', marca, pedido_ref: ref, fecha, hora,
          producto: `[Otros pagos] ${otrosDesc}`, cantidad: 1,
          precio_unit: null, importe: imp, es_prime: tipo === 'prime' || prime,
          origen: 'uber_detalle_articulo_otros_pagos', tipo_linea: tipo,
        })
      }
      continue
    }

    const cant = iCant >= 0 && num(c[iCant]) ? num(c[iCant]) : (iCantSol >= 0 ? num(c[iCantSol]) || 1 : 1)
    const precio = iPrecio >= 0 ? (num(c[iPrecio]) || null) : null
    const key = `${ref}||${producto}`
    const ya = acc.get(key)
    if (ya) {
      ya.cantidad += cant
      if (imp != null) ya.importe = (ya.importe || 0) + imp
    } else {
      acc.set(key, {
        plataforma: 'uber', marca, pedido_ref: ref || `${fecha}_${producto}`, fecha, hora,
        producto, cantidad: cant, precio_unit: precio, importe: imp, es_prime: prime,
        origen: 'uber_detalle_articulo', tipo_linea: 'producto',
      })
    }
  }
  const lns: Ln[] = Array.from(acc.values())
  for (let i = 0; i < lns.length; i += 200)
    await supabase.from('lineas_producto_operativa').upsert(lns.slice(i, i + 200), { onConflict: 'plataforma,pedido_ref,producto' })
  const refs = new Set(lns.map(l => l.pedido_ref))
  return {
    productos: lns.filter(l => l.origen === 'uber_detalle_articulo').length,
    otrosPagos: lns.filter(l => l.origen === 'uber_detalle_articulo_otros_pagos').length,
    pedidos: refs.size,
  }
}
