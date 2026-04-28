import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface Paso {
  orden: number
  descripcion: string
  foto_url?: string
}

interface RecetaFull {
  id: string
  nombre: string
  alergenos: string[] | null
  tiempo_prep_min: number | null
  tiempo_coccion_min: number | null
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

// ─── MODO COCINA ──────────────────────────────────────────────────────────────

export default function RecetaModoCocina({ receta, lineas, onClose }: {
  receta: RecetaFull
  lineas: RecetaLinea[]
  onClose: () => void
}) {
  const [pasoActual, setPasoActual] = useState(0)
  const [vistaIngredientes, setVistaIngredientes] = useState(false)

  // Pasos: desde jsonb o desde elaboracion como bloque único
  const pasos: Paso[] = (() => {
    if (Array.isArray(receta.pasos) && receta.pasos.length > 0) {
      return [...receta.pasos].sort((a, b) => a.orden - b.orden)
    }
    if (receta.elaboracion) {
      return [{ orden: 1, descripcion: receta.elaboracion }]
    }
    return []
  })()

  const alergenos = receta.alergenos ?? []
  const tiempoTotal = (receta.tiempo_prep_min ?? 0) + (receta.tiempo_coccion_min ?? 0)

  // Fullscreen al montar
  useEffect(() => {
    const el = document.documentElement
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => { /* el usuario puede no permitirlo */ })
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { /* ok */ })
      }
    }
  }, [])

  function salir() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* ok */ })
    }
    onClose()
  }

  // Navegación teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setPasoActual(p => Math.min(p + 1, pasos.length - 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setPasoActual(p => Math.max(p - 1, 0))
      } else if (e.key === 'Escape') {
        salir()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pasos.length])

  const paso = pasos[pasoActual]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Lexend, sans-serif',
    }}>

      {/* BARRA SUPERIOR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid #1a1a1a', flexShrink: 0,
      }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(20px,3vw,36px)', color: '#e8f442', letterSpacing: '3px', textTransform: 'uppercase' }}>
          {receta.nombre}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {tiempoTotal > 0 && (
            <div style={{ color: '#9ba8c0', fontSize: 14 }}>{tiempoTotal} min total</div>
          )}
          <button
            onClick={() => setVistaIngredientes(v => !v)}
            style={{
              padding: '8px 18px', borderRadius: 8, border: `1px solid ${vistaIngredientes ? '#e8f442' : '#2a2a2a'}`,
              background: vistaIngredientes ? '#e8f442' : 'transparent',
              color: vistaIngredientes ? '#111111' : '#cccccc',
              fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer',
            }}
          >
            Ingredientes
          </button>
          <button
            onClick={salir}
            style={{
              width: 60, height: 60, borderRadius: 8,
              border: '1px solid #333',
              background: '#1a1a1a', color: '#ffffff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* PANEL INGREDIENTES */}
        {vistaIngredientes && (
          <div style={{
            width: 320, flexShrink: 0, background: '#111111',
            borderRight: '1px solid #1a1a1a', overflowY: 'auto', padding: '20px 24px',
          }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: '#9ba8c0', marginBottom: 16 }}>
              Ingredientes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {lineas.map((l, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto',
                  gap: 12, padding: '10px 0', borderBottom: '1px solid #1a1a1a',
                }}>
                  <span style={{ fontSize: 'clamp(16px,2vw,28px)', color: '#ffffff' }}>
                    {l.ingrediente_nombre.replace(/_[A-Z]+$/, '')}
                  </span>
                  <span style={{ fontSize: 'clamp(14px,1.8vw,24px)', color: '#9ba8c0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {l.cantidad} {l.unidad}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PANEL PASO */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {pasos.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a6880', fontSize: 18 }}>
              Sin pasos de preparación definidos.
            </div>
          ) : (
            <>
              {/* Número de paso */}
              <div style={{ padding: '20px 32px 0', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 72, color: '#B01D23', lineHeight: 1, fontWeight: 700 }}>
                  {pasoActual + 1}
                </span>
                <span style={{ color: '#5a6880', fontSize: 20 }}>/ {pasos.length}</span>
              </div>

              {/* Contenido del paso */}
              <div style={{ flex: 1, display: 'flex', gap: 32, padding: '16px 32px', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{
                    fontSize: 'clamp(24px,3vw,36px)',
                    color: '#ffffff',
                    lineHeight: 1.55,
                    fontFamily: 'Lexend, sans-serif',
                  }}>
                    {paso?.descripcion}
                  </div>
                </div>
                {paso?.foto_url && (
                  <div style={{ width: '40%', flexShrink: 0 }}>
                    <img
                      src={paso.foto_url}
                      alt={`Paso ${paso.orden}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }}
                    />
                  </div>
                )}
              </div>

              {/* Botones nav */}
              <div style={{ display: 'flex', gap: 12, padding: '16px 32px', flexShrink: 0 }}>
                <button
                  onClick={() => setPasoActual(p => Math.max(p - 1, 0))}
                  disabled={pasoActual === 0}
                  style={{
                    flex: 1, minHeight: 80, borderRadius: 10,
                    border: `1px solid ${pasoActual === 0 ? '#222' : '#444'}`,
                    background: pasoActual === 0 ? '#111' : '#1a1a1a',
                    color: pasoActual === 0 ? '#333' : '#ffffff',
                    cursor: pasoActual === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    fontFamily: 'Oswald, sans-serif', fontSize: 18, letterSpacing: '1px', textTransform: 'uppercase',
                    transition: 'all 150ms',
                  }}
                >
                  <ChevronLeft size={24} />
                  Anterior
                </button>
                <button
                  onClick={() => setPasoActual(p => Math.min(p + 1, pasos.length - 1))}
                  disabled={pasoActual === pasos.length - 1}
                  style={{
                    flex: 1, minHeight: 80, borderRadius: 10,
                    border: 'none',
                    background: pasoActual === pasos.length - 1 ? '#2a1515' : '#B01D23',
                    color: pasoActual === pasos.length - 1 ? '#5a2020' : '#ffffff',
                    cursor: pasoActual === pasos.length - 1 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    fontFamily: 'Oswald, sans-serif', fontSize: 18, letterSpacing: '1px', textTransform: 'uppercase',
                    transition: 'all 150ms',
                  }}
                >
                  Siguiente
                  <ChevronRight size={24} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* BARRA INFERIOR — ALÉRGENOS */}
      {alergenos.length > 0 && (
        <div style={{
          borderTop: '1px solid #1a1a1a', padding: '10px 24px',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          background: '#0d0d0d', overflowX: 'auto',
        }}>
          <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: '#5a6880', flexShrink: 0 }}>
            Alérgenos:
          </span>
          {alergenos.map(a => (
            <span key={a} style={{
              padding: '4px 12px', borderRadius: 99, border: '1px solid #f5a623',
              background: '#1a0f00', color: '#f5a623',
              fontFamily: 'Lexend, sans-serif', fontSize: 13, flexShrink: 0,
            }}>
              {ALERGENO_LABEL[a] ?? a}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
