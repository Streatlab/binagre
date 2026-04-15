import { NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const modulos = [
  { path: '/',             label: 'Dashboard',       icon: '⬡', perfiles: ['admin', 'cocina'] },
  { path: '/escandallo',   label: 'Escandallo',      icon: '⚖', perfiles: ['admin', 'cocina'] },
  { path: '/facturacion',  label: 'Facturación',     icon: '€', perfiles: ['admin'] },
  { path: '/pos',          label: 'POS',             icon: '▤', perfiles: ['admin'] },
  { path: '/marcas',       label: 'Marcas',          icon: '◉', perfiles: ['admin'] },
  { path: '/proveedores',  label: 'Proveedores',     icon: '⇄', perfiles: ['admin'] },
  { path: '/running',      label: 'Running',         icon: '↗', perfiles: ['admin'] },
]

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { usuario, logout } = useAuth()

  const visibles = modulos.filter(m => usuario && m.perfiles.includes(usuario.perfil))

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-40 h-full w-56 bg-card border-r border-border
          flex flex-col transition-transform duration-200
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-5 border-b border-border">
          <h1 className="text-accent font-bold text-lg tracking-tight">Streat Lab</h1>
          <p className="text-xs text-neutral-500 mt-0.5">ERP</p>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {visibles.map(m => (
            <NavLink
              key={m.path}
              to={m.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'text-accent bg-accent/10 border-r-2 border-accent'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <span className="text-base w-5 text-center">{m.icon}</span>
              {m.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="text-xs text-neutral-500 mb-2">
            {usuario?.nombre} — <span className="text-accent">{usuario?.perfil}</span>
          </div>
          <button
            onClick={logout}
            className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
