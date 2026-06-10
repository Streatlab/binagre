/**
 * Checklists Operativos — Apertura / Cierre / Operación / Histórico
 *
 * SQL migrations needed (run once in Supabase):
 *
 * CREATE TABLE IF NOT EXISTS checklist_plantillas (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   tipo text NOT NULL,
 *   nombre text NOT NULL,
 *   orden integer DEFAULT 0,
 *   activo boolean DEFAULT true
 * );
 *
 * CREATE TABLE IF NOT EXISTS checklist_ejecuciones (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   fecha date NOT NULL DEFAULT CURRENT_DATE,
 *   tipo text NOT NULL,
 *   items_completados integer DEFAULT 0,
 *   items_totales integer DEFAULT 0,
 *   completado boolean DEFAULT false,
 *   notas text,
 *   created_at timestamptz DEFAULT now()
 * );
 *
 * CREATE TABLE IF NOT EXISTS checklist_items_ejecucion (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   ejecucion_id uuid REFERENCES checklist_ejecuciones(id) ON DELETE CASCADE,
 *   plantilla_id uuid REFERENCES checklist_plantillas(id),
 *   item_nombre text NOT NULL,
 *   completado boolean DEFAULT false,
 *   completado_at timestamptz,
 *   created_at timestamptz DEFAULT now()
 * );
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoChecklist = 'apertura' | 'cierre' | 'operacion'

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

interface Plantilla {
  id: string
  tipo: string
  nombre: string
  orden: number
  activo: boolean
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_APERTURA = [
  'Encender equipos frigoríficos',
  'Verificar temperaturas frigoríficos (< 4°C)',
  'Encender hornos y equipos de cocina',
  'Verificar stock mínimo de aperturas',
  'Comprobar limpieza de superficies',
  'Verificar materiales de embalaje',
  'Activar plataformas delivery (Uber, Glovo, JE)',
  'Verificar conexión internet y tablets',
  'Comprobar carta actualizada en plataformas',
  'Briefing equipo',
]

const DEFAULT_CIERRE = [
  'Desactivar plataformas delivery',
  'Limpiar y desinfectar superficies de trabajo',
  'Limpiar equipos (freidoras, planchas, hornos)',
  'Guardar productos en recipientes herméticos etiquetados',
  'Vaciar y limpiar cubos de basura',
  'Verificar temperaturas frigoríficos y congeladores',
  'Limpiar suelos',
  'Revisar que todo esté apagado',
  'Cerrar llaves de gas',
  'Cierre de caja y registro ventas del día',
  'Dejar novedades escritas',
  'Cierre de aplicaciones ERP',
]

const DEFAULT_OPERACION = [
  'Revisar pedidos pendientes en plataformas',
  'Controlar tiempos de preparación',
  'Revisar stock de ingredientes clave',
  'Verificar calidad de presentación de platos',
  'Gestionar reclamaciones y reembolsos',
]

const DEFAULTS: Record<TipoChecklist, string[]> = {
  apertura: DEFAULT_APERTURA,
  cierre: DEFAULT_CIERRE,
  operacion: DEFAULT_OPERACION,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localDateStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fmtHora(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtFechaCorta(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function progressColor(pct: number): string {
  if (pct < 30) return '#B01D23'
  if (pct < 70) return '#f5a623'
  return '#1D9E75'
}

// ─── Component ────────────────────────────────────────────────────────────────

const TABS: { key: TipoChecklist | 'historico'; label: string }[] = [
  { key: 'apertura', label: 'Apertura' },
  { key: 'cierre', label: 'Cierre' },
  { key: 'operacion', label: 'Operación' },
  { key: 'historico', label: 'Histórico' },
]

export default function ChecklistsAperturaCierre() {
  const [activeTab, setActiveTab] = useState<TipoChecklist | 'historico'>('apertura')
  const [ejecucion, setEjecucion] = useState<Ejecucion | null>(null)
  const [items, setItems] = useState<ItemEjecucion[]>([])
  const [historico, setHistorico] = useState<Ejecucion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [nuevoItemTempNombre, setNuevoItemTempNombre] = useState('')
  const [nuevoItemPlantillaNombre, setNuevoItemPlantillaNombre] = useState('')
  const [showAddTemp, setShowAddTemp] = useState(false)
  const [showAddPlantilla, setShowAddPlantilla] = useState(false)

  // ─── Load checklist for active tab ──────────────────────────────────────────

  const cargarChecklist = useCallback(async (tipo: TipoChecklist) => {
    setLoading(true)
    setError(null)
    setModoEdicion(false)
    try {
      const hoy = localDateStr()

      const { data: existente, error: errExist } = await supabase
        .from('checklist_ejecuciones')
        .select('*')
        .eq('fecha', hoy)
        .eq('tipo', tipo)
        .maybeSingle()

      if (errExist) {
        if (errExist.message?.includes('does not exist') || errExist.code === '42P01') {
          setError('Las tablas de checklists no existen aún. Ejecuta las migraciones SQL comentadas al inicio del archivo.')
          setLoading(false)
          return
        }
        throw errExist
      }

      let ejec: Ejecucion

      if (existente) {
        ejec = existente as Ejecucion
      } else {
        const { data: plantData } = await supabase
          .from('checklist_plantillas')
          .select('*')
          .eq('tipo', tipo)
          .eq('activo', true)
          .order('orden')

        const tipedPlant = (plantData ?? []) as Plantilla[]
        const nombres: string[] = tipedPlant.length > 0
          ? tipedPlant.map((p) => p.nombre)
          : DEFAULTS[tipo]

        const { data: newEjec, error: errEjec } = await supabase
          .from('checklist_ejecuciones')
          .insert({ fecha: hoy, tipo, items_totales: nombres.length, items_completados: 0 })
          .select()
          .single()

        if (errEjec) throw errEjec
        ejec = newEjec as Ejecucion

        const itemsToInsert = nombres.map((nombre, i) => ({
          ejecucion_id: ejec.id,
          plantilla_id: tipedPlant[i]?.id ?? null,
          item_nombre: nombre,
        }))

        const { error: errItems } = await supabase
          .from('checklist_items_ejecucion')
          .insert(itemsToInsert)

        if (errItems) throw errItems
      }

      const { data: itemsData, error: errItemsLoad } = await supabase
        .from('checklist_items_ejecucion')
        .select('*')
        .eq('ejecucion_id', ejec.id)
        .order('created_at')

      if (errItemsLoad) throw errItemsLoad

      setEjecucion(ejec)
      setItems((itemsData ?? []) as ItemEjecucion[])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('does not exist') || msg.includes('42P01')
        ? 'Las tablas de checklists no existen aún. Ejecuta las migraciones SQL.'
        : `Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const cargarHistorico = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: errH } = await supabase
        .from('checklist_ejecuciones')
        .select('*')
        .order('fecha', { ascending: false })
        .order('tipo')
        .limit(30)

      if (errH) {
        if (errH.code === '42P01') {
          setError('Las tablas de checklists no existen aún.')
          return
        }
        throw errH
      }
      setHistorico((data ?? []) as Ejecucion[])
    } catch (e: unknown) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'historico') {
      cargarHistorico()
    } else {
      cargarChecklist(activeTab as TipoChecklist)
    }
  }, [activeTab, cargarChecklist, cargarHistorico])

  // ─── Toggle item ────────────────────────────────────────────────────────────

  const toggleItem = async (item: ItemEjecucion) => {
    if (!ejecucion) return
    const nuevoEstado = !item.completado
    const ahora = nuevoEstado ? new Date().toISOString() : null

    setItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, completado: nuevoEstado, completado_at: ahora } : i
    ))

    const { error: errUpd } = await supabase
      .from('checklist_items_ejecucion')
      .update({ completado: nuevoEstado, completado_at: ahora })
      .eq('id', item.id)

    if (errUpd) {
      setItems(prev => prev.map(i => i.id === item.id ? item : i))
      return
    }

    const updatedItems = items.map(i => i.id === item.id ? { ...i, completado: nuevoEstado } : i)
    const completados = updatedItems.filter(i => i.completado).length
    const totales = updatedItems.length
    const completadoTodo = completados === totales

    await supabase
      .from('checklist_ejecuciones')
      .update({ items_completados: completados, completado: completadoTodo })
      .eq('id', ejecucion.id)

    setEjecucion(prev => prev
      ? { ...prev, items_completados: completados, completado: completadoTodo }
      : prev
    )
  }

  // ─── Add temp item ───────────────────────────────────────────────────────────

  const addItemTemp = async () => {
    if (!ejecucion || !nuevoItemTempNombre.trim()) return
    const { data, error: errAdd } = await supabase
      .from('checklist_items_ejecucion')
      .insert({ ejecucion_id: ejecucion.id, item_nombre: nuevoItemTempNombre.trim() })
      .select()
      .single()

    if (errAdd || !data) return
    setItems(prev => [...prev, data as ItemEjecucion])
    setNuevoItemTempNombre('')
    setShowAddTemp(false)
    const nuevoTotal = items.length + 1
    await supabase.from('checklist_ejecuciones')
      .update({ items_totales: nuevoTotal })
      .eq('id', ejecucion.id)
    setEjecucion(prev => prev ? { ...prev, items_totales: nuevoTotal } : prev)
  }

  // ─── Plantilla edicion ───────────────────────────────────────────────────────

  const cargarPlantillas = async (tipo: TipoChecklist) => {
    const { data } = await supabase
      .from('checklist_plantillas')
      .select('*')
      .eq('tipo', tipo)
      .order('orden')
    setPlantillas((data ?? []) as Plantilla[])
  }

  const toggleModoEdicion = async () => {
    if (!modoEdicion && activeTab !== 'historico') {
      await cargarPlantillas(activeTab as TipoChecklist)
    }
    setModoEdicion(prev => !prev)
  }

  const addItemPlantilla = async () => {
    if (activeTab === 'historico' || !nuevoItemPlantillaNombre.trim()) return
    const orden = plantillas.length
    const { data, error: errP } = await supabase
      .from('checklist_plantillas')
      .insert({ tipo: activeTab, nombre: nuevoItemPlantillaNombre.trim(), orden })
      .select()
      .single()

    if (errP || !data) return
    setPlantillas(prev => [...prev, data as Plantilla])
    setNuevoItemPlantillaNombre('')
    setShowAddPlantilla(false)
  }

  const deleteItemPlantilla = async (id: string) => {
    await supabase.from('checklist_plantillas').delete().eq('id', id)
    setPlantillas(prev => prev.filter(p => p.id !== id))
  }

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const totalItems = items.length
  const completadosCount = items.filter(i => i.completado).length
  const pct = totalItems > 0 ? Math.round((completadosCount / totalItems) * 100) : 0
  const todoCompleto = totalItems > 0 && completadosCount === totalItems

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: FONT.body, padding: '28px', background: '#111111', minHeight: '100vh', color: '#ffffff' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', color: '#B01D23', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>
          CHECKLISTS OPERATIVOS
        </h1>
        <span style={{ fontFamily: FONT.body, fontSize: 13, color: '#777777' }}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '7px 18px',
              borderRadius: 20,
              border: 'none',
              background: activeTab === tab.key ? '#e8f442' : '#1e1e1e',
              color: activeTab === tab.key ? '#111111' : '#cccccc',
              fontFamily: FONT.heading,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', borderRadius: 8, padding: '14px 18px', color: '#ffaaaa', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color: '#777777', fontSize: 13, padding: '20px 0' }}>Cargando…</div>
      )}

      {/* ─── Histórico Tab ─────────────────────────────────────────────── */}
      {!loading && !error && activeTab === 'historico' && (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #2a2a2a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0a0a0a' }}>
                {['Fecha', 'Tipo', 'Completados', '%', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#777777', fontWeight: 600, borderBottom: '1px solid #2a2a2a' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '20px 14px', color: '#777777', textAlign: 'center' }}>Sin registros aún</td>
                </tr>
              ) : historico.map((h, i) => {
                const p = h.items_totales > 0 ? Math.round((h.items_completados / h.items_totales) * 100) : 0
                return (
                  <tr key={h.id} style={{ background: i % 2 === 0 ? '#111111' : '#141414', borderBottom: '1px solid #2a2a2a' }}>
                    <td style={{ padding: '10px 14px', fontFamily: FONT.body }}>{fmtFechaCorta(h.fecha)}</td>
                    <td style={{ padding: '10px 14px', fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: '#cccccc' }}>{h.tipo}</td>
                    <td style={{ padding: '10px 14px' }}>{h.items_completados}/{h.items_totales}</td>
                    <td style={{ padding: '10px 14px', color: progressColor(p), fontWeight: 600 }}>{p}%</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        background: h.completado ? '#1D9E7522' : '#B01D2322',
                        color: h.completado ? '#1D9E75' : '#B01D23',
                        border: `1px solid ${h.completado ? '#1D9E75' : '#B01D23'}`,
                        padding: '2px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontFamily: FONT.heading,
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                      }}>
                        {h.completado ? 'Completado' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Checklist Tab ─────────────────────────────────────────────── */}
      {!loading && !error && activeTab !== 'historico' && !modoEdicion && (
        <div>
          {/* Progress bar */}
          {ejecucion && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#777777' }}>
                  Progreso
                </span>
                <span style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: progressColor(pct) }}>
                  {completadosCount}/{totalItems} — {pct}%
                </span>
              </div>
              <div style={{ background: '#2a2a2a', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: progressColor(pct),
                  borderRadius: 6,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              {todoCompleto && (
                <div style={{ marginTop: 14, background: '#1D9E7520', border: '1px solid #1D9E75', borderRadius: 8, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>✓</span>
                  <div>
                    <div style={{ fontFamily: FONT.heading, fontSize: 14, letterSpacing: '1px', textTransform: 'uppercase', color: '#1D9E75', fontWeight: 700 }}>
                      COMPLETADO
                    </div>
                    <div style={{ fontFamily: FONT.body, fontSize: 12, color: '#cccccc', marginTop: 2 }}>
                      Todos los items del checklist han sido verificados.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {items.map(item => (
              <div
                key={item.id}
                onClick={() => toggleItem(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: `1px solid ${item.completado ? '#1D9E7530' : '#2a2a2a'}`,
                  background: item.completado ? '#1D9E7515' : '#141414',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  userSelect: 'none',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: `2px solid ${item.completado ? '#1D9E75' : '#383838'}`,
                  background: item.completado ? '#1D9E75' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 150ms',
                }}>
                  {item.completado && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7L6 11L12 3" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Nombre */}
                <span style={{
                  fontFamily: FONT.body,
                  fontSize: 14,
                  color: item.completado ? '#777777' : '#ffffff',
                  textDecoration: item.completado ? 'line-through' : 'none',
                  flex: 1,
                }}>
                  {item.item_nombre}
                </span>

                {/* Hora completado */}
                {item.completado_at && (
                  <span style={{ fontFamily: FONT.heading, fontSize: 12, color: '#1D9E75', letterSpacing: '0.5px', flexShrink: 0 }}>
                    {fmtHora(item.completado_at)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Add temp item */}
          {showAddTemp ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={nuevoItemTempNombre}
                onChange={e => setNuevoItemTempNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItemTemp()}
                placeholder="Nombre del item temporal..."
                autoFocus
                style={{
                  flex: 1, minWidth: 200, padding: '8px 12px', background: '#1e1e1e', border: '1px solid #383838',
                  borderRadius: 6, color: '#ffffff', fontFamily: FONT.body, fontSize: 13, outline: 'none',
                }}
              />
              <button onClick={addItemTemp} style={{ padding: '8px 16px', background: '#e8f442', color: '#111111', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
                Añadir
              </button>
              <button onClick={() => { setShowAddTemp(false); setNuevoItemTempNombre('') }} style={{ padding: '8px 14px', background: '#222222', border: '1px solid #383838', color: '#cccccc', borderRadius: 6, fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowAddTemp(true)}
                style={{ padding: '8px 16px', background: '#e8f442', color: '#111111', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                + Añadir item temporal
              </button>
              <button
                onClick={toggleModoEdicion}
                style={{ padding: '8px 16px', background: '#222222', border: '1px solid #383838', color: '#cccccc', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Editar plantilla
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Modo edición plantilla ─────────────────────────────────────── */}
      {!loading && !error && activeTab !== 'historico' && modoEdicion && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontFamily: FONT.heading, fontSize: 15, letterSpacing: '2px', textTransform: 'uppercase', color: '#e8f442', margin: 0 }}>
              EDITANDO PLANTILLA — {(activeTab as string).toUpperCase()}
            </h2>
            <button
              onClick={toggleModoEdicion}
              style={{ padding: '7px 16px', background: '#B01D23', color: '#ffffff', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Guardar y cerrar
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {plantillas.length === 0 && (
              <div style={{ color: '#777777', fontSize: 13, padding: '12px 0', fontFamily: FONT.body }}>
                No hay items en la plantilla. Añade items con el botón de abajo.
              </div>
            )}
            {plantillas.map((p, idx) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 12, color: '#777777', minWidth: 24, textAlign: 'right' }}>
                  {idx + 1}
                </span>
                <span style={{ flex: 1, fontFamily: FONT.body, fontSize: 13, color: '#cccccc' }}>
                  {p.nombre}
                </span>
                <button
                  onClick={() => deleteItemPlantilla(p.id)}
                  style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #B01D23', color: '#B01D23', borderRadius: 4, fontFamily: FONT.body, fontSize: 11, cursor: 'pointer' }}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>

          {showAddPlantilla ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={nuevoItemPlantillaNombre}
                onChange={e => setNuevoItemPlantillaNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItemPlantilla()}
                placeholder="Nombre del item de plantilla..."
                autoFocus
                style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: '#1e1e1e', border: '1px solid #383838', borderRadius: 6, color: '#ffffff', fontFamily: FONT.body, fontSize: 13, outline: 'none' }}
              />
              <button onClick={addItemPlantilla} style={{ padding: '8px 16px', background: '#e8f442', color: '#111111', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
                Añadir
              </button>
              <button onClick={() => { setShowAddPlantilla(false); setNuevoItemPlantillaNombre('') }} style={{ padding: '8px 14px', background: '#222222', border: '1px solid #383838', color: '#cccccc', borderRadius: 6, fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddPlantilla(true)}
              style={{ padding: '8px 16px', background: '#e8f442', color: '#111111', border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              + Añadir item
            </button>
          )}
        </div>
      )}
    </div>
  )
}