/**
 * PanelGlobal — Módulo Panel Global del ERP Binagre
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import TabsPastilla from '@/components/ui/TabsPastilla'
import TabResumen from '@/components/panel/resumen/TabResumen'
import TabOperaciones from '@/components/panel/TabOperaciones'
import TabFinanzas from '@/components/panel/TabFinanzas'
import Cashflow from '@/pages/finanzas/Cashflow'
import TabMarcas from '@/components/panel/TabMarcas'
import TabEvolucion from '@/components/panel/TabEvolucion'
import { COLORS, FONT } from '@/components/panel/resumen/tokens'
import type { RowFacturacion } from '@/components/panel/resumen/types'
import { toLocalDateStr } from '@/lib/dateRange'

interface MarcaItem { id: string; nombre: string }

type TabId = 'resumen' | 'operaciones' | 'finanzas' | 'cashflow' | 'evolucion' | 'marcas'

// Fondo crema único, coherente con el sidebar y el wrapper del ERP
const PAGE_BG = '#FCEFD6'
const INK = '#140f08'
const ROSA = '#FF2E63'
const SHADOW = `4px 4px 0 ${INK}`

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

// Desplegable neobrutal: borde negro, cero redondez, sombra única de 4px
const dropdownBtn: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 0,
  border: `3px solid ${INK}`,
  background: '#ffffff',
  fontSize: 14,
  fontFamily: 'Lexend, sans-serif',
  fontWeight: 600,
  color: INK,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
  position: 'relative',
  boxShadow: SHADOW,
}

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 50,
  right: 0,
  background: '#ffffff',
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
  label, options, selected, onToggle, onAll,
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
    ? label : `${selected.length} sel.`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button style={dropdownBtn} onClick={() => setOpen(o => !o)}>
        <span>{displayLabel}</span>
        <ChevronDown size={14} strokeWidth={3} style={{ marginLeft: 2 }} />
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
                borderBottom: `1px solid ${INK}1a`,
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
  const [rowsPeriodo, setRowsPeriodo] = useState<RowFacturacion[]>([])
  const [rowsAll, setRowsAll] = useState<RowFacturacion[]>([])

  useEffect(() => {
    supabase.from('marcas').select('id,nombre').eq('activa', true).then(({ data }) => {
      if (data) setMarcasDisp(data as MarcaItem[])
    })
  }, [])

  useEffect(() => {
    const desde = toLocalDateStr(fechaDesde)
    const hasta  = toLocalDateStr(fechaHasta)
    supabase
      .from('facturacion_diario').select('*')
      .gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: true })
      .then(({ data }) => { setRowsPeriodo((data ?? []) as RowFacturacion[]) })
  }, [fechaDesde, fechaHasta])

  useEffect(() => {
    const anoActual = new Date().getFullYear()
    supabase
      .from('facturacion_diario').select('*')
      .gte('fecha', `${anoActual - 1}-01-01`)
      .order('fecha', { ascending: true })
      .then(({ data }) => { setRowsAll((data ?? []) as RowFacturacion[]) })
  }, [])

  const handleFecha = useCallback((desde: Date, hasta: Date, label: string) => {
    setFechaDesde(desde); setFechaHasta(hasta); setPeriodoLabel(label)
  }, [])

  const subtitulo = buildSubtitulo(periodoLabel, fechaDesde, fechaHasta)
  const marcasOpts = marcasDisp.map(m => ({ id: m.id, label: m.nombre }))

  return (
    <div style={{ background: PAGE_BG, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 700, color: INK, letterSpacing: 3, textTransform: 'uppercase' }}>
            PANEL GLOBAL
          </div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#6b5d45', marginTop: 2 }}>
            {subtitulo}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SelectorFechaUniversal nombreModulo="panel_global" defaultOpcion="mes_en_curso" onChange={handleFecha} />
          <MultiSelect label="Todas las marcas" options={marcasOpts} selected={marcasFiltro}
            onToggle={id => setMarcasFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            onAll={() => setMarcasFiltro([])} />
          <MultiSelect label="Canales" options={CANALES_DISPONIBLES} selected={canalesFiltro}
            onToggle={id => setCanalesFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            onAll={() => setCanalesFiltro([])} />
        </div>
      </div>

      <TabsPastilla tabs={TABS} activeId={activeTab} onChange={id => setActiveTab(id as TabId)} />

      {activeTab === 'resumen' && (
        <TabResumen rowsPeriodo={rowsPeriodo} rowsAll={rowsAll} fechaDesde={fechaDesde} fechaHasta={fechaHasta} canalesFiltro={canalesFiltro} periodoLabel={periodoLabel} onNavTab={(t) => setActiveTab(t as TabId)} />
      )}
      {activeTab === 'operaciones' && <TabOperaciones rows={rowsPeriodo} />}
      {activeTab === 'finanzas'    && <TabFinanzas rows={rowsPeriodo} />}
      {activeTab === 'cashflow'    && <Cashflow />}
      {activeTab === 'evolucion'   && <TabEvolucion rowsAll={rowsAll} periodoDesde={fechaDesde} periodoHasta={fechaHasta} />}
      {activeTab === 'marcas' && <TabMarcas rows={rowsPeriodo} />}
    </div>
  )
}
