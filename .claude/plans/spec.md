# Spec: Conciliación — KPIs cuadrar al milímetro con paginación

## Contexto
Módulo de conciliación en `TabMovimientos.tsx`. Las funciones `cargarAgregados()` y `handleExportar` no paginan las consultas Supabase, por lo que PostgREST las recorta a 1.000 filas server-side. Esto provoca KPIs incorrectos que muestran datos truncados en lugar del total real de 5.582 movimientos en el rango 2023-2026.

## Petición original
**Modo autónomo total.** Fix crítico: los KPIs de conciliación no cuadran porque `cargarAgregados()` y `handleExportar` no paginan. PostgREST recorta a 1K filas. Crear helper `fetchAllPaginated` y aplicar a ambas funciones. Criterios CA1-CA3 definidos con datos específicos. No preguntar, ejecutar hasta deploy confirmado.

## Criterios DADO/CUANDO/ENTONCES

### CA1 — KPIs exactos
**DADO** que la tabla contiene 5.582 movimientos en el rango 2023-2026  
**CUANDO** la tab Movimientos carga con ese rango  
**ENTONCES** Card "Ingresos" muestra **+319.693,18 €**  
**Y** Card "Gastos" muestra **-315.573,68 €**  
**Y** Card "Pendientes" muestra el conteo real (no truncado a 1000)  
**Y** Card "Pendientes" muestra el importe acumulado real

### CA2 — Filtro titular cuadra
**DADO** los KPIs anteriores  
**CUANDO** se cambia filtroTitular a Rubén o Emilio  
**ENTONCES** los 4 KPIs deben recalcularse aplicando el filtro de titular sobre TODOS los movs (no solo los 1000 primeros)

### CA3 — Exportar CSV completo
**DADO** que se hace click en "Exportar"  
**CUANDO** se descarga el CSV  
**ENTONCES** el archivo contiene los 5.582 movs (no 1.000) si no hay otros filtros aplicados

## Alcance
- Archivos que tocar:
  - `src/lib/supabasePaginated.ts` (crear si no existe)
  - `src/components/conciliacion/TabMovimientos.tsx` (modificar `cargarAgregados` y `handleExportar`)
  - `src/hooks/useConciliacion.ts` (revisar y aplicar mismo patrón si necesario)

## Fuera de alcance
- `cargarPagina()` (la query de la tabla con `.range(from, to)` paginada por UI) — ya funciona bien
- Estilos, fuentes, colores, layout — cero cambios visuales
- `Conciliacion.tsx` página padre

## Riesgos identificados
- Tipos del helper: si `PostgrestFilterBuilder` no funciona, usar `any` y documentar
- Vercel deploy: 1 reintento máximo, si falla documentar
- Tab Resumen: puede necesitar mismo fix en `useConciliacion.ts`

## Decisiones autónomas autorizadas
- Usar `any` en tipos si hay conflictos TypeScript con PostgREST
- Aplicar mismo patrón a `useConciliacion.ts` si detecta mismo problema
- Saltar validación localhost si no arranca, ir directo a deploy
- PAGE_SIZE: mantener 1000 (valor actual PostgREST)