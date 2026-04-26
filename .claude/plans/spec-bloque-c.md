# SPEC — Bloque C · KPIs unificados + Sueldos integrados + Vista por titular

## Contexto
Tras Bloque B (deduplicador, ordenante/beneficiario, motor reglas multi-dim), Conciliación queda al 100%. Running y PE existen pero hay 3 mejoras críticas pendientes para tomar decisiones de negocio:

1. **Sueldos correctamente integrados:** sueldo Emilio = ingresos plataforma de su titular + transferencias categoría RRH-NOM-EMI. Hoy Running solo muestra gastos brutos de Rubén y mezcla cosas.
2. **Vista por titular separada:** ver KPIs filtrando solo Rubén o solo Emilio para análisis socios y reparto de costes/ingresos.
3. **PE con sueldos reales:** los parámetros sueldo_ruben/sueldo_emilio del módulo PE deben sincronizarse con lo que realmente se paga (no slider manual), tomando datos de Conciliación últimos 90 días.

## Criterios DADO/CUANDO/ENTONCES

### CA-1 · Sueldo Emilio en Running
- DADO un mes seleccionado en Running
- CUANDO se calcula la fila "RRHH" del PyG
- ENTONCES desglosa: 
  1. Sueldo Emilio total = SUM(importe>0 titular Emilio del mes) + SUM(ABS(importe) titular Rubén categoría RRH-NOM-EMI del mes)
  2. Mostrar tooltip o subfila: "Plataformas X€ + Complemento SL Y€ = Total Z€"

### CA-2 · Selector Titular en Running
- DADO Running con selectores de marca y periodo
- CUANDO el usuario añade selector Titular ("Todos / Rubén / Emilio")
- ENTONCES los KPIs de ingresos, gastos, resultado se filtran por ese titular. Los datos cruzados (sueldo Emilio que sale de Rubén) se mantienen consistentes según contexto.

### CA-3 · Sincronización PE ↔ Sueldos reales
- DADO una visita al módulo PE
- CUANDO se cargan los parámetros desde pe_parametros
- ENTONCES los campos sueldo_ruben y sueldo_emilio muestran un badge "real (90d): X€/mes" al lado del valor configurado, con un botón "↻ usar real" que sustituye el valor.
- El cálculo "real" sale de Conciliación: SUM últimos 90 días RRH-NOM-EMI / 3 = sueldo Emilio mensual real.

### CA-4 · Vista resumen socios
- DADO un mes
- CUANDO el usuario abre /finanzas/socios (página NUEVA)
- ENTONCES ve dos columnas (Rubén / Emilio) con: ingresos del mes, gastos del mes, resultado neto, % participación.

## Diseño técnico

### Hook `useSueldos.ts` (NUEVO)
```ts
export function useSueldos(desde: Date, hasta: Date, marcaId?: string | null) {
  // Devuelve {
  //   emilio: { plataformas: number, complementoSL: number, total: number },
  //   ruben: { autosueldo: number, total: number },
  //   ultimos90d: { emilio_mensual_real: number, ruben_mensual_real: number }
  // }
}
```

### Modificar `Running.tsx`
1. Añadir selector Titular (Todos/Rubén/Emilio) junto al de marca.
2. Añadir card "Sueldos del periodo" con desglose Emilio (plataformas + complemento) y Rubén (autosueldo si lo identificamos).
3. En TablaPyG categoria RRHH, expandir con subfilas por persona.

### Modificar `PuntoEquilibrio.tsx`
1. En TabConfig, junto a sueldo_ruben y sueldo_emilio: badge "real 90d: X€/mes" + botón "↻".
2. Endpoint nuevo `/api/pe/sueldos-reales` que devuelve los dos valores calculados.

### Página NUEVA `/finanzas/socios` (`Socios.tsx`)
1. Selector mes (default mes actual).
2. Dos columnas paralelas Rubén/Emilio con KPIs.
3. Card "Reparto del resultado neto" con propuesta de distribución (50/50 default, configurable).

## No-objetivos
- No tocar el sistema de pe_parametros existente: los sliders siguen funcionando, solo añadimos el botón "usar real".
- No diseñar política de reparto socios — solo mostrar números, decisión humana.
- No retroactivo: los meses anteriores a Bloque B sin beneficiario quedan como están.

## Validaciones
1. `npm run build` 0 errores.
2. Running > Emilio abr 2026: tarjeta Sueldos muestra "Plataformas 1.710€ + Complemento SL 4.150€ = 5.860€".
3. PE > Configuración > Sueldo Emilio: badge "real 90d: ~1.953€/mes" (≈ 5.860€/3).
4. /finanzas/socios mar 2026: Rubén ingresos X, gastos Y, resultado Z. Emilio idem.

## Cierre
git add . && git commit -m "feat(running+pe): bloque C - sueldos integrados + vista socios + sync real" && git push origin master && git pull origin master.
NO Vercel (regla 3 modo localhost).
