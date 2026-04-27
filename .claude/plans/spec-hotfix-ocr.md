# SPEC — Fix Hotfix · OCR Alcampo + rate limit + borrar Socios

## Contexto
3 fixes pequeños cerrados al 100%. Sin huecos.

## Fix 1 · OCR captura totales formato Alcampo y otros multi-IVA

### Problema
Facturas Alcampo (y similares con desglose multi-IVA en tabla) devuelven `total=0` aunque el OCR detecta proveedor. Causa: el prompt actual busca solo palabras tipo "TOTAL", "IMPORTE", pero Alcampo usa específicamente:
- "Total Base Imponible"
- "Total Impuesto"  
- "Total Factura"

### Cambio
En el prompt del OCR (archivo `src/lib/facturas/ocr.ts` o equivalente), añadir al system prompt o user prompt instrucciones para detectar:

```
PATRONES DE TOTALES A RECONOCER (uno o varios):
1. "Total Factura: X €" → total
2. "Total Base Imponible: X €" → base imponible
3. "Total Impuesto: X €" o "Total IVA: X €" → iva
4. "TOTAL", "IMPORTE TOTAL", "TOTAL A PAGAR" → total
5. Si hay desglose multi-IVA (ej. tabla con %4, %10, %21), sumar las bases en "Total Base Imponible" y los importes en "Total Impuesto", verificar que base + iva = total.
6. Cuando hay duplicidad de cabecera (dirección emisor + dirección cliente arriba a la vez), el NIF que aparece JUNTO al cliente (no al emisor) es nif_cliente.
```

Mantener el resto del prompt intacto.

### Validación
Subir factura ALCAMPO `260300305131.pdf` (Total Factura 21,75€, Base 19,08€, IVA 2,67€, NIF cliente 21669051S):
- proveedor = "ALCAMPO S.A."
- total = 21.75
- base = 19.08
- iva = 2.67
- nif_cliente = "21669051S" → titular_id = RUBEN_ID
- nif_emisor = "A-28581882"

## Fix 2 · Procesamiento secuencial (no paralelo)

### Problema
Subir 5+ facturas a la vez dispara `429 rate_limit_error` de la API Anthropic. El procesamiento OCR se hace en paralelo y agota tokens.

### Cambio
En `src/lib/facturas/procesarArchivo.ts` (o donde esté el orquestador del lote), reemplazar el `Promise.all(rows.map(...))` por bucle secuencial con `await`:

```ts
// ANTES: paralelo (rate limit)
await Promise.all(facturas.map(f => procesarFactura(f)))

// DESPUÉS: secuencial
for (const f of facturas) {
  await procesarFactura(f)
}
```

Si hay ya algo de "concurrencia controlada" (p-limit, queue), dejar concurrencia = 1.

### Validación
Subir 10 PDFs simultáneamente → todos terminan sin error 429 (más lento pero sin fallos).

## Fix 3 · Borrar página /finanzas/socios

### Problema
La página /finanzas/socios no aporta valor de negocio según Rubén. Borrar.

### Cambio
1. Borrar archivo `src/pages/finanzas/Socios.tsx`.
2. Quitar la ruta `/finanzas/socios` del router.
3. Quitar el item "Socios" del Sidebar.
4. NO borrar `useSueldos.ts` — sigue usándose en Running.

### Validación
1. `npm run build` 0 errores.
2. Sidebar Finanzas no muestra "Socios".
3. URL `/finanzas/socios` da 404 o redirige.
4. Running > selector titular sigue funcionando con sueldos correctos.

## Cierre
git+pull. NO Vercel.
