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
- [ ] F1 · Mapa del sistema actual (botones, clasificadores, cartero, subidas, toasts, enchufes, conciliación)
- [ ] F2 · Cajón de sastre (BD + API + UI Bandeja)
- [ ] F3 · Enrutador único: botón Documentación + cartero comparten pipeline
- [ ] F4 · Superpersistencia de subidas (cola BD reanudable multi-dispositivo, sin cron)
- [ ] F5 · Toast/ProgresoGlobal Cantera Alegre (20 s, reloj de arena, clic-info)
- [ ] F6 · Auditoría y conexión de enchufes
- [ ] F7 · Conciliación bancaria conforme LEY (verificación + reparación)
- [ ] F8 · Gate verde + verificación externa + commits + push único final a rama de sesión

## DECISIONES
- D1: El push final único va a la rama de sesión `claude/localizar-autoloop-gyrljz` (no a `trabajo`, no a `master`): preserva el trabajo sin publicar. Rubén decide el merge.
- D2: Cambios de BD solo ADITIVOS (tablas/funciones nuevas, sin romper lo existente). Sin crons nuevos; la repesca se apoya en triggers + reanudación cliente + el cron condicional ya existente (no se crea ninguno).

## ⚠️ BLOQUEADOS
(vacío)

## NOTAS DE AUDITORÍA (F1/F7 en curso)
- Conciliación BD: `auto_match_factura` cumplía la LEY; `fn_auto_match_movimiento` NO (tolerancia 0,05 + ventana fija 60d + fn_norm_prov) → CORREGIDO por migración `ley_match_banco_a_factura_exacto` (exacto, fn_prov_canon, matching_config, candidato único, blindado contra abortos). `fn_match_params` tolerancia → 0. `trg_ley_match_01` ya bloqueaba enlaces inexactos (0 enlaces malos en BD, verificado).
- Cartero (`cartero-correo` v9): clasifica solo factura|ventas; default 'factura' para lo desconocido; no conoce equipo ni cajón. A reescribir en F3.
- Cola persistente ya existente: `ocr_sessions` + bucket ocr-uploads + `ocr-procesar-sesion` + ticks condicionales; equipo: `equipo_manifiesto` + repesca. Ventas: POST directo sin persistencia (agujero para F4).
- Frontend: 5 botones (Banco, Ventas, Facturas, Equipo, Correo). Bloque "Rechazados" embrionario del cajón (solo equipo, sin Descartar). ProgresoGlobal ya es Cantera Alegre con reloj de arena y BD (`papeleo_tareas`); toastStore autocierre 6 s (→20 s).
