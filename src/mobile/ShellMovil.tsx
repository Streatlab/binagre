import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import ToastHost from '@/components/ui/ToastHost'
import ResponsiveTables from '@/components/ResponsiveTables'
import OcrCompletadoGlobal from '@/components/ocr/OcrCompletadoGlobal'
import OcrUploadToast from '@/components/ocr/OcrUploadToast'
import CommandPalette from '@/components/CommandPalette'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  SECCIONES, DIRECTOS, PROXIMAMENTE, tituloDeRuta,
  INK, CREMA, CREMA2, BLANCO, AMA, GRANATE,
  type SeccionMovil,
} from '@/mobile/mapaMovil'
import '@/styles/movil-scope.css'

const OSW = 'Oswald, sans-serif'

/**
 * App móvil Binagre.
 * · Navegación: cabecera fija + carrusel inferior + panel flotante por módulo.
 * · Contenido: las PANTALLAS REALES del ERP (Outlet). No se pierde ni un dato.
 * · Espejo del sidebar: mismas secciones, rutas, etiquetas, perfiles y PEND.
 */
export default function ShellMovil() {
  const nav = useNavigate()
  const loc = useLocation()
  const { usuario, logout } = useAuth()
  const perfil = usuario?.perfil ?? ''

  const [abierta, setAbierta] = useState<SeccionMovil | null>(null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [proxAbierto, setProxAbierto] = useState(false)
  const [tareasBadge, setTareasBadge] = useState(0)
  const [instalar, setInstalar] = useState<any>(null)
  const [ocultarAviso, setOcultarAviso] = useState(false)

  const dockRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const cab = tituloDeRuta(loc.pathname)
  const enPanel = loc.pathname === '/'

  const ir = (path: string) => { setAbierta(null); setMenuAbierto(false); nav(path) }

  // Contador de tareas (igual que el sidebar)
  useEffect(() => {
    supabase.from('tareas_pendientes')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'atrasada'])
      .then(({ count }) => setTareasBadge(count ?? 0))
  }, [])

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

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
    const el = dockRef.current?.querySelector<HTMLElement>('[data-activo="1"]')
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [loc.pathname, abierta])

  const verAviso = !!instalar && !ocultarAviso
  const directos = DIRECTOS.filter(d => !perfil || d.perfiles.includes(perfil))
  const secciones = SECCIONES
    .filter(s => !perfil || s.perfiles.includes(perfil))
    .map(s => ({ ...s, items: s.items.filter(i => !perfil || i.perfiles.includes(perfil)) }))
    .filter(s => s.items.length > 0)

  const chip = (bg: string, color: string, txt: string, size = '0.65rem') => ({
    display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW,
    fontWeight: 700, fontSize: size, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    padding: '0.15rem 0.45rem', whiteSpace: 'nowrap' as const,
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden', background: CREMA, color: INK,
      fontFamily: 'Lexend, sans-serif', fontSize: 16, display: 'flex', flexDirection: 'column',
    }}>

      {/* ── Cabecera ── */}
      <header style={{
        flex: '0 0 auto', background: CREMA, borderBottom: `3px solid ${INK}`,
        padding: 'calc(0.7rem + env(safe-area-inset-top)) 0.9rem 0.7rem',
        display: 'flex', alignItems: 'center', gap: '0.6rem',
      }}>
        {!enPanel && (
          <button onClick={() => nav('/')} aria-label="Volver al panel" style={{
            width: '2.5rem', height: '2.5rem', flex: '0 0 auto', background: AMA, border: `3px solid ${INK}`,
            boxShadow: `3px 3px 0 ${INK}`, fontFamily: OSW, fontWeight: 700, fontSize: '1.35rem',
            cursor: 'pointer', borderRadius: 0, padding: 0, lineHeight: 1,
          }}>‹</button>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{ ...chip(cab.color, cab.texto, ''), marginBottom: '0.2rem' }}>{cab.seccion}</span>
          <h1 style={{
            fontFamily: OSW, fontWeight: 700, fontSize: '1.5rem', textTransform: 'uppercase',
            letterSpacing: '-0.01em', lineHeight: 1, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', margin: 0,
          }}>{cab.titulo}</h1>
        </div>
        <button onClick={() => setMenuAbierto(v => !v)} aria-label="Menú" style={{
          width: '2.5rem', height: '2.5rem', flex: '0 0 auto', background: menuAbierto ? INK : BLANCO,
          color: menuAbierto ? AMA : INK, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`,
          fontSize: '1.1rem', cursor: 'pointer', borderRadius: 0, padding: 0,
        }}>☰</button>
      </header>

      {/* ── Menú de cuenta (tema, usuario, próximamente, salir) ── */}
      {menuAbierto && (
        <div style={{
          position: 'absolute', top: 'calc(4.6rem + env(safe-area-inset-top))', right: '0.6rem', zIndex: 70,
          background: CREMA, border: `4px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`,
          width: '15rem', maxHeight: '70dvh', overflowY: 'auto', padding: '0.7rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase' }}>
              {usuario?.nombre || 'Usuario'}
            </span>
            <ThemeToggle />
          </div>

          <button onClick={() => setProxAbierto(v => !v)} style={{
            width: '100%', textAlign: 'left', background: BLANCO, border: `3px solid ${INK}`,
            boxShadow: `3px 3px 0 ${INK}`, padding: '0.5rem 0.6rem', cursor: 'pointer', borderRadius: 0,
            fontFamily: OSW, fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem',
          }}>
            <span>🕐 Próximamente</span>
            <span style={{ marginLeft: 'auto' }}>{proxAbierto ? '⌄' : '›'}</span>
          </button>

          {proxAbierto && (
            <div style={{ border: `3px solid ${INK}`, background: BLANCO, marginBottom: '0.6rem' }}>
              {PROXIMAMENTE.map((p, i) => (
                <div key={p.label} style={{
                  padding: '0.35rem 0.5rem', fontFamily: OSW, fontWeight: 600, fontSize: '0.75rem',
                  textTransform: 'uppercase', color: '#9a8f78',
                  borderTop: i > 0 ? '1.5px solid rgba(0,0,0,.12)' : 'none',
                  display: 'flex', gap: '0.35rem', alignItems: 'center',
                }}>
                  <span>{p.emoji}</span><span>{p.label}</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={logout} style={{
            width: '100%', background: GRANATE, color: '#fff', border: `3px solid ${INK}`,
            boxShadow: `3px 3px 0 ${INK}`, padding: '0.5rem', cursor: 'pointer', borderRadius: 0,
            fontFamily: OSW, fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase',
          }}>Cerrar sesión</button>
        </div>
      )}

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
      {(abierta || menuAbierto) && (
        <div onClick={() => { setAbierta(null); setMenuAbierto(false) }}
          style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,10,.5)', zIndex: 62 }} />
      )}

      {/* ── Panel flotante del módulo ── */}
      {abierta && (
        <div style={{
          position: 'absolute', left: '0.6rem', right: '0.6rem', bottom: 'calc(6.2rem + env(safe-area-inset-bottom))',
          zIndex: 65, background: CREMA, border: `4px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`,
          padding: '0.7rem', maxHeight: '64dvh', display: 'flex', flexDirection: 'column',
          animation: 'slUp .32s cubic-bezier(.34,1.45,.5,1)',
        }}>
          <style>{`@keyframes slUp{from{opacity:0;transform:translateY(18px) scale(.94)}to{opacity:1;transform:none}}`}</style>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={chip(abierta.color, abierta.texto, '', '0.72rem')}>{abierta.label}</span>
            <button onClick={() => setAbierta(null)} style={{ ...chip(BLANCO, INK, '', '0.72rem'), cursor: 'pointer' }}>Cerrar ✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
            {abierta.items.map(it => {
              const activo = loc.pathname === it.path
              return (
                <button key={it.path} onClick={() => ir(it.path)} style={{
                  background: activo ? INK : BLANCO, color: activo ? AMA : INK,
                  border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, borderRadius: 0,
                  padding: '0.7rem', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: '0.7rem',
                }}>
                  <span style={{
                    fontSize: '1.4rem', flexShrink: 0, width: '2.6rem', height: '2.6rem',
                    border: `3px solid ${INK}`, background: abierta.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{it.emoji}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{
                      display: 'block', fontFamily: OSW, fontWeight: 700, fontSize: '0.98rem',
                      textTransform: 'uppercase', lineHeight: 1.15,
                    }}>{it.label}</span>
                    <span style={{ display: 'block', fontSize: '0.78rem', opacity: 0.55 }}>{it.desc}</span>
                  </span>
                  {it.pendiente
                    ? <span style={chip(GRANATE, '#fff', '', '0.6rem')}>PEND</span>
                    : <span style={{ opacity: 0.3, fontSize: '1.3rem', fontFamily: OSW }}>›</span>}
                </button>
              )
            })}
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

            {directos.map(d => {
              const activo = loc.pathname === d.path && !abierta
              return (
                <button key={d.path} data-activo={activo ? '1' : undefined} onClick={() => ir(d.path)} style={{
                  flex: '0 0 auto', width: '4.2rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  borderRadius: 0, transform: activo ? 'translateY(-4px) scale(1.06)' : 'none', transition: 'transform .25s',
                  position: 'relative',
                }}>
                  <span style={{
                    width: '3.4rem', height: '3.4rem', margin: '0 auto', background: AMA, color: INK,
                    border: `3px solid ${INK}`, boxShadow: activo ? `5px 5px 0 ${INK}` : `3px 3px 0 ${INK}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem',
                  }}>{d.emoji}</span>
                  {d.path === '/tareas' && tareasBadge > 0 && (
                    <span style={{
                      position: 'absolute', top: '-0.2rem', right: '0.35rem', background: GRANATE, color: '#fff',
                      border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 700, fontSize: '0.6rem',
                      padding: '0 0.25rem', minWidth: '1.1rem', textAlign: 'center',
                    }}>{tareasBadge > 99 ? '99+' : tareasBadge}</span>
                  )}
                  <span style={{
                    display: 'block', fontFamily: OSW, fontWeight: 600, fontSize: '0.66rem', letterSpacing: '0.06em',
                    textTransform: 'uppercase', marginTop: '0.3rem', textAlign: 'center',
                    textDecoration: activo ? 'underline' : 'none', textUnderlineOffset: 3,
                  }}>{d.label}</span>
                </button>
              )
            })}

            {secciones.map(s => {
              const activo = abierta?.key === s.key || (!abierta && s.items.some(i => loc.pathname === i.path || loc.pathname.startsWith(i.path + '/')))
              return (
                <button key={s.key} data-activo={activo ? '1' : undefined}
                  onClick={() => { setMenuAbierto(false); setAbierta(abierta?.key === s.key ? null : (s as SeccionMovil)) }} style={{
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
      <CommandPalette />
    </div>
  )
}
