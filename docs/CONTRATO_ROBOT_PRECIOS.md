# CONTRATO · Robot de precios Mercadona + Alcampo (BLOQUE 6)

Reparto: **el scraper (Cody) solo descarga el precio.** Todo lo de la base de datos ya está hecho y probado en el ERP.

## Qué tiene que buscar el robot
Leer la vista `v_robot_precios_objetivo` (301 ingredientes activos: 200 Mercadona, 101 Alcampo).
Devuelve por fila: `iding`, `nombre`, `proveedor`, `formato`, `precio_actual`.
El proveedor sale del sufijo del nombre (`_MER` = Mercadona, `_ALC` = Alcampo).

## Qué tiene que llamar cuando tenga el precio
Una sola llamada por ingrediente:

```sql
select fn_ingesta_precio_super('ING348', 2.65);      -- iding, precio
-- opcional 3er argumento proveedor si se quiere forzar
```

La función ya hace sola: mete el precio en `precio1` y empuja `precio1→2→3` (histórico de los 3 últimos), actualiza `ultimo_precio`, guarda la serie completa en `precios_ingredientes`, refresca el precio activo del Escandallo y deja traza en `robot_log` (fuente `precios_super`). Si el precio no cambia, lo registra como "sin cambio" y no ensucia el histórico.

Devuelve `{ ok, iding, proveedor, precio, cambio }`. Si el iding no existe o el precio es inválido, devuelve `ok:false` y lo avisa en `robot_log`.

## Frecuencia
Semanal, **lunes 06:00** (los precios de súper no cambian a diario).

## Alimenta
Escandallo (precio activo del ingrediente) y Lista de la compra (elige por precio más barato).
