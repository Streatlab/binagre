import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useTheme, cardStyle, FONT } from '@/styles/tokens'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface CartaPlato {
  id: string
  nombre: string
  pvp: number
  marca: string
  receta_id: string | null
}

interface RecetaFoodCost {
  id: string
  coste_rac: number
}

interface PedidoConteo {
  plato: string
  count: number
}

interface PlotPoint {
  id: string
  nombre: string
  marca: string
  popularidad: number   // 0-100 %
  margen: number        // € absolutos
  margenPct: number     // % sobre pvp
  pvp: number
  cuadrante: 'estrella' | 'vaca' | 'dilema' | 'perro'
  estimado: boolean     // true si popularidad por fallback uniforme
}

type Periodo = 'semana' | 'mes_actual' | 'mes_anterior' | 'tres_meses' | 'ano_actual'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function periodoToDateRange(p: Periodo): { desde: string; hasta: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDayMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  switch (p) {
    case 'semana': {
      const day = now.getDay() || 7
      const mon = new Date(now); mon.setDate(now.getDate() - day + 1)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return { desde: iso(mon), hasta: iso(sun) }
    }
    case 'mes_actual':
      return { desde: iso(firstDayMonth), hasta: iso(lastDayMonth) }
    case 'mes_anterior': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { desde: iso(first), hasta: iso(last) }
    }
    case 'tres_meses': {
      const first = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return { desde: iso(first), hasta: iso(lastDayMonth) }
    }
    case 'ano_actual': {
      return { desde: `${now.getFullYear()}-01-01`, hasta: iso(lastDayMonth) }
    }
  }
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// ─── COLORES CUADRANTE ────────────────────────────────────────────────────────

const QUAD_COLOR: Record<PlotPoint['cuadrante'], string> = {
  estrella: '#e8f442',
  vaca:     '#06C167',
  dilema:   '#f5a623',
  perro:    '#B01D23',
}

const QUAD_LABEL: Record<PlotPoint['cuadrante'], string> = {
  estrella: 'Estrella',
  vaca:     'Vaca',
  dilema:   'Dilema',
  perro:    'Perro',
}

const QUAD_ACTION: Record<PlotPoint['cuadrante'], string> = {
  estrella: 'Mantener y destacar en carta',
  vaca:     'Subir precio o reducir food cost',
  dilema:   'Promocionar, mejorar foto y visibilidad',
  perro:    'Eliminar de carta o rediseñar',
}

const CANALES_LIST = ['Uber', 'Glovo', 'JustEat', 'Web', 'Directa']
const COMISION_DEFAULT: Record<string, number> = {
  Uber: 0.30, Glovo: 0.30, JustEat: 0.30, Web: 0.07, Directa: 0.00
}

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'semana',       label: 'Semana actual' },
  { value: 'mes_actual',   label: 'Mes actual' },
  { value: 'mes_anterior', label: 'Mes anterior' },
  { value: 'tres_meses',   label: 'Últimos 3 meses' },
  { value: 'ano_actual',   label: 'Año actual' },
]

// ─── TOOLTIP RECHARTS ─────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PlotPoint }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', fontFamily: FONT.body, fontSize: 12 }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 14, color: '#ffffff', marginBottom: 4 }}>{d.nombre}</div>
      <div style={{ color: '#9ba8c0' }}>{d.marca}</div>
      <div style={{ marginTop: 6, color: '#ffffff' }}>
        <span style={{ color: '#e8f442' }}>Pop:</span> {d.popularidad.toFixed(1)}%
        {d.estimado && <span style={{ color: '#f5a623', fontSize: 10, marginLeft: 4 }}>(est.)</span>}
      </div>
      <div style={{ color: '#ffffff' }}>
        <span style={{ color: '#e8f442' }}>Margen:</span> {fmtEur(d.margen)} ({(d.margenPct * 100).toFixed(1)}%)
      </div>
      <div style={{ color: '#ffffff' }}>
        <span style={{ color: '#e8f442' }}>PVP:</span> {fmtEur(d.pvp)}
      </div>
      <div style={{ marginTop: 4, color: QUAD_COLOR[d.cuadrante], fontWeight: 600 }}>{QUAD_LABEL[d.cuadrante]}</div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function MenuEngineering() {
  const { T, isDark } = useTheme()
  const navigate = useNavigate()

  // Filtros
  const [marcasSelec, setMarcasSelec] = useState<string[]>([])
  const [canalesSelec, setCanalesSelec] = useState<string[]>(CANALES_LIST)
  const [periodo, setPeriodo] = useState<Periodo>('mes_actual')

  // Datos BD
  const [cartaPlatos, setCartaPlatos] = useState<CartaPlato[]>([])
  const [foodCosts, setFoodCosts] = useState<Map<string, number>>(new Map())
  const [pedidosConteo, setPedidosConteo] = useState<PedidoConteo[]>([])
  const [comisiones, setComisiones] = useState<Map<string, number>>(new Map(Object.entries(COMISION_DEFAULT)))
  const [marcasDisponibles, setMarcasDisponibles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [sinFoodCost, setSinFoodCost] = useState(0)

  // ─── Cargar datos ────────────────────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    setLoading(true)

    // 1. carta_platos
    let platos: CartaPlato[] = []
    try {
      const { data } = await supabase
        .from('carta_platos')
        .select('id,nombre,pvp,marca,receta_id')
        .eq('activo', true)
      platos = (data as CartaPlato[]) ?? []
    } catch {
      // tabla no existe todavia
    }

    setCartaPlatos(platos)
    const marcas = [...new Set(platos.map(p => p.marca))].filter(Boolean).sort()
    setMarcasDisponibles(marcas)
    if (marcasSelec.length === 0 && marcas.length > 0) {
      setMarcasSelec(marcas)
    }

    // 2. food cost desde recetas
    const recetaIds = platos.map(p => p.receta_id).filter(Boolean) as string[]
    if (recetaIds.length > 0) {
      const { data: recs } = await supabase
        .from('recetas')
        .select('id,coste_rac')
        .in('id', recetaIds)
      const fcMap = new Map<string, number>()
      for (const r of (recs as RecetaFoodCost[]) ?? []) {
        fcMap.set(r.id, Number(r.coste_rac) ?? 0)
      }
      setFoodCosts(fcMap)
    }

    // 3. popularidad desde pedidos_plataforma
    const { desde, hasta } = periodoToDateRange(periodo)
    try {
      const { data: pedidos } = await supabase
        .from('pedidos_plataforma')
        .select('plato')
        .gte('fecha', desde)
        .lte('fecha', hasta)

      const conteo = new Map<string, number>()
      for (const p of (pedidos as { plato: string }[]) ?? []) {
        conteo.set(p.plato, (conteo.get(p.plato) ?? 0) + 1)
      }
      const arr: PedidoConteo[] = []
      conteo.forEach((count, plato) => arr.push({ plato, count }))
      setPedidosConteo(arr)
    } catch {
      setPedidosConteo([])
    }

    // 4. comisiones desde config_canales
    try {
      const { data: canales } = await supabase
        .from('config_canales')
        .select('canal,comision')
      if (canales) {
        const cm = new Map(Object.entries(COMISION_DEFAULT))
        for (const c of canales as { canal: string; comision: number }[]) {
          cm.set(c.canal, Number(c.comision))
        }
        setComisiones(cm)
      }
    } catch {
      // usa defaults
    }

    setLoading(false)
  }, [periodo])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ─── Calcular puntos del scatter ─────────────────────────────────────────────

  const { points, medX, medY } = useMemo<{ points: PlotPoint[]; medX: number; medY: number }>(() => {
    if (cartaPlatos.length === 0) return { points: [], medX: 50, medY: 0 }

    // Filtrar por marcas seleccionadas
    const platosFiltrados = marcasSelec.length > 0
      ? cartaPlatos.filter(p => marcasSelec.includes(p.marca))
      : cartaPlatos

    if (platosFiltrados.length === 0) return { points: [], medX: 50, medY: 0 }

    // Calcular comisión media ponderada de canales seleccionados
    const comisionMedia = canalesSelec.length > 0
      ? canalesSelec.reduce((sum, c) => sum + (comisiones.get(c) ?? COMISION_DEFAULT[c] ?? 0), 0) / canalesSelec.length
      : 0

    // Popularidad desde pedidos_plataforma
    const totalPedidos = pedidosConteo.reduce((s, p) => s + p.count, 0)
    const pedidosMap = new Map(pedidosConteo.map(p => [p.plato, p.count]))
    const hayPedidos = totalPedidos > 0

    // Fallback: distribucion uniforme por marca
    const platosAgrupadosPorMarca = new Map<string, number>()
    for (const p of platosFiltrados) {
      platosAgrupadosPorMarca.set(p.marca, (platosAgrupadosPorMarca.get(p.marca) ?? 0) + 1)
    }

    let sinFC = 0
    const pts: PlotPoint[] = []

    for (const plato of platosFiltrados) {
      const foodCostReceta = plato.receta_id ? (foodCosts.get(plato.receta_id) ?? null) : null

      if (foodCostReceta === null) {
        sinFC++
        continue
      }

      const pvp = Number(plato.pvp)
      const margen = pvp * (1 - comisionMedia) - foodCostReceta
      const margenPct = pvp > 0 ? margen / pvp : 0

      // Popularidad
      let pop = 0
      let estimado = false
      if (hayPedidos) {
        const pedidosPlato = pedidosMap.get(plato.nombre) ?? 0
        pop = totalPedidos > 0 ? (pedidosPlato / totalPedidos) * 100 : 0
      } else {
        // Fallback uniforme dentro de la marca
        const nPlatosMarca = platosAgrupadosPorMarca.get(plato.marca) ?? 1
        pop = 100 / nPlatosMarca
        estimado = true
      }

      pts.push({
        id: plato.id,
        nombre: plato.nombre,
        marca: plato.marca,
        popularidad: pop,
        margen,
        margenPct,
        pvp,
        cuadrante: 'perro', // se asigna tras mediana
        estimado,
      })
    }

    setSinFoodCost(sinFC)

    if (pts.length === 0) return { points: [], medX: 50, medY: 0 }

    const mX = median(pts.map(p => p.popularidad))
    const mY = median(pts.map(p => p.margen))

    for (const p of pts) {
      const altaPop = p.popularidad > mX
      const altoMargen = p.margen > mY
      if (altaPop && altoMargen)       p.cuadrante = 'estrella'
      else if (altaPop && !altoMargen) p.cuadrante = 'vaca'
      else if (!altaPop && altoMargen) p.cuadrante = 'dilema'
      else                             p.cuadrante = 'perro'
    }

    return { points: pts, medX: mX, medY: mY }
  }, [cartaPlatos, marcasSelec, canalesSelec, foodCosts, pedidosConteo, comisiones])

  // Agrupados por cuadrante
  const porCuadrante = useMemo(() => {
    const map: Record<PlotPoint['cuadrante'], PlotPoint[]> = { estrella: [], vaca: [], dilema: [], perro: [] }
    for (const p of points) map[p.cuadrante].push(p)
    return map
  }, [points])

  const hayEstimados = useMemo(() => points.some(p => p.estimado), [points])

  // ─── Estilos ──────────────────────────────────────────────────────────────────

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: 8,
    border: active ? 'none' : `1px solid ${T.brd}`,
    background: active ? '#B01D23' : T.card,
    color: active ? '#ffffff' : T.sec,
    fontFamily: FONT.heading,
    fontSize: 13,
    cursor: 'pointer',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    transition: 'all 150ms',
  })

  const selectStyle: React.CSSProperties = {
    background: isDark ? '#1e1e1e' : '#ffffff',
    border: `1px solid ${T.brd}`,
    borderRadius: 8,
    color: T.pri,
    fontFamily: FONT.body,
    fontSize: 13,
    padding: '7px 12px',
    cursor: 'pointer',
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 32, color: T.sec, fontFamily: FONT.body }}>Cargando datos…</div>
    )
  }

  if (cartaPlatos.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: FONT.body }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '2px', color: '#B01D23', marginBottom: 12 }}>MENU ENGINEERING</div>
        <div style={{ color: T.sec, fontSize: 14, marginBottom: 8 }}>No hay platos en la carta.</div>
        <div style={{ color: T.mut, fontSize: 12 }}>Vincula platos a recetas en Escandallo v2 para activar el análisis.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, letterSpacing: '3px', color: '#B01D23', textTransform: 'uppercase' }}>
          Menu Engineering
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Periodo */}
          <select value={periodo} onChange={e => setPeriodo(e.target.value as Periodo)} style={selectStyle}>
            {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* FILTROS MARCA + CANAL */}
      <div style={{ ...cardStyle(T), display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Marcas */}
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>Marcas</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {marcasDisponibles.map(m => {
              const active = marcasSelec.includes(m)
              return (
                <button
                  key={m}
                  onClick={() => setMarcasSelec(prev => active ? prev.filter(x => x !== m) : [...prev, m])}
                  style={tabBtnStyle(active)}
                >
                  {m}
                </button>
              )
            })}
            {marcasDisponibles.length > 1 && (
              <button
                onClick={() => setMarcasSelec(marcasDisponibles)}
                style={{ ...tabBtnStyle(false), fontSize: 11 }}
              >
                Todas
              </button>
            )}
          </div>
        </div>

        {/* Canales */}
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 8 }}>Canales</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CANALES_LIST.map(c => {
              const active = canalesSelec.includes(c)
              return (
                <button
                  key={c}
                  onClick={() => setCanalesSelec(prev => active ? prev.filter(x => x !== c) : [...prev, c])}
                  style={tabBtnStyle(active)}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* AVISOS */}
      {sinFoodCost > 0 && (
        <div style={{ background: '#1a1200', border: '1px solid #f5a623', borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 12, color: '#f5a623' }}>
          {sinFoodCost} plato{sinFoodCost > 1 ? 's' : ''} excluido{sinFoodCost > 1 ? 's' : ''} por falta de food cost. Asigna receta en Escandallo v2.
        </div>
      )}
      {hayEstimados && (
        <div style={{ background: '#1a1200', border: '1px solid #e8f442', borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 12, color: '#e8f442' }}>
          Popularidad estimada — sin detalle de pedidos por plato. Importa Glovo formato A para datos reales.
        </div>
      )}
      {points.length > 0 && points.length < 4 && (
        <div style={{ background: isDark ? '#1a1f32' : '#f0f0f0', border: `1px solid ${T.brd}`, borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
          Pocos platos para análisis significativo ({points.length}). Añade más a la carta para mejores resultados.
        </div>
      )}

      {/* SCATTER CHART + CUADRANTES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

        {/* Scatter */}
        <div style={{ ...cardStyle(T), padding: '20px 16px' }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 16 }}>
            Matriz Kasavana &amp; Smith · Mediana dinámica
          </div>
          {points.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
              Sin datos para los filtros seleccionados.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2a3050' : '#e0e0e0'} />
                <XAxis
                  dataKey="popularidad"
                  type="number"
                  name="Popularidad"
                  unit="%"
                  domain={[0, 'dataMax + 5']}
                  tick={{ fontFamily: FONT.body, fontSize: 11, fill: T.sec }}
                  label={{ value: 'Popularidad (%)', position: 'insideBottom', offset: -20, fontFamily: FONT.body, fontSize: 11, fill: T.mut }}
                />
                <YAxis
                  dataKey="margen"
                  type="number"
                  name="Margen"
                  tick={{ fontFamily: FONT.body, fontSize: 11, fill: T.sec }}
                  tickFormatter={v => `${v.toFixed(1)}€`}
                  label={{ value: 'Margen unitario (€)', angle: -90, position: 'insideLeft', fontFamily: FONT.body, fontSize: 11, fill: T.mut }}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x={medX} stroke="#B01D23" strokeDasharray="4 4" strokeWidth={1.5} />
                <ReferenceLine y={medY} stroke="#B01D23" strokeDasharray="4 4" strokeWidth={1.5} />
                {(['estrella', 'vaca', 'dilema', 'perro'] as PlotPoint['cuadrante'][]).map(q => (
                  <Scatter
                    key={q}
                    name={QUAD_LABEL[q]}
                    data={porCuadrante[q]}
                    fill={QUAD_COLOR[q]}
                    opacity={0.85}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          )}
          {/* Leyenda */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
            {(['estrella', 'vaca', 'dilema', 'perro'] as PlotPoint['cuadrante'][]).map(q => (
              <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: QUAD_COLOR[q] }} />
                <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.sec }}>{QUAD_LABEL[q]} ({porCuadrante[q].length})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel cuadrantes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(['estrella', 'vaca', 'dilema', 'perro'] as PlotPoint['cuadrante'][]).map(q => (
            <div key={q} style={{ ...cardStyle(T), borderLeft: `3px solid ${QUAD_COLOR[q]}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontFamily: FONT.heading, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', color: QUAD_COLOR[q] }}>
                  {QUAD_LABEL[q]}
                </div>
                <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
                  {porCuadrante[q].length} plato{porCuadrante[q].length !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 8 }}>
                {QUAD_ACTION[q]}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 120, overflowY: 'auto' }}>
                {porCuadrante[q].slice(0, 8).map(p => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/cocina/recetario/${p.id}`)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: '3px 0',
                      fontFamily: FONT.body,
                      fontSize: 12,
                      color: T.pri,
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                    <span style={{ color: T.mut, flexShrink: 0 }}>{fmtEur(p.margen)}</span>
                  </button>
                ))}
                {porCuadrante[q].length > 8 && (
                  <div style={{ fontSize: 11, color: T.mut }}>+{porCuadrante[q].length - 8} más…</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
