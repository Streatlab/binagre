import { useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import { Download, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fechaLocalStr } from '@/utils/fechaLocal'
import { fmtEur } from '@/utils/format'
import {
  COLORS, OSWALD, LEXEND, lbl, lblXs, kpiBig, CARDS, BAR, SUBTABS,
} from '@/components/panel/resumen/tokens'

/* ============================================================
   PANEL INTELIGENCIA — pestaña "Detalle ventas" del módulo Ventas.
   Lee el PERIODO del selector universal de arriba (desde/hasta).
   UNIDADES = reales (pedidos_plataforma). IMPORTES = estimados.
   Informes descargables en CSV y PDF.
   ============================================================ */

const TICKET_EST = 14.5
const COMISION: Record<string, number> = { 'Uber Eats': 0.30, Glovo: 0.30, 'Just Eat': 0.30, 'Tienda online': 0.0 }
const PLAT_COLOR: Record<string, string> = {
  'Uber Eats': COLORS.uber, Glovo: COLORS.glovo, 'Just Eat': COLORS.je, 'Tienda online': COLORS.redSL, Otras: COLORS.mut,
}
const NOMBRE_PLAT: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', just_eat: 'Just Eat', je: 'Just Eat', web: 'Tienda online', directa: 'Tienda online',
}
const nombrePlat = (p: string | null) => NOMBRE_PLAT[(p || '').toLowerCase().trim()] || 'Otras'

interface Linea {
  plataforma: string | null; marca: string | null; plato: string | null
  tipo_linea: string | null; hora: string | null; fecha: string | null; factura_origen: string | null
}
interface Fila { etiqueta: string; u: number }

const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES')
const tipEur = (v: any) => fmtEur(Number(v))

function agrupa(rows: Linea[], key: (r: Linea) => string | null, filtro?: (r: Linea) => boolean): Fila[] {
  const m = new Map<string, number>()
  for (const r of rows) {
    if (filtro && !filtro(r)) continue
    const k = (key(r) || '').trim(); if (!k) continue
    m.set(k, (m.get(k) || 0) + 1)
  }
  return Array.from(m, ([etiqueta, u]) => ({ etiqueta, u })).sort((a, b) => b.u - a.u)
}

/* Familias/categorías: estimación de ejemplo hasta mapear la Carta */
const INF_FAMILIAS: Fila[] = [
  { etiqueta: 'Guisos y caseros', u: 24 }, { etiqueta: 'Asiático / Ramen', u: 19 },
  { etiqueta: 'Pasta', u: 11 }, { etiqueta: 'Saludable', u: 7 },
  { etiqueta: 'Tacos / Mexicano', u: 4 }, { etiqueta: 'Milanesas', u: 3 }, { etiqueta: 'Menús', u: 1 },
]
const INF_CATEGORIAS: Fila[] = [
  { etiqueta: 'Principales', u: 41 }, { etiqueta: 'Entrantes', u: 18 },
  { etiqueta: 'Postres', u: 6 }, { etiqueta: 'Bebidas', u: 5 }, { etiqueta: 'Extras', u: 3 },
]

const tooltipStyle = { background: COLORS.sidebar, border: 'none', borderRadius: 8, color: '#fff', fontFamily: LEXEND, fontSize: 12 }
const tituloCard = { ...lbl, marginBottom: 12 }

function descargarCSV(nombre: string, dim: string, data: Fila[]) {
  const total = data.reduce((a, d) => a + d.u, 0) || 1
  const cab = `${dim};Unidades;Porcentaje\n`
  const cuerpo = data.map(d => `"${d.etiqueta.replace(/"/g, '""')}";${d.u};${Math.round((d.u / total) * 100)}%`).join('\n')
  const blob = new Blob(['\ufeff' + cab + cuerpo], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nombre; a.click(); URL.revokeObjectURL(a.href)
}

function descargarPDF(nombre: string, titulo: string, periodo: string, dim: string, data: Fila[]) {
  const total = data.reduce((a, d) => a + d.u, 0) || 1
  const doc = new jsPDF()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor('#B01D23')
  doc.text(titulo, 14, 18)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#555')
  doc.text(`Periodo: ${periodo}`, 14, 25)
  let y = 36
  doc.setFontSize(10); doc.setTextColor('#111'); doc.setFont('helvetica', 'bold')
  doc.text(dim, 14, y); doc.text('Unidades', 150, y); doc.text('%', 180, y)
  doc.setDrawColor('#ccc'); doc.line(14, y + 2, 196, y + 2)
  doc.setFont('helvetica', 'normal')
  data.forEach((r, i) => {
    y += 7
    if (y > 280) { doc.addPage(); y = 20 }
    const txt = r.etiqueta.length > 60 ? r.etiqueta.slice(0, 58) + '…' : r.etiqueta
    doc.text(`${i + 1}. ${txt}`, 14, y)
    doc.text(`${r.u}`, 150, y); doc.text(`${Math.round((r.u / total) * 100)}%`, 180, y)
  })
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.text(`Total: ${total} unidades`, 14, y)
  doc.save(nombre)
}

function Barras({ data, color, sufijo }: { data: Fila[]; color: string; sufijo: string }) {
  const max = Math.max(1, ...data.map(d => d.u))
  const total = data.reduce((a, d) => a + d.u, 0) || 1
  if (data.length === 0) return <div style={{ fontFamily: LEXEND, fontSize: 13, color: COLORS.mut, padding: '12px 0' }}>Sin datos en este periodo.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {data.map(d => (
        <div key={d.etiqueta} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 170, fontFamily: LEXEND, fontSize: 12, color: COLORS.sec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.etiqueta}>{d.etiqueta}</span>
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

interface Props { desde: Date; hasta: Date; marcasFiltro: string[]; canalesFiltro: string[] }

export default function PanelInteligenciaVentas({ desde, hasta, marcasFiltro, canalesFiltro }: Props) {
  const [rows, setRows] = useState<Linea[]>([])
  const [cargando, setCargando] = useState(true)
  const [inf, setInf] = useState<InfTab>('Productos')

  useEffect(() => {
    let alive = true
    setCargando(true)
    const d = fechaLocalStr(desde), h = fechaLocalStr(hasta)
    supabase
      .from('pedidos_plataforma')
      .select('plataforma, marca, plato, tipo_linea, hora, fecha, factura_origen')
      .gte('fecha', d).lte('fecha', h)
      .then(({ data }) => {
        if (!alive) return
        let r = (data as Linea[]) ?? []
        if (canalesFiltro.length) r = r.filter(x => canalesFiltro.includes((x.plataforma || '').toLowerCase().trim()))
        if (marcasFiltro.length) r = r.filter(x => marcasFiltro.includes(x.marca || 'SIN_MARCA'))
        setRows(r); setCargando(false)
      })
    return () => { alive = false }
  }, [desde, hasta, marcasFiltro, canalesFiltro])

  const periodoStr = `${fechaLocalStr(desde)} a ${fechaLocalStr(hasta)}`

  const d = useMemo(() => {
    const platos = rows.filter(r => r.tipo_linea === 'plato' || r.tipo_linea === 'bebida' || !r.tipo_linea)
    const pedidos = new Set(rows.map(r => r.factura_origen).filter(Boolean)).size || Math.round(rows.length / 1.8)
    const bruto = pedidos * TICKET_EST
    // peso por plataforma según pedidos reales
    const pedidosPlat = new Map<string, Set<string>>()
    for (const r of rows) {
      const n = nombrePlat(r.plataforma)
      if (!pedidosPlat.has(n)) pedidosPlat.set(n, new Set())
      if (r.factura_origen) pedidosPlat.get(n)!.add(r.factura_origen)
    }
    const totPed = Array.from(pedidosPlat.values()).reduce((a, s) => a + s.size, 0) || 1
    const plataformas = Array.from(pedidosPlat, ([plataforma, s]) => {
      const peso = s.size / totPed
      const b = bruto * peso
      const com = b * (COMISION[plataforma] ?? 0.30)
      return { plataforma, peso, bruto: b, comision: com, neto: b - com }
    }).sort((a, b) => b.bruto - a.bruto)
    const comisionTotal = plataformas.reduce((a, p) => a + p.comision, 0)
    const dias = Math.max(1, Math.round((hasta.getTime() - desde.getTime()) / 86400000) + 1)

    const porMarca = agrupa(rows, r => r.marca, r => r.tipo_linea !== 'cargo')
    const porProducto = agrupa(platos, r => r.plato)
    const porModificador = agrupa(rows, r => r.plato, r => r.tipo_linea === 'modificador')
    const porHoraMap = agrupa(rows, r => (r.hora ? `${r.hora.slice(0, 2)}h` : null)).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta))
    const evolMap = new Map<string, number>()
    for (const r of rows) { if (r.fecha) { const k = r.fecha.slice(5).replace('-', '/'); evolMap.set(k, (evolMap.get(k) || 0) + 1) } }
    const evolucion = Array.from(evolMap, ([dia, u]) => ({ dia, bruto: Math.round((u / Math.max(1, rows.length)) * bruto), neto: Math.round((u / Math.max(1, rows.length)) * (bruto - comisionTotal)) }))

    return {
      pedidos, bruto, neto: bruto - comisionTotal, comisionTotal, comisionAnual: comisionTotal * (365 / dias),
      plataformas, porMarca, porProducto, porModificador, porHora: porHoraMap, evolucion, unidades: platos.length,
    }
  }, [rows, desde, hasta])

  const infData: Record<InfTab, { data: Fila[]; color: string; nota: 'REAL' | 'EST.'; sufijo: string }> = {
    Productos: { data: d.porProducto, color: COLORS.ok, nota: 'REAL', sufijo: '×' },
    Familias: { data: INF_FAMILIAS, color: COLORS.modal, nota: 'EST.', sufijo: ' uds' },
    Categorías: { data: INF_CATEGORIAS, color: COLORS.modal, nota: 'EST.', sufijo: ' uds' },
    Marcas: { data: d.porMarca, color: COLORS.sidebar, nota: 'REAL', sufijo: ' uds' },
    Modificadores: { data: d.porModificador, color: COLORS.je, nota: 'REAL', sufijo: '×' },
  }
  const cur = infData[inf]
  const fileBase = `ventas_${inf.toLowerCase()}_${fechaLocalStr(desde)}_${fechaLocalStr(hasta)}`

  if (cargando) return <div style={{ ...CARDS.std, textAlign: 'center', color: COLORS.mut, fontFamily: LEXEND, padding: 28 }}>Cargando…</div>

  const kpis = [
    { label: 'FACTURACIÓN BRUTA (EST.)', value: fmtEur(d.bruto), color: COLORS.redSL },
    { label: 'TE PAGAN (EST.)', value: fmtEur(d.neto), color: COLORS.ok },
    { label: 'PEDIDOS', value: nf0(d.pedidos), color: COLORS.pri },
    { label: 'UNIDADES', value: nf0(d.unidades), color: COLORS.pri },
  ]

  const btn = (activo: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
    border: `0.5px solid ${COLORS.brd}`, background: '#fff', color: COLORS.sec,
    fontFamily: LEXEND, fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: activo ? 1 : 0.5,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, background: `${COLORS.glovo}33`, border: `0.5px solid ${COLORS.glovoDark}55`, borderRadius: 10, padding: '5px 12px' }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: COLORS.redSL }} />
        <span style={{ ...lblXs, color: COLORS.glovoDark }}>UNIDADES REALES DEL PERIODO · IMPORTES ESTIMADOS HASTA ENCHUFAR EXPORT</span>
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
      <div style={{ ...CARDS.std, background: `${COLORS.redSL}0d`, border: `0.5px solid ${COLORS.redSL}33` }}>
        <div style={{ ...lbl, color: COLORS.redSL }}>COSTE DE DEPENDER DE PLATAFORMAS</div>
        <div style={{ fontFamily: OSWALD, fontSize: 34, fontWeight: 600, color: COLORS.redSL, lineHeight: 1.05, marginTop: 4 }}>
          {fmtEur(d.comisionAnual)} <span style={{ fontSize: 14, color: COLORS.mut }}>/año proyectado</span>
        </div>
        <div style={{ fontFamily: LEXEND, fontSize: 12, color: COLORS.sec, marginTop: 6 }}>Cada pedido movido a tienda online (0% comisión) recupera ~30% de margen.</div>
      </div>

      {/* Reparto + Mapa horario */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ ...CARDS.std }}>
          <div style={tituloCard}>REPARTO POR PLATAFORMA (EST.)</div>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={d.plataformas} dataKey="bruto" nameKey="plataforma" innerRadius={52} outerRadius={82} paddingAngle={2}>
                {d.plataformas.map((p) => <Cell key={p.plataforma} fill={PLAT_COLOR[p.plataforma] || COLORS.mut} />)}
              </Pie>
              <Tooltip formatter={tipEur} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {d.plataformas.map((p) => (
              <div key={p.plataforma} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND, fontSize: 12, color: COLORS.sec }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: PLAT_COLOR[p.plataforma] || COLORS.mut }} />{p.plataforma}</span>
                <span style={{ fontFamily: OSWALD, fontWeight: 600 }}>{fmtEur(p.bruto)} · {Math.round(p.peso * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...CARDS.std }}>
          <div style={tituloCard}>VENTAS POR FRANJA HORARIA (REAL)</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={d.porHora}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.group} />
              <XAxis dataKey="etiqueta" fontSize={11} stroke={COLORS.mut} />
              <YAxis fontSize={11} stroke={COLORS.mut} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="u" radius={[4, 4, 0, 0]}>
                {d.porHora.map((x) => <Cell key={x.etiqueta} fill={COLORS.redSL} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Evolución */}
      <div style={{ ...CARDS.std }}>
        <div style={tituloCard}>EVOLUCIÓN EN EL PERIODO (EST.)</div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={d.evolucion}>
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
      </div>

      {/* Margen por plataforma */}
      <div style={{ ...CARDS.std }}>
        <div style={tituloCard}>MARGEN TRAS COMISIÓN POR PLATAFORMA (EST.)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {d.plataformas.map((p) => (
            <div key={p.plataforma} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 110, fontFamily: OSWALD, fontSize: 12, fontWeight: 600, color: COLORS.sec, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: PLAT_COLOR[p.plataforma] || COLORS.mut }} />{p.plataforma}
              </span>
              <div style={{ flex: 1, height: 24, borderRadius: 8, overflow: 'hidden', display: 'flex', background: COLORS.group }}>
                <div style={{ width: `${p.bruto ? (p.neto / p.bruto) * 100 : 0}%`, background: COLORS.ok }} />
                <div style={{ width: `${(COMISION[p.plataforma] ?? 0.3) * 100}%`, background: COLORS.redSL }} />
              </div>
              <span style={{ width: 170, textAlign: 'right', fontFamily: LEXEND, fontSize: 12, color: COLORS.sec }}>
                <b style={{ fontFamily: OSWALD }}>{fmtEur(p.neto)}</b> neto · <span style={{ color: COLORS.redSL }}>-{fmtEur(p.comision)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* INFORMES por dimensión — con descarga */}
      <div style={{ ...CARDS.std }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ ...lbl }}>INFORMES DE VENTAS</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {INF_TABS.map(t => (
              <button key={t} onClick={() => setInf(t)} style={inf === t ? SUBTABS.active : SUBTABS.inactive}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...lblXs }}>VENTAS POR {inf.toUpperCase()}</span>
            <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.5px', padding: '1px 6px', borderRadius: 3, background: cur.nota === 'REAL' ? `${COLORS.ok}22` : `${COLORS.glovo}44`, color: cur.nota === 'REAL' ? COLORS.ok : COLORS.glovoDark }}>{cur.nota}</span>
            <span style={{ fontFamily: LEXEND, fontSize: 11, color: COLORS.mut }}>· {periodoStr}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn(cur.data.length > 0)} disabled={cur.data.length === 0}
              onClick={() => descargarCSV(`${fileBase}.csv`, inf, cur.data)}>
              <Download size={14} /> CSV
            </button>
            <button style={btn(cur.data.length > 0)} disabled={cur.data.length === 0}
              onClick={() => descargarPDF(`${fileBase}.pdf`, `Ventas por ${inf}`, periodoStr, inf, cur.data)}>
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>

        <Barras data={cur.data} color={cur.color} sufijo={cur.sufijo} />
        {(inf === 'Familias' || inf === 'Categorías') && (
          <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLORS.mut, marginTop: 12 }}>
            Estimado de ejemplo. Saldrá real en cuanto la Carta tenga cada plato asignado a su familia/categoría.
          </div>
        )}
      </div>
    </div>
  )
}

/* recharts imports al final para mantener orden de helpers arriba */
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area, PieChart, Pie,
} from 'recharts'
