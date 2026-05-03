import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useSidebarState } from '@/hooks/useSidebarState'
import { ThemeToggle } from './ThemeToggle'
import { useTheme, FONT } from '@/styles/tokens'
import { supabase } from '@/lib/supabase'
import SidebarBadge from '@/components/ui/SidebarBadge'

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

const SECTIONS: NavSection[] = [
  {
    key: 'finanzas', emoji: '📈', label: 'Finanzas', perfiles: ['admin'],
    items: [
      { path: '/facturacion',                   label: 'Facturación',         emoji: '🗂️', perfiles: ['admin'] },
      { path: '/finanzas/objetivos',            label: 'Objetivos',           emoji: '🎯', perfiles: ['admin'] },
      { path: '/facturacion/conciliacion',      label: 'Conciliación',        emoji: '🏦', perfiles: ['admin'] },
      { path: '/finanzas/punto-equilibrio',     label: 'Punto de Equilibrio', emoji: '⚖️', perfiles: ['admin'] },
      { path: '/finanzas/running',              label: 'Running Financiero',  emoji: '📊', perfiles: ['admin'] },
      { path: '/finanzas/pagos-cobros',         label: 'Pagos y Cobros',      emoji: '💳', perfiles: ['admin'] },
      { path: '/finanzas/gestion-facturas',     label: 'Gestión de Facturas', emoji: '🧾', perfiles: ['admin'] },
      { path: '/ocr',                           label: 'OCR',                 emoji: '📥', perfiles: ['admin'] },
      // Placeholders nuevos (Banktrack-inspired)
      { path: '/finanzas/verifactu',            label: 'Verifactu',           emoji: '✅', perfiles: ['admin'] },
      { path: '/finanzas/ocr-whatsapp',         label: 'OCR WhatsApp/Email',  emoji: '💬', perfiles: ['admin'] },
      { path: '/finanzas/escenarios-tesoreria', label: 'Escenarios Tesorería',emoji: '🔮', perfiles: ['admin'] },
    ],
  },
  {
    key: 'equipo', emoji: '👥', label: 'Equipo', perfiles: ['admin'],
    items: [
      { path: '/equipo', label: 'Equipo', emoji: '👥', perfiles: ['admin'] },
    ],
  },
  {
    key: 'cocina', emoji: '🍳', label: 'Cocina', perfiles: ['admin', 'cocina'],
    items: [
      { path: '/escandallo',              label: 'Escandallo',       emoji: '⚖️', perfiles: ['admin', 'cocina'] },
      { path: '/escandallo-v2',           label: 'Escandallo v2 (beta)', emoji: '⚗️', perfiles: ['admin'] },
      { path: '/carta',                   label: 'Carta',               emoji: '🍽️', perfiles: ['admin'] },
      { path: '/cocina/menu-engineering', label: 'Menú Engineering', emoji: '⚙️', perfiles: ['admin'] },
      { path: '/cocina/recetario',        label: 'Recetario',         emoji: '📋', perfiles: ['admin', 'cocina'] },
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
    key: 'configuracion', emoji: '⚙️', label: 'Configuración', perfiles: ['admin'],
    items: [
      { path: '/configuracion/marcas',                label: 'Marcas',                   emoji: '🏷️', perfiles: ['admin'] },
      { path: '/configuracion/bancos-y-cuentas',       label: 'Bancos y Cuentas',        emoji: '🏦', perfiles: ['admin'] },
      { path: '/configuracion/plataformas',           label: 'Plataformas',              emoji: '📡', perfiles: ['admin'] },
      { path: '/configuracion/usuarios',              label: 'Usuarios',                 emoji: '👤', perfiles: ['admin'] },
      { path: '/configuracion/calendario',             label: 'Calendario operativo',     emoji: '📅', perfiles: ['admin'] },
    ],
  },
]

/* Rutas placeholder, no clicables. Se muestran en desplegable "PRÓXIMAMENTE". */
const PROXIMAMENTE: { label: string; emoji: string }[] = [
  { label: 'Revenue & Ticket',             emoji: '🎫' },
  { label: 'Predicción Demanda',           emoji: '🔮' },
  { label: 'Tesorería',                    emoji: '💳' },
  { label: 'Reclamación Reembolsos',       emoji: '💸' },
  { label: 'Checklists Apertura/Cierre',   emoji: '✅' },
  { label: 'Tareas Operativas',            emoji: '📝' },
  { label: 'Control Temperaturas',         emoji: '🌡️' },
  { label: 'BPM / Calidad',                emoji: '✅' },
  { label: 'Daños Material',               emoji: '🔧' },
  { label: 'Manuales',                     emoji: '📚' },
  { label: 'Novedades',                    emoji: '🔔' },
  { label: 'Mantenimiento Equipos',        emoji: '🔧' },
  { label: 'Organigrama',                  emoji: '🏢' },
  { label: 'Almacén',                      emoji: '🏭' },
  { label: 'Stock Mínimo Alertas',         emoji: '⚠️' },
  { label: 'Movimientos Stock',            emoji: '🔄' },
  { label: 'Pedidos a Proveedores',        emoji: '🛒' },
  { label: 'Pedidos de Artículos',         emoji: '📦' },
  { label: 'Albaranes',                    emoji: '📄' },
  { label: 'POS',                          emoji: '🖥️' },
  { label: 'Pedidos en Curso',             emoji: '⏳' },
  { label: 'Producción',                   emoji: '🏭' },
  { label: 'Fichas Empleados',             emoji: '👤' },
  { label: 'Evaluaciones',                 emoji: '⭐' },
  { label: 'Llamados Atención',            emoji: '⚠️' },
  { label: 'Beneficios Antigüedad',        emoji: '🎁' },
  { label: 'Celebraciones',                emoji: '🎉' },
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
  { label: 'Oportunidades',                emoji: '💡' },
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
  { label: 'Integraciones',                emoji: '🔌' },
  // ── Nuevos (análisis ERPs hostelería 2026) ──
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
  finanzas:      { icon: TrendingUp,   color: '#06C167' },
  equipo:        { icon: Users,        color: '#66aaff' },
  cocina:        { icon: ChefHat,      color: '#f5a623' },
  stock:         { icon: ShoppingCart, color: '#B01D23' },
  configuracion: { icon: Settings,     color: '#9ba8c0' },
}

const PROXIMAMENTE_LS_KEY = 'streatlab.sidebar.proximamente.open'

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { usuario, logout } = useAuth()
  const { collapsed, toggle } = useSidebarState()
  const { T, isDark } = useTheme()
  const perfil = usuario?.perfil ?? ''

  const activeTextColor = '#ffffff'
  const hoverBg = isDark ? T.card : T.group

  const [openSections, setOpenSections] = useState<string[]>([])
  const [proxOpen, setProxOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(PROXIMAMENTE_LS_KEY) === '1'
  })
  const [tareasBadge, setTareasBadge] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(PROXIMAMENTE_LS_KEY, proxOpen ? '1' : '0')
  }, [proxOpen])

  useEffect(() => {
    supabase
      .from('tareas_pendientes')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'atrasada'])
      .then(({ count }) => setTareasBadge(count ?? 0))
  }, [])

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
    padding: '9px 10px 9px 16px',
    margin: '1px 8px',
    borderRadius: 6,
    fontFamily: FONT.body,
    fontSize: 14,
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
            <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 }} title="Expandir">
              <ChevronRight size={18} color="#B01D23" />
            </button>
          </div>
        ) : (
          <div style={{ padding: 12, borderBottom: `1px solid ${T.brd}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <img src="/data/logo-icon.svg" alt="Streat Lab" style={{ height: 32, width: 'auto', display: 'block', flexShrink: 0, filter: 'none' }} crossOrigin="anonymous" />
              <span style={{ fontFamily: FONT.heading, fontSize: 14, color: '#B01D23', letterSpacing: '2px', fontWeight: 600, whiteSpace: 'nowrap' }}>STREAT LAB</span>
            </div>
            <button onClick={toggle} style={{ color: T.mut, background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="hover:text-[var(--sl-text-primary)] transition-colors hidden md:flex" title="Colapsar">«</button>
          </div>
        )}

        <nav className="flex-1 py-2 overflow-y-auto" style={{ overflowX: 'hidden' }}>

          {/* PANEL GLOBAL — PRIMER ÍTEM (TOP) */}
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
                padding: '10px 14px 10px 12px',
                fontFamily: FONT.heading,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: isActive ? '#ffffff' : T.pri,
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

          {/* TAREAS — SEGUNDO ÍTEM */}
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
                padding: '10px 14px 10px 12px',
                fontFamily: FONT.heading,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: isActive ? '#ffffff' : T.pri,
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
                      padding: '10px 14px 10px 12px',
                      fontFamily: FONT.heading, fontSize: 13,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: isOpen ? T.pri : T.sec,
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

          {/* PRÓXIMAMENTE — sección especial, items no clicables */}
          {!collapsed && perfil === 'admin' && (
            <SidebarProximamente
              isOpen={proxOpen}
              onToggle={() => setProxOpen(o => !o)}
              T={T}
            />
          )}
          {collapsed && perfil === 'admin' && (
            <button
              type="button"
              onClick={() => setProxOpen(o => !o)}
              title="Próximamente"
              style={{
                width: '100%', height: 44, background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6,
              }}
            >
              <Clock size={20} strokeWidth={1.8} color={T.mut} />
            </button>
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

/* ═══════════════════════════════════════════════
   SidebarProximamente — items no clicables con tooltip "En desarrollo"
   ═══════════════════════════════════════════════ */
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
