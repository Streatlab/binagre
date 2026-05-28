import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { useMultiSort } from '@/hooks/useMultiSort'
import SortableHeader, { ClearSortButton } from '@/components/ui/SortableHeader'
import {
  DIAS, type DiaKey, type Empleado, type Turno,
  horasReales, esPartido, tramosTexto,
  horasSemanaPorEmpleado, lunesDeSemana, fmtRangoSemana, fmtHoras, colorEmpleado,
} from './utils'

type Col = 'empleado' | 'total'

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

export default function TabHistorico() {
  const { T } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [lunes, setLunes] = useState<Date>(() => { const l = lunesDeSemana(new Date()); l.setDate(l.getDate() - 7); return l })

  const { handleSort, clearSorts, sortIndex, sortDir, applySort, showClearButton } =
    useMultiSort<Empleado, Col>({ defaultSorts: [{ col: 'empleado', dir: 'asc' }] })

  useEffect(() => {
    supabase.from('empleados').select('id,nombre,cargo')
      .then(({ data }) => { setEmpleados(ordenarEmpleados((data ?? []) as Empleado[])); setLoading(false) })
  }, [])

  // Turnos históricos se cargan aquí por rango de semana (tabla `turnos_semana`) cuando se enchufe.

  const horasEmp = horasSemanaPorEmpleado(turnos)
  const totalHoras = turnos.reduce((s, t) => s + horasReales(t), 0)
  const idxEmp = useMemo(() => {
    const m: Record<string, number> = {}
    empleados.forEach((e, i) => { m[e.id] = i })
    return m
  }, [empleados])

  const empleadosOrden = useMemo(() => applySort(empleados, {
    empleado: e => e.nombre,
    total: e => horasEmp[e.id] ?? 0,
  }), [empleados, horasEmp, applySort])

  const th: React.CSSProperties = { padding: '10px 12px', fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: T.mut, fontWeight: 400, background: T.group, textAlign: 'center', whiteSpace: 'nowrap', borderBottom: `0.5px solid ${T.brd}` }
  const td: React.CSSProperties = { padding: '5px 4px', fontFamily: FONT.body, fontSize: 13, color: T.pri, textAlign: 'center', borderBottom: `1px solid ${T.brd}`, verticalAlign: 'middle' }

  function celdaTurno(empId: string, dia: DiaKey) {
    const t = turnos.find(x => x.empleado_id === empId && x.dia === dia)
    if (!t) return <span style={{ color: T.mut, fontSize: 11, fontStyle: 'italic' }}>Libre</span>
    const col = colorEmpleado(idxEmp[empId] ?? 0)
    return (
      <span style={{ display: 'inline-block', padding: '4px 6px', borderRadius: 5, background: col.bg, color: col.text, fontSize: 10, fontFamily: FONT.body, fontWeight: 500, lineHeight: 1.25 }}>
        <span style={{ whiteSpace: 'pre-line' }}>{tramosTexto(t)}</span>
        <span style={{ display: 'block', fontSize: 8.5, opacity: 0.7 }}>{esPartido(t) ? 'partido' : 'corrido'} · {fmtHoras(horasReales(t))}</span>
      </span>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() - 7); return n })} style={navBtn(T)}><ChevronLeft size={16} /></button>
          <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.sec, minWidth: 180, textAlign: 'center' }}>
            {fmtRangoSemana(lunes)}
          </span>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() + 7); return n })} style={navBtn(T)}><ChevronRight size={16} /></button>
          <ClearSortButton show={showClearButton} onClear={clearSorts} />
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <KpiInline label="Horas totales" value={fmtHoras(totalHoras)} T={T} />
        </div>
      </div>

      <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  <SortableHeader col="empleado" label="Empleado" sortIndex={sortIndex('empleado')} sortDir={sortDir('empleado')} onToggle={handleSort} />
                  {DIAS.map(d => <th key={d} style={th}>{d}</th>)}
                  <SortableHeader col="total" label="Total" sortIndex={sortIndex('total')} sortDir={sortDir('total')} onToggle={handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {empleadosOrden.length === 0 ? (
                  <tr><td colSpan={DIAS.length + 2} style={{ ...td, padding: '40px 24px', color: T.mut }}>Sin datos para esta semana.</td></tr>
                ) : empleadosOrden.map(emp => (
                  <tr key={emp.id}>
                    <td style={{ padding: '10px 12px', fontFamily: FONT.body, fontSize: 13, color: T.pri, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${T.brd}` }}>
                      {nombrePila(emp.nombre)}
                      {emp.cargo && <div style={{ fontSize: 10, color: T.mut, fontWeight: 400 }}>{emp.cargo}</div>}
                    </td>
                    {DIAS.map(d => <td key={d} style={td}>{celdaTurno(emp.id, d)}</td>)}
                    <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, fontWeight: 600, fontSize: 14 }}>{fmtHoras(horasEmp[emp.id] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function navBtn(T: ReturnType<typeof useTheme>['T']): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 8, border: `0.5px solid ${T.brd}`, background: T.card, color: T.sec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
}

function KpiInline({ label, value, T }: { label: string; value: string; T: ReturnType<typeof useTheme>['T'] }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut }}>{label}</div>
      <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: T.pri }}>{value}</div>
    </div>
  )
}
