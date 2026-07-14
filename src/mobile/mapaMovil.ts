// Mapa de navegación de la app móvil.
// Mismo orden y mismos módulos que el sidebar de escritorio.

export interface ItemMovil { path: string; label: string; emoji: string; desc: string; pendiente?: boolean }
export interface SeccionMovil { key: string; label: string; emoji: string; color: string; texto: string; items: ItemMovil[] }

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
  { path: '/', label: 'Panel', emoji: '📊', desc: 'Resumen del día' },
  { path: '/tareas', label: 'Tareas', emoji: '🔔', desc: 'Pendientes y avisos' },
]

export const SECCIONES: SeccionMovil[] = [
  {
    key: 'finanzas', label: 'Finanzas', emoji: '📈', color: VERDE, texto: '#fff',
    items: [
      { path: '/finanzas/documentacion', label: 'Papeleo', emoji: '📥', desc: 'Buzón y lectura de facturas' },
      { path: '/facturacion', label: 'Facturación', emoji: '🧾', desc: 'Facturas y conciliación' },
      { path: '/finanzas/ventas', label: 'Ventas', emoji: '💰', desc: 'Por canal, marca y día' },
      { path: '/finanzas/objetivos', label: 'Objetivos', emoji: '🎯', desc: 'Metas y progreso' },
      { path: '/finanzas/punto-equilibrio', label: 'Punto de Equilibrio', emoji: '⚖️', desc: 'Cuánto hay que vender' },
      { path: '/finanzas/running', label: 'Running', emoji: '📊', desc: 'Cuenta de resultados' },
      { path: '/finanzas/pagos-cobros', label: 'Pagos y Cobros', emoji: '💳', desc: 'Qué entra y qué sale' },
      { path: '/finanzas/verifactu', label: 'Verifactu', emoji: '✅', desc: 'Facturas emitidas' },
      { path: '/finanzas/escenarios-tesoreria', label: 'Escenarios', emoji: '🔮', desc: 'Simulaciones de caja' },
      { path: '/finanzas/tesoreria-13-semanas', label: 'Tesorería 13 sem.', emoji: '📅', desc: 'Caja a 3 meses' },
      { path: '/finanzas/fondo-maniobra', label: 'Fondo de Maniobra', emoji: '⚙️', desc: 'Colchón operativo' },
      { path: '/finanzas/estados-financieros', label: 'Estados Financieros', emoji: '📑', desc: 'Balance y P&G' },
      { path: '/finanzas/break-even', label: 'Break-even', emoji: '📐', desc: 'Por marca y canal' },
      { path: '/finanzas/analisis-horizontal-vertical', label: 'Análisis', emoji: '📉', desc: 'Horizontal y vertical' },
      { path: '/finanzas/panel-alertas', label: 'Alertas', emoji: '🚨', desc: 'Avisos financieros' },
      { path: '/finanzas/repeticion-clientes', label: 'Repetición', emoji: '🔁', desc: 'Clientes que vuelven' },
      { path: '/finanzas/roi-canal', label: 'ROI por Canal', emoji: '🏆', desc: 'Qué canal renta' },
      { path: '/finanzas/ticket-medio', label: 'Ticket Medio', emoji: '🎫', desc: 'Gasto por pedido' },
      { path: '/finanzas/lineas-factura', label: 'Líneas de Factura', emoji: '🧩', desc: 'Detalle por artículo', pendiente: true },
      { path: '/finanzas/rentabilidad-franja', label: 'Rentab. por Franja', emoji: '🕐', desc: 'Comida vs cena', pendiente: true },
      { path: '/finanzas/ventas-perdidas', label: 'Ventas Perdidas', emoji: '🕳️', desc: 'Pedidos que se fueron', pendiente: true },
    ],
  },
  {
    key: 'cocina', label: 'Cocina', emoji: '🍳', color: AMA, texto: INK,
    items: [
      { path: '/escandallo', label: 'Escandallo', emoji: '⚖️', desc: 'Coste de cada plato' },
      { path: '/cocina/lista-compra', label: 'Lista de Compra', emoji: '🛒', desc: 'Qué hay que pedir' },
      { path: '/carta', label: 'Carta', emoji: '🍽️', desc: 'Platos y precios' },
      { path: '/cocina/menu-engineering', label: 'Menú Engineering', emoji: '⚙️', desc: 'Estrellas y perros' },
      { path: '/cocina/pareto-ingredientes', label: 'Pareto', emoji: '🥕', desc: 'Ingredientes que más pesan' },
      { path: '/cocina/recetario', label: 'Recetario', emoji: '📋', desc: 'Fichas técnicas' },
      { path: '/cocina/produccion', label: 'Producción', emoji: '🍲', desc: 'Qué se cocina hoy' },
      { path: '/cocina/menu-familia', label: 'Menú Familia', emoji: '🥘', desc: 'Formato familiar' },
      { path: '/cocina/mapeo-platos', label: 'Mapeo Plato→Receta', emoji: '🔗', desc: 'Enlazar carta y receta', pendiente: true },
      { path: '/cocina/duplicados-platos', label: 'Platos Duplicados', emoji: '👯', desc: 'Nombres repetidos', pendiente: true },
      { path: '/cocina/teorico-vs-real', label: 'Teórico vs Real', emoji: '🚦', desc: 'Consumo esperado', pendiente: true },
      { path: '/cocina/alertas-precio', label: 'Alertas de Precio', emoji: '📈', desc: 'Subidas de proveedor', pendiente: true },
      { path: '/cocina/produccion-prevista', label: 'Producción Prevista', emoji: '🔮', desc: 'Previsión de demanda', pendiente: true },
    ],
  },
  {
    key: 'operaciones', label: 'Operac.', emoji: '📋', color: NARANJA, texto: '#fff',
    items: [
      { path: '/ops/checklists', label: 'Checklists', emoji: '✅', desc: 'Apertura y cierre' },
      { path: '/ops/tareas', label: 'Tareas', emoji: '📝', desc: 'Del equipo' },
      { path: '/ops/manuales', label: 'Manuales', emoji: '📚', desc: 'Cómo se hace' },
      { path: '/ops/reembolsos', label: 'Reclamaciones', emoji: '💸', desc: 'Dinero a recuperar' },
      { path: '/ops/pulso', label: 'Pulso Cocina', emoji: '📡', desc: 'Cómo va el servicio' },
      { path: '/analytics/demanda', label: 'Pulso Operativa', emoji: '⏱️', desc: 'Demanda por hora' },
      { path: '/ops/temperaturas', label: 'Temperaturas', emoji: '🌡️', desc: 'Registro APPCC' },
      { path: '/ops/bpm', label: 'BPM / Calidad', emoji: '🧼', desc: 'Buenas prácticas' },
      { path: '/ops/equipos', label: 'Libro Equipos', emoji: '🔧', desc: 'Maquinaria' },
      { path: '/ops/danos', label: 'Daños Menaje', emoji: '🍽️', desc: 'Roturas' },
      { path: '/ops/pedidos-menaje', label: 'Pedidos Menaje', emoji: '📦', desc: 'Envases y utensilios' },
      { path: '/ops/bitacora', label: 'Bitácora', emoji: '🔔', desc: 'Incidencias del día' },
      { path: '/ops/reuniones', label: 'Reuniones', emoji: '🤝', desc: 'Actas del equipo' },
      { path: '/marcas', label: 'Marcas', emoji: '🏷️', desc: 'Marcas virtuales' },
    ],
  },
  {
    key: 'stock', label: 'Stock', emoji: '🛒', color: AZUL, texto: '#fff',
    items: [
      { path: '/stock/inventario', label: 'Inventario', emoji: '📦', desc: 'Stock real' },
      { path: '/stock/compras', label: 'Compras', emoji: '🛒', desc: 'Pedidos a proveedor' },
      { path: '/stock/proveedores', label: 'Proveedores', emoji: '🏢', desc: 'Precios y contactos' },
    ],
  },
  {
    key: 'informes', label: 'Informes', emoji: '📄', color: GRANATE, texto: '#fff',
    items: [
      { path: '/informes', label: 'Panel Informes', emoji: '📊', desc: 'Informes automáticos' },
      { path: '/informes/destinatarios', label: 'Destinatarios', emoji: '👥', desc: 'Quién los recibe' },
      { path: '/informes/historial', label: 'Historial', emoji: '🕒', desc: 'Envíos hechos' },
      { path: '/informes/configuracion', label: 'Configuración', emoji: '⚙️', desc: 'Cuándo se envían' },
    ],
  },
  {
    key: 'equipo', label: 'Equipo', emoji: '👥', color: ROSA, texto: '#fff',
    items: [
      { path: '/equipo', label: 'Personas', emoji: '👥', desc: 'Fichas del equipo' },
      { path: '/equipo/organigrama', label: 'Organigrama', emoji: '🏢', desc: 'Quién hace qué' },
      { path: '/equipo/horarios', label: 'Horarios', emoji: '🗓️', desc: 'Turnos de la semana' },
      { path: '/equipo/presencia', label: 'Presencia', emoji: '🕐', desc: 'Fichajes' },
    ],
  },
  {
    key: 'mkt', label: 'MKT', emoji: '📣', color: '#1e2233', texto: '#fff',
    items: [
      { path: '/marketing/panel', label: 'Panel MKT', emoji: '📣', desc: 'Vista general' },
      { path: '/marketing/plan', label: 'Campañas y Promos', emoji: '🗓️', desc: 'Qué está activo' },
      { path: '/marketing/rendimiento-ads-promo', label: 'Rendimiento', emoji: '📈', desc: 'Ads y promociones' },
      { path: '/clientes/resenas', label: 'Reseñas', emoji: '⭐', desc: 'Qué dicen los clientes' },
      { path: '/clientes/benchmark', label: 'Benchmark', emoji: '🎯', desc: 'Frente a la competencia' },
      { path: '/clientes/playbook-tp', label: 'Playbook', emoji: '📘', desc: 'Tácticas ThinkPaladar' },
      { path: '/clientes/crm', label: 'CRM', emoji: '🛍️', desc: 'Base de clientes' },
      { path: '/clientes/club', label: 'Club Fidelización', emoji: '🎖️', desc: 'Clientes que repiten' },
    ],
  },
  {
    key: 'configuracion', label: 'Config', emoji: '🔧', color: GRIS, texto: '#fff',
    items: [
      { path: '/configuracion/compras/categorias', label: 'Catálogos', emoji: '🛒', desc: 'Categorías de compra' },
      { path: '/configuracion/integraciones', label: 'Integraciones', emoji: '🔌', desc: 'Plataformas y robots' },
      { path: '/configuracion/reglas', label: 'Reglas', emoji: '📐', desc: 'Leyes del ERP' },
      { path: '/configuracion/bancos-y-cuentas', label: 'Bancos', emoji: '🏦', desc: 'Cuentas y extractos' },
      { path: '/configuracion/usuarios', label: 'Usuarios', emoji: '👤', desc: 'Accesos' },
      { path: '/configuracion/calendario', label: 'Calendario', emoji: '📅', desc: 'Días operativos' },
      { path: '/configuracion/aprendizajes', label: 'Aprendizajes', emoji: '🧠', desc: 'Errores y reglas' },
      { path: '/configuracion/calcneto-aprendizaje', label: 'Ajuste calcNeto', emoji: '⚖️', desc: 'Calibración de neto' },
      { path: '/configuracion/mapeo-marcas', label: 'Mapeo de Marcas', emoji: '🏷️', desc: 'Marca por plataforma', pendiente: true },
      { path: '/integraciones/sync-carta', label: 'Sync de Carta', emoji: '🔄', desc: 'Carta a plataformas', pendiente: true },
    ],
  },
]

export function tituloDeRuta(pathname: string): { seccion: string; titulo: string; color: string; texto: string } {
  if (pathname === '/') return { seccion: 'Streat Lab · Hoy', titulo: 'Panel', color: AMA, texto: INK }
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
