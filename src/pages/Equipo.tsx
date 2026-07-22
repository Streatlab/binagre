import { BLANCO, GRANATE } from '@/styles/neobrutal'
import { useSearchParams } from 'react-router-dom'
import { useTheme, FONT, pageTitleStyle } from '@/styles/tokens'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useAuth } from '@/context/AuthContext'
import TabEmpleados from './equipo/TabEmpleados'
import TabNominas from './equipo/TabNominas'
import TabCostes from './equipo/TabCostes'
import TabSeguridadSocial from './equipo/TabSeguridadSocial'
import TabCalendarioLaboral from './equipo/TabCalendarioLaboral'
import TabPermisos from './equipo/TabPermisos'
import TabPortal from './equipo/TabPortal'
import TabIncentivos from './equipo/TabIncentivos'
import TabDocumentos from './equipo/TabDocumentos'
import Organigrama from './equipo/Organigrama'
import Horarios from './equipo/Horarios'
import ControlPresencia from './equipo/ControlPresencia'

// Neobrutal — theme-aware: superficies/bordes salen de variables
const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'
const NEO_CARD: React.CSSProperties = { border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW }

type TabKey = 'empleados' | 'nominas' | 'costes' | 'segsocial' | 'documentos' | 'incentivos' | 'calendario' | 'permisos' | 'horarios' | 'presencia' | 'organigrama' | 'portal'
export type GrupoEquipo = 'personas' | 'dinero' | 'dia' | 'documentos'

// Equipo es una seccion propia del sidebar con 4 entradas; cada una trae solo
// SUS pestañas. Antes eran 12 pestañas seguidas en una sola pantalla y no se
// podia trabajar. Agrupacion: quienes son / que cuestan / como trabajan / papeles.
const GRUPOS: Record<GrupoEquipo, { titulo: string; tabs: { key: TabKey; label: string }[] }> = {
  personas: {
    titulo: 'Equipo · Personas',
    tabs: [
      { key: 'empleados',   label: 'Fichas' },
      { key: 'organigrama', label: 'Organigrama' },
      { key: 'incentivos',  label: 'Incentivos' },
      { key: 'portal',      label: 'Portal del empleado' },
    ],
  },
  dinero: {
    titulo: 'Equipo · Dinero',
    tabs: [
      { key: 'nominas',   label: 'Nóminas' },
      { key: 'costes',    label: 'Costes' },
      { key: 'segsocial', label: 'Seguridad Social y autónomos' },
    ],
  },
  dia: {
    titulo: 'Equipo · Día a día',
    tabs: [
      { key: 'horarios',   label: 'Horarios' },
      { key: 'presencia',  label: 'Fichajes' },
      { key: 'calendario', label: 'Calendario laboral' },
      { key: 'permisos',   label: 'Permisos y vacaciones' },
    ],
  },
  documentos: {
    titulo: 'Equipo · Documentos',
    tabs: [
      { key: 'documentos', label: 'Documentos' },
    ],
  },
}

const tabBase: React.CSSProperties = {
  fontFamily: 'Oswald, sans-serif',
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  padding: '9px 18px',
  minHeight: 44,
  cursor: 'pointer',
  border: `3px solid ${NEO_INK}`,
  borderRadius: 0,
  display: 'inline-flex',
  alignItems: 'center',
}

export default function Equipo({ grupo = 'personas' }: { grupo?: GrupoEquipo }) {
  const { T } = useTheme()
  const isMobile = useIsMobile()
  const { usuario } = useAuth()
  const [params, setParams] = useSearchParams()

  const isAdmin = usuario?.perfil === 'admin' || usuario?.rol === 'admin'

  const { titulo, tabs } = GRUPOS[grupo]
  const raw = params.get('tab') as TabKey | null
  const activeTab: TabKey = tabs.some(t => t.key === raw) ? raw! : tabs[0].key

  function setTab(key: TabKey) {
    setParams({ tab: key })
  }

  // Un empleado sin perfil admin solo llega aquí por la ruta redirigida de su
  // antiguo Portal (/equipo/portal): ve directamente su portal, sin la barra
  // de pestañas administrativas.
  if (!isAdmin) {
    return (
      <div style={{ background: 'var(--neo-bg)', minHeight: '100vh', padding: isMobile ? '14px 12px' : '24px 28px', fontFamily: FONT.body }}>
        <TabPortal />
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--neo-bg)', minHeight: '100vh', padding: isMobile ? '14px 12px' : '24px 28px', fontFamily: FONT.body }}>
      <h1 style={{ ...pageTitleStyle(T), fontSize: 'clamp(22px, 5vw, 30px)' }}>{titulo}</h1>

      {/* Tabs neobrutal — una sola fila, scroll horizontal en móvil (nunca dos filas apiladas) */}
      {tabs.length > 1 && (
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 }}>
        {tabs.map(t => {
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...tabBase,
                flexShrink: 0,
                background: active ? GRANATE : 'var(--sl-card)',
                color: active ? BLANCO : NEO_INK,
                boxShadow: active ? NEO_SHADOW : 'none',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      )}

      {/* Tab content */}
      <div style={{ ...NEO_CARD, background: 'var(--sl-card)', padding: isMobile ? '14px 12px' : '20px 22px', overflowX: 'auto' }}>
        {activeTab === 'empleados'   && <TabEmpleados />}
        {activeTab === 'nominas'     && <TabNominas />}
        {activeTab === 'costes'      && <TabCostes />}
        {activeTab === 'segsocial'   && <TabSeguridadSocial />}
        {activeTab === 'documentos'  && <TabDocumentos />}
        {activeTab === 'incentivos'  && <TabIncentivos />}
        {activeTab === 'calendario'  && <TabCalendarioLaboral />}
        {activeTab === 'permisos'    && <TabPermisos />}
        {activeTab === 'horarios'    && <Horarios />}
        {activeTab === 'presencia'   && <ControlPresencia />}
        {activeTab === 'organigrama' && <Organigrama />}
        {activeTab === 'portal'      && <TabPortal />}
      </div>
    </div>
  )
}
