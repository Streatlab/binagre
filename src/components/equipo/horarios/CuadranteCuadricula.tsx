/**
 * Cuadrante visual común — Esta Semana, Histórico, Plantillas, Generador.
 */
import { useMemo } from 'react'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { esFestivo, nombreFestivo } from '@/utils/festivosMadrid'
import {
  DIAS, type DiaKey, type Empleado, type Turno,
  horasSemanaPorEmpleado, horasBrutasSemanaPorEmpleado,
  horasReales, horasBrutas, tramosTexto,
  colorEmpleado,
} from './utils'

const FESTIVO_ROJO = '#B01D23'

/** Semana con override puntual: en ella las celdas sin turno van en gris sin la palabra "Libre". */
const SEMANA_SIN_LIBRE = '2026-06-15'

/** Formatea horas reales como "6h 45min" (vista). Si son horas justas, "8h". */
function fmtHM(h: number): string {
  const totalMin = Math.round(h * 60)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return mm === 0 ? `${hh}h` : `${hh}h ${mm}min`
}

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
  mostrarCierre?: boolean
  mostrarLeyenda?: boolean
}

export function CuadranteCuadricula({ empleados, turnos, lunes, cierres = {}, mostrarCierre = true }: CuadranteProps) {
  const { T } = useTheme()
  const horasEmp = horasSemanaPorEmpleado(turnos)
  const brutoEmp = horasBrutasSemanaPorEmpleado(turnos)
  const idxEmp = useMemo(() => {
    const m: Record<string, number> = {}
    empleados.forEach((e, i) => { m[e.id] = i })
    return m
  }, [empleados])
  const dias = useMemo(() => fechasSemana(lunes), [lunes])
  const ocultarLibre = isoDeFecha(lunes) === SEMANA_SIN_LIBRE
  const turnoDe = (empId: string, dia: DiaKey) => turnos.find(t => t.empleado_id === empId && t.dia === dia)
  const cols = `120px repeat(7, minmax(0,1fr)) 100px`

  const empleadosVisibles = useMemo(() =>
    empleados.filter(e => turnos.some(t => t.empleado_id === e.id)),
  [empleados, turnos])

  const filaCierre = mostrarCierre && Object.keys(cierres).length > 0

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
            const totalBruto = brutoEmp[emp.id] ?? 0
            return (
              <FilaEmpleado
                key={emp.id} emp={emp} col={col} total={total} totalBruto={totalBruto}
                dias={dias} turnoDe={turnoDe} T={T} ocultarLibre={ocultarLibre}
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
    </div>
  )
}

function FilaEmpleado({
  emp, col, total, totalBruto, dias, turnoDe, T, ocultarLibre,
}: {
  emp: Empleado
  col: { bg: string; text: string }
  total: number
  totalBruto: number
  dias: ReturnType<typeof fechasSemana>
  turnoDe: (id: string, dia: DiaKey) => Turno | undefined
  T: ReturnType<typeof useTheme>['T']
  ocultarLibre: boolean
}) {
  return (
    <>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 600, color: T.pri, padding: '8px 4px', display: 'flex', alignItems: 'center', letterSpacing: '0.5px' }}>
        {nombrePila(emp.nombre)}
      </div>

      {dias.map(({ dia, festivo }) => {
        const t = turnoDe(emp.id, dia)
        if (!t) {
          return (
            <div key={dia} style={{ background: T.group, color: T.mut, borderRadius: 5, fontSize: 12, fontStyle: 'italic', minHeight: 78, display: 'flex', alignItems: 'center', justifyContent: 'center', border: festivo ? `2px solid ${FESTIVO_ROJO}` : 'none' }}>
              {ocultarLibre ? '' : 'Libre'}
            </div>
          )
        }
        const real = horasReales(t)
        const bruto = horasBrutas(t)
        const hayDescuento = Math.abs(bruto - real) > 0.001
        return (
          <div key={dia} style={{ background: col.bg, color: col.text, borderRadius: 5, padding: '6px 3px', textAlign: 'center', lineHeight: 1.25, minHeight: 78, display: 'flex', flexDirection: 'column', justifyContent: 'center', border: festivo ? `2px solid ${FESTIVO_ROJO}` : 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'pre-line' }}>{tramosTexto(t)}</span>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 500, marginTop: 4, opacity: 0.7 }}>
              {fmtHM(real)}
              {hayDescuento && (
                <span style={{ color: '#B01D23', opacity: 1, fontWeight: 600 }}> /{fmtHM(bruto)}</span>
              )}
            </span>
          </div>
        )
      })}

      <div style={{ background: col.bg, color: col.text, borderRadius: 5, padding: '8px 4px', textAlign: 'center', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 700 }}>{fmtHM(total)}</span>
        {Math.abs(totalBruto - total) > 0.001 && (
          <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 600, color: '#B01D23' }}>/{fmtHM(totalBruto)}</span>
        )}
      </div>
    </>
  )
}
