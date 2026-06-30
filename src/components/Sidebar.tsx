import { NavLink } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  LayoutDashboard,
  TrendingUp,
  ChefHat,
  ShoppingCart,
  Settings,
  ChevronRight,
  Clock,
  Users,
  BellRing,
  FileText,
  ClipboardList,
  Megaphone,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ThemeToggle } from './ThemeToggle'
import { useTheme, FONT } from '@/styles/tokens'
import { supabase } from '@/lib/supabase'
import SidebarBadge from '@/components/ui/SidebarBadge'
import { useEsMovil } from '@/hooks/useEsMovil'

// ── Variante B del mock (bloques de color sólido). FONDO del sidebar (header,
// cuerpo y footer) en crema. Texto de módulos y submódulos grande (~85% ancho)
// sin aumentar la altura de las celdas.
const INK    = '#0a0a0a'
const CREMA  = '#FCEFD6'
const BLANCO = '#fff'
const GRANATE = '#B01D23'
const AMA    = '#FFC400'
const LOGO_SRC = '/loco-icon.svg.svg'

interface NavItem   { path: string; label: string; emoji: string; perfiles: string[] }
interface NavSection { key: string; label: string; perfiles: string[]; items: NavItem[] }
interface SectionIconConfig { icon: LucideIcon; headBg: string; headColor: string }

const SECTIONS: NavSection[] = [
  {
    key: 'finanzas', label: 'Finanzas', perfiles: ['admin'],
    items: [
      { path: '/finanzas/documentacion',        label: 'Documentación',        emoji: '📥', perfiles: ['admin'] },
      { path: '/facturacion',                   label: 'Facturación',          emoji: '🧾', perfiles: ['admin'] },
      { path: '/finanzas/ventas',               label: 'Ventas',               emoji: '💰', perfiles: ['admin'] },
      { path: '/finanzas/objetivos',            label: 'Objetivos',            emoji: '🎯', perfiles: ['admin'] },
      { path: '/finanzas/punto-equilibrio',     label: 'Punto de Equilibrio',  emoji: '⚖️', perfiles: ['admin'] },
      { path: '/finanzas/running',              label: 'Running',              emoji: '📊', perfiles: ['admin'] },
      { path: '/finanzas/pagos-cobros',         label: 'Pagos y Cobros',       emoji: '💳', perfiles: ['admin'] },
      { path: '/finanzas/verifactu',            label: 'Verifactu',            emoji: '✅', perfiles: ['admin'] },
      { path: '/finanzas/escenarios-tesoreria', label: 'Escenarios Tesorería', emoji: '🔮', perfiles: ['admin'] },
    ],
  },
  {
    key: 'cocina', label: 'Cocina', perfiles: ['admin', 'cocina'],
    items: [
      { path: '/escandallo',                 label: 'Escandallo',          emoji: '⚖️', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/lista-compra',        label: 'Lista de Compra',     emoji: '🛒', perfiles: ['admin', 'cocina'] },
      { path: '/carta',                      label: 'Carta',               emoji: '🍽️', perfiles: ['admin'] },
      { path: '/cocina/menu-engineering',    label: 'Menú Engineering',    emoji: '⚙️', perfiles: ['admin'] },
      { path: '/cocina/pareto-ingredientes', label: 'Pareto Ingredientes', emoji: '🥕', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/recetario',           label: 'Recetario',           emoji: '📋', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/produccion',          label: 'Producción',          emoji: '📋', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/menu-familia',        label: 'Menú Familia',        emoji: '🥘', perfiles: ['admin', 'cocina'] },
    ],
  },
  {
    key: 'operaciones', label: 'Operaciones', perfiles: ['admin'],
    items: [
      { path: '/ops/checklists',    label: 'Checklists',       emoji: '✅', perfiles: ['admin'] },
      { path: '/ops/tareas',        label: 'Tareas',           emoji: '📝', perfiles: ['admin'] },
      { path: '/ops/manuales',      label: 'Manuales',         emoji: '📚', perfiles: ['admin'] },
      { path: '/ops/reembolsos',    label: 'Reclamaciones',    emoji: '💸', perfiles: ['admin'] },
      { path: '/ops/pulso',         label: 'Pulso Cocina',     emoji: '📡', perfiles: ['admin'] },
      { path: '/ops/temperaturas',  label: 'Temperaturas',     emoji: '🌡️', perfiles: ['admin'] },
      { path: '/ops/bpm',           label: 'BPM / Calidad',    emoji: '✅', perfiles: ['admin'] },
      { path: '/ops/equipos',       label: 'Libro Equipos',    emoji: '🔧', perfiles: ['admin'] },
      { path: '/ops/danos',         label: 'Daños Menaje',     emoji: '🍽️', perfiles: ['admin'] },
      { path: '/ops/pedidos-menaje',label: 'Pedidos Menaje',   emoji: '📦', perfiles: ['admin'] },
      { path: '/ops/bitacora',      label: 'Bitácora',         emoji: '🔔', perfiles: ['admin'] },
      { path: '/ops/reuniones',     label: 'Reuniones Equipo', emoji: '🤝', perfiles: ['admin'] },
      { path: '/marcas',            label: 'Marcas',           emoji: '🏷️', perfiles: ['admin'] },
    ],
  },
  {
    key: 'stock', label: 'Stock & Compras', perfiles: ['admin'],
    items: [
      { path: '/stock/inventario',  label: 'Inventario',  emoji: '📦', perfiles: ['admin'] },
      { path: '/stock/compras',     label: 'Compras',     emoji: '🛒', perfiles: ['admin'] },
      { path: '/stock/proveedores', label: 'Proveedores', emoji: '🏢', perfiles: ['admin'] },
    ],
  },
  {
    key: 'informes', label: 'Informes', perfiles: ['admin'],
    items: [
      { path: '/informes',               label: 'Panel Informes',   emoji: '📊', perfiles: ['admin'] },
      { path: '/informes/destinatarios', label: 'Destinatarios',    emoji: '👥', perfiles: ['admin'] },
      { path: '/informes/historial',     label: 'Historial envíos', emoji: '🕒', perfiles: ['admin'] },
      { path: '/informes/configuracion', label: 'Configuración',    emoji: '⚙️', perfiles: ['admin'] },
    ],
  },
  {
    key: 'equipo', label: 'Equipo', perfiles: ['admin'],
    items: [
      { path: '/equipo',             label: 'Personas',    emoji: '👥', perfiles: ['admin'] },
      { path: '/equipo/organigrama', label: 'Organigrama', emoji: '🏢', perfiles: ['admin'] },
      { path: '/equipo/horarios',    label: 'Horarios',    emoji: '🗓️', perfiles: ['admin'] },
      { path: '/equipo/presencia',   label: 'Presencia',   emoji: '🕐', perfiles: ['admin'] },
    ],
  },
  {
    key: 'mkt', label: 'MKT', perfiles: ['admin'],
    items: [
      { path: '/clientes/crm',         label: 'CRM Streat Lab',        emoji: '🛍️', perfiles: ['admin'] },
      { path: '/clientes/club',        label: 'Club Fidelización',     emoji: '🎖️', perfiles: ['admin'] },
      { path: '/clientes/resenas',     label: 'Panel Reseñas',         emoji: '⭐',  perfiles: ['admin'] },
      { path: '/clientes/playbook-tp', label: 'Playbook ThinkPaladar', emoji: '📣', perfiles: ['admin'] },
    ],
  },
  {
    key: 'configuracion', label: 'Configuración', perfiles: ['admin'],
    items: [
      { path: '/configuracion/compras/categorias',   label: 'Catálogos · Compras',  emoji: '🛒', perfiles: ['admin'] },
      { path: '/configuracion/integraciones',        label: 'Integraciones',        emoji: '🔌', perfiles: ['admin'] },
      { path: '/configuracion/reglas',               label: 'Reglas',               emoji: '📐', perfiles: ['admin'] },
      { path: '/configuracion/bancos-y-cuentas',     label: 'Bancos y Cuentas',     emoji: '🏦', perfiles: ['admin'] },
      { path: '/configuracion/usuarios',             label: 'Usuarios',             emoji: '👤', perfiles: ['admin'] },
      { path: '/configuracion/calendario',           label: 'Calendario operativo', emoji: '📅', perfiles: ['admin'] },
      { path: '/configuracion/aprendizajes',         label: 'Aprendizajes ERP',     emoji: '🧠', perfiles: ['admin'] },
      { path: '/configuracion/calcneto-aprendizaje', label: 'Ajuste calcNeto',      emoji: '⚖️', perfiles: ['admin'] },
    ],
  },
]

// Variante B: cada sec-head con su color de fondo sólido (literal del mock)
const SECTION_ICONS: Record<string, SectionIconConfig> = {
  finanzas:      { icon: TrendingUp,    headBg: '#0FB86B', headColor: '#fff'  },
  cocina:        { icon: ChefHat,       headBg: '#FFC400', headColor: '#0a0a0a' },
  operaciones:   { icon: ClipboardList, headBg: '#FF6A1A', headColor: '#fff'  },
  stock:         { icon: ShoppingCart,  headBg: '#2D5BFF', headColor: '#fff'  },
  informes:      { icon: FileText,      headBg: '#B01D23', headColor: '#fff'  },
  equipo:        { icon: Users,         headBg: '#FF2E63', headColor: '#fff'  },
  mkt:           { icon: Megaphone,     headBg: '#1e2233', headColor: '#fff'  },
  configuracion: { icon: Settings,      headBg: '#484f66', headColor: '#fff'  },
}

const PROXIMAMENTE: { label: string; emoji: string }[] = [
  { label: 'Revenue & Ticket',        emoji: '🎫' },
  { label: 'Predicción Demanda',      emoji: '🔮' },
  { label: 'Tesorería',               emoji: '💳' },
  { label: 'BPM / Calidad',           emoji: '✅' },
  { label: 'Almacén',                 emoji: '🏭' },
  { label: 'Stock Mínimo Alertas',    emoji: '⚠️' },
  { label: 'POS',                     emoji: '🖥️' },
  { label: 'Fichas Empleados',        emoji: '👤' },
  { label: 'CRM Tienda Propia',       emoji: '🛍️' },
  { label: 'Ventas por Hora',         emoji: '🕐' },
  { label: 'Ranking Productos',       emoji: '🏆' },
  { label: 'Alérgenos',               emoji: '🥜' },
  { label: 'BI / Informes Avanzados', emoji: '📈' },
  { label: 'Control Mermas',          emoji: '📉' },
  { label: 'Email Marketing',         emoji: '✉️' },
  { label: 'Exportación a Gestoría',  emoji: '📤' },
  { label: 'Inventario Tiempo Real',  emoji: '📡' },
  { label: 'Marketing Automation',    emoji: '🤖' },
  { label: 'Planificación Turnos',    emoji: '🗓️' },
  { label: 'Promociones por Día/Hora',emoji: '⏰' },
]

const PROXIMAMENTE_LS_KEY  = 'streatlab.sidebar.proximamente.open'
const OPEN_SECTIONS_LS_KEY = 'streatlab.sidebar.openSections'

function loadOpenSections(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(OPEN_SECTIONS_LS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr.filter(x => typeof x === 'string').slice(-2)
    return []
  } catch { return [] }
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { usuario, logout } = useAuth()
  const { isDark } = useTheme()
  const perfil      = usuario?.perfil ?? ''
  const esMovilDisp = useEsMovil()

  const [openSections, setOpenSections] = useState<string[]>(() => loadOpenSections())
  const [proxOpen, setProxOpen]         = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(PROXIMAMENTE_LS_KEY) === '1'
  })
  const [tareasBadge, setTareasBadge] = useState(0)
  const [ocrBadge,    setOcrBadge]    = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(PROXIMAMENTE_LS_KEY, proxOpen ? '1' : '0')
  }, [proxOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(OPEN_SECTIONS_LS_KEY, JSON.stringify(openSections)) } catch {}
  }, [openSections])

  useEffect(() => {
    supabase
      .from('tareas_pendientes')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'atrasada'])
      .then(({ count }) => setTareasBadge(count ?? 0))
  }, [])

  useEffect(() => {
    if (perfil !== 'admin') return
    supabase
      .from('facturas')
      .select('id', { count: 'exact', head: true })
      .in('tipo', ['proveedor', 'plataforma'])
      .or('total.lte.0,titular_id.is.null,categoria_factura.is.null')
      .then(({ count }) => setOcrBadge(count ?? 0))
  }, [perfil])

  // ── Colapso original: al interactuar (clic o HOVER) se ABRE y queda abierto 20 s; luego autocolapsa ──
  const [abierto, setAbierto] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const OPEN_MS = 20000

  const abrir20s = () => {
    setAbierto(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setAbierto(false), OPEN_MS)
  }

  useEffect(() => {
    abrir20s()
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const collapsed = esMovilDisp ? false : !abierto

  const toggleSection = (key: string) => {
    abrir20s()
    setOpenSections(prev => {
      if (prev.includes(key)) return prev.filter(s => s !== key)
      const next = [...prev, key]
      if (next.length > 2) next.shift()
      return next
    })
  }

  const filterItems = (items: NavItem[]) => items.filter(i => i.perfiles.includes(perfil))
  const sidebarWidth = collapsed ? 56 : 248

  const asideStyle: CSSProperties = {
    background: isDark ? '#1a1f2e' : CREMA,
    border: `4px solid ${INK}`,
    width: sidebarWidth,
    minWidth: sidebarWidth,
    maxWidth: sidebarWidth,
    scrollbarWidth: 'none',
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={onClose} />}

      <aside
        style={asideStyle}
        onMouseEnter={() => { if (!esMovilDisp) abrir20s() }}
        className={`
          sl-noscroll fixed top-0 left-0 z-40 h-full
          flex flex-col overflow-hidden transition-all duration-[250ms] ease-[ease]
          md:translate-x-0 md:static md:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <style>{`.sl-noscroll *::-webkit-scrollbar{width:0;height:0;display:none}.sl-noscroll *{scrollbar-width:none}`}</style>

        {/* ── HEADER (crema, logo Binagre real) ── */}
        {collapsed ? (
          <div style={{ background: CREMA, borderBottom: `4px solid ${INK}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 64, padding: '6px 0', gap: 4 }}>
            <div style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src={LOGO_SRC} alt="Streat Lab" style={{ width: 30, height: 30, objectFit: 'contain' }} />
            </div>
            <button onClick={abrir20s} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 36 }} title="Abrir">
              <ChevronRight size={18} color={INK} />
            </button>
          </div>
        ) : (
          <div style={{ background: CREMA, borderBottom: `4px solid ${INK}`, display: 'flex', alignItems: 'center', gap: 11, padding: '15px 16px' }}>
            <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src={LOGO_SRC} alt="Streat Lab" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            </div>
            <span style={{ fontFamily: FONT.heading, fontWeight: 800, letterSpacing: '2px', color: INK, fontSize: 21, textTransform: 'uppercase', flex: 1 }}>STREAT LAB</span>
            <button
              onClick={() => { if (esMovilDisp) onClose(); else setAbierto(false) }}
              style={{ color: INK, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 800, minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Colapsar"
            >«</button>
          </div>
        )}

        {/* ── NAV ── */}
        <nav className="flex-1 overflow-y-auto" style={{ overflowX: 'hidden', background: CREMA }}>

          {/* Panel Global (directo) */}
          {!collapsed && perfil && ['admin', 'cocina'].includes(perfil) && (
            <NavLink to="/" end onClick={onClose}
              style={({ isActive }) => ({
                fontFamily: FONT.heading, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 18,
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 11,
                borderBottom: `3px solid ${INK}`, cursor: 'pointer', textDecoration: 'none',
                color: isActive ? AMA : INK, background: isActive ? INK : CREMA,
              })}
            >
              {({ isActive }) => (
                <>
                  <LayoutDashboard size={20} strokeWidth={2.4} color={isActive ? AMA : INK} style={{ flexShrink: 0 }} />
                  <span>Panel Global</span>
                </>
              )}
            </NavLink>
          )}
          {collapsed && perfil && ['admin', 'cocina'].includes(perfil) && (
            <NavLink to="/" end onClick={() => { abrir20s(); onClose() }} title="Panel Global"
              style={({ isActive }) => ({
                width: '100%', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', borderBottom: `3px solid ${INK}`,
                background: isActive ? INK : CREMA,
              })}>
              {({ isActive }) => <LayoutDashboard size={20} strokeWidth={2.4} color={isActive ? AMA : INK} />}
            </NavLink>
          )}

          {/* Tareas (directo) */}
          {!collapsed && perfil === 'admin' && (
            <NavLink to="/tareas" onClick={onClose}
              style={({ isActive }) => ({
                fontFamily: FONT.heading, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 18,
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 11,
                borderBottom: `3px solid ${INK}`, cursor: 'pointer', textDecoration: 'none',
                color: isActive ? AMA : INK, background: isActive ? INK : CREMA,
              })}
            >
              {({ isActive }) => (
                <>
                  <BellRing size={20} strokeWidth={2.4} color={isActive ? AMA : INK} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Tareas</span>
                  <SidebarBadge count={tareasBadge} />
                </>
              )}
            </NavLink>
          )}
          {collapsed && perfil === 'admin' && (
            <NavLink to="/tareas" onClick={() => { abrir20s(); onClose() }} title="Tareas pendientes"
              style={({ isActive }) => ({
                width: '100%', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', position: 'relative', borderBottom: `3px solid ${INK}`,
                background: isActive ? INK : CREMA,
              })}>
              {({ isActive }) => (
                <>
                  <BellRing size={20} strokeWidth={2.4} color={isActive ? AMA : INK} />
                  {tareasBadge > 0 && (
                    <span style={{ position: 'absolute', top: 6, right: 8, background: GRANATE, color: '#fff', borderRadius: '50%', fontSize: 9, width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                      {tareasBadge > 9 ? '9+' : tareasBadge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )}

          {/* Secciones · variante B: sec-head de color sólido, texto grande */}
          {SECTIONS.map(section => {
            const visibleItems = filterItems(section.items)
            if (!section.perfiles.includes(perfil) || visibleItems.length === 0) return null
            const isOpen = openSections.includes(section.key)
            const cfg    = SECTION_ICONS[section.key]
            const Icon   = cfg?.icon
            const headBg = cfg?.headBg ?? '#444'
            const headCo = cfg?.headColor ?? '#fff'

            return (
              <div key={section.key}>
                {collapsed ? (
                  <button type="button" onClick={() => toggleSection(section.key)} title={section.label}
                    style={{ width: '100%', height: 44, background: headBg, border: 'none', borderBottom: `3px solid ${INK}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {Icon ? <Icon size={20} strokeWidth={2.4} color={headCo} /> : null}
                  </button>
                ) : (
                  <button type="button" onClick={() => toggleSection(section.key)}
                    style={{
                      width: '100%', background: headBg, color: headCo,
                      border: 'none', borderBottom: `3px solid ${INK}`, cursor: 'pointer',
                      boxShadow: isOpen ? `inset 0 -5px 0 ${INK}` : 'none',
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '11px 16px',
                      fontFamily: FONT.heading, fontWeight: 800, fontSize: 19,
                      textTransform: 'uppercase', letterSpacing: '0.02em',
                    }}
                  >
                    {Icon ? <Icon size={20} strokeWidth={2.4} color={headCo} style={{ flexShrink: 0 }} /> : null}
                    <span style={{ flex: 1, textAlign: 'left' }}>{section.label}</span>
                    <span style={{ fontWeight: 800, fontSize: 17, transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>›</span>
                  </button>
                )}

                {!collapsed && isOpen && (
                  <div style={{ background: BLANCO, borderBottom: `3px solid ${INK}` }}>
                    {visibleItems.map((item, idx) => (
                      <NavLink key={`${item.path}-${idx}`} to={item.path} end onClick={onClose}
                        style={({ isActive }) => ({
                          fontFamily: FONT.heading, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.01em', fontSize: 16,
                          padding: '8px 16px 8px 18px', display: 'flex', alignItems: 'center', gap: 9,
                          cursor: 'pointer', textDecoration: 'none',
                          borderTop: idx > 0 ? '1.5px solid rgba(0,0,0,.14)' : 'none',
                          background: isActive ? INK : BLANCO,
                          color: isActive ? (section.key === 'cocina' ? AMA : '#fff') : INK,
                        })}
                      >
                        {({ isActive }) => (
                          <>
                            <span style={{ width: 7, height: 7, flexShrink: 0, background: isActive ? AMA : INK, display: 'inline-block' }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                            {item.path === '/finanzas/documentacion' && <SidebarBadge count={ocrBadge} />}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Próximamente */}
          {!collapsed && perfil === 'admin' && (
            <div>
              <button type="button" onClick={() => setProxOpen(o => !o)}
                style={{ width: '100%', background: CREMA, border: 'none', borderBottom: `3px solid ${INK}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', fontFamily: FONT.heading, fontWeight: 800, fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.02em', color: '#6b5d45' }}
                title="Funciones en desarrollo">
                <Clock size={18} strokeWidth={2.4} color="#6b5d45" />
                <span style={{ flex: 1, textAlign: 'left' }}>Próximamente</span>
                <span style={{ fontWeight: 800, fontSize: 17, transition: 'transform .2s', transform: proxOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>›</span>
              </button>
              {proxOpen && (
                <div style={{ background: BLANCO, borderBottom: `3px solid ${INK}` }}>
                  {PROXIMAMENTE.map((item, idx) => (
                    <div key={`${item.label}-${idx}`} aria-disabled="true"
                      style={{ fontFamily: FONT.heading, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.01em', fontSize: 14.5, padding: '7px 16px 7px 18px', display: 'flex', alignItems: 'center', gap: 9, color: '#9a8f78', opacity: 0.6, cursor: 'not-allowed', userSelect: 'none', borderTop: idx > 0 ? '1.5px solid rgba(0,0,0,.1)' : 'none', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>{item.emoji}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* ── FOOTER (crema) ── */}
        {collapsed ? (
          <div style={{ marginTop: 'auto', background: CREMA, borderTop: `4px solid ${INK}`, padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ThemeToggle />
            </div>
            <button onClick={logout} style={{ width: 44, height: 32, color: INK, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Cerrar sesión">⏏</button>
          </div>
        ) : (
          <div style={{ marginTop: 'auto', background: CREMA, borderTop: `4px solid ${INK}`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ThemeToggle />
            </div>
            <div style={{ fontFamily: FONT.heading, textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.04em', color: INK, textAlign: 'right', lineHeight: 1.4 }}>
              {usuario?.nombre}<br />
              <button onClick={logout} style={{ color: GRANATE, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.heading, textTransform: 'uppercase', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', padding: 0 }}>Cerrar sesión</button>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
