/**
 * T-M7-03 — Importador
 * Módulo unificado de importación de archivos.
 * Ruta: /importador
 */

import { useEffect, useState } from 'react'
import { FONT } from '@/styles/tokens'
import TabsPastilla from '@/components/ui/TabsPastilla'
import TabSubirV2 from '@/components/importador/TabSubirV2'
import TabHistorico from '@/components/importador/TabHistorico'
import TabPendientes from '@/components/importador/TabPendientes'
import { supabase } from '@/lib/supabase'

type TabId = 'subir' | 'historico' | 'pendientes'

export default function Importador() {
  const [tab, setTab] = useState<TabId>('subir')
  const [refreshKey, setRefreshKey] = useState(0)
  const [pendientesCount, setPendientesCount] = useState(0)

  useEffect(() => {
    supabase
      .from('imports_log')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'revision_manual'])
      .then(({ count }) => setPendientesCount(count ?? 0))
  }, [refreshKey])

  const TABS = [
    { id: 'subir',      label: 'Subir' },
    { id: 'historico',  label: 'Histórico' },
    { id: 'pendientes', label: 'Pendientes sistema', badge: pendientesCount },
  ]

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px', minHeight: '100%' }}>
      {/* Header C.1 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontFamily: FONT.heading,
          fontSize: 22,
          fontWeight: 600,
          color: '#B01D23',
          textTransform: 'uppercase',
          letterSpacing: '3px',
          margin: 0,
        }}>
          IMPORTADOR
        </h1>
        <p style={{ fontFamily: FONT.body, fontSize: 13, color: '#7a8090', marginTop: 4, marginBottom: 0 }}>
          Punto único de entrada de documentación al ERP
        </p>
      </div>

      {/* Tabs pastilla */}
      <TabsPastilla
        tabs={TABS}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {/* Contenido */}
      {tab === 'subir' && (
        <TabSubirV2 />
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
    </div>
  )
}
