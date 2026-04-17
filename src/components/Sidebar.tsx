import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSidebarState } from '@/hooks/useSidebarState'

const ACCENT = '#e8f442'
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

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { usuario, logout } = useAuth()
  const { collapsed, toggle } = useSidebarState()
  const visibles = modulos.filter(m => usuario && m.perfiles.includes(usuario.perfil))
  const width = collapsed ? 'w-14' : 'w-[200px]'

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />}

      <aside
        className={`
          fixed top-0 left-0 z-40 h-full bg-[#1e2233] border-r border-[#3a4058]
          flex flex-col transition-all duration-200 relative
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
          ${width}
        `}
      >
        {/* Header logo + nombre */}
        <div className="p-3 border-b border-[#3a4058] flex items-center justify-center min-h-[72px]">
          {collapsed ? <LogoSL small={true} /> : (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <LogoSL small={false} />
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, color: '#f0f0ff', letterSpacing: '0.08em' }}>Streat Lab</span>
            </div>
          )}
          {!collapsed && (
            <button onClick={toggle} className="p-1.5 text-[#7080a8] hover:text-[#f0f0ff] rounded transition-colors hidden lg:block flex-shrink-0" title="Colapsar">«</button>
          )}
          {collapsed && (
            <button onClick={toggle} className="absolute top-[76px] right-[-12px] bg-[#1e2233] border border-[#3a4058] rounded-full w-6 h-6 flex items-center justify-center text-[#7080a8] hover:text-[#f0f0ff] hidden lg:flex" title="Expandir">»</button>
          )}
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
              style={({ isActive }) => ({
                fontFamily: 'Oswald, sans-serif',
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                borderLeft: isActive ? `3px solid ${ACCENT}` : '3px solid transparent',
                background: isActive ? '#262d42' : 'transparent',
                color: isActive ? '#f0f0ff' : '#8090b8',
              })}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-[11px] transition-colors ${collapsed ? 'justify-center' : ''} ${
                  isActive ? '' : 'hover:text-[#f0f0ff] hover:bg-[#262d42]/60'
                }`
              }
            >
              <span className="text-base w-5 text-center flex-shrink-0">{m.icon}</span>
              {!collapsed && <span className="truncate">{m.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer user */}
        <div
          className={`p-3 border-t border-[#3a4058] ${collapsed ? 'text-center' : ''}`}
          style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: '#5060a0' }}
        >
          {!collapsed ? (
            <>
              <div className="mb-2 truncate">
                {usuario?.nombre} — <span className="text-accent">{usuario?.perfil}</span>
              </div>
              <button
                onClick={logout}
                className="text-[#5060a0] hover:text-[#ff6060] transition-colors text-xs"
              >Cerrar sesión</button>
            </>
          ) : (
            <button
              onClick={logout}
              className="text-[#5060a0] hover:text-[#ff6060] transition-colors text-sm"
              title="Cerrar sesión"
            >⏏</button>
          )}
        </div>
      </aside>
    </>
  )
}
