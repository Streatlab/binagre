/**
 * ResultadosPage — Módulo "Resultados" (¿gano dinero?).
 */
import { useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import RutaPantalla from '@/components/ui/RutaPantalla'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { Running } from '@/pages/finanzas/Running'
import { PyG } from '@/pages/finanzas/PyG'
import { EstadosFinancieros } from '@/pages/finanzas/EstadosFinancieros'
import { AnalisisHorizontalVertical } from '@/pages/finanzas/AnalisisHorizontalVertical'

type TabId = 'running' | 'pyg' | 'estados' | 'evolucion'

const TABS: { id: TabId; label: string }[] = [
  { id: 'running', label: 'Running' },
  { id: 'pyg', label: 'P&G' },
  { id: 'estados', label: 'Estados financieros' },
  { id: 'evolucion', label: 'Evolución' },
]
const VALID_TABS: TabId[] = TABS.map(t => t.id)

export default function ResultadosPage() {
  const [tab, setTab] = useState<TabId>(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    return (q && VALID_TABS.includes(q as TabId)) ? (q as TabId) : 'running'
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
        <RutaPantalla niveles={['Resultados', TABS.find(t => t.id === tab)?.label ?? '']} subtitulo="¿Gano dinero? Cuenta de resultados, estados financieros y evolución" />
      </div>

      <TabsPastilla tabs={TABS} activeId={tab} onChange={id => selectTab(id as TabId)} />

      <div style={{ height: 16 }} />

      {tab === 'running' && <Running embedded />}
      {tab === 'pyg' && <PyG embedded />}
      {tab === 'estados' && <EstadosFinancieros embedded />}
      {tab === 'evolucion' && <AnalisisHorizontalVertical embedded />}
    </div>
  )
}
