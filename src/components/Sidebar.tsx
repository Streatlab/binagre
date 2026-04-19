import { NavLink } from 'react-router-dom'
import { useState, Fragment } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSidebarState } from '@/hooks/useSidebarState'
import { ThemeToggle } from './ThemeToggle'

const ACCENT = '#e8f442'
const RED = '#B01D23'

interface NavItem {
  path: string
  label: string
  icon: string
  perfiles: string[]
}

interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}


const PRINCIPAL: NavItem[] = [
  { path: '/',            label: 'Dashboard',   icon: '📊', perfiles: ['admin', 'cocina'] },
  { path: '/escandallo',  label: 'Escandallo',  icon: '⚖️', perfiles: ['admin', 'cocina'] },
  { path: '/facturacion', label: 'Facturación',  icon: '💶', perfiles: ['admin'] },
]

const GROUPS: NavGroup[] = [
  {
    key: 'analytics', label: 'ANALYTICS',
    items: [
      { path: '/analytics/revenue',      label: 'Revenue & Ticket Medio', icon: '📈', perfiles: ['admin'] },
      { path: '/analytics/cogs',         label: 'COGS / Coste MP',        icon: '🧾', perfiles: ['admin'] },
      { path: '/analytics/margen',       label: 'Margen por Canal',       icon: '💹', perfiles: ['admin'] },
      { path: '/analytics/ventas-marca', label: 'Ventas por Marca',       icon: '🏪', perfiles: ['admin'] },
      { path: '/analytics/ranking',      label: 'Ranking Productos',      icon: '🏆', perfiles: ['admin'] },
      { path: '/analytics/demanda',      label: 'Predicción Demanda',     icon: '🔮', perfiles: ['admin'] },
    ],
  },
  {
    key: 'operaciones', label: 'OPERACIONES',
    items: [
      { path: '/ops/temperaturas',   label: 'Control Temperaturas',       icon: '🌡️', perfiles: ['admin', 'cocina'] },
      { path: '/ops/checklists',     label: 'Checklists Apertura/Cierre', icon: '✅', perfiles: ['admin', 'cocina'] },
      { path: '/ops/tareas',         label: 'Tareas Operativas',          icon: '📋', perfiles: ['admin', 'cocina'] },
      { path: '/ops/bitacora',       label: 'Bitácora Novedades',         icon: '📓', perfiles: ['admin', 'cocina'] },
      { path: '/ops/equipos',        label: 'Libro Equipos',              icon: '🔧', perfiles: ['admin', 'cocina'] },
      { path: '/ops/danos',          label: 'Daños Menaje',               icon: '⚠️', perfiles: ['admin', 'cocina'] },
      { path: '/ops/pedidos-menaje', label: 'Pedidos Menaje',             icon: '📦', perfiles: ['admin', 'cocina'] },
      { path: '/ops/pulso',          label: 'Pulso Cocina',               icon: '💓', perfiles: ['admin'] },
      { path: '/ops/bpm',            label: 'BPM / Calidad',              icon: '⭐', perfiles: ['admin'] },
      { path: '/ops/reuniones',      label: 'Reuniones Equipo',           icon: '🤝', perfiles: ['admin'] },
      { path: '/ops/recetas',        label: 'Recetas Fichas Técnicas',    icon: '📖', perfiles: ['admin', 'cocina'] },
    ],
  },
  {
    key: 'equipo', label: 'EQUIPO',
    items: [
      { path: '/equipo/empleados',     label: 'Fichas Empleados',      icon: '👤', perfiles: ['admin'] },
      { path: '/equipo/evaluaciones',  label: 'Evaluaciones',          icon: '📊', perfiles: ['admin'] },
      { path: '/equipo/llamados',      label: 'Llamados Atención',     icon: '🚨', perfiles: ['admin'] },
      { path: '/equipo/antiguedad',    label: 'Beneficios Antigüedad', icon: '🎖️', perfiles: ['admin'] },
      { path: '/equipo/celebraciones', label: 'Celebraciones',         icon: '🎉', perfiles: ['admin'] },
      { path: '/equipo/dotacion',      label: 'Dotación',              icon: '👕', perfiles: ['admin'] },
      { path: '/equipo/onboarding',    label: 'Onboarding Digital',    icon: '🚀', perfiles: ['admin'] },
      { path: '/equipo/sgsst',        label: 'SG-SST',                icon: '🦺', perfiles: ['admin'] },
      { path: '/equipo/metas',        label: 'Mis Ventas / Mis Metas', icon: '🎯', perfiles: ['admin'] },
    ],
  },
  {
    key: 'clientes', label: 'CLIENTES',
    items: [
      { path: '/clientes/club',    label: 'Club Fidelización',  icon: '💎', perfiles: ['admin'] },
      { path: '/clientes/crm',     label: 'CRM Tienda Propia',  icon: '🤖', perfiles: ['admin'] },
      { path: '/clientes/resenas', label: 'Panel Reseñas',       icon: '⭐', perfiles: ['admin'] },
    ],
  },
  {
    key: 'integraciones', label: 'INTEGRACIONES',
    items: [
      { path: '/integraciones/pos', label: 'POS Ventas', icon: '🖥️', perfiles: ['admin'] },
    ],
  },
]

const CONFIG: NavItem[] = [
  { path: '/configuracion', label: 'Configuración', icon: '⚙️', perfiles: ['admin'] },
  { path: '/marcas',        label: 'Marcas',         icon: '🏷️', perfiles: ['admin'] },
  { path: '/running',       label: 'Running',        icon: '🏃', perfiles: ['admin'] },
]

function LogoSL({ small = false }: { small?: boolean }) {
  const size = small ? 32 : 36
  const [fallback, setFallback] = useState(false)
  if (fallback) {
    return (
      <div
        style={{
          width: size, height: size, borderRadius: '50%',
          background: RED, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Impact, sans-serif', fontSize: 13, letterSpacing: '0.02em',
          flexShrink: 0,
        }}
      >SL</div>
    )
  }
  return (
    <img
      src="/data/STREAT LAB LOGO-04.jpg"
      onError={() => setFallback(true)}
      alt="Streat Lab"
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  )
}

function NavItemLink({ item, collapsed, onClose }: { item: NavItem; collapsed: boolean; onClose: () => void }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onClose}
      title={collapsed ? item.label : undefined}
      style={({ isActive }) => ({
        fontFamily: 'Oswald, sans-serif',
        fontSize: '0.78rem',
        fontWeight: 500,
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        borderLeft: isActive ? `3px solid ${ACCENT}` : '3px solid transparent',
        background: isActive ? 'var(--sl-card)' : 'transparent',
        color: isActive ? ACCENT : 'var(--sl-text-nav)',
      })}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-[11px] transition-colors ${collapsed ? 'justify-center' : ''} ${
          isActive ? '' : 'hover:text-[var(--sl-text-primary)] hover:bg-[var(--sl-card)]'
        }`
      }
    >
      <span style={collapsed ? { fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' } : { width: 20, textAlign: 'center', flexShrink: 0 }} className={collapsed ? '' : 'text-base flex-shrink-0'}>{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

function GroupNavItemLink({ item, collapsed, onClose }: { item: NavItem; collapsed: boolean; onClose: () => void }) {
  return (
    <NavLink
      to={item.path}
      onClick={onClose}
      title={collapsed ? item.label : undefined}
      style={({ isActive }) => ({
        fontFamily: 'Oswald, sans-serif',
        fontSize: '0.78rem',
        fontWeight: 500,
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        borderLeft: isActive ? `3px solid ${ACCENT}` : '3px solid transparent',
        background: isActive ? 'var(--sl-card)' : 'transparent',
        color: isActive ? ACCENT : 'var(--sl-text-nav)',
        paddingLeft: collapsed ? undefined : 28,
      })}
      className={({ isActive }) =>
        `flex items-center gap-3 pr-4 py-[11px] transition-colors ${collapsed ? 'justify-center px-4' : ''} ${
          isActive ? '' : 'hover:text-[var(--sl-text-primary)] hover:bg-[var(--sl-card)]'
        }`
      }
    >
      <span style={collapsed ? { fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' } : { width: 20, textAlign: 'center', flexShrink: 0 }} className={collapsed ? '' : 'text-base flex-shrink-0'}>{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { usuario, logout } = useAuth()
  const { collapsed, toggle } = useSidebarState()
  const perfil = usuario?.perfil ?? ''

  // Group open/close state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    analytics: false,
    operaciones: false,
    equipo: false,
    clientes: false,
    integraciones: false,
  })

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const filterItems = (items: NavItem[]) => items.filter(i => i.perfiles.includes(perfil))

  const width = collapsed ? 'w-[56px]' : 'w-[220px]'

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />}

      <aside
        className={`
          fixed top-0 left-0 z-40 h-full bg-[var(--sl-sidebar)] border-r border-[var(--sl-border)]
          flex flex-col transition-all duration-200
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
          ${width}
        `}
      >
        {/* Header logo + nombre */}
        {collapsed ? (
          <div className="border-b border-[var(--sl-border)] flex flex-col items-center justify-center min-h-[72px] py-2 gap-1">
            <LogoSL small={true} />
            <button onClick={toggle} style={{ width: 44, height: 44, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="text-[var(--sl-text-muted)] hover:text-[var(--sl-text-primary)] rounded transition-colors hidden lg:flex" title="Expandir">»</button>
          </div>
        ) : (
          <div className="p-3 border-b border-[var(--sl-border)] flex items-center min-h-[72px]">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <LogoSL small={false} />
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, color: ACCENT, letterSpacing: '3px' }}>STREAT LAB</span>
            </div>
            <button onClick={toggle} className="p-1.5 text-[var(--sl-text-muted)] hover:text-[var(--sl-text-primary)] rounded transition-colors hidden lg:block flex-shrink-0" title="Colapsar">«</button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {/* PRINCIPAL items */}
          {filterItems(PRINCIPAL).map(item => (
            <NavItemLink key={item.path} item={item} collapsed={collapsed} onClose={onClose} />
          ))}

          {/* Collapsable groups */}
          {GROUPS.map(group => {
            const visibleItems = filterItems(group.items)
            if (visibleItems.length === 0) return null
            const isOpen = openGroups[group.key]

            return (
              <Fragment key={group.key}>
                {/* Group header */}
                {collapsed ? (
                  <div style={{ height: 1, background: 'var(--sl-border)', margin: '8px 10px' }} />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    style={{
                      fontFamily: 'Oswald, sans-serif',
                      fontSize: '0.6rem',
                      color: 'var(--sl-text-disabled)',
                      textTransform: 'uppercase',
                      letterSpacing: '2px',
                      padding: '10px 18px',
                      cursor: 'pointer',
                      background: 'transparent',
                      border: 'none',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    className="hover:!text-[var(--sl-text-primary)] transition-colors"
                  >
                    <span>{group.label}</span>
                    <span style={{ fontSize: 10 }}>{isOpen ? '▾' : '▸'}</span>
                  </button>
                )}

                {/* Group items */}
                {(collapsed || isOpen) && visibleItems.map(item => (
                  <GroupNavItemLink key={item.path} item={item} collapsed={collapsed} onClose={onClose} />
                ))}
              </Fragment>
            )
          })}

          {/* Separator before config */}
          {collapsed ? (
            <div style={{ height: 1, background: 'var(--sl-border)', margin: '8px 10px' }} />
          ) : (
            <div style={{ height: 1, background: 'var(--sl-border)', margin: '8px 18px' }} />
          )}

          {/* CONFIG items */}
          {filterItems(CONFIG).map(item => (
            <NavItemLink key={item.path} item={item} collapsed={collapsed} onClose={onClose} />
          ))}
        </nav>

        {/* Theme toggle */}
        {!collapsed && (
          <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid var(--sl-border)' }}>
            <ThemeToggle />
          </div>
        )}

        {/* Footer user */}
        <div
          className={`p-3 border-t border-[var(--sl-border)] ${collapsed ? 'text-center' : ''}`}
          style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-muted)' }}
        >
          {!collapsed ? (
            <>
              <div className="mb-2 truncate">
                {usuario?.nombre} — <span className="text-accent">{usuario?.perfil}</span>
              </div>
              <button
                onClick={logout}
                className="text-[var(--sl-text-muted)] hover:text-[var(--sl-border-error)] transition-colors text-xs"
              >Cerrar sesión</button>
            </>
          ) : (
            <button
              onClick={logout}
              className="text-[var(--sl-text-muted)] hover:text-[var(--sl-border-error)] transition-colors text-sm"
              title="Cerrar sesión"
            >⏏</button>
          )}
        </div>
      </aside>
    </>
  )
}
