import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import { useIsDark } from '@/hooks/useIsDark'

interface Pill { id: string; label: string }

const PILLS: Pill[] = [
  { id: 'costes',      label: 'Costes' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'categorias',  label: 'Categorías' },
  { id: 'unidades',    label: 'Unidades' },
]

export default function ComprasPage() {
  const loc = useLocation()
  const nav = useNavigate()
  const isDark = useIsDark()

  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? ''
  const active =
    seg === 'proveedores' ? 'proveedores' :
    seg === 'categorias'  ? 'categorias'  :
    seg === 'unidades'    ? 'unidades'    :
    'costes'

  const inactiveBg = isDark ? '#141414' : '#ffffff'
  const inactiveColor = isDark ? '#cccccc' : '#1A1A1A'
  const inactiveBorder = isDark ? '#2a2a2a' : '#E9E1D0'

  return (
    <ConfigShell>
      <ModTitle>Compras</ModTitle>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {PILLS.map(p => {
          const isActive = p.id === active
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => nav(`/configuracion/compras/${p.id}`)}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'Oswald, sans-serif',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: isActive ? 600 : 500,
                background: isActive ? '#B01D23' : inactiveBg,
                color: isActive ? '#ffffff' : inactiveColor,
                border: `1px solid ${isActive ? '#B01D23' : inactiveBorder}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >{p.label}</button>
          )
        })}
      </div>
      <Outlet />
    </ConfigShell>
  )
}
