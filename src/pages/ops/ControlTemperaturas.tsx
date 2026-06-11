import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'

interface Equipo {
  id: string
  nombre: string
  estado: string
  rango_temp_min: number | null
  rango_temp_max: number | null
}

interface Registro {
  id: string
  equipo_id: string
  fecha_hora: string
  temperatura: number
  usuario: string | null
  nota: string | null
}

function localDateStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function fmtFechaHora(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function semaforoColor(temp: number, min: number | null, max: number | null): string {
  if (min === null && max === null) return '#777777'
  if (min !== null && temp < min) return '#B01D23'
  if (max !== null && temp > max) return '#B01D23'
  return '#22c55e'
}

export default function ControlTemperaturas() {
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form
  const [equipoId, setEquipoId] = useState('')
  const [temperatura, setTemperatura] = useState('')
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const [{ data: eqData, error: eqErr }, { data: regData, error: regErr }] = await Promise.all([
        supabase.from('equipos').select('id,nombre,estado,rango_temp_min,rango_temp_max').order('nombre'),
        supabase.from('registros_temperatura').select('*').order('fecha_hora', { ascending: false }).limit(100),
      ])
      if (eqErr) throw eqErr
      if (regErr) throw regErr
      setEquipos((eqData ?? []) as Equipo[])
      setRegistros((regData ?? []) as Registro[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function guardar() {
    if (!equipoId || !temperatura) return
    setSaving(true)
    const { error: err } = await supabase.from('registros_temperatura').insert({
      equipo_id: equipoId,
      temperatura: parseFloat(temperatura),
      nota: nota || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setTemperatura('')
    setNota('')
    cargar()
  }

  const hoy = localDateStr()
  const equiposSinRegistroHoy = equipos.filter(eq =>
    !registros.some(r => r.equipo_id === eq.id && r.fecha_hora.startsWith(hoy))
  )

  const equipoMap = Object.fromEntries(equipos.map(e => [e.id, e]))

  return (
    <div style={{ backgroundColor: '#111111', minHeight: '100vh', padding: '1.5rem', fontFamily: FONT.body }}>
      <h1 style={{ fontFamily: FONT.heading, textTransform: 'uppercase', letterSpacing: 3, color: '#ffffff', fontSize: 22, marginBottom: 24 }}>
        Control Temperaturas
      </h1>

      {error && (
        <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', color: '#ffaaaa', borderRadius: 8, padding: '1rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Alertas sin registro hoy */}
      {equiposSinRegistroHoy.length > 0 && (
        <div style={{ backgroundColor: '#2d1515', border: '1px solid #aa3030', borderRadius: 8, padding: '1rem', marginBottom: 20 }}>
          <div style={{ color: '#ffaaaa', fontSize: 12, fontFamily: FONT.heading, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
            Sin registro hoy
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {equiposSinRegistroHoy.map(eq => (
              <span key={eq.id} style={{ backgroundColor: '#3d1515', border: '1px solid #B01D23', color: '#ff9999', padding: '3px 10px', borderRadius: 12, fontSize: 12 }}>
                {eq.nombre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Formulario */}
      <div style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, padding: '1rem', marginBottom: 24 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: '#777777', marginBottom: 12 }}>
          Nuevo Registro
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: '#777777', marginBottom: 4 }}>Equipo</div>
            <select
              value={equipoId}
              onChange={e => setEquipoId(e.target.value)}
              style={{ backgroundColor: '#1e1e1e', border: '1px solid #2a2a2a', color: '#ffffff', padding: '0.5rem', borderRadius: 6, minWidth: 180 }}
            >
              <option value="">Seleccionar...</option>
              {equipos.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#777777', marginBottom: 4 }}>Temperatura (°C)</div>
            <input
              type="number"
              step="0.1"
              value={temperatura}
              onChange={e => setTemperatura(e.target.value)}
              placeholder="Ej: 3.5"
              style={{ backgroundColor: '#1e1e1e', border: '1px solid #2a2a2a', color: '#ffffff', padding: '0.5rem', borderRadius: 6, width: 120 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#777777', marginBottom: 4 }}>Nota (opcional)</div>
            <input
              type="text"
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Observaciones..."
              style={{ backgroundColor: '#1e1e1e', border: '1px solid #2a2a2a', color: '#ffffff', padding: '0.5rem', borderRadius: 6, width: 220 }}
            />
          </div>
          <button
            onClick={guardar}
            disabled={saving || !equipoId || !temperatura}
            style={{ backgroundColor: '#B01D23', color: '#ffffff', border: 'none', borderRadius: 6, padding: '0.5rem 1.25rem', fontFamily: FONT.heading, letterSpacing: 1, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            Guardar
          </button>
        </div>
      </div>

      {/* Lista registros */}
      {loading ? (
        <div style={{ color: '#777777', fontSize: 13 }}>Cargando...</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #2a2a2a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#0a0a0a' }}>
                {['Fecha/Hora', 'Equipo', 'Temp.', 'Rango', 'Estado', 'Nota'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#777777', borderBottom: '1px solid #2a2a2a' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '20px 14px', color: '#777777', textAlign: 'center' }}>Sin registros</td></tr>
              ) : registros.map((r, i) => {
                const eq = equipoMap[r.equipo_id]
                const color = semaforoColor(r.temperatura, eq?.rango_temp_min ?? null, eq?.rango_temp_max ?? null)
                return (
                  <tr key={r.id} style={{ backgroundColor: i % 2 === 0 ? '#111111' : '#141414', borderBottom: '1px solid #2a2a2a' }}>
                    <td style={{ padding: '10px 14px', color: '#cccccc' }}>{fmtFechaHora(r.fecha_hora)}</td>
                    <td style={{ padding: '10px 14px', color: '#ffffff' }}>{eq?.nombre ?? r.equipo_id}</td>
                    <td style={{ padding: '10px 14px', color: color, fontWeight: 700, fontSize: 15 }}>{r.temperatura}°C</td>
                    <td style={{ padding: '10px 14px', color: '#777777', fontSize: 12 }}>
                      {eq?.rango_temp_min !== null && eq?.rango_temp_max !== null
                        ? `${eq.rango_temp_min}°C – ${eq.rango_temp_max}°C`
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: color }} />
                    </td>
                    <td style={{ padding: '10px 14px', color: '#777777' }}>{r.nota ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
