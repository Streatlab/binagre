import { NavLink } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
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
import { useAuth } from '@/context/AuthContext'
import { ThemeToggle } from './ThemeToggle'
import { useTheme, FONT } from '@/styles/tokens'
import { supabase } from '@/lib/supabase'
import SidebarBadge from '@/components/ui/SidebarBadge'
import { useEsMovil } from '@/hooks/useEsMovil'

// Fondo del sidebar SIEMPRE crema (header, cuerpo y footer). Las secciones son
// botones de color sólido flotando sobre el crema.
const CREMA = '#FCEFD6'
const INK   = '#140f08'

interface NavItem   { path: string; label: string; emoji: string; perfiles: string[] }
interface NavSection { key: string; emoji: string; label: string; perfiles: string[]; items: NavItem[] }
interface SectionIconConfig { icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>; color: string }

const SECTIONS: NavSection[] = [
  {
    key: 'finanzas', emoji: '📈', label: 'Finanzas', perfiles: ['admin'],
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
    key: 'cocina', emoji: '🍳', label: 'Cocina', perfiles: ['admin', 'cocina'],
    items: [
      { path: '/escandallo',                 label: 'Escandallo',            emoji: '⚖️', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/lista-compra',        label: 'Lista de Compra',       emoji: '🛒', perfiles: ['admin', 'cocina'] },
      { path: '/carta',                      label: 'Carta',                 emoji: '🍽️', perfiles: ['admin'] },
      { path: '/cocina/menu-engineering',    label: 'Menú Engineering',      emoji: '⚙️', perfiles: ['admin'] },
      { path: '/cocina/pareto-ingredientes', label: 'Pareto Ingredientes',   emoji: '🥕', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/recetario',           label: 'Recetario',             emoji: '📋', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/produccion',          label: 'Producción',            emoji: '📋', perfiles: ['admin', 'cocina'] },
    ],
  },
  {
    key: 'operaciones', emoji: '🛠️', label: 'Operaciones', perfiles: ['admin'],
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
    key: 'stock', emoji: '📦', label: 'Stock & Compras', perfiles: ['admin'],
    items: [
      { path: '/stock/inventario',  label: 'Inventario',  emoji: '📦', perfiles: ['admin'] },
      { path: '/stock/compras',     label: 'Compras',     emoji: '🛒', perfiles: ['admin'] },
      { path: '/stock/proveedores', label: 'Proveedores', emoji: '🏢', perfiles: ['admin'] },
    ],
  },
  {
    key: 'informes', emoji: '📑', label: 'Informes', perfiles: ['admin'],
    items: [
      { path: '/informes',               label: 'Panel Informes',   emoji: '📊', perfiles: ['admin'] },
      { path: '/informes/destinatarios', label: 'Destinatarios',    emoji: '👥', perfiles: ['admin'] },
      { path: '/informes/historial',     label: 'Historial envíos', emoji: '🕒', perfiles: ['admin'] },
      { path: '/informes/configuracion', label: 'Configuración',    emoji: '⚙️', perfiles: ['admin'] },
    ],
  },
  {
    key: 'equipo', emoji: '👥', label: 'Equipo', perfiles: ['admin'],
    items: [
      { path: '/equipo',             label: 'Personas',    emoji: '👥', perfiles: ['admin'] },
      { path: '/equipo/organigrama', label: 'Organigrama', emoji: '🏢', perfiles: ['admin'] },
      { path: '/equipo/horarios',    label: 'Horarios',    emoji: '🗓️', perfiles: ['admin'] },
      { path: '/equipo/presencia',   label: 'Presencia',   emoji: '🕐', perfiles: ['admin'] },
    ],
  },
  {
    key: 'mkt', emoji: '📣', label: 'MKT', perfiles: ['admin'],
    items: [
      { path: '/clientes/crm',         label: 'CRM Streat Lab',        emoji: '🛍️', perfiles: ['admin'] },
      { path: '/clientes/club',        label: 'Club Fidelización',     emoji: '🎖️', perfiles: ['admin'] },
      { path: '/clientes/resenas',     label: 'Panel Reseñas',         emoji: '⭐',  perfiles: ['admin'] },
      { path: '/clientes/playbook-tp', label: 'Playbook ThinkPaladar', emoji: '📣', perfiles: ['admin'] },
    ],
  },
  {
    key: 'configuracion', emoji: '⚙️', label: 'Configuración', perfiles: ['admin'],
    items: [
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

// Color de fondo sólido para el botón de cada sección
const SECTION_BG: Record<string, string> = {
  finanzas:      '#06C167',
  cocina:        '#f5a623',
  operaciones:   '#e05c1a',
  stock:         '#2D5BFF',
  informes:      '#B01D23',
  equipo:        '#e63c6e',
  mkt:           '#2b2117',
  configuracion: '#484f66',
}

const SECTION_ICONS: Record<string, SectionIconConfig> = {
  finanzas:      { icon: TrendingUp,    color: '#fff' },
  cocina:        { icon: ChefHat,       color: '#fff' },
  operaciones:   { icon: ClipboardList, color: '#fff' },
  stock:         { icon: ShoppingCart,  color: '#fff' },
  informes:      { icon: FileText,      color: '#fff' },
  equipo:        { icon: Users,         color: '#fff' },
  mkt:           { icon: Megaphone,     color: '#fff' },
  configuracion: { icon: Settings,      color: '#fff' },
}

const PROXIMAMENTE: { label: string; emoji: string }[] = [
  { label: 'Revenue & Ticket',            emoji: '🎫' },
  { label: 'Predicción Demanda',          emoji: '🔮' },
  { label: 'Tesorería',                   emoji: '💳' },
  { label: 'BPM / Calidad',               emoji: '✅' },
  { label: 'Almacén',                     emoji: '🏭' },
  { label: 'Stock Mínimo Alertas',        emoji: '⚠️' },
  { label: 'POS',                         emoji: '🖥️' },
  { label: 'Fichas Empleados',            emoji: '👤' },
  { label: 'CRM Tienda Propia',           emoji: '🛍️' },
  { label: 'Ventas por Hora',             emoji: '🕐' },
  { label: 'Ranking Productos',           emoji: '🏆' },
  { label: 'Alérgenos',                   emoji: '🥜' },
  { label: 'BI / Informes Avanzados',     emoji: '📈' },
  { label: 'Control Mermas',              emoji: '📉' },
  { label: 'Email Marketing',             emoji: '✉️' },
  { label: 'Exportación a Gestoría',      emoji: '📤' },
  { label: 'Inventario Tiempo Real',      emoji: '📡' },
  { label: 'Marketing Automation',        emoji: '🤖' },
  { label: 'Planificación Turnos',        emoji: '🗓️' },
  { label: 'Promociones por Día/Hora',    emoji: '⏰' },
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

  // ── Mecánica colapso/expansión ────────────────────────────────────────────
  // cerrado: el usuario pulsó «  → manda sobre todo (queda plegado)
  // pinned:  abierto tras interacción, con autocolapso por inactividad
  // peek:    abierto temporal al pasar el ratón (solo escritorio)
  const [pinned, setPinned]   = useState(false)
  const [peek,   setPeek]     = useState(false)
  const [cerrado, setCerrado] = useState(false)
  const pinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const PIN_MS   = 20000   // autocolapso a los 20 s de inactividad

  const pin = () => {
    setCerrado(false)
    setPinned(true)
    if (pinTimer.current) clearTimeout(pinTimer.current)
    pinTimer.current = setTimeout(() => setPinned(false), PIN_MS)
  }
  const colapsarManual = () => {
    if (pinTimer.current) { clearTimeout(pinTimer.current); pinTimer.current = null }
    setPinned(false)
    setPeek(false)
    setCerrado(true)
  }

  useEffect(() => {
    pin()
    return () => { if (pinTimer.current) clearTimeout(pinTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // En móvil el sidebar se controla por 'open' (off-canvas) y nunca se colapsa a iconos.
  // En escritorio: cerrado manda; si no, abierto mientras esté fijado o el ratón encima.
  const collapsed = esMovilDisp ? false : (cerrado ? true : (!pinned && !peek))

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      if (prev.includes(key)) return prev.filter(s => s !== key)
      const next = [...prev, key]
      if (next.length > 2) next.shift()
      return next
    })
  }

  const filterItems = (items: NavItem[]) => items.filter(i => i.perfiles.includes(perfil))
  const sidebarWidth = collapsed ? 56 : 220

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={onClose} />}

      <aside
        onMouseEnter={() => { if (!esMovilDisp && !cerrado) setPeek(true) }}
        onMouseLeave={() => { if (!esMovilDisp) setPeek(false) }}
        style={{
          background: isDark ? '#1a1f2e' : CREMA,
          borderRadius: 16,
          width: sidebarWidth,
          minWidth: sidebarWidth,
          maxWidth: sidebarWidth,
        }}
        className={`
          fixed top-0 left-0 z-40 h-full border-r border-[var(--sl-border)]
          flex flex-col transition-all duration-[250ms] ease-[ease] overflow-hidden
          md:translate-x-0 md:static md:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* ── HEADER (crema) ── */}
        {collapsed ? (
          <div style={{ background: CREMA, borderBottom: `2px solid ${INK}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 64, padding: '6px 0', gap: 4 }}>
            <img src="/data/logo-icon.svg" alt="Streat Lab" style={{ height: 28, width: 'auto', display: 'block' }} crossOrigin="anonymous" />
            <button onClick={pin} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 }} title="Abrir">
              <ChevronRight size={18} color="#B01D23" />
            </button>
          </div>
        ) : (
          <div style={{ background: CREMA, borderBottom: `2px solid ${INK}`, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <img src="/data/logo-icon.svg" alt="Streat Lab" style={{ height: 32, width: 'auto', display: 'block', flexShrink: 0 }} crossOrigin="anonymous" />
              <span style={{ fontFamily: FONT.heading, fontSize: 14, color: '#B01D23', letterSpacing: '2px', fontWeight: 600, whiteSpace: 'nowrap' }}>STREAT LAB</span>
            </div>
            {/* Móvil cierra el off-canvas; escritorio colapsa a iconos */}
            <button
              onClick={() => { if (esMovilDisp) onClose(); else colapsarManual() }}
              style={{ color: '#B01D23', background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20 }}
              title="Colapsar"
            >«</button>
          </div>
        )}

        {/* ── NAV ── */}
        <nav className="flex-1 py-2 overflow-y-auto" style={{ overflowX: 'hidden', background: isDark ? '#1a1f2e' : CREMA }}>

          {/* Panel Global */}
          {!collapsed && perfil && ['admin', 'cocina'].includes(perfil) && (
            <NavLink to="/" end onClick={onClose}
              style={({ isActive }) => ({
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                margin: '0 0 6px', padding: '9px 14px 9px 12px',
                background: isActive ? '#B01D23' : 'transparent',
                border: 'none', cursor: 'pointer', textDecoration: 'none',
                fontFamily: FONT.heading, fontSize: 14.5, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                color: isActive ? '#fff' : INK,
              })}
            >
              {({ isActive }) => (
                <>
                  <LayoutDashboard size={18} strokeWidth={1.8} color={isActive ? '#fff' : '#B01D23'} style={{ flexShrink: 0 }} />
                  <span>Panel Global</span>
                </>
              )}
            </NavLink>
          )}
          {collapsed && perfil && ['admin', 'cocina'].includes(perfil) && (
            <NavLink to="/" end onClick={onClose} title="Panel Global"
              style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
              <LayoutDashboard size={20} strokeWidth={1.8} color="#B01D23" />
            </NavLink>
          )}

          {/* Tareas */}
          {!collapsed && perfil === 'admin' && (
            <NavLink to="/tareas" onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                margin: '0 8px 8px', padding: '10px 14px 10px 12px',
                background: isActive ? '#B01D23' : '#fff',
                border: `2px solid ${INK}`, borderRadius: 8,
                cursor: 'pointer', textDecoration: 'none',
                fontFamily: FONT.heading, fontSize: 14.5, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                color: isActive ? '#fff' : INK,
              })}
            >
              {({ isActive }) => (
                <>
                  <BellRing size={18} strokeWidth={1.8} color={isActive ? '#fff' : '#B01D23'} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Tareas</span>
                  <SidebarBadge count={tareasBadge} />
                </>
              )}
            </NavLink>
          )}
          {collapsed && perfil === 'admin' && (
            <NavLink to="/tareas" onClick={onClose} title="Tareas pendientes"
              style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', position: 'relative' }}>
              <BellRing size={20} strokeWidth={1.8} color="#B01D23" />
              {tareasBadge > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 8, background: '#B01D23', color: '#fff', borderRadius: '50%', fontSize: 9, width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {tareasBadge > 9 ? '9+' : tareasBadge}
                </span>
              )}
            </NavLink>
          )}

          {/* Secciones: botón de color sólido sobre crema */}
          {SECTIONS.map(section => {
            const visibleItems = filterItems(section.items)
            if (!section.perfiles.includes(perfil) || visibleItems.length === 0) return null
            const isOpen        = openSections.includes(section.key)
            const IconComponent = SECTION_ICONS[section.key]?.icon
            const sectionBg     = SECTION_BG[section.key] ?? '#444'

            return (
              <div key={section.key} style={{ margin: collapsed ? 0 : '0 8px 8px' }}>
                {collapsed ? (
                  <button type="button" onClick={() => toggleSection(section.key)} title={section.label}
                    style={{ width: '100%', height: 44, background: sectionBg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {IconComponent ? <IconComponent size={20} strokeWidth={1.8} color="#fff" /> : <span style={{ color: '#fff' }}>{section.emoji}</span>}
                  </button>
                ) : (
                  <button type="button" onClick={() => toggleSection(section.key)}
                    style={{
                      width: '100%', background: sectionBg, border: `2px solid ${INK}`, borderRadius: 8, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px 10px 12px',
                      fontFamily: FONT.heading, fontSize: 14.5, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {IconComponent ? <IconComponent size={18} strokeWidth={1.8} color="#fff" /> : <span style={{ fontSize: 14 }}>{section.emoji}</span>}
                      <span>{section.label}</span>
                    </div>
                    <span style={{ fontSize: 14, transition: 'transform 300ms', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', color: '#fff' }}>›</span>
                  </button>
                )}

                {!collapsed && (
                  <div style={{ maxHeight: isOpen ? `${visibleItems.length * 38 + 8}px` : 0, overflow: 'hidden', transition: 'max-height 300ms ease', background: '#fff', border: isOpen ? `2px solid ${INK}` : 'none', borderTop: 'none', borderRadius: isOpen ? '0 0 8px 8px' : 0, marginTop: isOpen ? -2 : 0 }}>
                    {visibleItems.map((item, idx) => (
                      <NavLink key={`${item.path}-${idx}`} to={item.path} end onClick={onClose}
                        style={({ isActive }) => ({
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 10px 7px 18px',
                          background: isActive ? '#B01D23' : 'transparent',
                          color: isActive ? '#fff' : INK,
                          textDecoration: 'none', cursor: 'pointer',
                          fontFamily: FONT.body, fontSize: 14, fontWeight: 500,
                          borderBottom: idx < visibleItems.length - 1 ? `1px solid ${INK}1a` : 'none',
                          whiteSpace: 'nowrap', overflow: 'hidden',
                        })}
                      >
                        {({ isActive }) => (
                          <>
                            <span style={{ fontSize: 13, flexShrink: 0 }}>{item.emoji}</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', color: isActive ? '#fff' : INK }}>{item.label}</span>
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
            <div style={{ margin: '4px 8px 0' }}>
              <button type="button" onClick={() => setProxOpen(o => !o)}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 10px 12px', fontFamily: FONT.heading, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a8f78', transition: 'color 200ms' }}
                title="Funciones en desarrollo"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={16} strokeWidth={1.8} color="#9a8f78" />
                  <span>Próximamente</span>
                </div>
                <span style={{ fontSize: 11, transition: 'transform 300ms', transform: proxOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>›</span>
              </button>
              <div style={{ maxHeight: proxOpen ? `${PROXIMAMENTE.length * 30 + 8}px` : 0, overflow: 'hidden', transition: 'max-height 400ms ease' }}>
                {PROXIMAMENTE.map((item, idx) => (
                  <div key={`${item.label}-${idx}`} aria-disabled="true"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px 5px 18px', borderRadius: 4, fontFamily: FONT.body, fontSize: 12.5, color: '#9a8f78', opacity: 0.6, cursor: 'not-allowed', userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    <span style={{ fontSize: 12, flexShrink: 0 }}>{item.emoji}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* ── FOOTER (crema) ── */}
        <div style={{ background: CREMA, padding: collapsed ? '8px' : '10px 12px', borderTop: `2px solid ${INK}`, display: 'flex', justifyContent: 'center' }}>
          <ThemeToggle />
        </div>
        <div style={{ background: CREMA, padding: 12, borderTop: `1px solid ${INK}22`, fontFamily: FONT.body, fontSize: 12, color: '#444', textAlign: collapsed ? 'center' : 'left' }}>
          {!collapsed ? (
            <>
              <div style={{ marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {usuario?.nombre} — <span style={{ color: '#B01D23' }}>{usuario?.perfil}</span>
              </div>
              <button onClick={logout} style={{ color: '#666', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>Cerrar sesión</button>
            </>
          ) : (
            <button onClick={logout} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }} title="Cerrar sesión">⏏</button>
          )}
        </div>
      </aside>
    </>
  )
}
