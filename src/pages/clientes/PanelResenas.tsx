import { BLANCO, INK, GRIS, GRANATE, VERDE, NAR, ROJO, OSW, LEX } from '@/styles/neobrutal'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, TABS_PILL } from '@/components/panel/resumen/tokens'
import { fmtNumES } from '@/utils/format'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

/* ═════════════ PANEL DE RESEÑAS STREAT LAB ═════════════
   Resumen en columnas verticales por plataforma con edición inline.
   Evolución con histórico + previsión por mínimos cuadrados.
   CANTERA ALEGRE v1.0 (área Marketing · rosa). Solo capa visual; datos/lógica intactos.
*/

type Registro = { id: number; fecha: string; marca: string; plataforma: string; rating: number; num_resenas: number; num_nuevas: number; comentario: string | null }
type Acceso = { marca: string; plataforma: string }

const PLATAFORMAS = ['UE', 'GL', 'JE'] as const
const PLAT_LABEL: Record<string, string> = { UE: 'Uber Eats', GL: 'Glovo', JE: 'Just Eat' }
const PLAT_COLOR: Record<string, string> = { UE: COLORS.uber, GL: COLORS.glovo, JE: COLORS.je }
const PLAT_TXT: Record<string, string> = { GL: COLORS.glovoText }
const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 0, border: `0.5px solid ${COLORS.brd}`, background: COLORS.card, color: COLORS.pri, fontSize: 13, fontFamily: FONT.body, outline: 'none', width: '100%' }
const btnPri: React.CSSProperties = { padding: '8px 16px', borderRadius: 0, border: 'none', background: COLORS.accent, color: BLANCO, fontFamily: FONT.body, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnMini: React.CSSProperties = { padding: '3px 9px', borderRadius: 0, border: `0.5px solid ${COLORS.brd}`, background: 'transparent', color: COLORS.sec, cursor: 'pointer', fontSize: 11, fontFamily: FONT.body }
const th: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, fontWeight: 500, padding: '8px 10px', textAlign: 'left', borderBottom: `1px solid ${COLORS.brd}` }
const td: React.CSSProperties = { fontFamily: LEX, fontSize: 13, color: COLORS.sec, padding: '8px 10px', borderBottom: `1px solid ${COLORS.group}` }

function ratingColor(r: number) { if (r >= 4.5) return COLORS.ok; if (r >= 4.0) return COLORS.warn; return COLORS.err }
function estrellas(r: number) {
  const full = Math.floor(r); const half = r - full >= 0.5
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)))
}
function fmtFecha(f: string) { const [, m, d] = f.split('-'); return `${d} ${MESES_ES[parseInt(m, 10) - 1]}` }

// previsión por mínimos cuadrados → siguiente punto
function preverSiguiente(ys: number[]): number | null {
  const n = ys.length
  if (n < 2) return null
  let sx = 0, sy = 0, sxy = 0, sxx = 0
  ys.forEach((y, i) => { sx += i; sy += y; sxy += i * y; sxx += i * i })
  const denom = n * sxx - sx * sx
  if (denom === 0) return null
  const m = (n * sxy - sx * sy) / denom
  const b = (sy - m * sx) / n
  const pred = m * n + b
  return Math.max(0, Math.min(5, pred))
}

function ultimoPorClave(registros: Registro[]) {
  const m: Record<string, Registro> = {}
  for (const r of registros) { const k = `${r.marca}|${r.plataforma}`; if (!m[k] || r.fecha > m[k].fecha) m[k] = r }
  return m
}

const TABS = [{ id: 'resumen', label: 'Resumen' }, { id: 'evolucion', label: 'Evolución' }, { id: 'registro', label: 'Registrar' }] as const

export default function PanelResenas() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('resumen')
  const [registros, setRegistros] = useState<Registro[]>([])
  const [accesos, setAccesos] = useState<Acceso[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')

  async function cargar() {
    setCargando(true)
    const [r, a] = await Promise.all([
      supabase.from('crm_resenas_registro').select('*').order('fecha', { ascending: false }),
      supabase.from('marca_plataforma_acceso').select('marca:marca_id(nombre), plataforma, activo').eq('activo', true),
    ])
    setRegistros((r.data as Registro[]) || [])
    const acc: Acceso[] = ((a.data as any[]) || []).map(x => ({ marca: x.marca?.nombre || '', plataforma: x.plataforma })).filter(x => x.marca)
    setAccesos(acc)
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])
  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  // Derivado de presentación para el héroe (misma fuente que TabResumen).
  const ultimos = useMemo(() => ultimoPorClave(registros), [registros])
  const valoresHero = Object.values(ultimos)
  const mediaGlobalHero = valoresHero.length ? valoresHero.reduce((s, r) => s + Number(r.rating), 0) / valoresHero.length : null
  const totalResenasHero = valoresHero.reduce((s, r) => s + (r.num_resenas || 0), 0)
  const porPlatHero = PLATAFORMAS.map(p => {
    const v = valoresHero.filter(r => r.plataforma === p)
    const media = v.length ? v.reduce((s, r) => s + Number(r.rating), 0) / v.length : null
    return { p, media }
  })

  const titular = valoresHero.length === 0
    ? 'Sin valoraciones todavía: registra la primera nota.'
    : mediaGlobalHero != null && mediaGlobalHero >= 4.5 ? 'Las plataformas valoran muy bien la marca.'
    : mediaGlobalHero != null && mediaGlobalHero >= 4.0 ? 'Buena nota media, con margen de mejora.'
    : 'La nota media pide atención.'

  const atencionHero = porPlatHero
    .filter(x => x.media != null)
    .map(x => `${PLAT_LABEL[x.p]}: ${(x.media as number).toFixed(2)}`)

  return (
    <PantallaCantera>
      {/* 1 · Héroe del área Marketing (rosa) */}
      <HeroCantera
        area="marketing"
        titular={titular}
        etiquetaDato="Media global"
        cifra={mediaGlobalHero != null ? mediaGlobalHero.toFixed(2) : '—'}
        resumen={mediaGlobalHero != null ? <>{estrellas(mediaGlobalHero)} · {fmtNumES(totalResenasHero)} reseñas</> : undefined}
        atencion={atencionHero}
      />

      <div style={TABS_PILL.container}>
        {TABS.map(t2 => <button key={t2.id} onClick={() => setTab(t2.id)} style={tab === t2.id ? TABS_PILL.active : TABS_PILL.inactive}>{t2.label}</button>)}
      </div>

      {msg && <Papel ceja={VERDE} pad="10px 16px" style={{ fontSize: 13, color: INK }}>{msg}</Papel>}

      {cargando ? (
        <div style={{ color: GRIS, fontSize: 14, padding: 24, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando reseñas…</div>
      ) : (
        <>
          {tab === 'resumen' && <TabResumen registros={registros} onSaved={() => { cargar(); flash('Nota actualizada') }} />}
          {tab === 'evolucion' && <TabEvolucion registros={registros} />}
          {tab === 'registro' && <TabRegistro accesos={accesos} registros={registros} onSaved={() => { cargar(); flash('Valoraciones registradas') }} />}
        </>
      )}
    </PantallaCantera>
  )
}

/* ═════════════ RESUMEN — plancha de KPIs + columnas verticales con edición ═════════════ */
function TabResumen({ registros, onSaved }: { registros: Registro[]; onSaved: () => void }) {
  const ultimos = useMemo(() => ultimoPorClave(registros), [registros])
  const valores = Object.values(ultimos)
  const [editK, setEditK] = useState<string | null>(null)
  const [ed, setEd] = useState({ rating: '', num_resenas: '' })

  const mediaGlobal = valores.length ? valores.reduce((s, r) => s + Number(r.rating), 0) / valores.length : 0
  const totalResenas = valores.reduce((s, r) => s + (r.num_resenas || 0), 0)

  const porPlat = PLATAFORMAS.map(p => {
    const v = valores.filter(r => r.plataforma === p).sort((a, b) => Number(b.rating) - Number(a.rating))
    const media = v.length ? v.reduce((s, r) => s + Number(r.rating), 0) / v.length : 0
    const res = v.reduce((s, r) => s + (r.num_resenas || 0), 0)
    return { plataforma: p, media, res, marcas: v }
  })

  async function guardar(marca: string, plataforma: string) {
    if (!ed.rating) return
    const hoy = new Date().toISOString().slice(0, 10)
    await supabase.from('crm_resenas_registro').upsert({ fecha: hoy, marca, plataforma, rating: Number(ed.rating), num_resenas: Number(ed.num_resenas) || 0, num_nuevas: 0 }, { onConflict: 'fecha,marca,plataforma' })
    setEditK(null); setEd({ rating: '', num_resenas: '' }); onSaved()
  }

  if (valores.length === 0) return <Papel ceja={GRIS}><div style={{ color: GRIS, fontFamily: LEX }}>Sin valoraciones todavía. Ve a "Registrar" e introduce la nota de cada marca.</div></Papel>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Plancha de KPIs */}
      <div>
        <SeccionLabel bg={GRANATE}>Nota por plataforma</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={ratingColor(mediaGlobal)} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Media global</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, marginTop: 6 }}>{mediaGlobal.toFixed(2)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{estrellas(mediaGlobal)} · {fmtNumES(totalResenas)} reseñas</div>
          </PlanchaCelda>
          {porPlat.map(p => (
            <PlanchaCelda key={p.plataforma} bg={p.media ? ratingColor(p.media) : GRIS}>
              <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>{PLAT_LABEL[p.plataforma]}</div>
              <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, marginTop: 6 }}>{p.media ? p.media.toFixed(2) : '—'}</div>
              <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{fmtNumES(p.res)} reseñas · {p.marcas.length} marcas</div>
            </PlanchaCelda>
          ))}
        </Plancha>
      </div>

      {/* Frase potente (color por significado, distinto del héroe rosa) */}
      {mediaGlobal >= 4.5 ? (
        <FrasePotente significado="logro">La nota media supera el 4,5: sigue respondiendo reseñas para mantenerla.</FrasePotente>
      ) : mediaGlobal >= 4.0 ? (
        <FrasePotente significado="coste">Nota media correcta, con margen: revisa los comentarios peor valorados.</FrasePotente>
      ) : (
        <FrasePotente significado="peligro">La nota media está por debajo de 4: prioriza responder y corregir incidencias.</FrasePotente>
      )}

      {/* Columnas verticales por plataforma con edición inline — papel (sin sombra) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
        {porPlat.map(p => (
          <Papel key={p.plataforma} ceja={PLAT_COLOR[p.plataforma]} pad="0" style={{ flex: '1 1 300px', overflow: 'hidden' }}>
            <div style={{ background: PLAT_COLOR[p.plataforma], padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: OSW, fontSize: 16, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: PLAT_TXT[p.plataforma] || BLANCO }}>{PLAT_LABEL[p.plataforma]}</span>
              <span style={{ fontFamily: OSW, fontSize: 22, fontWeight: 600, color: PLAT_TXT[p.plataforma] || BLANCO }}>{p.media ? p.media.toFixed(2) : '—'}</span>
            </div>
            <div style={{ padding: '6px 0' }}>
              {p.marcas.length === 0 ? (
                <div style={{ padding: '14px 16px', color: GRIS, fontSize: 13, fontFamily: LEX }}>Sin marcas registradas.</div>
              ) : p.marcas.map((m, i) => {
                const k = `${m.marca}|${p.plataforma}`
                const editando = editK === k
                return (
                  <div key={m.marca} style={{ padding: '10px 16px', borderBottom: i < p.marcas.length - 1 ? `1px solid ${COLORS.group}` : 'none' }}>
                    {editando ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontFamily: LEX, fontSize: 13, color: INK }}>{m.marca}</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input type="number" step="0.1" min="0" max="5" placeholder="Nota" value={ed.rating} onChange={e => setEd({ ...ed, rating: e.target.value })} style={{ ...inp, width: 70 }} />
                          <input type="number" placeholder="Nº reseñas" value={ed.num_resenas} onChange={e => setEd({ ...ed, num_resenas: e.target.value })} style={{ ...inp, flex: 1 }} />
                          <button onClick={() => guardar(m.marca, p.plataforma)} style={btnPri}>OK</button>
                          <button onClick={() => setEditK(null)} style={btnMini}>✕</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: LEX, fontSize: 13, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{m.marca}</span>
                          <span style={{ fontFamily: OSW, fontSize: 16, fontWeight: 600, color: ratingColor(Number(m.rating)) }}>{Number(m.rating).toFixed(1)}</span>
                          <button onClick={() => { setEditK(k); setEd({ rating: String(m.rating), num_resenas: String(m.num_resenas) }) }} style={{ ...btnMini, padding: '2px 7px' }} title="Editar nota">✎</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <div style={{ flex: 1, height: 6, background: COLORS.group, borderRadius: 0 }}>
                            <div style={{ height: 6, width: `${(Number(m.rating) / 5) * 100}%`, background: ratingColor(Number(m.rating)), borderRadius: 0 }} />
                          </div>
                          <span style={{ fontFamily: LEX, fontSize: 11, color: GRIS, whiteSpace: 'nowrap' }}>{fmtNumES(m.num_resenas)} res.</span>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </Papel>
        ))}
      </div>
    </div>
  )
}

/* ═════════════ EVOLUCIÓN — histórico + previsión ═════════════ */
function TabEvolucion({ registros }: { registros: Registro[] }) {
  const marcas = useMemo(() => Array.from(new Set(registros.map(r => r.marca))).sort(), [registros])
  const [marcaSel, setMarcaSel] = useState('')
  const marca = marcaSel || marcas[0] || ''
  const serie = useMemo(() => registros.filter(x => x.marca === marca).sort((a, b) => a.fecha.localeCompare(b.fecha)), [registros, marca])
  const fechas = useMemo(() => Array.from(new Set(serie.map(s => s.fecha))).sort(), [serie])

  // media global por marca por fecha (todas plataformas) para previsión
  const mediaPorFecha = fechas.map(f => {
    const dia = serie.filter(s => s.fecha === f)
    const med = dia.length ? dia.reduce((s, r) => s + Number(r.rating), 0) / dia.length : 0
    return { fecha: f, media: med }
  })
  const prevision = preverSiguiente(mediaPorFecha.map(p => p.media))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filtro propio: marca */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={lblSm}>Marca</span>
          <select value={marca} onChange={e => setMarcaSel(e.target.value)} style={{ ...inp, width: 280 }}>
            {marcas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>

      {fechas.length < 2 ? (
        <Papel ceja={GRIS}><div style={{ color: GRIS, fontFamily: LEX }}>Necesitas al menos 2 registros en fechas distintas para ver evolución y previsión. Registra notas cada pocos días.</div></Papel>
      ) : (
        <>
          {/* Plancha: nota actual, tendencia, previsión */}
          <Plancha>
            <PlanchaCelda bg={ratingColor(mediaPorFecha[mediaPorFecha.length - 1].media)} first>
              <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Nota media actual</div>
              <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, marginTop: 6 }}>{mediaPorFecha[mediaPorFecha.length - 1].media.toFixed(2)}</div>
              <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{fmtFecha(fechas[fechas.length - 1])}</div>
            </PlanchaCelda>
            {(() => {
              const ult = mediaPorFecha[mediaPorFecha.length - 1].media
              const pen = mediaPorFecha[mediaPorFecha.length - 2].media
              const dlt = ult - pen
              return (
                <PlanchaCelda bg={dlt >= 0 ? VERDE : ROJO}>
                  <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Movimiento</div>
                  <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, marginTop: 6 }}>{dlt >= 0 ? '+' : ''}{dlt.toFixed(2)}</div>
                  <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>vs registro anterior</div>
                </PlanchaCelda>
              )
            })()}
            {prevision !== null && (
              <PlanchaCelda bg={ratingColor(prevision)}>
                <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Previsión próxima</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, marginTop: 6 }}>{prevision.toFixed(2)}</div>
                <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>tendencia mínimos cuadrados</div>
              </PlanchaCelda>
            )}
          </Plancha>

          {/* Gráfico de líneas por plataforma + previsión — papel */}
          <Papel ceja={GRANATE}>
            <div style={{ ...lbl, marginBottom: 16 }}>Evolución de nota — {marca}</div>
            <LineChartResenas serie={serie} fechas={fechas} prevision={prevision} mediaPorFecha={mediaPorFecha} />
          </Papel>

          {/* Tabla — papel */}
          <Papel ceja={NAR} pad="0" style={{ overflowX: 'auto' }}>
            <div style={{ ...lbl, margin: '16px 16px 12px' }}>Registros — {marca}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Fecha</th><th style={th}>Plataforma</th><th style={{ ...th, textAlign: 'right' }}>Nota</th><th style={{ ...th, textAlign: 'right' }}>Reseñas</th></tr></thead>
              <tbody>
                {serie.slice().reverse().map(r => (
                  <tr key={r.id}>
                    <td style={td}>{fmtFecha(r.fecha)}</td>
                    <td style={td}>{PLAT_LABEL[r.plataforma]}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: OSW, fontWeight: 600, color: ratingColor(Number(r.rating)) }}>{Number(r.rating).toFixed(1)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtNumES(r.num_resenas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Papel>
        </>
      )}
    </div>
  )
}

/* gráfico de líneas SVG canónico: una línea por plataforma + línea de previsión punteada */
function LineChartResenas({ serie, fechas, prevision, mediaPorFecha }: { serie: Registro[]; fechas: string[]; prevision: number | null; mediaPorFecha: { fecha: string; media: number }[] }) {
  const W = 720, H = 240, padL = 34, padR = 16, padT = 14, padB = 28
  const innerW = W - padL - padR, innerH = H - padT - padB
  const yMin = 3.0, yMax = 5.0
  const nx = fechas.length + (prevision !== null ? 1 : 0)
  const xAt = (i: number) => padL + (nx <= 1 ? innerW / 2 : (i / (nx - 1)) * innerW)
  const yAt = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH

  const yTicks = [3, 3.5, 4, 4.5, 5]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
      {yTicks.map(t => (
        <g key={t}>
          <line x1={padL} y1={yAt(t)} x2={W - padR} y2={yAt(t)} stroke={COLORS.group} strokeWidth={1} />
          <text x={padL - 6} y={yAt(t) + 3} textAnchor="end" fontFamily="Lexend, sans-serif" fontSize={9} fill={COLORS.mut}>{t.toFixed(1)}</text>
        </g>
      ))}
      {fechas.map((f, i) => (
        <text key={f} x={xAt(i)} y={H - 8} textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize={9} fill={COLORS.mut} style={{ textTransform: 'uppercase' }}>{fmtFecha(f)}</text>
      ))}
      {prevision !== null && (
        <text x={xAt(nx - 1)} y={H - 8} textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize={9} fill={COLORS.accent} style={{ textTransform: 'uppercase' }}>Prev.</text>
      )}
      {PLATAFORMAS.map(p => {
        const pts = fechas.map((f, i) => { const reg = serie.find(s => s.fecha === f && s.plataforma === p); return reg ? { x: xAt(i), y: yAt(Math.max(yMin, Math.min(yMax, Number(reg.rating)))) } : null }).filter(Boolean) as { x: number; y: number }[]
        if (pts.length === 0) return null
        const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ')
        return (
          <g key={p}>
            <path d={d} fill="none" stroke={PLAT_COLOR[p] === COLORS.glovo ? COLORS.glovoDark : PLAT_COLOR[p]} strokeWidth={2} />
            {pts.map((pt, i) => <circle key={i} cx={pt.x} cy={pt.y} r={3} fill={PLAT_COLOR[p] === COLORS.glovo ? COLORS.glovoDark : PLAT_COLOR[p]} />)}
          </g>
        )
      })}
      {/* línea media + previsión */}
      {(() => {
        const pts = mediaPorFecha.map((mp, i) => ({ x: xAt(i), y: yAt(Math.max(yMin, Math.min(yMax, mp.media))) }))
        const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ')
        const last = pts[pts.length - 1]
        const prevPt = prevision !== null ? { x: xAt(nx - 1), y: yAt(Math.max(yMin, Math.min(yMax, prevision))) } : null
        return (
          <g>
            <path d={d} fill="none" stroke={COLORS.sec} strokeWidth={1.5} strokeDasharray="2 2" opacity={0.5} />
            {prevPt && <line x1={last.x} y1={last.y} x2={prevPt.x} y2={prevPt.y} stroke={COLORS.accent} strokeWidth={2} strokeDasharray="4 3" />}
            {prevPt && <circle cx={prevPt.x} cy={prevPt.y} r={4} fill={COLORS.accent} />}
          </g>
        )
      })()}
    </svg>
  )
}

/* ═════════════ REGISTRO ═════════════ */
function TabRegistro({ accesos, registros, onSaved }: { accesos: Acceso[]; registros: Registro[]; onSaved: () => void }) {
  const hoy = new Date().toISOString().slice(0, 10)
  const [fecha, setFecha] = useState(hoy)
  const [valores, setValores] = useState<Record<string, { rating: string; num_resenas: string }>>({})
  const ultimos = useMemo(() => ultimoPorClave(registros), [registros])

  const marcasPorPlat = useMemo(() => {
    const m: Record<string, string[]> = { UE: [], GL: [], JE: [] }
    accesos.forEach(a => { if (m[a.plataforma] && !m[a.plataforma].includes(a.marca)) m[a.plataforma].push(a.marca) })
    Object.keys(m).forEach(k => m[k].sort())
    return m
  }, [accesos])

  function setVal(marca: string, plat: string, campo: 'rating' | 'num_resenas', v: string) {
    const k = `${marca}|${plat}`
    setValores(prev => ({ ...prev, [k]: { ...(prev[k] || { rating: '', num_resenas: '' }), [campo]: v } }))
  }

  async function guardarTodo() {
    const rows = Object.entries(valores).filter(([, v]) => v.rating).map(([k, v]) => {
      const [marca, plataforma] = k.split('|')
      return { fecha, marca, plataforma, rating: Number(v.rating), num_resenas: Number(v.num_resenas) || 0, num_nuevas: 0 }
    })
    if (rows.length === 0) return
    for (const row of rows) await supabase.from('crm_resenas_registro').upsert(row, { onConflict: 'fecha,marca,plataforma' })
    setValores({}); onSaved()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Papel ceja={GRANATE} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={lblSm}>Fecha del registro</span>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inp, width: 180 }} />
        <button onClick={guardarTodo} style={btnPri}>Guardar todas</button>
        <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>Rellena solo lo que cambie. Se muestra la última nota registrada.</span>
      </Papel>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
        {PLATAFORMAS.map(p => (
          <Papel key={p} ceja={PLAT_COLOR[p]} pad="0" style={{ flex: '1 1 300px', overflow: 'hidden' }}>
            <div style={{ background: PLAT_COLOR[p], padding: '12px 16px' }}>
              <span style={{ fontFamily: OSW, fontSize: 15, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: PLAT_TXT[p] || BLANCO }}>{PLAT_LABEL[p]}</span>
            </div>
            <div style={{ padding: '6px 0' }}>
              {marcasPorPlat[p].length === 0 ? (
                <div style={{ padding: '14px 16px', color: GRIS, fontSize: 13, fontFamily: LEX }}>Sin marcas activas.</div>
              ) : marcasPorPlat[p].map((marca, i) => {
                const k = `${marca}|${p}`
                const v = valores[k] || { rating: '', num_resenas: '' }
                const prev = ultimos[k]
                return (
                  <div key={k} style={{ padding: '8px 16px', borderBottom: i < marcasPorPlat[p].length - 1 ? `1px solid ${COLORS.group}` : 'none' }}>
                    <div style={{ fontFamily: LEX, fontSize: 13, color: INK, marginBottom: 4 }}>
                      {marca}{prev ? <span style={{ color: GRIS, fontSize: 11 }}> · ahora {Number(prev.rating).toFixed(1)}</span> : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" step="0.1" min="0" max="5" placeholder="Nota" value={v.rating} onChange={e => setVal(marca, p, 'rating', e.target.value)} style={{ ...inp, width: 80 }} />
                      <input type="number" placeholder="Nº reseñas" value={v.num_resenas} onChange={e => setVal(marca, p, 'num_resenas', e.target.value)} style={{ ...inp, flex: 1 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Papel>
        ))}
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, fontWeight: 600 }
const lblSm: React.CSSProperties = { fontFamily: OSW, fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }
