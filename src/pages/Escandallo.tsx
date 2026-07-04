import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente, Merma, EPS, Receta } from '@/components/escandallo/types'
import TabIndice from '@/components/escandallo/TabIndice'
import TabIngredientes from '@/components/escandallo/TabIngredientes'
import TabMermas from '@/components/escandallo/TabMermas'
import TabEPS from '@/components/escandallo/TabEPS'
import TabRecetas from '@/components/escandallo/TabRecetas'
import ModalEPS from '@/components/escandallo/ModalEPS'
import ModalReceta from '@/components/escandallo/ModalReceta'
import ModalIngrediente from '@/components/escandallo/ModalIngrediente'
import ModalMerma from '@/components/escandallo/ModalMerma'
import { INK, CREMA, SHADOW, BORDER_CARD, OSW, LEX, AMA, ROSA, GRANATE, ROJO } from '@/styles/neobrutal'

type Tab = 'indice' | 'ingredientes' | 'mermas' | 'eps' | 'recetas'
const TAB_KEY = 'sl_fichas_tab'
const esTab = (v: string | null): v is Tab => v === 'indice' || v === 'ingredientes' || v === 'mermas' || v === 'eps' || v === 'recetas'

const TABS: { id: Tab; label: string; count: (d: Data) => number }[] = [
  { id: 'indice', label: 'Índice', count: d => d.epsList.length + d.recetasList.length },
  { id: 'ingredientes', label: 'Ingredientes', count: d => d.ingredientes.length },
  { id: 'mermas', label: 'Mermas', count: d => d.mermas.length },
  { id: 'eps', label: 'EPS', count: d => d.epsList.length },
  { id: 'recetas', label: 'Recetas', count: d => d.recetasList.length },
]

interface Data {
  ingredientes: Ingrediente[]
  mermas: Merma[]
  epsList: EPS[]
  recetasList: Receta[]
}

export default function Escandallo() {
  const [tab, setTab] = useState<Tab>(() => { const s = localStorage.getItem(TAB_KEY); return esTab(s) ? s : 'indice' })
  useEffect(() => { localStorage.setItem(TAB_KEY, tab) }, [tab])

  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [mermas, setMermas] = useState<Merma[]>([])
  const [epsList, setEpsList] = useState<EPS[]>([])
  const [recetasList, setRecetasList] = useState<Receta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState(() => localStorage.getItem('sl_fichas_busqueda') ?? '')
  useEffect(() => { localStorage.setItem('sl_fichas_busqueda', busqueda) }, [busqueda])

  const [modalEPS, setModalEPS] = useState<{ open: boolean; eps: EPS | null }>({ open: false, eps: null })
  const [modalReceta, setModalReceta] = useState<{ open: boolean; receta: Receta | null }>({ open: false, receta: null })
  const [modalIng, setModalIng] = useState<{ open: boolean; ing: Ingrediente | null }>({ open: false, ing: null })
  const [modalMerma, setModalMerma] = useState<{ open: boolean; merma: Merma | null }>({ open: false, merma: null })

  const data: Data = { ingredientes, mermas, epsList, recetasList }

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
    <div style={{ background: CREMA, minHeight: '100%' }}>
      {/* ===== MARCO: cabecera clara + pestañas rosas (folder) ===== */}
      <div style={{ background: CREMA, padding: '22px 32px 0', borderBottom: `4px solid ${INK}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ fontFamily: OSW, fontWeight: 700, fontSize: 'clamp(26px,3.2vw,40px)', lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color: GRANATE, margin: 0 }}>Escandallo</h2>
          <span style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: INK }}>Banco de trabajo · Comer bien, aquí y ahora</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const on = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: OSW, fontWeight: 700, fontSize: 13.5, letterSpacing: '0.5px',
                  textTransform: 'uppercase', padding: on ? '11px 18px 15px' : '11px 18px',
                  cursor: 'pointer', border: `3px solid ${INK}`, borderBottom: 'none', borderRadius: 0,
                  background: on ? ROSA : '#ffffff', color: on ? '#ffffff' : INK,
                  position: 'relative', top: on ? 0 : 4, marginBottom: -4,
                }}
              >
                {t.label}
                <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 11, padding: '1px 6px', background: on ? '#fff' : INK, color: on ? ROSA : '#fff' }}>{t.count(data)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ===== CONTENIDO (cada pestaña trae su propia cabecera amarilla con buscador) ===== */}
      <div style={{ padding: '24px 32px 40px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <div style={{ height: 28, width: 28, border: `3px solid ${INK}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ background: '#ffffff', border: BORDER_CARD, boxShadow: SHADOW, padding: 28, textAlign: 'center' }}>
            <p style={{ fontFamily: LEX, color: ROJO, fontSize: 14, margin: 0 }}>{error}</p>
            <button onClick={fetchData} style={{ marginTop: 12, fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', background: AMA, color: INK, border: `2px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, padding: '6px 14px', cursor: 'pointer' }}>Reintentar</button>
          </div>
        ) : (
          <>
            {tab === 'indice' && (
              <TabIndice
                epsList={epsList}
                recetasList={recetasList}
                busqueda={busqueda}
                onBuscar={setBusqueda}
                onOpenEps={eps => setModalEPS({ open: true, eps })}
                onOpenReceta={receta => setModalReceta({ open: true, receta })}
              />
            )}
            {tab === 'ingredientes' && (
              <TabIngredientes
                ingredientes={ingredientes}
                busqueda={busqueda}
                onBuscar={setBusqueda}
                onSelect={ing => setModalIng({ open: true, ing })}
                onNew={() => setModalIng({ open: true, ing: null })}
              />
            )}
            {tab === 'mermas' && (
              <TabMermas
                mermas={mermas}
                busqueda={busqueda}
                onBuscar={setBusqueda}
                onSelect={merma => setModalMerma({ open: true, merma })}
                onNew={() => setModalMerma({ open: true, merma: null })}
              />
            )}
            {tab === 'eps' && (
              <TabEPS
                epsList={epsList}
                busqueda={busqueda}
                onBuscar={setBusqueda}
                onSelect={eps => setModalEPS({ open: true, eps })}
                onNew={() => setModalEPS({ open: true, eps: null })}
              />
            )}
            {tab === 'recetas' && (
              <TabRecetas
                recetasList={recetasList}
                busqueda={busqueda}
                onBuscar={setBusqueda}
                onSelect={receta => setModalReceta({ open: true, receta })}
                onNew={() => setModalReceta({ open: true, receta: null })}
              />
            )}
          </>
        )}
      </div>

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
