// resolverContraparte.ts — BÚSQUEDA CRUZADA DE CONTRAPARTE (Prompt 2, task 5).
//
// Si una factura trae NIF pero no nombre (o al revés), se completa buscando en el
// diccionario NIF (fuente de verdad) y, si no está, en las reglas de conciliación
// por alias. Reutilizable desde el motor y el barrido de pendientes.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface Contraparte {
  nif: string | null
  nombre: string | null
  fuente: 'ya_completo' | 'diccionario' | 'reglas' | 'sin_resolver'
}

function normalizarNif(nif: string | null | undefined): string | null {
  if (!nif) return null
  const limpio = nif.replace(/[\s\-.]/g, '').toUpperCase()
  return limpio || null
}

// Completa el par (nif, nombre) de un proveedor. Al menos uno de los dos debe venir.
export async function resolverContraparte(
  supabase: SupabaseClient,
  entrada: { nif?: string | null; nombre?: string | null },
): Promise<Contraparte> {
  const nif = normalizarNif(entrada.nif)
  const nombre = entrada.nombre?.trim() || null
  if (nif && nombre) return { nif, nombre, fuente: 'ya_completo' }
  if (!nif && !nombre) return { nif: null, nombre: null, fuente: 'sin_resolver' }

  // 1) Diccionario NIF (fuente de verdad).
  try {
    if (nif) {
      const { data } = await supabase.from('diccionario_nif_proveedor')
        .select('proveedor_canonico').eq('nif', nif).maybeSingle()
      if (data?.proveedor_canonico) return { nif, nombre: data.proveedor_canonico as string, fuente: 'diccionario' }
    } else if (nombre) {
      const { data } = await supabase.from('diccionario_nif_proveedor')
        .select('nif').ilike('proveedor_canonico', `%${nombre}%`).maybeSingle()
      if (data?.nif) return { nif: data.nif as string, nombre, fuente: 'diccionario' }
    }
  } catch { /* best-effort */ }

  // 2) Reglas de conciliación por alias (razon_social / patron).
  try {
    if (nif) {
      const { data } = await supabase.from('reglas_conciliacion')
        .select('razon_social').eq('patron_nif', nif).not('razon_social', 'is', null).maybeSingle()
      if (data?.razon_social) return { nif, nombre: data.razon_social as string, fuente: 'reglas' }
    } else if (nombre) {
      const { data } = await supabase.from('reglas_conciliacion')
        .select('patron_nif').ilike('razon_social', `%${nombre}%`).not('patron_nif', 'is', null).maybeSingle()
      if (data?.patron_nif) return { nif: data.patron_nif as string, nombre, fuente: 'reglas' }
    }
  } catch { /* best-effort */ }

  return { nif, nombre, fuente: 'sin_resolver' }
}
