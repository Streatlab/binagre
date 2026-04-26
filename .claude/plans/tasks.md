# TASKS — Bloque B Conciliación + Facturas

Pipeline: pm-spec ✅ → implementer (en curso) → qa-reviewer → cierre git+pull (NO Vercel).

## T1 · OCR robusto sin zombies
1. En el hook/función que sube facturas (buscar en `src/hooks/useFacturas.ts` o similar): envolver la llamada a OCR con `Promise.race` contra timeout de 60s.
2. Si timeout o error: actualizar factura con `estado='error'`, `error_mensaje='Timeout OCR (>60s)'` o el error real.
3. Crear función SQL/RPC `marcar_facturas_zombie()` que actualice a `estado='error'` cualquier factura en `estado='pendiente_revision'` sin `ocr_raw` y con `created_at < NOW() - INTERVAL '60 seconds'`.
4. Llamar a esa función al cargar la página de Facturas (cleanup automático).
5. En la UI Facturas, fila con `estado='error'`: mostrar botón "Reintentar OCR" que vuelva a lanzar el OCR sobre el PDF original.

## T2 · Reparar facturas sin Drive (4 IDs)
IDs a reparar:
- cd18823f-1948-4ab7-8fb3-1ab480118c52 (Portier Eats 139,01€)
- 730f1e91-b3b9-4fe6-94b6-378cabd190cf (Mercadona 240,94€)
- 68e4265a-3996-44b7-a837-37278ced0faa (Glovo 50,81€)
- 242e33cf-1914-422a-a2d3-961642e919e3 (Glovo 126,46€)

Pasos:
1. Crear botón "Reparar facturas sin Drive" en `/finanzas/facturas` (panel admin).
2. Función backend: para cada ID anterior, buscar PDF en Supabase Storage por `pdf_original_name`, subir a Google Drive carpeta "Facturas Streat Lab", rellenar `pdf_drive_id` y `pdf_drive_url`.
3. Si no hay PDF en Storage para alguna: marcar `estado='error'` con mensaje "PDF original perdido, re-subir manualmente".

## T3 · Importar excel BBVA Emilio
1. Verificar que `cuentas_bancarias` tiene campo `titular`. Si no, crear migración añadiéndolo. Insertar filas:
   - Streat Lab S.L. (cuenta principal)
   - Emilio (cuenta BBVA personal)
2. En `ImportDropzone`: añadir selector "Cuenta destino" antes de subir el archivo. Default: cuenta Streat Lab.
3. Cada movimiento insertado lleva `cuenta_id` correspondiente.
4. Probar import del excel BBVA Emilio (lo subirá Rubén) → 51 movs nuevos con `cuenta_origen='BBVA_EMILIO'`.

## T4 · Matching cross-cuenta Emilio
1. En el matcher de conciliación-facturas: además de buscar el mov en cuentas Streat Lab, buscar también en cuenta Emilio.
2. Si match encontrado en cuenta Emilio: marcar factura con flag `pagado_por_emilio=true` (crear columna si no existe).
3. UI Facturas: mostrar badge "Pagado por Emilio" en filas con ese flag.
4. Caso de prueba: factura Mercadona 240,94€ (id 730f1e91-...) debe matchear con mov BBVA Emilio mismo importe ±7 días.

## T5 · QA
1. `npm run build` → 0 errores TS.
2. `npm run dev` → levantar localhost.
3. Verificar las 4 funcionalidades en UI (ver checklist en spec.md).
4. **NO ejecutar `npx vercel --prod`** — regla 3 modo localhost.

## T6 · Cierre
```
git add . && git commit -m "feat(conciliacion+facturas): bloque B - ocr robusto, reparar drive, import bbva emilio, matching cross-cuenta" && git push origin master && git pull origin master
```
