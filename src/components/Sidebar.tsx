import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSidebarState } from '@/hooks/useSidebarState'
import { ThemeToggle } from './ThemeToggle'

const RED = '#B01D23'

interface NavLinkEntry {
  type: 'link'
  label: string
  path: string
  icon: string
}

interface NavItem {
  label: string
  path: string
  icon: string
  placeholder?: boolean
}

interface NavGroup {
  type: 'group'
  label: string
  icon: string
  items: NavItem[]
}

type NavEntry = NavLinkEntry | NavGroup

const NAV: NavEntry[] = [
  { type: 'link', label: 'DASHBOARD', path: '/', icon: '🏠' },
  {
    type: 'group', label: 'FACTURACIÓN', icon: '💰',
    items: [
      { label: 'Resumen',  path: '/facturacion', icon: '📊' },
      { label: 'Análisis', path: '/analytics',   icon: '📈', placeholder: true },
      { label: 'Revenue',  path: '/revenue',     icon: '💹', placeholder: true },
      { label: 'Running',  path: '/running',     icon: '🏃' },
    ],
  },
  {
    type: 'group', label: 'COCINA', icon: '🍳',
    items: [
      { label: 'Escandallo',    path: '/escandallo',          icon: '⚖️' },
      { label: 'Control Temp.', path: '/control-temperatura', icon: '🌡️', placeholder: true },
      { label: 'Checklists',    path: '/checklists',          icon: '✅', placeholder: true },
      { label: 'Bitácora',      path: '/bitacora',            icon: '📓', placeholder: true },
    ],
  },
  {
    type: 'group', label: 'OPERACIONES', icon: '⚙️',
    items: [
      { label: 'Marcas',        path: '/marcas',        icon: '🏷️' },
      { label: 'POS',           path: '/pos',           icon: '🖥️', placeholder: true },
      { label: 'Daño Equipo',   path: '/dano-equipo',   icon: '🔧', placeholder: true },
      { label: 'Daño Menaje',   path: '/dano-menaje',   icon: '🍽️', placeholder: true },
      { label: 'Novedades',     path: '/novedades',     icon: '📢', placeholder: true },
      { label: 'Integraciones', path: '/integraciones', icon: '🔌', placeholder: true },
      { label: 'Manuales',      path: '/manuales',      icon: '📋', placeholder: true },
    ],
  },
  {
    type: 'group', label: 'EQUIPO', icon: '👥',
    items: [
      { label: 'Mi Equipo',            path: '/equipo',       icon: '👤', placeholder: true },
      { label: 'Evaluaciones',         path: '/evaluaciones', icon: '⭐', placeholder: true },
      { label: 'Llamados de atención', path: '/llamados',     icon: '⚠️', placeholder: true },
      { label: 'Celebraciones',        path: '/celebraciones', icon: '🎉', placeholder: true },
      { label: 'Dotación',             path: '/dotacion',     icon: '👕', placeholder: true },
    ],
  },
  {
    type: 'group', label: 'CLIENTES', icon: '🤝',
    items: [
      { label: 'Reseñas', path: '/resenas', icon: '💬', placeholder: true },
      { label: 'Quejas',  path: '/quejas',  icon: '📝', placeholder: true },
    ],
  },
  { type: 'link', label: 'CONFIGURACIÓN', path: '/configuracion', icon: '⚙️' },
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

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { usuario, logout } = useAuth()
  const { collapsed, toggle } = useSidebarState()
  const location = useLocation()
  const navigate = useNavigate()

  const [isDark, setIsDark] = useState(
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
  )
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // tokens
  const sbBg     = isDark ? '#0d0d0d' : '#f8f5f0'
  const sbBorder = isDark ? '#222222' : '#ddd8d0'
  const sbText   = isDark ? '#d8e0f0' : '#2d3748'
  const sbMuted  = isDark ? '#6a7a9a' : '#718096'
  const sbActive = isDark ? '#e8f442' : '#7a6200'
  const sbHover  = isDark ? '#1a1a1a' : '#ede9e2'

  // Auto-abrir grupo que contiene la ruta activa
  const groupOfPath = (path: string): string | null => {
    for (const e of NAV) {
      if (e.type === 'group' && e.items.some(i => !i.placeholder && (i.path === path || (i.path !== '/' && path.startsWith(i.path))))) {
        return e.label
      }
    }
    return null
  }
  const [openGroup, setOpenGroup] = useState<string | null>(groupOfPath(location.pathname))
  useEffect(() => {
    const g = groupOfPath(location.pathname)
    if (g) setOpenGroup(g)
  }, [location.pathname])

  const isPathActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path + '/')

  const width = collapsed ? 'w-[56px]' : 'w-[220px]'

  const goTo = (path: string) => {
    navigate(path)
    onClose()
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />}

      <aside
        className={`
          fixed top-0 left-0 z-40 h-full border-r
          flex flex-col transition-all duration-200
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
          ${width}
        `}
        style={{ backgroundColor: sbBg, borderColor: sbBorder }}
      >
        {/* Header logo */}
        {collapsed ? (
          <div style={{ borderBottom: `1px solid ${sbBorder}` }} className="flex flex-col items-center justify-center min-h-[72px] py-2 gap-1">
            <LogoSL small />
            <button
              onClick={toggle}
              style={{ width: 44, height: 44, fontSize: 18, color: sbMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              className="rounded transition-colors hidden lg:flex hover:!text-[var(--sl-text-primary)]"
              title="Expandir"
            >»</button>
          </div>
        ) : (
          <div style={{ borderBottom: `1px solid ${sbBorder}` }} className="p-3 flex items-center min-h-[72px]">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <LogoSL />
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, color: sbActive, letterSpacing: '3px' }}>STREAT LAB</span>
            </div>
            <button
              onClick={toggle}
              style={{ color: sbMuted }}
              className="p-1.5 rounded transition-colors hidden lg:block flex-shrink-0 hover:!text-[var(--sl-text-primary)]"
              title="Colapsar"
            >«</button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map(entry => {
            if (entry.type === 'link') {
              const active = isPathActive(entry.path)
              return (
                <NavLink
                  key={entry.path}
                  to={entry.path}
                  end={entry.path === '/'}
                  onClick={onClose}
                  title={collapsed ? entry.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: collapsed ? '13px 0' : '12px 16px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    color: active ? sbActive : sbText,
                    borderLeft: active ? `2px solid ${sbActive}` : '2px solid transparent',
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: '0.88rem',
                    letterSpacing: '1.5px',
                    textDecoration: 'none',
                    backgroundColor: active ? sbHover : 'transparent',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span style={{ fontSize: '1rem', lineHeight: 1, marginRight: 8, width: 20, textAlign: 'center', flexShrink: 0 }}>{entry.icon}</span>
                  {!collapsed && <span>{entry.label}</span>}
                </NavLink>
              )
            }

            // group
            const groupActive = entry.items.some(i => !i.placeholder && isPathActive(i.path))
            const isOpenGroup = openGroup === entry.label || (collapsed && groupActive)

            return (
              <div key={entry.label}>
                {!collapsed ? (
                  <div
                    onClick={() => setOpenGroup(prev => prev === entry.label ? null : entry.label)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '11px 16px',
                      marginTop: 6,
                      color: sbMuted,
                      fontFamily: 'Oswald, sans-serif',
                      fontSize: '0.68rem',
                      letterSpacing: '2px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      textTransform: 'uppercase',
                      borderTop: `1px solid ${sbBorder}`,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1rem', lineHeight: 1 }}>{entry.icon}</span>
                      <span>{entry.label}</span>
                    </span>
                    <span style={{ fontSize: 11 }}>{isOpenGroup ? '▼' : '▶'}</span>
                  </div>
                ) : (
                  <div
                    title={entry.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      padding: '10px 0',
                      fontSize: '1rem',
                      color: sbMuted,
                      borderTop: `1px solid ${sbBorder}`,
                    }}
                  >
                    {entry.icon}
                  </div>
                )}

                {isOpenGroup && entry.items.map(item => {
                  const itemActive = !item.placeholder && isPathActive(item.path)

                  if (item.placeholder) {
                    return (
                      <div
                        key={item.path}
                        title={collapsed ? `${item.label} (próximamente)` : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: collapsed ? '9px 0' : '9px 16px 9px 24px',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          color: sbMuted,
                          opacity: 0.5,
                          fontFamily: 'Lexend, sans-serif',
                          fontSize: '0.82rem',
                          cursor: 'default',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        <span style={{ fontSize: '1rem', lineHeight: 1, marginRight: 8, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                        {!collapsed && <span>{item.label}</span>}
                      </div>
                    )
                  }

                  return (
                    <div
                      key={item.path}
                      onClick={() => goTo(item.path)}
                      title={collapsed ? item.label : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: collapsed ? '9px 0' : '9px 16px 9px 24px',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        color: itemActive ? sbActive : sbText,
                        borderLeft: itemActive ? `2px solid ${sbActive}` : '2px solid transparent',
                        fontFamily: 'Lexend, sans-serif',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        backgroundColor: itemActive ? sbHover : 'transparent',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <span style={{ fontSize: '1rem', lineHeight: 1, marginRight: 8, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                      {!collapsed && <span>{item.label}</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Theme toggle */}
        {!collapsed && (
          <div style={{ marginTop: 'auto', padding: 12, borderTop: `1px solid ${sbBorder}` }}>
            <ThemeToggle />
          </div>
        )}

        {/* Footer user */}
        <div
          className={collapsed ? 'text-center' : ''}
          style={{
            padding: 12,
            borderTop: `1px solid ${sbBorder}`,
            fontFamily: 'Lexend, sans-serif',
            fontSize: 12,
            color: sbMuted,
          }}
        >
          {!collapsed ? (
            <>
              <div className="mb-2 truncate" style={{ color: sbText }}>
                {usuario?.nombre} — <span style={{ color: sbActive }}>{usuario?.perfil}</span>
              </div>
              <button
                onClick={logout}
                style={{ color: sbMuted, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12 }}
                className="hover:!text-[var(--sl-border-error)] transition-colors"
              >Cerrar sesión</button>
            </>
          ) : (
            <button
              onClick={logout}
              style={{ color: sbMuted, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14 }}
              className="hover:!text-[var(--sl-border-error)] transition-colors"
              title="Cerrar sesión"
            >⏏</button>
          )}
        </div>
      </aside>
    </>
  )
}
