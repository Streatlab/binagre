/**
 * PanelGlobal — Módulo Panel Global del ERP Binagre
 * Spec: .claude/plans/spec-mockups-validados.md · FASE A
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import TabsPastilla from '@/components/ui/TabsPastilla'
import TabResumen from '@/components/panel/resumen/TabResumen'
import { COLORS, FONT } from '@/components/panel/resumen/tokens'
import type { RowFacturacion } from '@/components/panel/resumen/types'

/* ── Tipos ─────────────────────────────────────── */
interface MarcaItem {
  id: string
  nombre: string
}

type TabId = 'resumen' | 'operaciones' | 'finanzas' | 'cashflow' | 'marcas'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'resumen',     label: 'Resumen' },
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'finanzas',    label: 'Finanzas' },
  { id: 'cashflow',    label: 'Cashflow' },
  { id: 'marcas',      label: 'Marcas' },
]

const CANALES_DISPONIBLES = [
  { id: 'uber',  label: 'Uber Eats' },
  { id: 'glovo', label: 'Glovo' },
  { id: 'je',    label: 'Just Eat' },
  { id: 'web',   label: 'Web' },
  { id: 'dir',   label: 'Directa' },
]

const dropdownBtn: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '0.5px solid #d0c8bc',
  background: '#ffffff',
  fontSize: 13,
  fontFamily: 'Lexend, sans-serif',
  color: '#111111',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
  position: 'relative',
}

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 38,
  right: 0,
  background: '#ffffff',
  border: '0.5px solid #d0c8bc',
  borderRadius: 8,
  width: 220,
  fontSize: 12,
  color: '#3a4050',
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  zIndex: 100,
  maxHeight: 360,
  overflowY: 'auto',
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* ── Dropdown multiselect genérico ─────────────── */
function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  onAll,
}: {
  label: string
  options: Array<{ id: string; label: string }>
  selected: string[]
  onToggle: (id: string) => void
  onAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function click(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  const displayLabel = selected.length === 0 || selected.length === options.length
    ? label
    : `${selected.length} sel.`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button style={dropdownBtn} onClick={() => setOpen(o => !o)}>
        <span>{displayLabel}</span>
        <ChevronDown size={11} strokeWidth={2.5} style={{ marginLeft: 4 }} />
      </button>
      {open && (
        <div style={menuStyle}>
          <button
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '8px 12px', background: 'transparent', border: 'none',
              fontSize: 13, fontFamily: 'Lexend, sans-serif', color: '#7a8090', cursor: 'pointer',
              borderBottom: '0.5px solid #ebe8e2',
            }}
            onClick={() => { onAll(); setOpen(false) }}
          >
            Todos
          </button>
          {options.map(o => (
            <label
              key={o.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '3px 8px', cursor: 'pointer',
                lineHeight: 1.2,
                background: selected.includes(o.id) ? '#FF475715' : 'transparent',
                color: selected.includes(o.id) ? '#FF4757' : '#7a8090',
                fontFamily: 'Lexend, sans-serif', fontSize: 12,
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={() => onToggle(o.id)}
                style={{ accentColor: '#FF4757' }}
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Subtítulo dinámico ─────────────────────────── */
function buildSubtitulo(label: string, desde: Date, hasta: Date): string {
  const fmtDate = (d: Date) => {
    const dia = d.getDate()
    const mes = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
    const anio = d.getFullYear()
    return `${dia} ${mes} ${anio}`
  }
  return `${label} · ${fmtDate(desde)} — ${fmtDate(hasta)}`
}

/* ── Placeholder para tabs no implementados ─────── */
function TabPlaceholder({ nombre }: { nombre: string }) {
  return (
    <div style={{
      padding: 40,
      textAlign: 'center',
      color: '#7a8090',
      fontFamily: 'Lexend, sans-serif',
      fontSize: 14,
    }}>
      {nombre} · Próximamente
    </div>
  )
}

/* ── PanelGlobal ────────────────────────────────── */
export default function PanelGlobal() {
  const [activeTab, setActiveTab] = useState<TabId>('resumen')
  const [periodoLabel, setPeriodoLabel] = useState('Mes en curso')
  const [fechaDesde, setFechaDesde] = useState<Date>(() => new Date(2026, 3, 1))
  const [fechaHasta, setFechaHasta] = useState<Date>(() => new Date(2026, 3, 30))
  const [marcasFiltro, setMarcasFiltro] = useState<string[]>([])
  const [canalesFiltro, setCanalesFiltro] = useState<string[]>([])
  const [marcasDisp, setMarcasDisp] = useState<MarcaItem[]>([])
  const [rowsPeriodo, setRowsPeriodo] = useState<RowFacturacion[]>([])
  const [rowsAll, setRowsAll] = useState<RowFacturacion[]>([])

  /* Cargar marcas activas */
  useEffect(() => {
    supabase.from('marcas').select('id,nombre').eq('estado', 'activa').then(({ data }) => {
      if (data) setMarcasDisp(data as MarcaItem[])
    })
  }, [])

  /* Cargar facturación cuando cambia periodo */
  useEffect(() => {
    const desde = toLocalDateStr(fechaDesde)
    const hasta  = toLocalDateStr(fechaHasta)
    supabase
      .from('facturacion_diario')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true })
      .then(({ data }) => {
        setRowsPeriodo((data ?? []) as RowFacturacion[])
      })
  }, [fechaDesde, fechaHasta])

  /* Cargar todo para cálculos de delta */
  useEffect(() => {
    const anoActual = new Date().getFullYear()
    supabase
      .from('facturacion_diario')
      .select('*')
      .gte('fecha', `${anoActual - 1}-01-01`)
      .order('fecha', { ascending: true })
      .then(({ data }) => {
        setRowsAll((data ?? []) as RowFacturacion[])
      })
  }, [])

  const handleFecha = useCallback((desde: Date, hasta: Date, label: string) => {
    setFechaDesde(desde)
    setFechaHasta(hasta)
    setPeriodoLabel(label)
  }, [])

  const subtitulo = buildSubtitulo(periodoLabel, fechaDesde, fechaHasta)

  /* Opciones marcas para el multiselect */
  const marcasOpts = marcasDisp.map(m => ({ id: m.id, label: m.nombre }))

  return (
    <div style={{
      background: COLORS.bg,
      minHeight: '100vh',
      padding: '24px 28px',
      fontFamily: FONT.body,
      color: COLORS.pri,
    }}>
      {/* HEADER A.1 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 18,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {/* Izquierda */}
        <div>
          <div style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: 22,
            fontWeight: 600,
            color: COLORS.redSL,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}>
            PANEL GLOBAL
          </div>
          <div style={{
            fontFamily: 'Lexend, sans-serif',
            fontSize: 13,
            color: COLORS.mut,
            marginTop: 2,
          }}>
            {subtitulo}
          </div>
        </div>

        {/* Derecha: 3 dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SelectorFechaUniversal
            nombreModulo="panel_global"
            defaultOpcion="mes_en_curso"
            onChange={handleFecha}
          />
          <MultiSelect
            label="Todas las marcas"
            options={marcasOpts}
            selected={marcasFiltro}
            onToggle={id => setMarcasFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            onAll={() => setMarcasFiltro([])}
          />
          <MultiSelect
            label="Canales"
            options={CANALES_DISPONIBLES}
            selected={canalesFiltro}
            onToggle={id => setCanalesFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            onAll={() => setCanalesFiltro([])}
          />
        </div>
      </div>

      {/* TABS PASTILLA A.2 */}
      <TabsPastilla
        tabs={TABS}
        activeId={activeTab}
        onChange={id => setActiveTab(id as TabId)}
      />

      {/* CONTENIDO */}
      {activeTab === 'resumen' && (
        <TabResumen
          rowsPeriodo={rowsPeriodo}
          rowsAll={rowsAll}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
          canalesFiltro={canalesFiltro}
        />
      )}
      {activeTab === 'operaciones' && <TabPlaceholder nombre="Operaciones" />}
      {activeTab === 'finanzas'    && <TabPlaceholder nombre="Finanzas" />}
      {activeTab === 'cashflow'    && <TabPlaceholder nombre="Cashflow" />}
      {activeTab === 'marcas'      && <TabPlaceholder nombre="Marcas" />}
    </div>
  )
}
