// glovoOperativa — Lee el "orderDetails" (Historial de pedidos) de Glovo en
// español y lo convierte en:
//   · pedidos_operativa          (una fila por pedido: hora, estado, reclamos)
//   · lineas_producto_operativa  (una fila por producto del pedido)
//   · ventas_franja              (agregado por marca/fecha/hora)
//
// Se reconoce por cabecera española: "Nombre del local" + "Total parcial".
// Los campos pueden tener saltos de línea dentro de comillas (la dirección del
// local), así que se parsea el CSV completo respetando las comillas.

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarMarca, limpiarSufijoLocal, type MarcaCanonica } from './normalizarMarca.js'

// CSV robusto: respeta comillas y saltos de línea dentro de campos.
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let cur = '', dentro = false, row: string[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (dentro) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') dentro = false
      else cur += ch
    } else {
      if (ch === '"') dentro = true
      else if (ch === ',') { row.push(cur.trim()); cur = '' }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(cur.trim()); cur = ''
        if (row.some(c => c !== '')) rows.push(row)
        row = []; if (ch === '\r') i++
      } else cur += ch
    }
  }
  if (cur || row.length) { row.push(cur.trim()); if (row.some(c => c !== '')) rows.push(row) }
  return rows
}

function num(s: string | undefined): number {
  const v = (s || '').replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = parseFloat(v); return isNaN(n) ? 0 : n
}
function dow(f: string): number { return new Date(f + 'T12:00:00Z').getUTCDay() }

export function esOrderDetailsGlovo(texto: string): boolean {
  const cab = (texto || '').slice(0, 4000).toLowerCase()
  return cab.includes('nombre del local') && cab.includes('total parcial')
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

export function parsear(texto: string, marcasCanonicas: MarcaCanonica[]): { operativa: Op[]; franjas: Fr[]; lineas: Ln[] } {
  const rows = parseCSV(texto)
  if (rows.length < 2) return { operativa: [], franjas: [], lineas: [] }
  const hdr = rows[0].map(h => h.toLowerCase())
  const ix = (...res: RegExp[]) => { for (const re of res) { const i = hdr.findIndex(h => re.test(h)); if (i !== -1) return i } return -1 }
  const iId = ix(/^nro de pedido$/, /n.?º? de pedido/, /^pedido$/, /order id/)
  const iRest = ix(/^nombre del local$/, /nombre del local/, /^local$/)
  const iEst = ix(/^estado del pedido$/, /estado del pedido/, /^estado$/)
  const iRec = ix(/^fecha del pedido$/, /fecha del pedido/, /^fecha$/)
  const iReclamo = ix(/tiene reclamos/, /reclamo/)
  const iCancel = ix(/cancelado el/)
  const iTotal = ix(/^total parcial$/, /total parcial/)
  const iItems = ix(/^art[íi]culos$/, /art[íi]culos/)
  // Prime: nombre de columna no confirmado con un export real (fallo seguro a
  // false si ninguna cabecera de la lista coincide, igual que antes de esto).
  const iPrime = ix(/es pedido pro/, /pedido pro/, /^pro\??$/, /suscrip/, /glovo\s*prime/)

  const operativa: Op[] = [], lns: Ln[] = []
  const agg = new Map<string, Fr>()
  const vistos = new Set<string>()
  for (const c of rows.slice(1)) {
    const ref = (iId >= 0 ? c[iId] || '' : '').trim()
    if (!ref || vistos.has(ref)) continue
    vistos.add(ref)
    const ts = (iRec >= 0 ? c[iRec] || '' : '').trim()
    if (ts.length < 10) continue
    const fecha = ts.slice(0, 10)
    const hn = parseInt(ts.slice(11, 13), 10); const hora = isNaN(hn) ? null : hn
    const est = (iEst >= 0 ? c[iEst] || '' : '').trim().toLowerCase()
    const cancelado = est.includes('cancel') || est.includes('rechaz') || est.includes('reject') || (iCancel >= 0 && !!(c[iCancel] || '').trim())
    const reclamo = /^s/i.test((iReclamo >= 0 ? c[iReclamo] || '' : '').trim()) // "Sí"
    const marca = normalizarMarca(iRest >= 0 ? c[iRest] || '' : '', marcasCanonicas)
    const total = iTotal >= 0 ? num(c[iTotal]) : 0
    const items = iItems >= 0 ? parseItems(c[iItems] || '') : []
    const nart = items.reduce((a, x) => a + x.cantidad, 0)
    const prime = iPrime >= 0 ? /^s[ií]|^y|^true|^1$/i.test((c[iPrime] || '').trim()) : false

    operativa.push({
      plataforma: 'glovo', marca, pedido_ref: ref, fecha, hora,
      estado: est || null, completado: !cancelado, articulos: nart || null,
      valor_recibo: total || null, es_prime: prime, canal_origen: null,
      min_preparacion: null, min_entrega: null,
      incidencia: cancelado ? (est || 'cancelado') : (reclamo ? 'reclamacion' : null),
    })

    for (const it of items) {
      const prev = lns.find(l => l.pedido_ref === ref && l.producto === it.producto)
      if (prev) { prev.cantidad += it.cantidad; continue }
      lns.push({
        plataforma: 'glovo', marca, pedido_ref: ref, fecha, hora,
        producto: it.producto, cantidad: it.cantidad,
        precio_unit: null, importe: null, es_prime: prime, origen: 'glovo_orderdetails',
      })
    }

    if (!cancelado && hora != null) {
      const k = `${marca}||${fecha}||${hora}`
      if (!agg.has(k)) agg.set(k, { canal: 'glovo', marca, fecha, hora, dia_semana: dow(fecha), pedidos: 0, unidades: 0, importe: 0 })
      const a = agg.get(k)!; a.pedidos += 1; a.unidades += nart; a.importe += total
    }
  }
  return { operativa, franjas: Array.from(agg.values()), lineas: lns }
}

export async function procesarOrderDetailsGlovo(supabase: SupabaseClient, texto: string) {
  const { data: marcasCanonicas } = await supabase.from('marcas').select('nombre')
  const { operativa, franjas, lineas } = parsear(texto, marcasCanonicas ?? [])
  for (let i = 0; i < operativa.length; i += 200)
    await supabase.from('pedidos_operativa').upsert(operativa.slice(i, i + 200), { onConflict: 'plataforma,pedido_ref' })
  const ff = franjas.map(f => ({ canal: f.canal, marca: f.marca, fecha: f.fecha, hora: f.hora, dia_semana: f.dia_semana, pedidos: f.pedidos, unidades: f.unidades, importe: Math.round(f.importe * 100) / 100, origen: 'glovo_orderdetails', updated_at: new Date().toISOString() }))
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
