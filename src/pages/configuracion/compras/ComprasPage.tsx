import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { useIsDark } from '@/hooks/useIsDark'

interface Pill {
  id: string
  label: string
  enabled: boolean
}

const PILLS: Pill[] = [
  { id: 'escandallo',  label: 'Escandallo',  enabled: true },
  { id: 'proveedores', label: 'Proveedores', enabled: true },
  { id: 'formatos',    label: 'Formatos',    enabled: true },
  { id: 'categorias',  label: 'Categorías',  enabled: true },
]

export default function ComprasPage() {
  const loc = useLocation()
  const nav = useNavigate()
  const isDark = useIsDark()

  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? ''
  const active =
    seg === 'proveedores' ? 'proveedores' :
    seg === 'formatos'    ? 'formatos'    :
    seg === 'categorias'  ? 'categorias'  :
    'escandallo'

  const inactiveBg = isDark ? '#141414' : '#ffffff'
  const inactiveColor = isDark ? '#cccccc' : '#1A1A1A'
  const inactiveBorder = isDark ? '#2a2a2a' : '#E9E1D0'
  const disabledColor = isDark ? '#555555' : '#B8AFA0'

  const handleClick = (p: Pill) => {
    if (!p.enabled) return
    nav(`/configuracion/compras/${p.id}`)
  }

  return (
    <div>
      <ModTitle>Compras</ModTitle>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {PILLS.map(p => {
          const isActive = p.id === active && p.enabled
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleClick(p)}
              disabled={!p.enabled}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'Oswald, sans-serif',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: isActive ? 600 : 500,
                background: isActive ? '#B01D23' : inactiveBg,
                color: isActive ? '#ffffff' : (p.enabled ? inactiveColor : disabledColor),
                border: `1px solid ${isActive ? '#B01D23' : inactiveBorder}`,
                cursor: p.enabled ? 'pointer' : 'not-allowed',
                opacity: p.enabled ? 1 : 0.6,
                transition: 'all 0.15s ease',
              }}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      <Outlet />
    </div>
  )
}
