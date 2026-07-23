import { BLANCO, GRIS, OSW, LEX, INK, CREMA, VERDE, GRANATE, NAR, CORP } from '@/styles/neobrutal'
import { PARETO_WARN_BG, PARETO_WARN_TXT } from '@/styles/palettes'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { fmtDec } from '@/components/panel/resumen/tokens'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { normPlato } from '@/utils/normPlato'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'

/** Sin receta madre resuelta (ni por mapeo_plato_receta ni por fallback de nombre) —
 *  se agrupan aparte en vez de mostrar el nombre crudo de plataforma (Tanda 8). */
const SIN_VINCULAR = 'Sin vincular'

/**
 * PARETO DE VENTAS · Binagre ERP · CANTERA ALEGRE v1.0 (área Ventas · verde)
 * ------------------------------------------------------------------
 * 100% datos reales de la tabla `ventas_plato` (sin hardcode).
 * Responde a la pregunta 80/20: qué pocos productos / marcas / canales
 * concentran la mayor parte de la facturación.
 *
 * Dimensiones:
 *   - Producto (global): ranking por nombre madre (recetas.nombre vía
 *     mapeo_plato_receta, normPlato solo de último recurso — Tanda 8). Las
 *     variantes de plataforma ("…+ bebida", tamaños, nombres comerciales) se
 *     agregan bajo su receta madre; lo sin vincular se agrupa aparte con
 *     acceso directo al enlace asistido (Coste por plato).
 *   - Marca: desglose por marca (se llena solo cuando la importación
 *     etiqueta marca por plato; hoy la mayoría entra como "Streat Lab").
 *   - Canal: concentración por plataforma.
 *
 * Métrica conmutable: ingresos € o unidades.
 * Clasificación ABC: A ≤80% acumulado · B 80–95% · C >95%.
 * Solo capa visual (Cantera Alegre); datos/hooks/cálculos sin tocar.
 * ------------------------------------------------------------------ */

interface VentaRow {
  plato: string
  canal: string
  marca: string
  mes: number
  unidades: number
  ingresos_brutos: number | null
  estimado: boolean
}
interface MapeoRow {
  plato_muestra: string | null
  receta_id: string | null
}
interface RecetaLite {
  id: string
  nombre: string
}

type Dim = 'plato' | 'marca' | 'canal'
type Metrica = 'eur' | 'uds'
type Clase = 'A' | 'B' | 'C'

interface ParetoRow {
  key: string
  valor: number
  pct: number
  acumPct: number
  clase: Clase
  variantes?: number  // nº de nombres crudos de plataforma agregados bajo el nombre madre (dim=plato)
}

const CLASE_COLOR: Record<Clase, string> = { A: VERDE, B: NAR, C: GRANATE }
const CLASE_DESC: Record<Clase, string> = {
  A: 'Vitales — concentran hasta el 80%',
  B: 'Importantes — siguiente 15%',
  C: 'Cola larga — último 5%',
}

const CANAL_LABEL: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat', web: 'Web', dir: 'Directa', directa: 'Directa',
}
const CANAL_CORP_KEY: Record<string, string> = {
  uber: 'uber', glovo: 'glovo', je: 'je', web: 'web', dir: 'dir', directa: 'dir',
}

const MES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const DIMS: Array<{ id: Dim; label: string }> = [
  { id: 'plato', label: 'Producto (global)' },
  { id: 'marca', label: 'Marca' },
  { id: 'canal', label: 'Canal' },
]

function computePareto(items: { key: string; valor: number; variantes?: number }[]): { rows: ParetoRow[]; total: number; nA: number } {
  const total = items.reduce((s, i) => s + i.valor, 0)
  const sorted = items.filter(i => i.valor > 0).sort((a, b) => b.valor - a.valor)
  let acum = 0
  const rows: ParetoRow[] = sorted.map(i => {
    const pct = total > 0 ? (i.valor / total) * 100 : 0
    acum += pct
    const clase: Clase = acum <= 80 ? 'A' : acum <= 95 ? 'B' : 'C'
    return { key: i.key, valor: i.valor, pct, acumPct: acum, clase, variantes: i.variantes }
  })
  return { rows, total, nA: rows.filter(r => r.clase === 'A').length }
}

function Pill({ active, color, children, onClick }: { active: boolean; color: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 0,
      border: `2px solid ${INK}`,
      background: active ? color : BLANCO,
      color: active ? BLANCO : INK,
      boxShadow: active ? SHADOW_DURA : 'none',
      fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer',
    }}>{children}</button>
  )
}

export default function ParetoVentas() {
  const navigate = useNavigate()
  const [ventas, setVentas] = useState<VentaRow[]>([])
  const [mapeo, setMapeo] = useState<MapeoRow[]>([])
  const [recetas, setRecetas] = useState<RecetaLite[]>([])
  const [loading, setLoading] = useState(true)

  const [dim, setDim] = useState<Dim>('plato')
  const [metrica, setMetrica] = useState<Metrica>('eur')
  const [mesSel, setMesSel] = useState<number | 'todos'>('todos')

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: v }, { data: m }, { data: r }] = await Promise.all([
      supabase.from('ventas_plato').select('plato,canal,marca,mes,unidades,ingresos_brutos,estimado'),
      supabase.from('mapeo_plato_receta').select('plato_muestra,receta_id'),
      supabase.from('recetas').select('id,nombre'),
    ])
    setVentas((v as VentaRow[]) ?? [])
    setMapeo((m as MapeoRow[]) ?? [])
    setRecetas((r as RecetaLite[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  /* ── Resolución nombre madre (Tanda 8, mismo criterio que v_margen_plato /
   *  Menú Engineering): mapeo_plato_receta primero, normPlato solo de último recurso. ── */
  const mapaEnlace = useMemo(() => {
    const m = new Map<string, string>()
    for (const row of mapeo) if (row.plato_muestra && row.receta_id) m.set(row.plato_muestra, row.receta_id)
    return m
  }, [mapeo])
  const nombrePorId = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of recetas) m.set(r.id, r.nombre)
    return m
  }, [recetas])
  const recetaPorNombreNorm = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of recetas) m.set(normPlato(r.nombre), r.id)
    return m
  }, [recetas])
  const nombreMadre = useCallback((platoCrudo: string): string => {
    const recetaId = mapaEnlace.get(platoCrudo) ?? recetaPorNombreNorm.get(normPlato(platoCrudo))
    return recetaId ? (nombrePorId.get(recetaId) ?? SIN_VINCULAR) : SIN_VINCULAR
  }, [mapaEnlace, recetaPorNombreNorm, nombrePorId])

  const mesesDisp = useMemo(() => {
    const s = new Set<number>()
    ventas.forEach(v => s.add(v.mes))
    return [...s].sort((a, b) => a - b)
  }, [ventas])

  const filtradas = useMemo(
    () => ventas.filter(v => mesSel === 'todos' || v.mes === mesSel),
    [ventas, mesSel],
  )

  const hayEstimados = useMemo(() => filtradas.some(v => v.estimado), [filtradas])

  const { rows, total, nA } = useMemo(() => {
    const agg = new Map<string, number>()
    const variantesPorKey = new Map<string, Set<string>>()
    for (const v of filtradas) {
      let key: string
      if (dim === 'plato') {
        key = v.plato ? nombreMadre(v.plato) : '(sin nombre)'
        if (key !== SIN_VINCULAR && v.plato) {
          const s = variantesPorKey.get(key) ?? new Set<string>()
          s.add(v.plato)
          variantesPorKey.set(key, s)
        }
      }
      else if (dim === 'marca') key = v.marca || '(sin marca)'
      else key = CANAL_LABEL[v.canal] ?? v.canal ?? '(sin canal)'
      const valor = metrica === 'eur' ? Number(v.ingresos_brutos || 0) : Number(v.unidades || 0)
      agg.set(key, (agg.get(key) ?? 0) + valor)
    }
    return computePareto([...agg.entries()].map(([key, valor]) => ({
      key, valor, variantes: variantesPorKey.get(key)?.size,
    })))
  }, [filtradas, dim, metrica, nombreMadre])

  const fmtVal = (v: number) => (metrica === 'eur' ? fmtEur(v) : `${fmtDec(v, 0)} ud`)

  const chartData = useMemo(
    () => rows.slice(0, 20).map(r => ({ name: r.key, valor: r.valor, acum: Number(r.acumPct.toFixed(1)), clase: r.clase })),
    [rows],
  )

  const barColor = (r: { key?: string; clase: Clase }) => {
    if (dim === 'canal' && r.key) {
      const k = CANAL_CORP_KEY[r.key.toLowerCase?.() ?? '']
      if (k && CORP[k]) return CORP[k]
    }
    return CLASE_COLOR[r.clase]
  }

  const soloUnaMarca = dim === 'marca' && rows.length <= 1
  const dimLabel = dim === 'plato' ? 'productos' : dim === 'marca' ? 'marcas' : 'canales'

  if (loading) return <div style={{ padding: 32, color: GRIS, fontFamily: LEX }}>Cargando ventas…</div>

  const periodoLabel = mesSel === 'todos' ? 'Acumulado' : (MES[mesSel as number] ?? `Mes ${mesSel}`)
  const titular = rows.length === 0
    ? 'Sin ventas en este periodo para calcular el Pareto.'
    : <>De <b>{rows.length}</b> {dimLabel}, <b>{nA}</b> concentran el <b>80%</b> {metrica === 'eur' ? 'de la facturación' : 'de las unidades'}.</>

  const atencion = [
    rows[0] ? `Líder: ${rows[0].key} · ${fmtDec(rows[0].pct, 0)}%` : null,
    `Cola larga (C): ${rows.filter(r => r.clase === 'C').length}`,
    rows.length ? `${fmtDec((nA / rows.length) * 100, 0)}% del surtido hace el 80%` : null,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>
      {/* Filtros propios (métrica + periodo), planos arriba-derecha */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginBottom: 6, textAlign: 'right' }}>Métrica</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Pill active={metrica === 'eur'} color={GRANATE} onClick={() => setMetrica('eur')}>Ingresos €</Pill>
            <Pill active={metrica === 'uds'} color={GRANATE} onClick={() => setMetrica('uds')}>Unidades</Pill>
          </div>
        </div>
        <div>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginBottom: 6, textAlign: 'right' }}>Periodo</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Pill active={mesSel === 'todos'} color={INK} onClick={() => setMesSel('todos')}>Acumulado</Pill>
            {mesesDisp.map(m => (
              <Pill key={m} active={mesSel === m} color={INK} onClick={() => setMesSel(m)}>{MES[m] ?? `Mes ${m}`}</Pill>
            ))}
          </div>
        </div>
      </div>

      {/* Dimensión */}
      <div>
        <TabsPastilla tabs={DIMS} activeId={dim} onChange={id => setDim(id as Dim)} />
      </div>

      {soloUnaMarca && (
        <div style={{ background: PARETO_WARN_BG, border: `2px solid ${NAR}`, borderRadius: 0, padding: '10px 16px', fontFamily: LEX, fontSize: 12, color: PARETO_WARN_TXT }}>
          ⚠ Aún no hay desglose por marca: todas las ventas entran como una sola marca. Este Pareto se abre solo en cuanto la importación etiquete la marca de cada plato. El Pareto por producto y por canal ya es real.
        </div>
      )}

      {/* 1 · Héroe del área Ventas (verde) */}
      <HeroCantera
        area="ventas"
        periodo={periodoLabel}
        titular={titular}
        etiquetaDato={metrica === 'eur' ? 'Facturación total' : 'Unidades totales'}
        cifra={fmtVal(total)}
        resumen={rows.length ? <>Regla 80/20 sobre {rows.length} {dimLabel} con ventas.</> : undefined}
        atencion={atencion}
      />

      {/* 2 · Plancha KPIs */}
      <div>
        <SeccionLabel bg={VERDE}>Clasificación ABC</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={VERDE} color={BLANCO} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Hacen el 80% (A)</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{nA} de {rows.length}</div>
          </PlanchaCelda>
          <PlanchaCelda>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Líder</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{rows[0] ? `${fmtDec(rows[0].pct, 0)}%` : '—'}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rows[0]?.key ?? '—'}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={GRANATE} color={BLANCO}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Cola larga (C)</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{rows.filter(r => r.clase === 'C').length}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>último 5%</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* 3 · Frase potente (oportunidad · rosa, distinta del héroe verde) */}
      {rows.length > 2 && (
        <FrasePotente significado="oportunidad">Protege los {dimLabel} de clase A en carta y posicionamiento; revisa o retira la cola larga (C).</FrasePotente>
      )}

      {/* Gráfico Pareto — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={NAR}>Curva de Pareto{rows.length > 20 ? ' · top 20' : ''}</SeccionLabel>
        <Papel ceja={NAR}>
          <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 8 }}>
            Barras = {metrica === 'eur' ? 'facturación' : 'unidades'} · línea = % acumulado
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={chartData} margin={{ top: 16, right: 16, bottom: 90, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CREMA} />
              <XAxis dataKey="name" interval={0} angle={-40} textAnchor="end" height={90}
                tick={{ fontFamily: LEX, fontSize: 10, fill: INK }} />
              <YAxis yAxisId="left" tick={{ fontFamily: LEX, fontSize: 11, fill: INK }}
                tickFormatter={(v: number) => (metrica === 'eur' ? `${Math.round(v / 1000)}k` : `${v}`)} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontFamily: LEX, fontSize: 11, fill: INK }} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip content={<PTooltip metrica={metrica} />} />
              <ReferenceLine yAxisId="right" y={80} stroke={GRANATE} strokeDasharray="4 4" label={{ value: '80%', position: 'right', fontSize: 10, fill: GRANATE }} />
              <Bar yAxisId="left" dataKey="valor" radius={0}>
                {chartData.map((d, i) => <Cell key={i} fill={barColor(d)} />)}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="acum" stroke={GRANATE} strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
            {(['A', 'B', 'C'] as Clase[]).map(c => (
              <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: LEX, fontSize: 11, color: INK }}>
                <span style={{ width: 10, height: 10, background: CLASE_COLOR[c], border: `1px solid ${INK}` }} /> {c} · {CLASE_DESC[c]}
              </span>
            ))}
          </div>
        </Papel>
      </div>

      {/* Tabla ABC — papel (sin sombra) */}
      <div>
        <SeccionLabel bg={GRANATE}>Clasificación ABC completa</SeccionLabel>
        <Papel ceja={GRANATE} pad="0">
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1.8fr 110px 70px 120px 56px', gap: 8, padding: '10px 12px', borderBottom: `2px solid ${INK}` }}>
            {['#', dim === 'plato' ? 'Producto' : dim === 'marca' ? 'Marca' : 'Canal', metrica === 'eur' ? 'Ingresos' : 'Unidades', '%', 'Acum %', 'Clase'].map((h, i) => (
              <span key={i} style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, background: INK, textAlign: i >= 2 && i <= 4 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {rows.map((r, i) => (
              <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '28px 1.8fr 110px 70px 120px 56px', gap: 8, padding: '8px 12px', borderBottom: `1px solid ${INK}`, alignItems: 'center' }}>
                <span style={{ fontFamily: OSW, fontSize: 12, color: GRIS, textAlign: 'right' }}>{i + 1}</span>
                <span style={{ fontFamily: LEX, fontSize: 12, color: r.key === SIN_VINCULAR ? GRIS : INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.key}
                  {r.variantes && r.variantes > 1 && (
                    <span style={{ color: GRIS, fontSize: 11 }}> · {r.variantes} variantes de plataforma</span>
                  )}
                  {r.key === SIN_VINCULAR && (
                    <button
                      onClick={() => navigate('/cocina/coste-plato')}
                      style={{ marginLeft: 8, background: 'none', border: 'none', color: GRANATE, textDecoration: 'underline', fontFamily: LEX, fontSize: 11, cursor: 'pointer', padding: 0 }}
                    >
                      Vincular →
                    </button>
                  )}
                </span>
                <span style={{ fontFamily: OSW, fontSize: 12, color: INK, fontWeight: 600, textAlign: 'right' }}>{fmtVal(r.valor)}</span>
                <span style={{ fontFamily: LEX, fontSize: 12, color: GRIS, textAlign: 'right' }}>{fmtDec(r.pct)}%</span>
                <span style={{ position: 'relative', textAlign: 'right', fontFamily: LEX, fontSize: 11, color: GRIS }}>
                  <span style={{ position: 'absolute', inset: 0, width: `${Math.min(100, r.acumPct)}%`, background: `${CLASE_COLOR[r.clase]}22` }} />
                  <span style={{ position: 'relative' }}>{fmtDec(r.acumPct)}%</span>
                </span>
                <span style={{ justifySelf: 'start' }}>
                  <span style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, color: BLANCO, background: CLASE_COLOR[r.clase], padding: '1px 8px' }}>{r.clase}</span>
                </span>
              </div>
            ))}
            {!rows.length && <div style={{ padding: 16, color: GRIS, fontFamily: LEX, fontSize: 13 }}>Sin ventas en este periodo.</div>}
          </div>
        </Papel>
      </div>

      {hayEstimados && (
        <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS }}>
          Parte de las unidades pueden ser estimadas; se sustituyen solas al cargar el resumen real de plataforma.
        </div>
      )}
    </PantallaCantera>
  )
}

function PTooltip({ active, payload, metrica }: { active?: boolean; payload?: Array<{ payload: { name: string; valor: number; acum: number; clase: Clase } }>; metrica: Metrica }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: BLANCO, border: `2px solid ${INK}`, borderRadius: 0, padding: '8px 12px', fontFamily: LEX, fontSize: 12 }}>
      <div style={{ fontFamily: OSW, fontSize: 13, marginBottom: 2 }}>{d.name}</div>
      <div>{metrica === 'eur' ? fmtEur(d.valor) : `${fmtDec(d.valor, 0)} ud`}</div>
      <div>Acumulado: {fmtDec(d.acum)}%</div>
      <div style={{ color: CLASE_COLOR[d.clase], fontWeight: 600 }}>Clase {d.clase}</div>
    </div>
  )
}
