/**
 * CashflowSL — Cashflow del Panel Global con el estilo SL (Ley Visual SL v1).
 *
 * Misma lógica de negocio que la versión neobrutal (ley de cobro por plataforma,
 * frontera del banco, cierre histórico 19-jun, neto vía resolverNeto).
 * La capa visual está escrita desde cero: no importa nada de neobrutal.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  loadConfigCanales, recargarConfigCanales, loadMarcasPorCanal,
  type CanalConfig, type MarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'
import { resolverNeto, loadVentasReales, loadRatiosCalibrados } from '@/lib/panel/netoResolver'
import {
  C, Card, CardHead, Hero, HeroPill, Kpi, KpiGrid, Bar, Nota, Pill, Vacio, LineaArea,
  CANAL_COLOR, CANAL_LABEL, eur0, num0, pct1,
} from './uiSL'

type Sim = -10 | 0 | 10

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const CANALES = [
  { id: 'uber',  bk: 'uber_bruto',    pk: 'uber_pedidos' },
  { id: 'glovo', bk: 'glovo_bruto',   pk: 'glovo_pedidos' },
  { id: 'je',    bk: 'je_bruto',      pk: 'je_pedidos' },
  { id: 'web',   bk: 'web_bruto',     pk: 'web_pedidos' },
  { id: 'dir',   bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

const FESTIVOS_FALLBACK = [
  '2026-01-01', '2026-01-06', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-15',
  '2026-08-15', '2026-10-12', '2026-11-02', '2026-11-09', '2026-12-07', '2026-12-08', '2026-12-25',
]

const CIERRE_HIST = '2026-06-19'
const CANALES_CICLO = ['uber', 'glovo', 'je']

const SELECT = 'fecha,servicio,uber_bruto,uber_pedidos,glovo_bruto,glovo_pedidos,je_bruto,je_pedidos,web_bruto,web_pedidos,directa_bruto,directa_pedidos,total_bruto,total_pedidos'

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
function pagoGlovo(y: number, m: number, q: 1 | 2) { return toLocal(new Date(y, m + 1, q === 1 ? 5 : 20, 12)) }
function pagoJE(y: number, m: number, q: 1 | 2) { return q === 1 ? toLocal(new Date(y, m, 20, 12)) : toLocal(new Date(y, m + 1, 5, 12)) }

function periodoTxt(canal: string, ini: string, fin: string) {
  if (canal === 'web' || canal === 'dir') return fmtCorta(ini)
  if (canal === 'uber') { const a = parse(ini), b = parse(fin); return `sem. ${a.getDate()}–${b.getDate()} ${MESES[b.getMonth()]}` }
  const a = parse(ini)
  return `${a.getDate() <= 15 ? '1ª' : '2ª'} quincena ${MESES[a.getMonth()]}`
}
function claveCobro(c: { canal: string; ini: string; fin: string }) { return `${c.canal}|${c.ini}|${c.fin}` }

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

export default function CashflowSL() {
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
  const [cobradoMap, setCobradoMap] = useState<Record<string, boolean>>({})
  const [frontera, setFrontera] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfigCanales().then(setConfig)
    loadMarcasPorCanal().then(setMarcasPorCanal)
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

  useEffect(() => {
    supabase.from('v_frontera_cobro_banco').select('canal,ultima_fecha').then(({ data }) => {
      const f: Record<string, string> = {}
      for (const r of (data ?? []) as { canal: string; ultima_fecha: string }[]) {
        if (r.canal && r.ultima_fecha) f[r.canal] = String(r.ultima_fecha).slice(0, 10)
      }
      setFrontera(f)
    })
  }, [])

  const hoy = toLocal(new Date())
  const factor = 1 + sim / 100

  const cobradoBanco = (c: { canal: string; pago: string }) => {
    if (c.pago <= CIERRE_HIST) return true
    const f = frontera[c.canal]
    return !!f && c.pago <= f
  }
  const estaCobrado = (c: Cobro) => cobradoBanco(c) || !!cobradoMap[claveCobro(c)]

  async function toggleCobrado(c: Cobro) {
    if (cobradoBanco(c)) return
    const k = claveCobro(c)
    const nuevo = !cobradoMap[k]
    setCobradoMap(prev => ({ ...prev, [k]: nuevo }))
    await supabase.from('cashflow_cobros_estado').upsert({
      clave: k, canal: c.canal, ini: c.ini, fin: c.fin, pago: c.pago,
      cobrado: nuevo, marcado_at: new Date().toISOString(),
    })
  }

  const aggDia = useMemo(() => {
    const todo = new Set<string>()
    for (const r of rows) if (r.servicio === 'TODO') todo.add(r.fecha)
    const m = new Map<string, Record<string, number>>()
    for (const r of rows) {
      if (todo.has(r.fecha)) { if (r.servicio !== 'TODO') continue }
      else if (r.servicio !== 'ALM' && r.servicio !== 'CENAS') continue
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
      const dd = parse(f); const y = dd.getFullYear(); const mm = dd.getMonth(); const q: 1 | 2 = dd.getDate() <= 15 ? 1 : 2
      for (const c of CANALES) {
        const bruto = a[c.bk] ?? 0
        const ped = a[c.pk] ?? 0
        if (bruto <= 0) continue
        if (c.id === 'uber') {
          const lun = mondayOf(dd); const dom = addDays(lun, 6)
          push('U' + toLocal(lun), c, toLocal(lun), toLocal(dom), pagoUber(dom, festivos), bruto, ped, f)
        } else if (c.id === 'glovo' || c.id === 'je') {
          const ini = toLocal(new Date(y, mm, q === 1 ? 1 : 16, 12))
          const fin = q === 1 ? toLocal(new Date(y, mm, 15, 12)) : toLocal(finDeMes(y, mm))
          const pago = c.id === 'glovo' ? pagoGlovo(y, mm, q) : pagoJE(y, mm, q)
          push(`${c.id}${y}-${mm}-${q}`, c, ini, fin, pago, bruto, ped, f)
        } else {
          push(`${c.id}${f}`, c, f, f, f, bruto, ped, f)
        }
      }
    }
    const out: Cobro[] = []
    for (const g of grupos.values()) {
      const { neto } = resolverNeto(g.canal.id, g.bruto, g.ped, {
        modo: 'agregado_canal', marcasPorCanal,
        fechaDesde: parse(g.ini), fechaHasta: parse(g.fin),
        configCanales: config, diasConDatos: g.dias.size,
      })
      out.push({
        canal: g.canal.id, label: CANAL_LABEL[g.canal.id], color: CANAL_COLOR[g.canal.id],
        ini: g.ini, fin: g.fin, pago: g.pago, bruto: g.bruto, neto, pedidos: g.ped,
        futuro: g.pago > hoy,
      })
    }
    return out.sort((a, b) => (a.pago < b.pago ? -1 : 1))
  }, [aggDia, config, marcasPorCanal, festivos, loading, hoy])

  const pendientes = useMemo(
    () => cobros.filter(c => CANALES_CICLO.includes(c.canal) && !cobradoBanco(c) && !cobradoMap[claveCobro(c)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cobros, cobradoMap, frontera])

  const visibles = useMemo(
    () => [...pendientes].sort((a, b) => (a.pago < b.pago ? 1 : -1)).slice(0, 10),
    [pendientes])

  const porCobrar = useMemo(() => pendientes.reduce((s, c) => s + c.neto, 0) * factor, [pendientes, factor])
  const finMes = useMemo(() => { const d = new Date(); return toLocal(finDeMes(d.getFullYear(), d.getMonth())) }, [])
  const hastaFinMes = useMemo(
    () => pendientes.filter(c => c.pago <= finMes).reduce((s, c) => s + c.neto, 0) * factor,
    [pendientes, finMes, factor])

  const porCanal = useMemo(() => CANALES.map(c => {
    const list = pendientes.filter(x => x.canal === c.id)
    return { id: c.id, label: CANAL_LABEL[c.id], color: CANAL_COLOR[c.id], neto: list.reduce((s, x) => s + x.neto, 0) * factor }
  }).filter(c => c.neto > 0).sort((a, b) => b.neto - a.neto), [pendientes, factor])
  const topPlat = porCanal[0] ?? null

  const grueso = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of pendientes) m.set(c.pago, (m.get(c.pago) ?? 0) + c.neto * factor)
    let best: { pago: string; total: number } | null = null
    for (const [pago, total] of m) if (!best || total > best.total) best = { pago, total }
    return best
  }, [pendientes, factor])

  const serie = useMemo(() => {
    const desde = toLocal(addDays(new Date(), -35))
    const hasta = toLocal(addDays(new Date(), 45))
    const m = new Map<string, number>()
    for (const c of cobros) {
      if (c.pago < desde || c.pago > hasta) continue
      m.set(c.pago, (m.get(c.pago) ?? 0) + c.neto * (c.pago > hoy ? factor : 1))
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([pago, total]) => ({ pago, total }))
  }, [cobros, hoy, factor])

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
  const gastoMes = gastosCat.reduce((s, c) => s + c.total, 0)
  const nFacturas = gastosCat.reduce((s, c) => s + c.n, 0)

  const caja = useMemo(() => [...cajaBanco]
    .sort((a, b) => (a.mes < b.mes ? -1 : 1))
    .slice(-6)
    .map(c => ({
      ym: c.mes,
      label: MESES[parseInt(c.mes.slice(5, 7), 10) - 1],
      ingresos: Number(c.ingresos) || 0,
      gastos: Number(c.gastos) || 0,
      saldo: Number(c.saldo_mes) || 0,
    })), [cajaBanco])

  const saldoBanco = useMemo(() => cajaBanco.reduce((s, c) => s + (Number(c.saldo_mes) || 0), 0), [cajaBanco])
  const ultimoMov = useMemo(() => {
    const m = [...cajaBanco].map(c => c.mes).sort().slice(-1)[0]
    return m ? `${MESES[parseInt(m.slice(5, 7), 10) - 1]} ${m.slice(0, 4)}` : '—'
  }, [cajaBanco])
  const burn = useMemo(() => {
    const u = [...cajaBanco].sort((a, b) => (a.mes < b.mes ? -1 : 1)).slice(-4)
    return u.length ? u.reduce((s, c) => s + (Number(c.gastos) || 0), 0) / u.length : 0
  }, [cajaBanco])
  const runway = burn > 0 ? saldoBanco / (burn / 4.345) : 0

  const porMarca = useMemo(() => {
    const ventas = new Map<string, number>()
    for (const v of ventasMarca) ventas.set(v.marca, (ventas.get(v.marca) ?? 0) + Number(v.neto || 0))
    const base = marcasActivas.length ? marcasActivas : [...ventas.keys()]
    return base.map(marca => ({ marca, neto: ventas.get(marca) ?? 0 })).sort((a, b) => b.neto - a.neto)
  }, [ventasMarca, marcasActivas])

  if (loading) return <Card><Vacio>Cargando cashflow…</Vacio></Card>

  const maxMarca = Math.max(...porMarca.map(m => m.neto), 1)
  const maxCaja = Math.max(...caja.map(c => Math.max(c.ingresos, c.gastos)), 1)
  const etiquetasSerie = serie.length > 3
    ? [serie[0], serie[Math.floor(serie.length / 3)], serie[Math.floor((2 * serie.length) / 3)], serie[serie.length - 1]].map(s => fmtCorta(s.pago))
    : serie.map(s => fmtCorta(s.pago))

  const titular = porCobrar > 0
    ? (grueso ? `El grueso entra el ${fmtLarga(grueso.pago)}` : 'Cobros pendientes de las plataformas')
    : 'No queda nada pendiente de cobro'

  return (
    <div>
      <Hero
        eyebrow="CASHFLOW · COBROS Y TESORERÍA"
        titular={titular}
        valor={eur0(porCobrar)}
        sub={`Pendiente de cobro (neto estimado)${sim !== 0 ? ` · simulación ${sim > 0 ? '+' : ''}${sim}%` : ''}`}
        right={
          <>
            <HeroPill>Hasta fin de mes {eur0(hastaFinMes)}</HeroPill>
            {topPlat && porCobrar > 0 && (
              <HeroPill>{topPlat.label} es el {pct1((topPlat.neto / porCobrar) * 100)}</HeroPill>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              {([-10, 0, 10] as Sim[]).map(s => (
                <button key={s} onClick={() => setSim(s)}
                  style={{
                    border: 'none', cursor: 'pointer', borderRadius: 999, padding: '5px 12px',
                    fontFamily: 'inherit', fontSize: 11, fontWeight: 800,
                    background: sim === s ? '#fff' : 'rgba(255,255,255,0.22)',
                    color: sim === s ? '#951218' : '#fff',
                  }}>
                  {s === 0 ? 'Real' : `${s > 0 ? '+' : '−'}10%`}
                </button>
              ))}
            </div>
          </>
        }
      />

      <KpiGrid>
        <Kpi icono="◎" tono={saldoBanco >= 0 ? 'verde' : 'rojo'} label={`Saldo banco · ${ultimoMov}`} valor={eur0(saldoBanco)}
          pie={<Pill tone={saldoBanco >= 0 ? 'verde' : 'rojo'}>Movimientos reales</Pill>} />
        <Kpi icono="↑" tono="verde" label="Por cobrar" valor={eur0(porCobrar)}
          pie={<Pill tone="verde">{pendientes.length} liquidaciones</Pill>} />
        <Kpi icono="↓" tono="rojo" label="Gasto del mes" valor={eur0(gastoMes)}
          pie={<Pill tone="rojo">{num0(nFacturas)} facturas</Pill>} />
        <Kpi icono="◷" tono={runway >= 12 ? 'verde' : runway > 0 ? 'ambar' : 'neutro'} label="Colchón"
          valor={runway > 0 ? `${Math.round(runway)} sem.` : '—'}
          pie={<Pill tone={runway >= 12 ? 'verde' : 'ambar'}>Gasto medio {eur0(burn)}/mes</Pill>} />
      </KpiGrid>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 14, marginBottom: 16 }}>
        <Card style={{ marginBottom: 0 }}>
          <CardHead title="Cuándo entra el dinero" sub="Cobros de los últimos 35 días y de los próximos 45" />
          <LineaArea puntos={serie.map(s => s.total)} etiquetas={etiquetasSerie} color={C.verde} fmt={eur0} />
          {grueso && porCobrar > 0 && (
            <Nota tono="verde">
              El día más gordo es el {fmtLarga(grueso.pago)}: entran {eur0(grueso.total)}, el {pct1((grueso.total / porCobrar) * 100)} de todo lo que tienes pendiente.
            </Nota>
          )}
        </Card>

        <Card style={{ marginBottom: 0 }}>
          <CardHead title="Qué te deben, por plataforma" sub="Neto estimado pendiente" />
          {porCanal.length === 0
            ? <Vacio>Nada pendiente de cobro.</Vacio>
            : porCanal.map(c => (
              <Bar key={c.id} label={c.label} valor={eur0(c.neto)}
                pct={porCobrar > 0 ? (c.neto / porCobrar) * 100 : 0} color={c.color} />
            ))}
          {topPlat && porCobrar > 0 && (topPlat.neto / porCobrar) >= 0.45 && (
            <Nota tono="ambar">
              {topPlat.label} concentra el {pct1((topPlat.neto / porCobrar) * 100)} de lo que te queda por cobrar. Si se retrasan, lo notas.
            </Nota>
          )}
        </Card>
      </div>

      <Card>
        <CardHead
          title="Ingresos pendientes"
          sub="Lo que el banco todavía no ha pagado · del 19-jun hacia atrás ya está cobrado"
          right={<Pill tone="verde">{eur0(porCobrar)} pendiente</Pill>}
        />
        {visibles.length === 0
          ? <Vacio>Sin cobros pendientes.</Vacio>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Plataforma</th>
                    <th>Ventas de</th>
                    <th className="r">Pedidos</th>
                    <th>Cobro</th>
                    <th className="r">Bruto</th>
                    <th className="r">Neto est.</th>
                    <th className="r">% que te queda</th>
                    <th className="r">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(c => {
                    const pct = c.bruto > 0 ? (c.neto / c.bruto) * 100 : 0
                    const porBanco = cobradoBanco(c)
                    const cobrado = estaCobrado(c)
                    const vencido = c.pago <= hoy && !cobrado
                    return (
                      <tr key={claveCobro(c)} style={{ opacity: cobrado ? 0.55 : 1 }}>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 999, background: c.color, display: 'inline-block' }} />
                            {c.label}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: C.gris }}>{periodoTxt(c.canal, c.ini, c.fin)}</td>
                        <td className="r slnum">{num0(c.pedidos)}</td>
                        <td className="slnum" style={{ color: vencido ? C.rojoSem : C.ink }}>
                          {fmtCorta(c.pago)}
                          {vencido && <small className="slsub" style={{ color: C.rojoSem }}>reclamar</small>}
                        </td>
                        <td className="r slnum" style={{ color: C.gris }}>{eur0(c.bruto)}</td>
                        <td className="r slnum" style={{ color: C.verde, textDecoration: cobrado ? 'line-through' : 'none' }}>
                          {eur0(c.neto * factor)}
                        </td>
                        <td className="r">
                          <Pill tone={pct >= 58 ? 'verde' : pct >= 40 ? 'ambar' : 'rojo'}>{pct1(pct)}</Pill>
                        </td>
                        <td className="r">
                          {porBanco
                            ? <Pill tone="verde" dot>Cobrado · banco</Pill>
                            : (
                              <button onClick={() => toggleCobrado(c)}
                                title={cobrado ? 'Marcado como cobrado' : 'Marcar como cobrado'}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                                <span style={{
                                  position: 'relative', display: 'inline-block', width: 38, height: 22,
                                  borderRadius: 999, background: cobrado ? C.verde : C.track,
                                  transition: 'background .15s',
                                }}>
                                  <span style={{
                                    position: 'absolute', top: 3, left: cobrado ? 19 : 3,
                                    width: 16, height: 16, borderRadius: 999, background: '#fff',
                                    boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .15s',
                                  }} />
                                </span>
                              </button>
                            )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total pendiente</td>
                    <td />
                    <td className="r slnum">{num0(visibles.reduce((s, c) => s + c.pedidos, 0))}</td>
                    <td />
                    <td className="r slnum">{eur0(visibles.reduce((s, c) => s + c.bruto, 0))}</td>
                    <td className="r slnum">{eur0(visibles.filter(c => !estaCobrado(c)).reduce((s, c) => s + c.neto, 0) * factor)}</td>
                    <td className="r slnum">
                      {(() => {
                        const b = visibles.reduce((s, c) => s + c.bruto, 0)
                        return b > 0 ? pct1((visibles.reduce((s, c) => s + c.neto, 0) / b) * 100) : '—'
                      })()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        <Nota tono="blu">
          Desde el 20 de junio, un cobro solo cuenta como cobrado cuando entra en el banco o lo marcas tú a mano.
        </Nota>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 14, marginBottom: 16 }}>
        <Card style={{ marginBottom: 0 }}>
          <CardHead title="Caja mes a mes" sub="Dinero real que entró y salió del banco" />
          {caja.length === 0
            ? <Vacio>Sin movimientos bancarios importados.</Vacio>
            : (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 180 }}>
                  {caja.map(c => (
                    <div key={c.ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6, height: '100%' }}>
                      <span className="slnum" style={{ fontSize: 10, color: c.saldo >= 0 ? C.verde : C.rojoSem }}>
                        {c.saldo >= 0 ? '+' : '−'}{num0(Math.abs(c.saldo))}
                      </span>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', width: '100%', justifyContent: 'center', flex: 1 }}>
                        <div style={{ width: 16, borderRadius: '6px 6px 3px 3px', height: `${Math.max(2, (c.ingresos / maxCaja) * 120)}px`, background: C.verde }} />
                        <div style={{ width: 16, borderRadius: '6px 6px 3px 3px', height: `${Math.max(2, (c.gastos / maxCaja) * 120)}px`, background: C.rojoSem }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                  {caja.map(c => (
                    <div key={c.ym} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 800, color: C.grisCl, textTransform: 'uppercase' }}>{c.label}</div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: C.grisCl, fontWeight: 700, marginTop: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: C.verde, display: 'inline-block' }} />Entra
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: C.rojoSem, display: 'inline-block' }} />Sale
                  </span>
                  <span style={{ marginLeft: 'auto' }}>Última importación: {ultimoMov}</span>
                </div>
              </div>
            )}
        </Card>

        <Card style={{ marginBottom: 0 }}>
          <CardHead title="Caja por marca" sub={`Neto de los últimos 90 días · ${porMarca.length} marcas activas`} />
          {porMarca.length === 0
            ? <Vacio>Sin marcas activas.</Vacio>
            : porMarca.map(m => (
              <Bar key={m.marca} label={m.marca} valor={eur0(m.neto)}
                pct={(m.neto / maxMarca) * 100}
                color={m.neto > 0 ? C.naranja : C.grisCl} />
            ))}
        </Card>
      </div>

      <Card>
        <CardHead
          title="Gastos del mes por categoría"
          sub="Facturas de proveedor registradas este mes"
          right={<Pill tone="rojo">{eur0(gastoMes)}</Pill>}
        />
        {gastosCat.length === 0
          ? <Vacio>Sin facturas registradas este mes.</Vacio>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th className="r">Facturas</th>
                    <th className="r">Importe</th>
                    <th className="r">IVA</th>
                    <th className="r">Peso en el mes</th>
                  </tr>
                </thead>
                <tbody>
                  {gastosCat.slice(0, 10).map(g => {
                    const share = gastoMes > 0 ? (g.total / gastoMes) * 100 : 0
                    return (
                      <tr key={g.nombre}>
                        <td>{g.nombre}</td>
                        <td className="r slnum">{num0(g.n)}</td>
                        <td className="r slnum" style={{ color: C.rojoSem }}>{eur0(g.total)}</td>
                        <td className="r slnum" style={{ color: C.gris }}>{eur0(g.iva)}</td>
                        <td className="r">
                          <Pill tone={share >= 25 ? 'rojo' : share >= 10 ? 'ambar' : 'neutro'}>{pct1(share)}</Pill>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total mes</td>
                    <td className="r slnum">{num0(nFacturas)}</td>
                    <td className="r slnum">{eur0(gastoMes)}</td>
                    <td className="r slnum">{eur0(gastosCat.reduce((s, c) => s + c.iva, 0))}</td>
                    <td className="r slnum">100,0%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
      </Card>
    </div>
  )
}
