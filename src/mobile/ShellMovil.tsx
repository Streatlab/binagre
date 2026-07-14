import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  SECCIONES, DIRECTOS, tituloDeRuta,
  INK, CREMA, CREMA2, BLANCO, AMA, GRANATE,
  type SeccionMovil,
} from '@/mobile/mapaMovil'
import { PanelMovil, PantallaPendiente, emojiDeRuta } from '@/mobile/PantallasMovil'
import { useEscalaMovil, InstalarPWA } from '@/mobile/pwa'

const OSW = 'Oswald, sans-serif'

/** Lienzo: si el navegador va en "modo escritorio", dibuja a 402px y escala. */
function Lienzo({ children }: { children: ReactNode }) {
  const esc = useEscalaMovil()
  if (!esc) {
    return <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>{children}</div>
  }
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: CREMA }}>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: esc.base, height: esc.alto,
        transform: `scale(${esc.scale})`, transformOrigin: '0 0',
      }}>
        {children}
      </div>
    </div>
  )
}

/**
 * App móvil Binagre — estructura Delasalud (una columna, sin scroll horizontal),
 * estilo Neobrutal Food-Pop, barra inferior en carrusel con panel flotante.
 */
export default function ShellMovil() {
  const nav = useNavigate()
  const loc = useLocation()
  const [abierta, setAbierta] = useState<SeccionMovil | null>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const cab = tituloDeRuta(loc.pathname)
  const enPanel = loc.pathname === '/'

  const ir = (path: string) => { setAbierta(null); nav(path) }

  useEffect(() => {
    const el = dockRef.current?.querySelector<HTMLElement>('[data-activo="1"]')
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [loc.pathname, abierta])

  const pantalla = () => {
    if (loc.pathname === '/') return <PanelMovil />
    return <PantallaPendiente titulo={cab.titulo} emoji={emojiDeRuta(loc.pathname)} />
  }

  return (
    <Lienzo>
      <div style={{
        position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
        background: CREMA, color: INK, fontFamily: 'Lexend, sans-serif',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── Cabecera ── */}
        <header style={{
          flex: '0 0 auto', background: CREMA, borderBottom: `4px solid ${INK}`,
          padding: 'calc(8px + env(safe-area-inset-top)) 12px 8px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {!enPanel && (
            <button onClick={() => nav('/')} aria-label="Volver" style={{
              width: 36, height: 36, flex: '0 0 36px', background: AMA, border: `3px solid ${INK}`,
              boxShadow: `3px 3px 0 ${INK}`, fontFamily: OSW, fontWeight: 700, fontSize: 19,
              cursor: 'pointer', borderRadius: 0, padding: 0,
            }}>‹</button>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{
              display: 'inline-block', background: cab.color, color: cab.texto, border: `2px solid ${INK}`,
              fontFamily: OSW, fontWeight: 600, fontSize: 9.5, letterSpacing: 1.6,
              textTransform: 'uppercase', padding: '2px 7px', marginBottom: 3,
            }}>{cab.seccion}</span>
            <h1 style={{
              fontFamily: OSW, fontWeight: 700, fontSize: 21, textTransform: 'uppercase',
              letterSpacing: '-0.4px', lineHeight: 1, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', margin: 0,
            }}>{cab.titulo}</h1>
          </div>
        </header>

        {/* ── Contenido ── */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 12px 24px' }}>
            <InstalarPWA />
            {pantalla()}
          </div>
        </main>

        {/* ── Velo ── */}
        {abierta && (
          <div onClick={() => setAbierta(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,10,.5)', zIndex: 62 }} />
        )}

        {/* ── Panel flotante ── */}
        {abierta && (
          <div style={{
            position: 'absolute', left: 10, right: 10, bottom: 'calc(96px + env(safe-area-inset-bottom))',
            zIndex: 65, background: CREMA, border: `4px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`,
            padding: 10, maxHeight: '56%', display: 'flex', flexDirection: 'column',
            animation: 'slUp .32s cubic-bezier(.34,1.45,.5,1)',
          }}>
            <style>{`@keyframes slUp{from{opacity:0;transform:translateY(16px) scale(.94)}to{opacity:1;transform:none}}`}</style>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
              <span style={{
                background: abierta.color, color: abierta.texto, border: `2px solid ${INK}`, fontFamily: OSW,
                fontWeight: 600, fontSize: 9.5, letterSpacing: 1.6, textTransform: 'uppercase', padding: '2px 7px',
              }}>{abierta.label}</span>
              <button onClick={() => setAbierta(null)} style={{
                background: BLANCO, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 9.5,
                letterSpacing: 1.6, textTransform: 'uppercase', padding: '2px 7px', cursor: 'pointer', borderRadius: 0,
              }}>Cerrar ✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, overflowY: 'auto' }}>
              {abierta.items.map(it => (
                <button key={it.path} onClick={() => ir(it.path)} style={{
                  background: BLANCO, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`,
                  padding: 8, cursor: 'pointer', textAlign: 'left', borderRadius: 0,
                }}>
                  <span style={{ fontSize: 15, display: 'block', marginBottom: 3 }}>{it.emoji}</span>
                  <b style={{
                    display: 'block', fontFamily: OSW, fontWeight: 600, fontSize: 12.5,
                    textTransform: 'uppercase', lineHeight: 1.15,
                  }}>{it.label}</b>
                  {it.pendiente && (
                    <span style={{
                      display: 'inline-block', marginTop: 4, background: GRANATE, color: '#fff', fontFamily: OSW,
                      fontSize: 8, fontWeight: 700, padding: '1px 4px', border: `1.5px solid ${INK}`,
                    }}>PEND</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Dock ── */}
        <nav style={{
          flex: '0 0 auto', background: CREMA2, borderTop: `4px solid ${INK}`,
          padding: '10px 0 calc(10px + env(safe-area-inset-bottom))',
        }}>
          <div ref={dockRef} style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
            <div style={{ display: 'flex', gap: 8, margin: '0 auto', padding: '2px 12px 4px', minWidth: 'max-content' }}>

              {DIRECTOS.map(d => {
                const activo = loc.pathname === d.path && !abierta
                return (
                  <button key={d.path} data-activo={activo ? '1' : undefined} onClick={() => ir(d.path)} style={{
                    flex: '0 0 auto', width: 56, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    borderRadius: 0, transform: activo ? 'translateY(-5px) scale(1.06)' : 'none', transition: 'transform .25s',
                  }}>
                    <span style={{
                      width: 48, height: 48, margin: '0 auto', background: AMA, color: INK, border: `3px solid ${INK}`,
                      boxShadow: activo ? `5px 5px 0 ${INK}` : `3px 3px 0 ${INK}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    }}>{d.emoji}</span>
                    <span style={{
                      display: 'block', fontFamily: OSW, fontWeight: 600, fontSize: 9, letterSpacing: .6,
                      textTransform: 'uppercase', marginTop: 4, textAlign: 'center',
                      textDecoration: activo ? 'underline' : 'none', textUnderlineOffset: 2,
                    }}>{d.label}</span>
                  </button>
                )
              })}

              {SECCIONES.map(s => {
                const activo = abierta?.key === s.key || (!abierta && s.items.some(i => loc.pathname === i.path || loc.pathname.startsWith(i.path + '/')))
                return (
                  <button key={s.key} data-activo={activo ? '1' : undefined}
                    onClick={() => setAbierta(abierta?.key === s.key ? null : s)} style={{
                      flex: '0 0 auto', width: 56, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      borderRadius: 0, transform: activo ? 'translateY(-5px) scale(1.06)' : 'none', transition: 'transform .25s',
                    }}>
                    <span style={{
                      width: 48, height: 48, margin: '0 auto', background: s.color, color: s.texto,
                      border: `3px solid ${INK}`, boxShadow: activo ? `5px 5px 0 ${INK}` : `3px 3px 0 ${INK}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    }}>{s.emoji}</span>
                    <span style={{
                      display: 'block', fontFamily: OSW, fontWeight: 600, fontSize: 9, letterSpacing: .6,
                      textTransform: 'uppercase', marginTop: 4, textAlign: 'center', lineHeight: 1.1,
                      textDecoration: activo ? 'underline' : 'none', textUnderlineOffset: 2,
                    }}>{s.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </nav>
      </div>
    </Lienzo>
  )
}
