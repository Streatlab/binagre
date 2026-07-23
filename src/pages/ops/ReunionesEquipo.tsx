import { BLANCO, BORDE_SUAVE, GRIS, INK, NAR, ROJO_S } from '@/styles/neobrutal'
import { ERROR_BANNER_BG, ERROR_BANNER_BORDE } from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { toLocalDateStr } from '@/lib/dateRange'
import { COLORS, COLOR } from '@/components/panel/resumen/tokens'
import RutaPantalla from '@/components/ui/RutaPantalla'


const BG_OPS = INK
interface Reunion {
  id: string
  fecha: string
  asistentes: string[] | null
  acta: string | null
  acuerdos: AcuerdoItem[] | null
  created_at: string
}

interface AcuerdoItem {
  texto: string
  hecho: boolean
  responsable?: string
}

function fmtFecha(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function getEmptyForm() {
  return { fecha: toLocalDateStr(new Date()), asistentes: '', acta: '' }
}

export default function ReunionesEquipo() {
  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(getEmptyForm())
  const [acuerdosForm, setAcuerdosForm] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('reuniones_equipo')
        .select('*')
        .order('fecha', { ascending: false })
      if (e) throw e
      setReuniones((data ?? []) as Reunion[])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('42P01') ? 'Tabla reuniones_equipo no encontrada.' : `Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  async function addReunion() {
    if (!form.fecha) return
    setSaving(true)
    const asistentesArr = form.asistentes.trim()
      ? form.asistentes.split(',').map(s => s.trim()).filter(Boolean)
      : null
    const acuerdosArr: AcuerdoItem[] = acuerdosForm.trim()
      ? acuerdosForm.split('\n').map(l => l.trim()).filter(Boolean).map(t => ({ texto: t, hecho: false }))
      : []
    const { error: e } = await supabase.from('reuniones_equipo').insert({
      fecha: form.fecha,
      asistentes: asistentesArr,
      acta: form.acta || null,
      acuerdos: acuerdosArr.length > 0 ? acuerdosArr : null,
    })
    if (!e) {
      setForm(getEmptyForm())
      setAcuerdosForm('')
      setShowForm(false)
      await loadData()
    } else {
      setError(e.message)
    }
    setSaving(false)
  }

  async function toggleAcuerdo(reunion: Reunion, idx: number) {
    const acuerdos = (reunion.acuerdos ?? []).map((a, i) =>
      i === idx ? { ...a, hecho: !a.hecho } : a
    )
    const { error: e } = await supabase
      .from('reuniones_equipo')
      .update({ acuerdos })
      .eq('id', reunion.id)
    if (!e) {
      setReuniones(prev => prev.map(r => r.id === reunion.id ? { ...r, acuerdos } : r))
    }
  }

  const acuerdosPendientes = reuniones.flatMap(r =>
    (r.acuerdos ?? []).filter(a => !a.hecho).map(a => ({ ...a, reunionId: r.id, reunionFecha: r.fecha, acuerdoList: r.acuerdos ?? [] }))
  )

  return (
    <div style={{ fontFamily: FONT.body, padding: '28px', background: BG_OPS, minHeight: '100vh', color: BLANCO }}>
      <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <RutaPantalla niveles={['Reuniones equipo']} subtitulo="Actas y acuerdos de reuniones" />
        <button onClick={() => setShowForm(s => !s)}
          style={{ padding: '8px 18px', background: COLORS.glovo, color: BG_OPS, border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Nueva reunion
        </button>
      </div>

      {error && <div style={{ backgroundColor: ERROR_BANNER_BG, border: `1px solid ${ERROR_BANNER_BORDE}`, borderRadius: 8, padding: '14px 18px', color: ROJO_S, fontSize: 13, marginBottom: 20 }}>{error}</div>}

      {/* Acuerdos pendientes */}
      {acuerdosPendientes.length > 0 && (
        <div style={{ background: INK, border: '1px solid #f5a62340', borderRadius: 10, padding: '16px 18px', marginBottom: 24 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: NAR, marginBottom: 12 }}>
            ACUERDOS PENDIENTES ({acuerdosPendientes.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {acuerdosPendientes.map((a, i) => {
              const reunion = reuniones.find(r => r.id === a.reunionId)
              if (!reunion) return null
              const idx = (reunion.acuerdos ?? []).findIndex(ac => ac.texto === a.texto && !ac.hecho && (reunion.acuerdos ?? []).indexOf(ac) >= 0)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => toggleAcuerdo(reunion, idx >= 0 ? idx : i)}
                    style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${BORDE_SUAVE}`, background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, color: GRIS, flex: 1 }}>{a.texto}</span>
                  <span style={{ fontSize: 11, color: GRIS }}>{fmtFecha(a.reunionFecha)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Formulario nueva reunion */}
      {showForm && (
        <div style={{ background: INK, border: `1px solid ${BORDE_SUAVE}`, borderRadius: 10, padding: '20px', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLOR.textMut, display: 'block', marginBottom: 4 }}>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', background: INK, border: `1px solid ${BORDE_SUAVE}`, borderRadius: 6, color: BLANCO, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLOR.textMut, display: 'block', marginBottom: 4 }}>Asistentes (separados por coma)</label>
              <input type="text" value={form.asistentes} onChange={e => setForm(p => ({ ...p, asistentes: e.target.value }))}
                placeholder="Nombre1, Nombre2..."
                style={{ width: '100%', padding: '8px 10px', background: INK, border: `1px solid ${BORDE_SUAVE}`, borderRadius: 6, color: BLANCO, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLOR.textMut, display: 'block', marginBottom: 4 }}>Acta</label>
            <textarea rows={4} value={form.acta} onChange={e => setForm(p => ({ ...p, acta: e.target.value }))}
              style={{ width: '100%', padding: '8px 10px', background: INK, border: `1px solid ${BORDE_SUAVE}`, borderRadius: 6, color: BLANCO, fontSize: 13, resize: 'vertical', fontFamily: FONT.body, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLOR.textMut, display: 'block', marginBottom: 4 }}>Acuerdos (uno por linea)</label>
            <textarea rows={4} value={acuerdosForm} onChange={e => setAcuerdosForm(e.target.value)}
              placeholder="Acuerdo 1&#10;Acuerdo 2..."
              style={{ width: '100%', padding: '8px 10px', background: INK, border: `1px solid ${BORDE_SUAVE}`, borderRadius: 6, color: BLANCO, fontSize: 13, resize: 'vertical', fontFamily: FONT.body, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addReunion} disabled={saving}
              style={{ padding: '8px 18px', background: COLORS.redSL, color: BLANCO, border: 'none', borderRadius: 6, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 14px', background: INK, border: `1px solid ${BORDE_SUAVE}`, color: GRIS, borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: COLOR.textMut, fontSize: 13 }}>Cargando...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reuniones.length === 0 ? (
            <div style={{ color: COLOR.textMut, fontSize: 13 }}>Sin reuniones registradas.</div>
          ) : reuniones.map(r => {
            const acuerdosR = r.acuerdos ?? []
            const pendientesR = acuerdosR.filter(a => !a.hecho).length
            return (
              <div key={r.id} style={{ background: INK, border: `1px solid ${BORDE_SUAVE}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }}
                  onClick={() => setExpanded(prev => prev === r.id ? null : r.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: FONT.heading, fontSize: 14, letterSpacing: '1px', color: BLANCO, marginBottom: 2 }}>{fmtFecha(r.fecha)}</div>
                      {r.asistentes && <div style={{ fontSize: 12, color: COLOR.textMut }}>{r.asistentes.join(', ')}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {pendientesR > 0 && (
                      <span style={{ background: NAR + '20', color: NAR, border: `1px solid ${NAR}`, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontFamily: FONT.heading }}>
                        {pendientesR} pendiente{pendientesR > 1 ? 's' : ''}
                      </span>
                    )}
                    <span style={{ color: GRIS, fontSize: 14 }}>{expanded === r.id ? '▲' : '▼'}</span>
                  </div>
                </div>
                {expanded === r.id && (
                  <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${BORDE_SUAVE}` }}>
                    {r.acta && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: COLOR.textMut, marginBottom: 6 }}>Acta</div>
                        <p style={{ margin: 0, fontSize: 13, color: GRIS, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.acta}</p>
                      </div>
                    )}
                    {acuerdosR.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: COLOR.textMut, marginBottom: 8 }}>Acuerdos</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {acuerdosR.map((a, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                              onClick={e => { e.stopPropagation(); toggleAcuerdo(r, idx) }}>
                              <div style={{
                                width: 20, height: 20, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                                border: `2px solid ${a.hecho ? COLORS.ok : INK}`,
                                background: a.hecho ? COLORS.ok : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {a.hecho && (
                                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                    <path d="M2 5.5L4.5 8L9 3" stroke={BLANCO} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                              <span style={{ fontSize: 13, color: a.hecho ? GRIS : GRIS, textDecoration: a.hecho ? 'line-through' : 'none', cursor: 'pointer' }}>{a.texto}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
