import { BLANCO, BORDE_SUAVE, GRIS, INK, ROJO_S } from '@/styles/neobrutal'
import { ERROR_BANNER_BG, ERROR_BANNER_BORDE } from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { COLORS, COLOR } from '@/components/panel/resumen/tokens'


const BG_OPS = INK
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

  return (
    <div style={{ fontFamily: FONT.body, padding: '28px', background: BG_OPS, minHeight: '100vh', color: BLANCO }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', color: COLORS.redSL, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>BITÁCORA NOVEDADES</h1>
          <span style={{ fontSize: 13, color: COLOR.textMut }}>Registro de novedades por turno</span>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          style={{ padding: '8px 18px', background: COLORS.glovo, color: BG_OPS, border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Nueva entrada
        </button>
      </div>

      {error && <div style={{ backgroundColor: ERROR_BANNER_BG, border: `1px solid ${ERROR_BANNER_BORDE}`, borderRadius: 8, padding: '14px 18px', color: ROJO_S, fontSize: 13, marginBottom: 20 }}>{error}</div>}

      {/* Formulario nueva entrada */}
      {showForm && (
        <div style={{ background: INK, border: `1px solid ${BORDE_SUAVE}`, borderRadius: 10, padding: '20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLOR.textMut }}>Turno</label>
              <select value={turno} onChange={e => setTurno(e.target.value)}
                style={{ padding: '8px 10px', background: INK, border: `1px solid ${BORDE_SUAVE}`, borderRadius: 6, color: BLANCO, fontSize: 13 }}>
                {TURNOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLOR.textMut }}>Novedad</label>
              <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3}
                placeholder="Escribe la novedad del turno..."
                style={{ padding: '8px 10px', background: INK, border: `1px solid ${BORDE_SUAVE}`, borderRadius: 6, color: BLANCO, fontSize: 13, resize: 'vertical', fontFamily: FONT.body }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLOR.textMut, marginBottom: 6 }}>Etiquetas</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ETIQUETAS_PRESET.map(et => (
                <button key={et} onClick={() => toggleEtiqueta(et)}
                  style={{ padding: '3px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: FONT.body, fontSize: 12, background: etiquetasSeleccionadas.includes(et) ? COLORS.glovo : INK, color: etiquetasSeleccionadas.includes(et) ? BG_OPS : GRIS }}>
                  {et}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addEntrada} disabled={saving}
              style={{ padding: '8px 18px', background: COLORS.redSL, color: BLANCO, border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 14px', background: INK, border: `1px solid ${BORDE_SUAVE}`, color: GRIS, borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar en novedades..."
          style={{ padding: '8px 12px', background: INK, border: `1px solid ${BORDE_SUAVE}`, borderRadius: 6, color: BLANCO, fontSize: 13, minWidth: 200, outline: 'none' }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltroEtiqueta(null)}
            style={{ padding: '4px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', background: filtroEtiqueta === null ? COLORS.glovo : INK, color: filtroEtiqueta === null ? BG_OPS : GRIS, fontSize: 12, fontFamily: FONT.body }}>
            Todas
          </button>
          {ETIQUETAS_PRESET.map(et => (
            <button key={et} onClick={() => setFiltroEtiqueta(et === filtroEtiqueta ? null : et)}
              style={{ padding: '4px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', background: filtroEtiqueta === et ? COLORS.glovo : INK, color: filtroEtiqueta === et ? BG_OPS : GRIS, fontSize: 12, fontFamily: FONT.body }}>
              {et}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div style={{ color: COLOR.textMut, fontSize: 13 }}>Cargando…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entradas.length === 0 ? (
            <div style={{ color: COLOR.textMut, fontSize: 13 }}>Sin entradas{busqueda || filtroEtiqueta ? ' para esta búsqueda' : ' aún'}.</div>
          ) : entradas.map(entrada => (
            <div key={entrada.id} style={{ background: INK, border: `1px solid ${BORDE_SUAVE}`, borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: INK, border: `1px solid ${BORDE_SUAVE}`, padding: '2px 8px', borderRadius: 4, fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.glovo }}>{entrada.turno}</span>
                  {entrada.etiquetas && entrada.etiquetas.map(et => (
                    <span key={et} style={{ background: '#B01D2315', border: '1px solid #B01D2340', padding: '2px 8px', borderRadius: 10, fontSize: 10, color: GRIS }}>{et}</span>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: GRIS, whiteSpace: 'nowrap' }}>{fmtFechaHora(entrada.fecha_hora)}</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: GRIS, lineHeight: 1.5 }}>{entrada.texto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
