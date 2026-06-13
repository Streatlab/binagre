import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { COLORS, FONT, CARDS, fmtDec } from '@/components/panel/resumen/tokens'
import TabsPastilla from '@/components/ui/TabsPastilla'

/**
 * PARETO DE INGREDIENTES · Binagre ERP
 * ------------------------------------------------------------------
 * 100% datos reales (sin hardcode). Responde al 80/20 de cocina:
 * qué pocos ingredientes / categorías concentran el coste.
 *
 * Vistas:
 *   - Recetario: peso de cada ingrediente en el coste del escandallo
 *     cargado (tabla recetas_lineas, importe por línea). Es el food-cost
 *     real de las recetas; crece según cargas recetas.
 *   - Catálogo: coste unitario estándar de cada ingrediente del maestro
 *     (tabla ingredientes). Para detectar artículos caros a negociar.
 *   - Categorías: coste por familia de ingrediente.
 *
 * Clasificación ABC: A ≤80% acumulado · B 80–95% · C >95%.
 * Nota: aún no hay consumo real por ventas, así que el Pareto pondera
 * coste de receta / coste unitario, no gasto = precio × volumen comprado.
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

type Vista = 'recetario' | 'catalogo' | 'categorias'
type Clase = 'A' | 'B' | 'C'

interface ParetoRow {
  key: string
  valor: number
  pct: number
  acumPct: number
  clase: Clase
  meta?: string
}

const CLASE_COLOR: Record<Clase, string> = { A: COLORS.ok, B: COLORS.warn, C: COLORS.err }
const CLASE_DESC: Record<Clase, string> = {
  A: 'Vitales — concentran hasta el 80%',
  B: 'Importantes — siguiente 15%',
  C: 'Cola larga — último 5%',
}

const VISTAS: Array<{ id: Vista; label: string }> = [
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

const cardBig = CARDS.big
const card = CARDS.std
const lbl: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500 }
const lblSm: React.CSSProperties = { ...lbl, fontSize: 11, letterSpacing: 1.5 }

function Pill({ active, color, children, onClick }: { active: boolean; color: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 7,
      border: active ? 'none' : `0.5px solid ${COLORS.brd}`,
      background: active ? color : COLORS.card,
      color: active ? '#fff' : COLORS.sec,
      fontFamily: FONT.body, fontSize: 12, fontWeight: 500, cursor: 'pointer',
    }}>{children}</button>
  )
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 160 }}>
      <div style={lblSm}>{label}</div>
      <div style={{ fontFamily: FONT.heading, fontSize: 30, fontWeight: 600, color: COLORS.pri, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function ParetoIngredientes() {
  const [lineas, setLineas] = useState<LineaRow[]>([])
  const [ings, setIngs] = useState<IngRow[]>([])
  const [loading, setLoading] = useState(true)

  const [vista, setVista] = useState<Vista>('recetario')
  const [catSel, setCatSel] = useState<string>('__todas')
  const [excluirEps, setExcluirEps] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: l }, { data: i }] = await Promise.all([
      supabase.from('recetas_lineas').select('ingrediente_nombre,eur_total'),
      supabase.from('ingredientes').select('nombre,categoria,coste_neto_std,precio_activo,ultimo_precio').eq('activo', true),
    ])
    setLineas((l as LineaRow[]) ?? [])
    setIngs((i as IngRow[]) ?? [])
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
  }, [vista, lineas, ings, catSel, excluirEps])

  const chartData = useMemo(
    () => rows.slice(0, 20).map(r => ({ name: r.key, valor: r.valor, acum: Number(r.acumPct.toFixed(1)), clase: r.clase })),
    [rows],
  )

  if (loading) return <div style={{ padding: 32, color: COLORS.sec, fontFamily: FONT.body }}>Cargando escandallo…</div>

  const tituloMetrica = vista === 'recetario' ? 'Coste en recetas' : vista === 'catalogo' ? 'Coste unitario' : 'Coste por categoría'
  const notaVista =
    vista === 'recetario'
      ? `Suma del coste de cada ingrediente en las recetas cargadas. No ponderado por ventas todavía.`
      : vista === 'catalogo'
        ? `Coste unitario estándar del maestro de ingredientes (no gasto total). ${excluirEps && catSel === '__todas' ? 'EPS excluidas para no duplicar sub-recetas.' : ''}`
        : `Coste agregado por familia de ingrediente del maestro.`

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: COLORS.redSL, letterSpacing: 3, textTransform: 'uppercase' }}>
          PARETO DE INGREDIENTES
        </div>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 2 }}>
          {rows.length} {vista === 'categorias' ? 'categorías' : 'ingredientes'} · {tituloMetrica.toLowerCase()} · regla 80/20 sobre datos reales
        </div>
      </div>

      {/* Vista */}
      <div style={{ marginBottom: 14 }}>
        <TabsPastilla tabs={VISTAS} activeId={vista} onChange={id => setVista(id as Vista)} />
      </div>

      {/* Filtros catálogo */}
      {vista === 'catalogo' && (
        <div style={{ ...card, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ ...lblSm, marginBottom: 8 }}>Categoría</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 720 }}>
              <Pill active={catSel === '__todas'} color={COLORS.accent} onClick={() => setCatSel('__todas')}>Todas</Pill>
              {categorias.map(c => (
                <Pill key={c} active={catSel === c} color={COLORS.accent} onClick={() => setCatSel(c)}>{c}</Pill>
              ))}
            </div>
          </div>
          {catSel === '__todas' && (
            <div>
              <div style={{ ...lblSm, marginBottom: 8 }}>Sub-recetas</div>
              <Pill active={excluirEps} color={COLORS.sec} onClick={() => setExcluirEps(e => !e)}>
                {excluirEps ? 'EPS excluidas' : 'EPS incluidas'}
              </Pill>
            </div>
          )}
        </div>
      )}

      {/* Nota metodología */}
      <div style={{ background: '#fff8e6', border: `0.5px solid ${COLORS.warn}`, borderRadius: 10, padding: '8px 14px', fontFamily: FONT.body, fontSize: 12, color: '#8a6d1f', marginBottom: 14 }}>
        {notaVista}
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <KpiCard label={tituloMetrica} value={fmtEur(total)} sub={`${rows.length} ${vista === 'categorias' ? 'categorías' : 'ingredientes'}`} />
        <KpiCard label="Hacen el 80%" value={`${nA} de ${rows.length}`} sub={rows.length ? `${fmtDec((nA / rows.length) * 100, 0)}% del total` : '—'} />
        <KpiCard label="Líder" value={rows[0] ? `${fmtDec(rows[0].pct, 0)}%` : '—'} sub={rows[0]?.key} />
        <KpiCard label="Cola larga (C)" value={`${rows.filter(r => r.clase === 'C').length}`} sub="aportan solo el último 5%" />
      </div>

      {/* Insight */}
      {rows.length > 2 && (
        <div style={{ ...card, marginBottom: 14, borderLeft: `3px solid ${COLORS.redSL}` }}>
          <span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.pri }}>
            <strong>{nA}</strong> de <strong>{rows.length}</strong> {vista === 'categorias' ? 'categorías' : 'ingredientes'} ({fmtDec((nA / rows.length) * 100, 0)}%) concentran el <strong>80%</strong> del coste. Ahí está el margen real: negocia precio, busca proveedor alternativo o ajusta gramaje en esos pocos.
          </span>
        </div>
      )}

      {/* Gráfico Pareto */}
      <div style={{ ...cardBig, marginBottom: 14 }}>
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
            <ReferenceLine yAxisId="right" y={80} stroke={COLORS.redSL} strokeDasharray="4 4" label={{ value: '80%', position: 'right', fontSize: 10, fill: COLORS.redSL }} />
            <Bar yAxisId="left" dataKey="valor" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={CLASE_COLOR[d.clase]} />)}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="acum" stroke={COLORS.redSL} strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
          {(['A', 'B', 'C'] as Clase[]).map(c => (
            <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONT.body, fontSize: 11, color: COLORS.sec }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: CLASE_COLOR[c] }} /> {c} · {CLASE_DESC[c]}
            </span>
          ))}
        </div>
      </div>

      {/* Tabla ABC */}
      <div style={card}>
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
                <span style={{ position: 'absolute', inset: 0, width: `${Math.min(100, r.acumPct)}%`, background: `${CLASE_COLOR[r.clase]}22`, borderRadius: 3 }} />
                <span style={{ position: 'relative' }}>{fmtDec(r.acumPct)}%</span>
              </span>
              <span style={{ justifySelf: 'start' }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, color: '#fff', background: CLASE_COLOR[r.clase], borderRadius: 4, padding: '1px 8px' }}>{r.clase}</span>
              </span>
            </div>
          ))}
          {!rows.length && <div style={{ padding: 16, color: COLORS.mut, fontFamily: FONT.body, fontSize: 13 }}>Sin datos para esta vista.</div>}
        </div>
      </div>
    </div>
  )
}

function PTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; valor: number; acum: number; clase: Clase } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#fff', border: `0.5px solid ${COLORS.brd}`, borderRadius: 8, padding: '8px 12px', fontFamily: FONT.body, fontSize: 12 }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 13, marginBottom: 2 }}>{d.name}</div>
      <div>{fmtEur(d.valor)}</div>
      <div>Acumulado: {fmtDec(d.acum)}%</div>
      <div style={{ color: CLASE_COLOR[d.clase], fontWeight: 600 }}>Clase {d.clase}</div>
    </div>
  )
}
