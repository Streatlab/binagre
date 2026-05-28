import { useState } from 'react'
import { FONT, useTheme, pageTitleStyle } from '@/styles/tokens'
import TabsPastilla from '@/components/ui/TabsPastilla'
import TabEstaSemana from '@/components/equipo/horarios/TabEstaSemana'
import TabHistorico from '@/components/equipo/horarios/TabHistorico'
import TabVacaciones from '@/components/equipo/horarios/TabVacaciones'
import TabReglas from '@/components/equipo/horarios/TabReglas'
import TabGenerador from '@/components/equipo/horarios/TabGenerador'
import TabResumenHoras from '@/components/equipo/horarios/TabResumenHoras'

type TabId = 'semana' | 'historico' | 'vacaciones' | 'reglas' | 'generador' | 'resumen'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'semana',     label: 'Esta semana' },
  { id: 'historico',  label: 'Histórico' },
  { id: 'vacaciones', label: 'Vacaciones' },
  { id: 'reglas',     label: 'Reglas' },
  { id: 'generador',  label: 'Generador' },
  { id: 'resumen',    label: 'Resumen horas' },
]

export default function Horarios() {
  const { T } = useTheme()
  const [activeTab, setActiveTab] = useState<TabId>('semana')

  return (
    <div style={{ padding: '24px 28px', fontFamily: FONT.body, color: T.pri }}>
      <h1 style={pageTitleStyle(T)}>Horarios</h1>
      <div style={{ marginBottom: 16 }}>
        <TabsPastilla tabs={TABS} activeId={activeTab} onChange={id => setActiveTab(id as TabId)} />
      </div>

      {activeTab === 'semana'     && <TabEstaSemana />}
      {activeTab === 'historico'  && <TabHistorico />}
      {activeTab === 'vacaciones' && <TabVacaciones />}
      {activeTab === 'reglas'     && <TabReglas />}
      {activeTab === 'generador'  && <TabGenerador />}
      {activeTab === 'resumen'    && <TabResumenHoras />}
    </div>
  )
}
{/* build trigger: horarios festivos v5 */}
