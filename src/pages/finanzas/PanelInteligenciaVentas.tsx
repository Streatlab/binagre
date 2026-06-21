import { useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area, PieChart, Pie,
} from 'recharts'
import { fmtEur } from '@/utils/format'
import { COLORS, OSWALD, LEXEND, CARDS } from '@/components/panel/resumen/tokens'

/* ============================================================
   PANEL INTELIGENCIA · pestaña "Detalle ventas" del módulo Ventas.
   DATOS ESTIMADOS. Volumen (marcas/platos/franjas) = real Supabase;
   importes/ticket/comisiones/beneficio = estimados hasta enchufar export.
   ============================================================ */

const PLAT_COLOR: Record<string, string> = {
  'Uber Eats': '#1e2233', Glovo: '#f5c518', 'Just Eat': COLORS.redSL, 'Tienda online': COLORS.ok,
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

export default function PanelInteligenciaVentas() {
  const d = useMemo(() => {
    const totalLineas = MARCAS.reduce((a, m) => a + m.lineas, 0)
    const pedidos = Math.round(totalLineas / 1.8)
    const bruto = pedidos * TICKET_EST
    const plats = [
      { plataforma: 'Uber Eats', peso: 0.46 },
      { plataforma: 'Glovo', peso: 0.27 },
      { plataforma: 'Just Eat', peso: 0.15 },
      { plataforma: 'Tienda online', peso: 0.12 },
    ].map((p) => {
      const b = bruto * p.peso
      const comision = b * COMISION[p.plataforma]
      return { ...p, bruto: b, comision, neto: b - comision }
    })
    const comisionTotal = plats.reduce((a, p) => a + p.comision, 0)
    const neto = bruto - comisionTotal
    const comisionAnual = comisionTotal * (365 / 17)
    const marcas = MARCAS.map((m) => ({ ...m, bruto: (m.lineas / totalLineas) * bruto })).sort((a, b) => b.bruto - a.bruto)
    const evol = Array.from({ length: 17 }, (_, i) => {
      const base = bruto / 17
      const wd = new Date(2026, 5, i + 1).getDay()
      const f = wd === 0 || wd === 6 ? 1.35 : wd === 1 ? 0.7 : 1
      return { dia: `${i + 1}/6`, bruto: Math.round(base * f), neto: Math.round(base * f * 0.71) }
    })
    const cash = Array.from({ length: 8 }, (_, i) => ({ sem: `S${i + 1}`, entrada: Math.round(neto * (7 / 17) * (1 + i * 0.04)) }))
    return { pedidos, bruto, neto, comisionTotal, comisionAnual, plats, marcas, evol, cash }
  }, [])

  const tt = { background: '#1e2233', border: 'none', borderRadius: 8, color: 'white', fontFamily: LEXEND, fontSize: 12 }
  const titulo: React.CSSProperties = { fontFamily: OSWALD, fontSize: 13, fontWeight: 600, letterSpacing: '1px', color: COLORS.pri, textTransform: 'uppercase', marginBottom: 10 }
  const sub: React.CSSProperties = { fontFamily: LEXEND, fontSize: 11, color: COLORS.mut, marginTop: 8 }

  const kpis = [
    { label: 'Facturación bruta', value: fmtEur(d.bruto), color: COLORS.pri },
    { label: 'Te pagan (neto)', value: fmtEur(d.neto), color: COLORS.ok },
    { label: 'Pedidos', value: nf0(d.pedidos), color: COLORS.pri },
    { label: 'Comisión plataformas', value: fmtEur(d.comisionTotal), color: COLORS.redSL },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Aviso datos estimados */}
      <div style={{
        display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8,
        background: '#e8f44233', border: '0.5px solid #cdd44a', borderRadius: 999, padding: '4px 12px',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: '#B01D23' }} />
        <span style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '1px', color: '#7a6a00' }}>
          DATOS ESTIMADOS · se enchufarán a real con el export de plataformas
        </span>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {kpis.map((c) => (
          <div key={c.label} style={{ ...CARDS.std }}>
            <div style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 500, letterSpacing: '1.5px', color: COLORS.mut, textTransform: 'uppercase' }}>{c.label}</div>
            <div style={{ fontFamily: OSWALD, fontSize: 28, fontWeight: 600, color: c.color, lineHeight: 1.05, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Coste de depender */}
      <div style={{ ...CARDS.std, background: '#B01D2310', border: '0.5px solid #B01D2333' }}>
        <div style={{ fontFamily: OSWALD, fontSize: 12, fontWeight: 600, letterSpacing: '1px', color: COLORS.redSL, textTransform: 'uppercase' }}>Coste de depender de plataformas</div>
        <div style={{ fontFamily: OSWALD, fontSize: 34, fontWeight: 600, color: COLORS.redSL, lineHeight: 1.05, marginTop: 4 }}>
          {fmtEur(d.comisionAnual)} <span style={{ fontSize: 14, color: COLORS.mut }}>/año proyectado</span>
        </div>
        <div style={sub}>Cada pedido movido a tienda online (0% comisión) recupera ~30% de margen.</div>
      </div>

      {/* Reparto plataforma + Mapa horario */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ ...CARDS.std }}>
          <div style={titulo}>Reparto por plataforma (est.)</div>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={d.plats} dataKey="bruto" nameKey="plataforma" innerRadius={52} outerRadius={82} paddingAngle={2}>
                {d.plats.map((p) => <Cell key={p.plataforma} fill={PLAT_COLOR[p.plataforma]} />)}
              </Pie>
              <Tooltip formatter={tipEur} contentStyle={tt} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {d.plats.map((p) => (
              <div key={p.plataforma} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND, fontSize: 12, color: COLORS.sec }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: PLAT_COLOR[p.plataforma] }} />{p.plataforma}</span>
                <span style={{ fontFamily: OSWALD, fontWeight: 600 }}>{fmtEur(p.bruto)} · {Math.round(p.peso * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...CARDS.std }}>
          <div style={titulo}>Mapa horario (volumen real)</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={HORAS}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="h" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip contentStyle={tt} />
              <Bar dataKey="lineas" radius={[4, 4, 0, 0]}>
                {HORAS.map((x) => <Cell key={x.h} fill={x.lineas >= 14 ? COLORS.redSL : x.lineas >= 7 ? '#484f66' : '#cbd5e1'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={sub}>Picos a las 13h y 22h. Franja muerta 18-19h → candidata a apagar marcas.</div>
        </div>
      </div>

      {/* Evolución */}
      <div style={{ ...CARDS.std }}>
        <div style={titulo}>Evolución diaria (est.)</div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={d.evol}>
            <defs>
              <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.redSL} stopOpacity={0.32} />
                <stop offset="100%" stopColor={COLORS.redSL} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="dia" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={(v: number) => `${v}€`} />
            <Tooltip formatter={tipEur} contentStyle={tt} />
            <Area type="monotone" dataKey="bruto" stroke={COLORS.redSL} fill="url(#gv)" strokeWidth={2} name="Bruto" />
            <Line type="monotone" dataKey="neto" stroke={COLORS.ok} strokeWidth={2} dot={false} name="Neto" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Margen por plataforma */}
      <div style={{ ...CARDS.std }}>
        <div style={titulo}>Margen tras comisión por plataforma (est.)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {d.plats.map((p) => (
            <div key={p.plataforma} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 96, fontFamily: OSWALD, fontSize: 12, fontWeight: 600, color: COLORS.sec, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: PLAT_COLOR[p.plataforma] }} />{p.plataforma}
              </span>
              <div style={{ flex: 1, height: 26, borderRadius: 8, overflow: 'hidden', display: 'flex', background: '#f0eee9' }}>
                <div style={{ width: `${(p.neto / p.bruto) * 100}%`, background: COLORS.ok }} />
                <div style={{ width: `${COMISION[p.plataforma] * 100}%`, background: COLORS.redSL }} />
              </div>
              <span style={{ width: 170, textAlign: 'right', fontFamily: LEXEND, fontSize: 12, color: COLORS.sec }}>
                <b style={{ fontFamily: OSWALD }}>{fmtEur(p.neto)}</b> neto · <span style={{ color: COLORS.redSL }}>-{fmtEur(p.comision)}</span>
              </span>
            </div>
          ))}
        </div>
        <div style={{ ...sub, background: '#e8f44222', borderRadius: 8, padding: '8px 10px', marginTop: 12 }}>
          Tienda online deja ~30% más por euro. Palanca nº1: migrar clientes de Uber/Glovo a la web.
        </div>
      </div>

      {/* Marcas + Cashflow */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}>
        <div style={{ ...CARDS.std }}>
          <div style={titulo}>Ventas por marca (est.)</div>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={d.marcas} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" fontSize={11} tickFormatter={(v: number) => `${Math.round(v)}€`} />
              <YAxis type="category" dataKey="marca" width={140} fontSize={10} />
              <Tooltip formatter={tipEur} contentStyle={tt} />
              <Bar dataKey="bruto" fill={COLORS.redSL} radius={[0, 4, 4, 0]} name="Bruto" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ ...CARDS.std }}>
          <div style={titulo}>Cashflow proyectado · neto (est.)</div>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={d.cash}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="sem" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v: number) => `${v}€`} />
              <Tooltip formatter={tipEur} contentStyle={tt} />
              <Bar dataKey="entrada" fill="#1e2233" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Platos gancho / cola */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ ...CARDS.std }}>
          <div style={titulo}>Platos gancho (más vendidos · real)</div>
          {TOP_PLATOS.slice(0, 4).map((p) => (
            <div key={p.plato} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `0.5px solid ${COLORS.brd}`, fontFamily: LEXEND, fontSize: 13, color: COLORS.pri }}>
              <span>🔥 {p.plato}</span><span style={{ color: COLORS.mut, fontSize: 12 }}>{p.veces}× · {p.marca}</span>
            </div>
          ))}
        </div>
        <div style={{ ...CARDS.std }}>
          <div style={titulo}>Cola larga (1 venta · vigilar)</div>
          {TOP_PLATOS.slice(4).map((p) => (
            <div key={p.plato} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `0.5px solid ${COLORS.brd}`, fontFamily: LEXEND, fontSize: 13, color: COLORS.pri }}>
              <span>❄️ {p.plato}</span><span style={{ color: COLORS.mut, fontSize: 12 }}>{p.veces}× · {p.marca}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
