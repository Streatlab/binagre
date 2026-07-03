# CLAUDE.md — ERP Binagre / Streat Lab

## Contexto mínimo
- ERP React/TypeScript/Vite. Supabase: eryauogxcpbgdryeimdq. Vercel: proyecto "binagre".
- El usuario NO es programador. Todo se ejecuta vía herramientas, nunca se le pide código, SQL ni prompts.

## Git y deploy (obligatorio)
1. TODO commit va a la rama `trabajo`. PROHIBIDO commitear a la rama principal.
2. Publicar a producción (merge) lo hace SOLO el usuario, nunca Claude.
3. Vercel cobra por build: agrupar todos los cambios de la sesión en 1 commit. Objetivo 1-3 commits/sesión.
4. Tras publicar el usuario, verificar estado en Vercel (1 sola verificación) y reportar READY o fallo.

## Verificación antes de commitear (obligatorio)
- Comprobar tipos y build localmente cuando haya entorno: `npx tsc --noEmit` y `npm run build`.
- Sin entorno local: revisar mentalmente imports, tipos y JSX del fragmento tocado antes del commit. Un build roto = build de Vercel desperdiciado.

## Comunicación (obligatorio)
1. Respuestas máx 3-4 líneas. Sin preámbulos, sin postambles, sin recapitulaciones.
2. Prohibido narrar: nunca "voy a", "déjame", "estoy revisando", ni anunciar herramientas.
3. Formato único: "Hecho: X" / "Resultado: X" / "Pendiente tuyo: X" / "Falla X. Alternativa: Y".
4. Cero código en chat. Cero nombres de archivos, funciones, tablas, hex, commits (salvo valor de negocio directo).
5. No pedir permisos ni confirmaciones: ejecutar. Preguntar SOLO ante bloqueo real (1 pregunta, 1 línea).
6. Si el usuario dice "silencio" o "corta": modo silencio total inmediato.

## Protocolo token-cero (obligatorio)
1. Lecturas quirúrgicas: solo la sección/función que se toca. NUNCA leer repo completo ni archivos enteros si basta un fragmento.
2. Ediciones dirigidas (reemplazos puntuales). Nunca reescribir archivos completos.
3. Un módulo por sesión. No tocar módulos no relacionados.
4. No releer módulos congelados (registro "frozen modules" en Notion).
5. Antes de explorar repo o Supabase: consultar el mapa de contexto cacheado en Notion "99 Claude".
6. Agrupar llamadas a herramientas en un solo turno cuando sea posible.
7. Al saturar contexto: volcar estado a Notion "99 Claude" antes de perder información.

## Mapa de módulos (orientarse SIN explorar el repo)
- Dashboard / Panel Global · Facturación · Conciliación · Bancos · Cobros · Pagos · Tesorería · Presupuestos · Remesas · Margen · Revenue · COGS · Menú Engineering · OCR · POS (tablero pedidos, venta directa, cierre caja, informes) · MKT Playbook Agencia.
- Estado congelado/activo de cada módulo: registro "frozen modules" en Notion. Consultar ahí, no deducir del código.
- Theming: variables CSS `--sl-*` en rama trabajo (migración casi completa; Ocr y Facturación aplazados con patrón distinto).
- Mantener este mapa actualizado al añadir/congelar módulos.

## Errores ya cometidos — PROHIBIDO repetir
1. Commitear a la rama principal (dispara build de producción).
2. Un deploy por microajuste.
3. Reintentar Tesseract en Vercel serverless con PDFs escaneados (timeout/0 chars): ir a bootstrap de pago (regla 3 bis).
4. Pasar por API de pago un NIF que ya tiene plantilla en reglas de conciliación (kill-switch por proveedor).
5. Categorizar facturas/movimientos sin información explícita del usuario.
6. Mezclar cualquier cosa de David/erp-david en este repo.
7. Inventar datos: solo datos reales o fuentes verificadas.

## Reglas de negocio críticas
1. Titular de factura por NIF: Rubén 21669051S · Emilio 53484832B. Sin detectar → SIN_TITULAR.
2. Ciclos de cobro plataformas: Uber Eats cada lunes (semana Lun-Dom anterior; si festivo, día siguiente). Glovo: 1-15 cobra el 5 del mes siguiente, 16-fin cobra el 20 del mes siguiente. Just Eat: 1-15 cobra el 20 del mismo mes, 16-fin cobra el 5 del siguiente. Venta directa: mismo día. Base del cálculo de Cobros pendientes en Conciliación.
3. Flujo de datos: usuario solo hace input (facturas drag-and-drop, facturación diaria manual, CSV plataformas). El sistema compila y es la única fuente de verdad. No re-preguntar este flujo.
4. OCR: procedimiento oficial en Notion "📌 OBLIGATORIO LEER · Flujo OCR + Conciliación" (regla 3 bis). Leerlo antes de tocar OCR.

## Definición de TERMINADO (checklist de cierre de sesión)
1. Todos los cambios en 1 commit a `trabajo`.
2. Notion 99 Claude actualizado (fixes con estado realista: ACTIVO/EN_CURSO/PARADO/RESUELTO, track BINAGRE-ERP).
3. Reporte final: "Hecho: X · Pendiente tuyo: Y" (Y = publicar merge si aplica).

## Aislamiento absoluto
- Este repo = Binagre / Streat Lab. JAMÁS mezclar con erp-david / David Reparte / davidparte: ni repos, ni Supabase, ni design tokens, ni lógica de negocio.
