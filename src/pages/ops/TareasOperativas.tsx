import { BLANCO, BORDE_SUAVE, GRANATE, GRIS, INK, LIMA, NAR, ROJO_S, VERDE } from '@/styles/neobrutal'
import { GRANATE_DISABLED } from '@/styles/palettes'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'

/* ─── Types ─── */
type Columna = 'pendiente' | 'en_progreso' | 'hecho'
type Prioridad = 'baja' | 'normal' | 'alta' | 'urgente'

interface Tarea {
  id: string
  titulo: string
  descripcion: string | null
  columna: Columna
  prioridad: Prioridad
  asignado_a: string | null
  fecha_limite: string | null
  etiqueta: string | null
  orden: number
  created_at: string
  updated_at: string
}

type SortKey = 'titulo' | 'columna' | 'prioridad' | 'asignado_a' | 'fecha_limite'

/* ─── Helpers ─── */
function localToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isVencida(fecha: string | null): boolean {
  if (!fecha) return false
  return fecha < localToday()
}

const PRIORIDAD_COLOR: Record<Prioridad, string> = {
  urgente: GRANATE,
  alta: NAR,
  normal: LIMA,
  baja: GRIS,
}

const PRIORIDAD_TEXT: Record<Prioridad, string> = {
  urgente: BLANCO,
  alta: INK,
  normal: INK,
  baja: BLANCO,
}

const COL_CONFIG: { key: Columna; label: string; headerBg: string }[] = [
  { key: 'pendiente',   label: 'PENDIENTE',   headerBg: GRANATE },
  { key: 'en_progreso', label: 'EN PROGRESO', headerBg: NAR },
  { key: 'hecho',       label: 'HECHO',       headerBg: VERDE },
]

const FORM_EMPTY = {
  titulo: '',
  descripcion: '',
  columna: 'pendiente' as Columna,
  prioridad: 'normal' as Prioridad,
  asignado_a: '',
  fecha_limite: '',
  etiqueta: '',
}

/* ─── Shared styles ─── */
const labelSt: React.CSSProperties = {
  display: 'block',
  fontFamily: 'Oswald,sans-serif',
  fontSize: 11,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: GRIS,
  marginBottom: 5,
}

const inputSt: React.CSSProperties = {
  width: '100%',
  background: INK,
  border: `0.5px solid ${BORDE_SUAVE}`,
  borderRadius: 6,
  color: BLANCO,
  fontFamily: 'Lexend,sans-serif',
  fontSize: 13,
  padding: '8px 10px',
  outline: 'none',
  boxSizing: 'border-box',
}

/* ─── Component ─── */
export default function TareasOperativas() {
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vista, setVista] = useState<'kanban' | 'lista'>('kanban')
  const [dragOver, setDragOver] = useState<Columna | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarea, setEditTarea] = useState<Tarea | null>(null)
  const [form, setForm] = useState({ ...FORM_EMPTY })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState<Prioridad | ''>('')
  const [filtroColumna, setFiltroColumna] = useState<Columna | ''>('')
  const [filtroAsignado, setFiltroAsignado] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('titulo')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const dragId = useRef<string | null>(null)

  /* ─── Load ─── */
  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('tareas_erp')
        .select('*')
        .order('orden', { ascending: true })
        .order('created_at', { ascending: true })
      if (err) throw err
      setTareas((data as Tarea[]) ?? [])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('does not exist') || msg.includes('42P01')) {
        setTareas([])
        setError('La tabla tareas_erp no existe aun. Se mostrara vacio hasta que sea creada.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  /* ─── Modal helpers ─── */
  function abrirNueva(columna: Columna) {
    setEditTarea(null)
    setForm({ ...FORM_EMPTY, columna })
    setModalOpen(true)
  }

  function abrirEditar(t: Tarea) {
    setEditTarea(t)
    setForm({
      titulo: t.titulo,
      descripcion: t.descripcion ?? '',
      columna: t.columna,
      prioridad: t.prioridad,
      asignado_a: t.asignado_a ?? '',
      fecha_limite: t.fecha_limite ?? '',
      etiqueta: t.etiqueta ?? '',
    })
    setModalOpen(true)
  }

  function cerrarModal() {
    setModalOpen(false)
    setEditTarea(null)
    setForm({ ...FORM_EMPTY })
  }

  async function guardar() {
    if (!form.titulo.trim()) return
    setSaving(true)
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        columna: form.columna,
        prioridad: form.prioridad,
        asignado_a: form.asignado_a.trim() || null,
        fecha_limite: form.fecha_limite || null,
        etiqueta: form.etiqueta.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (editTarea) {
        const { error: err } = await supabase
          .from('tareas_erp')
          .update(payload)
          .eq('id', editTarea.id)
        if (err) throw err
        setTareas(prev => prev.map(t => t.id === editTarea.id ? { ...t, ...payload } : t))
      } else {
        const maxOrden = tareas.filter(t => t.columna === form.columna).length
        const { data, error: err } = await supabase
          .from('tareas_erp')
          .insert({ ...payload, orden: maxOrden })
          .select()
          .single()
        if (err) throw err
        setTareas(prev => [...prev, data as Tarea])
      }
      cerrarModal()
    } catch (e: unknown) {
      alert('Error al guardar: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  async function borrar(id: string) {
    try {
      const { error: err } = await supabase.from('tareas_erp').delete().eq('id', id)
      if (err) throw err
      setTareas(prev => prev.filter(t => t.id !== id))
    } catch (e: unknown) {
      alert('Error al borrar: ' + (e instanceof Error ? e.message : String(e)))
    }
    setConfirmDelete(null)
  }

  /* ─── Drag & Drop ─── */
  async function handleDrop(e: React.DragEvent, columnaDestino: Columna) {
    e.preventDefault()
    const id = dragId.current ?? e.dataTransfer.getData('tareaId')
    if (!id) return
    setDragOver(null)
    const tarea = tareas.find(t => t.id === id)
    if (!tarea || tarea.columna === columnaDestino) return
    setTareas(prev => prev.map(t => t.id === id ? { ...t, columna: columnaDestino } : t))
    const { error: err } = await supabase
      .from('tareas_erp')
      .update({ columna: columnaDestino, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (err) {
      setTareas(prev => prev.map(t => t.id === id ? { ...t, columna: tarea.columna } : t))
      alert('Error al mover tarea: ' + err.message)
    }
  }

  /* ─── Lista sort ─── */
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 1 ? -1 : 1)
    else { setSortKey(key); setSortDir(1) }
  }

  const tareasFiltradas = tareas.filter(t => {
    if (busqueda !== '' &&
      !t.titulo.toLowerCase().includes(busqueda.toLowerCase()) &&
      !(t.asignado_a ?? '').toLowerCase().includes(busqueda.toLowerCase()) &&
      !(t.etiqueta ?? '').toLowerCase().includes(busqueda.toLowerCase())) return false
    if (filtroPrioridad !== '' && t.prioridad !== filtroPrioridad) return false
    if (filtroColumna !== '' && t.columna !== filtroColumna) return false
    if (filtroAsignado !== '' && !(t.asignado_a ?? '').toLowerCase().includes(filtroAsignado.toLowerCase())) return false
    return true
  })

  const tareasOrdenadas = [...tareasFiltradas].sort((a, b) => {
    const av = (a[sortKey] ?? '') as string
    const bv = (b[sortKey] ?? '') as string
    return av.localeCompare(bv) * sortDir
  })

  /* ─── TareaCard ─── */
  function TareaCard({ t }: { t: Tarea }) {
    return (
      <div
        draggable
        onDragStart={e => {
          dragId.current = t.id
          e.dataTransfer.setData('tareaId', t.id)
        }}
        onDragEnd={() => { dragId.current = null }}
        style={{
          background: INK,
          border: `0.5px solid ${BORDE_SUAVE}`,
          borderRadius: 8,
          padding: '12px',
          marginBottom: 8,
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: FONT.body, fontSize: 13, color: BLANCO, flex: 1, lineHeight: 1.4 }}>
            {t.titulo}
          </span>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => abrirEditar(t)}
              title="Editar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 4px', color: GRIS, lineHeight: 1 }}
            >&#x270F;</button>
            <button
              onClick={() => setConfirmDelete(t.id)}
              title="Borrar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 4px', color: GRIS, lineHeight: 1 }}
            >&#x1F5D1;</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <span style={{
            background: PRIORIDAD_COLOR[t.prioridad],
            color: PRIORIDAD_TEXT[t.prioridad],
            fontFamily: 'Oswald,sans-serif',
            fontSize: 10,
            letterSpacing: '0.5px',
            padding: '1px 6px',
            borderRadius: 3,
            textTransform: 'uppercase',
          }}>{t.prioridad}</span>
          {t.etiqueta && (
            <span style={{
              background: INK, color: GRIS,
              fontFamily: 'Oswald,sans-serif', fontSize: 10,
              padding: '1px 6px', borderRadius: 3, letterSpacing: '0.5px',
            }}>{t.etiqueta}</span>
          )}
        </div>
        {(t.asignado_a || t.fecha_limite) && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {t.asignado_a && (
              <span style={{ fontFamily: FONT.body, fontSize: 11, color: GRIS }}>
                {t.asignado_a}
              </span>
            )}
            {t.fecha_limite && (
              <span style={{
                fontFamily: FONT.body, fontSize: 11,
                color: isVencida(t.fecha_limite) ? GRANATE : GRIS,
                fontWeight: isVencida(t.fecha_limite) ? 600 : 400,
              }}>
                {t.fecha_limite.slice(0, 10).split('-').reverse().join('/')}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  /* ─── ThSortable ─── */
  function ThSortable({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k
    return (
      <th
        onClick={() => toggleSort(k)}
        style={{
          background: INK, fontFamily: 'Oswald,sans-serif', fontSize: 11,
          letterSpacing: '1.5px', textTransform: 'uppercase', color: active ? LIMA : GRIS,
          padding: '10px 12px', textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap',
          borderBottom: `0.5px solid ${BORDE_SUAVE}`,
        }}
      >
        {label} {active ? (sortDir === 1 ? '↑' : '↓') : ''}
      </th>
    )
  }

  /* ─── Render ─── */
  return (
    <div style={{ padding: '28px', background: INK, minHeight: '100vh', fontFamily: FONT.body }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{
          fontFamily: 'Oswald,sans-serif', fontSize: 22, letterSpacing: '3px',
          color: GRANATE, fontWeight: 600, textTransform: 'uppercase', margin: 0,
        }}>TAREAS Y KANBAN</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setVista('kanban')}
            style={{
              padding: '6px 14px', borderRadius: 6,
              border: vista === 'kanban' ? 'none' : `0.5px solid ${BORDE_SUAVE}`,
              background: vista === 'kanban' ? GRANATE : 'transparent',
              color: BLANCO, fontFamily: 'Oswald,sans-serif', fontSize: 13,
              cursor: 'pointer', letterSpacing: '1px',
            }}
          >KANBAN</button>
          <button
            onClick={() => setVista('lista')}
            style={{
              padding: '6px 14px', borderRadius: 6,
              border: vista === 'lista' ? 'none' : `0.5px solid ${BORDE_SUAVE}`,
              background: vista === 'lista' ? GRANATE : 'transparent',
              color: BLANCO, fontFamily: 'Oswald,sans-serif', fontSize: 13,
              cursor: 'pointer', letterSpacing: '1px',
            }}
          >LISTA</button>
        </div>
      </div>

      {/* Error soft */}
      {error && (
        <div style={{
          background: '#2d1515', border: '1px solid #aa3030', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, color: ROJO_S,
          fontFamily: FONT.body, fontSize: 13,
        }}>{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color: GRIS, fontFamily: FONT.body, fontSize: 14, textAlign: 'center', padding: 40 }}>
          Cargando tareas...
        </div>
      )}

      {/* KANBAN */}
      {!loading && vista === 'kanban' && (
        <div>
          {/* Filtros kanban */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Buscar..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ background: INK, border: `0.5px solid ${BORDE_SUAVE}`, borderRadius: 6, color: BLANCO, fontFamily: FONT.body, fontSize: 13, padding: '7px 12px', width: 200, outline: 'none' }}
            />
            <select
              value={filtroPrioridad}
              onChange={e => setFiltroPrioridad(e.target.value as Prioridad | '')}
              style={{ background: INK, border: `0.5px solid ${BORDE_SUAVE}`, borderRadius: 6, color: filtroPrioridad ? BLANCO : GRIS, fontFamily: FONT.body, fontSize: 13, padding: '7px 10px', outline: 'none' }}
            >
              <option value="">Prioridad</option>
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="normal">Normal</option>
              <option value="baja">Baja</option>
            </select>
            {(busqueda || filtroPrioridad) && (
              <button
                onClick={() => { setBusqueda(''); setFiltroPrioridad('') }}
                style={{ background: 'transparent', border: `0.5px solid ${BORDE_SUAVE}`, color: GRIS, borderRadius: 6, padding: '7px 12px', fontFamily: FONT.body, fontSize: 12, cursor: 'pointer' }}
              >Limpiar</button>
            )}
          </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflowX: 'auto' }}>
          {COL_CONFIG.map(col => {
            const colTareas = tareasFiltradas.filter(t => t.columna === col.key)
            const isDragTarget = dragOver === col.key
            return (
              <div
                key={col.key}
                onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null)
                }}
                onDrop={e => handleDrop(e, col.key)}
                style={{
                  flex: '1 1 280px',
                  minWidth: 260,
                  background: INK,
                  border: isDragTarget ? `2px dashed ${LIMA}` : `0.5px solid ${BORDE_SUAVE}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                  transition: 'border 150ms',
                }}
              >
                <div style={{
                  background: col.headerBg,
                  padding: '10px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{
                    fontFamily: 'Oswald,sans-serif', fontSize: 13, letterSpacing: '1.5px',
                    color: BLANCO, fontWeight: 600,
                  }}>{col.label}</span>
                  <span style={{
                    background: 'rgba(0,0,0,0.3)', color: BLANCO,
                    fontFamily: 'Oswald,sans-serif', fontSize: 11,
                    padding: '2px 8px', borderRadius: 10,
                  }}>{colTareas.length}</span>
                </div>
                <div style={{ padding: '12px 12px 4px' }}>
                  {colTareas.length === 0 && (
                    <div style={{
                      color: GRIS, fontFamily: FONT.body, fontSize: 12,
                      textAlign: 'center', padding: '16px 0', fontStyle: 'italic',
                    }}>Sin tareas</div>
                  )}
                  {colTareas.map(t => <TareaCard key={t.id} t={t} />)}
                </div>
                <div style={{ padding: '4px 12px 12px' }}>
                  <button
                    onClick={() => abrirNueva(col.key)}
                    style={{
                      width: '100%', padding: '7px', borderRadius: 6,
                      border: `0.5px dashed ${BORDE_SUAVE}`, background: 'transparent',
                      color: GRIS, fontFamily: 'Oswald,sans-serif',
                      fontSize: 12, letterSpacing: '1px', cursor: 'pointer',
                    }}
                  >+ ANADIR</button>
                </div>
              </div>
            )
          })}
        </div>
        </div>
      )}

      {/* LISTA */}
      {!loading && vista === 'lista' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Buscar por titulo, asignado o etiqueta..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{
                background: INK, border: `0.5px solid ${BORDE_SUAVE}`, borderRadius: 8,
                color: BLANCO, fontFamily: FONT.body, fontSize: 13,
                padding: '8px 12px', width: 280, outline: 'none',
              }}
            />
            <select
              value={filtroPrioridad}
              onChange={e => setFiltroPrioridad(e.target.value as Prioridad | '')}
              style={{ background: INK, border: `0.5px solid ${BORDE_SUAVE}`, borderRadius: 8, color: filtroPrioridad ? BLANCO : GRIS, fontFamily: FONT.body, fontSize: 13, padding: '8px 10px', outline: 'none' }}
            >
              <option value="">Todas las prioridades</option>
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="normal">Normal</option>
              <option value="baja">Baja</option>
            </select>
            <select
              value={filtroColumna}
              onChange={e => setFiltroColumna(e.target.value as Columna | '')}
              style={{ background: INK, border: `0.5px solid ${BORDE_SUAVE}`, borderRadius: 8, color: filtroColumna ? BLANCO : GRIS, fontFamily: FONT.body, fontSize: 13, padding: '8px 10px', outline: 'none' }}
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_progreso">En progreso</option>
              <option value="hecho">Hecho</option>
            </select>
            <input
              type="text"
              placeholder="Asignado a..."
              value={filtroAsignado}
              onChange={e => setFiltroAsignado(e.target.value)}
              style={{ background: INK, border: `0.5px solid ${BORDE_SUAVE}`, borderRadius: 8, color: BLANCO, fontFamily: FONT.body, fontSize: 13, padding: '8px 12px', width: 160, outline: 'none' }}
            />
            {(busqueda || filtroPrioridad || filtroColumna || filtroAsignado) && (
              <button
                onClick={() => { setBusqueda(''); setFiltroPrioridad(''); setFiltroColumna(''); setFiltroAsignado('') }}
                style={{ background: 'transparent', border: `0.5px solid ${BORDE_SUAVE}`, color: GRIS, borderRadius: 6, padding: '8px 12px', fontFamily: FONT.body, fontSize: 12, cursor: 'pointer' }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <ThSortable label="Titulo" k="titulo" />
                  <ThSortable label="Columna" k="columna" />
                  <ThSortable label="Prioridad" k="prioridad" />
                  <ThSortable label="Asignado" k="asignado_a" />
                  <ThSortable label="Fecha limite" k="fecha_limite" />
                  <th style={{
                    background: INK, fontFamily: 'Oswald,sans-serif', fontSize: 11,
                    letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS,
                    padding: '10px 12px', borderBottom: `0.5px solid ${BORDE_SUAVE}`,
                  }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tareasOrdenadas.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: FONT.body, fontSize: 13 }}>
                      No hay tareas
                    </td>
                  </tr>
                )}
                {tareasOrdenadas.map((t, i) => {
                  const colConf = COL_CONFIG.find(c => c.key === t.columna)
                  return (
                    <tr key={t.id} style={{ background: i % 2 === 0 ? INK : INK }}>
                      <td style={{ padding: '10px 12px', color: BLANCO, fontFamily: FONT.body, fontSize: 13, borderBottom: `0.5px solid ${BORDE_SUAVE}` }}>
                        {t.titulo}
                        {t.etiqueta && (
                          <span style={{
                            marginLeft: 8, background: INK, color: GRIS,
                            fontFamily: 'Oswald,sans-serif', fontSize: 10,
                            padding: '1px 5px', borderRadius: 3,
                          }}>{t.etiqueta}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `0.5px solid ${BORDE_SUAVE}` }}>
                        <span style={{
                          background: colConf?.headerBg ?? GRIS,
                          color: BLANCO, fontFamily: 'Oswald,sans-serif',
                          fontSize: 10, padding: '2px 7px', borderRadius: 3,
                          letterSpacing: '0.5px', textTransform: 'uppercase',
                        }}>{t.columna.replace('_', ' ')}</span>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `0.5px solid ${BORDE_SUAVE}` }}>
                        <span style={{
                          background: PRIORIDAD_COLOR[t.prioridad],
                          color: PRIORIDAD_TEXT[t.prioridad],
                          fontFamily: 'Oswald,sans-serif', fontSize: 10,
                          padding: '2px 7px', borderRadius: 3,
                          letterSpacing: '0.5px', textTransform: 'uppercase',
                        }}>{t.prioridad}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: GRIS, fontFamily: FONT.body, fontSize: 13, borderBottom: `0.5px solid ${BORDE_SUAVE}` }}>
                        {t.asignado_a ?? '—'}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `0.5px solid ${BORDE_SUAVE}` }}>
                        {t.fecha_limite ? (
                          <span style={{
                            color: isVencida(t.fecha_limite) ? GRANATE : GRIS,
                            fontFamily: FONT.body, fontSize: 13,
                            fontWeight: isVencida(t.fecha_limite) ? 600 : 400,
                          }}>
                            {t.fecha_limite.slice(0, 10).split('-').reverse().join('/')}
                          </span>
                        ) : <span style={{ color: GRIS }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `0.5px solid ${BORDE_SUAVE}` }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => abrirEditar(t)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}
                          >&#x270F;</button>
                          <button
                            onClick={() => setConfirmDelete(t.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}
                          >&#x1F5D1;</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => abrirNueva('pendiente')}
              style={{
                padding: '8px 18px', borderRadius: 6, border: 'none',
                background: LIMA, color: INK,
                fontFamily: 'Oswald,sans-serif', fontSize: 13,
                letterSpacing: '1px', cursor: 'pointer',
              }}
            >+ NUEVA TAREA</button>
          </div>
        </div>
      )}

      {/* MODAL Nueva/Editar */}
      {modalOpen && (
        <div
          onClick={cerrarModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: INK,
              border: `0.5px solid ${BORDE_SUAVE}`,
              borderRadius: 12,
              padding: '28px 24px',
              width: '100%',
              maxWidth: 480,
            }}
          >
            <h2 style={{
              fontFamily: 'Oswald,sans-serif', fontSize: 16, letterSpacing: '2px',
              color: GRANATE, textTransform: 'uppercase', margin: '0 0 20px',
            }}>
              {editTarea ? 'EDITAR TAREA' : 'NUEVA TAREA'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelSt}>Titulo *</label>
                <input
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Titulo de la tarea"
                  style={inputSt}
                />
              </div>
              <div>
                <label style={labelSt}>Descripcion</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={3}
                  placeholder="Descripcion opcional..."
                  style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelSt}>Columna</label>
                  <select
                    value={form.columna}
                    onChange={e => setForm(f => ({ ...f, columna: e.target.value as Columna }))}
                    style={inputSt}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En progreso</option>
                    <option value="hecho">Hecho</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelSt}>Prioridad</label>
                  <select
                    value={form.prioridad}
                    onChange={e => setForm(f => ({ ...f, prioridad: e.target.value as Prioridad }))}
                    style={inputSt}
                  >
                    <option value="baja">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelSt}>Asignado a</label>
                  <input
                    value={form.asignado_a}
                    onChange={e => setForm(f => ({ ...f, asignado_a: e.target.value }))}
                    placeholder="Nombre..."
                    style={inputSt}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelSt}>Fecha limite</label>
                  <input
                    type="date"
                    value={form.fecha_limite}
                    onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))}
                    style={{ ...inputSt, colorScheme: 'dark' }}
                  />
                </div>
              </div>
              <div>
                <label style={labelSt}>Etiqueta</label>
                <input
                  value={form.etiqueta}
                  onChange={e => setForm(f => ({ ...f, etiqueta: e.target.value }))}
                  placeholder="bug, mejora, operacion..."
                  style={inputSt}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button
                onClick={cerrarModal}
                style={{
                  padding: '8px 18px', borderRadius: 6,
                  border: `0.5px solid ${BORDE_SUAVE}`, background: INK,
                  color: GRIS, fontFamily: 'Oswald,sans-serif',
                  fontSize: 13, letterSpacing: '1px', cursor: 'pointer',
                }}
              >CANCELAR</button>
              <button
                onClick={guardar}
                disabled={saving || !form.titulo.trim()}
                style={{
                  padding: '8px 18px', borderRadius: 6, border: 'none',
                  background: saving || !form.titulo.trim() ? GRANATE_DISABLED : GRANATE,
                  color: BLANCO, fontFamily: 'Oswald,sans-serif',
                  fontSize: 13, letterSpacing: '1px',
                  cursor: saving || !form.titulo.trim() ? 'not-allowed' : 'pointer',
                }}
              >{saving ? 'GUARDANDO...' : 'GUARDAR'}</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE */}
      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1100, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: INK,
              border: `0.5px solid ${BORDE_SUAVE}`,
              borderRadius: 12, padding: '28px 24px',
              width: '100%', maxWidth: 360, textAlign: 'center',
            }}
          >
            <p style={{ fontFamily: FONT.body, fontSize: 14, color: BLANCO, margin: '0 0 20px' }}>
              Borrar esta tarea? La accion no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  padding: '8px 18px', borderRadius: 6,
                  border: `0.5px solid ${BORDE_SUAVE}`, background: INK,
                  color: GRIS, fontFamily: 'Oswald,sans-serif',
                  fontSize: 13, letterSpacing: '1px', cursor: 'pointer',
                }}
              >CANCELAR</button>
              <button
                onClick={() => borrar(confirmDelete)}
                style={{
                  padding: '8px 18px', borderRadius: 6, border: 'none',
                  background: GRANATE, color: BLANCO,
                  fontFamily: 'Oswald,sans-serif', fontSize: 13,
                  letterSpacing: '1px', cursor: 'pointer',
                }}
              >BORRAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}