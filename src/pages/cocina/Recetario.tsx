import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ChefHat, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, cardStyle, FONT } from '@/styles/tokens'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface Receta {
  id: string
  nombre: string
  categoria: string | null
  marca_id: string | null
  foto_url: string | null
  tiempo_prep_min: number | null
  tiempo_coccion_min: number | null
  alergenos: string[] | null
  dificultad: 'facil' | 'medio' | 'dificil' | null
  coste_rac: number
}

const ALERGENOS_EU = [
  'gluten', 'crustaceos', 'huevos', 'pescado', 'cacahuetes', 'soja',
  'lacteos', 'frutos_de_cascara', 'apio', 'mostaza', 'sesamo', 'sulfitos',
  'altramuces', 'moluscos',
]

const ALERGENO_LABEL: Record<string, string> = {
  gluten: 'Gluten', crustaceos: 'Crustáceos', huevos: 'Huevos', pescado: 'Pescado',
  cacahuetes: 'Cacahuetes', soja: 'Soja', lacteos: 'Lácteos',
  frutos_de_cascara: 'Frutos secos', apio: 'Apio', mostaza: 'Mostaza',
  sesamo: 'Sésamo', sulfitos: 'Sulfitos', altramuces: 'Altramuces', moluscos: 'Moluscos',
}

const DIFICULTAD_COLOR: Record<string, string> = {
  facil: '#06C167',
  medio: '#f5a623',
  dificil: '#B01D23',
}
const DIFICULTAD_LABEL: Record<string, string> = {
  facil: 'Fácil',
  medio: 'Medio',
  dificil: 'Difícil',
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Recetario() {
  const { T, isDark } = useTheme()
  const navigate = useNavigate()

  const [recetas, setRecetas] = useState<Receta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [marcasSelec, setMarcasSelec] = useState<string[]>([])
  const [aleExcluir, setAleExcluir] = useState<string[]>([])
  const [dificultad, setDificultad] = useState<string>('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data, error: e } = await supabase
      .from('recetas')
      .select('id,nombre,categoria,marca_id,foto_url,tiempo_prep_min,tiempo_coccion_min,alergenos,dificultad,coste_rac')
      .order('nombre')
    if (e) setError(e.message)
    else setRecetas((data as Receta[]) ?? [])
    setLoading(false)
  }

  const marcasDisponibles = useMemo(() => [...new Set(recetas.map(r => r.marca_id ?? 'Sin marca'))].sort(), [recetas])

  const recetasFiltradas = useMemo(() => recetas.filter(r => {
    if (busqueda && !r.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    if (marcasSelec.length > 0) {
      const marcaR = r.marca_id ?? 'Sin marca'
      if (!marcasSelec.includes(marcaR)) return false
    }
    if (aleExcluir.length > 0) {
      const aler = r.alergenos ?? []
      if (aleExcluir.some(a => aler.includes(a))) return false
    }
    if (dificultad && r.dificultad !== dificultad) return false
    return true
  }), [recetas, busqueda, marcasSelec, aleExcluir, dificultad])

  const inputStyle: React.CSSProperties = {
    background: isDark ? '#1e1e1e' : '#ffffff',
    border: `1px solid ${T.brd}`,
    borderRadius: 8,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 13,
    padding: '8px 12px',
    outline: 'none',
    width: '100%',
  }

  const pillStyle = (active: boolean, color?: string): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 99,
    border: active ? 'none' : `1px solid ${T.brd}`,
    background: active ? (color ?? '#B01D23') : 'transparent',
    color: active ? '#ffffff' : T.sec,
    fontFamily: FONT.body,
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all 150ms',
    whiteSpace: 'nowrap' as const,
  })

  if (loading) return <div style={{ padding: 32, color: T.sec, fontFamily: FONT.body }}>Cargando recetas…</div>
  if (error) return <div style={{ padding: 32, color: '#B01D23', fontFamily: FONT.body }}>{error}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ChefHat size={24} color="#B01D23" />
        <div style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', color: '#B01D23', textTransform: 'uppercase' }}>
          Recetario
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
          {recetasFiltradas.length} de {recetas.length} recetas
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ ...cardStyle(T), display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Buscador */}
        <div style={{ position: 'relative' }}>
          <Search size={14} color={T.mut} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            placeholder="Buscar receta..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 34 }}
          />
        </div>

        {/* Marcas */}
        {marcasDisponibles.length > 1 && (
          <div>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>Marca</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setMarcasSelec([])} style={pillStyle(marcasSelec.length === 0)}>Todas</button>
              {marcasDisponibles.map(m => (
                <button
                  key={m}
                  onClick={() => setMarcasSelec(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                  style={pillStyle(marcasSelec.includes(m))}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dificultad */}
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>Dificultad</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setDificultad('')} style={pillStyle(dificultad === '')}>Todas</button>
            {(['facil', 'medio', 'dificil'] as const).map(d => (
              <button key={d} onClick={() => setDificultad(dificultad === d ? '' : d)} style={pillStyle(dificultad === d, DIFICULTAD_COLOR[d])}>
                {DIFICULTAD_LABEL[d]}
              </button>
            ))}
          </div>
        </div>

        {/* Alérgenos excluir */}
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>Excluir alérgenos</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {ALERGENOS_EU.map(a => (
              <button
                key={a}
                onClick={() => setAleExcluir(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
                style={pillStyle(aleExcluir.includes(a), '#f5a623')}
              >
                {ALERGENO_LABEL[a]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* GRID RECETAS */}
      {recetasFiltradas.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 14 }}>
          Sin resultados para los filtros aplicados.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {recetasFiltradas.map(r => (
            <RecetaCard key={r.id} receta={r} T={T} onClick={() => navigate(`/cocina/recetario/${r.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CARD RECETA ──────────────────────────────────────────────────────────────

function RecetaCard({ receta: r, T, onClick }: {
  receta: Receta
  T: ReturnType<typeof useTheme>['T']
  onClick: () => void
}) {
  const tiempoTotal = (r.tiempo_prep_min ?? 0) + (r.tiempo_coccion_min ?? 0)

  return (
    <div
      onClick={onClick}
      style={{
        background: T.card,
        border: `1px solid ${T.brd}`,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 200ms, box-shadow 200ms',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#B01D23'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(176,29,35,0.15)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.brd
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
      }}
    >
      {/* Foto */}
      <div style={{ height: 140, background: T.brd === '#2a3050' ? '#1a1f32' : '#e8e8e8', overflow: 'hidden', position: 'relative' }}>
        {r.foto_url ? (
          <img src={r.foto_url} alt={r.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChefHat size={36} color={T.mut} strokeWidth={1} />
          </div>
        )}
        {r.dificultad && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: DIFICULTAD_COLOR[r.dificultad],
            color: '#ffffff', borderRadius: 99,
            padding: '2px 8px', fontSize: 11, fontFamily: FONT.body,
          }}>
            {DIFICULTAD_LABEL[r.dificultad]}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontFamily: FONT.body, fontSize: 14, fontWeight: 600, color: T.pri, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.nombre}
        </div>
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 8 }}>
          {r.categoria ?? 'Sin categoría'}
        </div>

        {/* Tiempo */}
        {tiempoTotal > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
            <Clock size={12} color={T.mut} />
            <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.sec }}>
              {r.tiempo_prep_min ? `${r.tiempo_prep_min}' prep` : ''}
              {r.tiempo_prep_min && r.tiempo_coccion_min ? ' + ' : ''}
              {r.tiempo_coccion_min ? `${r.tiempo_coccion_min}' cocción` : ''}
            </span>
          </div>
        )}

        {/* Alérgenos badges */}
        {(r.alergenos ?? []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(r.alergenos ?? []).slice(0, 5).map(a => (
              <span key={a} style={{
                fontFamily: FONT.body, fontSize: 10, padding: '2px 7px', borderRadius: 99,
                background: '#2a1500', color: '#f5a623', border: '0.5px solid #f5a623',
              }}>
                {ALERGENO_LABEL[a] ?? a}
              </span>
            ))}
            {(r.alergenos ?? []).length > 5 && (
              <span style={{ fontFamily: FONT.body, fontSize: 10, color: T.mut }}>+{(r.alergenos ?? []).length - 5}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
