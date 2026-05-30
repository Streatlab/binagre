/**
 * PanelGlobal2 — Copia REAL de Panel Global con estilo Lymon.
 *
 * - Datos 100% reales (Supabase facturacion_diario), igual que Panel Global.
 * - Header funcional: selector de fecha + filtros marcas/canales.
 * - Una sola tab: Resumen, con las 12 cards completas vestidas en estilo Lymon.
 * - Look Lymon: oscuro #2d2d2e + lima #e8f442 + tomate #C8362A, Oswald mayúsculas.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import TabResumenLymon from './TabResumenLymon'
import type { RowFacturacion } from '@/components/panel/resumen/types'

interface MarcaItem { id: string; nombre: string }

const C = {
  bg: '#2d2d2e', surface: '#3a3a3c', border: 'rgba(255,255,255,0.08)',
  text: '#ffffff', textMuted: '#a8a8aa',
  lime: '#e8f442', tomato: '#C8362A', leaf: '#7A8F5C',
}

const CANALES_DISPONIBLES = [
  { id: 'uber', label: 'Uber Eats' },
  { id: 'glovo', label: 'Glovo' },
  { id: 'je', label: 'Just Eat' },
  { id: 'web', label: 'Web' },
  { id: 'dir', label: 'Directa' },
]

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function MultiSelectDark({
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
    function click(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])
  const displayLabel = selected.length === 0 || selected.length === options.length ? label : `${selected.length} sel.`
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        height: 40, padding: '0 14px', border: `1px solid ${C.border}`, borderRadius: 8,
        background: 'transparent', color: C.text, fontSize: 12, cursor: 'pointer',
        fontFamily: 'Oswald, sans-serif', fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>{displayLabel}</span>
        <ChevronDown size={12} strokeWidth={2.5} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 46, right: 0, background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 10, width: 240, zIndex: 100,
          maxHeight: 360, overflowY: 'auto', padding: '4px 0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <button onClick={() => { onAll(); setOpen(false) }} style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px',
            background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer',
            fontSize: 12, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase',
            letterSpacing: '0.06em', borderBottom: `1px solid ${C.border}`,
          }}>Todos</button>
          {options.map(o => {
            const on = selected.includes(o.id)
            return (
              <label key={o.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                cursor: 'pointer', fontSize: 13, color: on ? C.lime : C.textMuted,
                background: on ? 'rgba(232,244,66,0.06)' : 'transparent',
              }}>
                <input type="checkbox" checked={on} onChange={() => onToggle(o.id)} style={{ accentColor: C.lime }} />
                {o.label}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PanelGlobal2() {
  const [fechaDesde, setFechaDesde] = useState<Date>(() => new Date(2026, 3, 1))
  const [fechaHasta, setFechaHasta] = useState<Date>(() => new Date(2026, 3, 30))
  const [periodoLabel, setPeriodoLabel] = useState('Mes en curso')
  const [marcasFiltro, setMarcasFiltro] = useState<string[]>([])
  const [canalesFiltro, setCanalesFiltro] = useState<string[]>([])
  const [marcasDisp, setMarcasDisp] = useState<MarcaItem[]>([])
  const [rowsPeriodo, setRowsPeriodo] = useState<RowFacturacion[]>([])
  const [rowsAll, setRowsAll] = useState<RowFacturacion[]>([])

  useEffect(() => {
    supabase.from('marcas').select('id,nombre').eq('estado', 'activa').then(({ data }) => {
      if (data) setMarcasDisp(data as MarcaItem[])
    })
  }, [])

  useEffect(() => {
    const desde = toLocalDateStr(fechaDesde)
    const hasta = toLocalDateStr(fechaHasta)
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

  const marcasOpts = marcasDisp.map(m => ({ id: m.id, label: m.nombre }))

  return (
    <div style={{
      background: C.bg, minHeight: '100vh',
      fontFamily: 'Inter, -apple-system, sans-serif', color: C.text,
      fontSize: 14, lineHeight: 1.5, WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ padding: '32px 40px', maxWidth: 1320, margin: '0 auto' }}>

        {/* HEADER con filtros reales */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 600, color: C.lime, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
              {periodoLabel}
            </div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 42, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.05, textTransform: 'uppercase' }}>
              Panel Global 2
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <SelectorFechaUniversal nombreModulo="panel_global_2" defaultOpcion="mes_en_curso" onChange={handleFecha} />
            <MultiSelectDark label="Todas las marcas" options={marcasOpts} selected={marcasFiltro}
              onToggle={id => setMarcasFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
              onAll={() => setMarcasFiltro([])} />
            <MultiSelectDark label="Canales" options={CANALES_DISPONIBLES} selected={canalesFiltro}
              onToggle={id => setCanalesFiltro(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
              onAll={() => setCanalesFiltro([])} />
          </div>
        </div>

        {/* TAB única: Resumen */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          <div style={{
            padding: '8px 20px', borderRadius: 999, background: C.lime, color: C.bg,
            fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 13,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>Resumen</div>
        </div>

        <TabResumenLymon
          rowsPeriodo={rowsPeriodo}
          rowsAll={rowsAll}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
          canalesFiltro={canalesFiltro}
        />
      </div>
    </div>
  )
}
