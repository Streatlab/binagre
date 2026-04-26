# SPEC — Bloque B Conciliación: Deduplicador + Reglas Emilio + Ordenante/Beneficiario

## Contexto
Tras limpiar manualmente Conciliación al 100%, restan 4 fixes en código para que el flujo automático no rompa lo conseguido:

1. **Deduplicador robusto:** re-importar mismo extracto debe devolver "0 nuevos, X duplicados", no insertar copias.
2. **Capturar ordenante/beneficiario:** el import actual descarta esa info del Excel BBVA. Sin ella es imposible matchear cross-cuenta.
3. **Auto-borrado traspasos internos Emilio:** "Traspaso a cuenta" del titular Emilio = movimiento interno entre sus cuentas personales = NO entra a conciliación.
4. **Cálculo sueldo Emilio en Running:** sumar ingresos plataforma Emilio + transferencias SL→Emilio identificadas como sueldo.

## Criterio DADO/CUANDO/ENTONCES

### CA-1 · Re-import sin duplicados
- DADO un extracto ya en BD (ej. 61 movs Emilio dic 2025 - abr 2026)
- CUANDO el usuario re-importa exactamente el mismo Excel
- ENTONCES `insertMovimientos` retorna `{ insertados: 0, duplicados: 61 }` y BD queda igual.

### CA-2 · Capturar ordenante y beneficiario
- DADO un Excel BBVA con columnas adicionales (Ordenante, Beneficiario, Detalle, Observaciones)
- CUANDO el parser procesa la fila
- ENTONCES guarda esos campos en columnas `ordenante TEXT` y `beneficiario TEXT` en `conciliacion`.

### CA-3 · Auto-borrado traspaso Emilio
- DADO un import nuevo del titular Emilio que contiene movs con concepto ILIKE '%traspaso%'
- CUANDO se procesa el import
- ENTONCES esos movs se descartan ANTES del INSERT (no llegan a BD). Log: "X traspasos internos Emilio omitidos".

### CA-4 · Identificar transferencia SL→Emilio como sueldo
- DADO una transferencia saliente del titular Rubén con beneficiario "Emilio" (cuando llegue ese campo) o concepto que contenga "Emilio"
- CUANDO se inserta en conciliacion
- ENTONCES categoria = 'RRH-NOM-EMI', proveedor = 'Emilio Sueldo'.

### CA-5 · Cálculo sueldo Emilio mensual en Running
- DADO un mes concreto (ej. abr 2026)
- CUANDO Running consulta sueldo Emilio
- ENTONCES devuelve: `(SUM ingresos plataforma Emilio del mes) + (SUM transferencias SL→Emilio del mes con categoria RRH-NOM-EMI)`.

## Diseño técnico

### BD
1. Migración: añadir columnas `ordenante TEXT`, `beneficiario TEXT` a `conciliacion`.
2. Migración: añadir UNIQUE INDEX sobre `(titular_id, dedup_key)` donde `dedup_key = sha256(fecha || importe_centimos || concepto_normalizado)`.
3. Backfill: rellenar `dedup_key` para los 5.716 movs existentes.

### Parser Excel
1. Detectar columnas BBVA estándar: Ordenante, Beneficiario, Detalle, Concepto.
2. Normalizar concepto: lowercase + trim + collapse spaces.
3. Calcular `dedup_key` en cliente antes del INSERT.

### insertMovimientos
1. Filtro pre-insert: si `titular_id = Emilio` AND `concepto ILIKE '%traspaso%'` → descartar fila.
2. INSERT con `ON CONFLICT (titular_id, dedup_key) DO NOTHING`.
3. Devolver `{ insertados, duplicados, omitidos }`.

### Categorización auto SL→Emilio
1. En `insertMovimientos`, tras alias matching: si `titular_id = Rubén` AND `(beneficiario ILIKE '%emilio%' OR concepto ILIKE '%emilio%')` → `categoria = 'RRH-NOM-EMI'`, `proveedor = 'Emilio Sueldo'`.

### Running
1. Hook `useRunningSueldos(mes)` o equivalente: 
   - sueldo_emilio = SUM(importe WHERE titular = Emilio AND importe > 0 AND mes = X) + SUM(ABS(importe) WHERE titular = Rubén AND categoria = 'RRH-NOM-EMI' AND mes = X)
2. Render en tabla Running de `Emilio` con desglose plataformas + complemento SL.

## No-objetivos
- No retroactivo: las transferencias SL→Emilio históricas se etiquetan manualmente cuando Rubén las identifique.
- No tocar la lógica de Rubén ni otros titulares.

## Validaciones
1. `npm run build` 0 errores.
2. Re-importar extracto Emilio: "0 nuevos, 61 duplicados".
3. Importar extracto sintético con 1 traspaso Emilio: "0 traspasos omitidos".
4. Crear mov manual Rubén → Emilio 867€ → aparece en Running > Emilio sueldo del mes.

## Cierre
git add . && git commit -m "feat(conciliacion): dedup robusto + ordenante/beneficiario + reglas Emilio sueldo" && git push origin master && git pull origin master
NO desplegar Vercel (regla 3 modo localhost).
