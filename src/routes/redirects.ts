/**
 * Redirecciones de rutas viejas → destino vivo (reconciliación v5, punto 4/10).
 * Incluye MIS redirecciones (áreas nuevas) y las legacy de Finanzas que ya traía
 * master (módulos ?tab=). Ninguna ruta vieja acaba en 404 ni en doble redirección.
 * El test las recorre todas y verifica que App.tsx las implementa.
 */
export const REDIRECTS: [string, string][] = [
  // ── v5 · Ventas y Clientes ──
  ['analytics/margen', '/ventas/analitica'],
  ['analytics/ventas-marca', '/ventas/analitica/ventas-marca'],
  ['analytics/pareto-ventas', '/ventas/analitica/pareto'],
  ['analytics/revenue', '/ventas/analitica/revenue'],
  ['analytics/demanda', '/ventas/analitica/demanda'],
  ['clientes/crm', '/ventas/clientes'],
  ['clientes/club', '/ventas/clientes/club'],
  ['clientes/resenas', '/ventas/marketing/resenas'],
  ['clientes/benchmark', '/ventas/marketing/benchmark'],
  ['clientes/playbook-tp', '/ventas/marketing/playbook'],
  ['marketing/panel', '/ventas/marketing'],
  ['marketing/plan', '/ventas/marketing/campanas'],
  ['marketing/rendimiento-ads-promo', '/ventas/marketing/rendimiento'],
  // ── v5 · Cocina ──
  ['cocina/menu-familia', '/carta/menu-familia'],
  ['cocina/pareto-ingredientes', '/cocina/menu-engineering/pareto'],
  // ── v5 · Compras ──
  ['stock/inventario', '/compras/inventario'],
  ['stock/proveedores', '/compras/proveedores'],
  ['cocina/lista-compra', '/compras'],
  // ── v5 · Operaciones ──
  ['ops/checklists', '/ops/registro-diario'],
  ['ops/tareas', '/ops/registro-diario/tareas'],
  ['ops/temperaturas', '/ops/registro-diario/temperaturas'],
  ['ops/bitacora', '/ops/registro-diario/bitacora'],
  ['ops/pulso', '/ops/registro-diario/pulso'],
  ['ops/equipos', '/ops/mantenimiento'],
  ['ops/danos', '/ops/mantenimiento/danos'],
  ['ops/pedidos-menaje', '/ops/mantenimiento/pedidos-menaje'],
  ['ops/bpm', '/ops/calidad'],
  ['ops/manuales', '/ops/calidad/manuales'],
  // ── Legacy Finanzas → módulos ?tab= (heredado de master, sin 404) ──
  ['facturacion', '/finanzas/papeleo?tab=facturacion'],
  ['facturacion/conciliacion', '/finanzas/papeleo?tab=conciliacion'],
  ['finanzas/documentacion', '/finanzas/papeleo?tab=bandeja'],
  ['finanzas/gestion-facturas', '/finanzas/papeleo?tab=gestion'],
  ['finanzas/listado-facturas', '/finanzas/papeleo?tab=gestion'],
  ['finanzas/gestoria', '/finanzas/papeleo?tab=gestoria'],
  ['finanzas/importar-plataformas', '/finanzas/papeleo?tab=importar'],
  ['finanzas/ventas', '/finanzas/ventas-panel?tab=ventas'],
  ['finanzas/objetivos', '/finanzas/ventas-panel?tab=objetivos'],
  ['finanzas/ticket-medio', '/finanzas/ventas-panel?tab=ticket'],
  ['finanzas/repeticion-clientes', '/finanzas/ventas-panel?tab=repeticion'],
  ['finanzas/running', '/finanzas/resultados?tab=running'],
  ['finanzas/pyg', '/finanzas/resultados?tab=pyg'],
  ['finanzas/estados-financieros', '/finanzas/resultados?tab=estados'],
  ['finanzas/analisis-horizontal-vertical', '/finanzas/resultados?tab=evolucion'],
  ['finanzas/pagos-cobros', '/finanzas/tesoreria?tab=calendario'],
  ['finanzas/reservas', '/finanzas/tesoreria?tab=reserva'],
  ['finanzas/escenarios-tesoreria', '/finanzas/tesoreria?tab=escenarios'],
  ['finanzas/tesoreria-13-semanas', '/finanzas/tesoreria?tab=13semanas'],
  ['finanzas/fondo-maniobra', '/finanzas/tesoreria?tab=salud'],
  ['finanzas/punto-equilibrio', '/finanzas/rentabilidad?tab=equilibrio'],
  ['finanzas/break-even', '/finanzas/rentabilidad?tab=marca-canal'],
  ['finanzas/roi-canal', '/finanzas/rentabilidad?tab=roi'],
  ['finanzas/rentabilidad-franja', '/finanzas/rentabilidad?tab=franja'],
]
