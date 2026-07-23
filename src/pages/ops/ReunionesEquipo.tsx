import { BLANCO, GRANATE, GRIS, INK, NAR, VERDE } from '@/styles/neobrutal'
import { ERROR_BANNER_BG, ERROR_BANNER_BORDE } from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { toLocalDateStr } from '@/lib/dateRange'
import { COLORS } from '@/components/panel/resumen/tokens'
import RutaPantalla from '@/components/ui/RutaPantalla'
import { HeroCantera, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

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

  const titularHero = reuniones.length === 0
    ? 'Aún no hay reuniones registradas.'
    : acuerdosPendientes.length > 0
      ? `${acuerdosPendientes.length} ${acuerdosPendientes.length === 1 ? 'acuerdo pendiente' : 'acuerdos pendientes'} de cerrar.`
      : 'Sin acuerdos pendientes: todo al día.'

  const atencionHero = [
    acuerdosPendientes.length > 0 ? `${acuerdosPendientes.length} pendientes` : null,
    `${reuniones.length} reuniones`,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <RutaPantalla niveles={['Reuniones equipo']} subtitulo="Actas y acuerdos de reuniones" />
        <button onClick={() => setShowForm(s => !s)}
          style={{ padding: '9px 18px', background: COLORS.glovo, color: INK, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Nueva reunión
        </button>
      </div>

      {/* 1 · Héroe del área Operaciones (naranja) */}
      <HeroCantera
        area="ops"
        titular={titularHero}
        atencion={atencionHero}
      />

      {error && <Papel ceja={ERROR_BANNER_BORDE} style={{ background: ERROR_BANNER_BG, border: `1px solid ${ERROR_BANNER_BORDE}`, color: COLORS.redSL }}>{error}</Papel>}

      {/* 3 · Frase potente */}
      {!loading && reuniones.length > 0 && (
        acuerdosPendientes.length > 0
          ? <FrasePotente significado="peligro">Hay acuerdos sin cerrar: revísalos en la próxima reunión.</FrasePotente>
          : <FrasePotente significado="logro">Todos los acuerdos de las reuniones están cerrados.</FrasePotente>
      )}

      {/* Acuerdos pendientes */}
      {acuerdosPendientes.length > 0 && (
        <div>
          <SeccionLabel bg={NAR}>Acuerdos pendientes ({acuerdosPendientes.length})</SeccionLabel>
          <Papel ceja={NAR}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {acuerdosPendientes.map((a, i) => {
                const reunion = reuniones.find(r => r.id === a.reunionId)
                if (!reunion) return null
                const idx = (reunion.acuerdos ?? []).findIndex(ac => ac.texto === a.texto && !ac.hecho && (reunion.acuerdos ?? []).indexOf(ac) >= 0)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => toggleAcuerdo(reunion, idx >= 0 ? idx : i)}
                      style={{ width: 20, height: 20, border: `2px solid ${INK}`, background: BLANCO, cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, color: INK, flex: 1 }}>{a.texto}</span>
                    <span style={{ fontSize: 11, color: GRIS }}>{fmtFecha(a.reunionFecha)}</span>
                  </div>
                )
              })}
            </div>
          </Papel>
        </div>
      )}

      {/* Formulario nueva reunión */}
      {showForm && (
        <Papel ceja={GRANATE}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                style={{ padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontFamily: FONT.body, fontSize: 13 }} />
            </div>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Asistentes (separados por coma)</label>
              <input type="text" value={form.asistentes} onChange={e => setForm(p => ({ ...p, asistentes: e.target.value }))}
                placeholder="Nombre1, Nombre2..."
                style={{ padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontFamily: FONT.body, fontSize: 13 }} />
            </div>
          </div>
          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Acta</label>
            <textarea rows={4} value={form.acta} onChange={e => setForm(p => ({ ...p, acta: e.target.value }))}
              style={{ padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontSize: 13, resize: 'vertical', fontFamily: FONT.body }} />
          </div>
          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Acuerdos (uno por línea)</label>
            <textarea rows={4} value={acuerdosForm} onChange={e => setAcuerdosForm(e.target.value)}
              placeholder="Acuerdo 1&#10;Acuerdo 2..."
              style={{ padding: '8px 10px', background: BLANCO, border: `3px solid ${INK}`, color: INK, fontSize: 13, resize: 'vertical', fontFamily: FONT.body }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addReunion} disabled={saving}
              style={{ padding: '9px 18px', background: COLORS.redSL, color: BLANCO, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '9px 14px', background: BLANCO, border: `3px solid ${INK}`, color: GRIS, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </Papel>
      )}

      {loading ? <div style={{ color: GRIS, fontSize: 13 }}>Cargando…</div> : (
        <div>
          <SeccionLabel bg={GRANATE}>Reuniones</SeccionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reuniones.length === 0 ? (
              <div style={{ color: GRIS, fontSize: 13 }}>Sin reuniones registradas.</div>
            ) : reuniones.map(r => {
              const acuerdosR = r.acuerdos ?? []
              const pendientesR = acuerdosR.filter(a => !a.hecho).length
              return (
                <Papel key={r.id} ceja={GRANATE} pad="0">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }}
                    onClick={() => setExpanded(prev => prev === r.id ? null : r.id)}>
                    <div>
                      <div style={{ fontFamily: FONT.heading, fontSize: 14, letterSpacing: '1px', color: INK, marginBottom: 2 }}>{fmtFecha(r.fecha)}</div>
                      {r.asistentes && <div style={{ fontSize: 12, color: GRIS }}>{r.asistentes.join(', ')}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {pendientesR > 0 && (
                        <span style={{ background: BLANCO, color: NAR, border: `2px solid ${NAR}`, padding: '2px 8px', fontSize: 10, fontFamily: FONT.heading }}>
                          {pendientesR} pendiente{pendientesR > 1 ? 's' : ''}
                        </span>
                      )}
                      <span style={{ color: GRIS, fontSize: 14 }}>{expanded === r.id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expanded === r.id && (
                    <div style={{ padding: '0 18px 18px', borderTop: `2px solid ${INK}` }}>
                      {r.acta && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Acta</div>
                          <p style={{ margin: 0, fontSize: 13, color: INK, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.acta}</p>
                        </div>
                      )}
                      {acuerdosR.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: GRIS, marginBottom: 8 }}>Acuerdos</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {acuerdosR.map((a, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                                onClick={e => { e.stopPropagation(); toggleAcuerdo(r, idx) }}>
                                <div style={{
                                  width: 20, height: 20, flexShrink: 0, cursor: 'pointer',
                                  border: `2px solid ${a.hecho ? VERDE : INK}`,
                                  background: a.hecho ? VERDE : BLANCO,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {a.hecho && (
                                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                      <path d="M2 5.5L4.5 8L9 3" stroke={BLANCO} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                                <span style={{ fontSize: 13, color: GRIS, textDecoration: a.hecho ? 'line-through' : 'none', cursor: 'pointer' }}>{a.texto}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Papel>
              )
            })}
          </div>
        </div>
      )}
    </PantallaCantera>
  )
}
