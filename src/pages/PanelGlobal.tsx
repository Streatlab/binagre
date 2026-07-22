/**
 * PanelGlobal — Módulo Panel Global del ERP Binagre
 *
 * Convive con DOS estilos mientras se valida el nuevo:
 *  · NEO → estilo Neobrutal actual (intacto).
 *  · SL  → estilo nuevo (Ley Visual SL v1), escrito desde cero en /components/panel/sl.
 * El interruptor de la barra superior alterna entre los dos. Es temporal.
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
import TabResumen from '@/components/panel/resumen/TabResumen'
import TabOperaciones from '@/components/panel/TabOperaciones'
import TabFinanzas from '@/components/panel/TabFinanzas'
import Cashflow from '@/pages/finanzas/Cashflow'
import TabMarcas from '@/components/panel/TabMarcas'
import TabEvolucion from '@/components/panel/TabEvolucion'
import { COLORS, FONT } from '@/components/panel/resumen/tokens'
import type { RowFacturacion } from '@/components/panel/resumen/types'
import { toLocalDateStr } from '@/lib/dateRange'
import { useSkin, SkinToggle } from '@/context/skin'
import TabResumenSL from '@/components/panel/sl/TabResumenSL'
import TabEvolucionSL from '@/components/panel/sl/TabEvolucionSL'
import CashflowSL from '@/components/panel/sl/CashflowSL'

interface MarcaItem { id: string; nombre: string }

type TabId = 'resumen' | 'operaciones' | 'finanzas' | 'cashflow' | 'evolucion' | 'marcas'

/** Vista unificada: facturación del robot + lo que el robot en vivo ve de más. */
const FUENTE_VENTAS = 'v_facturacion_diario_unificada'

// Theme-aware: fondo e INK salen de variables → cambian solos en claro/oscuro
const PAGE_BG = 'var(--neo-bg)'
const INK = 'var(--neo-ink)'
const ROSA = '#FF2E63'
const SHADOW = `4px 4px 0 var(--neo-shadow-color)`

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'resumen',     label: 'Resumen' },
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'finanzas',    label: 'Finanzas' },
  { id: 'cashflow',    label: 'Cashflow' },
  { id: 'evolucion',   label: 'Evolución' },
  { id: 'marcas',      label: 'Marcas' },
]

/** Pestañas ya migradas al estilo SL. El resto sigue en Neobrutal aunque el skin sea SL. */
const TABS_SL: TabId[] = ['resumen', 'cashflow', 'evolucion']

const CANALES_DISPONIBLES = [
  { id: 'uber',  label: 'Uber Eats' },
  { id: 'glovo', label: 'Glovo' },
  { id: 'je',    label: 'Just Eat' },
  { id: 'web',   label: 'Web' },
  { id: 'dir',   label: 'Directa' },
]

// Desplegable neobrutal: borde, cero redondez, sombra única de 4px
const dropdownBtn: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 0,
  border: `3px solid ${INK}`,
  background: 'var(--sl-card)',
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

// Desplegable SL: pastilla redonda, borde de 1px, sin sombra dura
const dropdownBtnSL: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 999,
  border: '1px solid var(--slx-line)',
  background: 'var(--slx-card)',
  fontSize: 12,
  fontFamily: "'Nunito', sans-serif",
  fontWeight: 800,
  color: 'var(--slx-gris)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
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
  label, options, selected, onToggle, onAll, sl,
}: {
  label: string
  options: Array<{ id: string; label: string }>
  selected: string[]
  onToggle: (id: string) => void
  onAll: () => void
  sl?: boolean
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
      <button style={sl ? dropdownBtnSL : dropdownBtn} onClick={() => setOpen(o => !o)}>
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

/** Pestañas del estilo SL: subrayado rojo, sin cajas. */
function TabsSL({ tabs, activeId, onChange }: {
  tabs: Array<{ id: TabId; label: string }>
  activeId: TabId
  onChange: (id: TabId) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--slx-line)', flexWrap: 'wrap' }}>
      {tabs.map(t => {
        const on = t.id === activeId
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: `3px solid ${on ? 'var(--slx-rojo)' : 'transparent'}`,
              marginBottom: -1,
              fontFamily: "'Nunito', sans-serif",
              fontSize: 12.5,
              fontWeight: 800,
              color: on ? 'var(--slx-rojo)' : 'var(--slx-gris-cl)',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}


export default function PanelGlobal() {
  const { skin } = useSkin()
  const [activeTab, setActiveTab] = useState<TabId>('resumen')
  const [periodoLabel, setPeriodoLabel] = useState('Mes en curso')
  const [fechaDesde, setFechaDesde] = useState<Date>(() => new Date(2026, 3, 1))
  const [fechaHasta, setFechaHasta] = useState<Date>(() => new Date(2026, 3, 30))
  const [marcasFiltro, setMarcasFiltro] = useState<string[]>([])
  const [canalesFiltro, setCanalesFiltro] = useState<string[]>([])
  const [marcasDisp, setMarcasDisp] = useState<MarcaItem[]>([])
  const [rowsPeriodo, setRowsPeriodo] = useState<RowFacturacion[]>([])
  const [rowsAll, setRowsAll] = useState<RowFacturacion[]>([])
  const [tickVivo, setTickVivo] = useState(0)

  useEffect(() => {
    supabase.from('marcas').select('id,nombre').eq('activa', true).then(({ data }) => {
      if (data) setMarcasDisp(data as MarcaItem[])
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
  const marcasOpts = marcasDisp.map(m => ({ id: m.id, label: m.nombre }))
  const esSL = skin === 'sl'
  const usaSL = esSL && TABS_SL.includes(activeTab)

  const filtros = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <SkinToggle />
      <SelectorFechaUniversal nombreModulo="panel_global" defaultOpcion="mes_en_curso" onChange={handleFecha} />
      <MultiSelect label="Todas las marcas" options={marcasOpts} selected={marcasFiltro} sl={esSL}
        onToggle={id => setMarcasFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
        onAll={() => setMarcasFiltro([])} />
      <MultiSelect label="Canales" options={CANALES_DISPONIBLES} selected={canalesFiltro} sl={esSL}
        onToggle={id => setCanalesFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
        onAll={() => setCanalesFiltro([])} />
    </div>
  )

  const contenido = (
    <>
      {activeTab === 'resumen' && (
        usaSL
          ? <TabResumenSL rowsPeriodo={rowsPeriodo} rowsAll={rowsAll} fechaDesde={fechaDesde} fechaHasta={fechaHasta} canalesFiltro={canalesFiltro} periodoLabel={periodoLabel} onNavTab={(t) => setActiveTab(t as TabId)} />
          : <TabResumen rowsPeriodo={rowsPeriodo} rowsAll={rowsAll} fechaDesde={fechaDesde} fechaHasta={fechaHasta} canalesFiltro={canalesFiltro} periodoLabel={periodoLabel} onNavTab={(t) => setActiveTab(t as TabId)} />
      )}
      {activeTab === 'operaciones' && <TabOperaciones rows={rowsPeriodo} />}
      {activeTab === 'finanzas'    && <TabFinanzas rows={rowsPeriodo} rowsAll={rowsAll} fechaDesde={fechaDesde} fechaHasta={fechaHasta} />}
      {activeTab === 'cashflow'    && (usaSL ? <CashflowSL /> : <Cashflow />)}
      {activeTab === 'evolucion'   && (
        usaSL
          ? <TabEvolucionSL rowsAll={rowsAll} periodoDesde={fechaDesde} periodoHasta={fechaHasta} />
          : <TabEvolucion rowsAll={rowsAll} periodoDesde={fechaDesde} periodoHasta={fechaHasta} />
      )}
      {activeTab === 'marcas' && <TabMarcas rows={rowsPeriodo} fechaDesde={fechaDesde} fechaHasta={fechaHasta} />}
    </>
  )

  /* ── Estilo SL ── */
  if (esSL) {
    return (
      <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>Panel global</div>
            <div style={{ fontSize: 12, color: 'var(--slx-gris-cl)', fontWeight: 700, marginTop: 2 }}>{subtitulo}</div>
          </div>
          {filtros}
        </div>

        <TabsSL tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

        {!usaSL && (
          <div style={{
            marginBottom: 14, padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 800,
            background: 'var(--slx-ambar-soft)', color: 'var(--slx-ambar)',
          }}>
            Esta pestaña todavía no está migrada al estilo SL. Se muestra en Neobrutal.
          </div>
        )}

        {contenido}
      </div>
    )
  }

  /* ── Estilo Neobrutal (intacto) ── */
  return (
    <div style={{ background: PAGE_BG, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 700, color: INK, letterSpacing: 3, textTransform: 'uppercase' }}>
            PANEL GLOBAL
          </div>
          <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: 'var(--sl-text-secondary)', marginTop: 2 }}>
            {subtitulo}
          </div>
        </div>
        {filtros}
      </div>

      <TabsPastilla tabs={TABS} activeId={activeTab} onChange={id => setActiveTab(id as TabId)} />

      {contenido}
    </div>
  )
}
