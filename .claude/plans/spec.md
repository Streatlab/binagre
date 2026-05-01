# Spec: Conciliación — paginación server-side con URL params

## Contexto
El módulo Conciliación vive en `src/pages/Conciliacion.tsx`. La pestaña **Movimientos** delega toda la tabla a `src/components/conciliacion/TabMovimientos.tsx`. Actualmente `Conciliacion.tsx` carga todos los registros de la tabla `conciliacion` con `.range(0, 999999)` dentro de un `useEffect` (líneas 163–192) y los pasa al hijo como prop `movimientos`. `TabMovimientos` hace filtrado, ordenación y paginación 100% en memoria. Con muchos registros esto es lento y el cap no escala.

## Petición original
> Feature "Conciliación paginado": paginar la tabla de movimientos para que no cargue todas las filas de un tirón.

## Criterios DADO/CUANDO/ENTONCES

1. DADO que el usuario abre la pestaña Movimientos, CUANDO se monta el componente, ENTONCES se lanza una query con `.range(0, 49)` + `count: 'exact'` y se muestra la página 1 de N con tamaño por defecto 50.

2. DADO que hay 347 movimientos en el período, CUANDO se carga la página 1, ENTONCES el pie muestra "Mostrando 1–50 de 347 movimientos" y los controles muestran "Página 1 de 7".

3. DADO que el usuario está en la página 3, CUANDO hace click en "Siguiente", ENTONCES la URL cambia a `?page=4&size=50` y se carga `.range(150, 199)`.

4. DADO que el usuario está en la página 1, CUANDO hace click en "Primera" o "Anterior", ENTONCES los botones están deshabilitados (opacity 0.35, cursor default, sin acción).

5. DADO que el usuario cambia el selector de tamaño a 100, CUANDO selecciona 100, ENTONCES la URL pasa a `?page=1&size=100`, la query usa `.range(0, 99)` y `page` se resetea a 1.

6. DADO que el usuario aplica un filtro (busqueda, catFiltro, filtroCard, filtroTitular), CUANDO cambia cualquier filtro, ENTONCES `page` se resetea a 1, la URL se actualiza y se relanza la query.

7. DADO que la URL contiene `?page=99&size=50` pero solo hay 3 páginas, CUANDO se monta, ENTONCES se carga la página 3 y la URL se corrige a `?page=3&size=50` sin redirección adicional.

8. DADO que `size` en la URL es un valor fuera de [25, 50, 100, 200], CUANDO se parsea, ENTONCES se usa 50 y la URL se corrige.

9. DADO que el total de movimientos filtrados es 0, CUANDO se carga, ENTONCES se muestra el empty state existente y los controles de paginación no se renderizan.

10. DADO que Supabase devuelve un error de red, CUANDO falla la fetch, ENTONCES aparece un banner inline "Error cargando movimientos. Intenta de nuevo." con botón "Reintentar" que relanza la misma query.

11. DADO una URL compartida `?page=2&size=100`, CUANDO el usuario la abre, ENTONCES la tabla carga directamente la página 2 con tamaño 100 sin pasar por página 1.

12. DADO que el usuario cambia la columna de ordenación, CUANDO cambia `sortColumn` o `sortDir`, ENTONCES `page` se resetea a 1 y la query se relanza.

## Alcance

### Archivos que tocar
1. `src/pages/Conciliacion.tsx` — eliminar el `useEffect` de líneas 163–192 que carga `movimientosPeriodo` y el estado `movimientosPeriodo`. Pasar a `TabMovimientos` solo `periodoDesde`, `periodoHasta`, `periodoLabel` (ya no se pasa `movimientos` como prop).
2. `src/components/conciliacion/TabMovimientos.tsx` — mover la query Supabase dentro del componente con paginación server-side; añadir `useSearchParams` para URL params; añadir controles de paginación completos y selector de tamaño de página; gestionar query de agregados paralela para KPIs.

### Archivos que NO tocar
- `src/hooks/useConciliacion.ts`
- `src/types/conciliacion.ts`
- `src/styles/tokens.ts`, `src/styles/design-tokens.css`
- `src/components/conciliacion/ModalDetalleMovimiento.tsx`
- `src/components/conciliacion/ResumenDashboard.tsx`
- Lógica de matching, categorización, reglas, inserción

## Lógica de datos — especificación exacta

### Query paginada principal
```ts
const PAGE_SIZES = [25, 50, 100, 200] as const
type PageSize = typeof PAGE_SIZES[number]

const from = (page - 1) * pageSize
const to   = from + pageSize - 1

let q = supabase
  .from('conciliacion')
  .select('*, factura_data:facturas(pdf_drive_url, pdf_filename)', { count: 'exact' })
  .gte('fecha', desdeStr)
  .lte('fecha', hastaStr)
  .range(from, to)

// Ordenación server-side (ver mapeo abajo)
// Filtros server-side (ver tabla abajo)
```

### Mapeo sortColumn → campo BD
| sortColumn    | campo BD      | Nota |
|---------------|---------------|------|
| `fecha`       | `fecha`       | default desc |
| `concepto`    | `concepto`    | |
| `contraparte` | `proveedor`   | |
| `importe`     | `importe`     | |
| `categoria`   | `categoria`   | |
| `doc`         | `doc_estado`  | |
| `estado`      | *(no aplica)* | client-side sobre página actual |
| `titular`     | `titular_id`  | |

### Filtros server-side
| Filtro activo | Cláusula Supabase |
|---|---|
| `filtroCard === 'ingresos'` | `.gt('importe', 0)` |
| `filtroCard === 'gastos'` | `.lt('importe', 0)` |
| `filtroCard === 'pendientes'` | client-side (campo derivado) |
| `catFiltro !== 'todas'` | `.eq('categoria', catFiltro)` |
| `filtroTitular !== 'todos'` | `.eq('titular_id', idResuelto)` — resolver id desde array `titulares` ya cargado |

### Búsqueda textual (`busqueda`)
Aplicada client-side sobre los registros de la página actual. Esto es aceptable dado que la paginación ya reduce el volumen. Búsqueda global con FTS es fuera de scope de este spec.

### Query de agregados paralela (KPIs de las 4 cards)
```ts
// Se lanza una sola vez por cambio de período, NO por cambio de página
supabase
  .from('conciliacion')
  .select('importe, categoria, doc_estado, titular_id')
  .gte('fecha', desdeStr)
  .lte('fecha', hastaStr)
  // sin .range() — trae todos para calcular KPIs
```
Los totales `ingresosImporte`, `gastosImporte`, `pendientesCount`, `pendientesImporte` se calculan sobre este resultado, no sobre la página actual.

### Exportar CSV
El botón "Exportar" lanza una query sin `.range()` (con los filtros activos de fecha + catFiltro + filtroCard + filtroTitular) para obtener todos los registros antes de generar el CSV. Igual que hoy pero contra BD en vez de memoria.

### URL params — lectura y escritura
- Hook: `useSearchParams` de `react-router-dom`
- Al montar: leer `page` y `size`; validar; corregir si inválido
- Al cambiar `page` o `pageSize`: `setSearchParams({ page: String(p), size: String(s) }, { replace: true })`
- Al cambiar filtros: reset `page=1` antes de actualizar URL

### Validación params URL
- `page`: entero >= 1; si > totalPages (conocido post-fetch) → `Math.min(parsed, totalPages)`; si totalPages aún desconocido → usar parsed y corregir post-fetch
- `size`: si no en [25, 50, 100, 200] → usar 50; corregir URL

## Diseño UX — controles de paginación (pie de tabla)

Fila con `justifyContent: 'space-between'`, `padding: '14px 16px'`, `background: '#fafaf7'`, `borderTop: '0.5px solid #d0c8bc'`.

Lado izquierdo: `"Mostrando X–Y de Z movimientos"` (Lexend 12px, `#7a8090`)

Lado derecho: selector tamaño + botones de navegación
- Selector: label "Filas:" (Oswald 10px, `#7a8090`, uppercase) + `<select>` con opciones 25/50/100/200. Estilo igual al `<select>` de categoría en la barra de filtros: `padding: '6px 10px', borderRadius: 8, border: '0.5px solid #d0c8bc', background: '#fff', Lexend 13px`.
- Botones: `[Primera]` `[‹ Anterior]` `[Página X de Y]` `[Siguiente ›]` `[Última]`
- Botón activo: `background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 8, Lexend 13px, color: '#111'`
- Botón deshabilitado: mismo estilo pero `opacity: 0.35, cursor: 'default'`
- Controles ocultos si `totalPages === 1`

## Edge cases cerrados

| Situación | Comportamiento |
|---|---|
| `page > totalPages` | Corregir a `totalPages`; actualizar URL sin reload |
| `size` inválido en URL | Usar 50; actualizar URL |
| `total = 0` | Empty state existente; sin controles de paginación |
| Error de red | Banner inline + botón Reintentar |
| Cambio de período | Reset page=1, relanzar query paginada y de agregados |
| Cambio de filtro | Reset page=1, relanzar query paginada |
| Cambio de ordenación | Reset page=1, relanzar query paginada |
| `titulares` no cargados al montar | Ignorar `filtroTitular` en query hasta que array esté disponible |
| `count: null` de Supabase | Tratar como 0; mostrar empty state |
| `filtroCard === 'pendientes'` | Client-side; el count de la card KPI viene de la query de agregados |

## Fuera de alcance
- Búsqueda textual global (FTS)
- Paginación en pestaña Resumen
- Paginación en `useConciliacion`
- Renombrar columnas de BD
- Cambiar lógica de matching o categorización
- Infinite scroll / virtual scroll
- Deploy a Vercel (solo localhost hasta que Rubén diga "deploy Vercel")

## Riesgos identificados
1. **Prop `movimientos` eliminada de `TabMovimientos`** — breaking change en la firma; hay un único call-site en `Conciliacion.tsx` que hay que actualizar en el mismo commit.
2. **KPIs de cards** — al paginar, los totales ya no son computables desde los datos en memoria; requiere query de agregados paralela (ligera, sin `.range()`). Si esta query falla, mostrar `—` en las cards en vez de 0 para no confundir.
3. **`handleExportar`** — necesita query sin paginación; con muchos registros puede tardar. Solución: añadir estado `exportando` con feedback visual ("Exportando...") en el botón durante la descarga.
4. **`filtroCard === 'pendientes'` en paginación** — el filtro client-side significa que la página puede mostrar menos de `pageSize` filas aunque haya más páginas. Este comportamiento es conocido y aceptado; se documenta en tooltip del filtro: "Filtrando por estado pendiente — el conteo es aproximado en paginación".
5. Aislamiento David: ningún token ni tabla de David referenciada. Riesgo nulo.
