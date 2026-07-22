/**
 * ResultadosPage — Módulo "Resultados" (¿gano dinero?).
 */
import { useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Running } from '@/pages/finanzas/Running'
import { PyG } from '@/pages/finanzas/PyG'
import { EstadosFinancieros } from '@/pages/finanzas/EstadosFinancieros'
import { AnalisisHorizontalVertical } from '@/pages/finanzas/AnalisisHorizontalVertical'

const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'

type TabId = 'running' | 'pyg' | 'estados' | 'evolucion'

const TABS: { id: TabId; label: string }[] = [
  { id: 'running', label: 'RUNNING' },
  { id: 'pyg', label: 'P&G' },
  { id: 'estados', label: 'ESTADOS FINANCIEROS' },
  { id: 'evolucion', label: 'EVOLUCIÓN' },
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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(16px,5vw,22px)', fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--sl-text-primary)', margin: 0 }}>
          Resultados
        </h1>
        <p style={{ fontSize: 13, color: 'var(--sl-text-muted)', margin: '4px 0 0' }}>
          ¿Gano dinero? Cuenta de resultados, estados financieros y evolución
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'nowrap', overflowX: 'auto' }}>
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
              backgroundColor: tab === t.id ? 'var(--sl-yellow)' : 'var(--sl-card-alt)',
              color: tab === t.id ? 'var(--sl-text-nav)' : 'var(--sl-text-secondary)',
              boxShadow: tab === t.id ? NEO_SHADOW : 'none',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'running' && <Running embedded />}
      {tab === 'pyg' && <PyG embedded />}
      {tab === 'estados' && <EstadosFinancieros embedded />}
      {tab === 'evolucion' && <AnalisisHorizontalVertical embedded />}
    </div>
  )
}
