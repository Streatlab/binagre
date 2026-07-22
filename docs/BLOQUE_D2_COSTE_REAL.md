# Bloque D2 · Coste real del plato — cierre

Decisiones de pricing CERRADAS por Rubén sobre `docs/BLOQUE_D_WATERFALL.md` (divergencias
B/C/D/E/F). Las 5 quedan resueltas así:

## 1 · Fórmula canónica

`src/utils/waterfallReceta.ts` (`computeWaterfall`) es la única. Borradas las huérfanas:
`src/utils/calcWaterfall.ts`, el `calcWaterfall()` de `src/hooks/useConfig.ts` y su test
muerto `tests/smoke.test.ts`. Ningún componente las importaba (verificado por grep antes de
borrar) — cero migración de imports residuales necesaria.

## 2 · Merma dentro del coste (divergencia B)

`ModalEPS.tsx`/`ModalReceta.tsx` cargaban `eur_ud_neta` con `eur_min || eur_std` (bruto).
Nuevo helper `precioNeto()` en `src/components/escandallo/types.ts`:
`coste_neto_min || coste_neto_std || eur_min || eur_std` — neto con merma siempre que
exista, bruto como fallback para ingredientes pre-creados sin ficha completada. Aplicado en
los 8 sitios donde se fijaba `eur_ud_neta` de una línea (selección de ingrediente, dictado
por voz, conflictos, táper). Los dos "detector de más barato" (`masBaratos`) se dejan en
bruto a propósito: son un hint de deduplicado, no un coste.

**Backfill aplicado** (Supabase, transacción única): 11 `eps_lineas` y 0 `recetas_lineas`
tenían el valor incorrecto → recalculadas junto con `coste_tanda`/`coste_rac` de sus EPS y
recetas.

## 3 · Fees fijos (divergencia D) — resuelto vía decisión 4, sin código propio

`fijo_eur` (Just Eat 0,30€/pedido, Web 0,50€/pedido) ya entra automáticamente en el fallback
teórico de `calcNetoPorCanal`/`calcDesglosePorCanal` (`src/lib/panel/calcNetoPlataforma.ts`),
que es lo que resuelve `comisionEfectivaCanal`. El fee **periódico** (Uber semanal, Glovo
quincenal) se deja **fuera** a propósito: no hay forma de prorratearlo a UN plato sin asumir
un volumen de pedidos, y ya vive en el cálculo agregado de Panel/Running — sumarlo aquí
sería contarlo dos veces. **DECISIÓN AUTÓNOMA**: no se implementa como código separado
porque el punto 4 ya lo cubre sin duplicar lógica.

## 4 · Comisión real, no de tarifa (divergencia E)

Nuevo `src/lib/escandallo/comisionEfectiva.ts` (`comisionEfectivaCanal`): llama a
`resolverNeto()` (LEY-NETO-01, `netoResolver.ts`) con `(canal, pvp, 1)` sin fechas — usa,
en orden, el `ratio_neto_real` calibrado del canal, luego el ratio empírico ponderado por
recencia, y solo si ninguno existe cae a la fórmula teórica (que igual incluye fijo_eur y
mezcla prime/promo autocalibrada, nunca la comisión base a pelo). Si `pvp<=0` o el
resolver no da nada usable, cae a la comisión base de `config_canales` — nunca a un 0%
silencioso. `ModalReceta.tsx` precarga los cachés de `netoResolver`/`calcNetoPlataforma`
(`useVentasRealesListas`, `useRatiosCalibrados`, `useConfigCanales`) y sustituye la
comisión base por la efectiva en `channelData`. `computeWaterfall` sigue siendo puro/testeable:
recibe la comisión ya resuelta, no llama a Supabase.

## 5 · Precio de cálculo = media histórica configurable (divergencia F)

- `configuracion.ventana_precio_dias = '60'` (editable en Config → Cocina, pendiente de UI
  en Tanda C).
- `fn_precio_por_ud_std(precio, contenido_valor, contenido_unidad, ingrediente_id)`: € por
  ud. std., con contenido conocido (kg/g/l/ml/ud) o fallback a `ingredientes.uds` (mismo
  criterio que `ModalIngrediente` para `eur_std`).
- Trigger `BEFORE INSERT` en `precios_ingredientes` rellena `precio_por_ud_std` si el
  caller no lo trae — funciona igual venga de conciliación, del robot OCR o de un import.
- `fn_precio_calculo(ingrediente_id)`: media en la ventana → último precio conocido →
  `eur_std` manual de la ficha. Vista `v_precio_calculo` para inspección.
- Trigger `AFTER INSERT` en `precios_ingredientes` (`fn_trg_precio_ingrediente_recalcula`):
  recalcula en cadena reutilizando `fn_recalc_ingrediente_por_factor` (Tanda 2, la misma
  que ya cascadea ingrediente→eps_lineas→eps→recetas_lineas→recetas para la herencia de
  alérgenos).
- **Robot OCR** (`fn_procesar_linea_factura`): antes actualizaba `precio1/2/3/precio_activo`
  pero nunca insertaba en `precios_ingredientes` ni recalculaba coste salvo un atajo manual
  (factor sobre el precio crudo, solo si `selector_precio='ultimo'`). Ahora inserta en
  `precios_ingredientes` como cualquier otra fuente y se retira el atajo — el trigger es la
  única cadena, así no se cascada el factor dos veces.

### DECISIÓN AUTÓNOMA — guardarraya de cordura (no pedida explícitamente, necesaria)

Al construir `fn_precio_calculo` sobre datos reales se encontraron precios ya corruptos en
`precios_ingredientes` (ej. una factura mal leída insertando 1282€ para un ingrediente que
vale 11€/kg). Cascadear eso sin filtro habría metido basura en el coste de las recetas
(contra LEY-ANTIFALSOS). Los triggers de recálculo **solo cascadean si el factor de cambio
está entre 0,3x y 3x**; fuera de ese rango se deja el ingrediente tal cual y se abre una
tarea en `tareas_erp` ("Revisar precio sospechoso: …") para que se corrija a mano. Del
backfill inicial (223 ingredientes con media histórica distinta a su `eur_std`), 188
cascadearon solos y **35 quedaron con tarea abierta** — son los que tenían datos de origen
ya corruptos, no un efecto de esta tanda.

## 6 · Test

`tests/waterfall.test.ts` ampliado con 2 bloques nuevos: merma infla el coste vs. bruto
(y merma 0% no penaliza), y una comisión efectiva derivada de `(pvp-neto)/pvp` mantiene la
coherencia interna del waterfall y baja el margen frente a la comisión base — tal y como
se espera al pasar de tarifa a neto real. La media histórica (decisión 5) es SQL puro:
verificada con queries directas en Supabase (backfill + guardarraya), no con vitest — el
runner de tests de este repo no resuelve el alias `@/…` fuera de módulos sin imports.

## 7 · Aviso de impacto

- Backfill de merma: 11 líneas de EPS corregidas (0 en recetas — ya coincidían).
- Backfill de media histórica: 223 ingredientes con precio distinto a su `eur_std`; 188
  corregidos solos, 35 con tarea de revisión manual abierta (precio de origen sospechoso).
- Márgenes de receta: de 32 recetas con PVP y coste cargados, **ninguna queda en negativo**
  tras los 4 cambios (rango 74,9%–77,3% de margen bruto aprox. sobre `pvp_uber`). No hay
  top-10-que-más-caen que reportar porque no se guardó una foto de "antes" de coste_rac
  antes del backfill (aviso honesto: si se necesita el delta exacto, no es reconstruible a
  posteriori con precisión).

## Ficheros tocados

- Borrados: `src/utils/calcWaterfall.ts`, `tests/smoke.test.ts`.
- Editados: `src/hooks/useConfig.ts`, `src/utils/waterfallReceta.ts` (solo comentarios),
  `src/components/escandallo/types.ts` (`precioNeto`), `src/components/escandallo/ModalEPS.tsx`,
  `src/components/escandallo/ModalReceta.tsx`, `tests/waterfall.test.ts`.
- Nuevos: `src/lib/escandallo/comisionEfectiva.ts`.
- Supabase: `configuracion.ventana_precio_dias`, `fn_precio_por_ud_std`,
  `fn_precio_calculo`, `v_precio_calculo`, `fn_trg_precio_ingrediente_std` (+trigger BEFORE
  INSERT), `fn_trg_precio_ingrediente_recalcula` (+trigger AFTER INSERT) en
  `precios_ingredientes`; `fn_procesar_linea_factura` actualizada; backfill de
  `eps_lineas`/`recetas_lineas`/`eps`/`recetas` (merma) y de `precio_por_ud_std`/`eur_std`
  en cadena (media histórica) ya ejecutados en producción.

## Orden restante

C (con la fuente de verdad resuelta leyendo `useConfig.ts`) → E → F → G. Ver
`docs/HANDOFF_TANDAS_4-6.md` para el detalle de cada bloque.
