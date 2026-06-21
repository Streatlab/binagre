import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, CARDS, lbl, lblSm, kpiMid, TABS_PILL, SUBTABS } from '@/components/panel/resumen/tokens'
import { fmtEur } from '@/utils/format'

/* ═════════════ BENCHMARK & CARTA MAESTRA · MKT ═════════════
   Manual de competencia + patrones + plan 90 días + batería de platos.
   Datos en Supabase: mkt_benchmark_competidores / _patrones / _plan / _platos.
   Estilo canónico Panel Global (tokens, cards blancas, paleta SL).
*/

type Competidor = {
  id: number; categoria: string; nombre: string; es_benchmark: boolean
  facturacion: string | null; que_venden: string | null; como_lo_venden: string | null
  por_que_funciona: string | null; su_debilidad: string | null; nuestro_atajo: string | null; orden: number
}
type Patron = { id: number; titulo: string; descripcion: string; aplicacion_sl: string | null; orden: number }
type PlanItem = { id: number; fase: string; semanas: string | null; accion: string; hecho: boolean; orden: number }
type Plato = {
  id: number; marca: string; tipo: string; nombre: string; descripcion: string | null
  precio: number | null; es_heroe: boolean; en_carta: boolean; orden: number
}

const CAT_LABEL: Record<string, string> = {
  comida_casera: 'Comida Casera', binagre_premium: 'Binagre · Premium', ramen_katsu: 'Ramen & Katsu',
  pasta: 'Pasta Italiana', french_tacos: 'French Tacos', green: 'Green / Honest', transversal: 'Manual transversal',
}
const MARCA_LABEL: Record<string, string> = {
  comida_casera: 'Comida Casera', binagre: 'Binagre', ramen_katsu: 'Ramen & Katsu',
  pasta: 'Pasta', french_tacos: 'French Tacos', green: 'Green',
}
const MARCA_ORDEN = ['binagre', 'comida_casera', 'ramen_katsu', 'pasta', 'french_tacos', 'green']
const TIPO_LABEL: Record<string, string> = { heroe: 'Héroes', plato: 'Platos', combo: 'Combos', formato: 'Formatos' }
const TIPO_ORDEN = ['heroe', 'plato', 'combo', 'formato']

const TABS = [
  { id: 'competencia', label: 'Competencia' },
  { id: 'manual', label: 'El Manual' },
  { id: 'plan', label: 'Plan 90 días' },
  { id: 'carta', label: 'Carta Maestra' },
] as const

export default function Benchmark() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('competencia')
  const [competidores, setCompetidores] = useState<Competidor[]>([])
  const [patrones, setPatrones] = useState<Patron[]>([])
  const [plan, setPlan] = useState<PlanItem[]>([])
  const [platos, setPlatos] = useState<Plato[]>([])
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    setCargando(true)
    const [c, pa, pl, pt] = await Promise.all([
      supabase.from('mkt_benchmark_competidores').select('*').order('orden'),
      supabase.from('mkt_benchmark_patrones').select('*').order('orden'),
      supabase.from('mkt_benchmark_plan').select('*').order('orden'),
      supabase.from('mkt_benchmark_platos').select('*').order('orden'),
    ])
    setCompetidores((c.data as Competidor[]) || [])
    setPatrones((pa.data as Patron[]) || [])
    setPlan((pl.data as PlanItem[]) || [])
    setPlatos((pt.data as Plato[]) || [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: COLORS.redSL, letterSpacing: 3, textTransform: 'uppercase' }}>BENCHMARK & CARTA MAESTRA</div>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 2 }}>Cómo ganan los mejores · qué copiar · plan 90 días · batería de platos para implantar</div>
      </div>

      <div style={TABS_PILL.container}>
        {TABS.map(t2 => <button key={t2.id} onClick={() => setTab(t2.id)} style={tab === t2.id ? TABS_PILL.active : TABS_PILL.inactive}>{t2.label}</button>)}
      </div>

      {cargando ? (
        <div style={{ color: COLORS.mut, fontSize: 14, padding: 24 }}>Cargando benchmark...</div>
      ) : (
        <div style={{ marginTop: 14 }}>
          {tab === 'competencia' && <TabCompetencia competidores={competidores} />}
          {tab === 'manual' && <TabManual patrones={patrones} />}
          {tab === 'plan' && <TabPlan plan={plan} onChange={cargar} />}
          {tab === 'carta' && <TabCarta platos={platos} onChange={cargar} />}
        </div>
      )}
    </div>
  )
}

/* ═════════════ TAB 1 · COMPETENCIA ═════════════ */
function TabCompetencia({ competidores }: { competidores: Competidor[] }) {
  const cats = useMemo(() => Array.from(new Set(competidores.map(c => c.categoria))), [competidores])
  const [catSel, setCatSel] = useState<string>('todas')
  const visibles = catSel === 'todas' ? competidores : competidores.filter(c => c.categoria === catSel)

  if (competidores.length === 0) return <div style={{ ...CARDS.std, color: COLORS.mut }}>Sin competidores cargados.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => setCatSel('todas')} style={catSel === 'todas' ? SUBTABS.active : SUBTABS.inactive}>Todas</button>
        {cats.map(c => <button key={c} onClick={() => setCatSel(c)} style={catSel === c ? SUBTABS.active : SUBTABS.inactive}>{CAT_LABEL[c] || c}</button>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14, alignItems: 'start' }}>
        {visibles.map(c => (
          <div key={c.id} style={{ ...CARDS.std, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <div style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: COLORS.pri }}>{c.nombre}</div>
                <div style={{ ...lblSm, marginTop: 2 }}>{CAT_LABEL[c.categoria] || c.categoria}</div>
              </div>
              <span style={{
                fontFamily: FONT.heading, fontSize: 10, letterSpacing: 0.5, padding: '2px 8px', borderRadius: 4,
                background: c.es_benchmark ? COLORS.redSL : COLORS.group,
                color: c.es_benchmark ? '#fff' : COLORS.sec, whiteSpace: 'nowrap', textTransform: 'uppercase',
              }}>{c.es_benchmark ? 'Benchmark' : 'Eficiente'}</span>
            </div>

            {c.facturacion && (
              <div style={{ ...kpiMid, color: COLORS.ok }}>{c.facturacion}</div>
            )}

            <Bloque label="Qué venden" texto={c.que_venden} />
            <Bloque label="Cómo lo venden" texto={c.como_lo_venden} />
            <Bloque label="Por qué funciona" texto={c.por_que_funciona} />
            <Bloque label="Su debilidad" texto={c.su_debilidad} />

            {c.nuestro_atajo && (
              <div style={{ background: COLORS.glovo, borderRadius: 8, padding: '10px 12px', marginTop: 2 }}>
                <div style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.glovoText, fontWeight: 600 }}>Nuestro atajo</div>
                <div style={{ fontFamily: FONT.body, fontSize: 13, color: '#111', marginTop: 3, lineHeight: 1.4 }}>{c.nuestro_atajo}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
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

/* ═════════════ TAB 2 · EL MANUAL ═════════════ */
function TabManual({ patrones }: { patrones: Patron[] }) {
  if (patrones.length === 0) return <div style={{ ...CARDS.std, color: COLORS.mut }}>Sin patrones cargados.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...CARDS.std, color: COLORS.sec, fontSize: 13, lineHeight: 1.5 }}>
        Los 8 patrones que comparten <strong style={{ color: COLORS.pri }}>todos</strong> los ganadores. Si cumplimos estos 8, jugamos su mismo juego.
      </div>
      {patrones.map((p, i) => (
        <div key={p.id} style={{ ...CARDS.std, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 30, fontWeight: 600, color: COLORS.redSL, lineHeight: 1, minWidth: 38 }}>{i + 1}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: COLORS.pri }}>{p.titulo}</div>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, marginTop: 4, lineHeight: 1.4 }}>{p.descripcion}</div>
            {p.aplicacion_sl && (
              <div style={{ background: COLORS.glovo, borderRadius: 8, padding: '8px 12px', marginTop: 8 }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.glovoText, fontWeight: 600 }}>Cómo lo aplicamos · </span>
                <span style={{ fontFamily: FONT.body, fontSize: 13, color: '#111' }}>{p.aplicacion_sl}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═════════════ TAB 3 · PLAN 90 DÍAS ═════════════ */
function TabPlan({ plan, onChange }: { plan: PlanItem[]; onChange: () => void }) {
  const [guardando, setGuardando] = useState<number | null>(null)
  const fases = useMemo(() => Array.from(new Set(plan.map(p => p.fase))), [plan])

  const totalHechos = plan.filter(p => p.hecho).length
  const pctGlobal = plan.length ? Math.round((totalHechos / plan.length) * 100) : 0

  async function toggle(item: PlanItem) {
    setGuardando(item.id)
    const nuevo = !item.hecho
    const { error } = await supabase.from('mkt_benchmark_plan').update({ hecho: nuevo }).eq('id', item.id)
    setGuardando(null)
    if (!error) onChange()
  }

  if (plan.length === 0) return <div style={{ ...CARDS.std, color: COLORS.mut }}>Sin plan cargado.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={CARDS.std}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={lbl}>Progreso global</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: pctGlobal >= 66 ? COLORS.ok : pctGlobal >= 33 ? COLORS.warn : COLORS.sec }}>{pctGlobal}%</div>
        </div>
        <div style={{ height: 8, background: COLORS.group, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: 8, width: `${pctGlobal}%`, background: COLORS.redSL, borderRadius: 4 }} />
        </div>
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
                <button key={it.id} onClick={() => toggle(it)} disabled={guardando === it.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px', borderRadius: 8,
                    border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%',
                    opacity: guardando === it.id ? 0.5 : 1,
                  }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                    border: `1.5px solid ${it.hecho ? COLORS.ok : COLORS.brd}`,
                    background: it.hecho ? COLORS.ok : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 13, fontWeight: 700,
                  }}>{it.hecho ? '✓' : ''}</span>
                  <span style={{ fontFamily: FONT.body, fontSize: 13, color: it.hecho ? COLORS.mut : COLORS.sec, lineHeight: 1.4, textDecoration: it.hecho ? 'line-through' : 'none' }}>{it.accion}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ═════════════ TAB 4 · CARTA MAESTRA ═════════════ */
function TabCarta({ platos, onChange }: { platos: Plato[]; onChange: () => void }) {
  const [guardando, setGuardando] = useState<number | null>(null)
  const marcas = useMemo(() => {
    const set = Array.from(new Set(platos.map(p => p.marca)))
    return MARCA_ORDEN.filter(m => set.includes(m)).concat(set.filter(m => !MARCA_ORDEN.includes(m)))
  }, [platos])
  const [marcaSel, setMarcaSel] = useState<string>('todas')

  const totalProp = platos.length
  const totalEnCarta = platos.filter(p => p.en_carta).length

  async function toggle(p: Plato) {
    setGuardando(p.id)
    const { error } = await supabase.from('mkt_benchmark_platos').update({ en_carta: !p.en_carta }).eq('id', p.id)
    setGuardando(null)
    if (!error) onChange()
  }

  const marcasMostrar = marcaSel === 'todas' ? marcas : [marcaSel]

  if (platos.length === 0) return <div style={{ ...CARDS.std, color: COLORS.mut }}>Sin platos cargados.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...CARDS.std, flex: 1, minWidth: 160 }}>
          <div style={lbl}>Platos propuestos</div>
          <div style={{ ...kpiMid, marginTop: 6 }}>{totalProp}</div>
        </div>
        <div style={{ ...CARDS.std, flex: 1, minWidth: 160 }}>
          <div style={lbl}>Ya en carta</div>
          <div style={{ ...kpiMid, marginTop: 6, color: COLORS.ok }}>{totalEnCarta}</div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 2 }}>{totalProp ? Math.round((totalEnCarta / totalProp) * 100) : 0}% implantado</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => setMarcaSel('todas')} style={marcaSel === 'todas' ? SUBTABS.active : SUBTABS.inactive}>Todas</button>
        {marcas.map(m => <button key={m} onClick={() => setMarcaSel(m)} style={marcaSel === m ? SUBTABS.active : SUBTABS.inactive}>{MARCA_LABEL[m] || m}</button>)}
      </div>

      {marcasMostrar.map(marca => {
        const dela = platos.filter(p => p.marca === marca)
        if (dela.length === 0) return null
        const enCarta = dela.filter(p => p.en_carta).length
        const tipos = TIPO_ORDEN.filter(t => dela.some(p => p.tipo === t)).concat(
          Array.from(new Set(dela.map(p => p.tipo))).filter(t => !TIPO_ORDEN.includes(t))
        )
        return (
          <div key={marca} style={CARDS.std}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${COLORS.group}` }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: COLORS.redSL, textTransform: 'uppercase', letterSpacing: 1.5 }}>{MARCA_LABEL[marca] || marca}</div>
              <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: enCarta === dela.length ? COLORS.ok : COLORS.mut }}>{enCarta}/{dela.length} en carta</span>
            </div>

            {tipos.map(tipo => {
              const items = dela.filter(p => p.tipo === tipo)
              return (
                <div key={tipo} style={{ marginBottom: 10 }}>
                  <div style={{ ...lblSm, marginBottom: 6 }}>{TIPO_LABEL[tipo] || tipo}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {items.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 8px', borderRadius: 8, background: p.en_carta ? `${COLORS.ok}10` : 'transparent' }}>
                        <button onClick={() => toggle(p)} disabled={guardando === p.id} title={p.en_carta ? 'Quitar de carta' : 'Marcar en carta'}
                          style={{
                            width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1, cursor: 'pointer',
                            border: `1.5px solid ${p.en_carta ? COLORS.ok : COLORS.brd}`,
                            background: p.en_carta ? COLORS.ok : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 13, fontWeight: 700, opacity: guardando === p.id ? 0.5 : 1,
                          }}>{p.en_carta ? '✓' : ''}</button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {p.es_heroe && <span title="Plato héroe" style={{ color: COLORS.warn, fontSize: 13 }}>★</span>}
                            <span style={{ fontFamily: FONT.body, fontSize: 13.5, fontWeight: 600, color: COLORS.pri }}>{p.nombre}</span>
                          </div>
                          {p.descripcion && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 1, lineHeight: 1.35 }}>{p.descripcion}</div>}
                        </div>
                        {p.precio != null && <div style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, color: COLORS.pri, whiteSpace: 'nowrap' }}>{fmtEur(Number(p.precio))}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
