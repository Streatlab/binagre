# Bloque D · Auditoría del waterfall de coste/margen + blindaje

## Qué se ha hecho (Tanda 3)

1. **Extracción del waterfall VIVO a módulo testeable.** La tabla de margen que ve el
   usuario en el modal de receta se calculaba con una función `computeWaterfall` inline en
   `ModalReceta.tsx` (sin ningún test). Se ha extraído **tal cual, sin cambiar la fórmula**,
   a `src/utils/waterfallReceta.ts` (`computeWaterfall`, `costeRacion`, `norm`), y
   `ModalReceta` ahora la importa.
2. **Test que bloquea el build** (`tests/waterfall.test.ts`, 13 casos, corre en
   `vitest run` dentro de `npm run build`): cadena de coste `eur_ud_neta → coste_rac (EP y
   receta) → coste_mp → margen`, coherencia interna del waterfall (coste_total = mp +
   plataforma + estructura; margen = pvp − coste_total; IVA de comisión ×1,21; estructura
   sobre ingreso neto; factor_k), determinismo y bordes. Si el margen real del Escandallo
   descuadra, el deploy se cae.

## Hallazgo capital de la auditoría

Existen **TRES** implementaciones del waterfall con fórmulas que **no coinciden**:

| Función | Ruta | ¿Viva? | ¿Testeada antes? |
|---|---|---|---|
| `computeWaterfall` | `ModalReceta.tsx` (ahora en `utils/waterfallReceta.ts`) | **SÍ** | No → **ahora sí** |
| `calcWaterfall` | `src/utils/calcWaterfall.ts` | No (huérfana) | Sí (`smoke.test.ts`) |
| `calcWaterfall` | `src/hooks/useConfig.ts` | No (huérfana) | No |

El test antiguo (`smoke.test.ts`) blindaba la huérfana; el código vivo iba sin red. Eso
queda corregido.

## Divergencias detectadas — DECISIONES DE PRICING PENDIENTES (no tocadas)

Estas afectan al **PVP y al margen de cara al cliente**, así que NO se han cambiado en
silencio (RULES.md §8). Requieren decisión de Rubén antes de unificar:

- **B · La merma no entra en el coste.** `ModalIngrediente` calcula `coste_neto_std =
  eur_std/(1−merma%)`, pero EPS y recetas cargan la línea con `eur_min || eur_std` **sin
  merma**. El `coste_mp` del waterfall ignora la merma. ¿Debe el coste del plato incluir la
  merma? (Casi seguro que sí, pero es un cambio de todos los márgenes.)
- **C · Tres fórmulas incompatibles** entre las tres implementaciones (real/cash con IVA
  invertido; estructura sobre `pvp−comisión` vs sobre `pvp/1.1`; margen sobre `pvp` vs sobre
  `pvp/1.1`). Hay que elegir UNA canónica y borrar las otras dos.
- **D · El waterfall vivo ignora los fees fijos** (`fijo_eur`, `fee_periodo_eur`): Just Eat
  (0,30 €/ped) y Web quedan infravalorados. La huérfana sí los suma.
- **E · Comisión base vs real por canal.** El Escandallo usa la comisión base de
  `config_canales`; el neto real (prime/promo/liquidación) vive en `netoResolver`
  (LEY-NETO-01). El margen del Escandallo no coincide con el del Panel/Margen para el mismo
  canal. Unificar el plato con `netoResolver` es la parte gorda de "cuadrar con neto por
  canal" y merece su propia tanda.
- **F · Snapshots sin recálculo.** El precio del ingrediente se congela en la línea de EPS,
  y el `coste_rac` del EPS se congela en la línea de receta. No hay trigger que propague un
  cambio de precio: EPS y recetas quedan con coste viejo hasta reabrir y guardar a mano.
  (Candidato a `fn_recalc` en cadena, como la herencia de alérgenos de la Tanda 2.)

## Recomendación

El blindaje (test sobre el código vivo) ya está. La **unificación** de las tres fórmulas +
la conexión del margen del plato con `netoResolver` + la entrada de la merma en el coste
son cambios de pricing de cara al cliente: conviene una tanda dedicada con las decisiones
de Rubén cerradas (qué fórmula es canónica, si la merma entra en coste, si el plato usa neto
real por canal). Este documento deja el mapa exacto para hacerlo sin sorpresas.
