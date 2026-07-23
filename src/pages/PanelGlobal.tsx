/**
 * PanelGlobal — Módulo Panel Global del ERP Binagre. Único estilo: Neobrutal.
 *
 * La franja "HOY EN VIVO" vive dentro del Resumen (ResumenLanding), no aquí.
 *
 * FUENTE DE DATOS (14 jul 2026):
 *   Lee de la vista `v_facturacion_diario_unificada`, NO de la tabla `facturacion_diario`.
 *   La vista = facturación del robot (por servicio) + fila complementaria con lo que el robot
 *   EN VIVO (Rushour) ya ha visto y aún no está facturado. Nunca resta ni pisa: solo completa.
 *   Así el Resumen, la Evolución y las tarjetas de abajo cuadran con la franja "hoy en vivo".
 *   El neto de esas ventas lo resuelve siempre netoResolver (LEY-NETO-01 / LEY-NETO-02).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import TabsPastilla from '@/components/ui/TabsPastilla'
import RutaPantalla from '@/components/ui/RutaPantalla'
import TabResumen from '@/components/panel/resumen/TabResumen'
import TabOperaciones from '@/components/panel/TabOperaciones'
import TabFinanzas from '@/components/panel/TabFinanzas'
import Cashflow from '@/pages/finanzas/Cashflow'
import TabMarcas from '@/components/panel/TabMarcas'
import TabEvolucion from '@/components/panel/TabEvolucion'
import { COLORS, FONT } from '@/components/panel/resumen/tokens'
import type { RowFacturacion } from '@/components/panel/resumen/types'
import { toLocalDateStr } from '@/lib/dateRange'
import { ROSA } from '@/styles/neobrutal'

interface MarcaItem { id: string; nombre: string }

type TabId = 'resumen' | 'operaciones' | 'finanzas' | 'cashflow' | 'evolucion' | 'marcas'

/** Vista unificada: facturación del robot + lo que el robot en vivo ve de más. */
const FUENTE_VENTAS = 'v_facturacion_diario_unificada'

// Theme-aware: fondo e INK salen de variables → cambian solos en claro/oscuro
const PAGE_BG = 'var(--neo-bg)'
const INK = 'var(--neo-ink)'
const SHADOW = `3px 3px 0 var(--neo-shadow-color)`

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'resumen',     label: 'Resumen' },
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'finanzas',    label: 'Finanzas' },
  { id: 'cashflow',    label: 'Cashflow' },
  { id: 'evolucion',   label: 'Evolución' },
  { id: 'marcas',      label: 'Marcas' },
]

const CANALES_DISPONIBLES = [
  { id: 'uber',  label: 'Uber Eats' },
  { id: 'glovo', label: 'Glovo' },
  { id: 'je',    label: 'Just Eat' },
  { id: 'web',   label: 'Web' },
  { id: 'dir',   label: 'Directa' },
]

// CANTERA ALEGRE v4: los filtros son secundarios — planos, sin sombra, unificados,
// con etiqueta pequeña delante. La única pieza con cuerpo es la plancha de pestañas.
const dropdownBtn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 0,
  border: `2px solid ${INK}`,
  background: 'var(--sl-card)',
  fontSize: 13,
  fontFamily: "'Lexend', sans-serif",
  fontWeight: 600,
  color: INK,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  whiteSpace: 'nowrap',
  position: 'relative',
}

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 50,
  right: 0,
  background: 'var(--sl-card)',
  border: `3px solid ${INK}`,
  borderRadius: 0,
  width: 280,
  fontSize: 13,
  color: INK,
  boxShadow: SHADOW,
  zIndex: 100,
  maxHeight: 360,
  overflowY: 'auto',
  paddingTop: 2,
  paddingBottom: 2,
}


function MultiSelect({
  label, etiqueta, caretColor = ROSA, options, selected, onToggle, onAll,
}: {
  label: string
  etiqueta: string
  caretColor?: string
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
    ? label : `${selected.length} sel.`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button style={dropdownBtn} onClick={() => setOpen(o => !o)}>
        <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--sl-text-secondary)' }}>{etiqueta}</span>
        <span>{displayLabel}</span>
        <ChevronDown size={14} strokeWidth={3} style={{ marginLeft: 2, color: caretColor }} />
      </button>
      {open && (
        <div style={menuStyle}>
          <button
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '9px 12px', background: 'transparent', border: 'none',
              fontSize: 13, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, color: INK, cursor: 'pointer',
              borderBottom: `2px solid ${INK}`,
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
                padding: '7px 12px', cursor: 'pointer', lineHeight: 1.3,
                background: selected.includes(o.id) ? `${ROSA}1f` : 'transparent',
                color: INK,
                fontFamily: 'Lexend, sans-serif', fontSize: 13, whiteSpace: 'nowrap',
                borderBottom: `1px solid var(--sl-border)`,
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={() => onToggle(o.id)}
                style={{ accentColor: ROSA }}
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function buildSubtitulo(label: string, desde: Date, hasta: Date): string {
  const fmtDate = (d: Date) => {
    const dia = d.getDate()
    const mes = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
    const anio = d.getFullYear()
    return `${dia} ${mes} ${anio}`
  }
  return `${label} · ${fmtDate(desde)} — ${fmtDate(hasta)}`
}

export default function PanelGlobal() {
  const [activeTab, setActiveTab] = useState<TabId>('resumen')
  const [periodoLabel, setPeriodoLabel] = useState('Mes en curso')
  const [fechaDesde, setFechaDesde] = useState<Date>(() => new Date(2026, 3, 1))
  const [fechaHasta, setFechaHasta] = useState<Date>(() => new Date(2026, 3, 30))
  const [marcasFiltro, setMarcasFiltro] = useState<string[]>([])
  const [canalesFiltro, setCanalesFiltro] = useState<string[]>([])
  const [marcasDisp, setMarcasDisp] = useState<MarcaItem[]>([])
  const [accesos, setAccesos] = useState<Array<{ marca_id: string; plataforma: string }>>([])
  const [rowsPeriodo, setRowsPeriodo] = useState<RowFacturacion[]>([])
  const [rowsAll, setRowsAll] = useState<RowFacturacion[]>([])
  const [tickVivo, setTickVivo] = useState(0)

  useEffect(() => {
    supabase.from('marcas').select('id,nombre').eq('activa', true).then(({ data }) => {
      if (data) setMarcasDisp(data as MarcaItem[])
    })
    // Configuración real marca↔canal: al elegir canal, Marcas solo enseña las dadas de alta ahí
    supabase.from('marca_plataforma_acceso').select('marca_id,plataforma').eq('activo', true).then(({ data }) => {
      if (data) setAccesos(data as Array<{ marca_id: string; plataforma: string }>)
    })
  }, [])

  /* Refresco al entrar un snapshot nuevo del robot en vivo: el panel se recalcula solo. */
  useEffect(() => {
    const ch = supabase
      .channel('ventas_vivo_panel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ventas_vivo' }, () => {
        setTickVivo(t => t + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    const desde = toLocalDateStr(fechaDesde)
    const hasta  = toLocalDateStr(fechaHasta)
    supabase
      .from(FUENTE_VENTAS).select('*')
      .gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: true })
      .then(({ data }) => { setRowsPeriodo((data ?? []) as RowFacturacion[]) })
  }, [fechaDesde, fechaHasta, tickVivo])

  useEffect(() => {
    const anoActual = new Date().getFullYear()
    supabase
      .from(FUENTE_VENTAS).select('*')
      .gte('fecha', `${anoActual - 1}-01-01`)
      .order('fecha', { ascending: true })
      .then(({ data }) => { setRowsAll((data ?? []) as RowFacturacion[]) })
  }, [tickVivo])

  const handleFecha = useCallback((desde: Date, hasta: Date, label: string) => {
    setFechaDesde(desde); setFechaHasta(hasta); setPeriodoLabel(label)
  }, [])

  const subtitulo = buildSubtitulo(periodoLabel, fechaDesde, fechaHasta)

  // Canal → plataforma de la configuración real (web/directa no filtran marcas)
  const CANAL_PLAT: Record<string, string> = { uber: 'UE', glovo: 'GL', je: 'JE' }
  const platsElegidas = canalesFiltro.map(c => CANAL_PLAT[c]).filter(Boolean)
  const marcasEnCanal = platsElegidas.length > 0
    ? new Set(accesos.filter(a => platsElegidas.includes(a.plataforma)).map(a => a.marca_id))
    : null
  const marcasOpts = marcasDisp
    .filter(m => !marcasEnCanal || marcasEnCanal.has(m.id))
    .map(m => ({ id: m.id, label: m.nombre }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))

  const filtros = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <SelectorFechaUniversal nombreModulo="panel_global" defaultOpcion="mes_en_curso" onChange={handleFecha} />
      <MultiSelect label="Todos" etiqueta="Canal" caretColor="#FF6A1A" options={CANALES_DISPONIBLES} selected={canalesFiltro}
        onToggle={id => { setCanalesFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); setMarcasFiltro([]) }}
        onAll={() => { setCanalesFiltro([]); setMarcasFiltro([]) }} />
      <MultiSelect label="Todas" etiqueta="Marcas" caretColor={ROSA} options={marcasOpts} selected={marcasFiltro}
        onToggle={id => setMarcasFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
        onAll={() => setMarcasFiltro([])} />
    </div>
  )

  const contenido = (
    <>
      {activeTab === 'resumen' && (
        <TabResumen rowsPeriodo={rowsPeriodo} rowsAll={rowsAll} fechaDesde={fechaDesde} fechaHasta={fechaHasta} canalesFiltro={canalesFiltro} periodoLabel={periodoLabel} onNavTab={(t) => setActiveTab(t as TabId)} />
      )}
      {activeTab === 'operaciones' && <TabOperaciones rows={rowsPeriodo} />}
      {activeTab === 'finanzas'    && <TabFinanzas rows={rowsPeriodo} rowsAll={rowsAll} fechaDesde={fechaDesde} fechaHasta={fechaHasta} />}
      {activeTab === 'cashflow'    && <Cashflow />}
      {activeTab === 'evolucion'   && <TabEvolucion rowsAll={rowsAll} periodoDesde={fechaDesde} periodoHasta={fechaHasta} />}
      {activeTab === 'marcas' && <TabMarcas rows={rowsPeriodo} fechaDesde={fechaDesde} fechaHasta={fechaHasta} />}
    </>
  )

  return (
    <div style={{ background: PAGE_BG, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>
      {/* CANTERA ALEGRE v4 · ruta (Global ▸ pestaña) + filtros planos a la derecha,
          plancha de pestañas debajo y contenido directo (el héroe abre la pantalla). */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <RutaPantalla niveles={['Global', TABS.find(t => t.id === activeTab)?.label ?? '']} subtitulo={subtitulo} />
        {filtros}
      </div>

      <TabsPastilla tabs={TABS} activeId={activeTab} onChange={id => setActiveTab(id as TabId)} />

      <div style={{ height: 16 }} />
      {contenido}
    </div>
  )
}
