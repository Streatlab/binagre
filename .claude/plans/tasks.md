# TASKS — Bloque B Conciliación

Pipeline: pm-spec ✅ → architect-review (skip, scope claro) → implementer → qa-reviewer.

## T1 · Migración BD (architect)
1. Crear migración: `ALTER TABLE conciliacion ADD COLUMN ordenante TEXT, ADD COLUMN beneficiario TEXT;`
2. Crear índice único: `CREATE UNIQUE INDEX uniq_conciliacion_dedup ON conciliacion (titular_id, dedup_key);` (asume dedup_key ya existe; verificar que está pobladito con backfill).
3. Backfill dedup_key si está NULL para todos: `UPDATE conciliacion SET dedup_key = encode(digest(fecha::text || importe::text || lower(trim(regexp_replace(concepto, '\s+', ' ', 'g'))), 'sha256'), 'hex') WHERE dedup_key IS NULL;`

## T2 · src/lib/normalizar.ts (NUEVO)
```ts
export function normalizarConcepto(c: string): string {
  return (c ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export async function calcularDedupKey(
  fecha: string,
  importe: number,
  concepto: string
): Promise<string> {
  const data = new TextEncoder().encode(`${fecha}${importe}${normalizarConcepto(concepto)}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

## T3 · Parser BBVA en `src/components/conciliacion/ImportDropzone.tsx`
1. Mapear columnas adicionales si existen en el Excel: "Ordenante", "Beneficiario" (case-insensitive).
2. Pasarlas al hook como `ordenante` y `beneficiario` en cada row.

## T4 · `src/hooks/useConciliacion.ts` — `insertMovimientos`
**Antes del INSERT actual:**

```ts
import { calcularDedupKey, normalizarConcepto } from '@/lib/normalizar'

// Calcular dedup_key para todas las filas
rows = await Promise.all(rows.map(async r => ({
  ...r,
  dedup_key: await calcularDedupKey(r.fecha, r.importe, r.concepto),
})))

// Filtro 1: descartar traspasos internos Emilio
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'
const rowsAntesFiltro = rows.length
rows = rows.filter(r => !(
  r.titular_id === EMILIO_ID && 
  /traspaso/i.test(r.concepto ?? '')
))
const omitidosTraspasoEmilio = rowsAntesFiltro - rows.length

// Filtro 2: auto-categorizar transferencias Rubén → Emilio
const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
rows = rows.map(r => {
  if (
    r.titular_id === RUBEN_ID &&
    r.importe < 0 &&
    (
      /emilio/i.test(r.beneficiario ?? '') ||
      /emilio/i.test(r.concepto ?? '')
    )
  ) {
    return { ...r, categoria: 'RRH-NOM-EMI', proveedor: 'Emilio Sueldo' }
  }
  return r
})
```

**Insert con ON CONFLICT:** ya existe el INDEX, basta usar `.upsert()` de supabase con `onConflict: 'titular_id,dedup_key', ignoreDuplicates: true`.

**Devolver:**
```ts
return {
  insertados: data?.length ?? 0,
  duplicados: rowsAntesFiltro - omitidosTraspasoEmilio - (data?.length ?? 0),
  omitidos: omitidosTraspasoEmilio,
}
```

## T5 · UI Feedback en ImportDropzone
Mostrar al usuario: "X movimientos importados, Y duplicados (no añadidos), Z traspasos internos omitidos".

## T6 · Hook Running sueldos `src/hooks/useRunningSueldos.ts` (NUEVO)
```ts
export function useRunningSueldos(mes: string) {
  // mes formato 'YYYY-MM'
  // Devuelve { ruben: number, emilio: number, desgloseEmilio: { plataformas, complementoSL } }
  
  // Plataformas Emilio: SUM importe WHERE titular = Emilio AND importe > 0 AND mes
  // Complemento SL: SUM ABS(importe) WHERE titular = Rubén AND categoria = 'RRH-NOM-EMI' AND mes
  // Sueldo total = plataformas + complementoSL
}
```

## T7 · Integrar en `src/pages/finanzas/Running.tsx`
Añadir fila Emilio con desglose: "Plataformas: 1.710€ + Complemento SL: 0€ = 1.710€".

## T8 · QA
1. `npm run build` sin errores TS.
2. `npm run dev` localhost.
3. Re-importar extracto Emilio actual → debe decir "0 nuevos, 61 duplicados".
4. Subir Excel con 1 fila "Traspaso a cuenta" titular Emilio → "0 nuevos, 1 omitido (traspaso interno)".
5. Crear manualmente mov titular Rubén con concepto "Transferencia a Emilio" -867€ → en Running > Emilio aparece +867€ complemento SL.
6. Verificar UI Conciliación: columna Contraparte sigue funcionando como antes.

## T9 · Cierre
git add . && git commit -m "feat(conciliacion): bloque B - dedup robusto + reglas Emilio + sueldos Running" && git push origin master && git pull origin master
NO Vercel (regla 3).
