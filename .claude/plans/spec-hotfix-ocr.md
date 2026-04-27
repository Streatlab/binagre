# SPEC — Hotfix V2 · Cola robusta + Toast progreso + Drive idempotente + UX titular

## Contexto
Tras primer testeo Bloque D, detectados 7 bugs/mejoras críticos. BD facturas vaciada, Drive vaciado por usuario. Se valida en limpio.

## Constantes (ya conocidas, NO preguntar)
```ts
const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'
const NIF_RUBEN = '21669051S'
const NIF_EMILIO = '53484832B'
const DRIVE_OPERACIONES_ID = '1dB6REknvNl8JxGGuv8MXloUCJ3_evd7H'
const PLATAFORMAS = ['uber eats','uber bv','portier eats','glovo','glovoapp','just eat','takeaway','rushour']
const COLOR_RUBEN = '#F26B1F' // naranja
const COLOR_EMILIO = '#1E5BCC' // azul
```

## Fix 1 · Cola secuencial robusta + persistencia

### Problema
Subir 200 facturas en drag&drop falla: solo 9 procesan, resto se pierden silenciosamente. Causa: procesamiento paralelo + rate limit 429 + sin reintento.

### Solución
1. Toda subida masiva crea filas en BD con estado `cola_pendiente` ANTES de empezar OCR.
2. Worker secuencial (concurrencia=1) procesa una a una.
3. Si rate limit 429 → esperar 60s y reintentar (max 3 reintentos).
4. Si OCR funciona → estado pasa a flujo normal (`pendiente_revision` / `asociada` / `sin_match` / `pendiente_titular_manual`).
5. Si fallo persistente tras 3 reintentos → estado `cola_fallida` con motivo en `notas_error`.

### Archivos
- `src/lib/facturas/cola.ts` (NUEVO) — orquestador de cola con reintento.
- `src/lib/facturas/procesarArchivo.ts` (modificar) — usar cola.
- Migración SQL si falta: `ALTER TABLE facturas ADD COLUMN IF NOT EXISTS notas_error TEXT;` y añadir estados nuevos al CHECK constraint si existe.

## Fix 2 · Toast progreso en tiempo real

### Problema
Tras drag&drop no hay feedback visible. Usuario no sabe cuántas se han procesado.

### Solución
1. Al iniciar lote: toast persistente con contador.
2. Formato: "📥 X de Y facturas procesadas · Z pendientes"
3. Actualización cada vez que una factura cambia de estado (subscription Supabase Realtime o polling 3s).
4. Cuando termina: toast de éxito "✅ 200 facturas procesadas (180 asociadas, 15 pendientes revisión, 5 fallidas)" con botón "Ver detalle".
5. El toast no bloquea la UI — usuario puede navegar.

### Archivos
- `src/components/facturas/ToastProgreso.tsx` (NUEVO).
- `src/pages/finanzas/Facturas.tsx` (modificar) — montar toast al subir lote.

## Fix 3 · Drive idempotente (no duplicar carpetas)

### Problema
Procesos concurrentes creaban "EMILIO" 2 veces y "2026" 2 veces. Causa: no se comprueba si la subcarpeta ya existe antes de crearla.

### Solución
En `src/lib/drive.ts` función `findOrCreateFolder(parentId, name)`:
1. Primero buscar carpeta con `name` exacto y `parentId` exacto.
2. Si existe → devolver ID existente.
3. Si NO existe → crear y devolver ID nuevo.
4. Cache en memoria local del proceso para no consultar Drive 100 veces.

Como ahora la cola es secuencial (Fix 1), no habrá race conditions adicionales.

## Fix 4 · OCR Uber Eats con base + IVA + total

### Problema
Facturas Uber Eats no calcula correctamente. Formato Uber: comisiones + servicios + bonificaciones, total en € con desglose IVA específico.

### Solución
Extender prompt OCR con instrucciones específicas para Uber/plataformas:
```
PARA FACTURAS DE PLATAFORMAS DELIVERY (Uber Eats, Glovo, Just Eat, Portier):
- El "Importe Total" o "Importe a pagar" es el total final (puede ser positivo cobro o negativo abono).
- "Subtotal" o "Base imponible" es la base.
- IVA = Total - Base (cuando hay desglose) o se calcula del % indicado.
- Si la factura es de "Comisión Uber Eats" o similar, el emisor es Uber/Portier (NO el restaurante).
- nif_emisor está en el footer/cabecera de Uber, NO en el cliente.
```

## Fix 5 · UI titular con colores

### Problema
Columna "Titular" muestra puntos de color sin texto. Ilegible.

### Solución
En `src/pages/finanzas/Facturas.tsx` columna Titular:
1. Si `titular_id = RUBEN_ID` → texto "Rubén" en color `#F26B1F` (naranja), bold.
2. Si `titular_id = EMILIO_ID` → texto "Emilio" en color `#1E5BCC` (azul), bold.
3. Si NULL o pendiente_titular_manual → texto "—" en gris + click abre selector.

Aplicar también en `Conciliacion.tsx` si muestra titular.

## Fix 6 · Filtro fecha por defecto = "Todas"

### Problema
Filtro "últimos 30 días" oculta facturas más antiguas. Usuario sube 200 facturas mezclando meses, las viejas quedan invisibles.

### Solución
En selector de filtro fecha de Facturas.tsx, añadir opción "Todas" y dejarla por DEFAULT. Mantener "Últimos 30 días" como opción secundaria.

## Fix 7 · Borrar /finanzas/socios

### Solución
1. Borrar `src/pages/finanzas/Socios.tsx`.
2. Quitar ruta del router.
3. Quitar item Sidebar.
4. NO borrar `useSueldos.ts`.

## Validaciones
1. `npm run build` 0 errores.
2. Subir 30 PDFs en drag&drop → toast aparece "0 de 30 procesadas" → va incrementando.
3. Tras terminar → toast final "✅ 30 procesadas (X asociadas, Y pendientes)".
4. Drive: solo UNA carpeta EMILIO, UNA RUBÉN, UNA por año. Cero duplicados.
5. Una factura Uber Eats con NIF Rubén aparece con base + iva + total correctos.
6. Tabla muestra "Rubén" en naranja, "Emilio" en azul.
7. Filtro fecha por defecto "Todas" muestra facturas de cualquier fecha.
8. Sidebar Finanzas no muestra "Socios".

## Cierre
git add . && git commit -m "fix(facturas): cola robusta + toast progreso + drive idempotente + ocr uber + ux titular + filtro todas + borrar socios" && git push origin master && git pull origin master.
NO Vercel.
