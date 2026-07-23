# LEY-MARGEN-02 · Un solo margen oficial

Decisión Rubén, 22-jul.

## Regla

En pantalla hay **UN** margen por plato: el **limpio, sin IVA** (el IVA
repercutido no es ingreso). Es el modelo "cash" (`margenC` / `margenPctC` en
`computeWaterfall`), en el que el coste de plataforma es `pvp · comisión` sin
añadir el IVA de la comisión.

La variante que trata el **IVA de la comisión como coste** (modelo "real":
`margenR`, con `pvp · comisión · 1,21`) **desaparece de la UI**. La fórmula se
conserva internamente en `computeWaterfall` sólo para tests; ninguna pantalla la
muestra al usuario.

## Alcance

- `ModalReceta` (waterfall del Escandallo): tabla en columna única por canal con
  el margen limpio; el PVP recomendado usa `pvpRecomendado` (modelo limpio).
- Carta, Menú Engineering y Coste por plato ya calculan el margen como
  `neto − coste` (limpio), sin duplicar la variante con IVA.

## Fuente de la comisión

Se sigue etiquetando el origen de la comisión (real / calibrada / teórica) tal
como hace `netoResolver` (LEY-NETO-01/02). LEY-MARGEN-02 **no** cambia
`netoResolver` ni las LEY-NETO.
