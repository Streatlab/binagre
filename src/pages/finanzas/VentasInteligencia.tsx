import React, { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area, PieChart, Pie,
} from 'recharts'
import {
  TrendingUp, TrendingDown, AlertTriangle, Wallet, Store,
  Percent, Repeat, Flame, Snowflake, ChevronRight,
} from 'lucide-react'

/* ============================================================
   FINANZAS · VENTAS-INTELIGENCIA · BINAGRE / STREAT LAB
   DATOS ESTIMADOS (no reales). Volumen real de Supabase;
   importes/ticket/comisiones estimados hasta enchufar export.
   ============================================================ */

const T = {
  rojo: '#B01D23', sidebar: '#1e2233', panel: '#e8f442', modal: '#484f66',
  verde: '#22c55e', gris: '#6b7280', rojoSoft: '#B01D2314', panelSoft: '#e8f44222',
}

const PLATAFORMA_COLOR: Record<string, string> = {
  'Uber Eats': '#000000', Glovo: '#f5c518', 'Just Eat': T.rojo, 'Tienda online': T.verde,
}
const COMISION: Record<string, number> = {
  'Uber Eats': 0.30, Glovo: 0.30, 'Just Eat': 0.30, 'Tienda online': 0.0,
}

/* --- Marcas y platos REALES (Supabase pedidos_plataforma jun 2026) --- */
const MARCAS = [
  { marca: 'Comida Casera para Llevar', lineas: 16 },
  { marca: 'La Cocina de Carmucha', lineas: 14 },
  { marca: 'Ninja Ramen & Katsu Club', lineas: 14 },
  { marca: 'Pasta Manía Italiana', lineas: 11 },
  { marca: 'Greta la Green', lineas: 7 },
  { marca: 'Es Tiempo de Cocidos', lineas: 7 },
  { marca: 'Mister Katsu', lineas: 5 },
  { marca: 'Tan Pichi: Raciones y Medias', lineas: 5 },
  { marca: 'Streat Lab', lineas: 5 },
  { marca: 'French TacOH LA LA', lineas: 4 },
  { marca: 'Binagre', lineas: 3 },
  { marca: 'Milanesas VIP', lineas: 3 },
  { marca: 'Restaurante de Menús', lineas: 1 },
]

const HORAS = [
  { h: '12h', lineas: 7 }, { h: '13h', lineas: 17 }, { h: '14h', lineas: 12 },
  { h: '15h', lineas: 14 }, { h: '16h', lineas: 5 }, { h: '17h', lineas: 6 },
  { h: '18h', lineas: 3 }, { h: '19h', lineas: 3 }, { h: '20h', lineas: 8 },
  { h: '21h', lineas: 4 }, { h: '22h', lineas: 16 },
]

const TOP_PLATOS = [
  { plato: 'Ramen the Warriors', veces: 8, marca: 'Ninja Ramen' },
  { plato: 'Salmorejo cordobés', veces: 5, marca: 'Carmucha' },
  { plato: 'Croquetas feas del mesón', veces: 4, marca: 'Carmucha' },
  { plato: 'Filete empanado + huevo y patatas', veces: 2, marca: 'Comida Casera' },
  { plato: 'Korean Fried Chicken', veces: 1, marca: 'Ninja Ramen' },
  { plato: 'TACOS Talla XXL', veces: 1, marca: 'French TacOH' },
  { plato: 'Mac and Cheese', veces: 1, marca: 'Pasta Manía' },
  { plato: 'Arroz meloso de pulpo trufado', veces: 1, marca: 'Es Tiempo Cocidos' },
]

/* --- Parámetros de estimación (editar al enchufar reales) --- */
const TICKET_EST = 14.5
const COSTE_PLATO = 0.32

const fmtEur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const fmtEur2 = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

const totalLineas = MARCAS.reduce((a, m) => a + m.lineas, 0)
const pedidosEst = Math.round(totalLineas / 1.8)
const brutoEst = pedidosEst * TICKET_EST

const PLATAFORMAS = [
  { plataforma: 'Uber Eats', peso: 0.46 },
  { plataforma: 'Glovo', peso: 0.27 },
  { plataforma: 'Just Eat', peso: 0.15 },
  { plataforma: 'Tienda online', peso: 0.12 },
].map((p) => {
  const bruto = brutoEst * p.peso
  const comision = bruto * COMISION[p.plataforma]
  return { ...p, bruto, comision, neto: bruto - comision }
})

const comisionTotal = PLATAFORMAS.reduce((a, p) => a + p.comision, 0)
const netoTotal = brutoEst - comisionTotal
const comisionAnual = comisionTotal * (365 / 17)

const marcasEst = MARCAS.map((m) => {
  const bruto = (m.lineas / totalLineas) * brutoEst
  return { ...m, bruto }
})

const evolucion = Array.from({ length: 17 }, (_, i) => {
  const base = brutoEst / 17
  const wd = new Date(2026, 5, i + 1).getDay()
  const factor = wd === 0 || wd === 6 ? 1.35 : wd === 1 ? 0.7 : 1
  return { dia: `${i + 1}/6`, bruto: Math.round(base * factor), neto: Math.round(base * factor * 0.71) }
})

const tooltipStyle = { background: T.sidebar, border: 'none', borderRadius: 8, color: 'white' }

function Badge() {
  return (
    <span style={{ background: T.panel, color: '#0a0a0a' }}
      className="text-[11px] font-bold px-2 py-0.5 rounded-full tracking-wide">
      DATOS ESTIMADOS
    </span>
  )
}

function KpiCard({ label, value, delta, sub, icon: Icon, accent }: {
  label: string; value: string | number; delta?: number; sub?: string;
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; accent?: string
}) {
  const up = (delta ?? 0) >= 0
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        {Icon && <Icon size={18} style={{ color: accent || T.rojo }} />}
      </div>
      <div className="text-3xl font-extrabold" style={{ color: T.sidebar }}>{value}</div>
      {delta !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-semibold mt-1 ${up ? 'text-green-600' : 'text-red-600'}`}>
          {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {up ? '+' : ''}{delta}% vs 7d
        </div>
      )}
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="font-bold mb-3" style={{ color: T.sidebar }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ icon: Icon, color, a, b }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string; a: string; b: string
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="flex items-center gap-2 text-sm font-medium" style={{ color: T.sidebar }}>
        <Icon size={15} style={{ color }} />{a}
      </span>
      <span className="text-xs text-gray-500 flex items-center gap-1">{b}<ChevronRight size={13} /></span>
    </div>
  )
}

const TABS = ['Panel', 'Evolución', 'Cashflow', 'Plataformas', 'Marcas', 'Platos']

export default function VentasInteligencia() {
  const [tab, setTab] = useState('Panel')

  return (
    <div className="min-h-screen" style={{ background: '#f4f5f7' }}>
      <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between" style={{ background: T.sidebar }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-extrabold" style={{ background: T.rojo, color: 'white' }}>SL</div>
          <div>
            <div className="text-white font-bold leading-tight">Finanzas · Ventas-Inteligencia</div>
            <div className="text-[11px] text-gray-300">Binagre / Streat Lab · jun 2026</div>
          </div>
        </div>
        <Badge />
      </div>

      <div className="px-6 pt-4 flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition"
            style={tab === t ? { background: T.rojo, color: 'white' } : { background: 'white', color: T.sidebar, border: '1px solid #e5e7eb' }}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-6">
        {tab === 'Panel' && <Panel />}
        {tab === 'Evolución' && <Evolucion />}
        {tab === 'Cashflow' && <Cashflow />}
        {tab === 'Plataformas' && <Plataformas />}
        {tab === 'Marcas' && <Marcas />}
        {tab === 'Platos' && <Platos />}
      </div>

      <div className="px-6 pb-8 text-[11px] text-gray-400">
        Volumen (líneas, marcas, platos, franjas) = datos reales · Importes, ticket, comisiones y beneficio = estimados hasta enchufar export de plataformas.
      </div>
    </div>
  )
}

function Panel() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Facturación bruta" value={fmtEur(brutoEst)} delta={8} sub="17 días · est." icon={Wallet} />
        <KpiCard label="Pedidos" value={pedidosEst} delta={5} sub="todas plataformas" icon={Store} accent={T.sidebar} />
        <KpiCard label="Ticket medio" value={fmtEur2(TICKET_EST)} delta={2} icon={TrendingUp} accent={T.verde} />
        <KpiCard label="Neto tras comisión" value={fmtEur(netoTotal)} delta={-3} sub={`comisión ${fmtEur(comisionTotal)}`} icon={Percent} accent={T.rojo} />
      </div>

      <div className="rounded-2xl p-6" style={{ background: T.rojoSoft, border: `1px solid ${T.rojo}33` }}>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={18} style={{ color: T.rojo }} />
          <span className="font-bold" style={{ color: T.rojo }}>Coste de depender de plataformas</span>
        </div>
        <div className="text-4xl font-extrabold" style={{ color: T.rojo }}>
          {fmtEur(comisionAnual)}<span className="text-base font-semibold text-gray-500">/año proyectado</span>
        </div>
        <div className="text-sm text-gray-600 mt-1">Cada pedido movido a tienda online (0% comisión) recupera ~30% de margen.</div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Reparto por plataforma (est.)">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={PLATAFORMAS} dataKey="bruto" nameKey="plataforma" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {PLATAFORMAS.map((p) => <Cell key={p.plataforma} fill={PLATAFORMA_COLOR[p.plataforma]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtEur(v)} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1">
            {PLATAFORMAS.map((p) => (
              <div key={p.plataforma} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: PLATAFORMA_COLOR[p.plataforma] }} />{p.plataforma}</span>
                <span className="font-semibold">{fmtEur(p.bruto)} · {Math.round(p.peso * 100)}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Mapa horario (volumen real)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={HORAS}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="h" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="lineas" radius={[4, 4, 0, 0]}>
                {HORAS.map((x) => <Cell key={x.h} fill={x.lineas >= 14 ? T.rojo : x.lineas >= 7 ? T.modal : '#cbd5e1'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-gray-500">Picos: 13h y 22h. Franja muerta 18-19h → candidata a apagar marcas.</div>
        </Card>
      </div>
    </>
  )
}

function Evolucion() {
  return (
    <Card title="Evolución diaria (est.)">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={evolucion}>
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={T.rojo} stopOpacity={0.35} />
              <stop offset="100%" stopColor={T.rojo} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="dia" fontSize={11} />
          <YAxis fontSize={11} tickFormatter={(v: number) => `${v}€`} />
          <Tooltip formatter={(v: number) => fmtEur(v)} contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="bruto" stroke={T.rojo} fill="url(#g1)" strokeWidth={2} name="Bruto" />
          <Line type="monotone" dataKey="neto" stroke={T.verde} strokeWidth={2} dot={false} name="Neto" />
        </AreaChart>
      </ResponsiveContainer>
      <div className="text-xs text-gray-500">Fines de semana concentran el pico. Lunes flojo → día de pruebas / promo.</div>
    </Card>
  )
}

function Cashflow() {
  const proy = Array.from({ length: 8 }, (_, i) => {
    const semanal = netoTotal * (7 / 17)
    return { sem: `Sem ${i + 1}`, entrada: Math.round(semanal * (1 + i * 0.04)) }
  })
  const acum = proy.reduce((a, p) => a + p.entrada, 0)
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Entrada neta semanal" value={fmtEur(netoTotal * 7 / 17)} icon={Wallet} accent={T.verde} />
        <KpiCard label="Proyección 8 semanas" value={fmtEur(acum)} icon={TrendingUp} />
        <KpiCard label="Comisión retenida 8s" value={fmtEur(comisionTotal * 7 / 17 * 8)} icon={Percent} accent={T.rojo} />
      </div>
      <Card title="Cashflow proyectado · entradas netas (est.)">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={proy}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="sem" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={(v: number) => `${v}€`} />
            <Tooltip formatter={(v: number) => fmtEur(v)} contentStyle={tooltipStyle} />
            <Bar dataKey="entrada" fill={T.sidebar} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </>
  )
}

function Plataformas() {
  return (
    <Card title="Margen tras comisión por plataforma (est.)">
      <div className="space-y-3">
        {PLATAFORMAS.map((p) => (
          <div key={p.plataforma} className="flex items-center gap-3">
            <span className="w-28 text-sm font-semibold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: PLATAFORMA_COLOR[p.plataforma] }} />{p.plataforma}
            </span>
            <div className="flex-1 h-7 rounded-lg overflow-hidden flex bg-gray-100">
              <div style={{ width: `${(p.neto / p.bruto) * 100}%`, background: T.verde }} />
              <div style={{ width: `${COMISION[p.plataforma] * 100}%`, background: T.rojo }} />
            </div>
            <span className="w-40 text-right text-sm">
              <b>{fmtEur(p.neto)}</b> neto · <span className="text-red-600">-{fmtEur(p.comision)}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm rounded-xl p-3" style={{ background: T.panelSoft }}>
        <Repeat size={16} style={{ color: T.sidebar }} />
        Tienda online deja <b>~30% más por euro</b>. Palanca nº1: migrar clientes de Uber/Glovo a la web.
      </div>
    </Card>
  )
}

function Marcas() {
  const orden = [...marcasEst].sort((a, b) => b.bruto - a.bruto)
  return (
    <Card title="Ventas por marca (est.)">
      <ResponsiveContainer width="100%" height={420}>
        <BarChart data={orden} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis type="number" fontSize={11} tickFormatter={(v: number) => `${Math.round(v)}€`} />
          <YAxis type="category" dataKey="marca" width={150} fontSize={11} />
          <Tooltip formatter={(v: number) => fmtEur(v)} contentStyle={tooltipStyle} />
          <Bar dataKey="bruto" fill={T.rojo} radius={[0, 4, 4, 0]} name="Bruto" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

function Platos() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card title="Platos gancho (más vendidos · real)">
        {TOP_PLATOS.slice(0, 4).map((p) => (
          <Row key={p.plato} icon={Flame} color={T.rojo} a={p.plato} b={`${p.veces}× · ${p.marca}`} />
        ))}
      </Card>
      <Card title="Cola larga (1 venta · vigilar)">
        {TOP_PLATOS.slice(4).map((p) => (
          <Row key={p.plato} icon={Snowflake} color={T.gris} a={p.plato} b={`${p.veces}× · ${p.marca}`} />
        ))}
      </Card>
    </div>
  )
}
