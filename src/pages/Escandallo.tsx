import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente, Merma, EPS, Receta } from '@/components/escandallo/types'
import TabIndice from '@/components/escandallo/TabIndice'
import TabIngredientes from '@/components/escandallo/TabIngredientes'
import TabMermas from '@/components/escandallo/TabMermas'
import TabEPS from '@/components/escandallo/TabEPS'
import TabRecetas from '@/components/escandallo/TabRecetas'
import TabsPastilla from '@/components/ui/TabsPastilla'
import ModalEPS from '@/components/escandallo/ModalEPS'
import ModalReceta from '@/components/escandallo/ModalReceta'
import ModalIngrediente from '@/components/escandallo/ModalIngrediente'
import ModalMerma from '@/components/escandallo/ModalMerma'

type Tab = 'indice' | 'ingredientes' | 'mermas' | 'eps' | 'recetas'

const TABS: { id: Tab; label: string }[] = [
  { id: 'indice', label: 'Índice' },
  { id: 'ingredientes', label: 'Ingredientes' },
  { id: 'mermas', label: 'Mermas' },
  { id: 'eps', label: 'EPS' },
  { id: 'recetas', label: 'Recetas' },
]

export default function Escandallo() {
  const [tab, setTab] = useState<Tab>('indice')
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [mermas, setMermas] = useState<Merma[]>([])
  const [epsList, setEpsList] = useState<EPS[]>([])
  const [recetasList, setRecetasList] = useState<Receta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const [modalEPS, setModalEPS] = useState<{ open: boolean; eps: EPS | null }>({ open: false, eps: null })
  const [modalReceta, setModalReceta] = useState<{ open: boolean; receta: Receta | null }>({ open: false, receta: null })
  const [modalIng, setModalIng] = useState<{ open: boolean; ing: Ingrediente | null }>({ open: false, ing: null })
  const [modalMerma, setModalMerma] = useState<{ open: boolean; merma: Merma | null }>({ open: false, merma: null })

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [ingRes, merRes, epsRes, recRes, recLinRes] = await Promise.all([
        supabase.from('ingredientes').select('*').order('nombre_base', { nullsFirst: false }).order('nombre'),
        supabase.from('mermas').select('*').order('nombre_base', { nullsFirst: false }),
        supabase.from('eps').select('*').order('codigo', { nullsFirst: false }).order('nombre'),
        supabase.from('recetas').select('*').order('codigo', { nullsFirst: false }).order('nombre'),
        supabase.from('recetas_lineas').select('eps_id').not('eps_id', 'is', null),
      ])
      if (ingRes.error) throw ingRes.error
      if (merRes.error) throw merRes.error
      if (epsRes.error) throw epsRes.error
      if (recRes.error) throw recRes.error
      const usosEps: Record<string, number> = {}
      ;(recLinRes.data ?? []).forEach(l => {
        if (!l.eps_id) return
        usosEps[l.eps_id] = (usosEps[l.eps_id] ?? 0) + 1
      })
      setIngredientes(ingRes.data ?? [])
      setMermas(merRes.data ?? [])
      setEpsList((epsRes.data ?? []).map(e => ({ ...e, usos: usosEps[e.id] ?? 0 })))
      setRecetasList(recRes.data ?? [])
    } catch (e: any) {
      setError(e.message || 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSaved = () => {
    setModalEPS({ open: false, eps: null })
    setModalReceta({ open: false, receta: null })
    setModalIng({ open: false, ing: null })
    setModalMerma({ open: false, merma: null })
    fetchData()
  }

  const handleIngSaved = () => {
    setModalIng({ open: false, ing: null })
    fetchData()
  }

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ color: '#B01D23', fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 600, letterSpacing: '3px', margin: 0, textTransform: 'uppercase' }}>ESCANDALLO</h2>
      </div>

      {/* Subtabs estilo Conciliación + buscador */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <TabsPastilla
          tabs={TABS.map(t => ({ id: t.id, label: t.label }))}
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

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-xl p-8 text-center">
          <p className="text-[#dc2626] text-sm">{error}</p>
          <button onClick={fetchData} className="mt-3 text-xs text-[var(--sl-text-primary)] underline">Reintentar</button>
        </div>
      ) : (
        <>
          {tab === 'indice' && (
            <TabIndice
              epsList={epsList}
              recetasList={recetasList}
              busqueda={busqueda}
              onOpenEps={eps => setModalEPS({ open: true, eps })}
              onOpenReceta={receta => setModalReceta({ open: true, receta })}
            />
          )}
          {tab === 'ingredientes' && (
            <TabIngredientes
              ingredientes={ingredientes}
              busqueda={busqueda}
              onSelect={ing => setModalIng({ open: true, ing })}
              onNew={() => setModalIng({ open: true, ing: null })}
            />
          )}
          {tab === 'mermas' && (
            <TabMermas
              mermas={mermas}
              busqueda={busqueda}
              onSelect={merma => setModalMerma({ open: true, merma })}
              onNew={() => setModalMerma({ open: true, merma: null })}
            />
          )}
          {tab === 'eps' && (
            <TabEPS
              epsList={epsList}
              busqueda={busqueda}
              onSelect={eps => setModalEPS({ open: true, eps })}
              onNew={() => setModalEPS({ open: true, eps: null })}
            />
          )}
          {tab === 'recetas' && (
            <TabRecetas
              recetasList={recetasList}
              busqueda={busqueda}
              onSelect={receta => setModalReceta({ open: true, receta })}
              onNew={() => setModalReceta({ open: true, receta: null })}
            />
          )}
        </>
      )}

      {modalEPS.open && (
        <ModalEPS
          eps={modalEPS.eps}
          ingredientes={ingredientes}
          onClose={() => setModalEPS({ open: false, eps: null })}
          onSaved={handleSaved}
          onDelete={handleSaved}
        />
      )}
      {modalReceta.open && (
        <ModalReceta
          receta={modalReceta.receta}
          ingredientes={ingredientes}
          epsList={epsList}
          onClose={() => setModalReceta({ open: false, receta: null })}
          onSaved={handleSaved}
          onDelete={handleSaved}
        />
      )}
      {modalIng.open && (
        <ModalIngrediente
          ingrediente={modalIng.ing}
          onClose={() => setModalIng({ open: false, ing: null })}
          onSaved={handleIngSaved}
          onDelete={handleSaved}
          onOpenMerma={merma => { setModalIng({ open: false, ing: null }); setModalMerma({ open: true, merma }); fetchData() }}
        />
      )}
      {modalMerma.open && (
        <ModalMerma
          merma={modalMerma.merma}
          onClose={() => setModalMerma({ open: false, merma: null })}
          onSaved={handleSaved}
          onDelete={handleSaved}
        />
      )}
    </div>
  )
}
