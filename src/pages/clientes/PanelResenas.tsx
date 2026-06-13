import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS, lbl, lblSm, kpiBig, kpiMid, TABS_PILL } from '@/components/panel/resumen/tokens'
import { fmtNumES } from '@/utils/format'

/* ═════════════ PANEL DE RESEÑAS STREAT LAB ═════════════
   Tokens y estilos canónicos Binagre (Panel Global / Evolución).
   Resumen en COLUMNAS VERTICALES por plataforma (UE · Glovo · Just Eat),
   cada columna con sus marcas reales y su nota. Datos visibles desde el inicio.
*/

type Registro = { id: number; fecha: string; marca: string; plataforma: string; rating: number; num_resenas: number; num_nuevas: number; comentario: string | null }
type Acceso = { marca: string; plataforma: string }

const PLATAFORMAS = ['UE', 'GL', 'JE'] as const
const PLAT_LABEL: Record<string, string> = { UE: 'Uber Eats', GL: 'Glovo', JE: 'Just Eat' }
const PLAT_COLOR: Record<string, string> = { UE: COLORS.uber, GL: COLORS.glovo, JE: COLORS.je }
const PLAT_TXT: Record<string, string> = { GL: COLORS.glovoText }

const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: `0.5px solid ${COLORS.brd}`, background: COLORS.card, color: COLORS.pri, fontSize: 13, fontFamily: FONT.body, outline: 'none', width: '100%' }
const btnPri: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: COLORS.accent, color: '#fff', fontFamily: FONT.body, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500, padding: '8px 10px', textAlign: 'left', borderBottom: `1px solid ${COLORS.brd}` }
const td: React.CSSProperties = { fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, padding: '8px 10px', borderBottom: `1px solid ${COLORS.group}` }

function ratingColor(r: number) { if (r >= 4.5) return COLORS.ok; if (r >= 4.0) return COLORS.warn; return COLORS.err }
function estrellas(r: number) {
  const full = Math.floor(r); const half = r - full >= 0.5
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)))
}

const TABS = [{ id: 'resumen', label: 'Resumen' }, { id: 'registro', label: 'Registrar' }, { id: 'historico', label: 'Histórico' }] as const

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

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: COLORS.redSL, letterSpacing: 3, textTransform: 'uppercase' }}>PANEL DE RESEÑAS</div>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 2 }}>Valoración de cada marca por plataforma · actualiza las notas cada pocos días</div>
      </div>

      <div style={TABS_PILL.container}>
        {TABS.map(t2 => <button key={t2.id} onClick={() => setTab(t2.id)} style={tab === t2.id ? TABS_PILL.active : TABS_PILL.inactive}>{t2.label}</button>)}
      </div>

      {msg && <div style={{ ...CARDS.std, borderLeft: `3px solid ${COLORS.ok}`, margin: '12px 0', fontSize: 13, color: COLORS.pri }}>{msg}</div>}

      {cargando ? (
        <div style={{ color: COLORS.mut, fontSize: 14, padding: 24 }}>Cargando reseñas...</div>
      ) : (
        <div style={{ marginTop: 14 }}>
          {tab === 'resumen' && <TabResumen registros={registros} />}
          {tab === 'registro' && <TabRegistro accesos={accesos} registros={registros} onSaved={() => { cargar(); flash('Valoración registrada') }} />}
          {tab === 'historico' && <TabHistorico registros={registros} />}
        </div>
      )}
    </div>
  )
}

function ultimoPorClave(registros: Registro[]) {
  const m: Record<string, Registro> = {}
  for (const r of registros) { const k = `${r.marca}|${r.plataforma}`; if (!m[k] || r.fecha > m[k].fecha) m[k] = r }
  return m
}

/* ═════════════ RESUMEN — columnas verticales por plataforma ═════════════ */
function TabResumen({ registros }: { registros: Registro[] }) {
  const ultimos = useMemo(() => ultimoPorClave(registros), [registros])
  const valores = Object.values(ultimos)

  const mediaGlobal = valores.length ? valores.reduce((s, r) => s + Number(r.rating), 0) / valores.length : 0
  const totalResenas = valores.reduce((s, r) => s + (r.num_resenas || 0), 0)

  const porPlat = PLATAFORMAS.map(p => {
    const v = valores.filter(r => r.plataforma === p).sort((a, b) => Number(b.rating) - Number(a.rating))
    const media = v.length ? v.reduce((s, r) => s + Number(r.rating), 0) / v.length : 0
    const res = v.reduce((s, r) => s + (r.num_resenas || 0), 0)
    return { plataforma: p, media, res, marcas: v }
  })

  if (valores.length === 0) return <div style={{ ...CARDS.std, color: COLORS.mut }}>Sin valoraciones todavía. Ve a "Registrar" e introduce la nota de cada marca.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...CARDS.big, flex: 1, minWidth: 220 }}>
          <div style={lbl}>Media global Streat Lab</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
            <span style={{ ...kpiBig, color: ratingColor(mediaGlobal) }}>{mediaGlobal.toFixed(2)}</span>
            <span style={{ fontFamily: FONT.body, fontSize: 16, color: ratingColor(mediaGlobal) }}>{estrellas(mediaGlobal)}</span>
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 4 }}>{fmtNumES(totalResenas)} reseñas · {valores.length} fichas marca×plataforma</div>
        </div>
        {porPlat.map(p => (
          <div key={p.plataforma} style={{ ...CARDS.std, flex: 1, minWidth: 150, borderTop: `3px solid ${PLAT_COLOR[p.plataforma]}` }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 14, letterSpacing: '1px', textTransform: 'uppercase', color: PLAT_TXT[p.plataforma] || PLAT_COLOR[p.plataforma], fontWeight: 600 }}>{PLAT_LABEL[p.plataforma]}</div>
            <div style={{ ...kpiMid, marginTop: 6, color: ratingColor(p.media) }}>{p.media ? p.media.toFixed(2) : '—'}</div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>{fmtNumES(p.res)} reseñas · {p.marcas.length} marcas</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, alignItems: 'start' }}>
        {porPlat.map(p => (
          <div key={p.plataforma} style={{ ...CARDS.std, padding: 0, overflow: 'hidden' }}>
            <div style={{ background: PLAT_COLOR[p.plataforma], padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: PLAT_TXT[p.plataforma] || '#fff' }}>{PLAT_LABEL[p.plataforma]}</span>
              <span style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: PLAT_TXT[p.plataforma] || '#fff' }}>{p.media ? p.media.toFixed(2) : '—'}</span>
            </div>
            <div style={{ padding: '6px 0' }}>
              {p.marcas.length === 0 ? (
                <div style={{ padding: '14px 16px', color: COLORS.mut, fontSize: 13 }}>Sin marcas registradas.</div>
              ) : p.marcas.map((m, i) => (
                <div key={m.marca} style={{ padding: '10px 16px', borderBottom: i < p.marcas.length - 1 ? `1px solid ${COLORS.group}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.pri, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{m.marca}</span>
                    <span style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: ratingColor(Number(m.rating)) }}>{Number(m.rating).toFixed(1)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <div style={{ flex: 1, height: 6, background: COLORS.group, borderRadius: 3 }}>
                      <div style={{ height: 6, width: `${(Number(m.rating) / 5) * 100}%`, background: ratingColor(Number(m.rating)), borderRadius: 3 }} />
                    </div>
                    <span style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, whiteSpace: 'nowrap' }}>{fmtNumES(m.num_resenas)} res.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
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
      <div style={CARDS.std}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={lblSm}>Fecha del registro</div>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inp, width: 180 }} />
          <button onClick={guardarTodo} style={btnPri}>Guardar todas</button>
          <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>Rellena solo lo que cambie. Se muestra la última nota registrada.</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, alignItems: 'start' }}>
        {PLATAFORMAS.map(p => (
          <div key={p} style={{ ...CARDS.std, padding: 0, overflow: 'hidden' }}>
            <div style={{ background: PLAT_COLOR[p], padding: '12px 16px' }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: PLAT_TXT[p] || '#fff' }}>{PLAT_LABEL[p]}</span>
            </div>
            <div style={{ padding: '6px 0' }}>
              {marcasPorPlat[p].length === 0 ? (
                <div style={{ padding: '14px 16px', color: COLORS.mut, fontSize: 13 }}>Sin marcas activas.</div>
              ) : marcasPorPlat[p].map((marca, i) => {
                const k = `${marca}|${p}`
                const v = valores[k] || { rating: '', num_resenas: '' }
                const prev = ultimos[k]
                return (
                  <div key={k} style={{ padding: '8px 16px', borderBottom: i < marcasPorPlat[p].length - 1 ? `1px solid ${COLORS.group}` : 'none' }}>
                    <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.pri, marginBottom: 4 }}>
                      {marca}{prev ? <span style={{ color: COLORS.mut, fontSize: 11 }}> · ahora {Number(prev.rating).toFixed(1)}</span> : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" step="0.1" min="0" max="5" placeholder="Nota" value={v.rating} onChange={e => setVal(marca, p, 'rating', e.target.value)} style={{ ...inp, width: 80 }} />
                      <input type="number" placeholder="Nº reseñas" value={v.num_resenas} onChange={e => setVal(marca, p, 'num_resenas', e.target.value)} style={{ ...inp, flex: 1 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═════════════ HISTÓRICO ═════════════ */
function TabHistorico({ registros }: { registros: Registro[] }) {
  const [marcaSel, setMarcaSel] = useState('')
  const marcas = useMemo(() => Array.from(new Set(registros.map(r => r.marca))).sort(), [registros])
  const marca = marcaSel || marcas[0] || ''
  const serie = useMemo(() => registros.filter(x => x.marca === marca).sort((a, b) => a.fecha.localeCompare(b.fecha)), [registros, marca])
  const fechas = Array.from(new Set(serie.map(s => s.fecha))).sort()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={CARDS.std}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={lblSm}>Marca</div>
          <select value={marca} onChange={e => setMarcaSel(e.target.value)} style={{ ...inp, width: 280 }}>
            {marcas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {fechas.length === 0 ? (
        <div style={{ ...CARDS.std, color: COLORS.mut }}>Sin histórico para esta marca.</div>
      ) : (
        <div style={CARDS.big}>
          <div style={{ ...lbl, marginBottom: 16 }}>Evolución de nota — {marca}</div>
          {PLATAFORMAS.map(p => {
            const puntos = fechas.map(f => { const reg = serie.find(s => s.fecha === f && s.plataforma === p); return reg ? Number(reg.rating) : null })
            if (!puntos.some(x => x !== null)) return null
            return (
              <div key={p} style={{ marginBottom: 18 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: PLAT_TXT[p] || PLAT_COLOR[p] }}>{PLAT_LABEL[p]}</span>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, marginTop: 6 }}>
                  {fechas.map((f, i) => {
                    const val = puntos[i]
                    const h = val !== null ? Math.max(4, (val / 5) * 72) : 0
                    return (
                      <div key={f} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        {val !== null ? <span style={{ fontFamily: FONT.body, fontSize: 9, color: COLORS.mut }}>{val.toFixed(1)}</span> : <span style={{ fontSize: 9, color: COLORS.group }}>—</span>}
                        <div style={{ width: '100%', height: h, background: PLAT_COLOR[p], borderRadius: '3px 3px 0 0' }} />
                        <span style={{ fontFamily: FONT.body, fontSize: 8, color: COLORS.mut }}>{f.slice(5)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={CARDS.std}>
        <div style={{ ...lbl, marginBottom: 12 }}>Registros — {marca}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Fecha</th><th style={th}>Plataforma</th><th style={{ ...th, textAlign: 'right' }}>Nota</th><th style={{ ...th, textAlign: 'right' }}>Reseñas</th></tr></thead>
            <tbody>
              {serie.slice().reverse().map(r => (
                <tr key={r.id}>
                  <td style={td}>{r.fecha}</td>
                  <td style={td}>{PLAT_LABEL[r.plataforma]}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, fontWeight: 600, color: ratingColor(Number(r.rating)) }}>{Number(r.rating).toFixed(1)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtNumES(r.num_resenas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
