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
import { supabase } from '@/lib/supabase'
import SidebarBadge from '@/components/ui/SidebarBadge'
import { useEsMovil } from '@/hooks/useEsMovil'

// ── tokens neobrutal · sidebar oscuro canónico Streat Lab ──
const INK = '#0a0a0a'
const DARK = '#1e2233'      // fondo sidebar (canónico)
const DARK2 = '#2b3148'     // cabeceras de sección / botones inactivos
const DARK3 = '#161a28'     // caja de items abierta
const ROSA = '#FF2E63'      // acento activo (rosa de las comisiones)
const ROJO = '#B01D23'      // marca (cabecera logo)
const TXT = '#ece8dc'       // texto claro sobre oscuro
const TXT_MUT = '#8b90a3'
const SHADOW = `4px 4px 0 ${INK}`   // sombra única en todo el ERP
const OSW = 'Oswald, sans-serif'
const LEX = 'Lexend, sans-serif'

interface NavItem {
  path: string
  label: string
  emoji: string
  perfiles: string[]
}

interface NavSection {
  key: string
  emoji: string
  label: string
  perfiles: string[]
  items: NavItem[]
}

interface SectionIconConfig {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>
  color: string
}

// Orden: Panel Global, Tareas, Finanzas, Cocina, Operaciones,
// Stock & Compras, Informes, Equipo, MKT, Configuración.
// Panel Global y Tareas son enlaces directos (fuera de SECTIONS).
const SECTIONS: NavSection[] = [
  {
    key: 'finanzas', emoji: '📈', label: 'Finanzas', perfiles: ['admin'],
    items: [
      { path: '/finanzas/documentacion',        label: 'Documentación',       emoji: '📥', perfiles: ['admin'] },
      { path: '/facturacion',                   label: 'Facturación',         emoji: '🧾', perfiles: ['admin'] },
      { path: '/finanzas/ventas',               label: 'Ventas',              emoji: '💰', perfiles: ['admin'] },
      { path: '/finanzas/objetivos',            label: 'Objetivos',           emoji: '🎯', perfiles: ['admin'] },
      { path: '/finanzas/punto-equilibrio',     label: 'Punto de Equilibrio', emoji: '⚖️', perfiles: ['admin'] },
      { path: '/finanzas/running',              label: 'Running',             emoji: '📊', perfiles: ['admin'] },
      { path: '/finanzas/pagos-cobros',         label: 'Pagos y Cobros',      emoji: '💳', perfiles: ['admin'] },
      { path: '/finanzas/verifactu',            label: 'Verifactu',           emoji: '✅', perfiles: ['admin'] },
      { path: '/finanzas/escenarios-tesoreria', label: 'Escenarios Tesorería',emoji: '🔮', perfiles: ['admin'] },
    ],
  },
  {
    key: 'cocina', emoji: '🍳', label: 'Cocina', perfiles: ['admin', 'cocina'],
    items: [
      { path: '/escandallo',              label: 'Escandallo',           emoji: '⚖️', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/lista-compra',     label: 'Lista de Compra',      emoji: '🛒', perfiles: ['admin', 'cocina'] },
      { path: '/carta',                   label: 'Carta',                emoji: '🍽️', perfiles: ['admin'] },
      { path: '/cocina/menu-engineering', label: 'Menú Engineering',     emoji: '⚙️', perfiles: ['admin'] },
      { path: '/cocina/pareto-ingredientes', label: 'Pareto Ingredientes', emoji: '🥕', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/recetario',        label: 'Recetario',            emoji: '📋', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/produccion',       label: 'Producción',           emoji: '📋', perfiles: ['admin', 'cocina'] },
    ],
  },
  {
    key: 'operaciones', emoji: '🛠️', label: 'Operaciones', perfiles: ['admin'],
    items: [
      { path: '/ops/checklists',          label: 'Checklists',           emoji: '✅', perfiles: ['admin'] },
      { path: '/ops/tareas',              label: 'Tareas',               emoji: '📝', perfiles: ['admin'] },
      { path: '/ops/manuales',            label: 'Manuales',             emoji: '📚', perfiles: ['admin'] },
      { path: '/ops/reembolsos',          label: 'Reclamaciones',        emoji: '💸', perfiles: ['admin'] },
      { path: '/ops/pulso',               label: 'Pulso Cocina',         emoji: '📡', perfiles: ['admin'] },
      { path: '/ops/temperaturas',        label: 'Temperaturas',         emoji: '🌡️', perfiles: ['admin'] },
      { path: '/ops/bpm',                 label: 'BPM / Calidad',        emoji: '✅', perfiles: ['admin'] },
      { path: '/ops/equipos',             label: 'Libro Equipos',        emoji: '🔧', perfiles: ['admin'] },
      { path: '/ops/danos',               label: 'Daños Menaje',         emoji: '🍽️', perfiles: ['admin'] },
      { path: '/ops/pedidos-menaje',      label: 'Pedidos Menaje',       emoji: '📦', perfiles: ['admin'] },
      { path: '/ops/bitacora',            label: 'Bitácora',             emoji: '🔔', perfiles: ['admin'] },
      { path: '/ops/reuniones',           label: 'Reuniones Equipo',     emoji: '🤝', perfiles: ['admin'] },
      { path: '/marcas',                  label: 'Marcas',               emoji: '🏷️', perfiles: ['admin'] },
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
      { path: '/clientes/resenas',     label: 'Panel Reseñas',         emoji: '⭐', perfiles: ['admin'] },
      { path: '/clientes/playbook-tp', label: 'Playbook ThinkPaladar', emoji: '📣', perfiles: ['admin'] },
    ],
  },
  {
    key: 'configuracion', emoji: '⚙️', label: 'Configuración', perfiles: ['admin'],
    items: [
      { path: '/configuracion/integraciones',    label: 'Integraciones',        emoji: '🔌', perfiles: ['admin'] },
      { path: '/configuracion/reglas',           label: 'Reglas',               emoji: '📐', perfiles: ['admin'] },
      { path: '/configuracion/bancos-y-cuentas', label: 'Bancos y Cuentas',     emoji: '🏦', perfiles: ['admin'] },
      { path: '/configuracion/usuarios',         label: 'Usuarios',             emoji: '👤', perfiles: ['admin'] },
      { path: '/configuracion/calendario',       label: 'Calendario operativo', emoji: '📅', perfiles: ['admin'] },
      { path: '/configuracion/aprendizajes',     label: 'Aprendizajes ERP',     emoji: '🧠', perfiles: ['admin'] },
      { path: '/configuracion/calcneto-aprendizaje', label: 'Ajuste calcNeto',  emoji: '⚖️', perfiles: ['admin'] },
    ],
  },
]

const PROXIMAMENTE: { label: string; emoji: string }[] = [
  { label: 'Revenue & Ticket',             emoji: '🎫' },
  { label: 'Predicción Demanda',           emoji: '🔮' },
  { label: 'Tesorería',                    emoji: '💳' },
  { label: 'Control Temperaturas',         emoji: '🌡️' },
  { label: 'BPM / Calidad',                emoji: '✅' },
  { label: 'Daños Material',               emoji: '🔧' },
  { label: 'Novedades',                    emoji: '🔔' },
  { label: 'Mantenimiento Equipos',        emoji: '🔧' },
  { label: 'Almacén',                      emoji: '🏭' },
  { label: 'Stock Mínimo Alertas',         emoji: '⚠️' },
  { label: 'Movimientos Stock',            emoji: '🔄' },
  { label: 'Pedidos a Proveedores',        emoji: '🛒' },
  { label: 'Pedidos de Artículos',         emoji: '📦' },
  { label: 'Albaranes',                    emoji: '📄' },
  { label: 'POS',                          emoji: '🖥️' },
  { label: 'Pedidos en Curso',             emoji: '⏳' },
  { label: 'Fichas Empleados',             emoji: '👤' },
  { label: 'Evaluaciones',                 emoji: '⭐' },
  { label: 'Llamados Atención',            emoji: '⚠️' },
  { label: 'Beneficios Antigüedad',        emoji: '🎁' },
  { label: 'Celebraciones',               emoji: '🎉' },
  { label: 'Onboarding Digital',           emoji: '🚀' },
  { label: 'Mis Ventas / Mis Metas',       emoji: '🏅' },
  { label: 'Calendario',                   emoji: '📅' },
  { label: 'Mensajería Interna',           emoji: '💬' },
  { label: 'Novedades Equipo',             emoji: '📢' },
  { label: 'Reuniones Equipo',             emoji: '🤝' },
  { label: 'Recursos Humanos',             emoji: '👥' },
  { label: 'Project Management',           emoji: '📊' },
  { label: 'Kanban',                       emoji: '📋' },
  { label: 'Club Fidelización',            emoji: '🎖️' },
  { label: 'CRM Tienda Propia',            emoji: '🛍️' },
  { label: 'Panel Reseñas',                emoji: '⭐' },
  { label: 'Quejas',                       emoji: '😡' },
  { label: 'Clientes',                     emoji: '👥' },
  { label: 'Ficha Cliente',                emoji: '👤' },
  { label: 'Envío WhatsApp',               emoji: '💬' },
  { label: 'Envío Email',                  emoji: '📧' },
  { label: 'Oportunidades',               emoji: '💡' },
  { label: 'Top Clientes Facturación',     emoji: '🏆' },
  { label: 'Tienda en Línea',              emoji: '🛒' },
  { label: 'Ventas por Hora',              emoji: '🕐' },
  { label: 'Ventas por Familia',           emoji: '🗂️' },
  { label: 'Ventas por Canal',             emoji: '📡' },
  { label: 'Consumo Platos',               emoji: '🍽️' },
  { label: 'Comparativa Año',              emoji: '📅' },
  { label: 'Ventas Marca',                 emoji: '🏷️' },
  { label: 'Margen Canal',                 emoji: '📡' },
  { label: 'COGS Coste MP',                emoji: '🧾' },
  { label: 'Ranking Productos',            emoji: '🏆' },
  { label: 'Panel Favoritos',              emoji: '⭐' },
  { label: 'Búsqueda Avanzada',            emoji: '🔎' },
  { label: 'Ranking Marcas',               emoji: '📊' },
  { label: 'Ranking Canales',              emoji: '📡' },
  { label: 'Alérgenos',                    emoji: '🥜' },
  { label: 'Alertas Caducidad',            emoji: '⏰' },
  { label: 'Automatización Impuestos',     emoji: '🧾' },
  { label: 'BI / Informes Avanzados',      emoji: '📈' },
  { label: 'Caja',                         emoji: '💵' },
  { label: 'Combos y Promociones',         emoji: '🎁' },
  { label: 'Control Mermas',               emoji: '📉' },
  { label: 'Control Presencia / Fichaje',  emoji: '🕒' },
  { label: 'Email Marketing',              emoji: '✉️' },
  { label: 'Estadísticas Horas Punta',     emoji: '📊' },
  { label: 'Exportación a Gestoría',       emoji: '📤' },
  { label: 'Gestión Clientes',             emoji: '👥' },
  { label: 'Gestión Impuestos',            emoji: '🧮' },
  { label: 'Menús Dinámicos',              emoji: '🍴' },
  { label: 'Gestión Pedidos',              emoji: '🧾' },
  { label: 'Stock e Inventario',           emoji: '📦' },
  { label: 'Informes Financieros',         emoji: '💼' },
  { label: 'Informes de Ventas',           emoji: '📑' },
  { label: 'Integración Delivery',         emoji: '🛵' },
  { label: 'Inventario Tiempo Real',       emoji: '📡' },
  { label: 'Marketing Automation',         emoji: '🤖' },
  { label: 'Notificaciones Empleados',     emoji: '🔔' },
  { label: 'Pagos Proveedores Auto',       emoji: '💸' },
  { label: 'Panel KPIs Global',            emoji: '📊' },
  { label: 'Planificación Turnos',         emoji: '🗓️' },
  { label: 'Pop-ups y Dark Kitchens',      emoji: '🏪' },
  { label: 'Predicción Plantilla',         emoji: '👥' },
  { label: 'Promociones por Día/Hora',     emoji: '⏰' },
]

const SECTION_ICONS: Record<string, SectionIconConfig> = {
  finanzas:      { icon: TrendingUp,    color: '#2ee88f' },
  cocina:        { icon: ChefHat,       color: '#ffb43d' },
  operaciones:   { icon: ClipboardList, color: '#f5d23d' },
  stock:         { icon: ShoppingCart,  color: '#ff5a6a' },
  informes:      { icon: FileText,      color: '#f5d23d' },
  equipo:        { icon: Users,         color: '#6db3ff' },
  mkt:           { icon: Megaphone,     color: '#ff5a6a' },
  configuracion: { icon: Settings,      color: '#b6bdd4' },
}

const PROXIMAMENTE_LS_KEY = 'streatlab.sidebar.proximamente.open'
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
  const perfil = usuario?.perfil ?? ''
  const esMovilDisp = useEsMovil()

  const [openSections, setOpenSections] = useState<string[]>(() => loadOpenSections())
  const [proxOpen, setProxOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(PROXIMAMENTE_LS_KEY) === '1'
  })
  const [tareasBadge, setTareasBadge] = useState(0)
  const [ocrBadge, setOcrBadge] = useState(0)

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

  // ── Mecánica de colapso/expansión (persistente: se mantiene 5 min tras la última interacción) ──
  const [pinned, setPinned] = useState(false)
  const [peek, setPeek] = useState(false)
  const pinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const PIN_MS = 300000

  const pin = () => {
    setPinned(true)
    if (pinTimer.current) clearTimeout(pinTimer.current)
    pinTimer.current = setTimeout(() => setPinned(false), PIN_MS)
  }
  const unpin = () => {
    if (pinTimer.current) { clearTimeout(pinTimer.current); pinTimer.current = null }
    setPinned(false)
    setPeek(false)
  }

  useEffect(() => {
    pin()
    return () => { if (pinTimer.current) clearTimeout(pinTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const collapsed = esMovilDisp ? false : (!pinned && !peek)

  // Máximo 2 secciones abiertas a la vez; abrir una 3ª cierra la primera que se abrió (FIFO).
  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      if (prev.includes(key)) return prev.filter(s => s !== key)
      const next = [...prev, key]
      if (next.length > 2) next.shift()
      return next
    })
  }

  const filterItems = (items: NavItem[]) => items.filter(i => i.perfiles.includes(perfil))
  const sidebarWidth = collapsed ? 58 : 230

  // botón directo (Panel Global / Tareas)
  const directLink = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    margin: '8px 8px',
    padding: '11px 13px',
    border: `3px solid ${INK}`,
    borderRadius: 0,
    background: isActive ? ROSA : DARK2,
    color: isActive ? '#fff' : TXT,
    boxShadow: isActive ? SHADOW : 'none',
    fontFamily: OSW,
    fontSize: 15,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    textDecoration: 'none',
    cursor: 'pointer',
  })

  // botón cuadrado colapsado (40x40, sombra única — homogéneo con el toggle sol/luna)
  const collapsedBtn = (isActive: boolean): React.CSSProperties => ({
    margin: '10px auto',
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    position: 'relative',
    border: `3px solid ${INK}`,
    background: isActive ? ROSA : DARK2,
    boxShadow: SHADOW,
    cursor: 'pointer',
  })

  // item dentro de la caja de sección
  const itemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderTop: `1px solid rgba(255,255,255,0.07)`,
    borderLeft: isActive ? `5px solid ${INK}` : '5px solid transparent',
    fontFamily: OSW,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: isActive ? '#fff' : TXT,
    background: isActive ? ROSA : 'transparent',
    textDecoration: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
  })

  return (
    <>
      <style>{`
        .sl-noscroll::-webkit-scrollbar { width: 0; height: 0; display: none; }
        .sl-noscroll { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>

      {open && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={onClose} />}

      <aside
        onMouseEnter={() => setPeek(true)}
        onMouseLeave={() => setPeek(false)}
        onClick={pin}
        style={{ background: DARK, borderRadius: 0, borderRight: `4px solid ${INK}`, width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
        className={`
          fixed top-0 left-0 z-40 h-full
          flex flex-col transition-all duration-[250ms] ease-[ease] overflow-hidden
          md:translate-x-0 md:static md:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {collapsed ? (
          <div style={{ background: ROJO, borderBottom: `4px solid ${INK}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 66, padding: '6px 0', gap: 4 }}>
            <img src="/data/logo-icon.svg" alt="Streat Lab" style={{ height: 28, width: 'auto', display: 'block', filter: 'brightness(0) invert(1)' }} crossOrigin="anonymous" />
            <button onClick={(e) => { e.stopPropagation(); pin() }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 36 }} title="Abrir">
              <ChevronRight size={18} color="#ffffff" strokeWidth={3} />
            </button>
          </div>
        ) : (
          <div style={{ background: ROJO, padding: '14px 14px', borderBottom: `4px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 66 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
              <img src="/data/logo-icon.svg" alt="Streat Lab" style={{ height: 34, width: 'auto', display: 'block', flexShrink: 0, filter: 'brightness(0) invert(1)' }} crossOrigin="anonymous" />
              <span style={{ fontFamily: OSW, fontSize: 19, color: '#ffffff', letterSpacing: '3px', fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>STREAT LAB</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); unpin() }} style={{ color: '#ffffff', background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }} className="hidden md:flex" title="Colapsar">«</button>
          </div>
        )}

        <nav className="flex-1 py-2 sl-noscroll" style={{ overflowY: 'auto', overflowX: 'hidden' }}>

          {(!collapsed && perfil && ['admin', 'cocina'].includes(perfil)) && (
            <NavLink to="/" end onClick={onClose} style={({ isActive }) => directLink(isActive)}>
              {({ isActive }) => (
                <>
                  <LayoutDashboard size={19} strokeWidth={2.4} color={isActive ? '#fff' : ROSA} style={{ flexShrink: 0 }} />
                  <span>Panel Global</span>
                </>
              )}
            </NavLink>
          )}

          {collapsed && perfil && ['admin', 'cocina'].includes(perfil) && (
            <NavLink to="/" end onClick={onClose} title="Panel Global" style={({ isActive }) => collapsedBtn(isActive)}>
              {({ isActive }) => <LayoutDashboard size={20} strokeWidth={2.4} color={isActive ? '#fff' : ROSA} />}
            </NavLink>
          )}

          {(!collapsed && perfil === 'admin') && (
            <NavLink to="/tareas" onClick={onClose} style={({ isActive }) => directLink(isActive)}>
              {({ isActive }) => (
                <>
                  <BellRing size={19} strokeWidth={2.4} color={isActive ? '#fff' : ROSA} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Tareas</span>
                  <SidebarBadge count={tareasBadge} />
                </>
              )}
            </NavLink>
          )}

          {collapsed && perfil === 'admin' && (
            <NavLink to="/tareas" onClick={onClose} title="Tareas pendientes" style={({ isActive }) => collapsedBtn(isActive)}>
              {({ isActive }) => (
                <>
                  <BellRing size={20} strokeWidth={2.4} color={isActive ? '#fff' : ROSA} />
                  {tareasBadge > 0 && (
                    <span style={{ position: 'absolute', top: -8, right: -8, background: ROSA, color: '#fff', border: `2px solid ${INK}`, fontSize: 9, minWidth: 16, height: 16, padding: '0 3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: OSW }}>
                      {tareasBadge > 9 ? '9+' : tareasBadge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )}

          {SECTIONS.map(section => {
            const visibleItems = filterItems(section.items)
            if (!section.perfiles.includes(perfil) || visibleItems.length === 0) return null
            const isOpen = openSections.includes(section.key)
            const IconComponent = SECTION_ICONS[section.key]?.icon
            const iconColor = SECTION_ICONS[section.key]?.color || '#888'

            return (
              <div key={section.key}>
                {collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    title={section.label}
                    style={{ ...collapsedBtn(false), background: isOpen ? ROSA : DARK2 }}
                  >
                    {IconComponent ? <IconComponent size={20} strokeWidth={2.2} color={isOpen ? '#fff' : iconColor} /> : <span>{section.emoji}</span>}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    style={{
                      width: 'auto', margin: '7px 8px 0', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                      padding: '10px 12px',
                      border: `3px solid ${INK}`,
                      background: isOpen ? ROSA : DARK2,
                      boxShadow: isOpen ? SHADOW : 'none',
                      fontFamily: OSW, fontSize: 14.5, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      color: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
                      {IconComponent ? <IconComponent size={18} strokeWidth={2.4} color={isOpen ? '#fff' : iconColor} /> : <span style={{ fontSize: 14 }}>{section.emoji}</span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{section.label}</span>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 800, transition: 'transform 300ms', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', flexShrink: 0, marginLeft: 10 }}>›</span>
                  </button>
                )}

                {!collapsed && (
                  <div style={{ maxHeight: isOpen ? `${visibleItems.length * 40 + 4}px` : 0, overflow: 'hidden', transition: 'max-height 300ms ease', margin: '0 8px', border: isOpen ? `3px solid ${INK}` : 'none', borderTop: 'none', background: DARK3 }}>
                    {visibleItems.map((item, idx) => {
                      return (
                        <NavLink key={`${item.path}-${idx}`} to={item.path} end onClick={onClose} style={({ isActive }) => itemStyle(isActive)}>
                          {({ isActive }) => (
                            <>
                              <span style={{ width: 8, height: 8, flexShrink: 0, background: isActive ? '#fff' : iconColor, border: `1px solid ${isActive ? INK : 'rgba(0,0,0,0.4)'}` }} />
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                              {item.path === '/finanzas/documentacion' && <SidebarBadge count={ocrBadge} />}
                            </>
                          )}
                        </NavLink>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {!collapsed && perfil === 'admin' && (
            <SidebarProximamente isOpen={proxOpen} onToggle={() => setProxOpen(o => !o)} />
          )}
        </nav>

        <div style={{ padding: collapsed ? '8px' : '12px', borderTop: `4px solid ${INK}`, display: 'flex', justifyContent: 'center', background: DARK }}>
          <ThemeToggle />
        </div>

        <div style={{ padding: 12, borderTop: `3px solid ${INK}`, background: DARK, fontFamily: LEX, fontSize: 12, color: TXT, textAlign: collapsed ? 'center' : 'left' }}>
          {!collapsed ? (
            <>
              <div style={{ marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TXT, fontWeight: 600 }}>
                {usuario?.nombre} — <span style={{ color: ROSA, fontFamily: OSW, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{usuario?.perfil}</span>
              </div>
              <button onClick={logout} style={{ color: TXT, fontSize: 12, background: DARK2, border: `2px solid ${INK}`, padding: '5px 12px', cursor: 'pointer', fontFamily: OSW, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>Cerrar sesión</button>
            </>
          ) : (
            <button onClick={logout} style={{ color: TXT, background: DARK2, border: `2px solid ${INK}`, cursor: 'pointer', fontSize: 14, width: 36, height: 36 }} title="Cerrar sesión">⏏</button>
          )}
        </div>
      </aside>
    </>
  )
}

function SidebarProximamente({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <div style={{ marginTop: 7 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: 'auto', margin: '0 8px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '10px 12px',
          border: `3px solid ${INK}`,
          background: isOpen ? DARK2 : DARK3,
          fontFamily: OSW, fontSize: 12.5, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          color: TXT_MUT,
        }}
        title="Funciones en desarrollo"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
          <Clock size={16} strokeWidth={2.4} color={TXT_MUT} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Próximamente</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, transition: 'transform 300ms', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', flexShrink: 0, marginLeft: 10 }}>›</span>
      </button>
      <div
        style={{
          maxHeight: isOpen ? `${PROXIMAMENTE.length * 32 + 8}px` : 0,
          overflow: 'hidden', transition: 'max-height 400ms ease',
          margin: '0 8px',
          border: isOpen ? `3px solid ${INK}` : 'none', borderTop: 'none', background: DARK3,
        }}
      >
        {PROXIMAMENTE.map((item, idx) => (
          <div
            key={`${item.label}-${idx}`}
            onClick={e => e.preventDefault()}
            title="En desarrollo — próximamente"
            aria-disabled="true"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 10px 7px 14px',
              borderTop: `1px solid rgba(255,255,255,0.06)`,
              fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
              color: TXT_MUT, opacity: 0.6,
              cursor: 'not-allowed', userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden',
            }}
          >
            <span style={{ width: 7, height: 7, flexShrink: 0, background: TXT_MUT }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
