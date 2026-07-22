import { AZUL_CL, BLANCO, GRANATE, GRIS, NAR, VERDE } from '@/styles/neobrutal'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, FileDown, Share2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import {
  type Empleado, type Turno,
  lunesDeSemana, fmtRangoSemana, numeroSemanaISO,
} from './utils'
import { getSemanaPorLunes } from './datosReales'
import { getAsignacionPorLunes, aplicarPlantilla, PLANTILLAS } from './plantillas'
import { CuadranteCuadricula, expandirTurnos, isoDeFecha } from './CuadranteCuadricula'
import { exportarHorarioPDF, compartirHorarioPDF } from './exportPDF'
import { fetchTurnosDB } from './fetchTurnosDB'

type Fuente = 'bd' | 'historico' | 'plantilla' | 'vacio'

export default function TabEstaSemana() {
  const { T } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [lunes, setLunes] = useState<Date>(() => {
    const guardado = typeof localStorage !== 'undefined' ? localStorage.getItem('horarios_semana_lunes') : null
    if (guardado) {
      const d = new Date(`${guardado}T00:00:00`)
      if (!isNaN(d.getTime())) return d
    }
    return lunesDeSemana(new Date())
  })
  const [turnos, setTurnos] = useState<Turno[]>([])
  // turnos efectivos guardados (lo que se ve) → lo que se exporta
  const [turnosExport, setTurnosExport] = useState<Turno[]>([])
  const [cierres, setCierres] = useState<Partial<Record<string, string>>>({})
  const [fuente, setFuente] = useState<Fuente>('vacio')

  const cargarEmpleados = useCallback(() => {
    supabase.from('empleados').select('id,nombre,cargo,orden,estado')
      .order('orden', { ascending: true, nullsFirst: false })
      .then(({ data }) => setEmpleados((data ?? []) as Empleado[]))
  }, [])

  useEffect(() => { cargarEmpleados() }, [cargarEmpleados])

  useEffect(() => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('horarios_semana_lunes', isoDeFecha(lunes))
  }, [lunes])

  useEffect(() => {
    if (empleados.length === 0) return
    let cancelled = false
    setLoading(true)
    const iso = isoDeFecha(lunes)

    async function load() {
      // 1. Datos reales de la BD — MANDA siempre que existan (son ediciones reales del usuario)
      const turnosBD = await fetchTurnosDB(iso)
      if (cancelled) return
      if (turnosBD.length > 0) {
        setTurnos(turnosBD); setCierres({}); setFuente('bd'); setLoading(false); return
      }
      // 2. Histórico hardcodeado (semanas registradas o con override puntual) — solo si no hay nada en BD
      const sem = getSemanaPorLunes(iso)
      if (sem) {
        if (cancelled) return
        setTurnos(expandirTurnos(empleados, sem.turnos)); setCierres({}); setFuente('historico'); setLoading(false); return
      }
      // 3. Plantilla asignada a esa semana
      const asig = getAsignacionPorLunes(iso)
      if (asig && asig.plantilla) {
        const turnosPila = aplicarPlantilla(asig.plantilla, asig.swapRayAndres)
        const p = PLANTILLAS[asig.plantilla]
        setTurnos(expandirTurnos(empleados, turnosPila)); setCierres(p.cierres); setFuente('plantilla'); setLoading(false); return
      }
      setTurnos([]); setCierres({}); setFuente('vacio'); setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [lunes, empleados])

  function navBtn(): React.CSSProperties {
    return { width: 32, height: 32, borderRadius: 8, border: `0.5px solid ${T.brd}`, background: T.card, color: T.sec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  }
  function actionBtn(): React.CSSProperties {
    return { height: 32, padding: '0 14px', borderRadius: 8, border: `1px solid #B01D23`, background: GRANATE, color: BLANCO, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }
  }

  const fuenteLabel: Record<Fuente, string> = {
    bd: 'Datos reales BD', historico: 'Histórico registrado', plantilla: 'Plantilla estimada', vacio: 'Sin datos',
  }
  const fuenteColor: Record<Fuente, string> = {
    bd: VERDE, historico: AZUL_CL, plantilla: NAR, vacio: GRIS,
  }

  // Lo que se exporta: los turnos guardados si los hay; si no, la base cargada.
  const turnosParaExportar = turnosExport.length > 0 ? turnosExport : turnos

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 600, color: GRANATE, letterSpacing: '3px', textTransform: 'uppercase' }}>
            Rota S{numeroSemanaISO(lunes)} · {fmtRangoSemana(lunes)}
          </div>
          {!loading && (
            <span style={{ fontSize: 10, fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase', color: fuenteColor[fuente], background: fuenteColor[fuente] + '20', padding: '3px 8px', borderRadius: 4 }}>
              {fuenteLabel[fuente]}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() - 7); return n })} style={navBtn()}><ChevronLeft size={16} /></button>
          <button onClick={() => setLunes(lunesDeSemana(new Date()))} style={{ ...navBtn(), width: 'auto', padding: '0 10px', fontSize: 10, fontFamily: FONT.heading, letterSpacing: '1px', textTransform: 'uppercase' }}>Hoy</button>
          <button onClick={() => setLunes(l => { const n = new Date(l); n.setDate(n.getDate() + 7); return n })} style={navBtn()}><ChevronRight size={16} /></button>
          <button onClick={() => exportarHorarioPDF(empleados, turnosParaExportar, lunes, { abrir: true })} style={actionBtn()}><FileDown size={14} /> Exportar</button>
          <button onClick={() => compartirHorarioPDF(empleados, turnosParaExportar, lunes)} style={actionBtn()}><Share2 size={14} /> Compartir</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
      ) : (
        <CuadranteCuadricula empleados={empleados} turnos={turnos} lunes={lunes} cierres={cierres} mostrarCierre={false} onEmpleadosChange={cargarEmpleados} onTurnosChange={setTurnosExport} />
      )}
    </div>
  )
}
