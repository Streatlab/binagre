import { useSearchParams } from 'react-router-dom'
import { useTheme, FONT, tabActiveStyle, tabInactiveStyle, pageTitleStyle } from '@/styles/tokens'
import TabEmpleados from './equipo/TabEmpleados'
import TabNominas from './equipo/TabNominas'
import TabCalendarioLaboral from './equipo/TabCalendarioLaboral'
import TabHorarios from './equipo/TabHorarios'
import TabPermisos from './equipo/TabPermisos'
import TabPortal from './equipo/TabPortal'

type TabKey = 'empleados' | 'nominas' | 'calendario' | 'horarios' | 'permisos' | 'portal'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'empleados',  label: 'Empleados' },
  { key: 'nominas',    label: 'Nóminas' },
  { key: 'calendario', label: 'Calendario laboral' },
  { key: 'horarios',   label: 'Horarios' },
  { key: 'permisos',   label: 'Permisos' },
  { key: 'portal',     label: 'Portal' },
]

export default function Equipo() {
  const { T, isDark } = useTheme()
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as TabKey | null
  const activeTab: TabKey = TABS.some(t => t.key === raw) ? raw! : 'empleados'

  function setTab(key: TabKey) {
    setParams({ tab: key })
  }

  return (
    <div style={{ padding: '24px 28px', fontFamily: FONT.body }}>
      <h1 style={pageTitleStyle(T)}>Equipo</h1>

      {/* Tabs estilo Conciliación */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={activeTab === t.key ? tabActiveStyle(isDark) : tabInactiveStyle(T)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'empleados'  && <TabEmpleados />}
        {activeTab === 'nominas'    && <TabNominas />}
        {activeTab === 'calendario' && <TabCalendarioLaboral />}
        {activeTab === 'horarios'   && <TabHorarios />}
        {activeTab === 'permisos'   && <TabPermisos />}
        {activeTab === 'portal'     && <TabPortal />}
      </div>
    </div>
  )
}
