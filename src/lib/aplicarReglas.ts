import { supabase } from '@/lib/supabase'

export interface ReglaConciliacion {
  id: string
  patron: string | null
  match_ordenante: string | null
  match_beneficiario: string | null
  match_titular_id: string | null
  match_importe_min: number | null
  match_importe_max: number | null
  set_proveedor: string | null
  categoria_codigo: string | null
  borrar: boolean
  prioridad: number
  activa: boolean
}

export interface MovParaRegla {
  titular_id: string | null
  concepto: string | null
  ordenante: string | null
  beneficiario: string | null
  importe: number
  proveedor?: string | null
  categoria?: string | null
}

let cacheReglas: ReglaConciliacion[] | null = null

export async function cargarReglas(): Promise<ReglaConciliacion[]> {
  if (cacheReglas) return cacheReglas
  const { data, error } = await supabase
    .from('reglas_conciliacion')
    .select('*')
    .eq('activa', true)
    .order('prioridad', { ascending: true })
  if (error) throw error
  cacheReglas = data ?? []
  return cacheReglas
}

export function invalidarCacheReglas() { cacheReglas = null }

function matcheaTexto(valor: string | null, patron: string | null): boolean {
  if (!patron) return true // condición no-evaluada = pasa
  if (!valor) return false
  return valor.toLowerCase().includes(patron.toLowerCase())
}

export function aplicarReglas(
  mov: MovParaRegla,
  reglas: ReglaConciliacion[]
): { mov: MovParaRegla; borrar: boolean; reglaAplicada: string | null } {
  for (const r of reglas) {
    const ok = (
      matcheaTexto(mov.concepto, r.patron) &&
      matcheaTexto(mov.ordenante, r.match_ordenante) &&
      matcheaTexto(mov.beneficiario, r.match_beneficiario) &&
      (r.match_titular_id === null || mov.titular_id === r.match_titular_id) &&
      (r.match_importe_min === null || mov.importe >= r.match_importe_min) &&
      (r.match_importe_max === null || mov.importe <= r.match_importe_max)
    )
    if (!ok) continue

    if (r.borrar) {
      return { mov, borrar: true, reglaAplicada: r.patron ?? r.id }
    }

    return {
      mov: {
        ...mov,
        proveedor: r.set_proveedor ?? mov.proveedor,
        categoria: r.categoria_codigo ?? mov.categoria,
      },
      borrar: false,
      reglaAplicada: r.patron ?? r.id,
    }
  }
  return { mov, borrar: false, reglaAplicada: null }
}
