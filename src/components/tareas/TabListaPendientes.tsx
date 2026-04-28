import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/styles/tokens'
import { supabase } from '@/lib/supabase'

interface TareaPendiente {
  id: string
  tarea_periodica_id: string
  fecha_esperada: string
  estado: 'pendiente' | 'cumplida' | 'atrasada'
  fecha_cumplida: string | null
  nombre?: string
  modulo_destino?: string
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const hoyStr = toDateStr(new Date())

function diasRetraso(fechaEsperada: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fe = new Date(fechaEsperada + 'T00:00:00')
  const diff = Math.floor((hoy.getTime() - fe.getTime()) / 86400000)
  return diff > 0 ? diff : 0
}

function urgenciaOrden(t: TareaPendiente): number {
  if (t.estado === 'atrasada') return 0
  if (t.fecha_esperada === hoyStr) return 1
  return 2
}

const ESTADO_COLORS: Record<string, string> = {
  atrasada: '#B01D23',
  pendiente: '#f5a623',
  cumplida: '#1D9E75',
}

export default function TabListaPendientes({ onRefresh }: { onRefresh?: () => void }) {
  const { T } = useTheme()
  const navigate = useNavigate()
  const [tareas, setTareas] = useState<TareaPendiente[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tareas_pendientes')
      .select('id, tarea_periodica_id, fecha_esperada, estado, fecha_cumplida, tareas_periodicas(nombre, modulo_destino)')
      .in('estado', ['pendiente', 'atrasada'])
      .order('fecha_esperada', { ascending: true })

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (data as any[]).map((r) => {
        const tp = Array.isArray(r.tareas_periodicas) ? r.tareas_periodicas[0] : r.tareas_periodicas
        return {
          id: r.id as string,
          tarea_periodica_id: r.tarea_periodica_id as string,
          fecha_esperada: r.fecha_esperada as string,
          estado: r.estado as 'pendiente' | 'cumplida' | 'atrasada',
          fecha_cumplida: r.fecha_cumplida as string | null,
          nombre: tp?.nombre ?? '',
          modulo_destino: tp?.modulo_destino ?? '',
        }
      })
      mapped.sort((a, b) => urgenciaOrden(a) - urgenciaOrden(b) || a.fecha_esperada.localeCompare(b.fecha_esperada))
      setTareas(mapped)
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function marcarSubida(id: string) {
    await supabase
      .from('tareas_pendientes')
      .update({ estado: 'cumplida', fecha_cumplida: new Date().toISOString() })
      .eq('id', id)
    onRefresh?.()
    cargar()
  }

  async function posponer(id: string, fechaActual: string) {
    const d = new Date(fechaActual + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    const nuevaFecha = toDateStr(d)
    await supabase
      .from('tareas_pendientes')
      .update({ fecha_esperada: nuevaFecha, estado: 'pendiente' })
      .eq('id', id)
    cargar()
  }

  async function eliminar(id: string) {
    await supabase.from('tareas_pendientes').delete().eq('id', id)
    onRefresh?.()
    cargar()
  }

  function irImportador(id: string, modulo: string) {
    if (modulo === 'importador') {
      navigate(`/importador?tarea_id=${id}`)
    } else {
      marcarSubida(id)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (tareas.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#777', fontFamily: 'Lexend, sans-serif', fontSize: 14 }}>
      Sin tareas pendientes ni atrasadas.
    </div>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#0a0a0a' }}>
            {['Tarea', 'Fecha esperada', 'Estado', 'Días retraso', 'Acción'].map(h => (
              <th
                key={h}
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#cccccc',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: `1px solid #2a2a2a`,
                  whiteSpace: 'nowrap',
                }}
              >{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tareas.map((t, idx) => {
            const retraso = diasRetraso(t.fecha_esperada)
            return (
              <tr
                key={t.id}
                style={{ background: idx % 2 === 0 ? '#111111' : '#141414', borderBottom: `1px solid #2a2a2a` }}
              >
                <td style={{ padding: '10px 12px', color: '#ffffff' }}>{t.nombre}</td>
                <td style={{ padding: '10px 12px', color: '#cccccc', whiteSpace: 'nowrap' }}>{t.fecha_esperada}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: 4,
                    background: (ESTADO_COLORS[t.estado] ?? '#888') + '22',
                    color: ESTADO_COLORS[t.estado] ?? '#888',
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>{t.estado}</span>
                </td>
                <td style={{ padding: '10px 12px', color: retraso > 0 ? '#B01D23' : '#777', fontWeight: retraso > 0 ? 600 : 400 }}>
                  {retraso > 0 ? `+${retraso}d` : '—'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => irImportador(t.id, t.modulo_destino ?? '')}
                      style={{
                        background: '#B01D23',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '5px 10px',
                        fontSize: 11,
                        fontFamily: 'Oswald, sans-serif',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >Marcar subida</button>
                    <button
                      onClick={() => posponer(t.id, t.fecha_esperada)}
                      style={{
                        background: '#222222',
                        color: '#cccccc',
                        border: `1px solid #383838`,
                        borderRadius: 6,
                        padding: '5px 10px',
                        fontSize: 11,
                        fontFamily: 'Oswald, sans-serif',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >+1 día</button>
                    <button
                      onClick={() => eliminar(t.id)}
                      style={{
                        background: 'none',
                        color: '#777',
                        border: `1px solid #383838`,
                        borderRadius: 6,
                        padding: '5px 10px',
                        fontSize: 11,
                        fontFamily: 'Oswald, sans-serif',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >Eliminar</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
