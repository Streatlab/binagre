# TASKS — Bloque B Conciliación

Pipeline: pm-spec ✅ → implementer → qa-reviewer.
**BD ya preparada por Claude (chat principal):** columnas ordenante/beneficiario añadidas, 3 reglas seed creadas. NO ejecutar migraciones de schema.

## T1 · src/lib/normalizar.ts (NUEVO)
```ts
export function normalizarConcepto(c: string): string {
  return (c ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export async function calcularDedupKey(
  titularId: string,
  fecha: string,
  importe: number,
  concepto: string
): Promise<string> {
  const data = new TextEncoder().encode(
    `${titularId}${fecha}${Math.round(importe * 100)}${normalizarConcepto(concepto)}`
  )
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

## T2 · src/lib/aplicarReglas.ts (NUEVO)
Motor de reglas multi-dimensión. Carga reglas activas, aplica la primera que matchea TODAS las condiciones no-NULL.

```ts
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
```

## T3 · Parser BBVA en `src/components/conciliacion/ImportDropzone.tsx`
1. Detectar columnas adicionales (case-insensitive): "Ordenante", "Beneficiario".
2. Mapear a row: `{ ...existente, ordenante, beneficiario }`.

## T4 · `src/hooks/useConciliacion.ts` — `insertMovimientos`
**Refactor del flujo (orden):**

```ts
import { calcularDedupKey } from '@/lib/normalizar'
import { cargarReglas, aplicarReglas } from '@/lib/aplicarReglas'
import { loadAliases, matchProveedor } from '@/lib/matchProveedor'

async function insertMovimientos(rows, onProgress) {
  // 0. Cargar reglas y alias en paralelo
  const [reglas, aliases] = await Promise.all([cargarReglas(), loadAliases()])
  
  // 1. Aplicar matching de proveedor (alias) para los que vengan sin
  rows = rows.map(r => ({
    ...r,
    proveedor: r.proveedor && r.proveedor.trim() !== ''
      ? r.proveedor
      : matchProveedor(r.concepto ?? '', aliases),
  }))
  
  // 2. Aplicar motor de reglas multi-dimensión
  let omitidos = 0
  rows = rows
    .map(r => {
      const { mov, borrar } = aplicarReglas(r, reglas)
      if (borrar) { omitidos++; return null }
      return mov
    })
    .filter(Boolean)
  
  // 3. Calcular dedup_key para cada row
  rows = await Promise.all(rows.map(async r => ({
    ...r,
    dedup_key: await calcularDedupKey(r.titular_id, r.fecha, r.importe, r.concepto ?? ''),
  })))
  
  // 4. INSERT con upsert (ignore duplicates)
  const { data, error } = await supabase
    .from('conciliacion')
    .upsert(rows, { ignoreDuplicates: true, onConflict: 'titular_id,dedup_key' })
    .select()
  
  if (error) throw error
  
  return {
    insertados: data?.length ?? 0,
    duplicados: rows.length - (data?.length ?? 0),
    omitidos,
  }
}
```

## T5 · UI Feedback Import
En ImportDropzone, mostrar al terminar:
"✅ X importados, Y duplicados (ya existían), Z omitidos por reglas"

## T6 · Hook Running `src/hooks/useRunningSueldos.ts` (NUEVO)
```ts
export function useRunningSueldos(mes: string) {
  // mes formato 'YYYY-MM'
  // Devuelve: { ruben, emilio, desgloseEmilio: { plataformas, complementoSL } }
  
  const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'
  const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
  
  // Ingresos plataforma Emilio:
  // SUM(importe) WHERE titular_id = EMILIO AND importe > 0 AND fecha BETWEEN inicio_mes AND fin_mes
  
  // Complemento SL:
  // SUM(ABS(importe)) WHERE titular_id = RUBEN AND categoria = 'RRH-NOM-EMI' AND fecha BETWEEN inicio_mes AND fin_mes
  
  // Sueldo total Emilio = plataformas + complementoSL
}
```

## T7 · Integrar en `src/pages/finanzas/Running.tsx`
Mostrar tabla de sueldos con:
- Fila Emilio: "Plataformas: X€ + Complemento SL: Y€ = Total Z€"
- Fila Rubén: pendiente lógica (autosueldos por definir)

## T8 · QA Validations
1. `npm run build` 0 errores.
2. Re-importar el Excel Emilio actual: "0 importados, 61 duplicados, 0 omitidos".
3. Crear Excel sintético con: 1 traspaso Emilio + 1 transferencia Rubén beneficiario "Timoteo Hnz" 867€ + 1 transferencia Rubén beneficiario "Emilio Dorca" 500€.
   - Resultado esperado: "2 importados, 0 duplicados, 1 omitido".
   - El de Timoteo aparece con ALQ-LOC.
   - El de Emilio aparece con RRH-NOM-EMI.
4. Running > Emilio abr 2026: plataformas ~1.710€ + complemento SL 500€ = ~2.210€.

## T9 · Cierre
git add . && git commit -m "feat(conciliacion): bloque B - reglas multi-dim + dedup robusto + sueldos Running" && git push origin master && git pull origin master
NO Vercel (regla 3).
