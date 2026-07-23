import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INK, CREMA, OSW, LEX, SHADOW, BLANCO } from '@/styles/neobrutal'

type Item = { label: string; path: string; group: string }

const ITEMS: Item[] = [
  { label: 'Dashboard', path: '/', group: 'General' },
  { label: 'Hoy (cocina)', path: '/cocina/hoy', group: 'General' },
  { label: 'Escandallo / Datos', path: '/cocina/dinero/datos', group: 'General' },
  { label: 'Carta', path: '/cocina/operativa/recetas/carta', group: 'General' },
  { label: 'Panel global', path: '/panel', group: 'General' },
  { label: 'Panel dirección', path: '/panel-direccion', group: 'General' },
  { label: 'Tareas', path: '/tareas', group: 'General' },

  { label: 'Papeleo', path: '/finanzas/papeleo?tab=bandeja', group: 'Finanzas' },
  { label: 'Facturación', path: '/finanzas/papeleo?tab=facturacion', group: 'Finanzas' },
  { label: 'Conciliación', path: '/finanzas/papeleo?tab=conciliacion', group: 'Finanzas' },
  { label: 'Gestión de facturas', path: '/finanzas/papeleo?tab=documental', group: 'Finanzas' },
  { label: 'Gestoría', path: '/finanzas/papeleo?tab=gestoria', group: 'Finanzas' },
  { label: 'Bandeja pendientes', path: '/finanzas/pendientes', group: 'Finanzas' },

  { label: 'Ventas', path: '/finanzas/ventas-panel?tab=ventas', group: 'Finanzas' },
  { label: 'Objetivos', path: '/finanzas/ventas-panel?tab=objetivos', group: 'Finanzas' },
  { label: 'Ticket medio', path: '/finanzas/ventas-panel?tab=ticket', group: 'Finanzas' },
  { label: 'Repetición de clientes', path: '/finanzas/ventas-panel?tab=repeticion', group: 'Finanzas' },

  { label: 'Tesorería', path: '/finanzas/tesoreria?tab=calendario', group: 'Finanzas' },
  { label: 'Fondo & Reserva', path: '/finanzas/tesoreria?tab=reserva', group: 'Finanzas' },
  { label: 'Escenarios tesorería', path: '/finanzas/tesoreria?tab=escenarios', group: 'Finanzas' },
  { label: 'Tesorería 13 semanas', path: '/finanzas/tesoreria?tab=13semanas', group: 'Finanzas' },
  { label: 'Salud financiera', path: '/finanzas/tesoreria?tab=salud', group: 'Finanzas' },

  { label: 'Running (P&L anual)', path: '/finanzas/resultados?tab=running', group: 'Finanzas' },
  { label: 'P&G', path: '/finanzas/resultados?tab=pyg', group: 'Finanzas' },
  { label: 'Estados financieros', path: '/finanzas/resultados?tab=estados', group: 'Finanzas' },
  { label: 'Evolución (Horiz./Vert.)', path: '/finanzas/resultados?tab=evolucion', group: 'Finanzas' },

  { label: 'Punto de equilibrio', path: '/finanzas/rentabilidad?tab=equilibrio', group: 'Finanzas' },
  { label: 'Break-even marca/canal', path: '/finanzas/rentabilidad?tab=marca-canal', group: 'Finanzas' },
  { label: 'ROI por canal', path: '/finanzas/rentabilidad?tab=roi', group: 'Finanzas' },
  { label: 'Rentabilidad por franja', path: '/finanzas/rentabilidad?tab=franja', group: 'Finanzas' },

  { label: 'Revenue / Ticket medio', path: '/analytics/revenue', group: 'Analytics' },
  { label: 'Margen por canal', path: '/analytics/margen', group: 'Analytics' },
  { label: 'Ventas por marca', path: '/analytics/ventas-marca', group: 'Analytics' },
  { label: 'Predicción demanda', path: '/analytics/demanda', group: 'Analytics' },
  { label: 'Pareto ventas', path: '/analytics/pareto-ventas', group: 'Analytics' },

  { label: 'Hoy', path: '/cocina/hoy', group: 'Cocina' },
  { label: 'Plato Maestro', path: '/cocina/operativa/plato-maestro', group: 'Cocina' },
  { label: 'Análisis (Menú Engineering)', path: '/cocina/dinero/analisis', group: 'Cocina' },
  { label: 'Pareto ingredientes', path: '/cocina/dinero/analisis/pareto', group: 'Cocina' },
  { label: 'Coste por plato', path: '/cocina/dinero/analisis/coste', group: 'Cocina' },
  { label: 'Libro de Recetas', path: '/cocina/operativa/recetas', group: 'Cocina' },
  { label: 'Producción', path: '/cocina/operativa/produccion', group: 'Cocina' },
  { label: 'Menú familia', path: '/cocina/operativa/recetas/menu-familia', group: 'Cocina' },
  { label: 'Inventario cocina', path: '/cocina/inventario', group: 'Cocina' },
  { label: 'Lista de compra', path: '/compras', group: 'Cocina' },
  { label: 'Inventario (stock)', path: '/compras/inventario', group: 'Cocina' },
  { label: 'Catálogo de platos (alias)', path: '/cocina/platos-maestros', group: 'Cocina' },

  { label: 'Reclamaciones / Reembolsos', path: '/ops/reembolsos', group: 'Operativa' },
  { label: 'Control temperaturas', path: '/ops/temperaturas', group: 'Operativa' },
  { label: 'Checklists apertura/cierre', path: '/ops/checklists', group: 'Operativa' },
  { label: 'Tareas operativas', path: '/ops/tareas', group: 'Operativa' },
  { label: 'Manuales operaciones', path: '/ops/manuales', group: 'Operativa' },
  { label: 'Bitácora novedades', path: '/ops/bitacora', group: 'Operativa' },
  { label: 'Libro de equipos', path: '/ops/equipos', group: 'Operativa' },
  { label: 'Daños / menaje', path: '/ops/danos', group: 'Operativa' },
  { label: 'Pedidos menaje', path: '/ops/pedidos-menaje', group: 'Operativa' },
  { label: 'Pulso Operativa', path: '/ops/pulso', group: 'Operativa' },
  { label: 'BPM Calidad', path: '/ops/bpm', group: 'Operativa' },
  { label: 'Reuniones equipo', path: '/ops/reuniones', group: 'Operativa' },
  { label: 'Fichas técnicas / recetas', path: '/ops/recetas', group: 'Operativa' },

  { label: 'Equipo', path: '/equipo', group: 'Equipo' },
  { label: 'Organigrama', path: '/equipo/organigrama', group: 'Equipo' },
  { label: 'Horarios', path: '/equipo/horarios', group: 'Equipo' },
  { label: 'Control presencia', path: '/equipo/presencia', group: 'Equipo' },

  { label: 'Club fidelización', path: '/clientes/club', group: 'Clientes' },
  { label: 'CRM tienda propia', path: '/clientes/crm', group: 'Clientes' },
  { label: 'Panel reseñas', path: '/clientes/resenas', group: 'Clientes' },
  { label: 'Playbook Think Paladar', path: '/clientes/playbook-tp', group: 'Clientes' },
  { label: 'Benchmark', path: '/clientes/benchmark', group: 'Clientes' },

  { label: 'Panel MKT', path: '/marketing/panel', group: 'Marketing' },
  { label: 'Plan de campañas', path: '/marketing/plan', group: 'Marketing' },
  { label: 'Rendimiento ads/promo', path: '/marketing/rendimiento-ads-promo', group: 'Marketing' },

  { label: 'Informes', path: '/informes', group: 'Informes' },
  { label: 'Destinatarios', path: '/informes/destinatarios', group: 'Informes' },
  { label: 'Historial informes', path: '/informes/historial', group: 'Informes' },
  { label: 'Configuración informes', path: '/informes/configuracion', group: 'Informes' },
  { label: 'Importar ventas', path: '/importar-ventas', group: 'Informes' },

  { label: 'Integraciones / Marcas', path: '/configuracion/integraciones', group: 'Configuración' },
  { label: 'Reglas', path: '/configuracion/reglas', group: 'Configuración' },
  { label: 'Bancos y cuentas', path: '/configuracion/bancos-y-cuentas', group: 'Configuración' },
  { label: 'Compras', path: '/configuracion/compras', group: 'Configuración' },
  { label: 'Usuarios', path: '/configuracion/usuarios', group: 'Configuración' },
  { label: 'Calendario', path: '/configuracion/calendario', group: 'Configuración' },
  { label: 'Aprendizajes', path: '/configuracion/aprendizajes', group: 'Configuración' },
]

function normaliza(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === 'k'
      if (e.altKey && isK) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const results = useMemo(() => {
    if (!q.trim()) return ITEMS
    const nq = normaliza(q)
    return ITEMS.filter((i) => normaliza(i.label).includes(nq) || normaliza(i.group).includes(nq))
  }, [q])

  useEffect(() => setSel(0), [q])

  function goTo(item: Item) {
    setOpen(false)
    navigate(item.path)
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[sel]) goTo(results[sel])
    }
  }

  if (!open) return null

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,10,10,0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          background: CREMA,
          border: `3px solid ${INK}`,
          boxShadow: SHADOW,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ borderBottom: `3px solid ${INK}`, padding: '10px 14px' }}>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Buscar módulo…"
            style={{
              width: '100%', border: 'none', outline: 'none', background: 'transparent',
              fontFamily: LEX, fontSize: 16, color: INK,
            }}
          />
        </div>
        <div style={{ overflowY: 'auto' }}>
          {results.length === 0 && (
            <div style={{ padding: 16, fontFamily: LEX, fontSize: 14, color: INK, opacity: 0.6 }}>
              Sin resultados
            </div>
          )}
          {results.map((item, idx) => (
            <div
              key={item.path + item.label}
              onMouseEnter={() => setSel(idx)}
              onClick={() => goTo(item)}
              style={{
                padding: '10px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: idx === sel ? INK : 'transparent',
                color: idx === sel ? BLANCO : INK,
                cursor: 'pointer',
                fontFamily: LEX, fontSize: 14,
              }}
            >
              <span>{item.label}</span>
              <span style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1px', opacity: 0.6, textTransform: 'uppercase' }}>
                {item.group}
              </span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `3px solid ${INK}`, padding: '6px 14px', fontFamily: LEX, fontSize: 11, color: INK, opacity: 0.6 }}>
          Alt+K abre · ↑↓ moverse · Enter abrir · Esc cerrar
        </div>
      </div>
    </div>
  )
}
