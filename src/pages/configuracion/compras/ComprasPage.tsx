import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useTheme, FONT } from '@/styles/tokens'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { ConfigShell } from '@/components/configuracion/ConfigShell'

interface Pill { id: string; label: string }

const PILLS: Pill[] = [
  { id: 'costes',      label: 'Costes' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'categorias',  label: 'Categorías' },
  { id: 'unidades',    label: 'Unidades' },
]

export default function ComprasPage() {
  const { T } = useTheme()
  const loc = useLocation()
  const nav = useNavigate()

  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? ''
  const active =
    seg === 'proveedores' ? 'proveedores' :
    seg === 'categorias'  ? 'categorias'  :
    seg === 'unidades'    ? 'unidades'    :
    'costes'

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
                fontFamily: FONT.heading,
                fontSize: 13,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: isActive ? 600 : 500,
                background: isActive ? '#B01D23' : T.card,
                color: isActive ? '#ffffff' : T.sec,
                border: `0.5px solid ${isActive ? '#B01D23' : T.brd}`,
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
