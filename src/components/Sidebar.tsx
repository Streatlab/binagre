import { NavLink } from 'react-router-dom'
import { useState, type ReactElement } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSidebarState } from '@/hooks/useSidebarState'
import { useTheme } from '../contexts/ThemeContext'
import { NavIcon } from './NavIcon'

// ─── Subitem icons — SVG outline 14px, usan currentColor ──────────────────────

const svgProps = {
  width: 14, height: 14, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

const SUBITEM_ICONS: Record<string, ReactElement> = {
  // Finanzas
  'Facturación':       <svg {...svgProps}><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>,
  'Objetivos':         <svg {...svgProps}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  'Análisis':          <svg {...svgProps}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  'Revenue & Ticket':  <svg {...svgProps}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  'COGS / Coste MP':   <svg {...svgProps}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  'Margen por Canal':  <svg {...svgProps}><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  'Ventas por Marca':  <svg {...svgProps}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  'Ranking Productos': <svg {...svgProps}><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>,
  'Predicción Demanda':<svg {...svgProps}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  'Tesorería':         <svg {...svgProps}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>,
  'Cobros':            <svg {...svgProps}><line x1="12" y1="2" x2="12" y2="22"/><polyline points="19 15 12 22 5 15"/></svg>,
  'Pagos':             <svg {...svgProps}><line x1="12" y1="22" x2="12" y2="2"/><polyline points="5 9 12 2 19 9"/></svg>,
  'Presupuestos':      <svg {...svgProps}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>,
  'Remesas':           <svg {...svgProps}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>,
  'Running Financiero':<svg {...svgProps}><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>,
  // Cocina
  'Escandallo':        <svg {...svgProps}><path d="M3 6h18"/><path d="M7 6v14M17 6v14"/><path d="M3 12h18"/></svg>,
  'Ingredientes':      <svg {...svgProps}><path d="M12 2a10 10 0 010 20"/><path d="M12 2c-3 0-6 4-6 10s3 10 6 10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>,
  'EPS':               <svg {...svgProps}><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>,
  'Recetas':           <svg {...svgProps}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>,
  'Mermas':            <svg {...svgProps}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  'Índice':            <svg {...svgProps}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  'Fichas Técnicas':   <svg {...svgProps}><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="17" y2="13"/><line x1="7" y1="17" x2="12" y2="17"/></svg>,
  'Pulso Cocina':      <svg {...svgProps}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  'KDS Kitchen Display':<svg {...svgProps}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  'Carta':             <svg {...svgProps}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  'Menu Engineering':  <svg {...svgProps}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09A1.65 1.65 0 0015 4.6a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.14.34.22.7.22 1.06V10a2 2 0 010 4h-.22z"/></svg>,
  'Histórico Recetas': <svg {...svgProps}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  // Operaciones
  'Checklists Apertura/Cierre':<svg {...svgProps}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  'Tareas Operativas': <svg {...svgProps}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  'Control Temperaturas BPM':<svg {...svgProps}><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4 4 0 105 0z"/></svg>,
  'BPM / Calidad':     <svg {...svgProps}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  'Daños Material':    <svg {...svgProps}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  'Pedidos a Proveedores':<svg {...svgProps}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  'Manuales':          <svg {...svgProps}><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>,
  'Novedades':         <svg {...svgProps}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  'Bitácora':          <svg {...svgProps}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  'Mantenimiento Equipos':<svg {...svgProps}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>,
  'Organigrama':       <svg {...svgProps}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  'División Órgano Trabajo':<svg {...svgProps}><rect x="2" y="7" width="20" height="14" rx="2"/><polyline points="16 21 12 17 8 21"/><path d="M12 17V3"/></svg>,
  // Stock
  'Inventario':        <svg {...svgProps}><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  'Almacén':           <svg {...svgProps}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>,
  'Stock Mínimo Alertas':<svg {...svgProps}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  'Movimientos Stock': <svg {...svgProps}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>,
  'Compras':           <svg {...svgProps}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  'Proveedores':       <svg {...svgProps}><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  'Pedidos a Proveedor':<svg {...svgProps}><path d="M9 11H5l-2 9h16l-2-9h-4"/><path d="M9 11V5a3 3 0 016 0v6"/></svg>,
  'Pedidos de Artículos':<svg {...svgProps}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  'Albaranes':         <svg {...svgProps}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>,
  // Marketing
  'Embudo':            <svg {...svgProps}><path d="M3 4h18"/><path d="M5 10h14l-2 6h-10z"/><line x1="12" y1="16" x2="12" y2="22"/></svg>,
  // POS
  'POS':               <svg {...svgProps}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  'Pedidos en Curso':  <svg {...svgProps}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  'Producción':        <svg {...svgProps}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M7 3h10v4H7z"/></svg>,
  // Configuración
  'Configuración':     <svg {...svgProps}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09A1.65 1.65 0 0015 4.6a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.14.34.22.7.22 1.06V10a2 2 0 010 4h-.22z"/></svg>,
  'Roles y Permisos':  <svg {...svgProps}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  'Usuarios':          <svg {...svgProps}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
}

const ACCENT = '#e8f442'
const RED = '#B01D23'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Nav data ─────────────────────────────────────────────────────────────────

const PANEL_GLOBAL: NavItem = { path: '/', label: 'Panel Global', emoji: '🏠', perfiles: ['admin', 'cocina'] }

const SECTIONS: NavSection[] = [
  {
    key: 'finanzas', emoji: '📈', label: 'Finanzas', perfiles: ['admin'],
    items: [
      { path: '/facturacion',             label: 'Facturación',           emoji: '🗂️', perfiles: ['admin'] },
      { path: '/finanzas/objetivos',       label: 'Objetivos',             emoji: '🎯', perfiles: ['admin'] },
      { path: '/finanzas/analisis',        label: 'Análisis',              emoji: '🔍', perfiles: ['admin'] },
      { path: '/analytics/revenue',        label: 'Revenue & Ticket',      emoji: '🎫', perfiles: ['admin'] },
      { path: '/analytics/cogs',           label: 'COGS / Coste MP',       emoji: '🧾', perfiles: ['admin'] },
      { path: '/analytics/margen',         label: 'Margen por Canal',      emoji: '📊', perfiles: ['admin'] },
      { path: '/analytics/ventas-marca',   label: 'Ventas por Marca',      emoji: '🏷️', perfiles: ['admin'] },
      { path: '/analytics/ranking',        label: 'Ranking Productos',     emoji: '🏆', perfiles: ['admin'] },
      { path: '/analytics/demanda',        label: 'Predicción Demanda',    emoji: '🔮', perfiles: ['admin'] },
      { path: '/finanzas/tesoreria',       label: 'Tesorería',             emoji: '💳', perfiles: ['admin'] },
      { path: '/finanzas/cobros',          label: 'Cobros',                emoji: '💸', perfiles: ['admin'] },
      { path: '/finanzas/pagos',           label: 'Pagos',                 emoji: '💵', perfiles: ['admin'] },
      { path: '/finanzas/presupuestos',    label: 'Presupuestos',          emoji: '📋', perfiles: ['admin'] },
      { path: '/finanzas/remesas',         label: 'Remesas',               emoji: '🏦', perfiles: ['admin'] },
      { path: '/running',                  label: 'Running Financiero',    emoji: '📊', perfiles: ['admin'] },
    ],
  },
  {
    key: 'cocina', emoji: '🍳', label: 'Cocina', perfiles: ['admin', 'cocina'],
    items: [
      { path: '/escandallo', label: 'Escandallo',       emoji: '⚖️',  perfiles: ['admin', 'cocina'] },
      { path: '/cocina/menu-engineering', label: 'Menú Engineering', emoji: '⚙️', perfiles: ['admin'] },
      { path: '/cocina/inventario', label: 'Inventario', emoji: '📦', perfiles: ['admin', 'cocina'] },
      { path: '/cocina/recetas', label: 'Recetas',      emoji: '📜',  perfiles: ['admin', 'cocina'] },
    ],
  },
  {
    key: 'operaciones', emoji: '⚙️', label: 'Operaciones', perfiles: ['admin', 'cocina'],
    items: [
      { path: '/ops/checklists',      label: 'Checklists Apertura/Cierre', emoji: '✅',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/tareas',          label: 'Tareas Operativas',          emoji: '📝',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/temperaturas',    label: 'Control Temperaturas BPM',   emoji: '🌡️',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/bpm',             label: 'BPM / Calidad',              emoji: '✅',  perfiles: ['admin'] },
      { path: '/ops/danos',           label: 'Daños Material',             emoji: '🔧',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/pedidos-menaje',  label: 'Pedidos a Proveedores',      emoji: '🛒',  perfiles: ['admin', 'cocina'] },
      { path: '/operaciones/manuales', label: 'Manuales',                  emoji: '📚',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/bitacora',        label: 'Novedades',                  emoji: '🔔',  perfiles: ['admin', 'cocina'] },
      { path: '/ops/equipos',         label: 'Mantenimiento Equipos',      emoji: '🔧',  perfiles: ['admin', 'cocina'] },
      { path: '/operaciones/organigrama', label: 'Organigrama',            emoji: '🏢',  perfiles: ['admin'] },
      { path: '/ops/bitacora',        label: 'Bitácora',                   emoji: '📖',  perfiles: ['admin', 'cocina'] },
      { path: '/operaciones/division', label: 'División Órgano Trabajo',   emoji: '🏭',  perfiles: ['admin'] },
    ],
  },
  {
    key: 'stock', emoji: '📦', label: 'Stock & Compras', perfiles: ['admin'],
    items: [
      { path: '/stock/inventario',        label: 'Inventario',            emoji: '📦', perfiles: ['admin'] },
      { path: '/stock/almacen',           label: 'Almacén',               emoji: '🏭', perfiles: ['admin'] },
      { path: '/stock/minimo',            label: 'Stock Mínimo Alertas',  emoji: '⚠️', perfiles: ['admin'] },
      { path: '/stock/movimientos',       label: 'Movimientos Stock',     emoji: '🔄', perfiles: ['admin'] },
      { path: '/stock/compras',           label: 'Compras',               emoji: '🛒', perfiles: ['admin'] },
      { path: '/stock/proveedores',       label: 'Proveedores',           emoji: '🏢', perfiles: ['admin'] },
      { path: '/stock/pedidos-proveedor', label: 'Pedidos a Proveedor',   emoji: '📋', perfiles: ['admin'] },
      { path: '/stock/pedidos-articulos', label: 'Pedidos de Artículos',  emoji: '📦', perfiles: ['admin'] },
      { path: '/stock/albaranes',         label: 'Albaranes',             emoji: '📄', perfiles: ['admin'] },
    ],
  },
  {
    key: 'pos', emoji: '🚀', label: 'POS & Pedidos', perfiles: ['admin'],
    items: [
      { path: '/pos',              label: 'POS',             emoji: '🖥️', perfiles: ['admin'] },
      { path: '/pos/pedidos-curso', label: 'Pedidos en Curso', emoji: '⏳', perfiles: ['admin'] },
      { path: '/pos/produccion',   label: 'Producción',      emoji: '🏭', perfiles: ['admin'] },
    ],
  },
  {
    key: 'marcas', emoji: '🏷️', label: 'Marcas', perfiles: ['admin'],
    items: [
      { path: '/marcas',                  label: 'Marcas',             emoji: '🏷️', perfiles: ['admin'] },
      { path: '/marcas/ranking',          label: 'Ranking Marcas',     emoji: '📊', perfiles: ['admin'] },
      { path: '/marcas/ranking-canales',  label: 'Ranking Canales',    emoji: '📡', perfiles: ['admin'] },
      { path: '/integraciones/pos',       label: 'Integraciones',      emoji: '🔌', perfiles: ['admin'] },
    ],
  },
  {
    key: 'marketing', emoji: '📈', label: 'Marketing', perfiles: ['admin'],
    items: [
      { path: '/marketing/embudo', label: 'Embudo', emoji: '🔽', perfiles: ['admin'] },
    ],
  },
  {
    key: 'equipo', emoji: '👥', label: 'Equipo', perfiles: ['admin'],
    items: [
      { path: '/equipo/empleados',    label: 'Fichas Empleados',       emoji: '👤', perfiles: ['admin'] },
      { path: '/equipo/evaluaciones', label: 'Evaluaciones',           emoji: '⭐', perfiles: ['admin'] },
      { path: '/equipo/llamados',     label: 'Llamados Atención',      emoji: '⚠️', perfiles: ['admin'] },
      { path: '/equipo/antiguedad',   label: 'Beneficios Antigüedad',  emoji: '🎁', perfiles: ['admin'] },
      { path: '/equipo/celebraciones',label: 'Celebraciones',          emoji: '🎉', perfiles: ['admin'] },
      { path: '/equipo/onboarding',   label: 'Onboarding Digital',     emoji: '🚀', perfiles: ['admin'] },
      { path: '/equipo/metas',        label: 'Mis Ventas / Mis Metas', emoji: '🏅', perfiles: ['admin'] },
      { path: '/equipo/calendario',   label: 'Calendario',             emoji: '📅', perfiles: ['admin'] },
      { path: '/equipo/mensajeria',   label: 'Mensajería Interna',     emoji: '💬', perfiles: ['admin'] },
      { path: '/equipo/novedades',    label: 'Novedades Equipo',       emoji: '📢', perfiles: ['admin'] },
      { path: '/ops/reuniones',       label: 'Reuniones Equipo',       emoji: '🤝', perfiles: ['admin'] },
      { path: '/equipo/rrhh',         label: 'Recursos Humanos',       emoji: '👥', perfiles: ['admin'] },
      { path: '/equipo/projects',     label: 'Project Management',     emoji: '📊', perfiles: ['admin'] },
      { path: '/equipo/kanban',       label: 'Kanban',                 emoji: '📋', perfiles: ['admin'] },
      { path: '/equipo/servicio',     label: 'Servicio',               emoji: '🏆', perfiles: ['admin'] },
    ],
  },
  {
    key: 'clientes', emoji: '🤝', label: 'Clientes & CRM', perfiles: ['admin'],
    items: [
      { path: '/clientes/club',          label: 'Club Fidelización',           emoji: '🎖️', perfiles: ['admin'] },
      { path: '/clientes/crm',           label: 'CRM Tienda Propia',           emoji: '🛍️', perfiles: ['admin'] },
      { path: '/clientes/resenas',       label: 'Panel Reseñas',               emoji: '⭐', perfiles: ['admin'] },
      { path: '/clientes/quejas',        label: 'Quejas',                      emoji: '😡', perfiles: ['admin'] },
      { path: '/clientes',               label: 'Clientes',                    emoji: '👥', perfiles: ['admin'] },
      { path: '/clientes/ficha',         label: 'Ficha Cliente',               emoji: '👤', perfiles: ['admin'] },
      { path: '/clientes/whatsapp',      label: 'Envío WhatsApp desde Ficha',  emoji: '💬', perfiles: ['admin'] },
      { path: '/clientes/email',         label: 'Envío Email desde Ficha',     emoji: '📧', perfiles: ['admin'] },
      { path: '/clientes/articulos',     label: 'Artículos Consumidos',        emoji: '🍽️', perfiles: ['admin'] },
      { path: '/clientes/oportunidades', label: 'Oportunidades',               emoji: '💡', perfiles: ['admin'] },
      { path: '/clientes/embudo',        label: 'Oportunidades por Etapas',    emoji: '🔽', perfiles: ['admin'] },
      { path: '/clientes/oportunidades-gp', label: 'Oport. Ganadas vs Perdidas', emoji: '📊', perfiles: ['admin'] },
      { path: '/clientes/tipologia',     label: 'Oport. por Tipología',        emoji: '🏷️', perfiles: ['admin'] },
      { path: '/clientes/top',           label: 'Top Clientes Facturación',    emoji: '🏆', perfiles: ['admin'] },
      { path: '/clientes/tienda',        label: 'Tienda en Línea',             emoji: '🛒', perfiles: ['admin'] },
      { path: '/clientes/cotizaciones',  label: 'Cotizaciones',                emoji: '📄', perfiles: ['admin'] },
    ],
  },
  {
    key: 'informes', emoji: '📊', label: 'Informes & Estadísticas', perfiles: ['admin'],
    items: [
      { path: '/informes/ventas-hora',     label: 'Ventas por Hora',            emoji: '🕐', perfiles: ['admin'] },
      { path: '/informes/ventas-familia',  label: 'Ventas por Familia',         emoji: '🗂️', perfiles: ['admin'] },
      { path: '/informes/ventas-canal',    label: 'Ventas por Canal',           emoji: '📡', perfiles: ['admin'] },
      { path: '/informes/consumo-platos',  label: 'Consumo Platos por Período', emoji: '🍽️', perfiles: ['admin'] },
      { path: '/informes/comparativa',     label: 'Comparativa Año vs Anterior',emoji: '📅', perfiles: ['admin'] },
      { path: '/informes/mapa',            label: 'Mapa Geográfico Ventas',     emoji: '🗺️', perfiles: ['admin'] },
      { path: '/informes/pagos',           label: 'Pagos Registrados',          emoji: '💳', perfiles: ['admin'] },
      { path: '/informes/mis-ventas',      label: 'Mis Ventas',                 emoji: '📊', perfiles: ['admin'] },
      { path: '/informes/ventas-marca',    label: 'Ventas Marca',               emoji: '🏷️', perfiles: ['admin'] },
      { path: '/informes/margen-canal',    label: 'Margen Canal',               emoji: '📡', perfiles: ['admin'] },
      { path: '/informes/cogs',            label: 'COGS Coste MP',              emoji: '🧾', perfiles: ['admin'] },
      { path: '/informes/ranking',         label: 'Ranking Productos',          emoji: '🏆', perfiles: ['admin'] },
    ],
  },
  {
    key: 'configuracion', emoji: '⚙️', label: 'Configuración', perfiles: ['admin'],
    items: [
      { path: '/configuracion',               label: 'Configuración',                emoji: '⚙️', perfiles: ['admin'] },
      { path: '/configuracion/roles',         label: 'Roles y Permisos',             emoji: '🔐', perfiles: ['admin'] },
      { path: '/configuracion/usuarios',      label: 'Usuarios',                     emoji: '👤', perfiles: ['admin'] },
      { path: '/configuracion/filtros',       label: 'Filtros Múltiples',            emoji: '🔍', perfiles: ['admin'] },
      { path: '/configuracion/busqueda',      label: 'Búsqueda Avanzada',            emoji: '🔎', perfiles: ['admin'] },
      { path: '/configuracion/app-movil',     label: 'App Móvil Accesos',            emoji: '📱', perfiles: ['admin'] },
      { path: '/configuracion/favoritos',     label: 'Panel Favoritos',              emoji: '⭐', perfiles: ['admin'] },
      { path: '/configuracion/acciones',      label: 'Acciones Rápidas',             emoji: '🚀', perfiles: ['admin'] },
    ],
  },
]

// ─── LogoSL ───────────────────────────────────────────────────────────────────

function LogoSL({ small = false }: { small?: boolean }) {
  const size = small ? 32 : 36
  const [fallback, setFallback] = useState(false)
  if (fallback) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: RED, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Impact, sans-serif', fontSize: 13, letterSpacing: '0.02em', flexShrink: 0 }}>SL</div>
    )
  }
  return (
    <img src="/data/logo-icon.svg" onError={() => setFallback(true)} alt="Streat Lab" width={size} height={size} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { usuario, logout } = useAuth()
  const { collapsed, toggle } = useSidebarState()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const perfil = usuario?.perfil ?? ''
  // FIFO accordion: max 2 sections open simultaneously
  const [openSections, setOpenSections] = useState<string[]>([])

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      if (prev.includes(key)) return prev.filter(s => s !== key)
      const next = [...prev, key]
      if (next.length > 2) next.shift()
      return next
    })
  }

  const filterItems = (items: NavItem[]) => items.filter(i => i.perfiles.includes(perfil))
  const width = collapsed ? 'w-[56px]' : 'w-[260px]'


  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />}

      <aside
        style={{ background: 'var(--sl-sidebar)', position: 'relative' }}
        className={`
          fixed top-0 left-0 z-40 h-full border-r border-[var(--sl-border)]
          flex flex-col transition-all duration-200
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
          ${width}
        `}
      >
        {/* Botón circular colapsar/expandir — flecha SVG rotatoria */}
        <button
          type="button"
          onClick={e => { e.preventDefault(); e.stopPropagation(); toggle() }}
          style={{
            position: 'absolute',
            top: 16,
            right: -12,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: isDark ? '#2a3050' : '#e8e4de',
            border: `1px solid ${isDark ? '#3a4058' : '#d0c8bc'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            padding: 0,
          }}
          className="hidden lg:flex"
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isDark ? '#9ba8c0' : '#5a6478'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s ease' }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Header */}
        {collapsed ? (
          <div className="border-b border-[var(--sl-border)] flex items-center justify-center min-h-[72px] py-2">
            <LogoSL small />
          </div>
        ) : (
          <div className="p-3 border-b border-[var(--sl-border)] flex items-center min-h-[72px]">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <LogoSL />
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, color: isDark ? '#f0f0ff' : '#111111', letterSpacing: '3px' }}>STREAT LAB</span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto" style={{ overflowX: 'hidden' }}>

          {/* Panel Global — direct link, no accordion */}
          {PANEL_GLOBAL.perfiles.includes(perfil) && (
            collapsed ? (
              <NavLink to={PANEL_GLOBAL.path} end onClick={() => { toggle(); onClose() }} title={PANEL_GLOBAL.label}
                className="flex items-center justify-center transition-colors"
                style={({ isActive }) => ({ width: 56, height: 44, color: isActive ? ACCENT : 'var(--sl-text-nav)', background: isActive ? 'rgba(232,244,66,0.12)' : 'transparent' })}>
                {({ isActive }) => <NavIcon section="panel" collapsed isDark={isDark} active={isActive} size={24} />}
              </NavLink>
            ) : (
              <NavLink to={PANEL_GLOBAL.path} end onClick={onClose}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%',
                  padding: '10px 16px 10px 12px',
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: 11,
                  fontWeight: 400,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em',
                  color: isActive ? '#1a1a1a' : 'var(--sl-text-secondary)',
                  background: isActive ? ACCENT : 'transparent',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'background 150ms',
                })}
                className={({ isActive }) => `sl-nav-item${isActive ? ' sl-nav-active' : ''}`}>
                {({ isActive }) => (
                  <>
                    <NavIcon section="panel" collapsed={false} isDark={isDark} active={isActive} size={24} />
                    <span>{PANEL_GLOBAL.label}</span>
                  </>
                )}
              </NavLink>
            )
          )}

          {/* Sections */}
          {SECTIONS.map(section => {
            const visibleItems = filterItems(section.items)
            if (!section.perfiles.includes(perfil) || visibleItems.length === 0) return null
            const isOpen = openSections.includes(section.key)

            return (
              <div key={section.key}>
                {/* Section header */}
                {collapsed ? (
                  <button
                    type="button"
                    onClick={() => {
                      // Asegurar que la sección queda abierta al expandir
                      if (!openSections.includes(section.key)) {
                        setOpenSections(prev => {
                          const next = [...prev, section.key]
                          if (next.length > 2) next.shift()
                          return next
                        })
                      }
                      toggle()
                    }}
                    title={section.label}
                    style={{
                      width: 56, height: 40, background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: isOpen ? 1 : 0.7,
                    }}
                  >
                    <NavIcon section={section.key} collapsed isDark={isDark} active={isOpen} size={24} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 16px 10px 12px',
                      fontFamily: 'Oswald, sans-serif', fontSize: 11,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: isOpen ? 'var(--sl-text-secondary)' : 'var(--sl-text-muted)',
                      transition: 'color 200ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <NavIcon section={section.key} collapsed={false} isDark={isDark} size={24} />
                      <span>{section.label}</span>
                    </div>
                    <span style={{ fontSize: 11, transition: 'transform 300ms', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>›</span>
                  </button>
                )}

                {/* Section items — animated (expanded) */}
                {!collapsed && (
                  <div style={{ maxHeight: isOpen ? `${visibleItems.length * 36}px` : 0, overflow: 'hidden', transition: 'max-height 300ms ease' }}>
                    {visibleItems.map((item, idx) => (
                      <NavLink
                        key={`${item.path}-${idx}`}
                        to={item.path}
                        end={item.path === '/'}
                        onClick={onClose}
                        style={({ isActive }) => ({
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 12px 6px 16px',
                          margin: '1px 8px',
                          borderRadius: 6,
                          fontFamily: 'Lexend, sans-serif',
                          fontSize: 13,
                          color: isActive ? '#1a1a1a' : 'var(--sl-text-nav)',
                          background: isActive ? ACCENT : 'transparent',
                          textDecoration: 'none',
                          cursor: 'pointer',
                          transition: 'background 150ms',
                          whiteSpace: 'nowrap' as const,
                          overflow: 'hidden',
                        })}
                        className={({ isActive }) => `sl-nav-item${isActive ? ' sl-nav-active' : ''}`}
                      >
                        {({ isActive }) => {
                          const iconColor = isActive ? '#1a1a1a' : (isDark ? '#c8d0e8' : '#5a6478')
                          const icon = SUBITEM_ICONS[item.label]
                          return (
                            <>
                              <span style={{ color: iconColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, flexShrink: 0 }}>
                                {icon ?? <span style={{ fontSize: 8, lineHeight: 1 }}>●</span>}
                              </span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                            </>
                          )
                        }}
                      </NavLink>
                    ))}
                  </div>
                )}

                {/* Collapsed: show icons only when section is "open" (tap) */}
                {collapsed && isOpen && visibleItems.slice(0, 8).map((item, idx) => (
                  <NavLink
                    key={`${item.path}-${idx}`}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => { toggle(); onClose() }}
                    title={item.label}
                    className="flex items-center justify-center transition-colors"
                    style={({ isActive }) => ({ width: 56, height: 40, fontSize: 16, color: isActive ? ACCENT : 'var(--sl-text-nav)', background: isActive ? 'rgba(232,244,66,0.12)' : 'transparent' })}
                  >
                    {item.emoji}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>

        {/* Botón tema — sol/luna, siempre visible */}
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: collapsed ? 0 : 8,
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '10px' : '10px 16px',
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderTop: `0.5px solid ${isDark ? '#2a3050' : '#d0c8bc'}`,
          }}
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#9ba8c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#5a6478" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
            </svg>
          )}
          {!collapsed && (
            <span style={{ fontFamily: 'Lexend,sans-serif', fontSize: 12, color: isDark ? '#9ba8c0' : '#5a6478' }}>
              {isDark ? 'Modo claro' : 'Modo oscuro'}
            </span>
          )}
        </button>

        {/* Footer user */}
        <div className={`p-3 border-t border-[var(--sl-border)] ${collapsed ? 'text-center' : ''}`} style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-muted)' }}>
          {!collapsed ? (
            <>
              <div className="mb-2 truncate">{usuario?.nombre} — <span style={{ color: ACCENT }}>{usuario?.perfil}</span></div>
              <button onClick={logout} className="text-[var(--sl-text-muted)] hover:text-[var(--sl-border-error)] transition-colors text-xs">Cerrar sesión</button>
            </>
          ) : (
            <button onClick={logout} className="text-[var(--sl-text-muted)] hover:text-[var(--sl-border-error)] transition-colors text-sm" title="Cerrar sesión">⏏</button>
          )}
        </div>
      </aside>
    </>
  )
}
