# IMPRESIÓN · PROGRESO AUTOLOOP

> Checklist-memoria del sistema de impresión (docs/HANDOFF_IMPRESION_CODE.md).
> Casilla `[x]` SOLO con evidencia objetiva (grep / build verde / fila en BD).

## Estado: FASES 0–4 COMPLETADAS · auditoría final en curso

### Fase 0 · Base
- [x] Tablas `impresion_preferencias` + `impresion_envios` creadas en Supabase Binagre (migración `sistema_impresion_tablas`; copia en `supabase/migrations/005_sistema_impresion.sql`)
- [x] Semilla: 35 documentos insertados (verificado `select count(*)` = 35)
- [x] RPC `fn_secreto_brevo()` (Vault `brevo_api_key`; null si no existe)

### Fase 1 · Motor + Cocina
- [x] `api/_puertas/imprimir.ts` + rama `if (a === 'imprimir')` en puerta papeleo (sin archivo de función nuevo; `/api/papeleo/imprimir` lo captura el catch-all, no necesita rewrite)
- [x] `src/lib/impresionEnvio.ts` único llamador del endpoint (grep: solo él en src/ + el handler en api/)
- [x] `src/components/BotonImprimir.tsx` + `ModalImprimir.tsx` (Cantera, pantalla completa en móvil, resultado siempre visible)
- [x] Ajustes → Impresión (`src/pages/configuracion/ImpresionPage.tsx`) + ruta + navModel + card ConfiguracionHub + CommandPalette
- [x] 7 documentos cocina con PDF existente cableados (Produccion ×3, TabHojaInventario, Esquemas, ListaCompra, TabFichas receta+EP)
- [x] PDFs nuevos: Menú Familia, Menu Engineering (Boston 4 cuadrantes), Coste por plato

### Fase 2 · Equipo — COMPLETADA
- [x] 8 documentos: horarios_semana (TabEstaSemana + exportPDF.ts), fichajes_mes, calendario_laboral, incentivos_empleado, nomina_resumen, documentos_empleado, organigrama, permisos_vacaciones

### Fase 3 · Operaciones/APPCC — COMPLETADA
- [x] 8 documentos: checklist_apertura_cierre (reusa impresion.ts, excepción de ley), registro_temperaturas, registro_bpm, manual_operaciones, libro_equipos, acta_reunion, pedido_menaje, danos_menaje

### Fase 4 · Finanzas — COMPLETADA
- [x] 9 documentos: pg_mensual (Running), estados_financieros, tesoreria_13s, pagos_cobros, paquete_gestoria, factura_listado, punto_equilibrio, objetivos_categoria, informe_periodico

### Criterios sección 6 del handoff
- [x] 1. BotonImprimir + ModalImprimir existen y se exportan
- [x] 2. BotonImprimir importado en 33 archivos → cubre los 35 documentos (Produccion=3 docs, TabFichas=2, inventario en 2 pantallas)
- [x] 3. impresionEnvio.ts único llamador (grep `api.brevo.com|papeleo/imprimir` en src → 1 archivo)
- [x] 4. Migración aplicada + 35 filas semilla + impresion_envios creada
- [x] 5. Ruta de ajustes en App.tsx + navModel (sale también en PWA)
- [x] 6. Sin ruta nueva de 2+ segmentos → sin rewrite necesario
- [x] 7. `npx tsc -b` y `npm run build` VERDES (última pasada tras fase 4 + limpieza window.print)
- [x] 8. Funciones en api/ = 5 (≤12): equipo/diagnostico, informes, oauth/google, operaciones, papeleo
- [x] 9. Este documento actualizado
- [ ] 10. Envío e2e — **BLOQUEADO: no existe la API key de Brevo en ningún sitio accesible** (ni Vault, ni robot_credenciales, ni env). Ver decisión 1.

### Limpieza LEY_IMPRESION (auditoría)
- [x] `window.print()` eliminado de Menú Familia y Esquemas (quedaba DOM-print antiguo); ahora todo sale por BotonImprimir → PDF real
- [x] Barrido radios 1–99 en archivos tocados: 0
- [x] navModel ↔ rutas App.tsx: 0 items sin ruta

### AUDITORÍA 100% ERP + PWA (24-jul)
- [x] Smoke test Playwright real (build servido con vite preview, sesión admin): **40 rutas × 2 pieles (escritorio 1440px y PWA móvil táctil 390px) = 0 pantallas rotas, 0 errores JS graves**
- [x] Test de interacción: BotonImprimir abre ModalImprimir con las 2 salidas, preferencias y toggles (verificado con captura)
- [x] Robustez añadida: si la red se cuelga, el modal cae a preferencias por defecto a los 4s (nunca se queda en "Cargando…")
- [x] Revisión de código del diff completo (47 archivos): APROBADO; único hallazgo menor = insert de log sin manejo de error (no rompe nada)
- [x] Gate de color sobre todo src/: solo las excepciones ya documentadas en CANTERA_PROGRESO (arena #a3987f/#8a7f68, crema #fff8e7 sobre tinta, paleta gráfica running.ts, marca Google, piel móvil) — sin hex nuevos fuera de tabla
- [x] PWA: manifest + sw.js + icono presentes; Impresión sale sola en móvil vía navModel (fuente única)

## DECISIONES AUTÓNOMAS
1. **Brevo API key no está en el Vault** (verificado vault.secrets, robot_credenciales, funciones pg; los envíos del 23-jul se hicieron con la key pegada en chat vía pg_net). El handler la busca: `BREVO_API_KEY` env → `fn_secreto_brevo()` (Vault `brevo_api_key`) → `robot_credenciales` plataforma='brevo'. **Pendiente de Rubén: guardar la key en el Vault como `brevo_api_key`**; en cuanto exista, el envío al local funciona sin tocar código y la prueba e2e se puede repetir desde Ajustes → Impresión.
2. **Copias**: mismo PDF adjunto N veces (sufijo `-copia-N`); Epson Connect imprime cada adjunto.
3. **Área marco de los docs de operaciones**: 'cocina' (el marco BLINDADO solo tiene cocina/finanzas/equipo; no se amplía sin orden de Rubén).
4. **Rama**: la sesión trabaja y commitea en `claude/erp-pwa-audit-fix-555u6t` (rama del entorno). Ni `trabajo` ni `master` se tocan; ningún commit lleva `[deploy]` → con el ignoreCommand de vercel.json Vercel no lanza build. NADA publicado.
5. Decisiones por documento: ver informes de implementación en `.claude/plans/implementation-summary*.md` y comentarios en cada generador.
