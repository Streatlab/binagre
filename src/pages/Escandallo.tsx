import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente, Merma, EPS, Receta } from '@/components/escandallo/types'
import TabIngredientes from '@/components/escandallo/TabIngredientes'
import TabMermas from '@/components/escandallo/TabMermas'
import TabEPS from '@/components/escandallo/TabEPS'
import TabRecetas from '@/components/escandallo/TabRecetas'
import ModalEPS from '@/components/escandallo/ModalEPS'
import ModalReceta from '@/components/escandallo/ModalReceta'

type Tab = 'ingredientes' | 'mermas' | 'eps' | 'recetas'

const TABS: { key: Tab; label: string }[] = [
  { key: 'ingredientes', label: 'Ingredientes' },
  { key: 'mermas', label: 'Mermas' },
  { key: 'eps', label: 'EPS' },
  { key: 'recetas', label: 'Recetas' },
]

export default function Escandallo() {
  const [tab, setTab] = useState<Tab>('ingredientes')
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [mermas, setMermas] = useState<Merma[]>([])
  const [epsList, setEpsList] = useState<EPS[]>([])
  const [recetasList, setRecetasList] = useState<Receta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const [modalEPS, setModalEPS] = useState<{ open: boolean; eps: EPS | null }>({ open: false, eps: null })
  const [modalReceta, setModalReceta] = useState<{ open: boolean; receta: Receta | null }>({ open: false, receta: null })

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [ingRes, merRes, epsRes, recRes] = await Promise.all([
        supabase.from('ingredientes').select('*').order('nombre'),
        supabase.from('mermas').select('*').order('nombre'),
        supabase.from('eps').select('*').order('nombre'),
        supabase.from('recetas').select('*').order('nombre'),
      ])
      if (ingRes.error) throw ingRes.error
      if (merRes.error) throw merRes.error
      if (epsRes.error) throw epsRes.error
      if (recRes.error) throw recRes.error
      setIngredientes(ingRes.data ?? [])
      setMermas(merRes.data ?? [])
      setEpsList(epsRes.data ?? [])
      setRecetasList(recRes.data ?? [])
    } catch (e: any) {
      setError(e.message || 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const q = busqueda.toLowerCase()
  const filteredIng = ingredientes.filter(i => i.nombre?.toLowerCase().includes(q))
  const filteredMermas = mermas.filter(m => m.nombre?.toLowerCase().includes(q))
  const filteredEps = epsList.filter(e => e.nombre?.toLowerCase().includes(q))
  const filteredRec = recetasList.filter(r => r.nombre?.toLowerCase().includes(q))

  const handleSaved = () => {
    setModalEPS({ open: false, eps: null })
    setModalReceta({ open: false, receta: null })
    fetchData()
  }

  const showNewBtn = tab === 'eps' || tab === 'recetas'

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-lg font-semibold text-white">Escandallo</h2>
        {showNewBtn && (
          <button
            onClick={() => tab === 'eps'
              ? setModalEPS({ open: true, eps: null })
              : setModalReceta({ open: true, receta: null })
            }
            className="px-4 py-2 text-sm font-semibold bg-accent text-black rounded-lg hover:brightness-110 transition"
          >
            + {tab === 'eps' ? 'Nueva EPS' : 'Nueva Receta'}
          </button>
        )}
      </div>

      {/* Tabs + Buscador */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setBusqueda('') }}
              className={'px-3 py-1.5 text-sm font-medium rounded-md transition ' +
                (tab === t.key ? 'bg-accent text-black' : 'text-neutral-400 hover:text-white')
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-accent"
          placeholder="Buscar…"
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
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={fetchData} className="mt-3 text-xs text-accent underline">Reintentar</button>
        </div>
      ) : (
        <>
          {tab === 'ingredientes' && <TabIngredientes ingredientes={filteredIng} />}
          {tab === 'mermas' && <TabMermas mermas={filteredMermas} />}
          {tab === 'eps' && <TabEPS epsList={filteredEps} onSelect={eps => setModalEPS({ open: true, eps })} />}
          {tab === 'recetas' && <TabRecetas recetasList={filteredRec} onSelect={receta => setModalReceta({ open: true, receta })} />}
        </>
      )}

      {/* Modales */}
      {modalEPS.open && (
        <ModalEPS
          eps={modalEPS.eps}
          ingredientes={ingredientes}
          onClose={() => setModalEPS({ open: false, eps: null })}
          onSaved={handleSaved}
        />
      )}
      {modalReceta.open && (
        <ModalReceta
          receta={modalReceta.receta}
          ingredientes={ingredientes}
          epsList={epsList}
          onClose={() => setModalReceta({ open: false, receta: null })}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
