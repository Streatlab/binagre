import { AZUL_CL, BLANCO, GRANATE, GRIS, INK, LIMA, NAR, VERDE } from '@/styles/neobrutal'
import { MANUALES_CAT_EMERGENCIA, MANUALES_CAT_RRHH, MANUALES_DANGER_TXT } from '@/styles/palettes'
import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtDate } from '@/utils/format'
import { FONT } from '@/styles/tokens'
import { HeroCantera, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

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
  apertura:          LIMA,
  cierre:            GRIS,
  limpieza:          AZUL_CL,
  recepcion_pedidos: VERDE,
  atencion_cliente:  NAR,
  cocina:            GRANATE,
  emergencias:       MANUALES_CAT_EMERGENCIA,
  rrhh:              MANUALES_CAT_RRHH,
  general:           GRIS,
}

const EMPTY_DRAFT: ManualDraft = {
  titulo: '',
  categoria: 'general',
  contenido: '',
  creado_por: null,
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  btnPrimary: {
    backgroundColor: GRANATE,
    color: BLANCO,
    border: `3px solid ${INK}`,
    boxShadow: `3px 3px 0 ${INK}`,
    padding: '9px 18px',
    fontFamily: FONT.heading,
    fontSize: 12,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
  } as CSSProperties,

  btnSecondary: {
    backgroundColor: BLANCO,
    color: GRIS,
    border: `2px solid ${INK}`,
    padding: '8px 16px',
    fontFamily: FONT.heading,
    fontSize: 12,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
  } as CSSProperties,

  btnAdd: {
    backgroundColor: LIMA,
    color: INK,
    border: `3px solid ${INK}`,
    boxShadow: `3px 3px 0 ${INK}`,
    padding: '9px 18px',
    fontFamily: FONT.heading,
    fontSize: 12,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    fontWeight: 700,
  } as CSSProperties,

  searchInput: {
    backgroundColor: BLANCO,
    border: `3px solid ${INK}`,
    color: INK,
    padding: '8px 12px',
    fontFamily: FONT.body,
    fontSize: 13,
    width: 220,
    outline: 'none',
  } as CSSProperties,

  cardTitle: {
    fontFamily: FONT.heading,
    fontSize: 15,
    fontWeight: 600,
    color: INK,
    letterSpacing: '0.5px',
    margin: 0,
  } as CSSProperties,

  cardMeta: {
    fontSize: 11,
    color: GRIS,
    fontFamily: FONT.body,
  } as CSSProperties,

  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  } as CSSProperties,

  modal: {
    backgroundColor: BLANCO,
    border: `3px solid ${INK}`,
    borderTop: `7px solid ${GRANATE}`,
    padding: 28,
    width: '90%',
    maxWidth: 680,
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  } as CSSProperties,

  modalTitle: {
    fontFamily: FONT.heading,
    fontSize: 18,
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
    color: GRANATE,
    margin: 0,
    fontWeight: 600,
  } as CSSProperties,

  label: {
    fontFamily: FONT.heading,
    fontSize: 11,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    color: GRIS,
    marginBottom: 4,
    display: 'block',
  } as CSSProperties,

  input: {
    width: '100%',
    backgroundColor: BLANCO,
    border: `3px solid ${INK}`,
    color: INK,
    padding: '8px 12px',
    fontFamily: FONT.body,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as CSSProperties,

  textarea: {
    width: '100%',
    backgroundColor: BLANCO,
    border: `3px solid ${INK}`,
    color: INK,
    padding: '8px 12px',
    fontFamily: FONT.body,
    fontSize: 13,
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 220,
    lineHeight: 1.6,
    boxSizing: 'border-box' as const,
  } as CSSProperties,

  modalActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    flexWrap: 'wrap' as const,
  } as CSSProperties,

  viewContent: {
    backgroundColor: BLANCO,
    border: `2px solid ${INK}`,
    padding: '12px 16px',
    color: INK,
    fontFamily: FONT.body,
    fontSize: 13,
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap' as const,
    minHeight: 120,
  } as CSSProperties,

  emptyState: {
    textAlign: 'center' as const,
    color: GRIS,
    padding: '60px 0',
    fontFamily: FONT.body,
    fontSize: 14,
  } as CSSProperties,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pillStyle(active: boolean): CSSProperties {
  return {
    padding: '4px 12px',
    fontSize: 12,
    fontFamily: FONT.heading,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    cursor: 'pointer',
    border: `2px solid ${INK}`,
    backgroundColor: active ? LIMA : BLANCO,
    color: INK,
  }
}

function catBadgeStyle(cat: Categoria): CSSProperties {
  const c = CAT_COLORS[cat]
  return {
    display: 'inline-block',
    backgroundColor: BLANCO,
    color: c,
    border: `2px solid ${c}`,
    padding: '2px 8px',
    fontSize: 11,
    fontFamily: FONT.heading,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }
}

function btnSmall(variant: 'view' | 'edit' | 'archive'): CSSProperties {
  const map = {
    view:    { color: GRANATE },
    edit:    { color: INK },
    archive: { color: GRIS },
  }
  return {
    backgroundColor: BLANCO,
    color: map[variant].color,
    border: `2px solid ${INK}`,
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

  const activos = manuales.filter(m => m.activo)
  const archivados = manuales.filter(m => !m.activo)

  const titularHero = manuales.length === 0
    ? 'Aún no hay manuales de operaciones.'
    : `${activos.length} ${activos.length === 1 ? 'manual activo' : 'manuales activos'} para consultar.`

  const atencionHero = [
    `${activos.length} activos`,
    archivados.length > 0 ? `${archivados.length} archivados` : null,
    `${CATEGORIAS.length} categorías`,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>

      {/* Acción propia */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button style={S.btnAdd} onClick={abrirNuevo}>+ Nuevo Manual</button>
      </div>

      {/* 1 · Héroe del área Operaciones (naranja) */}
      <HeroCantera
        area="ops"
        titular={titularHero}
        atencion={atencionHero}
      />

      {error && <Papel ceja={MANUALES_CAT_EMERGENCIA} style={{ color: MANUALES_CAT_EMERGENCIA }}>{error}</Papel>}

      {/* 3 · Frase potente */}
      {!loading && !error && manuales.length > 0 && (
        <FrasePotente significado="oportunidad">Cada manual actualizado evita errores repetidos en el turno.</FrasePotente>
      )}

      {/* Category pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          style={S.searchInput}
          placeholder="Buscar por título o contenido..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: FONT.heading, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', color: GRIS }}>
          <input
            type="checkbox"
            checked={verArchivados}
            onChange={e => setVerArchivados(e.target.checked)}
            style={{ accentColor: LIMA }}
          />
          Ver archivados
        </label>
      </div>

      {/* States */}
      {loading && (
        <p style={{ color: GRIS, fontFamily: FONT.body, fontSize: 13 }}>Cargando...</p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div style={S.emptyState}>
          {verArchivados
            ? 'No hay manuales archivados.'
            : 'No hay manuales activos. Crea el primero con "+ Nuevo Manual".'}
        </div>
      )}

      {/* Lista */}
      {!loading && !error && filtered.length > 0 && (
        <div>
          <SeccionLabel bg={GRANATE}>{verArchivados ? 'Archivados' : 'Manuales'}</SeccionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {filtered.map(m => (
              <Papel key={m.id} ceja={CAT_COLORS[m.categoria]} style={{ flex: '1 1 300px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
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

                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button style={btnSmall('view')} onClick={() => abrirVer(m)}>Ver</button>
                  {m.activo
                    ? <>
                        <button style={btnSmall('edit')} onClick={() => abrirEditar(m)}>Editar</button>
                        <button style={btnSmall('archive')} onClick={() => archivar(m)}>Archivar</button>
                      </>
                    : <button style={btnSmall('edit')} onClick={() => restaurar(m)}>Restaurar</button>
                  }
                </div>
              </Papel>
            ))}
          </div>
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
                  {selected.contenido || <em style={{ color: GRIS }}>Sin contenido</em>}
                </div>

                <div style={S.modalActions}>
                  {selected.activo && (
                    <>
                      <button style={S.btnSecondary} onClick={() => abrirEditar(selected)}>Editar</button>
                      <button style={{ ...S.btnSecondary, color: MANUALES_DANGER_TXT }} onClick={() => archivar(selected)}>Archivar</button>
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
                    style={S.input}
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
                      <span style={{ marginLeft: 8, color: GRIS, textTransform: 'none', letterSpacing: 0 }}>
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
                      style={{ ...S.btnSecondary, color: MANUALES_DANGER_TXT, marginRight: 'auto' }}
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
    </PantallaCantera>
  )
}
