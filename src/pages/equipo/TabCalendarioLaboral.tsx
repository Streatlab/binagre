import { AZUL_CL, GRANATE, LIMA, ROJO, VERDE } from '@/styles/neobrutal'
import { EMP_CALENDARIO_EXTRA, PERMISO_RETRIBUIDO, FESTIVO_CALENDARIO_TXT, SIN_DATO_GRIS, CALENDARIO_FESTIVO_BG } from '@/styles/palettes'
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { FESTIVOS_MADRID, esFestivo, nombreFestivo } from '@/utils/festivosMadrid'
import { HeroCantera, Papel, FrasePotente, PantallaCantera } from '@/components/kit/cantera'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

interface Empleado { id: string; nombre: string }
interface EventoLaboral {
  id: string
  empleado_id: string
  fecha: string
  tipo: 'festivo' | 'vacaciones' | 'baja_medica' | 'asuntos_propios' | 'permiso_retribuido'
  nota?: string
}

// Colores por empleado (top 5 + fallback)
// Colores empleados en calendario — paleta distinta de los tokens Marino+Fuego de David (prohibidos aquí)
const EMP_COLORS = [GRANATE, EMP_CALENDARIO_EXTRA[0], VERDE, EMP_CALENDARIO_EXTRA[1], EMP_CALENDARIO_EXTRA[2], EMP_CALENDARIO_EXTRA[3]]

const TIPO_LABELS: Record<string, string> = {
  festivo: 'Festivo',
  vacaciones: 'Vacaciones',
  baja_medica: 'Baja médica',
  asuntos_propios: 'Asuntos propios',
  permiso_retribuido: 'Permiso retribuido',
}

const TIPO_COLORES: Record<string, string> = {
  festivo: LIMA,
  vacaciones: '', // color por empleado
  baja_medica: ROJO,
  asuntos_propios: AZUL_CL,
  permiso_retribuido: PERMISO_RETRIBUIDO,
}

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// ─── FASE 2: PDF con el marco único (área 'equipo') — botón Imprimir ────────
const AREA: M.Area = 'equipo'

/** Calendario laboral del mes. Sin empleados → null (regla del marco). */
function construirCalendarioLaboralPDF(empleados: Empleado[], eventos: EventoLaboral[], year: number, month: number, rec: M.Recursos, bn = false) {
  if (empleados.length === 0) return null

  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)

  const monthName = new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())
  let y = M.pintarCabecera(doc, ctx, { docNombre: 'Calendario Laboral', tituloCentrado: monthName, area: AREA, bn })

  const empColor = (empId: string) => {
    const idx = empleados.findIndex(e => e.id === empId)
    return hexRgb(EMP_COLORS[idx % EMP_COLORS.length] ?? SIN_DATO_GRIS)
  }

  // Leyenda
  M.fDato(doc, ctx, true); doc.setFontSize(7.5)
  let xLeg = cb.x0
  const leyenda: Array<{ label: string; color: [number, number, number] }> = [
    ...empleados.map((e, i) => ({ label: e.nombre, color: hexRgb(EMP_COLORS[i % EMP_COLORS.length]) })),
    { label: 'Festivo', color: hexRgb(LIMA) },
    { label: 'Baja médica', color: hexRgb(ROJO) },
  ]
  for (const it of leyenda) {
    doc.setFillColor(it.color[0], it.color[1], it.color[2]); doc.circle(xLeg + 1, y - 1, 1, 'F')
    doc.setTextColor(...M.TINTA)
    doc.text(it.label, xLeg + 3.5, y)
    xLeg += doc.getTextWidth(it.label) + 10
    if (xLeg > cb.x1 - 20) { xLeg = cb.x0; y += 4.5 }
  }
  y += 6

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const startOffset = firstWeekday === 0 ? 6 : firstWeekday - 1
  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const cellW = cb.w / 7
  const rows = Math.ceil((daysInMonth + startOffset) / 7)
  const cellH = Math.min(22, (cb.bottom - y - 6) / rows)

  M.fTitulo(doc, ctx, true); doc.setFontSize(8); doc.setTextColor(...M.GRIS)
  weekDays.forEach((d, i) => doc.text(d, cb.x0 + i * cellW + cellW / 2, y, { align: 'center' }))
  y += 4

  for (let day = 1; day <= daysInMonth; day++) {
    const idx = startOffset + day - 1
    const row = Math.floor(idx / 7)
    const col = idx % 7
    const x = cb.x0 + col * cellW
    const cy = y + row * cellH
    const fecha = isoDate(year, month, day)
    const esFest = esFestivo(fecha) || FESTIVOS_MADRID.includes(fecha)
    const festNombre = nombreFestivo(fecha)
    const evs = eventos.filter(e => e.fecha === fecha)

    if (esFest) { doc.setFillColor(pal.soft[0], pal.soft[1], pal.soft[2]); doc.roundedRect(x + 0.4, cy + 0.4, cellW - 0.8, cellH - 0.8, M.R, M.R, 'F') }
    doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.15); doc.roundedRect(x + 0.4, cy + 0.4, cellW - 0.8, cellH - 0.8, M.R, M.R, 'S')

    M.fTitulo(doc, ctx, true); doc.setFontSize(9); doc.setTextColor(esFest ? pal.acento[0] : M.TINTA[0], esFest ? pal.acento[1] : M.TINTA[1], esFest ? pal.acento[2] : M.TINTA[2])
    doc.text(String(day), x + 2, cy + 4)

    if (festNombre) {
      M.fDato(doc, ctx, true); doc.setFontSize(5.5); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
      const maxW = cellW - 3
      const fs = M.fitFont(doc, festNombre, maxW, 5.5, 4)
      doc.setFontSize(fs)
      doc.text(festNombre, x + cellW / 2, cy + 8, { align: 'center', maxWidth: maxW })
    }

    let dx = x + 2
    for (const ev of evs) {
      const c = ev.tipo === 'festivo' ? hexRgb(LIMA)
        : ev.tipo === 'baja_medica' ? hexRgb(ROJO)
        : ev.tipo === 'asuntos_propios' ? hexRgb(AZUL_CL)
        : ev.tipo === 'permiso_retribuido' ? hexRgb(PERMISO_RETRIBUIDO)
        : empColor(ev.empleado_id ?? '')
      doc.setFillColor(c[0], c[1], c[2]); doc.circle(dx, cy + cellH - 3, 1, 'F')
      dx += 3
    }
  }

  M.pintarPaginado(doc, 1, 1, ctx)
  return doc
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
    return EMP_COLORS[idx % EMP_COLORS.length] ?? SIN_DATO_GRIS
  }

  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  const ausenciasDelMes = useMemo(() => eventos.filter(e => e.tipo !== 'festivo').length, [eventos])

  return (
    <PantallaCantera embedded>
      <HeroCantera
        area="equipo"
        titular={ausenciasDelMes > 0
          ? `${monthName}: ${ausenciasDelMes} ausencia${ausenciasDelMes !== 1 ? 's' : ''} registrada${ausenciasDelMes !== 1 ? 's' : ''}`
          : `${monthName}: sin ausencias registradas`}
        etiquetaDato="Ausencias del mes"
        cifra={String(ausenciasDelMes)}
        resumen={<>{empleados.length} persona{empleados.length !== 1 ? 's' : ''} en el calendario laboral.</>}
        atencion={[`${ausenciasDelMes} ausencias`, `${empleados.length} personas`]}
      />

      {ausenciasDelMes > 0 ? (
        <FrasePotente significado="oportunidad">Hay {ausenciasDelMes} ausencia{ausenciasDelMes !== 1 ? 's' : ''} este mes: revisa la cobertura de turnos antes de que falte gente.</FrasePotente>
      ) : (
        <FrasePotente significado="logro">Equipo al completo este mes: ninguna ausencia registrada.</FrasePotente>
      )}

      <Papel ceja={GRANATE}>
      {/* Header navegación */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={() => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }}
          style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 0, padding: '6px 10px', cursor: 'pointer', color: T.pri, display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: FONT.heading, fontSize: 16, letterSpacing: '2px', textTransform: 'uppercase', color: T.pri, minWidth: 200, textAlign: 'center' }}>
          {monthName}
        </span>
        <button onClick={() => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }}
          style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 0, padding: '6px 10px', cursor: 'pointer', color: T.pri, display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={16} />
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <BotonImprimir
            compacto
            documentoId="equipo.calendario_laboral"
            titulo={`Calendario laboral · ${monthName}`}
            generarPdf={async opts => { const rec = await M.cargarRecursos(); return construirCalendarioLaboralPDF(empleados, eventos, year, month, rec, opts.bn) }}
          />
        </div>
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
          <div style={{ width: 10, height: 10, borderRadius: 0, background: LIMA }} />
          Festivo
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: FONT.body, color: T.sec }}>
          <div style={{ width: 10, height: 10, borderRadius: 0, background: ROJO }} />
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
          const festNombre = nombreFestivo(fecha)
          const evs = getEventosForDate(fecha)
          const isToday = new Date().toISOString().slice(0, 10) === fecha

          return (
            <div
              key={day}
              onClick={e => { e.stopPropagation(); setDropdown(d => d?.fecha === fecha ? null : { fecha, x: e.clientX, y: e.clientY }) }}
              title={festNombre ?? undefined}
              style={{
                minHeight: 64, borderRadius: 0, border: `1px solid ${isToday ? GRANATE : T.brd}`,
                background: esFest ? CALENDARIO_FESTIVO_BG : T.card,
                cursor: 'pointer', padding: 4, position: 'relative',
                boxShadow: isToday ? `0 0 0 2px ${GRANATE}` : 'none',
              }}
            >
              <div style={{
                fontFamily: FONT.heading, fontSize: 12, fontWeight: isToday ? 700 : 400,
                color: esFest ? FESTIVO_CALENDARIO_TXT : isToday ? GRANATE : T.sec,
                marginBottom: 3,
              }}>
                {day}
              </div>
              {festNombre && (
                <div style={{ fontSize: 8, color: FESTIVO_CALENDARIO_TXT, fontFamily: FONT.body, lineHeight: 1.2, marginBottom: 2, fontWeight: 600 }}>
                  {festNombre}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {evs.map(ev => (
                  <div
                    key={ev.id}
                    title={`${TIPO_LABELS[ev.tipo]} — ${empleados.find(e => e.id === ev.empleado_id)?.nombre ?? 'General'}`}
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: ev.tipo === 'festivo' ? LIMA
                        : ev.tipo === 'baja_medica' ? ROJO
                        : ev.tipo === 'asuntos_propios' ? AZUL_CL
                        : ev.tipo === 'permiso_retribuido' ? PERMISO_RETRIBUIDO
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
            background: T.card, border: `1px solid ${T.brd}`, borderRadius: 0, zIndex: 100,
            minWidth: 200, padding: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, padding: '4px 8px 8px' }}>
              {dropdown.fecha}
            </div>
            <button
              onClick={() => addEvento(dropdown.fecha, 'festivo')}
              style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT.body, fontSize: 13, color: FESTIVO_CALENDARIO_TXT }}
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
      </Papel>
    </PantallaCantera>
  )
}
