import { useEffect, useState } from 'react'
import { useTheme } from '@/styles/tokens'
import { supabase } from '@/lib/supabase'

interface TareaDia {
  id: string
  tarea_periodica_id: string
  fecha_esperada: string
  estado: 'pendiente' | 'cumplida' | 'atrasada'
  nombre?: string
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr(): string {
  return toDateStr(new Date())
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

export default function TabCalendario() {
  const { T } = useTheme()
  const hoy = todayStr()

  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [mes, setMes] = useState(() => new Date().getMonth())
  const [tareas, setTareas] = useState<TareaDia[]>([])
  const [modalDia, setModalDia] = useState<string | null>(null)

  useEffect(() => {
    const primerDia = new Date(anio, mes, 1)
    const ultimoDia = new Date(anio, mes + 1, 0)
    const desde = toDateStr(primerDia)
    const hasta = toDateStr(ultimoDia)

    supabase
      .from('tareas_pendientes')
      .select('id, tarea_periodica_id, fecha_esperada, estado, tareas_periodicas(nombre)')
      .gte('fecha_esperada', desde)
      .lte('fecha_esperada', hasta)
      .then(({ data }) => {
        if (!data) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setTareas((data as any[]).map((r) => ({
          id: r.id as string,
          tarea_periodica_id: r.tarea_periodica_id as string,
          fecha_esperada: r.fecha_esperada as string,
          estado: r.estado as 'pendiente' | 'cumplida' | 'atrasada',
          nombre: (Array.isArray(r.tareas_periodicas) ? r.tareas_periodicas[0]?.nombre : r.tareas_periodicas?.nombre) ?? '',
        })))
      })
  }, [anio, mes])

  // Generar celdas del calendario
  const primerDiaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7 // 0=lun
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ]
  // Rellenar hasta múltiplo de 7
  while (celdas.length % 7 !== 0) celdas.push(null)

  function tareasDeDia(dia: number): TareaDia[] {
    const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    return tareas.filter(t => t.fecha_esperada === fechaStr)
  }

  function prevMes() {
    if (mes === 0) { setMes(11); setAnio(a => a - 1) }
    else setMes(m => m - 1)
  }
  function nextMes() {
    if (mes === 11) { setMes(0); setAnio(a => a + 1) }
    else setMes(m => m + 1)
  }

  const tareasModalDia = modalDia
    ? tareas.filter(t => t.fecha_esperada === modalDia)
    : []

  const estadoColor: Record<string, string> = {
    cumplida: '#1D9E75',
    pendiente: '#f5a623',
    atrasada: '#B01D23',
  }

  return (
    <div>
      {/* Navegación mes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <button
          onClick={prevMes}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.sec, fontSize: 20, padding: '0 4px' }}
        >‹</button>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: T.pri, fontWeight: 600, minWidth: 160, textAlign: 'center' }}>
          {MESES[mes]} {anio}
        </span>
        <button
          onClick={nextMes}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.sec, fontSize: 20, padding: '0 4px' }}
        >›</button>
      </div>

      {/* Cabecera días semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {DIAS_SEMANA.map(d => (
          <div
            key={d}
            style={{ textAlign: 'center', fontFamily: 'Oswald, sans-serif', fontSize: 11, color: T.mut, padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >{d}</div>
        ))}
      </div>

      {/* Celdas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {celdas.map((dia, idx) => {
          if (dia === null) {
            return <div key={`empty-${idx}`} style={{ minHeight: 64, borderRadius: 6 }} />
          }
          const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
          const esHoy = fechaStr === hoy
          const tareasDelDia = tareasDeDia(dia)
          const hasTareas = tareasDelDia.length > 0

          return (
            <div
              key={`dia-${dia}`}
              onClick={() => hasTareas && setModalDia(fechaStr)}
              style={{
                minHeight: 64,
                borderRadius: 6,
                border: `1px solid ${esHoy ? '#e8f442' : T.brd}`,
                background: esHoy ? 'rgba(232,244,66,0.06)' : T.card,
                padding: '6px 8px',
                cursor: hasTareas ? 'pointer' : 'default',
                transition: 'background 150ms',
              }}
            >
              <div style={{
                fontFamily: 'Lexend, sans-serif',
                fontSize: 12,
                color: esHoy ? '#e8f442' : T.pri,
                fontWeight: esHoy ? 700 : 400,
                marginBottom: 4,
              }}>{dia}</div>

              {/* Puntos de estado */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {tareasDelDia.map(t => (
                  <div
                    key={t.id}
                    title={t.nombre ?? ''}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: estadoColor[t.estado] ?? '#888',
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal día */}
      {modalDia && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setModalDia(null)}
        >
          <div
            style={{ backgroundColor: '#1a1a1a', border: `1px solid #383838`, borderRadius: 12, padding: 24, minWidth: 320, maxWidth: 480 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: '#B01D23', fontWeight: 600 }}>
                Tareas del {modalDia}
              </span>
              <button onClick={() => setModalDia(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#777', fontSize: 18 }}>×</button>
            </div>
            {tareasModalDia.length === 0 ? (
              <p style={{ color: '#777', fontSize: 13 }}>No hay tareas este día.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tareasModalDia.map(t => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: '#141414',
                      border: `1px solid #2a2a2a`,
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: estadoColor[t.estado] ?? '#888', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#ffffff' }}>{t.nombre}</span>
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: estadoColor[t.estado] + '22',
                      color: estadoColor[t.estado],
                      fontFamily: 'Oswald, sans-serif',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}>{t.estado}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
