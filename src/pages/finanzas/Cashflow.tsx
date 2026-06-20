import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { COLOR, COLORS, LEXEND, OSWALD } from '@/components/panel/resumen/tokens'
import {
  calcNetoPorCanal, loadConfigCanales, recargarConfigCanales, loadMarcasPorCanal,
  type CanalConfig, type MarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'

/* ════════════════════════════════════════════════════════════
   CASH FLOW — pestaña del Panel Global
   Cobros (fechas de pago LEY por plataforma) · Caja por mes
   (banco real) con línea de saldo · Saldo banco + Runway reales ·
   Ingresos pendientes · Gastos del mes · Caja por marca (marcas
   activas en vivo desde configuración) · Simulador.
   ════════════════════════════════════════════════════════════ */

type Periodo = 'semana' | 'mes' | 'anio'
type Comp = 'prev' | 'mes' | 'anio'
type Sim = -10 | 0 | 10

const VERDE = '#1D9E75'
const ROJO = '#E24B4A'
const AMARILLO = '#f5a623'
const AZUL = '#185FA5'
const GRIS = '#9ba3af'
const BORDE = '#d0c8bc'
const TINTA = '#1e2233'
const POS = VERDE, WARN = AMARILLO, NEG = ROJO

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const CANALES = [
  { id: 'uber', label: 'Uber Eats', color: COLOR.uber, bk: 'uber_bruto', pk: 'uber_pedidos' },
  { id: 'glovo', label: 'Glovo', color: '#c9a900', bk: 'glovo_bruto', pk: 'glovo_pedidos' },
  { id: 'je', label: 'Just Eat', color: COLOR.je, bk: 'je_bruto', pk: 'je_pedidos' },
  { id: 'web', label: 'Web', color: COLOR.webSL, bk: 'web_bruto', pk: 'web_pedidos' },
  { id: 'dir', label: 'Directa', color: COLOR.directa, bk: 'directa_bruto', pk: 'directa_pedidos' },
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
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [comp, setComp] = useState<Comp>('mes')
  const [sim, setSim] = useState<Sim>(0)
  const setPeriodoP = (p: Periodo) => { setPeriodo(p); if (p !== 'semana' && comp === 'prev') setComp('mes') }

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

  useEffect(() => {
    loadConfigCanales().then(setConfig); loadMarcasPorCanal().then(setMarcasPorCanal)
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

  async function toggleCobrado(c: Cobro) {
    const k = claveCobro(c)
    const nuevo = !cobradoMap[k]
    setCobradoMap(prev => ({ ...prev, [k]: nuevo }))
    await supabase.from('cashflow_cobros_estado').upsert({
      clave: k, canal: c.canal, ini: c.ini, fin: c.fin, pago: c.pago, cobrado: nuevo, marcado_at: new Date().toISOString(),
    })
  }

  const hoy = toLocal(new Date())
  const factor = 1 + sim / 100

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
      const { neto } = calcNetoPorCanal(g.canal.id, g.bruto, g.ped, {
        modo: 'agregado_canal', marcasPorCanal, fechaDesde: parse(g.ini), fechaHasta: parse(g.fin), configCanales: config, diasConDatos: g.dias.size,
      })
      out.push({ canal: g.canal.id, label: g.canal.label, color: g.canal.color, ini: g.ini, fin: g.fin, pago: g.pago, bruto: g.bruto, neto, pedidos: g.ped, futuro: g.pago > hoy })
    }
    return out.sort((a, b) => (a.pago < b.pago ? -1 : 1))
  }, [aggDia, config, marcasPorCanal, festivos, loading, hoy])

  const futuros = useMemo(() => cobros.filter(c => c.pago > hoy).sort((a, b) => (a.pago < b.pago ? -1 : 1)), [cobros, hoy])
  const porCobrarTotal = useMemo(() => futuros.filter(c => !cobradoMap[claveCobro(c)]).reduce((s, c) => s + c.neto, 0) * factor, [futuros, factor, cobradoMap])
  const finMesStr = useMemo(() => { const d = new Date(); return toLocal(finDeMes(d.getFullYear(), d.getMonth())) }, [])
  const hastaFinMes = useMemo(() => futuros.filter(c => c.pago <= finMesStr).reduce((s, c) => s + c.neto, 0) * factor, [futuros, finMesStr, factor])

  const porCanal = useMemo(() => CANALES.map(c => {
    const list = futuros.filter(x => x.canal === c.id)
    return { id: c.id, label: c.label, color: c.color, neto: list.reduce((s, x) => s + x.neto, 0) * factor }
  }), [futuros, factor])
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
    for (const c of futuros) m.set(c.pago, (m.get(c.pago) ?? 0) + c.neto * factor)
    let best: { pago: string; total: number } | null = null
    for (const [pago, total] of m) if (!best || total > best.total) best = { pago, total }
    return best
  }, [futuros, factor])

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
    if (grueso && porCobrarTotal > 0) { const r = grueso.total / porCobrarTotal; out.push({ txt: `El grueso entra el ${fmtLarga(grueso.pago)}: ${nf0(grueso.total)}, ${r >= 0.5 ? 'más de la mitad' : 'el ' + (r * 100).toFixed(0) + '%'} de lo que tienes pendiente.`, color: POS }) }
    if (topPlat && topPlat.neto > 0 && porCobrarTotal > 0) { const pct = (topPlat.neto / porCobrarTotal) * 100; if (pct >= 45) out.push({ txt: `${topPlat.label} son ${Math.round(pct / 10)} de cada 10 € que te quedan por cobrar.`, color: pct >= 65 ? WARN : COLOR.textSec }) }
    if (runwaySem > 0) out.push({ txt: runwaySem >= 12 ? `Con la caja del banco (${nf0(saldoBanco)}) y tu ritmo de gasto, tienes colchón para unas ${Math.round(runwaySem)} semanas.` : `Colchón ajustado: la caja del banco (${nf0(saldoBanco)}) da para unas ${Math.round(runwaySem)} semanas al ritmo de gasto actual.`, color: runwaySem >= 12 ? POS : WARN })
    return out
  }, [grueso, topPlat, porCobrarTotal, runwaySem, saldoBanco])

  const cTabs = periodo === 'semana'
    ? [{ id: 'prev', label: 'vs sem. ant.' }, { id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
    : [{ id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
  const pTabs: { id: Periodo; label: string }[] = [{ id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }, { id: 'anio', label: 'Año' }]
  const simTabs: { id: Sim; label: string }[] = [{ id: -10, label: '−10%' }, { id: 0, label: 'Real' }, { id: 10, label: '+10%' }]

  const card: CSSProperties = { background: '#fff', border: `0.5px solid ${BORDE}`, borderRadius: 16, padding: '16px 18px' }
  const lblS: CSSProperties = { fontFamily: OSWALD, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: COLOR.textMut, marginBottom: 10 }
  const SUBC: CSSProperties = { display: 'inline-flex', gap: 4, padding: '3px 4px', borderRadius: 10, background: COLORS.accent, border: `0.5px solid ${COLORS.accent}` }
  const subA: CSSProperties = { padding: '4px 10px', borderRadius: 6, border: 'none', background: '#fff', color: COLORS.pri, fontFamily: OSWALD, fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer' }
  const subI: CSSProperties = { padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.25)', color: '#fff', fontFamily: OSWALD, fontSize: 10, fontWeight: 500, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer' }
  const th: CSSProperties = { padding: '7px 8px', textAlign: 'right', fontFamily: OSWALD, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: COLOR.textMut, borderBottom: `1px solid ${BORDE}` }
  const tdL: CSSProperties = { padding: '7px 8px', textAlign: 'left', fontFamily: LEXEND, fontSize: 12.5 }
  const tdR: CSSProperties = { padding: '7px 8px', textAlign: 'right', fontFamily: OSWALD, fontSize: 13 }
  const kpi: CSSProperties = { background: '#faf8f4', borderRadius: 10, padding: '10px 12px' }
  const kpiL: CSSProperties = { fontFamily: OSWALD, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: COLOR.textMut }
  const kpiV: CSSProperties = { fontFamily: OSWALD, fontSize: 23, fontWeight: 700, lineHeight: 1.1 }
  const ex: CSSProperties = { fontSize: 10, color: '#b9b3a8', marginTop: 6 }
  const dot = (c: string): CSSProperties => ({ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, marginRight: 6 })

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textSec, fontFamily: LEXEND }}>Cargando…</div>

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
    <div style={{ fontFamily: LEXEND, color: COLOR.textPri, paddingTop: 18 }}>

      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
          <TabsPastilla tabs={cTabs} activeId={comp} onChange={id => setComp(id as Comp)} />
          <div style={{ width: 1, height: 22, background: COLORS.brd, margin: '0 2px' }} />
          <div style={SUBC}>{pTabs.map(t => <button key={t.id} onClick={() => setPeriodoP(t.id)} style={periodo === t.id ? subA : subI}>{t.label}</button>)}</div>
          <div style={{ flex: 1 }} />
          <span style={{ ...lblS, margin: 0, fontSize: 10 }}>Simulador</span>
          <div style={SUBC}>{simTabs.map(t => <button key={t.id} onClick={() => setSim(t.id)} style={sim === t.id ? subA : subI}>{t.label}</button>)}</div>
        </div>
        <div style={{ fontFamily: OSWALD, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 600, lineHeight: 1.05 }}>
          POR COBRAR <span style={{ color: VERDE }}>{nf0(porCobrarTotal)}</span>
          {sim !== 0 && <span style={{ color: COLOR.textMut, fontSize: '0.5em', marginLeft: 10 }}>· simulación {sim > 0 ? '+' : ''}{sim}%</span>}
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {frases.map((f, i) => <div key={i} style={{ fontFamily: OSWALD, fontSize: 'clamp(16px,2.1vw,20px)', fontWeight: 600, color: f.color, letterSpacing: '0.3px' }}>{f.txt}</div>)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={card}>
          <div style={lblS}>Cobros · cobrado y previsto · neto</div>
          {graf.length === 0 ? <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textMut, padding: '20px 0' }}>Sin cobros en el horizonte.</div> : (
            <div style={{ position: 'relative' }}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                {[0, 1, 2, 3].map(g => { const v = maxY / 3 * g; const y = Y(v); return (<g key={g}><line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="#efece6" /><text x={P.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill={GRIS} fontFamily="Lexend">{nf0(v)}</text></g>) })}
                {idxFut > 0 && (() => { const xh = (X(idxFut - 1) + X(idxFut)) / 2; return (<g><line x1={xh} y1={P.t} x2={xh} y2={H - P.b} stroke={COLORS.accent} strokeWidth="1" strokeDasharray="3 3" /><text x={xh} y={P.t - 6} textAnchor="middle" fontSize="9" fill={COLORS.accent} fontFamily="Oswald">HOY</text></g>) })()}
                {graf.length > 1 && <polyline points={graf.map((p, i) => `${X(i)} ${Y(p.total)}`).join(' ')} fill="none" stroke={VERDE} strokeWidth="2.5" />}
                {graf.map((p, i) => (<g key={i}><circle cx={X(i)} cy={Y(p.total)} r={hover === i ? 6 : 4} fill={p.futuro ? '#fff' : VERDE} stroke={VERDE} strokeWidth="2" style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} /><text x={X(i)} y={H - P.b + 14} textAnchor="middle" fontSize="9" fill={GRIS} fontFamily="Lexend">{fmtCorta(p.pago)}</text></g>))}
              </svg>
              {hover != null && graf[hover] && (
                <div style={{ position: 'absolute', left: `${(X(hover) / W) * 100}%`, top: `${(Y(graf[hover].total) / H) * 100}%`, transform: 'translate(-50%, calc(-100% - 12px))', background: COLORS.modal, color: '#fff', borderRadius: 10, padding: '10px 12px', minWidth: 160, pointerEvents: 'none', zIndex: 5, boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }}>
                  <div style={{ fontFamily: OSWALD, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>{fmtLarga(graf[hover].pago)}</div>
                  {graf[hover].items.map((it, k) => (<div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontFamily: LEXEND, fontSize: 12, marginBottom: 2 }}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: it.color }} />{it.label}</span><span style={{ fontFamily: OSWALD, fontWeight: 600 }}>{nf0(it.neto)}</span></div>))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 6, paddingTop: 6, borderTop: '0.5px solid rgba(255,255,255,0.25)', fontFamily: OSWALD, fontSize: 13, fontWeight: 700 }}><span>{graf[hover].futuro ? 'Previsto' : 'Cobrado'}</span><span>{nf0(graf[hover].total)}</span></div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: COLOR.textSec, marginTop: 8 }}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: VERDE }} />Cobrado</span><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', border: `2px solid ${VERDE}` }} />Previsto</span></div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={kpi}><div style={kpiL}>Por cobrar</div><div style={{ ...kpiV, color: VERDE }}>{nf0(porCobrarTotal)}</div></div>
          <div style={kpi}><div style={kpiL}>Hasta fin de mes</div><div style={{ ...kpiV, color: VERDE }}>{nf0(hastaFinMes)}</div></div>
          <div style={kpi}><div style={kpiL}>Saldo banco</div><div style={{ ...kpiV, color: saldoBanco >= 0 ? VERDE : ROJO }}>{nf0(saldoBanco)}</div><div style={{ ...ex, margin: 0 }}>a {ultimoMov || '—'}</div></div>
          <div style={kpi}><div style={kpiL}>Runway</div><div style={{ ...kpiV, color: runwaySem >= 12 ? VERDE : runwaySem > 0 ? AMARILLO : GRIS }}>{runwaySem > 0 ? Math.round(runwaySem) : '—'} sem.</div><div style={{ ...ex, margin: 0 }}>saldo ÷ gasto medio</div></div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 12 }}>
        <div style={lblS}>Caja por mes · banco real · línea = saldo</div>
        <svg viewBox={`0 0 ${CW} 170`} style={{ width: '100%', height: 'auto' }}>
          <line x1={40} y1={cb} x2={CW - 10} y2={cb} stroke="#e6e1d8" />
          {cruce.map((c, i) => { const x = cx(i); return (
            <g key={i}>
              <rect x={x - 19} y={cb - barH(c.ingresos)} width={16} height={barH(c.ingresos)} fill={VERDE} rx={3} />
              <rect x={x + 3} y={cb - barH(c.gastos)} width={16} height={barH(c.gastos)} fill={ROJO} rx={3} />
              <text x={x} y={cb + 16} textAnchor="middle" fontSize="9" fill={COLOR.textSec} fontFamily="Lexend">{c.label}</text>
              <text x={x} y={cb + 32} textAnchor="middle" fontSize="10" fill={c.margen >= 0 ? VERDE : ROJO} fontFamily="Oswald">{c.margen >= 0 ? '+' : ''}{nf0(c.margen)}</text>
            </g>) })}
          <polyline points={cruce.map((c, i) => `${cx(i)} ${ySaldo(c.margen)}`).join(' ')} fill="none" stroke={TINTA} strokeWidth="2.5" />
          {cruce.map((c, i) => <circle key={i} cx={cx(i)} cy={ySaldo(c.margen)} r={3.5} fill={c.margen >= 0 ? TINTA : ROJO} />)}
        </svg>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: COLOR.textSec, marginTop: 4 }}>
          <span><span style={dot(VERDE)} />Ingresos</span><span><span style={dot(ROJO)} />Gastos</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 0, borderTop: `2px solid ${TINTA}` }} />Saldo</span>
        </div>
        <div style={ex}>Movimientos reales del banco{ultimoMov ? ` · última importación: ${ultimoMov}` : ''}.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={card}>
          <div style={lblS}>Ingresos pendientes · por liquidación</div>
          {futuros.length === 0 ? <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textMut }}>Sin cobros pendientes.</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...th, textAlign: 'left' }}>Plataforma</th><th style={{ ...th, textAlign: 'left' }}>Ventas de</th><th style={th}>Ped.</th><th style={{ ...th, textAlign: 'left' }}>Cobro</th><th style={th}>Bruto</th><th style={th}>Neto</th><th style={th}>% neto</th><th style={{ ...th, textAlign: 'center' }}>Estado</th></tr></thead>
              <tbody>
                {futuros.map((c, i) => { const pct = c.bruto > 0 ? (c.neto / c.bruto) * 100 : 0; const cobrado = !!cobradoMap[claveCobro(c)]; return (
                  <tr key={i} style={{ borderTop: i ? `0.5px solid #f3efe8` : undefined, opacity: cobrado ? 0.5 : 1 }}>
                    <td style={tdL}><span style={dot(c.color)} />{c.label}</td>
                    <td style={{ ...tdL, color: COLOR.textSec }}>{periodoTxt(c.canal, c.ini, c.fin)}</td>
                    <td style={tdR}>{c.pedidos}</td>
                    <td style={tdL}>{fmtCorta(c.pago)}</td>
                    <td style={{ ...tdR, color: COLOR.textPri }}>{nf0(c.bruto)}</td>
                    <td style={{ ...tdR, fontWeight: 700, color: VERDE, textDecoration: cobrado ? 'line-through' : 'none' }}>{nf0(c.neto * factor)}</td>
                    <td style={{ ...tdR, color: pct >= 58 ? '#3b6d11' : '#c47f12' }}>{pct.toFixed(1)}%</td>
                    <td style={{ ...tdR, textAlign: 'center' }}><button onClick={() => toggleCobrado(c)} style={{ cursor: 'pointer', border: 'none', borderRadius: 999, padding: '3px 10px', fontFamily: OSWALD, fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 700, background: cobrado ? VERDE : '#ece8e1', color: cobrado ? '#fff' : COLOR.textMut }}>{cobrado ? '✓ Cobrado' : 'Pendiente'}</button></td>
                  </tr>) })}
                <tr style={{ borderTop: `1.5px solid ${BORDE}` }}>
                  <td style={{ ...tdL, fontFamily: OSWALD, fontWeight: 700 }}>TOTAL</td><td></td>
                  <td style={{ ...tdR, fontWeight: 700 }}>{futuros.reduce((s, c) => s + c.pedidos, 0)}</td><td></td>
                  <td style={{ ...tdR, fontWeight: 700 }}>{nf0(futuros.reduce((s, c) => s + c.bruto, 0))}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: VERDE }}>{nf0(porCobrarTotal)}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: COLOR.textSec }}>{(() => { const b = futuros.reduce((s, c) => s + c.bruto, 0); return b > 0 ? ((futuros.reduce((s, c) => s + c.neto, 0) / b) * 100).toFixed(1) : '0' })()}%</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}
          <div style={ex}>Datos reales · neto con la calculadora central. Marca cada liquidación como cobrada cuando entre el dinero: lo que sigue pendiente es lo que baja del total «por cobrar».</div>
        </div>
        <div style={card}>
          <div style={lblS}>Caja por marca · 90d · {porMarca.length} activas</div>
          {porMarca.length === 0 ? <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLOR.textMut }}>Sin marcas activas.</div> : (() => { const max = Math.max(...porMarca.map(m => m.neto), 1); return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
              {porMarca.map((m, i) => { const sin = m.neto <= 0; return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND, fontSize: 11, marginBottom: 3, gap: 6 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: sin ? COLOR.textMut : COLOR.textSec }}>{m.marca}</span><span style={{ fontFamily: OSWALD, fontWeight: 700, color: sin ? GRIS : VERDE }}>{nf0(m.neto)}</span></div>
                  <div style={{ height: 6, background: '#ece8e1', borderRadius: 4 }}><div style={{ height: 6, width: `${(m.neto / max) * 100}%`, background: sin ? '#e0dccf' : VERDE, borderRadius: 4 }} /></div>
                </div>) })}
            </div>) })()}
          <div style={ex}>Neto últimos 90 días · marcas activas en vivo desde configuración.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={card}>
          <div style={lblS}>Gastos del mes · por categoría</div>
          {gastosCat.length === 0 ? <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textMut }}>Sin facturas registradas este mes.</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...th, textAlign: 'left' }}>Categoría</th><th style={th}>Facturas</th><th style={th}>Importe</th><th style={th}>IVA</th></tr></thead>
              <tbody>
                {gastosCat.slice(0, 10).map((g, i) => (
                  <tr key={i} style={{ borderTop: i ? `0.5px solid #f3efe8` : undefined }}>
                    <td style={tdL}><span style={dot(ROJO)} />{g.nombre}</td>
                    <td style={{ ...tdR, color: COLOR.textMut, fontFamily: LEXEND, fontSize: 12 }}>{g.n}</td>
                    <td style={{ ...tdR, fontWeight: 700, color: ROJO }}>{nf0(g.total)}</td>
                    <td style={{ ...tdR, color: COLOR.textSec }}>{nf0(g.iva)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `1.5px solid ${BORDE}` }}>
                  <td style={{ ...tdL, fontFamily: OSWALD, fontWeight: 700 }}>TOTAL MES</td>
                  <td style={{ ...tdR, fontWeight: 700 }}>{nFacturasMes}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: ROJO }}>{nf0(gastoMesTotal)}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: COLOR.textSec }}>{nf0(gastosCat.reduce((s, c) => s + c.iva, 0))}</td>
                </tr>
              </tbody>
            </table>
          )}
          <div style={ex}>Datos reales de facturas. El estado de pago/vencimiento aún no se registra.</div>
        </div>
        <div style={card}>
          <div style={lblS}>Gasto del mes</div>
          <div style={{ ...kpi, marginBottom: 8 }}><div style={kpiL}>Total facturado</div><div style={{ ...kpiV, color: ROJO }}>{nf0(gastoMesTotal)}</div></div>
          <div style={kpi}><div style={kpiL}>Nº facturas</div><div style={{ ...kpiV, color: COLOR.textPri }}>{nFacturasMes}</div></div>
        </div>
      </div>

      <div style={card}>
        <div style={lblS}>Se activa al cargar datos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
          {[
            { t: 'Recorte real vs previsto', d: 'Reembolsos y penalizaciones de cada liquidación de plataforma.', dep: 'liquidaciones (vacías)' },
            { t: 'Coste de ADS y promos', d: 'Descuento por publicidad y su efecto en el neto.', dep: 'liquidaciones (vacías)' },
            { t: 'Conciliación cobro ↔ banco', d: 'Casar cada cobro previsto con su abono real en el banco.', dep: 'cruce automático (en desarrollo)' },
            { t: 'Calendario 30/60/90', d: 'Días con dinero y días secos.', dep: 'fecha de pago de gastos' },
          ].map((x, i) => (
            <div key={i} style={{ border: `1px dashed ${BORDE}`, borderRadius: 11, padding: '10px 12px', background: '#faf8f4' }}>
              <div style={{ fontFamily: OSWALD, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: COLOR.textSec, marginBottom: 5 }}>{x.t}</div>
              <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLOR.textMut, marginBottom: 6 }}>{x.d}</div>
              <div style={{ fontFamily: OSWALD, fontSize: 9, letterSpacing: '0.5px', textTransform: 'uppercase', color: AZUL }}>Falta: {x.dep}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
