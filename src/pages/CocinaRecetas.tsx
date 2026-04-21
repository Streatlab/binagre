import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNum } from '@/utils/format'
import { useTheme, FONT } from '@/styles/tokens'

// ─── TIPOS ───────────────────────────────────────────────────

interface Receta {
  id: string
  codigo: string
  nombre: string
  raciones: number
  categoria: string | null
  coste_rac: number
  pvp_real: number | null
  elaboracion: string | null
  herramientas: string | null
  alergenos: string[] | null
  foto_url: string | null
}

interface RecetaLinea {
  linea: number
  tipo: string
  ingrediente_nombre: string
  cantidad: number
  unidad: string
  eur_ud_neta: number
}

const ALERGENOS_LIST = [
  'Gluten', 'Lácteos', 'Huevo', 'Pescado', 'Marisco',
  'Frutos secos', 'Soja', 'Apio', 'Mostaza', 'Sésamo',
  'Sulfitos', 'Altramuces', 'Moluscos', 'Cacahuetes',
]

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────

export default function CocinaRecetas() {
  const { T, isDark } = useTheme()

  const [recetas, setRecetas] = useState<Receta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Receta | null>(null)
  const [lineas, setLineas] = useState<RecetaLinea[]>([])
  const [loadingLineas, setLoadingLineas] = useState(false)
  const [categorias, setCategorias] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')

  // Edit states — always editable, no editMode toggle
  const [editCategoria, setEditCategoria] = useState('')
  const [editElaboracion, setEditElaboracion] = useState('')
  const [editHerramientas, setEditHerramientas] = useState('')
  const [editAlergenos, setEditAlergenos] = useState<string[]>([])
  const [editFotoUrl, setEditFotoUrl] = useState('')

  // Actions
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadRecetas()
    loadCategorias()
  }, [])

  async function loadRecetas() {
    setLoading(true)
    const { data, error: e } = await supabase
      .from('recetas')
      .select('id,codigo,nombre,raciones,categoria,coste_rac,pvp_real,elaboracion,herramientas,alergenos,foto_url')
      .order('nombre')
    if (e) setError(e.message)
    else setRecetas((data as Receta[]) ?? [])
    setLoading(false)
  }

  async function loadCategorias() {
    const { data } = await supabase
      .from('configuracion')
      .select('valor')
      .eq('clave', 'categorias_recetas')
      .single()
    if (data?.valor) {
      try {
        const parsed = JSON.parse(data.valor)
        if (Array.isArray(parsed)) setCategorias(parsed)
      } catch { /* ignore parse error */ }
    }
  }

  function resetFields(r: Receta) {
    setEditCategoria(r.categoria ?? '')
    setEditElaboracion(r.elaboracion ?? '')
    setEditHerramientas(r.herramientas ?? '')
    setEditAlergenos(r.alergenos ?? [])
    setEditFotoUrl(r.foto_url ?? '')
  }

  async function selectReceta(r: Receta) {
    setSelected(r)
    resetFields(r)
    setConfirmEliminar(false)
    setSavedOk(false)
    setLoadingLineas(true)
    const { data } = await supabase
      .from('recetas_lineas')
      .select('linea,tipo,ingrediente_nombre,cantidad,unidad,eur_ud_neta')
      .eq('receta_id', r.id)
      .order('linea')
    setLineas((data as RecetaLinea[]) ?? [])
    setLoadingLineas(false)
  }

  async function saveReceta() {
    if (!selected) return
    setSaving(true)
    const { error: e } = await supabase
      .from('recetas')
      .update({
        categoria: editCategoria || null,
        elaboracion: editElaboracion || null,
        herramientas: editHerramientas || null,
        alergenos: editAlergenos.length > 0 ? editAlergenos : null,
        foto_url: editFotoUrl || null,
      })
      .eq('id', selected.id)
    if (!e) {
      const updated: Receta = {
        ...selected,
        categoria: editCategoria || null,
        elaboracion: editElaboracion || null,
        herramientas: editHerramientas || null,
        alergenos: editAlergenos.length > 0 ? editAlergenos : null,
        foto_url: editFotoUrl || null,
      }
      setRecetas(prev => prev.map(r => r.id === selected.id ? updated : r))
      setSelected(updated)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
    }
    setSaving(false)
  }

  async function eliminarReceta() {
    if (!selected) return
    setDeleting(true)
    await supabase.from('recetas_lineas').delete().eq('receta_id', selected.id)
    await supabase.from('recetas').delete().eq('id', selected.id)
    setRecetas(prev => prev.filter(r => r.id !== selected.id))
    setSelected(null)
    setLineas([])
    setConfirmEliminar(false)
    setDeleting(false)
  }

  const recetasFiltradas = useMemo(() => recetas.filter(r =>
    r.nombre.toLowerCase().includes(busqueda.toLowerCase())
  ), [recetas, busqueda])

  const grouped = useMemo(() => {
    const byCat: Record<string, Receta[]> = {}
    recetasFiltradas.forEach(r => {
      const cat = r.categoria ?? 'Sin categoría'
      if (!byCat[cat]) byCat[cat] = []
      byCat[cat].push(r)
    })
    const result: Array<{ cat: string; items: Receta[] }> = []
    const used = new Set<string>()
    // DB-ordered categories first
    categorias.forEach(c => {
      if (byCat[c]) { result.push({ cat: c, items: byCat[c] }); used.add(c) }
    })
    // Any remaining categories not in DB list
    Object.keys(byCat).forEach(cat => {
      if (!used.has(cat) && cat !== 'Sin categoría') { result.push({ cat, items: byCat[cat] }); used.add(cat) }
    })
    // "Sin categoría" always last
    if (byCat['Sin categoría']) result.push({ cat: 'Sin categoría', items: byCat['Sin categoría'] })
    return result
  }, [recetasFiltradas, categorias])

  const inputStyle: React.CSSProperties = {
    background: isDark ? '#3a4058' : '#ffffff',
    border: `1px solid ${isDark ? '#4a5270' : '#d0c8bc'}`,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 13,
    borderRadius: 8,
    padding: '7px 10px',
    width: '100%',
    boxSizing: 'border-box',
  }

  const sectionLabel: React.CSSProperties = {
    fontFamily: FONT.heading,
    fontSize: 10,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: T.mut,
    marginBottom: 8,
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '4px 8px',
    color: T.mut,
    fontSize: 10,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    fontWeight: 400,
    fontFamily: FONT.heading,
  }

  if (loading) return <div style={{ padding: 32, color: T.sec, fontFamily: FONT.body }}>Cargando fichas…</div>
  if (error) return <div style={{ padding: 32, color: '#E24B4A', fontFamily: FONT.body }}>{error}</div>

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 80px)' }}>

      {/* ── LEFT PANEL 280px ─────────────────────────────── */}
      <div style={{
        width: 280, flexShrink: 0,
        background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 12,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 14px 8px' }}>
          <input
            placeholder="Buscar ficha..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, padding: '0 14px 8px' }}>
          {recetasFiltradas.length} fichas
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {grouped.map(({ cat, items }) => (
            <div key={cat}>
              <div style={{
                fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px',
                textTransform: 'uppercase', color: T.mut,
                padding: '10px 14px 4px', marginTop: 4,
              }}>
                {cat}
              </div>
              {items.map(r => {
                const isActive = selected?.id === r.id
                return (
                  <div
                    key={r.id}
                    onClick={() => selectReceta(r)}
                    style={{
                      padding: '9px 14px',
                      cursor: 'pointer',
                      borderLeft: isActive ? `2px solid ${T.emphasis}` : '2px solid transparent',
                      background: isActive
                        ? (isDark ? 'rgba(232,244,66,0.08)' : 'rgba(176,29,35,0.06)')
                        : 'transparent',
                      transition: 'background 100ms',
                    }}
                  >
                    <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.nombre}
                    </div>
                    <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 2 }}>
                      {fmtEur(r.coste_rac)}/rac
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          {grouped.length === 0 && (
            <div style={{ padding: 20, fontFamily: FONT.body, fontSize: 13, color: T.mut, textAlign: 'center' }}>
              Sin resultados
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────── */}
      {selected ? (
        <div style={{
          flex: 1,
          background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 12,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '2px', textTransform: 'uppercase', color: T.emphasis }}>
                {selected.nombre}
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, marginTop: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>
                  {selected.raciones} ración{selected.raciones !== 1 ? 'es' : ''} · Coste {fmtEur(selected.coste_rac)}/rac
                  {selected.pvp_real ? ` · PVP ${fmtEur(selected.pvp_real)}` : ''}
                </span>
                {savedOk && <span style={{ color: '#1D9E75' }}>✓ Guardado</span>}
              </div>
            </div>

            {/* Categoría */}
            <div style={{ marginBottom: 20 }}>
              <div style={sectionLabel}>Categoría</div>
              <select
                value={editCategoria}
                onChange={e => setEditCategoria(e.target.value)}
                style={{ ...inputStyle, width: 'auto' }}
              >
                <option value="">Sin categoría</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Ingredientes — readonly */}
            <div style={{ marginBottom: 20 }}>
              <div style={sectionLabel}>Ingredientes</div>
              {loadingLineas ? (
                <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>Cargando…</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                      <th style={thStyle}>Ingrediente / EPS</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Cantidad</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Coste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, i) => (
                      <tr key={i} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                        <td style={{ padding: '7px 8px', color: T.pri }}>
                          {l.tipo === 'EPS' && <span style={{ color: T.mut, fontSize: 11, marginRight: 4 }}>EPS ·</span>}
                          {l.ingrediente_nombre.replace(/_[A-Z]+$/, '')}
                        </td>
                        <td style={{ padding: '7px 8px', color: T.sec, textAlign: 'right' }}>{fmtNum(l.cantidad)} {l.unidad}</td>
                        <td style={{ padding: '7px 8px', color: T.sec, textAlign: 'right' }}>{fmtEur(l.cantidad * l.eur_ud_neta)}</td>
                      </tr>
                    ))}
                    {lineas.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ padding: '12px 8px', color: T.mut, fontStyle: 'italic' }}>
                          Sin ingredientes registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Elaboración */}
            <div style={{ marginBottom: 20 }}>
              <div style={sectionLabel}>Elaboración</div>
              <textarea
                value={editElaboracion}
                onChange={e => setEditElaboracion(e.target.value)}
                placeholder="Pasos de elaboración..."
                rows={8}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            {/* Herramientas */}
            <div style={{ marginBottom: 20 }}>
              <div style={sectionLabel}>Herramientas y Equipos</div>
              <textarea
                value={editHerramientas}
                onChange={e => setEditHerramientas(e.target.value)}
                placeholder="Herramientas, equipos y utensilios necesarios..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            {/* Alérgenos */}
            <div style={{ marginBottom: 20 }}>
              <div style={sectionLabel}>Alérgenos</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {ALERGENOS_LIST.map(a => {
                  const checked = editAlergenos.includes(a)
                  return (
                    <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: FONT.body, fontSize: 12, color: checked ? T.pri : T.sec }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setEditAlergenos(p => checked ? p.filter(x => x !== a) : [...p, a])}
                        style={{ accentColor: T.emphasis }}
                      />
                      {a}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Foto URL */}
            <div>
              <div style={sectionLabel}>Foto</div>
              <input
                value={editFotoUrl}
                onChange={e => setEditFotoUrl(e.target.value)}
                placeholder="URL de la foto..."
                style={inputStyle}
              />
              {editFotoUrl && (
                <div style={{ marginTop: 10 }}>
                  <img
                    src={editFotoUrl}
                    alt={selected.nombre}
                    style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, border: `0.5px solid ${T.brd}` }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}
            </div>

          </div>

          {/* Bottom buttons */}
          <div style={{ padding: '16px 28px', borderTop: `0.5px solid ${T.brd}`, display: 'flex', gap: 8, alignItems: 'center' }}>
            {confirmEliminar ? (
              <>
                <span style={{ fontFamily: FONT.body, fontSize: 12, color: '#E24B4A', flex: 1 }}>
                  ¿Eliminar esta ficha? Esta acción no se puede deshacer.
                </span>
                <button
                  onClick={() => setConfirmEliminar(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: 'none', color: T.sec, fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={eliminarReceta}
                  disabled={deleting}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#E24B4A', color: '#fff', fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }}
                >
                  {deleting ? 'Eliminando…' : 'Confirmar eliminación'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setConfirmEliminar(true)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: 'none', color: '#E24B4A', fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }}
                >
                  ELIMINAR
                </button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => resetFields(selected)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: 'none', color: T.sec, fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }}
                >
                  CANCELAR
                </button>
                <button
                  onClick={saveReceta}
                  disabled={saving}
                  style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#B01D23', color: '#fff', fontFamily: FONT.body, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                >
                  {saving ? 'Guardando…' : 'GUARDAR'}
                </button>
              </>
            )}
          </div>

        </div>
      ) : (
        <div style={{
          flex: 1,
          background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 14 }}>
            Selecciona una ficha técnica para ver el detalle
          </div>
        </div>
      )}

    </div>
  )
}
