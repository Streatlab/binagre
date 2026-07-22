import { BLANCO, GRANATE } from '@/styles/neobrutal'
import { useEffect, useMemo, useState } from 'react'
import { FileDown, Share2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { type Empleado, lunesDeSemana } from './utils'
import { PLANTILLAS, type PlantillaId } from './plantillas'
import { CuadranteCuadricula, expandirTurnos, ordenarEmpleados } from './CuadranteCuadricula'
import { exportarHorarioPDF, compartirHorarioPDF } from './exportPDF'

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

  const lunesFake = useMemo(() => lunesDeSemana(new Date()), [])
  const ids: PlantillaId[] = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']

  function actionBtn(): React.CSSProperties {
    return { height: 32, padding: '0 14px', borderRadius: 8, border: `1px solid #B01D23`, background: GRANATE, color: BLANCO, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ids.map(id => (
            <button key={id} onClick={() => setActiva(id)}
              style={{
                padding: '6px 14px', borderRadius: 8,
                border: `1px solid ${activa === id ? GRANATE : T.brd}`,
                background: activa === id ? GRANATE : T.card,
                color: activa === id ? BLANCO : T.pri,
                fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1.5px',
                textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600,
              }}>
              {id}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT.body, fontSize: 12, color: T.sec, cursor: 'pointer' }}>
            <input type="checkbox" checked={swap} onChange={e => setSwap(e.target.checked)} />
            Intercambiar Ray ↔ Andrés
          </label>
          <button onClick={() => exportarHorarioPDF(empleados, turnos, lunesFake, { abrir: true, titulo: plantilla.nombre })} style={actionBtn()}><FileDown size={14} /> Exportar</button>
          <button onClick={() => compartirHorarioPDF(empleados, turnos, lunesFake, { titulo: plantilla.nombre })} style={actionBtn()}><Share2 size={14} /> Compartir</button>
        </div>
      </div>

      <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 600, color: GRANATE, letterSpacing: '2px', textTransform: 'uppercase' }}>
          {plantilla.nombre}
        </div>
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, marginTop: 4 }}>{plantilla.descripcion}</div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
      ) : (
        <CuadranteCuadricula empleados={empleados} turnos={turnos} lunes={lunesFake} cierres={plantilla.cierres} />
      )}
    </div>
  )
}
