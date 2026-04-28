import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { TabPills } from '@/components/configuracion/TabPills'
import { ConfigShell } from '@/components/configuracion/ConfigShell'

// Accesos Uber → movido a tab Plataformas (FASE 10.5)
// Tipos de cocina → propiedad de Marca (FASE 10.5)
const TABS = [
  { id: 'marcas',  label: 'Marcas' },
  { id: 'canales', label: 'Canales de venta' },
]

export default function MarcasPage() {
  const loc = useLocation()
  const nav = useNavigate()

  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? ''
  const active =
    seg === 'canales' ? 'canales' :
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
