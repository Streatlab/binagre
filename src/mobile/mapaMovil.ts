import { NAR_S } from '@/styles/neobrutal'
/**
 * Mapa de navegación de la app móvil.
 * ESPEJO EXACTO del Sidebar de escritorio: mismas secciones, mismo orden,
 * mismas rutas, mismas etiquetas, mismos emojis, mismos perfiles y mismos
 * marcados PEND. Si algo se añade al sidebar, se añade aquí.
 */

export interface ItemMovil {
  path: string
  label: string
  emoji: string
  desc: string
  perfiles: string[]
  pendiente?: boolean
}
export interface SeccionMovil {
  key: string
  label: string
  emoji: string
  color: string
  texto: string
  perfiles: string[]
  items: ItemMovil[]
}

export const INK = '#0a0a0a'
export const CREMA = NAR_S
export const CREMA2 = '#F3D9A8'
export const BLANCO = '#FFFDF7'
export const AMA = '#FFC400'
export const GRANATE = '#B01D23'
export const VERDE = '#0FB86B'
export const ROJO = '#FF1E27'
export const NARANJA = '#FF6A1A'
export const AZUL = '#2D5BFF'
export const ROSA = '#FF2E63'
export const GRIS = '#484f66'

export const DIRECTOS: ItemMovil[] = [
  { path: '/', label: 'Panel', emoji: '📊', desc: 'Panel Global', perfiles: ['admin', 'cocina'] },
  { path: '/tareas', label: 'Tareas', emoji: '🔔', desc: 'Tareas pendientes', perfiles: ['admin'] },
]

export const SECCIONES: SeccionMovil[] = [
  {
    key: 'finanzas', label: 'Finanzas', emoji: '📈', color: VERDE, texto: BLANCO, perfiles: ['admin'],
    items: [
      { path: '/finanzas/papeleo?tab=bandeja', label: 'Papeleo', emoji: '📥', desc: 'Buzón y lectura de facturas', perfiles: ['admin'] },
      { path: '/finanzas/papeleo?tab=facturacion', label: 'Facturación', emoji: '🧾', desc: 'Facturas y conciliación', perfiles: ['admin'] },
      { path: '/finanzas/ventas-panel?tab=ventas', label: 'Ventas', emoji: '💰', desc: 'Por canal, marca y día', perfiles: ['admin'] },
      { path: '/finanzas/ventas-panel?tab=objetivos', label: 'Objetivos', emoji: '🎯', desc: 'Metas y progreso', perfiles: ['admin'] },
      { path: '/finanzas/rentabilidad?tab=equilibrio', label: 'Punto de Equilibrio', emoji: '⚖️', desc: 'Cuánto hay que vender', perfiles: ['admin'] },
      { path: '/finanzas/resultados?tab=running', label: 'Running', emoji: '📊', desc: 'Cuenta de resultados', perfiles: ['admin'] },
      { path: '/finanzas/tesoreria?tab=calendario', label: 'Pagos y Cobros', emoji: '💳', desc: 'Qué entra y qué sale', perfiles: ['admin'] },
      { path: '/finanzas/tesoreria?tab=reserva', label: 'Reservas', emoji: '🏦', desc: 'Colchón y provisiones', perfiles: ['admin'] },
      { path: '/finanzas/tesoreria?tab=escenarios', label: 'Escenarios Tesorería', emoji: '🔮', desc: 'Simulaciones de caja', perfiles: ['admin'] },
      { path: '/finanzas/tesoreria?tab=13semanas', label: 'Tesorería 13 Semanas', emoji: '📅', desc: 'Caja a 3 meses', perfiles: ['admin'] },
      { path: '/finanzas/tesoreria?tab=salud', label: 'Salud Financiera', emoji: '⚙️', desc: 'Colchón operativo', perfiles: ['admin'] },
      { path: '/finanzas/resultados?tab=estados', label: 'Estados Financieros', emoji: '📑', desc: 'Balance y P&G', perfiles: ['admin'] },
      { path: '/finanzas/rentabilidad?tab=marca-canal', label: 'Break-even Marca/Canal', emoji: '📐', desc: 'Rentabilidad por marca', perfiles: ['admin'] },
      { path: '/finanzas/resultados?tab=evolucion', label: 'Análisis Horiz./Vert.', emoji: '📉', desc: 'Comparativa de partidas', perfiles: ['admin'] },
      { path: '/finanzas/panel-alertas', label: 'Panel de Alertas', emoji: '🚨', desc: 'Avisos financieros', perfiles: ['admin'] },
      { path: '/finanzas/ventas-panel?tab=repeticion', label: 'Repetición Clientes', emoji: '🔁', desc: 'Clientes que vuelven', perfiles: ['admin'] },
      { path: '/finanzas/rentabilidad?tab=roi', label: 'ROI por Canal', emoji: '🏆', desc: 'Qué canal renta', perfiles: ['admin'] },
      { path: '/finanzas/ventas-panel?tab=ticket', label: 'Ticket Medio', emoji: '🎫', desc: 'Gasto por pedido', perfiles: ['admin'] },
      { path: '/finanzas/lineas-factura', label: 'Líneas de Factura', emoji: '🧩', desc: 'Detalle por artículo', perfiles: ['admin'], pendiente: true },
      { path: '/finanzas/rentabilidad?tab=franja', label: 'Rentab. por Franja', emoji: '🕐', desc: 'Comida vs cena', perfiles: ['admin'], pendiente: true },
      { path: '/finanzas/ventas-perdidas', label: 'Ventas Perdidas', emoji: '🕳️', desc: 'Pedidos que se fueron', perfiles: ['admin'], pendiente: true },
    ],
  },
  {
    key: 'cocina', label: 'Cocina', emoji: '🍳', color: AMA, texto: INK, perfiles: ['admin', 'cocina'],
    items: [
      { path: '/escandallo', label: 'Escandallo', emoji: '⚖️', desc: 'Coste de cada plato', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/lista-compra', label: 'Lista de Compra', emoji: '🛒', desc: 'Qué hay que pedir', perfiles: ['admin', 'cocina'] },
      { path: '/carta', label: 'Carta', emoji: '🍽️', desc: 'Platos y precios', perfiles: ['admin'] },
      { path: '/cocina/menu-engineering', label: 'Menú Engineering', emoji: '⚙️', desc: 'Estrellas y perros', perfiles: ['admin'] },
      { path: '/cocina/pareto-ingredientes', label: 'Pareto Ingredientes', emoji: '🥕', desc: 'Los que más pesan', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/recetario', label: 'Libro de Recetas', emoji: '📋', desc: 'Fichas técnicas', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/platos-maestros', label: 'Plato Maestro', emoji: '🍽️', desc: 'Catálogo, alias y fusiones', perfiles: ['admin'] },
      { path: '/cocina/produccion', label: 'Producción', emoji: '📋', desc: 'Qué se cocina', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/menu-familia', label: 'Menú Familia', emoji: '🥘', desc: 'Formato familiar', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/teorico-vs-real', label: 'Teórico vs Real', emoji: '🚦', desc: 'Consumo esperado', perfiles: ['admin'], pendiente: true },
      { path: '/cocina/alertas-precio', label: 'Alertas de Precio', emoji: '📈', desc: 'Subidas de proveedor', perfiles: ['admin'], pendiente: true },
      { path: '/cocina/produccion-prevista', label: 'Producción Prevista', emoji: '🔮', desc: 'Previsión de demanda', perfiles: ['admin', 'cocina'], pendiente: true },
    ],
  },
  {
    key: 'operaciones', label: 'Operaciones', emoji: '📋', color: NARANJA, texto: BLANCO, perfiles: ['admin'],
    items: [
      { path: '/ops/checklists', label: 'Checklists', emoji: '✅', desc: 'Apertura y cierre', perfiles: ['admin'] },
      { path: '/ops/tareas', label: 'Tareas', emoji: '📝', desc: 'Del equipo', perfiles: ['admin'] },
      { path: '/ops/manuales', label: 'Manuales', emoji: '📚', desc: 'Cómo se hace', perfiles: ['admin'] },
      { path: '/ops/reembolsos', label: 'Reclamaciones', emoji: '💸', desc: 'Dinero a recuperar', perfiles: ['admin'] },
      { path: '/ops/pulso', label: 'Pulso Cocina', emoji: '📡', desc: 'Cómo va el servicio', perfiles: ['admin'] },
      { path: '/analytics/demanda', label: 'Pulso Operativa', emoji: '⏱️', desc: 'Demanda por hora', perfiles: ['admin'] },
      { path: '/ops/temperaturas', label: 'Temperaturas', emoji: '🌡️', desc: 'Registro APPCC', perfiles: ['admin'] },
      { path: '/ops/bpm', label: 'BPM / Calidad', emoji: '✅', desc: 'Buenas prácticas', perfiles: ['admin'] },
      { path: '/ops/equipos', label: 'Libro Equipos', emoji: '🔧', desc: 'Maquinaria', perfiles: ['admin'] },
      { path: '/ops/danos', label: 'Daños Menaje', emoji: '🍽️', desc: 'Roturas', perfiles: ['admin'] },
      { path: '/ops/pedidos-menaje', label: 'Pedidos Menaje', emoji: '📦', desc: 'Envases y utensilios', perfiles: ['admin'] },
      { path: '/ops/bitacora', label: 'Bitácora', emoji: '🔔', desc: 'Incidencias del día', perfiles: ['admin'] },
      { path: '/ops/reuniones', label: 'Reuniones Equipo', emoji: '🤝', desc: 'Actas del equipo', perfiles: ['admin'] },
      { path: '/marcas', label: 'Marcas', emoji: '🏷️', desc: 'Marcas virtuales', perfiles: ['admin'] },
    ],
  },
  {
    key: 'stock', label: 'Stock & Compras', emoji: '🛒', color: AZUL, texto: BLANCO, perfiles: ['admin'],
    items: [
      { path: '/stock/inventario', label: 'Inventario', emoji: '📦', desc: 'Stock real', perfiles: ['admin'] },
      { path: '/stock/compras', label: 'Compras', emoji: '🛒', desc: 'Pedidos a proveedor', perfiles: ['admin'] },
      { path: '/stock/proveedores', label: 'Proveedores', emoji: '🏢', desc: 'Precios y contactos', perfiles: ['admin'] },
    ],
  },
  {
    key: 'informes', label: 'Informes', emoji: '📄', color: GRANATE, texto: BLANCO, perfiles: ['admin'],
    items: [
      { path: '/informes', label: 'Panel Informes', emoji: '📊', desc: 'Informes automáticos', perfiles: ['admin'] },
      { path: '/informes/destinatarios', label: 'Destinatarios', emoji: '👥', desc: 'Quién los recibe', perfiles: ['admin'] },
      { path: '/informes/historial', label: 'Historial envíos', emoji: '🕒', desc: 'Envíos hechos', perfiles: ['admin'] },
      { path: '/informes/configuracion', label: 'Configuración', emoji: '⚙️', desc: 'Cuándo se envían', perfiles: ['admin'] },
    ],
  },
  {
    key: 'equipo', label: 'Equipo', emoji: '👥', color: ROSA, texto: BLANCO, perfiles: ['admin'],
    items: [
      { path: '/equipo', label: 'Personas', emoji: '👥', desc: 'Fichas del equipo', perfiles: ['admin'] },
      { path: '/equipo/organigrama', label: 'Organigrama', emoji: '🏢', desc: 'Quién hace qué', perfiles: ['admin'] },
      { path: '/equipo/horarios', label: 'Horarios', emoji: '🗓️', desc: 'Turnos de la semana', perfiles: ['admin'] },
      { path: '/equipo/presencia', label: 'Presencia', emoji: '🕐', desc: 'Fichajes', perfiles: ['admin'] },
    ],
  },
  {
    key: 'mkt', label: 'MKT', emoji: '📣', color: '#1e2233', texto: BLANCO, perfiles: ['admin'],
    items: [
      { path: '/marketing/panel', label: 'Panel MKT', emoji: '📣', desc: 'Vista general', perfiles: ['admin'] },
      { path: '/marketing/plan', label: 'Campañas y Promos', emoji: '🗓️', desc: 'Qué está activo', perfiles: ['admin'] },
      { path: '/marketing/rendimiento-ads-promo', label: 'Rendimiento Ads y Promo', emoji: '📈', desc: 'Qué funciona', perfiles: ['admin'] },
      { path: '/clientes/resenas', label: 'Panel Reseñas', emoji: '⭐', desc: 'Qué dicen los clientes', perfiles: ['admin'] },
      { path: '/clientes/benchmark', label: 'Benchmark', emoji: '🎯', desc: 'Frente a la competencia', perfiles: ['admin'] },
      { path: '/clientes/playbook-tp', label: 'Playbook ThinkPaladar', emoji: '📘', desc: 'Tácticas de la agencia', perfiles: ['admin'] },
      { path: '/clientes/crm', label: 'CRM Streat Lab', emoji: '🛍️', desc: 'Base de clientes', perfiles: ['admin'] },
      { path: '/clientes/club', label: 'Club Fidelización', emoji: '🎖️', desc: 'Clientes que repiten', perfiles: ['admin'] },
    ],
  },
  {
    key: 'configuracion', label: 'Configuración', emoji: '🔧', color: GRIS, texto: BLANCO, perfiles: ['admin'],
    items: [
      { path: '/configuracion/compras/categorias', label: 'Catálogos · Compras', emoji: '🛒', desc: 'Categorías de compra', perfiles: ['admin'] },
      { path: '/configuracion/integraciones', label: 'Integraciones', emoji: '🔌', desc: 'Plataformas y robots', perfiles: ['admin'] },
      { path: '/configuracion/reglas', label: 'Reglas', emoji: '📐', desc: 'Leyes del ERP', perfiles: ['admin'] },
      { path: '/configuracion/bancos-y-cuentas', label: 'Bancos y Cuentas', emoji: '🏦', desc: 'Cuentas y extractos', perfiles: ['admin'] },
      { path: '/configuracion/usuarios', label: 'Usuarios', emoji: '👤', desc: 'Accesos', perfiles: ['admin'] },
      { path: '/configuracion/calendario', label: 'Calendario operativo', emoji: '📅', desc: 'Días operativos', perfiles: ['admin'] },
      { path: '/configuracion/aprendizajes', label: 'Aprendizajes ERP', emoji: '🧠', desc: 'Errores y reglas', perfiles: ['admin'] },
      { path: '/configuracion/calcneto-aprendizaje', label: 'Ajuste calcNeto', emoji: '⚖️', desc: 'Calibración del neto', perfiles: ['admin'] },
      { path: '/configuracion/mapeo-marcas', label: 'Mapeo de Marcas', emoji: '🏷️', desc: 'Marca por plataforma', perfiles: ['admin'], pendiente: true },
      { path: '/integraciones/sync-carta', label: 'Sync de Carta', emoji: '🔄', desc: 'Carta a plataformas', perfiles: ['admin'], pendiente: true },
    ],
  },
]

/** Mismo listado informativo que el sidebar. No son pantallas: no se puede entrar. */
export const PROXIMAMENTE: { label: string; emoji: string }[] = [
  { label: 'Revenue & Ticket', emoji: '🎫' },
  { label: 'Tesorería', emoji: '💳' },
  { label: 'BPM / Calidad', emoji: '✅' },
  { label: 'Almacén', emoji: '🏭' },
  { label: 'Stock Mínimo Alertas', emoji: '⚠️' },
  { label: 'POS', emoji: '🖥️' },
  { label: 'Fichas Empleados', emoji: '👤' },
  { label: 'Ventas por Hora', emoji: '🕐' },
  { label: 'Ranking Productos', emoji: '🏆' },
  { label: 'Alérgenos', emoji: '🥜' },
  { label: 'BI / Informes Avanzados', emoji: '📈' },
  { label: 'Control Mermas', emoji: '📉' },
  { label: 'Exportación a Gestoría', emoji: '📤' },
  { label: 'Inventario Tiempo Real', emoji: '📡' },
  { label: 'Planificación Turnos', emoji: '🗓️' },
]

export function tituloDeRuta(pathname: string): { seccion: string; titulo: string; color: string; texto: string } {
  if (pathname === '/') return { seccion: 'Streat Lab', titulo: 'Panel Global', color: AMA, texto: INK }
  if (pathname === '/tareas') return { seccion: 'Streat Lab', titulo: 'Tareas', color: AMA, texto: INK }
  for (const s of SECCIONES) {
    const hit = s.items.find(i => pathname === i.path || pathname.startsWith(i.path + '/'))
    if (hit) return { seccion: s.label, titulo: hit.label, color: s.color, texto: s.texto }
  }
  return { seccion: 'Streat Lab', titulo: 'ERP', color: AMA, texto: INK }
}

export function emojiDeRuta(pathname: string): string {
  for (const s of SECCIONES) {
    const hit = s.items.find(i => pathname === i.path || pathname.startsWith(i.path + '/'))
    if (hit) return hit.emoji
  }
  return '🚧'
}
