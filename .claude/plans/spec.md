# Spec: Fix paginación PostgREST - 5.582 movimientos completos

## Contexto
PostgREST server-side limita a 1.000 filas por defecto. El hook `useConciliacion` usa `.range(0, 999999)` que NO funciona, cortando en 1K registros cuando la BBDD real tiene 5.582 movimientos. Tab Movimientos muestra datos incompletos.

## Petición original
Paginación automática para sortear límite PostgREST 1K filas. Helper genérico `fetchAllPaginated` que itera `.range()` hasta agotar. Aplicar en hook conciliación para obtener 5.582 movimientos completos.

## Criterios DADO/CUANDO/ENTONCES
1. DADO 5.582 registros en `facturacion_diario`, CUANDO cargo tab Movimientos, ENTONCES veo "100 de 5582" en paginador visual
2. DADO helper `fetchAllPaginated`, CUANDO recibe query builder función, ENTONCES devuelve array completo sin límite 1K
3. DADO error de red durante paginación, CUANDO falla página N, ENTONCES helper propaga error sin datos parciales
4. DADO `npm run build`, CUANDO importo helper en hook, ENTONCES compila sin errores TypeScript

## Alcance
- Archivos que tocar:
  - `src/lib/supabasePaginated.ts` (NUEVO - helper genérico)
  - `src/hooks/useConciliacion.ts` (reemplazar query por helper)
  - `src/pages/Conciliacion.tsx` (verificar tab Movimientos recibe datos completos)

- Archivos que NO tocar:
  - Componente `TabMovimientos.tsx` (paginación UI sin cambios)
  - Estilos/tokens (mantener visual actual)
  - Filtros existentes (fechas, canal, etc.)

## Fuera de alcance
- Optimización render 5K filas
- Paginación UI server-side
- Otros hooks que usen Supabase
- Refactor arquitectura global

## Riesgos identificados
- Helper recibe FUNCIÓN que devuelve builder fresco, no builder directo (evitar stale state)
- `fetchAllPaginated` devuelve array directo, no `{data, error}` wrapper (consistencia con Supabase client)
- Import correcto `@supabase/supabase-js` en helper
- Tipos TypeScript genéricos `<T>` para reutilización