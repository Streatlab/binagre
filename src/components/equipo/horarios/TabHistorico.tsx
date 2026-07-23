import { BLANCO, GRANATE } from '@/styles/neobrutal'
import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, FileDown, Share2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { type Empleado, type Turno, fmtRangoSemana, numeroSemanaISO, lunesDeSemana } from './utils'
import { getSemanaPorLunes } from './datosReales'
import { CuadranteCuadricula, expandirTurnos, ordenarEmpleados, isoDeFecha } from './CuadranteCuadricula'
import { exportarHorarioPDF, compartirHorarioPDF } from './exportPDF'
import { fetchTurnosDB } from './fetchTurnosDB'

export default function TabHistorico() {
  const { T } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [empLoading, setEmpLoading] = useState(true)
  // Empieza en la semana anterior a la actual
  const [lunes, setLunes] = useState<Date>(() => {
    const l = lunesDeSemana(new Date())
    l.setDate(l.getDate() - 7)
    return l
  })
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [turnosLoading, setTurnosLoading] = useState(false)

  useEffect(() => {
    supabase.from('empleados').select('id,nombre,cargo')
      .then(({ data }) => { setEmpleados(ordenarEmpleados((data ?? []) as Empleado[])); setEmpLoading(false) })
  }, [])

  const cargarTurnos = useCallback(async (lunesDate: Date, emps: Empleado[]) => {
    if (emps.length === 0) return
    setTurnosLoading(true)
    const iso = isoDeFecha(lunesDate)
    // 1. Datos reales de la BD
    const turnosBD = await fetchTurnosDB(iso)
    if (turnosBD.length > 0) {
      setTurnos(turnosBD); setTurnosLoading(false); return
    }
    // 2. Fallback: histórico hardcodeado
    const semData = getSemanaPorLunes(iso)
    if (semData) {
      setTurnos(expandirTurnos(emps, semData.turnos)); setTurnosLoading(false); return
    }
    setTurnos([]); setTurnosLoading(false)
  }, [])

  useEffect(() => {
    if (!empLoading) cargarTurnos(lunes, empleados)
  }, [lunes, empleados, empLoading, cargarTurnos])

  function navBtn(disabled?: boolean): React.CSSProperties {
    return { width: 32, height: 32, borderRadius: 0, border: `0.5px solid ${T.brd}`, background: disabled ? T.group : T.card, color: disabled ? T.mut : T.sec, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }
  }
  function actionBtn(): React.CSSProperties {
    return { height: 32, padding: '0 14px', borderRadius: 0, border: `1px solid ${GRANATE}`, background: GRANATE, color: BLANCO, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }
  }

  // Límite: no navegar a semanas futuras desde el histórico (para eso está TabEstaSemana)
  const esLunesActual = isoDeFecha(lunes) === isoDeFecha(lunesDeSemana(new Date()))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 600, color: GRANATE, letterSpacing: '3px', textTransform: 'uppercase' }}>
          Rota S{numeroSemanaISO(lunes)} · {fmtRangoSemana(lunes)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() - 7); return n })} style={navBtn()}><ChevronLeft size={16} /></button>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() + 7); return n })} disabled={esLunesActual} style={navBtn(esLunesActual)}><ChevronRight size={16} /></button>
          <button onClick={() => exportarHorarioPDF(empleados, turnos, lunes, { abrir: true })} style={actionBtn()}><FileDown size={14} /> Exportar</button>
          <button onClick={() => compartirHorarioPDF(empleados, turnos, lunes)} style={actionBtn()}><Share2 size={14} /> Compartir</button>
        </div>
      </div>

      {(empLoading || turnosLoading) ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
      ) : (
        <CuadranteCuadricula empleados={empleados} turnos={turnos} lunes={lunes} />
      )}
    </div>
  )
}
