# TASKS — Fix Conciliación · matching automático de proveedor

Pipeline: `pm-spec` ✅ → `implementer` (en curso) → `qa-reviewer`.

## T1 · Crear `src/lib/matchProveedor.ts`
Helper aislado, cero dependencias UI. Exporta:
- `loadAliases(): Promise<AliasRow[]>` — fetch + caché en módulo.
- `invalidateAliasCache(): void` — limpia caché.
- `matchProveedor(concepto: string, aliases: AliasRow[]): string | null` — pura, ordena por `alias.length` DESC, retorna primer canónico que matchee.

```ts
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
```

## T2 · Modificar `src/hooks/useConciliacion.ts`
- Añadir import al inicio:
  ```ts
  import { loadAliases, matchProveedor } from '@/lib/matchProveedor'
  ```
- Dentro de `insertMovimientos(rows, onProgress)`, **JUSTO ANTES** del bloque `// 1. Resolver órdenes ya usados en BD...`, insertar:
  ```ts
  // 0. Resolver proveedor canónico contra alias para filas sin proveedor
  const aliases = await loadAliases()
  rows = rows.map(r => ({
    ...r,
    proveedor: r.proveedor && r.proveedor.trim() !== ''
      ? r.proveedor
      : matchProveedor(r.concepto ?? '', aliases),
  }))
  ```

NO tocar nada más en el archivo. NO tocar el componente `Conciliacion.tsx` (ya lee `m.proveedor` correctamente).

## T3 · QA
1. `npm run build` → 0 errores TS.
2. Levantar dev local: `npm run dev`.
3. Abrir `/finanzas/conciliacion` → tab Movimientos → importar CSV de prueba con conceptos que incluyan "MERCADONA", "UBER", "GLOVO", "TRANSFERENCIA".
4. Verificar tabla: columna Contraparte muestra proveedor canónico para los reconocidos, vacío para "TRANSFERENCIA".
5. Console limpia, sin warnings nuevos.

## T4 · Cierre obligatorio
```
git add . && git commit -m "fix(conciliacion): match proveedor contra alias en insertMovimientos" && git push origin master && npx vercel --prod && git pull origin master
```
