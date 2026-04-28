import { useEffect, useState, useCallback } from 'react'
import { useTheme, groupStyle, tituloPaginaStyle } from '@/styles/tokens'
import TabConciliacion from '@/components/ui/TabConciliacion'
import TabCalendario from '@/components/tareas/TabCalendario'
import TabListaPendientes from '@/components/tareas/TabListaPendientes'
import TabConfigTareas from '@/components/tareas/TabConfigTareas'
import { generarPendientes } from '@/lib/tareas/generarPendientes'
import { supabase } from '@/lib/supabase'

const TABS = [
  { id: 'calendario',   label: 'Calendario' },
  { id: 'pendientes',   label: 'Lista pendientes' },
  { id: 'configuracion',label: 'Configuración tareas' },
]

export default function Tareas() {
  const { T } = useTheme()
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
    <div style={{ fontFamily: 'Lexend, sans-serif' }}>
      <div style={groupStyle(T)}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ ...tituloPaginaStyle(T), margin: 0, fontSize: 22, letterSpacing: '3px' }}>
            TAREAS PENDIENTES
          </span>
          {nPendientes > 0 && (
            <span style={{
              background: '#B01D23',
              color: '#ffffff',
              borderRadius: 10,
              padding: '2px 10px',
              fontSize: 12,
              fontFamily: 'Lexend, sans-serif',
              fontWeight: 600,
            }}>{nPendientes}</span>
          )}
          {generando && (
            <div className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Tabs */}
        <TabConciliacion tabs={TABS} activeId={tab} onChange={setTab} />

        {/* Contenido */}
        <div style={{ marginTop: 20 }}>
          {tab === 'calendario'    && <TabCalendario />}
          {tab === 'pendientes'    && <TabListaPendientes onRefresh={cargarCount} />}
          {tab === 'configuracion' && <TabConfigTareas />}
        </div>
      </div>
    </div>
  )
}
