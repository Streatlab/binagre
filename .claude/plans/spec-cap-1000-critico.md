# Spec · Conciliación · BUG CRÍTICO PERSISTENTE

> Sonnet · NO Opus · Aislamiento Binagre absoluto
> El commit anterior 01777d32 NO ha resuelto los bugs. Sigue mostrando "Mostrando 25 de 1000 movimientos" y cards mal sumadas.

## EVIDENCIA EN PRODUCCIÓN HOY (binagre.vercel.app/conciliacion)

Filtro: 01/01/20 → 31/12/26
- Cards: Ingresos +56.887,96 € · Gastos -57.732,54 € · Pendientes 851 (23.493,58 €)
- Footer tabla: "Mostrando 25 de 1000 movimientos"

## DATOS REALES EN BD (verificado por Supabase)

- Total: 5.203 movimientos (rango jul 2023 → abr 2026)
- Ingresos histórico: +283.354,59 €
- Gastos histórico: -234.415,64 €
- Pendientes (doc_estado='falta'): 4.410

## EL FIX ANTERIOR FALLÓ

Las 4 cards y la tabla siguen sumando solo 1000 filas.

## DIAGNÓSTICO REQUERIDO ANTES DE ARREGLAR

1. Buscar TODOS los lugares del código donde se hace una query a tabla `conciliacion`:
   - `supabase.from('conciliacion').select(...)`
   - `useConciliacion`, `useMovimientos`, hooks similares
   - Service files (services/conciliacion.ts o similares)
2. Buscar todos los `.limit(1000)`, `.range(0, 999)`, `LIMIT 1000` en queries
3. Buscar todos los componentes que renderizan las 4 cards (Ingresos, Gastos, Pendientes, Titular) y la tabla de movimientos
4. Identificar cuál query alimenta cada componente

## FIX OBLIGATORIO

### A · Eliminar cap de 1000 en TODAS las queries

Buscar en todo `src/`:
```
grep -r "limit(1000)" src/
grep -r "range(0, 999)" src/
grep -r "LIMIT 1000" src/
```

Eliminar TODOS los caps. Si Supabase tiene un default cap (1000), añadir `.range(0, 999999)` para forzar traer todo el dataset filtrado.

### B · Cards filtradas por fecha del header

El SelectorFechaUniversal del header debe estar conectado a:
1. Query de la tabla (ya filtra)
2. Query/cálculo de cards de Ingresos/Gastos/Pendientes/Titular (NO filtra → este es el bug)

Las cards deben recibir como input el dataset YA filtrado por:
- Fecha (mes en curso, custom range, etc)
- Titular (toggle Todos/Rubén/Emilio)

NO sumar todo el dataset original. Solo el filtrado.

### C · Pendientes contador

El contador "851 pendientes" sale de un dataset de 1000 filas. Debe salir del dataset filtrado (5.203 reales).

## VALIDACIÓN OBLIGATORIA POSTDEPLOY

Después del deploy, abrir binagre.vercel.app/conciliacion en incógnito y ABRIR DEVTOOLS. Verificar:

### Test 1 · "Mes en curso" (abril 2026)
- Cards Ingresos: **+5.060,15 €** (no 56k)
- Cards Gastos: **-5.811,77 €** (no 57k)
- Tabla: 83 movimientos visibles
- Footer NO debe decir "de 1000"

### Test 2 · Custom range 01/01/20 → 31/12/26 (todo histórico)
- Cards Ingresos: **+283.354,59 €**
- Cards Gastos: **-234.415,64 €**
- Tabla: 5.203 movimientos
- Footer NO debe decir "de 1000"
- Pendientes: 4.410

### Test 3 · "Mes anterior" (marzo 2026)
- Cards: ingresos y gastos solo de marzo

Si CUALQUIER test falla, NO commitear. Investigar más, encontrar el bug real, fixear, retest.

## CRITERIOS DE ACEPTACIÓN (ABSOLUTOS)

1. Test 1 PASA con valores exactos
2. Test 2 PASA con valores exactos
3. Test 3 PASA
4. Footer NUNCA dice "X de 1000". Dice "X movimientos" o paginación real.
5. Build limpio sin errores tsc/vite
6. Deploy Vercel exitoso (npx vercel --prod)
7. Informe final con DevTools logs y screenshots descriptivos de cada test

## ENTREGABLES

1. Diagnóstico de archivos modificados (lista)
2. Fix aplicado
3. 3 tests validados antes de commitear
4. git push master + npx vercel --prod
5. Informe con URL deploy + 3 tests pasados (con números reales)
