// uberHistorialOperativa — Lee el "historial de pedidos" de Uber (order history)
// y lo convierte en:
//   · pedidos_operativa  (una fila por pedido: tiempos, Prime, incidencias, canal)
//   · ventas_franja      (agregado por canal/marca/fecha/hora, excluyendo cancelados)
//
// Se reconoce por su cabecera: "Restaurante" + "Valor del recibo" + "Estado del pedido".
// Es un documento de OPERATIVA de ventas, no una factura ni una liquidación.

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
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}
function dowDeFecha(fechaISO: string): number {
  return new Date(fechaISO + 'T12:00:00Z').getUTCDay()
}

export function esHistorialPedidosUber(texto: string): boolean {
  const primera = (texto.split('\n')[0] || '')
  return /Restaurante/i.test(primera) && /Valor del recibo/i.test(primera) && /Estado del pedido/i.test(primera)
}

interface FilaOperativa {
  plataforma: string; marca: string; pedido_ref: string; fecha: string; hora: number | null
  estado: string | null; completado: boolean; articulos: number | null; valor_recibo: number | null
  es_prime: boolean; canal_origen: string | null; min_preparacion: number | null
  min_entrega: number | null; incidencia: string | null
}
interface FilaFranja {
  canal: string; marca: string; fecha: string; hora: number; dia_semana: number
  pedidos: number; unidades: number; importe: number
}

function parsear(texto: string): { operativa: FilaOperativa[]; franjas: FilaFranja[] } {
  const lineas = texto.split('\n').filter(l => l.trim())
  if (lineas[0]?.charCodeAt(0) === 0xFEFF) lineas[0] = lineas[0].slice(1)
  const hdr = partirCSV(lineas[0])
  const idx = (re: RegExp) => hdr.findIndex(h => re.test(h))
  const iRef = idx(/^C[oó]digo del pedido$/i)
  const iR = idx(/^Restaurante$/i)
  const iE = idx(/^Estado del pedido$/i)
  const iComp = idx(/est[aá] completo/i)
  const iV = idx(/^Valor del recibo$/i)
  const iN = idx(/Cantidad de art[ií]culos/i)
  const iH = idx(/^Hora del pedido del cliente$/i)
  const iPrime = idx(/pase de suscripci[oó]n/i)
  const iCanal = idx(/canal de pedidos/i)
  const iPrep = idx(/tiempo original de preparaci[oó]n/i)
  const iEntrega = idx(/^Tiempo total de entrega$/i)

  const operativa: FilaOperativa[] = []
  const agg = new Map<string, FilaFranja>()
  let ln = 0
  for (const linea of lineas.slice(1)) {
    const c = partirCSV(linea)
    const ts = (c[iH] || '').trim()
    if (ts.length < 13) continue
    const fecha = ts.slice(0, 10)
    const horaN = parseInt(ts.slice(11, 13), 10)
    const hora = isNaN(horaN) ? null : horaN
    const estado = (c[iE] || '').trim().toLowerCase()
    const cancelado = estado === 'canceled' || estado === 'cancelado' || estado === 'failed'
    const marca = (c[iR] || '').trim() || 'Sin marca'
    const primeRaw = iPrime >= 0 ? (c[iPrime] || '').trim().toLowerCase() : ''

    operativa.push({
      plataforma: 'uber', marca,
      pedido_ref: iRef >= 0 ? (c[iRef] || '').trim() : `${fecha}_${hora}_${ln++}`,
      fecha, hora, estado: estado || null,
      completado: iComp >= 0 ? /s[ií]|yes|true/i.test(c[iComp] || '') : !cancelado,
      articulos: iN >= 0 ? Math.round(num(c[iN] || '0')) : null,
      valor_recibo: iV >= 0 ? num(c[iV]) : null,
      es_prime: primeRaw === 'uber_one' || primeRaw.includes('uber one'),
      canal_origen: iCanal >= 0 ? (c[iCanal] || '').trim() || null : null,
      min_preparacion: iPrep >= 0 ? (num(c[iPrep]) || null) : null,
      min_entrega: iEntrega >= 0 ? (num(c[iEntrega]) || null) : null,
      incidencia: cancelado ? 'cancelado' : null,
    })

    if (!cancelado && hora != null) {
      const k = `${marca}||${fecha}||${hora}`
      if (!agg.has(k)) agg.set(k, { canal: 'uber', marca, fecha, hora, dia_semana: dowDeFecha(fecha), pedidos: 0, unidades: 0, importe: 0 })
      const a = agg.get(k)!
      a.pedidos += 1
      a.unidades += iN >= 0 ? Math.round(num(c[iN] || '0')) : 0
      a.importe += iV >= 0 ? num(c[iV]) : 0
    }
  }
  return { operativa, franjas: Array.from(agg.values()) }
}

export async function procesarHistorialPedidosUber(
  supabase: SupabaseClient,
  texto: string,
): Promise<{ pedidos: number; prime: number; incidencias: number; franjas: number }> {
  const { operativa, franjas } = parsear(texto)

  for (let i = 0; i < operativa.length; i += 200) {
    const lote = operativa.slice(i, i + 200)
    await supabase.from('pedidos_operativa').upsert(lote, { onConflict: 'plataforma,pedido_ref' })
  }

  const filasFranja = franjas.map(f => ({
    canal: f.canal, marca: f.marca, fecha: f.fecha, hora: f.hora,
    dia_semana: f.dia_semana, pedidos: f.pedidos, unidades: f.unidades,
    importe: Math.round(f.importe * 100) / 100,
    origen: 'uber_order_history', updated_at: new Date().toISOString(),
  }))
  for (let i = 0; i < filasFranja.length; i += 300) {
    const lote = filasFranja.slice(i, i + 300)
    await supabase.from('ventas_franja').upsert(lote, { onConflict: 'canal,marca,fecha,hora' })
  }

  return {
    pedidos: operativa.length,
    prime: operativa.filter(o => o.es_prime).length,
    incidencias: operativa.filter(o => o.incidencia).length,
    franjas: franjas.length,
  }
}
