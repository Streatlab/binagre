/**
 * AppMovil — piel MÓVIL del ERP Binagre / Streat Lab (PWA).
 *
 * Traducción 1:1 del mockup de Claude Design "Binagre Mobile" (estilo Cantera
 * Alegre: pergamino #FCEFD6, tinta #241D12, Oswald + Lexend, bordes gruesos y
 * sombras neobrutalistas duras, dock Mac infinito con imán/inercia/magnify,
 * nube de palabras por sección y modo sol/luna).
 *
 * ⚠️ NO es una app aparte: es solo la CHROME. El contenido son las PANTALLAS
 * REALES del ERP (`<Outlet/>`), con sus pestañas y subpestañas nativas. Las
 * tuberías (datos, lógica, Supabase) no se tocan. La navegación sale de la
 * fuente única `@/nav/navModel`, la misma que usa el sidebar de escritorio: por
 * eso cualquier cambio futuro del ERP se refleja idéntico aquí. Ver contrato en
 * docs/LEY_PWA_MOVIL.md.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { supabase } from '@/lib/supabase'
import {
  DIRECTOS, SECTIONS, SECTION_ICONS, seccionesVisibles, tituloDeRuta,
  type NavItem,
} from '@/nav/navModel'
import ToastSL from '@/components/ui/ToastSL'
import ResponsiveTables from '@/components/ResponsiveTables'
import OcrCompletadoGlobal from '@/components/ocr/OcrCompletadoGlobal'
import OcrUploadToast from '@/components/ocr/OcrUploadToast'
import CommandPalette from '@/components/CommandPalette'
import '@/styles/movil-scope.css'

const OSW = "'Oswald', sans-serif"
const LEX = "'Lexend', sans-serif"
const LOGO_SRC = '/loco-icon.svg.svg'

/* ── Tokens de piel (mockup) ── */
const T = (dark: boolean) => ({
  paper: dark ? '#17120c' : '#FCEFD6',
  ink: dark ? '#FCEFD6' : '#241D12',
  panel: dark ? '#241d15' : '#FFFDF7',
  cloud: dark ? 'rgba(23,18,12,.96)' : 'rgba(252,239,214,.95)',
})
const INK_HARD = '#241D12' // borde/sombra: siempre tinta dura, como el mock

type DockEntry =
  | { kind: 'page'; key: string; label: string; bg: string; ic: string; Icon: LucideIcon; path: string; tareas?: boolean }
  | { kind: 'section'; key: string; label: string; bg: string; ic: string; Icon: LucideIcon; texto: string; items: NavItem[] }

function keyForPath(pathname: string): string | null {
  const dir = DIRECTOS.find(d => d.path === pathname)
  if (dir) return dir.path
  for (const s of SECTIONS) {
    if (s.items.some(i => pathname === i.path || pathname.startsWith(i.path + '/'))) return s.key
  }
  return null
}

export default function AppMovil() {
  const nav = useNavigate()
  const loc = useLocation()
  const { usuario, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const tk = T(isDark)
  const perfil = usuario?.perfil ?? ''

  const [selected, setSelected] = useState<string>(() => keyForPath(loc.pathname) ?? '/panel')
  const [openCloud, setOpenCloud] = useState(false)
  const [menu, setMenu] = useState(false)
  const [tareas, setTareas] = useState(0)
  const [instalar, setInstalar] = useState<any>(null)
  const [ios, setIos] = useState(false)
  const [avisoOff, setAvisoOff] = useState(false)

  const stripRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const ctl = useRef<any>({ drag: null, raf: null, oneSet: 0, suppress: false, wired: false })

  /* ── Dock: 3 accesos directos + 6 secciones (mismas que el sidebar) ── */
  const directos = useMemo<DockEntry[]>(() => DIRECTOS.map(d => ({
    kind: 'page', key: d.path, label: d.label, bg: d.bg, ic: d.ic, Icon: d.icon, path: d.path, tareas: d.tareas,
  })), [])
  const secciones = useMemo<DockEntry[]>(() => seccionesVisibles(perfil).map(s => {
    const v = SECTION_ICONS[s.key]
    return {
      kind: 'section', key: s.key, label: s.label.split(' ')[0].toUpperCase(),
      bg: v?.headBg ?? '#484f66', ic: v?.headColor ?? '#fff', Icon: v?.icon as LucideIcon,
      texto: v?.headColor ?? '#fff', items: s.items,
    }
  }), [perfil])
  const dock = useMemo(() => [...directos, ...secciones], [directos, secciones])
  const byKey = useCallback((k: string) => dock.find(d => d.key === k), [dock])

  const cab = tituloDeRuta(loc.pathname)
  const seccionSel = selected && byKey(selected)?.kind === 'section' ? (byKey(selected) as any) : null

  /* ── Badge de tareas (igual que sidebar) ── */
  useEffect(() => {
    supabase.from('tareas_pendientes')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'atrasada'])
      .then(({ count }) => setTareas(count ?? 0))
  }, [])

  /* ── PWA: ofrecer instalación (Android/Chrome) o instrucción iOS ──
     El evento `beforeinstallprompt` se dispara UNA vez y a menudo antes de que
     monte React, así que lo captura index.html en `window.__bip`. Aquí lo
     recogemos (ya disparado o cuando llegue) para mostrar «Instalar». Si el
     usuario desinstala la app, el navegador vuelve a dispararlo → reaparece. */
  useEffect(() => {
    const yaInstalada = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
    if (yaInstalada) { setAvisoOff(true); return }
    // iOS/iPadOS Safari nunca dispara beforeinstallprompt: se instala a mano.
    const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)
    setIos(esIos)
    if ((window as any).__bip) setInstalar((window as any).__bip)
    const onReady = () => setInstalar((window as any).__bip)
    const cap = (e: Event) => { e.preventDefault(); ;(window as any).__bip = e; setInstalar(e) }
    const onInstalled = () => { ;(window as any).__bip = null; setInstalar(null); setAvisoOff(true) }
    window.addEventListener('bip-ready', onReady)
    window.addEventListener('beforeinstallprompt', cap)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('bip-ready', onReady)
      window.removeEventListener('beforeinstallprompt', cap)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  /* ── Física del dock (imán al centro + inercia + carrusel infinito) ── */
  const magnify = useCallback(() => {
    const strip = stripRef.current
    if (!strip) return
    const cx = strip.getBoundingClientRect().left + strip.clientWidth / 2
    strip.querySelectorAll<HTMLElement>('.dock-ic').forEach(el => {
      const b = el.getBoundingClientRect()
      const t = Math.max(0, 1 - Math.abs(b.left + b.width / 2 - cx) / 165)
      el.style.transform = `translateY(${-t * 4}px) scale(${1 + t * 0.18})`
      el.style.zIndex = String(Math.round(t * 10))
      el.style.opacity = String(0.55 + t * 0.45)
    })
  }, [])

  const loopFix = useCallback(() => {
    const strip = stripRef.current
    const one = ctl.current.oneSet
    if (!strip || !one) return
    if (strip.scrollLeft < one * 0.5) strip.scrollLeft += one
    else if (strip.scrollLeft > one * 1.5) strip.scrollLeft -= one
  }, [])

  const stopMomentum = useCallback(() => {
    if (ctl.current.raf) { cancelAnimationFrame(ctl.current.raf); ctl.current.raf = null }
  }, [])

  const tweenTo = useCallback((target: number) => {
    stopMomentum()
    const strip = stripRef.current
    if (!strip) return
    const step = () => {
      const cur = strip.scrollLeft
      const d = target - cur
      if (Math.abs(d) < 1) { strip.scrollLeft = target; ctl.current.raf = null; magnify(); return }
      strip.scrollLeft = cur + d * 0.22
      magnify()
      ctl.current.raf = requestAnimationFrame(step)
    }
    ctl.current.raf = requestAnimationFrame(step)
  }, [magnify, stopMomentum])

  const centerKey = useCallback((key: string, smooth: boolean) => {
    const strip = stripRef.current
    if (!strip) return
    const els = [...strip.querySelectorAll<HTMLElement>('.dock-ic')].filter(el => el.dataset.key === key)
    const el = els[1] || els[0]
    if (!el) return
    const left = el.offsetLeft + el.offsetWidth / 2 - strip.clientWidth / 2
    if (smooth) tweenTo(left)
    else { strip.scrollLeft = left; magnify() }
  }, [magnify, tweenTo])

  const settle = useCallback(() => {
    const strip = stripRef.current
    if (!strip) return
    const cx = strip.getBoundingClientRect().left + strip.clientWidth / 2
    let best: HTMLElement | null = null, bd = 1e9
    strip.querySelectorAll<HTMLElement>('.dock-ic').forEach(el => {
      const b = el.getBoundingClientRect()
      const dd = Math.abs(b.left + b.width / 2 - cx)
      if (dd < bd) { bd = dd; best = el }
    })
    if (!best) return
    const el = best as HTMLElement
    if (bd > 5) tweenTo(el.offsetLeft + el.offsetWidth / 2 - strip.clientWidth / 2)
    if (el.dataset.key) setSelected(el.dataset.key)
  }, [tweenTo])

  const momentum = useCallback((v0: number) => {
    stopMomentum()
    const strip = stripRef.current
    if (!strip) return
    let v = v0
    const step = () => {
      if (Math.abs(v) < 0.5) { ctl.current.raf = null; settle(); return }
      strip.scrollLeft -= v
      v *= 0.94
      loopFix()
      magnify()
      ctl.current.raf = requestAnimationFrame(step)
    }
    ctl.current.raf = requestAnimationFrame(step)
  }, [loopFix, magnify, settle, stopMomentum])

  /* Tap: centra y actúa (página → navega · sección → nube) */
  const tap = useCallback((key: string) => {
    const it = byKey(key)
    if (!it) return
    if (selected === key && it.kind === 'section' && it.items.length) {
      setOpenCloud(o => !o); return
    }
    stopMomentum()
    centerKey(key, true)
    setSelected(key)
    if (it.kind === 'section' && it.items.length) {
      setOpenCloud(true)
    } else if (it.kind === 'page') {
      setOpenCloud(false)
      if (loc.pathname !== it.path) nav(it.path)
      scrollRef.current?.scrollTo({ top: 0 })
    }
  }, [byKey, centerKey, loc.pathname, nav, selected, stopMomentum])

  const irItem = useCallback((path: string) => {
    setOpenCloud(false); setMenu(false)
    if (loc.pathname !== path) nav(path)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [loc.pathname, nav])

  /* Wiring pointer + centrado inicial */
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const setup = () => {
      const s = stripRef.current
      if (!s) return
      ctl.current.oneSet = s.scrollWidth / 3
      centerKey(keyForPath(loc.pathname) ?? '/panel', false)
      magnify()
    }
    requestAnimationFrame(setup)
    const t = setTimeout(setup, 160)

    if (ctl.current.wired) return () => clearTimeout(t)
    ctl.current.wired = true
    strip.style.touchAction = 'none'
    strip.style.cursor = 'grab'

    const onDown = (e: PointerEvent) => {
      stopMomentum()
      ctl.current.drag = { active: true, lastX: e.clientX, lastT: performance.now(), v: 0, dist: 0 }
      strip.style.cursor = 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      const d = ctl.current.drag
      if (!d || !d.active) return
      const now = performance.now()
      const dx = e.clientX - d.lastX
      strip.scrollLeft -= dx
      d.dist += Math.abs(dx)
      d.v = dx / Math.max(1, now - d.lastT)
      d.lastX = e.clientX; d.lastT = now
      loopFix(); magnify()
      e.preventDefault()
    }
    const onUp = () => {
      const d = ctl.current.drag
      if (!d || !d.active) return
      d.active = false
      ctl.current.suppress = d.dist > 8
      strip.style.cursor = 'grab'
      momentum(d.v * 16)
    }
    const onClickCapture = (e: MouseEvent) => {
      if (ctl.current.suppress) { e.stopPropagation(); e.preventDefault(); ctl.current.suppress = false }
    }
    strip.addEventListener('pointerdown', onDown)
    strip.addEventListener('click', onClickCapture, true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      clearTimeout(t)
      stopMomentum()
      strip.removeEventListener('pointerdown', onDown)
      strip.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      ctl.current.wired = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Al cambiar de ruta: subir el contenido y re-centrar el dock */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    const k = keyForPath(loc.pathname)
    if (k) { setSelected(k); centerKey(k, true) }
  }, [loc.pathname, centerKey])

  const abrirBuscador = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', altKey: true, bubbles: true }))
  }
  const instalarApp = async () => {
    const ev = instalar || (window as any).__bip
    if (!ev) return
    ev.prompt()
    try { await ev.userChoice } catch { /* nada */ }
    ;(window as any).__bip = null
    setInstalar(null)
  }

  const btnIcon = (onClick: () => void, node: React.ReactNode, label: string) => (
    <button onClick={onClick} aria-label={label} style={{
      width: 36, height: 36, background: tk.panel, border: `3px solid ${INK_HARD}`, borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `2px 2px 0 ${INK_HARD}`,
      cursor: 'pointer', color: tk.ink, padding: 0,
    }}>{node}</button>
  )

  const verAviso = (!!instalar || ios) && !avisoOff

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden', background: tk.paper, color: tk.ink,
      fontFamily: LEX, display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Topbar: logo + sol/luna + buscador ── */}
      <header style={{
        flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'calc(6px + env(safe-area-inset-top)) 14px 10px', background: tk.paper,
        borderBottom: `3px solid ${INK_HARD}`,
      }}>
        <button onClick={() => setMenu(m => !m)} style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <img src={LOGO_SRC} alt="Streat Lab" style={{ width: 40, height: 40, objectFit: 'contain', background: '#fff', border: `3px solid ${INK_HARD}`, borderRadius: 11, padding: 2 }} />
          <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, letterSpacing: 3, color: tk.ink, whiteSpace: 'nowrap' }}>STREAT LAB</span>
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {btnIcon(toggleTheme, isDark ? <Sun size={16} strokeWidth={2.2} /> : <Moon size={16} strokeWidth={2.2} />, 'Cambiar tema')}
          {btnIcon(abrirBuscador, <Search size={16} strokeWidth={2.4} />, 'Buscar')}
        </div>
      </header>

      {/* ── Cabecera de contexto (sección · título de la pantalla actual) ── */}
      <div style={{ flex: 'none', padding: '9px 16px 7px', background: tk.paper, display: 'flex', alignItems: 'baseline', gap: 8, borderBottom: `1.5px solid ${isDark ? '#3a2f20' : '#e7d3a8'}` }}>
        <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase', color: isDark ? '#c9bda6' : '#6B5D45' }}>{cab.seccion}</span>
        <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 17, textTransform: 'uppercase', color: tk.ink, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cab.titulo}</span>
      </div>

      {/* ── Menú de cuenta (usuario + salir) ── */}
      {menu && (
        <div style={{ position: 'absolute', top: 'calc(62px + env(safe-area-inset-top))', left: 14, zIndex: 70, background: tk.paper, border: `4px solid ${INK_HARD}`, boxShadow: `6px 6px 0 ${INK_HARD}`, width: '15rem', padding: '0.7rem' }}>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 15, textTransform: 'uppercase', color: tk.ink, marginBottom: 8 }}>{usuario?.nombre || 'Usuario'}</div>
          <button onClick={() => { setMenu(false); logout() }} style={{ width: '100%', background: '#B01D23', color: '#fff', border: `3px solid ${INK_HARD}`, boxShadow: `3px 3px 0 ${INK_HARD}`, padding: '0.5rem', cursor: 'pointer', borderRadius: 0, fontFamily: OSW, fontWeight: 700, fontSize: 14, textTransform: 'uppercase' }}>Cerrar sesión</button>
        </div>
      )}

      {/* ── Contenido: PANTALLAS REALES del ERP ── */}
      <div ref={scrollRef} className="scr" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
        <div className="movil-scope" style={{ padding: '12px 12px 130px' }}>
          <Outlet />
        </div>
      </div>

      {/* ── Aviso instalar PWA ── */}
      {verAviso && (
        <div style={{ flex: 'none', background: '#FFC400', borderTop: `3px solid ${INK_HARD}`, padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>📲</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontFamily: OSW, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', color: INK_HARD }}>Instalar Binagre</p>
            <p style={{ margin: 0, fontSize: 11, color: INK_HARD, opacity: 0.75 }}>{ios ? 'Toca Compartir ⬆ → «Añadir a pantalla de inicio»' : 'Añádela a la pantalla de inicio'}</p>
          </div>
          {instalar && (
            <button onClick={instalarApp} style={{ background: INK_HARD, color: '#FFC400', border: `3px solid ${INK_HARD}`, fontFamily: OSW, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', padding: '0.4rem 0.7rem', cursor: 'pointer' }}>Instalar</button>
          )}
          <button onClick={() => setAvisoOff(true)} aria-label="Ahora no" style={{ background: 'transparent', border: 'none', fontFamily: OSW, fontWeight: 700, fontSize: 18, cursor: 'pointer', color: INK_HARD }}>✕</button>
        </div>
      )}

      {/* ── Velo ── */}
      {(openCloud || menu) && (
        <div onClick={() => { setOpenCloud(false); setMenu(false) }} style={{ position: 'absolute', inset: 0, bottom: 90, background: 'transparent', zIndex: 39 }} />
      )}

      {/* ── Nube de palabras (submódulos de la sección) ── */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 110, transformOrigin: 'bottom center',
        transform: openCloud && seccionSel ? 'translateY(0) scale(1)' : 'translateY(10px) scale(.92)',
        opacity: openCloud && seccionSel ? 1 : 0, pointerEvents: openCloud && seccionSel ? 'auto' : 'none',
        transition: 'transform .2s cubic-bezier(.25,.9,.3,1.25), opacity .15s ease', zIndex: 41,
      }}>
        {seccionSel && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 9, background: tk.cloud, border: `3px solid ${INK_HARD}`, borderRadius: 16, padding: '15px 14px' }}>
            {seccionSel.items.map((it: NavItem) => {
              const activo = loc.pathname === it.path || loc.pathname.startsWith(it.path + '/')
              const bg = activo ? INK_HARD : seccionSel.bg
              const txt = activo ? '#FFC400' : (seccionSel.bg === '#FFC400' ? '#241D12' : '#fff')
              return (
                <button key={it.path} onClick={() => irItem(it.path)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 15px', borderRadius: 11,
                  background: bg, border: `2px solid ${INK_HARD}`, boxShadow: `2px 2px 0 ${INK_HARD}`, cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 14 }}>{it.emoji}</span>
                  <span style={{ fontFamily: LEX, fontWeight: 600, fontSize: 14, color: txt, whiteSpace: 'nowrap' }}>{it.label}</span>
                  {it.pendiente && <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 8, letterSpacing: 1, color: activo ? '#FFC400' : '#fff', border: `1.5px solid ${activo ? '#FFC400' : '#fff'}`, padding: '0 3px' }}>PEND</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Dock Mac infinito (imán + inercia + magnify) ── */}
      <div style={{ flex: 'none', position: 'relative', background: tk.paper, borderTop: `3px solid ${INK_HARD}`, zIndex: 30, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div ref={stripRef} className="scr" onScroll={magnify} style={{ height: 88, display: 'flex', alignItems: 'center', gap: 16, padding: '0 calc(50% - 20px)', overflowX: 'auto', overflowY: 'visible' }}>
          {[0, 1, 2].map(g => dock.map(it => {
            const Icon = it.Icon
            return (
              <button key={`${g}-${it.key}`} className="dock-ic" data-key={it.key} onClick={() => tap(it.key)} style={{
                flex: 'none', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: 0,
                transition: 'transform .16s cubic-bezier(.2,.85,.25,1)', transformOrigin: 'bottom center', willChange: 'transform',
              }}>
                <div style={{ position: 'relative', width: 40, height: 40, background: it.bg, border: `3px solid ${INK_HARD}`, borderRadius: 12, boxShadow: `3px 3px 0 ${INK_HARD}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {Icon ? <Icon size={19} strokeWidth={2.1} color={it.ic} /> : null}
                  {it.kind === 'page' && it.tareas && tareas > 0 && (
                    <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 17, height: 17, padding: '0 3px', background: '#FF1E27', border: `2px solid ${INK_HARD}`, borderRadius: 9, color: '#fff', fontFamily: OSW, fontWeight: 700, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tareas > 99 ? '99+' : tareas}</span>
                  )}
                </div>
                <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 8, letterSpacing: 0.4, color: tk.ink, whiteSpace: 'nowrap' }}>{it.label}</span>
              </button>
            )
          }))}
        </div>
      </div>

      {/* ── Overlays globales del ERP (paridad con escritorio) ── */}
      <ToastSL />
      <ResponsiveTables />
      <OcrUploadToast />
      <OcrCompletadoGlobal />
      <CommandPalette />
    </div>
  )
}
