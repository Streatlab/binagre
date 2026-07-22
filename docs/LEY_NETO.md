# LEY DEL NETO · REAL MANDA + AUTOAPRENDIZAJE

> **Ley del ERP. No negociable. Si un módulo muestra "neto" y no pasa por aquí, está mal.**
> Reglas: `LEY-NETO-01` (real manda) y `LEY-NETO-02` (autoaprendizaje). Ambas `bloqueante = true` en `reglas_globales`.

## Fuente única

| Qué | Dónde |
|---|---|
| Resolver oficial | `src/lib/panel/netoResolver.ts` → `resolverNetoCanal()` / `resolverNeto()` |
| Fórmula base | `src/lib/panel/calcNetoPlataforma.ts` → `calcNetoPorCanal()` / `calcDesglosePorCanal()` |
| Parámetros de canal (autocalibrados) | tabla `config_canales` |
| Liquidaciones reales | `ventas_plataforma`, `uber_liquidaciones`, `glovo_liquidaciones`, `justeat_liquidaciones` |
| Motor de autoaprendizaje | función BD `fn_recalibrar_calcneto()` + triggers en las tablas de liquidaciones |
| Historial de ajustes | tabla `calcneto_calibracion_log` |

**Ningún módulo calcula neto por su cuenta.** Se importa el resolver y punto.

---

## LEY-NETO-01 · Real manda

1. **REAL** — Si hay liquidación real en `ventas_plataforma` cuyo periodo cae *dentro* del rango consultado, ese neto es la verdad para esa parte del bruto. Solo afecta a SU periodo; nunca reescribe el resto.
2. **RATIO CALIBRADO CON RECENCIA** — El bruto no cubierto se estima con el ratio neto/bruto empírico del canal:
   - Peso de cada liquidación = `pedidos × factorRecencia(antigüedad)`
   - Recencia: decaimiento exponencial, **vida media 75 días**, **piso 0.4**.
   - Muestra mínima: ≥120 pedidos **o** ≥3 liquidaciones.
3. **FÓRMULA** — Sin muestra fiable, `calcNetoPorCanal()` con los parámetros de `config_canales`.

**Saneado:** se descarta cualquier liquidación con `bruto <= 0`, `pedidos <= 0` o ratio neto/bruto fuera de **[0.15 , 0.90]** (parser sucio). Ni vale como real ni calibra.

---

## LEY-NETO-02 · Autoaprendizaje de la calculadora

Los porcentajes de comportamiento **NO se escriben a mano**. Se recalculan solos cada vez que entra una liquidación real (trigger de BD), con ventana de **183 días** y **muestra mínima (≥120 pedidos o ≥3 liquidaciones)**:

| Campo en `config_canales` | Qué aprende | De dónde |
|---|---|---|
| `pct_pedidos_promo_estim` | % de pedidos que llevan promo | cargo de promo de la liquidación ÷ fee unitario ÷ pedidos |
| `pct_pedidos_prime_estim` | % de pedidos de cliente prime | se despeja de la comisión efectiva entre el tramo normal y el prime |
| `pct_promo_subvencionada_estim` | % del bruto que nos comemos en descuentos | línea de promociones de la liquidación ÷ bruto |
| `pct_ads_estim` | % del bruto que se va en publicidad de plataforma | línea de ads / marketing ÷ bruto |

- Si la muestra no llega al mínimo, **no se toca nada** (una liquidación suelta no puede mover el canal).
- Cada ajuste queda registrado en `calcneto_calibracion_log` (valor anterior → valor nuevo, muestra, fecha).
- Recalibrado manual: `select fn_recalibrar_calcneto();`

**Ads y promo subvencionada se restan del neto a importe final** (no llevan IVA añadido). Comisiones y fees sí llevan IVA 21%.

---

## Etiqueta de fuente

Toda pantalla que muestre neto debe exponer la fuente devuelta por el resolver:
`real` · `mixto` · `estimado_calibrado` · `estimado`

Pantallas obligadas: **Panel, Vivo, Running, Margen, Break-even, Tesorería, Facturación, Revenue.**

## PROHIBIDO

- Crear otra función de neto.
- Hardcodear un % de comisión, de promo, de prime o de ads.
- Escribir a mano los campos `pct_*_estim` de `config_canales`: los gestiona `fn_recalibrar_calcneto()`.
- Usar `v_ratio_neto_canal` (media plana de 150 días, **sin recencia**) como fuente de verdad. Solo para inspección manual.
- Mostrar neto sin etiqueta de fuente.

---

## LEY-NETO v2 · Bruto real (no inflado) y `ratio_neto_real`

> El partner infla el PVP para que, tras la promo autofinanciada, quede su precio real.
> Ese precio real ES la facturación. El PVP inflado y las "ventas" crudas de la
> liquidación **no son bruto**. En Uber la comisión se paga sobre el precio real.

### Fuente de facturación por canal
- **Uber → Rushour (revenue).** · **Glovo → Rushour (revenue).**
- **Just Eat → Sinqro (importe vivo).** PROVISIONAL: sin verificar bueno/inflado.
- Ningún módulo coge la facturación de la liquidación ni del PVP inflado.

### Reglas v2
1. Bruto/facturación real = revenue Rushour (Uber/Glovo) / importe Sinqro (JE).
2. La promo autofinanciada **no** se resta al neto (ya está fuera del bruto real).
3. Neto = bruto_real − cargos_reales (comisión + tasas + ads). Comisión sobre bruto real.
4. Ratios de `config_canales` calibrados sobre **bruto_real** = `ventas_bruto −
   abs(promo_autofinanciada)`, y aplicados sobre bruto_real. Misma base para calibrar
   y aplicar.
5. Prohibido: PVP inflado o `ventas_bruto` crudo de liquidación como facturación.

### `ratio_neto_real` (nuevo)
- `config_canales.ratio_neto_real = sum(pago_neto) / sum(bruto_real)`, ventana 183 d,
  lo escribe **solo** `fn_recalibrar_calcneto()`.
- `netoResolver.ts`: neto estimado = facturación_real × `ratio_neto_real` (preferido
  sobre el ratio empírico). **Nunca** multiplicar facturación real por un ratio del
  bruto inflado.
- Denominador de todos los ratios (Uber/Glovo) pasa a bruto_real. Uber usa
  `promociones`; Glovo usa `otros_cargos` (promo asumida por partner).

### Asserts v2
- Ningún neto sale de dividir por bruto inflado.
- Ningún módulo usa `ventas_bruto` de liquidación como facturación.
- `ratio_neto_real` por canal nunca > 1 ni < 0.

### Estado (última calibración)
- **Uber Eats**: `ratio_neto_real ≈ 0,507` (50,7 %) · 98 liq / 946 pedidos. Antes,
  sobre bruto inflado, ~38,6 %.
- **Glovo**: pendiente de muestra (umbral 120 pedidos / 3 liq).
- **Just Eat**: PROVISIONAL (facturación Sinqro sin verificar).
