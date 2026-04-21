import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import {
  useTheme,
  cardStyle,
  FONT,
} from '@/styles/tokens'

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
  alergenos: string[] | null
  foto_url: string | null
}

interface RecetaLinea {
  linea: number
  tipo: string
  ingrediente_nombre: string
  cantidad: number
  unidad: string
  eur_total: number
}

const ALERGENOS_LIST = [
  'Gluten','Lácteos','Huevo','Pescado','Marisco',
  'Frutos secos','Soja','Apio','Mostaza','Sésamo',
  'Sulfitos','Altramuces','Moluscos','Cacahuetes'
]

const CATEGORIAS = ['Entrante','Principal','Postre','Bebida','Guarnición','Salsa','Base']

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────

export default function CocinaRecetas() {
  const { T, isDark } = useTheme()
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Receta | null>(null)
  const [lineas, setLineas] = useState<RecetaLinea[]>([])
  const [loadingLineas, setLoadingLineas] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editElaboracion, setEditElaboracion] = useState('')
  const [editAlergenos, setEditAlergenos] = useState<string[]>([])
  const [editCategoria, setEditCategoria] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCat, setFiltroCat] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error: e } = await supabase
      .from('recetas')
      .select('id,codigo,nombre,raciones,categoria,coste_rac,pvp_real,elaboracion,alergenos,foto_url')
      .order('nombre')
    if (e) setError(e.message)
    else setRecetas((data as Receta[]) ?? [])
    setLoading(false)
  }

  async function selectReceta(r: Receta) {
    setSelected(r)
    setEditMode(false)
    setEditElaboracion(r.elaboracion ?? '')
    setEditAlergenos(r.alergenos ?? [])
    setEditCategoria(r.categoria ?? '')
    setLoadingLineas(true)
    const { data } = await supabase
      .from('recetas_lineas')
      .select('linea,tipo,ingrediente_nombre,cantidad,unidad,eur_total')
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
        elaboracion: editElaboracion || null,
        alergenos: editAlergenos.length > 0 ? editAlergenos : null,
        categoria: editCategoria || null,
      })
      .eq('id', selected.id)
    if (!e) {
      setRecetas(prev => prev.map(r => r.id === selected.id
        ? { ...r, elaboracion: editElaboracion, alergenos: editAlergenos, categoria: editCategoria }
        : r
      ))
      setSelected(prev => prev ? { ...prev, elaboracion: editElaboracion, alergenos: editAlergenos, categoria: editCategoria } : prev)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2000)
      setEditMode(false)
    }
    setSaving(false)
  }

  const recetasFiltradas = useMemo(() => recetas.filter(r => {
    const matchBusq = r.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchCat = filtroCat === '' || r.categoria === filtroCat
    return matchBusq && matchCat
  }), [recetas, busqueda, filtroCat])

  const inputStyle: React.CSSProperties = {
    background: isDark ? '#3a4058' : '#ffffff',
    border: `1px solid ${isDark ? '#4a5270' : '#cccccc'}`,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 12,
    borderRadius: 8,
    padding: '6px 10px',
    width: '100%',
  }

  if (loading) return <div style={{ padding: 32, color: T.sec, fontFamily: FONT.body }}>Cargando recetas…</div>
  if (error) return <div style={{ padding: 32, color: '#E24B4A', fontFamily: FONT.body }}>{error}</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, height: '100%', minHeight: '80vh' }}>

      {/* LISTA IZQUIERDA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Buscador y filtro */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            placeholder="Buscar receta..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ ...inputStyle }}
          />
          <select
            value={filtroCat}
            onChange={e => setFiltroCat(e.target.value)}
            style={{ ...inputStyle }}
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Contador */}
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
          {recetasFiltradas.length} recetas
        </div>

        {/* Lista */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {recetasFiltradas.map(r => {
            const isSelected = selected?.id === r.id
            const tieneElaboracion = !!r.elaboracion
            return (
              <div
                key={r.id}
                onClick={() => selectReceta(r)}
                style={{
                  ...cardStyle(T),
                  cursor: 'pointer',
                  padding: '10px 14px',
                  border: isSelected ? `1px solid ${T.emphasis}` : `0.5px solid ${T.brd}`,
                  background: isSelected ? (isDark ? '#1a1f32' : '#ffffff') : T.card,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FONT.body, fontSize: 13, fontWeight: 500, color: T.pri, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.nombre}
                  </div>
                  <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 2 }}>
                    {r.categoria ?? 'Sin categoría'} · {fmtEur(r.coste_rac)}/rac
                  </div>
                </div>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: tieneElaboracion ? '#1D9E75' : '#E24B4A',
                }} title={tieneElaboracion ? 'Con elaboración' : 'Sin elaboración'} />
              </div>
            )
          })}
        </div>
      </div>

      {/* DETALLE DERECHA */}
      {selected ? (
        <div style={{ ...cardStyle(T), overflowY: 'auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontFamily: FONT.heading, fontSize: 20, letterSpacing: '2px', textTransform: 'uppercase', color: "#B01D23", marginBottom: 4 }}>
                {selected.nombre}
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>
                {selected.raciones} ración{selected.raciones !== 1 ? 'es' : ''} · Coste {fmtEur(selected.coste_rac)}/rac
                {selected.pvp_real ? ` · PVP ${fmtEur(selected.pvp_real)}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!editMode ? (
                <button onClick={() => setEditMode(true)} style={{ padding: '6px 14px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: 'none', color: T.sec, fontFamily: FONT.body, fontSize: 12, cursor: 'pointer' }}>
                  Editar
                </button>
              ) : (
                <>
                  <button onClick={saveReceta} disabled={saving} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#B01D23', color: '#fff', fontFamily: FONT.body, fontSize: 12, cursor: 'pointer' }}>
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button onClick={() => setEditMode(false)} style={{ padding: '6px 14px', borderRadius: 8, border: `0.5px solid ${T.brd}`, background: 'none', color: T.sec, fontFamily: FONT.body, fontSize: 12, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </>
              )}
              {savedOk && <span style={{ fontFamily: FONT.body, fontSize: 12, color: '#1D9E75', alignSelf: 'center' }}>✓ Guardado</span>}
            </div>
          </div>

          {/* Categoría editable */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>Categoría</div>
            {editMode ? (
              <select value={editCategoria} onChange={e => setEditCategoria(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                <option value="">Sin categoría</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{selected.categoria ?? '—'}</span>
            )}
          </div>

          {/* Ingredientes */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 10 }}>Ingredientes</div>
            {loadingLineas ? (
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec }}>Cargando…</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px', color: T.mut, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 400 }}>Ingrediente</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', color: T.mut, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 400 }}>Cantidad</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', color: T.mut, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 400 }}>Coste</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => (
                    <tr key={i} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                      <td style={{ padding: '7px 8px', color: T.pri }}>{l.ingrediente_nombre.replace(/_[A-Z]+$/, '')}</td>
                      <td style={{ padding: '7px 8px', color: T.sec, textAlign: 'right' }}>{l.cantidad} {l.unidad}</td>
                      <td style={{ padding: '7px 8px', color: T.sec, textAlign: 'right' }}>{fmtEur(l.eur_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Elaboración */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>Elaboración</div>
            {editMode ? (
              <textarea
                value={editElaboracion}
                onChange={e => setEditElaboracion(e.target.value)}
                placeholder="Escribe los pasos de elaboración..."
                rows={8}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              />
            ) : (
              <div style={{ fontFamily: FONT.body, fontSize: 13, color: selected.elaboracion ? T.pri : T.mut, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {selected.elaboracion ?? '⚠️ Sin elaboración — pulsa Editar para añadirla'}
              </div>
            )}
          </div>

          {/* Alérgenos */}
          <div>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>Alérgenos</div>
            {editMode ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ALERGENOS_LIST.map(a => {
                  const checked = editAlergenos.includes(a)
                  return (
                    <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: FONT.body, fontSize: 12, color: T.sec }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setEditAlergenos(p => checked ? p.filter(x => x !== a) : [...p, a])}
                      />
                      {a}
                    </label>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(selected.alergenos ?? []).length > 0
                  ? (selected.alergenos ?? []).map(a => (
                    <span key={a} style={{ fontFamily: FONT.body, fontSize: 11, padding: '3px 10px', borderRadius: 99, background: isDark ? '#2a1500' : '#fff3e0', color: '#f5a623', border: '0.5px solid #f5a623' }}>
                      {a}
                    </span>
                  ))
                  : <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>Sin alérgenos definidos</span>
                }
              </div>
            )}
          </div>

        </div>
      ) : (
        <div style={{ ...cardStyle(T), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 14 }}>
            Selecciona una receta para ver su ficha
          </div>
        </div>
      )}

    </div>
  )
}
