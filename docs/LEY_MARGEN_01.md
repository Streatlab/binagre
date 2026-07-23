# LEY-MARGEN-01 · Margen deseado dinámico

Decisión Rubén, 22-jul. Fuente única de la lógica: `src/utils/waterfallReceta.ts`
(`resolveMargenDeseado`, `pvpRecomendado`). Tests: `tests/waterfall.test.ts`.

## Cascada (dos niveles, gana el más específico)

1. **Override por receta** — `recetas.margen_deseado_pct` (numeric, nullable).
   Editable desde la ficha de la receta (ModalReceta). Si existe, **manda**.
2. **% global** — `configuracion.margen_deseado_pct`. Editable en Configuración.
   Rubén lo cambia cuando quiera y aplica a todo lo que no tenga override.
3. **Default 20** — si no hay override ni global.

`resolveMargenDeseado(overrideReceta, global, def=20)` devuelve **decimal**.
Acepta la entrada en % (`20`) o en decimal (`0.20`). Un override de `0` es un
override real (margen 0%), no "sin valor"; sólo `null`/`undefined`/`NaN` se
consideran vacíos y bajan al siguiente nivel.

## Qué deja de leerse

`config_canales.margen_deseado_pct` **ya no se usa** para el PVP recomendado.
La columna NO se borra (puede seguir en la tabla), sólo se deja de leer. No hay
margen por canal como fuente del deseado, ni niveles de elaboración.

## PVP recomendado y "sin precio viable"

El PVP recomendado del waterfall usa el % resultante de la cascada.
`pvpRecomendado(costeMP, comision, estructura, margenDeseado)` (modelo limpio /
cash, ver LEY-MARGEN-02) calcula:

    denominador = 1 − comisión − estructura − margenDeseado
    PVP = costeMP / denominador   (si denominador > 0)

Cuando el **denominador es ≤ 0** no hay precio viable con esos parámetros: la
función devuelve `{ viable: false, pvp: 0 }` y la UI muestra
**"Sin precio viable con estos parámetros"** — nunca un 0 mudo.
