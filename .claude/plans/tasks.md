# Tasks — Conciliación KPIs cuadrar al milímetro

Ejecución secuencial T1 → T9. El implementer trabaja en worktree aislado sobre `master`. Cada tarea <5 min.

---

## T1. Pre-flight: verificar helper existente
**Archivo:** `src/lib/supabasePaginated.ts`
**Acción:** Leer y confirmar export `fetchAllPaginated<T>(builderFn: () => any): Promise<T[]>` con `PAGE_SIZE = 1000`. NO modificar.
**Output esperado:** Nota en summary.md "Helper ya existe, sin cambios".

---

## T2. Pre-flight: verificar useConciliacion ya pagina
**Archivo:** `src/hooks/useConciliacion.ts`
**Acción:** Leer y confirmar que línea 8 importa `fetchAllPaginated` y línea ~64 lo usa para cargar `movimientos`. NO modificar.
**Output esperado:** Nota en summary.md "Tab Resumen ya pagina via useConciliacion, sin cambios".

---

## T3. Añadir import en TabMovimientos
**Archivo:** `src/components/conciliacion/TabMovimientos.tsx`
**Acción:** En el bloque de imports superior (junto a `import { supabase } from '@/lib/supabase'`), añadir:
```ts
import { fetchAllPaginated } from '@/lib/supabasePaginated'
```
**Output esperado:** Nuevo import en cabecera. Resto del archivo sin tocar.

---

## T4. Refactorizar cargarAgregados
**Archivo:** `src/components/conciliacion/TabMovimientos.tsx`
**Acción:** Reemplazar el cuerpo del `useCallback` `cargarAgregados` (líneas ~211-240) por:
```ts
const cargarAgregados = useCallback(async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await fetchAllPaginated<any>(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from('conciliacion')
        .select('importe, categoria, doc_estado, titular_id')
        .gte('fecha', periodoDesdeStr)
        .lte('fecha', periodoHastaStr)

      if (filtroTitular !== 'todos' && titulares.length > 0) {
        const matchIds = titulares
          .filter(t => {
            const n = t.nombre.toLowerCase()
            if (filtroTitular === 'ruben')  return n.includes('rubén') || n.includes('ruben')
            if (filtroTitular === 'emilio') return n.includes('emilio')
            return false
          })
          .map(t => t.id)
        if (matchIds.length === 1)      q = q.eq('titular_id', matchIds[0])
        else if (matchIds.length > 1)   q = q.in('titular_id', matchIds)
      }
      return q
    })

    let ingresosImporte = 0, gastosImporte = 0
    let pendientesCount = 0, pendientesImporte = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of data as any[]) {
      const imp = Number(r.importe) || 0
      if (imp > 0) ingresosImporte += imp
      if (imp < 0) gastosImporte   += imp
      const tieneCategoria = !!r.categoria
      const tieneDoc = r.doc_estado === 'tiene' || r.doc_estado === 'no_requiere'
      if (!(tieneCategoria && tieneDoc)) {
        pendientesCount   += 1
        pendientesImporte += Math.abs(imp)
      }
    }
    setAgregados({ ingresosImporte, gastosImporte, pendientesCount, pendientesImporte })
  } catch {
    setAgregados(null)
  }
}, [periodoDesdeStr, periodoHastaStr, filtroTitular, titulares])
```
**Cambios clave**:
- Query envuelta en `fetchAllPaginated` (todos los filtros DENTRO del closure).
- Filtro titular añadido (CA2).
- Try/catch para setear `null` en error.
- Deps actualizadas: añadir `filtroTitular` y `titulares`.
**Output esperado:** KPIs recalculan al cambiar período O titular, y suman sobre los 5.582 movs reales.

---

## T5. Refactorizar handleExportar
**Archivo:** `src/components/conciliacion/TabMovimientos.tsx`
**Acción:** Reemplazar el cuerpo de `handleExportar` (líneas ~317-369) por:
```ts
const handleExportar = async () => {
  setExportando(true)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await fetchAllPaginated<any>(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from('conciliacion')
        .select('*')
        .gte('fecha', periodoDesdeStr)
        .lte('fecha', periodoHastaStr)

      if (filtroCard === 'ingresos') q = q.gt('importe', 0)
      if (filtroCard === 'gastos')   q = q.lt('importe', 0)
      if (catFiltro !== 'todas')     q = q.eq('categoria', catFiltro)
      if (filtroTitular !== 'todos' && titulares.length > 0) {
        const matchIds = titulares
          .filter(t => {
            const n = t.nombre.toLowerCase()
            if (filtroTitular === 'ruben')  return n.includes('rubén') || n.includes('ruben')
            if (filtroTitular === 'emilio') return n.includes('emilio')
            return false
          })
          .map(t => t.id)
        if (matchIds.length === 1)    q = q.eq('titular_id', matchIds[0])
        else if (matchIds.length > 1) q = q.in('titular_id', matchIds)
      }
      return q.order('fecha', { ascending: false })
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = data.map((m: any) => [
      m.fecha,
      (m.concepto ?? '').replace(/,/g, ' '),
      (m.proveedor ?? '').replace(/,/g, ' '),
      m.importe,
      m.categoria ?? '',
      (m.doc_estado ?? 'falta'),
    ])
    const csv = [
      ['Fecha', 'Concepto', 'Contraparte', 'Importe', 'Categoría', 'Doc Estado'].join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `movimientos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  } catch {
    // swallow: el botón vuelve a su estado normal en finally
  } finally {
    setExportando(false)
  }
}
```
**Cambios clave**:
- Query envuelta en `fetchAllPaginated` (todos filtros + `.order('fecha', desc)` DENTRO del closure ANTES del retorno).
- `.order()` movido al final del closure (antes era post-await).
- Try/catch/finally para garantizar reset de `exportando`.
- Resto (mapeo CSV, blob, download) sin cambios.
**Output esperado:** CSV con 5.582 filas reales sin truncar.

---

## T6. Verificar zonas no tocadas
**Archivo:** `src/components/conciliacion/TabMovimientos.tsx`
**Acción:** Inspeccionar diff y confirmar:
- `cargarPagina()` (UI-paginated) NO tocado
- Render JSX (cards, tabla, paginador, modal) NO tocado
- Solo cambios: 1 import + 2 funciones refactorizadas
**Output esperado:** Diff limpio. Cero cambios visuales.

---

## T7. Validar build TypeScript
**Acción:** Desde raíz del repo:
```bash
npx tsc --no-emit
```
Si hay errores en `TabMovimientos.tsx`, fallback a `any` total (autorizado por spec). Si el error es ajeno al cambio, abortar y documentar.
**Output esperado:** Exit code 0.

---

## T8. Validar build Vite
**Acción:** Desde raíz del repo:
```bash
npm run build
```
**Output esperado:** Build exitoso, dist/ generado, sin warnings nuevos relevantes.

---

## T9. Cadena git+vercel obligatoria
**Acción:** Desde raíz del repo, ejecutar como cadena única:
```bash
git add src/components/conciliacion/TabMovimientos.tsx && \
git commit -m "fix(conciliacion): KPIs y export CSV usan fetchAllPaginated, eliminan cap 1K" && \
git push origin master && \
npx vercel --prod --yes && \
git pull origin master
```
Si Vercel falla en 1er intento → 1 reintento autorizado. Si falla 2 veces → documentar en summary.md y parar (autorizado por spec).
**Output esperado:** Commit en master con SHA, deploy URL en https://binagre.vercel.app, working tree limpio. summary.md con commit SHA, URL de deploy y check pasos CA1/CA2/CA3.

---

## Notas para implementer
- Los filtros DEBEN ir dentro del closure `() => { ... return q }` que se pasa al helper. Si quedan fuera, sólo aplican a la 1ª iteración (resultado incorrecto desde la página 2).
- El `.order('fecha', { ascending: false })` en `handleExportar` va DENTRO del closure, ANTES del retorno. El helper añade `.range()` después automáticamente.
- En `cargarAgregados` no se usa `.order()` (suma es asociativa).
- Cualquier desviación → documentar en `summary.md` como DECISIÓN AUTÓNOMA.
- NO tocar `cargarPagina()`, JSX, ni otros archivos. Cambios visuales = cero.
