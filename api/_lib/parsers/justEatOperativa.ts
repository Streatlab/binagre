// justEatOperativa — Lee el "orderDetails" de Just Eat y lo convierte en:
//   · pedidos_operativa          (una fila por pedido: hora, Prime, incidencias)
//   · lineas_producto_operativa  (una fila por producto del pedido)
//
// Se reconoce por cabecera: "Order ID" + "Order received at" + "Order status".

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
function dow(f: string): number { return new Date(f + 'T12:00:00Z').getUTCDay() }

export function esOrderDetailsJustEat(texto: string): boolean {
  const p = (texto.split('\n')[0] || '')
  return /Order ID/i.test(p) && /Order received at/i.test(p) && /Order status/i.test(p)
}

// "1 Bienmesabe [1 MEDIA], 2 Brioche con Nutella" → [{producto,cantidad}]
function parseItems(txt: string): { producto: string; cantidad: number }[] {
  if (!txt) return []
  const out: { producto: string; cantidad: number }[] = []
  for (const raw of txt.split(',')) {
    const s = raw.trim(); if (!s) continue
    const m = s.match(/^(\d+)\s+(.+)$/)
    if (m) out.push({ cantidad: parseInt(m[1], 10) || 1, producto: m[2].replace(/\s*\[[^\]]*\]\s*/g, ' ').trim() })
    else out.push({ cantidad: 1, producto: s.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim() })
  }
  return out.filter(x => x.producto)
}

interface Op {
  plataforma: string; marca: string; pedido_ref: string; fecha: string; hora: number | null
  estado: string | null; completado: boolean; articulos: number | null; valor_recibo: number | null
  es_prime: boolean; canal_origen: string | null; min_preparacion: number | null; min_entrega: number | null; incidencia: string | null
}
interface Fr { canal: string; marca: string; fecha: string; hora: number; dia_semana: number; pedidos: number; unidades: number; importe: number }
interface Ln { plataforma: string; marca: string; pedido_ref: string; fecha: string; hora: number | null; producto: string; cantidad: number; precio_unit: number | null; importe: number | null; es_prime: boolean; origen: string }

function parsear(texto: string, marcasCanonicas: MarcaCanonica[]): { operativa: Op[]; franjas: Fr[]; lineas: Ln[] } {
  const lineas = texto.split('\n').filter(l => l.trim())
  if (lineas[0]?.charCodeAt(0) === 0xFEFF) lineas[0] = lineas[0].slice(1)
  const hdr = partirCSV(lineas[0])
  const ix = (re: RegExp) => hdr.findIndex(h => re.test(h))
  const iId = ix(/^Order ID$/i), iRest = ix(/^Restaurant name$/i), iEst = ix(/^Order status$/i)
  const iSub = ix(/^Is Subscription Order$/i), iRec = ix(/^Order received at$/i)
  const iComp = ix(/^Has Complaint\?$/i), iCancel = ix(/^Cancellation reason$/i)
  const iSubtotal = ix(/^Subtotal$/i), iItems = ix(/^Order Items$/i)

  const operativa: Op[] = [], lns: Ln[] = []
  const agg = new Map<string, Fr>()
  for (const linea of lineas.slice(1)) {
    const c = partirCSV(linea)
    const ts = (c[iRec] || '').trim(); if (ts.length < 13) continue
    const fecha = ts.slice(0, 10)
    const hn = parseInt(ts.slice(11, 13), 10); const hora = isNaN(hn) ? null : hn
    const est = (c[iEst] || '').trim().toLowerCase()
    const cancelado = est.includes('cancel') || est.includes('reject') || est.includes('fail')
    const complaint = /^y/i.test(c[iComp] || '')
    const marca = normalizarMarca((c[iRest] || '').split(':')[0].trim() || 'Sin marca', marcasCanonicas)
    const prime = /^y/i.test(c[iSub] || '')
    const ref = (c[iId] || '').trim()
    const subtotal = iSubtotal >= 0 ? num(c[iSubtotal]) : 0
    const items = iItems >= 0 ? parseItems(c[iItems] || '') : []
    const nart = items.reduce((a, x) => a + x.cantidad, 0)

    operativa.push({
      plataforma: 'just_eat', marca, pedido_ref: ref, fecha, hora,
      estado: est || null, completado: !cancelado, articulos: nart || null,
      valor_recibo: subtotal || null, es_prime: prime, canal_origen: null,
      min_preparacion: null, min_entrega: null,
      incidencia: cancelado ? (c[iCancel] || 'cancelado') : (complaint ? 'reclamacion' : null),
    })

    for (const it of items) {
      const prev = lns.find(l => l.pedido_ref === ref && l.producto === it.producto)
      if (prev) { prev.cantidad += it.cantidad; continue }
      lns.push({
        plataforma: 'just_eat', marca, pedido_ref: ref, fecha, hora,
        producto: it.producto, cantidad: it.cantidad,
        precio_unit: null, importe: null, es_prime: prime, origen: 'just_eat_orderdetails',
      })
    }

    if (!cancelado && hora != null) {
      const k = `${marca}||${fecha}||${hora}`
      if (!agg.has(k)) agg.set(k, { canal: 'just_eat', marca, fecha, hora, dia_semana: dow(fecha), pedidos: 0, unidades: 0, importe: 0 })
      const a = agg.get(k)!; a.pedidos += 1; a.unidades += nart; a.importe += subtotal
    }
  }
  return { operativa, franjas: Array.from(agg.values()), lineas: lns }
}

export async function procesarOrderDetailsJustEat(supabase: SupabaseClient, texto: string) {
  const { data: marcasCanonicas } = await supabase.from('marcas').select('nombre')
  const { operativa, franjas, lineas } = parsear(texto, marcasCanonicas ?? [])
  for (let i = 0; i < operativa.length; i += 200)
    await supabase.from('pedidos_operativa').upsert(operativa.slice(i, i + 200), { onConflict: 'plataforma,pedido_ref' })
  const ff = franjas.map(f => ({ canal: f.canal, marca: f.marca, fecha: f.fecha, hora: f.hora, dia_semana: f.dia_semana, pedidos: f.pedidos, unidades: f.unidades, importe: Math.round(f.importe * 100) / 100, origen: 'just_eat_orderdetails', updated_at: new Date().toISOString() }))
  for (let i = 0; i < ff.length; i += 300)
    await supabase.from('ventas_franja').upsert(ff.slice(i, i + 300), { onConflict: 'canal,marca,fecha,hora' })
  for (let i = 0; i < lineas.length; i += 200)
    await supabase.from('lineas_producto_operativa').upsert(lineas.slice(i, i + 200), { onConflict: 'plataforma,pedido_ref,producto' })
  return {
    pedidos: operativa.length,
    prime: operativa.filter(o => o.es_prime).length,
    incidencias: operativa.filter(o => o.incidencia).length,
    productos: lineas.length,
  }
}
