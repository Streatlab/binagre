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

## ESCANDALLO 2.0 v2 — ingesta total automática (T1-T6)

**Formato/contenido de la línea (T1).** El prompt de visión de `extraer-lineas`
ahora también pide `formato`/`contenido_valor`/`contenido_unidad` (ej. "CEBOLLA
MALLA 2 KG" → Bolsa/Malla, 2, kg; null si no aparece escrito, nunca se inventa).
Columnas nuevas en `facturas_lineas`. Al pre-crear un ingrediente borrador,
`fn_procesar_linea_factura` ya rellena `formato/uds/ud_std/ud_min/precio_total/
eur_std/eur_min` cuando el contenido es conocido; si no, sigue quedando
pendiente para completar a mano (igual que antes).

**Precio normalizado e histórico (T2).** `precios_ingredientes` guarda también
`formato/contenido_valor/contenido_unidad/precio_por_ud_std` (vía
`fn_linea_a_inventario`). Si el proveedor cambia de envase manteniendo el
precio de etiqueta (ej. bolsa de 2kg a 1,8kg), el `precio_por_ud_std` lo
detecta y genera una `alertas_precio` con nota "cambio de formato". El
selector `media` de `fn_procesar_linea_factura` ahora calcula la media desde
el histórico normalizado (últimos 90 días), con fallback al promedio de
precio1-3 si no hay histórico normalizado todavía.

**Fusión multi-proveedor (T3).** Se reutiliza `producto_ingrediente_map` como
tabla de alias (ya tenía la forma correcta: proveedor+texto único →
ingrediente). Acción `fusionar-borrador` (RPC `fn_fusionar_borrador`, todo o
nada): traspasa alias, histórico de precios, alertas, líneas de factura,
movimientos/líneas de inventario, usos en EPS/recetas y stock; cierra la
tarea del borrador (`columna='hecho'`); borra el borrador. UI: cada borrador
tiene botón "Es el mismo que…" con buscador. `sugerir-fusiones` (RPC
`fn_sugerir_fusiones`, pg_trgm) SOLO propone pares por similitud de nombre —
nunca fusiona sola. Probado con datos reales: "Sal Marina Yodada" (borrador)
↔ "Sal marina yodada_ALC"/"_MER" sale con similitud 1.000.

**Robot completa borradores (T4).** Acción `completar-borradores` (Mercadona,
API JSON pública, sin navegador — corre en Vercel) rellena formato/contenido/
precio de borradores con proveedor Mercadona sin formato conocido, buscando
por `nombre_super`/`nombre` con el mismo algoritmo de coincidencia que el
robot semanal, y marca la tarea "completado por robot, revisar merma" (la
merma nunca la pone el robot). **DECISIÓN AUTÓNOMA:** Alcampo necesita
Playwright (no cabe en una función serverless de Vercel), así que su mitad
vive en el mismo job de GitHub Actions semanal ya existente
(`robot-precios-super.yml`, lunes 04:00 UTC) en vez de un cron pg_cron nuevo
domingo 05:00 Madrid — mismo resultado (barrido semanal automático), sin
duplicar infraestructura de navegador headless.

**Procesado desatendido (T5).** Acción `procesar-lote` (hasta 10 facturas por
invocación, corta limpio a los ~260s y devuelve cuántas hizo). Cron diario
pg_cron `escandallo_procesar_lote_diario` (03:30 UTC = 05:30 Madrid verano)
procesa hasta 10 pendientes/día. Cron semanal
`escandallo_completar_borradores_semanal` (domingo 03:00 UTC = 05:00 Madrid
verano) llama a `completar-borradores`. Ambos vía `net.http_get` a la API de
Vercel, mismo patrón que el resto de crons del proyecto. UI: botón "Procesar
todas (en tandas)" con contador y botón de parar.

**Seguridad de los cron endpoints:** `procesar-lote` y `completar-borradores`
aceptan POST sin restricción (para la pestaña Auto) y GET solo si coincide
`ESCANDALLO_CRON_SECRET` (env var opcional en Vercel) — si no está configurada,
no bloquean (igual que otros crons internos del proyecto). Recomendado fijarla
en Vercel para que nadie externo pueda disparar llamadas a Anthropic a coste
de Rubén.

**Verificación:** `npx tsc -b` y `npm run build` limpios, `check-api-limit`
en 5/10 funciones. Migraciones aplicadas y probadas en Supabase (transacciones
de prueba con rollback, sin tocar datos reales): borrador con formato/eur_std
correctos, selector `media` desde histórico normalizado, alerta de cambio de
formato, fusión completa (alias+histórico+stock+tarea), `sugerir-fusiones`
con casos reales de producción sin fusionar nada. Pendiente de esta sesión:
la rama de trabajo es `claude/escandallo-auto-ingesta-2tu34i` (asignada por
el entorno, no `trabajo` como decía el prompt original) — la prueba real de
"2 facturas vía API" contra Drive/Anthropic en producción y la verificación
de deployment READY quedan pendientes de que esta rama llegue a producción.
