import { useState, useEffect } from 'react'
import TabsPastilla from '@/components/ui/TabsPastilla'
import TabFichas from '@/components/escandallo/TabFichas'
import ColaRevisionFichas from '@/components/escandallo/ColaRevisionFichas'
import { HeroCantera, PantallaCantera } from '@/components/kit/cantera'

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
        <input
          className="flex-1 bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-lg px-3 py-2 text-sm text-[var(--sl-text-primary)] placeholder:text-[var(--sl-text-muted)] focus:outline-none focus:border-accent"
          placeholder="Buscar..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      <ColaRevisionFichas />

      <TabFichas busqueda={busqueda} tipo={tab === 'eps' ? 'ep' : 'receta'} />
    </PantallaCantera>
  )
}
