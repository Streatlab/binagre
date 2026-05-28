import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { type Empleado } from './utils'
import { PLANTILLAS, type PlantillaId } from './plantillas'
import { CuadranteCuadricula, expandirTurnos, ordenarEmpleados } from './CuadranteCuadricula'

export default function TabPlantillas() {
  const { T } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [activa, setActiva] = useState<PlantillaId>('S1')
  const [swap, setSwap] = useState(false)

  useEffect(() => {
    supabase.from('empleados').select('id,nombre,cargo').eq('estado', 'activo')
      .then(({ data }) => { setEmpleados(ordenarEmpleados((data ?? []) as Empleado[])); setLoading(false) })
  }, [])

  const plantilla = PLANTILLAS[activa]
  const turnos = useMemo(() => {
    const t = swap ? { Ray: plantilla.turnos['Andrés'] ?? {}, 'Andrés': plantilla.turnos['Ray'] ?? {}, Emilio: plantilla.turnos.Emilio ?? {}, 'Rubén': plantilla.turnos['Rubén'] ?? {} } : plantilla.turnos
    return expandirTurnos(empleados, t)
  }, [plantilla, swap, empleados])

  // Lunes ficticio para mostrar (no se enseñan fechas en plantillas)
  const lunesFake = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0,0,0,0); return d }, [])

  const ids: PlantillaId[] = ['S1', 'S2', 'S3', 'S4', 'S5']

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ids.map(id => (
            <button key={id} onClick={() => setActiva(id)}
              style={{
                padding: '6px 14px', borderRadius: 8,
                border: `1px solid ${activa === id ? '#B01D23' : T.brd}`,
                background: activa === id ? '#B01D23' : T.card,
                color: activa === id ? '#fff' : T.pri,
                fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1.5px',
                textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600,
              }}>
              {id}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT.body, fontSize: 12, color: T.sec, cursor: 'pointer' }}>
          <input type="checkbox" checked={swap} onChange={e => setSwap(e.target.checked)} />
          Intercambiar Ray ↔ Andrés
        </label>
      </div>

      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 600, color: '#B01D23', letterSpacing: '2px', textTransform: 'uppercase' }}>
          {plantilla.nombre}
        </div>
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, marginTop: 4 }}>{plantilla.descripcion}</div>
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 8 }}>
          Objetivo horas: Ray {plantilla.totales_objetivo.Ray}h · Andrés {plantilla.totales_objetivo['Andrés']}h · Emilio {plantilla.totales_objetivo.Emilio}h · Rubén {plantilla.totales_objetivo['Rubén']}h
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
      ) : (
        <CuadranteCuadricula empleados={empleados} turnos={turnos} lunes={lunesFake} cierres={plantilla.cierres} />
      )}
    </div>
  )
}
