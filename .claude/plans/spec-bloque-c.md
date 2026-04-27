# SPEC — Bloque C · KPIs unificados + Sueldos integrados + Vista socios

## Contexto
Tras Bloque B, Conciliación queda al 100% con deduplicador, ordenante/beneficiario y reglas multi-dim. Running y PE existen pero faltan 3 mejoras críticas para tomar decisiones:

1. Sueldos correctamente integrados en Running (sueldo Emilio = ingresos plataforma + complemento SL).
2. Selector de titular en Running (Todos / Rubén / Emilio).
3. Página NUEVA `/finanzas/socios` para análisis Rubén vs Emilio.

PE refactor lo está haciendo otro chat — NO tocar PE en este bloque.

## Constantes cerradas (NO preguntar)
```ts
const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'
```

## Criterios DADO/CUANDO/ENTONCES

### CA-1 · Sueldo Emilio en Running
- DADO un mes seleccionado en Running
- CUANDO se calcula la fila RRHH del PyG
- ENTONCES desglosa:
  1. Sueldo Emilio total = SUM(importe>0 titular Emilio del mes con categoría LIKE 'ING-%') + SUM(ABS(importe) titular Rubén categoría 'RRH-NOM-EMI' del mes)
  2. Tooltip o subfila visible: "Plataformas X€ + Complemento SL Y€ = Total Z€"

### CA-2 · Selector Titular en Running
- DADO la página Running
- CUANDO el usuario añade selector Titular ("Todos / Rubén / Emilio")
- ENTONCES los KPIs ingresos/gastos/resultado se filtran. Sueldo Emilio se mantiene calculado correctamente (incluso filtrando por Rubén, su gasto incluye el complemento que paga a Emilio).

### CA-3 · Página NUEVA `/finanzas/socios`
- DADO una visita a la URL `/finanzas/socios`
- CUANDO carga
- ENTONCES muestra dos columnas paralelas (Rubén / Emilio) con: ingresos del mes seleccionado, gastos del mes (excluyendo INT-TRF), resultado neto, % sobre total negocio.

## Diseño técnico

### Hook `src/hooks/useSueldos.ts` (NUEVO)
```ts
export function useSueldos(desde: Date, hasta: Date) {
  // Devuelve {
  //   emilio: { plataformas: number, complementoSL: number, total: number },
  //   ruben: { ingresosNetos: number, gastosNetos: number, resultado: number },
  //   ultimos90d: { emilio_mensual_real: number }
  // }
}
```

### Modificar `src/pages/finanzas/Running.tsx`
1. Añadir selector Titular junto al de marca (Todos/Rubén/Emilio).
2. Card "Sueldos del periodo" con desglose Emilio.
3. En TablaPyG categoría RRHH expandir con subfilas por persona.

### Página NUEVA `src/pages/finanzas/Socios.tsx`
1. Selector mes (default = mes actual).
2. Layout 2 columnas: Rubén | Emilio.
3. KPIs por columna: Ingresos, Gastos, Resultado neto, % sobre total.
4. Card abajo: "Reparto del resultado neto" con texto informativo (no calculado, decisión humana).

### Routing
1. Añadir ruta `/finanzas/socios` en router.
2. Añadir item "Socios" en sidebar Finanzas.

## No-objetivos
- NO tocar PE (lo lleva otro chat).
- NO calcular reparto socios automáticamente — solo mostrar números.
- NO retroactividad: meses anteriores a Bloque B sin beneficiario quedan como están.

## Validaciones
1. `npm run build` 0 errores.
2. Running > Emilio abr 2026 muestra: "Plataformas 1.710€ + Complemento SL 4.150€ = 5.860€".
3. /finanzas/socios mar 2026: Rubén ingresos X, gastos Y. Emilio idem.

## Cierre
git+pull. NO Vercel.
