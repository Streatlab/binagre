import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area, PieChart, Pie,
} from 'recharts'
import { fmtEur } from '@/utils/format'
import {
  COLORS, OSWALD, LEXEND, lbl, lblXs, kpiBig, CARDS, BAR, SUBTABS,
} from '@/components/panel/resumen/tokens'

/* ============================================================
   PANEL INTELIGENCIA — pestaña "Detalle ventas" del módulo Ventas.
   Mismo contenido de siempre, con el estilo canónico del ERP.
   DATOS ESTIMADOS. Volumen (marcas/platos/franjas) = real Supabase;
   importes/ticket/comisiones = estimados hasta enchufar export.
   ============================================================ */

const PLAT_COLOR: Record<string, string> = {
  'Uber Eats': COLORS.uber, Glovo: COLORS.glovo, 'Just Eat': COLORS.je, 'Tienda online': COLORS.redSL,
}
const COMISION: Record<string, number> = {
  'Uber Eats': 0.30, Glovo: 0.30, 'Just Eat': 0.30, 'Tienda online': 0.0,
}

const MARCAS = [
  { marca: 'Comida Casera para Llevar', lineas: 16 },
  { marca: 'La Cocina de Carmucha', lineas: 14 },
  { marca: 'Ninja Ramen & Katsu Club', lineas: 14 },
  { marca: 'Pasta Manía Italiana', lineas: 11 },
  { marca: 'Greta la Green', lineas: 7 },
  { marca: 'Es Tiempo de Cocidos', lineas: 7 },
  { marca: 'Mister Katsu', lineas: 5 },
  { marca: 'Tan Pichi', lineas: 5 },
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
  { plato: 'Filete empanado + huevo', veces: 2, marca: 'Comida Casera' },
  { plato: 'Korean Fried Chicken', veces: 1, marca: 'Ninja Ramen' },
  { plato: 'TACOS Talla XXL', veces: 1, marca: 'French TacOH' },
  { plato: 'Mac and Cheese', veces: 1, marca: 'Pasta Manía' },
  { plato: 'Arroz meloso de pulpo', veces: 1, marca: 'Es Tiempo Cocidos' },
]

const TICKET_EST = 14.5
const tipEur = (v: any) => fmtEur(Number(v))
const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES')

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
const marcasEst = MARCAS.map((m) => ({ ...m, bruto: (m.lineas / totalLineas) * brutoEst })).sort((a, b) => b.bruto - a.bruto)
const evolucion = Array.from({ length: 17 }, (_, i) => {
  const base = brutoEst / 17
  const wd = new Date(2026, 5, i + 1).getDay()
  const f = wd === 0 || wd === 6 ? 1.35 : wd === 1 ? 0.7 : 1
  return { dia: `${i + 1}/6`, bruto: Math.round(base * f), neto: Math.round(base * f * 0.71) }
})
const cashflow = Array.from({ length: 8 }, (_, i) => ({ sem: `S${i + 1}`, entrada: Math.round(netoTotal * (7 / 17) * (1 + i * 0.04)) }))

/* Informes por dimensión (volumen real donde existe; familia/categoría estimadas) */
const INF_PRODUCTOS = TOP_PLATOS.map(p => ({ etiqueta: p.plato, u: p.veces }))
const INF_MARCAS = MARCAS.map(m => ({ etiqueta: m.marca, u: m.lineas }))
const INF_MODIF = [
  { etiqueta: 'Extra de queso', u: 6 }, { etiqueta: 'Picante extra', u: 4 },
  { etiqueta: 'Sin cebolla', u: 3 }, { etiqueta: 'Pan extra', u: 2 }, { etiqueta: 'Salsa aparte', u: 2 },
]
const INF_FAMILIAS = [
  { etiqueta: 'Guisos y caseros', u: 24 }, { etiqueta: 'Asiático / Ramen', u: 19 },
  { etiqueta: 'Pasta', u: 11 }, { etiqueta: 'Saludable', u: 7 },
  { etiqueta: 'Tacos / Mexicano', u: 4 }, { etiqueta: 'Milanesas', u: 3 }, { etiqueta: 'Menús', u: 1 },
]
const INF_CATEGORIAS = [
  { etiqueta: 'Principales', u: 41 }, { etiqueta: 'Entrantes', u: 18 },
  { etiqueta: 'Postres', u: 6 }, { etiqueta: 'Bebidas', u: 5 }, { etiqueta: 'Extras', u: 3 },
]

const tooltipStyle = { background: COLORS.sidebar, border: 'none', borderRadius: 8, color: '#fff', fontFamily: LEXEND, fontSize: 12 }
const tituloCard = { ...lbl, marginBottom: 12 }

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...CARDS.std, ...style }}>{children}</div>
}

function Barras({ data, color, sufijo }: { data: Array<{ etiqueta: string; u: number }>; color: string; sufijo: string }) {
  const max = Math.max(1, ...data.map(d => d.u))
  const total = data.reduce((a, d) => a + d.u, 0) || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {data.map(d => (
        <div key={d.etiqueta} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 160, fontFamily: LEXEND, fontSize: 12, color: COLORS.sec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.etiqueta}>{d.etiqueta}</span>
          <div style={{ ...BAR.track, flex: 1, height: 10 }}>
            <div style={{ width: `${(d.u / max) * 100}%`, background: color, borderRadius: 4 }} />
          </div>
          <span style={{ width: 84, textAlign: 'right', fontFamily: OSWALD, fontSize: 13, fontWeight: 600, color: COLORS.pri }}>
            {nf0(d.u)}{sufijo} <span style={{ color: COLORS.mut, fontSize: 11, fontFamily: LEXEND }}>{Math.round((d.u / total) * 100)}%</span>
          </span>
        </div>
      ))}
    </div>
  )
}

const INF_TABS = ['Productos', 'Familias', 'Categorías', 'Marcas', 'Modificadores'] as const
type InfTab = typeof INF_TABS[number]

export default function PanelInteligenciaVentas() {
  const [inf, setInf] = useState<InfTab>('Productos')

  const kpis = [
    { label: 'FACTURACIÓN BRUTA', value: fmtEur(brutoEst), color: COLORS.redSL },
    { label: 'TE PAGAN (NETO)', value: fmtEur(netoTotal), color: COLORS.ok },
    { label: 'PEDIDOS', value: nf0(pedidosEst), color: COLORS.pri },
    { label: 'COMISIÓN PLATAFORMAS', value: fmtEur(comisionTotal), color: COLORS.redSL },
  ]

  const infData: Record<InfTab, { data: Array<{ etiqueta: string; u: number }>; color: string; nota: string; sufijo: string }> = {
    Productos: { data: INF_PRODUCTOS, color: COLORS.ok, nota: 'REAL', sufijo: '×' },
    Familias: { data: INF_FAMILIAS, color: COLORS.modal, nota: 'EST.', sufijo: ' uds' },
    Categorías: { data: INF_CATEGORIAS, color: COLORS.modal, nota: 'EST.', sufijo: ' uds' },
    Marcas: { data: INF_MARCAS, color: COLORS.sidebar, nota: 'REAL', sufijo: ' uds' },
    Modificadores: { data: INF_MODIF, color: COLORS.je, nota: 'EST.', sufijo: '×' },
  }
  const cur = infData[inf]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Aviso */}
      <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, background: `${COLORS.glovo}33`, border: `0.5px solid ${COLORS.glovoDark}55`, borderRadius: 10, padding: '5px 12px' }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: COLORS.redSL }} />
        <span style={{ ...lblXs, color: COLORS.glovoDark }}>DATOS ESTIMADOS · SE ENCHUFARÁN A REAL CON EL EXPORT DE PLATAFORMAS</span>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {kpis.map(c => (
          <div key={c.label} style={{ ...CARDS.big, padding: '20px 22px' }}>
            <div style={{ ...lbl, fontSize: 11 }}>{c.label}</div>
            <div style={{ ...kpiBig, color: c.color, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Coste de depender */}
      <Card style={{ background: `${COLORS.redSL}0d`, border: `0.5px solid ${COLORS.redSL}33` }}>
        <div style={{ ...lbl, color: COLORS.redSL }}>COSTE DE DEPENDER DE PLATAFORMAS</div>
        <div style={{ fontFamily: OSWALD, fontSize: 34, fontWeight: 600, color: COLORS.redSL, lineHeight: 1.05, marginTop: 4 }}>
          {fmtEur(comisionAnual)} <span style={{ fontSize: 14, color: COLORS.mut }}>/año proyectado</span>
        </div>
        <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLORS.sec, marginTop: 6 }}>Cada pedido movido a tienda online (0% comisión) recupera ~30% de margen.</div>
      </Card>

      {/* Reparto plataforma + Mapa horario */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card>
          <div style={tituloCard}>REPARTO POR PLATAFORMA (EST.)</div>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={PLATAFORMAS} dataKey="bruto" nameKey="plataforma" innerRadius={52} outerRadius={82} paddingAngle={2}>
                {PLATAFORMAS.map((p) => <Cell key={p.plataforma} fill={PLAT_COLOR[p.plataforma]} />)}
              </Pie>
              <Tooltip formatter={tipEur} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {PLATAFORMAS.map((p) => (
              <div key={p.plataforma} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND, fontSize: 12, color: COLORS.sec }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: PLAT_COLOR[p.plataforma] }} />{p.plataforma}</span>
                <span style={{ fontFamily: OSWALD, fontWeight: 600 }}>{fmtEur(p.bruto)} · {Math.round(p.peso * 100)}%</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={tituloCard}>MAPA HORARIO (VOLUMEN REAL)</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={HORAS}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.group} />
              <XAxis dataKey="h" fontSize={11} stroke={COLORS.mut} />
              <YAxis fontSize={11} stroke={COLORS.mut} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="lineas" radius={[4, 4, 0, 0]}>
                {HORAS.map((x) => <Cell key={x.h} fill={x.lineas >= 14 ? COLORS.redSL : x.lineas >= 7 ? COLORS.modal : '#cbd5e1'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLORS.mut, marginTop: 4 }}>Picos 13h y 22h. Franja muerta 18-19h → candidata a apagar marcas.</div>
        </Card>
      </div>

      {/* Evolución */}
      <Card>
        <div style={tituloCard}>EVOLUCIÓN DIARIA (EST.)</div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={evolucion}>
            <defs>
              <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.redSL} stopOpacity={0.32} />
                <stop offset="100%" stopColor={COLORS.redSL} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.group} />
            <XAxis dataKey="dia" fontSize={11} stroke={COLORS.mut} />
            <YAxis fontSize={11} stroke={COLORS.mut} tickFormatter={(v: number) => `${v}€`} />
            <Tooltip formatter={tipEur} contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="bruto" stroke={COLORS.redSL} fill="url(#gv)" strokeWidth={2} name="Bruto" />
            <Line type="monotone" dataKey="neto" stroke={COLORS.ok} strokeWidth={2} dot={false} name="Neto" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Margen por plataforma */}
      <Card>
        <div style={tituloCard}>MARGEN TRAS COMISIÓN POR PLATAFORMA (EST.)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PLATAFORMAS.map((p) => (
            <div key={p.plataforma} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 96, fontFamily: OSWALD, fontSize: 12, fontWeight: 600, color: COLORS.sec, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: PLAT_COLOR[p.plataforma] }} />{p.plataforma}
              </span>
              <div style={{ flex: 1, height: 24, borderRadius: 8, overflow: 'hidden', display: 'flex', background: COLORS.group }}>
                <div style={{ width: `${(p.neto / p.bruto) * 100}%`, background: COLORS.ok }} />
                <div style={{ width: `${COMISION[p.plataforma] * 100}%`, background: COLORS.redSL }} />
              </div>
              <span style={{ width: 170, textAlign: 'right', fontFamily: LEXEND, fontSize: 12, color: COLORS.sec }}>
                <b style={{ fontFamily: OSWALD }}>{fmtEur(p.neto)}</b> neto · <span style={{ color: COLORS.redSL }}>-{fmtEur(p.comision)}</span>
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLORS.sec, background: `${COLORS.glovo}22`, borderRadius: 8, padding: '8px 10px', marginTop: 12 }}>
          Tienda online deja ~30% más por euro. Palanca nº1: migrar clientes de Uber/Glovo a la web.
        </div>
      </Card>

      {/* Marcas + Cashflow */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}>
        <Card>
          <div style={tituloCard}>VENTAS POR MARCA (EST.)</div>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={marcasEst} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.group} />
              <XAxis type="number" fontSize={11} stroke={COLORS.mut} tickFormatter={(v: number) => `${Math.round(v)}€`} />
              <YAxis type="category" dataKey="marca" width={140} fontSize={10} stroke={COLORS.mut} />
              <Tooltip formatter={tipEur} contentStyle={tooltipStyle} />
              <Bar dataKey="bruto" fill={COLORS.redSL} radius={[0, 4, 4, 0]} name="Bruto" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={tituloCard}>CASHFLOW PROYECTADO · NETO (EST.)</div>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={cashflow}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.group} />
              <XAxis dataKey="sem" fontSize={11} stroke={COLORS.mut} />
              <YAxis fontSize={11} stroke={COLORS.mut} tickFormatter={(v: number) => `${v}€`} />
              <Tooltip formatter={tipEur} contentStyle={tooltipStyle} />
              <Bar dataKey="entrada" fill={COLORS.sidebar} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Platos gancho / cola */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card>
          <div style={tituloCard}>PLATOS GANCHO (MÁS VENDIDOS · REAL)</div>
          {TOP_PLATOS.slice(0, 4).map((p) => (
            <div key={p.plato} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `0.5px solid ${COLORS.brd}`, fontFamily: LEXEND, fontSize: 13, color: COLORS.pri }}>
              <span>{p.plato}</span><span style={{ color: COLORS.mut, fontSize: 12 }}>{p.veces}× · {p.marca}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div style={tituloCard}>COLA LARGA (1 VENTA · VIGILAR)</div>
          {TOP_PLATOS.slice(4).map((p) => (
            <div key={p.plato} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `0.5px solid ${COLORS.brd}`, fontFamily: LEXEND, fontSize: 13, color: COLORS.pri }}>
              <span>{p.plato}</span><span style={{ color: COLORS.mut, fontSize: 12 }}>{p.veces}× · {p.marca}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* INFORMES por dimensión */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ ...lbl }}>INFORMES DE VENTAS</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {INF_TABS.map(t => (
              <button key={t} onClick={() => setInf(t)} style={inf === t ? SUBTABS.active : SUBTABS.inactive}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ ...lblXs }}>VENTAS POR {inf.toUpperCase()}</span>
          <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.5px', padding: '1px 6px', borderRadius: 3, background: cur.nota === 'REAL' ? `${COLORS.ok}22` : `${COLORS.glovo}44`, color: cur.nota === 'REAL' ? COLORS.ok : COLORS.glovoDark }}>{cur.nota}</span>
        </div>
        <Barras data={cur.data} color={cur.color} sufijo={cur.sufijo} />
        {(inf === 'Familias' || inf === 'Categorías') && (
          <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLORS.mut, marginTop: 12 }}>
            Estimado de ejemplo. Saldrá real en cuanto la Carta tenga cada plato asignado a su familia/categoría.
          </div>
        )}
      </Card>
    </div>
  )
}
