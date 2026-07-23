import { BLANCO, CREMA, GRANATE, GRIS, INK, ROJO_S, SHADOW } from '@/styles/neobrutal'
import { ERROR_BANNER_BG, ERROR_BANNER_BORDE } from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { COLORS, COLOR } from '@/components/panel/resumen/tokens'
import { HeroCantera, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

interface Equipo {
  id: string
  nombre: string
  tipo: string | null
  temp_min: number | null
  temp_max: number | null
  activo: boolean
}

interface RegistroTemp {
  id: string
  equipo_id: string
  temperatura: number
  nota: string | null
  fecha_hora: string
  equipo_nombre?: string
  equipo_temp_min?: number | null
  equipo_temp_max?: number | null
}

function localDateStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function fmtFechaHora(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function semaforo(temp: number, min: number | null, max: number | null): { color: string; label: string } {
  if (min === null || max === null) return { color: COLOR.textMut, label: '?' }
  if (temp >= min && temp <= max) return { color: COLORS.ok, label: 'OK' }
  return { color: COLORS.redSL, label: 'ALERTA' }
}

export default function ControlTemperaturas() {
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [registros, setRegistros] = useState<RegistroTemp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ equipo_id: '', temperatura: '', nota: '' })
  const [saving, setSaving] = useState(false)
  const [equiposSinRegistroHoy, setEquiposSinRegistroHoy] = useState<string[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data: eqData, error: e1 } = await supabase
        .from('equipos').select('*').eq('activo', true).order('nombre')
      if (e1) throw e1

      const { data: regData, error: e2 } = await supabase
        .from('registros_temperatura')
        .select('*, equipos(nombre, temp_min, temp_max)')
        .order('fecha_hora', { ascending: false })
        .limit(100)
      if (e2) throw e2

      const eqs = (eqData ?? []) as Equipo[]
      setEquipos(eqs)

      const regs: RegistroTemp[] = ((regData ?? []) as Record<string, unknown>[]).map(r => ({
        id: r.id as string,
        equipo_id: r.equipo_id as string,
        temperatura: r.temperatura as number,
        nota: r.nota as string | null,
        fecha_hora: r.fecha_hora as string,
        equipo_nombre: (r.equipos as Record<string, unknown> | null)?.nombre as string | undefined,
        equipo_temp_min: (r.equipos as Record<string, unknown> | null)?.temp_min as number | null,
        equipo_temp_max: (r.equipos as Record<string, unknown> | null)?.temp_max as number | null,
      }))
      setRegistros(regs)

      // Detectar equipos sin registro hoy
      const hoy = localDateStr()
      const idsConRegistroHoy = new Set(
        regs.filter(r => r.fecha_hora.startsWith(hoy)).map(r => r.equipo_id)
      )
      setEquiposSinRegistroHoy(eqs.filter(e => !idsConRegistroHoy.has(e.id)).map(e => e.nombre))

      if (eqs.length > 0 && !form.equipo_id) {
        setForm(prev => ({ ...prev, equipo_id: eqs[0].id }))
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('42P01') ? 'Tablas no encontradas. Ejecuta las migraciones SQL.' : `Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  async function addRegistro() {
    if (!form.equipo_id || !form.temperatura) return
    setSaving(true)
    const temp = parseFloat(form.temperatura)
    if (isNaN(temp)) { setSaving(false); return }

    const { error: e } = await supabase
      .from('registros_temperatura')
      .insert({ equipo_id: form.equipo_id, temperatura: temp, nota: form.nota || null, fecha_hora: new Date().toISOString() })

    if (!e) {
      setForm(prev => ({ ...prev, temperatura: '', nota: '' }))
      await loadData()
    }
    setSaving(false)
  }

  const registrosAlerta = registros.filter(r => semaforo(r.temperatura, r.equipo_temp_min ?? null, r.equipo_temp_max ?? null).label === 'ALERTA')

  const titularHero = equiposSinRegistroHoy.length > 0
    ? `${equiposSinRegistroHoy.length} ${equiposSinRegistroHoy.length === 1 ? 'equipo sin registrar' : 'equipos sin registrar'} hoy.`
    : registrosAlerta.length > 0
      ? `${registrosAlerta.length} ${registrosAlerta.length === 1 ? 'lectura fuera de rango' : 'lecturas fuera de rango'}.`
      : registros.length === 0 ? 'Aún no hay registros de temperatura.' : 'Todas las temperaturas dentro de rango.'

  const atencionHero = [
    equiposSinRegistroHoy.length > 0 ? `${equiposSinRegistroHoy.length} sin registrar hoy` : null,
    registrosAlerta.length > 0 ? `${registrosAlerta.length} fuera de rango` : null,
    `${equipos.length} equipos activos`,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>

      {/* 1 · Héroe del área Operaciones (naranja) */}
      <HeroCantera
        area="ops"
        periodo={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
        titular={titularHero}
        etiquetaDato={registrosAlerta.length > 0 ? 'Lecturas fuera de rango' : undefined}
        cifra={registrosAlerta.length > 0 ? String(registrosAlerta.length) : undefined}
        atencion={atencionHero}
      />

      {error && <Papel ceja={ROJO_S} style={{ background: ERROR_BANNER_BG, border: `1px solid ${ERROR_BANNER_BORDE}`, color: ROJO_S }}>{error}</Papel>}

      {/* 3 · Frase potente (una sola, según el estado del control) */}
      {!loading && (
        equiposSinRegistroHoy.length > 0
          ? <FrasePotente significado="peligro">Registra hoy la temperatura de: {equiposSinRegistroHoy.join(', ')}.</FrasePotente>
          : registrosAlerta.length > 0
            ? <FrasePotente significado="peligro">Hay lecturas fuera del rango seguro: revísalas cuanto antes.</FrasePotente>
            : registros.length > 0
              ? <FrasePotente significado="logro">Todos los equipos dentro del rango de temperatura seguro.</FrasePotente>
              : <FrasePotente significado="coste">Añade el primer registro del día para empezar el control.</FrasePotente>
      )}

      {/* Formulario añadir */}
      <div>
        <SeccionLabel bg={GRANATE}>Nuevo registro</SeccionLabel>
        <Papel ceja={GRANATE}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Equipo</label>
              <select value={form.equipo_id} onChange={e => setForm(p => ({ ...p, equipo_id: e.target.value }))}
                style={{ padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontFamily: FONT.body, fontSize: 13 }}>
                {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Temperatura (°C)</label>
              <input type="number" step="0.1" value={form.temperatura} onChange={e => setForm(p => ({ ...p, temperatura: e.target.value }))}
                style={{ padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontFamily: FONT.body, fontSize: 13, width: 120 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Nota</label>
              <input type="text" value={form.nota} onChange={e => setForm(p => ({ ...p, nota: e.target.value }))}
                placeholder="Opcional..." style={{ padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontFamily: FONT.body, fontSize: 13 }} />
            </div>
            <button onClick={addRegistro} disabled={saving}
              style={{ padding: '9px 18px', background: COLORS.glovo, color: INK, border: `3px solid ${INK}`, boxShadow: SHADOW, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : '+ Añadir'}
            </button>
          </div>
        </Papel>
      </div>

      {loading ? <div style={{ color: GRIS, fontSize: 13 }}>Cargando…</div> : (
        <div>
          <SeccionLabel bg={GRANATE}>Registros</SeccionLabel>
          <Papel ceja={GRANATE} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: INK }}>
                  {['Equipo', 'Temperatura', 'Rango', 'Estado', 'Nota', 'Fecha/Hora'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '20px 14px', color: GRIS, textAlign: 'center' }}>Sin registros aún</td></tr>
                ) : registros.map(r => {
                  const sem = semaforo(r.temperatura, r.equipo_temp_min ?? null, r.equipo_temp_max ?? null)
                  return (
                    <tr key={r.id} style={{ borderBottom: `2px solid ${INK}` }}>
                      <td style={{ padding: '10px 14px', color: GRIS }}>{r.equipo_nombre ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, color: sem.color }}>{r.temperatura}°C</td>
                      <td style={{ padding: '10px 14px', color: GRIS, fontSize: 12 }}>
                        {r.equipo_temp_min !== null && r.equipo_temp_max !== null ? `${r.equipo_temp_min}°C – ${r.equipo_temp_max}°C` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: sem.color, color: BLANCO, border: `2px solid ${INK}`, padding: '2px 8px', fontSize: 11, fontFamily: FONT.heading, letterSpacing: '1px' }}>{sem.label}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: GRIS, fontSize: 12 }}>{r.nota ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: GRIS, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtFechaHora(r.fecha_hora)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Papel>
        </div>
      )}
    </PantallaCantera>
  )
}
