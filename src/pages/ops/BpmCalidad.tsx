import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { COLORS, COLOR } from '@/components/panel/resumen/tokens'


const BG_OPS = '#111111'
type TipoBpm = 'apertura' | 'cierre' | 'BPM'

interface Plantilla {
  id: string
  tipo: string
  nombre: string
  orden: number
  activo: boolean
}

interface ItemEjecucion {
  id: string
  ejecucion_id: string
  plantilla_id: string | null
  item_nombre: string
  completado: boolean
  completado_at: string | null
}

interface Ejecucion {
  id: string
  fecha: string
  tipo: string
  items_completados: number
  items_totales: number
  completado: boolean
  notas: string | null
}

const TIPOS: TipoBpm[] = ['apertura', 'cierre', 'BPM']
const TIPO_LABELS: Record<TipoBpm, string> = { apertura: 'Apertura', cierre: 'Cierre', BPM: 'BPM / Calidad' }

const DEFAULT_BPM = [
  'Verificar higiene personal del equipo',
  'Comprobar temperatura de almacenamiento frigoríficos',
  'Revisar caducidades de productos',
  'Verificar limpieza de equipos y superficies',
  'Comprobar etiquetado de productos',
  'Revisar stock de productos de limpieza',
  'Verificar formación en alérgenos',
  'Comprobar registros APPCC del día anterior',
  'Revisar registros de temperatura anteriores',
  'Verificar trazabilidad de productos',
]

function localDateStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function fmtHora(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function progressColor(pct: number): string {
  if (pct < 30) return COLORS.redSL
  if (pct < 70) return '#f5a623'
  return COLORS.ok
}

export default function BpmCalidad() {
  const [activeTab, setActiveTab] = useState<TipoBpm>('BPM')
  const [ejecucion, setEjecucion] = useState<Ejecucion | null>(null)
  const [items, setItems] = useState<ItemEjecucion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [modoEdicion, setModoEdicion] = useState(false)
  const [nuevoItemNombre, setNuevoItemNombre] = useState('')
  const [showAddItem, setShowAddItem] = useState(false)

  const cargarChecklist = useCallback(async (tipo: TipoBpm) => {
    setLoading(true)
    setError(null)
    setModoEdicion(false)
    try {
      const hoy = localDateStr()
      const { data: existente, error: e1 } = await supabase
        .from('checklist_ejecuciones').select('*').eq('fecha', hoy).eq('tipo', tipo).maybeSingle()
      if (e1) { if (e1.code === '42P01') { setError('Tablas no encontradas.'); return } throw e1 }

      let ejec: Ejecucion
      if (existente) {
        ejec = existente as Ejecucion
      } else {
        const { data: plantData } = await supabase.from('checklist_plantillas').select('*').eq('tipo', tipo).eq('activo', true).order('orden')
        let tipedPlant = (plantData ?? []) as Plantilla[]

        if (tipedPlant.length === 0 && tipo === 'BPM') {
          const seedItems = DEFAULT_BPM.map((nombre, i) => ({ tipo, nombre, orden: i, activo: true }))
          const { data: seeded } = await supabase.from('checklist_plantillas').insert(seedItems).select()
          tipedPlant = (seeded ?? []) as Plantilla[]
        }

        const nombres = tipedPlant.length > 0 ? tipedPlant.map(p => p.nombre) : (tipo === 'BPM' ? DEFAULT_BPM : [])
        const { data: newEjec, error: e2 } = await supabase
          .from('checklist_ejecuciones').insert({ fecha: hoy, tipo, items_totales: nombres.length, items_completados: 0 }).select().single()
        if (e2) throw e2
        ejec = newEjec as Ejecucion

        if (nombres.length > 0) {
          await supabase.from('checklist_items_ejecucion').insert(
            nombres.map((nombre, i) => ({ ejecucion_id: ejec.id, plantilla_id: tipedPlant[i]?.id ?? null, item_nombre: nombre }))
          )
        }
      }

      const { data: itemsData } = await supabase.from('checklist_items_ejecucion').select('*').eq('ejecucion_id', ejec.id).order('created_at')
      setEjecucion(ejec)
      setItems((itemsData ?? []) as ItemEjecucion[])
    } catch (e: unknown) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarChecklist(activeTab) }, [activeTab, cargarChecklist])

  async function toggleItem(item: ItemEjecucion) {
    if (!ejecucion) return
    const nuevo = !item.completado
    const ahora = nuevo ? new Date().toISOString() : null
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, completado: nuevo, completado_at: ahora } : i))
    await supabase.from('checklist_items_ejecucion').update({ completado: nuevo, completado_at: ahora }).eq('id', item.id)
    const updated = items.map(i => i.id === item.id ? { ...i, completado: nuevo } : i)
    const comp = updated.filter(i => i.completado).length
    await supabase.from('checklist_ejecuciones').update({ items_completados: comp, completado: comp === updated.length }).eq('id', ejecucion.id)
    setEjecucion(prev => prev ? { ...prev, items_completados: comp, completado: comp === updated.length } : prev)
  }

  async function cargarPlantillas(tipo: TipoBpm) {
    const { data } = await supabase.from('checklist_plantillas').select('*').eq('tipo', tipo).order('orden')
    setPlantillas((data ?? []) as Plantilla[])
  }

  async function addItemPlantilla() {
    if (!nuevoItemNombre.trim()) return
    const { data, error: e } = await supabase
      .from('checklist_plantillas').insert({ tipo: activeTab, nombre: nuevoItemNombre.trim(), orden: plantillas.length }).select().single()
    if (!e && data) { setPlantillas(prev => [...prev, data as Plantilla]); setNuevoItemNombre(''); setShowAddItem(false) }
  }

  async function deleteItemPlantilla(id: string) {
    await supabase.from('checklist_plantillas').delete().eq('id', id)
    setPlantillas(prev => prev.filter(p => p.id !== id))
  }

  const totalItems = items.length
  const completados = items.filter(i => i.completado).length
  const pct = totalItems > 0 ? Math.round((completados / totalItems) * 100) : 0

  return (
    <div style={{ fontFamily: FONT.body, padding: '28px', background: BG_OPS, minHeight: '100vh', color: '#ffffff' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', color: COLORS.redSL, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>BPM / CALIDAD</h1>
        <span style={{ fontSize: 13, color: COLOR.textMut }}>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TIPOS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '7px 18px', borderRadius: 20, border: 'none', background: activeTab === t ? COLORS.glovo : '#1e1e1e', color: activeTab === t ? BG_OPS : '#cccccc', fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
            {TIPO_LABELS[t]}
          </button>
        ))}
      </div>

      {error && <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', borderRadius: 8, padding: '14px 18px', color: '#ffaaaa', fontSize: 13, marginBottom: 20 }}>{error}</div>}
      {loading && <div style={{ color: COLOR.textMut, fontSize: 13, padding: '20px 0' }}>Cargando…</div>}

      {!loading && !error && !modoEdicion && (
        <div>
          {ejecucion && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLOR.textMut }}>Progreso</span>
                <span style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: progressColor(pct) }}>{completados}/{totalItems} — {pct}%</span>
              </div>
              <div style={{ background: '#2a2a2a', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: progressColor(pct), borderRadius: 6, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {items.map(item => (
              <div key={item.id} onClick={() => toggleItem(item)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 8, border: `1px solid ${item.completado ? '#1D9E7530' : '#2a2a2a'}`, background: item.completado ? '#1D9E7515' : '#141414', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, border: `2px solid ${item.completado ? COLORS.ok : '#383838'}`, background: item.completado ? COLORS.ok : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.completado && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L6 11L12 3" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <span style={{ flex: 1, fontSize: 14, color: item.completado ? COLOR.textMut : '#ffffff', textDecoration: item.completado ? 'line-through' : 'none' }}>{item.item_nombre}</span>
                {item.completado_at && <span style={{ fontFamily: FONT.heading, fontSize: 12, color: COLORS.ok }}>{fmtHora(item.completado_at)}</span>}
              </div>
            ))}
          </div>

          <button onClick={() => { setModoEdicion(true); cargarPlantillas(activeTab) }} style={{ padding: '8px 16px', background: '#222222', border: '1px solid #383838', color: '#cccccc', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
            Editar plantilla
          </button>
        </div>
      )}

      {!loading && !error && modoEdicion && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontFamily: FONT.heading, fontSize: 15, letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.glovo, margin: 0 }}>EDITANDO — {TIPO_LABELS[activeTab].toUpperCase()}</h2>
            <button onClick={() => setModoEdicion(false)} style={{ padding: '7px 16px', background: COLORS.redSL, color: '#ffffff', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Cerrar</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {plantillas.map((p, idx) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 12, color: COLOR.textMut, minWidth: 24, textAlign: 'right' }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 13, color: '#cccccc' }}>{p.nombre}</span>
                <button onClick={() => deleteItemPlantilla(p.id)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #B01D23', color: COLORS.redSL, borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Eliminar</button>
              </div>
            ))}
          </div>
          {showAddItem ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="text" value={nuevoItemNombre} onChange={e => setNuevoItemNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItemPlantilla()}
                placeholder="Nombre del item..." autoFocus
                style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: '#1e1e1e', border: '1px solid #383838', borderRadius: 6, color: '#ffffff', fontSize: 13, outline: 'none' }} />
              <button onClick={addItemPlantilla} style={{ padding: '8px 16px', background: COLORS.glovo, color: BG_OPS, border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Añadir</button>
              <button onClick={() => { setShowAddItem(false); setNuevoItemNombre('') }} style={{ padding: '8px 14px', background: '#222222', border: '1px solid #383838', color: '#cccccc', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setShowAddItem(true)} style={{ padding: '8px 16px', background: COLORS.glovo, color: BG_OPS, border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>+ Añadir item</button>
          )}
        </div>
      )}
    </div>
  )
}
