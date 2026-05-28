import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { type Empleado, lunesDeSemana, fmtRangoSemana, numeroSemanaISO } from './utils'
import { PLANTILLAS, type PlantillaId, aplicarPlantilla, PLANNING_2026 } from './plantillas'
import { CuadranteCuadricula, expandirTurnos, ordenarEmpleados, isoDeFecha } from './CuadranteCuadricula'

// Reglas resumidas para validar visualmente
const TOPE_HORAS_COCINERO = 42.5
const TOPE_HORAS_EMILIO = 30

interface PropuestaSemana {
  lunes: string
  plantillaId: PlantillaId
  swap: boolean
  nota?: string
}

export default function TabGenerador() {
  const { T } = useTheme()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [paso, setPaso] = useState<'config' | 'preview'>('config')
  const [numSemanas, setNumSemanas] = useState(4)
  const [findeLargo, setFindeLargo] = useState<'auto' | 'Ray' | 'Andrés' | 'Rubén+Emilio'>('auto')
  const [propuestas, setPropuestas] = useState<PropuestaSemana[]>([])
  const [aprobadas, setAprobadas] = useState<Record<number, boolean>>({})

  useEffect(() => {
    supabase.from('empleados').select('id,nombre,cargo').eq('estado', 'activo')
      .then(({ data }) => { setEmpleados(ordenarEmpleados((data ?? []) as Empleado[])); setLoading(false) })
  }, [])

  function generarPropuestas() {
    // Punto de partida: primera semana sin asignar en PLANNING_2026, o la siguiente al planning
    const ultLunes = PLANNING_2026[PLANNING_2026.length - 1].lunes
    const inicio = new Date(`${ultLunes}T00:00:00`)
    inicio.setDate(inicio.getDate() + 7)

    const sec: PlantillaId[] = ['S1', 'S2', 'S3', 'S4', 'S5']
    const props: PropuestaSemana[] = []
    for (let i = 0; i < numSemanas; i++) {
      const l = new Date(inicio); l.setDate(l.getDate() + 7 * i)
      // Rotación simple base como muestra el planning existente:
      // patrón observado: S1 → S2 → S3 → S2(+L+M Ray) → S4 → S4 → S3(swap) → S2(swap)
      // por simplicidad arrancamos cíclico S1..S5 hasta tener mejor lógica
      const plantillaId = sec[i % sec.length]
      const swap = false
      props.push({ lunes: isoDeFecha(l), plantillaId, swap, nota: `Plantilla ${plantillaId} (rotación inicial)` })
    }
    setPropuestas(props)
    setAprobadas({})
    setPaso('preview')
  }

  function alternarPlantilla(idx: number) {
    const sec: PlantillaId[] = ['S1', 'S2', 'S3', 'S4', 'S5']
    setPropuestas(prev => prev.map((p, i) => {
      if (i !== idx) return p
      const cur = sec.indexOf(p.plantillaId)
      const next = sec[(cur + 1) % sec.length]
      return { ...p, plantillaId: next, nota: `Plantilla ${next} (cambiada manual)` }
    }))
  }

  function alternarSwap(idx: number) {
    setPropuestas(prev => prev.map((p, i) => i === idx ? { ...p, swap: !p.swap } : p))
  }

  function aprobar(idx: number) {
    setAprobadas(prev => ({ ...prev, [idx]: true }))
  }

  function rechazar(idx: number) {
    setPropuestas(prev => prev.filter((_, i) => i !== idx))
    setAprobadas(prev => {
      const r: Record<number, boolean> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k)
        if (ki < idx) r[ki] = v
        else if (ki > idx) r[ki - 1] = v
      })
      return r
    })
  }

  const btnBase = (active = false): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 8,
    border: `1px solid ${active ? '#B01D23' : T.brd}`,
    background: active ? '#B01D23' : T.card,
    color: active ? '#fff' : T.pri,
    fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px',
    textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600,
  })

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Cargando…</div>

  if (paso === 'config') {
    return (
      <div>
        <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, padding: 24, maxWidth: 600 }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 600, color: '#B01D23', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 16 }}>
            Generar nuevas semanas
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, marginBottom: 20 }}>
            El generador parte del último planning conocido y propone semanas siguientes basadas en las plantillas S1-S5 y las reglas. Tú apruebas o cambias cada semana antes de guardar.
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', color: T.mut, textTransform: 'uppercase', marginBottom: 8 }}>¿Cuántas semanas quieres generar?</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 4, 6, 8].map(n => (
                <button key={n} onClick={() => setNumSemanas(n)} style={btnBase(numSemanas === n)}>{n} sem</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', color: T.mut, textTransform: 'uppercase', marginBottom: 8 }}>¿A quién le toca el próximo finde largo?</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['auto', 'Ray', 'Andrés', 'Rubén+Emilio'] as const).map(p => (
                <button key={p} onClick={() => setFindeLargo(p)} style={btnBase(findeLargo === p)}>{p}</button>
              ))}
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 6 }}>Auto = calcular según rotación Ray → Rubén+Emilio → Andrés (mín 6 sem)</div>
          </div>

          <button onClick={generarPropuestas} style={{ ...btnBase(true), padding: '10px 24px', fontSize: 13 }}>
            Generar propuestas
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 600, color: '#B01D23', letterSpacing: '2px', textTransform: 'uppercase' }}>
          Propuestas · {propuestas.length} semanas
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPaso('config')} style={btnBase()}>Volver</button>
          <button disabled={Object.keys(aprobadas).length === 0} style={{ ...btnBase(Object.keys(aprobadas).length > 0), opacity: Object.keys(aprobadas).length > 0 ? 1 : 0.4 }}>
            Guardar aprobadas ({Object.keys(aprobadas).length})
          </button>
        </div>
      </div>

      {propuestas.map((prop, idx) => {
        const lunes = new Date(`${prop.lunes}T00:00:00`)
        const turnosPila = aplicarPlantilla(prop.plantillaId, prop.swap)
        const turnos = expandirTurnos(empleados, turnosPila)
        const p = PLANTILLAS[prop.plantillaId]
        const aprobada = aprobadas[idx] === true

        // validación rápida
        const horasPorEmp: Record<string, number> = {}
        for (const t of turnos) {
          const e = empleados.find(x => x.id === t.empleado_id)
          if (!e) continue
          const pila = e.nombre.split(/\s+/)[0]
          let mins = 0
          for (const tr of t.tramos) {
            const [eh, em] = tr.entrada.split(':').map(Number)
            const [sh, sm] = tr.salida.split(':').map(Number)
            let m = (sh * 60 + sm) - (eh * 60 + em); if (m < 0) m += 24 * 60
            mins += m
          }
          mins -= (t.descuento_min ?? 0)
          horasPorEmp[pila] = (horasPorEmp[pila] ?? 0) + mins / 60
        }
        const avisos: string[] = []
        for (const pila of ['Ray', 'Andrés']) {
          if ((horasPorEmp[pila] ?? 0) > TOPE_HORAS_COCINERO) avisos.push(`${pila} > ${TOPE_HORAS_COCINERO}h`)
        }
        if ((horasPorEmp.Emilio ?? 0) > TOPE_HORAS_EMILIO) avisos.push(`Emilio > ${TOPE_HORAS_EMILIO}h`)

        return (
          <div key={idx} style={{
            marginBottom: 24, padding: 14, borderRadius: 12,
            border: `2px solid ${aprobada ? '#1D9E75' : T.brd}`,
            background: aprobada ? '#1D9E7510' : 'transparent',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, fontWeight: 600, color: '#B01D23', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  S{numeroSemanaISO(lunes)} · {fmtRangoSemana(lunes)}
                </div>
                <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginTop: 2 }}>
                  {prop.nota}{prop.swap ? ' · swap Ray↔Andrés' : ''}
                </div>
                {avisos.length > 0 && (
                  <div style={{ fontFamily: FONT.body, fontSize: 11, color: '#E24B4A', marginTop: 4, fontWeight: 500 }}>
                    ⚠ {avisos.join(' · ')}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => alternarPlantilla(idx)} style={btnBase()}>↻ {prop.plantillaId}</button>
                <button onClick={() => alternarSwap(idx)} style={btnBase(prop.swap)}>Swap R↔A</button>
                <button onClick={() => aprobar(idx)} disabled={aprobada} style={{ ...btnBase(aprobada), background: aprobada ? '#1D9E75' : T.card, color: aprobada ? '#fff' : T.pri, borderColor: aprobada ? '#1D9E75' : T.brd }}>
                  {aprobada ? '✓ Aprobada' : 'Aprobar'}
                </button>
                <button onClick={() => rechazar(idx)} style={btnBase()}>✕ Rechazar</button>
              </div>
            </div>

            <CuadranteCuadricula empleados={empleados} turnos={turnos} lunes={lunes} cierres={p.cierres} mostrarLeyenda={false} />
          </div>
        )
      })}

      {propuestas.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>
          No hay propuestas. Vuelve a configurar.
        </div>
      )}
    </div>
  )
}
