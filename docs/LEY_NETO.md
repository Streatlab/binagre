# LEY DEL NETO · REAL MANDA

> **Ley del ERP. No negociable. Si un módulo muestra "neto" y no pasa por aquí, está mal.**
> Código de regla: `LEY-NETO-01` (tabla `reglas_globales`, `bloqueante = true`).

## Fuente única

| Qué | Dónde |
|---|---|
| Resolver oficial | `src/lib/panel/netoResolver.ts` → `resolverNetoCanal()` / `resolverNeto()` |
| Fórmula base (comisión, promo, prime, cupones) | `src/lib/panel/calcNetoPlataforma.ts` → `calcNetoPorCanal()` |
| Config de canales | tabla `config_canales` |
| Liquidaciones reales | tabla `ventas_plataforma` |

**Ningún módulo calcula neto por su cuenta.** Se importa el resolver y punto.

## Jerarquía (en este orden, siempre)

1. **REAL MANDA** — Si hay liquidación real en `ventas_plataforma` cuyo periodo cae *dentro* del rango consultado, ese neto es la verdad para esa parte del bruto. La liquidación real **solo afecta a SU periodo**, nunca reescribe el resto.
2. **RATIO CALIBRADO CON RECENCIA** — El bruto no cubierto por liquidación se estima con el ratio neto/bruto empírico del canal:
   - Peso de cada liquidación = `pedidos × factorRecencia(antigüedad)`
   - `factorRecencia`: decaimiento exponencial, **vida media 75 días**, **piso 0.4** (el histórico antiguo nunca vale cero).
   - Solo se usa si hay **muestra fiable**: >=120 pedidos acumulados **o** >=3 liquidaciones del canal.
   - Efecto buscado: una semana rara con pocos pedidos **no** puede mover el canal.
3. **FÓRMULA TEÓRICA** — Sin muestra fiable, `calcNetoPorCanal()` con `config_canales` (comisión, promo subvencionada, prime, cupones, ads).

## Saneado obligatorio (anti-parser-sucio)

Una liquidación se descarta por completo (ni vale como real, ni calibra) si:
- `bruto <= 0` o `pedidos <= 0`
- ratio `neto/bruto` fuera de **[0.15 , 0.90]**

## Autoalimentación

Cada liquidación nueva que aterriza en `ventas_plataforma` invalida la caché por realtime y **recalibra el ratio del canal automáticamente**. No hay que tocar nada a mano.

## Etiqueta de fuente

Toda pantalla que muestre neto debe exponer la fuente devuelta por el resolver:
`real` · `mixto` · `estimado_calibrado` · `estimado`

Pantallas obligadas: **Panel, Vivo, Running, Margen, Break-even, Tesorería, Facturación, Revenue.**

## PROHIBIDO

- Crear otra función de neto.
- Hardcodear un % de comisión.
- Usar `v_ratio_neto_canal` (media plana de 150 días, **sin recencia**) como fuente de verdad. Solo vale para inspección manual.
- Mostrar neto sin etiqueta de fuente.
