import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import ToastHost from '@/components/ui/ToastHost'
import ResponsiveTables from '@/components/ResponsiveTables'
import OcrCompletadoGlobal from '@/components/ocr/OcrCompletadoGlobal'
import OcrUploadToast from '@/components/ocr/OcrUploadToast'
import {
  SECCIONES, DIRECTOS, tituloDeRuta,
  INK, CREMA, CREMA2, BLANCO, AMA, GRANATE,
  type SeccionMovil,
} from '@/mobile/mapaMovil'
import { Fila } from '@/mobile/PantallasMovil'
import '@/styles/movil-scope.css'

const OSW = 'Oswald, sans-serif'

/**
 * App móvil Binagre.
 * Estructura: Delasalud (una columna, cabecera fija, barra inferior).
 * Contenido: las PANTALLAS REALES del ERP (mismos datos y cálculos que en
 * escritorio), reordenadas a una columna con movil-scope.css.
 */
export default function ShellMovil() {
  const nav = useNavigate()
  const loc = useLocation()
  const [abierta, setAbierta] = useState<SeccionMovil | null>(null)
  const [instalar, setInstalar] = useState<any>(null)
  const [ocultarAviso, setOcultarAviso] = useState(false)
  const dockRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const cab = tituloDeRuta(loc.pathname)
  const enPanel = loc.pathname === '/'

  const ir = (path: string) => { setAbierta(null); nav(path) }

  // Escala forzada a móvil (anula el "modo escritorio" del navegador)
  useEffect(() => {
    const ajustar = () => {
      const w = window.innerWidth
      const z = w > 560 ? Math.round((w / 420) * 1000) / 1000 : 1
      ;(document.documentElement.style as any).zoom = String(z)
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    window.addEventListener('orientationchange', ajustar)
    return () => {
      ;(document.documentElement.style as any).zoom = ''
      window.removeEventListener('resize', ajustar)
      window.removeEventListener('orientationchange', ajustar)
    }
  }, [])

  // Aviso de instalación (PWA)
  useEffect(() => {
    const captura = (e: Event) => { e.preventDefault(); setInstalar(e) }
    window.addEventListener('beforeinstallprompt', captura)
    return () => window.removeEventListener('beforeinstallprompt', captura)
  }, [])

  const instalarApp = async () => {
    if (!instalar) return
    instalar.prompt()
    try { await instalar.userChoice } catch { /* nada */ }
    setInstalar(null)
  }

  // Al cambiar de pantalla: arriba del todo y centrar icono activo
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
    const el = dockRef.current?.querySelector<HTMLElement>('[data-activo="1"]')
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [loc.pathname, abierta])

  const verAviso = !!instalar && !ocultarAviso

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden', background: CREMA, color: INK,
      fontFamily: 'Lexend, sans-serif', fontSize: 16, display: 'flex', flexDirection: 'column',
    }}>

      {/* ── Cabecera ── */}
      <header style={{
        flex: '0 0 auto', background: CREMA, borderBottom: `3px solid ${INK}`,
        padding: 'calc(0.7rem + env(safe-area-inset-top)) 1rem 0.7rem',
        display: 'flex', alignItems: 'center', gap: '0.7rem',
      }}>
        {!enPanel && (
          <button onClick={() => nav('/')} aria-label="Volver" style={{
            width: '2.6rem', height: '2.6rem', flex: '0 0 auto', background: AMA, border: `3px solid ${INK}`,
            boxShadow: `3px 3px 0 ${INK}`, fontFamily: OSW, fontWeight: 700, fontSize: '1.4rem',
            cursor: 'pointer', borderRadius: 0, padding: 0, lineHeight: 1,
          }}>‹</button>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{
            display: 'inline-block', background: cab.color, color: cab.texto, border: `2px solid ${INK}`,
            fontFamily: OSW, fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.12em',
            textTransform: 'uppercase', padding: '0.1rem 0.45rem', marginBottom: '0.2rem',
          }}>{cab.seccion}</span>
          <h1 style={{
            fontFamily: OSW, fontWeight: 700, fontSize: '1.6rem', textTransform: 'uppercase',
            letterSpacing: '-0.01em', lineHeight: 1, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', margin: 0,
          }}>{cab.titulo}</h1>
        </div>
      </header>

      {/* ── Contenido: pantallas reales del ERP ── */}
      <main ref={mainRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
        <div className="movil-scope" style={{ padding: '0.9rem 0.75rem 2rem' }}>
          <Outlet />
        </div>
      </main>

      {/* ── Aviso instalar app ── */}
      {verAviso && (
        <div style={{
          flex: '0 0 auto', background: AMA, borderTop: `3px solid ${INK}`, padding: '0.7rem 1rem',
          display: 'flex', alignItems: 'center', gap: '0.7rem',
        }}>
          <span style={{ fontSize: '1.6rem' }}>📲</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: OSW, fontWeight: 700, fontSize: '1rem', textTransform: 'uppercase' }}>Instalar Binagre</p>
            <p style={{ fontSize: '0.78rem', opacity: 0.7 }}>Añádela a la pantalla de inicio</p>
          </div>
          <button onClick={instalarApp} style={{
            background: INK, color: AMA, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${BLANCO}`,
            fontFamily: OSW, fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase',
            padding: '0.5rem 0.8rem', borderRadius: 0, cursor: 'pointer',
          }}>Instalar</button>
          <button onClick={() => setOcultarAviso(true)} aria-label="Ahora no" style={{
            background: 'transparent', border: 'none', fontFamily: OSW, fontWeight: 700,
            fontSize: '1.2rem', padding: '0 0.2rem', cursor: 'pointer', borderRadius: 0,
          }}>✕</button>
        </div>
      )}

      {/* ── Velo ── */}
      {abierta && (
        <div onClick={() => setAbierta(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,10,.5)', zIndex: 62 }} />
      )}

      {/* ── Panel flotante del módulo ── */}
      {abierta && (
        <div style={{
          position: 'absolute', left: '0.75rem', right: '0.75rem', bottom: 'calc(6.4rem + env(safe-area-inset-bottom))',
          zIndex: 65, background: CREMA, border: `4px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`,
          padding: '0.75rem', maxHeight: '62dvh', display: 'flex', flexDirection: 'column',
          maxWidth: 480, marginLeft: 'auto', marginRight: 'auto',
          animation: 'slUp .32s cubic-bezier(.34,1.45,.5,1)',
        }}>
          <style>{`@keyframes slUp{from{opacity:0;transform:translateY(18px) scale(.94)}to{opacity:1;transform:none}}`}</style>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
            <span style={{
              background: abierta.color, color: abierta.texto, border: `2px solid ${INK}`, fontFamily: OSW,
              fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase',
              padding: '0.25rem 0.6rem',
            }}>{abierta.label}</span>
            <button onClick={() => setAbierta(null)} style={{
              background: BLANCO, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 700, fontSize: '0.75rem',
              letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.25rem 0.6rem', cursor: 'pointer', borderRadius: 0,
            }}>Cerrar ✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto' }}>
            {abierta.items.map(it => (
              <Fila key={it.path} emoji={it.emoji} bg={abierta.color} titulo={it.label} desc={it.desc}
                chip={it.pendiente ? 'Pend' : undefined} chipBg={GRANATE} chipColor="#fff"
                onClick={() => ir(it.path)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Carrusel inferior ── */}
      <nav style={{
        flex: '0 0 auto', background: CREMA2, borderTop: `3px solid ${INK}`,
        padding: '0.6rem 0 calc(0.6rem + env(safe-area-inset-bottom))',
      }}>
        <div ref={dockRef} style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ display: 'flex', gap: '0.55rem', margin: '0 auto', padding: '0.15rem 0.75rem 0.25rem', minWidth: 'max-content' }}>

            {DIRECTOS.map(d => {
              const activo = loc.pathname === d.path && !abierta
              return (
                <button key={d.path} data-activo={activo ? '1' : undefined} onClick={() => ir(d.path)} style={{
                  flex: '0 0 auto', width: '4.2rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  borderRadius: 0, transform: activo ? 'translateY(-4px) scale(1.06)' : 'none', transition: 'transform .25s',
                }}>
                  <span style={{
                    width: '3.4rem', height: '3.4rem', margin: '0 auto', background: AMA, color: INK,
                    border: `3px solid ${INK}`, boxShadow: activo ? `5px 5px 0 ${INK}` : `3px 3px 0 ${INK}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem',
                  }}>{d.emoji}</span>
                  <span style={{
                    display: 'block', fontFamily: OSW, fontWeight: 600, fontSize: '0.66rem', letterSpacing: '0.06em',
                    textTransform: 'uppercase', marginTop: '0.3rem', textAlign: 'center',
                    textDecoration: activo ? 'underline' : 'none', textUnderlineOffset: 3,
                  }}>{d.label}</span>
                </button>
              )
            })}

            {SECCIONES.map(s => {
              const activo = abierta?.key === s.key || (!abierta && s.items.some(i => loc.pathname === i.path || loc.pathname.startsWith(i.path + '/')))
              return (
                <button key={s.key} data-activo={activo ? '1' : undefined}
                  onClick={() => setAbierta(abierta?.key === s.key ? null : s)} style={{
                    flex: '0 0 auto', width: '4.2rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    borderRadius: 0, transform: activo ? 'translateY(-4px) scale(1.06)' : 'none', transition: 'transform .25s',
                  }}>
                  <span style={{
                    width: '3.4rem', height: '3.4rem', margin: '0 auto', background: s.color, color: s.texto,
                    border: `3px solid ${INK}`, boxShadow: activo ? `5px 5px 0 ${INK}` : `3px 3px 0 ${INK}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem',
                  }}>{s.emoji}</span>
                  <span style={{
                    display: 'block', fontFamily: OSW, fontWeight: 600, fontSize: '0.66rem', letterSpacing: '0.06em',
                    textTransform: 'uppercase', marginTop: '0.3rem', textAlign: 'center', lineHeight: 1.1,
                    textDecoration: activo ? 'underline' : 'none', textUnderlineOffset: 3,
                  }}>{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      <ToastHost />
      <ResponsiveTables />
      <OcrUploadToast />
      <OcrCompletadoGlobal />
    </div>
  )
}
