import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import { COLORS } from '@/components/panel/resumen/tokens'
import {
  DIAS, type DiaKey, type Empleado, type Turno,
  horasTurno, horasSemanaPorEmpleado, lunesDeSemana, fmtRangoSemana, fmtHoras,
} from './utils'

export default function TabHistorico() {
  const { T, isDark } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  // Histórico arranca en la semana anterior a la actual
  const [lunes, setLunes] = useState<Date>(() => { const l = lunesDeSemana(new Date()); l.setDate(l.getDate() - 7); return l })

  useEffect(() => {
    supabase.from('empleados').select('id,nombre,cargo').order('nombre')
      .then(({ data }) => { setEmpleados((data ?? []) as Empleado[]); setLoading(false) })
  }, [])

  // Turnos históricos se cargan aquí por rango de semana (tabla `turnos`) cuando se enchufe.

  const horasEmp = horasSemanaPorEmpleado(turnos)
  const totalHoras = turnos.reduce((s, t) => s + horasTurno(t.entrada, t.salida), 0)

  const th: React.CSSProperties = { padding: '10px 12px', fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: T.mut, fontWeight: 400, background: T.group, textAlign: 'center', whiteSpace: 'nowrap' }
  const thL: React.CSSProperties = { ...th, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2 }
  const td: React.CSSProperties = { padding: '10px 12px', fontFamily: FONT.body, fontSize: 13, color: T.pri, textAlign: 'center', borderBottom: `1px solid ${T.brd}` }

  function celdaTurno(empId: string, dia: DiaKey) {
    const t = turnos.find(x => x.empleado_id === empId && x.dia === dia)
    if (!t) return <span style={{ color: T.mut, fontSize: 12 }}>—</span>
    return (
      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, background: COLORS.mut + '18', color: T.sec, fontSize: 12, fontFamily: FONT.body, fontWeight: 500 }}>
        {t.entrada}–{t.salida}
      </span>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() - 7); return n })} style={navBtn(T)}><ChevronLeft size={16} /></button>
          <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.sec, minWidth: 200, textAlign: 'center' }}>
            {fmtRangoSemana(lunes)}
          </span>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() + 7); return n })} style={navBtn(T)}><ChevronRight size={16} /></button>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <KpiInline label="Horas totales" value={`${fmtHoras(totalHoras)} h`} T={T} />
        </div>
      </div>

      <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                  <th style={thL}>Empleado</th>
                  {DIAS.map(d => <th key={d} style={th}>{d}</th>)}
                  <th style={{ ...th, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {empleados.length === 0 ? (
                  <tr><td colSpan={DIAS.length + 2} style={{ ...td, padding: '40px 24px', color: T.mut }}>Sin datos para esta semana.</td></tr>
                ) : empleados.map(emp => (
                  <tr key={emp.id}>
                    <td style={{ padding: '10px 12px', fontFamily: FONT.body, fontSize: 13, color: T.pri, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${T.brd}`, position: 'sticky', left: 0, background: isDark ? T.card : '#fff', zIndex: 1 }}>
                      {emp.nombre}
                    </td>
                    {DIAS.map(d => <td key={d} style={td}>{celdaTurno(emp.id, d)}</td>)}
                    <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, fontWeight: 600 }}>{fmtHoras(horasEmp[emp.id] ?? 0)} h</td>
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
