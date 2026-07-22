/**
 * PapeleoPage — Módulo "Papeleo" (facturas y banco).
 *
 * Facturacion.tsx y Documentacion.tsx son piezas grandes y de uso diario
 * (OCR, bandeja de pendientes). Para no arriesgar su funcionamiento se
 * montan tal cual dentro de cada pestaña, sin tocar su lógica ni su
 * maquetación interna (puede quedar algo de doble padding).
 */
import { useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import Documentacion from '@/pages/finanzas/Documentacion'
import Facturacion from '@/pages/Facturacion'
import ConciliacionSwitch from '@/pages/switch/ConciliacionSwitch'
import GestionFacturas from '@/pages/finanzas/GestionFacturas'
import Gestoria from '@/pages/finanzas/Gestoria'
import ImportarPlataformas from '@/pages/finanzas/ImportarPlataformas'

const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'

type TabId = 'bandeja' | 'facturacion' | 'conciliacion' | 'gestion' | 'gestoria' | 'importar'

const TABS: { id: TabId; label: string }[] = [
  { id: 'bandeja', label: 'BANDEJA' },
  { id: 'facturacion', label: 'FACTURACIÓN' },
  { id: 'conciliacion', label: 'CONCILIACIÓN' },
  { id: 'gestion', label: 'GESTIÓN DE FACTURAS' },
  { id: 'gestoria', label: 'GESTORÍA' },
  { id: 'importar', label: 'IMPORTAR PLATAFORMAS' },
]
const VALID_TABS: TabId[] = TABS.map(t => t.id)

export default function PapeleoPage() {
  const [tab, setTab] = useState<TabId>(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    return (q && VALID_TABS.includes(q as TabId)) ? (q as TabId) : 'bandeja'
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
          Papeleo
        </h1>
        <p style={{ fontSize: 13, color: 'var(--sl-text-muted)', margin: '4px 0 0' }}>
          Facturas y banco: bandeja, facturación, conciliación y gestoría
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

      {tab === 'bandeja' && <Documentacion />}
      {tab === 'facturacion' && <Facturacion />}
      {tab === 'conciliacion' && <ConciliacionSwitch />}
      {tab === 'gestion' && <GestionFacturas />}
      {tab === 'gestoria' && <Gestoria />}
      {tab === 'importar' && <ImportarPlataformas />}
    </div>
  )
}
