import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { TabPills } from '@/components/configuracion/TabPills'
import { ConfigShell } from '@/components/configuracion/ConfigShell'

const TABS = [
  { id: 'marcas',  label: 'Marcas' },
  { id: 'canales', label: 'Canales de venta' },
  { id: 'drive',   label: 'Google Drive' },
]

export default function MarcasPage() {
  const loc = useLocation()
  const nav = useNavigate()

  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? ''
  const active =
    seg === 'canales' ? 'canales' :
    seg === 'drive'   ? 'drive'   :
    'marcas'

  const handleChange = (id: string) => {
    if (id === 'marcas') nav('/configuracion/integraciones')
    else nav(`/configuracion/integraciones/${id}`)
  }

  return (
    <ConfigShell>
      <ModTitle>Integraciones</ModTitle>
      <TabPills tabs={TABS} active={active} onChange={handleChange} />
      <Outlet />
    </ConfigShell>
  )
}
