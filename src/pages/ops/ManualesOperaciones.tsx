import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtDate } from '@/utils/format'
import { FONT } from '@/styles/tokens'

// ─── Types ────────────────────────────────────────────────────────────────────

type Categoria =
  | 'apertura'
  | 'cierre'
  | 'limpieza'
  | 'recepcion_pedidos'
  | 'atencion_cliente'
  | 'cocina'
  | 'emergencias'
  | 'rrhh'
  | 'general'

interface Manual {
  id: string
  titulo: string
  categoria: Categoria
  contenido: string
  version: number
  activo: boolean
  creado_por: string | null
  created_at: string
  updated_at: string
}

type ManualDraft = {
  titulo: string
  categoria: Categoria
  contenido: string
  creado_por: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: 'apertura',          label: 'Apertura' },
  { value: 'cierre',            label: 'Cierre' },
  { value: 'limpieza',          label: 'Limpieza' },
  { value: 'recepcion_pedidos', label: 'Recepción pedidos' },
  { value: 'atencion_cliente',  label: 'Atención cliente' },
  { value: 'cocina',            label: 'Cocina' },
  { value: 'emergencias',       label: 'Emergencias' },
  { value: 'rrhh',              label: 'RRHH' },
  { value: 'general',           label: 'General' },
]

const CAT_COLORS: Record<Categoria, string> = {
  apertura:          '#e8f442',
  cierre:            '#777777',
  limpieza:          '#66aaff',
  recepcion_pedidos: '#06C167',
  atencion_cliente:  '#f5a623',
  cocina:            '#B01D23',
  emergencias:       '#ff4444',
  rrhh:              '#cc88ff',
  general:           '#444444',
}

const EMPTY_DRAFT: ManualDraft = {
  titulo: '',
  categoria: 'general',
  contenido: '',
  creado_por: null,
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    fontFamily: FONT.body,
    color: '#ffffff',
    minHeight: '100vh',
    padding: 24,
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  } as React.CSSProperties,

  title: {
    fontFamily: FONT.heading,
    fontSize: 22,
    letterSpacing: '3px',
    textTransform: 'uppercase' as const,
    color: '#B01D23',
    fontWeight: 600,
    margin: 0,
  } as React.CSSProperties,

  btnPrimary: {
    backgroundColor: '#B01D23',
    color: '#ffffff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 18px',
    fontFamily: FONT.heading,
    fontSize: 13,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
  } as React.CSSProperties,

  btnSecondary: {
    backgroundColor: '#222222',
    color: '#cccccc',
    border: '1px solid #383838',
    borderRadius: 6,
    padding: '8px 16px',
    fontFamily: FONT.heading,
    fontSize: 13,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
  } as React.CSSProperties,

  btnAdd: {
    backgroundColor: '#e8f442',
    color: '#111111',
    border: 'none',
    borderRadius: 6,
    padding: '8px 18px',
    fontFamily: FONT.heading,
    fontSize: 13,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    fontWeight: 700,
  } as React.CSSProperties,

  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  searchInput: {
    backgroundColor: '#1e1e1e',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    color: '#ffffff',
    padding: '6px 12px',
    fontFamily: FONT.body,
    fontSize: 13,
    width: 220,
    outline: 'none',
  } as React.CSSProperties,

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 14,
  } as React.CSSProperties,

  card: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  } as React.CSSProperties,

  cardTitle: {
    fontFamily: FONT.heading,
    fontSize: 15,
    fontWeight: 600,
    color: '#ffffff',
    letterSpacing: '0.5px',
    margin: 0,
  } as React.CSSProperties,

  cardMeta: {
    fontSize: 11,
    color: '#777777',
    fontFamily: FONT.body,
  } as React.CSSProperties,

  cardActions: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
  } as React.CSSProperties,

  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  modal: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    padding: 28,
    width: '90%',
    maxWidth: 680,
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  } as React.CSSProperties,

  modalTitle: {
    fontFamily: FONT.heading,
    fontSize: 18,
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
    color: '#e8f442',
    margin: 0,
    fontWeight: 600,
  } as React.CSSProperties,

  label: {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    color: '#777777',
    marginBottom: 4,
    display: 'block',
  } as React.CSSProperties,

  input: {
    width: '100%',
    backgroundColor: '#1e1e1e',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    color: '#ffffff',
    padding: '8px 12px',
    fontFamily: FONT.body,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  select: {
    width: '100%',
    backgroundColor: '#1e1e1e',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    color: '#ffffff',
    padding: '8px 12px',
    fontFamily: FONT.body,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  textarea: {
    width: '100%',
    backgroundColor: '#1e1e1e',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    color: '#ffffff',
    padding: '8px 12px',
    fontFamily: FONT.body,
    fontSize: 13,
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 220,
    lineHeight: 1.6,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  modalActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  viewContent: {
    backgroundColor: '#111111',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    padding: '12px 16px',
    color: '#cccccc',
    fontFamily: FONT.body,
    fontSize: 13,
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap' as const,
    minHeight: 120,
  } as React.CSSProperties,

  emptyState: {
    textAlign: 'center' as const,
    color: '#777777',
    padding: '60px 0',
    fontFamily: FONT.body,
    fontSize: 14,
  } as React.CSSProperties,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontFamily: FONT.heading,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    cursor: 'pointer',
    border: active ? '1px solid #e8f442' : '1px solid #383838',
    backgroundColor: active ? '#e8f442' : '#1a1a1a',
    color: active ? '#111111' : '#cccccc',
  }
}

function catBadgeStyle(cat: Categoria): React.CSSProperties {
  const c = CAT_COLORS[cat]
  return {
    display: 'inline-block',
    backgroundColor: c + '22',
    color: c,
    border: `1px solid ${c}55`,
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    fontFamily: FONT.heading,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }
}

function btnSmall(variant: 'view' | 'edit' | 'archive'): React.CSSProperties {
  const map = {
    view:    { bg: '#1e2233', color: '#e8f442' },
    edit:    { bg: '#1e1e1e', color: '#ffffff' },
    archive: { bg: '#1e1e1e', color: '#777777' },
  }
  return {
    backgroundColor: map[variant].bg,
    color: map[variant].color,
    border: '1px solid #383838',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 11,
    fontFamily: FONT.heading,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    cursor: 'pointer',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ManualesOperaciones() {
  const [manuales, setManuales] = useState<Manual[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [catFilter, setCatFilter] = useState<Categoria | 'todos'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [verArchivados, setVerArchivados] = useState(false)

  type ModalMode = 'view' | 'edit' | 'new' | null
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [selected, setSelected] = useState<Manual | null>(null)
  const [draft, setDraft] = useState<ManualDraft>({ ...EMPTY_DRAFT })
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('manuales_operaciones')
      .select('*')
      .order('updated_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setManuales((data ?? []) as Manual[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtered = manuales.filter(m => {
    if (!verArchivados && !m.activo) return false
    if (verArchivados && m.activo) return false
    if (catFilter !== 'todos' && m.categoria !== catFilter) return false
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      if (!m.titulo.toLowerCase().includes(q) && !m.contenido.toLowerCase().includes(q)) return false
    }
    return true
  })

  const abrirNuevo = () => {
    setDraft({ ...EMPTY_DRAFT })
    setSelected(null)
    setModalMode('new')
  }

  const abrirVer = (m: Manual) => {
    setSelected(m)
    setModalMode('view')
  }

  const abrirEditar = (m: Manual) => {
    setSelected(m)
    setDraft({
      titulo: m.titulo,
      categoria: m.categoria,
      contenido: m.contenido,
      creado_por: m.creado_por,
    })
    setModalMode('edit')
  }

  const cerrarModal = () => {
    setModalMode(null)
    setSelected(null)
    setDraft({ ...EMPTY_DRAFT })
  }

  const guardar = async () => {
    if (!draft.titulo.trim()) return
    setSaving(true)

    if (modalMode === 'new') {
      const { error: err } = await supabase
        .from('manuales_operaciones')
        .insert({
          titulo: draft.titulo.trim(),
          categoria: draft.categoria,
          contenido: draft.contenido,
          creado_por: draft.creado_por,
          version: 1,
          activo: true,
        })
      if (err) { alert('Error al guardar: ' + err.message); setSaving(false); return }
    } else if (modalMode === 'edit' && selected) {
      const { error: err } = await supabase
        .from('manuales_operaciones')
        .update({
          titulo: draft.titulo.trim(),
          categoria: draft.categoria,
          contenido: draft.contenido,
          version: selected.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selected.id)
      if (err) { alert('Error al guardar: ' + err.message); setSaving(false); return }
    }

    setSaving(false)
    cerrarModal()
    cargar()
  }

  const archivar = async (m: Manual) => {
    if (!confirm(`¿Archivar "${m.titulo}"?`)) return
    await supabase
      .from('manuales_operaciones')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', m.id)
    cargar()
    if (modalMode !== null) cerrarModal()
  }

  const restaurar = async (m: Manual) => {
    await supabase
      .from('manuales_operaciones')
      .update({ activo: true, updated_at: new Date().toISOString() })
      .eq('id', m.id)
    cargar()
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>Manuales de Operaciones</h1>
        <button style={S.btnAdd} onClick={abrirNuevo}>+ Nuevo Manual</button>
      </div>

      {/* Category pills */}
      <div style={S.filters}>
        <button style={pillStyle(catFilter === 'todos')} onClick={() => setCatFilter('todos')}>
          Todos
        </button>
        {CATEGORIAS.map(c => (
          <button
            key={c.value}
            style={pillStyle(catFilter === c.value)}
            onClick={() => setCatFilter(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Search + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          style={S.searchInput}
          placeholder="Buscar por título o contenido..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: FONT.heading, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#777777' }}>
          <input
            type="checkbox"
            checked={verArchivados}
            onChange={e => setVerArchivados(e.target.checked)}
            style={{ accentColor: '#e8f442' }}
          />
          Ver archivados
        </label>
      </div>

      {/* States */}
      {loading && (
        <p style={{ color: '#777777', fontFamily: FONT.body, fontSize: 13 }}>Cargando...</p>
      )}
      {error && (
        <p style={{ color: '#ff4444', fontFamily: FONT.body, fontSize: 13 }}>Error: {error}</p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div style={S.emptyState}>
          {verArchivados
            ? 'No hay manuales archivados.'
            : 'No hay manuales activos. Crea el primero con "+ Nuevo Manual".'}
        </div>
      )}

      {/* Grid */}
      {!loading && !error && filtered.length > 0 && (
        <div style={S.grid}>
          {filtered.map(m => (
            <div key={m.id} style={S.card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <p style={S.cardTitle}>{m.titulo}</p>
                <span style={catBadgeStyle(m.categoria)}>
                  {CATEGORIAS.find(c => c.value === m.categoria)?.label ?? m.categoria}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span style={S.cardMeta}>v{m.version}</span>
                <span style={S.cardMeta}>Actualizado: {fmtDate(m.updated_at)}</span>
                {m.creado_por && <span style={S.cardMeta}>Por: {m.creado_por}</span>}
              </div>

              {m.contenido && (
                <p style={{ ...S.cardMeta, fontSize: 12 }}>
                  {m.contenido.slice(0, 120)}{m.contenido.length > 120 ? '…' : ''}
                </p>
              )}

              <div style={S.cardActions}>
                <button style={btnSmall('view')} onClick={() => abrirVer(m)}>Ver</button>
                {m.activo
                  ? <>
                      <button style={btnSmall('edit')} onClick={() => abrirEditar(m)}>Editar</button>
                      <button style={btnSmall('archive')} onClick={() => archivar(m)}>Archivar</button>
                    </>
                  : <button style={btnSmall('edit')} onClick={() => restaurar(m)}>Restaurar</button>
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalMode !== null && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) cerrarModal() }}>
          <div style={S.modal}>

            {modalMode === 'view' && selected && (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <h2 style={S.modalTitle}>{selected.titulo}</h2>
                  <span style={catBadgeStyle(selected.categoria)}>
                    {CATEGORIAS.find(c => c.value === selected.categoria)?.label}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span style={S.cardMeta}>Versión {selected.version}</span>
                  <span style={S.cardMeta}>Actualizado: {fmtDate(selected.updated_at)}</span>
                  {selected.creado_por && <span style={S.cardMeta}>Por: {selected.creado_por}</span>}
                </div>

                <div style={S.viewContent}>
                  {selected.contenido || <em style={{ color: '#555555' }}>Sin contenido</em>}
                </div>

                <div style={S.modalActions}>
                  {selected.activo && (
                    <>
                      <button style={S.btnSecondary} onClick={() => abrirEditar(selected)}>Editar</button>
                      <button style={{ ...S.btnSecondary, color: '#ff7777' }} onClick={() => archivar(selected)}>Archivar</button>
                    </>
                  )}
                  <button style={S.btnSecondary} onClick={cerrarModal}>Cerrar</button>
                </div>
              </>
            )}

            {(modalMode === 'edit' || modalMode === 'new') && (
              <>
                <h2 style={S.modalTitle}>
                  {modalMode === 'new' ? 'Nuevo Manual' : 'Editar Manual'}
                </h2>

                <div>
                  <label style={S.label}>Título *</label>
                  <input
                    style={S.input}
                    value={draft.titulo}
                    onChange={e => setDraft(d => ({ ...d, titulo: e.target.value }))}
                    placeholder="Nombre del manual..."
                    maxLength={200}
                  />
                </div>

                <div>
                  <label style={S.label}>Categoría</label>
                  <select
                    style={S.select}
                    value={draft.categoria}
                    onChange={e => setDraft(d => ({ ...d, categoria: e.target.value as Categoria }))}
                  >
                    {CATEGORIAS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={S.label}>Creado por</label>
                  <input
                    style={S.input}
                    value={draft.creado_por ?? ''}
                    onChange={e => setDraft(d => ({ ...d, creado_por: e.target.value || null }))}
                    placeholder="Nombre del autor (opcional)"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label style={S.label}>
                    Contenido
                    {modalMode === 'edit' && selected && (
                      <span style={{ marginLeft: 8, color: '#555555', textTransform: 'none', letterSpacing: 0 }}>
                        (guardar sube a v{selected.version + 1})
                      </span>
                    )}
                  </label>
                  <textarea
                    style={S.textarea}
                    value={draft.contenido}
                    onChange={e => setDraft(d => ({ ...d, contenido: e.target.value }))}
                    placeholder="Escribe el procedimiento aquí. Soporta texto plano con saltos de línea."
                  />
                </div>

                <div style={S.modalActions}>
                  {modalMode === 'edit' && selected?.activo && (
                    <button
                      style={{ ...S.btnSecondary, color: '#ff7777', marginRight: 'auto' }}
                      onClick={() => archivar(selected)}
                    >
                      Archivar
                    </button>
                  )}
                  <button style={S.btnSecondary} onClick={cerrarModal}>Cancelar</button>
                  <button
                    style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1 }}
                    onClick={guardar}
                    disabled={saving || !draft.titulo.trim()}
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
