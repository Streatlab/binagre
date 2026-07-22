import { GRANATE } from '@/styles/neobrutal'
import { useState, useEffect } from 'react'
import { ChefHat } from 'lucide-react'
import TabsPastilla from '@/components/ui/TabsPastilla'
import TabFichas from '@/components/escandallo/TabFichas'
import ColaRevisionFichas from '@/components/escandallo/ColaRevisionFichas'
import { useTheme, FONT } from '@/styles/tokens'

type Tab = 'eps' | 'recetas'

const TABS = [
  { id: 'eps', label: 'EPs' },
  { id: 'recetas', label: 'Recetas' },
]

export default function Recetario() {
  const { T } = useTheme()
  const [tab, setTab] = useState<Tab>('eps')
  const [busqueda, setBusqueda] = useState(() => localStorage.getItem('sl_fichas_busqueda') ?? '')
  useEffect(() => { localStorage.setItem('sl_fichas_busqueda', busqueda) }, [busqueda])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ChefHat size={24} color={GRANATE} />
        <div style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', color: GRANATE, textTransform: 'uppercase' }}>
          Libro de Recetas
        </div>
      </div>

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
    </div>
  )
}
