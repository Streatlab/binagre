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
import { useTheme } from '../contexts/ThemeContext'
import { ThemeToggle } from './ThemeToggle'
import { supabase } from '@/lib/supabase'
import SidebarBadge from '@/components/ui/SidebarBadge'
import { useEsMovil } from '@/hooks/useEsMovil'

// ── Brutalismo Streat Lab · bloques de color sólido + inversión + tipografía bold ──
const INK = '#0a0a0a'
const AMA = '#FFC400'      // acento de inversión (activo directo)
const ROSA = '#FF2E63'     // acento iconos inactivos
const OSW = 'Oswald, sans-serif'

// base del sidebar (zonas neutras) según tema — header y footer también se adaptan
interface Pal { bg: string; txt: string; txtMut: string; head: string; headTxt: string; logoBd: string }
const PAL_DARK: Pal = { bg: '#1e2233', txt: '#e8e4d8', txtMut: '#8b90a3', head: '#0a0a0a', headTxt: '#FCEFD6', logoBd: '#FCEFD6' }
const PAL_LIGHT: Pal = { bg: '#FCEFD6', txt: '#1e2233', txtMut: '#6b5d45', head: '#F3D9A8', headTxt: '#140f08', logoBd: '#140f08' }

// color sólido de cada sección (bloques)
const SEC_COLOR: Record<string, { bg: string; fg: string }> = {
  finanzas:      { bg: '#0FB86B', fg: '#ffffff' },
  cocina:        { bg: '#FFC400', fg: '#0a0a0a' },
  operaciones:   { bg: '#FF6A1A', fg: '#ffffff' },
  stock:         { bg: '#2D5BFF', fg: '#ffffff' },
  informes:      { bg: '#B01D23', fg: '#ffffff' },
  equipo:        { bg: '#FF2E63', fg: '#ffffff' },
  mkt:           { bg: '#1e2233', fg: '#ffffff' },
  configuracion: { bg: '#484f66', fg: '#ffffff' },
}
const PROX_BG = '#9a8f78'

interface NavItem { path: string; label: string; emoji: string; perfiles: string[] }
interface NavSection { key: string; emoji: string; label: string; perfiles: string[]; items: NavItem[] }
interface SectionIconConfig { icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }> }

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
  { label: 'Revenue & Ticket', emoji: '🎫' }, { label: 'Predicción Demanda', emoji: '🔮' },
  { label: 'Tesorería', emoji: '💳' }, { label: 'Control Temperaturas', emoji: '🌡️' },
  { label: 'BPM / Calidad', emoji: '✅' }, { label: 'Daños Material', emoji: '🔧' },
  { label: 'Novedades', emoji: '🔔' }, { label: 'Mantenimiento Equipos', emoji: '🔧' },
  { label: 'Almacén', emoji: '🏭' }, { label: 'Stock Mínimo Alertas', emoji: '⚠️' },
  { label: 'Movimientos Stock', emoji: '🔄' }, { label: 'Pedidos a Proveedores', emoji: '🛒' },
  { label: 'Pedidos de Artículos', emoji: '📦' }, { label: 'Albaranes', emoji: '📄' },
  { label: 'POS', emoji: '🖥️' }, { label: 'Pedidos en Curso', emoji: '⏳' },
  { label: 'Fichas Empleados', emoji: '👤' }, { label: 'Evaluaciones', emoji: '⭐' },
  { label: 'Llamados Atención', emoji: '⚠️' }, { label: 'Beneficios Antigüedad', emoji: '🎁' },
  { label: 'Celebraciones', emoji: '🎉' }, { label: 'Onboarding Digital', emoji: '🚀' },
  { label: 'Mis Ventas / Mis Metas', emoji: '🏅' }, { label: 'Calendario', emoji: '📅' },
  { label: 'Mensajería Interna', emoji: '💬' }, { label: 'Novedades Equipo', emoji: '📢' },
  { label: 'Reuniones Equipo', emoji: '🤝' }, { label: 'Recursos Humanos', emoji: '👥' },
  { label: 'Project Management', emoji: '📊' }, { label: 'Kanban', emoji: '📋' },
  { label: 'Club Fidelización', emoji: '🎖️' }, { label: 'CRM Tienda Propia', emoji: '🛍️' },
  { label: 'Panel Reseñas', emoji: '⭐' }, { label: 'Quejas', emoji: '😡' },
  { label: 'Clientes', emoji: '👥' }, { label: 'Ficha Cliente', emoji: '👤' },
  { label: 'Envío WhatsApp', emoji: '💬' }, { label: 'Envío Email', emoji: '📧' },
  { label: 'Oportunidades', emoji: '💡' }, { label: 'Top Clientes Facturación', emoji: '🏆' },
  { label: 'Tienda en Línea', emoji: '🛒' }, { label: 'Ventas por Hora', emoji: '🕐' },
  { label: 'Ventas por Familia', emoji: '🗂️' }, { label: 'Ventas por Canal', emoji: '📡' },
  { label: 'Consumo Platos', emoji: '🍽️' }, { label: 'Comparativa Año', emoji: '📅' },
  { label: 'Ventas Marca', emoji: '🏷️' }, { label: 'Margen Canal', emoji: '📡' },
  { label: 'COGS Coste MP', emoji: '🧾' }, { label: 'Ranking Productos', emoji: '🏆' },
  { label: 'Panel Favoritos', emoji: '⭐' }, { label: 'Búsqueda Avanzada', emoji: '🔎' },
  { label: 'Ranking Marcas', emoji: '📊' }, { label: 'Ranking Canales', emoji: '📡' },
  { label: 'Alérgenos', emoji: '🥜' }, { label: 'Alertas Caducidad', emoji: '⏰' },
  { label: 'Automatización Impuestos', emoji: '🧾' }, { label: 'BI / Informes Avanzados', emoji: '📈' },
  { label: 'Caja', emoji: '💵' }, { label: 'Combos y Promociones', emoji: '🎁' },
  { label: 'Control Mermas', emoji: '📉' }, { label: 'Control Presencia / Fichaje', emoji: '🕒' },
  { label: 'Email Marketing', emoji: '✉️' }, { label: 'Estadísticas Horas Punta', emoji: '📊' },
  { label: 'Exportación a Gestoría', emoji: '📤' }, { label: 'Gestión Clientes', emoji: '👥' },
  { label: 'Gestión Impuestos', emoji: '🧮' }, { label: 'Menús Dinámicos', emoji: '🍴' },
  { label: 'Gestión Pedidos', emoji: '🧾' }, { label: 'Stock e Inventario', emoji: '📦' },
  { label: 'Informes Financieros', emoji: '💼' }, { label: 'Informes de Ventas', emoji: '📑' },
  { label: 'Integración Delivery', emoji: '🛵' }, { label: 'Inventario Tiempo Real', emoji: '📡' },
  { label: 'Marketing Automation', emoji: '🤖' }, { label: 'Notificaciones Empleados', emoji: '🔔' },
  { label: 'Pagos Proveedores Auto', emoji: '💸' }, { label: 'Panel KPIs Global', emoji: '📊' },
  { label: 'Planificación Turnos', emoji: '🗓️' }, { label: 'Pop-ups y Dark Kitchens', emoji: '🏪' },
  { label: 'Predicción Plantilla', emoji: '👥' }, { label: 'Promociones por Día/Hora', emoji: '⏰' },
]

const SECTION_ICONS: Record<string, SectionIconConfig> = {
  finanzas:      { icon: TrendingUp },
  cocina:        { icon: ChefHat },
  operaciones:   { icon: ClipboardList },
  stock:         { icon: ShoppingCart },
  informes:      { icon: FileText },
  equipo:        { icon: Users },
  mkt:           { icon: Megaphone },
  configuracion: { icon: Settings },
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
  const { theme } = useTheme()
  const C: Pal = theme === 'light' ? PAL_LIGHT : PAL_DARK
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
    supabase.from('tareas_pendientes').select('id', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'atrasada']).then(({ count }) => setTareasBadge(count ?? 0))
  }, [])

  useEffect(() => {
    if (perfil !== 'admin') return
    supabase.from('facturas').select('id', { count: 'exact', head: true })
      .in('tipo', ['proveedor', 'plataforma'])
      .or('total.lte.0,titular_id.is.null,categoria_factura.is.null')
      .then(({ count }) => setOcrBadge(count ?? 0))
  }, [perfil])

  // colapso/expansión persistente (5 min tras última interacción)
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
    setPinned(false); setPeek(false)
  }

  useEffect(() => {
    pin()
    return () => { if (pinTimer.current) clearTimeout(pinTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const sidebarWidth = collapsed ? 58 : 240

  const directLink = (isActive: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 11,
    padding: '13px 16px',
    borderBottom: `3px solid ${INK}`,
    background: isActive ? INK : C.bg,
    color: isActive ? AMA : C.txt,
    fontFamily: OSW, fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
    textDecoration: 'none', cursor: 'pointer',
  })

  const collapsedBtn = (active: boolean, bg: string): React.CSSProperties => ({
    margin: '8px auto', width: 40, height: 40,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none', position: 'relative',
    border: `3px solid ${INK}`, background: bg,
    cursor: 'pointer',
  })

  return (
    <>
      <style>{`
        .slb-noscroll::-webkit-scrollbar { width: 0; height: 0; display: none; }
        .slb-noscroll { scrollbar-width: none; -ms-overflow-style: none; }
        .slb-head, .slb-direct, .slb-it { transition: filter .12s, background .12s; }
        .slb-head:not(.slb-on):hover { filter: brightness(.93); }
        .slb-direct:not(.slb-on):hover { filter: brightness(.96); }
        .slb-it:not(.slb-on):hover { background: #f0ece2 !important; }
      `}</style>

      {open && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={onClose} />}

      <aside
        onMouseEnter={() => setPeek(true)}
        onMouseLeave={() => setPeek(false)}
        onClick={pin}
        style={{ background: C.bg, borderRight: `4px solid ${INK}`, width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
        className={`fixed top-0 left-0 z-40 h-full flex flex-col transition-all duration-[250ms] ease-[ease] overflow-hidden md:translate-x-0 md:static md:z-auto ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* HEADER · se adapta al tema (claro en modo claro) */}
        {collapsed ? (
          <div style={{ background: C.head, borderBottom: `4px solid ${INK}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 66, padding: '6px 0', gap: 4 }}>
            <div style={{ width: 30, height: 30, background: '#B01D23', border: `2px solid ${C.logoBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: OSW, fontWeight: 700, color: '#FCEFD6', fontSize: 12 }}>SL</div>
            <button onClick={(e) => { e.stopPropagation(); pin() }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 30 }} title="Abrir">
              <ChevronRight size={18} color={C.headTxt} strokeWidth={3} />
            </button>
          </div>
        ) : (
          <div style={{ background: C.head, padding: '14px 16px', borderBottom: `4px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 66 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
              <div style={{ width: 34, height: 34, background: '#B01D23', border: `2px solid ${C.logoBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: OSW, fontWeight: 700, color: '#FCEFD6', fontSize: 14, flexShrink: 0 }}>SL</div>
              <span style={{ fontFamily: OSW, fontSize: 19, color: C.headTxt, letterSpacing: '3px', fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>STREAT LAB</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); unpin() }} style={{ color: C.headTxt, background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }} className="hidden md:flex" title="Colapsar">«</button>
          </div>
        )}

        <nav className="flex-1 slb-noscroll" style={{ overflowY: 'auto', overflowX: 'hidden' }}>

          {/* PANEL GLOBAL */}
          {(!collapsed && perfil && ['admin', 'cocina'].includes(perfil)) && (
            <NavLink to="/" end onClick={onClose} className={({ isActive }) => isActive ? 'slb-direct slb-on' : 'slb-direct'} style={({ isActive }) => directLink(isActive)}>
              {({ isActive }) => (<><LayoutDashboard size={19} strokeWidth={2.4} color={isActive ? AMA : ROSA} style={{ flexShrink: 0 }} /><span>Panel Global</span></>)}
            </NavLink>
          )}
          {collapsed && perfil && ['admin', 'cocina'].includes(perfil) && (
            <NavLink to="/" end onClick={onClose} title="Panel Global" className={({ isActive }) => isActive ? 'slb-on' : ''} style={({ isActive }) => collapsedBtn(isActive, isActive ? INK : C.bg)}>
              {({ isActive }) => <LayoutDashboard size={20} strokeWidth={2.4} color={isActive ? AMA : ROSA} />}
            </NavLink>
          )}

          {/* TAREAS */}
          {(!collapsed && perfil === 'admin') && (
            <NavLink to="/tareas" onClick={onClose} className={({ isActive }) => isActive ? 'slb-direct slb-on' : 'slb-direct'} style={({ isActive }) => directLink(isActive)}>
              {({ isActive }) => (<><BellRing size={19} strokeWidth={2.4} color={isActive ? AMA : ROSA} style={{ flexShrink: 0 }} /><span style={{ flex: 1 }}>Tareas</span><SidebarBadge count={tareasBadge} /></>)}
            </NavLink>
          )}
          {collapsed && perfil === 'admin' && (
            <NavLink to="/tareas" onClick={onClose} title="Tareas pendientes" className={({ isActive }) => isActive ? 'slb-on' : ''} style={({ isActive }) => collapsedBtn(isActive, isActive ? INK : C.bg)}>
              {({ isActive }) => (<>
                <BellRing size={20} strokeWidth={2.4} color={isActive ? AMA : ROSA} />
                {tareasBadge > 0 && <span style={{ position: 'absolute', top: -8, right: -8, background: ROSA, color: '#fff', border: `2px solid ${INK}`, fontSize: 9, minWidth: 16, height: 16, padding: '0 3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: OSW }}>{tareasBadge > 9 ? '9+' : tareasBadge}</span>}
              </>)}
            </NavLink>
          )}

          {/* SECCIONES · bloques de color sólido */}
          {SECTIONS.map(section => {
            const visibleItems = filterItems(section.items)
            if (!section.perfiles.includes(perfil) || visibleItems.length === 0) return null
            const isOpen = openSections.includes(section.key)
            const IconComponent = SECTION_ICONS[section.key]?.icon
            const sc = SEC_COLOR[section.key] ?? { bg: '#888', fg: '#fff' }

            return (
              <div key={section.key}>
                {collapsed ? (
                  <button type="button" onClick={() => toggleSection(section.key)} title={section.label} className={isOpen ? 'slb-on' : ''} style={collapsedBtn(isOpen, sc.bg)}>
                    {IconComponent ? <IconComponent size={20} strokeWidth={2.3} color={sc.fg} /> : <span>{section.emoji}</span>}
                  </button>
                ) : (
                  <button type="button" onClick={() => toggleSection(section.key)} className={isOpen ? 'slb-head slb-on' : 'slb-head'}
                    style={{ width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', border: 'none', borderBottom: `3px solid ${INK}`, background: sc.bg, color: sc.fg, boxShadow: isOpen ? `inset 0 -5px 0 ${INK}` : 'none', fontFamily: OSW, fontSize: 14.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {IconComponent ? <IconComponent size={18} strokeWidth={2.4} color={sc.fg} /> : <span style={{ fontSize: 14 }}>{section.emoji}</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>{section.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', flexShrink: 0 }}>›</span>
                  </button>
                )}

                {!collapsed && isOpen && (
                  <div style={{ background: '#fff', borderBottom: `3px solid ${INK}` }}>
                    {visibleItems.map((item, idx) => (
                      <NavLink key={`${item.path}-${idx}`} to={item.path} end onClick={onClose}
                        className={({ isActive }) => isActive ? 'slb-it slb-on' : 'slb-it'}
                        style={({ isActive }) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px 9px 20px', background: isActive ? INK : '#fff', color: isActive ? '#fff' : INK, fontFamily: OSW, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', borderTop: idx === 0 ? 'none' : `1.5px solid rgba(0,0,0,0.10)` })}>
                        {({ isActive }) => (<>
                          <span style={{ width: 8, height: 8, flexShrink: 0, background: isActive ? sc.bg : INK }} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                          {item.path === '/finanzas/documentacion' && <SidebarBadge count={ocrBadge} />}
                        </>)}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {!collapsed && perfil === 'admin' && (
            <SidebarProximamente isOpen={proxOpen} onToggle={() => setProxOpen(o => !o)} />
          )}
        </nav>

        {/* FOOTER · se adapta al tema (claro en modo claro) */}
        <div style={{ background: C.head, borderTop: `4px solid ${INK}`, padding: collapsed ? '8px' : '12px 16px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 10 }}>
          <ThemeToggle />
          {!collapsed && (
            <div style={{ fontFamily: OSW, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em', color: C.headTxt, textAlign: 'right', lineHeight: 1.4 }}>
              {usuario?.nombre}<br /><span style={{ color: ROSA, fontWeight: 700 }}>{usuario?.perfil}</span>
            </div>
          )}
        </div>
        <div style={{ background: C.head, padding: collapsed ? '0 8px 10px' : '0 16px 12px', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <button onClick={logout} style={{ color: C.headTxt, background: 'transparent', border: `2px solid ${C.headTxt}`, padding: collapsed ? 0 : '5px 12px', width: collapsed ? 34 : 'auto', height: collapsed ? 34 : 'auto', cursor: 'pointer', fontFamily: OSW, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', fontSize: collapsed ? 14 : 12 }} title="Cerrar sesión">
            {collapsed ? '⏏' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>
    </>
  )
}

function SidebarProximamente({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <div>
      <button type="button" onClick={onToggle} className={isOpen ? 'slb-head slb-on' : 'slb-head'}
        style={{ width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', border: 'none', borderBottom: `3px solid ${INK}`, background: PROX_BG, color: '#fff', boxShadow: isOpen ? `inset 0 -5px 0 ${INK}` : 'none', fontFamily: OSW, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }} title="Funciones en desarrollo">
        <Clock size={16} strokeWidth={2.4} color="#fff" />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>Próximamente</span>
        <span style={{ fontSize: 13, fontWeight: 800, transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', flexShrink: 0 }}>›</span>
      </button>
      {isOpen && (
        <div style={{ background: '#fff', borderBottom: `3px solid ${INK}` }}>
          {PROXIMAMENTE.map((item, idx) => (
            <div key={`${item.label}-${idx}`} onClick={e => e.preventDefault()} title="En desarrollo — próximamente" aria-disabled="true"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px 7px 20px', borderTop: idx === 0 ? 'none' : `1.5px solid rgba(0,0,0,0.08)`, fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9a8f78', cursor: 'not-allowed', userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <span style={{ width: 7, height: 7, flexShrink: 0, background: '#c4baa6' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
