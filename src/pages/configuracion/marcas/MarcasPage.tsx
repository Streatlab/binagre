import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { TabPills } from '@/components/configuracion/TabPills'

const TABS = [
  { id: 'marcas',   label: 'Marcas' },
  { id: 'usuarios', label: 'Usuarios de marcas' },
  { id: 'canales',  label: 'Canales de venta' },
]

export default function MarcasPage() {
  const loc = useLocation()
  const nav = useNavigate()

  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? ''
  const active =
    seg === 'usuarios' ? 'usuarios' :
    seg === 'canales'  ? 'canales'  :
    'marcas'

  const handleChange = (id: string) => {
    if (id === 'marcas') nav('/configuracion/marcas')
    else nav(`/configuracion/marcas/${id}`)
  }

  return (
    <div>
      <ModTitle>Marcas</ModTitle>
      <TabPills tabs={TABS} active={active} onChange={handleChange} />
      <Outlet />
    </div>
  )
}
