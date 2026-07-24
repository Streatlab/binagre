import { useState, useEffect } from 'react'
import TabsPastilla from '@/components/ui/TabsPastilla'
import TabFichas from '@/components/escandallo/TabFichas'
import ColaRevisionFichas from '@/components/escandallo/ColaRevisionFichas'
import { HeroCantera, PantallaCantera } from '@/components/kit/cantera'
import { BuscadorCantera } from '@/components/kit/controles'

type Tab = 'eps' | 'recetas'

const TABS = [
  { id: 'eps', label: 'EPs' },
  { id: 'recetas', label: 'Recetas' },
]

export default function Recetario() {
  const [tab, setTab] = useState<Tab>('eps')
  const [busqueda, setBusqueda] = useState(() => localStorage.getItem('sl_fichas_busqueda') ?? '')
  useEffect(() => { localStorage.setItem('sl_fichas_busqueda', busqueda) }, [busqueda])

  return (
    <PantallaCantera embedded>
      {/* HÉROE (naranja · área Cocina) — pantalla-lista sin KPI: titular + resumen, sin cifra */}
      <HeroCantera
        area="cocina"
        titular="La base de todo el escandallo: cada plato parte de una ficha técnica."
        resumen="Fichas de EPs y recetas listas para enlazar, imprimir y mantener al día."
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <TabsPastilla
          tabs={TABS}
          activeId={tab}
          onChange={(id) => setTab(id as Tab)}
        />
        <BuscadorCantera value={busqueda} onChange={setBusqueda} placeholder="Buscar ficha, código o ingrediente…" />
      </div>

      <ColaRevisionFichas />

      <TabFichas busqueda={busqueda} tipo={tab === 'eps' ? 'ep' : 'receta'} />
    </PantallaCantera>
  )
}
