import { GRANATE, NAR, VERDE } from '@/styles/neobrutal'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { useMultiSort } from '@/hooks/useMultiSort'
import SortableHeader, { ClearSortButton } from '@/components/ui/SortableHeader'
import {
  type Empleado, type Turno, REGLAS_DEFAULT,
  horasSemanaPorEmpleado, fmtHoras, lunesDeSemana,
} from './utils'
import { isoDeFecha } from './CuadranteCuadricula'
import { fetchTurnosDB } from './fetchTurnosDB'

type Col = 'nombre' | 'horas' | 'uso' | 'estado'

interface Fila {
  id: string
  nombre: string
  cargo?: string | null
  horas: number
  pct: number
  estadoOrden: number  // 0 OK, 1 al límite, 2 extra
}

export default function TabResumenHoras() {
  const { T } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const reglas = REGLAS_DEFAULT

  const { handleSort, clearSorts, sortIndex, sortDir, applySort, showClearButton } =
    useMultiSort<Fila, Col>({ defaultSorts: [{ col: 'horas', dir: 'desc' }] })

  useEffect(() => {
    const lunesISO = isoDeFecha(lunesDeSemana(new Date()))
    Promise.all([
      supabase.from('empleados').select('id,nombre,cargo').eq('estado', 'activo').order('nombre'),
      fetchTurnosDB(lunesISO),
    ]).then(([{ data }, turnosBD]) => {
      setEmpleados((data ?? []) as Empleado[])
      setTurnos(turnosBD)
      setLoading(false)
    })
  }, [])

  // Turnos de la semana en curso cargados desde BD (tabla `horarios`).

  const horasEmp = horasSemanaPorEmpleado(turnos)
  const totalHoras = Object.values(horasEmp).reduce((a, b) => a + b, 0)
  const conExtra = empleados.filter(e => (horasEmp[e.id] ?? 0) > reglas.horas_max_semana).length
  const promedio = empleados.length ? totalHoras / empleados.length : 0

  const filas: Fila[] = useMemo(() => empleados.map(emp => {
    const h = horasEmp[emp.id] ?? 0
    const pct = reglas.horas_max_semana ? (h / reglas.horas_max_semana) * 100 : 0
    const estadoOrden = h > reglas.horas_max_semana ? 2 : pct >= 90 ? 1 : 0
    return { id: emp.id, nombre: emp.nombre, cargo: emp.cargo, horas: h, pct, estadoOrden }
  }), [empleados, horasEmp, reglas.horas_max_semana])

  const filasOrden = applySort(filas, {
    nombre: r => r.nombre,
    horas: r => r.horas,
    uso: r => r.pct,
    estado: r => r.estadoOrden,
  })

  const td: React.CSSProperties = { padding: '12px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 16 }}>
        <KpiCard label="Horas totales" value={`${fmtHoras(totalHoras)} h`} T={T} />
        <KpiCard label="Promedio / empleado" value={`${fmtHoras(promedio)} h`} T={T} />
        <KpiCard label="Tope semanal" value={`${reglas.horas_max_semana} h`} T={T} />
        <KpiCard label="Con horas extra" value={`${conExtra}`} color={conExtra > 0 ? NAR : undefined} T={T} />
      </div>

      {showClearButton && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <ClearSortButton show={showClearButton} onClear={clearSorts} />
        </div>
      )}

      {/* Tabla por empleado con barra de progreso + semáforo */}
      <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <SortableHeader col="nombre" label="Empleado"     sortIndex={sortIndex('nombre')} sortDir={sortDir('nombre')} onToggle={handleSort} />
                <SortableHeader col="horas"  label="Horas semana" sortIndex={sortIndex('horas')}  sortDir={sortDir('horas')}  onToggle={handleSort} />
                <SortableHeader col="uso"    label="Uso vs tope"  sortIndex={sortIndex('uso')}    sortDir={sortDir('uso')}    onToggle={handleSort} style={{ width: '40%' }} />
                <SortableHeader col="estado" label="Estado"       sortIndex={sortIndex('estado')} sortDir={sortDir('estado')} onToggle={handleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {filasOrden.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '40px 24px', textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin empleados activos.</td></tr>
              ) : filasOrden.map(f => {
                const color = f.estadoOrden === 2 ? GRANATE : f.estadoOrden === 1 ? NAR : VERDE
                return (
                  <tr key={f.id} style={{ borderBottom: `1px solid ${T.brd}` }}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {f.nombre}
                      {f.cargo && <div style={{ fontSize: 11, color: T.mut, fontWeight: 400 }}>{f.cargo}</div>}
                    </td>
                    <td style={{ ...td, fontFamily: FONT.heading, fontSize: 15, fontWeight: 600 }}>{fmtHoras(f.horas)} h</td>
                    <td style={td}>
                      <div style={{ height: 8, borderRadius: 4, background: T.brd, overflow: 'hidden' }}>
                        <div style={{ height: 8, width: `${Math.min(f.pct, 100)}%`, background: color, borderRadius: 4, transition: 'width .4s ease' }} />
                      </div>
                      <span style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body }}>{Math.round(f.pct)}%</span>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 4, fontSize: 10, letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase', fontFamily: FONT.heading, background: color + '25', color }}>
                        {f.estadoOrden === 2 ? 'Horas extra' : f.estadoOrden === 1 ? 'Al límite' : 'OK'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, color, T }: { label: string; value: string; color?: string; T: ReturnType<typeof useTheme>['T'] }) {
  return (
    <div style={cardStyle(T)}>
      <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: FONT.heading, fontSize: 28, fontWeight: 600, color: color ?? T.pri, lineHeight: 1 }}>{value}</div>
    </div>
  )
}
