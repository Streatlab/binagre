# Bloque C · Configurables (Cocina) — cierre

## Duda bloqueante resuelta

Auditoría de `src/hooks/useConfig.ts` + los 4 modales de Escandallo (ver
`docs/HANDOFF_TANDAS_4-6.md:31-49`) antes de tocar nada. Hallazgo: **coexistían cuatro
sistemas de categorías y dos de unidades**, y una sesión paralela ya había construido
parte del CRUD (`src/pages/configuracion/compras/*`, área "Compras") — pero una parte de
ese CRUD escribía en tablas sin migración de creación y desconectadas de lo que Escandallo
lee de verdad (antipatrón "UI desconectada" que el propio handoff pedía evitar).

| Concepto | CRUD ya existente | Fuente real que lee Escandallo | Estado |
|---|---|---|---|
| Categorías de ingredientes | `EditorCategoriasIngredientes.tsx` → tabla `categorias_ingredientes` | `ModalIngrediente.tsx` lee la misma tabla | **Correcto, sin tocar** |
| Proveedores | `TabProveedores.tsx` → tabla `config_proveedores` | `useConfig.ts` lee la misma tabla | **Correcto, sin tocar** |
| Categorías de recetas | `TabCategorias.tsx` (parte "Lista") → tabla `categorias_recetas` | `ModalReceta.tsx`/`RecetasFichasTecnicas.tsx` leen `configuracion` clave JSON `categorias_recetas` | **Desconectado → arreglado** |
| Unidades/formatos | `TabUnidades.tsx` → tablas `config_formatos`/`unidades_relacion` | `ModalIngrediente`/`ModalMerma`/`ModalReceta` leen `configuracion` claves JSON `unidades`/`unidades_estandar`/`unidades_minimas`/`formatos_compra` | **Desconectado → arreglado** |
| Categorías de EPS | Sin CRUD | `ModalEPS.tsx` lee clave JSON `categorias_eps` | **Creado** |
| Formato de números | No existía | `format.ts` (hardcodeado) | **Creado** |

Verificado en Supabase: las tablas `categorias_recetas` (vacía, 0 filas) y
`config_formatos`/`unidades_relacion` (18/5 filas, idénticas al contenido de las claves
JSON) no tenían ningún dato de usuario distinto del seed — abandonarlas no pierde nada.

## Qué se ha hecho

1. **`EditorListaConfigJson.tsx`** (nuevo, `src/components/configuracion/`): CRUD genérico
   reutilizable para una lista de strings guardada como JSON en `configuracion.valor` bajo
   una clave — mismo patrón visual que `EditorCategoriasIngredientes`/`TabCostes`.
2. **`compras/TabUnidades.tsx` reescrito**: de `config_formatos`/`unidades_relacion`
   (tablas desconectadas) a 4 `EditorListaConfigJson` sobre `unidades` / `unidades_estandar`
   / `unidades_minimas` / `formatos_compra`. Bug real arreglado en el sitio donde ya vivía
   (Compras), no solo en Cocina.
3. **`compras/TabCategorias.tsx` reescrito**: la parte "Categorías de recetas" pasa de la
   tabla huérfana a la clave JSON `categorias_recetas`; se añaden `categorias_eps` y
   `categorias` (genérico, el que usa `ModalMerma`). `EditorCategoriasIngredientes` sin
   cambios.
4. **Nueva sección "Cocina" en Configuración** (`src/pages/configuracion/cocina/`):
   `CocinaPage.tsx` con 4 pestañas — Categorías / Unidades / Proveedores / Formato de
   números — reutilizando **los mismos componentes** que Compras (cero UI duplicada,
   import directo). Enlazada desde `ConfiguracionHub.tsx`.
5. **Formato de números (C4)**: clave `configuracion.formato_numeros` (decimales de
   `fmtNum`, default 4 = comportamiento actual sin cambios hasta que se edite). Cargada una
   vez al arrancar la app en `contexts/ConfigContext.tsx` (ya montado en `main.tsx`), que
   llama a `setDecimalesNum()` (nuevo export de `src/utils/format.ts`). `fmtEur`/`fmtPct`
   **no se tocan**: moneda y porcentaje siguen con 2 decimales fijos (regla contable, no
   configurable). `fmtNum` sigue aceptando un único argumento en todas las llamadas
   existentes (RULES.md): el cambio es solo en su valor por defecto.

## DECISIONES AUTÓNOMAS

- **C3 (proveedores + `proveedor_alias`/`fn_prov_canon`)**: no se toca. Son sistemas
  distintos — `config_proveedores` es el catálogo de compras (abreviatura + categoría +
  marca); `proveedor_alias`/`fn_prov_canon` son equivalencias de razón social para
  matching de conciliación bancaria/OCR (Tanda 2, `docs/LEY_CONCILIACION.md`). El CRUD de
  proveedores no necesita tocarlos porque no los usa ni los rompe.
- **Formato de números**: se interpreta como decimales de `fmtNum` (cantidades del
  Escandallo), no como cambio de locale. `format.md`/RULES.md fijan es_ES/coma decimal como
  regla dura en toda la app — un selector que cambiara el locale la violaría. Los euros y
  porcentajes quedan fuera del selector a propósito.
- **Categoría "genérica" (`configuracion.categorias`, la que usa `ModalMerma`)**: se le da
  CRUD igual que a las demás en vez de deprecarla, para no romper el datalist de Mermas sin
  que nadie lo haya pedido explícitamente.

## Verificación

`npx tsc -b` y `npm run build` limpios. Sin backfill de datos necesario (las claves JSON ya
existían con contenido real; `formato_numeros` sembrada a `'4'`, igual al comportamiento
previo).

## Ficheros tocados

- Nuevos: `src/components/configuracion/EditorListaConfigJson.tsx`,
  `src/pages/configuracion/cocina/CocinaPage.tsx`,
  `src/pages/configuracion/cocina/TabFormatoNumeros.tsx`.
- Reescritos: `src/pages/configuracion/compras/TabUnidades.tsx`,
  `src/pages/configuracion/compras/TabCategorias.tsx`.
- Editados: `src/utils/format.ts` (`setDecimalesNum`), `src/contexts/ConfigContext.tsx`
  (carga inicial), `src/App.tsx` (rutas `/configuracion/cocina/*`),
  `src/pages/configuracion/ConfiguracionHub.tsx` (apartado Cocina).
- Supabase: `configuracion.formato_numeros` sembrada a `'4'`.

## Orden restante

E (inventario por hoja + foto) → F (integraciones) → G (reordenación + restyle — nota: una
sesión paralela en `trabajo` ya ha avanzado mucho de esto bajo otra numeración, D1-D16;
revisar su alcance antes de empezar G para no duplicar).
