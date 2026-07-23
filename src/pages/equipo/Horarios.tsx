import { useState } from 'react'
import { FONT } from '@/styles/tokens'
import TabsPastilla from '@/components/ui/TabsPastilla'
import TabEstaSemana from '@/components/equipo/horarios/TabEstaSemana'
import TabHistorico from '@/components/equipo/horarios/TabHistorico'
import TabVacaciones from '@/components/equipo/horarios/TabVacaciones'
import TabReglas from '@/components/equipo/horarios/TabReglas'
import TabGenerador from '@/components/equipo/horarios/TabGenerador'
import TabPlantillas from '@/components/equipo/horarios/TabPlantillas'
import TabResumenHoras from '@/components/equipo/horarios/TabResumenHoras'
import { PantallaCantera } from '@/components/kit/cantera'

type TabId = 'semana' | 'historico' | 'vacaciones' | 'reglas' | 'generador' | 'plantillas' | 'resumen'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'semana',     label: 'Esta semana' },
  { id: 'historico',  label: 'Histórico' },
  { id: 'vacaciones', label: 'Vacaciones' },
  { id: 'reglas',     label: 'Reglas' },
  { id: 'generador',  label: 'Generador' },
  { id: 'plantillas', label: 'Plantillas' },
  { id: 'resumen',    label: 'Resumen horas' },
]

export default function Horarios() {
  const [activeTab, setActiveTab] = useState<TabId>('semana')

  return (
    <PantallaCantera embedded style={{ fontFamily: FONT.body }}>
      <TabsPastilla tabs={TABS} activeId={activeTab} onChange={id => setActiveTab(id as TabId)} />

      {activeTab === 'semana'     && <TabEstaSemana />}
      {activeTab === 'historico'  && <TabHistorico />}
      {activeTab === 'vacaciones' && <TabVacaciones />}
      {activeTab === 'reglas'     && <TabReglas />}
      {activeTab === 'generador'  && <TabGenerador />}
      {activeTab === 'plantillas' && <TabPlantillas />}
      {activeTab === 'resumen'    && <TabResumenHoras />}
    </PantallaCantera>
  )
}
