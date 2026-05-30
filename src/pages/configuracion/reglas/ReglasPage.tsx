import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { TabPills } from '@/components/configuracion/TabPills'
import { ConfigShell } from '@/components/configuracion/ConfigShell'

const TABS = [
  { id: 'ingredientes', label: 'Normalización ingredientes' },
]

export default function ReglasPage() {
  const loc = useLocation()
  const nav = useNavigate()

  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? ''
  const active = seg === 'ingredientes' ? 'ingredientes' : 'ingredientes'

  const handleChange = (id: string) => {
    nav(`/configuracion/reglas/${id}`)
  }

  return (
    <ConfigShell>
      <ModTitle>Reglas</ModTitle>
      <TabPills tabs={TABS} active={active} onChange={handleChange} />
      <Outlet />
    </ConfigShell>
  )
}
