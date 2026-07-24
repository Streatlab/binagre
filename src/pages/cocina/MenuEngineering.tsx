import { AZUL, BLANCO, GRANATE, NAR, ROJO, VERDE } from '@/styles/neobrutal'
import { PARETO_WARN_BORDER, PARETO_WARN_MUT } from '@/styles/palettes'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
  LineChart, Line, BarChart, Bar, Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { COLORS, FONT, CARDS, fmtDec } from '@/components/panel/resumen/tokens'
import { calcNetoPorCanal, useConfigCanales } from '@/lib/panel/calcNetoPlataforma'
import { normPlato, similitudPlato } from '@/utils/normPlato'
import RutaPantalla from '@/components/ui/RutaPantalla'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
import type { jsPDF } from 'jspdf'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

/** Umbral mínimo para sugerir un enlace automático (Tanda 8) — igual criterio que Carta.tsx:
 *  por debajo, mejor no sugerir nada que sugerir mal; sigue disponible el selector manual. */
const UMBRAL_SUGERENCIA = 0.5

/**
 * MENU ENGINEERING · Binagre ERP
 * ------------------------------------------------------------------
 * 6 métodos sobre datos REALES:
 *   1. Boston (Kasavana & Smith 1982) — matriz BCG: popularidad × margen €
 *   2. Pavesic (1983) — food cost % × margen de contribución ponderado
 *   3. LeBruto adaptada (8 cuadrantes, SIN coste mano de obra — es fijo)
 *   4. Omnes — 4 leyes de precios; dispersión en 5 tramos Y en 3 tramos
 *   5. Atkinson (micro-marketing mix) — contribución al margen total
 *   6. Taylor (multifactor) — índice compuesto ponderado
 *
 * FUENTES DE DATOS (nunca hardcode):
 *   - Coste y PVP por canal: tabla `recetas` (coste_rac, pvp_*).
 *   - Comisiones netas: calcNetoPorCanal(modo:'plato') ← config_canales real.
 *   - Popularidad (unidades): tabla `ventas_plato` agregada por plato/periodo,
 *     resuelta a receta vía `mapeo_plato_receta.plato_muestra → receta_id`
 *     (misma tabla que alimenta CostePlato.tsx). Ventas cuyo plato no resuelve
 *     receta se excluyen del análisis y se contabilizan en el aviso de cobertura.
 *
 * MECANISMO ESTIMADO → REAL:
 *   ventas_plato.origen ∈ {estimado, real, excel, pos, resumen}
 *   ventas_plato.estimado boolean. Clave única (canal,marca,plato,mes,año):
 *   cuando entra un upsert real, pisa la fila estimada automáticamente.
 *   El módulo marca cada punto como (est.) mientras siga siendo estimado.
 * ------------------------------------------------------------------ */

/* ── Tipos ──────────────────────────────────────────── */
interface RecetaRow {
  id: string
  nombre: string
  coste_rac: number | null
  pvp_uber: number | null
  pvp_glovo: number | null
  pvp_je: number | null
  pvp_web: number | null
  pvp_real: number | null
  marca_id: string | null
}
interface VentaRow {
  plato: string
  canal: string
  mes: number
  año: number
  unidades: number
  estimado: boolean
  origen: string
  ingresos_brutos: number | null
}
interface MapeoRow {
  id: string
  plato_muestra: string | null
  plato_norm: string
  receta_id: string | null
  euros: number | null
  unidades: number | null
}
interface Dish {
  id: string
  nombre: string
  coste: number
  precioCarta: number          // precio de referencia para Omnes (pvp_real||pvp_uber)
  netoMedio: number            // neto medio tras comisiones en canales seleccionados
  margen: number               // netoMedio − coste (€/ud)
  margenPct: number            // margen / precioCarta
  foodCostPct: number          // coste / precioCarta
  unidades: number             // del periodo seleccionado
  mix: number                  // % sobre total unidades del conjunto filtrado
  estimado: boolean
}

type MetodoId = 'boston' | 'pavesic' | 'lebruto' | 'omnes' | 'atkinson' | 'taylor'

const METODOS: Array<{ id: MetodoId; label: string }> = [
  { id: 'boston',   label: 'Boston' },
  { id: 'pavesic',  label: 'Pavesic' },
  { id: 'lebruto',  label: 'LeBruto 8' },
  { id: 'omnes',    label: 'Omnes' },
  { id: 'atkinson', label: 'Atkinson' },
  { id: 'taylor',   label: 'Taylor' },
]

const CANALES: Array<{ id: string; pvp: keyof RecetaRow; label: string; color: string }> = [
  { id: 'uber',  pvp: 'pvp_uber',  label: 'Uber',    color: COLORS.uber },
  { id: 'glovo', pvp: 'pvp_glovo', label: 'Glovo',   color: COLORS.glovo },
  { id: 'je',    pvp: 'pvp_je',    label: 'Just Eat',color: COLORS.je },
  { id: 'web',   pvp: 'pvp_web',   label: 'Web',     color: COLORS.web },
]

/* ── Helpers numéricos ──────────────────────────────── */
function mean(arr: number[]): number {
  return arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0
}
function pctTramos(precios: number[], nTramos: number): { rango: [number, number]; n: number; pct: number }[] {
  if (!precios.length) return []
  const min = Math.min(...precios), max = Math.max(...precios)
  const w = (max - min) / nTramos || 1
  const out: { rango: [number, number]; n: number; pct: number }[] = []
  for (let i = 0; i < nTramos; i++) {
    const lo = min + w * i
    const hi = i === nTramos - 1 ? max : min + w * (i + 1)
    const n = precios.filter(p => (i === nTramos - 1 ? p >= lo && p <= hi : p >= lo && p < hi)).length
    out.push({ rango: [lo, hi], n, pct: (n / precios.length) * 100 })
  }
  return out
}

// Fix popularidad (Tanda 8): ventas_plato.plato vs recetas.nombre se cruzaban con `===`
// exacto y la mayoria de platos salian con 0 unidades aunque si tuvieran ventas reales
// (mayusculas/acentos/espacios distintos). normPlato() replica norm_plato() de Postgres
// (la misma que usa v_margen_plato/mapeo_plato_receta) -- ver src/utils/normPlato.ts.

/* ── Estilos base (tokens Panel Global) ───────────────
 * CANTERA ALEGRE: sombra dura SOLO en pulsable/resumen del héroe — estos
 * bloques son informativos (gráficos, listas), así que se les quita el
 * boxShadow heredado de CARDS.big/std (que ya vienen a radio 0). ── */
const cardBig = { ...CARDS.big, boxShadow: 'none' }
const card = { ...CARDS.std, boxShadow: 'none' }
const lbl: React.CSSProperties = {
  fontFamily: FONT.heading, fontSize: 12, letterSpacing: 2,
  textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500,
}
const lblSm: React.CSSProperties = { ...lbl, fontSize: 11, letterSpacing: 1.5 }

function Pill({ active, color, children, onClick }: { active: boolean; color: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 0,
      border: active ? 'none' : `0.5px solid ${COLORS.brd}`,
      background: active ? color : COLORS.card,
      color: active ? BLANCO : COLORS.sec,
      fontFamily: FONT.body, fontSize: 12, fontWeight: 500, cursor: 'pointer',
    }}>{children}</button>
  )
}

/* ══════════════════════════════════════════════════════
   PDF — MARCO ÚNICO (src/lib/marcoDoc.ts) — LANDSCAPE
   Informe Boston (estrella/vaca/puzzle/perro): misma clasificación que la
   pantalla (Boston, línea ~500) + tabla completa de platos con popularidad/
   margen/food cost/PVP/coste. Se reutilizan B_LABEL/B_ACTION/CuadB definidos
   más abajo en el módulo (solo se referencian dentro del cuerpo de la
   función, que se ejecuta tras cargar todo el módulo).
   ══════════════════════════════════════════════════════ */
const AREA_ME: M.Area = 'cocina'

function crearInformePDF(dishes: Dish[], meta: string, rec: M.Recursos, bn = false): jsPDF | null {
  if (!dishes.length) return null
  const doc = M.nuevaHoja({ orientation: 'landscape' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA_ME, bn)
  const cb = M.contentBox(doc)

  const N = dishes.length
  const cutX = (100 / N) * 0.70
  const cutY = mean(dishes.map(d => d.margen))
  const clasificados = dishes.map(d => {
    const altaPop = d.mix >= cutX
    const altoMargen = d.margen >= cutY
    const cuad: CuadB = altaPop && altoMargen ? 'estrella' : altaPop && !altoMargen ? 'vaca' : !altaPop && altoMargen ? 'puzzle' : 'perro'
    return { ...d, cuad }
  })
  const porCuad: Record<CuadB, typeof clasificados> = { estrella: [], vaca: [], puzzle: [], perro: [] }
  clasificados.forEach(p => porCuad[p.cuad].push(p))

  const nuevaPagina = () => {
    M.pintarEspina(doc, AREA_ME, ctx, bn)
    return M.pintarCabecera(doc, ctx, { docNombre: 'Informe Menu Engineering', meta, tituloCentrado: 'MENU ENGINEERING', area: AREA_ME, bn })
  }
  let y = nuevaPagina()

  // KPI en pills
  const margenMedio = mean(dishes.map(d => d.margen))
  const foodCostMedio = mean(dishes.map(d => d.foodCostPct))
  let xPill = cb.x0
  const pillsTxt = [`${N} platos analizados`, `Margen medio ${fmtEur(margenMedio)}`, `Food cost medio ${fmtDec(foodCostMedio * 100)}%`]
  pillsTxt.forEach(txt => { xPill += M.pill(doc, xPill, y, txt, AREA_ME, ctx, { bn }) + 3 })
  y += 11

  // Matriz Boston — 2x2 de tarjetas (alto margen arriba, bajo abajo)
  const gap = 4
  const colW = (cb.w - gap) / 2
  const rowH = 44
  const quads: CuadB[] = ['estrella', 'puzzle', 'vaca', 'perro']
  quads.forEach((q, i) => {
    const col = i % 2, fila = Math.floor(i / 2)
    const x = cb.x0 + col * (colW + gap)
    const yy = y + fila * (rowH + gap)
    M.tarjeta(doc, x, yy, colW, rowH, AREA_ME, { bn })
    M.fTitulo(doc, ctx, true); doc.setFontSize(10.5); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.text(`${B_LABEL[q].toUpperCase()} · ${porCuad[q].length}`, x + 3.5, yy + 5.6)
    M.fDato(doc, ctx, false); doc.setFontSize(7)
    doc.setTextColor(...M.GRIS)
    const accionLines = doc.splitTextToSize(B_ACTION[q], colW - 7) as string[]
    doc.text(accionLines, x + 3.5, yy + 9.3)
    let yItem = yy + 9.3 + accionLines.length * 3.2 + 2.5
    const top = porCuad[q].slice(0, 5)
    top.forEach(p => {
      if (yItem > yy + rowH - 2.5) return
      M.fDato(doc, ctx, false); doc.setFontSize(7.8); doc.setTextColor(...M.TINTA)
      doc.text(p.nombre, x + 3.5, yItem, { maxWidth: colW - 24 })
      doc.setTextColor(...M.GRIS)
      doc.text(fmtEur(p.margen), x + colW - 3.5, yItem, { align: 'right' })
      yItem += 3.9
    })
    if (porCuad[q].length > 5) {
      M.fDato(doc, ctx, false); doc.setFontSize(6.8); doc.setTextColor(...M.GRIS)
      doc.text(`+${porCuad[q].length - 5} más`, x + 3.5, Math.min(yItem, yy + rowH - 2))
    }
  })
  y += 2 * rowH + gap + 7

  // Tabla completa de platos
  const cols: { label: string; w: number; align: 'left' | 'right' }[] = [
    { label: 'Plato', w: 0.27, align: 'left' },
    { label: 'Cuadrante', w: 0.12, align: 'left' },
    { label: 'Popularidad', w: 0.13, align: 'right' },
    { label: 'Margen', w: 0.13, align: 'right' },
    { label: 'Food cost', w: 0.12, align: 'right' },
    { label: 'PVP', w: 0.115, align: 'right' },
    { label: 'Coste', w: 0.115, align: 'right' },
  ]
  const colX: number[] = []
  { let acc = cb.x0; cols.forEach(c => { colX.push(acc); acc += cb.w * c.w }) }

  const pintarCabeceraTabla = (yy: number) => {
    doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.rect(cb.x0, yy, cb.w, 5.6, 'F')
    M.fTitulo(doc, ctx, true); doc.setFontSize(7.6); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    cols.forEach((c, i) => doc.text(c.label, c.align === 'right' ? colX[i] + cb.w * c.w - 2 : colX[i] + 2, yy + 3.9, { align: c.align }))
    return yy + 5.6
  }
  y = pintarCabeceraTabla(y)

  clasificados.forEach(d => {
    if (y > cb.bottom - 5) { doc.addPage(); y = nuevaPagina(); y = pintarCabeceraTabla(y) }
    doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.1); doc.line(cb.x0, y + 4.6, cb.x1, y + 4.6)
    M.fDato(doc, ctx, false); doc.setFontSize(8); doc.setTextColor(...M.TINTA)
    doc.text(d.nombre, colX[0] + 2, y + 3.6, { maxWidth: cb.w * cols[0].w - 4 })
    doc.setTextColor(...M.GRIS)
    doc.text(B_LABEL[d.cuad], colX[1] + 2, y + 3.6)
    doc.text(`${fmtDec(d.mix)}%${d.estimado ? ' (est.)' : ''}`, colX[2] + cb.w * cols[2].w - 2, y + 3.6, { align: 'right' })
    doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.text(fmtEur(d.margen), colX[3] + cb.w * cols[3].w - 2, y + 3.6, { align: 'right' })
    doc.setTextColor(...M.GRIS)
    doc.text(`${fmtDec(d.foodCostPct * 100)}%`, colX[4] + cb.w * cols[4].w - 2, y + 3.6, { align: 'right' })
    doc.text(fmtEur(d.precioCarta), colX[5] + cb.w * cols[5].w - 2, y + 3.6, { align: 'right' })
    doc.text(fmtEur(d.coste), colX[6] + cb.w * cols[6].w - 2, y + 3.6, { align: 'right' })
    y += 4.8
  })

  const totalPag = doc.getNumberOfPages()
  for (let p = 1; p <= totalPag; p++) { doc.setPage(p); M.pintarPaginado(doc, p, totalPag, ctx) }
  return doc
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════ */
export default function MenuEngineering() {
  const configCanales = useConfigCanales()
  const navigate = useNavigate()

  const [recetas, setRecetas] = useState<RecetaRow[]>([])
  const [ventas, setVentas] = useState<VentaRow[]>([])
  const [mapeo, setMapeo] = useState<MapeoRow[]>([])
  const [loading, setLoading] = useState(true)

  const [metodo, setMetodo] = useState<MetodoId>('boston')
  const [canalesSel, setCanalesSel] = useState<string[]>(['uber'])
  const [mesSel, setMesSel] = useState<number | 'todos'>('todos')

  /* ── Carga datos reales ── */
  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, { data: v }, { data: m }] = await Promise.all([
      supabase.from('recetas')
        .select('id,nombre,coste_rac,pvp_uber,pvp_glovo,pvp_je,pvp_web,pvp_real,marca_id')
        .gt('coste_rac', 0),
      supabase.from('ventas_plato').select('*'),
      supabase.from('mapeo_plato_receta').select('id,plato_muestra,plato_norm,receta_id,euros,unidades'),
    ])
    setRecetas((r as RecetaRow[]) ?? [])
    setVentas((v as unknown as VentaRow[]) ?? [])
    setMapeo((m as MapeoRow[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  /* ── Mapa plato_muestra → receta_id (solo enlaces ya resueltos) ── */
  const mapaEnlace = useMemo(() => {
    const m = new Map<string, string>()
    for (const row of mapeo) {
      if (row.plato_muestra && row.receta_id) m.set(row.plato_muestra, row.receta_id)
    }
    return m
  }, [mapeo])

  /* ── Fallback de último recurso (Tanda 8): nombre normalizado de receta → id,
   *  solo para platos de ventas que no tengan fila enlazada en mapeo_plato_receta. ── */
  const recetaPorNombreNorm = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of recetas) m.set(normPlato(r.nombre), r.id)
    return m
  }, [recetas])

  /* ── Enlace asistido (Tanda 8): vincular un plato_muestra a una receta en un clic ── */
  const [vinculando, setVinculando] = useState<string | null>(null)
  const vincular = useCallback(async (mapeoId: string, recetaId: string) => {
    setVinculando(mapeoId)
    await supabase.from('mapeo_plato_receta').update({
      receta_id: recetaId, origen: 'manual', confianza: 1, updated_at: new Date().toISOString(),
    }).eq('id', mapeoId)
    await cargar()
    setVinculando(null)
  }, [cargar])

  /* ── Lista de platos de ventas sin receta enlazada, con sugerencia por similitud
   *  (mismo criterio que Carta.tsx), ordenada por facturación — para enlazar en un clic
   *  sin salir de la pantalla (CA-5). ── */
  const sinEnlazarLista = useMemo(() => {
    return mapeo
      .filter(row => !row.receta_id)
      .map(row => {
        let sugerencia: { receta: RecetaRow; score: number } | null = null
        const nombre = row.plato_muestra ?? row.plato_norm
        for (const r of recetas) {
          const score = similitudPlato(nombre, r.nombre)
          if (score >= UMBRAL_SUGERENCIA && (!sugerencia || score > sugerencia.score)) sugerencia = { receta: r, score }
        }
        return { row, nombre, sugerencia }
      })
      .sort((a, b) => Number(b.row.euros ?? 0) - Number(a.row.euros ?? 0))
  }, [mapeo, recetas])

  /* ── Meses disponibles en ventas ── */
  const mesesDisp = useMemo(() => {
    const s = new Set<number>()
    ventas.forEach(v => s.add(v.mes))
    return [...s].sort((a, b) => a - b)
  }, [ventas])

  /* ── Dataset base (real) ── */
  const dishes = useMemo<Dish[]>(() => {
    if (!recetas.length) return []
    // unidades por receta (filtrado por canal y mes), resuelto vía mapeo_plato_receta
    // (misma fuente que v_margen_plato). Fallback de último recurso (Tanda 8): si un
    // plato de ventas no está enlazado en el mapeo, se intenta un cruce directo por
    // nombre normalizado contra recetas.nombre antes de descartarlo del análisis.
    const uds = new Map<string, number>()
    const est = new Map<string, boolean>()
    for (const v of ventas) {
      if (!canalesSel.includes(v.canal)) continue
      if (mesSel !== 'todos' && v.mes !== mesSel) continue
      const recetaId = mapaEnlace.get(v.plato) ?? recetaPorNombreNorm.get(normPlato(v.plato))
      if (!recetaId) continue // sin receta enlazada ni match por nombre → no participa (ver sinEnlazar)
      uds.set(recetaId, (uds.get(recetaId) ?? 0) + Number(v.unidades || 0))
      if (v.estimado) est.set(recetaId, true)
    }
    const raw: Dish[] = []
    for (const r of recetas) {
      const coste = Number(r.coste_rac || 0)
      const precioCarta = Number(r.pvp_real || 0) > 0 ? Number(r.pvp_real) : Number(r.pvp_uber || 0)
      if (precioCarta <= 0) continue
      // neto medio tras comisiones en los canales seleccionados con PVP > 0
      const netos: number[] = []
      for (const c of CANALES) {
        if (!canalesSel.includes(c.id)) continue
        const pvp = Number(r[c.pvp] || 0)
        if (pvp <= 0) continue
        netos.push(calcNetoPorCanal(c.id, pvp, 1, { modo: 'plato', configCanales }).neto)
      }
      const netoMedio = netos.length ? mean(netos) : precioCarta
      const margen = netoMedio - coste
      raw.push({
        id: r.id, nombre: r.nombre, coste, precioCarta, netoMedio,
        margen, margenPct: precioCarta > 0 ? margen / precioCarta : 0,
        foodCostPct: precioCarta > 0 ? coste / precioCarta : 0,
        unidades: uds.get(r.id) ?? 0, mix: 0,
        estimado: est.get(r.id) ?? false,
      })
    }
    const totalUds = raw.reduce((s, d) => s + d.unidades, 0) || 1
    raw.forEach(d => { d.mix = (d.unidades / totalUds) * 100 })
    return raw.sort((a, b) => b.margen - a.margen)
  }, [recetas, ventas, mapaEnlace, recetaPorNombreNorm, canalesSel, mesSel, configCanales])

  const hayEstimados = useMemo(() => dishes.some(d => d.estimado), [dishes])

  /* ── Cobertura: ventas del periodo/canal filtrado sin receta enlazada (CA-5) ── */
  const sinEnlazar = useMemo(() => {
    let euros = 0
    const platos = new Set<string>()
    for (const v of ventas) {
      if (!canalesSel.includes(v.canal)) continue
      if (mesSel !== 'todos' && v.mes !== mesSel) continue
      if (mapaEnlace.has(v.plato) || recetaPorNombreNorm.has(normPlato(v.plato))) continue
      euros += Number(v.ingresos_brutos || 0)
      platos.add(v.plato)
    }
    return { euros, n: platos.size }
  }, [ventas, mapaEnlace, recetaPorNombreNorm, canalesSel, mesSel])

  /* ── Evolución mensual (unidades totales) ── */
  const evolucion = useMemo(() => {
    const m = new Map<number, number>()
    for (const v of ventas) {
      if (!canalesSel.includes(v.canal)) continue
      m.set(v.mes, (m.get(v.mes) ?? 0) + Number(v.unidades || 0))
    }
    const MES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([mes, uds]) => ({ mes: MES[mes] ?? String(mes), uds }))
  }, [ventas, canalesSel])

  /* ── Agregados para el héroe (solo lectura de `dishes`, sin recalcular negocio) ── */
  const margenMedio = useMemo(() => dishes.length ? mean(dishes.map(dd => dd.margen)) : 0, [dishes])
  const foodCostMedio = useMemo(() => dishes.length ? mean(dishes.map(dd => dd.foodCostPct)) : 0, [dishes])

  /* ════════════════════════════════════════════════════ */
  if (loading) return <div style={{ padding: 32, color: COLORS.sec, fontFamily: FONT.body }}>Cargando datos…</div>

  const canalesLabel = canalesSel.map(c => CANALES.find(x => x.id === c)?.label).join(', ')

  const filtros = (
    <Papel ceja={NAR} style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div>
        <div style={{ ...lblSm, marginBottom: 8 }}>Canales</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CANALES.map(c => (
            <Pill key={c.id} active={canalesSel.includes(c.id)} color={COLORS.accent}
              onClick={() => setCanalesSel(p => p.includes(c.id) ? (p.length > 1 ? p.filter(x => x !== c.id) : p) : [...p, c.id])}>
              {c.label}
            </Pill>
          ))}
        </div>
      </div>
      <div>
        <div style={{ ...lblSm, marginBottom: 8 }}>Periodo</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Pill active={mesSel === 'todos'} color={COLORS.sec} onClick={() => setMesSel('todos')}>Acumulado</Pill>
          {mesesDisp.map(m => (
            <Pill key={m} active={mesSel === m} color={COLORS.sec} onClick={() => setMesSel(m)}>Mes {m}</Pill>
          ))}
        </div>
      </div>
    </Papel>
  )

  const atencion = [
    `${dishes.length} platos analizados`,
    hayEstimados ? 'Popularidad estimada (placeholder)' : null,
    sinEnlazar.n > 0 ? `${sinEnlazar.n} platos sin enlazar` : null,
    canalesLabel ? `Canales: ${canalesLabel}` : null,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <RutaPantalla niveles={['Cocina', 'Menú Engineering']} />
        <BotonImprimir
          compacto
          documentoId="cocina.menu_engineering"
          titulo="Informe Menu Engineering"
          generarPdf={async opts => {
            const rec = await M.cargarRecursos()
            const meta = `${mesSel !== 'todos' ? `Mes ${mesSel}` : 'Acumulado'}${canalesLabel ? ` · ${canalesLabel}` : ''}`
            return crearInformePDF(dishes, meta, rec, opts.bn)
          }}
        />
      </div>

      {/* HÉROE (naranja · área Cocina) */}
      <HeroCantera
        area="cocina"
        periodo={mesSel !== 'todos' ? `Mes ${mesSel}` : 'Acumulado'}
        titular={dishes.length === 0 ? 'Aún no hay platos con precio y coste para analizar.' : <>El margen medio de tu carta es de <b>{fmtEur(margenMedio)}</b> por plato.</>}
        etiquetaDato="Margen medio por plato"
        cifra={fmtEur(margenMedio)}
        resumen={dishes.length > 0 ? <>Food cost medio <b>{fmtDec(foodCostMedio * 100)}%</b> sobre {dishes.length} platos con venta y receta.</> : undefined}
        atencion={atencion}
      />

      {/* PLANCHA DE KPIs comparables */}
      <div>
        <SeccionLabel bg={NAR}>KPIs de carta</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={NAR} color={BLANCO} first>
            <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Platos analizados</div>
            <div style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{dishes.length}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={VERDE} color={BLANCO}>
            <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Margen medio</div>
            <div style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(margenMedio)}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={foodCostMedio <= 0.35 ? VERDE : ROJO} color={BLANCO}>
            <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Food cost medio</div>
            <div style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{fmtDec(foodCostMedio * 100)}%</div>
          </PlanchaCelda>
          <PlanchaCelda bg={AZUL} color={BLANCO}>
            <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Sin enlazar</div>
            <div style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{sinEnlazar.n}</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* FRASE POTENTE (color por significado, distinto del héroe naranja) */}
      {sinEnlazar.n > 0
        ? <FrasePotente significado="peligro">{fmtEur(sinEnlazar.euros)} de ventas todavía sin receta enlazada quedan fuera del análisis: enlázalas para que el margen real sea fiable.</FrasePotente>
        : hayEstimados
          ? <FrasePotente significado="coste">La popularidad aún es estimada: en cuanto entren ventas reales, los 6 métodos se recalculan solos.</FrasePotente>
          : <FrasePotente significado="oportunidad">Usa los 6 métodos para decidir qué platos empujar, cuáles repensar y cuáles retirar de la carta.</FrasePotente>}

      {/* Filtros */}
      {filtros}

      {/* Enlace asistido: platos de ventas sin receta enlazada (CA-5) */}
      {sinEnlazar.n > 0 && (
        <Papel ceja={GRANATE}>
          <div style={{ marginBottom: 8, fontFamily: FONT.body, fontSize: 12, color: COLORS.pri }}>
            ⚠ {fmtEur(sinEnlazar.euros)} de ventas todavía sin receta enlazada ({sinEnlazar.n} platos) — no participan en el análisis. Vincúlalos aquí en un clic:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sinEnlazarLista.slice(0, 8).map(({ row, nombre, sugerencia }) => (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: BLANCO, border: `0.5px solid ${PARETO_WARN_BORDER}`, borderRadius: 0, padding: '6px 10px' }}>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nombre}>
                  {nombre} <span style={{ color: PARETO_WARN_MUT }}>· {fmtEur(Number(row.euros ?? 0))}</span>
                </div>
                {sugerencia ? (
                  <button
                    onClick={() => vincular(row.id, sugerencia.receta.id)}
                    disabled={vinculando === row.id}
                    title={`Similitud ${Math.round(sugerencia.score * 100)}%`}
                    style={{ flexShrink: 0, background: COLORS.accent, color: BLANCO, border: 'none', borderRadius: 0, padding: '4px 10px', fontFamily: FONT.body, fontSize: 11, cursor: vinculando === row.id ? 'default' : 'pointer', opacity: vinculando === row.id ? 0.6 : 1 }}
                  >
                    ¿{sugerencia.receta.nombre}? · Vincular
                  </button>
                ) : (
                  <select
                    value=""
                    disabled={vinculando === row.id}
                    onChange={e => { if (e.target.value) vincular(row.id, e.target.value) }}
                    style={{ flexShrink: 0, maxWidth: 180, fontFamily: FONT.body, fontSize: 11, border: `0.5px solid ${PARETO_WARN_BORDER}`, borderRadius: 0, padding: '4px 6px' }}
                  >
                    <option value="">Vincular a…</option>
                    {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
          {sinEnlazarLista.length > 8 && (
            <div onClick={() => navigate('/cocina/coste-plato')} style={{ marginTop: 8, cursor: 'pointer', textDecoration: 'underline' }}>
              Ver los {sinEnlazarLista.length - 8} restantes en Coste por plato →
            </div>
          )}
        </Papel>
      )}

      {/* Evolución mensual */}
      {evolucion.length > 1 && (
        <Papel ceja={AZUL}>
          <div style={{ ...lblSm, marginBottom: 10 }}>Evolución unidades · {canalesLabel}</div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={evolucion} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.group} />
              <XAxis dataKey="mes" tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.sec }} />
              <YAxis tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.sec }} />
              <Tooltip contentStyle={{ fontFamily: FONT.body, fontSize: 12, borderRadius: 0 }} />
              <Line type="monotone" dataKey="uds" stroke={COLORS.accent} strokeWidth={2} dot={{ r: 3 }} name="Unidades" />
            </LineChart>
          </ResponsiveContainer>
        </Papel>
      )}

      {/* Selector de método */}
      <div>
        <SeccionLabel bg={VERDE}>Método de análisis</SeccionLabel>
        <TabsPastilla tabs={METODOS} activeId={metodo} onChange={id => setMetodo(id as MetodoId)} />
      </div>

      {/* Render por método (6 vistas Recharts: se reutilizan tal cual, solo capa visual de arriba) */}
      {metodo === 'boston'   && <Boston dishes={dishes} />}
      {metodo === 'pavesic'  && <Pavesic dishes={dishes} />}
      {metodo === 'lebruto'  && <LeBruto dishes={dishes} />}
      {metodo === 'omnes'    && <Omnes dishes={dishes} />}
      {metodo === 'atkinson' && <Atkinson dishes={dishes} />}
      {metodo === 'taylor'   && <Taylor dishes={dishes} />}
    </PantallaCantera>
  )
}

/* ══════════════════════════════════════════════════════
   1 · BOSTON (Kasavana & Smith) — matriz BCG
   Eje X: popularidad (mix %). Eje Y: margen €.
   Corte X: regla del 70% → (100/N)·0,70. Corte Y: margen medio.
   ══════════════════════════════════════════════════════ */
type CuadB = 'estrella' | 'vaca' | 'puzzle' | 'perro'
const B_COLOR: Record<CuadB, string> = { estrella: VERDE, vaca: AZUL, puzzle: NAR, perro: ROJO }
const B_LABEL: Record<CuadB, string> = { estrella: 'Estrella', vaca: 'Vaca', puzzle: 'Puzzle', perro: 'Perro' }
const B_ACTION: Record<CuadB, string> = {
  estrella: 'Mantener y destacar en carta',
  vaca: 'Vende mucho, margen bajo → subir precio o bajar coste',
  puzzle: 'Margen alto, vende poco → promocionar y dar visibilidad',
  perro: 'Vende poco y deja poco → eliminar o rediseñar',
}

function Boston({ dishes }: { dishes: Dish[] }) {
  const { cutX, cutY, porCuad } = useMemo(() => {
    const N = dishes.length || 1
    const cutX = (100 / N) * 0.70
    const cutY = mean(dishes.map(d => d.margen))
    const pts = dishes.map(d => {
      const altaPop = d.mix >= cutX
      const altoMargen = d.margen >= cutY
      const cuad: CuadB = altaPop && altoMargen ? 'estrella' : altaPop && !altoMargen ? 'vaca' : !altaPop && altoMargen ? 'puzzle' : 'perro'
      return { ...d, cuad }
    })
    const porCuad: Record<CuadB, typeof pts> = { estrella: [], vaca: [], puzzle: [], perro: [] }
    pts.forEach(p => porCuad[p.cuad].push(p))
    return { cutX, cutY, porCuad }
  }, [dishes])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start' }}>
      <div style={cardBig}>
        <div style={{ ...lblSm, marginBottom: 4 }}>Matriz BCG · corte popularidad regla 70% ({fmtDec(cutX)}%) · margen medio {fmtEur(cutY)}</div>
        <ResponsiveContainer width="100%" height={440}>
          <ScatterChart margin={{ top: 20, right: 24, bottom: 40, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.group} />
            <XAxis type="number" dataKey="mix" name="Popularidad" unit="%" domain={[0, 'dataMax + 2']}
              tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.sec }}
              label={{ value: 'Popularidad (mix %)', position: 'insideBottom', offset: -22, fontSize: 11, fill: COLORS.mut }} />
            <YAxis type="number" dataKey="margen" name="Margen"
              tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.sec }} tickFormatter={(v: number) => `${v.toFixed(1)}€`}
              label={{ value: 'Margen (€/ud)', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.mut }} />
            <ZAxis range={[60, 60]} />
            <Tooltip content={<BTooltip />} />
            <ReferenceLine x={cutX} stroke={COLORS.redSL} strokeDasharray="4 4" />
            <ReferenceLine y={cutY} stroke={COLORS.redSL} strokeDasharray="4 4" />
            {(['estrella', 'vaca', 'puzzle', 'perro'] as CuadB[]).map(q => (
              <Scatter key={q} name={B_LABEL[q]} data={porCuad[q]} fill={B_COLOR[q]} opacity={0.85} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
          {(['estrella', 'vaca', 'puzzle', 'perro'] as CuadB[]).map(q => (
            <span key={q} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONT.body, fontSize: 11, color: COLORS.sec }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: B_COLOR[q] }} />
              {B_LABEL[q]} ({porCuad[q].length})
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(['estrella', 'vaca', 'puzzle', 'perro'] as CuadB[]).map(q => (
          <div key={q} style={{ ...card, borderLeft: `3px solid ${B_COLOR[q]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: B_COLOR[q] }}>{B_LABEL[q]}</span>
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>{porCuad[q].length}</span>
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginBottom: 6 }}>{B_ACTION[q]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 110, overflowY: 'auto' }}>
              {porCuad[q].slice(0, 8).map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: FONT.body, fontSize: 12, color: COLORS.pri }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}{p.estimado ? ' ·est' : ''}</span>
                  <span style={{ color: COLORS.mut, flexShrink: 0 }}>{fmtEur(p.margen)}</span>
                </div>
              ))}
              {porCuad[q].length > 8 && <span style={{ fontSize: 11, color: COLORS.mut }}>+{porCuad[q].length - 8} más…</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
function BTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Dish & { cuad: CuadB } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: BLANCO, border: `0.5px solid ${COLORS.brd}`, borderRadius: 0, padding: '8px 12px', fontFamily: FONT.body, fontSize: 12 }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 13, marginBottom: 2 }}>{d.nombre}</div>
      <div>Popularidad: {fmtDec(d.mix)}% {d.estimado && <span style={{ color: COLORS.warn }}>(est.)</span>}</div>
      <div>Margen: {fmtEur(d.margen)} ({fmtDec(d.margenPct * 100)}%)</div>
      <div>PVP: {fmtEur(d.precioCarta)} · Coste: {fmtEur(d.coste)}</div>
      <div style={{ color: B_COLOR[d.cuad], fontWeight: 600 }}>{B_LABEL[d.cuad]}</div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   2 · PAVESIC — food cost % (X, menor = mejor) × margen contribución ponderado (Y)
   Categorías: Primes / Standards / Sleepers / Problems
   ══════════════════════════════════════════════════════ */
type CuadP = 'prime' | 'standard' | 'sleeper' | 'problem'
const P_COLOR: Record<CuadP, string> = { prime: VERDE, standard: AZUL, sleeper: NAR, problem: ROJO }
const P_LABEL: Record<CuadP, string> = { prime: 'Prime', standard: 'Standard', sleeper: 'Sleeper', problem: 'Problem' }
const P_DESC: Record<CuadP, string> = {
  prime: 'Food cost bajo + margen ponderado alto → joya',
  standard: 'Food cost alto pero margen ponderado alto → mantener',
  sleeper: 'Food cost bajo, margen ponderado bajo → impulsar ventas',
  problem: 'Food cost alto, margen ponderado bajo → revisar o quitar',
}
function Pavesic({ dishes }: { dishes: Dish[] }) {
  const { cutFc, cutMcw, porCuad } = useMemo(() => {
    const totalU = dishes.reduce((s, d) => s + d.unidades, 0) || 1
    const enr = dishes.map(d => ({ ...d, mcw: d.margen * (d.unidades / totalU) }))  // margen contribución ponderado
    const cutFc = mean(enr.map(d => d.foodCostPct))
    const cutMcw = mean(enr.map(d => d.mcw))
    const pts = enr.map(d => {
      const fcBajo = d.foodCostPct <= cutFc
      const mcwAlto = d.mcw >= cutMcw
      const cuad: CuadP = fcBajo && mcwAlto ? 'prime' : !fcBajo && mcwAlto ? 'standard' : fcBajo && !mcwAlto ? 'sleeper' : 'problem'
      return { ...d, cuad }
    })
    const porCuad: Record<CuadP, typeof pts> = { prime: [], standard: [], sleeper: [], problem: [] }
    pts.forEach(p => porCuad[p.cuad].push(p))
    return { cutFc, cutMcw, porCuad }
  }, [dishes])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start' }}>
      <div style={cardBig}>
        <div style={{ ...lblSm, marginBottom: 4 }}>Pavesic · food cost medio {fmtDec(cutFc * 100)}% · margen pond. medio {fmtEur(cutMcw)}</div>
        <ResponsiveContainer width="100%" height={440}>
          <ScatterChart margin={{ top: 20, right: 24, bottom: 40, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.group} />
            <XAxis type="number" dataKey="foodCostPct" name="Food cost" unit="" domain={[0, 'dataMax']}
              tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.sec }} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              label={{ value: 'Food cost % (←mejor)', position: 'insideBottom', offset: -22, fontSize: 11, fill: COLORS.mut }} />
            <YAxis type="number" dataKey="mcw" name="MC ponderado"
              tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.sec }} tickFormatter={(v: number) => `${v.toFixed(2)}€`}
              label={{ value: 'Margen contrib. ponderado', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.mut }} />
            <Tooltip content={<PTooltip />} />
            <ReferenceLine x={cutFc} stroke={COLORS.redSL} strokeDasharray="4 4" />
            <ReferenceLine y={cutMcw} stroke={COLORS.redSL} strokeDasharray="4 4" />
            {(['prime', 'standard', 'sleeper', 'problem'] as CuadP[]).map(q => (
              <Scatter key={q} name={P_LABEL[q]} data={porCuad[q]} fill={P_COLOR[q]} opacity={0.85} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(['prime', 'standard', 'sleeper', 'problem'] as CuadP[]).map(q => (
          <div key={q} style={{ ...card, borderLeft: `3px solid ${P_COLOR[q]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: P_COLOR[q] }}>{P_LABEL[q]}</span>
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut }}>{porCuad[q].length}</span>
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginBottom: 6 }}>{P_DESC[q]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 110, overflowY: 'auto' }}>
              {porCuad[q].slice(0, 8).map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: FONT.body, fontSize: 12 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                  <span style={{ color: COLORS.mut, flexShrink: 0 }}>{fmtDec(p.foodCostPct * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
function PTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Dish & { mcw: number; cuad: CuadP } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: BLANCO, border: `0.5px solid ${COLORS.brd}`, borderRadius: 0, padding: '8px 12px', fontFamily: FONT.body, fontSize: 12 }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 13, marginBottom: 2 }}>{d.nombre}</div>
      <div>Food cost: {fmtDec(d.foodCostPct * 100)}%</div>
      <div>Margen pond.: {fmtEur(d.mcw)}</div>
      <div style={{ color: P_COLOR[d.cuad], fontWeight: 600 }}>{P_LABEL[d.cuad]}</div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   3 · LeBruto ADAPTADA — 8 cuadrantes (sin coste mano de obra, es fijo)
   Boston (popularidad × margen €) × tercer eje: margen % (alto/bajo).
   ══════════════════════════════════════════════════════ */
function LeBruto({ dishes }: { dishes: Dish[] }) {
  const { celdas, cutX, cutY, cutPct } = useMemo(() => {
    const N = dishes.length || 1
    const cutX = (100 / N) * 0.70
    const cutY = mean(dishes.map(d => d.margen))
    const cutPct = mean(dishes.map(d => d.margenPct))
    const key = (d: Dish) => {
      const pop = d.mix >= cutX ? 'P+' : 'P-'
      const mg = d.margen >= cutY ? 'M+' : 'M-'
      const pc = d.margenPct >= cutPct ? '%+' : '%-'
      return `${pop} ${mg} ${pc}`
    }
    const celdas = new Map<string, Dish[]>()
    for (const d of dishes) {
      const k = key(d)
      if (!celdas.has(k)) celdas.set(k, [])
      celdas.get(k)!.push(d)
    }
    return { celdas, cutX, cutY, cutPct }
  }, [dishes])

  const orden = ['P+ M+ %+', 'P+ M+ %-', 'P+ M- %+', 'P+ M- %-', 'P- M+ %+', 'P- M+ %-', 'P- M- %+', 'P- M- %-']
  const colorCelda = (k: string) => {
    const score = (k.includes('P+') ? 1 : 0) + (k.includes('M+') ? 1 : 0) + (k.includes('%+') ? 1 : 0)
    return score === 3 ? VERDE : score === 2 ? AZUL : score === 1 ? NAR : ROJO
  }

  return (
    <div style={cardBig}>
      <div style={{ ...lblSm, marginBottom: 4 }}>
        LeBruto adaptada · 8 celdas = popularidad (70%: {fmtDec(cutX)}%) × margen € ({fmtEur(cutY)}) × margen % ({fmtDec(cutPct * 100)}%)
      </div>
      <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginBottom: 12 }}>
        P+/P- popularidad · M+/M- margen € · %+/%- margen porcentual. El coste de mano de obra no entra (es fijo, se decide aparte).
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {orden.map(k => {
          const arr = celdas.get(k) ?? []
          const col = colorCelda(k)
          return (
            <div key={k} style={{ ...card, borderTop: `3px solid ${col}`, minHeight: 120 }}>
              <div style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: 1, color: col, marginBottom: 4 }}>{k}</div>
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginBottom: 6 }}>{arr.length} plato{arr.length !== 1 ? 's' : ''}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 90, overflowY: 'auto' }}>
                {arr.slice(0, 6).map(p => (
                  <div key={p.id} style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.pri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.nombre}
                  </div>
                ))}
                {arr.length > 6 && <span style={{ fontSize: 10, color: COLORS.mut }}>+{arr.length - 6}…</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   4 · OMNES — 4 leyes de precios. Dispersión en 5 tramos Y 3 tramos.
   Comparador 5 tramos aplicado a PRECIO (oferta) y a DEMANDA (unidades).
   ══════════════════════════════════════════════════════ */
function Omnes({ dishes }: { dishes: Dish[] }) {
  const data = useMemo(() => {
    const precios = dishes.map(d => d.precioCarta).filter(p => p > 0)
    if (!precios.length) return null
    const min = Math.min(...precios), max = Math.max(...precios)
    const apertura = min > 0 ? max / min : 0
    const disp3 = pctTramos(precios, 3)
    const disp5 = pctTramos(precios, 5)
    // Demanda en 5 tramos (mismas fronteras de precio) → comparador oferta/demanda
    const totalU = dishes.reduce((s, d) => s + d.unidades, 0) || 1
    const dem5 = disp5.map((t, idx) => {
      const u = dishes.filter(d => d.precioCarta >= t.rango[0] && (idx === disp5.length - 1 ? d.precioCarta <= t.rango[1] : d.precioCarta < t.rango[1]))
        .reduce((s, d) => s + d.unidades, 0)
      return { ...t, demPct: (u / totalU) * 100 }
    })
    // Ratio eficacia / IRP = precio medio demandado / precio medio ofertado
    const precioMedioOferta = mean(precios)
    const precioMedioDemandado = dishes.reduce((s, d) => s + d.precioCarta * d.unidades, 0) / totalU
    const irp = precioMedioOferta > 0 ? precioMedioDemandado / precioMedioOferta : 0
    return { min, max, apertura, disp3, disp5, dem5, irp, precioMedioOferta, precioMedioDemandado }
  }, [dishes])

  if (!data) return <div style={{ ...card, color: COLORS.mut }}>Sin precios para analizar.</div>

  const tramoBar = (t: { rango: [number, number]; pct: number }, ok: (p: number) => boolean) => {
    const col = ok(t.pct) ? COLORS.ok : COLORS.warn
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.body, fontSize: 12, color: COLORS.sec, marginBottom: 3 }}>
          <span>{fmtEur(t.rango[0])} – {fmtEur(t.rango[1])}</span>
          <span style={{ color: col, fontWeight: 600 }}>{fmtDec(t.pct)}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 0, background: COLORS.group, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, t.pct)}%`, height: '100%', background: col }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Leyes 1 y 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={card}>
          <div style={lblSm}>Ley 1 · Apertura de gama</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 30, fontWeight: 600, color: data.apertura <= 2.5 ? COLORS.ok : COLORS.err, marginTop: 4 }}>
            ×{fmtDec(data.apertura)}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 4 }}>
            {fmtEur(data.min)} → {fmtEur(data.max)}. Objetivo ≤ ×2,5. {data.apertura <= 2.5 ? 'OK, gama enfocada.' : 'Demasiado abierta: apuntas a varios públicos.'}
          </div>
        </div>
        <div style={card}>
          <div style={lblSm}>Ley 3 · Ratio de eficacia (IRP)</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 30, fontWeight: 600, color: Math.abs(data.irp - 1) <= 0.05 ? COLORS.ok : COLORS.warn, marginTop: 4 }}>
            {fmtDec(data.irp, 2)}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.mut, marginTop: 4 }}>
            Demandado {fmtEur(data.precioMedioDemandado)} / ofertado {fmtEur(data.precioMedioOferta)}.&nbsp;
            {data.irp < 0.95 ? 'Eligen los baratos → quita platos caros o añade alguno barato.'
              : data.irp > 1.05 ? 'Pagan por los caros → puedes subir gama.' : 'Oferta y demanda equilibradas.'}
          </div>
        </div>
      </div>

      {/* Ley 2 · dispersión: 5 tramos Y 3 tramos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={card}>
          <div style={{ ...lblSm, marginBottom: 10 }}>Ley 2 · Dispersión en 5 tramos</div>
          {data.disp5.map((t, i) => <div key={i}>{tramoBar(t, p => p >= 12 && p <= 28)}</div>)}
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginTop: 4 }}>Ideal: reparto equilibrado, ningún tramo vacío ni saturado.</div>
        </div>
        <div style={card}>
          <div style={{ ...lblSm, marginBottom: 10 }}>Ley 2 · Dispersión en 3 tramos (control clásico)</div>
          {data.disp3.map((t, i) => <div key={i}>{tramoBar(t, i === 1 ? (p => p > 50) : (p => p < 25))}</div>)}
          <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginTop: 4 }}>Ideal: medio &gt;50%, bajo &lt;25%, alto &lt;25%.</div>
        </div>
      </div>

      {/* Comparador 5 tramos: oferta vs demanda */}
      <div style={card}>
        <div style={{ ...lblSm, marginBottom: 10 }}>Comparador 5 tramos · oferta (nº platos) vs demanda (unidades)</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.dem5.map(t => ({ tramo: `${fmtEur(t.rango[0])}–${fmtEur(t.rango[1])}`, Oferta: Number(t.pct.toFixed(1)), Demanda: Number(t.demPct.toFixed(1)) }))}
            margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.group} />
            <XAxis dataKey="tramo" tick={{ fontFamily: FONT.body, fontSize: 10, fill: COLORS.sec }} />
            <YAxis tick={{ fontFamily: FONT.body, fontSize: 11, fill: COLORS.sec }} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip contentStyle={{ fontFamily: FONT.body, fontSize: 12, borderRadius: 0 }} />
            <Legend wrapperStyle={{ fontFamily: FONT.body, fontSize: 12 }} />
            <Bar dataKey="Oferta" fill={COLORS.sec} radius={[3, 3, 0, 0]} />
            <Bar dataKey="Demanda" fill={COLORS.accent} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>
          Donde la demanda supera a la oferta, hay hueco de carta en esa banda de precio. Donde sobra oferta, exceso de platos.
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   5 · ATKINSON (micro-marketing mix) — contribución al margen total
   ══════════════════════════════════════════════════════ */
function Atkinson({ dishes }: { dishes: Dish[] }) {
  const rows = useMemo(() => {
    const totalMargen = dishes.reduce((s, d) => s + d.margen * d.unidades, 0) || 1
    return dishes.map(d => ({
      ...d,
      contribTotal: d.margen * d.unidades,
      contribPct: (d.margen * d.unidades / totalMargen) * 100,
    })).sort((a, b) => b.contribTotal - a.contribTotal)
  }, [dishes])

  let acum = 0
  return (
    <div style={card}>
      <div style={{ ...lblSm, marginBottom: 10 }}>Atkinson · aporte de cada plato al margen total (mix × margen). Pareto: pocos platos = mayor parte del beneficio.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 80px 90px 110px 90px', gap: 8, padding: '6px 8px', borderBottom: `0.5px solid ${COLORS.brd}` }}>
        {['Plato', 'Mix %', 'Margen €', 'Contrib. €', 'Acum %'].map(h => (
          <span key={h} style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: COLORS.mut }}>{h}</span>
        ))}
      </div>
      <div style={{ maxHeight: 460, overflowY: 'auto' }}>
        {rows.map(r => {
          acum += r.contribPct
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 80px 90px 110px 90px', gap: 8, padding: '6px 8px', borderBottom: `0.5px solid ${COLORS.group}`, alignItems: 'center' }}>
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.pri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}{r.estimado ? ' ·est' : ''}</span>
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.sec }}>{fmtDec(r.mix)}%</span>
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: r.margen >= 0 ? COLORS.sec : COLORS.err }}>{fmtEur(r.margen)}</span>
              <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.pri, fontWeight: 600 }}>{fmtEur(r.contribTotal)}</span>
              <span style={{ position: 'relative', fontFamily: FONT.body, fontSize: 11, color: COLORS.mut }}>
                <span style={{ position: 'absolute', inset: 0, width: `${Math.min(100, acum)}%`, background: `${COLORS.accent}22`, borderRadius: 0 }} />
                <span style={{ position: 'relative' }}>{fmtDec(acum)}%</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   6 · TAYLOR (multifactor) — índice compuesto normalizado
   Factores: margen € (35%), margen % (25%), popularidad (25%), eficiencia food cost (15%)
   ══════════════════════════════════════════════════════ */
function Taylor({ dishes }: { dishes: Dish[] }) {
  const rows = useMemo(() => {
    if (!dishes.length) return []
    const norm = (vals: number[]) => {
      const min = Math.min(...vals), max = Math.max(...vals)
      const r = max - min || 1
      return (v: number) => (v - min) / r
    }
    const nMargen = norm(dishes.map(d => d.margen))
    const nPct = norm(dishes.map(d => d.margenPct))
    const nPop = norm(dishes.map(d => d.mix))
    const nFc = norm(dishes.map(d => -d.foodCostPct))   // food cost menor = mejor
    return dishes.map(d => {
      const score = 0.35 * nMargen(d.margen) + 0.25 * nPct(d.margenPct) + 0.25 * nPop(d.mix) + 0.15 * nFc(-d.foodCostPct)
      return { ...d, score: score * 100 }
    }).sort((a, b) => b.score - a.score)
  }, [dishes])

  const colorScore = (s: number) => s >= 66 ? COLORS.ok : s >= 33 ? COLORS.warn : COLORS.err

  return (
    <div style={card}>
      <div style={{ ...lblSm, marginBottom: 4 }}>Taylor · índice compuesto (0–100)</div>
      <div style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.mut, marginBottom: 10 }}>
        Pondera margen € (35%) · margen % (25%) · popularidad (25%) · eficiencia food cost (15%). Ranking único de prioridad de carta.
      </div>
      <div style={{ maxHeight: 500, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r, i) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '28px 1.6fr 1fr 64px', gap: 10, alignItems: 'center' }}>
            <span style={{ fontFamily: FONT.heading, fontSize: 13, color: COLORS.mut, textAlign: 'right' }}>{i + 1}</span>
            <span style={{ fontFamily: FONT.body, fontSize: 12, color: COLORS.pri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}{r.estimado ? ' ·est' : ''}</span>
            <div style={{ height: 10, borderRadius: 0, background: COLORS.group, overflow: 'hidden' }}>
              <div style={{ width: `${r.score}%`, height: '100%', background: colorScore(r.score) }} />
            </div>
            <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: colorScore(r.score), textAlign: 'right' }}>{fmtDec(r.score)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
