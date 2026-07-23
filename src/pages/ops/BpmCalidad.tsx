import { BLANCO, GRANATE, GRIS, INK, NAR, VERDE } from '@/styles/neobrutal'
import { ERROR_BANNER_BG, ERROR_BANNER_BORDE, BPM_ITEM_DONE_BG, BPM_ITEM_DONE_BORDE } from '@/styles/palettes'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { COLORS } from '@/components/panel/resumen/tokens'
import { HeroCantera, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

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
  if (pct < 70) return NAR
  return VERDE
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

  const titularHero = totalItems === 0
    ? `Checklist de ${TIPO_LABELS[activeTab].toLowerCase()} sin ítems.`
    : pct === 100
      ? `Checklist de ${TIPO_LABELS[activeTab].toLowerCase()} completada.`
      : `${completados} de ${totalItems} ítems hechos en ${TIPO_LABELS[activeTab].toLowerCase()}.`

  const atencionHero = totalItems > 0 ? [
    `${completados}/${totalItems} hechos`,
    `${pct}% completado`,
  ] : []

  return (
    <PantallaCantera>

      {/* Pestañas propias (planas) */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TIPOS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '7px 18px', border: `2px solid ${INK}`, background: activeTab === t ? COLORS.glovo : BLANCO, color: INK, fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
            {TIPO_LABELS[t]}
          </button>
        ))}
      </div>

      {/* 1 · Héroe del área Operaciones (naranja) */}
      <HeroCantera
        area="ops"
        titular={titularHero}
        etiquetaDato={totalItems > 0 ? 'Progreso' : undefined}
        cifra={totalItems > 0 ? `${pct}%` : undefined}
        atencion={atencionHero}
      />

      {error && <Papel ceja={ERROR_BANNER_BORDE} style={{ background: ERROR_BANNER_BG, border: `1px solid ${ERROR_BANNER_BORDE}`, color: COLORS.redSL }}>{error}</Papel>}
      {loading && <div style={{ color: GRIS, fontSize: 13 }}>Cargando…</div>}

      {/* 3 · Frase potente */}
      {!loading && !error && totalItems > 0 && (
        pct === 100
          ? <FrasePotente significado="logro">Checklist completada: todo revisado según protocolo.</FrasePotente>
          : pct < 30
            ? <FrasePotente significado="peligro">La checklist va muy atrasada: complétala antes de seguir con el turno.</FrasePotente>
            : <FrasePotente significado="coste">Aún quedan ítems por marcar en la checklist.</FrasePotente>
      )}

      {!loading && !error && !modoEdicion && (
        <div>
          {ejecucion && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ background: BLANCO, border: `3px solid ${INK}`, height: 12, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: progressColor(pct), transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0' }}>
            {items.map(item => (
              <div key={item.id} onClick={() => toggleItem(item)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', border: `2px solid ${item.completado ? BPM_ITEM_DONE_BORDE : INK}`, background: item.completado ? BPM_ITEM_DONE_BG : BLANCO, cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ width: 26, height: 26, border: `2px solid ${item.completado ? VERDE : INK}`, background: item.completado ? VERDE : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.completado && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L6 11L12 3" stroke={BLANCO} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <span style={{ flex: 1, fontSize: 14, color: item.completado ? GRIS : INK, textDecoration: item.completado ? 'line-through' : 'none' }}>{item.item_nombre}</span>
                {item.completado_at && <span style={{ fontFamily: FONT.heading, fontSize: 12, color: VERDE }}>{fmtHora(item.completado_at)}</span>}
              </div>
            ))}
          </div>

          <button onClick={() => { setModoEdicion(true); cargarPlantillas(activeTab) }}
            style={{ padding: '8px 16px', background: BLANCO, border: `2px solid ${INK}`, color: GRIS, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
            Editar plantilla
          </button>
        </div>
      )}

      {!loading && !error && modoEdicion && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <SeccionLabel bg={GRANATE}>Editando — {TIPO_LABELS[activeTab]}</SeccionLabel>
            <button onClick={() => setModoEdicion(false)}
              style={{ padding: '7px 16px', background: COLORS.redSL, color: BLANCO, border: `2px solid ${INK}`, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Cerrar</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {plantillas.map((p, idx) => (
              <Papel key={p.id} ceja={GRANATE} pad="10px 14px" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 12, color: GRIS, minWidth: 24, textAlign: 'right' }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 13, color: INK }}>{p.nombre}</span>
                <button onClick={() => deleteItemPlantilla(p.id)} style={{ padding: '4px 10px', background: BLANCO, border: `2px solid ${GRANATE}`, color: COLORS.redSL, fontSize: 11, cursor: 'pointer' }}>Eliminar</button>
              </Papel>
            ))}
          </div>
          {showAddItem ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="text" value={nuevoItemNombre} onChange={e => setNuevoItemNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItemPlantilla()}
                placeholder="Nombre del item..." autoFocus
                style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontSize: 13, outline: 'none' }} />
              <button onClick={addItemPlantilla} style={{ padding: '8px 16px', background: COLORS.glovo, color: INK, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Añadir</button>
              <button onClick={() => { setShowAddItem(false); setNuevoItemNombre('') }} style={{ padding: '8px 14px', background: BLANCO, border: `3px solid ${INK}`, color: GRIS, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setShowAddItem(true)} style={{ padding: '8px 16px', background: COLORS.glovo, color: INK, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>+ Añadir item</button>
          )}
        </div>
      )}
    </PantallaCantera>
  )
}
