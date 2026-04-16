import { NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useSidebarState } from '@/hooks/useSidebarState'

const RED = '#B01D23'

const modulos = [
  { path: '/',              label: 'Dashboard',     icon: '⬡', perfiles: ['admin', 'cocina'] },
  { path: '/escandallo',    label: 'Escandallo',    icon: '⚖', perfiles: ['admin', 'cocina'] },
  { path: '/facturacion',   label: 'Facturación',   icon: '€', perfiles: ['admin'] },
  { path: '/pos',           label: 'POS',           icon: '▤', perfiles: ['admin'] },
  { path: '/marcas',        label: 'Marcas',        icon: '◉', perfiles: ['admin'] },
  { path: '/configuracion', label: 'Configuración', icon: '⚙', perfiles: ['admin'] },
  { path: '/running',       label: 'Running',       icon: '↗', perfiles: ['admin'] },
]

/** Logo SL — circulo rojo con letras SL blancas */
function LogoSL({ small = false }: { small?: boolean }) {
  const size = small ? 32 : 48
  const fontSize = small ? 12 : 18
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="22" fill={RED} />
      <text x="24" y="30" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize={fontSize} fontWeight={800} fill="#ffffff" letterSpacing="1">
        SL
      </text>
    </svg>
  )
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { usuario, logout } = useAuth()
  const { collapsed, toggle } = useSidebarState()

  const visibles = modulos.filter(m => usuario && m.perfiles.includes(usuario.perfil))
  const width = collapsed ? 'w-14' : 'w-[220px]'

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-40 h-full bg-[#242424] border-r border-[#333]
          flex flex-col transition-all duration-200
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
          ${width}
        `}
      >
        {/* Header con logo SL */}
        <div className="p-3 border-b border-[#333] flex items-center justify-between min-h-[72px]">
          <div className="flex items-center gap-2 min-w-0">
            <LogoSL small={collapsed} />
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-white font-bold text-base tracking-tight truncate leading-tight">Streat Lab</h1>
                <p className="text-[10px] text-[#888] truncate">ERP</p>
              </div>
            )}
          </div>
          <button
            onClick={toggle}
            className="p-1.5 text-[#888] hover:text-white hover:bg-white/5 rounded transition-colors hidden lg:block flex-shrink-0"
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {visibles.map(m => (
            <NavLink
              key={m.path}
              to={m.path}
              end={m.path === '/'}
              onClick={onClose}
              title={collapsed ? m.label : undefined}
              style={({ isActive }) => isActive ? { borderRight: `2px solid ${RED}` } : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'text-white bg-[#B01D23]/10'
                    : 'text-[#aaa] hover:text-white hover:bg-white/5'
                }`
              }
            >
              <span className="text-base w-5 text-center flex-shrink-0">{m.icon}</span>
              {!collapsed && <span className="truncate">{m.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer user */}
        <div className={`p-3 border-t border-[#333] ${collapsed ? 'text-center' : ''}`}>
          {!collapsed ? (
            <>
              <div className="text-xs text-[#888] mb-2 truncate">
                {usuario?.nombre} — <span className="text-accent">{usuario?.perfil}</span>
              </div>
              <button
                onClick={logout}
                className="text-xs text-[#888] hover:text-red-400 transition-colors"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <button
              onClick={logout}
              className="text-[#888] hover:text-red-400 transition-colors text-sm"
              title="Cerrar sesión"
            >
              ⏏
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
