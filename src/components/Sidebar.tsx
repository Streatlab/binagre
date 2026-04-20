import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSidebarState } from '@/hooks/useSidebarState'
import { ThemeToggle } from './ThemeToggle'

const RED = '#B01D23'

interface NavLink {
  type: 'link'
  label: string
  path: string
  icon: string
}

interface NavItem {
  label: string
  path: string
  active?: boolean
  placeholder?: boolean
}

interface NavGroup {
  type: 'group'
  label: string
  items: NavItem[]
}

type NavEntry = NavLink | NavGroup

const NAV: NavEntry[] = [
  { type: 'link', label: 'DASHBOARD', path: '/', icon: '▪' },
  {
    type: 'group', label: 'FACTURACIÓN',
    items: [
      { label: 'Resumen',  path: '/facturacion', active: true },
      { label: 'Análisis', path: '/analytics',   placeholder: true },
      { label: 'Revenue',  path: '/revenue',     placeholder: true },
      { label: 'Running',  path: '/running',     active: true },
    ],
  },
  {
    type: 'group', label: 'COCINA',
    items: [
      { label: 'Escandallo',    path: '/escandallo',          active: true },
      { label: 'Control Temp.', path: '/control-temperatura', placeholder: true },
      { label: 'Checklists',    path: '/checklists',          placeholder: true },
      { label: 'Bitácora',      path: '/bitacora',            placeholder: true },
    ],
  },
  {
    type: 'group', label: 'OPERACIONES',
    items: [
      { label: 'Marcas',        path: '/marcas',        active: true },
      { label: 'POS',           path: '/pos',           placeholder: true },
      { label: 'Daño Equipo',   path: '/dano-equipo',   placeholder: true },
      { label: 'Daño Menaje',   path: '/dano-menaje',   placeholder: true },
      { label: 'Novedades',     path: '/novedades',     placeholder: true },
      { label: 'Integraciones', path: '/integraciones', placeholder: true },
      { label: 'Manuales',      path: '/manuales',      placeholder: true },
    ],
  },
  {
    type: 'group', label: 'EQUIPO',
    items: [
      { label: 'Mi Equipo',            path: '/equipo',       placeholder: true },
      { label: 'Evaluaciones',         path: '/evaluaciones', placeholder: true },
      { label: 'Llamados de atención', path: '/llamados',     placeholder: true },
      { label: 'Celebraciones',        path: '/celebraciones', placeholder: true },
      { label: 'Dotación',             path: '/dotacion',     placeholder: true },
    ],
  },
  {
    type: 'group', label: 'CLIENTES',
    items: [
      { label: 'Reseñas', path: '/resenas', placeholder: true },
      { label: 'Quejas',  path: '/quejas',  placeholder: true },
    ],
  },
  { type: 'link', label: 'CONFIGURACIÓN', path: '/configuracion', icon: '▪' },
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
    const observer = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    )
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  // tokens
  const sbBg      = isDark ? '#0a0a0a' : '#ffffff'
  const sbBorder  = isDark ? '#1a1a1a' : '#e5e0d8'
  const sbText    = isDark ? '#c8d0e8' : '#374151'
  const sbMuted   = isDark ? '#4a5270' : '#9ca3af'
  const sbActive  = '#e8f442'
  const sbActiveText = isDark ? '#e8f442' : '#7a6200'
  const activeBg  = isDark ? '#111111' : '#f9f9f7'

  // Auto-abrir grupo que contiene la ruta activa
  const groupOfPath = (path: string): string | null => {
    for (const e of NAV) {
      if (e.type === 'group' && e.items.some(i => i.path === path || (i.path !== '/' && path.startsWith(i.path)))) {
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
                    gap: 10,
                    padding: collapsed ? '12px 0' : '10px 16px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    color: active ? sbActiveText : sbText,
                    borderLeft: active ? `2px solid ${sbActive}` : '2px solid transparent',
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: '0.78rem',
                    letterSpacing: '1px',
                    textDecoration: 'none',
                    backgroundColor: active ? activeBg : 'transparent',
                  }}
                >
                  <span style={{ fontSize: 10, color: active ? sbActive : sbMuted }}>{entry.icon}</span>
                  {!collapsed && <span>{entry.label}</span>}
                </NavLink>
              )
            }

            // group
            const groupActive = entry.items.some(i => !i.placeholder && isPathActive(i.path))
            const isOpenGroup = openGroup === entry.label || (collapsed && groupActive)

            return (
              <div key={entry.label}>
                {!collapsed && (
                  <div
                    onClick={() => setOpenGroup(prev => prev === entry.label ? null : entry.label)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 16px',
                      color: sbMuted,
                      fontFamily: 'Oswald, sans-serif',
                      fontSize: '0.6rem',
                      letterSpacing: '2px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      marginTop: 4,
                    }}
                  >
                    <span>{entry.label}</span>
                    <span style={{ fontSize: 10 }}>{isOpenGroup ? '▼' : '▶'}</span>
                  </div>
                )}
                {collapsed && <div style={{ height: 1, background: sbBorder, margin: '8px 10px' }} />}

                {isOpenGroup && entry.items.map(item => {
                  const itemActive = !item.placeholder && isPathActive(item.path)

                  if (item.placeholder) {
                    return (
                      <div
                        key={item.path}
                        title={collapsed ? `${item.label} (próximamente)` : undefined}
                        style={{
                          opacity: 0.35,
                          cursor: 'default',
                          padding: collapsed ? '7px 10px' : '7px 16px 7px 28px',
                          fontSize: '0.75rem',
                          color: sbText,
                          fontFamily: 'Lexend, sans-serif',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {collapsed ? item.label.charAt(0) : item.label}
                      </div>
                    )
                  }

                  return (
                    <div
                      key={item.path}
                      onClick={() => goTo(item.path)}
                      title={collapsed ? item.label : undefined}
                      style={{
                        padding: collapsed ? '7px 10px' : '7px 16px 7px 28px',
                        fontSize: '0.75rem',
                        color: itemActive ? sbActiveText : sbText,
                        borderLeft: itemActive ? `2px solid ${sbActive}` : '2px solid transparent',
                        fontFamily: 'Lexend, sans-serif',
                        cursor: 'pointer',
                        backgroundColor: itemActive ? activeBg : 'transparent',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {collapsed ? item.label.charAt(0) : item.label}
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
