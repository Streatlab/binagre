import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INK, CREMA, OSW, LEX, SHADOW } from '@/styles/neobrutal'

type Item = { label: string; path: string; group: string }

const ITEMS: Item[] = [
  { label: 'Dashboard', path: '/', group: 'General' },
  { label: 'Escandallo', path: '/escandallo', group: 'General' },
  { label: 'Carta', path: '/carta', group: 'General' },
  { label: 'Panel global', path: '/panel', group: 'General' },
  { label: 'Panel dirección', path: '/panel-direccion', group: 'General' },
  { label: 'Tareas', path: '/tareas', group: 'General' },

  { label: 'Papeleo', path: '/finanzas/papeleo', group: 'Finanzas' },
  { label: 'Tesorería', path: '/finanzas/tesoreria', group: 'Finanzas' },
  { label: 'Estados Financieros', path: '/finanzas/resultados', group: 'Finanzas' },
  { label: 'Rentabilidad', path: '/finanzas/rentabilidad', group: 'Finanzas' },
  { label: 'Panel de Alertas', path: '/finanzas/panel-alertas', group: 'Finanzas' },
  { label: 'Bandeja pendientes', path: '/finanzas/pendientes', group: 'Finanzas' },

  { label: 'Ventas', path: '/finanzas/ventas-panel', group: 'Ventas y Clientes' },
  { label: 'Analítica (margen, marca, pareto)', path: '/ventas/analitica', group: 'Ventas y Clientes' },
  { label: 'Clientes (CRM + Club)', path: '/ventas/clientes', group: 'Ventas y Clientes' },
  { label: 'Marketing', path: '/ventas/marketing', group: 'Ventas y Clientes' },

  { label: 'Escandallo', path: '/escandallo', group: 'Cocina' },
  { label: 'Recetario', path: '/cocina/recetario', group: 'Cocina' },
  { label: 'Producción', path: '/cocina/produccion', group: 'Cocina' },
  { label: 'Carta', path: '/carta', group: 'Cocina' },
  { label: 'Menú Engineering', path: '/cocina/menu-engineering', group: 'Cocina' },
  { label: 'Recetas (cocina)', path: '/cocina/recetas', group: 'Cocina' },
  { label: 'Esquemas', path: '/cocina/esquemas', group: 'Cocina' },

  { label: 'Lista de compra', path: '/compras', group: 'Compras' },
  { label: 'Inventario', path: '/compras/inventario', group: 'Compras' },
  { label: 'Proveedores', path: '/compras/proveedores', group: 'Compras' },
  { label: 'Catálogos · Compras', path: '/configuracion/compras/categorias', group: 'Compras' },

  { label: 'Registro diario', path: '/ops/registro-diario', group: 'Operaciones' },
  { label: 'Mantenimiento', path: '/ops/mantenimiento', group: 'Operaciones' },
  { label: 'Calidad (BPM + Manuales)', path: '/ops/calidad', group: 'Operaciones' },
  { label: 'Reclamaciones', path: '/ops/reembolsos', group: 'Operaciones' },
  { label: 'Reuniones equipo', path: '/ops/reuniones', group: 'Operaciones' },
  { label: 'Marcas', path: '/marcas', group: 'Operaciones' },
  { label: 'Equipo', path: '/equipo', group: 'Operaciones' },
  { label: 'Portal del empleado', path: '/equipo/portal', group: 'Operaciones' },

  { label: 'Configuración', path: '/configuracion', group: 'Ajustes' },
  { label: 'Integraciones / Marcas', path: '/configuracion/integraciones', group: 'Ajustes' },
  { label: 'Reglas', path: '/configuracion/reglas', group: 'Ajustes' },
  { label: 'Bancos y cuentas', path: '/configuracion/bancos-y-cuentas', group: 'Ajustes' },
  { label: 'Usuarios', path: '/configuracion/usuarios', group: 'Ajustes' },
  { label: 'Informes', path: '/informes', group: 'Ajustes' },
  { label: 'Importar ventas', path: '/importar-ventas', group: 'Ajustes' },
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
                color: idx === sel ? '#fff' : INK,
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
