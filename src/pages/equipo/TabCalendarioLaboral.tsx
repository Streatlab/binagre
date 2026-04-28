import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { FESTIVOS_MADRID, esFestivo } from '@/utils/festivosMadrid'

interface Empleado { id: string; nombre: string }
interface EventoLaboral {
  id: string
  empleado_id: string
  fecha: string
  tipo: 'festivo' | 'vacaciones' | 'baja_medica' | 'asuntos_propios' | 'permiso_retribuido'
  nota?: string
}

// Colores por empleado (top 5 + fallback)
// Colores empleados en calendario — paleta distinta de tokens David/Marino (#16355C, #F26B1F prohibidos)
const EMP_COLORS = ['#B01D23', '#1E88CC', '#1D9E75', '#9b59b6', '#e67e22', '#27ae60']

const TIPO_LABELS: Record<string, string> = {
  festivo: 'Festivo',
  vacaciones: 'Vacaciones',
  baja_medica: 'Baja médica',
  asuntos_propios: 'Asuntos propios',
  permiso_retribuido: 'Permiso retribuido',
}

const TIPO_COLORES: Record<string, string> = {
  festivo: '#e8f442',
  vacaciones: '', // color por empleado
  baja_medica: '#aa3030',
  asuntos_propios: '#66aaff',
  permiso_retribuido: '#9b59b6',
}

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function TabCalendarioLaboral() {
  const { T, isDark: _isDark } = useTheme()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [eventos, setEventos] = useState<EventoLaboral[]>([])
  const [dropdown, setDropdown] = useState<{ fecha: string; x: number; y: number } | null>(null)

  async function fetchAll() {
    const firstDay = isoDate(year, month, 1)
    const lastDay = isoDate(year, month + 1, 0)
    const [e, ev] = await Promise.all([
      supabase.from('empleados').select('id, nombre').eq('estado', 'activo').order('nombre'),
      supabase.from('eventos_laborales').select('*').gte('fecha', firstDay).lte('fecha', lastDay),
    ])
    setEmpleados((e.data ?? []) as Empleado[])
    setEventos((ev.data ?? []) as EventoLaboral[])
  }

  useEffect(() => { fetchAll() }, [year, month])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const startOffset = firstWeekday === 0 ? 6 : firstWeekday - 1 // Mon=0

  function getEventosForDate(fecha: string): EventoLaboral[] {
    return eventos.filter(e => e.fecha === fecha)
  }

  async function addEvento(fecha: string, tipo: EventoLaboral['tipo'], empleadoId?: string) {
    if (tipo === 'festivo') {
      const { error } = await supabase.from('eventos_laborales').upsert(
        { fecha, tipo, nota: 'Manual' },
        { onConflict: 'empleado_id,fecha,tipo' }
      )
      if (error) return
    } else if (empleadoId) {
      const { error } = await supabase.from('eventos_laborales').insert({ empleado_id: empleadoId, fecha, tipo })
      if (error) return
    }
    setDropdown(null)
    await fetchAll()
  }

  const monthName = new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())

  const empColor = (empId: string) => {
    const idx = empleados.findIndex(e => e.id === empId)
    return EMP_COLORS[idx % EMP_COLORS.length] ?? '#888'
  }

  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  return (
    <div>
      {/* Header navegación */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={() => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }}
          style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: T.pri, display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: FONT.heading, fontSize: 16, letterSpacing: '2px', textTransform: 'uppercase', color: T.pri, minWidth: 200, textAlign: 'center' }}>
          {monthName}
        </span>
        <button onClick={() => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }}
          style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: T.pri, display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Leyenda empleados */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {empleados.map((emp, i) => (
          <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: FONT.body, color: T.sec }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: EMP_COLORS[i % EMP_COLORS.length] }} />
            {emp.nombre}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: FONT.body, color: T.sec }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#e8f442' }} />
          Festivo
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: FONT.body, color: T.sec }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#aa3030' }} />
          Baja médica
        </div>
      </div>

      {/* Grid calendario */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {weekDays.map(d => (
          <div key={d} style={{ textAlign: 'center', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const fecha = isoDate(year, month, day)
          const esFest = esFestivo(fecha) || FESTIVOS_MADRID.includes(fecha)
          const evs = getEventosForDate(fecha)
          const isToday = new Date().toISOString().slice(0, 10) === fecha

          return (
            <div
              key={day}
              onClick={e => { e.stopPropagation(); setDropdown(d => d?.fecha === fecha ? null : { fecha, x: e.clientX, y: e.clientY }) }}
              style={{
                minHeight: 64, borderRadius: 6, border: `1px solid ${isToday ? '#B01D23' : T.brd}`,
                background: esFest ? '#e8f44215' : T.card,
                cursor: 'pointer', padding: 4, position: 'relative',
                boxShadow: isToday ? `0 0 0 2px #B01D23` : 'none',
              }}
            >
              <div style={{
                fontFamily: FONT.heading, fontSize: 12, fontWeight: isToday ? 700 : 400,
                color: esFest ? '#e8f442' : isToday ? '#B01D23' : T.sec,
                marginBottom: 3,
              }}>
                {day}
              </div>
              {esFest && <div style={{ fontSize: 8, color: '#e8f442', fontFamily: FONT.body, lineHeight: 1.2, marginBottom: 2 }}>Festivo</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {evs.map(ev => (
                  <div
                    key={ev.id}
                    title={`${TIPO_LABELS[ev.tipo]} — ${empleados.find(e => e.id === ev.empleado_id)?.nombre ?? 'General'}`}
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: ev.tipo === 'festivo' ? '#e8f442'
                        : ev.tipo === 'baja_medica' ? '#aa3030'
                        : ev.tipo === 'asuntos_propios' ? '#66aaff'
                        : ev.tipo === 'permiso_retribuido' ? '#9b59b6'
                        : empColor(ev.empleado_id ?? ''),
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Dropdown añadir evento */}
      {dropdown && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setDropdown(null)} />
          <div style={{
            position: 'fixed', left: Math.min(dropdown.x, window.innerWidth - 220), top: dropdown.y + 8,
            background: T.card, border: `1px solid ${T.brd}`, borderRadius: 8, zIndex: 100,
            minWidth: 200, padding: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, padding: '4px 8px 8px' }}>
              {dropdown.fecha}
            </div>
            <button
              onClick={() => addEvento(dropdown.fecha, 'festivo')}
              style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT.body, fontSize: 13, color: '#e8f442' }}
            >
              Marcar festivo
            </button>
            {empleados.map(emp => (
              <div key={emp.id} style={{ borderTop: `0.5px solid ${T.brd}`, paddingTop: 4, marginTop: 4 }}>
                <div style={{ padding: '4px 12px', fontFamily: FONT.body, fontSize: 11, color: T.mut }}>{emp.nombre}</div>
                {(['vacaciones', 'baja_medica', 'asuntos_propios', 'permiso_retribuido'] as const).map(tipo => (
                  <button
                    key={tipo}
                    onClick={() => addEvento(dropdown.fecha, tipo, emp.id)}
                    style={{ display: 'block', width: '100%', padding: '4px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT.body, fontSize: 12, color: TIPO_COLORES[tipo] || empColor(emp.id) }}
                  >
                    {TIPO_LABELS[tipo]}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
