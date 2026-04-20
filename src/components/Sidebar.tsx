import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect, Fragment } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSidebarState } from '@/hooks/useSidebarState'
import { useTheme } from '@/contexts/ThemeContext'
import { ThemeToggle } from './ThemeToggle'

const ACCENT = '#e8f442'
const RED = '#B01D23'

interface NavItem {
  label: string
  path: string
  icon?: string
  placeholder?: boolean
  perfiles: string[]
}

interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

const DASHBOARD: NavItem = { label: 'Dashboard', path: '/', icon: '📊', perfiles: ['admin', 'cocina'] }
const CONFIGURACION: NavItem = { label: 'Configuración', path: '/configuracion', icon: '⚙️', perfiles: ['admin'] }

const GROUPS: NavGroup[] = [
  {
    key: 'facturacion', label: 'FACTURACIÓN',
    items: [
      { label: 'Resumen',   path: '/facturacion', icon: '💶', perfiles: ['admin'] },
      { label: 'Análisis',  path: '/analytics',   icon: '📈', placeholder: true, perfiles: ['admin'] },
      { label: 'Revenue',   path: '/revenue',     icon: '💹', placeholder: true, perfiles: ['admin'] },
      { label: 'Running',   path: '/running',     icon: '🏃', perfiles: ['admin'] },
    ],
  },
  {
    key: 'cocina', label: 'COCINA',
    items: [
      { label: 'Escandallo',    path: '/escandallo',           icon: '⚖️', perfiles: ['admin', 'cocina'] },
      { label: 'Control temp.', path: '/control-temperatura',  icon: '🌡️', placeholder: true, perfiles: ['admin', 'cocina'] },
      { label: 'Checklists',    path: '/checklists',           icon: '✅', placeholder: true, perfiles: ['admin', 'cocina'] },
    ],
  },
  {
    key: 'operaciones', label: 'OPERACIONES',
    items: [
      { label: 'Marcas',        path: '/marcas',         icon: '🏷️', perfiles: ['admin'] },
      { label: 'POS',           path: '/pos',            icon: '🖥️', placeholder: true, perfiles: ['admin'] },
      { label: 'Integraciones', path: '/integraciones',  icon: '🔌', placeholder: true, perfiles: ['admin'] },
      { label: 'Manuales',      path: '/manuales',       icon: '📘', placeholder: true, perfiles: ['admin'] },
    ],
  },
  {
    key: 'equipo', label: 'EQUIPO',
    items: [
      { label: 'Equipo',    path: '/equipo',    icon: '👥', placeholder: true, perfiles: ['admin'] },
      { label: 'Clientes',  path: '/clientes',  icon: '🤝', placeholder: true, perfiles: ['admin'] },
    ],
  },
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
      src="/data/streat-icon.svg"
      onError={() => setFallback(true)}
      alt="Streat Lab"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  )
}

function activeLinkStyle(isActive: boolean, collapsed: boolean, indent: boolean): React.CSSProperties {
  return {
    fontFamily: 'Oswald, sans-serif',
    fontSize: '0.78rem',
    fontWeight: 500,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    borderLeft: isActive ? `2px solid ${ACCENT}` : '2px solid transparent',
    background: isActive ? 'var(--sl-card)' : 'transparent',
    color: isActive ? ACCENT : 'var(--sl-text-nav)',
    paddingLeft: collapsed ? undefined : (indent ? 28 : undefined),
  }
}

function TopNavLink({ item, collapsed, onClose }: { item: NavItem; collapsed: boolean; onClose: () => void }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onClose}
      title={collapsed ? item.label : undefined}
      style={({ isActive }) => activeLinkStyle(isActive, collapsed, false)}
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

function GroupChild({ item, collapsed, onClose }: { item: NavItem; collapsed: boolean; onClose: () => void }) {
  if (item.placeholder) {
    return (
      <div
        title={collapsed ? `${item.label} (próximamente)` : undefined}
        style={{
          ...activeLinkStyle(false, collapsed, !collapsed),
          opacity: 0.4,
          cursor: 'default',
        }}
        className={`flex items-center gap-3 pr-4 py-[11px] ${collapsed ? 'justify-center px-4' : ''}`}
      >
        <span style={collapsed ? { fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' } : { width: 20, textAlign: 'center', flexShrink: 0 }} className={collapsed ? '' : 'text-base flex-shrink-0'}>{item.icon}</span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </div>
    )
  }
  return (
    <NavLink
      to={item.path}
      onClick={onClose}
      title={collapsed ? item.label : undefined}
      style={({ isActive }) => activeLinkStyle(isActive, collapsed, !collapsed)}
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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const location = useLocation()
  const perfil = usuario?.perfil ?? ''

  const filterItems = (items: NavItem[]) => items.filter(i => i.perfiles.includes(perfil))

  // Auto-abrir grupo que contiene la ruta activa
  const initialOpen = (): Record<string, boolean> => {
    const state: Record<string, boolean> = {}
    for (const g of GROUPS) {
      state[g.key] = g.items.some(i => !i.placeholder && location.pathname.startsWith(i.path) && i.path !== '/')
    }
    return state
  }
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpen)

  useEffect(() => {
    setOpenGroups(prev => {
      const next = { ...prev }
      for (const g of GROUPS) {
        const hasActive = g.items.some(i => !i.placeholder && location.pathname.startsWith(i.path) && i.path !== '/')
        if (hasActive) next[g.key] = true
      }
      return next
    })
  }, [location.pathname])

  const toggleGroup = (key: string) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))

  const groupHeaderColor = isDark ? '#7080a8' : '#9ca3af'
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
        {/* Header logo */}
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
          {/* DASHBOARD — siempre visible */}
          {filterItems([DASHBOARD]).map(item => (
            <TopNavLink key={item.path} item={item} collapsed={collapsed} onClose={onClose} />
          ))}

          {/* Grupos colapsables */}
          {GROUPS.map(group => {
            const visibleItems = filterItems(group.items)
            if (visibleItems.length === 0) return null
            const isOpen = openGroups[group.key]

            return (
              <Fragment key={group.key}>
                {/* Cabecera de grupo */}
                {collapsed ? (
                  <div style={{ height: 1, background: 'var(--sl-border)', margin: '8px 10px' }} />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    style={{
                      fontFamily: 'Oswald, sans-serif',
                      fontSize: '0.62rem',
                      color: groupHeaderColor,
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
                    <span style={{ fontSize: 10 }}>{isOpen ? '▼' : '▶'}</span>
                  </button>
                )}

                {/* Items del grupo */}
                {(collapsed || isOpen) && visibleItems.map(item => (
                  <GroupChild key={item.path} item={item} collapsed={collapsed} onClose={onClose} />
                ))}
              </Fragment>
            )
          })}

          {/* Separator antes de config */}
          {collapsed ? (
            <div style={{ height: 1, background: 'var(--sl-border)', margin: '8px 10px' }} />
          ) : (
            <div style={{ height: 1, background: 'var(--sl-border)', margin: '8px 18px' }} />
          )}

          {/* CONFIGURACIÓN — siempre visible al final */}
          {filterItems([CONFIGURACION]).map(item => (
            <TopNavLink key={item.path} item={item} collapsed={collapsed} onClose={onClose} />
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
