import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { TabPills } from '@/components/configuracion/TabPills'
import { ConfigShell } from '@/components/configuracion/ConfigShell'

const TABS = [
  { id: 'costes',      label: 'Costes' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'categorias',  label: 'Categorías' },
  { id: 'unidades',    label: 'Unidades' },
]

export default function ComprasPage() {
  const loc = useLocation()
  const nav = useNavigate()

  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? ''
  const active =
    seg === 'proveedores' ? 'proveedores' :
    seg === 'categorias'  ? 'categorias'  :
    seg === 'unidades'    ? 'unidades'    :
    'costes'

  const handleChange = (id: string) => {
    nav(`/configuracion/compras/${id}`)
  }

  return (
    <ConfigShell>
      <ModTitle>Compras</ModTitle>
      <TabPills tabs={TABS} active={active} onChange={handleChange} />
      <Outlet />
    </ConfigShell>
  )
}
