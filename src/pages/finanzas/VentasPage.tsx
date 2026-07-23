/**
 * VentasPage — Módulo "Ventas" (¿cuánto vendo y a quién?).
 */
import { useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import RutaPantalla from '@/components/ui/RutaPantalla'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { Ventas } from '@/pages/finanzas/Ventas'
import { Objetivos } from '@/pages/finanzas/Objetivos'
import { TicketMedio } from '@/pages/finanzas/TicketMedio'
import { RepeticionClientes } from '@/pages/finanzas/RepeticionClientes'

type TabId = 'ventas' | 'objetivos' | 'ticket' | 'repeticion'

const TABS: { id: TabId; label: string }[] = [
  { id: 'ventas', label: 'Ventas' },
  { id: 'objetivos', label: 'Objetivos' },
  { id: 'ticket', label: 'Ticket medio' },
  { id: 'repeticion', label: 'Repetición de clientes' },
]
const VALID_TABS: TabId[] = TABS.map(t => t.id)

export default function VentasPage() {
  const [tab, setTab] = useState<TabId>(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    return (q && VALID_TABS.includes(q as TabId)) ? (q as TabId) : 'ventas'
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
        <RutaPantalla niveles={['Ventas', TABS.find(t => t.id === tab)?.label ?? '']} subtitulo="¿Cuánto vendo y a quién? Ventas, objetivos, ticket medio y repetición" />
      </div>

      <TabsPastilla tabs={TABS} activeId={tab} onChange={id => selectTab(id as TabId)} />

      <div style={{ height: 16 }} />

      {tab === 'ventas' && <Ventas embedded />}
      {tab === 'objetivos' && <Objetivos embedded />}
      {tab === 'ticket' && <TicketMedio embedded />}
      {tab === 'repeticion' && <RepeticionClientes embedded />}
    </div>
  )
}
