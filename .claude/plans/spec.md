# SPEC — Fix Deduplicador Conciliación

## Contexto
El re-import del extracto Emilio creó 61 duplicados exactos en BD (misma fecha + concepto + importe que los originales, pero filas nuevas con titular_id NULL). El deduplicador actual no los pilla.

Síntoma: usuario re-importa un extracto del mismo banco/cuenta y aparecen filas duplicadas en lugar de "ya existen, omitidos".

## Causa probable
El `dedup_key` actual probablemente solo considera (fecha, importe, concepto) sin normalizar concepto, sin tener en cuenta `titular_id` ni microdiferencias. O simplemente no se está usando como UNIQUE INDEX en BD.

## Criterio DADO/CUANDO/ENTONCES

### CA-1 · Re-importar mismo extracto = 0 duplicados
- DADO un extracto ya importado en BD (titular Emilio, 61 movs)
- CUANDO el usuario sube exactamente el mismo extracto otra vez
- ENTONCES insertMovimientos detecta los 61 como duplicados y NO los inserta. Devuelve "0 nuevos, 61 ya existían".

### CA-2 · Re-importar extracto ampliado = solo nuevos
- DADO un extracto ya importado con 61 movs
- CUANDO el usuario sube un extracto con esos 61 + 20 movs nuevos
- ENTONCES inserta solo los 20 nuevos. "20 nuevos, 61 ya existían".

### CA-3 · Mismo importe en cuentas distintas NO es duplicado
- DADO un mov de 50€ en cuenta Rubén el 1 abr
- CUANDO se importa otro de 50€ en cuenta Emilio el 1 abr (mismo concepto)
- ENTONCES se insertan los DOS (titulares distintos = movs distintos).

## Diseño técnico
1. `dedup_key` = hash de `(titular_id, fecha, importe_centimos, concepto_normalizado)`
2. `concepto_normalizado` = lowercase + trim + collapse spaces
3. UNIQUE INDEX en BD sobre `dedup_key` para garantizar a nivel de motor
4. En `insertMovimientos`, calcular dedup_key antes del INSERT y hacer ON CONFLICT DO NOTHING

## No-objetivos
- No tocar movs existentes (ya están limpios tras el borrado manual de hoy)
- No backfillear dedup_key retroactivo (los 5.716 ya están dedup'eados de hecho)

## Validaciones
1. `npm run build` 0 errores
2. Re-importar el Excel Emilio actual → respuesta "0 nuevos, 61 ya existían"
3. Importar Excel Rubén con 5 movs nuevos → "5 nuevos, X ya existían"
