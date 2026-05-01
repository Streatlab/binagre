# Tasks: Helper paginado PostgREST

Ejecución secuencial T1 → T5. Modo localhost (NO `npx vercel --prod`).

---

## T1. Crear helper paginado
**Archivo:** `src/lib/supabasePaginated.ts` (NUEVO)
**Acción:** Crear archivo con función genérica `fetchAllPaginated<T>(builderFn)` que pagina con `.range()` hasta agotar.
**Contenido:**
```ts
const PAGE_SIZE = 1000;

export async function fetchAllPaginated<T>(
  builderFn: () => any
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await builderFn().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}
```
**Notas:**
- `builderFn: () => any` evita pelearse con el sistema de tipos union de PostgrestBuilder. El genérico `<T>` se mantiene en el retorno, que es lo que importa al caller.
- NO importar tipos de `@supabase/postgrest-js` para no acoplar el helper a versión específica del SDK.
**Output esperado:** Archivo nuevo, ~17 líneas. Compila aislado.
**Verificación:** `npx tsc --no-emit` sin errores nuevos en este archivo.

---

## T2. Actualizar hook useConciliacion
**Archivo:** `src/hooks/useConciliacion.ts`
**Acción:**
1. Leer archivo completo primero (regla 1 de `.claude/CLAUDE.md`)
2. Añadir import: `import { fetchAllPaginated } from '../lib/supabasePaginated';` (ajustar ruta relativa real)
3. Localizar la query actual a `facturacion_diario` (con `.range(0, 999999)` o similar)
4. Reemplazar el bloque `const { data, error } = await supabase.from('facturacion_diario').select(...).range(0, 999999);` por:
   ```ts
   const data = await fetchAllPaginated<MovimientoRow>(() =>
     supabase
       .from('facturacion_diario')
       .select('*')
       .order('fecha', { ascending: false })
       // mantener TODOS los filtros existentes aquí dentro (.eq, .gte, .lte, ...)
   );
   ```
5. Eliminar el `.range(0, 999999)` antiguo
6. Mantener el try/catch externo intacto — el helper hace `throw` en error
7. Si el código antiguo tenía `if (error) throw error;` separado, ya no aplica (el helper lo hace internamente)
8. Tipo `MovimientoRow`: usar el que ya exista en el hook; si no existe nombre, inferir del esquema actual sin redefinirlo
**Output esperado:** Hook devuelve 5.582 filas en vez de 1.000. Firma pública del hook sin cambios. Filtros vivos en el callback se aplican en cada página.

---

## T3. Verificar Conciliacion.tsx
**Archivo:** `src/pages/Conciliacion.tsx`
**Acción:** Leer archivo y comprobar que:
- Consume `movimientos` (o el nombre real) del hook sin slice/limit hardcodeado client-side
- Pasa el array completo a `TabMovimientos` por props
- NO hay `.slice(0, 1000)` ni `Math.min(..., 1000)` ocultos
**Si todo OK:** archivo intacto, no se commitea.
**Si hay slice:** eliminar, commitear con T5.
**Output esperado:** Confirmación escrita en summary.md (T5) de qué se encontró y si se modificó.

---

## T4. Validar build TypeScript + Vite
**Acción:**
1. `npx tsc --no-emit` desde raíz
2. `npm run build`
**Output esperado:** Ambos sin errores.
**Si T1 da error TS por tipos:** ya está mitigado con `builderFn: () => any` en el contenido de T1. Si aún así falla, dejar `any` también en el parámetro de salida y documentar como DECISIÓN AUTÓNOMA en summary.md.
**Si npm run build falla:** NO continuar a T5 hasta resolverlo.

---

## T5. Cadena git LOCAL (sin Vercel)
**Acción:** Según `.claude/rules/RULES.md` sección 3 (modo localhost activo, NO desplegar a Vercel hasta autorización explícita "deploy Vercel"):
```bash
git add src/lib/supabasePaginated.ts src/hooks/useConciliacion.ts src/pages/Conciliacion.tsx
git commit -m "fix(conciliacion): helper paginado supera limite PostgREST 1K filas"
git push origin master
git pull origin master
```
**NO ejecutar `npx vercel --prod`.**
**Output esperado:** Commit en master, working tree limpio. Validación visual pendiente: Rubén levanta `npm run dev`, abre tab Movimientos en Conciliación y confirma "X de 5582".

---

## Notas para implementer
- Si los filtros del hook actual (`.eq('canal', x)`, `.gte('fecha', y)`, `.order(...)`) no van DENTRO del callback `() => supabase.from(...)...`, los resultados serán incorrectos a partir de la 2ª página. Verificar dos veces.
- Si `MovimientoRow` no está definido, inferir del retorno actual del hook y reutilizar; no redefinir tipos del esquema.
- Tras T2, el `.range(0, 999999)` debe haber DESAPARECIDO del hook. Si queda residual, helper no surte efecto (Supabase aplica el último range).
- Cualquier desviación → anotar en `summary.md` como DECISIÓN AUTÓNOMA.
