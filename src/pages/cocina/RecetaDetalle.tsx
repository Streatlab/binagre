import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, ChefHat, Maximize2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useTheme, FONT } from '@/styles/tokens'
import RecetaModoCocina from './RecetaModoCocina'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface Paso {
  orden: number
  descripcion: string
  foto_url?: string
}

interface RecetaFull {
  id: string
  nombre: string
  categoria: string | null
  raciones: number
  coste_rac: number
  pvp_real: number | null
  foto_url: string | null
  foto_presentacion_url: string | null
  tiempo_prep_min: number | null
  tiempo_coccion_min: number | null
  alergenos: string[] | null
  dificultad: 'facil' | 'medio' | 'dificil' | null
  trucos: string | null
  pasos: Paso[] | null
  elaboracion: string | null
}

interface RecetaLinea {
  linea: number
  ingrediente_nombre: string
  cantidad: number
  unidad: string
  eur_total: number
}

const ALERGENO_LABEL: Record<string, string> = {
  gluten: 'Gluten', crustaceos: 'Crustáceos', huevos: 'Huevos', pescado: 'Pescado',
  cacahuetes: 'Cacahuetes', soja: 'Soja', lacteos: 'Lácteos',
  frutos_de_cascara: 'Frutos secos', apio: 'Apio', mostaza: 'Mostaza',
  sesamo: 'Sésamo', sulfitos: 'Sulfitos', altramuces: 'Altramuces', moluscos: 'Moluscos',
}

const DIFICULTAD_COLOR: Record<string, string> = {
  facil: '#06C167', medio: '#f5a623', dificil: '#B01D23',
}
const DIFICULTAD_LABEL: Record<string, string> = {
  facil: 'Fácil', medio: 'Medio', dificil: 'Difícil',
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function RecetaDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { T, isDark } = useTheme()

  const [receta, setReceta] = useState<RecetaFull | null>(null)
  const [lineas, setLineas] = useState<RecetaLinea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modoCocina, setModoCocina] = useState(false)

  useEffect(() => {
    if (!id) return
    cargar(id)
  }, [id])

  async function cargar(recetaId: string) {
    setLoading(true)
    const { data, error: e } = await supabase
      .from('recetas')
      .select('id,nombre,categoria,raciones,coste_rac,pvp_real,foto_url,foto_presentacion_url,tiempo_prep_min,tiempo_coccion_min,alergenos,dificultad,trucos,pasos,elaboracion')
      .eq('id', recetaId)
      .single()

    if (e) { setError(e.message); setLoading(false); return }
    setReceta(data as RecetaFull)

    const { data: lns } = await supabase
      .from('recetas_lineas')
      .select('linea,ingrediente_nombre,cantidad,unidad,eur_total')
      .eq('receta_id', recetaId)
      .order('linea')
    setLineas((lns as RecetaLinea[]) ?? [])
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 32, color: T.sec, fontFamily: FONT.body }}>Cargando…</div>
  if (error || !receta) return (
    <div style={{ padding: 32, color: '#B01D23', fontFamily: FONT.body }}>
      {error ?? 'Receta no encontrada.'}
      <button onClick={() => navigate(-1)} style={{ marginLeft: 12, color: T.sec, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.body }}>Volver</button>
    </div>
  )

  if (modoCocina) {
    return <RecetaModoCocina receta={receta} lineas={lineas} onClose={() => setModoCocina(false)} />
  }

  const pasos: Paso[] = Array.isArray(receta.pasos) ? receta.pasos : []
  const tiempoTotal = (receta.tiempo_prep_min ?? 0) + (receta.tiempo_coccion_min ?? 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* HEADER NAVEGACIÓN */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <button
          onClick={() => navigate('/cocina/recetario')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: T.sec, fontFamily: FONT.body, fontSize: 13 }}
        >
          <ArrowLeft size={16} />
          Recetario
        </button>
        <button
          onClick={() => setModoCocina(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: '#B01D23', color: '#ffffff',
            fontFamily: FONT.heading, fontSize: 13, letterSpacing: '1px',
            textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          <Maximize2 size={15} />
          Modo cocina
        </button>
      </div>

      {/* LAYOUT DOS COLUMNAS */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>

        {/* COLUMNA IZQUIERDA — foto + info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Foto presentación */}
          <div style={{ borderRadius: 12, overflow: 'hidden', background: isDark ? '#1a1f32' : '#e8e8e8', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(receta.foto_presentacion_url ?? receta.foto_url) ? (
              <img
                src={(receta.foto_presentacion_url ?? receta.foto_url)!}
                alt={receta.nombre}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <ChefHat size={48} color={T.mut} strokeWidth={1} />
            )}
          </div>

          {/* Info básica */}
          <div style={{ background: '#141414', border: `1px solid ${T.brd}`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '2px', textTransform: 'uppercase', color: '#B01D23' }}>
              {receta.nombre}
            </div>
            {receta.categoria && (
              <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>{receta.categoria}</div>
            )}

            {/* Dificultad */}
            {receta.dificultad && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut }}>Dificultad</span>
                <span style={{ padding: '2px 10px', borderRadius: 99, background: DIFICULTAD_COLOR[receta.dificultad], color: '#fff', fontSize: 11, fontFamily: FONT.body }}>
                  {DIFICULTAD_LABEL[receta.dificultad]}
                </span>
              </div>
            )}

            {/* Tiempos */}
            {tiempoTotal > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.sec }}>
                <Clock size={14} color={T.mut} />
                <span style={{ fontFamily: FONT.body, fontSize: 13 }}>
                  {receta.tiempo_prep_min ? `${receta.tiempo_prep_min} min prep` : ''}
                  {receta.tiempo_prep_min && receta.tiempo_coccion_min ? ' · ' : ''}
                  {receta.tiempo_coccion_min ? `${receta.tiempo_coccion_min} min cocción` : ''}
                  {tiempoTotal > 0 ? ` (${tiempoTotal} min total)` : ''}
                </span>
              </div>
            )}

            {/* Coste */}
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
              {receta.raciones} ración{receta.raciones !== 1 ? 'es' : ''} · Coste {fmtEur(receta.coste_rac)}/rac
              {receta.pvp_real ? ` · PVP ${fmtEur(receta.pvp_real)}` : ''}
            </div>
          </div>

          {/* Alérgenos */}
          {(receta.alergenos ?? []).length > 0 && (
            <div style={{ background: '#141414', border: `1px solid ${T.brd}`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>Alérgenos</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(receta.alergenos ?? []).map(a => (
                  <span key={a} style={{ fontFamily: FONT.body, fontSize: 11, padding: '3px 10px', borderRadius: 99, background: '#2a1500', color: '#f5a623', border: '0.5px solid #f5a623' }}>
                    {ALERGENO_LABEL[a] ?? a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA — ingredientes + pasos + trucos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Ingredientes */}
          <div style={{ background: '#141414', border: `1px solid ${T.brd}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 12 }}>Ingredientes</div>
            {lineas.length === 0 ? (
              <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Sin ingredientes registrados.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                    {['Ingrediente', 'Cantidad', 'Coste'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Ingrediente' ? 'left' : 'right', padding: '4px 8px', color: T.mut, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>
                    ))}
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

          {/* Pasos */}
          {pasos.length > 0 && (
            <div style={{ background: '#141414', border: `1px solid ${T.brd}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 14 }}>Preparación</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {pasos.sort((a, b) => a.orden - b.orden).map(paso => (
                  <div key={paso.orden} style={{ display: 'flex', gap: 14 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', background: '#B01D23',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: FONT.heading, fontSize: 13, flexShrink: 0, marginTop: 2,
                    }}>
                      {paso.orden}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FONT.body, fontSize: 14, color: T.pri, lineHeight: 1.6 }}>
                        {paso.descripcion}
                      </div>
                      {paso.foto_url && (
                        <img
                          src={paso.foto_url}
                          alt={`Paso ${paso.orden}`}
                          style={{ marginTop: 10, width: '40%', borderRadius: 8, objectFit: 'cover', maxHeight: 180 }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Elaboración texto (fallback si no hay pasos jsonb) */}
          {pasos.length === 0 && receta.elaboracion && (
            <div style={{ background: '#141414', border: `1px solid ${T.brd}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 10 }}>Elaboración</div>
              <div style={{ fontFamily: FONT.body, fontSize: 14, color: T.pri, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {receta.elaboracion}
              </div>
            </div>
          )}

          {/* Trucos */}
          {receta.trucos && (
            <div style={{ background: '#1a1200', border: '1px solid #f5a623', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: '#f5a623', marginBottom: 8 }}>Trucos del cocinero</div>
              <div style={{ fontFamily: FONT.body, fontSize: 13, color: '#ffffff', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {receta.trucos}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
