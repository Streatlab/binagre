# SPEC — Bloque B Conciliación: Reglas extendidas + Ordenante/Beneficiario

## Contexto
Tabla `reglas_conciliacion` ya existe con 70 patrones simples (concepto → categoría). Necesitamos extenderla para soportar matching por **ordenante**, **beneficiario**, **titular**, **rango de importe**, y acción **borrar**. Las columnas extra ya están añadidas en BD. Faltan 4 cosas en código:

1. Parser BBVA debe capturar ordenante/beneficiario del Excel y guardarlos en BD (campos invisibles para el usuario, sólo para el motor de reglas).
2. Motor de reglas en `insertMovimientos` debe evaluar TODAS las dimensiones (no sólo concepto): ordenante, beneficiario, titular, importe.
3. Deduplicador robusto: re-importar = 0 nuevos.
4. Hook Running para sumar sueldos calculados desde Conciliación + complemento SL.

## Criterios DADO/CUANDO/ENTONCES

### CA-1 · Parser captura ordenante/beneficiario
- DADO un Excel BBVA con columnas Ordenante y Beneficiario
- CUANDO el parser lo procesa
- ENTONCES guarda esos campos en `conciliacion.ordenante` y `conciliacion.beneficiario`. Si el Excel no los trae, NULL.

### CA-2 · Motor reglas multi-dimensión
- DADO un movimiento con beneficiario "Timoteo Hernandez"
- CUANDO el motor evalúa reglas activas ordenadas por prioridad ASC
- ENTONCES aplica la regla con `match_beneficiario = 'timoteo'` (LIKE %timoteo%) → categoria = ALQ-LOC, proveedor = Timoteo.

### CA-3 · Acción borrar
- DADO un movimiento titular Emilio + concepto "Traspaso a cuenta"
- CUANDO matchea regla con `borrar = TRUE`
- ENTONCES se descarta antes del INSERT. NO entra a BD. Log: "X movs omitidos por reglas".

### CA-4 · Deduplicación robusta
- DADO un extracto re-importado idéntico
- CUANDO `insertMovimientos` procesa
- ENTONCES retorna `{ insertados: 0, duplicados: N, omitidos: 0 }`. BD inalterada.

### CA-5 · Sueldo Emilio en Running
- DADO un mes (ej. abr 2026)
- CUANDO Running consulta sueldo total Emilio
- ENTONCES = SUM ingresos plataforma Emilio del mes (titular_id Emilio, importe > 0) + SUM transferencias categoría 'RRH-NOM-EMI' del mes (todas tituladas Rubén).

## Diseño técnico

### BD (ya hecho)
- ✅ Columnas añadidas a `conciliacion`: ordenante, beneficiario.
- ✅ Columnas añadidas a `reglas_conciliacion`: match_ordenante, match_beneficiario, match_titular_id, match_importe_min, match_importe_max, set_proveedor, borrar, notas_regla.
- ✅ 3 reglas seed creadas: emilio_traspaso_interno, beneficiario_emilio_sueldo, beneficiario_timoteo_alquiler.

### Parser ImportDropzone
1. Detectar columnas BBVA: "Ordenante", "Beneficiario", "Concepto", "Detalle". Case-insensitive, fuzzy match.
2. Pasar al hook como `ordenante` y `beneficiario` en cada row.

### Motor reglas en useConciliacion.insertMovimientos
1. Cargar reglas activas ORDER BY prioridad ASC.
2. Para cada row: aplicar la PRIMERA regla que matchee TODAS sus condiciones no-NULL (concepto via patron, ordenante, beneficiario, titular_id, importe entre min/max).
3. Si `borrar = TRUE` → marcar row para descartar.
4. Si no → aplicar `set_proveedor`, `categoria_codigo`, etc.

### Deduplicador
1. `dedup_key` = SHA-256 de (titular_id || fecha || importe_centimos || concepto_normalizado).
2. UNIQUE INDEX (titular_id, dedup_key) → ya existe o se crea.
3. INSERT con `.upsert({ ignoreDuplicates: true, onConflict: 'titular_id,dedup_key' })`.

### Hook Running
- `useRunningSueldos(mes)` retorna `{ ruben, emilio, desgloseEmilio: { plataformas, complementoSL } }`.
- Datos vienen de `conciliacion`. Sin tabla nueva.

## No-objetivos
- No tocar el sistema de reglas legacy basado en `patron` simple — coexiste con el extendido.
- No exponer ordenante/beneficiario en UI Conciliación. Sólo internos.
- No backfill retroactivo de ordenante/beneficiario (los movs viejos quedan sin ese dato; se etiquetan a mano si hace falta).

## Validaciones
1. `npm run build` 0 errores.
2. Re-importar Excel Emilio: "0 nuevos, 61 duplicados, 0 omitidos".
3. Excel sintético con 1 traspaso Emilio: "0 nuevos, 0 duplicados, 1 omitido (regla emilio_traspaso_interno)".
4. Excel con 1 transferencia Rubén beneficiario "Timoteo Hnz" 867€: aparece en BD con categoria ALQ-LOC, proveedor Timoteo.
5. Excel con 1 transferencia Rubén beneficiario "Emilio Dorca" 500€: aparece con categoría RRH-NOM-EMI, proveedor Emilio Sueldo.
6. Running > Emilio abr 2026: muestra plataformas (1.710€ aprox) + complemento SL (500€ del 14 abr) = 2.210€.

## Cierre
git+pull. NO Vercel (regla 3 modo localhost).
