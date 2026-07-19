# ESCANDALLO 2.0 — Fases A · C · D

Automatización del corazón económico. Rama `trabajo`.

## Fase A — Facturas → ingredientes/precios (automático)
Pestaña **Auto** en Escandallo. "Procesar 1 factura": baja PDF de Drive, extrae líneas por visión, valida ±0,05€, cruza con diccionario. Producto conocido → actualiza precio + recalcula escandallos + alerta si sube ≥8%. Nuevo → pre-crea borrador + tarea. Solo materia prima (2.11/2.12). Ruta `/api/papeleo/escandallo-auto/:accion` (rewrite en vercel.json).

## Fase C — Inventario quincenal por foto
Crear → foto → IA lee → confirmar. PMP, inventario inicial/final, coste real del periodo.

## Fase D — Varianza y estructura real
Consumo teórico (ventas×escandallo) vs real (inventario) en €. Estructura desde Running real (54,2%). Tabla Recetas: margen de 5 canales.

## Requisitos entorno
Vercel Preview + Production: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Pendiente
Fase B: links de cartas → pre-crear recetas.

_Deploy trigger: recarga de variables OAuth en preview._
