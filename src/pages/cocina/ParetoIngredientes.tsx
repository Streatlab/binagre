import { BLANCO, INK, GRANATE, NAR, VERDE, AMA, AZUL, OSW, LEX } from '@/styles/neobrutal'
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { COLORS, FONT, fmtDec } from '@/components/panel/resumen/tokens'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

/**
 * PARETO DE INGREDIENTES · Binagre ERP
 * ------------------------------------------------------------------
 * 100% datos reales (sin hardcode). Responde al 80/20 de cocina:
 * qué pocos ingredientes / categorías concentran el coste.
 *
 * Vistas:
 *   - Consumo real (compras) [Tanda F3]: gasto real de compra por partida en
 *     90 días — vista `v_escandallo_pareto_compras`, la MISMA que ya usa el
 *     cuadro de mando de Escandallo → Auto ("Dónde se va el dinero"). Es el
 *     pareto por gasto = precio × volumen comprado, no una estimación.
 *   - Recetario: peso de cada ingrediente en el coste del escandallo
 *     cargado (tabla recetas_lineas, importe por línea). Es el food-cost
 *     TEÓRICO de las recetas; crece según cargas recetas.
 *   - Catálogo: coste unitario estándar de cada ingrediente del maestro
 *     (tabla ingredientes). Para detectar artículos caros a negociar.
 *   - Categorías: coste por familia de ingrediente.
 *
 * Clasificación ABC: A ≤80% acumulado · B 80–95% · C >95%.
 * ------------------------------------------------------------------ */

interface LineaRow {
  ingrediente_nombre: string | null
  eur_total: number | null
}
interface IngRow {
  nombre: string | null
  categoria: string | null
  coste_neto_std: number | null
  precio_activo: number | null
  ultimo_precio: number | null
}
interface ComprasRow { item: string; gasto: number; pct: number; pct_acumulado: number }

type Vista = 'compras' | 'recetario' | 'catalogo' | 'categorias'
type Clase = 'A' | 'B' | 'C'

interface ParetoRow {
  key: string
  valor: number
  pct: number
  acumPct: number
  clase: Clase
  meta?: string
}

const CLASE_COLOR: Record<Clase, string> = { A: VERDE, B: AMA, C: GRANATE }
const CLASE_DESC: Record<Clase, string> = {
  A: 'Vitales — concentran hasta el 80%',
  B: 'Importantes — siguiente 15%',
  C: 'Cola larga — último 5%',
}

const VISTAS: Array<{ id: Vista; label: string }> = [
  { id: 'compras', label: 'Consumo real (compras)' },
  { id: 'recetario', label: 'En recetas' },
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'categorias', label: 'Categorías' },
]

function computePareto(items: { key: string; valor: number; meta?: string }[]): { rows: ParetoRow[]; total: number; nA: number } {
  const total = items.reduce((s, i) => s + i.valor, 0)
  const sorted = items.filter(i => i.valor > 0).sort((a, b) => b.valor - a.valor)
  let acum = 0
  const rows: ParetoRow[] = sorted.map(i => {
    const pct = total > 0 ? (i.valor / total) * 100 : 0
    acum += pct
    const clase: Clase = acum <= 80 ? 'A' : acum <= 95 ? 'B' : 'C'
    return { key: i.key, valor: i.valor, pct, acumPct: acum, clase, meta: i.meta }
  })
  return { rows, total, nA: rows.filter(r => r.clase === 'A').length }
}

const lbl: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500 }
const lblSm: React.CSSProperties = { ...lbl, fontSize: 11, letterSpacing: 1.5 }

function Pill({ active, color, children, onClick }: { active: boolean; color: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px',
      border: active ? 'none' : `0.5px solid ${COLORS.brd}`,
      background: active ? color : COLORS.card,
      color: active ? BLANCO : COLORS.sec,
      fontFamily: FONT.body, fontSize: 12, fontWeight: 500, cursor: 'pointer',
    }}>{children}</button>
  )
}

export default function ParetoIngredientes() {
  const [lineas, setLineas] = useState<LineaRow[]>([])
  const [ings, setIngs] = useState<IngRow[]>([])
  const [compras, setCompras] = useState<ComprasRow[]>([])
  const [loading, setLoading] = useState(true)

  const [vista, setVista] = useState<Vista>('compras')
  const [catSel, setCatSel] = useState<string>('__todas')
  const [excluirEps, setExcluirEps] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: l }, { data: i }, { data: c }] = await Promise.all([
      supabase.from('recetas_lineas').select('ingrediente_nombre,eur_total'),
      supabase.from('ingredientes').select('nombre,categoria,coste_neto_std,precio_activo,ultimo_precio').eq('activo', true),
      supabase.from('v_escandallo_pareto_compras').select('item,gasto,pct,pct_acumulado').limit(200),
    ])
    setLineas((l as LineaRow[]) ?? [])
    setIngs((i as IngRow[]) ?? [])
    setCompras((c as ComprasRow[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const costeIng = (r: IngRow) => Number(r.coste_neto_std || r.precio_activo || r.ultimo_precio || 0)
  const esEps = (c: string | null) => (c ?? '').toUpperCase() === 'EPS'

  const categorias = useMemo(() => {
    const s = new Set<string>()
    ings.forEach(r => { if (r.categoria) s.add(r.categoria) })
    return [...s].sort()
  }, [ings])

  const { rows, total, nA, unidad } = useMemo(() => {
    if (vista === 'compras') {
      // Tanda F3: consumo real (gasto de compra por partida, 90 días) — v_escandallo_pareto_compras,
      // la misma vista que ya usa el cuadro de mando de Escandallo → Auto ("Dónde se va el dinero").
      const rowsC: ParetoRow[] = compras.map(c => ({
        key: c.item,
        valor: Number(c.gasto || 0),
        pct: Number(c.pct || 0),
        acumPct: Number(c.pct_acumulado || 0),
        clase: (c.pct_acumulado <= 80 ? 'A' : c.pct_acumulado <= 95 ? 'B' : 'C') as Clase,
      }))
      const totalC = compras.reduce((s, c) => s + Number(c.gasto || 0), 0)
      return { rows: rowsC, total: totalC, nA: rowsC.filter(r => r.clase === 'A').length, unidad: '€' as const }
    }
    if (vista === 'recetario') {
      const agg = new Map<string, number>()
      for (const l of lineas) {
        const k = (l.ingrediente_nombre || '(sin nombre)').trim()
        agg.set(k, (agg.get(k) ?? 0) + Number(l.eur_total || 0))
      }
      const r = computePareto([...agg.entries()].map(([key, valor]) => ({ key, valor })))
      return { ...r, unidad: '€' as const }
    }
    if (vista === 'catalogo') {
      const items = ings
        .filter(r => (catSel === '__todas' ? (excluirEps ? !esEps(r.categoria) : true) : r.categoria === catSel))
        .map(r => ({ key: (r.nombre || '(sin nombre)').trim(), valor: costeIng(r), meta: r.categoria ?? '' }))
      const r = computePareto(items)
      return { ...r, unidad: '€' as const }
    }
    // categorias
    const agg = new Map<string, number>()
    for (const r of ings) {
      const k = r.categoria || '(sin categoría)'
      agg.set(k, (agg.get(k) ?? 0) + costeIng(r))
    }
    const r = computePareto([...agg.entries()].map(([key, valor]) => ({ key, valor })))
    return { ...r, unidad: '€' as const }
  }, [vista, lineas, ings, compras, catSel, excluirEps])

  const chartData = useMemo(
    () => rows.slice(0, 20).map(r => ({ name: r.key, valor: r.valor, acum: Number(r.acumPct.toFixed(1)), clase: r.clase })),
    [rows],
  )

  if (loading) return <div style={{ padding: 32, color: COLORS.sec, fontFamily: FONT.body }}>Cargando escandallo…</div>

  const tituloMetrica = vista === 'compras' ? 'Gasto real (90 días)' : vista === 'recetario' ? 'Coste en recetas' : vista === 'catalogo' ? 'Coste unitario' : 'Coste por categoría'
  const notaVista =
    vista === 'compras'
      ? `Gasto real de compra por partida en los últimos 90 días (misma fuente que "Dónde se va el dinero" en Escandallo → Auto): precio × volumen comprado, no una estimación teórica.`
      : vista === 'recetario'
        ? `Suma del coste de cada ingrediente en las recetas cargadas (food cost teórico, no gasto real de compra — para eso usa "Consumo real (compras)").`
        : vista === 'catalogo'
          ? `Coste unitario estándar del maestro de ingredientes (no gasto total). ${excluirEps && catSel === '__todas' ? 'EPS excluidas para no duplicar sub-recetas.' : ''}`
          : `Coste agregado por familia de ingrediente del maestro.`

  const pctA = rows.length ? (nA / rows.length) * 100 : 0

  return (
    <PantallaCantera embedded>
      {/* HÉROE (naranja · área Cocina) */}
      <HeroCantera
        area="cocina"
        titular={rows.length > 2 ? `${nA} de ${rows.length} ${vista === 'categorias' ? 'categorías' : 'ingredientes'} concentran el 80% del coste.` : 'Pocos datos todavía para sacar el 80/20.'}
        etiquetaDato={tituloMetrica}
        cifra={fmtEur(total)}
        resumen={<>{rows.length} {vista === 'categorias' ? 'categorías' : 'ingredientes'} · {tituloMetrica.toLowerCase()} · regla 80/20 sobre datos reales</>}
        atencion={[
          rows[0] ? `Líder: ${rows[0].key} · ${fmtDec(rows[0].pct, 0)}%` : null,
          `${rows.filter(r => r.clase === 'C').length} en cola larga (C)`,
        ].filter(Boolean) as string[]}
      />

      {/* Vista */}
      <TabsPastilla tabs={VISTAS} activeId={vista} onChange={id => setVista(id as Vista)} />

      {/* Filtros catálogo */}
      {vista === 'catalogo' && (
        <Papel ceja={NAR} style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ ...lblSm, marginBottom: 8 }}>Categoría</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 720 }}>
              <Pill active={catSel === '__todas'} color={NAR} onClick={() => setCatSel('__todas')}>Todas</Pill>
              {categorias.map(c => (
                <Pill key={c} active={catSel === c} color={NAR} onClick={() => setCatSel(c)}>{c}</Pill>
              ))}
            </div>
          </div>
          {catSel === '__todas' && (
            <div>
              <div style={{ ...lblSm, marginBottom: 8 }}>Sub-recetas</div>
              <Pill active={excluirEps} color={AZUL} onClick={() => setExcluirEps(e => !e)}>
                {excluirEps ? 'EPS excluidas' : 'EPS incluidas'}
              </Pill>
            </div>
          )}
        </Papel>
      )}

      {/* Nota metodología */}
      <Papel ceja={AMA} style={{ fontFamily: LEX, fontSize: 12.5, fontWeight: 600, color: INK, lineHeight: 1.5 }}>
        {notaVista}
      </Papel>

      {/* PLANCHA DE KPIs: sólidos pegados */}
      <div>
        <SeccionLabel bg={GRANATE}>KPIs del Pareto</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={NAR} color={BLANCO} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>{tituloMetrica}</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(total)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{rows.length} {vista === 'categorias' ? 'categorías' : 'ingredientes'}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={VERDE} color={BLANCO}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Hacen el 80%</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{nA} de {rows.length}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{rows.length ? `${fmtDec(pctA, 0)}% del total` : '—'}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={AZUL} color={BLANCO}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Líder</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{rows[0] ? `${fmtDec(rows[0].pct, 0)}%` : '—'}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rows[0]?.key ?? '—'}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={GRANATE} color={BLANCO}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Cola larga (C)</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{rows.filter(r => r.clase === 'C').length}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>aportan solo el último 5%</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* FRASE POTENTE (color por significado, distinto del héroe naranja) */}
      {rows.length > 2 && (
        <FrasePotente significado="oportunidad">
          {nA} de {rows.length} {vista === 'categorias' ? 'categorías' : 'ingredientes'} ({fmtDec(pctA, 0)}%) concentran el 80% del coste. Ahí está el margen real: negocia precio, busca proveedor alternativo o ajusta gramaje en esos pocos.
        </FrasePotente>
      )}

      {/* Gráfico Pareto */}
      <Papel ceja={NAR}>
        <div style={{ ...lblSm, marginBottom: 4 }}>
          Curva de Pareto {rows.length > 20 ? '· top 20' : ''} — barras = coste, línea = % acumulado
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData} margin={{ top: 16, right: 16, bottom: 100, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.group} />
            <XAxis dataKey="name" interval={0} angle={-40} textAnchor="end" height={100}
              tick={{ fontFamily: FONT.body, fontSize: 10, fill: COLORS.sec }} />
            <YAxis yAxisId="left" tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.sec }} tickFormatter={(v: number) => `${fmtDec(v, 0)}€`} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.sec }} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip content={<PTooltip />} />
            <ReferenceLine yAxisId="right" y={80} stroke={GRANATE} strokeDasharray="4 4" label={{ value: '80%', position: 'right', fontSize: 10, fill: GRANATE }} />
            <Bar yAxisId="left" dataKey="valor" radius={[0, 0, 0, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={CLASE_COLOR[d.clase]} />)}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="acum" stroke={GRANATE} strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
          {(['A', 'B', 'C'] as Clase[]).map(c => (
            <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONT.body, fontSize: 11, color: COLORS.sec }}>
              <span style={{ width: 10, height: 10, background: CLASE_COLOR[c] }} /> {c} · {CLASE_DESC[c]}
            </span>
          ))}
        </div>
      </Papel>

      {/* Tabla ABC */}
      <Papel ceja={GRANATE}>
        <div style={{ ...lblSm, marginBottom: 10 }}>Clasificación ABC completa</div>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1.8fr 100px 70px 120px 56px', gap: 8, padding: '6px 8px', borderBottom: `0.5px solid ${COLORS.brd}` }}>
          {['#', vista === 'categorias' ? 'Categoría' : 'Ingrediente', 'Coste', '%', 'Acum %', 'Clase'].map((h, i) => (
            <span key={i} style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: COLORS.mut, textAlign: i >= 2 && i <= 4 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          {rows.map((r, i) => (
            <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '28px 1.8fr 100px 70px 120px 56px', gap: 8, padding: '6px 8px', borderBottom: `0.5px solid ${COLORS.group}`, alignItems: 'center' }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 12, color: COLORS.mut, textAlign: 'right' }}>{i + 1}</span>
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.pri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.key}{r.meta ? <span style={{ color: COLORS.mut }}> · {r.meta}</span> : ''}
              </span>
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.pri, fontWeight: 600, textAlign: 'right' }}>{fmtEur(r.valor)}</span>
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.sec, textAlign: 'right' }}>{fmtDec(r.pct)}%</span>
              <span style={{ position: 'relative', textAlign: 'right', fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>
                <span style={{ position: 'absolute', inset: 0, width: `${Math.min(100, r.acumPct)}%`, background: `${CLASE_COLOR[r.clase]}22` }} />
                <span style={{ position: 'relative' }}>{fmtDec(r.acumPct)}%</span>
              </span>
              <span style={{ justifySelf: 'start' }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, color: BLANCO, background: CLASE_COLOR[r.clase], padding: '1px 8px' }}>{r.clase}</span>
              </span>
            </div>
          ))}
          {!rows.length && <div style={{ padding: 16, color: COLORS.mut, fontFamily: FONT.body, fontSize: 13 }}>Sin datos para esta vista.</div>}
        </div>
      </Papel>
    </PantallaCantera>
  )
}

function PTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; valor: number; acum: number; clase: Clase } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: BLANCO, border: `0.5px solid ${COLORS.brd}`, borderRadius: 0, padding: '8px 12px', fontFamily: FONT.body, fontSize: 12 }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 13, marginBottom: 2 }}>{d.name}</div>
      <div>{fmtEur(d.valor)}</div>
      <div>Acumulado: {fmtDec(d.acum)}%</div>
      <div style={{ color: CLASE_COLOR[d.clase], fontWeight: 600 }}>Clase {d.clase}</div>
    </div>
  )
}
