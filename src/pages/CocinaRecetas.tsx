import { GRANATE, VERDE, ROJO, GRIS, INK, BLANCO, AMA, NAR, OSW, LEX } from '@/styles/neobrutal'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useIsMobile } from '@/hooks/useIsMobile'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'

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

const inputStyle: React.CSSProperties = {
  background: BLANCO,
  border: `2px solid ${INK}`,
  color: INK,
  fontFamily: LEX,
  fontSize: 13,
  borderRadius: 0,
  padding: '9px 11px',
  minHeight: 44,
  width: '100%',
}

const btnBase: React.CSSProperties = {
  padding: '10px 18px', minHeight: 44, borderRadius: 0, border: `2px solid ${INK}`, boxShadow: SHADOW_DURA,
  fontFamily: OSW, fontSize: 12, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────

export default function CocinaRecetas() {
  const isMobile = useIsMobile()
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

  // ── Métricas del héroe: cobertura de elaboración escrita ──
  const stats = useMemo(() => {
    const total = recetas.length
    const conElaboracion = recetas.filter(r => !!r.elaboracion).length
    const sinElaboracion = total - conElaboracion
    const categorias = new Set(recetas.map(r => r.categoria).filter(Boolean)).size
    return { total, conElaboracion, sinElaboracion, categorias }
  }, [recetas])
  const pctElaboracion = stats.total > 0 ? Math.round((stats.conElaboracion / stats.total) * 100) : 0

  if (loading) return (
    <PantallaCantera>
      <div style={{ padding: 32, color: GRIS, fontFamily: LEX }}>Cargando recetas…</div>
    </PantallaCantera>
  )
  if (error) return (
    <PantallaCantera>
      <div style={{ padding: 32, color: ROJO, fontFamily: LEX }}>{error}</div>
    </PantallaCantera>
  )

  return (
    <PantallaCantera>
      {/* HÉROE (naranja · área Cocina) */}
      <HeroCantera
        area="cocina"
        titular={stats.sinElaboracion === 0 && stats.total > 0
          ? 'Todas tus recetas tienen la elaboración escrita para cocina.'
          : 'Hay recetas sin elaboración escrita: el equipo improvisa cada plato.'}
        etiquetaDato="Recetas con elaboración escrita"
        cifra={`${stats.conElaboracion}/${stats.total}`}
        resumen={<>{pctElaboracion}% de las recetas ya tienen sus pasos por escrito.</>}
        atencion={[
          stats.sinElaboracion > 0 ? `${stats.sinElaboracion} sin elaboración` : null,
          `${stats.categorias} categorías`,
          `${recetasFiltradas.length} en esta vista`,
        ].filter(Boolean) as string[]}
      />

      {/* PLANCHA DE KPIs */}
      <div>
        <SeccionLabel bg={GRANATE}>Cobertura de fichas</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={VERDE} color={BLANCO} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Con elaboración</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{stats.conElaboracion}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>de {stats.total} recetas</div>
          </PlanchaCelda>
          <PlanchaCelda bg={GRANATE} color={BLANCO}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Sin elaboración</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{stats.sinElaboracion}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>por completar</div>
          </PlanchaCelda>
          <PlanchaCelda bg={AMA} color={INK}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Categorías</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{stats.categorias}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>en uso</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* FRASE POTENTE */}
      {stats.sinElaboracion > 0 ? (
        <FrasePotente significado="peligro">
          {stats.sinElaboracion} receta{stats.sinElaboracion !== 1 ? 's' : ''} sin elaboración escrita: sin ese texto, cocina improvisa cada vez. Escríbelas antes de que toque producirlas.
        </FrasePotente>
      ) : stats.total > 0 ? (
        <FrasePotente significado="logro">
          Todas las recetas tienen su elaboración lista: cualquiera de cocina puede seguirlas sin preguntar.
        </FrasePotente>
      ) : null}

      {/* LISTA + DETALLE */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: 16, alignItems: 'start' }}>

        {/* LISTA IZQUIERDA */}
        <Papel ceja={NAR} pad="14px" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            placeholder="Buscar receta..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={inputStyle}
          />
          <select
            value={filtroCat}
            onChange={e => setFiltroCat(e.target.value)}
            style={inputStyle}
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, fontWeight: 600 }}>
            {recetasFiltradas.length} recetas
          </div>

          <div style={{ overflowY: 'auto', maxHeight: isMobile ? '42vh' : '68vh', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recetasFiltradas.map(r => {
              const isSelected = selected?.id === r.id
              const tieneElaboracion = !!r.elaboracion
              return (
                <div
                  key={r.id}
                  onClick={() => selectReceta(r)}
                  style={{
                    border: `2px solid ${INK}`,
                    boxShadow: isSelected ? SHADOW_DURA : 'none',
                    background: isSelected ? AMA : BLANCO,
                    cursor: 'pointer',
                    padding: '10px 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 500, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.nombre}
                    </div>
                    <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 2 }}>
                      {r.categoria ?? 'Sin categoría'} · {fmtEur(r.coste_rac)}/rac
                    </div>
                  </div>
                  <div style={{
                    width: 10, height: 10, flexShrink: 0, border: `2px solid ${INK}`,
                    background: tieneElaboracion ? VERDE : ROJO,
                  }} title={tieneElaboracion ? 'Con elaboración' : 'Sin elaboración'} />
                </div>
              )
            })}
          </div>
        </Papel>

        {/* DETALLE DERECHA */}
        {selected ? (
          <Papel ceja={NAR} pad="20px 22px" style={{ overflowY: 'auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontFamily: OSW, fontSize: 'clamp(15px,4.5vw,20px)', letterSpacing: '2px', textTransform: 'uppercase', color: GRANATE, marginBottom: 4, wordBreak: 'break-word', fontWeight: 700 }}>
                  {selected.nombre}
                </div>
                <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>
                  {selected.raciones} ración{selected.raciones !== 1 ? 'es' : ''} · Coste {fmtEur(selected.coste_rac)}/rac
                  {selected.pvp_real ? ` · PVP ${fmtEur(selected.pvp_real)}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {!editMode ? (
                  <button onClick={() => setEditMode(true)} style={{ ...btnBase, background: BLANCO, color: INK }}>
                    Editar
                  </button>
                ) : (
                  <>
                    <button onClick={saveReceta} disabled={saving} style={{ ...btnBase, background: GRANATE, color: BLANCO }}>
                      {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button onClick={() => setEditMode(false)} style={{ ...btnBase, background: BLANCO, color: INK }}>
                      Cancelar
                    </button>
                  </>
                )}
                {savedOk && <span style={{ fontFamily: LEX, fontSize: 12, color: VERDE, fontWeight: 600 }}>✓ Guardado</span>}
              </div>
            </div>

            {/* Categoría editable */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 6, fontWeight: 600 }}>Categoría</div>
              {editMode ? (
                <select value={editCategoria} onChange={e => setEditCategoria(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                  <option value="">Sin categoría</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <span style={{ fontFamily: LEX, fontSize: 13, color: INK }}>{selected.categoria ?? '—'}</span>
              )}
            </div>

            {/* Ingredientes */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 10, fontWeight: 600 }}>Ingredientes</div>
              {loadingLineas ? (
                <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>Cargando…</div>
              ) : (
                <div style={{ border: `2px solid ${INK}`, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: LEX, fontSize: 13, minWidth: 320 }}>
                    <thead>
                      <tr style={{ background: INK }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: BLANCO, fontFamily: OSW, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Ingrediente</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: BLANCO, fontFamily: OSW, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Cantidad</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: BLANCO, fontFamily: OSW, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Coste</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((l, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${INK}` }}>
                          <td style={{ padding: '7px 10px', color: INK }}>{l.ingrediente_nombre.replace(/_[A-Z]+$/, '')}</td>
                          <td style={{ padding: '7px 10px', color: GRIS, textAlign: 'right' }}>{l.cantidad} {l.unidad}</td>
                          <td style={{ padding: '7px 10px', color: GRIS, textAlign: 'right' }}>{fmtEur(l.eur_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Elaboración */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 8, fontWeight: 600 }}>Elaboración</div>
              {editMode ? (
                <textarea
                  value={editElaboracion}
                  onChange={e => setEditElaboracion(e.target.value)}
                  placeholder="Escribe los pasos de elaboración..."
                  rows={8}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                />
              ) : (
                <div style={{ fontFamily: LEX, fontSize: 13, color: selected.elaboracion ? INK : GRIS, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {selected.elaboracion ?? '⚠️ Sin elaboración — pulsa Editar para añadirla'}
                </div>
              )}
            </div>

            {/* Alérgenos */}
            <div>
              <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 8, fontWeight: 600 }}>Alérgenos</div>
              {editMode ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ALERGENOS_LIST.map(a => {
                    const checked = editAlergenos.includes(a)
                    return (
                      <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: LEX, fontSize: 12, color: INK }}>
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
                      <span key={a} style={{ fontFamily: LEX, fontSize: 11, padding: '3px 10px', border: `2px solid ${NAR}`, color: NAR, fontWeight: 600 }}>
                        {a}
                      </span>
                    ))
                    : <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>Sin alérgenos definidos</span>
                  }
                </div>
              )}
            </div>

          </Papel>
        ) : (
          <Papel ceja={NAR} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
            <div style={{ textAlign: 'center', color: GRIS, fontFamily: LEX, fontSize: 14 }}>
              Selecciona una receta para ver su ficha
            </div>
          </Papel>
        )}

      </div>
    </PantallaCantera>
  )
}

