import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { TabPills } from '@/components/configuracion/TabPills'

const TABS = [
  { id: 'informacion',  label: 'Información bancaria' },
  { id: 'conciliacion', label: 'Conciliación' },
]

export default function BancosPage() {
  const loc = useLocation()
  const nav = useNavigate()

  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? ''
  const active = seg === 'conciliacion' ? 'conciliacion' : 'informacion'

  const handleChange = (id: string) => {
    if (id === 'informacion') nav('/configuracion/bancos')
    else nav(`/configuracion/bancos/${id}`)
  }

  return (
    <div>
      <ModTitle>Bancos y cuentas</ModTitle>
      <TabPills tabs={TABS} active={active} onChange={handleChange} />
      <Outlet />
    </div>
  )
}
