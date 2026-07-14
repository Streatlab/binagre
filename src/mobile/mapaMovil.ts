// Mapa de navegación de la app móvil.
// Mismo orden y mismos módulos que el sidebar de escritorio.

export interface ItemMovil { path: string; label: string; emoji: string; pendiente?: boolean }
export interface SeccionMovil { key: string; label: string; emoji: string; color: string; texto: string; items: ItemMovil[] }

export const INK = '#0a0a0a'
export const CREMA = '#FCEFD6'
export const CREMA2 = '#F3D9A8'
export const BLANCO = '#ffffff'
export const AMA = '#FFC400'
export const GRANATE = '#B01D23'

// Accesos directos (sin submenú)
export const DIRECTOS: ItemMovil[] = [
  { path: '/', label: 'Panel', emoji: '📊' },
  { path: '/tareas', label: 'Tareas', emoji: '🔔' },
]

export const SECCIONES: SeccionMovil[] = [
  {
    key: 'finanzas', label: 'Finanzas', emoji: '📈', color: '#0FB86B', texto: '#fff',
    items: [
      { path: '/finanzas/documentacion', label: 'Papeleo', emoji: '📥' },
      { path: '/facturacion', label: 'Facturación', emoji: '🧾' },
      { path: '/finanzas/ventas', label: 'Ventas', emoji: '💰' },
      { path: '/finanzas/objetivos', label: 'Objetivos', emoji: '🎯' },
      { path: '/finanzas/punto-equilibrio', label: 'Punto de Equilibrio', emoji: '⚖️' },
      { path: '/finanzas/running', label: 'Running', emoji: '📊' },
      { path: '/finanzas/pagos-cobros', label: 'Pagos y Cobros', emoji: '💳' },
      { path: '/finanzas/verifactu', label: 'Verifactu', emoji: '✅' },
      { path: '/finanzas/escenarios-tesoreria', label: 'Escenarios Tesorería', emoji: '🔮' },
      { path: '/finanzas/tesoreria-13-semanas', label: 'Tesorería 13 Semanas', emoji: '📅' },
      { path: '/finanzas/fondo-maniobra', label: 'Fondo de Maniobra', emoji: '⚙️' },
      { path: '/finanzas/estados-financieros', label: 'Estados Financieros', emoji: '📑' },
      { path: '/finanzas/break-even', label: 'Break-even Marca/Canal', emoji: '📐' },
      { path: '/finanzas/analisis-horizontal-vertical', label: 'Análisis Horiz./Vert.', emoji: '📉' },
      { path: '/finanzas/panel-alertas', label: 'Panel de Alertas', emoji: '🚨' },
      { path: '/finanzas/repeticion-clientes', label: 'Repetición Clientes', emoji: '🔁' },
      { path: '/finanzas/roi-canal', label: 'ROI por Canal', emoji: '🏆' },
      { path: '/finanzas/ticket-medio', label: 'Ticket Medio', emoji: '🎫' },
      { path: '/finanzas/lineas-factura', label: 'Líneas de Factura', emoji: '🧩', pendiente: true },
      { path: '/finanzas/rentabilidad-franja', label: 'Rentab. por Franja', emoji: '🕐', pendiente: true },
      { path: '/finanzas/ventas-perdidas', label: 'Ventas Perdidas', emoji: '🕳️', pendiente: true },
    ],
  },
  {
    key: 'cocina', label: 'Cocina', emoji: '🍳', color: '#FFC400', texto: '#0a0a0a',
    items: [
      { path: '/escandallo', label: 'Escandallo', emoji: '⚖️' },
      { path: '/cocina/lista-compra', label: 'Lista de Compra', emoji: '🛒' },
      { path: '/carta', label: 'Carta', emoji: '🍽️' },
      { path: '/cocina/menu-engineering', label: 'Menú Engineering', emoji: '⚙️' },
      { path: '/cocina/pareto-ingredientes', label: 'Pareto Ingredientes', emoji: '🥕' },
      { path: '/cocina/recetario', label: 'Recetario', emoji: '📋' },
      { path: '/cocina/produccion', label: 'Producción', emoji: '📋' },
      { path: '/cocina/menu-familia', label: 'Menú Familia', emoji: '🥘' },
      { path: '/cocina/mapeo-platos', label: 'Mapeo Plato → Receta', emoji: '🔗', pendiente: true },
      { path: '/cocina/duplicados-platos', label: 'Platos Duplicados', emoji: '👯', pendiente: true },
      { path: '/cocina/teorico-vs-real', label: 'Teórico vs Real', emoji: '🚦', pendiente: true },
      { path: '/cocina/alertas-precio', label: 'Alertas de Precio', emoji: '📈', pendiente: true },
      { path: '/cocina/produccion-prevista', label: 'Producción Prevista', emoji: '🔮', pendiente: true },
    ],
  },
  {
    key: 'operaciones', label: 'Operac.', emoji: '📋', color: '#FF6A1A', texto: '#fff',
    items: [
      { path: '/ops/checklists', label: 'Checklists', emoji: '✅' },
      { path: '/ops/tareas', label: 'Tareas', emoji: '📝' },
      { path: '/ops/manuales', label: 'Manuales', emoji: '📚' },
      { path: '/ops/reembolsos', label: 'Reclamaciones', emoji: '💸' },
      { path: '/ops/pulso', label: 'Pulso Cocina', emoji: '📡' },
      { path: '/analytics/demanda', label: 'Pulso Operativa', emoji: '⏱️' },
      { path: '/ops/temperaturas', label: 'Temperaturas', emoji: '🌡️' },
      { path: '/ops/bpm', label: 'BPM / Calidad', emoji: '✅' },
      { path: '/ops/equipos', label: 'Libro Equipos', emoji: '🔧' },
      { path: '/ops/danos', label: 'Daños Menaje', emoji: '🍽️' },
      { path: '/ops/pedidos-menaje', label: 'Pedidos Menaje', emoji: '📦' },
      { path: '/ops/bitacora', label: 'Bitácora', emoji: '🔔' },
      { path: '/ops/reuniones', label: 'Reuniones Equipo', emoji: '🤝' },
      { path: '/marcas', label: 'Marcas', emoji: '🏷️' },
    ],
  },
  {
    key: 'stock', label: 'Stock', emoji: '🛒', color: '#2D5BFF', texto: '#fff',
    items: [
      { path: '/stock/inventario', label: 'Inventario', emoji: '📦' },
      { path: '/stock/compras', label: 'Compras', emoji: '🛒' },
      { path: '/stock/proveedores', label: 'Proveedores', emoji: '🏢' },
    ],
  },
  {
    key: 'informes', label: 'Informes', emoji: '📄', color: '#B01D23', texto: '#fff',
    items: [
      { path: '/informes', label: 'Panel Informes', emoji: '📊' },
      { path: '/informes/destinatarios', label: 'Destinatarios', emoji: '👥' },
      { path: '/informes/historial', label: 'Historial envíos', emoji: '🕒' },
      { path: '/informes/configuracion', label: 'Configuración', emoji: '⚙️' },
    ],
  },
  {
    key: 'equipo', label: 'Equipo', emoji: '👥', color: '#FF2E63', texto: '#fff',
    items: [
      { path: '/equipo', label: 'Personas', emoji: '👥' },
      { path: '/equipo/organigrama', label: 'Organigrama', emoji: '🏢' },
      { path: '/equipo/horarios', label: 'Horarios', emoji: '🗓️' },
      { path: '/equipo/presencia', label: 'Presencia', emoji: '🕐' },
    ],
  },
  {
    key: 'mkt', label: 'MKT', emoji: '📣', color: '#1e2233', texto: '#fff',
    items: [
      { path: '/marketing/panel', label: 'Panel MKT', emoji: '📣' },
      { path: '/marketing/plan', label: 'Campañas y Promos', emoji: '🗓️' },
      { path: '/marketing/rendimiento-ads-promo', label: 'Rendimiento Ads y Promo', emoji: '📈' },
      { path: '/clientes/resenas', label: 'Panel Reseñas', emoji: '⭐' },
      { path: '/clientes/benchmark', label: 'Benchmark', emoji: '🎯' },
      { path: '/clientes/playbook-tp', label: 'Playbook ThinkPaladar', emoji: '📘' },
      { path: '/clientes/crm', label: 'CRM Streat Lab', emoji: '🛍️' },
      { path: '/clientes/club', label: 'Club Fidelización', emoji: '🎖️' },
    ],
  },
  {
    key: 'configuracion', label: 'Config', emoji: '🔧', color: '#484f66', texto: '#fff',
    items: [
      { path: '/configuracion/compras/categorias', label: 'Catálogos · Compras', emoji: '🛒' },
      { path: '/configuracion/integraciones', label: 'Integraciones', emoji: '🔌' },
      { path: '/configuracion/reglas', label: 'Reglas', emoji: '📐' },
      { path: '/configuracion/bancos-y-cuentas', label: 'Bancos y Cuentas', emoji: '🏦' },
      { path: '/configuracion/usuarios', label: 'Usuarios', emoji: '👤' },
      { path: '/configuracion/calendario', label: 'Calendario operativo', emoji: '📅' },
      { path: '/configuracion/aprendizajes', label: 'Aprendizajes ERP', emoji: '🧠' },
      { path: '/configuracion/calcneto-aprendizaje', label: 'Ajuste calcNeto', emoji: '⚖️' },
      { path: '/configuracion/mapeo-marcas', label: 'Mapeo de Marcas', emoji: '🏷️', pendiente: true },
      { path: '/integraciones/sync-carta', label: 'Sync de Carta', emoji: '🔄', pendiente: true },
    ],
  },
]

// Título de cabecera a partir de la ruta activa
export function tituloDeRuta(pathname: string): { seccion: string; titulo: string; color: string; texto: string } {
  if (pathname === '/') return { seccion: 'Streat Lab · Hoy', titulo: 'Panel Global', color: AMA, texto: INK }
  if (pathname === '/tareas') return { seccion: 'Streat Lab', titulo: 'Tareas', color: AMA, texto: INK }
  for (const s of SECCIONES) {
    const hit = s.items.find(i => pathname === i.path || pathname.startsWith(i.path + '/'))
    if (hit) return { seccion: s.label, titulo: hit.label, color: s.color, texto: s.texto }
  }
  return { seccion: 'Streat Lab', titulo: 'ERP', color: AMA, texto: INK }
}
