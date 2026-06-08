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
   Ingresos (cobros por plataforma, fechas reales) · Gastos reales
   (facturas) · Cruce de caja por mes · IVA · por Marca · Simulador.
   Neto siempre vía calcNetoPorCanal. Sin inventar: lo que no tiene
   dato fuente se muestra como "pendiente de cargar".
   ════════════════════════════════════════════════════════════ */

type Periodo = 'semana' | 'mes' | 'anio'
type Comp = 'prev' | 'mes' | 'anio'
type Sim = -10 | 0 | 10

const VERDE = '#1D9E75'
const ROJO = '#E24B4A'
const AMARILLO = '#f5a623'
const AZUL = '#1E5BCC'
const GRIS = '#9ba3af'
const BORDE = '#d0c8bc'
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

// Fallback si la tabla festivos está vacía (Madrid 2026)
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
  const [festivos, setFestivos] = useState<Set<string>>(new Set(FESTIVOS_FALLBACK))
  const [config, setConfig] = useState<Record<string, CanalConfig>>({})
  const [marcasPorCanal, setMarcasPorCanal] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })
  const [loading, setLoading] = useState(true)
  const [hover, setHover] = useState<number | null>(null)

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
    ]).then(([rd, rf, rc, rfe, rm]) => {
      setRows((rd.data as Row[]) ?? [])
      setFacturas(((rf.data as Factura[]) ?? []).filter(f => f.fecha_factura))
      const cm: Record<string, string> = {}
      for (const c of (rc.data ?? []) as { codigo: string; nombre: string }[]) cm[c.codigo] = c.nombre
      setCatNombres(cm)
      const fe = (rfe.data ?? []) as { fecha: string }[]
      if (fe.length) setFestivos(new Set(fe.map(x => x.fecha.slice(0, 10))))
      setVentasMarca((rm.data as VentaMarca[]) ?? [])
      setLoading(false)
    })
  }, [])

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

  const futuros = useMemo(() => cobros.filter(c => c.pago > hoy), [cobros, hoy])
  const porCobrarTotal = useMemo(() => futuros.reduce((s, c) => s + c.neto, 0) * factor, [futuros, factor])
  const proximo = futuros[0] ?? null

  // Por cobrar por plataforma (orden fijo)
  const porCanal = useMemo(() => CANALES.map(c => {
    const list = futuros.filter(x => x.canal === c.id)
    return { id: c.id, label: c.label, color: c.color, bruto: list.reduce((s, x) => s + x.bruto, 0) * factor, neto: list.reduce((s, x) => s + x.neto, 0) * factor, prox: list.map(x => x.pago).sort()[0] ?? null }
  }), [futuros, factor])
  const topPlat = useMemo(() => [...porCanal].sort((a, b) => b.neto - a.neto)[0] ?? null, [porCanal])

  // Gráfico cobros (cobrado + previsto) alrededor de hoy
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

  // GASTOS reales (facturas proveedor) — por categoría y por mes
  const mesActual = hoy.slice(0, 7)
  const gastosCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of facturas) {
      if ((f.fecha_factura ?? '').slice(0, 7) !== mesActual) continue
      const nom = f.categoria_factura ? (catNombres[f.categoria_factura] ?? f.categoria_factura) : 'Sin categoría'
      m.set(nom, (m.get(nom) ?? 0) + Number(f.total || 0))
    }
    return [...m.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total)
  }, [facturas, catNombres, mesActual])
  const gastoMesTotal = useMemo(() => gastosCat.reduce((s, c) => s + c.total, 0), [gastosCat])

  function gastoDeMes(ym: string) { return facturas.filter(f => (f.fecha_factura ?? '').slice(0, 7) === ym).reduce((s, f) => s + Number(f.total || 0), 0) }
  function cobrosNetoDeMes(ym: string) { return cobros.filter(c => c.pago.slice(0, 7) === ym).reduce((s, c) => s + c.neto, 0) }

  // CRUCE caja por mes (últimos 6 meses)
  const cruce = useMemo(() => {
    const out: { ym: string; label: string; ingresos: number; gastos: number; margen: number }[] = []
    const base = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const ingresos = cobrosNetoDeMes(ym); const gastos = gastoDeMes(ym)
      out.push({ ym, label: MESES[d.getMonth()], ingresos, gastos, margen: ingresos - gastos })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobros, facturas])
  const margenMesActual = useMemo(() => (cruce.find(c => c.ym === mesActual)?.margen ?? 0), [cruce, mesActual])

  // IVA (informativo): repercutido estimado en ventas (10%) vs soportado real (facturas) del mes
  const ivaMes = useMemo(() => {
    const brutoMes = [...aggDia.entries()].filter(([f]) => f.slice(0, 7) === mesActual).reduce((s, [, a]) => s + CANALES.reduce((ss, c) => ss + (a[c.bk] ?? 0), 0), 0)
    const repercutido = brutoMes - brutoMes / 1.10
    const soportado = facturas.filter(f => (f.fecha_factura ?? '').slice(0, 7) === mesActual).reduce((s, f) => s + Number(f.total_iva || 0), 0)
    return { repercutido, soportado, saldo: repercutido - soportado }
  }, [aggDia, facturas, mesActual])

  // Por marca (últimos 90 días)
  const porMarca = useMemo(() => {
    const m = new Map<string, { neto: number; bruto: number }>()
    for (const v of ventasMarca) { const e = m.get(v.marca) ?? { neto: 0, bruto: 0 }; e.neto += Number(v.neto || 0); e.bruto += Number(v.bruto || 0); m.set(v.marca, e) }
    return [...m.entries()].map(([marca, x]) => ({ marca, ...x })).sort((a, b) => b.neto - a.neto).slice(0, 6)
  }, [ventasMarca])

  const frases = useMemo(() => {
    const out: { txt: string; color: string }[] = []
    if (grueso && porCobrarTotal > 0) out.push({ txt: `El grueso entra el ${fmtLarga(grueso.pago)}: ${nf0(grueso.total)}, el ${((grueso.total / porCobrarTotal) * 100).toFixed(0)}% de lo pendiente.`, color: POS })
    if (topPlat && topPlat.neto > 0 && porCobrarTotal > 0) { const pct = (topPlat.neto / porCobrarTotal) * 100; if (pct >= 45) out.push({ txt: `${topPlat.label} concentra el ${pct.toFixed(0)}% de lo que queda por cobrar.`, color: pct >= 65 ? WARN : COLOR.textSec }) }
    if (gastoMesTotal > 0) out.push({ txt: margenMesActual >= 0 ? `Este mes la caja va en positivo: cobros menos gastos dejan +${nf0(margenMesActual)}.` : `Atención: este mes los gastos superan a los cobros en ${nf0(Math.abs(margenMesActual))}.`, color: margenMesActual >= 0 ? POS : NEG })
    return out
  }, [grueso, topPlat, porCobrarTotal, gastoMesTotal, margenMesActual])

  const cTabs = periodo === 'semana'
    ? [{ id: 'prev', label: 'vs sem. ant.' }, { id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
    : [{ id: 'mes', label: 'vs mes ant.' }, { id: 'anio', label: 'vs año ant.' }]
  const pTabs: { id: Periodo; label: string }[] = [{ id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }, { id: 'anio', label: 'Año' }]
  const simTabs: { id: Sim; label: string }[] = [{ id: -10, label: '−10%' }, { id: 0, label: 'Real' }, { id: 10, label: '+10%' }]

  const card: CSSProperties = { background: '#fff', border: `0.5px solid ${BORDE}`, borderRadius: 16, padding: '18px 20px' }
  const lblS: CSSProperties = { fontFamily: OSWALD, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: COLOR.textMut }
  const SUBTAB_CONTAINER: CSSProperties = { display: 'inline-flex', gap: 4, padding: '3px 4px', borderRadius: 10, background: COLORS.accent, border: `0.5px solid ${COLORS.accent}` }
  const subA: CSSProperties = { padding: '4px 10px', borderRadius: 6, border: 'none', background: '#fff', color: COLORS.pri, fontFamily: OSWALD, fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer' }
  const subI: CSSProperties = { padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.25)', color: '#fff', fontFamily: OSWALD, fontSize: 10, fontWeight: 500, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer' }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textSec, fontFamily: LEXEND }}>Cargando…</div>

  const W = 720, H = 220, pad = { l: 44, r: 16, t: 22, b: 30 }
  const ix = W - pad.l - pad.r, iy = H - pad.t - pad.b
  const maxY = Math.max(...graf.map(p => p.total), 1) * 1.15
  const X = (i: number) => pad.l + ix * (graf.length <= 1 ? 0.5 : i / (graf.length - 1))
  const Y = (v: number) => pad.t + iy * (1 - v / maxY)
  const idxFuturo = graf.findIndex(p => p.futuro)
  const maxCruce = Math.max(...cruce.map(c => Math.max(c.ingresos, c.gastos)), 1)

  return (
    <div style={{ fontFamily: LEXEND, color: COLOR.textPri, paddingTop: 18 }}>

      {/* CABECERA */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 16, flexWrap: 'wrap' }}>
          <TabsPastilla tabs={cTabs} activeId={comp} onChange={id => setComp(id as Comp)} />
          <div style={{ width: 1, height: 24, background: COLORS.brd, margin: '0 2px' }} />
          <div style={SUBTAB_CONTAINER}>{pTabs.map(t => <button key={t.id} onClick={() => setPeriodoP(t.id)} style={periodo === t.id ? subA : subI}>{t.label}</button>)}</div>
          <div style={{ flex: 1 }} />
          <span style={{ ...lblS, fontSize: 10 }}>Simulador</span>
          <div style={SUBTAB_CONTAINER}>{simTabs.map(t => <button key={t.id} onClick={() => setSim(t.id)} style={sim === t.id ? subA : subI}>{t.label}</button>)}</div>
        </div>

        <div style={{ fontFamily: OSWALD, fontSize: 'clamp(28px,4.2vw,44px)', fontWeight: 600, lineHeight: 1.04 }}>
          POR COBRAR <span style={{ color: VERDE }}>{nf0(porCobrarTotal)}</span>
          {sim !== 0 && <span style={{ color: COLOR.textMut, fontSize: '0.5em', marginLeft: 10 }}>· simulación {sim > 0 ? '+' : ''}{sim}% ventas</span>}
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: OSWALD, fontSize: 'clamp(18px,2.6vw,26px)', fontWeight: 600 }}>
            <span style={{ color: COLOR.textSec }}>{futuros.length} cobros pendientes</span>
            {proximo && <><span style={{ color: COLOR.textMut }}> · </span><span style={{ color: VERDE }}>próximo {fmtCorta(proximo.pago)}</span></>}
            <span style={{ color: COLOR.textMut }}> · </span>
            <span style={{ color: margenMesActual >= 0 ? VERDE : ROJO }}>caja mes {margenMesActual >= 0 ? '+' : ''}{nf0(margenMesActual)}</span>
          </div>
          {frases.map((f, i) => <div key={i} style={{ fontFamily: OSWALD, fontSize: 'clamp(16px,2.2vw,21px)', fontWeight: 600, color: f.color, letterSpacing: '0.3px' }}>{f.txt}</div>)}
        </div>
      </div>

      {/* GRÁFICO cobros */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ ...lblS, marginBottom: 4 }}>Cobros · cobrado y previsto · neto</div>
        {graf.length === 0 ? <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textMut, padding: '20px 0' }}>Sin cobros en el horizonte.</div> : (
          <div style={{ position: 'relative' }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
              {[0, 1, 2, 3].map(g => { const v = maxY / 3 * g; const y = Y(v); return (<g key={g}><line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#efece6" /><text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill={GRIS} fontFamily="Lexend">{nf0(v)}</text></g>) })}
              {idxFuturo > 0 && (() => { const xh = (X(idxFuturo - 1) + X(idxFuturo)) / 2; return (<g><line x1={xh} y1={pad.t} x2={xh} y2={H - pad.b} stroke={COLORS.accent} strokeWidth="1" strokeDasharray="3 3" /><text x={xh} y={pad.t - 6} textAnchor="middle" fontSize="9" fill={COLORS.accent} fontFamily="Oswald">HOY</text></g>) })()}
              {graf.length > 1 && <polyline points={graf.map((p, i) => `${X(i)} ${Y(p.total)}`).join(' ')} fill="none" stroke={VERDE} strokeWidth="2.5" />}
              {graf.map((p, i) => (<g key={i}><circle cx={X(i)} cy={Y(p.total)} r={hover === i ? 6 : 4} fill={p.futuro ? '#fff' : VERDE} stroke={VERDE} strokeWidth="2" style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} /><text x={X(i)} y={H - pad.b + 14} textAnchor="middle" fontSize="9" fill={GRIS} fontFamily="Lexend">{fmtCorta(p.pago)}</text></g>))}
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

      {/* POR PLATAFORMA */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ ...lblS, marginBottom: 12 }}>Por cobrar · por plataforma</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${CANALES.length}, 1fr)`, gap: 10 }}>
          {porCanal.map(c => (
            <div key={c.id} style={{ background: `${c.color}1a`, border: `0.5px solid ${c.color}`, borderRadius: 14, padding: '16px 18px', opacity: c.neto > 0 ? 1 : 0.55 }}>
              <div style={{ fontFamily: OSWALD, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: c.color, marginBottom: 8 }}>{c.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', alignItems: 'baseline' }}>
                <span style={{ fontFamily: OSWALD, fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', color: COLOR.textMut }}>Bruto</span>
                <span style={{ fontFamily: OSWALD, fontSize: 20, fontWeight: 600, color: '#111', textAlign: 'right' }}>{nf0(c.bruto)}</span>
                <span style={{ fontFamily: OSWALD, fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', color: VERDE }}>Neto</span>
                <span style={{ fontFamily: OSWALD, fontSize: 25, fontWeight: 700, color: VERDE, textAlign: 'right' }}>{nf0(c.neto)}</span>
              </div>
              <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLOR.textMut, marginTop: 8 }}>{c.prox ? `Próximo: ${fmtCorta(c.prox)}` : 'Cobro inmediato'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CRUCE INGRESOS vs GASTOS por mes */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ ...lblS, marginBottom: 12 }}>Caja por mes · cobros netos vs gastos</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, paddingTop: 10 }}>
          {cruce.map((c, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 130, width: '100%', justifyContent: 'center' }}>
                <div style={{ width: '34%', height: `${Math.max((c.ingresos / maxCruce) * 100, 1)}%`, background: VERDE, borderRadius: '4px 4px 0 0' }} title={`Cobros: ${nf0(c.ingresos)}`} />
                <div style={{ width: '34%', height: `${Math.max((c.gastos / maxCruce) * 100, 1)}%`, background: ROJO, borderRadius: '4px 4px 0 0' }} title={`Gastos: ${nf0(c.gastos)}`} />
              </div>
              <span style={{ fontFamily: LEXEND, fontSize: 12, color: COLOR.textSec, marginTop: 6 }}>{c.label}</span>
              <span style={{ fontFamily: OSWALD, fontSize: 13, fontWeight: 700, color: c.margen >= 0 ? VERDE : ROJO }}>{c.margen >= 0 ? '+' : ''}{nf0(c.margen)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: COLOR.textSec, marginTop: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: VERDE }} />Cobros netos</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: ROJO }} />Gastos (facturas)</span>
        </div>
      </div>

      {/* GASTOS del mes por categoría + IVA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ ...lblS, marginBottom: 12 }}>Gastos del mes · por categoría</div>
          {gastosCat.length === 0 ? <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textMut }}>Sin gastos registrados este mes.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {gastosCat.slice(0, 8).map((g, i) => { const pct = gastoMesTotal > 0 ? (g.total / gastoMesTotal) * 100 : 0; return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND, fontSize: 12.5, marginBottom: 3 }}><span style={{ color: COLOR.textSec }}>{g.nombre}</span><span style={{ fontFamily: OSWALD, fontWeight: 600, color: '#111' }}>{nf0(g.total)}</span></div>
                  <div style={{ height: 5, background: '#ebe8e2', borderRadius: 3 }}><div style={{ height: 5, width: `${pct}%`, background: ROJO, borderRadius: 3 }} /></div>
                </div>) })}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: OSWALD, fontSize: 14, fontWeight: 700, marginTop: 6, paddingTop: 8, borderTop: `0.5px solid ${BORDE}` }}><span style={{ color: COLOR.textMut }}>TOTAL MES</span><span style={{ color: ROJO }}>{nf0(gastoMesTotal)}</span></div>
            </div>
          )}
        </div>
        <div style={card}>
          <div style={{ ...lblS, marginBottom: 12 }}>IVA del mes · estimado</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textSec }}>Repercutido (ventas 10%)</span><span style={{ fontFamily: OSWALD, fontSize: 20, fontWeight: 600, color: '#111' }}>{nf0(ivaMes.repercutido)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textSec }}>Soportado (facturas)</span><span style={{ fontFamily: OSWALD, fontSize: 20, fontWeight: 600, color: '#111' }}>{nf0(ivaMes.soportado)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8, borderTop: `0.5px solid ${BORDE}` }}><span style={{ fontFamily: OSWALD, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', color: COLOR.textMut }}>A liquidar</span><span style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 700, color: ivaMes.saldo >= 0 ? AMARILLO : VERDE }}>{nf0(ivaMes.saldo)}</span></div>
            <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLOR.textMut }}>Estimación informativa. El IVA repercutido asume tipo 10% sobre ventas con IVA incluido.</div>
          </div>
        </div>
      </div>

      {/* POR MARCA */}
      {porMarca.length > 0 && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ ...lblS, marginBottom: 12 }}>Caja por marca · neto · últimos 90 días</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(() => { const max = Math.max(...porMarca.map(m => m.neto), 1); return porMarca.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ minWidth: 150, fontFamily: LEXEND, fontSize: 13, color: COLOR.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.marca}</span>
                <div style={{ flex: 1, height: 14, background: '#ebe8e2', borderRadius: 7 }}><div style={{ height: 14, width: `${(m.neto / max) * 100}%`, background: VERDE, borderRadius: 7 }} /></div>
                <span style={{ minWidth: 70, textAlign: 'right', fontFamily: OSWALD, fontSize: 15, fontWeight: 600, color: VERDE }}>{nf0(m.neto)}</span>
              </div>)) })()}
          </div>
        </div>
      )}

      {/* PENDIENTE DE DATOS (honesto, sin inventar) */}
      <div style={card}>
        <div style={{ ...lblS, marginBottom: 12 }}>Se activa al cargar datos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {[
            { t: 'Conciliación de cobros', d: 'Casar cada depósito con el banco para marcar lo realmente cobrado y detectar impagos.', dep: 'Importar movimientos bancarios' },
            { t: 'Recorte real vs previsto', d: 'Comparar lo previsto con lo que abona cada plataforma (reembolsos, penalizaciones).', dep: 'Cargar liquidaciones reales' },
            { t: 'Coste de ADS y promos', d: 'Cuánto descuenta cada plataforma por publicidad y su efecto en el neto.', dep: 'Cargar resúmenes de plataforma' },
            { t: 'Cobros faltantes / duplicados', d: 'Avisar de un depósito que debía entrar y no está, o uno repetido.', dep: 'Conciliación bancaria activa' },
          ].map((x, i) => (
            <div key={i} style={{ border: `1px dashed ${BORDE}`, borderRadius: 12, padding: '12px 14px', background: '#faf8f4' }}>
              <div style={{ fontFamily: OSWALD, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: COLOR.textSec, marginBottom: 6 }}>{x.t}</div>
              <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLOR.textMut, marginBottom: 8 }}>{x.d}</div>
              <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase', color: AZUL }}>Falta: {x.dep}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
