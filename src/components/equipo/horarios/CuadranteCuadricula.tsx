/**
 * Cuadrante visual común — Esta Semana, Histórico, Plantillas, Generador.
 */
import { useMemo } from 'react'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { esFestivo, nombreFestivo } from '@/utils/festivosMadrid'
import {
  DIAS, type DiaKey, type Empleado, type Turno,
  horasSemanaPorEmpleado, descuentoSemanaPorEmpleado,
  horasReales, tramosTexto,
  fmtHoras, colorEmpleado,
} from './utils'

const FESTIVO_ROJO = '#B01D23'

export function nombrePila(nombre: string): string {
  return nombre.trim().split(/\s+/)[0]
}

export const ORDEN_PILA = ['Ray', 'Andrés', 'Emilio', 'Rubén']

export function ordenarEmpleados(emps: Empleado[]): Empleado[] {
  return [...emps].sort((a, b) => {
    const ia = ORDEN_PILA.indexOf(nombrePila(a.nombre))
    const ib = ORDEN_PILA.indexOf(nombrePila(b.nombre))
    const ra = ia === -1 ? Infinity : ia
    const rb = ib === -1 ? Infinity : ib
    if (ra !== rb) return ra - rb
    return a.nombre.localeCompare(b.nombre, 'es')
  })
}

export function isoDeFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fechasSemana(lunes: Date) {
  return DIAS.map((dia, i) => {
    const d = new Date(lunes)
    d.setDate(d.getDate() + i)
    const iso = isoDeFecha(d)
    return { dia, fecha: d, iso, num: d.getDate(), festivo: esFestivo(iso), festNombre: nombreFestivo(iso) }
  })
}

export function expandirTurnos(
  empleados: Empleado[],
  turnosPorPila: Record<string, Partial<Record<DiaKey, import('./utils').Tramo[]>>>,
): Turno[] {
  const ts: Turno[] = []
  for (const emp of empleados) {
    const pila = nombrePila(emp.nombre)
    const turnosEmp = turnosPorPila[pila]
    if (!turnosEmp) continue
    for (const dia of DIAS) {
      const tramos = turnosEmp[dia]
      if (tramos && tramos.length > 0) {
        const desc = (pila === 'Ray' || pila === 'Andrés') ? 30 : 0
        ts.push({ empleado_id: emp.id, dia, tramos, descuento_min: desc })
      }
    }
  }
  return ts
}

interface CuadranteProps {
  empleados: Empleado[]
  turnos: Turno[]
  lunes: Date
  cierres?: Partial<Record<DiaKey, string>>
  mostrarLeyenda?: boolean
}

export function CuadranteCuadricula({ empleados, turnos, lunes, cierres = {}, mostrarLeyenda = true }: CuadranteProps) {
  const { T } = useTheme()
  const horasEmp = horasSemanaPorEmpleado(turnos)
  const descEmp = descuentoSemanaPorEmpleado(turnos)
  const idxEmp = useMemo(() => {
    const m: Record<string, number> = {}
    empleados.forEach((e, i) => { m[e.id] = i })
    return m
  }, [empleados])
  const dias = useMemo(() => fechasSemana(lunes), [lunes])
  const turnoDe = (empId: string, dia: DiaKey) => turnos.find(t => t.empleado_id === empId && t.dia === dia)
  const cols = `120px repeat(7, minmax(0,1fr)) 100px`

  const empleadosVisibles = useMemo(() =>
    empleados.filter(e => turnos.some(t => t.empleado_id === e.id)),
  [empleados, turnos])

  const filaCierre = Object.keys(cierres).length > 0

  return (
    <div>
      <div style={{ ...cardStyle(T), padding: 14, overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 3, minWidth: 880 }}>
          <div />
          {dias.map(({ dia, num, festivo, festNombre }) => (
            <div key={dia} title={festNombre ?? undefined}
              style={{ textAlign: 'center', padding: '6px 2px', borderRadius: 4, border: festivo ? `2px solid ${FESTIVO_ROJO}` : 'none' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: festivo ? FESTIVO_ROJO : T.mut, fontWeight: festivo ? 700 : 500 }}>{dia} {num}</div>
              {festivo && (
                <div style={{ fontFamily: FONT.body, fontSize: 8, fontWeight: 600, color: FESTIVO_ROJO, lineHeight: 1.1, marginTop: 1 }}>
                  {festNombre}
                </div>
              )}
            </div>
          ))}
          <div style={{ textAlign: 'center', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#B01D23', padding: '6px 2px' }}>Total</div>

          {empleadosVisibles.map(emp => {
            const col = colorEmpleado(idxEmp[emp.id] ?? 0)
            const total = horasEmp[emp.id] ?? 0
            const desc = descEmp[emp.id] ?? 0
            return (
              <FilaEmpleado
                key={emp.id} emp={emp} col={col} total={total} desc={desc}
                dias={dias} turnoDe={turnoDe} T={T}
              />
            )
          })}

          {empleadosVisibles.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '40px 0', textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin datos.</div>
          )}

          {filaCierre && empleadosVisibles.length > 0 && (
            <>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#B01D23', fontWeight: 500, padding: '8px 4px', display: 'flex', alignItems: 'center' }}>
                Cierra
              </div>
              {dias.map(({ dia }) => (
                <div key={dia} style={{ fontFamily: FONT.body, fontSize: 11, textAlign: 'center', background: T.group, borderRadius: 4, padding: '6px 2px', fontWeight: 500, color: T.sec, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {cierres[dia] ?? ''}
                </div>
              ))}
              <div />
            </>
          )}
        </div>
      </div>

      {mostrarLeyenda && empleadosVisibles.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
          {empleadosVisibles.map(emp => {
            const i = idxEmp[emp.id] ?? 0
            const col = colorEmpleado(i)
            return (
              <span key={emp.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: col.bg }} />{nombrePila(emp.nombre)}
              </span>
            )
          })}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: T.group }} />Libre
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
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
      {/* Nombre — sin cargo, más grande */}
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 600, color: T.pri, padding: '8px 4px', display: 'flex', alignItems: 'center', letterSpacing: '0.5px' }}>
        {nombrePila(emp.nombre)}
      </div>

      {dias.map(({ dia, festivo }) => {
        const t = turnoDe(emp.id, dia)
        if (!t) {
          return (
            <div key={dia} style={{ background: T.group, color: T.mut, borderRadius: 5, fontSize: 13, fontStyle: 'italic', minHeight: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', border: festivo ? `2px solid ${FESTIVO_ROJO}` : 'none' }}>
              Libre
            </div>
          )
        }
        const real = horasReales(t)
        return (
          <div key={dia} style={{ background: col.bg, color: col.text, borderRadius: 5, padding: '6px 3px', textAlign: 'center', lineHeight: 1.25, minHeight: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center', border: festivo ? `2px solid ${FESTIVO_ROJO}` : 'none' }}>
            <b style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'pre-line' }}>{tramosTexto(t)}</b>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 700, marginTop: 4 }}>{fmtHoras(real)}</span>
          </div>
        )
      })}

      <div style={{ background: col.bg, color: col.text, borderRadius: 5, padding: '8px 4px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.25 }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 700 }}>{fmtHoras(total)}</span>
        {desc > 0 && <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>−{fmtHoras(desc)} desc</span>}
      </div>
    </>
  )
}
