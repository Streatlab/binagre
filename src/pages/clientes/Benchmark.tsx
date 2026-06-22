import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS, lbl, lblSm, kpiMid, kpiBig, TABS_PILL, SUBTABS } from '@/components/panel/resumen/tokens'
import { fmtEur, fmtNumES } from '@/utils/format'

/* ═════════════ BENCHMARK & CARTA MAESTRA · MKT · v2 ═════════════
   Competencia + manual + plan 90d + carta maestra + simulador de lanzamiento.
   Todo editable, con gráficos, exportable y cruzado con ventas reales del ERP.
   Tablas: mkt_benchmark_competidores / _patrones / _plan / _platos / _insights.
   KPIs reales: v_mkt_benchmark_kpis (ticket medio 90d, etc.).
*/

type Competidor = {
  id: number; categoria: string; nombre: string; es_benchmark: boolean
  facturacion: string | null; ticket_medio: string | null; canal_principal: string | null
  año_fundacion: number | null; amenaza: number | null; facilidad_copiar: number | null; web: string | null
  que_venden: string | null; como_lo_venden: string | null
  por_que_funciona: string | null; su_debilidad: string | null; nuestro_atajo: string | null; orden: number
}
type Patron = { id: number; titulo: string; descripcion: string; aplicacion_sl: string | null; orden: number }
type PlanItem = { id: number; fase: string; semanas: string | null; accion: string; hecho: boolean; orden: number }
type Plato = {
  id: number; marca: string; tipo: string; nombre: string; descripcion: string | null
  precio: number | null; es_heroe: boolean; en_carta: boolean
  food_cost_pct: number | null; prioridad: number | null; notas: string | null; orden: number
}
type Insight = { id: number; categoria: string | null; texto: string; fuente: string | null }
type Kpis = { ticket_medio_90d: number | null; pedidos_90d: number | null; bruto_90d: number | null }

const CAT_LABEL: Record<string, string> = {
  comida_casera: 'Comida Casera', binagre_premium: 'Binagre · Premium', ramen_katsu: 'Ramen & Katsu',
  pasta: 'Pasta Italiana', french_tacos: 'French Tacos', green: 'Green / Honest', transversal: 'Transversal',
}
const MARCA_LABEL: Record<string, string> = {
  comida_casera: 'Comida Casera', binagre: 'Binagre', ramen_katsu: 'Ramen & Katsu',
  pasta: 'Pasta', french_tacos: 'French Tacos', green: 'Green',
}
const MARCA_ORDEN = ['binagre', 'comida_casera', 'ramen_katsu', 'pasta', 'french_tacos', 'green']
const TIPO_LABEL: Record<string, string> = { heroe: 'Héroes', plato: 'Platos', combo: 'Combos', formato: 'Formatos' }
const TIPO_ORDEN = ['heroe', 'plato', 'combo', 'formato']

// comisión media plataforma estimada (para margen neto delivery)
const COMISION_PLATAFORMA = 0.30

const TABS = [
  { id: 'competencia', label: 'Competencia' },
  { id: 'manual', label: 'El Manual' },
  { id: 'plan', label: 'Plan 90 días' },
  { id: 'carta', label: 'Carta Maestra' },
  { id: 'simulador', label: 'Simulador 🚀' },
] as const

const inp: React.CSSProperties = { padding: '6px 9px', borderRadius: 7, border: `0.5px solid ${COLORS.brd}`, background: COLORS.card, color: COLORS.pri, fontSize: 13, fontFamily: FONT.body, outline: 'none', width: '100%' }
const btnPri: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, border: 'none', background: COLORS.redSL, color: '#fff', fontFamily: FONT.body, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: `0.5px solid ${COLORS.brd}`, background: 'transparent', color: COLORS.sec, fontFamily: FONT.body, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }
const btnMini: React.CSSProperties = { padding: '3px 8px', borderRadius: 6, border: `0.5px solid ${COLORS.brd}`, background: 'transparent', color: COLORS.mut, cursor: 'pointer', fontSize: 11, fontFamily: FONT.body }

function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const csv = [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

export default function Benchmark() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('competencia')
  const [competidores, setCompetidores] = useState<Competidor[]>([])
  const [patrones, setPatrones] = useState<Patron[]>([])
  const [plan, setPlan] = useState<PlanItem[]>([])
  const [platos, setPlatos] = useState<Plato[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    setCargando(true)
    const [c, pa, pl, pt, ins, k] = await Promise.all([
      supabase.from('mkt_benchmark_competidores').select('*').order('orden'),
      supabase.from('mkt_benchmark_patrones').select('*').order('orden'),
      supabase.from('mkt_benchmark_plan').select('*').order('orden'),
      supabase.from('mkt_benchmark_platos').select('*').order('orden'),
      supabase.from('mkt_benchmark_insights').select('*').order('id'),
      supabase.from('v_mkt_benchmark_kpis').select('*').single(),
    ])
    setCompetidores((c.data as Competidor[]) || [])
    setPatrones((pa.data as Patron[]) || [])
    setPlan((pl.data as PlanItem[]) || [])
    setPlatos((pt.data as Plato[]) || [])
    setInsights((ins.data as Insight[]) || [])
    setKpis((k.data as Kpis) || null)
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: COLORS.redSL, letterSpacing: 3, textTransform: 'uppercase' }}>BENCHMARK & CARTA MAESTRA</div>
          <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 2 }}>Cómo ganan los mejores · qué copiar · plan 90 días · batería de platos · simulador de lanzamiento</div>
        </div>
        {kpis?.ticket_medio_90d != null && (
          <div style={{ ...CARDS.std, padding: '10px 16px', display: 'flex', gap: 18 }}>
            <div><div style={lblSm}>Ticket medio (90d)</div><div style={{ ...kpiMid, color: COLORS.redSL }}>{fmtEur(kpis.ticket_medio_90d)}</div></div>
            <div><div style={lblSm}>Pedidos (90d)</div><div style={kpiMid}>{fmtNumES(kpis.pedidos_90d)}</div></div>
          </div>
        )}
      </div>

      <div style={TABS_PILL.container}>
        {TABS.map(t2 => <button key={t2.id} onClick={() => setTab(t2.id)} style={tab === t2.id ? TABS_PILL.active : TABS_PILL.inactive}>{t2.label}</button>)}
      </div>

      {cargando ? (
        <div style={{ color: COLORS.mut, fontSize: 14, padding: 24 }}>Cargando benchmark...</div>
      ) : (
        <div style={{ marginTop: 14 }}>
          {tab === 'competencia' && <TabCompetencia competidores={competidores} insights={insights} onChange={cargar} />}
          {tab === 'manual' && <TabManual patrones={patrones} onChange={cargar} />}
          {tab === 'plan' && <TabPlan plan={plan} onChange={cargar} />}
          {tab === 'carta' && <TabCarta platos={platos} onChange={cargar} />}
          {tab === 'simulador' && <TabSimulador platos={platos} kpis={kpis} />}
        </div>
      )}
    </div>
  )
}

/* ═════════════ helpers de UI ═════════════ */
function Estrellas({ n, color }: { n: number | null; color: string }) {
  const v = n ?? 0
  return <span style={{ color, letterSpacing: 1 }}>{'●'.repeat(v)}<span style={{ color: COLORS.brd }}>{'●'.repeat(Math.max(0, 5 - v))}</span></span>
}

function Bloque({ label, texto }: { label: string; texto: string | null }) {
  if (!texto) return null
  return (
    <div>
      <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500 }}>{label}</div>
      <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, marginTop: 2, lineHeight: 1.4 }}>{texto}</div>
    </div>
  )
}

/* ═════════════ TAB 1 · COMPETENCIA (con mapa de amenaza + edición) ═════════════ */
function TabCompetencia({ competidores, insights, onChange }: { competidores: Competidor[]; insights: Insight[]; onChange: () => void }) {
  const cats = useMemo(() => Array.from(new Set(competidores.map(c => c.categoria))), [competidores])
  const [catSel, setCatSel] = useState<string>('todas')
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Partial<Competidor>>({})
  const visibles = catSel === 'todas' ? competidores : competidores.filter(c => c.categoria === catSel)

  async function guardar(id: number) {
    await supabase.from('mkt_benchmark_competidores').update({
      nuestro_atajo: draft.nuestro_atajo, amenaza: draft.amenaza, facilidad_copiar: draft.facilidad_copiar,
    }).eq('id', id)
    setEditId(null); setDraft({}); onChange()
  }

  if (competidores.length === 0) return <div style={{ ...CARDS.std, color: COLORS.mut }}>Sin competidores cargados.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Mapa de amenaza × facilidad de copiar */}
      <div style={CARDS.big}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={lbl}>Mapa estratégico · amenaza vs. facilidad de copiarles</div>
          <button onClick={() => exportCSV('competidores.csv', competidores as unknown as Record<string, unknown>[])} style={btnGhost}>↓ CSV</button>
        </div>
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginBottom: 10 }}>Arriba-derecha = prioridad máxima: nos amenazan y podemos copiarlos.</div>
        <MapaAmenaza competidores={competidores} />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => setCatSel('todas')} style={catSel === 'todas' ? SUBTABS.active : SUBTABS.inactive}>Todas</button>
        {cats.map(c => <button key={c} onClick={() => setCatSel(c)} style={catSel === c ? SUBTABS.active : SUBTABS.inactive}>{CAT_LABEL[c] || c}</button>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14, alignItems: 'start' }}>
        {visibles.map(c => {
          const editando = editId === c.id
          return (
            <div key={c.id} style={{ ...CARDS.std, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: COLORS.pri }}>{c.nombre}</div>
                  <div style={{ ...lblSm, marginTop: 2 }}>{CAT_LABEL[c.categoria] || c.categoria}{c.año_fundacion ? ` · desde ${c.año_fundacion}` : ''}</div>
                </div>
                <span style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: 0.5, padding: '2px 8px', borderRadius: 4, background: c.es_benchmark ? COLORS.redSL : COLORS.group, color: c.es_benchmark ? '#fff' : COLORS.sec, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{c.es_benchmark ? 'Benchmark' : 'Eficiente'}</span>
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {c.facturacion && <div><div style={lblSm}>Facturación</div><div style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: COLORS.ok }}>{c.facturacion}</div></div>}
                {c.ticket_medio && <div><div style={lblSm}>Ticket</div><div style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: COLORS.pri }}>{c.ticket_medio}</div></div>}
              </div>
              {c.canal_principal && <Bloque label="Canal principal" texto={c.canal_principal} />}

              <div style={{ display: 'flex', gap: 16 }}>
                <div><div style={lblSm}>Amenaza</div>{editando ? <input type="number" min={1} max={5} value={draft.amenaza ?? c.amenaza ?? ''} onChange={e => setDraft({ ...draft, amenaza: Number(e.target.value) })} style={{ ...inp, width: 56 }} /> : <Estrellas n={c.amenaza} color={COLORS.err} />}</div>
                <div><div style={lblSm}>Copiable</div>{editando ? <input type="number" min={1} max={5} value={draft.facilidad_copiar ?? c.facilidad_copiar ?? ''} onChange={e => setDraft({ ...draft, facilidad_copiar: Number(e.target.value) })} style={{ ...inp, width: 56 }} /> : <Estrellas n={c.facilidad_copiar} color={COLORS.ok} />}</div>
              </div>

              <Bloque label="Qué venden" texto={c.que_venden} />
              <Bloque label="Cómo lo venden" texto={c.como_lo_venden} />
              <Bloque label="Por qué funciona" texto={c.por_que_funciona} />
              <Bloque label="Su debilidad" texto={c.su_debilidad} />

              <div style={{ background: COLORS.glovo, borderRadius: 8, padding: '10px 12px', marginTop: 2 }}>
                <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.glovoText, fontWeight: 600, marginBottom: 3 }}>Nuestro atajo</div>
                {editando
                  ? <textarea value={draft.nuestro_atajo ?? c.nuestro_atajo ?? ''} onChange={e => setDraft({ ...draft, nuestro_atajo: e.target.value })} style={{ ...inp, minHeight: 70, background: '#fff' }} />
                  : <div style={{ fontFamily: FONT.body, fontSize: 13, color: '#111', lineHeight: 1.4 }}>{c.nuestro_atajo}</div>}
              </div>

              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {editando
                  ? <><button onClick={() => { setEditId(null); setDraft({}) }} style={btnMini}>Cancelar</button><button onClick={() => guardar(c.id)} style={btnPri}>Guardar</button></>
                  : <button onClick={() => { setEditId(c.id); setDraft({}) }} style={btnMini}>✎ Editar atajo / scores</button>}
              </div>
            </div>
          )
        })}
      </div>

      {insights.length > 0 && (
        <div style={CARDS.std}>
          <div style={{ ...lbl, marginBottom: 10 }}>Insights del sector</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {insights.map(i => (
              <div key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: COLORS.redSL, fontSize: 14, lineHeight: 1.3 }}>▸</span>
                <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, lineHeight: 1.45 }}>{i.texto}{i.fuente && <span style={{ color: COLORS.mut, fontSize: 11 }}> — {i.fuente}</span>}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MapaAmenaza({ competidores }: { competidores: Competidor[] }) {
  const W = 720, H = 360, pad = 40
  const innerW = W - pad * 2, innerH = H - pad * 2
  const xAt = (v: number) => pad + ((v - 1) / 4) * innerW
  const yAt = (v: number) => pad + (1 - (v - 1) / 4) * innerH
  const pts = competidores.filter(c => c.amenaza && c.facilidad_copiar)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
      <rect x={xAt(3)} y={pad} width={innerW / 2} height={innerH / 2} fill={`${COLORS.ok}12`} />
      {[1, 2, 3, 4, 5].map(t => (<g key={t}><line x1={xAt(t)} y1={pad} x2={xAt(t)} y2={H - pad} stroke={COLORS.group} strokeWidth={1} /><line x1={pad} y1={yAt(t)} x2={W - pad} y2={yAt(t)} stroke={COLORS.group} strokeWidth={1} /></g>))}
      <text x={W / 2} y={H - 8} textAnchor="middle" fontFamily="Oswald" fontSize={11} fill={COLORS.mut} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Facilidad de copiarles →</text>
      <text x={14} y={H / 2} textAnchor="middle" fontFamily="Oswald" fontSize={11} fill={COLORS.mut} transform={`rotate(-90 14 ${H / 2})`} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Amenaza →</text>
      {pts.map(c => {
        const x = xAt(c.facilidad_copiar!), y = yAt(c.amenaza!)
        const prioritario = c.amenaza! >= 3 && c.facilidad_copiar! >= 3
        return (
          <g key={c.id}>
            <circle cx={x} cy={y} r={prioritario ? 7 : 5} fill={prioritario ? COLORS.redSL : COLORS.directa} opacity={0.9} />
            <text x={x + 9} y={y + 4} fontFamily="Lexend" fontSize={11} fill={COLORS.pri} fontWeight={prioritario ? 600 : 400}>{c.nombre}</text>
          </g>
        )
      })}
    </svg>
  )
}

/* ═════════════ TAB 2 · EL MANUAL ═════════════ */
function TabManual({ patrones, onChange }: { patrones: Patron[]; onChange: () => void }) {
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  async function guardar(id: number) {
    await supabase.from('mkt_benchmark_patrones').update({ aplicacion_sl: draft }).eq('id', id)
    setEditId(null); onChange()
  }
  if (patrones.length === 0) return <div style={{ ...CARDS.std, color: COLORS.mut }}>Sin patrones cargados.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...CARDS.std, color: COLORS.sec, fontSize: 13, lineHeight: 1.5 }}>
        Los 8 patrones que comparten <strong style={{ color: COLORS.pri }}>todos</strong> los ganadores. Si cumplimos estos 8, jugamos su mismo juego. El bloque amarillo es editable: ahí anotamos cómo lo aterrizamos.
      </div>
      {patrones.map((p, i) => {
        const editando = editId === p.id
        return (
          <div key={p.id} style={{ ...CARDS.std, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 30, fontWeight: 600, color: COLORS.redSL, lineHeight: 1, minWidth: 38 }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: COLORS.pri }}>{p.titulo}</div>
              <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, marginTop: 4, lineHeight: 1.4 }}>{p.descripcion}</div>
              <div style={{ background: COLORS.glovo, borderRadius: 8, padding: '8px 12px', marginTop: 8 }}>
                <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.glovoText, fontWeight: 600, marginBottom: 3 }}>Cómo lo aplicamos</div>
                {editando
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <textarea value={draft} onChange={e => setDraft(e.target.value)} style={{ ...inp, minHeight: 60, background: '#fff' }} />
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}><button onClick={() => setEditId(null)} style={btnMini}>Cancelar</button><button onClick={() => guardar(p.id)} style={btnPri}>Guardar</button></div>
                    </div>
                  : <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontFamily: FONT.body, fontSize: 13, color: '#111' }}>{p.aplicacion_sl || '—'}</span>
                      <button onClick={() => { setEditId(p.id); setDraft(p.aplicacion_sl || '') }} style={{ ...btnMini, flexShrink: 0 }}>✎</button>
                    </div>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ═════════════ TAB 3 · PLAN 90 DÍAS (editable + añadir) ═════════════ */
function TabPlan({ plan, onChange }: { plan: PlanItem[]; onChange: () => void }) {
  const [guardando, setGuardando] = useState<number | null>(null)
  const [nuevaFase, setNuevaFase] = useState('Fase 1 · Cimientos')
  const [nuevaAccion, setNuevaAccion] = useState('')
  const fases = useMemo(() => Array.from(new Set(plan.map(p => p.fase))), [plan])
  const totalHechos = plan.filter(p => p.hecho).length
  const pctGlobal = plan.length ? Math.round((totalHechos / plan.length) * 100) : 0

  async function toggle(item: PlanItem) {
    setGuardando(item.id)
    await supabase.from('mkt_benchmark_plan').update({ hecho: !item.hecho }).eq('id', item.id)
    setGuardando(null); onChange()
  }
  async function añadir() {
    if (!nuevaAccion.trim()) return
    const maxOrden = Math.max(0, ...plan.map(p => p.orden))
    await supabase.from('mkt_benchmark_plan').insert({ fase: nuevaFase, accion: nuevaAccion.trim(), orden: maxOrden + 1, hecho: false })
    setNuevaAccion(''); onChange()
  }
  async function borrar(id: number) { await supabase.from('mkt_benchmark_plan').delete().eq('id', id); onChange() }

  if (plan.length === 0 && fases.length === 0) return <div style={{ ...CARDS.std, color: COLORS.mut }}>Sin plan cargado.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={CARDS.std}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={lbl}>Progreso global</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: pctGlobal >= 66 ? COLORS.ok : pctGlobal >= 33 ? COLORS.warn : COLORS.sec }}>{pctGlobal}%</div>
        </div>
        <div style={{ height: 8, background: COLORS.group, borderRadius: 4, overflow: 'hidden' }}><div style={{ height: 8, width: `${pctGlobal}%`, background: COLORS.redSL, borderRadius: 4 }} /></div>
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 6 }}>{totalHechos} de {plan.length} acciones completadas</div>
      </div>

      {fases.map(fase => {
        const items = plan.filter(p => p.fase === fase)
        const hechos = items.filter(p => p.hecho).length
        const pct = items.length ? Math.round((hechos / items.length) * 100) : 0
        return (
          <div key={fase} style={CARDS.std}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, color: COLORS.pri, textTransform: 'uppercase', letterSpacing: 1 }}>
                {fase} {items[0]?.semanas && <span style={{ color: COLORS.mut, fontSize: 12 }}>· semanas {items[0].semanas}</span>}
              </div>
              <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: pct === 100 ? COLORS.ok : COLORS.mut }}>{hechos}/{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {items.map(it => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 8px', borderRadius: 8 }}>
                  <button onClick={() => toggle(it)} disabled={guardando === it.id} style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1, cursor: 'pointer', border: `1.5px solid ${it.hecho ? COLORS.ok : COLORS.brd}`, background: it.hecho ? COLORS.ok : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, opacity: guardando === it.id ? 0.5 : 1 }}>{it.hecho ? '✓' : ''}</button>
                  <span style={{ flex: 1, fontFamily: FONT.body, fontSize: 13, color: it.hecho ? COLORS.mut : COLORS.sec, lineHeight: 1.4, textDecoration: it.hecho ? 'line-through' : 'none' }}>{it.accion}</span>
                  <button onClick={() => borrar(it.id)} style={{ ...btnMini, flexShrink: 0, color: COLORS.err }} title="Borrar">✕</button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div style={CARDS.std}>
        <div style={{ ...lbl, marginBottom: 8 }}>Añadir acción</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={nuevaFase} onChange={e => setNuevaFase(e.target.value)} style={{ ...inp, width: 220 }}>
            {(fases.length ? fases : ['Fase 1 · Cimientos', 'Fase 2 · Recurrencia', 'Fase 3 · Escalar']).map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <input placeholder="Nueva acción..." value={nuevaAccion} onChange={e => setNuevaAccion(e.target.value)} onKeyDown={e => e.key === 'Enter' && añadir()} style={{ ...inp, flex: 1, minWidth: 200 }} />
          <button onClick={añadir} style={btnPri}>+ Añadir</button>
        </div>
      </div>
    </div>
  )
}

/* ═════════════ TAB 4 · CARTA MAESTRA (editar precio/fc, añadir, borrar, gráfico margen) ═════════════ */
function margenNeto(precio: number | null, fcPct: number | null): number | null {
  if (precio == null || fcPct == null) return null
  const neto = precio * (1 - COMISION_PLATAFORMA)        // tras comisión plataforma
  const coste = precio * (fcPct / 100)                    // food cost
  return neto - coste
}

function TabCarta({ platos, onChange }: { platos: Plato[]; onChange: () => void }) {
  const [guardando, setGuardando] = useState<number | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Partial<Plato>>({})
  const [marcaSel, setMarcaSel] = useState<string>('todas')

  const marcas = useMemo(() => {
    const set = Array.from(new Set(platos.map(p => p.marca)))
    return MARCA_ORDEN.filter(m => set.includes(m)).concat(set.filter(m => !MARCA_ORDEN.includes(m)))
  }, [platos])
  const totalProp = platos.length
  const totalEnCarta = platos.filter(p => p.en_carta).length

  async function toggleCarta(p: Plato) { setGuardando(p.id); await supabase.from('mkt_benchmark_platos').update({ en_carta: !p.en_carta }).eq('id', p.id); setGuardando(null); onChange() }
  async function guardar(id: number) { await supabase.from('mkt_benchmark_platos').update({ nombre: draft.nombre, descripcion: draft.descripcion, precio: draft.precio, food_cost_pct: draft.food_cost_pct }).eq('id', id); setEditId(null); setDraft({}); onChange() }
  async function borrar(id: number) { await supabase.from('mkt_benchmark_platos').delete().eq('id', id); onChange() }
  async function añadirPlato(marca: string) {
    const maxOrden = Math.max(0, ...platos.filter(p => p.marca === marca).map(p => p.orden))
    await supabase.from('mkt_benchmark_platos').insert({ marca, tipo: 'plato', nombre: 'Nuevo plato', precio: 0, food_cost_pct: 28, orden: maxOrden + 1 }); onChange()
  }

  const marcasMostrar = marcaSel === 'todas' ? marcas : [marcaSel]
  if (platos.length === 0) return <div style={{ ...CARDS.std, color: COLORS.mut }}>Sin platos cargados.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{ ...CARDS.std, flex: 1, minWidth: 150 }}><div style={lbl}>Propuestos</div><div style={{ ...kpiMid, marginTop: 6 }}>{totalProp}</div></div>
        <div style={{ ...CARDS.std, flex: 1, minWidth: 150 }}><div style={lbl}>En carta</div><div style={{ ...kpiMid, marginTop: 6, color: COLORS.ok }}>{totalEnCarta}</div><div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 2 }}>{totalProp ? Math.round((totalEnCarta / totalProp) * 100) : 0}% implantado</div></div>
        <div style={{ ...CARDS.big, flex: 2, minWidth: 280 }}>
          <div style={{ ...lblSm, marginBottom: 8 }}>Margen neto medio por marca (tras comisión 30% + food cost)</div>
          <GraficoMargen platos={platos} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setMarcaSel('todas')} style={marcaSel === 'todas' ? SUBTABS.active : SUBTABS.inactive}>Todas</button>
          {marcas.map(m => <button key={m} onClick={() => setMarcaSel(m)} style={marcaSel === m ? SUBTABS.active : SUBTABS.inactive}>{MARCA_LABEL[m] || m}</button>)}
        </div>
        <button onClick={() => exportCSV('carta_maestra.csv', platos.map(p => ({ marca: p.marca, tipo: p.tipo, nombre: p.nombre, precio: p.precio, food_cost_pct: p.food_cost_pct, margen_neto: margenNeto(p.precio, p.food_cost_pct)?.toFixed(2), en_carta: p.en_carta })) as unknown as Record<string, unknown>[])} style={btnGhost}>↓ Exportar CSV</button>
      </div>

      {marcasMostrar.map(marca => {
        const dela = platos.filter(p => p.marca === marca)
        if (dela.length === 0) return null
        const enCarta = dela.filter(p => p.en_carta).length
        const tipos = TIPO_ORDEN.filter(t => dela.some(p => p.tipo === t)).concat(Array.from(new Set(dela.map(p => p.tipo))).filter(t => !TIPO_ORDEN.includes(t)))
        return (
          <div key={marca} style={CARDS.std}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${COLORS.group}` }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: COLORS.redSL, textTransform: 'uppercase', letterSpacing: 1.5 }}>{MARCA_LABEL[marca] || marca}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: enCarta === dela.length ? COLORS.ok : COLORS.mut }}>{enCarta}/{dela.length} en carta</span>
                <button onClick={() => añadirPlato(marca)} style={btnMini}>+ plato</button>
              </div>
            </div>
            {tipos.map(tipo => (
              <div key={tipo} style={{ marginBottom: 10 }}>
                <div style={{ ...lblSm, marginBottom: 6 }}>{TIPO_LABEL[tipo] || tipo}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {dela.filter(p => p.tipo === tipo).map(p => {
                    const editando = editId === p.id
                    const mg = margenNeto(p.precio, p.food_cost_pct)
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px', borderRadius: 8, background: p.en_carta ? `${COLORS.ok}10` : 'transparent' }}>
                        <button onClick={() => toggleCarta(p)} disabled={guardando === p.id} title={p.en_carta ? 'Quitar de carta' : 'Marcar en carta'} style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1, cursor: 'pointer', border: `1.5px solid ${p.en_carta ? COLORS.ok : COLORS.brd}`, background: p.en_carta ? COLORS.ok : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, opacity: guardando === p.id ? 0.5 : 1 }}>{p.en_carta ? '✓' : ''}</button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {editando ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <input value={draft.nombre ?? p.nombre} onChange={e => setDraft({ ...draft, nombre: e.target.value })} style={inp} />
                              <textarea value={draft.descripcion ?? p.descripcion ?? ''} onChange={e => setDraft({ ...draft, descripcion: e.target.value })} style={{ ...inp, minHeight: 44 }} />
                              <div style={{ display: 'flex', gap: 6 }}>
                                <div><div style={lblSm}>Precio €</div><input type="number" step="0.1" value={draft.precio ?? p.precio ?? 0} onChange={e => setDraft({ ...draft, precio: Number(e.target.value) })} style={{ ...inp, width: 90 }} /></div>
                                <div><div style={lblSm}>Food cost %</div><input type="number" step="1" value={draft.food_cost_pct ?? p.food_cost_pct ?? 0} onChange={e => setDraft({ ...draft, food_cost_pct: Number(e.target.value) })} style={{ ...inp, width: 90 }} /></div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}><button onClick={() => { setEditId(null); setDraft({}) }} style={btnMini}>Cancelar</button><button onClick={() => guardar(p.id)} style={btnPri}>Guardar</button></div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {p.es_heroe && <span title="Plato héroe" style={{ color: COLORS.warn, fontSize: 13 }}>★</span>}
                                <span style={{ fontFamily: FONT.body, fontSize: 13.5, fontWeight: 600, color: COLORS.pri }}>{p.nombre}</span>
                              </div>
                              {p.descripcion && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 1, lineHeight: 1.35 }}>{p.descripcion}</div>}
                              {mg != null && <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.sec, marginTop: 2 }}>Margen neto ~{fmtEur(mg)} · FC {p.food_cost_pct}%</div>}
                            </>
                          )}
                        </div>
                        {!editando && <>
                          {p.precio != null && <div style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, color: COLORS.pri, whiteSpace: 'nowrap' }}>{fmtEur(Number(p.precio))}</div>}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <button onClick={() => { setEditId(p.id); setDraft({}) }} style={btnMini}>✎</button>
                            <button onClick={() => borrar(p.id)} style={{ ...btnMini, color: COLORS.err }}>✕</button>
                          </div>
                        </>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function GraficoMargen({ platos }: { platos: Plato[] }) {
  const data = MARCA_ORDEN.filter(m => platos.some(p => p.marca === m)).map(m => {
    const dela = platos.filter(p => p.marca === m && p.precio && p.food_cost_pct)
    const mgs = dela.map(p => margenNeto(p.precio, p.food_cost_pct)!).filter(v => v != null)
    const avg = mgs.length ? mgs.reduce((s, v) => s + v, 0) / mgs.length : 0
    return { marca: m, avg }
  })
  const max = Math.max(1, ...data.map(d => d.avg))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map(d => (
        <div key={d.marca} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.sec, width: 110, textAlign: 'right' }}>{MARCA_LABEL[d.marca] || d.marca}</span>
          <div style={{ flex: 1, height: 18, background: COLORS.group, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: 18, width: `${(d.avg / max) * 100}%`, background: COLORS.redSL, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 11, color: '#fff', fontWeight: 600 }}>{fmtEur(d.avg)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═════════════ TAB 5 · SIMULADOR DE LANZAMIENTO ═════════════
   Eliges una marca candidata + pedidos/día estimados → proyecta ingreso,
   coste MP, margen neto mensual cruzando food cost real con tu ticket real.
   Ranking de qué marca lanzar primero por margen potencial.
*/
function TabSimulador({ platos, kpis }: { platos: Plato[]; kpis: Kpis | null }) {
  const marcas = useMemo(() => MARCA_ORDEN.filter(m => platos.some(p => p.marca === m)), [platos])
  const [marca, setMarca] = useState<string>(marcas[0] || 'binagre')
  const [pedidosDia, setPedidosDia] = useState<number>(15)
  const ticketReal = kpis?.ticket_medio_90d ?? 0

  // métricas de la marca seleccionada
  function metricasMarca(m: string) {
    const dela = platos.filter(p => p.marca === m && p.precio)
    const precioMedio = dela.length ? dela.reduce((s, p) => s + Number(p.precio), 0) / dela.length : 0
    const fcMedio = dela.length ? dela.reduce((s, p) => s + Number(p.food_cost_pct ?? 28), 0) / dela.length : 28
    const heroe = dela.find(p => p.es_heroe)
    return { precioMedio, fcMedio, nPlatos: dela.length, heroe }
  }
  const met = metricasMarca(marca)
  // ticket de simulación: usamos el precio medio de la marca (más realista que el ticket global)
  const ticketSim = met.precioMedio || ticketReal
  const ingresoMes = ticketSim * pedidosDia * 30
  const comisionMes = ingresoMes * COMISION_PLATAFORMA
  const costeMPmes = ingresoMes * (met.fcMedio / 100)
  const margenMes = ingresoMes - comisionMes - costeMPmes
  const margenPct = ingresoMes ? (margenMes / ingresoMes) * 100 : 0

  // ranking: qué marca lanzar primero (margen mensual potencial a mismos pedidos/día)
  const ranking = marcas.map(m => {
    const mm = metricasMarca(m)
    const ing = (mm.precioMedio || ticketReal) * pedidosDia * 30
    const mg = ing - ing * COMISION_PLATAFORMA - ing * (mm.fcMedio / 100)
    return { marca: m, margenMes: mg, fc: mm.fcMedio, precio: mm.precioMedio }
  }).sort((a, b) => b.margenMes - a.margenMes)
  const maxMg = Math.max(1, ...ranking.map(r => r.margenMes))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...CARDS.std, background: COLORS.modal, color: '#fff' }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>🚀 Simulador de lanzamiento</div>
        <div style={{ fontFamily: FONT.body, fontSize: 12.5, opacity: 0.85, marginTop: 3, lineHeight: 1.4 }}>Lo que ningún competidor puede hacer: cruzar la batería de platos con tu food cost y tu ticket real para decidir qué marca lanzar primero. Ajusta los pedidos/día y mira el margen.</div>
      </div>

      <div style={CARDS.std}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><div style={lblSm}>Marca candidata</div>
            <select value={marca} onChange={e => setMarca(e.target.value)} style={{ ...inp, width: 200 }}>
              {marcas.map(m => <option key={m} value={m}>{MARCA_LABEL[m] || m}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={lblSm}>Pedidos / día estimados</span><span style={{ fontFamily: FONT.heading, fontWeight: 600, color: COLORS.redSL }}>{pedidosDia}</span></div>
            <input type="range" min={2} max={60} value={pedidosDia} onChange={e => setPedidosDia(Number(e.target.value))} style={{ width: '100%', accentColor: COLORS.redSL }} />
          </div>
        </div>
      </div>

      {/* KPIs proyectados */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...CARDS.std, flex: 1, minWidth: 150 }}><div style={lbl}>Ingreso / mes</div><div style={{ ...kpiBig, marginTop: 4 }}>{fmtEur(ingresoMes)}</div><div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>ticket sim. {fmtEur(ticketSim)}</div></div>
        <div style={{ ...CARDS.std, flex: 1, minWidth: 150 }}><div style={lbl}>Comisión plataforma</div><div style={{ ...kpiMid, marginTop: 4, color: COLORS.err }}>−{fmtEur(comisionMes)}</div><div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>30% estimado</div></div>
        <div style={{ ...CARDS.std, flex: 1, minWidth: 150 }}><div style={lbl}>Coste materia prima</div><div style={{ ...kpiMid, marginTop: 4, color: COLORS.err }}>−{fmtEur(costeMPmes)}</div><div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>food cost {met.fcMedio.toFixed(0)}%</div></div>
        <div style={{ ...CARDS.std, flex: 1.3, minWidth: 170, borderColor: COLORS.ok }}><div style={lbl}>Margen neto / mes</div><div style={{ ...kpiBig, marginTop: 4, color: margenMes >= 0 ? COLORS.ok : COLORS.err }}>{fmtEur(margenMes)}</div><div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>{margenPct.toFixed(0)}% sobre ingreso</div></div>
      </div>

      {met.heroe && (
        <div style={{ ...CARDS.std, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: COLORS.warn, fontSize: 18 }}>★</span>
          <div><span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.sec }}>Plato héroe de esta marca: </span><span style={{ fontFamily: FONT.body, fontSize: 13.5, fontWeight: 600, color: COLORS.pri }}>{met.heroe.nombre}</span><span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}> — lánzalo como portada y construye toda la foto/copy a su alrededor.</span></div>
        </div>
      )}

      {/* Ranking: qué lanzar primero */}
      <div style={CARDS.big}>
        <div style={{ ...lbl, marginBottom: 4 }}>¿Qué marca lanzar primero? · margen neto potencial a {pedidosDia} pedidos/día</div>
        <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginBottom: 12 }}>Ordenado por margen mensual. La de arriba es la apuesta de mayor retorno con el mismo esfuerzo de cocina.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranking.map((r, i) => (
            <div key={r.marca} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: i === 0 ? COLORS.redSL : COLORS.mut, width: 22 }}>{i + 1}</span>
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, width: 110 }}>{MARCA_LABEL[r.marca] || r.marca}</span>
              <div style={{ flex: 1, height: 22, background: COLORS.group, borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ height: 22, width: `${(r.margenMes / maxMg) * 100}%`, background: i === 0 ? COLORS.ok : COLORS.directa, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 }}>
                  <span style={{ fontFamily: FONT.heading, fontSize: 12, color: '#fff', fontWeight: 600 }}>{fmtEur(r.margenMes)}</span>
                </div>
              </div>
              <span style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, width: 70, textAlign: 'right' }}>FC {r.fc.toFixed(0)}%</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: '10px 12px', background: COLORS.glovo, borderRadius: 8 }}>
          <span style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: COLORS.glovoText, fontWeight: 600 }}>Recomendación · </span>
          <span style={{ fontFamily: FONT.body, fontSize: 13, color: '#111' }}>Lanza primero <strong>{MARCA_LABEL[ranking[0]?.marca] || ranking[0]?.marca}</strong>: mejor margen neto con el mismo esfuerzo de cocina. Test de 4 semanas como pop-up, mide repetición, y si funciona, escala.</span>
        </div>
      </div>

      <div style={{ ...CARDS.std, color: COLORS.mut, fontSize: 12, lineHeight: 1.5 }}>
        Nota: estimación. Ticket de simulación = precio medio de la marca; food cost = media estimada de sus platos; comisión plataforma fija al 30%. No incluye costes fijos de cocina ni packaging. Ajusta los food cost reales en la pestaña Carta Maestra para afinar.
      </div>
    </div>
  )
}
