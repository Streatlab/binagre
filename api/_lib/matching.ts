import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedFactura } from './ocr'

const LIMITE_CONCILIACION = '2023-07-01'

export type MatchingResult = 'asociada' | 'pendiente_revision' | 'historica'

export async function matchingGastos(
  facturaId: string,
  extracted: ExtractedFactura,
  supabase: SupabaseClient,
): Promise<MatchingResult> {
  if (extracted.es_recapitulativa && extracted.periodo_inicio && extracted.periodo_fin) {
    const { data: gastos } = await supabase
      .from('conciliacion')
      .select('id, fecha, importe, concepto')
      .lt('importe', 0)
      .gte('fecha', extracted.periodo_inicio)
      .lte('fecha', extracted.periodo_fin)
      .ilike('concepto', `%${extracted.proveedor_nombre}%`)

    if (!gastos || gastos.length === 0) {
      return decidirHistorica(extracted)
    }

    const sumaGastos = gastos.reduce((a, g) => a + Math.abs(Number(g.importe)), 0)
    const diff = Math.abs(sumaGastos - extracted.total)

    if (diff < 1) {
      for (const g of gastos) {
        await supabase.from('facturas_gastos').insert({
          factura_id: facturaId,
          conciliacion_id: g.id,
          importe_asociado: Math.abs(Number(g.importe)),
          confirmado: true,
        })
      }
      return 'asociada'
    }
    return 'pendiente_revision'
  }

  const fechaBase = new Date(extracted.fecha_factura)
  const fechaMin = new Date(fechaBase)
  fechaMin.setDate(fechaMin.getDate() - 3)
  const fechaMax = new Date(fechaBase)
  fechaMax.setDate(fechaMax.getDate() + 3)

  const { data: candidatos } = await supabase
    .from('conciliacion')
    .select('id, fecha, importe, concepto')
    .lt('importe', 0)
    .gte('fecha', fechaMin.toISOString().slice(0, 10))
    .lte('fecha', fechaMax.toISOString().slice(0, 10))

  const match = candidatos?.find(
    (g) => Math.abs(Math.abs(Number(g.importe)) - extracted.total) < 0.5,
  )

  if (match) {
    await supabase.from('facturas_gastos').insert({
      factura_id: facturaId,
      conciliacion_id: match.id,
      importe_asociado: Math.abs(Number(match.importe)),
      confirmado: false,
    })
    return 'pendiente_revision'
  }

  return decidirHistorica(extracted)
}

function decidirHistorica(extracted: ExtractedFactura): MatchingResult {
  const fechaFac = new Date(extracted.fecha_factura)
  const limite = new Date(LIMITE_CONCILIACION)
  if (fechaFac < limite) return 'historica'
  return 'pendiente_revision'
}
