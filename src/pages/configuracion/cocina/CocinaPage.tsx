/**
 * CocinaPage.tsx — Tanda C: sección "Cocina" dentro de Configuración. Agrupa Categorías,
 * Unidades, Proveedores y Formato de números del Escandallo en un solo sitio, reutilizando
 * los mismos componentes que "Compras" (misma fuente, cero duplicación de UI/lógica).
 */
import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { TabPills } from '@/components/configuracion/TabPills'
import { ConfigShell } from '@/components/configuracion/ConfigShell'

const TABS = [
  { id: 'categorias',      label: 'Categorías' },
  { id: 'unidades',        label: 'Unidades' },
  { id: 'proveedores',     label: 'Proveedores' },
  { id: 'formato-numeros', label: 'Formato de números' },
]

export default function CocinaPage() {
  const loc = useLocation()
  const nav = useNavigate()

  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? ''
  const active =
    seg === 'unidades'        ? 'unidades' :
    seg === 'proveedores'     ? 'proveedores' :
    seg === 'formato-numeros' ? 'formato-numeros' :
    'categorias'

  const handleChange = (id: string) => {
    nav(`/configuracion/cocina/${id}`)
  }

  return (
    <ConfigShell>
      <ModTitle>Cocina</ModTitle>
      <TabPills tabs={TABS} active={active} onChange={handleChange} />
      <Outlet />
    </ConfigShell>
  )
}
