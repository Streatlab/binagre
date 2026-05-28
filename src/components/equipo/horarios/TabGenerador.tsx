import { useEffect, useMemo, useState } from 'react'
import { Wand2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, cardStyle } from '@/styles/tokens'
import {
  DIAS, type DiaKey, type Empleado, type Turno, REGLAS_DEFAULT, type ReglasHorario,
  horasReales, esPartido, tramosTexto,
  horasSemanaPorEmpleado, lunesDeSemana, fmtRangoSemana, fmtHoras, colorEmpleado,
} from './utils'

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

export default function TabGenerador() {
  const { T } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [propuesta, setPropuesta] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [reglas] = useState<ReglasHorario>(REGLAS_DEFAULT)
  const lunes = lunesDeSemana(new Date())

  useEffect(() => {
    supabase.from('empleados').select('id,nombre,cargo').eq('estado', 'activo')
      .then(({ data }) => { setEmpleados(ordenarEmpleados((data ?? []) as Empleado[])); setLoading(false) })
  }, [])

  // Motor real de generación (respetando reglas + vacaciones + cobertura) se enchufa
  // cuando se entreguen datos/criterios. De momento botón funcional y vista de propuesta lista.
  function generar() {
    setGenerando(true)
    setTimeout(() => { setPropuesta([]); setGenerando(false) }, 400)
  }

  const horasEmp = horasSemanaPorEmpleado(propuesta)
  const avisos = empleados.filter(e => (horasEmp[e.id] ?? 0) > reglas.horas_max_semana)
  const idxEmp = useMemo(() => {
    const m: Record<string, number> = {}
    empleados.forEach((e, i) => { m[e.id] = i })
    return m
  }, [empleados])

  const th: React.CSSProperties = { padding: '10px 12px', fontFamily: FONT.heading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: T.mut, fontWeight: 400, background: T.group, textAlign: 'center', whiteSpace: 'nowrap' }
  const thL: React.CSSProperties = { ...th, textAlign: 'left' }
  const td: React.CSSProperties = { padding: '5px 4px', fontFamily: FONT.body, fontSize: 13, color: T.pri, textAlign: 'center', borderBottom: `1px solid ${T.brd}`, verticalAlign: 'middle' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.sec }}>
          Semana destino: {fmtRangoSemana(lunes)}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={generar} disabled={generando || loading}
            style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#FF4757', color: '#fff', fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: generando ? 'not-allowed' : 'pointer', opacity: generando ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wand2 size={15} />{generando ? 'Generando…' : 'Generar horario'}
          </button>
          {propuesta.length > 0 && (
            <button style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#e8f442', color: '#111', fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}>
              Aplicar a Esta semana
            </button>
          )}
        </div>
      </div>

      {/* Avisos reglas */}
      {avisos.length > 0 && (
        <div style={{ ...cardStyle(T), borderColor: '#f5a623', background: '#f5a62312', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} color="#f5a623" />
          <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec }}>
            {avisos.length} empleado{avisos.length !== 1 ? 's' : ''} supera{avisos.length === 1 ? '' : 'n'} {reglas.horas_max_semana}h/semana.
          </span>
        </div>
      )}

      {/* Propuesta */}
      <div style={{ ...cardStyle(T), padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                  <th style={thL}>Empleado</th>
                  {DIAS.map(d => <th key={d} style={th}>{d}</th>)}
                  <th style={{ ...th, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {empleados.length === 0 ? (
                  <tr><td colSpan={DIAS.length + 2} style={{ ...td, padding: '40px 24px', color: T.mut }}>Sin empleados activos.</td></tr>
                ) : empleados.map(emp => {
                  const total = horasEmp[emp.id] ?? 0
                  const excede = total > reglas.horas_max_semana
                  const col = colorEmpleado(idxEmp[emp.id] ?? 0)
                  return (
                    <tr key={emp.id}>
                      <td style={{ padding: '10px 12px', fontFamily: FONT.body, fontSize: 13, color: T.pri, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${T.brd}` }}>
                        {nombrePila(emp.nombre)}
                        {emp.cargo && <div style={{ fontSize: 10, color: T.mut, fontWeight: 400 }}>{emp.cargo}</div>}
                      </td>
                      {DIAS.map(d => {
                        const t = propuesta.find(x => x.empleado_id === emp.id && x.dia === (d as DiaKey))
                        return <td key={d} style={td}>{t
                          ? <span style={{ display: 'inline-block', padding: '4px 6px', borderRadius: 5, background: col.bg, color: col.text, fontSize: 10, fontWeight: 500, lineHeight: 1.25 }}>
                              <span style={{ whiteSpace: 'pre-line' }}>{tramosTexto(t)}</span>
                              <span style={{ display: 'block', fontSize: 8.5, opacity: 0.7 }}>{esPartido(t) ? 'partido' : 'corrido'} · {fmtHoras(horasReales(t))}</span>
                            </span>
                          : <span style={{ color: T.mut, fontSize: 11, fontStyle: 'italic' }}>Libre</span>}</td>
                      })}
                      <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, fontWeight: 600, fontSize: 14, color: excede ? '#f5a623' : T.pri }}>{fmtHoras(total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {propuesta.length === 0 && empleados.length > 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
                Pulsa «Generar horario» para crear una propuesta según las reglas.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
