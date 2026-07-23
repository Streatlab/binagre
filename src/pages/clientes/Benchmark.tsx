import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { INK, BLANCO, OSW, LEX, GRANATE, VERDE, AMA, GRIS, ROSA, NAR, ROJO } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'
import { fmtEur, fmtNumES } from '@/utils/format'

/* ═════════════ BENCHMARK & CARTA MAESTRA · MKT ═════════════
   CANTERA ALEGRE v1.0 (área Clientes/Marketing · rosa). Solo capa visual.
   Competencia + manual + plan 90d + carta maestra + simulador de lanzamiento.
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

const inp: React.CSSProperties = { padding: '7px 9px', border: `2px solid ${INK}`, borderRadius: 0, background: BLANCO, color: INK, fontSize: 13, fontFamily: LEX, outline: 'none', width: '100%' }
const btnPri: React.CSSProperties = { padding: '8px 14px', border: `2px solid ${INK}`, borderRadius: 0, background: GRANATE, color: BLANCO, fontFamily: OSW, fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer', boxShadow: SHADOW_DURA }
const btnGhost: React.CSSProperties = { padding: '7px 12px', border: `2px solid ${INK}`, borderRadius: 0, background: BLANCO, color: INK, fontFamily: OSW, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer' }
const btnMini: React.CSSProperties = { padding: '3px 8px', border: `2px solid ${INK}`, borderRadius: 0, background: BLANCO, color: INK, cursor: 'pointer', fontSize: 11, fontFamily: OSW, fontWeight: 600 }
const th: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: BLANCO, fontWeight: 600, padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { fontFamily: LEX, fontSize: 13, color: INK, padding: '10px 12px', borderBottom: `2px solid ${INK}`, verticalAlign: 'top' }
const lblXsLocal: React.CSSProperties = { fontFamily: OSW, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: GRIS, fontWeight: 600 }
const lblCelda: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }
const valCelda: React.CSSProperties = { fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }
const subCelda: React.CSSProperties = { fontFamily: LEX, fontSize: 12, marginTop: 4 }

function StatCelda({ label, value, sub, bg = BLANCO, color, first }: { label: string; value: string; sub?: string; bg?: string; color?: string; first?: boolean }) {
  return (
    <PlanchaCelda bg={bg} color={color} first={first}>
      <div style={lblCelda}>{label}</div>
      <div style={valCelda}>{value}</div>
      {sub && <div style={subCelda}>{sub}</div>}
    </PlanchaCelda>
  )
}

function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const csv = [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
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

  if (cargando) {
    return (
      <PantallaCantera>
        <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando benchmark…</div>
      </PantallaCantera>
    )
  }

  const prioritarios = competidores.filter(c => (c.amenaza ?? 0) >= 3 && (c.facilidad_copiar ?? 0) >= 3).length
  const hechos = plan.filter(p => p.hecho).length
  const pctPlan = plan.length ? Math.round((hechos / plan.length) * 100) : 0
  const enCarta = platos.filter(p => p.en_carta).length

  const titular = competidores.length === 0
    ? 'Aún no hay competidores mapeados: sin referencia no hay atajo que copiar.'
    : prioritarios > 0
      ? `${prioritarios} competidor${prioritarios === 1 ? '' : 'es'} son prioridad máxima: nos amenazan y podemos copiarlos.`
      : 'Ningún competidor combina amenaza alta y facilidad de copia: la competencia está bajo control.'

  const atencionHero = [
    competidores.length ? `${competidores.length} competidores mapeados` : null,
    prioritarios ? `${prioritarios} prioritarios` : null,
    plan.length ? `Plan 90d al ${pctPlan}%` : null,
    platos.length ? `${enCarta}/${platos.length} platos en carta` : null,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>
      {/* 1 · Héroe del área Clientes (rosa) */}
      <HeroCantera
        area="marketing"
        titular={titular}
        etiquetaDato="Ticket medio (90d)"
        cifra={kpis?.ticket_medio_90d != null ? fmtEur(kpis.ticket_medio_90d) : '—'}
        resumen={kpis?.pedidos_90d != null ? <>{fmtNumES(kpis.pedidos_90d)} pedidos en los últimos 90 días</> : undefined}
        atencion={atencionHero}
      />

      {/* 2 · Plancha de KPIs del hub */}
      <div>
        <SeccionLabel bg={GRANATE}>Estado del benchmark</SeccionLabel>
        <Plancha>
          <StatCelda first bg={GRANATE} label="Competidores" value={String(competidores.length)} sub={`${prioritarios} prioritarios`} />
          <StatCelda bg={AMA} color={INK} label="Plan 90 días" value={`${pctPlan}%`} sub={`${hechos}/${plan.length} acciones`} />
          <StatCelda bg={VERDE} label="Carta maestra" value={`${enCarta}/${platos.length}`} sub="platos en carta" />
          <StatCelda bg={INK} color={BLANCO} label="Ticket medio (90d)" value={kpis?.ticket_medio_90d != null ? fmtEur(kpis.ticket_medio_90d) : '—'} />
        </Plancha>
      </div>

      {/* 3 · Frase potente */}
      {prioritarios > 0 ? (
        <FrasePotente significado="oportunidad">Copia primero a los competidores prioritarios: son los que más amenazan y más fácil resulta igualar.</FrasePotente>
      ) : (
        <FrasePotente significado="logro">Sin amenazas prioritarias detectadas: buen momento para invertir en diferenciación propia.</FrasePotente>
      )}

      {/* Navegación propia de la pantalla — pastillas planas arriba-derecha */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(t2 => {
            const on = tab === t2.id
            return (
              <button key={t2.id} onClick={() => setTab(t2.id)} style={{
                padding: '8px 16px', border: `2px solid ${INK}`, borderRadius: 0,
                background: on ? GRANATE : BLANCO, color: on ? BLANCO : INK,
                boxShadow: on ? SHADOW_DURA : 'none',
                fontFamily: OSW, fontSize: 12.5, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
              }}>{t2.label}</button>
            )
          })}
        </div>
      </div>

      {tab === 'competencia' && <TabCompetencia competidores={competidores} insights={insights} onChange={cargar} />}
      {tab === 'manual' && <TabManual patrones={patrones} onChange={cargar} />}
      {tab === 'plan' && <TabPlan plan={plan} onChange={cargar} />}
      {tab === 'carta' && <TabCarta platos={platos} onChange={cargar} />}
      {tab === 'simulador' && <TabSimulador platos={platos} kpis={kpis} />}
    </PantallaCantera>
  )
}

/* ═════════════ helpers de UI ═════════════ */
function Estrellas({ n, color }: { n: number | null; color: string }) {
  const v = n ?? 0
  return <span style={{ color, letterSpacing: 1 }}>{'●'.repeat(v)}<span style={{ color: GRIS }}>{'●'.repeat(Math.max(0, 5 - v))}</span></span>
}

function Bloque({ label, texto }: { label: string; texto: string | null }) {
  if (!texto) return null
  return (
    <div>
      <div style={lblXsLocal}>{label}</div>
      <div style={{ fontFamily: LEX, fontSize: 13, color: INK, marginTop: 2, lineHeight: 1.4 }}>{texto}</div>
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

  if (competidores.length === 0) return <Papel ceja={GRIS}><div style={{ color: GRIS, fontFamily: LEX }}>Sin competidores cargados.</div></Papel>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mapa de amenaza × facilidad de copiar */}
      <div>
        <SeccionLabel bg={GRANATE}>Mapa estratégico · amenaza vs. facilidad de copiarles</SeccionLabel>
        <Papel ceja={GRANATE}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <button onClick={() => exportCSV('competidores.csv', competidores as unknown as Record<string, unknown>[])} style={btnGhost}>↓ CSV</button>
          </div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 10 }}>Arriba-derecha = prioridad máxima: nos amenazan y podemos copiarlos.</div>
          <MapaAmenaza competidores={competidores} />
        </Papel>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['todas', ...cats].map(c => {
          const on = catSel === c
          return <button key={c} onClick={() => setCatSel(c)} style={{ ...btnGhost, background: on ? GRANATE : BLANCO, color: on ? BLANCO : INK, boxShadow: on ? SHADOW_DURA : 'none' }}>{c === 'todas' ? 'Todas' : (CAT_LABEL[c] || c)}</button>
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
        {visibles.map(c => {
          const editando = editId === c.id
          return (
            <div key={c.id} style={{ flex: '1 1 340px', minWidth: 320 }}>
              <Papel ceja={c.es_benchmark ? GRANATE : VERDE} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontFamily: OSW, fontSize: 18, fontWeight: 700, color: INK }}>{c.nombre}</div>
                    <div style={{ ...lblXsLocal, marginTop: 2 }}>{CAT_LABEL[c.categoria] || c.categoria}{c.año_fundacion ? ` · desde ${c.año_fundacion}` : ''}</div>
                  </div>
                  <span style={{ fontFamily: OSW, fontSize: 10, letterSpacing: 0.5, fontWeight: 700, padding: '2px 8px', border: `2px solid ${INK}`, background: c.es_benchmark ? GRANATE : BLANCO, color: c.es_benchmark ? BLANCO : INK, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{c.es_benchmark ? 'Benchmark' : 'Eficiente'}</span>
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {c.facturacion && <div><div style={lblXsLocal}>Facturación</div><div style={{ fontFamily: OSW, fontSize: 16, fontWeight: 700, color: VERDE }}>{c.facturacion}</div></div>}
                  {c.ticket_medio && <div><div style={lblXsLocal}>Ticket</div><div style={{ fontFamily: OSW, fontSize: 16, fontWeight: 700, color: INK }}>{c.ticket_medio}</div></div>}
                </div>
                {c.canal_principal && <Bloque label="Canal principal" texto={c.canal_principal} />}

                <div style={{ display: 'flex', gap: 16 }}>
                  <div><div style={lblXsLocal}>Amenaza</div>{editando ? <input type="number" min={1} max={5} value={draft.amenaza ?? c.amenaza ?? ''} onChange={e => setDraft({ ...draft, amenaza: Number(e.target.value) })} style={{ ...inp, width: 56 }} /> : <Estrellas n={c.amenaza} color={ROJO} />}</div>
                  <div><div style={lblXsLocal}>Copiable</div>{editando ? <input type="number" min={1} max={5} value={draft.facilidad_copiar ?? c.facilidad_copiar ?? ''} onChange={e => setDraft({ ...draft, facilidad_copiar: Number(e.target.value) })} style={{ ...inp, width: 56 }} /> : <Estrellas n={c.facilidad_copiar} color={VERDE} />}</div>
                </div>

                <Bloque label="Qué venden" texto={c.que_venden} />
                <Bloque label="Cómo lo venden" texto={c.como_lo_venden} />
                <Bloque label="Por qué funciona" texto={c.por_que_funciona} />
                <Bloque label="Su debilidad" texto={c.su_debilidad} />

                <div style={{ background: AMA, border: `2px solid ${INK}`, padding: '10px 12px', marginTop: 2 }}>
                  <div style={{ ...lblXsLocal, color: INK, marginBottom: 3 }}>Nuestro atajo</div>
                  {editando
                    ? <textarea value={draft.nuestro_atajo ?? c.nuestro_atajo ?? ''} onChange={e => setDraft({ ...draft, nuestro_atajo: e.target.value })} style={{ ...inp, minHeight: 70, background: BLANCO }} />
                    : <div style={{ fontFamily: LEX, fontSize: 13, color: INK, lineHeight: 1.4 }}>{c.nuestro_atajo}</div>}
                </div>

                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {editando
                    ? <><button onClick={() => { setEditId(null); setDraft({}) }} style={btnMini}>Cancelar</button><button onClick={() => guardar(c.id)} style={btnPri}>Guardar</button></>
                    : <button onClick={() => { setEditId(c.id); setDraft({}) }} style={btnMini}>✎ Editar atajo / scores</button>}
                </div>
              </Papel>
            </div>
          )
        })}
      </div>

      {insights.length > 0 && (
        <div>
          <SeccionLabel bg={AZUL_LOCAL}>Insights del sector</SeccionLabel>
          <Papel ceja={AZUL_LOCAL}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insights.map(i => (
                <div key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: GRANATE, fontSize: 14, lineHeight: 1.3 }}>▸</span>
                  <div style={{ fontFamily: LEX, fontSize: 13, color: INK, lineHeight: 1.45 }}>{i.texto}{i.fuente && <span style={{ color: GRIS, fontSize: 11 }}> — {i.fuente}</span>}</div>
                </div>
              ))}
            </div>
          </Papel>
        </div>
      )}
    </div>
  )
}
const AZUL_LOCAL = '#2D5BFF'

function MapaAmenaza({ competidores }: { competidores: Competidor[] }) {
  const W = 720, H = 360, pad = 40
  const innerW = W - pad * 2, innerH = H - pad * 2
  const xAt = (v: number) => pad + ((v - 1) / 4) * innerW
  const yAt = (v: number) => pad + (1 - (v - 1) / 4) * innerH
  const pts = competidores.filter(c => c.amenaza && c.facilidad_copiar)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
      <rect x={xAt(3)} y={pad} width={innerW / 2} height={innerH / 2} fill={`${VERDE}12`} />
      {[1, 2, 3, 4, 5].map(t => (<g key={t}><line x1={xAt(t)} y1={pad} x2={xAt(t)} y2={H - pad} stroke={GRIS} strokeWidth={1} /><line x1={pad} y1={yAt(t)} x2={W - pad} y2={yAt(t)} stroke={GRIS} strokeWidth={1} /></g>))}
      <text x={W / 2} y={H - 8} textAnchor="middle" fontFamily="Oswald" fontSize={11} fill={GRIS} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Facilidad de copiarles →</text>
      <text x={14} y={H / 2} textAnchor="middle" fontFamily="Oswald" fontSize={11} fill={GRIS} transform={`rotate(-90 14 ${H / 2})`} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Amenaza →</text>
      {pts.map(c => {
        const x = xAt(c.facilidad_copiar!), y = yAt(c.amenaza!)
        const prioritario = c.amenaza! >= 3 && c.facilidad_copiar! >= 3
        return (
          <g key={c.id}>
            <circle cx={x} cy={y} r={prioritario ? 7 : 5} fill={prioritario ? GRANATE : AZUL_LOCAL} opacity={0.9} />
            <text x={x + 9} y={y + 4} fontFamily="Lexend" fontSize={11} fill={INK} fontWeight={prioritario ? 700 : 400}>{c.nombre}</text>
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
  if (patrones.length === 0) return <Papel ceja={GRIS}><div style={{ color: GRIS, fontFamily: LEX }}>Sin patrones cargados.</div></Papel>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: LEX, fontSize: 13, color: INK, lineHeight: 1.5 }}>
        Los 8 patrones que comparten <strong>todos</strong> los ganadores. Si cumplimos estos 8, jugamos su mismo juego. El bloque amarillo es editable: ahí anotamos cómo lo aterrizamos.
      </div>
      {patrones.map((p, i) => {
        const editando = editId === p.id
        return (
          <Papel key={p.id} ceja={GRANATE} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ fontFamily: OSW, fontSize: 30, fontWeight: 700, color: GRANATE, lineHeight: 1, minWidth: 38 }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: OSW, fontSize: 16, fontWeight: 700, color: INK }}>{p.titulo}</div>
              <div style={{ fontFamily: LEX, fontSize: 13, color: INK, marginTop: 4, lineHeight: 1.4 }}>{p.descripcion}</div>
              <div style={{ background: AMA, border: `2px solid ${INK}`, padding: '8px 12px', marginTop: 8 }}>
                <div style={{ ...lblXsLocal, color: INK, marginBottom: 3 }}>Cómo lo aplicamos</div>
                {editando
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <textarea value={draft} onChange={e => setDraft(e.target.value)} style={{ ...inp, minHeight: 60, background: BLANCO }} />
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}><button onClick={() => setEditId(null)} style={btnMini}>Cancelar</button><button onClick={() => guardar(p.id)} style={btnPri}>Guardar</button></div>
                    </div>
                  : <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontFamily: LEX, fontSize: 13, color: INK }}>{p.aplicacion_sl || '—'}</span>
                      <button onClick={() => { setEditId(p.id); setDraft(p.aplicacion_sl || '') }} style={{ ...btnMini, flexShrink: 0 }}>✎</button>
                    </div>}
              </div>
            </div>
          </Papel>
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

  if (plan.length === 0 && fases.length === 0) return <Papel ceja={GRIS}><div style={{ color: GRIS, fontFamily: LEX }}>Sin plan cargado.</div></Papel>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <SeccionLabel bg={AMA} color={INK}>Progreso global</SeccionLabel>
        <Papel ceja={AMA}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={lblXsLocal}>Acciones completadas</div>
            <div style={{ fontFamily: OSW, fontSize: 22, fontWeight: 700, color: pctGlobal >= 66 ? VERDE : pctGlobal >= 33 ? AMA : GRIS }}>{pctGlobal}%</div>
          </div>
          <div style={{ height: 10, background: BLANCO, border: `2px solid ${INK}` }}><div style={{ height: '100%', width: `${pctGlobal}%`, background: GRANATE }} /></div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 6 }}>{totalHechos} de {plan.length} acciones completadas</div>
        </Papel>
      </div>

      {fases.map(fase => {
        const items = plan.filter(p => p.fase === fase)
        const hechosF = items.filter(p => p.hecho).length
        const pct = items.length ? Math.round((hechosF / items.length) * 100) : 0
        return (
          <Papel key={fase} ceja={pct === 100 ? VERDE : NAR}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontFamily: OSW, fontSize: 15, fontWeight: 700, color: INK, textTransform: 'uppercase', letterSpacing: 1 }}>
                {fase} {items[0]?.semanas && <span style={{ color: GRIS, fontSize: 12, fontWeight: 400 }}>· semanas {items[0].semanas}</span>}
              </div>
              <span style={{ fontFamily: OSW, fontSize: 14, fontWeight: 700, color: pct === 100 ? VERDE : GRIS }}>{hechosF}/{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {items.map(it => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 8px' }}>
                  <button onClick={() => toggle(it)} disabled={guardando === it.id} style={{ width: 20, height: 20, borderRadius: 0, flexShrink: 0, marginTop: 1, cursor: 'pointer', border: `2px solid ${it.hecho ? VERDE : INK}`, background: it.hecho ? VERDE : BLANCO, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLANCO, fontSize: 13, fontWeight: 700, opacity: guardando === it.id ? 0.5 : 1 }}>{it.hecho ? '✓' : ''}</button>
                  <span style={{ flex: 1, fontFamily: LEX, fontSize: 13, color: it.hecho ? GRIS : INK, lineHeight: 1.4, textDecoration: it.hecho ? 'line-through' : 'none' }}>{it.accion}</span>
                  <button onClick={() => borrar(it.id)} style={{ ...btnMini, flexShrink: 0, color: ROJO }} title="Borrar">✕</button>
                </div>
              ))}
            </div>
          </Papel>
        )
      })}

      <div>
        <SeccionLabel bg={GRANATE}>Añadir acción</SeccionLabel>
        <Papel ceja={GRANATE}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={nuevaFase} onChange={e => setNuevaFase(e.target.value)} style={{ ...inp, width: 220 }}>
              {(fases.length ? fases : ['Fase 1 · Cimientos', 'Fase 2 · Recurrencia', 'Fase 3 · Escalar']).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input placeholder="Nueva acción..." value={nuevaAccion} onChange={e => setNuevaAccion(e.target.value)} onKeyDown={e => e.key === 'Enter' && añadir()} style={{ ...inp, flex: 1, minWidth: 200 }} />
            <button onClick={añadir} style={btnPri}>+ Añadir</button>
          </div>
        </Papel>
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
  if (platos.length === 0) return <Papel ceja={GRIS}><div style={{ color: GRIS, fontFamily: LEX }}>Sin platos cargados.</div></Papel>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 300px' }}>
          <Plancha>
            <StatCelda first bg={GRANATE} label="Propuestos" value={String(totalProp)} />
            <StatCelda bg={VERDE} label="En carta" value={String(totalEnCarta)} sub={`${totalProp ? Math.round((totalEnCarta / totalProp) * 100) : 0}% implantado`} />
          </Plancha>
        </div>
        <div style={{ flex: '2 1 340px', minWidth: 300 }}>
          <Papel ceja={GRANATE}>
            <div style={{ ...lblXsLocal, marginBottom: 8 }}>Margen neto medio por marca (tras comisión 30% + food cost)</div>
            <GraficoMargen platos={platos} />
          </Papel>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['todas', ...marcas].map(m => {
            const on = marcaSel === m
            return <button key={m} onClick={() => setMarcaSel(m)} style={{ ...btnGhost, background: on ? GRANATE : BLANCO, color: on ? BLANCO : INK, boxShadow: on ? SHADOW_DURA : 'none' }}>{m === 'todas' ? 'Todas' : (MARCA_LABEL[m] || m)}</button>
          })}
        </div>
        <button onClick={() => exportCSV('carta_maestra.csv', platos.map(p => ({ marca: p.marca, tipo: p.tipo, nombre: p.nombre, precio: p.precio, food_cost_pct: p.food_cost_pct, margen_neto: margenNeto(p.precio, p.food_cost_pct)?.toFixed(2), en_carta: p.en_carta })) as unknown as Record<string, unknown>[])} style={btnGhost}>↓ Exportar CSV</button>
      </div>

      {marcasMostrar.map(marca => {
        const dela = platos.filter(p => p.marca === marca)
        if (dela.length === 0) return null
        const enCartaM = dela.filter(p => p.en_carta).length
        const tipos = TIPO_ORDEN.filter(t => dela.some(p => p.tipo === t)).concat(Array.from(new Set(dela.map(p => p.tipo))).filter(t => !TIPO_ORDEN.includes(t)))
        return (
          <Papel key={marca} ceja={GRANATE}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: `2px solid ${INK}` }}>
              <div style={{ fontFamily: OSW, fontSize: 18, fontWeight: 700, color: GRANATE, textTransform: 'uppercase', letterSpacing: 1.5 }}>{MARCA_LABEL[marca] || marca}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontFamily: OSW, fontSize: 14, fontWeight: 700, color: enCartaM === dela.length ? VERDE : GRIS }}>{enCartaM}/{dela.length} en carta</span>
                <button onClick={() => añadirPlato(marca)} style={btnMini}>+ plato</button>
              </div>
            </div>
            {tipos.map(tipo => (
              <div key={tipo} style={{ marginBottom: 10 }}>
                <div style={{ ...lblXsLocal, marginBottom: 6 }}>{TIPO_LABEL[tipo] || tipo}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {dela.filter(p => p.tipo === tipo).map(p => {
                    const editando = editId === p.id
                    const mg = margenNeto(p.precio, p.food_cost_pct)
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 8, background: p.en_carta ? `${VERDE}14` : 'transparent' }}>
                        <button onClick={() => toggleCarta(p)} disabled={guardando === p.id} title={p.en_carta ? 'Quitar de carta' : 'Marcar en carta'} style={{ width: 20, height: 20, borderRadius: 0, flexShrink: 0, marginTop: 1, cursor: 'pointer', border: `2px solid ${p.en_carta ? VERDE : INK}`, background: p.en_carta ? VERDE : BLANCO, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLANCO, fontSize: 13, fontWeight: 700, opacity: guardando === p.id ? 0.5 : 1 }}>{p.en_carta ? '✓' : ''}</button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {editando ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <input value={draft.nombre ?? p.nombre} onChange={e => setDraft({ ...draft, nombre: e.target.value })} style={inp} />
                              <textarea value={draft.descripcion ?? p.descripcion ?? ''} onChange={e => setDraft({ ...draft, descripcion: e.target.value })} style={{ ...inp, minHeight: 44 }} />
                              <div style={{ display: 'flex', gap: 6 }}>
                                <div><div style={lblXsLocal}>Precio €</div><input type="number" step="0.1" value={draft.precio ?? p.precio ?? 0} onChange={e => setDraft({ ...draft, precio: Number(e.target.value) })} style={{ ...inp, width: 90 }} /></div>
                                <div><div style={lblXsLocal}>Food cost %</div><input type="number" step="1" value={draft.food_cost_pct ?? p.food_cost_pct ?? 0} onChange={e => setDraft({ ...draft, food_cost_pct: Number(e.target.value) })} style={{ ...inp, width: 90 }} /></div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}><button onClick={() => { setEditId(null); setDraft({}) }} style={btnMini}>Cancelar</button><button onClick={() => guardar(p.id)} style={btnPri}>Guardar</button></div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {p.es_heroe && <span title="Plato héroe" style={{ color: AMA, fontSize: 13 }}>★</span>}
                                <span style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 600, color: INK }}>{p.nombre}</span>
                              </div>
                              {p.descripcion && <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 1, lineHeight: 1.35 }}>{p.descripcion}</div>}
                              {mg != null && <div style={{ fontFamily: LEX, fontSize: 11, color: INK, marginTop: 2 }}>Margen neto ~{fmtEur(mg)} · FC {p.food_cost_pct}%</div>}
                            </>
                          )}
                        </div>
                        {!editando && <>
                          {p.precio != null && <div style={{ fontFamily: OSW, fontSize: 15, fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>{fmtEur(Number(p.precio))}</div>}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <button onClick={() => { setEditId(p.id); setDraft({}) }} style={btnMini}>✎</button>
                            <button onClick={() => borrar(p.id)} style={{ ...btnMini, color: ROJO }}>✕</button>
                          </div>
                        </>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </Papel>
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
          <span style={{ fontFamily: LEX, fontSize: 12, color: INK, width: 110, textAlign: 'right' }}>{MARCA_LABEL[d.marca] || d.marca}</span>
          <div style={{ flex: 1, height: 20, background: BLANCO, border: `2px solid ${INK}` }}>
            <div style={{ height: '100%', width: `${(d.avg / max) * 100}%`, background: GRANATE, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
              <span style={{ fontFamily: OSW, fontSize: 11, color: BLANCO, fontWeight: 700 }}>{fmtEur(d.avg)}</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Papel ceja={ROSA} style={{ background: INK, color: BLANCO }}>
        <div style={{ fontFamily: OSW, fontSize: 15, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>🚀 Simulador de lanzamiento</div>
        <div style={{ fontFamily: LEX, fontSize: 12.5, opacity: 0.85, marginTop: 3, lineHeight: 1.4 }}>Lo que ningún competidor puede hacer: cruzar la batería de platos con tu food cost y tu ticket real para decidir qué marca lanzar primero. Ajusta los pedidos/día y mira el margen.</div>
      </Papel>

      <div>
        <SeccionLabel bg={GRANATE}>Marca candidata y ritmo</SeccionLabel>
        <Papel ceja={GRANATE}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><div style={lblXsLocal}>Marca candidata</div>
              <select value={marca} onChange={e => setMarca(e.target.value)} style={{ ...inp, width: 200 }}>
                {marcas.map(m => <option key={m} value={m}>{MARCA_LABEL[m] || m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={lblXsLocal}>Pedidos / día estimados</span><span style={{ fontFamily: OSW, fontWeight: 700, color: GRANATE }}>{pedidosDia}</span></div>
              <input type="range" min={2} max={60} value={pedidosDia} onChange={e => setPedidosDia(Number(e.target.value))} style={{ width: '100%', accentColor: GRANATE }} />
            </div>
          </div>
        </Papel>
      </div>

      {/* KPIs proyectados */}
      <div>
        <SeccionLabel bg={AMA} color={INK}>Proyección mensual</SeccionLabel>
        <Plancha>
          <StatCelda first bg={INK} color={BLANCO} label="Ingreso / mes" value={fmtEur(ingresoMes)} sub={`ticket sim. ${fmtEur(ticketSim)}`} />
          <StatCelda bg={ROJO} label="Comisión plataforma" value={`−${fmtEur(comisionMes)}`} sub="30% estimado" />
          <StatCelda bg={NAR} label="Coste materia prima" value={`−${fmtEur(costeMPmes)}`} sub={`food cost ${met.fcMedio.toFixed(0)}%`} />
          <StatCelda bg={margenMes >= 0 ? VERDE : ROJO} label="Margen neto / mes" value={fmtEur(margenMes)} sub={`${margenPct.toFixed(0)}% sobre ingreso`} />
        </Plancha>
      </div>

      {met.heroe && (
        <Papel ceja={AMA} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: AMA, fontSize: 18 }}>★</span>
          <div><span style={{ fontFamily: LEX, fontSize: 13, color: INK }}>Plato héroe de esta marca: </span><span style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 700, color: INK }}>{met.heroe.nombre}</span><span style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}> — lánzalo como portada y construye toda la foto/copy a su alrededor.</span></div>
        </Papel>
      )}

      {/* Ranking: qué lanzar primero */}
      <div>
        <SeccionLabel bg={GRANATE}>¿Qué marca lanzar primero? · margen neto potencial a {pedidosDia} pedidos/día</SeccionLabel>
        <Papel ceja={GRANATE}>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 12 }}>Ordenado por margen mensual. La de arriba es la apuesta de mayor retorno con el mismo esfuerzo de cocina.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ranking.map((r, i) => (
              <div key={r.marca} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: OSW, fontSize: 16, fontWeight: 700, color: i === 0 ? GRANATE : GRIS, width: 22 }}>{i + 1}</span>
                <span style={{ fontFamily: LEX, fontSize: 13, color: INK, width: 110 }}>{MARCA_LABEL[r.marca] || r.marca}</span>
                <div style={{ flex: 1, height: 22, background: BLANCO, border: `2px solid ${INK}` }}>
                  <div style={{ height: '100%', width: `${(r.margenMes / maxMg) * 100}%`, background: i === 0 ? VERDE : AZUL_LOCAL, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 }}>
                    <span style={{ fontFamily: OSW, fontSize: 12, color: BLANCO, fontWeight: 700 }}>{fmtEur(r.margenMes)}</span>
                  </div>
                </div>
                <span style={{ fontFamily: LEX, fontSize: 11, color: GRIS, width: 70, textAlign: 'right' }}>FC {r.fc.toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 12px', background: AMA, border: `2px solid ${INK}` }}>
            <span style={{ ...lblXsLocal, color: INK }}>Recomendación · </span>
            <span style={{ fontFamily: LEX, fontSize: 13, color: INK }}>Lanza primero <strong>{MARCA_LABEL[ranking[0]?.marca] || ranking[0]?.marca}</strong>: mejor margen neto con el mismo esfuerzo de cocina. Test de 4 semanas como pop-up, mide repetición, y si funciona, escala.</span>
          </div>
        </Papel>
      </div>

      <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, lineHeight: 1.5 }}>
        Nota: estimación. Ticket de simulación = precio medio de la marca; food cost = media estimada de sus platos; comisión plataforma fija al 30%. No incluye costes fijos de cocina ni packaging. Ajusta los food cost reales en la pestaña Carta Maestra para afinar.
      </div>
    </div>
  )
}
