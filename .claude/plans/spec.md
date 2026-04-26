# SPEC — Fix Conciliación · matching automático de proveedor

## Contexto
La columna "Contraparte" de `/finanzas/conciliacion` está vacía. Causa: la tabla `conciliacion` (5.655 movs en BD) tiene la columna `proveedor` 100% NULL. La tabla `proveedor_alias` (55 alias mapeados a proveedor canónico) ya existe pero no se está usando en el flujo de inserción.

El backfill SQL ya está aplicado: 873/5655 movs (15,4%) tienen `proveedor` rellenado retroactivamente. Resta arreglar el flujo de **inserción/edición** para que toda escritura futura matchee automáticamente.

## Criterio DADO/CUANDO/ENTONCES

### CA-1 · Importación de CSV
- **DADO** un CSV importado vía `ImportDropzone` con N movimientos
- **CUANDO** `useConciliacion.insertMovimientos` procesa las filas
- **ENTONCES** cada fila inserta `proveedor` matcheado contra `proveedor_alias` por `concepto.toLowerCase().includes(alias)`, priorizando alias más largos. Si no hay match, `proveedor = null`.

### CA-2 · UI Conciliación
- **DADO** un movimiento ya en BD con `proveedor` rellenado
- **CUANDO** el usuario abre la pestaña "Movimientos" en `/finanzas/conciliacion`
- **ENTONCES** la columna "Contraparte" muestra el `proveedor_canonico` (ej. "Mercadona", "Uber Eats"). Sin fallback al raw del concepto.

### CA-3 · Caché de alias
- **DADO** un usuario realiza múltiples imports en una sesión
- **CUANDO** se llama a `loadAliases()` repetidas veces
- **ENTONCES** la primera llamada consulta Supabase, las siguientes leen de caché en memoria. Existe `invalidateAliasCache()` exportado para forzar refresh.

## No-objetivos
- No tocar movimientos existentes (ya backfilleados por SQL).
- No matchear contra "concepto raw" como fallback en la UI — si no hay proveedor canónico, celda vacía o "—".
- No abordar Bizum/transferencias genéricas (no tienen contraparte en concepto).

## Archivos afectados
1. **NUEVO** `src/lib/matchProveedor.ts`
2. **MODIFICAR** `src/hooks/useConciliacion.ts` — añadir matching en `insertMovimientos`

## Validaciones
- `npm run build` sin errores de TS.
- Importar CSV de prueba con líneas que contengan "MERCADONA", "UBER", "GLOVO" → la columna Contraparte aparece rellena con el canónico tras refresh.
- Líneas con "TRANSFERENCIA RECIBIDA" → celda vacía (correcto).

## Cierre
Cadena estándar git+vercel obligatoria al terminar.
