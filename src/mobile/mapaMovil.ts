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
export const CREMA = '#FCEFD6'
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
    key: 'finanzas', label: 'Finanzas', emoji: '📈', color: VERDE, texto: '#fff', perfiles: ['admin'],
    items: [
      { path: '/finanzas/papeleo', label: 'Papeleo', emoji: '📥', desc: 'Buzón y facturas', perfiles: ['admin'] },
      { path: '/finanzas/tesoreria', label: 'Tesorería', emoji: '💳', desc: 'Caja, reserva y escenarios', perfiles: ['admin'] },
      { path: '/finanzas/resultados', label: 'Estados Financieros', emoji: '📑', desc: 'Running, P&G, evolución', perfiles: ['admin'] },
      { path: '/finanzas/rentabilidad', label: 'Rentabilidad', emoji: '📐', desc: 'Equilibrio, ROI, franja', perfiles: ['admin'] },
      { path: '/finanzas/panel-alertas', label: 'Panel de Alertas', emoji: '🚨', desc: 'Avisos financieros', perfiles: ['admin'] },
    ],
  },
  {
    key: 'ventas', label: 'Ventas y Clientes', emoji: '📈', color: ROSA, texto: '#fff', perfiles: ['admin'],
    items: [
      { path: '/finanzas/ventas-panel', label: 'Ventas', emoji: '💰', desc: 'Ventas, objetivos, ticket', perfiles: ['admin'] },
      { path: '/ventas/analitica', label: 'Analítica', emoji: '📊', desc: 'Margen, marca, pareto', perfiles: ['admin'] },
      { path: '/ventas/clientes', label: 'Clientes', emoji: '🛍️', desc: 'CRM y Club', perfiles: ['admin'] },
      { path: '/ventas/marketing', label: 'Marketing', emoji: '📣', desc: 'Campañas, reseñas, benchmark', perfiles: ['admin'] },
    ],
  },
  {
    key: 'cocina', label: 'Cocina', emoji: '🍳', color: AMA, texto: INK, perfiles: ['admin', 'cocina'],
    items: [
      { path: '/escandallo', label: 'Escandallo', emoji: '⚖️', desc: 'Coste de cada plato', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/recetario', label: 'Recetario', emoji: '📋', desc: 'Fichas técnicas', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/produccion', label: 'Producción', emoji: '📋', desc: 'Qué se cocina', perfiles: ['admin', 'cocina'] },
      { path: '/carta', label: 'Carta', emoji: '🍽️', desc: 'Carta y menú familia', perfiles: ['admin'] },
      { path: '/cocina/menu-engineering', label: 'Menú Engineering', emoji: '⚙️', desc: 'Estrellas, pareto', perfiles: ['admin'] },
    ],
  },
  {
    key: 'compras', label: 'Compras', emoji: '🛒', color: AZUL, texto: '#fff', perfiles: ['admin'],
    items: [
      { path: '/compras', label: 'Lista de Compra', emoji: '🛒', desc: 'Qué hay que pedir', perfiles: ['admin'] },
      { path: '/compras/inventario', label: 'Inventario', emoji: '📦', desc: 'Stock real', perfiles: ['admin'] },
      { path: '/compras/proveedores', label: 'Proveedores', emoji: '🏢', desc: 'Precios y contactos', perfiles: ['admin'] },
      { path: '/configuracion/compras/categorias', label: 'Catálogos·Compras', emoji: '📚', desc: 'Categorías de compra', perfiles: ['admin'] },
    ],
  },
  {
    key: 'operaciones', label: 'Operaciones', emoji: '📋', color: NARANJA, texto: '#fff', perfiles: ['admin'],
    items: [
      { path: '/ops/registro-diario', label: 'Registro diario', emoji: '✅', desc: 'Checklists, tareas, temp.', perfiles: ['admin'] },
      { path: '/ops/mantenimiento', label: 'Mantenimiento', emoji: '🔧', desc: 'Equipos, daños, pedidos', perfiles: ['admin'] },
      { path: '/ops/calidad', label: 'Calidad', emoji: '📚', desc: 'BPM y manuales', perfiles: ['admin'] },
      { path: '/ops/reembolsos', label: 'Reclamaciones', emoji: '💸', desc: 'Dinero a recuperar', perfiles: ['admin'] },
      { path: '/ops/reuniones', label: 'Reuniones Equipo', emoji: '🤝', desc: 'Actas del equipo', perfiles: ['admin'] },
      { path: '/marcas', label: 'Marcas', emoji: '🏷️', desc: 'Marcas virtuales', perfiles: ['admin'] },
      { path: '/equipo', label: 'Equipo', emoji: '👥', desc: 'Personas, horarios, portal', perfiles: ['admin'] },
    ],
  },
  {
    key: 'ajustes', label: 'Ajustes', emoji: '🔧', color: GRIS, texto: '#fff', perfiles: ['admin'],
    items: [
      { path: '/configuracion', label: 'Configuración', emoji: '⚙️', desc: 'Los 8 apartados', perfiles: ['admin'] },
      { path: '/informes', label: 'Informes', emoji: '📊', desc: 'Informes automáticos', perfiles: ['admin'] },
    ],
  },
]

/** Mismo listado informativo que el sidebar. No son pantallas: no se puede entrar. */
export const PROXIMAMENTE: { label: string; emoji: string }[] = []

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
