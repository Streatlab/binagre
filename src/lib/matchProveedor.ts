import { supabase } from '@/lib/supabase'

export interface AliasRow {
  proveedor_canonico: string
  alias: string
}

let cacheAlias: AliasRow[] | null = null

export async function loadAliases(): Promise<AliasRow[]> {
  if (cacheAlias) return cacheAlias
  const { data, error } = await supabase
    .from('proveedor_alias')
    .select('proveedor_canonico, alias')
  if (error) throw error
  cacheAlias = (data ?? []).sort((a, b) => b.alias.length - a.alias.length)
  return cacheAlias
}

export function invalidateAliasCache(): void {
  cacheAlias = null
}

export function matchProveedor(concepto: string, aliases: AliasRow[]): string | null {
  if (!concepto) return null
  const c = concepto.toLowerCase()
  for (const a of aliases) {
    if (c.includes(a.alias.toLowerCase())) return a.proveedor_canonico
  }
  return null
}
