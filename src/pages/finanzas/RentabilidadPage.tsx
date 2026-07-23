/**
 * RentabilidadPage — Módulo "Rentabilidad" (¿dónde gano y dónde pierdo?).
 */
import { useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import RutaPantalla from '@/components/ui/RutaPantalla'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { PuntoEquilibrio } from '@/pages/finanzas/PuntoEquilibrio'
import { BreakEvenCanal } from '@/pages/finanzas/BreakEvenCanal'
import { RoiCanal } from '@/pages/finanzas/RoiCanal'
import { RentabilidadFranja } from '@/pages/analytics/RentabilidadFranja'

type TabId = 'equilibrio' | 'marca-canal' | 'roi' | 'franja'

const TABS: { id: TabId; label: string }[] = [
  { id: 'equilibrio', label: 'Punto de equilibrio' },
  { id: 'marca-canal', label: 'Por marca y canal' },
  { id: 'roi', label: 'ROI por canal' },
  { id: 'franja', label: 'Por franja horaria' },
]
const VALID_TABS: TabId[] = TABS.map(t => t.id)

export default function RentabilidadPage() {
  const [tab, setTab] = useState<TabId>(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    return (q && VALID_TABS.includes(q as TabId)) ? (q as TabId) : 'equilibrio'
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
        <RutaPantalla niveles={['Rentabilidad', TABS.find(t => t.id === tab)?.label ?? '']} subtitulo="¿Dónde gano y dónde pierdo? Equilibrio, marca, canal y franja horaria" />
      </div>

      <TabsPastilla tabs={TABS} activeId={tab} onChange={id => selectTab(id as TabId)} />

      <div style={{ height: 16 }} />

      {tab === 'equilibrio' && <PuntoEquilibrio embedded />}
      {tab === 'marca-canal' && <BreakEvenCanal embedded />}
      {tab === 'roi' && <RoiCanal embedded />}
      {tab === 'franja' && <RentabilidadFranja embedded />}
    </div>
  )
}
