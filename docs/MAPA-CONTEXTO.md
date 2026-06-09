# MAPA DE CONTEXTO — Binagre ERP

> Mapa cacheado del proyecto. Léelo antes de explorar el repo: evita redescubrir la estructura.
> Stack: React + TypeScript + Vite + Tailwind + Supabase + Vercel · Supabase `eryauogxcpbgdryeimdq`.
> Solo nombres, rutas y tablas. Sin código ni SQL.

## Estructura (2 niveles)

```
api/            funciones serverless Vercel (oauth, ocr, facturas, informes, conciliacion, importar, pe)
  _lib/         extractores, parsers, OCR, matching, supabase-admin, gmail/drive
src/
  pages/        páginas por módulo (analytics, clientes, cocina, configuracion, equipo,
                finanzas, informes, integraciones, ops, stock)
  components/   UI por dominio (conciliacion, escandallo, facturas, importador, inventario,
                ocr, panel, tareas, equipo, configuracion, ui, alerts)
  hooks/        hooks de datos (useConciliacion, useRunning, useSueldos, useConfig…)
  lib/          lógica negocio (escandallo, inventario, marcas, panel, pe, parsers, tareas,
                reclamaciones) + helpers (matching, csv, normalizar, supabase)
  utils/        formato, waterfall, fechas, festivos
  context(s)/   Auth, Titular, Config, Calendario, IVA, Theme
  styles/       tokens.ts, design-tokens.css
  types/  assets/
supabase/       migrations/ + functions/ (edge: ocr-*, generar-zip-gestoria)
docs/  scripts/  tests/  public/  data/
.claude/        reglas, plans, specs, agents, hooks (constitución del proyecto)
```

## Módulos

### Dashboard
- **Ruta**: `src/pages/Dashboard.tsx`
- **Archivos clave**: Dashboard.tsx, KpiCard.tsx, KpiCardGrande.tsx
- **Tablas Supabase**: facturacion_diario, marcas, objetivos, ventas_plataforma, tareas_pendientes
- **Estado**: ACTIVO

### Escandallo (Ingredientes · Mermas · EPS · Recetas · Fichas · Índice)
- **Ruta**: `src/pages/Escandallo.tsx` · `src/components/escandallo/`
- **Archivos clave**: Escandallo.tsx, ModalIngrediente.tsx, ModalMerma.tsx, ModalEPS.tsx, ModalReceta.tsx, TabFichas.tsx, TabEPS.tsx, TabRecetas.tsx, TabIndice.tsx, lib/escandallo/actualizarPreciosDesdeFactura.ts
- **Tablas Supabase**: ingredientes, mermas, eps, eps_lineas, recetas, recetas_lineas, fichas_tecnicas, precios_ingredientes, configuracion
- **Estado**: ACTIVO (núcleo waterfall/margen protegido por smoke tests)

### Carta
- **Ruta**: `src/pages/Carta.tsx`
- **Archivos clave**: Carta.tsx
- **Tablas Supabase**: carta_platos, recetas
- **Estado**: ACTIVO

### Facturación
- **Ruta**: `src/pages/Facturacion.tsx` (+ FacturacionMobile.tsx)
- **Archivos clave**: Facturacion.tsx, FacturacionMobile.tsx
- **Tablas Supabase**: facturacion_diario
- **Estado**: ACTIVO (formato € protegido por smoke tests)

### Conciliación
- **Ruta**: `src/pages/Conciliacion.tsx` · `src/components/conciliacion/`
- **Archivos clave**: Conciliacion.tsx, TabMovimientos.tsx, BandejaPropuestas.tsx, BandejaPendiente.tsx, CierreCuatroPiezas.tsx, ModalDetalleMovimiento.tsx, ResumenDashboard.tsx, PanelCobertura.tsx, hooks/useConciliacion.ts, lib/aplicarReglas.ts
- **Tablas Supabase**: conciliacion, gastos, reglas_conciliacion, categorias_contables_ingresos, categorias_contables_gastos, categorias_pyg, categorias_gastos, facturas, facturas_gastos, ventas_plataforma, serie_diaria_rushour, movimientos_descartados, titulares, v_kpi_cobertura_conciliacion
- **Estado**: ACTIVO

### OCR (Facturas + Extractos)
- **Ruta**: `src/pages/OcrConToast.tsx`, `src/pages/Ocr.tsx` · `src/components/ocr/` · `api/`
- **Archivos clave**: OcrConToast.tsx, Ocr.tsx, ModalDetalleFactura.tsx, OcrEditModal.tsx, ExtractosTabla.tsx, VentasTab.tsx, OcrCompletadoGlobal.tsx, lib/ocrUploadStore.ts, api/_lib/(mistral-ocr|ocr-tesseract|parserBBVA), supabase/functions/ocr-*
- **Tablas Supabase**: facturas, facturas_gastos, conciliacion, reglas_conciliacion, ocr_sessions, extractos_bancarios, facturas_origen_correo, cartero_correo_estado, v_estado_factura, uber_liquidaciones, glovo_liquidaciones, justeat_liquidaciones, categorias_pyg, titulares
- **Estado**: ACTIVO

### Importar Ventas / Plataformas
- **Ruta**: `src/pages/ImportarVentas.tsx`, `src/pages/finanzas/ImportarPlataformas.tsx` · `src/components/importador/`
- **Archivos clave**: ImportarVentas.tsx, ImportarPlataformas.tsx, TabSubir.tsx, TabSubirV2.tsx, TabResumenes.tsx, TabPendientes.tsx, TabHistorico.tsx, lib/importersPlataformas.ts, lib/parsers/*, lib/motorAcciones.ts
- **Tablas Supabase**: imports_plataformas, imports_log, ventas_plataforma, ventas_plataforma_marca_mensual, ventas_plato, resumen_plataformas, serie_diaria_rushour, metricas_clientes_glovo, estadisticas_prime_promo, facturacion_diario, marcas
- **Estado**: ACTIVO

### Finanzas
- **Ruta**: `src/pages/finanzas/` (+ PagosCobros.tsx)
- **Archivos clave**: Objetivos.tsx, Running.tsx, PuntoEquilibrio.tsx, GestionFacturas.tsx, PagosCobros.tsx, hooks/useRunning.ts, useRunningAnual.ts, usePropuestasCuadre.ts, useFacturasPendientes.ts, lib/pe/foodCostPonderado.ts · (PyG.tsx y Cashflow.tsx presentes pero SIN ruta — WIP)
- **Tablas Supabase**: objetivos, objetivos_dia_semana, facturacion_diario, running, v_running_mensual, conciliacion, gastos, categorias_pyg, categorias_rango, ingresos_mensuales, resumenes_plataforma_marca_mensual, pe_parametros, pedidos_plataforma, carta_platos, recetas, facturas, facturas_gastos, ventas_resumenes, titulares · (Cashflow WIP: categorias_gastos, festivos, ventas_plataforma, v_caja_mensual)
- **Estado**: ACTIVO

### Panel Global
- **Ruta**: `src/pages/PanelGlobal.tsx` · `src/components/panel/`
- **Archivos clave**: PanelGlobal.tsx, panel/resumen/TabResumen.tsx, CardSaldo.tsx, CardRatio.tsx, CardResultadoPeriodo.tsx, CardFacturasCorreo.tsx, CardSaludOcr.tsx, ColGruposGasto.tsx, ColFacturacionCanal.tsx, ColDiasPico.tsx, panel/evolucion/TabEvolucion.tsx, lib/panel/calcNetoPlataforma.ts
- **Tablas Supabase**: marcas, facturacion_diario, objetivos, objetivos_dia_semana, running, kpi_objetivos, cuentas_bancarias, gastos_fijos, gastos, resumenes_plataforma_marca_mensual, ingresos_mensuales, presupuestos_mensuales, provisiones, pedidos, pe_parametros, config_canales, marca_plataforma_acceso, facturas_origen_correo, cartero_correo_estado, v_estado_factura, v_salud_ocr
- **Estado**: ACTIVO

### Tareas
- **Ruta**: `src/pages/Tareas.tsx` · `src/components/tareas/`
- **Archivos clave**: Tareas.tsx, TabListaPendientes.tsx, TabConfigTareas.tsx, TabCalendario.tsx, lib/tareas/generarPendientes.ts
- **Tablas Supabase**: tareas_pendientes, tareas_periodicas
- **Estado**: ACTIVO

### Informes
- **Ruta**: `src/pages/informes/` · `api/informes/`
- **Archivos clave**: InformesPanel.tsx, Destinatarios.tsx, Historial.tsx, ConfiguracionInformes.tsx, api/informes/(cron|enviar|waha-status), api/_lib/informes-calculo.ts, informes-envio.ts
- **Tablas Supabase**: notif_config, notif_destinatarios, notif_envios
- **Estado**: ACTIVO

### Cocina (Recetario · Esquemas · Producción · Lista Compra · Menu Engineering)
- **Ruta**: `src/pages/cocina/` (+ CocinaRecetas.tsx, CocinaInventario.tsx)
- **Archivos clave**: Recetario.tsx, Esquemas.tsx, Produccion.tsx, ListaCompra.tsx, MenuEngineering.tsx, CocinaRecetas.tsx, CocinaInventario.tsx
- **Tablas Supabase**: esquemas_cocina, esquemas_gamas, produccion_secciones, produccion_partidas, produccion_entradas, listas_compra, recetas, recetas_lineas, ventas_plato, ingredientes, config_proveedores, eps_lineas
- **Estado**: ACTIVO

### Stock / Inventario
- **Ruta**: `src/pages/stock/Inventario.tsx` · `src/components/inventario/`
- **Archivos clave**: Inventario.tsx, TabConteos.tsx, TabMovimientos.tsx, lib/inventario/calcularMermas.ts, foodCostReal.ts
- **Tablas Supabase**: conteos_inventario, ingredientes, recetas_lineas, carta_platos, precios_ingredientes, facturacion_diario, configuracion
- **Estado**: ACTIVO

### Equipo / RRHH
- **Ruta**: `src/pages/equipo/` (+ Equipo.tsx) · `src/components/equipo/`
- **Archivos clave**: Equipo.tsx, FichasEmpleados.tsx, TabEmpleados.tsx, TabHorarios.tsx, TabNominas.tsx, TabPermisos.tsx, TabPortal.tsx, TabCalendarioLaboral.tsx, Horarios.tsx, equipo/horarios/*, ModalEmpleado.tsx, ModalSolicitud.tsx, utils/calendarioOperativoSync.ts
- **Tablas Supabase**: empleados, horarios, nominas, solicitudes_permisos, eventos_laborales, calendario_operativo
- **Estado**: ACTIVO (sub-páginas Dotacion, MisVentasMetas, Evaluaciones, etc. son maquetas sin BD)

### Configuración › Integraciones/Marcas
- **Ruta**: `src/pages/configuracion/marcas/`
- **Archivos clave**: MarcasPage.tsx, TabMarcas.tsx, TabCanales.tsx, TabDrive.tsx, TabAccesosUber.tsx, TabTiposCocina.tsx
- **Tablas Supabase**: marcas, marca_plataforma_acceso, marca_alias, tipos_cocina, config_canales, facturacion_diario
- **Estado**: ACTIVO

### Configuración › Reglas
- **Ruta**: `src/pages/configuracion/reglas/`
- **Archivos clave**: ReglasPage.tsx, TabReglasIngredientes.tsx, TabReglasConciliacion.tsx, TabOcrPlantillas.tsx, TabCorreoOcr.tsx, TabDiccionarioNif.tsx
- **Tablas Supabase**: reglas_ingredientes, reglas_conciliacion, reglas_correo_ocr, cartero_correo_estado, diccionario_nif_proveedor
- **Estado**: ACTIVO

### Configuración › Bancos y Cuentas
- **Ruta**: `src/pages/configuracion/bancos/` (+ CuentasBancarias.tsx, cuentas/CuentasPage.tsx)
- **Archivos clave**: BancosYCuentasPage.tsx, CuentasPanel.tsx, TabInformacion.tsx, TabConciliacion.tsx, CategoriasPanel.tsx, ReglasPanel.tsx, ReglasGlobalesPanel.tsx, PresupuestosPanel.tsx, ProvisionesPanel.tsx, TitularesPanel.tsx
- **Tablas Supabase**: cuentas_bancarias, categorias_pyg, categorias_contables_ingresos, categorias_contables_gastos, reglas_conciliacion, reglas_globales, presupuestos_mensuales, provisiones, titulares, conciliacion, configuracion, google_oauth_tokens
- **Estado**: ACTIVO

### Configuración › Compras
- **Ruta**: `src/pages/configuracion/compras/`
- **Archivos clave**: ComprasPage.tsx, TabCostes.tsx, TabProveedores.tsx, TabCategorias.tsx, TabUnidades.tsx, TabFormatos.tsx, TabEscandalloParams.tsx
- **Tablas Supabase**: configuracion, config_proveedores, config_formatos, formatos_compra, unidades_relacion, categorias_recetas, categorias_ingredientes_config, parametros_escandallo, canales
- **Estado**: ACTIVO

### Configuración › Usuarios / Categorías / Calendario
- **Ruta**: `src/pages/configuracion/{usuarios,categorias,calendario}/`
- **Archivos clave**: UsuariosPage.tsx, CategoriasPage.tsx, CalendarioPage.tsx, ModalTipoDia.tsx, ModalRangoBulk.tsx
- **Tablas Supabase**: usuarios, permisos_rol, empleados, categorias_maestras, calendario_operativo
- **Estado**: ACTIVO

### Login / Auth (global)
- **Ruta**: `src/pages/Login.tsx` · `src/context/AuthContext.tsx`
- **Archivos clave**: Login.tsx, AuthContext.tsx, contexts/TitularContext.tsx, contexts/ConfigContext.tsx
- **Tablas Supabase**: usuarios, sesiones_usuario, titulares, marcas, categorias_maestras, config_canales
- **Estado**: ACTIVO

### Ops (operaciones tienda)
- **Ruta**: `src/pages/ops/`
- **Archivos clave**: RecetasFichasTecnicas.tsx, ReclamacionReembolsos.tsx + lib/reclamaciones/useReclamaciones.ts · (resto: ControlTemperaturas, Checklists, BitacoraNovedades, LibroEquipos, DanosMenaje, PedidosMenaje, PulsoCocina, BpmCalidad, ReunionesEquipo, TareasOperativas → maquetas)
- **Tablas Supabase**: recetas, recetas_lineas, configuracion (RecetasFichasTecnicas), reclamaciones (ReclamacionReembolsos)
- **Estado**: PARCIAL — solo 2 páginas con BD, resto PLACEHOLDER

### Analytics
- **Ruta**: `src/pages/analytics/`
- **Archivos clave**: RevenueTicketMedio.tsx, CogsCosteMp.tsx, MargenCanal.tsx, VentasMarca.tsx, RankingProductos.tsx, PrediccionDemanda.tsx
- **Tablas Supabase**: TABLAS: revisar manualmente (páginas maqueta, aún sin queries)
- **Estado**: PLACEHOLDER

### Clientes
- **Ruta**: `src/pages/clientes/`
- **Archivos clave**: ClubFidelizacion.tsx, CrmTiendaPropia.tsx, PanelResenas.tsx
- **Tablas Supabase**: TABLAS: revisar manualmente (páginas maqueta, aún sin queries)
- **Estado**: PLACEHOLDER

### Integraciones / POS / Marketing
- **Ruta**: `src/pages/integraciones/PosVentas.tsx`, `src/pages/POS.tsx`, `src/pages/MarketingEmbudo.tsx`
- **Archivos clave**: PosVentas.tsx, POS.tsx, MarketingEmbudo.tsx, Placeholder.tsx
- **Tablas Supabase**: TABLAS: revisar manualmente (sin queries)
- **Estado**: PLACEHOLDER

## Tablas Supabase (global) → módulos que la usan

| Tabla | Módulos |
|---|---|
| facturacion_diario | Dashboard, Facturación, Conciliación, Importar, Finanzas, Panel, Cocina(indirecto), Stock, Config/Marcas |
| ventas_plataforma | Dashboard, Conciliación, Importar, Cocina(margen), Finanzas/Cashflow |
| ventas_plataforma_marca_mensual / resumenes_plataforma_marca_mensual | Importar, Finanzas (Running/PE), Panel |
| ventas_plato | Importar, Cocina (Menu Engineering) |
| resumen_plataformas / serie_diaria_rushour / metricas_clientes_glovo / estadisticas_prime_promo | Importar, Conciliación, OCR |
| uber_liquidaciones / glovo_liquidaciones / justeat_liquidaciones | OCR (VentasTab) |
| imports_plataformas / imports_log | Importar |
| objetivos / objetivos_dia_semana | Dashboard, Finanzas, Panel |
| running / v_running_mensual / kpi_objetivos | Finanzas (Running), Panel |
| ingresos_mensuales / presupuestos_mensuales / provisiones / gastos_fijos | Panel, Finanzas, Config/Bancos |
| gastos / categorias_gastos | Conciliación, Finanzas, Panel |
| conciliacion | Conciliación, OCR, Finanzas, Config/Bancos, Sueldos |
| reglas_conciliacion | Conciliación, OCR, Config (Reglas/Bancos) |
| reglas_globales / reglas_ingredientes | Config (Bancos/Reglas), Importar |
| categorias_pyg | Conciliación, OCR, Finanzas, Config/Bancos |
| categorias_contables_ingresos / categorias_contables_gastos | Conciliación, Config/Bancos |
| categorias_maestras / categorias_recetas / categorias_ingredientes_config | Config (Categorías/Compras), Login |
| categorias_rango | Finanzas (Running) |
| movimientos_descartados | Conciliación |
| facturas / facturas_gastos / facturas_origen_correo | OCR, Conciliación, Finanzas (Pagos/Gestión), Panel, Sidebar |
| ventas_resumenes | Finanzas (Gestión Facturas) |
| reclamaciones | Ops (Reembolsos) |
| ocr_sessions / extractos_bancarios | OCR |
| cartero_correo_estado / reglas_correo_ocr / diccionario_nif_proveedor | OCR, Config (Reglas), Panel |
| v_estado_factura / v_salud_ocr / v_caja_mensual / v_kpi_cobertura_conciliacion | OCR, Panel, Conciliación, Finanzas |
| ingredientes / precios_ingredientes | Escandallo, Cocina, Stock |
| mermas | Escandallo |
| eps / eps_lineas | Escandallo, Cocina |
| recetas / recetas_lineas | Escandallo, Carta, Cocina, Stock, Ops |
| fichas_tecnicas | Escandallo |
| carta_platos | Carta, Cocina, Stock, Finanzas (PE) |
| conteos_inventario | Stock |
| esquemas_cocina / esquemas_gamas | Cocina (Esquemas) |
| produccion_secciones / produccion_partidas / produccion_entradas | Cocina (Producción, Lista Compra) |
| listas_compra | Cocina (Lista Compra) |
| pedidos / pedidos_plataforma | Panel, Finanzas (PE) |
| pe_parametros / parametros_escandallo / canales | Finanzas (PE), Panel, Config/Compras |
| marcas / marca_plataforma_acceso / marca_alias / tipos_cocina | Dashboard, Config/Marcas, Importar, Panel, Login |
| config_canales / config_proveedores / config_formatos / formatos_compra / unidades_relacion | Config (Marcas/Compras), Login, Cocina |
| configuracion | Escandallo, Stock, Config/Compras, Config/Bancos |
| cuentas_bancarias / google_oauth_tokens | Config/Bancos, Panel |
| titulares | Login, Conciliación, OCR, Finanzas, Config |
| usuarios / sesiones_usuario / permisos_rol | Login, Config/Usuarios |
| empleados / horarios / nominas / solicitudes_permisos / eventos_laborales / calendario_operativo | Equipo, Config (Usuarios/Calendario) |
| tareas_pendientes / tareas_periodicas | Tareas, Dashboard, Sidebar |
| notif_config / notif_destinatarios / notif_envios | Informes |
| festivos | Finanzas/Cashflow (WIP) |
| matching_config / proveedor_alias / stopwords_concepto | Conciliación/OCR (matching) |

## Utilidades compartidas

| Helper | Ruta | Función |
|---|---|---|
| Formato números/euros | `src/utils/format.ts`, `src/lib/format.ts` | fmtEur, fmtNum/fmtNumES, fmtPct, fmtDate — **CONGELADO** (smoke test) |
| Waterfall márgenes | `src/utils/calcWaterfall.ts` | cálculo coste/margen por canal — **CONGELADO** (smoke test) |
| Cliente Supabase | `src/lib/supabase.ts`, `src/lib/supabasePaginated.ts` | conexión + paginación |
| Fechas / festivos | `src/utils/fechaLocal.ts`, `festivosMadrid.ts`, `src/lib/dateRange.ts` | rangos y festivos es-ES |
| Calendario operativo | `src/utils/calendarioOperativoSync.ts` | sync empleados/eventos ↔ calendario |
| Matching / normalización | `src/lib/matching.ts`, `matchProveedor.ts`, `normalizar.ts`, `normalizarConcepto.ts`, `wildcards.ts` | conciliación y proveedores |
| Categorización / reglas | `src/lib/aplicarReglas.ts`, `autoCategorizar.ts`, `categoriaMapping.ts`, `categoryMapping.ts`, `motorAcciones.ts` | reglas de gasto/ingreso |
| Importación | `src/lib/csv.ts`, `importersPlataformas.ts`, `parseUberResumen.ts`, `lib/parsers/*` | parsers de plataformas |
| UI / estado | `src/lib/toastStore.ts`, `useMultiSort.ts`, `lib/ocrUploadStore.ts` | toasts, orden, subida OCR |
| Contextos | `src/context/AuthContext.tsx`, `src/contexts/{Titular,Config,Calendario,IVA,Theme}Context.tsx` | estado global |
| Design tokens | `src/styles/tokens.ts`, `src/styles/design-tokens.css` | colores canónicos (única fuente de hex) |

---
_Generado en modo solo lectura. Si una tabla cambia de nombre, actualizar este mapa antes de explorar de nuevo._
