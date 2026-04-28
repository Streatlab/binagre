import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'

interface Empleado { id: string; nombre: string }
interface Horario {
  id: string
  empleado_id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  turno_tipo: 'comida' | 'cena' | 'personalizado'
}
interface CalendarioOp {
  fecha: string
  tipo: string
}

const TURNOS_DEFAULT = {
  comida: { hora_inicio: '12:00', hora_fin: '16:00', color: '#1D9E75', label: 'Comida' },
  cena: { hora_inicio: '19:00', hora_fin: '23:30', color: '#f5a623', label: 'Cena' },
  personalizado: { hora_inicio: '09:00', hora_fin: '14:00', color: '#66aaff', label: 'Personalizado' },
}

function getISOWeekMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Drag handle: turno card
function TurnoCard({ horario, onDelete }: { horario: Horario; onDelete: () => void }) {
  const t = TURNOS_DEFAULT[horario.turno_tipo]
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: horario.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        padding: '4px 6px', borderRadius: 5, marginBottom: 3,
        background: t.color + '28', border: `1px solid ${t.color}`,
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        fontSize: 10, fontFamily: FONT.body, color: t.color,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}
    >
      <span>{t.label}<br /><span style={{ opacity: 0.75 }}>{horario.hora_inicio}–{horario.hora_fin}</span></span>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        style={{ background: 'none', border: 'none', color: t.color, cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '0 2px', marginLeft: 4 }}
      >×</button>
    </div>
  )
}

// Drop cell
function DayCell({
  empId, fecha, horarios, blocked, blockedMsg,
  onDrop, onDelete,
}: {
  empId: string; fecha: string; horarios: Horario[]; blocked: boolean; blockedMsg: string;
  onDrop: (turno: 'comida' | 'cena') => void; onDelete: (id: string) => void;
}) {
  const { T } = useTheme()
  const { setNodeRef, isOver } = useDroppable({ id: `${empId}::${fecha}` })
  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 64, padding: 4, borderRadius: 6,
        border: `1px solid ${isOver ? '#B01D23' : T.brd}`,
        background: blocked ? '#aa303010' : isOver ? '#B01D2310' : T.card,
        position: 'relative',
      }}
    >
      {blocked ? (
        <div style={{ fontSize: 9, color: '#aa3030', fontFamily: FONT.body, padding: '4px 0', textAlign: 'center' }}>
          <AlertTriangle size={10} style={{ marginRight: 2 }} />{blockedMsg}
        </div>
      ) : (
        <>
          {horarios.map(h => (
            <TurnoCard key={h.id} horario={h} onDelete={() => onDelete(h.id)} />
          ))}
          {!blocked && horarios.length === 0 && (
            <div style={{ padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => onDrop('comida')} style={{ padding: '2px 5px', borderRadius: 3, border: `1px dashed ${T.brd}`, background: 'none', color: T.mut, fontSize: 9, cursor: 'pointer', fontFamily: FONT.body }}>+ C</button>
                <button onClick={() => onDrop('cena')} style={{ padding: '2px 5px', borderRadius: 3, border: `1px dashed ${T.brd}`, background: 'none', color: T.mut, fontSize: 9, cursor: 'pointer', fontFamily: FONT.body }}>+ N</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function TabHorarios() {
  const { T, isDark: _isDark } = useTheme()
  const [weekStart, setWeekStart] = useState<Date>(() => getISOWeekMonday(new Date()))
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [calendario, setCalendario] = useState<CalendarioOp[]>([])
  const [toasts, setToasts] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const weekDates = Array.from({ length: 7 }, (_, i) => toISO(addDays(weekStart, i)))

  function addToast(msg: string) {
    setToasts(t => [...t, msg])
    setTimeout(() => setToasts(t => t.slice(1)), 3500)
  }

  async function fetchAll() {
    const firstDay = weekDates[0]
    const lastDay = weekDates[6]
    const [e, h, c] = await Promise.all([
      supabase.from('empleados').select('id, nombre').eq('estado', 'activo').order('nombre'),
      supabase.from('horarios').select('*').gte('fecha', firstDay).lte('fecha', lastDay),
      supabase.from('calendario_operativo').select('fecha, tipo').gte('fecha', firstDay).lte('fecha', lastDay),
    ])
    setEmpleados((e.data ?? []) as Empleado[])
    setHorarios((h.data ?? []) as Horario[])
    setCalendario((c.data ?? []) as CalendarioOp[])
  }

  useEffect(() => { fetchAll() }, [weekStart])

  function getCalendarioTipo(fecha: string): string {
    return calendario.find(c => c.fecha === fecha)?.tipo ?? 'operativo'
  }

  function isBlocked(fecha: string, turno: 'comida' | 'cena'): { blocked: boolean; msg: string } {
    const tipo = getCalendarioTipo(fecha)
    if (tipo === 'cerrado') return { blocked: true, msg: 'Cerrado' }
    if (tipo === 'solo_comida' && turno === 'cena') return { blocked: true, msg: 'Solo comida' }
    if (tipo === 'solo_cena' && turno === 'comida') return { blocked: true, msg: 'Solo cena' }
    return { blocked: false, msg: '' }
  }

  function validateHoras(empId: string, nuevaFecha: string, nuevoTurno: keyof typeof TURNOS_DEFAULT): string | null {
    const t = TURNOS_DEFAULT[nuevoTurno]
    const empHorarios = horarios.filter(h => h.empleado_id === empId)

    // Check 40h/week
    const totalMin = empHorarios.reduce((sum, h) => sum + parseMinutes(h.hora_fin) - parseMinutes(h.hora_inicio), 0)
    const nuevoMin = parseMinutes(t.hora_fin) - parseMinutes(t.hora_inicio)
    if (totalMin + nuevoMin > 40 * 60) return 'Excede 40h/semana para este empleado'

    // Check 12h rest between consecutive shifts
    for (const h of empHorarios) {
      if (h.fecha === nuevaFecha) continue
      const diff = Math.abs(new Date(nuevaFecha).getTime() - new Date(h.fecha).getTime()) / (1000 * 60 * 60)
      if (diff < 24) {
        const prevEnd = parseMinutes(h.hora_fin)
        const nextStart = parseMinutes(t.hora_inicio)
        const restMin = (diff * 60) - prevEnd + nextStart
        if (restMin < 12 * 60) return 'Descanso mínimo de 12h entre turnos'
      }
    }
    return null
  }

  async function addTurno(empId: string, fecha: string, turno: 'comida' | 'cena') {
    const b = isBlocked(fecha, turno)
    if (b.blocked) { addToast(b.msg); return }
    const warning = validateHoras(empId, fecha, turno)
    if (warning) { addToast(warning); return }
    const t = TURNOS_DEFAULT[turno]
    const { error } = await supabase.from('horarios').insert({
      empleado_id: empId, fecha,
      hora_inicio: t.hora_inicio, hora_fin: t.hora_fin, turno_tipo: turno,
    })
    if (error) addToast('Error: ' + error.message)
    else await fetchAll()
  }

  async function deleteTurno(id: string) {
    await supabase.from('horarios').delete().eq('id', id)
    await fetchAll()
  }

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null)
    if (!event.over) return
    const horarioId = event.active.id as string
    const target = event.over.id as string
    const [empId, fecha] = target.split('::')
    if (!empId || !fecha) return
    const h = horarios.find(x => x.id === horarioId)
    if (!h) return

    const turnoType = h.turno_tipo === 'cena' ? 'cena' : 'comida'
    const b = isBlocked(fecha, turnoType)
    if (b.blocked) { addToast(b.msg); return }

    // Move horario to new cell
    const { error } = await supabase.from('horarios').update({ empleado_id: empId, fecha }).eq('id', horarioId)
    if (error) addToast('Error: ' + error.message)
    else await fetchAll()
  }, [horarios, calendario])

  async function replicarSemana() {
    const prevWeekStart = addDays(weekStart, -7)
    const prevDates = Array.from({ length: 7 }, (_, i) => toISO(addDays(prevWeekStart, i)))
    const { data: prevHorarios } = await supabase.from('horarios').select('*').in('fecha', prevDates)
    if (!prevHorarios || prevHorarios.length === 0) { addToast('No hay horarios en la semana anterior'); return }
    const nuevos = prevHorarios.map((h: Horario) => ({
      empleado_id: h.empleado_id,
      fecha: toISO(addDays(new Date(h.fecha + 'T12:00:00'), 7)),
      hora_inicio: h.hora_inicio,
      hora_fin: h.hora_fin,
      turno_tipo: h.turno_tipo,
    }))
    const { error } = await supabase.from('horarios').insert(nuevos)
    if (error) addToast('Error al replicar: ' + error.message)
    else { addToast('Semana replicada'); await fetchAll() }
  }

  const th: React.CSSProperties = { padding: '8px 6px', fontFamily: FONT.heading, fontSize: 9, textTransform: 'uppercase', letterSpacing: '1.5px', color: T.mut, textAlign: 'center', background: T.group }

  const weekLabel = `${new Date(weekDates[0] + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — ${new Date(weekDates[6] + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div>
      {/* Toasts */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((msg, i) => (
          <div key={i} style={{ padding: '10px 16px', background: '#B01D23', color: '#fff', borderRadius: 8, fontFamily: FONT.body, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>{msg}</div>
        ))}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setWeekStart(d => addDays(d, -7))} style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: T.pri, display: 'flex' }}><ChevronLeft size={16} /></button>
          <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '1.5px', color: T.sec }}>{weekLabel}</span>
          <button onClick={() => setWeekStart(d => addDays(d, 7))} style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: T.pri, display: 'flex' }}><ChevronRight size={16} /></button>
        </div>
        <button
          onClick={replicarSemana}
          style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${T.brd}`, background: T.card, color: T.sec, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          Replicar semana anterior
        </button>
      </div>

      {/* Leyenda turnos */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {Object.entries(TURNOS_DEFAULT).map(([k, t]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: FONT.body, color: T.sec }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: t.color }} />
            {t.label} ({t.hora_inicio}–{t.hora_fin})
          </div>
        ))}
      </div>

      <DndContext sensors={sensors} onDragStart={e => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <div style={{ ...cardStyle(T), padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                <th style={{ ...th, textAlign: 'left', padding: '8px 14px', minWidth: 130 }}>Empleado</th>
                {weekDates.map((fecha, i) => {
                  const tipo = getCalendarioTipo(fecha)
                  const isCerrado = tipo === 'cerrado'
                  const d = new Date(fecha + 'T12:00:00')
                  return (
                    <th key={fecha} style={{ ...th, minWidth: 90 }}>
                      <div style={{ color: isCerrado ? '#aa3030' : T.mut }}>{diasSemana[i]}</div>
                      <div style={{ fontSize: 11, color: isCerrado ? '#aa3030' : T.sec, fontFamily: FONT.body, textTransform: 'none', letterSpacing: 0 }}>
                        {d.getDate()}/{d.getMonth() + 1}
                      </div>
                      {isCerrado && <div style={{ fontSize: 8, color: '#aa3030' }}>CERRADO</div>}
                      {tipo === 'solo_comida' && <div style={{ fontSize: 8, color: '#1D9E75' }}>SOLO C</div>}
                      {tipo === 'solo_cena' && <div style={{ fontSize: 8, color: '#f5a623' }}>SOLO N</div>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {empleados.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin empleados activos.</td></tr>
              ) : empleados.map(emp => (
                <tr key={emp.id} style={{ borderBottom: `1px solid ${T.brd}` }}>
                  <td style={{ padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri, fontWeight: 600 }}>{emp.nombre}</td>
                  {weekDates.map(fecha => {
                    const tipo = getCalendarioTipo(fecha)
                    const isCerrado = tipo === 'cerrado'
                    const empHorariosDia = horarios.filter(h => h.empleado_id === emp.id && h.fecha === fecha)
                    return (
                      <td key={fecha} style={{ padding: 4, verticalAlign: 'top' }}>
                        {isCerrado ? (
                          <div style={{ minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#aa303010', borderRadius: 6, border: `1px solid ${T.brd}` }}>
                            <span style={{ fontSize: 9, color: '#aa3030', fontFamily: FONT.body }}>Cerrado</span>
                          </div>
                        ) : (
                          <DayCell
                            empId={emp.id}
                            fecha={fecha}
                            horarios={empHorariosDia}
                            blocked={false}
                            blockedMsg=""
                            onDrop={turno => addTurno(emp.id, fecha, turno)}
                            onDelete={deleteTurno}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DragOverlay>
          {activeId ? (
            <div style={{
              padding: '6px 10px', borderRadius: 6, background: '#1D9E7580', border: '1px solid #1D9E75',
              fontFamily: FONT.body, fontSize: 11, color: '#fff', opacity: 0.9, cursor: 'grabbing',
            }}>
              Moviendo turno…
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
