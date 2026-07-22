/**
 * Redirecciones de rutas viejas → nueva pestaña (Bloque D · cierre punto 10).
 * Fuente ÚNICA: App las renderiza desde aquí y el test las recorre todas.
 * Cada par [vieja, nueva]. La nueva SIEMPRE es absoluta y NO puede ser a su vez
 * una ruta vieja (sin cadenas de redirección).
 */
export const REDIRECTS: [string, string][] = [
  // ── Tanda 1 · Finanzas ──
  ['finanzas/pagos-cobros', '/finanzas/tesoreria/pagos-cobros'],
  ['finanzas/reservas', '/finanzas/tesoreria/reservas'],
  ['finanzas/fondo-maniobra', '/finanzas/tesoreria/fondo-maniobra'],
  ['finanzas/escenarios-tesoreria', '/finanzas/tesoreria/escenarios'],
  ['finanzas/tesoreria-13-semanas', '/finanzas/tesoreria/13-semanas'],
  ['finanzas/pyg', '/finanzas/estados-financieros/pyg'],
  ['finanzas/running', '/finanzas/estados-financieros/running'],
  ['finanzas/analisis-horizontal-vertical', '/finanzas/estados-financieros/analisis'],
  ['finanzas/punto-equilibrio', '/finanzas/objetivos/punto-equilibrio'],
  ['finanzas/break-even', '/finanzas/objetivos/break-even'],
  // ── Tanda 2 · Ventas y Clientes ──
  ['finanzas/ventas', '/ventas'],
  ['finanzas/ticket-medio', '/ventas/ticket-medio'],
  ['finanzas/roi-canal', '/ventas/roi-canal'],
  ['finanzas/rentabilidad-franja', '/ventas/rentabilidad-franja'],
  ['finanzas/repeticion-clientes', '/ventas/repeticion-clientes'],
  ['analytics/revenue', '/ventas/analitica/revenue'],
  ['analytics/margen', '/ventas/analitica'],
  ['analytics/ventas-marca', '/ventas/analitica/ventas-marca'],
  ['analytics/demanda', '/ventas/analitica/demanda'],
  ['analytics/pareto-ventas', '/ventas/analitica/pareto'],
  ['clientes/club', '/ventas/clientes/club'],
  ['clientes/crm', '/ventas/clientes'],
  ['clientes/resenas', '/ventas/marketing/resenas'],
  ['clientes/playbook-tp', '/ventas/marketing/playbook'],
  ['clientes/benchmark', '/ventas/marketing/benchmark'],
  ['marketing/panel', '/ventas/marketing'],
  ['marketing/plan', '/ventas/marketing/campanas'],
  ['marketing/rendimiento-ads-promo', '/ventas/marketing/rendimiento'],
  // ── Tanda 3 · Cocina ──
  ['cocina/menu-familia', '/carta/menu-familia'],
  ['cocina/pareto-ingredientes', '/cocina/menu-engineering/pareto'],
  // ── Tanda 4 · Compras ──
  ['stock/proveedores', '/compras/proveedores'],
  ['stock/inventario', '/compras/inventario'],
  ['cocina/lista-compra', '/compras'],
  // ── Tanda 5 · Operaciones ──
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
]
