import { BLANCO, GRANATE } from '@/styles/neobrutal'
import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { useTheme, groupStyle, tituloPaginaStyle } from '@/styles/tokens'
import { useIsMobile } from '@/hooks/useIsMobile'
import TabConciliacion from '@/components/ui/TabConciliacion'
import TabCalendario from '@/components/tareas/TabCalendario'
import TabListaPendientes from '@/components/tareas/TabListaPendientes'
import TabConfigTareas from '@/components/tareas/TabConfigTareas'
import { generarPendientes } from '@/lib/tareas/generarPendientes'
import { supabase } from '@/lib/supabase'

const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'
const NEO_CARD: CSSProperties = { border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW }

const TABS = [
  { id: 'calendario',   label: 'Calendario' },
  { id: 'pendientes',   label: 'Lista pendientes' },
  { id: 'configuracion',label: 'Configuración tareas' },
]

export default function Tareas() {
  const { T } = useTheme()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState('calendario')
  const [nPendientes, setNPendientes] = useState(0)
  const [generando, setGenerando] = useState(true)

  const cargarCount = useCallback(async () => {
    const { count } = await supabase
      .from('tareas_pendientes')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'atrasada'])
    setNPendientes(count ?? 0)
  }, [])

  useEffect(() => {
    generarPendientes().finally(() => {
      setGenerando(false)
      cargarCount()
    })
  }, [cargarCount])

  return (
    <div style={{ fontFamily: 'Lexend, sans-serif', background: 'var(--neo-bg)', minHeight: '100vh', padding: isMobile ? '14px 12px' : '24px 28px' }}>
      <div style={{ ...groupStyle(T), ...NEO_CARD, padding: isMobile ? '16px 14px' : '24px 28px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <span style={{ ...tituloPaginaStyle(T), margin: 0, fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 800, letterSpacing: '3px' }}>
            TAREAS PENDIENTES
          </span>
          {nPendientes > 0 && (
            <span style={{
              background: GRANATE,
              color: BLANCO,
              ...NEO_CARD,
              padding: '2px 10px',
              fontSize: 13,
              fontFamily: 'Lexend, sans-serif',
              fontWeight: 800,
            }}>{nPendientes}</span>
          )}
          {generando && (
            <div className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <TabConciliacion tabs={TABS} activeId={tab} onChange={setTab} />
        </div>

        {/* Contenido */}
        <div style={{ marginTop: 20, overflowX: 'auto' }}>
          {tab === 'calendario'    && <TabCalendario />}
          {tab === 'pendientes'    && <TabListaPendientes onRefresh={cargarCount} />}
          {tab === 'configuracion' && <TabConfigTareas />}
        </div>
      </div>
    </div>
  )
}
