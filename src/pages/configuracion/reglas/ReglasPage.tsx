import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { TabPills } from '@/components/configuracion/TabPills'
import { ConfigShell } from '@/components/configuracion/ConfigShell'

const TABS = [
  { id: 'ingredientes', label: 'Normalización ingredientes' },
  { id: 'conciliacion', label: 'OCR / Conciliación' },
  { id: 'plantillas', label: 'OCR / Plantillas' },
  { id: 'correo', label: 'Aprendizaje OCR correo' },
]

export default function ReglasPage() {
  const loc = useLocation()
  const nav = useNavigate()

  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? ''
  const active = seg === 'conciliacion' ? 'conciliacion' : seg === 'plantillas' ? 'plantillas' : seg === 'correo' ? 'correo' : 'ingredientes'

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
