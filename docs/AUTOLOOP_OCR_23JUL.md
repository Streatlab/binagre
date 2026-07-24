# AUTOLOOP 23-jul-2026 · Sistema documental completo (OCR + Bandeja + Cartero + Conciliación)

Protocolo: AUTOLOOP v1. Cero pushes hasta el final (orden expresa de Rubén: ni siquiera `trabajo`).
Commits locales en rama `claude/localizar-autoloop-gyrljz` (base = origin/trabajo tras merge PR#33).

## CRITERIOS OBJETIVOS DE "HECHO"
1. UN solo botón de subida "Documentación" en la Bandeja; el clasificador enruta solo. Los 4 botones antiguos desaparecen de la UI (la lógica interna se reutiliza).
2. El cartero (auto y forzado) usa EXACTAMENTE el mismo enrutador que el botón: lo no clasificado/no parseado va al cajón de sastre, nunca se pierde ni se silencia.
3. Existe el CAJÓN DE SASTRE: tabla en BD + sección en Bandeja donde Rubén ve cada documento con su motivo, puede DESCARTAR o REENVIAR a un módulo (facturas, extractos, ventas, equipo). Reprocesar funciona.
4. Toast/progreso estilo Cantera Alegre: datos reales, persiste ~20 s tras terminar, al cambiar de módulo se minimiza a reloj de arena, clic = panel con estado real (qué documento, a dónde fue, qué falló). Mensajes mínimos.
5. Subidas masivas superpersistentes: cola en BD porcionada; cerrar navegador/apagar equipo no pierde nada; otro dispositivo ve y continúa el progreso; lo bloqueado va al cajón y el lote sigue; al final se repesca el cajón automáticamente. SIN crons nuevos.
6. Enchufes verificados: cada tipo de documento alimenta TODOS los módulos donde es útil (mapa documentado); enchufes que faltaban, conectados.
7. Conciliación factura↔banco conforme a la LEY (importe exacto, alias canónico, ventana por tipo, candidato único); verificada con SQL real.
8. Gate verde: `npx tsc --no-emit` + `npm run build` limpios. Verificación externa con greps antes de dar nada por hecho.

## FASES
- [x] F0 · Checklist creado
- [x] F1 · Mapa del sistema actual (3 exploraciones paralelas + auditoría BD)
- [x] F2 · Cajón de sastre: equipo_docs_revision estado=descartado como cajón único; UI renombrada, botón Descartar (API action descartar), reenvío a Banco con selector de titular; extractos y repescas agotadas caen al cajón (trigger trg_manifiesto_error_a_cajon)
- [x] F3 · Enrutador único: botón DOCUMENTACIÓN (los 4 botones retirados de la UI; tuberías vivas para reenvíos); cartero (cron + fn_forzar_cartero + botón Correo) repuntado a /api/facturas?action=cartero = mismo motor; lo irreconocible del correo va al cajón, no a facturas basura; guarda anti-basura (imagen sin texto no gasta OCR de pago); detección de extracto por parsearBBVA
- [x] F4 · Superpersistencia: guarda-primero (Storage+equipo_manifiesto+huella) ya existente + tarea visible multi-dispositivo en papeleo_tareas (ProgresoGlobal la pinta en web y móvil); repesca 15min/3 intentos ya existente; agotada → cajón. SIN crons nuevos (solo se repuntó uno existente)
- [x] F5 · Toasts 20 s; ProgresoGlobal ya era Cantera Alegre con reloj de arena y BD → añadido refresco al pulsar, pastilla final 20 s, contador "Al cajón" y línea de último detalle real
- [x] F6 · Enchufes: Glovo liquidación → glovo_liquidaciones (LEY-GLOVO-01, upsert por nº factura); cuota autónomos → gastos_fijos (trigger, cat 2.21.1); rebarrido automático de conciliación al terminar lote (cartero y subida); nóminas→gastos_fijos ya existía (triggers 23-jul); errores mudos destapados (reglas PDF, liquidaciones de correo → avisos_papeleo)
- [x] F7 · Conciliación conforme LEY: fn_auto_match_movimiento reescrita (exacto + fn_prov_canon + ventana por proveedor + candidato único + blindada), fn_match_params tol 0, matching.ts backend/frontend tol 0. Verificado: 0 enlaces con importe desigual en BD
- [x] F8 · Gate verde (candado 5/12 functions, vitest, tsc -b, vite build) + verificación externa por greps y SQL + push único a rama de sesión

## DECISIONES
- D1: El push final único va a la rama de sesión `claude/localizar-autoloop-gyrljz` (no a `trabajo`, no a `master`): preserva el trabajo sin publicar. Rubén decide el merge.
- D2: Cambios de BD solo ADITIVOS (tablas/funciones nuevas, sin romper lo existente). Sin crons nuevos; la repesca se apoya en triggers + reanudación cliente + el cron condicional ya existente (no se crea ninguno).
- D3: El resumen mensual de Uber NO alimenta facturacion_diario: esa tabla es día×marca×canal y un mensual no tiene granularidad diaria — conectarlo inventaría datos. Sigue en ventas_plataforma, que es su sitio.
- D4: Cartero canónico = /api/facturas?action=cartero (comparte motor con los botones). La edge cartero-correo queda desplegada pero sin programación ni forzado (clasificaba solo factura/ventas y metía basura en facturas).
- D5: Extractos por botón único/correo → cajón con instrucción de reenvío a Banco eligiendo titular (el titular no se adivina; LEY: no inventar).
- D6: La clasificación de personal en subidas masivas va SIN pista de IA (solo marcadores deterministas): con 15.000-50.000 archivos la pista pagada por documento era inasumible; el reencaminado gratis cubre el resto. La pista sigue disponible en la cola de revisión.
- D7: pdf.js API/worker mismatch: ya estaba corregido en trabajo (rasterizado usa el mismo pdfjs de unpdf); verificado, sin acción.

## ⚠️ BLOQUEADOS
(vacío)

## NOTAS DE AUDITORÍA (F1/F7 en curso)
- Conciliación BD: `auto_match_factura` cumplía la LEY; `fn_auto_match_movimiento` NO (tolerancia 0,05 + ventana fija 60d + fn_norm_prov) → CORREGIDO por migración `ley_match_banco_a_factura_exacto` (exacto, fn_prov_canon, matching_config, candidato único, blindado contra abortos). `fn_match_params` tolerancia → 0. `trg_ley_match_01` ya bloqueaba enlaces inexactos (0 enlaces malos en BD, verificado).
- Cartero (`cartero-correo` v9): clasifica solo factura|ventas; default 'factura' para lo desconocido; no conoce equipo ni cajón. A reescribir en F3.
- Cola persistente ya existente: `ocr_sessions` + bucket ocr-uploads + `ocr-procesar-sesion` + ticks condicionales; equipo: `equipo_manifiesto` + repesca. Ventas: POST directo sin persistencia (agujero para F4).
- Frontend: 5 botones (Banco, Ventas, Facturas, Equipo, Correo). Bloque "Rechazados" embrionario del cajón (solo equipo, sin Descartar). ProgresoGlobal ya es Cantera Alegre con reloj de arena y BD (`papeleo_tareas`); toastStore autocierre 6 s (→20 s).
