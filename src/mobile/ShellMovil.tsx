import { useState } from 'react'
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

/**
 * Shell de la app móvil (Neobrutal Food-Pop).
 * Barra inferior en carrusel horizontal: al pulsar un módulo se abre un panel
 * flotante con sus pantallas; al pulsar una se navega a ella.
 */
export default function ShellMovil() {
  const nav = useNavigate()
  const loc = useLocation()
  const [abierta, setAbierta] = useState<SeccionMovil | null>(null)
  const cab = tituloDeRuta(loc.pathname)
  const enPanel = loc.pathname === '/'

  const ir = (path: string) => { setAbierta(null); nav(path) }

  const OSW = 'Oswald, sans-serif'

  return (
    <div style={{ minHeight: '100dvh', background: CREMA, color: INK, fontFamily: 'Lexend, sans-serif' }}>

      {/* ── Cabecera ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: CREMA,
        borderBottom: `4px solid ${INK}`, padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {!enPanel && (
          <button onClick={() => nav('/')} aria-label="Volver" style={{
            width: 36, height: 36, flex: '0 0 36px', background: AMA, border: `3px solid ${INK}`,
            boxShadow: `3px 3px 0 ${INK}`, fontFamily: OSW, fontWeight: 700, fontSize: 19, cursor: 'pointer',
          }}>‹</button>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{
            display: 'inline-block', background: cab.color, color: cab.texto, border: `2px solid ${INK}`,
            fontFamily: OSW, fontWeight: 600, fontSize: 9.5, letterSpacing: 1.6,
            textTransform: 'uppercase', padding: '2px 7px', marginBottom: 3,
          }}>{cab.seccion}</span>
          <h1 style={{
            fontFamily: OSW, fontWeight: 700, fontSize: 21, textTransform: 'uppercase', letterSpacing: '-0.4px',
            lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0,
          }}>{cab.titulo}</h1>
        </div>
      </header>

      {/* ── Contenido ── */}
      <main style={{ padding: '76px 12px 116px' }}>
        <Outlet />
      </main>

      {/* ── Velo ── */}
      {abierta && (
        <div onClick={() => setAbierta(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(10,10,10,.5)', zIndex: 62,
        }} />
      )}

      {/* ── Panel flotante del módulo ── */}
      {abierta && (
        <div style={{
          position: 'fixed', left: 10, right: 10, bottom: 112, zIndex: 65, background: CREMA,
          border: `4px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, padding: 10,
          maxHeight: '56dvh', display: 'flex', flexDirection: 'column',
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
              letterSpacing: 1.6, textTransform: 'uppercase', padding: '2px 7px', cursor: 'pointer',
            }}>Cerrar ✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, overflowY: 'auto' }}>
            {abierta.items.map(it => (
              <button key={it.path} onClick={() => ir(it.path)} style={{
                background: BLANCO, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`,
                padding: 8, cursor: 'pointer', textAlign: 'left',
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

      {/* ── Carrusel inferior ── */}
      <nav style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: CREMA2,
        borderTop: `4px solid ${INK}`, padding: '10px 0 12px',
      }}>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '2px 12px 4px', scrollbarWidth: 'none' }}>
          <style>{`nav div::-webkit-scrollbar{display:none}`}</style>

          {DIRECTOS.map(d => {
            const activo = loc.pathname === d.path
            return (
              <button key={d.path} onClick={() => ir(d.path)} style={{
                flex: '0 0 auto', width: 58, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                transform: activo ? 'translateY(-5px)' : 'none', transition: 'transform .25s',
              }}>
                <span style={{
                  width: 50, height: 50, margin: '0 auto', background: AMA, color: INK, border: `3px solid ${INK}`,
                  boxShadow: activo ? `5px 5px 0 ${INK}` : `3px 3px 0 ${INK}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21,
                }}>{d.emoji}</span>
                <span style={{
                  display: 'block', fontFamily: OSW, fontWeight: 600, fontSize: 9, letterSpacing: .6,
                  textTransform: 'uppercase', marginTop: 4, textAlign: 'center',
                  textDecoration: activo ? 'underline' : 'none',
                }}>{d.label}</span>
              </button>
            )
          })}

          {SECCIONES.map(s => {
            const activo = abierta?.key === s.key || s.items.some(i => loc.pathname === i.path)
            return (
              <button key={s.key} onClick={() => setAbierta(abierta?.key === s.key ? null : s)} style={{
                flex: '0 0 auto', width: 58, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                transform: activo ? 'translateY(-5px)' : 'none', transition: 'transform .25s',
              }}>
                <span style={{
                  width: 50, height: 50, margin: '0 auto', background: s.color, color: s.texto,
                  border: `3px solid ${INK}`, boxShadow: activo ? `5px 5px 0 ${INK}` : `3px 3px 0 ${INK}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21,
                }}>{s.emoji}</span>
                <span style={{
                  display: 'block', fontFamily: OSW, fontWeight: 600, fontSize: 9, letterSpacing: .6,
                  textTransform: 'uppercase', marginTop: 4, textAlign: 'center', lineHeight: 1.1,
                  textDecoration: activo ? 'underline' : 'none',
                }}>{s.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <ToastHost />
      <ResponsiveTables />
      <OcrUploadToast />
      <OcrCompletadoGlobal />
    </div>
  )
}
