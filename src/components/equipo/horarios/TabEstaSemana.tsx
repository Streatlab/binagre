import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FileDown, Share2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import {
  type Empleado,
  lunesDeSemana, fmtRangoSemana, numeroSemanaISO,
} from './utils'
import { getSemanaPorLunes } from './datosReales'
import { getAsignacionPorLunes, aplicarPlantilla, PLANTILLAS } from './plantillas'
import { CuadranteCuadricula, expandirTurnos, ordenarEmpleados, isoDeFecha } from './CuadranteCuadricula'
import { exportarHorarioPDF, compartirHorarioPDF } from './exportPDF'

export default function TabEstaSemana() {
  const { T } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [lunes, setLunes] = useState<Date>(() => lunesDeSemana(new Date()))

  useEffect(() => {
    supabase.from('empleados').select('id,nombre,cargo').eq('estado', 'activo')
      .then(({ data }) => { setEmpleados(ordenarEmpleados((data ?? []) as Empleado[])); setLoading(false) })
  }, [])

  const { turnos, cierres } = useMemo(() => {
    const iso = isoDeFecha(lunes)
    const sem = getSemanaPorLunes(iso)
    if (sem) return { turnos: expandirTurnos(empleados, sem.turnos), cierres: {} }
    const asig = getAsignacionPorLunes(iso)
    if (asig && asig.plantilla) {
      const turnosPila = aplicarPlantilla(asig.plantilla, asig.swapRayAndres)
      const p = PLANTILLAS[asig.plantilla]
      return { turnos: expandirTurnos(empleados, turnosPila), cierres: p.cierres }
    }
    return { turnos: [], cierres: {} }
  }, [lunes, empleados])

  function navBtn(): React.CSSProperties {
    return { width: 32, height: 32, borderRadius: 8, border: `0.5px solid ${T.brd}`, background: T.card, color: T.sec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  }
  function actionBtn(): React.CSSProperties {
    return { height: 32, padding: '0 14px', borderRadius: 8, border: `1px solid #B01D23`, background: '#B01D23', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }
  }

  const handleExportar = () => exportarHorarioPDF(empleados, turnos, lunes, { abrir: true })
  const handleCompartir = () => compartirHorarioPDF(empleados, turnos, lunes)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 600, color: '#B01D23', letterSpacing: '3px', textTransform: 'uppercase' }}>
          Rota S{numeroSemanaISO(lunes)} · {fmtRangoSemana(lunes)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() - 7); return n })} style={navBtn()}><ChevronLeft size={16} /></button>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() + 7); return n })} style={navBtn()}><ChevronRight size={16} /></button>
          <button onClick={handleExportar} style={actionBtn()}><FileDown size={14} /> Exportar</button>
          <button onClick={handleCompartir} style={actionBtn()}><Share2 size={14} /> Compartir</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
      ) : (
        <CuadranteCuadricula empleados={empleados} turnos={turnos} lunes={lunes} cierres={cierres} />
      )}
    </div>
  )
}
