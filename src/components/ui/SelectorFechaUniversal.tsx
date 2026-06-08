import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, Calendar as CalendarIcon } from 'lucide-react'
import { fmtFechaCorta } from '@/styles/tokens'

type Opcion =
  | 'esta_semana'
  | 'semana_pasada'
  | 'ultimos_7'
  | 'este_mes'
  | 'mes_pasado'
  | 'ultimos_30'
  | 'ultimos_60'
  | 'ultimas_12_semanas'
  | 'ultimos_12_meses'
  | 'semanas_x'
  | 'personalizado'

// Valores antiguos persistidos / pasados como prop. Se migran a los nuevos.
type LegacyOpcion = 'semana_actual' | 'mes_en_curso' | 'un_mes'

interface SelectorFechaUniversalProps {
  nombreModulo: string
  onChange: (desde: Date, hasta: Date, label: string, opcion?: Opcion) => void
  defaultOpcion?: Opcion | LegacyOpcion
}

interface PersistedState { opcion: Opcion; desde: string; hasta: string; semanaISO?: number; semanaYear?: number }
interface SemanaItem { semanaISO: number; year: number; lunes: Date; domingo: Date; label: string }

// 13/05/26: clave GLOBAL para que el periodo persista entre pestañas y tras F5.
// Todos los módulos comparten el mismo periodo. nombreModulo se mantiene como parámetro
// por compatibilidad pero ya no se usa para diferenciar la clave de storage.
const STORAGE_KEY_GLOBAL = 'selector_fecha_global'

// Migración de ids antiguos a los nuevos (no romper estado guardado ni props).
function migrarOpcion(op: string): Opcion {
  const map: Record<string, Opcion> = {
    semana_actual: 'esta_semana',
    mes_en_curso: 'este_mes',
    un_mes: 'ultimos_30',
  }
  return (map[op] ?? op) as Opcion
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
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1)
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay())
  return ISOweekStart
}
function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function todayStr(): string { return toDateString(new Date()) }

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
    case 'esta_semana': {
      const dow = hoy.getDay() || 7
      const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - dow + 1)
      const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6)
      return { desde: lunes, hasta: domingo }
    }
    case 'semana_pasada': {
      const dow = hoy.getDay() || 7
      const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - dow + 1 - 7)
      const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6)
      return { desde: lunes, hasta: domingo }
    }
    case 'ultimos_7':   { const d = new Date(hoy); d.setDate(hoy.getDate() - 7);  return { desde: d, hasta: hoy } }
    case 'este_mes':    { return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: hoy } }
    case 'mes_pasado':  {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      const ultimo = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      return { desde: primero, hasta: ultimo }
    }
    case 'ultimos_30':  { const d = new Date(hoy); d.setDate(hoy.getDate() - 30); return { desde: d, hasta: hoy } }
    case 'ultimos_60':  { const d = new Date(hoy); d.setDate(hoy.getDate() - 60); return { desde: d, hasta: hoy } }
    case 'ultimas_12_semanas': { const d = new Date(hoy); d.setDate(hoy.getDate() - 84); return { desde: d, hasta: hoy } }
    case 'ultimos_12_meses':   { const d = new Date(hoy); d.setMonth(hoy.getMonth() - 12); return { desde: d, hasta: hoy } }
    default: return { desde: hoy, hasta: hoy }
  }
}

const OPCIONES: { id: Opcion; label: string }[] = [
  { id: 'esta_semana', label: 'Esta semana' },
  { id: 'semana_pasada', label: 'La semana pasada' },
  { id: 'ultimos_7', label: 'Últimos 7 días' },
  { id: 'este_mes', label: 'Este mes' },
  { id: 'mes_pasado', label: 'El mes pasado' },
  { id: 'ultimos_30', label: 'Últimos 30 días' },
  { id: 'ultimos_60', label: 'Últimos 60 días' },
  { id: 'ultimas_12_semanas', label: 'Últimas 12 semanas' },
  { id: 'ultimos_12_meses', label: 'Últimos 12 meses' },
  { id: 'semanas_x', label: 'Semanas X' },
  { id: 'personalizado', label: 'Personalizado' },
]

const btnStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, border: '0.5px solid #d0c8bc',
  background: '#ffffff', fontFamily: 'Lexend, sans-serif', fontSize: 13,
  color: '#111111', cursor: 'pointer', display: 'flex', alignItems: 'center',
  gap: 4, whiteSpace: 'nowrap',
}
const inputStyle: React.CSSProperties = {
  padding: '6px 26px 6px 10px', borderRadius: 8, border: '0.5px solid #d0c8bc',
  background: '#ffffff', fontFamily: 'Lexend, sans-serif', fontSize: 13,
  color: '#111111', width: 110, outline: 'none',
}
const inputErrorStyle: React.CSSProperties = { ...inputStyle, borderColor: '#E24B4A' }
const iconBtnStyle: React.CSSProperties = {
  position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
  color: '#7a8090', display: 'flex', alignItems: 'center',
}
const hiddenDateStyle: React.CSSProperties = {
  position: 'absolute', right: 0, top: 0, width: 1, height: 1,
  opacity: 0, pointerEvents: 'none', border: 'none', padding: 0,
}
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
  nombreModulo: _nombreModulo, onChange, defaultOpcion = 'esta_semana',
}: SelectorFechaUniversalProps) {
  const defaultOp = migrarOpcion(defaultOpcion)
  const defaultLabel = OPCIONES.find(o => o.id === defaultOp)?.label ?? 'Esta semana'

  const [opcion, setOpcion] = useState<Opcion>(defaultOp)
  const [open, setOpen] = useState(false)
  const [semanaOpen, setSemanaOpen] = useState(false)
  const [desdeInput, setDesdeInput] = useState('')
  const [hastaInput, setHastaInput] = useState('')
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel)
  // Último rango activo (para prerellenar Personalizado con lo que se estaba viendo)
  const lastRangeRef = useRef<{ desde: Date; hasta: Date }>(calcRango(defaultOp))
  const containerRef = useRef<HTMLDivElement>(null)
  const desdeRef = useRef<HTMLInputElement>(null)
  const hastaRef = useRef<HTMLInputElement>(null)
  const desdePickerRef = useRef<HTMLInputElement>(null)
  const hastaPickerRef = useRef<HTMLInputElement>(null)
  const semanas = buildSemanasList()

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_GLOBAL)
      if (raw) {
        const saved: PersistedState = JSON.parse(raw)
        const op = migrarOpcion(saved.opcion)
        if (op === 'semanas_x' && saved.semanaISO && saved.semanaYear) {
          const item = semanas.find(s => s.semanaISO === saved.semanaISO && s.year === saved.semanaYear)
          if (item) {
            lastRangeRef.current = { desde: item.lunes, hasta: item.domingo }
            setOpcion(op); setSelectedLabel(item.label); onChange(item.lunes, item.domingo, item.label, op); return
          }
        }
        if (op === 'personalizado' && saved.desde && saved.hasta) {
          const d = new Date(saved.desde + 'T00:00:00')
          const h = new Date(saved.hasta + 'T23:59:59')
          const labelPers = `${fmtFechaCorta(saved.desde)} → ${fmtFechaCorta(saved.hasta)}`
          lastRangeRef.current = { desde: d, hasta: h }
          setOpcion(op)
          setDesdeInput(isoToDisplay(saved.desde))
          setHastaInput(isoToDisplay(saved.hasta))
          setSelectedLabel(labelPers); onChange(d, h, labelPers, op); return
        }
        if (!['personalizado', 'semanas_x'].includes(op)) {
          const label = OPCIONES.find(o => o.id === op)?.label ?? 'Esta semana'
          const rango = calcRango(op)
          lastRangeRef.current = rango
          setOpcion(op); setSelectedLabel(label); onChange(rango.desde, rango.hasta, label, op); return
        }
      }
    } catch {}
    if (defaultOp === 'semanas_x' || defaultOp === 'personalizado') {
      const rango = calcRango('esta_semana'); lastRangeRef.current = rango
      onChange(rango.desde, rango.hasta, 'Esta semana', 'esta_semana')
    } else {
      const rango = calcRango(defaultOp); lastRangeRef.current = rango
      onChange(rango.desde, rango.hasta, defaultLabel, defaultOp)
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
    try { localStorage.setItem(STORAGE_KEY_GLOBAL, JSON.stringify(state)) } catch {}
  }

  function selectOpcion(op: Opcion) {
    if (op === 'semanas_x') { setOpcion(op); setOpen(false); setSemanaOpen(true); return }
    if (op === 'personalizado') {
      setOpcion(op); setOpen(false)
      // Prerellenar con el periodo que se estaba viendo; fin = hoy por defecto.
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
      const prev = lastRangeRef.current
      const pd = prev?.desde ?? calcRango('esta_semana').desde
      let ph = prev?.hasta ?? hoy
      if (ph > hoy) ph = hoy
      setDesdeInput(isoToDisplay(toDateString(pd)))
      setHastaInput(isoToDisplay(toDateString(ph)))
      setTimeout(() => desdeRef.current?.focus(), 50)
      return
    }
    const label = OPCIONES.find(o => o.id === op)?.label ?? op
    const rango = calcRango(op)
    lastRangeRef.current = rango
    setOpcion(op); setSelectedLabel(label); setOpen(false); setSemanaOpen(false)
    persist({ opcion: op, desde: toDateString(rango.desde), hasta: toDateString(rango.hasta) })
    onChange(rango.desde, rango.hasta, label, op)
  }

  function selectSemana(item: SemanaItem) {
    lastRangeRef.current = { desde: item.lunes, hasta: item.domingo }
    setOpcion('semanas_x'); setSelectedLabel(item.label); setSemanaOpen(false)
    persist({ opcion: 'semanas_x', desde: toDateString(item.lunes), hasta: toDateString(item.domingo), semanaISO: item.semanaISO, semanaYear: item.year })
    onChange(item.lunes, item.domingo, item.label, 'semanas_x')
  }

  function commitPersonalizado(desdeIso: string, hastaIso: string) {
    const hastaFinal = hastaIso < desdeIso ? desdeIso : hastaIso
    setDesdeInput(isoToDisplay(desdeIso))
    setHastaInput(isoToDisplay(hastaFinal))
    const d = new Date(desdeIso + 'T00:00:00')
    const h = new Date(hastaFinal + 'T23:59:59')
    lastRangeRef.current = { desde: d, hasta: h }
    const label = `${fmtFechaCorta(desdeIso)} → ${fmtFechaCorta(hastaFinal)}`
    setSelectedLabel(label)
    persist({ opcion: 'personalizado', desde: desdeIso, hasta: hastaFinal })
    onChange(d, h, label, 'personalizado')
  }

  function applyPersonalizado() {
    const desdeIso = parseFechaInput(desdeInput)
    const hastaIso = parseFechaInput(hastaInput) || todayStr()
    if (!desdeIso) return
    commitPersonalizado(desdeIso, hastaIso)
  }

  function openPicker(ref: React.RefObject<HTMLInputElement | null>) {
    const el = ref.current
    if (!el) return
    try { (el as any).showPicker?.() } catch {}
    el.focus()
  }
  function onPickDesde(iso: string) {
    if (!iso) return
    const hIso = parseFechaInput(hastaInput) || todayStr()
    commitPersonalizado(iso, hIso)
  }
  function onPickHasta(iso: string) {
    if (!iso) return
    const dIso = parseFechaInput(desdeInput)
    if (dIso) commitPersonalizado(dIso, iso)
    else setHastaInput(isoToDisplay(iso))
  }

  function handleDesdeBlur() {
    const desdeIso = parseFechaInput(desdeInput)
    if (desdeIso) {
      setDesdeInput(isoToDisplay(desdeIso))
      if (!parseFechaInput(hastaInput)) setHastaInput(isoToDisplay(todayStr()))
    }
  }
  function handleHastaBlur() {
    const hastaIso = parseFechaInput(hastaInput)
    if (hastaIso) setHastaInput(isoToDisplay(hastaIso))
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      // Autoformatear y aplicar al confirmar (Enter o Tab)
      if (e.key === 'Enter') e.preventDefault()
      applyPersonalizado()
    }
  }

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
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
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
            <button type="button" style={iconBtnStyle} onClick={() => openPicker(desdePickerRef)} aria-label="Calendario inicio">
              <CalendarIcon size={14} strokeWidth={2} />
            </button>
            <input
              ref={desdePickerRef}
              type="date"
              value={parseFechaInput(desdeInput) || ''}
              onChange={e => onPickDesde(e.target.value)}
              style={hiddenDateStyle}
              tabIndex={-1}
            />
          </div>
          <span style={{ fontSize: 13, color: '#777', fontFamily: 'Lexend, sans-serif' }}>→</span>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
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
            <button type="button" style={iconBtnStyle} onClick={() => openPicker(hastaPickerRef)} aria-label="Calendario fin">
              <CalendarIcon size={14} strokeWidth={2} />
            </button>
            <input
              ref={hastaPickerRef}
              type="date"
              value={parseFechaInput(hastaInput) || ''}
              onChange={e => onPickHasta(e.target.value)}
              style={hiddenDateStyle}
              tabIndex={-1}
            />
          </div>
          <button style={{ ...btnStyle, background: '#B01D23', color: '#fff', borderColor: '#B01D23' }} onClick={applyPersonalizado}>
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}
