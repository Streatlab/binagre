import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import {
  INK, OSC, CREMA, CLARO, TRACK, VERDE, ROJO, NAR, AZUL, AMA, GRIS, OSW, LEX, SHADOW, BORDER_CARD, PAD, CORP, CLARA, eyebrow, d, BLANCO } from '@/styles/neobrutal'
import { RUNNING_MUT, RUNNING_BORDER, ZEBRA_CLARA } from '@/styles/palettes'
import {
  loadConfigCanales, recargarConfigCanales, loadMarcasPorCanal,
  type CanalConfig, type MarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'
import { resolverNeto, loadVentasReales, loadRatiosCalibrados } from '@/lib/panel/netoResolver'

/* ════════════════════════════════════════════════════════════
   CASH FLOW — pestaña del Panel Global
   Cobros (fechas de pago LEY por plataforma) · Caja por mes
   (banco real) con línea de saldo · Saldo banco + Runway reales ·
   Ingresos pendientes · Gastos del mes · Caja por marca (marcas
   activas en vivo desde configuración) · Simulador.
   ════════════════════════════════════════════════════════════ */

type Sim = -10 | 0 | 10

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const CANALES = [
  { id: 'uber', label: 'Uber Eats', color: CORP['uber'], bk: 'uber_bruto', pk: 'uber_pedidos' },
  { id: 'glovo', label: 'Glovo', color: CORP['glovo'], bk: 'glovo_bruto', pk: 'glovo_pedidos' },
  { id: 'je', label: 'Just Eat', color: CORP['je'], bk: 'je_bruto', pk: 'je_pedidos' },
  { id: 'web', label: 'Web', color: CORP['web'], bk: 'web_bruto', pk: 'web_pedidos' },
  { id: 'dir', label: 'Directa', color: CORP['dir'], bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

const FESTIVOS_FALLBACK = [
  '2026-01-01', '2026-01-06', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-15',
  '2026-08-15', '2026-10-12', '2026-11-02', '2026-11-09', '2026-12-07', '2026-12-08', '2026-12-25',
]

const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: true })

function toLocal(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function parse(s: string) { return new Date(s.slice(0, 10) + 'T12:00:00') }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(d.getDate() + n); return r }
function mondayOf(d: Date) { const r = new Date(d); const w = r.getDay() || 7; r.setDate(r.getDate() - w + 1); r.setHours(12, 0, 0, 0); return r }
function finDeMes(y: number, m: number) { return new Date(y, m + 1, 0, 12) }
function fmtCorta(s: string) { const d = parse(s); return `${d.getDate()} ${MESES[d.getMonth()]}` }
function fmtLarga(s: string) { const d = parse(s); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}` }

function pagoUber(domingo: Date, fest: Set<string>): string {
  let p = addDays(domingo, 1)
  for (let i = 0; i < 7 && fest.has(toLocal(p)); i++) p = addDays(p, 1)
  return toLocal(p)
}
function pagoGlovo(y: number, m: number, q: 1 | 2): string { return toLocal(new Date(y, m + 1, q === 1 ? 5 : 20, 12)) }
function pagoJE(y: number, m: number, q: 1 | 2): string { return q === 1 ? toLocal(new Date(y, m, 20, 12)) : toLocal(new Date(y, m + 1, 5, 12)) }

function periodoTxt(canal: string, ini: string, fin: string): string {
  if (canal === 'web' || canal === 'dir') return fmtCorta(ini)
  if (canal === 'uber') { const a = parse(ini), b = parse(fin); return `sem. ${a.getDate()}–${b.getDate()} ${MESES[b.getMonth()]}` }
  const a = parse(ini); return `${a.getDate() <= 15 ? '1ª' : '2ª'} quinc. ${MESES[a.getMonth()]}`
}

function claveCobro(c: { canal: string; ini: string; fin: string }): string {
  return `${c.canal}|${c.ini}|${c.fin}`
}

interface Row {
  fecha: string; servicio?: string
  uber_bruto: number; uber_pedidos: number
  glovo_bruto: number; glovo_pedidos: number
  je_bruto: number; je_pedidos: number
  web_bruto: number; web_pedidos: number
  directa_bruto: number; directa_pedidos: number
  total_bruto: number; total_pedidos: number
}
interface Cobro { canal: string; label: string; color: string; ini: string; fin: string; pago: string; bruto: number; neto: number; pedidos: number; futuro: boolean }
interface Factura { fecha_factura: string; total: number; total_iva: number; categoria_factura: string | null }
interface VentaMarca { marca: string; neto: number; bruto: number }
interface CajaMes { mes: string; ingresos: number; gastos: number; saldo_mes: number }

const SELECT = 'fecha,servicio,uber_bruto,uber_pedidos,glovo_bruto,glovo_pedidos,je_bruto,je_pedidos,web_bruto,web_pedidos,directa_bruto,directa_pedidos,total_bruto,total_pedidos'

export default function Cashflow() {
  const [sim, setSim] = useState<Sim>(0)

  const [rows, setRows] = useState<Row[]>([])
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [catNombres, setCatNombres] = useState<Record<string, string>>({})
  const [ventasMarca, setVentasMarca] = useState<VentaMarca[]>([])
  const [cajaBanco, setCajaBanco] = useState<CajaMes[]>([])
  const [marcasActivas, setMarcasActivas] = useState<string[]>([])
  const [festivos, setFestivos] = useState<Set<string>>(new Set(FESTIVOS_FALLBACK))
  const [config, setConfig] = useState<Record<string, CanalConfig>>({})
  const [marcasPorCanal, setMarcasPorCanal] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })
  const [loading, setLoading] = useState(true)
  const [hover, setHover] = useState<number | null>(null)
  const [cobradoMap, setCobradoMap] = useState<Record<string, boolean>>({})
  const [frontera, setFrontera] = useState<Record<string, string>>({})

  useEffect(() => {
    loadConfigCanales().then(setConfig); loadMarcasPorCanal().then(setMarcasPorCanal)
    loadVentasReales().then(() => loadRatiosCalibrados())
    const on = () => { recargarConfigCanales().then(setConfig); loadMarcasPorCanal().then(setMarcasPorCanal) }
    window.addEventListener('config_canales:changed', on)
    return () => window.removeEventListener('config_canales:changed', on)
  }, [])

  useEffect(() => {
    const hace90 = toLocal(addDays(new Date(), -90))
    Promise.all([
      supabase.from('facturacion_diario').select(SELECT).order('fecha', { ascending: true }),
      supabase.from('facturas').select('fecha_factura,total,total_iva,categoria_factura').eq('tipo', 'proveedor'),
      supabase.from('categorias_gastos').select('codigo,nombre'),
      supabase.from('festivos').select('fecha'),
      supabase.from('ventas_plataforma').select('marca,neto,bruto,fecha_inicio_periodo').gte('fecha_inicio_periodo', hace90).neq('marca', 'SIN_MARCA'),
      supabase.from('v_caja_mensual').select('mes,ingresos,gastos,saldo_mes'),
      supabase.from('v_marcas_activas').select('nombre'),
    ]).then(([rd, rf, rc, rfe, rm, rcm, rma]) => {
      setRows((rd.data as Row[]) ?? [])
      setFacturas(((rf.data as Factura[]) ?? []).filter(f => f.fecha_factura))
      const cm: Record<string, string> = {}
      for (const c of (rc.data ?? []) as { codigo: string; nombre: string }[]) cm[c.codigo] = c.nombre
      setCatNombres(cm)
      const fe = (rfe.data ?? []) as { fecha: string }[]
      if (fe.length) setFestivos(new Set(fe.map(x => x.fecha.slice(0, 10))))
      setVentasMarca((rm.data as VentaMarca[]) ?? [])
      setCajaBanco((rcm.data as CajaMes[]) ?? [])
      setMarcasActivas(((rma.data as { nombre: string }[]) ?? []).map(x => x.nombre))
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    supabase.from('cashflow_cobros_estado').select('clave,cobrado').then(({ data }) => {
      const m: Record<string, boolean> = {}
      for (const r of (data ?? []) as { clave: string; cobrado: boolean }[]) m[r.clave] = r.cobrado
      setCobradoMap(m)
    })
  }, [])

  // Verdad del banco: hasta qué fecha ha entrado el cobro de cada plataforma según la conciliación
  // bancaria (categorías de venta 1.1.1 Uber / 1.1.2 Glovo / 1.1.3 Just Eat). Lo cobrado lo dice el
  // banco; lo posterior sigue pendiente y se estima con calcNetoPlataforma.
  useEffect(() => {
    supabase.from('v_frontera_cobro_banco').select('canal,ultima_fecha').then(({ data }) => {
      const f: Record<string, string> = {}
      for (const r of (data ?? []) as { canal: string; ultima_fecha: string }[]) {
        if (r.canal && r.ultima_fecha) f[r.canal] = String(r.ultima_fecha).slice(0, 10)
      }
      setFrontera(f)
    })
  }, [])

  async function toggleCobrado(c: Cobro) {
    if (cobradoBanco(c)) return
    const k = claveCobro(c)
    const nuevo = !cobradoMap[k]
    setCobradoMap(prev => ({ ...prev, [k]: nuevo }))
    await supabase.from('cashflow_cobros_estado').upsert({
      clave: k, canal: c.canal, ini: c.ini, fin: c.fin, pago: c.pago, cobrado: nuevo, marcado_at: new Date().toISOString(),
    })
  }

  const hoy = toLocal(new Date())
  const factor = 1 + sim / 100

  // Cierre histórico: del 19-jun-2026 hacia atrás, TODO cobrado al 100% (cerrado, no se discute).
  // Del 20-jun en adelante: cobrado solo si el extracto bancario ya trae ese cobro (la conciliación de
  // esa plataforma ha avanzado hasta esa fecha) o si se marca a mano. Nunca por la simple fecha de pago.
  const CIERRE_HIST = '2026-06-19'
  const cobradoBanco = (c: { canal: string; pago: string }) => {
    if (c.pago <= CIERRE_HIST) return true
    const f = frontera[c.canal]
    return !!f && c.pago <= f
  }
  const estaCobrado = (c: Cobro) => cobradoBanco(c) || !!cobradoMap[claveCobro(c)]

  const aggDia = useMemo(() => {
    const todo = new Set<string>()
    for (const r of rows) if (r.servicio === 'TODO') todo.add(r.fecha)
    const m = new Map<string, Record<string, number>>()
    for (const r of rows) {
      if (todo.has(r.fecha)) { if (r.servicio !== 'TODO') continue }
      else { if (r.servicio !== 'ALM' && r.servicio !== 'CENAS') continue }
      const a = m.get(r.fecha) ?? {}
      for (const c of CANALES) {
        a[c.bk] = (a[c.bk] ?? 0) + ((r[c.bk as keyof Row] as number) || 0)
        a[c.pk] = (a[c.pk] ?? 0) + ((r[c.pk as keyof Row] as number) || 0)
      }
      m.set(r.fecha, a)
    }
    return m
  }, [rows])

  const cobros = useMemo<Cobro[]>(() => {
    if (loading) return []
    type G = { canal: typeof CANALES[number]; ini: string; fin: string; pago: string; bruto: number; ped: number; dias: Set<string> }
    const grupos = new Map<string, G>()
    const push = (key: string, canal: typeof CANALES[number], ini: string, fin: string, pago: string, bruto: number, ped: number, f: string) => {
      let g = grupos.get(key)
      if (!g) { g = { canal, ini, fin, pago, bruto: 0, ped: 0, dias: new Set() }; grupos.set(key, g) }
      g.bruto += bruto; g.ped += ped; g.dias.add(f)
    }
    for (const [f, a] of aggDia) {
      const d = parse(f); const y = d.getFullYear(); const m = d.getMonth(); const q: 1 | 2 = d.getDate() <= 15 ? 1 : 2
      for (const c of CANALES) {
        const bruto = a[c.bk] ?? 0; const ped = a[c.pk] ?? 0
        if (bruto <= 0) continue
        if (c.id === 'uber') {
          const lun = mondayOf(d); const dom = addDays(lun, 6)
          push('U' + toLocal(lun), c, toLocal(lun), toLocal(dom), pagoUber(dom, festivos), bruto, ped, f)
        } else if (c.id === 'glovo' || c.id === 'je') {
          const ini = toLocal(new Date(y, m, q === 1 ? 1 : 16, 12))
          const fin = q === 1 ? toLocal(new Date(y, m, 15, 12)) : toLocal(finDeMes(y, m))
          const pago = c.id === 'glovo' ? pagoGlovo(y, m, q) : pagoJE(y, m, q)
          push(`${c.id}${y}-${m}-${q}`, c, ini, fin, pago, bruto, ped, f)
        } else {
          push(`${c.id}${f}`, c, f, f, f, bruto, ped, f)
        }
      }
    }
    const out: Cobro[] = []
    for (const g of grupos.values()) {
      const { neto } = resolverNeto(g.canal.id, g.bruto, g.ped, {
        modo: 'agregado_canal', marcasPorCanal, fechaDesde: parse(g.ini), fechaHasta: parse(g.fin), configCanales: config, diasConDatos: g.dias.size,
      })
      out.push({ canal: g.canal.id, label: g.canal.label, color: g.canal.color, ini: g.ini, fin: g.fin, pago: g.pago, bruto: g.bruto, neto, pedidos: g.ped, futuro: g.pago > hoy })
    }
    return out.sort((a, b) => (a.pago < b.pago ? -1 : 1))
  }, [aggDia, config, marcasPorCanal, festivos, loading, hoy])

  // Plataformas con ciclo de cobro por liquidación. Web/Directa son cobro inmediato → no "pendientes".
  const CANALES_CICLO = ['uber', 'glovo', 'je']
  // Pendiente de cobrar = periodos de Uber/Glovo/JE que el banco aún no ha pagado y no marcados a mano.
  const pendientesAll = useMemo(
    () => cobros.filter(c => CANALES_CICLO.includes(c.canal) && !cobradoBanco(c) && !cobradoMap[claveCobro(c)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cobros, cobradoMap, frontera])
  // Filas visibles: hasta 10, de la más reciente a la más antigua.
  const futuros = useMemo(
    () => [...pendientesAll].sort((a, b) => (a.pago < b.pago ? 1 : -1)).slice(0, 10),
    [pendientesAll])
  const porCobrarTotal = useMemo(() => pendientesAll.reduce((s, c) => s + c.neto, 0) * factor, [pendientesAll, factor])
  const finMesStr = useMemo(() => { const d = new Date(); return toLocal(finDeMes(d.getFullYear(), d.getMonth())) }, [])
  const hastaFinMes = useMemo(() => pendientesAll.filter(c => c.pago <= finMesStr).reduce((s, c) => s + c.neto, 0) * factor, [pendientesAll, finMesStr, factor])

  const porCanal = useMemo(() => CANALES.map(c => {
    const list = pendientesAll.filter(x => x.canal === c.id)
    return { id: c.id, label: c.label, color: c.color, neto: list.reduce((s, x) => s + x.neto, 0) * factor }
  }), [pendientesAll, factor])
  const topPlat = useMemo(() => [...porCanal].sort((a, b) => b.neto - a.neto)[0] ?? null, [porCanal])

  const graf = useMemo(() => {
    const desde = toLocal(addDays(new Date(), -35)); const hasta = toLocal(addDays(new Date(), 45))
    const m = new Map<string, { pago: string; total: number; futuro: boolean; items: { label: string; color: string; neto: number }[] }>()
    for (const c of cobros) {
      if (c.pago < desde || c.pago > hasta) continue
      const e = m.get(c.pago) ?? { pago: c.pago, total: 0, futuro: c.pago > hoy, items: [] }
      const v = c.neto * (c.pago > hoy ? factor : 1)
      e.total += v
      const it = e.items.find(x => x.label === c.label)
      if (it) it.neto += v; else e.items.push({ label: c.label, color: c.color, neto: v })
      m.set(c.pago, e)
    }
    return [...m.values()].sort((a, b) => (a.pago < b.pago ? -1 : 1))
  }, [cobros, hoy, factor])

  const grueso = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of pendientesAll) m.set(c.pago, (m.get(c.pago) ?? 0) + c.neto * factor)
    let best: { pago: string; total: number } | null = null
    for (const [pago, total] of m) if (!best || total > best.total) best = { pago, total }
    return best
  }, [pendientesAll, factor])

  const mesActual = hoy.slice(0, 7)
  const gastosCat = useMemo(() => {
    const m = new Map<string, { total: number; iva: number; n: number }>()
    for (const f of facturas) {
      if ((f.fecha_factura ?? '').slice(0, 7) !== mesActual) continue
      const nom = f.categoria_factura ? (catNombres[f.categoria_factura] ?? f.categoria_factura) : 'Sin categoría'
      const e = m.get(nom) ?? { total: 0, iva: 0, n: 0 }
      e.total += Number(f.total || 0); e.iva += Number(f.total_iva || 0); e.n += 1
      m.set(nom, e)
    }
    return [...m.entries()].map(([nombre, x]) => ({ nombre, ...x })).sort((a, b) => b.total - a.total)
  }, [facturas, catNombres, mesActual])
  const gastoMesTotal = useMemo(() => gastosCat.reduce((s, c) => s + c.total, 0), [gastosCat])
  const nFacturasMes = useMemo(() => gastosCat.reduce((s, c) => s + c.n, 0), [gastosCat])

  const cruce = useMemo(() => {
    return [...cajaBanco].sort((a, b) => (a.mes < b.mes ? -1 : 1)).slice(-6).map(c => ({
      ym: c.mes, label: MESES[parseInt(c.mes.slice(5, 7), 10) - 1],
      ingresos: Number(c.ingresos) || 0, gastos: Number(c.gastos) || 0, margen: Number(c.saldo_mes) || 0,
    }))
  }, [cajaBanco])
  const saldoBanco = useMemo(() => cajaBanco.reduce((s, c) => s + (Number(c.saldo_mes) || 0), 0), [cajaBanco])
  const ultimoMov = useMemo(() => { const m = [...cajaBanco].map(c => c.mes).sort().slice(-1)[0]; return m ? `${MESES[parseInt(m.slice(5, 7), 10) - 1]} ${m.slice(0, 4)}` : '' }, [cajaBanco])
  const burnMensual = useMemo(() => { const u = [...cajaBanco].sort((a, b) => (a.mes < b.mes ? -1 : 1)).slice(-4); return u.length ? u.reduce((s, c) => s + (Number(c.gastos) || 0), 0) / u.length : 0 }, [cajaBanco])
  const runwaySem = useMemo(() => (burnMensual > 0 ? saldoBanco / (burnMensual / 4.345) : 0), [saldoBanco, burnMensual])

  const porMarca = useMemo(() => {
    const ventas = new Map<string, number>()
    for (const v of ventasMarca) ventas.set(v.marca, (ventas.get(v.marca) ?? 0) + Number(v.neto || 0))
    const base = marcasActivas.length ? marcasActivas : [...ventas.keys()]
    return base.map(marca => ({ marca, neto: ventas.get(marca) ?? 0 })).sort((a, b) => b.neto - a.neto)
  }, [ventasMarca, marcasActivas])

  const frases = useMemo(() => {
    const out: { txt: string; color: string }[] = []
    if (grueso && porCobrarTotal > 0) { const r = grueso.total / porCobrarTotal; out.push({ txt: `El grueso entra el ${fmtLarga(grueso.pago)}: ${nf0(grueso.total)}, ${r >= 0.5 ? 'más de la mitad' : 'el ' + (r * 100).toFixed(0) + '%'} de lo que tienes pendiente.`, color: VERDE }) }
    if (topPlat && topPlat.neto > 0 && porCobrarTotal > 0) { const pct = (topPlat.neto / porCobrarTotal) * 100; if (pct >= 45) out.push({ txt: `${topPlat.label} son ${Math.round(pct / 10)} de cada 10 € que te quedan por cobrar.`, color: pct >= 65 ? NAR : GRIS }) }
    if (runwaySem > 0) out.push({ txt: runwaySem >= 12 ? `Con la caja del banco (${nf0(saldoBanco)}) y tu ritmo de gasto, tienes colchón para unas ${Math.round(runwaySem)} semanas.` : `Colchón ajustado: la caja del banco (${nf0(saldoBanco)}) da para unas ${Math.round(runwaySem)} semanas al ritmo de gasto actual.`, color: runwaySem >= 12 ? VERDE : NAR })
    return out
  }, [grueso, topPlat, porCobrarTotal, runwaySem, saldoBanco])

  const simTabs: { id: Sim; label: string }[] = [{ id: -10, label: '−10%' }, { id: 0, label: 'Real' }, { id: 10, label: '+10%' }]

  // Tabla canónica Escandallo (patrón Notion 38dc8b1f): contenedor 5px + sombra 7px,
  // cabecera INK, banda lateral de estado, columna-bloque del KPI crítico, total INK.
  const CONT: CSSProperties = { background: CREMA, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}` }
  const thT: CSSProperties = { fontFamily: OSW, fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: CREMA, background: INK, padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap', borderRight: `1px solid ${RUNNING_BORDER}` }
  const thTR: CSSProperties = { ...thT, textAlign: 'right' }
  const thTC: CSSProperties = { ...thT, textAlign: 'center' }
  const tdT: CSSProperties = { fontFamily: LEX, fontSize: 14, fontWeight: 600, color: INK, padding: '6px 8px', borderTop: `3px solid ${INK}`, borderRight: '2px solid rgba(20,15,8,.12)', whiteSpace: 'nowrap' }
  const tdTN: CSSProperties = { ...tdT, fontFamily: OSW, fontWeight: 700, fontSize: 15.5, textAlign: 'right' }
  const totTd: CSSProperties = { background: INK, color: CREMA, fontFamily: OSW, fontWeight: 700, fontSize: 13, letterSpacing: '0.6px', textTransform: 'uppercase', padding: '9px 10px', borderTop: `5px solid ${INK}` }
  const totTdN: CSSProperties = { ...totTd, textAlign: 'right' }
  const zebra = (i: number): string => (i % 2 ? ZEBRA_CLARA : BLANCO)
  const BAND = 12
  const dot = (c: string): CSSProperties => ({ display: 'inline-block', width: 8, height: 8, background: c, marginRight: 6 })
  const SUBC: CSSProperties = { display: 'inline-flex', gap: 4, padding: '3px 4px', background: INK, border: `2px solid ${INK}` }
  const subA: CSSProperties = { padding: '4px 10px', border: 'none', background: BLANCO, color: INK, fontFamily: OSW, fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer' }
  const subI: CSSProperties = { padding: '4px 10px', border: 'none', background: 'rgba(255,255,255,0.15)', color: BLANCO, fontFamily: OSW, fontSize: 10, fontWeight: 500, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer' }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Cargando…</div>

  const W = 720, H = 210, P = { l: 46, r: 16, t: 22, b: 28 }
  const ix = W - P.l - P.r, iy = H - P.t - P.b
  const maxY = Math.max(...graf.map(p => p.total), 1) * 1.15
  const X = (i: number) => P.l + ix * (graf.length <= 1 ? 0.5 : i / (graf.length - 1))
  const Y = (v: number) => P.t + iy * (1 - v / maxY)
  const idxFut = graf.findIndex(p => p.futuro)

  const maxBar = Math.max(...cruce.map(c => Math.max(c.ingresos, c.gastos)), 1)
  const CW = 720, cb = 120, ct = 16
  const cstep = (CW - 60) / Math.max(cruce.length, 1)
  const cx = (i: number) => 50 + cstep * i + cstep / 2
  const barH = (v: number) => Math.max((v / maxBar) * (cb - ct), 1)
  const ySaldo = (v: number) => cb - (v / maxBar) * (cb - ct) * 0.85

  return (
    <div style={{ background: CREMA, fontFamily: LEX, color: INK, border: `4px solid ${INK}` }}>

      {/* ── SECCIÓN 1 · HERO (AZUL) ── */}
      <section style={{ background: AZUL, borderBottom: `4px solid ${INK}`, padding: `44px ${PAD}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 40, alignItems: 'start' }}>
          {/* Izquierda: eyebrow + número hero + frases */}
          <div>
            <span style={eyebrow(BLANCO, INK)}>CASHFLOW · COBROS Y TESORERÍA</span>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: `${BLANCO}99`, marginBottom: 6 }}>POR COBRAR</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ ...d('clamp(44px,6.8vw,92px)', BLANCO) }}>{nf0(porCobrarTotal)}</div>
                {sim !== 0 && <span style={{ fontFamily: OSW, fontSize: 14, fontWeight: 600, color: AMA, letterSpacing: '0.5px', marginBottom: 14 }}>· simulación {sim > 0 ? '+' : ''}{sim}%</span>}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
              {frases.map((f, i) => (
                <div key={i} style={{ fontFamily: OSW, fontSize: 'clamp(15px,2vw,19px)', fontWeight: 600, color: f.color, letterSpacing: '0.3px' }}>{f.txt}</div>
              ))}
            </div>
          </div>
          {/* Derecha: 4 KPIs apilados */}
          <div style={{ background: CLARO, border: `3px solid ${INK}`, boxShadow: SHADOW }}>
            {[
              { label: 'Por cobrar', value: nf0(porCobrarTotal), color: VERDE },
              { label: 'Hasta fin de mes', value: nf0(hastaFinMes), color: VERDE },
              { label: `Saldo banco · ${ultimoMov || '—'}`, value: nf0(saldoBanco), color: saldoBanco >= 0 ? VERDE : ROJO },
              { label: 'Runway', value: runwaySem > 0 ? `${Math.round(runwaySem)} sem.` : '—', color: runwaySem >= 12 ? VERDE : runwaySem > 0 ? NAR : GRIS },
            ].map((k, i, arr) => (
              <div key={i} style={{ padding: '18px 20px', borderBottom: i < arr.length - 1 ? `3px solid ${INK}` : 'none' }}>
                <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontFamily: OSW, fontSize: 26, fontWeight: 700, lineHeight: 1, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Simulador full-width debajo del grid */}
        <div style={{ borderTop: `4px solid ${INK}`, marginTop: 32, marginLeft: `-${PAD}`, marginRight: `-${PAD}`, padding: `14px ${PAD}`, background: OSC, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={eyebrow(`${BLANCO}33`, BLANCO)}>Simulador</span>
          <div style={SUBC}>{simTabs.map(t => <button key={t.id} onClick={() => setSim(t.id)} style={sim === t.id ? subA : subI}>{t.label}</button>)}</div>
        </div>
      </section>

      {/* ── SECCIÓN 2 · COBROS · GRÁFICO (blanco) ── */}
      <section style={{ background: BLANCO, borderBottom: `4px solid ${INK}`, padding: `44px ${PAD}` }}>
        <span style={eyebrow(AMA)}>Cobros · cobrado y previsto · neto</span>
        {graf.length === 0
          ? <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, padding: '20px 0', marginTop: 8 }}>Sin cobros en el horizonte.</div>
          : (
            <div style={{ marginTop: 18, background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW, padding: '20px 22px 16px' }}>
            <div style={{ position: 'relative' }}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                {[0, 1, 2, 3].map(g => { const v = maxY / 3 * g; const y = Y(v); return (<g key={g}><line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke={TRACK} /><text x={P.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill={GRIS} fontFamily="Lexend">{nf0(v)}</text></g>) })}
                {idxFut > 0 && (() => { const xh = (X(idxFut - 1) + X(idxFut)) / 2; return (<g><line x1={xh} y1={P.t} x2={xh} y2={H - P.b} stroke={INK} strokeWidth="1" strokeDasharray="3 3" /><text x={xh} y={P.t - 6} textAnchor="middle" fontSize="9" fill={INK} fontFamily="Oswald">HOY</text></g>) })()}
                {graf.length > 1 && <polygon points={`${X(0)} ${H - P.b} ${graf.map((p, i) => `${X(i)} ${Y(p.total)}`).join(' ')} ${X(graf.length - 1)} ${H - P.b}`} fill={VERDE} opacity={0.1} />}
                {graf.length > 1 && <polyline points={graf.map((p, i) => `${X(i) + 2} ${Y(p.total) + 3}`).join(' ')} fill="none" stroke={INK} strokeWidth="4" opacity={0.22} />}
                {graf.length > 1 && <polyline points={graf.map((p, i) => `${X(i)} ${Y(p.total)}`).join(' ')} fill="none" stroke={VERDE} strokeWidth="4" strokeLinejoin="round" />}
                {graf.map((p, i) => (<g key={i}><circle cx={X(i)} cy={Y(p.total)} r={hover === i ? 7 : 5} fill={p.futuro ? BLANCO : VERDE} stroke={INK} strokeWidth="2.5" style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} /><text x={X(i)} y={H - P.b + 14} textAnchor="middle" fontSize="9" fill={GRIS} fontFamily="Lexend">{fmtCorta(p.pago)}</text></g>))}
              </svg>
              {hover != null && graf[hover] && (
                <div style={{ position: 'absolute', left: `${(X(hover) / W) * 100}%`, top: `${(Y(graf[hover].total) / H) * 100}%`, transform: 'translate(-50%, calc(-100% - 12px))', background: INK, color: CREMA, padding: '10px 12px', minWidth: 160, pointerEvents: 'none', zIndex: 5, boxShadow: SHADOW, border: BORDER_CARD }}>
                  <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>{fmtLarga(graf[hover].pago)}</div>
                  {graf[hover].items.map((it, k) => (<div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontFamily: LEX, fontSize: 12, marginBottom: 2 }}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, background: it.color }} />{it.label}</span><span style={{ fontFamily: OSW, fontWeight: 600 }}>{nf0(it.neto)}</span></div>))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 6, paddingTop: 6, borderTop: `1px solid rgba(252,239,214,0.3)`, fontFamily: OSW, fontSize: 13, fontWeight: 700 }}><span>{graf[hover].futuro ? 'Previsto' : 'Cobrado'}</span><span>{nf0(graf[hover].total)}</span></div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: GRIS, marginTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: VERDE }} />Cobrado</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: BLANCO, border: `2px solid ${VERDE}` }} />Previsto</span>
              </div>
            </div>
            </div>
          )}
      </section>

      {/* ── SECCIÓN 3 · CAJA POR MES (CREMA) ── */}
      <section style={{ background: CREMA, borderBottom: `4px solid ${INK}`, padding: `44px ${PAD}` }}>
        <span style={eyebrow(INK, CREMA)}>Caja por mes · banco real · línea = saldo</span>
        <div style={{ marginTop: 18, background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW, padding: '20px 22px 16px' }}>
        <svg viewBox={`0 0 ${CW} 170`} style={{ width: '100%', height: 'auto' }}>
          <line x1={40} y1={cb} x2={CW - 10} y2={cb} stroke={TRACK} />
          {cruce.map((c, i) => { const x = cx(i); return (
            <g key={i}>
              <rect x={x - 16} y={cb - barH(c.ingresos) + 3} width={16} height={barH(c.ingresos)} fill={INK} />
              <rect x={x - 19} y={cb - barH(c.ingresos)} width={16} height={barH(c.ingresos)} fill={VERDE} stroke={INK} strokeWidth={2} />
              <rect x={x + 6} y={cb - barH(c.gastos) + 3} width={16} height={barH(c.gastos)} fill={INK} />
              <rect x={x + 3} y={cb - barH(c.gastos)} width={16} height={barH(c.gastos)} fill={ROJO} stroke={INK} strokeWidth={2} />
              <text x={x} y={cb + 16} textAnchor="middle" fontSize="9" fill={GRIS} fontFamily="Lexend">{c.label}</text>
              <text x={x} y={cb + 32} textAnchor="middle" fontSize="10" fill={c.margen >= 0 ? VERDE : ROJO} fontFamily="Oswald">{c.margen >= 0 ? '+' : ''}{nf0(c.margen)}</text>
            </g>) })}
          <polyline points={cruce.map((c, i) => `${cx(i)} ${ySaldo(c.margen)}`).join(' ')} fill="none" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          {cruce.map((c, i) => <circle key={i} cx={cx(i)} cy={ySaldo(c.margen)} r={4.5} fill={c.margen >= 0 ? INK : ROJO} stroke={CREMA} strokeWidth={1.5} />)}
        </svg>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: GRIS, marginTop: 8 }}>
          <span><span style={dot(VERDE)} />Ingresos</span>
          <span><span style={dot(ROJO)} />Gastos</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 0, borderTop: `2px solid ${INK}` }} />Saldo</span>
        </div>
        {ultimoMov && <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 6 }}>Movimientos reales del banco · última importación: {ultimoMov}.</div>}
        </div>
      </section>

      {/* ── SECCIÓN 4 · INGRESOS PENDIENTES + CAJA POR MARCA (blanco / CLARO) ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: `4px solid ${INK}` }}>
        {/* Izquierda: tabla ingresos pendientes */}
        <div style={{ padding: `44px ${PAD}`, borderRight: `4px solid ${INK}`, background: BLANCO }}>
          <span style={eyebrow(VERDE, BLANCO)}>Ingresos pendientes · lo que el banco aún no ha pagado</span>
          {futuros.length === 0
            ? <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, marginTop: 14 }}>Sin cobros pendientes.</div>
            : (
              <div style={{ ...CONT, marginTop: 18 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                    <thead>
                      <tr>
                        <th style={thT}>Plataforma</th>
                        <th style={thT}>Ventas de</th>
                        <th style={thTR}>Pedidos</th>
                        <th style={thT}>Cobro</th>
                        <th style={thTR}>Bruto</th>
                        <th style={thTR}>Neto est. €</th>
                        <th style={thTC}>% neto</th>
                        <th style={{ ...thTC, borderRight: 'none' }}>Cobrado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {futuros.map((c, i) => {
                        const pct = c.bruto > 0 ? (c.neto / c.bruto) * 100 : 0
                        const porBanco = cobradoBanco(c)
                        const cobrado = porBanco || !!cobradoMap[claveCobro(c)]
                        const vencido = c.pago <= hoy && !cobrado
                        const band = cobrado ? VERDE : vencido ? ROJO : AZUL
                        const pctCol = pct >= 58 ? VERDE : NAR
                        return (
                          <tr key={i} style={{ background: zebra(i), opacity: cobrado ? 0.55 : 1 }}>
                            <td style={{ ...tdT, borderLeft: `${BAND}px solid ${band}` }}><span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', background: CORP[c.canal] ?? c.color, color: CLARA[c.canal] ? INK : BLANCO, fontFamily: OSW, fontSize: 12, fontWeight: 700, letterSpacing: '0.3px', whiteSpace: 'nowrap', border: `2px solid ${INK}` }}>{c.label}</span></td>
                            <td style={{ ...tdT, color: RUNNING_MUT, fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '.3px', textTransform: 'uppercase' }}>{periodoTxt(c.canal, c.ini, c.fin)}</td>
                            <td style={tdTN}>{c.pedidos}</td>
                            <td style={{ ...tdT, fontFamily: OSW, fontWeight: 700, fontSize: 14, color: vencido ? ROJO : INK }}>{fmtCorta(c.pago)}{vencido ? ' · reclamar' : ''}</td>
                            <td style={{ ...tdTN, color: RUNNING_MUT }}>{nf0(c.bruto)}</td>
                            <td style={{ ...tdTN, color: VERDE, textDecoration: cobrado ? 'line-through' : 'none' }}>{nf0(c.neto * factor)}</td>
                            <td style={{ ...tdT, padding: 0, textAlign: 'center' }}><div style={{ background: pctCol, color: BLANCO, fontFamily: OSW, fontWeight: 700, fontSize: 16, padding: '8px 6px', borderLeft: `3px solid ${INK}`, borderRight: `3px solid ${INK}` }}>{pct.toFixed(0)}%</div></td>
                            <td style={{ ...tdT, textAlign: 'center', borderRight: 'none' }}>{porBanco
                              ? <span title="Cobrado · confirmado por el banco" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', background: VERDE, color: BLANCO, fontFamily: OSW, fontSize: 11, fontWeight: 700, border: `2px solid ${INK}` }}>✓ banco</span>
                              : <button onClick={() => toggleCobrado(c)} aria-label={cobrado ? 'Cobrado' : 'Pendiente'} title={cobrado ? 'Cobrado' : 'Marcar como cobrado'} style={{ cursor: 'pointer', border: 'none', padding: 0, background: 'transparent', display: 'inline-flex', alignItems: 'center' }}><span style={{ position: 'relative', width: 38, height: 22, background: cobrado ? VERDE : TRACK, transition: 'background .15s', display: 'inline-block', border: `2px solid ${INK}` }}><span style={{ position: 'absolute', top: 2, left: cobrado ? 16 : 2, width: 14, height: 14, background: BLANCO, border: `2px solid ${INK}`, transition: 'left .15s' }} /></span></button>
                            }</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={totTd}>Total pendiente</td>
                        <td style={totTd} />
                        <td style={totTdN}>{futuros.reduce((s, c) => s + c.pedidos, 0)}</td>
                        <td style={totTd} />
                        <td style={totTdN}>{nf0(futuros.reduce((s, c) => s + c.bruto, 0))}</td>
                        <td style={{ ...totTdN, padding: 6, textAlign: 'center' }}><span style={{ display: 'inline-block', background: AMA, color: INK, fontFamily: OSW, fontWeight: 700, fontSize: 15, border: `3px solid ${INK}`, padding: '4px 10px' }}>{nf0(futuros.filter(c => !estaCobrado(c)).reduce((s, c) => s + c.neto, 0) * factor)}</span></td>
                        <td style={{ ...totTdN, color: AMA }}>{(() => { const b = futuros.reduce((s, c) => s + c.bruto, 0); return b > 0 ? ((futuros.reduce((s, c) => s + c.neto, 0) / b) * 100).toFixed(0) : '0' })()}%</td>
                        <td style={{ ...totTd, borderRight: 'none' }} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style={{ background: CLARO, borderTop: `3px solid ${INK}`, padding: '10px 14px', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: INK }}>Estado del cobro:</span>
                  {[{ c: AZUL, t: 'Pendiente · aún no vence' }, { c: ROJO, t: 'Vencido · a reclamar' }, { c: VERDE, t: 'Cobrado' }].map((it, k) => (
                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: LEX, fontSize: 12, color: INK }}>
                      <span style={{ width: 14, height: 14, background: it.c, border: `2px solid ${INK}`, display: 'inline-block' }} />{it.t}
                    </span>
                  ))}
                  <span style={{ fontFamily: LEX, fontSize: 11, color: RUNNING_MUT, marginLeft: 'auto' }}>Neto estimado · del 19-jun hacia atrás ya cobrado.</span>
                </div>
              </div>
            )}
          <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 10 }}>Desde el 20-jun: pendiente hasta que entra en banco o lo marcas a mano.</div>
        </div>
        {/* Derecha: caja por marca */}
        <div style={{ padding: `44px ${PAD}`, background: CLARO }}>
          <span style={eyebrow(INK, CREMA)}>Caja por marca · 90d · {porMarca.length} activas</span>
          {porMarca.length === 0
            ? <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 14 }}>Sin marcas activas.</div>
            : (() => {
                const max = Math.max(...porMarca.map(m => m.neto), 1)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
                    {porMarca.map((m, i) => {
                      const sin = m.neto <= 0
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 5 }}>
                            <span style={{ fontFamily: OSW, fontSize: 13, fontWeight: 700, color: sin ? GRIS : INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.marca}</span>
                            <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 15, color: sin ? GRIS : VERDE, flexShrink: 0 }}>{nf0(m.neto)}</span>
                          </div>
                          <div style={{ height: 14, background: TRACK, border: BORDER_CARD, boxShadow: SHADOW }}>
                            <div style={{ height: '100%', width: `${(m.neto / max) * 100}%`, background: sin ? GRIS : VERDE, borderRight: sin ? 'none' : `2px solid ${INK}` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()
          }
          <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 14 }}>Neto últimos 90 días · marcas activas en vivo desde configuración.</div>
        </div>
      </section>

      {/* ── SECCIÓN 5 · GASTOS DEL MES (grid 2fr 1fr, fondo CLARO) ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: `4px solid ${INK}` }}>
        {/* Izquierda: tabla gastos */}
        <div style={{ background: BLANCO, borderRight: `4px solid ${INK}`, padding: `44px ${PAD}` }}>
          <span style={eyebrow(ROJO, BLANCO)}>Gastos del mes · por categoría</span>
          {gastosCat.length === 0
            ? <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, marginTop: 14 }}>Sin facturas registradas este mes.</div>
            : (
              <div style={{ ...CONT, marginTop: 18 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                    <thead>
                      <tr>
                        <th style={thT}>Categoría</th>
                        <th style={thTR}>Facturas</th>
                        <th style={thTR}>Importe €</th>
                        <th style={thTR}>IVA €</th>
                        <th style={{ ...thTC, borderRight: 'none' }}>% mes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gastosCat.slice(0, 10).map((g, i) => {
                        const share = gastoMesTotal > 0 ? (g.total / gastoMesTotal) * 100 : 0
                        const band = share >= 25 ? ROJO : share >= 10 ? NAR : GRIS
                        return (
                          <tr key={i} style={{ background: zebra(i) }}>
                            <td style={{ ...tdT, borderLeft: `${BAND}px solid ${band}`, whiteSpace: 'normal' }}><span style={{ display: 'inline-block', width: 10, height: 10, background: band, border: `2px solid ${INK}`, marginRight: 8, verticalAlign: 'middle' }} />{g.nombre}</td>
                            <td style={{ ...tdTN, color: RUNNING_MUT, fontSize: 14 }}>{g.n}</td>
                            <td style={{ ...tdTN, color: ROJO }}>{nf0(g.total)}</td>
                            <td style={{ ...tdTN, color: RUNNING_MUT }}>{nf0(g.iva)}</td>
                            <td style={{ ...tdT, padding: 0, textAlign: 'center', borderRight: 'none' }}><div style={{ background: band, color: BLANCO, fontFamily: OSW, fontWeight: 700, fontSize: 16, padding: '8px 6px', borderLeft: `3px solid ${INK}` }}>{share.toFixed(0)}%</div></td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={totTd}>Total mes</td>
                        <td style={totTdN}>{nFacturasMes}</td>
                        <td style={{ ...totTdN, padding: 6 }}><span style={{ display: 'inline-block', background: AMA, color: INK, fontFamily: OSW, fontWeight: 700, fontSize: 15, border: `3px solid ${INK}`, padding: '4px 10px' }}>{nf0(gastoMesTotal)}</span></td>
                        <td style={totTdN}>{nf0(gastosCat.reduce((s, c) => s + c.iva, 0))}</td>
                        <td style={{ ...totTd, borderRight: 'none' }} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style={{ background: CLARO, borderTop: `3px solid ${INK}`, padding: '10px 14px', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: INK }}>Peso en el mes:</span>
                  {[{ c: ROJO, t: 'Gordo · ≥25%' }, { c: NAR, t: 'Medio · 10–25%' }, { c: GRIS, t: 'Menor · <10%' }].map((it, k) => (
                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: LEX, fontSize: 12, color: INK }}>
                      <span style={{ width: 14, height: 14, background: it.c, border: `2px solid ${INK}`, display: 'inline-block' }} />{it.t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 10 }}>Datos reales de facturas. El estado de pago/vencimiento aún no se registra.</div>
        </div>
        {/* Derecha: KPI gasto */}
        <div style={{ padding: `44px ${PAD}`, background: CLARO }}>
          <span style={eyebrow(INK, CREMA)}>Gasto del mes</span>
          <div style={{ marginTop: 22 }}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginBottom: 8 }}>Total facturado</div>
            <div style={d('clamp(44px,6vw,72px)', ROJO)}>{nf0(gastoMesTotal)}</div>
          </div>
          <div style={{ marginTop: 28 }}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Nº facturas</div>
            <div style={d('clamp(32px,4vw,52px)')}>{nFacturasMes}</div>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 6 · PENDIENTE DE ACTIVAR (TRACK) ── */}
      <section style={{ background: TRACK, padding: `44px ${PAD}` }}>
        <span style={eyebrow(INK, CREMA)}>Se activa al cargar datos</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 22 }}>
          {[
            { t: 'Recorte real vs previsto', desc: 'Reembolsos y penalizaciones de cada liquidación de plataforma.', dep: 'liquidaciones (vacías)' },
            { t: 'Coste de ADS y promos', desc: 'Descuento por publicidad y su efecto en el neto.', dep: 'liquidaciones (vacías)' },
            { t: 'Calendario 30/60/90', desc: 'Días con dinero y días secos.', dep: 'fecha de pago de gastos' },
          ].map((x, i) => (
            <div key={i} style={{ border: `2px dashed ${INK}`, padding: '16px 18px', background: BLANCO, boxShadow: SHADOW }}>
              <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', color: INK, marginBottom: 7 }}>{x.t}</div>
              <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginBottom: 8, lineHeight: 1.4 }}>{x.desc}</div>
              <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase', color: AZUL }}>Falta: {x.dep}</div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
