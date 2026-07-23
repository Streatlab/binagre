import { BLANCO, CREMA, GRANATE, GRIS, INK, ROJO_S, SHADOW } from '@/styles/neobrutal'
import { ERROR_BANNER_BG, ERROR_BANNER_BORDE } from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { COLORS } from '@/components/panel/resumen/tokens'
import { HeroCantera, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

interface Entrada {
  id: string
  turno: string
  texto: string
  etiquetas: string[] | null
  fecha_hora: string
  created_at: string
}

const TURNOS = ['Mañana', 'Tarde', 'Noche', 'Cierre']
const ETIQUETAS_PRESET = ['Incidencia', 'Pedido', 'Personal', 'Calidad', 'Equipo', 'Cliente', 'Otro']

function fmtFechaHora(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function BitacoraNovedades() {
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<string | null>(null)
  const [turno, setTurno] = useState(TURNOS[0])
  const [texto, setTexto] = useState('')
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { loadData() }, [busqueda, filtroEtiqueta])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      let q = supabase.from('bitacora_novedades').select('*').order('fecha_hora', { ascending: false }).limit(100)
      if (busqueda.trim()) q = q.ilike('texto', `%${busqueda.trim()}%`)
      const { data, error: e } = await q
      if (e) throw e
      let rows = (data ?? []) as Entrada[]
      if (filtroEtiqueta) {
        rows = rows.filter(r => r.etiquetas && r.etiquetas.includes(filtroEtiqueta))
      }
      setEntradas(rows)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('42P01') ? 'Tabla bitacora_novedades no encontrada.' : `Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  async function addEntrada() {
    if (!texto.trim()) return
    setSaving(true)
    const { error: e } = await supabase.from('bitacora_novedades').insert({
      turno, texto: texto.trim(),
      etiquetas: etiquetasSeleccionadas.length > 0 ? etiquetasSeleccionadas : null,
      fecha_hora: new Date().toISOString(),
    })
    if (!e) {
      setTexto('')
      setEtiquetasSeleccionadas([])
      setShowForm(false)
      await loadData()
    }
    setSaving(false)
  }

  function toggleEtiqueta(et: string) {
    setEtiquetasSeleccionadas(prev => prev.includes(et) ? prev.filter(e => e !== et) : [...prev, et])
  }

  const hoyStr = new Date().toISOString().slice(0, 10)
  const entradasHoy = entradas.filter(e => e.fecha_hora.startsWith(hoyStr))
  const conIncidencia = entradasHoy.filter(e => e.etiquetas?.includes('Incidencia')).length

  const titularHero = entradas.length === 0
    ? 'Aún no hay novedades registradas.'
    : conIncidencia > 0 ? `${conIncidencia} ${conIncidencia === 1 ? 'incidencia' : 'incidencias'} anotadas hoy.`
    : entradasHoy.length > 0 ? `${entradasHoy.length} ${entradasHoy.length === 1 ? 'novedad' : 'novedades'} registradas hoy.`
    : 'Sin novedades registradas hoy.'

  const atencionHero = [
    entradasHoy.length > 0 ? `${entradasHoy.length} hoy` : null,
    conIncidencia > 0 ? `${conIncidencia} incidencias` : null,
    `${entradas.length} en total`,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>

      {/* Filtros propios planos */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowForm(s => !s)}
          style={{ padding: '9px 18px', background: GRANATE, color: BLANCO, border: `3px solid ${INK}`, boxShadow: SHADOW, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Nueva entrada
        </button>
      </div>

      {/* 1 · Héroe del área Operaciones (naranja) */}
      <HeroCantera
        area="ops"
        periodo={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
        titular={titularHero}
        etiquetaDato={entradasHoy.length > 0 ? 'Novedades de hoy' : undefined}
        cifra={entradasHoy.length > 0 ? String(entradasHoy.length) : undefined}
        atencion={atencionHero}
      />

      {error && <Papel ceja={ROJO_S} style={{ background: ERROR_BANNER_BG, border: `1px solid ${ERROR_BANNER_BORDE}`, color: ROJO_S }}>{error}</Papel>}

      {/* 3 · Frase potente (una sola, según haya o no incidencias) */}
      {!loading && entradas.length > 0 && (
        conIncidencia > 0
          ? <FrasePotente significado="peligro">Hay incidencias anotadas hoy: revísalas con el turno correspondiente.</FrasePotente>
          : <FrasePotente significado="logro">Sin incidencias registradas hoy: el turno va según lo previsto.</FrasePotente>
      )}

      {/* Formulario nueva entrada */}
      {showForm && (
        <Papel ceja={GRANATE}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Turno</label>
              <select value={turno} onChange={e => setTurno(e.target.value)}
                style={{ padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontSize: 13 }}>
                {TURNOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Novedad</label>
              <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3}
                placeholder="Escribe la novedad del turno..."
                style={{ padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontSize: 13, resize: 'vertical', fontFamily: FONT.body }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Etiquetas</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ETIQUETAS_PRESET.map(et => (
                <button key={et} onClick={() => toggleEtiqueta(et)}
                  style={{ padding: '3px 10px', border: `2px solid ${INK}`, cursor: 'pointer', fontFamily: FONT.body, fontSize: 12, background: etiquetasSeleccionadas.includes(et) ? COLORS.glovo : BLANCO, color: etiquetasSeleccionadas.includes(et) ? INK : GRIS }}>
                  {et}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addEntrada} disabled={saving}
              style={{ padding: '8px 18px', background: GRANATE, color: BLANCO, border: `3px solid ${INK}`, boxShadow: SHADOW, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 14px', background: BLANCO, border: `3px solid ${INK}`, color: GRIS, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </Papel>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar en novedades..."
          style={{ padding: '8px 12px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontSize: 13, minWidth: 200, outline: 'none' }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltroEtiqueta(null)}
            style={{ padding: '4px 12px', border: `2px solid ${INK}`, cursor: 'pointer', background: filtroEtiqueta === null ? COLORS.glovo : BLANCO, color: filtroEtiqueta === null ? INK : GRIS, fontSize: 12, fontFamily: FONT.body }}>
            Todas
          </button>
          {ETIQUETAS_PRESET.map(et => (
            <button key={et} onClick={() => setFiltroEtiqueta(et === filtroEtiqueta ? null : et)}
              style={{ padding: '4px 12px', border: `2px solid ${INK}`, cursor: 'pointer', background: filtroEtiqueta === et ? COLORS.glovo : BLANCO, color: filtroEtiqueta === et ? INK : GRIS, fontSize: 12, fontFamily: FONT.body }}>
              {et}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div style={{ color: GRIS, fontSize: 13 }}>Cargando…</div> : (
        <div>
          <SeccionLabel bg={GRANATE}>Entradas</SeccionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entradas.length === 0 ? (
              <div style={{ color: GRIS, fontSize: 13 }}>Sin entradas{busqueda || filtroEtiqueta ? ' para esta búsqueda' : ' aún'}.</div>
            ) : entradas.map(entrada => (
              <Papel key={entrada.id} ceja={GRANATE}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: CREMA, border: `2px solid ${INK}`, padding: '2px 8px', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: INK }}>{entrada.turno}</span>
                    {entrada.etiquetas && entrada.etiquetas.map(et => (
                      <span key={et} style={{ background: CREMA, border: `2px solid ${INK}`, padding: '2px 8px', fontSize: 10, color: GRIS }}>{et}</span>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: GRIS, whiteSpace: 'nowrap' }}>{fmtFechaHora(entrada.fecha_hora)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: INK, lineHeight: 1.5 }}>{entrada.texto}</p>
              </Papel>
            ))}
          </div>
        </div>
      )}
    </PantallaCantera>
  )
}
