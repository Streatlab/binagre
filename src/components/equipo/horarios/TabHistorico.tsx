import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { type Empleado, fmtRangoSemana, numeroSemanaISO } from './utils'
import { SEMANAS_REALES, getSemanaPorLunes } from './datosReales'
import { CuadranteCuadricula, expandirTurnos, ordenarEmpleados } from './CuadranteCuadricula'

export default function TabHistorico() {
  const { T } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)

  // Histórico = todas las semanas reales menos la última (esa es "en curso")
  const semanasHistoricas = useMemo(() => SEMANAS_REALES.slice(0, -1).slice().reverse(), [])
  const [idx, setIdx] = useState(0)
  const sem = semanasHistoricas[idx]
  const lunes = useMemo(() => new Date(`${sem.lunes}T00:00:00`), [sem.lunes])

  useEffect(() => {
    supabase.from('empleados').select('id,nombre,cargo')
      .then(({ data }) => { setEmpleados(ordenarEmpleados((data ?? []) as Empleado[])); setLoading(false) })
  }, [])

  const turnos = useMemo(() => {
    const semData = getSemanaPorLunes(sem.lunes)
    if (!semData) return []
    return expandirTurnos(empleados, semData.turnos)
  }, [sem.lunes, empleados])

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
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 2 }}>Datos reales (Excel)</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setIdx(i => Math.min(semanasHistoricas.length - 1, i + 1))} disabled={idx >= semanasHistoricas.length - 1} style={navBtn()}><ChevronLeft size={16} /></button>
          <span style={{ fontFamily: FONT.heading, fontSize: 11, color: T.mut, padding: '0 8px', minWidth: 80, textAlign: 'center' }}>{idx + 1} / {semanasHistoricas.length}</span>
          <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx <= 0} style={navBtn()}><ChevronRight size={16} /></button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
      ) : (
        <CuadranteCuadricula empleados={empleados} turnos={turnos} lunes={lunes} />
      )}
    </div>
  )
}
