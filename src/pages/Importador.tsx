/**
 * T-M7-03 — Importador
 * Módulo unificado de importación de archivos.
 * Ruta: /importador
 */

import { useState } from 'react'
import { useTheme, FONT, groupStyle } from '@/styles/tokens'
import TabConciliacion from '@/components/ui/TabConciliacion'
import TabSubir from '@/components/importador/TabSubir'
import TabHistorico from '@/components/importador/TabHistorico'
import TabPendientes from '@/components/importador/TabPendientes'
import TabResumenes from '@/components/importador/TabResumenes'

type TabId = 'subir' | 'historico' | 'pendientes' | 'resumenes'

const TABS: { id: TabId; label: string }[] = [
  { id: 'subir',      label: 'Subir' },
  { id: 'historico',  label: 'Histórico' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'resumenes',  label: 'Resúmenes plataforma' },
]

export default function Importador() {
  const { T } = useTheme()
  const [tab, setTab] = useState<TabId>('subir')
  const [refreshKey, setRefreshKey] = useState(0)

  function handleUploadSuccess() {
    setRefreshKey(k => k + 1)
  }

  return (
    <div style={{ ...groupStyle(T), padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: FONT.heading,
          fontSize: 22,
          fontWeight: 600,
          color: '#B01D23',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          margin: 0,
        }}>
          IMPORTADOR
        </h1>
        <p style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 4 }}>
          Importación unificada: facturas, extractos, resúmenes de plataforma, nóminas y CSV de ventas.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 24 }}>
        <TabConciliacion
          tabs={TABS}
          activeId={tab}
          onChange={(id) => setTab(id as TabId)}
        />
      </div>

      {/* Contenido */}
      {tab === 'subir' && (
        <TabSubir onUploadSuccess={handleUploadSuccess} />
      )}
      {tab === 'historico' && (
        <TabHistorico refresh={refreshKey} />
      )}
      {tab === 'pendientes' && (
        <TabPendientes
          refresh={refreshKey}
          onRefresh={() => setRefreshKey(k => k + 1)}
        />
      )}
      {tab === 'resumenes' && (
        <TabResumenes refresh={refreshKey} />
      )}
    </div>
  )
}
