import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSidebarState } from '@/hooks/useSidebarState'
import { useTheme } from '../contexts/ThemeContext'
import { NavIcon } from './NavIcon'

const ACCENT = '#e8f442'
const RED = '#B01D23'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  path: string
  label: string
  emoji: string
  perfiles: string[]
}

interface NavSection {
  key: string
  emoji: string
  label: string
  perfiles: string[]
  items: NavItem[]
}

// ─── Nav data ─────────────────────────────────────────────────────────────────

const PANEL_GLOBAL: NavItem = { path: '/', label: 'Panel Global', emoji: '🏠', perfiles: ['admin', 'cocina'] }

const SECTIONS: NavSection[] = [
  {
    key: 'finanzas', emoji: '📈', label: 'Finanzas', perfiles: ['admin'],
    items: [
      { path: '/facturacion',             label: 'Facturación',           emoji: '🗂️', perfiles: ['admin'] },
      { path: '/finanzas/objetivos',       label: 'Objetivos',             emoji: '🎯', perfiles: ['admin'] },
      { path: '/finanzas/analisis',        label: 'Análisis',              emoji: '🔍', perfiles: ['admin'] },
      { path: '/analytics/revenue',        label: 'Revenue & Ticket',      emoji: '🎫', perfiles: ['admin'] },
      { path: '/analytics/cogs',           label: 'COGS / Coste MP',       emoji: '🧾', perfiles: ['admin'] },
      { path: '/analytics/margen',         label: 'Margen por Canal',      emoji: '📊', perfiles: ['admin'] },
      { path: '/analytics/ventas-marca',   label: 'Ventas por Marca',      emoji: '🏷️', perfiles: ['admin'] },
      { path: '/analytics/ranking',        label: 'Ranking Productos',     emoji: '🏆', perfiles: ['admin'] },
      { path: '/analytics/demanda',        label: 'Predicción Demanda',    emoji: '🔮', perfiles: ['admin'] },
      { path: '/finanzas/tesoreria',       label: 'Tesorería',             emoji: '💳', perfiles: ['admin'] },
      { path: '/finanzas/cobros',          label: 'Cobros',                emoji: '💸', perfiles: ['admin'] },
      { path: '/finanzas/pagos',           label: 'Pagos',                 emoji: '💵', perfiles: ['admin'] },
      { path: '/finanzas/presupuestos',    label: 'Presupuestos',          emoji: '📋', perfiles: ['admin'] },
      { path: '/finanzas/remesas',         label: 'Remesas',               emoji: '🏦', perfiles: ['admin'] },
      { path: '/running',                  label: 'Running Financiero',    emoji: '📊', perfiles: ['admin'] },
    ],
  },
  {
    key: 'cocina', emoji: '🍳', label: 'Cocina', perfiles: ['admin', 'cocina'],
    items: [
      { path: '/escandallo', label: 'Escandallo',       emoji: '⚖️',  perfiles: ['admin', 'cocina'] },
      { path: '/escandallo', label: 'Ingredientes',     emoji: '🧂',  perfiles: ['admin', 'cocina'] },
      { path: '/escandallo', label: 'EPS',              emoji: '⚗️',  perfiles: ['admin', 'cocina'] },
      { path: '/escandallo', label: 'Recetas',          emoji: '📜',  perfiles: ['admin', 'cocina'] },
      { path: '/escandallo', label: 'Mermas',           emoji: '📉',  perfiles: ['admin', 'cocina'] },
      { path: '/escandallo', label: 'Índice',           emoji: '🗂️',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/recetas',  label: 'Fichas Técnicas', emoji: '📋',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/pulso',    label: 'Pulso Cocina',    emoji: '🔥',  perfiles: ['admin'] },
      { path: '/cocina/kds',   label: 'KDS Kitchen Display', emoji: '📟', perfiles: ['admin'] },
      { path: '/cocina/carta', label: 'Carta',           emoji: '🍽️',  perfiles: ['admin'] },
      { path: '/cocina/menu-engineering', label: 'Menu Engineering', emoji: '⚙️', perfiles: ['admin'] },
      { path: '/cocina/historico-recetas', label: 'Histórico Recetas', emoji: '🕰️', perfiles: ['admin', 'cocina'] },
    ],
  },
  {
    key: 'operaciones', emoji: '⚙️', label: 'Operaciones', perfiles: ['admin', 'cocina'],
    items: [
      { path: '/ops/checklists',      label: 'Checklists Apertura/Cierre', emoji: '✅',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/tareas',          label: 'Tareas Operativas',          emoji: '📝',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/temperaturas',    label: 'Control Temperaturas BPM',   emoji: '🌡️',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/bpm',             label: 'BPM / Calidad',              emoji: '✅',  perfiles: ['admin'] },
      { path: '/ops/danos',           label: 'Daños Material',             emoji: '🔧',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/pedidos-menaje',  label: 'Pedidos a Proveedores',      emoji: '🛒',  perfiles: ['admin', 'cocina'] },
      { path: '/operaciones/manuales', label: 'Manuales',                  emoji: '📚',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/bitacora',        label: 'Novedades',                  emoji: '🔔',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/equipos',         label: 'Mantenimiento Equipos',      emoji: '🔧',  perfiles: ['admin', 'cocina'] },
      { path: '/operaciones/organigrama', label: 'Organigrama',            emoji: '🏢',  perfiles: ['admin'] },
      { path: '/ops/bitacora',        label: 'Bitácora',                   emoji: '📖',  perfiles: ['admin', 'cocina'] },
      { path: '/operaciones/division', label: 'División Órgano Trabajo',   emoji: '🏭',  perfiles: ['admin'] },
    ],
  },
  {
    key: 'stock', emoji: '📦', label: 'Stock & Compras', perfiles: ['admin'],
    items: [
      { path: '/stock/inventario',        label: 'Inventario',            emoji: '🏪', perfiles: ['admin'] },
      { path: '/stock/almacen',           label: 'Almacén',               emoji: '🏭', perfiles: ['admin'] },
      { path: '/stock/minimo',            label: 'Stock Mínimo Alertas',  emoji: '⚠️', perfiles: ['admin'] },
      { path: '/stock/movimientos',       label: 'Movimientos Stock',     emoji: '🔄', perfiles: ['admin'] },
      { path: '/stock/compras',           label: 'Compras',               emoji: '🛒', perfiles: ['admin'] },
      { path: '/stock/proveedores',       label: 'Proveedores',           emoji: '🏢', perfiles: ['admin'] },
      { path: '/stock/pedidos-proveedor', label: 'Pedidos a Proveedor',   emoji: '📋', perfiles: ['admin'] },
      { path: '/stock/pedidos-articulos', label: 'Pedidos de Artículos',  emoji: '📦', perfiles: ['admin'] },
      { path: '/stock/albaranes',         label: 'Albaranes',             emoji: '📄', perfiles: ['admin'] },
    ],
  },
  {
    key: 'pos', emoji: '🚀', label: 'POS & Pedidos', perfiles: ['admin'],
    items: [
      { path: '/pos',              label: 'POS',             emoji: '🖥️', perfiles: ['admin'] },
      { path: '/pos/pedidos-curso', label: 'Pedidos en Curso', emoji: '⏳', perfiles: ['admin'] },
      { path: '/pos/produccion',   label: 'Producción',      emoji: '🏭', perfiles: ['admin'] },
    ],
  },
  {
    key: 'marcas', emoji: '🏷️', label: 'Marcas', perfiles: ['admin'],
    items: [
      { path: '/marcas',                  label: 'Marcas',             emoji: '🏷️', perfiles: ['admin'] },
      { path: '/marcas/ranking',          label: 'Ranking Marcas',     emoji: '📊', perfiles: ['admin'] },
      { path: '/marcas/ranking-canales',  label: 'Ranking Canales',    emoji: '📡', perfiles: ['admin'] },
      { path: '/integraciones/pos',       label: 'Integraciones',      emoji: '🔌', perfiles: ['admin'] },
    ],
  },
  {
    key: 'equipo', emoji: '👥', label: 'Equipo', perfiles: ['admin'],
    items: [
      { path: '/equipo/empleados',    label: 'Fichas Empleados',       emoji: '👤', perfiles: ['admin'] },
      { path: '/equipo/evaluaciones', label: 'Evaluaciones',           emoji: '⭐', perfiles: ['admin'] },
      { path: '/equipo/llamados',     label: 'Llamados Atención',      emoji: '⚠️', perfiles: ['admin'] },
      { path: '/equipo/antiguedad',   label: 'Beneficios Antigüedad',  emoji: '🎁', perfiles: ['admin'] },
      { path: '/equipo/celebraciones',label: 'Celebraciones',          emoji: '🎉', perfiles: ['admin'] },
      { path: '/equipo/onboarding',   label: 'Onboarding Digital',     emoji: '🚀', perfiles: ['admin'] },
      { path: '/equipo/metas',        label: 'Mis Ventas / Mis Metas', emoji: '🏅', perfiles: ['admin'] },
      { path: '/equipo/calendario',   label: 'Calendario',             emoji: '📅', perfiles: ['admin'] },
      { path: '/equipo/mensajeria',   label: 'Mensajería Interna',     emoji: '💬', perfiles: ['admin'] },
      { path: '/equipo/novedades',    label: 'Novedades Equipo',       emoji: '📢', perfiles: ['admin'] },
      { path: '/ops/reuniones',       label: 'Reuniones Equipo',       emoji: '🤝', perfiles: ['admin'] },
      { path: '/equipo/rrhh',         label: 'Recursos Humanos',       emoji: '👥', perfiles: ['admin'] },
      { path: '/equipo/projects',     label: 'Project Management',     emoji: '📊', perfiles: ['admin'] },
      { path: '/equipo/kanban',       label: 'Kanban',                 emoji: '📋', perfiles: ['admin'] },
      { path: '/equipo/servicio',     label: 'Servicio',               emoji: '🏆', perfiles: ['admin'] },
    ],
  },
  {
    key: 'clientes', emoji: '🤝', label: 'Clientes & CRM', perfiles: ['admin'],
    items: [
      { path: '/clientes/club',          label: 'Club Fidelización',           emoji: '🎖️', perfiles: ['admin'] },
      { path: '/clientes/crm',           label: 'CRM Tienda Propia',           emoji: '🛍️', perfiles: ['admin'] },
      { path: '/clientes/resenas',       label: 'Panel Reseñas',               emoji: '⭐', perfiles: ['admin'] },
      { path: '/clientes/quejas',        label: 'Quejas',                      emoji: '😡', perfiles: ['admin'] },
      { path: '/clientes',               label: 'Clientes',                    emoji: '👥', perfiles: ['admin'] },
      { path: '/clientes/ficha',         label: 'Ficha Cliente',               emoji: '👤', perfiles: ['admin'] },
      { path: '/clientes/whatsapp',      label: 'Envío WhatsApp desde Ficha',  emoji: '💬', perfiles: ['admin'] },
      { path: '/clientes/email',         label: 'Envío Email desde Ficha',     emoji: '📧', perfiles: ['admin'] },
      { path: '/clientes/articulos',     label: 'Artículos Consumidos',        emoji: '🍽️', perfiles: ['admin'] },
      { path: '/clientes/oportunidades', label: 'Oportunidades',               emoji: '💡', perfiles: ['admin'] },
      { path: '/clientes/embudo',        label: 'Oportunidades por Etapas',    emoji: '🔽', perfiles: ['admin'] },
      { path: '/clientes/oportunidades-gp', label: 'Oport. Ganadas vs Perdidas', emoji: '📊', perfiles: ['admin'] },
      { path: '/clientes/tipologia',     label: 'Oport. por Tipología',        emoji: '🏷️', perfiles: ['admin'] },
      { path: '/clientes/top',           label: 'Top Clientes Facturación',    emoji: '🏆', perfiles: ['admin'] },
      { path: '/clientes/tienda',        label: 'Tienda en Línea',             emoji: '🛒', perfiles: ['admin'] },
      { path: '/clientes/cotizaciones',  label: 'Cotizaciones',                emoji: '📄', perfiles: ['admin'] },
    ],
  },
  {
    key: 'informes', emoji: '📊', label: 'Informes & Estadísticas', perfiles: ['admin'],
    items: [
      { path: '/informes/ventas-hora',     label: 'Ventas por Hora',            emoji: '🕐', perfiles: ['admin'] },
      { path: '/informes/ventas-familia',  label: 'Ventas por Familia',         emoji: '🗂️', perfiles: ['admin'] },
      { path: '/informes/ventas-canal',    label: 'Ventas por Canal',           emoji: '📡', perfiles: ['admin'] },
      { path: '/informes/consumo-platos',  label: 'Consumo Platos por Período', emoji: '🍽️', perfiles: ['admin'] },
      { path: '/informes/comparativa',     label: 'Comparativa Año vs Anterior',emoji: '📅', perfiles: ['admin'] },
      { path: '/informes/mapa',            label: 'Mapa Geográfico Ventas',     emoji: '🗺️', perfiles: ['admin'] },
      { path: '/informes/pagos',           label: 'Pagos Registrados',          emoji: '💳', perfiles: ['admin'] },
      { path: '/informes/mis-ventas',      label: 'Mis Ventas',                 emoji: '📊', perfiles: ['admin'] },
      { path: '/informes/ventas-marca',    label: 'Ventas Marca',               emoji: '🏷️', perfiles: ['admin'] },
      { path: '/informes/margen-canal',    label: 'Margen Canal',               emoji: '📡', perfiles: ['admin'] },
      { path: '/informes/cogs',            label: 'COGS Coste MP',              emoji: '🧾', perfiles: ['admin'] },
      { path: '/informes/ranking',         label: 'Ranking Productos',          emoji: '🏆', perfiles: ['admin'] },
    ],
  },
  {
    key: 'configuracion', emoji: '⚙️', label: 'Configuración', perfiles: ['admin'],
    items: [
      { path: '/configuracion',               label: 'Configuración',                emoji: '⚙️', perfiles: ['admin'] },
      { path: '/configuracion/roles',         label: 'Roles y Permisos',             emoji: '🔐', perfiles: ['admin'] },
      { path: '/configuracion/usuarios',      label: 'Usuarios',                     emoji: '👤', perfiles: ['admin'] },
      { path: '/configuracion/filtros',       label: 'Filtros Múltiples',            emoji: '🔍', perfiles: ['admin'] },
      { path: '/configuracion/busqueda',      label: 'Búsqueda Avanzada',            emoji: '🔎', perfiles: ['admin'] },
      { path: '/configuracion/app-movil',     label: 'App Móvil Accesos',            emoji: '📱', perfiles: ['admin'] },
      { path: '/configuracion/favoritos',     label: 'Panel Favoritos',              emoji: '⭐', perfiles: ['admin'] },
      { path: '/configuracion/acciones',      label: 'Acciones Rápidas',             emoji: '🚀', perfiles: ['admin'] },
    ],
  },
]

// ─── LogoSL ───────────────────────────────────────────────────────────────────

function LogoSL({ small = false }: { small?: boolean }) {
  const size = small ? 32 : 36
  const [fallback, setFallback] = useState(false)
  if (fallback) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: RED, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Impact, sans-serif', fontSize: 13, letterSpacing: '0.02em', flexShrink: 0 }}>SL</div>
    )
  }
  return (
    <img src="/data/logo-icon.svg" onError={() => setFallback(true)} alt="Streat Lab" width={size} height={size} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { usuario, logout } = useAuth()
  const { collapsed, toggle } = useSidebarState()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const perfil = usuario?.perfil ?? ''
  // FIFO accordion: max 2 sections open simultaneously
  const [openSections, setOpenSections] = useState<string[]>([])

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      if (prev.includes(key)) return prev.filter(s => s !== key)
      const next = [...prev, key]
      if (next.length > 2) next.shift()
      return next
    })
  }

  const filterItems = (items: NavItem[]) => items.filter(i => i.perfiles.includes(perfil))
  const width = collapsed ? 'w-[56px]' : 'w-[260px]'

  const itemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 8px 8px 16px',
    margin: '1px 8px',
    borderRadius: 6,
    fontFamily: 'Lexend, sans-serif',
    fontSize: 13,
    color: isActive ? '#1a1a1a' : 'var(--sl-text-nav)',
    background: isActive ? ACCENT : 'transparent',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'background 150ms',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
  })

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />}

      <aside
        style={{ background: 'var(--sl-sidebar)', position: 'relative' }}
        className={`
          fixed top-0 left-0 z-40 h-full border-r border-[var(--sl-border)]
          flex flex-col transition-all duration-200
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
          ${width}
        `}
      >
        {/* Botón circular colapsar/expandir — flecha SVG rotatoria */}
        <button
          onClick={toggle}
          style={{
            position: 'absolute',
            top: 16,
            right: -12,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: isDark ? '#2a3050' : '#e8e4de',
            border: `1px solid ${isDark ? '#3a4058' : '#d0c8bc'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            padding: 0,
          }}
          className="hidden lg:flex"
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isDark ? '#9ba8c0' : '#5a6478'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s ease' }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Header */}
        {collapsed ? (
          <div className="border-b border-[var(--sl-border)] flex items-center justify-center min-h-[72px] py-2">
            <LogoSL small />
          </div>
        ) : (
          <div className="p-3 border-b border-[var(--sl-border)] flex items-center min-h-[72px]">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <LogoSL />
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, color: ACCENT, letterSpacing: '3px' }}>STREAT LAB</span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto" style={{ overflowX: 'hidden' }}>

          {/* Panel Global — direct link, no accordion */}
          {PANEL_GLOBAL.perfiles.includes(perfil) && (
            collapsed ? (
              <NavLink to={PANEL_GLOBAL.path} end onClick={() => { toggle(); onClose() }} title={PANEL_GLOBAL.label}
                className="flex items-center justify-center transition-colors"
                style={({ isActive }) => ({ width: 56, height: 44, color: isActive ? ACCENT : 'var(--sl-text-nav)', background: isActive ? 'rgba(232,244,66,0.12)' : 'transparent' })}>
                {({ isActive }) => <NavIcon section="panel" collapsed isDark={isDark} active={isActive} />}
              </NavLink>
            ) : (
              <NavLink to={PANEL_GLOBAL.path} end onClick={onClose}
                style={({ isActive }) => ({ ...itemStyle(isActive), fontFamily: 'Oswald, sans-serif', fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase' as const })}>
                {({ isActive }) => (
                  <>
                    <NavIcon section="panel" collapsed={false} isDark={isDark} active={isActive} size={16} />
                    <span style={{ color: isActive ? '#1a1a1a' : 'var(--sl-text-nav)' }}>{PANEL_GLOBAL.label}</span>
                  </>
                )}
              </NavLink>
            )
          )}

          {/* Sections */}
          {SECTIONS.map(section => {
            const visibleItems = filterItems(section.items)
            if (!section.perfiles.includes(perfil) || visibleItems.length === 0) return null
            const isOpen = openSections.includes(section.key)

            return (
              <div key={section.key}>
                {/* Section header */}
                {collapsed ? (
                  <button
                    type="button"
                    onClick={() => {
                      // Asegurar que la sección queda abierta al expandir
                      if (!openSections.includes(section.key)) {
                        setOpenSections(prev => {
                          const next = [...prev, section.key]
                          if (next.length > 2) next.shift()
                          return next
                        })
                      }
                      toggle()
                    }}
                    title={section.label}
                    style={{
                      width: 56, height: 40, background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: isOpen ? 1 : 0.7,
                    }}
                  >
                    <NavIcon section={section.key} collapsed isDark={isDark} active={isOpen} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 16px 10px 12px',
                      fontFamily: 'Oswald, sans-serif', fontSize: 11,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: isOpen ? 'var(--sl-text-secondary)' : 'var(--sl-text-muted)',
                      transition: 'color 200ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <NavIcon section={section.key} collapsed={false} isDark={isDark} size={14} />
                      <span>{section.label}</span>
                    </div>
                    <span style={{ fontSize: 11, transition: 'transform 300ms', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>›</span>
                  </button>
                )}

                {/* Section items — animated (expanded) */}
                {!collapsed && (
                  <div style={{ maxHeight: isOpen ? `${visibleItems.length * 44}px` : 0, overflow: 'hidden', transition: 'max-height 300ms ease' }}>
                    {visibleItems.map((item, idx) => (
                      <NavLink
                        key={`${item.path}-${idx}`}
                        to={item.path}
                        end={item.path === '/'}
                        onClick={onClose}
                        style={({ isActive }) => itemStyle(isActive)}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--sl-hover)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        {({ isActive }) => (
                          <>
                            <span style={{ fontSize: 14, flexShrink: 0, ...(isActive ? {} : { paddingLeft: 16 }) }}>{item.emoji}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}

                {/* Collapsed: show icons only when section is "open" (tap) */}
                {collapsed && isOpen && visibleItems.slice(0, 8).map((item, idx) => (
                  <NavLink
                    key={`${item.path}-${idx}`}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => { toggle(); onClose() }}
                    title={item.label}
                    className="flex items-center justify-center transition-colors"
                    style={({ isActive }) => ({ width: 56, height: 40, fontSize: 16, color: isActive ? ACCENT : 'var(--sl-text-nav)', background: isActive ? 'rgba(232,244,66,0.12)' : 'transparent' })}
                  >
                    {item.emoji}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>

        {/* Botón tema — sol/luna, siempre visible */}
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: collapsed ? 0 : 8,
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '10px' : '10px 16px',
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderTop: `0.5px solid ${isDark ? '#2a3050' : '#d0c8bc'}`,
          }}
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#9ba8c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#5a6478" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
            </svg>
          )}
          {!collapsed && (
            <span style={{ fontFamily: 'Lexend,sans-serif', fontSize: 12, color: isDark ? '#9ba8c0' : '#5a6478' }}>
              {isDark ? 'Modo claro' : 'Modo oscuro'}
            </span>
          )}
        </button>

        {/* Footer user */}
        <div className={`p-3 border-t border-[var(--sl-border)] ${collapsed ? 'text-center' : ''}`} style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-muted)' }}>
          {!collapsed ? (
            <>
              <div className="mb-2 truncate">{usuario?.nombre} — <span style={{ color: ACCENT }}>{usuario?.perfil}</span></div>
              <button onClick={logout} className="text-[var(--sl-text-muted)] hover:text-[var(--sl-border-error)] transition-colors text-xs">Cerrar sesión</button>
            </>
          ) : (
            <button onClick={logout} className="text-[var(--sl-text-muted)] hover:text-[var(--sl-border-error)] transition-colors text-sm" title="Cerrar sesión">⏏</button>
          )}
        </div>
      </aside>
    </>
  )
}
