# ESCANDALLO 2.0 — Fases A · C · D

Automatización del corazón económico. Rama `trabajo`.

## Fase A — Facturas → ingredientes/precios (automático)
- Pestaña **Auto** en Escandallo. Botón "Procesar 1 factura": baja el PDF de Drive, extrae líneas por visión, valida ±0,05€ y las cruza.
- Producto conocido → actualiza precio, recalcula escandallos en cadena, alerta si sube ≥8%.
- Producto nuevo → pre-crea ingrediente en borrador + tarea "Completar ingrediente".
- Solo facturas de materia prima (categorías 2.11/2.12). Ruta: `/api/papeleo/escandallo-auto/*`.

## Fase C — Inventario quincenal por foto
- Crear inventario → foto del conteo → IA lee → confirmar. PMP, inventario inicial/final, coste real del periodo.

## Fase D — Varianza y estructura real
- Consumo teórico (ventas × escandallo) vs real (inventario) en € por ingrediente.
- Coste de estructura desde el Running real (54,2% feb-abr), no manual.
- Tabla Recetas: margen de los 5 canales.

## Pendiente
- Prueba real (1 factura + 1 inventario).
- Fase B: links de cartas → pre-crear recetas.

_Deploy trigger._
