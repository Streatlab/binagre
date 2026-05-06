import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { fmtFechaCorta } from '@/styles/tokens'

interface SelectorFechaUniversalProps {
  nombreModulo: string
  onChange: (desde: Date, hasta: Date, label: string) => void
  defaultOpcion?: Opcion
}

type Opcion = 'semana_actual' | 'ultimos_7' | 'mes_en_curso' | 'un_mes' | 'ultimos_60' | 'personalizado' | 'semanas_x'

interface PersistedState { opcion: Opcion; desde: string; hasta: string; semanaISO?: number; semanaYear?: number }
interface SemanaItem { semanaISO: number; year: number; lunes: Date; domingo: Date; label: string }

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
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1)
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay())
  return ISOweekStart
}
function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function todayStr(): string { return toDateString(new Date()) }

// Parser de fechas: acepta DD/MM/AA, DD/MM/AAAA, DD-MM-AA, DDMMAA, DD.MM.AA, etc.
// Devuelve YYYY-MM-DD o null
function parseFechaInput(s: string): string | null {
  if (!s) return null
  const clean = s.trim().replace(/[^\d/.\-]/g, '')
  let m = clean.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/)
  if (!m) {
    if (/^\d{6}$/.test(clean)) m = clean.match(/^(\d{2})(\d{2})(\d{2})$/) as any
    else if (/^\d{8}$/.test(clean)) m = clean.match(/^(\d{2})(\d{2})(\d{4})$/) as any
    else return null
  }
  if (!m) return null
  const day = parseInt(m[1], 10)
  const mon = parseInt(m[2], 10)
  let yr = parseInt(m[3], 10)
  if (yr < 100) yr = yr >= 70 ? 1900 + yr : 2000 + yr
  if (day < 1 || day > 31 || mon < 1 || mon > 12) return null
  return `${yr}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

// Formato display: YYYY-MM-DD → DD/MM/AAAA
function isoToDisplay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

function buildSemanasList(): SemanaItem[] {
  const today = new Date()
  const curISO = isoWeekNumber(today)
  const curYear = isoWeekYear(today)
  const items: SemanaItem[] = []
  for (let w = curISO; w >= 1; w--) {
    const lunes = getLunesDeSemana(curYear, w)
    const domingo = new Date(lunes); domingo.setDate(domingo.getDate() + 6)
    items.push({ semanaISO: w, year: curYear, lunes, domingo, label: `Semana ${w}, ${fmtFechaCorta(toDateString(lunes))}` })
  }
  if (items.length < 12) {
    const prevYear = curYear - 1
    const lastWeek = isoWeekNumber(new Date(prevYear, 11, 28))
    for (let w = lastWeek; w >= 1 && items.length < 12; w--) {
      const lunes = getLunesDeSemana(prevYear, w)
      const domingo = new Date(lunes); domingo.setDate(domingo.getDate() + 6)
      items.push({ semanaISO: w, year: prevYear, lunes, domingo, label: `Semana ${w}, ${fmtFechaCorta(toDateString(lunes))}` })
    }
  }
  return items
}

function calcRango(opcion: Opcion): { desde: Date; hasta: Date } {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  switch (opcion) {
    case 'semana_actual': {
      const dow = hoy.getDay() || 7
      const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - dow + 1)
      const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6)
      return { desde: lunes, hasta: domingo }
    }
    case 'ultimos_7':   { const d = new Date(hoy); d.setDate(hoy.getDate() - 7);  return { desde: d, hasta: hoy } }
    case 'mes_en_curso':{ return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: hoy } }
    case 'un_mes':      { const d = new Date(hoy); d.setDate(hoy.getDate() - 30); return { desde: d, hasta: hoy } }
    case 'ultimos_60':  { const d = new Date(hoy); d.setDate(hoy.getDate() - 60); return { desde: d, hasta: hoy } }
    default: return { desde: hoy, hasta: hoy }
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
  padding: '6px 10px', borderRadius: 8, border: '0.5px solid #d0c8bc',
  background: '#ffffff', fontFamily: 'Lexend, sans-serif', fontSize: 13,
  color: '#111111', cursor: 'pointer', display: 'flex', alignItems: 'center',
  gap: 4, whiteSpace: 'nowrap',
}
const inputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, border: '0.5px solid #d0c8bc',
  background: '#ffffff', fontFamily: 'Lexend, sans-serif', fontSize: 13,
  color: '#111111', width: 100, outline: 'none',
}
const inputErrorStyle: React.CSSProperties = { ...inputStyle, borderColor: '#E24B4A' }
const menuStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', right: 0, background: '#fff',
  border: '0.5px solid #d0c8bc', borderRadius: 8, width: 200, fontSize: 13,
  color: '#3a4050', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', zIndex: 50,
  maxHeight: '80vh', overflowY: 'auto',
}
const itemStyle: React.CSSProperties = {
  display: 'block', padding: '8px 12px', cursor: 'pointer', fontSize: 13,
  fontFamily: 'Lexend, sans-serif', color: '#7a8090', background: 'transparent',
  border: 'none', width: '100%', textAlign: 'left',
}

export default function SelectorFechaUniversal({
  nombreModulo, onChange, defaultOpcion = 'semana_actual',
}: SelectorFechaUniversalProps) {
  const storageKey = `selector_fecha_${nombreModulo}`
  const defaultLabel = OPCIONES.find(o => o.id === defaultOpcion)?.label ?? 'Semana actual'

  const [opcion, setOpcion] = useState<Opcion>(defaultOpcion)
  const [open, setOpen] = useState(false)
  const [semanaOpen, setSemanaOpen] = useState(false)
  // Inputs personalizados: lo que escribe el usuario
  const [desdeInput, setDesdeInput] = useState('')
  const [hastaInput, setHastaInput] = useState('')
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel)
  const containerRef = useRef<HTMLDivElement>(null)
  const desdeRef = useRef<HTMLInputElement>(null)
  const hastaRef = useRef<HTMLInputElement>(null)
  const semanas = buildSemanasList()

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) {
        const saved: PersistedState = JSON.parse(raw)
        const op = saved.opcion
        if (op === 'semanas_x' && saved.semanaISO && saved.semanaYear) {
          const item = semanas.find(s => s.semanaISO === saved.semanaISO && s.year === saved.semanaYear)
          if (item) { setOpcion(op); setSelectedLabel(item.label); onChange(item.lunes, item.domingo, item.label); return }
        }
        if (op === 'personalizado' && saved.desde && saved.hasta) {
          const d = new Date(saved.desde + 'T00:00:00')
          const h = new Date(saved.hasta + 'T23:59:59')
          const labelPers = `${fmtFechaCorta(saved.desde)} → ${fmtFechaCorta(saved.hasta)}`
          setOpcion(op)
          setDesdeInput(isoToDisplay(saved.desde))
          setHastaInput(isoToDisplay(saved.hasta))
          setSelectedLabel(labelPers); onChange(d, h, labelPers); return
        }
        if (!['personalizado', 'semanas_x'].includes(op)) {
          const label = OPCIONES.find(o => o.id === op)?.label ?? 'Semana actual'
          const rango = calcRango(op)
          setOpcion(op); setSelectedLabel(label); onChange(rango.desde, rango.hasta, label); return
        }
      }
    } catch {}
    if (defaultOpcion === 'semanas_x' || defaultOpcion === 'personalizado') {
      const rango = calcRango('semana_actual'); onChange(rango.desde, rango.hasta, 'Semana actual')
    } else {
      const rango = calcRango(defaultOpcion); onChange(rango.desde, rango.hasta, defaultLabel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setSemanaOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function persist(state: PersistedState) {
    try { sessionStorage.setItem(storageKey, JSON.stringify(state)) } catch {}
  }

  function selectOpcion(op: Opcion) {
    if (op === 'semanas_x') { setOpcion(op); setOpen(false); setSemanaOpen(true); return }
    if (op === 'personalizado') {
      setOpcion(op); setOpen(false)
      // Inicializar hasta con hoy si está vacío
      if (!hastaInput) setHastaInput(isoToDisplay(todayStr()))
      // Foco al input de desde
      setTimeout(() => desdeRef.current?.focus(), 50)
      return
    }
    const label = OPCIONES.find(o => o.id === op)?.label ?? op
    const rango = calcRango(op)
    setOpcion(op); setSelectedLabel(label); setOpen(false); setSemanaOpen(false)
    persist({ opcion: op, desde: toDateString(rango.desde), hasta: toDateString(rango.hasta) })
    onChange(rango.desde, rango.hasta, label)
  }

  function selectSemana(item: SemanaItem) {
    setOpcion('semanas_x'); setSelectedLabel(item.label); setSemanaOpen(false)
    persist({ opcion: 'semanas_x', desde: toDateString(item.lunes), hasta: toDateString(item.domingo), semanaISO: item.semanaISO, semanaYear: item.year })
    onChange(item.lunes, item.domingo, item.label)
  }

  // Aplicar fechas escritas
  function applyPersonalizado() {
    const desdeIso = parseFechaInput(desdeInput)
    const hastaIso = parseFechaInput(hastaInput) || todayStr()
    if (!desdeIso) return
    // Si hasta no estaba escrita o era inválida, normalizamos a hoy o desde
    const hastaFinal = hastaIso < desdeIso ? desdeIso : hastaIso
    setDesdeInput(isoToDisplay(desdeIso))
    setHastaInput(isoToDisplay(hastaFinal))
    const d = new Date(desdeIso + 'T00:00:00')
    const h = new Date(hastaFinal + 'T23:59:59')
    const label = `${fmtFechaCorta(desdeIso)} → ${fmtFechaCorta(hastaFinal)}`
    setSelectedLabel(label)
    persist({ opcion: 'personalizado', desde: desdeIso, hasta: hastaFinal })
    onChange(d, h, label)
  }

  function handleDesdeBlur() {
    // Al salir del campo desde, si hay fecha válida y hasta vacío → poner hoy
    const desdeIso = parseFechaInput(desdeInput)
    if (desdeIso) {
      setDesdeInput(isoToDisplay(desdeIso))
      if (!parseFechaInput(hastaInput)) {
        setHastaInput(isoToDisplay(todayStr()))
      }
    }
  }
  function handleHastaBlur() {
    const hastaIso = parseFechaInput(hastaInput)
    if (hastaIso) setHastaInput(isoToDisplay(hastaIso))
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); applyPersonalizado() }
  }

  // Validez visual
  const desdeOk = !desdeInput || parseFechaInput(desdeInput) !== null
  const hastaOk = !hastaInput || parseFechaInput(hastaInput) !== null

  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <button style={btnStyle} onClick={() => { setOpen(o => !o); setSemanaOpen(false) }}>
          <span>{selectedLabel}</span>
          <ChevronDown size={11} strokeWidth={2.5} style={{ marginLeft: 4 }} />
        </button>
        {open && (
          <div style={menuStyle}>
            {OPCIONES.map(o => (
              <button key={o.id} style={{ ...itemStyle, background: opcion === o.id ? '#FF475715' : 'transparent', color: opcion === o.id ? '#FF4757' : '#7a8090', fontWeight: opcion === o.id ? 500 : 400, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => selectOpcion(o.id)}>
                <span>{o.label}</span>
                {o.id === 'semanas_x' && <span style={{ fontSize: 10 }}>▸</span>}
              </button>
            ))}
          </div>
        )}
        {semanaOpen && (
          <div style={{ ...menuStyle, maxHeight: 260, overflowY: 'auto' }}>
            {semanas.map(s => (
              <button key={`${s.year}-${s.semanaISO}`} style={itemStyle} onClick={() => selectSemana(s)}>{s.label}</button>
            ))}
          </div>
        )}
      </div>

      {opcion === 'personalizado' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            ref={desdeRef}
            type="text"
            placeholder="DD/MM/AA"
            value={desdeInput}
            onChange={e => setDesdeInput(e.target.value)}
            onBlur={handleDesdeBlur}
            onKeyDown={handleKeyDown}
            style={desdeOk ? inputStyle : inputErrorStyle}
          />
          <span style={{ fontSize: 13, color: '#777', fontFamily: 'Lexend, sans-serif' }}>→</span>
          <input
            ref={hastaRef}
            type="text"
            placeholder="DD/MM/AA"
            value={hastaInput}
            onChange={e => setHastaInput(e.target.value)}
            onBlur={handleHastaBlur}
            onKeyDown={handleKeyDown}
            style={hastaOk ? inputStyle : inputErrorStyle}
          />
          <button style={{ ...btnStyle, background: '#B01D23', color: '#fff', borderColor: '#B01D23' }} onClick={applyPersonalizado}>
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}
