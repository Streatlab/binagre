/**
 * ResumenLanding v14 — pestaña Resumen del Panel Global (neobrutal Food Pop).
 * v14: bloque "Días pico" con altura contenida (deja de estirarse a toda la columna;
 *      el sobrante queda como fondo del panel, no amarillo).
 * v13: tabla de Resultado coherente cuando faltan costes (Margen bruto y Resultado neto en "—").
 * Mantiene: dos rectángulos (cuándo te compran + días pico), te deben rellena columna,
 *      Resultado en verde petróleo, PE en color propio, sombra única 4px, color por métrica.
 */
import { useState } from 'react'
import { fmtEur, fmtPct, fmtNum } from '@/lib/format'
import type { CanalStat, ObjetivosVentas, PagoProximoItem, TopVentaItem } from './types'
import type { GrupoGasto } from './ColGruposGasto'
import type { DiaPico } from './ColDiasPico'
import type { PorCobrarResult } from '@/lib/panel/calcPorCobrar'
import { elegirFrase, type MetricasInsight } from './frasesInsight'

const INK = '#140f08'
const OSC = '#2b2117'
const CREMA = '#FCEFD6'
const CLARO = '#F3D9A8'
const ROSA_CL = '#ffe0ea'
const LAV = '#d8e3ff'      // azul lavanda claro (Punto de equilibrio)
const TEAL = '#0F3D35'     // verde petróleo saturado (Resultado del periodo)
const TRACK = '#ecdcb8'
const TRACK_CANAL = '#e2dac9'
const ROSA = '#FF2E63'   // acento (no significa "malo")
const ROJO = '#FF1E27'   // negativo (semántico)
const AMA = '#FFC400'
const VERDE = '#0FB86B'  // positivo (semántico) · métrica Neto/TM neto
const NAR = '#FF6A1A'    // métrica Pedidos · aviso intermedio
const AZUL = '#2D5BFF'   // métrica TM bruto
const GRIS = '#9a8f78'
const SHADOW = `4px 4px 0 ${INK}`   // sombra única de todo el ERP
const OSW = "'Oswald', sans-serif"
const LEX = "'Lexend', sans-serif"
const PAD = '40px'

// colores corporativos de plataforma
const CORP: Record<string, string> = { uber: '#06C167', glovo: '#FFC244', je: '#FF8000', web: '#B01D23', dir: '#1e2233' }
const CLARA: Record<string, boolean> = { uber: true, glovo: true, je: false, web: false, dir: false }
const OBJ_MARGEN: Record<string, number> = { uber: 55, glovo: 55, je: 55, web: 88, dir: 92 }

// textos sobre fondo oscuro
const D1 = CREMA

const d = (size: string, color = INK): React.CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color })
const eyebrow = (bg: string, color = INK): React.CSSProperties => ({ display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 12px' })

const EUR = (n: number) => fmtEur(n, { decimals: 0 })
const E = (n: number) => fmtEur(n, { showEuro: false, decimals: 0 })
const E2 = (n: number) => fmtEur(n, { showEuro: false, decimals: 2 })
const N = (n: number) => fmtNum(n, 0)
const P0 = (n: number) => fmtPct(n, 0)
const P2 = (n: number) => fmtPct(n, 2)
const DELTA = (v: number | null) => (v == null ? '—' : fmtEur(v, { signed: true, showEuro: false, decimals: 1 }) + '%')

function serieEstimada(bruto: number): number[] {
  const b = bruto > 0 ? bruto : 100
  const factores = [0.62, 0.71, 0.79, 0.88, 0.95, 1]
  return factores.map(f => b * f)
}

const PCT_EST = [46, 37, 28, 19, 11]

function Est({ light = false, tip = 'Dato estimado · todavía no proviene del Running / datos reales' }: { light?: boolean; tip?: string }) {
  return <span title={tip} style={{ fontFamily: OSW, fontSize: 9, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', border: `1px solid ${light ? '#ffffff66' : '#00000044'}`, color: light ? '#ffffffcc' : '#00000088', padding: '0 4px', marginLeft: 6, verticalAlign: 'middle', cursor: 'help', borderRadius: 3 }}>est</span>
}

function Arrow({ v }: { v: number | null }) {
  if (v == null) return null
  const up = v >= 0
  return <span style={{ fontSize: '0.62em', marginRight: 5, color: up ? VERDE : ROJO }}>{up ? '▲' : '▼'}</span>
}

interface GrupoData { gasto: number; presupuesto: number; pctSobreNetos: number }
interface RepartoRow { nombre: string; bruto: number; neto: number; pedidos: number; pct: number }
interface MarcaRealRow { nombre: string; neto: number; bruto: number; pedidos: number; tmBruto: number; pct: number; serie?: number[]; varPct?: number | null }
type NavTab = 'operaciones' | 'finanzas' | 'cashflow' | 'marcas' | 'evolucion'

interface Props {
  datosDemo: boolean
  periodoLabel?: string
  periodoRango?: string
  semanaLabel: string
  semanaRango: string
  mesLabel: string
  anoLabel: number
  ventasPeriodo: number
  netoEstimado: number
  margenNetoReal: number
  variacionVentas: number | null
  variacionPedidos: number | null
  variacionTM: number | null
  pedidosPeriodo: number
  tmBruto: number
  tmNeto: number
  ebitda: number
  ebitdaPct: number
  primeCostPct: number
  costePorPedido: { comision: number; producto: number; total: number }
  cierreMes: number
  objetivoMes: number
  serie: number[]
  ventasSemana: number
  ventasMes: number
  ventasAno: number
  objetivos: ObjetivosVentas
  diario: { objetivo: number; real: number } | null
  canalStats: CanalStat[]
  grupos: Record<GrupoGasto, GrupoData>
  diasPico: DiaPico[]
  mediaDiariaPico: number
  saldo: { saldoHoy: number; cobros7d: number; pagos7d: number; cobros30d: number; pagos30d: number }
  ratioActual: number
  objetivoRatio: number
  gastosFijosMes: number
  gastosReales: number
  netosReales: number
  pe: { peBruto: number; acumulado: number; pctProgreso: number; faltan: number; diaVerdeEstimado: { fecha: string; diaSemana: string } | null; realFacDia: number; realPedDia: number }
  provisiones: { totalAGuardar: number; provIVA: number; provIRPF: number; proximosPagos: PagoProximoItem[] }
  porCobrar: PorCobrarResult
  topItems: TopVentaItem[]
  topDatosDemo: boolean
  topTab: 'productos' | 'modificadores'
  onTopTab: (t: 'productos' | 'modificadores') => void
  servicios: RepartoRow[]
  serviciosHay: boolean
  marcasReales: MarcaRealRow[]
  marcasRealesHay: boolean
  metricas: MetricasInsight
  onSaveObjetivoVenta: (tipo: 'semanal' | 'mensual' | 'anual', valor: number | null) => void
  onSaveObjetivoRatio: (valor: number | null) => void
  onSavePresupuestoGrupo: (grupo: GrupoGasto, valor: number | null) => void
  onFiltrarDiaSemana?: (idx: number) => void
  onNavTab?: (tab: NavTab) => void
}

function Edit({ value, onSave, suffix = '', color = INK }: { value: number; onSave: (v: number | null) => void; suffix?: string; color?: string }) {
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState(String(Math.round(value)))
  if (!edit) return <button onClick={() => { setVal(String(Math.round(value))); setEdit(true) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', fontFamily: OSW, fontWeight: 700, fontSize: 'inherit', letterSpacing: '-0.5px', color, textDecoration: 'underline dotted', textUnderlineOffset: 3, padding: 0 }}>{value > 0 ? N(value) + suffix : 'fijar'}</button>
  const commit = () => { const n = parseFloat(val.replace(/\./g, '').replace(',', '.')); onSave(Number.isFinite(n) ? n : null); setEdit(false) }
  return <input autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEdit(false) }} style={{ width: '4.5em', fontFamily: OSW, fontWeight: 700, fontSize: 'inherit', letterSpacing: '-0.5px', border: `2px solid ${INK}`, padding: '0 4px', background: '#fff', color: AZUL }} />
}

const Title: React.FC<{ tag: string; tagBg: string; tagColor?: string; title: string; dark?: boolean; nav?: { label: string; onClick?: () => void } }> = ({ tag, tagBg, tagColor = INK, title, dark, nav }) => (
  <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={eyebrow(tagBg, tagColor)}>{tag}</span>
      {nav && <button onClick={nav.onClick} style={{ ...eyebrow('#fff'), cursor: 'pointer', fontSize: 12 }}>{nav.label} →</button>}
    </div>
    {title && <div style={{ ...d('clamp(24px,3vw,38px)', dark ? D1 : INK), margin: '14px 0 22px' }}>{title}</div>}
  </>
)

function Spark({ serie, color = INK, w = 240, h = 54, dashed = false }: { serie: number[]; color?: string; w?: number; h?: number; dashed?: boolean }) {
  if (!serie || serie.length < 2) return null
  const max = Math.max(1, ...serie), step = w / (serie.length - 1)
  const path = serie.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(h - (v / max) * h).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: w, height: h }} preserveAspectRatio="none">
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={`${color}${dashed ? '14' : '22'}`} />
      <path d={path} fill="none" stroke={color} strokeWidth={dashed ? 2.5 : 3} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dashed ? '5 4' : undefined} />
    </svg>
  )
}

function Barra({ nombre, pct, color, valor, alto = 34, track = TRACK }: { nombre: string; pct: number; color: string; valor: string; alto?: number; track?: string }) {
  const fill = Math.min(100, Math.max(0, pct))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ ...d('15px'), width: 104, flexShrink: 0, lineHeight: 1.05 }}>{nombre}</span>
      <div style={{ position: 'relative', flex: 1, height: alto, background: track, border: `3px solid ${INK}`, overflow: 'hidden' }}>
        <div style={{ width: `${fill}%`, height: '100%', background: color, transition: 'width .3s', boxShadow: `2px 0 0 ${INK}` }} />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', ...d('17px') }}>{P0(pct)}</span>
      </div>
      <span style={{ ...d('17px'), width: 96, textAlign: 'right', flexShrink: 0 }}>{valor}</span>
    </div>
  )
}

export default function ResumenLanding(p: Props) {
  const [verCostes, setVerCostes] = useState(false)
  const netoPct = p.ventasPeriodo > 0 ? (p.netoEstimado / p.ventasPeriodo) * 100 : 0
  const maxDia = Math.max(1, ...p.diasPico.map(x => x.valor))
  const diasConV = p.diasPico.filter(x => x.valor > 0)
  const diaFuerte = diasConV.length ? diasConV.reduce((a, x) => x.valor > a.valor ? x : a) : null
  const diaFlojo = diasConV.length ? diasConV.reduce((a, x) => x.valor < a.valor ? x : a) : null

  // ¿hay costes cargados? Si no, no calculamos derivados (evita mostrar margen=neto=resultado)
  const hayProducto = p.grupos.producto.gasto > 0
  const hayCostes = hayProducto || p.grupos.equipo.gasto > 0 || p.grupos.local.gasto > 0 || p.grupos.controlables.gasto > 0
  const margenBruto = p.netoEstimado - p.grupos.producto.gasto
  const resultadoNetoPL = p.netoEstimado - (p.grupos.producto.gasto + p.grupos.equipo.gasto + p.grupos.local.gasto + p.grupos.controlables.gasto)

  const totalCanal = p.canalStats.reduce((a, c) => a + c.bruto, 0)
  const DI = 'Datos insuf.'
  const canalRent = p.canalStats.filter(c => c.pedidos > 0).map(c => ({ id: c.id, np: c.neto / c.pedidos })).sort((a, b) => b.np - a.np)[0]?.id

  const frase = elegirFrase(p.metricas)
  const fraseCostes = elegirFrase(p.metricas, 'costes')
  const mostrarCostes = fraseCostes.lead !== 'Comer bien'

  const m = p.metricas

  const saludFlags: string[] = []
  if (m.variacionVentas != null && m.variacionVentas < -3) saludFlags.push(`Ventas ${DELTA(m.variacionVentas)} vs anterior`)
  if (m.primeCostPct > 65) saludFlags.push(`Prime cost ${P0(m.primeCostPct)}`)
  if (m.ratioGap < 0) saludFlags.push('Ratio bajo objetivo')
  if (m.faltaPE > 0 && m.pePctProgreso < 70) saludFlags.push(`Cubre gastos ${P0(m.pePctProgreso)}`)
  if (m.margenNetoPct > 0 && m.margenNetoPct < 55) saludFlags.push(`Margen ${P0(m.margenNetoPct)}`)
  const saludNivel: 'verde' | 'ambar' | 'rojo' = saludFlags.length === 0 ? 'verde' : saludFlags.length <= 2 ? 'ambar' : 'rojo'
  const saludBg = saludNivel === 'verde' ? VERDE : saludNivel === 'ambar' ? NAR : ROJO
  const saludTxt = '#fff'
  const saludTitulo = saludNivel === 'verde' ? 'Semana sana' : saludNivel === 'ambar' ? 'Ojo, un par de cosas' : 'Atención: varios frentes'
  const saludPuntos = saludFlags.length
    ? saludFlags.slice(0, 3)
    : [
        p.ebitda >= 0 ? `EBITDA ${P0(p.ebitdaPct)}` : '',
        `Margen ${P0(m.margenNetoPct)}`,
        p.porCobrar.total > 0 ? `${E(p.porCobrar.total)} por cobrar` : '',
      ].filter(Boolean)
  const actualizado = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  const alertas: Array<{ t: string; c: string }> = []
  if (m.variacionVentas != null && m.variacionVentas < -3) alertas.push({ t: `Ventas ${DELTA(m.variacionVentas)} vs periodo ant.`, c: ROJO })
  if (m.primeCostPct > 65) alertas.push({ t: `Prime cost ${P0(m.primeCostPct)}`, c: NAR })
  if (m.faltaPE > 0 && m.pePctProgreso < 70) alertas.push({ t: `Faltan ${E(m.faltaPE)} para cubrir gastos`, c: NAR })
  if (m.ratioGap < 0) alertas.push({ t: `Ratio ${m.ratioActual.toFixed(2)}× bajo objetivo`, c: NAR })
  if (m.webPct < 10) alertas.push({ t: `Web solo ${P0(m.webPct)} de ventas`, c: AZUL })
  if (p.porCobrar.total > 0) alertas.push({ t: `Por cobrar ${E(p.porCobrar.total)} de plataformas`, c: AZUL })
  if (diaFlojo) alertas.push({ t: `Día flojo: ${diaFlojo.nombre} ${E(diaFlojo.valor)}`, c: AZUL })

  const objetivos: Array<{ k: 'semanal' | 'mensual' | 'anual'; lbl: string; real: number; obj: number }> = [
    { k: 'semanal', lbl: `${p.semanaLabel} · ${p.semanaRango}`, real: p.ventasSemana, obj: p.objetivos.semanal },
    { k: 'mensual', lbl: p.mesLabel, real: p.ventasMes, obj: p.objetivos.mensual },
    { k: 'anual', lbl: String(p.anoLabel), real: p.ventasAno, obj: p.objetivos.anual },
  ]
  const grupoMeta: Record<GrupoGasto, { obj: number }> = { producto: { obj: 30 }, equipo: { obj: 40 }, local: { obj: 15 }, controlables: { obj: 15 } }
  const pctN = (g: number) => p.netoEstimado > 0 ? (g / p.netoEstimado) * 100 : 0

  type Fila = { l: string; imp: string; impC: string; pct?: string; grupo?: GrupoGasto; bold?: boolean; dot: string; falta?: boolean }
  const filasBase: Fila[] = [
    { l: 'Facturación', imp: E2(p.ventasPeriodo), impC: INK, dot: INK },
    { l: 'Ingresos netos', imp: E2(p.netoEstimado), impC: VERDE, pct: P0(netoPct), bold: true, dot: VERDE },
    { l: 'Margen bruto', imp: hayProducto ? E2(margenBruto) : '—', impC: hayProducto ? INK : GRIS, bold: true, dot: hayProducto ? AMA : GRIS, falta: !hayProducto },
    { l: 'Resultado neto', imp: hayCostes ? E2(resultadoNetoPL) : '—', impC: hayCostes ? (resultadoNetoPL >= 0 ? VERDE : ROJO) : GRIS, bold: true, dot: hayCostes ? (resultadoNetoPL >= 0 ? VERDE : ROJO) : GRIS, falta: !hayCostes },
  ]
  const filaCoste = (l: string, g: GrupoGasto): Fila => ({
    l, grupo: g,
    imp: p.grupos[g].gasto > 0 ? '−' + E2(p.grupos[g].gasto) : DI,
    impC: p.grupos[g].gasto > 0 ? NAR : GRIS,
    pct: p.grupos[g].gasto > 0 ? P0(pctN(p.grupos[g].gasto)) : undefined,
    dot: NAR,
  })
  const filasCoste: Fila[] = [
    filaCoste('Producto · COGS', 'producto'),
    filaCoste('Equipo · Labor', 'equipo'),
    filaCoste('Local · Occupancy', 'local'),
    filaCoste('Controlables · Opex', 'controlables'),
  ]

  const desv = [
    { v: DELTA(p.variacionVentas), raw: p.variacionVentas, l: 'ventas', c: p.variacionVentas != null && p.variacionVentas < 0 ? ROJO : VERDE },
    { v: DELTA(p.variacionPedidos), raw: p.variacionPedidos, l: 'pedidos', c: p.variacionPedidos != null && p.variacionPedidos < 0 ? ROJO : VERDE },
    { v: DELTA(p.variacionTM), raw: p.variacionTM, l: 'ticket medio', c: p.variacionTM != null && p.variacionTM < 0 ? ROJO : VERDE },
  ]
  const heroStats: Array<{ l: string; v: string; c: string; est?: boolean; tip?: string }> = [
    { l: 'TM bruto', v: E2(p.tmBruto), c: AZUL, tip: 'Ticket medio bruto = facturación / pedidos' },
    { l: 'TM neto', v: E2(p.tmNeto), c: VERDE, tip: 'Ticket medio neto = ingresos netos / pedidos', est: true },
    { l: 'Coste/pedido', v: E2(p.costePorPedido.total), c: NAR, est: true, tip: `Coste real por pedido: comisión plataforma ${E2(p.costePorPedido.comision)} + producto ${E2(p.costePorPedido.producto)}` },
    { l: 'EBITDA est.', v: E(p.ebitda), c: p.ebitda >= 0 ? VERDE : ROJO, est: true, tip: 'Beneficio operativo estimado: ingresos − producto − personal − resto de gastos' },
    { l: 'Margen neto', v: P2(p.margenNetoReal), c: INK, tip: 'Ingresos netos sobre facturación bruta' },
  ]
  const servColor = [AMA, AZUL, VERDE, NAR, ROSA]
  const marcaColor = [ROSA, AZUL, VERDE, NAR, AMA, '#8A4FFF', '#0FB8B8']
  const marcas5 = p.marcasReales.slice(0, 5)

  const marcasVar = marcas5.filter(mk => mk.varPct != null)
  const marcaSube = marcasVar.length ? marcasVar.reduce((a, x) => ((x.varPct as number) > (a.varPct as number) ? x : a)) : null
  const marcaCae = marcasVar.length ? marcasVar.reduce((a, x) => ((x.varPct as number) < (a.varPct as number) ? x : a)) : null

  const servOrden = [...p.servicios].sort((a, b) => b.bruto - a.bruto)
  const mejorServ = servOrden[0] ?? null
  const flojoServ = servOrden.length > 1 ? servOrden[servOrden.length - 1] : null

  const pctCierre = p.objetivoMes > 0 ? (p.cierreMes / p.objetivoMes) * 100 : 0

  const sec = (bg: string, pad = `44px ${PAD}`): React.CSSProperties => ({ background: bg, padding: pad, borderBottom: `4px solid ${INK}` })

  return (
    <div style={{ background: CREMA, fontFamily: LEX, color: INK, border: `4px solid ${INK}` }}>
      {p.datosDemo && <div style={{ background: AMA, borderBottom: `4px solid ${INK}`, padding: `8px ${PAD}`, fontFamily: OSW, letterSpacing: '1px', fontSize: 13, textTransform: 'uppercase' }}>Datos demo · BD vacía o sin datos en este periodo</div>}

      {/* 0 · ESTADO DE SALUD */}
      <section style={{ background: saludBg, color: saludTxt, borderBottom: `4px solid ${INK}`, padding: `20px ${PAD}`, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24, alignItems: 'center' }}>
        <div>
          <div style={{ ...d('clamp(26px,3.4vw,42px)', saludTxt) }}>{saludTitulo}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {saludPuntos.map((t, i) => (
              <span key={i} style={{ fontFamily: OSW, fontWeight: 700, fontSize: 'clamp(15px,1.7vw,19px)', lineHeight: 1, letterSpacing: '0.3px', textTransform: 'uppercase', background: '#ffffff26', border: `2px solid #ffffff66`, color: '#fff', padding: '5px 11px' }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.85 }}>Periodo</div>
          <div style={d('clamp(18px,2.2vw,26px)', saludTxt)}>{p.periodoLabel ?? '—'}</div>
          {p.periodoRango && <div style={{ fontFamily: OSW, fontSize: 13.5, letterSpacing: '0.5px', textTransform: 'uppercase', opacity: 0.92, marginTop: 4 }}>{p.periodoRango}</div>}
          <div style={{ fontFamily: OSW, fontSize: 11.5, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8, marginTop: 8 }}>Actualizado {actualizado} · Panel Global</div>
        </div>
      </section>

      {/* 1 · HERO */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', borderBottom: `4px solid ${INK}`, background: AMA }}>
        <div style={{ padding: `42px ${PAD} 40px`, borderRight: `4px solid ${INK}` }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={eyebrow('#fff')}>Comer bien. Aquí y ahora.</span>
            {p.periodoLabel && <span style={{ ...eyebrow(INK, AMA), fontSize: 12 }}>{p.periodoLabel}</span>}
          </div>
          <div style={{ ...d('clamp(32px,4.2vw,56px)'), margin: '18px 0 18px', maxWidth: 640 }}>
            {p.pedidosPeriodo > 0
              ? <>Has entregado <span style={{ background: INK, color: NAR, padding: '0 .14em', display: 'inline-block' }}>{N(p.pedidosPeriodo)}</span> pedidos.</>
              : 'Aún no hay pedidos entregados.'}
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Facturación bruta</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
                <div style={d('clamp(44px,6.8vw,92px)')}>{EUR(p.ventasPeriodo)}</div>
                {p.variacionVentas != null && <div style={{ ...eyebrow(p.variacionVentas >= 0 ? VERDE : ROJO, '#fff'), fontSize: 18, padding: '7px 12px', marginBottom: 10 }}><Arrow v={p.variacionVentas} />{DELTA(p.variacionVentas)}</div>}
              </div>
            </div>
            <div style={{ marginBottom: 4 }}><Spark serie={p.serie} color={INK} /></div>
          </div>
          <div title="Lo que te queda tras las comisiones de plataforma. Estimado a partir de las fórmulas de comisión." style={{ display: 'inline-flex', alignItems: 'baseline', gap: 12, background: VERDE, color: '#fff', border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '8px 16px', marginTop: 18, cursor: 'help' }}>
            <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Neto estimado</span>
            <span style={d('clamp(24px,3.4vw,40px)', '#fff')}>{EUR(p.netoEstimado)}</span>
            <span style={{ fontFamily: OSW, fontSize: 15, fontWeight: 600 }}>{P2(netoPct)} s/ bruto</span>
            <Est light />
          </div>
        </div>
        <div style={{ background: CLARO, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
          <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '26px 28px', width: '100%', maxWidth: 380 }}>
            <div style={{ ...d('17px'), borderBottom: `2px dashed ${INK}`, paddingBottom: 12, marginBottom: 4 }}>· Resumen del periodo ·</div>
            {heroStats.map((s, i) => (
              <div key={s.l} title={s.tip} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '13px 0', borderBottom: i < heroStats.length - 1 ? `1px dotted ${INK}55` : 'none', cursor: s.tip ? 'help' : 'default' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{s.l}{s.est && <Est />}</span>
                <span style={d('clamp(22px,3vw,30px)', s.c)}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2 · ALERTAS */}
      <section style={{ background: OSC, borderBottom: `4px solid ${INK}`, padding: `18px ${PAD}`, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ ...d('16px', D1), marginRight: 4 }}>Atención →</span>
        {alertas.length === 0
          ? <span style={{ ...eyebrow(VERDE, '#fff'), fontSize: 13 }}>Todo en orden</span>
          : alertas.slice(0, 5).map((a, i) => (
            <span key={i} style={{ display: 'inline-block', background: '#fff', border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${a.c}`, fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '6px 12px' }}>{a.t}</span>
          ))}
      </section>

      {/* 3 · DESVIACIONES */}
      <section style={{ background: CREMA, borderBottom: `4px solid ${INK}`, padding: `20px ${PAD} 0` }}>
        <span style={{ ...eyebrow(AZUL, '#fff'), fontSize: 12 }}>Comparado con el periodo anterior de igual duración</span>
      </section>
      <section style={{ background: CREMA, borderBottom: `4px solid ${INK}`, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
        {desv.map((x, i) => (
          <div key={i} style={{ padding: '20px 22px 26px', borderRight: i < 2 ? `2px solid ${INK}22` : 'none' }}>
            <div style={d('clamp(30px,4.4vw,52px)', x.c)}><Arrow v={x.raw} />{x.v}</div>
            <div style={{ fontFamily: OSW, letterSpacing: '1.5px', fontSize: 12.5, color: '#6b5d45', textTransform: 'uppercase', marginTop: 6 }}>{x.l} · vs periodo anterior</div>
          </div>
        ))}
      </section>

      {/* 4 · FRASE (ROSA — acento) */}
      <section style={{ background: ROSA, color: '#fff', padding: `46px ${PAD}`, borderBottom: `4px solid ${INK}` }}>
        <div style={{ ...d('clamp(28px,4.4vw,54px)', '#fff'), maxWidth: 1000 }}>{frase.lead} <span style={{ background: '#fff', color: ROSA, padding: '0 10px' }}>{frase.mark}</span> {frase.tail}</div>
        <div style={{ fontSize: 'clamp(16px,1.9vw,21px)', fontWeight: 600, marginTop: 18, maxWidth: 820 }}>{frase.sub}</div>
      </section>

      {/* 5 · CANALES 66% | dos rectángulos apilados (Cuándo te compran + Días pico) 33% */}
      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `44px ${PAD}`, borderRight: `4px solid ${INK}`, background: '#fff' }}>
          <Title tag="Por dónde entra el hambre" tagBg={AMA} title="El reparto del hambre" nav={{ label: 'Operaciones', onClick: () => p.onNavTab?.('operaciones') }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {p.canalStats.map(c => {
              const col = CORP[c.id] ?? c.color
              const objM = OBJ_MARGEN[c.id] ?? 60
              const saludOk = c.margen >= objM * 0.9
              const pesoPct = totalCanal > 0 ? (c.bruto / totalCanal) * 100 : 0
              return (
                <div key={c.id} style={{ border: `3px solid ${INK}`, borderLeft: `12px solid ${col}`, background: '#fff', boxShadow: SHADOW, padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ ...eyebrow(col, CLARA[c.id] ? INK : '#fff'), fontSize: 13 }}>{c.label}</span>
                    {c.id === canalRent && <span style={{ ...eyebrow(VERDE, '#fff'), fontSize: 11 }}>+ rentable</span>}
                    <div style={{ flex: 1 }} />
                    <span title={`Margen neto del canal frente a un objetivo de referencia (${objM}%). Objetivo estimado.`} style={{ ...d('15px', saludOk ? VERDE : ROJO), cursor: 'help', display: 'flex', alignItems: 'center' }}>{saludOk ? '✓' : '✗'} {P0(c.margen)}<Est /></span>
                  </div>
                  <div style={{ position: 'relative', height: 24, background: TRACK_CANAL, border: `3px solid ${INK}`, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ width: `${Math.min(100, pesoPct)}%`, height: '100%', background: ROSA }} />
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: INK }}>peso {P0(pesoPct)}</span>
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', ...d('15px', INK) }}>{E2(c.bruto)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                    {[['Neto', E2(c.neto), VERDE], ['Pedidos', N(c.pedidos), NAR], ['TM bruto', c.pedidos > 0 ? E2(c.ticket) : '—', AZUL], ['TM neto', c.pedidos > 0 ? E2(c.neto / c.pedidos) : '—', VERDE]].map(([l, v, cc]) => (
                      <div key={l as string}>
                        <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '0.8px', textTransform: 'uppercase', opacity: 0.55 }}>{l}</div>
                        <div style={d('clamp(15px,1.8vw,20px)', cc as string)}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* columna derecha: dos rectángulos independientes de colores distintos */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Rectángulo 1 · Cuándo te compran (CLARO) — compacto */}
          <div style={{ background: CLARO, borderBottom: `4px solid ${INK}`, padding: `26px ${PAD}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <span style={eyebrow(NAR, '#fff')}>Cuándo te compran</span>
              {(mejorServ || flojoServ) && (
                <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  {mejorServ && <span style={{ color: VERDE }}>▲ {mejorServ.nombre}</span>}
                  {flojoServ && <span style={{ color: NAR, marginLeft: 8 }}>▼ {flojoServ.nombre}</span>}
                </span>
              )}
            </div>
            {p.serviciosHay
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {p.servicios.slice(0, 3).map((s, i) => (
                    <div key={s.nombre}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                        <span style={{ ...d('17px', INK) }}>{s.nombre}</span>
                        <span style={d('18px', servColor[i % servColor.length] === AMA ? INK : servColor[i % servColor.length])}>{P0(s.pct)} · {E(s.bruto)}</span>
                      </div>
                      <div style={{ height: 18, background: TRACK, border: `3px solid ${INK}`, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, s.pct)}%`, height: '100%', background: servColor[i % servColor.length] }} /></div>
                    </div>
                  ))}
                </div>
              : <div style={{ fontFamily: LEX, fontWeight: 600, fontSize: 13.5, color: '#5c5340' }}>Sin reparto por momento del día: el campo «servicio» no viene informado en este periodo.</div>}
          </div>

          {/* Rectángulo 2 · Días pico (AMA) — altura contenida; el sobrante de la columna queda como fondo del panel */}
          <div style={{ background: AMA, padding: `26px ${PAD}`, borderBottom: `4px solid ${INK}`, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
              <span style={eyebrow(INK, AMA)}>Días pico · {p.mesLabel}</span>
              <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Media {E(p.mediaDiariaPico)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180, marginBottom: 14 }}>
              {p.diasPico.map(x => {
                const esFlojo = diaFlojo ? x.idx === diaFlojo.idx && x.valor > 0 : false
                const esFuerte = diaFuerte ? x.idx === diaFuerte.idx && x.valor > 0 : false
                const barCol = esFlojo ? ROJO : esFuerte ? VERDE : x.color
                return (
                  <button key={x.idx} onClick={() => p.onFiltrarDiaSemana?.(x.idx)} title={E(x.valor)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: OSW, fontSize: 10.5, fontWeight: 600 }}>{x.valor > 0 ? E(x.valor) : ''}</span>
                    <div style={{ width: '100%', height: `${Math.max(4, (x.valor / maxDia) * 100)}%`, minHeight: 4, background: barCol, border: `3px solid ${INK}` }} />
                    <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{x.nombre}</span>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: OSW, fontSize: 13, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              <span><span style={{ color: VERDE }}>▲</span> {diaFuerte ? `${diaFuerte.nombre} ${E(diaFuerte.valor)}` : '—'}</span>
              <span><span style={{ color: ROJO }}>▼</span> {diaFlojo ? `${diaFlojo.nombre} ${E(diaFlojo.valor)}` : '—'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6 · TE DEBEN (columna 33%, AZUL, rellena) | RESULTADO 66% (saturado) */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `40px ${PAD}`, borderRight: `4px solid ${INK}`, background: AZUL, color: '#fff', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={eyebrow('#fff')}>Te deben</span>
            <button onClick={() => p.onNavTab?.('cashflow')} style={{ ...eyebrow('#fff'), cursor: 'pointer', fontSize: 11 }}>Cashflow →</button>
          </div>
          {p.porCobrar.total > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', gap: 22, marginTop: 22 }}>
              <div>
                <div style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.85 }}>Pendiente de cobro</div>
                <div style={d('clamp(48px,6.5vw,82px)', '#fff')}>{EUR(p.porCobrar.total)}</div>
                <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, background: '#fff', color: AZUL, border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '7px 14px', marginTop: 12 }}>
                  <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase' }}>Entra antes de fin de mes</span>
                  <span style={d('22px', AZUL)}>{E(p.porCobrar.hastaFinMes)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {p.porCobrar.porCanal.filter(c => c.neto > 0).map(c => {
                  const pct = p.porCobrar.total > 0 ? (c.neto / p.porCobrar.total) * 100 : 0
                  return (
                    <div key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ ...d('16px', '#fff') }}>{c.label}</span>
                        <span style={{ ...d('17px', '#fff') }}>{E(c.neto)} · {P0(pct)}</span>
                      </div>
                      <div style={{ position: 'relative', height: 22, background: '#ffffff33', border: `3px solid ${INK}`, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: CORP[c.id] ?? c.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, opacity: 0.85 }}>{p.porCobrar.nLiquidaciones} liquidaciones pendientes · neto estimado · cierre histórico al 19-jun</div>
            </div>
          ) : (
            <div style={{ ...d('clamp(22px,2.6vw,32px)', '#fff'), marginTop: 22, flex: 1 }}>Todo cobrado al día. Sin liquidaciones pendientes.</div>
          )}
        </div>

        <div style={{ padding: `44px ${PAD}`, background: TEAL, color: D1 }}>
          <Title tag="Resultado del periodo" tagBg={VERDE} tagColor="#fff" title="" dark nav={{ label: 'Finanzas', onClick: () => p.onNavTab?.('finanzas') }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '8px 0 22px' }}>
            <div title="Beneficio operativo estimado: ingresos − producto − personal − resto de gastos" style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '16px 18px', cursor: 'help' }}>
              <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b5d45' }}>EBITDA estimado<Est /></div>
              <div style={{ ...d('clamp(30px,4.4vw,52px)', p.ebitda >= 0 ? VERDE : ROJO), margin: '6px 0 4px' }}>{EUR(p.ebitda)}</div>
              <div style={{ ...eyebrow(p.ebitda >= 0 ? VERDE : ROJO, '#fff'), fontSize: 12 }}>{P0(p.ebitdaPct)} sobre ingresos</div>
            </div>
            <div title="Coste de producto + personal sobre ingresos. Objetivo ≤ 60%." style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '16px 18px', cursor: 'help' }}>
              <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b5d45' }}>Prime cost<Est /></div>
              <div style={{ ...d('clamp(30px,4.4vw,52px)', p.primeCostPct <= 60 ? VERDE : NAR), margin: '6px 0 4px' }}>{P0(p.primeCostPct)}</div>
              <div style={{ ...eyebrow(p.primeCostPct <= 60 ? VERDE : NAR, '#fff'), fontSize: 12 }}>objetivo ≤ 60%</div>
            </div>
          </div>

          {mostrarCostes && <div style={{ borderLeft: `3px solid ${AMA}`, paddingLeft: 14, marginBottom: 20, fontSize: 15, color: D1, maxWidth: 760 }}><b style={{ color: AMA }}>{fraseCostes.mark}</b> — {fraseCostes.sub}</div>}

          <div style={{ background: '#fff', border: `3px solid ${INK}`, color: INK, overflow: 'hidden', boxShadow: SHADOW }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr 0.7fr 1.3fr', gap: 8, padding: '11px 16px', background: INK, fontFamily: OSW, fontSize: 11.5, letterSpacing: '1px', textTransform: 'uppercase', color: D1 }}>
              <span>Concepto</span><span style={{ textAlign: 'right' }}>Importe</span><span style={{ textAlign: 'right' }}>% s/neto</span><span style={{ textAlign: 'right' }}>Presupuesto</span>
            </div>
            {(() => {
              const visibles: Fila[] = [filasBase[0], filasBase[1], ...(verCostes ? filasCoste : []), filasBase[2], filasBase[3]]
              return visibles.map((r, i) => {
                const gd = r.grupo ? p.grupos[r.grupo] : null
                const meta = r.grupo ? grupoMeta[r.grupo] : null
                const sobre = gd && gd.presupuesto > 0 && gd.gasto > gd.presupuesto
                const esEstimado = !!r.grupo && (!gd || gd.gasto === 0)
                return (
                  <div key={r.l} style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr 0.7fr 1.3fr', gap: 8, alignItems: 'center', padding: '13px 16px', borderTop: `1px solid ${INK}1a`, background: r.bold ? '#faf4e6' : (i % 2 ? '#fbf8f1' : '#fff') }}>
                    <span style={{ fontFamily: LEX, fontSize: 14, fontWeight: r.bold ? 700 : 500, color: INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 9, height: 9, flexShrink: 0, background: r.dot, border: `1px solid ${INK}` }} />
                      {r.l}{meta && <span style={{ fontSize: 11, color: GRIS }}> · obj {meta.obj}%</span>}{esEstimado && <Est />}{r.falta && <Est tip="Aún sin costes cargados — se calcula en cuanto entre el dato" />}
                    </span>
                    <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: r.bold ? 20 : 17, color: r.impC, letterSpacing: '-0.5px', textAlign: 'right' }}>{r.imp}</span>
                    <span style={{ fontFamily: OSW, fontSize: 13, color: GRIS, textAlign: 'right' }}>{r.pct ?? ''}</span>
                    <span style={{ textAlign: 'right', fontFamily: OSW, fontSize: 15 }}>
                      {gd ? <><Edit value={gd.presupuesto} onSave={v => p.onSavePresupuestoGrupo(r.grupo as GrupoGasto, v)} color={AZUL} />{sobre && <span style={{ color: ROJO, fontSize: 11, marginLeft: 6 }}>▲</span>}</> : <span style={{ color: '#00000022' }}>—</span>}
                    </span>
                  </div>
                )
              })
            })()}
            <button onClick={() => setVerCostes(v => !v)} style={{ width: '100%', background: '#faf4e6', border: 'none', borderTop: `2px solid ${INK}`, color: INK, fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', padding: '11px', cursor: 'pointer' }}>
              {verCostes ? '▲ Ocultar desglose de costes' : '▼ Ver desglose de costes (producto, equipo, local, opex)'}
            </button>
          </div>
        </div>
      </section>

      {/* 7 · OBJETIVOS (AMA) */}
      <section style={sec(AMA)}>
        <Title tag="Tus objetivos" tagBg={VERDE} tagColor="#fff" title="Cómo vas frente a lo que te marcaste. Toca el objetivo (en azul) para cambiarlo." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {p.diario && (() => {
            const prog = p.diario!.objetivo > 0 ? (p.diario!.real / p.diario!.objetivo) * 100 : 0
            const faltan = Math.max(0, p.diario!.objetivo - p.diario!.real)
            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <span style={d('22px')}>Hoy · {N(p.diario!.real)} <span style={d('22px', prog >= 100 ? VERDE : INK)}>{P0(prog)}</span></span>
                  <span style={d('20px')}>Faltan <span style={{ color: INK }}>{N(faltan)}</span> de objetivo {N(p.diario!.objetivo)}</span>
                </div>
                <div style={{ height: 18, border: `3px solid ${INK}`, background: '#fff' }}><div style={{ width: `${Math.min(100, prog)}%`, height: '100%', background: ROSA, transition: 'width .3s' }} /></div>
              </div>
            )
          })()}
          {objetivos.map(o => {
            const prog = o.obj > 0 ? (o.real / o.obj) * 100 : 0
            const faltan = Math.max(0, o.obj - o.real)
            return (
              <div key={o.k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <span style={d('22px')}>{o.lbl} · {N(o.real)} <span style={d('22px', prog >= 100 ? VERDE : INK)}>{P0(prog)}</span></span>
                  <span style={d('20px')}>Faltan <span style={{ color: INK }}>{N(faltan)}</span> de objetivo <Edit value={o.obj} onSave={v => p.onSaveObjetivoVenta(o.k, v)} color={AZUL} /></span>
                </div>
                <div style={{ height: 16, border: `3px solid ${INK}`, background: '#fff' }}><div style={{ width: `${Math.min(100, prog)}%`, height: '100%', background: ROSA, transition: 'width .3s' }} /></div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 8 · PROYECCIONES | RATIO | PE (cada una su color) */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `40px ${PAD}`, borderRight: `4px solid ${INK}`, background: VERDE, color: '#fff' }}>
          <span style={eyebrow('#fff')}>Proyecciones</span>
          <button onClick={() => p.onNavTab?.('cashflow')} style={{ ...eyebrow('#fff'), cursor: 'pointer', fontSize: 12, marginLeft: 8 }}>Cashflow →</button>
          <div title="A este ritmo de ventas, dónde cerrará el mes frente a tu objetivo mensual" style={{ background: '#ffffff1f', border: `3px solid ${INK}`, padding: '10px 12px', marginTop: 16, cursor: 'help' }}>
            <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.9 }}>A este ritmo cierras el mes en<Est light /></div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={d('clamp(26px,3.2vw,40px)', '#fff')}>{E(p.cierreMes)}</span>
              {p.objetivoMes > 0 && <span style={{ ...eyebrow(pctCierre >= 100 ? '#fff' : ROJO, pctCierre >= 100 ? VERDE : '#fff'), fontSize: 12 }}>{pctCierre >= 100 ? '✓ llegas' : '✗ ' + P0(pctCierre)}</span>}
            </div>
            {p.objetivoMes > 0 && <div style={{ fontFamily: LEX, fontSize: 12.5, fontWeight: 600, opacity: 0.9, marginTop: 2 }}>objetivo {E(p.objetivoMes)}</div>}
          </div>
          <div title="Saldo estimado a partir de cobros y pagos medios, no del extracto bancario real" style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.85, marginTop: 16, cursor: 'help' }}>Saldo estimado<Est light /></div>
          <div style={d('clamp(28px,3.4vw,42px)', '#fff')}>{p.saldo.saldoHoy > 0 ? E(p.saldo.saldoHoy) : '—'}</div>
          <div style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600, lineHeight: 1.95, marginTop: 12 }}>
            <div>Cobros 7 d · <b>{E(p.saldo.cobros7d)}</b></div>
            <div>Cobros 30 d · <b>{E(p.saldo.cobros30d)}</b></div>
            <div>Pagos 7 d · <b>{E(p.saldo.pagos7d)}</b></div>
            <div>Pagos 30 d · <b>{E(p.saldo.pagos30d)}</b></div>
          </div>
        </div>
        <div style={{ padding: `40px ${PAD}`, borderRight: `4px solid ${INK}`, background: ROSA_CL }}>
          <span style={eyebrow(VERDE, '#fff')}>Ratio ingresos / gastos</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, margin: '14px 0 10px' }}>
            <div title="Cuántas veces cubren los ingresos netos los gastos fijos del mes" style={{ ...d('clamp(36px,5vw,60px)', p.ratioActual >= p.objetivoRatio ? VERDE : NAR), cursor: 'help' }}>{(Number.isFinite(p.ratioActual) ? p.ratioActual : 0).toFixed(2)}×</div>
            <div style={d('18px')}>objetivo <Edit value={p.objetivoRatio} onSave={p.onSaveObjetivoRatio} suffix="×" color={AZUL} /></div>
          </div>
          <div style={{ height: 14, border: `3px solid ${INK}`, background: '#fff' }}><div style={{ width: `${Math.min(100, p.objetivoRatio > 0 ? (p.ratioActual / p.objetivoRatio) * 100 : 0)}%`, height: '100%', background: p.ratioActual >= p.objetivoRatio ? VERDE : NAR }} /></div>
          <div style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 600, lineHeight: 1.95, marginTop: 12 }}>
            <div>Ingresos netos · <b>{E(p.netosReales || p.netoEstimado)}</b></div>
            <div>Gastos fijos · <b>{E(p.gastosFijosMes)}</b></div>
            <div>Gastos reales · <b>{E(p.gastosReales)}</b></div>
          </div>
        </div>
        <div style={{ padding: `40px ${PAD}`, background: LAV }}>
          <span style={eyebrow(AZUL, '#fff')}>Punto de equilibrio</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, margin: '14px 0 10px' }}>
            <div title="Facturación bruta que necesitas este mes para cubrir todos los gastos fijos" style={{ ...d('clamp(36px,5vw,60px)'), cursor: 'help' }}>{E(p.pe.peBruto)}</div>
            <div style={{ ...eyebrow(p.pe.pctProgreso >= 100 ? VERDE : NAR, '#fff'), marginBottom: 12 }}>{P0(p.pe.pctProgreso)}</div>
          </div>
          <div style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.6 }}>bruto necesario este mes</div>
          <div style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 600, lineHeight: 1.95, marginTop: 10 }}>
            <div>Llevamos · <b>{E(p.pe.acumulado)}</b></div>
            <div>Faltan · <b style={{ color: p.pe.faltan > 0 ? NAR : VERDE }}>{E(p.pe.faltan)}</b></div>
            <div>Día verde · <b>{p.pe.diaVerdeEstimado ? `${p.pe.diaVerdeEstimado.fecha} ${p.pe.diaVerdeEstimado.diaSemana}` : '—'}</b></div>
            <div>Realidad · <b>{E(p.pe.realFacDia)}/día · {N(p.pe.realPedDia)} ped</b></div>
          </div>
        </div>
      </section>

      {/* 9 · MARCAS | PROVISIONES + TOP VENTAS */}
      <section style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `44px ${PAD}`, borderRight: `4px solid ${INK}`, background: '#fff' }}>
          <Title tag="Tus marcas" tagBg={ROSA} tagColor="#fff" title="Las 5 que más facturan, con su TM bruto y su evolución." nav={{ label: 'Marcas', onClick: () => p.onNavTab?.('marcas') }} />
          {(marcaSube || marcaCae) && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
              {marcaSube && marcaSube.varPct != null && marcaSube.varPct >= 0 && <span style={{ ...eyebrow(VERDE, '#fff'), fontSize: 13 }}>▲ Sube {marcaSube.nombre} {DELTA(marcaSube.varPct)}</span>}
              {marcaCae && marcaCae.varPct != null && marcaCae.varPct < 0 && <span style={{ ...eyebrow(ROJO, '#fff'), fontSize: 13 }}>▼ Cae {marcaCae.nombre} {DELTA(marcaCae.varPct)}</span>}
            </div>
          )}
          {marcas5.length > 0
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {marcas5.map((mk, i) => {
                  const real = mk.bruto > 0
                  const pctMostrar = real ? mk.pct : PCT_EST[i] ?? 8
                  const colorBarra = real ? marcaColor[i % marcaColor.length] : GRIS
                  const curva = real && mk.serie && mk.serie.length >= 2 ? mk.serie : serieEstimada(mk.bruto)
                  return (
                    <div key={mk.nombre} style={{ border: `3px solid ${INK}`, background: '#fff', boxShadow: SHADOW, padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16, alignItems: 'center', opacity: real ? 1 : 0.82 }}>
                      <div>
                        <Barra nombre={mk.nombre} pct={pctMostrar} color={colorBarra} valor={real ? E(mk.bruto) : '—'} alto={28} />
                        <div style={{ display: 'flex', gap: 18, marginTop: 8, fontFamily: OSW, fontSize: 13, letterSpacing: '0.5px', textTransform: 'uppercase', alignItems: 'center' }}>
                          {real ? <>
                            <span style={{ opacity: 0.55 }}>Fact. bruta <b style={{ color: INK }}>{E2(mk.bruto)}</b></span>
                            <span style={{ opacity: 0.55 }}>TM bruto <b style={{ color: AZUL }}>{mk.tmBruto > 0 ? E2(mk.tmBruto) : '—'}</b></span>
                            {mk.varPct != null && <span style={{ color: mk.varPct >= 0 ? VERDE : ROJO }}><Arrow v={mk.varPct} />{DELTA(mk.varPct)}</span>}
                          </> : <span style={{ color: GRIS }}>Sin datos en 90 días<Est /></span>}
                        </div>
                      </div>
                      <div style={{ borderLeft: `2px solid ${INK}22`, paddingLeft: 14 }}>
                        <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.55, marginBottom: 2 }}>Evolución {!real && <span style={{ color: GRIS }}>· est.</span>}</div>
                        <Spark serie={curva} color={real ? marcaColor[i % marcaColor.length] : GRIS} w={160} h={38} dashed={!real} />
                      </div>
                    </div>
                  )
                })}
              </div>
            : <div style={{ border: `3px solid ${INK}`, background: '#fff', padding: '18px', fontFamily: LEX, fontWeight: 600 }}>Sin marcas activas configuradas.</div>}
        </div>
        <div style={{ padding: `44px ${PAD}`, background: CLARO, display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div>
            <span style={eyebrow('#fff')}>Provisiones</span>
            <div style={{ ...d('clamp(26px,3.4vw,38px)', NAR), margin: '12px 0 10px' }}>{E(p.provisiones.totalAGuardar)}</div>
            <div style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 600, lineHeight: 1.9 }}>
              <div>IVA · <b>{E(p.provisiones.provIVA)}</b></div>
              <div>IRPF · <b>{E(p.provisiones.provIRPF)}</b></div>
            </div>
            {p.provisiones.proximosPagos.length > 0 && <>
              <div style={{ fontFamily: OSW, fontSize: 11.5, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.6, margin: '12px 0 6px' }}>Próximos pagos</div>
              {p.provisiones.proximosPagos.slice(0, 5).map((x, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEX, fontSize: 13, fontWeight: 600, padding: '3px 0' }}><span>{x.concepto}</span><span>{E(x.importe)}</span></div>
              ))}
            </>}
          </div>
          <div style={{ borderTop: `3px solid ${INK}`, paddingTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={eyebrow(VERDE, '#fff')}>Top ventas</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['productos', 'modificadores'] as const).map(t => (
                  <button key={t} onClick={() => p.onTopTab(t)} style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '4px 8px', cursor: 'pointer', border: `2px solid ${INK}`, background: p.topTab === t ? INK : 'transparent', color: p.topTab === t ? '#fff' : INK }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              {p.topItems.length === 0 || p.topDatosDemo
                ? <div style={{ fontFamily: OSW, letterSpacing: '0.5px', opacity: 0.5, fontSize: 13, padding: '8px 0' }}>Sin datos POS de {p.topTab}.</div>
                : p.topItems.slice(0, 5).map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i === 0 ? `2px solid ${INK}` : `1px solid ${INK}22` }}>
                    <span style={{ ...d('18px', i === 0 ? ROSA : INK), width: 26 }}>{String(t.ranking ?? i + 1).padStart(2, '0')}</span>
                    <span style={{ fontFamily: LEX, fontWeight: 600, fontSize: 13.5, flex: 1 }}>{t.producto}</span>
                    <span style={d('16px')}>{E2(t.importe)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* 10 · FOOTER */}
      <section style={{ background: OSC, color: D1, padding: PAD, textAlign: 'center' }}>
        <div style={d('clamp(34px,6vw,72px)', D1)}>Binagre es hogar.</div>
        <div style={{ fontFamily: OSW, letterSpacing: '6px', fontSize: 15, color: AMA, marginTop: 12, textTransform: 'uppercase' }}>Comer bien. Aquí y ahora.</div>
      </section>
    </div>
  )
}
