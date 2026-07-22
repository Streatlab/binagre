/**
 * bizumExtra — búsqueda del pago por Bizum de un EXTRA (ej. Fernando) en
 * conciliación de un mes. Búsqueda por nombre real (palabras >=3 letras,
 * normalizado sin tildes), SIN fuzzy inventado: si no hay match, null.
 * Compartido entre TabCostes y la pestaña Personas para no reimplementar
 * el mismo criterio dos veces.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

interface ConciliacionRow {
  fecha: string
  concepto: string | null
  proveedor: string | null
  importe: number
}

export function normalizarNombre(s: string | null | undefined): string {
  if (!s) return ''
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

export async function buscarBizumMes(
  supabase: SupabaseClient,
  nombreEmpleado: string,
  mes: number,
  anio: number,
): Promise<{ importe: number; fecha: string } | null> {
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = new Date(anio, mes, 0).getDate()
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

  const { data } = await supabase.from('conciliacion').select('fecha, concepto, proveedor, importe')
    .eq('tipo', 'gasto').gte('fecha', desde).lte('fecha', hasta)

  const palabras = normalizarNombre(nombreEmpleado).split(/\s+/).filter(p => p.length >= 3)
  if (palabras.length === 0) return null

  const matches = ((data ?? []) as ConciliacionRow[]).filter(c => {
    const texto = `${normalizarNombre(c.concepto)} ${normalizarNombre(c.proveedor)}`
    return palabras.some(p => texto.includes(p))
  })
  if (matches.length === 0) return null

  const suma = matches.reduce((s, c) => s + Math.abs(Number(c.importe)), 0)
  return { importe: suma, fecha: matches[matches.length - 1].fecha }
}
