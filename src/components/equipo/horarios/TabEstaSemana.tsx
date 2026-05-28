import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { esFestivo, nombreFestivo } from '@/utils/festivosMadrid'
import {
  DIAS, type DiaKey, type Empleado, type Turno,
  horasSemanaPorEmpleado, descuentoSemanaPorEmpleado,
  horasReales, esPartido, tramosTexto,
  lunesDeSemana, fmtRangoSemana, fmtHoras, numeroSemanaISO, colorEmpleado,
} from './utils'
import { getSemanaPorLunes } from './datosReales'

/** Texto de cierre por día (quién cierra a 23:00). Se enchufa con datos reales. */
type CierrePorDia = Partial<Record<DiaKey, string>>

function nombrePila(nombre: string): string {
  return nombre.trim().split(/\s+/)[0]
}

const ORDEN_PILA = ['Ray', 'Andrés', 'Emilio', 'Rubén']

function ordenarEmpleados(emps: Empleado[]): Empleado[] {
  return [...emps].sort((a, b) => {
    const ia = ORDEN_PILA.indexOf(nombrePila(a.nombre))
    const ib = ORDEN_PILA.indexOf(nombrePila(b.nombre))
    const ra = ia === -1 ? Infinity : ia
    const rb = ib === -1 ? Infinity : ib
    if (ra !== rb) return ra - rb
    return a.nombre.localeCompare(b.nombre, 'es')
  })
}

function isoDeFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fechasSemana(lunes: Date) {
  return DIAS.map((dia, i) => {
    const d = new Date(lunes)
    d.setDate(d.getDate() + i)
    const iso = isoDeFecha(d)
    return { dia, fecha: d, iso, num: d.getDate(), festivo: esFestivo(iso), festNombre: nombreFestivo(iso) }
  })
}

// Color festivo Streat Lab — borde rojo contundente, sin fondo amarillo
const FESTIVO_ROJO = '#B01D23'

export default function TabEstaSemana() {
  const { T } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [cierre] = useState<CierrePorDia>({})
  const [nota] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [lunes, setLunes] = useState<Date>(() => lunesDeSemana(new Date()))

  useEffect(() => {
    supabase.from('empleados').select('id,nombre,cargo').eq('estado', 'activo')
      .then(({ data }) => { setEmpleados(ordenarEmpleados((data ?? []) as Empleado[])); setLoading(false) })
  }, [])

  // Carga turnos desde semilla local (datosReales.ts) según el lunes seleccionado
  useEffect(() => {
    const iso = isoDeFecha(lunes)
    const sem = getSemanaPorLunes(iso)
    if (!sem || empleados.length === 0) { setTurnos([]); return }
    const ts: Turno[] = []
    for (const emp of empleados) {
      const pila = nombrePila(emp.nombre)
      const turnosEmp = sem.turnos[pila]
      if (!turnosEmp) continue
      for (const dia of DIAS) {
        const tramos = turnosEmp[dia]
        if (tramos && tramos.length > 0) {
          // descuento 30 min para cocineros (Ray, Andrés)
          const desc = (pila === 'Ray' || pila === 'Andrés') ? 30 : 0
          ts.push({ empleado_id: emp.id, dia, tramos, descuento_min: desc })
        }
      }
    }
    setTurnos(ts)
  }, [lunes, empleados])

  const horasEmp = horasSemanaPorEmpleado(turnos)
  const descEmp = descuentoSemanaPorEmpleado(turnos)
  const idxEmp = useMemo(() => {
    const m: Record<string, number> = {}
    empleados.forEach((e, i) => { m[e.id] = i })
    return m
  }, [empleados])

  const dias = useMemo(() => fechasSemana(lunes), [lunes])

  const turnoDe = (empId: string, dia: DiaKey) =>
    turnos.find(t => t.empleado_id === empId && t.dia === dia)

  const cols = `90px repeat(7, minmax(0,1fr)) 86px`

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 600, color: '#B01D23', letterSpacing: '3px', textTransform: 'uppercase' }}>
          Rota S{numeroSemanaISO(lunes)} · {fmtRangoSemana(lunes)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() - 7); return n })} style={navBtn(T)}><ChevronLeft size={16} /></button>
          <button onClick={() => setLunes(lunesDeSemana(new Date()))} style={{ ...navBtn(T), width: 'auto', padding: '0 12px', fontSize: 11, fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase' }}>Hoy</button>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() + 7); return n })} style={navBtn(T)}><ChevronRight size={16} /></button>
        </div>
      </div>
      {nota && <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 14 }}>{nota}</div>}

      <div style={{ ...cardStyle(T), padding: 14, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 3, minWidth: 780 }}>
            <div />
            {dias.map(({ dia, num, festivo, festNombre }) => (
              <div key={dia} title={festNombre ?? undefined}
                style={{ textAlign: 'center', padding: '6px 2px', borderRadius: 4, border: festivo ? `2px solid ${FESTIVO_ROJO}` : 'none' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: festivo ? FESTIVO_ROJO : T.mut, fontWeight: festivo ? 700 : 500 }}>{dia} {num}</div>
                {festivo && (
                  <div style={{ fontFamily: FONT.body, fontSize: 7.5, fontWeight: 600, color: FESTIVO_ROJO, lineHeight: 1.1, marginTop: 1 }}>
                    {festNombre}
                  </div>
                )}
              </div>
            ))}
            <div style={{ textAlign: 'center', fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#B01D23', padding: '6px 2px' }}>Total</div>

            {empleados.map(emp => {
              const col = colorEmpleado(idxEmp[emp.id] ?? 0)
              const total = horasEmp[emp.id] ?? 0
              const desc = descEmp[emp.id] ?? 0
              return (
                <FilaEmpleado
                  key={emp.id}
                  emp={emp}
                  col={col}
                  total={total}
                  desc={desc}
                  dias={dias}
                  turnoDe={turnoDe}
                  T={T}
                />
              )
            })}

            {empleados.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '40px 0', textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin empleados activos.</div>
            )}

            {empleados.length > 0 && (
              <>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#B01D23', fontWeight: 500, padding: '8px 4px', display: 'flex', alignItems: 'center' }}>
                  Cierra 23:00
                </div>
                {dias.map(({ dia }) => (
                  <div key={dia} style={{ fontFamily: FONT.body, fontSize: 9.5, textAlign: 'center', background: T.group, borderRadius: 4, padding: '6px 2px', fontWeight: 500, color: T.sec, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {cierre[dia] ?? ''}
                  </div>
                ))}
                <div />
              </>
            )}
          </div>
        )}
      </div>

      {empleados.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
          {empleados.map((emp, i) => {
            const col = colorEmpleado(i)
            return (
              <span key={emp.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: col.bg }} />{nombrePila(emp.nombre)}
              </span>
            )
          })}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: T.group }} />Libre
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#fff', border: `2px solid ${FESTIVO_ROJO}` }} />Festivo Madrid
          </span>
        </div>
      )}
    </div>
  )
}

function FilaEmpleado({
  emp, col, total, desc, dias, turnoDe, T,
}: {
  emp: Empleado
  col: { bg: string; text: string }
  total: number
  desc: number
  dias: ReturnType<typeof fechasSemana>
  turnoDe: (id: string, dia: DiaKey) => Turno | undefined
  T: ReturnType<typeof useTheme>['T']
}) {
  return (
    <>
      <div style={{ fontFamily: FONT.body, fontSize: 11, fontWeight: 600, color: T.pri, padding: '8px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {nombrePila(emp.nombre)}
        {emp.cargo && <span style={{ fontSize: 9, color: T.mut, fontWeight: 400 }}>{emp.cargo}</span>}
      </div>

      {dias.map(({ dia, festivo }) => {
        const t = turnoDe(emp.id, dia)
        if (!t) {
          return (
            <div key={dia} style={{ background: T.group, color: T.mut, borderRadius: 5, fontSize: 10, fontStyle: 'italic', minHeight: 66, display: 'flex', alignItems: 'center', justifyContent: 'center', border: festivo ? `2px solid ${FESTIVO_ROJO}` : 'none' }}>
              Libre
            </div>
          )
        }
        const real = horasReales(t)
        const tipo = esPartido(t) ? 'partido' : 'corrido'
        return (
          <div key={dia} style={{ background: col.bg, color: col.text, borderRadius: 5, padding: '5px 3px', fontSize: 10, textAlign: 'center', lineHeight: 1.3, minHeight: 66, display: 'flex', flexDirection: 'column', justifyContent: 'center', border: festivo ? `2px solid ${FESTIVO_ROJO}` : 'none' }}>
            <b style={{ fontSize: 10, fontWeight: 600, whiteSpace: 'pre-line' }}>{tramosTexto(t)}</b>
            <span style={{ fontSize: 9, opacity: 0.75, marginTop: 2 }}>{tipo} · {fmtHoras(real)}</span>
          </div>
        )
      })}

      <div style={{ background: col.bg, color: col.text, borderRadius: 5, padding: '8px 4px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.3 }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 600 }}>{fmtHoras(total)}</span>
        <span style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>{desc > 0 ? `−${fmtHoras(desc)} desc` : 'sin desc'}</span>
      </div>
    </>
  )
}

function navBtn(T: ReturnType<typeof useTheme>['T']): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 8, border: `0.5px solid ${T.brd}`, background: T.card, color: T.sec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
}
