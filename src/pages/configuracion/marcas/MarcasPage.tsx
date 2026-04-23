import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { TabPills } from '@/components/configuracion/TabPills'
import { ConfigShell } from '@/components/configuracion/ConfigShell'

const TABS = [
  { id: 'marcas',       label: 'Marcas' },
  { id: 'accesos-uber', label: 'Accesos Uber' },
  { id: 'canales',      label: 'Canales de venta' },
  { id: 'tipos-cocina', label: 'Tipos de cocina' },
]

export default function MarcasPage() {
  const loc = useLocation()
  const nav = useNavigate()

  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? ''
  const active =
    seg === 'accesos-uber' ? 'accesos-uber' :
    seg === 'canales'      ? 'canales'      :
    seg === 'tipos-cocina' ? 'tipos-cocina' :
    'marcas'

  const handleChange = (id: string) => {
    if (id === 'marcas') nav('/configuracion/marcas')
    else nav(`/configuracion/marcas/${id}`)
  }

  return (
    <ConfigShell>
      <ModTitle>Marcas</ModTitle>
      <TabPills tabs={TABS} active={active} onChange={handleChange} />
      <Outlet />
    </ConfigShell>
  )
}
