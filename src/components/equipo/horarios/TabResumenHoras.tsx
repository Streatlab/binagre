import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import {
  type Empleado, type Turno, REGLAS_DEFAULT,
  horasSemanaPorEmpleado, fmtHoras,
} from './utils'

export default function TabResumenHoras() {
  const { T } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const reglas = REGLAS_DEFAULT

  useEffect(() => {
    supabase.from('empleados').select('id,nombre,cargo').eq('estado', 'activo').order('nombre')
      .then(({ data }) => { setEmpleados((data ?? []) as Empleado[]); setLoading(false) })
  }, [])

  // Turnos de la semana en curso se enchufan a tabla `turnos` para el cómputo real.

  const horasEmp = horasSemanaPorEmpleado(turnos)
  const totalHoras = Object.values(horasEmp).reduce((a, b) => a + b, 0)
  const conExtra = empleados.filter(e => (horasEmp[e.id] ?? 0) > reglas.horas_max_semana).length
  const promedio = empleados.length ? totalHoras / empleados.length : 0

  const th: React.CSSProperties = { padding: '10px 14px', fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: T.mut, fontWeight: 400, background: T.group, textAlign: 'left' }
  const td: React.CSSProperties = { padding: '12px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 16 }}>
        <KpiCard label="Horas totales" value={`${fmtHoras(totalHoras)} h`} T={T} />
        <KpiCard label="Promedio / empleado" value={`${fmtHoras(promedio)} h`} T={T} />
        <KpiCard label="Tope semanal" value={`${reglas.horas_max_semana} h`} T={T} />
        <KpiCard label="Con horas extra" value={`${conExtra}`} color={conExtra > 0 ? '#f5a623' : undefined} T={T} />
      </div>

      {/* Tabla por empleado con barra de progreso + semáforo */}
      <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                <th style={th}>Empleado</th>
                <th style={th}>Horas semana</th>
                <th style={{ ...th, width: '40%' }}>Uso vs tope</th>
                <th style={{ ...th, textAlign: 'right' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {empleados.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '40px 24px', textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin empleados activos.</td></tr>
              ) : empleados.map(emp => {
                const h = horasEmp[emp.id] ?? 0
                const pct = reglas.horas_max_semana ? (h / reglas.horas_max_semana) * 100 : 0
                const extra = h > reglas.horas_max_semana
                const color = extra ? '#B01D23' : pct >= 90 ? '#f5a623' : '#1D9E75'
                return (
                  <tr key={emp.id} style={{ borderBottom: `1px solid ${T.brd}` }}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {emp.nombre}
                      {emp.cargo && <div style={{ fontSize: 11, color: T.mut, fontWeight: 400 }}>{emp.cargo}</div>}
                    </td>
                    <td style={{ ...td, fontFamily: FONT.heading, fontSize: 15, fontWeight: 600 }}>{fmtHoras(h)} h</td>
                    <td style={td}>
                      <div style={{ height: 8, borderRadius: 4, background: T.brd, overflow: 'hidden' }}>
                        <div style={{ height: 8, width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: 'width .4s ease' }} />
                      </div>
                      <span style={{ fontSize: 11, color: T.mut, fontFamily: FONT.body }}>{Math.round(pct)}%</span>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 4, fontSize: 10, letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase', fontFamily: FONT.heading, background: color + '25', color }}>
                        {extra ? 'Horas extra' : pct >= 90 ? 'Al límite' : 'OK'}
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
