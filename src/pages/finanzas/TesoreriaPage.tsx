/**
 * TesoreriaPage — Módulo "Tesorería" (¿tengo dinero?).
 * Aplana las 4 sub-pestañas del antiguo Pagos y Cobros a primer nivel y añade
 * 13 Semanas, Escenarios y Salud Financiera (antes Fondo de Maniobra).
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { TabCalendario, TabGastos, TabHistorial } from '@/pages/PagosCobros'
import { FondoReserva } from '@/components/tesoreria/FondoReserva'
import Tesoreria13Semanas from '@/pages/finanzas/Tesoreria13Semanas'
import { EscenariosTesoreria } from '@/pages/finanzas/EscenariosTesoreria'
import { FondoManiobra } from '@/pages/finanzas/FondoManiobra'

const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'

type TabId = 'calendario' | 'gastos' | 'reserva' | 'historial' | '13semanas' | 'escenarios' | 'salud'

const TABS: { id: TabId; label: string }[] = [
  { id: 'calendario', label: 'CALENDARIO' },
  { id: 'gastos', label: 'GASTOS FIJOS' },
  { id: 'reserva', label: 'FONDO & RESERVA' },
  { id: 'historial', label: 'HISTORIAL' },
  { id: '13semanas', label: '13 SEMANAS' },
  { id: 'escenarios', label: 'ESCENARIOS' },
  { id: 'salud', label: 'SALUD FINANCIERA' },
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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(16px,5vw,22px)', fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--sl-text-primary)', margin: 0 }}>
          Tesorería
        </h1>
        <p style={{ fontSize: 13, color: 'var(--sl-text-muted)', margin: '4px 0 0' }}>
          ¿Tengo dinero? Cobros, pagos, fondo de reserva y proyección de caja
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' as CSSProperties['scrollbarWidth'], WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => selectTab(t.id)}
            style={{
              flex: '0 0 auto',
              fontFamily: 'Oswald, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: 'uppercase',
              padding: '10px 18px',
              minHeight: 44,
              borderRadius: 0,
              border: `3px solid ${NEO_INK}`,
              cursor: 'pointer',
              backgroundColor: tab === t.id ? '#e8f442' : 'var(--sl-card-alt)',
              color: tab === t.id ? '#111111' : 'var(--sl-text-secondary)',
              boxShadow: tab === t.id ? NEO_SHADOW : 'none',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'calendario' && <TabCalendario />}
      {tab === 'gastos' && <TabGastos />}
      {tab === 'reserva' && <FondoReserva embedded />}
      {tab === 'historial' && <TabHistorial />}
      {tab === '13semanas' && <Tesoreria13Semanas />}
      {tab === 'escenarios' && <EscenariosTesoreria embedded />}
      {tab === 'salud' && <FondoManiobra embedded />}
    </div>
  )
}
