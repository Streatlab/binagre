import { BLANCO, GRANATE, NAR } from '@/styles/neobrutal'
import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import RutaPantalla from '@/components/ui/RutaPantalla'
import TabsPastilla from '@/components/ui/TabsPastilla'
import TabCalendario from '@/components/tareas/TabCalendario'
import TabListaPendientes from '@/components/tareas/TabListaPendientes'
import TabConfigTareas from '@/components/tareas/TabConfigTareas'
import { generarPendientes } from '@/lib/tareas/generarPendientes'
import { supabase } from '@/lib/supabase'
import { HeroCantera, PantallaCantera, Papel, FrasePotente } from '@/components/kit/cantera'

const NEO_INK = 'var(--neo-ink)'
const NEO_SHADOW = '4px 4px 0 var(--neo-shadow-color)'
const NEO_CARD: CSSProperties = { border: `3px solid ${NEO_INK}`, borderRadius: 0, boxShadow: NEO_SHADOW }

const TABS = [
  { id: 'calendario',   label: 'Calendario' },
  { id: 'pendientes',   label: 'Lista pendientes' },
  { id: 'configuracion',label: 'Configuración tareas' },
]

export default function Tareas() {
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
    <PantallaCantera style={{ padding: isMobile ? '14px 12px' : undefined }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <RutaPantalla niveles={['Tareas', TABS.find(t => t.id === tab)?.label ?? '']} />
        {generando && (
          <div className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* HÉROE (naranja · área Ops) */}
      {!generando && (
        <HeroCantera
          area="ops"
          titular={nPendientes > 0
            ? `Tienes ${nPendientes} tarea${nPendientes === 1 ? '' : 's'} pendiente${nPendientes === 1 ? '' : 's'} por resolver.`
            : 'Todo al día: no hay tareas pendientes ni atrasadas.'}
          cifra={nPendientes > 0 ? String(nPendientes) : undefined}
          etiquetaDato={nPendientes > 0 ? 'Pendientes y atrasadas' : undefined}
        />
      )}

      {/* FRASE POTENTE (1 por pantalla, distinta del héroe naranja) */}
      {!generando && (
        nPendientes > 3
          ? <FrasePotente significado="peligro">Con {nPendientes} tareas acumuladas, hoy toca despejar bandeja antes de que se conviertan en atrasadas.</FrasePotente>
          : nPendientes > 0
            ? <FrasePotente significado="coste">Quedan {nPendientes} tareas sueltas: ciérralas hoy y empiezas la semana limpia.</FrasePotente>
            : <FrasePotente significado="logro">Bandeja de tareas al día: buen momento para revisar la configuración periódica.</FrasePotente>
      )}

      {/* Contenido — papel sin sombra */}
      <Papel ceja={NAR} style={{ overflowX: 'auto' }}>
        <TabsPastilla tabs={TABS} activeId={tab} onChange={setTab} />

        <div style={{ height: 16 }} />

        {tab === 'calendario'    && <TabCalendario />}
        {tab === 'pendientes'    && <TabListaPendientes onRefresh={cargarCount} />}
        {tab === 'configuracion' && <TabConfigTareas />}
      </Papel>
    </PantallaCantera>
  )
}
