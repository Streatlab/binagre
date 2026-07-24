/**
 * navModel — FUENTE ÚNICA DE NAVEGACIÓN del ERP Binagre / Streat Lab.
 *
 * ⚠️ CONTRATO (LEY-PWA-MÓVIL-01, ver docs/LEY_PWA_MOVIL.md):
 *   Tanto el Sidebar de ESCRITORIO (`src/components/Sidebar.tsx`) como la app
 *   MÓVIL (`src/mobile/AppMovil.tsx`) leen ESTE archivo. No hay dos mapas de
 *   navegación: hay uno. Cualquier módulo, pestaña o etiqueta que se añada aquí
 *   aparece automáticamente en las dos pieles, sin duplicar nada.
 *
 *   → Para dar de alta un módulo nuevo en el ERP: añádelo a `SECTIONS` (o a
 *     `DIRECTOS` si es acceso directo). Se reflejará idéntico en web y en PWA.
 *   → Las PESTAÑAS y SUBPESTAÑAS de cada módulo NO se listan aquí: viven dentro
 *     de la propia pantalla (TabsContainer). En móvil se renderiza la pantalla
 *     real, así que sus pestañas aparecen solas. Cero duplicación también ahí.
 */
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  ChefHat,
  ShoppingCart,
  Settings,
  ClipboardList,
  Target,
  Bell,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  emoji: string
  perfiles: string[]
  pendiente?: boolean
  grupo?: string
}
export interface NavSection {
  key: string
  label: string
  perfiles: string[]
  items: NavItem[]
}
export interface SectionIconConfig {
  icon: LucideIcon
  headBg: string
  headColor: string
}

import { BLANCO, INK, VERDE, NAR, AZUL, ROSA, GRIS, AMA as AMA_TOK } from '@/styles/neobrutal'

/** Accesos directos (espejo de los enlaces sueltos del sidebar: Hoy, Panel, Tareas). */
export interface DirectItem {
  path: string
  label: string
  icon: LucideIcon
  bg: string
  ic: string
  tareas?: boolean
}
export const DIRECTOS: DirectItem[] = [
  { path: '/',       label: 'HOY',    icon: LayoutDashboard, bg: '#2D5BFF', ic: '#fff' },
  { path: '/panel',  label: 'PANEL',  icon: Target,          bg: '#241D12', ic: '#FFC400' },
  { path: '/tareas', label: 'TAREAS', icon: Bell,            bg: '#FF2E63', ic: '#fff', tareas: true },
]

/**
 * Las 6 secciones del ERP. IDÉNTICAS a las del sidebar de escritorio.
 * (Origen histórico: `SECTIONS` de Sidebar.tsx, ahora centralizado aquí.)
 */
export const SECTIONS: NavSection[] = [
  {
    key: 'finanzas', label: 'Finanzas', perfiles: ['admin'],
    items: [
      { path: '/finanzas/papeleo',       label: 'Papeleo',      emoji: '📥', perfiles: ['admin'] },
      { path: '/finanzas/ventas-panel',  label: 'Ventas',       emoji: '💰', perfiles: ['admin'] },
      { path: '/finanzas/tesoreria',     label: 'Tesorería',    emoji: '💳', perfiles: ['admin'] },
      { path: '/finanzas/resultados',    label: 'Resultados',   emoji: '📊', perfiles: ['admin'] },
      { path: '/finanzas/rentabilidad',  label: 'Rentabilidad', emoji: '🎯', perfiles: ['admin'] },
    ],
  },
  {
    key: 'cocina', label: 'Cocina', perfiles: ['admin', 'cocina'],
    items: [
      { path: '/cocina/hoy',       label: 'Hoy',       emoji: '🏠', perfiles: ['admin'] },
      { path: '/cocina/operativa', label: 'Operativa', emoji: '🍳', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/dinero',    label: 'Dinero',    emoji: '💶', perfiles: ['admin'] },
    ],
  },
  {
    key: 'operaciones', label: 'Operaciones', perfiles: ['admin'],
    items: [
      { path: '/ops/registro-diario', label: 'Registro diario',  emoji: '✅', perfiles: ['admin'] },
      { path: '/ops/mantenimiento',   label: 'Mantenimiento',    emoji: '🔧', perfiles: ['admin'] },
      { path: '/ops/calidad',         label: 'Calidad',          emoji: '📚', perfiles: ['admin'] },
      { path: '/ops/reembolsos',      label: 'Reclamaciones',    emoji: '💸', perfiles: ['admin'] },
      { path: '/ops/reuniones',       label: 'Reuniones Equipo', emoji: '🤝', perfiles: ['admin'] },
      { path: '/marcas',              label: 'Marcas',           emoji: '🏷️', perfiles: ['admin'] },
    ],
  },
  {
    key: 'equipo', label: 'Equipo', perfiles: ['admin'],
    items: [
      { path: '/equipo/personas',   label: 'Personas',   emoji: '👥', perfiles: ['admin'] },
      { path: '/equipo/dinero',     label: 'Dinero',     emoji: '💶', perfiles: ['admin'] },
      { path: '/equipo/dia-a-dia',  label: 'Día a día',  emoji: '🗓️', perfiles: ['admin'] },
      { path: '/equipo/documentos', label: 'Documentos', emoji: '📁', perfiles: ['admin'] },
    ],
  },
  {
    key: 'compras', label: 'Compras', perfiles: ['admin'],
    items: [
      { path: '/compras',                          label: 'Lista de Compra',    emoji: '🛒', perfiles: ['admin'] },
      { path: '/compras/inventario',               label: 'Inventario',         emoji: '📦', perfiles: ['admin'] },
      { path: '/compras/proveedores',              label: 'Proveedores',        emoji: '🏢', perfiles: ['admin'] },
      { path: '/configuracion/compras/categorias', label: 'Catálogos·Compras',  emoji: '📚', perfiles: ['admin'] },
    ],
  },
  {
    key: 'ventas', label: 'Ventas y Clientes', perfiles: ['admin'],
    items: [
      { path: '/ventas',           label: 'Ventas',    emoji: '💰', perfiles: ['admin'] },
      { path: '/ventas/analitica', label: 'Analítica', emoji: '📊', perfiles: ['admin'] },
      { path: '/ventas/clientes',  label: 'Clientes',  emoji: '🛍️', perfiles: ['admin'] },
      { path: '/ventas/marketing', label: 'Marketing', emoji: '📣', perfiles: ['admin'] },
    ],
  },
  {
    key: 'ajustes', label: 'Ajustes', perfiles: ['admin'],
    items: [
      { path: '/configuracion', label: 'Configuración', emoji: '⚙️', perfiles: ['admin'] },
      { path: '/configuracion/impresion', label: 'Impresión', emoji: '🖨️', perfiles: ['admin'] },
      { path: '/informes',      label: 'Informes',      emoji: '📊', perfiles: ['admin'] },
    ],
  },
]

/** Color e icono de cada sección (literal del mock Cantera Alegre). */
export const SECTION_ICONS: Record<string, SectionIconConfig> = {
  finanzas:    { icon: TrendingUp,    headBg: VERDE,   headColor: BLANCO },
  cocina:      { icon: ChefHat,       headBg: AMA_TOK, headColor: INK },
  operaciones: { icon: ClipboardList, headBg: NAR,     headColor: BLANCO },
  equipo:      { icon: Users,         headBg: INK,     headColor: BLANCO },
  compras:     { icon: ShoppingCart,  headBg: AZUL,    headColor: BLANCO },
  ventas:      { icon: TrendingUp,    headBg: ROSA,    headColor: BLANCO },
  ajustes:     { icon: Settings,      headBg: GRIS,    headColor: INK },
}

/** Filtra secciones/items por perfil del usuario (misma regla que el sidebar). */
export function seccionesVisibles(perfil: string): NavSection[] {
  return SECTIONS
    .filter(s => !perfil || s.perfiles.includes(perfil))
    .map(s => ({ ...s, items: s.items.filter(i => !perfil || i.perfiles.includes(perfil)) }))
    .filter(s => s.items.length > 0)
}

/** Título y sección de la cabecera móvil a partir de la ruta actual. */
export function tituloDeRuta(pathname: string): { seccion: string; titulo: string } {
  if (pathname === '/') return { seccion: 'Streat Lab', titulo: 'Hoy' }
  if (pathname === '/panel') return { seccion: 'Streat Lab', titulo: 'Panel Global' }
  if (pathname === '/tareas') return { seccion: 'Streat Lab', titulo: 'Tareas' }
  for (const s of SECTIONS) {
    const hit = s.items.find(i => pathname === i.path || pathname.startsWith(i.path + '/'))
    if (hit) return { seccion: s.label, titulo: hit.label }
  }
  return { seccion: 'Streat Lab', titulo: 'ERP' }
}
