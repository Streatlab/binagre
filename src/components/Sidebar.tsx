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

// Orden solicitado: Panel Global, Tareas, Finanzas, Cocina, Operaciones,
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
      { path: '/cocina/esquemas',         label: 'Esquemas',             emoji: '🗂️', perfiles: ['admin', 'cocina'] },
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
      { path: '/clientes/crm',    label: 'CRM Streat Lab',   emoji: '🛍️', perfiles: ['admin'] },
      { path: '/clientes/club',   label: 'Club Fidelización', emoji: '🎖️', perfiles: ['admin'] },
      { path: '/clientes/resenas',label: 'Panel Reseñas',     emoji: '⭐', perfiles: ['admin'] },
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
  finanzas:      { icon: TrendingUp,    color: '#06C167' },
  cocina:        { icon: ChefHat,       color: '#f5a623' },
  operaciones:   { icon: ClipboardList, color: '#e8b341' },
  stock:         { icon: ShoppingCart,  color: '#B01D23' },
  informes:      { icon: FileText,      color: '#e8b341' },
  equipo:        { icon: Users,         color: '#66aaff' },
  mkt:           { icon: Megaphone,     color: '#B01D23' },
  configuracion: { icon: Settings,      color: '#9ba8c0' },
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
  const { T, isDark } = useTheme()
  const perfil = usuario?.perfil ?? ''
  const esMovilDisp = useEsMovil()

  const activeTextColor = '#ffffff'
  const hoverBg = isDark ? T.card : T.group

  const mainLabelColor = isDark ? T.pri : '#15192a'

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

  // ── Mecánica de colapso/expansión ────────────────────────────────────────
  // Estado de reposo: COLAPSADO (solo iconos).
  // CLIC en cualquier opción/grupo del sidebar → "fijado" abierto 20 s exactos,
  //   independientemente de dónde esté el ratón; pasados los 20 s se colapsa solo.
  // HOVER (ratón encima) → se abre mientras el ratón está encima; al salir se colapsa
  //   (salvo que esté fijado por un clic reciente).
  const [pinned, setPinned] = useState(false)
  const [peek, setPeek] = useState(false)
  const pinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const PIN_MS = 20000

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

  // Al cargar: se muestra fijado 20 s y luego se colapsa solo.
  useEffect(() => {
    pin()
    return () => { if (pinTimer.current) clearTimeout(pinTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Colapsado salvo que esté fijado por clic o que el ratón esté encima.
  // En móvil (táctil): SIEMPRE expandido, sin rail de iconos ni timer de 20 s.
  const collapsed = esMovilDisp ? false : (!pinned && !peek)

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

  const itemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '4px 10px 4px 14px',
    margin: '1px 8px',
    borderRadius: 6,
    fontFamily: FONT.body,
    fontSize: 15,
    fontWeight: 500,
    color: isActive ? activeTextColor : T.pri,
    background: isActive ? '#B01D23' : 'transparent',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'background 150ms',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
  })

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={onClose} />}

      <aside
        onMouseEnter={() => setPeek(true)}
        onMouseLeave={() => setPeek(false)}
        onClick={pin}
        style={{ background: T.group, borderRadius: 16, width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
        className={`
          fixed top-0 left-0 z-40 h-full border-r border-[var(--sl-border)]
          flex flex-col transition-all duration-[250ms] ease-[ease] overflow-hidden
          md:translate-x-0 md:static md:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {collapsed ? (
          <div style={{ borderBottom: `1px solid ${T.brd}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 64, padding: '6px 0', gap: 4 }}>
            <img src="/data/logo-icon.svg" alt="Streat Lab" style={{ height: 28, width: 'auto', display: 'block', filter: 'none' }} crossOrigin="anonymous" />
            <button onClick={(e) => { e.stopPropagation(); pin() }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 }} title="Abrir">
              <ChevronRight size={18} color="#B01D23" />
            </button>
          </div>
        ) : (
          <div style={{ padding: 12, borderBottom: `1px solid ${T.brd}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <img src="/data/logo-icon.svg" alt="Streat Lab" style={{ height: 32, width: 'auto', display: 'block', flexShrink: 0, filter: 'none' }} crossOrigin="anonymous" />
              <span style={{ fontFamily: FONT.heading, fontSize: 14, color: '#B01D23', letterSpacing: '2px', fontWeight: 600, whiteSpace: 'nowrap' }}>STREAT LAB</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); unpin() }} style={{ color: T.mut, background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="hover:text-[var(--sl-text-primary)] transition-colors hidden md:flex" title="Colapsar">«</button>
          </div>
        )}

        <nav className="flex-1 py-2 overflow-y-auto" style={{ overflowX: 'hidden' }}>

          {(!collapsed && perfil && ['admin', 'cocina'].includes(perfil)) && (
            <NavLink
              to="/"
              end
              onClick={onClose}
              style={({ isActive }) => ({
                width: '100%',
                background: isActive ? '#B01D23' : 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 10,
                padding: '6px 14px 6px 12px',
                fontFamily: FONT.heading,
                fontSize: 14.5,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: isActive ? '#ffffff' : mainLabelColor,
                textDecoration: 'none',
                transition: 'background 150ms',
              })}
            >
              {({ isActive }) => (
                <>
                  <LayoutDashboard size={18} strokeWidth={1.8} color={isActive ? '#ffffff' : '#B01D23'} style={{ flexShrink: 0 }} />
                  <span>Panel Global</span>
                </>
              )}
            </NavLink>
          )}

          {collapsed && perfil && ['admin', 'cocina'].includes(perfil) && (
            <NavLink
              to="/"
              end
              onClick={onClose}
              title="Panel Global"
              style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
            >
              <LayoutDashboard size={20} strokeWidth={1.8} color="#B01D23" />
            </NavLink>
          )}

          {(!collapsed && perfil === 'admin') && (
            <NavLink
              to="/tareas"
              onClick={onClose}
              style={({ isActive }) => ({
                width: '100%',
                background: isActive ? '#B01D23' : 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 10,
                padding: '6px 14px 6px 12px',
                fontFamily: FONT.heading,
                fontSize: 14.5,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: isActive ? '#ffffff' : mainLabelColor,
                textDecoration: 'none',
                transition: 'background 150ms',
              })}
            >
              {({ isActive }) => (
                <>
                  <BellRing size={18} strokeWidth={1.8} color={isActive ? '#ffffff' : '#B01D23'} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Tareas</span>
                  <SidebarBadge count={tareasBadge} />
                </>
              )}
            </NavLink>
          )}

          {collapsed && perfil === 'admin' && (
            <NavLink
              to="/tareas"
              onClick={onClose}
              title="Tareas pendientes"
              style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', position: 'relative' }}
            >
              <BellRing size={20} strokeWidth={1.8} color="#B01D23" />
              {tareasBadge > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 8, background: '#B01D23', color: '#fff', borderRadius: '50%', fontSize: 9, width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {tareasBadge > 9 ? '9+' : tareasBadge}
                </span>
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
                    style={{
                      width: '100%', height: 44, background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {IconComponent ? <IconComponent size={20} strokeWidth={1.8} color={iconColor} /> : <span>{section.emoji}</span>}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 14px 6px 12px',
                      fontFamily: FONT.heading, fontSize: 14.5, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      color: mainLabelColor,
                      transition: 'color 200ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {IconComponent ? <IconComponent size={18} strokeWidth={1.8} color={iconColor} /> : <span style={{ fontSize: 14 }}>{section.emoji}</span>}
                      <span>{section.label}</span>
                    </div>
                    <span style={{ fontSize: 11, transition: 'transform 300ms', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>›</span>
                  </button>
                )}

                {!collapsed && (
                  <div style={{ maxHeight: isOpen ? `${visibleItems.length * 42}px` : 0, overflow: 'hidden', transition: 'max-height 300ms ease' }}>
                    {visibleItems.map((item, idx) => {
                      return (
                        <NavLink
                          key={`${item.path}-${idx}`}
                          to={item.path}
                          end
                          onClick={onClose}
                          style={({ isActive }) => itemStyle(isActive)}
                          className={({ isActive }) => isActive ? '' : `hover:!bg-[${hoverBg}] hover:!text-[${T.pri}]`}
                        >
                          {({ isActive }) => (
                            <>
                              <span style={{ fontSize: 14, flexShrink: 0 }}>{item.emoji}</span>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isActive ? activeTextColor : T.pri }}>{item.label}</span>
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
            <SidebarProximamente isOpen={proxOpen} onToggle={() => setProxOpen(o => !o)} T={T} />
          )}
        </nav>

        <div style={{ padding: collapsed ? '8px' : '12px', borderTop: `1px solid ${T.brd}`, display: 'flex', justifyContent: 'center' }}>
          <ThemeToggle />
        </div>

        <div style={{ padding: 12, borderTop: `1px solid ${T.brd}`, fontFamily: FONT.body, fontSize: 12, color: T.mut, textAlign: collapsed ? 'center' : 'left' }}>
          {!collapsed ? (
            <>
              <div style={{ marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.sec }}>
                {usuario?.nombre} — <span style={{ color: '#B01D23' }}>{usuario?.perfil}</span>
              </div>
              <button onClick={logout} style={{ color: T.mut, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>Cerrar sesión</button>
            </>
          ) : (
            <button onClick={logout} style={{ color: T.mut, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }} title="Cerrar sesión">⏏</button>
          )}
        </div>
      </aside>
    </>
  )
}

function SidebarProximamente({ isOpen, onToggle, T }: { isOpen: boolean; onToggle: () => void; T: ReturnType<typeof useTheme>['T'] }) {
  return (
    <div style={{ marginTop: 4 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px 10px 12px',
          fontFamily: FONT.heading, fontSize: 12,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          color: isOpen ? T.pri : T.mut,
          transition: 'color 200ms',
        }}
        title="Funciones en desarrollo"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={16} strokeWidth={1.8} color={T.mut} />
          <span>Próximamente</span>
        </div>
        <span style={{ fontSize: 11, transition: 'transform 300ms', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>›</span>
      </button>
      <div
        style={{
          maxHeight: isOpen ? `${PROXIMAMENTE.length * 32 + 8}px` : 0,
          overflow: 'hidden', transition: 'max-height 400ms ease',
        }}
      >
        {PROXIMAMENTE.map((item, idx) => (
          <div
            key={`${item.label}-${idx}`}
            onClick={e => e.preventDefault()}
            title="En desarrollo — próximamente"
            aria-disabled="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px 6px 24px',
              margin: '0 8px',
              borderRadius: 4,
              fontFamily: FONT.body,
              fontSize: 12.5,
              color: T.mut,
              opacity: 0.5,
              cursor: 'not-allowed',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <span style={{ fontSize: 12, flexShrink: 0 }}>{item.emoji}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
