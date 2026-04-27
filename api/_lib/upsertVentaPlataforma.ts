/**
 * T-F2-10 — UPSERT acumulación ventas_plataforma
 *
 * Clave única: (fecha_inicio_periodo, fecha_fin_periodo, plataforma, marca)
 *
 * Si existe fila:
 *   - Sumar bruto + neto + pedidos
 *   - Recalcular ticket_medio = bruto_acumulado / pedidos_acumulados
 *   - Append nif_factura a facturas_origen[]
 *   - Si una factura tiene marca='SIN_MARCA' y la nueva tiene marca resuelta:
 *     usar la resuelta para ambas (H3)
 *
 * Si no existe: INSERT directo.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { VentaPlataformaInput, PedidoPlataformaInput } from './parsers/types.js'

export interface UpsertResult {
  ok: boolean
  ventaId?: string
  accion: 'insert' | 'update'
  marcaResuelta?: string   // si se resolvió SIN_MARCA
  error?: string
}

/**
 * Upsert de una venta de plataforma con lógica de acumulación.
 */
export async function upsertVentaPlataforma(
  supabase: SupabaseClient,
  input: VentaPlataformaInput,
): Promise<UpsertResult> {
  const {
    fecha_inicio_periodo, fecha_fin_periodo, plataforma, marca,
    bruto, neto, pedidos, ingreso_colaborador, fecha_pago, facturas_origen,
  } = input

  // Buscar fila existente por clave única
  const { data: existente, error: errBuscar } = await supabase
    .from('ventas_plataforma')
    .select('id, bruto, neto, pedidos, facturas_origen, marca, ingreso_colaborador')
    .eq('fecha_inicio_periodo', fecha_inicio_periodo)
    .eq('fecha_fin_periodo', fecha_fin_periodo)
    .eq('plataforma', plataforma)
    // Para UPSERT debemos buscar por marca; pero si hay SIN_MARCA necesitamos cruzar
    .maybeSingle()

  if (errBuscar) {
    return { ok: false, accion: 'insert', error: errBuscar.message }
  }

  // Si no hay fila con misma marca exacta, verificar si hay SIN_MARCA que resolver
  if (!existente) {
    // Buscar si hay una fila SIN_MARCA para el mismo periodo+plataforma
    const { data: sinMarca } = await supabase
      .from('ventas_plataforma')
      .select('id, bruto, neto, pedidos, facturas_origen, ingreso_colaborador')
      .eq('fecha_inicio_periodo', fecha_inicio_periodo)
      .eq('fecha_fin_periodo', fecha_fin_periodo)
      .eq('plataforma', plataforma)
      .eq('marca', 'SIN_MARCA')
      .maybeSingle()

    if (sinMarca && marca !== 'SIN_MARCA') {
      // Resolver SIN_MARCA: actualizar la fila existente con la marca correcta
      const brutoAcum = (sinMarca.bruto ?? 0) + bruto
      const netoAcum = (sinMarca.neto ?? 0) + neto
      const pedidosAcum = (sinMarca.pedidos ?? 0) + pedidos
      const ingresoAcum = (sinMarca.ingreso_colaborador ?? 0) + ingreso_colaborador
      const ticketMedio = pedidosAcum > 0 ? brutoAcum / pedidosAcum : 0
      const facturasAcum = [
        ...((sinMarca.facturas_origen as string[]) ?? []),
        ...facturas_origen,
      ].filter((v, i, arr) => arr.indexOf(v) === i)

      const { error: errUpdate } = await supabase
        .from('ventas_plataforma')
        .update({
          marca,   // Resolver SIN_MARCA con la marca correcta (H3)
          bruto: brutoAcum,
          neto: netoAcum,
          pedidos: pedidosAcum,
          ticket_medio: ticketMedio,
          ingreso_colaborador: ingresoAcum,
          ...(fecha_pago ? { fecha_pago } : {}),
          facturas_origen: facturasAcum,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinMarca.id as string)

      if (errUpdate) {
        return { ok: false, accion: 'update', error: errUpdate.message }
      }
      return { ok: true, accion: 'update', ventaId: sinMarca.id as string, marcaResuelta: marca }
    }

    // Insert directo
    const ticketMedio = pedidos > 0 ? bruto / pedidos : 0
    const { data: nueva, error: errInsert } = await supabase
      .from('ventas_plataforma')
      .insert({
        fecha_inicio_periodo,
        fecha_fin_periodo,
        plataforma,
        marca,
        bruto,
        neto,
        pedidos,
        ticket_medio: ticketMedio,
        ingreso_colaborador,
        ...(fecha_pago ? { fecha_pago } : {}),
        facturas_origen,
      })
      .select('id')
      .single()

    if (errInsert || !nueva) {
      return { ok: false, accion: 'insert', error: errInsert?.message || 'Insert fallido' }
    }
    return { ok: true, accion: 'insert', ventaId: nueva.id as string }
  }

  // ── Acumulación: fila existente con misma marca ───────────────────────────
  const brutoAcum = (existente.bruto ?? 0) + bruto
  const netoAcum = (existente.neto ?? 0) + neto
  const pedidosAcum = (existente.pedidos ?? 0) + pedidos
  const ingresoAcum = (existente.ingreso_colaborador ?? 0) + ingreso_colaborador
  const ticketMedio = pedidosAcum > 0 ? brutoAcum / pedidosAcum : 0
  const facturasAcum = [
    ...((existente.facturas_origen as string[]) ?? []),
    ...facturas_origen,
  ].filter((v, i, arr) => arr.indexOf(v) === i)

  const { error: errUpdate } = await supabase
    .from('ventas_plataforma')
    .update({
      bruto: brutoAcum,
      neto: netoAcum,
      pedidos: pedidosAcum,
      ticket_medio: ticketMedio,
      ingreso_colaborador: ingresoAcum,
      ...(fecha_pago ? { fecha_pago } : {}),
      facturas_origen: facturasAcum,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existente.id as string)

  if (errUpdate) {
    return { ok: false, accion: 'update', error: errUpdate.message }
  }
  return { ok: true, accion: 'update', ventaId: existente.id as string }
}

/**
 * Inserta múltiples pedidos individuales (solo Glovo formato A).
 */
export async function insertarPedidosPlataforma(
  supabase: SupabaseClient,
  pedidos: PedidoPlataformaInput[],
): Promise<{ ok: boolean; insertados: number; error?: string }> {
  if (pedidos.length === 0) return { ok: true, insertados: 0 }

  const { error } = await supabase
    .from('pedidos_plataforma')
    .insert(pedidos.map(p => ({
      fecha: p.fecha,
      hora: p.hora,
      plataforma: p.plataforma,
      marca: p.marca,
      plato: p.plato,
      precio_bruto: p.precio_bruto,
      promo: p.promo,
      courier: p.courier,
      glovo_id: p.glovo_id,
      factura_origen: p.factura_origen,
    })))

  if (error) {
    return { ok: false, insertados: 0, error: error.message }
  }
  return { ok: true, insertados: pedidos.length }
}
