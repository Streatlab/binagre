/**
 * TesoreriaPage — Módulo "Tesorería" (¿tengo dinero?).
 * Aplana las 4 sub-pestañas del antiguo Pagos y Cobros a primer nivel y añade
 * 13 Semanas, Escenarios y Salud Financiera (antes Fondo de Maniobra).
 */
import { useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import RutaPantalla from '@/components/ui/RutaPantalla'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { TabCalendario, TabGastos, TabHistorial } from '@/pages/PagosCobros'
import { FondoReserva } from '@/components/tesoreria/FondoReserva'
import Tesoreria13Semanas from '@/pages/finanzas/Tesoreria13Semanas'
import { EscenariosTesoreria } from '@/pages/finanzas/EscenariosTesoreria'
import { FondoManiobra } from '@/pages/finanzas/FondoManiobra'

type TabId = 'calendario' | 'gastos' | 'reserva' | 'historial' | '13semanas' | 'escenarios' | 'salud'

const TABS: { id: TabId; label: string }[] = [
  { id: 'calendario', label: 'Calendario' },
  { id: 'gastos', label: 'Gastos fijos' },
  { id: 'reserva', label: 'Fondo & reserva' },
  { id: 'historial', label: 'Historial' },
  { id: '13semanas', label: '13 semanas' },
  { id: 'escenarios', label: 'Escenarios' },
  { id: 'salud', label: 'Salud financiera' },
]
const VALID_TABS: TabId[] = TABS.map(t => t.id)

export default function TesoreriaPage() {
  const [tab, setTab] = useState<TabId>(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    return (q && VALID_TABS.includes(q as TabId)) ? (q as TabId) : 'calendario'
  })
  const isMobile = useIsMobile()

  function selectTab(id: TabId) {
    setTab(id)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', id)
    window.history.replaceState({}, '', url)
  }

  return (
    <div style={{ padding: isMobile ? '18px 12px' : '28px 28px', fontFamily: 'Lexend, sans-serif', color: 'var(--sl-text-primary)', minHeight: '100vh', backgroundColor: 'var(--neo-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <RutaPantalla niveles={['Tesorería', TABS.find(t => t.id === tab)?.label ?? '']} subtitulo="¿Tengo dinero? Cobros, pagos, fondo de reserva y proyección de caja" />
      </div>

      <TabsPastilla tabs={TABS} activeId={tab} onChange={id => selectTab(id as TabId)} />

      <div style={{ height: 16 }} />

      {tab === 'calendario' && <TabCalendario />}
      {tab === 'gastos' && <TabGastos />}
      {tab === 'reserva' && <FondoReserva embedded />}
      {tab === 'historial' && <TabHistorial />}
      {tab === '13semanas' && <Tesoreria13Semanas embedded />}
      {tab === 'escenarios' && <EscenariosTesoreria embedded />}
      {tab === 'salud' && <FondoManiobra embedded />}
    </div>
  )
}
