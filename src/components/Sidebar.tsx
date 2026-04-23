import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard,
  TrendingUp,
  ChefHat,
  Settings2,
  ShoppingCart,
  Tablet,
  Store,
  Megaphone,
  Users,
  UserCircle,
  BarChart3,
  Settings,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useSidebarState } from '@/hooks/useSidebarState'
import { ThemeToggle } from './ThemeToggle'
import { useTheme, FONT } from '@/styles/tokens'

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

interface SectionIconConfig {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>
  color: string
}

const SECTIONS: NavSection[] = [
  {
    key: 'finanzas', emoji: '📈', label: 'Finanzas', perfiles: ['admin'],
    items: [
      { path: '/facturacion',             label: 'Facturación',           emoji: '🗂️', perfiles: ['admin'] },
      { path: '/finanzas/objetivos',      label: 'Objetivos',             emoji: '🎯', perfiles: ['admin'] },
      { path: '/facturacion/conciliacion', label: 'Conciliación',          emoji: '🏦', perfiles: ['admin'] },
      { path: '/finanzas/running',         label: 'Running Financiero',    emoji: '📊', perfiles: ['admin'] },
      { path: '/finanzas/importar-plataformas', label: 'Importar Plataformas', emoji: '📥', perfiles: ['admin'] },
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
    ],
  },
  {
    key: 'cocina', emoji: '🍳', label: 'Cocina', perfiles: ['admin', 'cocina'],
    items: [
      { path: '/escandallo',              label: 'Escandallo',       emoji: '⚖️', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/menu-engineering', label: 'Menú Engineering', emoji: '⚙️', perfiles: ['admin'] },
      { path: '/cocina/inventario',       label: 'Inventario',       emoji: '📦', perfiles: ['admin'] },
      { path: '/cocina/recetas',          label: 'Recetas (coste)',  emoji: '💰', perfiles: ['admin'] },
      { path: '/ops/recetas',             label: 'Fichas técnicas',  emoji: '📋', perfiles: ['admin', 'cocina'] },
    ],
  },
  {
    key: 'operaciones', emoji: '⚙️', label: 'Operaciones', perfiles: ['admin', 'cocina'],
    items: [
      { path: '/ops/reembolsos',      label: 'Reclamación Reembolsos',     emoji: '💸',  perfiles: ['admin', 'cocina'] },
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
      { path: '/configuracion/marcas',        label: 'Marcas',                       emoji: '🏷️', perfiles: ['admin'] },
      { path: '/configuracion/bancos',        label: 'Bancos y cuentas',             emoji: '🏦', perfiles: ['admin'] },
      { path: '/configuracion/compras',       label: 'Compras',                      emoji: '🧾', perfiles: ['admin'] },
      { path: '/configuracion/usuarios',      label: 'Usuarios',                     emoji: '👤', perfiles: ['admin'] },
      { path: '/configuracion/favoritos',     label: 'Panel Favoritos',              emoji: '⭐', perfiles: ['admin'] },
      { path: '/configuracion/busqueda',      label: 'Búsqueda Avanzada',            emoji: '🔎', perfiles: ['admin'] },
    ],
  },
]

const SECTION_ICONS: Record<string, SectionIconConfig> = {
  finanzas:       { icon: TrendingUp,      color: '#06C167' },
  cocina:         { icon: ChefHat,         color: '#f5a623' },
  operaciones:    { icon: Settings2,       color: '#66aaff' },
  stock:          { icon: ShoppingCart,    color: '#B01D23' },
  pos:            { icon: Tablet,          color: '#FF4757' },
  marcas:         { icon: Store,           color: '#f5a623' },
  marketing:      { icon: Megaphone,       color: '#06C167' },
  equipo:         { icon: Users,           color: '#66aaff' },
  clientes:       { icon: UserCircle,      color: '#B01D23' },
  informes:       { icon: BarChart3,       color: '#FF4757' },
  configuracion:  { icon: Settings,        color: '#9ba8c0' },
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { usuario, logout } = useAuth()
  const { collapsed, toggle } = useSidebarState()
  const { T, isDark } = useTheme()
  const perfil = usuario?.perfil ?? ''

  const activeTextColor = '#ffffff'
  const hoverBg = isDark ? T.card : T.group

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
  const sidebarWidth = collapsed ? 56 : 220

  const itemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 10px 9px 16px',
    margin: '1px 8px',
    borderRadius: 6,
    fontFamily: FONT.body,
    fontSize: 14,
    color: isActive ? activeTextColor : T.pri,
    background: isActive ? '#FF4757' : 'transparent',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'background 150ms',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
  })

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />}

      <aside
        style={{ background: T.group, borderRadius: 16, width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
        className={`
          fixed top-0 left-0 z-40 h-full border-r border-[var(--sl-border)]
          flex flex-col transition-all duration-200 overflow-hidden
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {collapsed ? (
          <div style={{ borderBottom: `1px solid ${T.brd}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 64, padding: '6px 0', gap: 4 }}>
            <img src="/data/logo-icon.svg" alt="Streat Lab" style={{ height: 28, width: 'auto', display: 'block', filter: 'none' }} crossOrigin="anonymous" />
            <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2 }} title="Expandir">
              <ChevronRight size={18} color="#FF4757" />
            </button>
          </div>
        ) : (
          <div style={{ padding: 12, borderBottom: `1px solid ${T.brd}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <img src="/data/logo-icon.svg" alt="Streat Lab" style={{ height: 32, width: 'auto', display: 'block', flexShrink: 0, filter: 'none' }} crossOrigin="anonymous" />
              <span style={{ fontFamily: FONT.heading, fontSize: 14, color: '#B01D23', letterSpacing: '2px', fontWeight: 600, whiteSpace: 'nowrap' }}>STREAT LAB</span>
            </div>
            <button onClick={toggle} style={{ color: T.mut, background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0 }} className="hover:text-[var(--sl-text-primary)] transition-colors hidden lg:block" title="Colapsar">«</button>
          </div>
        )}

        <nav className="flex-1 py-2 overflow-y-auto" style={{ overflowX: 'hidden' }}>

          {(!collapsed && perfil && ['admin', 'cocina'].includes(perfil)) && (
            <NavLink
              to="/"
              end
              onClick={onClose}
              style={({ isActive }) => ({
                width: '100%',
                background: isActive ? '#FF4757' : 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 10,
                padding: '10px 14px 10px 12px',
                fontFamily: FONT.heading,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: isActive ? '#ffffff' : T.pri,
                textDecoration: 'none',
                transition: 'background 150ms',
              })}
            >
              {({ isActive }) => (
                <>
                  <LayoutDashboard size={18} strokeWidth={1.8} color={isActive ? '#ffffff' : '#FF4757'} style={{ flexShrink: 0 }} />
                  <span>Panel Global</span>
                </>
              )}
            </NavLink>
          )}

          {collapsed && perfil && ['admin', 'cocina'].includes(perfil) && (
            <NavLink
              to="/"
              end
              onClick={onClose}
              title="Panel Global"
              style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
            >
              <LayoutDashboard size={20} strokeWidth={1.8} color="#FF4757" />
            </NavLink>
          )}

          {SECTIONS.map(section => {
            const visibleItems = filterItems(section.items)
            if (!section.perfiles.includes(perfil) || visibleItems.length === 0) return null
            const isOpen = openSections.includes(section.key)
            const IconComponent = SECTION_ICONS[section.key]?.icon
            const iconColor = SECTION_ICONS[section.key]?.color || '#888'

            return (
              <div key={section.key}>
                {collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    title={section.label}
                    style={{
                      width: '100%', height: 44, background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {IconComponent ? <IconComponent size={20} strokeWidth={1.8} color={iconColor} /> : <span>{section.emoji}</span>}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px 10px 12px',
                      fontFamily: FONT.heading, fontSize: 13,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: isOpen ? T.pri : T.sec,
                      transition: 'color 200ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {IconComponent ? <IconComponent size={18} strokeWidth={1.8} color={iconColor} /> : <span style={{ fontSize: 14 }}>{section.emoji}</span>}
                      <span>{section.label}</span>
                    </div>
                    <span style={{ fontSize: 11, transition: 'transform 300ms', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>›</span>
                  </button>
                )}

                {!collapsed && (
                  <div style={{ maxHeight: isOpen ? `${visibleItems.length * 42}px` : 0, overflow: 'hidden', transition: 'max-height 300ms ease' }}>
                    {visibleItems.map((item, idx) => (
                      <NavLink
                        key={`${item.path}-${idx}`}
                        to={item.path}
                        end={item.path === '/'}
                        onClick={onClose}
                        style={({ isActive }) => itemStyle(isActive)}
                        className={({ isActive }) => isActive ? '' : `hover:!bg-[${hoverBg}] hover:!text-[${T.pri}]`}
                      >
                        {({ isActive }) => (
                          <>
                            <span style={{ fontSize: 14, flexShrink: 0 }}>{item.emoji}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isActive ? activeTextColor : T.pri }}>{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div style={{ padding: collapsed ? '8px' : '12px', borderTop: `1px solid ${T.brd}`, display: 'flex', justifyContent: 'center' }}>
          <ThemeToggle />
        </div>

        <div style={{ padding: 12, borderTop: `1px solid ${T.brd}`, fontFamily: FONT.body, fontSize: 12, color: T.mut, textAlign: collapsed ? 'center' : 'left' }}>
          {!collapsed ? (
            <>
              <div style={{ marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.sec }}>
                {usuario?.nombre} — <span style={{ color: '#FF4757' }}>{usuario?.perfil}</span>
              </div>
              <button onClick={logout} style={{ color: T.mut, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>Cerrar sesión</button>
            </>
          ) : (
            <button onClick={logout} style={{ color: T.mut, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }} title="Cerrar sesión">⏏</button>
          )}
        </div>
      </aside>
    </>
  )
}
