import React, { useState, useEffect, useRef } from 'react'
import { fmtFechaCorta } from '@/styles/tokens'

interface SelectorFechaUniversalProps {
  nombreModulo: string
  onChange: (desde: Date, hasta: Date, label: string) => void
}

type Opcion =
  | 'semana_actual'
  | 'ultimos_7'
  | 'mes_en_curso'
  | 'un_mes'
  | 'ultimos_60'
  | 'personalizado'
  | 'semanas_x'

interface PersistedState {
  opcion: Opcion
  desde: string
  hasta: string
  semanaISO?: number
  semanaYear?: number
}

interface SemanaItem {
  semanaISO: number
  year: number
  lunes: Date
  domingo: Date
  label: string
}

function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function isoWeekYear(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  return date.getUTCFullYear()
}

function getLunesDeSemana(year: number, week: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7)
  const dow = simple.getDay()
  const ISOweekStart = simple
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1)
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay())
  }
  return ISOweekStart
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildSemanasList(): SemanaItem[] {
  const today = new Date()
  const curISO = isoWeekNumber(today)
  const curYear = isoWeekYear(today)

  const items: SemanaItem[] = []

  // Build from current week back to week 1 of current year
  for (let w = curISO; w >= 1; w--) {
    const lunes = getLunesDeSemana(curYear, w)
    const domingo = new Date(lunes)
    domingo.setDate(domingo.getDate() + 6)
    items.push({
      semanaISO: w,
      year: curYear,
      lunes,
      domingo,
      label: `Semana ${w}, ${fmtFechaCorta(toDateString(lunes))}`,
    })
  }

  // If fewer than 12, add weeks from previous year
  if (items.length < 12) {
    const prevYear = curYear - 1
    // Find last week of previous year
    const dec28 = new Date(prevYear, 11, 28)
    const lastWeek = isoWeekNumber(dec28)
    for (let w = lastWeek; w >= 1 && items.length < 12; w--) {
      const lunes = getLunesDeSemana(prevYear, w)
      const domingo = new Date(lunes)
      domingo.setDate(domingo.getDate() + 6)
      items.push({
        semanaISO: w,
        year: prevYear,
        lunes,
        domingo,
        label: `Semana ${w}, ${fmtFechaCorta(toDateString(lunes))}`,
      })
    }
  }

  return items
}

function calcRango(opcion: Opcion): { desde: Date; hasta: Date } {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  switch (opcion) {
    case 'semana_actual': {
      const dow = hoy.getDay() || 7
      const lunes = new Date(hoy)
      lunes.setDate(hoy.getDate() - dow + 1)
      const domingo = new Date(lunes)
      domingo.setDate(lunes.getDate() + 6)
      return { desde: lunes, hasta: domingo }
    }
    case 'ultimos_7': {
      const desde = new Date(hoy)
      desde.setDate(hoy.getDate() - 7)
      return { desde, hasta: hoy }
    }
    case 'mes_en_curso': {
      const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      return { desde, hasta: hoy }
    }
    case 'un_mes': {
      const desde = new Date(hoy)
      desde.setDate(hoy.getDate() - 30)
      return { desde, hasta: hoy }
    }
    case 'ultimos_60': {
      const desde = new Date(hoy)
      desde.setDate(hoy.getDate() - 60)
      return { desde, hasta: hoy }
    }
    default:
      return { desde: hoy, hasta: hoy }
  }
}

const OPCIONES: { id: Opcion; label: string }[] = [
  { id: 'semana_actual', label: 'Semana actual' },
  { id: 'ultimos_7', label: 'Últimos 7 días' },
  { id: 'mes_en_curso', label: 'Mes en curso' },
  { id: 'un_mes', label: 'Un mes hasta ahora' },
  { id: 'ultimos_60', label: 'Últimos 60 días' },
  { id: 'personalizado', label: 'Personalizado' },
  { id: 'semanas_x', label: 'Semanas X' },
]

const btnStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '0.5px solid #d0c8bc',
  background: '#ffffff',
  fontFamily: 'Lexend, sans-serif',
  fontSize: 13,
  color: '#111111',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
}

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: '110%',
  background: '#ffffff',
  border: '0.5px solid #d0c8bc',
  borderRadius: 8,
  minWidth: 180,
  zIndex: 20,
  padding: '4px 0',
  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
}

const itemStyle: React.CSSProperties = {
  display: 'block',
  padding: '7px 12px',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'Lexend, sans-serif',
  color: '#111111',
  background: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
}

export default function SelectorFechaUniversal({
  nombreModulo,
  onChange,
}: SelectorFechaUniversalProps) {
  const storageKey = `selector_fecha_${nombreModulo}`

  const [opcion, setOpcion] = useState<Opcion>('semana_actual')
  const [open, setOpen] = useState(false)
  const [semanaOpen, setSemanaOpen] = useState(false)
  const [desdeStr, setDesdeStr] = useState('')
  const [hastaStr, setHastaStr] = useState('')
  const [selectedLabel, setSelectedLabel] = useState('Semana actual')

  const containerRef = useRef<HTMLDivElement>(null)
  const semanas = buildSemanasList()

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) {
        const saved: PersistedState = JSON.parse(raw)
        const op = saved.opcion

        if (op === 'semanas_x' && saved.semanaISO && saved.semanaYear) {
          const item = semanas.find(
            s => s.semanaISO === saved.semanaISO && s.year === saved.semanaYear
          )
          if (item) {
            setOpcion(op)
            setSelectedLabel(item.label)
            onChange(item.lunes, item.domingo, item.label)
            return
          }
        }

        if (op === 'personalizado' && saved.desde && saved.hasta) {
          const d = new Date(saved.desde)
          const h = new Date(saved.hasta)
          setOpcion(op)
          setDesdeStr(saved.desde)
          setHastaStr(saved.hasta)
          setSelectedLabel(`${saved.desde} → ${saved.hasta}`)
          onChange(d, h, `${saved.desde} → ${saved.hasta}`)
          return
        }

        if (!['personalizado', 'semanas_x'].includes(op)) {
          const label = OPCIONES.find(o => o.id === op)?.label ?? 'Semana actual'
          const rango = calcRango(op)
          setOpcion(op)
          setSelectedLabel(label)
          onChange(rango.desde, rango.hasta, label)
          return
        }
      }
    } catch {
      // ignore parse errors
    }

    // Default
    const rango = calcRango('semana_actual')
    onChange(rango.desde, rango.hasta, 'Semana actual')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSemanaOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function persist(state: PersistedState) {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // ignore
    }
  }

  function selectOpcion(op: Opcion) {
    if (op === 'semanas_x') {
      setOpcion(op)
      setOpen(false)
      setSemanaOpen(true)
      return
    }
    if (op === 'personalizado') {
      setOpcion(op)
      setOpen(false)
      return
    }
    const label = OPCIONES.find(o => o.id === op)?.label ?? op
    const rango = calcRango(op)
    setOpcion(op)
    setSelectedLabel(label)
    setOpen(false)
    setSemanaOpen(false)
    persist({ opcion: op, desde: toDateString(rango.desde), hasta: toDateString(rango.hasta) })
    onChange(rango.desde, rango.hasta, label)
  }

  function selectSemana(item: SemanaItem) {
    setOpcion('semanas_x')
    setSelectedLabel(item.label)
    setSemanaOpen(false)
    persist({
      opcion: 'semanas_x',
      desde: toDateString(item.lunes),
      hasta: toDateString(item.domingo),
      semanaISO: item.semanaISO,
      semanaYear: item.year,
    })
    onChange(item.lunes, item.domingo, item.label)
  }

  function applyPersonalizado() {
    if (!desdeStr || !hastaStr) return
    const d = new Date(desdeStr + 'T00:00:00')
    const h = new Date(hastaStr + 'T23:59:59')
    const label = `${desdeStr} → ${hastaStr}`
    setSelectedLabel(label)
    persist({ opcion: 'personalizado', desde: desdeStr, hasta: hastaStr })
    onChange(d, h, label)
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
      {/* Main dropdown trigger */}
      <div style={{ position: 'relative' }}>
        <button style={btnStyle} onClick={() => { setOpen(o => !o); setSemanaOpen(false) }}>
          {selectedLabel}
          <span style={{ fontSize: 10 }}>▾</span>
        </button>

        {open && (
          <div style={menuStyle}>
            {OPCIONES.map(o => (
              <button
                key={o.id}
                style={{
                  ...itemStyle,
                  background: opcion === o.id ? '#f0ede8' : 'transparent',
                  fontWeight: opcion === o.id ? 600 : 400,
                }}
                onClick={() => selectOpcion(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Semanas secondary dropdown — rendered to the RIGHT */}
      {semanaOpen && (
        <div style={{ position: 'relative' }}>
          <div
            style={{
              ...menuStyle,
              left: 0,
              top: 0,
              maxHeight: 260,
              overflowY: 'auto',
            }}
          >
            {semanas.map(s => (
              <button
                key={`${s.year}-${s.semanaISO}`}
                style={itemStyle}
                onClick={() => selectSemana(s)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Personalizado inline inputs */}
      {opcion === 'personalizado' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={desdeStr}
            onChange={e => setDesdeStr(e.target.value)}
            style={{ ...btnStyle, cursor: 'default' }}
          />
          <span style={{ fontSize: 13, color: '#777', fontFamily: 'Lexend, sans-serif' }}>→</span>
          <input
            type="date"
            value={hastaStr}
            onChange={e => setHastaStr(e.target.value)}
            style={{ ...btnStyle, cursor: 'default' }}
          />
          <button
            style={{ ...btnStyle, background: '#B01D23', color: '#fff', borderColor: '#B01D23' }}
            onClick={applyPersonalizado}
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}
