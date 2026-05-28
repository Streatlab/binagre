import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import {
  type Empleado,
  lunesDeSemana, fmtRangoSemana, numeroSemanaISO,
} from './utils'
import { getSemanaPorLunes } from './datosReales'
import { getAsignacionPorLunes, aplicarPlantilla, PLANTILLAS } from './plantillas'
import { CuadranteCuadricula, expandirTurnos, ordenarEmpleados, isoDeFecha } from './CuadranteCuadricula'

export default function TabEstaSemana() {
  const { T } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [lunes, setLunes] = useState<Date>(() => lunesDeSemana(new Date()))

  useEffect(() => {
    supabase.from('empleados').select('id,nombre,cargo').eq('estado', 'activo')
      .then(({ data }) => { setEmpleados(ordenarEmpleados((data ?? []) as Empleado[])); setLoading(false) })
  }, [])

  // Datos: 1) real (Excel S22), 2) plantilla del planning, 3) vacío
  const { turnos, cierres, fuente } = useMemo(() => {
    const iso = isoDeFecha(lunes)
    const sem = getSemanaPorLunes(iso)
    if (sem) {
      return {
        turnos: expandirTurnos(empleados, sem.turnos),
        cierres: {},
        fuente: 'Datos reales (Excel)',
      }
    }
    const asig = getAsignacionPorLunes(iso)
    if (asig && asig.plantilla) {
      const turnosPila = aplicarPlantilla(asig.plantilla, asig.swapRayAndres)
      const p = PLANTILLAS[asig.plantilla]
      return {
        turnos: expandirTurnos(empleados, turnosPila),
        cierres: p.cierres,
        fuente: `Plantilla ${asig.plantilla}${asig.swapRayAndres ? ' (Ray↔Andrés)' : ''}${asig.finde_largo ? ' · Finde largo: ' + asig.finde_largo : ''}${asig.finde_medio ? ' · Finde medio: ' + asig.finde_medio : ''}`,
      }
    }
    return { turnos: [], cierres: {}, fuente: 'Sin asignación' }
  }, [lunes, empleados])

  function navBtn(): React.CSSProperties {
    return { width: 32, height: 32, borderRadius: 8, border: `0.5px solid ${T.brd}`, background: T.card, color: T.sec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 600, color: '#B01D23', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Rota S{numeroSemanaISO(lunes)} · {fmtRangoSemana(lunes)}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 2 }}>{fuente}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() - 7); return n })} style={navBtn()}><ChevronLeft size={16} /></button>
          <button onClick={() => setLunes(lunesDeSemana(new Date()))} style={{ ...navBtn(), width: 'auto', padding: '0 12px', fontSize: 11, fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase' }}>Hoy</button>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() + 7); return n })} style={navBtn()}><ChevronRight size={16} /></button>
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
