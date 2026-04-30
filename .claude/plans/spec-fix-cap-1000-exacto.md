# Spec · Conciliacion · FIX EXACTO CAP 1000 SUPABASE

> Sonnet · NO Opus · Aislamiento Binagre absoluto
> Fixes EXACTOS, copiar y pegar. NO improvisar. NO investigar.

## DIAGNÓSTICO YA HECHO

Bug 1: en `src/pages/Conciliacion.tsx`, el query Supabase del useEffect (líneas ~149-176) NO tiene `.range(0, 999999)`. Supabase JS client aplica un default cap de 1000 filas. Por eso siempre llegan 1000 max.

Bug 2: en `src/components/conciliacion/TabMovimientos.tsx`, hay un `PAGE_SIZE = 25` y la tabla pagina, pero como el dataset llega capado a 1000 desde Supabase, el footer dice "Mostrando 25 de 1000".

## FIX 1 · Conciliacion.tsx

ARCHIVO: `src/pages/Conciliacion.tsx`

LOCALIZAR este bloque (alrededor de la línea 149-176):

```tsx
  useEffect(() => {
    const desdeStr = periodoDesde.toISOString().slice(0, 10)
    const hastaStr = periodoHasta.toISOString().slice(0, 10)
    let cancel = false
    supabase
      .from('conciliacion')
      .select('*, factura_data:facturas(pdf_drive_url, pdf_filename)')
      .gte('fecha', desdeStr)
      .lte('fecha', hastaStr)
      .order('fecha', { ascending: false })
      .then(({ data }) => {
        if (cancel) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setMovimientosPeriodo((data ?? []).map((m: any) => ({
          id: m.id,
          fecha: m.fecha,
          concepto: m.concepto,
          importe: Number(m.importe),
          categoria_id: m.categoria ?? null,
          contraparte: m.proveedor ?? '',
          gasto_id: m.gasto_id ?? null,
          factura_id: m.factura_id ?? null,
          factura_data: m.factura_data ?? null,
          titular_id: m.titular_id ?? null,
          doc_estado: (m.doc_estado ?? 'falta') as 'tiene' | 'falta' | 'no_requiere',
        })))
      })
    return () => { cancel = true }
  }, [periodoDesde, periodoHasta])
```

REEMPLAZAR por (añade `.range(0, 999999)` justo después de `.order(...)`):

```tsx
  useEffect(() => {
    const desdeStr = periodoDesde.toISOString().slice(0, 10)
    const hastaStr = periodoHasta.toISOString().slice(0, 10)
    let cancel = false
    supabase
      .from('conciliacion')
      .select('*, factura_data:facturas(pdf_drive_url, pdf_filename)')
      .gte('fecha', desdeStr)
      .lte('fecha', hastaStr)
      .order('fecha', { ascending: false })
      .range(0, 999999)
      .then(({ data }) => {
        if (cancel) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setMovimientosPeriodo((data ?? []).map((m: any) => ({
          id: m.id,
          fecha: m.fecha,
          concepto: m.concepto,
          importe: Number(m.importe),
          categoria_id: m.categoria ?? null,
          contraparte: m.proveedor ?? '',
          gasto_id: m.gasto_id ?? null,
          factura_id: m.factura_id ?? null,
          factura_data: m.factura_data ?? null,
          titular_id: m.titular_id ?? null,
          doc_estado: (m.doc_estado ?? 'falta') as 'tiene' | 'falta' | 'no_requiere',
        })))
      })
    return () => { cancel = true }
  }, [periodoDesde, periodoHasta])
```

ÚNICA diferencia: añadir `.range(0, 999999)` justo después de `.order('fecha', { ascending: false })` y antes del `.then(...)`.

## FIX 2 · useConciliacion.ts (también capado a 1000 por defecto)

ARCHIVO: `src/hooks/useConciliacion.ts`

LOCALIZAR la query a `.from('conciliacion')` o `.from('movimientos_conciliacion')` que carga todos los movimientos (la que alimenta `movimientosBD`).

Añadir `.range(0, 999999)` después del `.order(...)` y antes del `.then(...)` o del `await`.

Si la query está en formato:
```tsx
const { data } = await supabase.from('conciliacion').select('*').order('fecha', { ascending: false })
```

REEMPLAZAR por:
```tsx
const { data } = await supabase.from('conciliacion').select('*').order('fecha', { ascending: false }).range(0, 999999)
```

Aplicar a TODAS las queries del hook que tocan tabla `conciliacion`.

## FIX 3 · Buscar otras queries capadas

Ejecutar grep en `src/`:

```bash
grep -rn "from('conciliacion')" src/
grep -rn "from('movimientos" src/
```

Para CADA query encontrada que no tenga `.range(0, 999999)`, añadirlo justo después del `.order(...)` o del `.eq(...)`/`.gte(...)`/`.lte(...)` final, antes del `.then(...)` o `await`.

## VALIDACIÓN OBLIGATORIA POSTDEPLOY

Abrir binagre.vercel.app/conciliacion en INCÓGNITO. Tab Movimientos. Selector fecha personalizado: 01/01/2020 → 31/12/2026.

Esperado:
- Card Ingresos: **+283.354,59 €**
- Card Gastos: **-234.415,64 €**
- Tabla footer: **"Mostrando 25 de 5203 movimientos"** (paginación normal de 25 con TOTAL real)
- Pendientes badge: número grande, alrededor de 4400

Si las cards muestran +56.887€ o -57.732€ o el footer dice "de 1000", el fix NO funcionó. NO commitear, debug y retest.

## ENTREGABLES

1. 3 fixes aplicados literalmente
2. Build limpio (`npm run build`, exit 0)
3. Validación visual con datos reales antes de commitear
4. git add . && git commit -m "fix(conci): añadir .range(0,999999) a queries Supabase para superar cap default 1000"
5. git push origin master
6. npx vercel --prod
7. Informe con URL deploy + screenshot/datos del test contra binagre.vercel.app
