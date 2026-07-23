import {
  BLANCO, GRANATE, GRIS, INK, NAR_S,
  TRACK, TRACK_CANAL,
  ROSA, ROJO, AMA, VERDE, NAR, AZUL, CORP, CLARA, OBJ_MARGEN,
} from '@/styles/neobrutal'
import { PANEL_MARCA_MORADO, PANEL_MARCA_CIAN, RESUMEN_ROW_BOLD, ZEBRA_CLARA } from '@/styles/palettes'
/**
 * ResumenLanding v23 — pestaña Resumen del Panel Global · CANTERA ALEGRE v4.
 * v23: menos negro — la tira de atención pasa de banda de tinta a banda blanca
 * con chips (sombra ligera). El resto igual que v22.
 * v22: el titular del héroe es la frase-insight nº1 (lenguaje natural anclado a
 * datos reales del periodo, batería `frases_insight` con rotación diaria); la
 * sección "frase potente" usa la frase nº2 (mensaje distinto). Los pedidos del
 * periodo pasan a pastilla de cabecera del héroe.
 */
import { useState } from 'react'
import { fmtEur, fmtPct, fmtNum } from '@/lib/format'
import type { CanalStat, ObjetivosVentas, PagoProximoItem, TopVentaItem } from './types'
import type { GrupoGasto } from './ColGruposGasto'
import type { DiaPico } from './ColDiasPico'
import type { PorCobrarResult } from '@/lib/panel/calcPorCobrar'
import { elegirFrase, elegirFrases, type MetricasInsight } from './frasesInsight'
import CardHoyEnVivo, { enHorarioServicio } from './CardHoyEnVivo'

const CREMA = NAR_S
const SHADOW = `3px 3px 0 ${INK}`   // sombra dura: SOLO pulsables + resumen/neto del héroe
const OSW = "'Oswald', sans-serif"
const LEX = "'Lexend', sans-serif"
const PAD = '24px'

const d = (size: string, color = INK): React.CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color })
const eyebrow = (bg: string, color = INK): React.CSSProperties => ({ display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 12px' })

const EUR = (n: number) => fmtEur(n, { decimals: 0 })
const E = (n: number) => fmtEur(n, { showEuro: false, decimals: 0 })
const E2 = (n: number) => fmtEur(n, { showEuro: false, decimals: 2 })
const ES = (n: number) => fmtEur(n, { signed: true, decimals: 2 })
const N = (n: number) => fmtNum(n, 0)
const P0 = (n: number) => fmtPct(n, 0)
const P2 = (n: number) => fmtPct(n, 2)
const DELTA = (v: number | null) => (v == null ? '—' : fmtEur(v, { signed: true, showEuro: false, decimals: 1 }) + '%')

function Est({ light = false, tip = 'Dato estimado · todavía no proviene del Running / datos reales' }: { light?: boolean; tip?: string }) {
  return <span title={tip} style={{ fontFamily: OSW, fontSize: 9, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', border: `1px solid ${light ? '#ffffff66' : '#00000044'}`, color: light ? '#ffffffcc' : '#00000088', padding: '0 4px', marginLeft: 6, verticalAlign: 'middle', cursor: 'help', borderRadius: 0 }}>est</span>
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
  saldoBanco: number | null
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
  return <input autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEdit(false) }} style={{ width: '4.5em', fontFamily: OSW, fontWeight: 700, fontSize: 'inherit', letterSpacing: '-0.5px', border: `2px solid ${INK}`, padding: '0 4px', background: BLANCO, color: AZUL }} />
}

const Title: React.FC<{ tag: string; tagBg: string; tagColor?: string; title: string; dark?: boolean; nav?: { label: string; onClick?: () => void } }> = ({ tag, tagBg, tagColor = INK, title, dark, nav }) => (
  <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={eyebrow(tagBg, tagColor)}>{tag}</span>
      {nav && <button onClick={nav.onClick} style={{ ...eyebrow(BLANCO), cursor: 'pointer', fontSize: 12 }}>{nav.label} →</button>}
    </div>
    {title && <div style={{ ...d('clamp(24px,3vw,38px)', dark ? CREMA : INK), margin: '14px 0 22px' }}>{title}</div>}
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

  // ¿estamos dando servicio? Solo entonces se pinta la sección HOY EN VIVO.
  const enServicio = enHorarioServicio()

  // ¿hay costes cargados? Si no, no calculamos derivados (evita mostrar margen=neto=resultado)
  const hayProducto = p.grupos.producto.gasto > 0
  const hayCostes = hayProducto || p.grupos.equipo.gasto > 0 || p.grupos.local.gasto > 0 || p.grupos.controlables.gasto > 0
  const margenBruto = p.netoEstimado - p.grupos.producto.gasto
  const resultadoNetoPL = p.netoEstimado - (p.grupos.producto.gasto + p.grupos.equipo.gasto + p.grupos.local.gasto + p.grupos.controlables.gasto)

  const totalCanal = p.canalStats.reduce((a, c) => a + c.bruto, 0)
  const DI = 'Datos insuf.'
  const canalRent = p.canalStats.filter(c => c.pedidos > 0).map(c => ({ id: c.id, np: c.neto / c.pedidos })).sort((a, b) => b.np - a.np)[0]?.id

  // Lo que deja cada pedido: ingreso bruto por pedido − coste total por pedido (comisión + producto)
  const hayPedidos = p.pedidosPeriodo > 0
  const beneficioPedido = p.tmBruto - p.costePorPedido.total

  // Héroe = mejor frase-insight del periodo; sección frase potente = la segunda (mensaje distinto)
  const [frase, frase2] = elegirFrases(p.metricas, 2)
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
  const saludTitulo = saludNivel === 'verde' ? 'Semana sana' : saludNivel === 'ambar' ? 'Ojo, un par de cosas' : 'Atención: varios frentes'
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
  const marcaColor = [ROSA, AZUL, VERDE, NAR, AMA, PANEL_MARCA_MORADO, PANEL_MARCA_CIAN]
  const marcas5 = p.marcasReales.slice(0, 5)

  const marcasVar = marcas5.filter(mk => mk.varPct != null)
  const marcaSube = marcasVar.length ? marcasVar.reduce((a, x) => ((x.varPct as number) > (a.varPct as number) ? x : a)) : null
  const marcaCae = marcasVar.length ? marcasVar.reduce((a, x) => ((x.varPct as number) < (a.varPct as number) ? x : a)) : null

  const servOrden = [...p.servicios].sort((a, b) => b.bruto - a.bruto)
  const mejorServ = servOrden[0] ?? null
  const flojoServ = servOrden.length > 1 ? servOrden[servOrden.length - 1] : null

  const pctCierre = p.objetivoMes > 0 ? (p.cierreMes / p.objetivoMes) * 100 : 0

  // ── piezas CANTERA ALEGRE ──
  const Bloque: React.FC<{ ceja: string; children: React.ReactNode; pad?: string; style?: React.CSSProperties }> = ({ ceja, children, pad = `22px ${PAD}`, style }) => (
    <div style={{ background: BLANCO, border: `3px solid ${INK}`, borderTop: `7px solid ${ceja}`, padding: pad, ...style }}>{children}</div>
  )
  const chipAtencion: React.CSSProperties = { display: 'inline-block', background: BLANCO, color: INK, border: `2px solid ${INK}`, boxShadow: '2px 2px 0 rgba(36,29,18,.25)', fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '5px 11px' }

  // Frase potente · color por SIGNIFICADO (rojo peligro · granate coste · verde logro · rosa oportunidad)
  const fraseColor = saludNivel === 'rojo' ? ROJO
    : (m.variacionVentas != null && m.variacionVentas >= 0 && saludNivel === 'verde') ? VERDE
    : ROSA

  const atencionChips = alertas.slice(0, 3)
  const atencionResto = Math.max(0, alertas.length - 3)

  return (
    <div style={{ fontFamily: LEX, color: INK, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {p.datosDemo && <Bloque ceja={AMA} pad={`10px ${PAD}`}><span style={{ fontFamily: OSW, letterSpacing: '1px', fontSize: 13, textTransform: 'uppercase' }}>Datos demo · BD vacía o sin datos en este periodo</span></Bloque>}

      {/* 0 · HOY EN VIVO (solo en horario de servicio) */}
      {enServicio && <CardHoyEnVivo />}

      {/* 1 · HÉROE (amarillo · área Resumen · mark naranja) + tira de atención pegada (blanca: menos negro) */}
      <div>
        <section style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 26, border: `3px solid ${INK}`, background: AMA, padding: '26px 28px', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={eyebrow(BLANCO)}>Comer bien. Aquí y ahora.</span>
              {p.periodoLabel && <span style={{ ...eyebrow(INK, CREMA), fontSize: 12 }}>{p.periodoLabel}{p.periodoRango ? ` · ${p.periodoRango}` : ''}</span>}
              {p.pedidosPeriodo > 0 && <span style={{ ...eyebrow(BLANCO), fontSize: 12 }}>{N(p.pedidosPeriodo)} pedidos</span>}
            </div>
            {/* Titular = frase-insight nº1: lenguaje natural anclado a los datos del periodo */}
            <div style={{ ...d('clamp(24px,3.2vw,42px)'), margin: '14px 0 0', maxWidth: 680, lineHeight: 0.98 }}>
              {frase.lead} <span style={{ background: NAR, color: BLANCO, padding: '0 10px', display: 'inline-block' }}>{frase.mark}</span> {frase.tail}
            </div>
            <div style={{ fontFamily: LEX, fontSize: 'clamp(13px,1.5vw,15px)', fontWeight: 600, marginTop: 8, maxWidth: 640, opacity: 0.8 }}>{frase.sub}</div>
            <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.55, marginTop: 16 }}>Facturación bruta</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={d('clamp(44px,6vw,76px)')}>{EUR(p.ventasPeriodo)}</div>
              {p.variacionVentas != null && (
                <span style={{ background: p.variacionVentas >= 0 ? VERDE : ROJO, color: BLANCO, border: `2px solid ${INK}`, padding: '4px 12px', fontFamily: OSW, fontWeight: 700, fontSize: 16 }}>
                  {p.variacionVentas >= 0 ? '▲ ' : '▼ '}{DELTA(p.variacionVentas)}
                </span>
              )}
              <div style={{ width: 170 }}><Spark serie={p.serie} color={INK} w={170} h={40} /></div>
            </div>
            <div title="Lo que te queda tras las comisiones de plataforma. Estimado a partir de las fórmulas de comisión." style={{ display: 'inline-flex', alignItems: 'baseline', gap: 12, background: VERDE, color: BLANCO, border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '8px 16px', marginTop: 14, cursor: 'help' }}>
              <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Neto estimado</span>
              <span style={d('24px', BLANCO)}>{EUR(p.netoEstimado)}</span>
              <span style={{ fontFamily: OSW, fontSize: 14, fontWeight: 600 }}>{P2(netoPct)} s/ bruto</span>
              <Est light />
            </div>
          </div>
          <div style={{ background: BLANCO, border: `2px solid ${INK}`, boxShadow: SHADOW, padding: '16px 18px' }}>
            <div style={{ ...d('16px'), textAlign: 'center', borderBottom: `2px dashed ${INK}`, paddingBottom: 10, marginBottom: 2 }}>· Resumen del periodo ·</div>
            {heroStats.map((st, i) => (
              <div key={st.l} title={st.tip} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '11px 0', borderBottom: i < heroStats.length - 1 ? `1px dotted ${INK}55` : 'none', cursor: st.tip ? 'help' : 'default' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{st.l}{st.est && <Est />}</span>
                <span style={d('21px', st.c)}>{st.v}</span>
              </div>
            ))}
          </div>
        </section>
        <div style={{ background: BLANCO, color: INK, border: `3px solid ${INK}`, borderTop: 'none', padding: `12px ${PAD}`, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ ...d('15px', INK) }}>Atención →</span>
          <span style={{ ...chipAtencion, background: saludBg, color: BLANCO, borderColor: saludBg }}>{saludTitulo}</span>
          {atencionChips.length === 0
            ? <span style={chipAtencion}>Todo en orden</span>
            : atencionChips.map((a, i) => <span key={i} style={chipAtencion}>{a.t}</span>)}
          {atencionResto > 0 && <span style={{ ...chipAtencion, background: CREMA }}>+{atencionResto} más</span>}
          <span style={{ marginLeft: 'auto', fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.6 }}>Actualizado {actualizado}</span>
        </div>
      </div>

      {/* 2 · PLANCHA COMPARATIVA (celdas blancas pegadas · vs periodo anterior de igual duración) */}
      <section style={{ border: `3px solid ${INK}`, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', background: BLANCO }}>
        {desv.map((x, i) => (
          <div key={i} style={{ padding: '18px 22px 20px', borderRight: i < 2 ? `3px solid ${INK}` : 'none' }}>
            <div style={d('clamp(28px,3.6vw,44px)', x.c)}><Arrow v={x.raw} />{x.v}</div>
            <div style={{ fontFamily: OSW, fontWeight: 600, letterSpacing: '0.13em', fontSize: 10, color: GRIS, textTransform: 'uppercase', marginTop: 6 }}>{x.l} · vs periodo anterior</div>
          </div>
        ))}
      </section>

      {/* 3 · FRASE POTENTE (frase-insight nº2, color por significado, máx 1) */}
      <section style={{ background: fraseColor, color: BLANCO, border: `3px solid ${INK}`, padding: `22px ${PAD}` }}>
        <div style={{ ...d('clamp(26px,3.4vw,44px)', BLANCO), maxWidth: 1000, lineHeight: 0.98 }}>{frase2.lead} <span style={{ background: BLANCO, color: fraseColor, padding: '0 10px' }}>{frase2.mark}</span> {frase2.tail}</div>
        <div style={{ fontSize: 'clamp(14px,1.7vw,17px)', fontWeight: 600, marginTop: 12, maxWidth: 820, opacity: 0.92 }}>{frase2.sub}</div>
      </section>

      {/* 4 · CANALES | Cuándo te compran + Días pico + Beneficio por pedido */}
      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'stretch' }}>
        <Bloque ceja={VERDE} style={{ display: 'flex', flexDirection: 'column' }}>
          <Title tag="Por dónde entra el hambre" tagBg={AMA} title="El reparto del hambre" nav={{ label: 'Operaciones', onClick: () => p.onNavTab?.('operaciones') }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {p.canalStats.map(c => {
              const col = CORP[c.id] ?? c.color
              const objM = OBJ_MARGEN[c.id] ?? 60
              const saludOk = c.margen >= objM * 0.9
              const pesoPct = totalCanal > 0 ? (c.bruto / totalCanal) * 100 : 0
              return (
                <div key={c.id} style={{ border: `2px solid ${INK}`, borderLeft: `12px solid ${col}`, background: BLANCO, padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ ...eyebrow(col, CLARA[c.id] ? INK : BLANCO), fontSize: 13 }}>{c.label}</span>
                    {c.id === canalRent && <span style={{ ...eyebrow(VERDE, BLANCO), fontSize: 11 }}>+ rentable</span>}
                    <div style={{ flex: 1 }} />
                    <span title={`Margen neto del canal frente a un objetivo de referencia (${objM}%). Objetivo estimado.`} style={{ ...d('15px', saludOk ? VERDE : ROJO), cursor: 'help', display: 'flex', alignItems: 'center' }}>{saludOk ? '✓' : '✗'} {P0(c.margen)}<Est /></span>
                  </div>
                  <div style={{ position: 'relative', height: 24, background: TRACK_CANAL, border: `2px solid ${INK}`, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ width: `${Math.min(100, pesoPct)}%`, height: '100%', background: col, borderRight: pesoPct > 0 ? `2px solid ${INK}` : 'none' }} />
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
        </Bloque>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Cuándo te compran */}
          <Bloque ceja={NAR} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <span style={eyebrow(NAR, BLANCO)}>Cuándo te compran</span>
              {(mejorServ || flojoServ) && (
                <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  {mejorServ && <span style={{ color: VERDE }}>▲ {mejorServ.nombre}</span>}
                  {flojoServ && <span style={{ color: NAR, marginLeft: 8 }}>▼ {flojoServ.nombre}</span>}
                </span>
              )}
            </div>
            {p.serviciosHay
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, justifyContent: 'center' }}>
                  {p.servicios.slice(0, 3).map((sv, i) => (
                    <div key={sv.nombre}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                        <span style={{ ...d('16px', INK) }}>{sv.nombre}</span>
                        <span style={d('17px', servColor[i % servColor.length] === AMA ? INK : servColor[i % servColor.length])}>{P0(sv.pct)} · {E(sv.bruto)}</span>
                      </div>
                      <div style={{ height: 16, background: CREMA, border: `2px solid ${INK}`, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, sv.pct)}%`, height: '100%', background: servColor[i % servColor.length], borderRight: `2px solid ${INK}` }} /></div>
                    </div>
                  ))}
                </div>
              : <div style={{ fontFamily: LEX, fontWeight: 600, fontSize: 13.5, color: GRIS, flex: 1, display: 'flex', alignItems: 'center' }}>Sin reparto por momento del día: el campo «servicio» no viene informado en este periodo.</div>}
          </Bloque>

          {/* Días pico */}
          <Bloque ceja={AMA} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <span style={eyebrow(AMA, INK)}>Días pico · {p.periodoLabel ?? p.mesLabel}</span>
              <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Media {E(p.mediaDiariaPico)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flex: 1, minHeight: 130, marginBottom: 12 }}>
              {p.diasPico.map(x => (
                <button key={x.idx} onClick={() => p.onFiltrarDiaSemana?.(x.idx)} title={E(x.valor)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontFamily: OSW, fontSize: 10.5, fontWeight: 600 }}>{x.valor > 0 ? E(x.valor) : ''}</span>
                  <div style={{ width: '100%', height: `${Math.max(4, (x.valor / maxDia) * 100)}%`, minHeight: 4, background: x.color, border: `2px solid ${INK}` }} />
                  <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{x.nombre}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: OSW, fontSize: 13, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              <span><span style={{ color: VERDE }}>▲</span> {diaFuerte ? `${diaFuerte.nombre} ${E(diaFuerte.valor)}` : '—'}</span>
              <span><span style={{ color: ROJO }}>▼</span> {diaFlojo ? `${diaFlojo.nombre} ${E(diaFlojo.valor)}` : '—'}</span>
            </div>
          </Bloque>

          {/* Lo que deja cada pedido */}
          <Bloque ceja={GRANATE} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={eyebrow(GRANATE, BLANCO)}>Lo que deja cada pedido</span>
              <span style={{ fontFamily: OSW, fontSize: 11.5, letterSpacing: '0.6px', textTransform: 'uppercase', opacity: 0.7 }}>Coste/ped {E2(p.costePorPedido.total)}</span>
            </div>
            {hayPedidos ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 600, opacity: 0.75, marginBottom: 10, lineHeight: 1.35 }}>De cada pedido, esto es lo que queda tras la comisión de plataforma y el producto.</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={d('clamp(34px,4.6vw,56px)', GRANATE)}>{ES(beneficioPedido)}</span>
                  <span style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>por pedido<Est /></span>
                </div>
              </div>
            ) : <div style={{ fontFamily: LEX, fontWeight: 600, fontSize: 13.5, color: GRIS, flex: 1, display: 'flex', alignItems: 'center' }}>Sin pedidos en este periodo para calcular el beneficio por pedido.</div>}
          </Bloque>
        </div>
      </section>

      {/* 5 · TE DEBEN | RESULTADO DEL PERIODO */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, alignItems: 'stretch' }}>
        <Bloque ceja={AZUL} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={eyebrow(AZUL, BLANCO)}>Te deben</span>
            <button onClick={() => p.onNavTab?.('cashflow')} style={{ ...eyebrow(BLANCO), cursor: 'pointer', fontSize: 11, boxShadow: SHADOW }}>Cashflow →</button>
          </div>
          {p.porCobrar.total > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', gap: 22, marginTop: 18 }}>
              <div>
                <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.6 }}>Pendiente de cobro</div>
                <div style={d('clamp(40px,5vw,62px)', AZUL)}>{EUR(p.porCobrar.total)}</div>
                <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, background: CREMA, border: `2px solid ${INK}`, padding: '6px 12px', marginTop: 10 }}>
                  <span style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase' }}>Entra antes de fin de mes</span>
                  <span style={d('20px', AZUL)}>{E(p.porCobrar.hastaFinMes)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {p.porCobrar.porCanal.filter(c => c.neto > 0).map(c => {
                  const pct = p.porCobrar.total > 0 ? (c.neto / p.porCobrar.total) * 100 : 0
                  return (
                    <div key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ ...d('15px', INK) }}>{c.label}</span>
                        <span style={{ ...d('16px', INK) }}>{E(c.neto)} · {P0(pct)}</span>
                      </div>
                      <div style={{ position: 'relative', height: 18, background: CREMA, border: `2px solid ${INK}`, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: CORP[c.id] ?? c.color, borderRight: `2px solid ${INK}` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontFamily: LEX, fontSize: 12.5, fontWeight: 600, color: GRIS }}>{p.porCobrar.nLiquidaciones} liquidaciones pendientes · neto estimado · cierre histórico al 19-jun</div>
            </div>
          ) : (
            <div style={{ ...d('clamp(20px,2.4vw,28px)', VERDE), marginTop: 18, flex: 1 }}>Todo cobrado al día. Sin liquidaciones pendientes.</div>
          )}
        </Bloque>

        <Bloque ceja={VERDE}>
          <Title tag="Resultado del periodo" tagBg={VERDE} tagColor={BLANCO} title="" nav={{ label: 'Finanzas', onClick: () => p.onNavTab?.('finanzas') }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '8px 0 20px' }}>
            <div title="Beneficio operativo estimado: ingresos − producto − personal − resto de gastos" style={{ background: BLANCO, border: `2px solid ${INK}`, padding: '14px 16px', cursor: 'help' }}>
              <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>EBITDA estimado<Est /></div>
              <div style={{ ...d('clamp(26px,3.6vw,40px)', p.ebitda >= 0 ? VERDE : ROJO), margin: '6px 0 4px' }}>{EUR(p.ebitda)}</div>
              <div style={{ ...eyebrow(p.ebitda >= 0 ? VERDE : ROJO, BLANCO), fontSize: 11 }}>{P0(p.ebitdaPct)} sobre ingresos</div>
            </div>
            <div title="Coste de producto + personal sobre ingresos. Objetivo ≤ 60%." style={{ background: BLANCO, border: `2px solid ${INK}`, padding: '14px 16px', cursor: 'help' }}>
              <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Prime cost<Est /></div>
              <div style={{ ...d('clamp(26px,3.6vw,40px)', p.primeCostPct <= 60 ? VERDE : NAR), margin: '6px 0 4px' }}>{P0(p.primeCostPct)}</div>
              <div style={{ ...eyebrow(p.primeCostPct <= 60 ? VERDE : NAR, BLANCO), fontSize: 11 }}>objetivo ≤ 60%</div>
            </div>
          </div>

          {mostrarCostes && <div style={{ borderLeft: `3px solid ${GRANATE}`, paddingLeft: 14, marginBottom: 18, fontSize: 14.5, color: INK, maxWidth: 760 }}><b style={{ color: GRANATE }}>{fraseCostes.mark}</b> — {fraseCostes.sub}</div>}

          <div style={{ background: BLANCO, border: `2px solid ${INK}`, color: INK, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr 0.7fr 1.3fr', gap: 8, padding: '10px 16px', background: INK, fontFamily: OSW, fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', color: CREMA }}>
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
                  <div key={r.l} style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr 0.7fr 1.3fr', gap: 8, alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${INK}33`, background: r.bold ? RESUMEN_ROW_BOLD : (i % 2 ? ZEBRA_CLARA : BLANCO) }}>
                    <span style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: r.bold ? 700 : 500, color: INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 9, height: 9, flexShrink: 0, background: r.dot, border: `1px solid ${INK}` }} />
                      {r.l}{meta && <span style={{ fontSize: 11, color: GRIS }}> · obj {meta.obj}%</span>}{esEstimado && <Est />}{r.falta && <Est tip="Aún sin costes cargados — se calcula en cuanto entre el dato" />}
                    </span>
                    <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: r.bold ? 19 : 16, color: r.impC, letterSpacing: '-0.5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.imp}</span>
                    <span style={{ fontFamily: OSW, fontSize: 13, color: GRIS, textAlign: 'right' }}>{r.pct ?? ''}</span>
                    <span style={{ textAlign: 'right', fontFamily: OSW, fontSize: 15 }}>
                      {gd ? <><Edit value={gd.presupuesto} onSave={v => p.onSavePresupuestoGrupo(r.grupo as GrupoGasto, v)} color={AZUL} />{sobre && <span style={{ color: ROJO, fontSize: 11, marginLeft: 6 }}>▲</span>}</> : <span style={{ color: '#00000022' }}>—</span>}
                    </span>
                  </div>
                )
              })
            })()}
            <button onClick={() => setVerCostes(v => !v)} style={{ width: '100%', background: RESUMEN_ROW_BOLD, border: 'none', borderTop: `2px solid ${INK}`, color: INK, fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', padding: '11px', cursor: 'pointer' }}>
              {verCostes ? '▲ Ocultar desglose de costes' : '▼ Ver desglose de costes (producto, equipo, local, opex)'}
            </button>
          </div>
        </Bloque>
      </section>

      {/* 6 · OBJETIVOS */}
      <Bloque ceja={AMA}>
        <Title tag="Tus objetivos" tagBg={AMA} tagColor={INK} title="Cómo vas frente a lo que te marcaste. Toca el objetivo (en azul) para cambiarlo." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {p.diario && (() => {
            const prog = p.diario!.objetivo > 0 ? (p.diario!.real / p.diario!.objetivo) * 100 : 0
            const faltan = Math.max(0, p.diario!.objetivo - p.diario!.real)
            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <span style={d('20px')}>Hoy · {N(p.diario!.real)} <span style={d('20px', prog >= 100 ? VERDE : INK)}>{P0(prog)}</span></span>
                  <span style={d('18px')}>Faltan <span style={{ color: INK }}>{N(faltan)}</span> de objetivo {N(p.diario!.objetivo)}</span>
                </div>
                <div style={{ height: 18, border: `2px solid ${INK}`, background: CREMA }}><div style={{ width: `${Math.min(100, prog)}%`, height: '100%', background: ROSA, borderRight: `2px solid ${INK}`, transition: 'width .3s' }} /></div>
              </div>
            )
          })()}
          {objetivos.map(o => {
            const prog = o.obj > 0 ? (o.real / o.obj) * 100 : 0
            const faltan = Math.max(0, o.obj - o.real)
            return (
              <div key={o.k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <span style={d('20px')}>{o.lbl} · {N(o.real)} <span style={d('20px', prog >= 100 ? VERDE : INK)}>{P0(prog)}</span></span>
                  <span style={d('18px')}>Faltan <span style={{ color: INK }}>{N(faltan)}</span> de objetivo <Edit value={o.obj} onSave={v => p.onSaveObjetivoVenta(o.k, v)} color={AZUL} /></span>
                </div>
                <div style={{ height: 16, border: `2px solid ${INK}`, background: CREMA }}><div style={{ width: `${Math.min(100, prog)}%`, height: '100%', background: ROSA, borderRight: `2px solid ${INK}`, transition: 'width .3s' }} /></div>
              </div>
            )
          })}
        </div>
      </Bloque>

      {/* 7 · PROYECCIONES | RATIO | PE */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, alignItems: 'stretch' }}>
        <Bloque ceja={AZUL}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={eyebrow(AZUL, BLANCO)}>Proyecciones</span>
            <button onClick={() => p.onNavTab?.('cashflow')} style={{ ...eyebrow(BLANCO), cursor: 'pointer', fontSize: 11, boxShadow: SHADOW }}>Cashflow →</button>
          </div>
          <div title="A este ritmo de ventas, dónde cerrará el mes frente a tu objetivo mensual" style={{ background: CREMA, border: `2px solid ${INK}`, padding: '10px 12px', marginTop: 14, cursor: 'help' }}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }}>A este ritmo cierras el mes en<Est /></div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={d('clamp(24px,2.8vw,34px)')}>{E(p.cierreMes)}</span>
              {p.objetivoMes > 0 && <span style={{ ...eyebrow(pctCierre >= 100 ? VERDE : ROJO, BLANCO), fontSize: 11 }}>{pctCierre >= 100 ? '✓ llegas' : '✗ ' + P0(pctCierre)}</span>}
            </div>
            {p.objetivoMes > 0 && <div style={{ fontFamily: LEX, fontSize: 12.5, fontWeight: 600, color: GRIS, marginTop: 2 }}>objetivo {E(p.objetivoMes)}</div>}
          </div>
          <div title="Saldo real del banco · suma de movimientos de v_caja_mensual (mismo dato que Cashflow)" style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, marginTop: 14, cursor: 'help' }}>Saldo banco</div>
          <div style={d('clamp(24px,2.8vw,34px)', AZUL)}>{p.saldoBanco != null ? E(p.saldoBanco) : '—'}</div>
          {p.saldoBanco != null && p.gastosFijosMes > 0 && (() => {
            const meses = p.saldoBanco / p.gastosFijosMes
            return (
              <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, marginTop: 10 }}>
                Con esta caja aguantas <b style={{ color: meses >= 3 ? VERDE : ROJO }}>{meses.toFixed(1)} meses</b> de gastos fijos
              </div>
            )
          })()}
          {/* LEY-PRUDENCIA-01: los cobros previstos son solo información de planificación,
              nunca se suman al saldo del banco ni compensan pagos. */}
          <div title="Salidas ya conocidas, cuenten o no todavía del banco (LEY-PRUDENCIA-01)" style={{ fontFamily: OSW, fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, marginTop: 12, cursor: 'help' }}>Pagos comprometidos<Est /></div>
          <div style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 600, lineHeight: 1.9, marginTop: 2 }}>
            <div>Pagos 7 d · <b>{E(p.saldo.pagos7d)}</b></div>
            <div>Pagos 30 d · <b>{E(p.saldo.pagos30d)}</b></div>
          </div>
          <div title="Aún no han llegado — no es caja disponible, solo cuentan cuando el banco los confirma" style={{ fontFamily: OSW, fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, marginTop: 10, cursor: 'help' }}>Cobros previstos (aún no han llegado)<Est /></div>
          <div style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 600, lineHeight: 1.9, marginTop: 2, color: GRIS }}>
            <div>Cobros 7 d · <b>{E(p.saldo.cobros7d)}</b></div>
            <div>Cobros 30 d · <b>{E(p.saldo.cobros30d)}</b></div>
          </div>
        </Bloque>

        <Bloque ceja={GRANATE}>
          <span style={eyebrow(GRANATE, BLANCO)}>Ratio ingresos / gastos</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, margin: '14px 0 10px' }}>
            <div title="Cuántas veces cubren los ingresos netos los gastos fijos del mes" style={{ ...d('clamp(32px,4vw,48px)', p.ratioActual >= p.objetivoRatio ? VERDE : NAR), cursor: 'help' }}>{(Number.isFinite(p.ratioActual) ? p.ratioActual : 0).toFixed(2)}×</div>
            <div style={d('17px')}>objetivo <Edit value={p.objetivoRatio} onSave={p.onSaveObjetivoRatio} suffix="×" color={AZUL} /></div>
          </div>
          <div style={{ height: 14, border: `2px solid ${INK}`, background: CREMA }}><div style={{ width: `${Math.min(100, p.objetivoRatio > 0 ? (p.ratioActual / p.objetivoRatio) * 100 : 0)}%`, height: '100%', background: p.ratioActual >= p.objetivoRatio ? VERDE : NAR, borderRight: `2px solid ${INK}` }} /></div>
          <div style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 600, lineHeight: 1.95, marginTop: 12 }}>
            <div>Ingresos netos · <b>{E(p.netosReales || p.netoEstimado)}</b></div>
            <div>Gastos fijos · <b>{E(p.gastosFijosMes)}</b></div>
            <div>Gastos reales · <b>{E(p.gastosReales)}</b></div>
          </div>
        </Bloque>

        <Bloque ceja={VERDE}>
          <span style={eyebrow(VERDE, BLANCO)}>Punto de equilibrio</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, margin: '14px 0 10px' }}>
            <div title="Facturación bruta que necesitas este mes para cubrir todos los gastos fijos" style={{ ...d('clamp(32px,4vw,48px)'), cursor: 'help' }}>{E(p.pe.peBruto)}</div>
            <div style={{ ...eyebrow(p.pe.pctProgreso >= 100 ? VERDE : NAR, BLANCO), marginBottom: 10 }}>{P0(p.pe.pctProgreso)}</div>
          </div>
          <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS }}>bruto necesario este mes</div>
          <div style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 600, lineHeight: 1.95, marginTop: 10 }}>
            <div>Llevamos · <b>{E(p.pe.acumulado)}</b></div>
            <div>Faltan · <b style={{ color: p.pe.faltan > 0 ? NAR : VERDE }}>{E(p.pe.faltan)}</b></div>
            <div>Día verde · <b>{p.pe.diaVerdeEstimado ? `${p.pe.diaVerdeEstimado.fecha} ${p.pe.diaVerdeEstimado.diaSemana}` : '—'}</b></div>
            <div>Realidad · <b>{E(p.pe.realFacDia)}/día · {N(p.pe.realPedDia)} ped</b></div>
          </div>
        </Bloque>
      </section>

      {/* 8 · MARCAS | PROVISIONES + TOP VENTAS */}
      <section style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16, alignItems: 'stretch' }}>
        <Bloque ceja={ROSA}>
          <Title tag="Tus marcas" tagBg={ROSA} tagColor={BLANCO} title="Las 5 que más facturan, con su TM bruto y su evolución." nav={{ label: 'Marcas', onClick: () => p.onNavTab?.('marcas') }} />
          {(marcaSube || marcaCae) && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {marcaSube && marcaSube.varPct != null && marcaSube.varPct >= 0 && <span style={{ ...eyebrow(VERDE, BLANCO), fontSize: 13 }}>▲ Sube {marcaSube.nombre} {DELTA(marcaSube.varPct)}</span>}
              {marcaCae && marcaCae.varPct != null && marcaCae.varPct < 0 && <span style={{ ...eyebrow(ROJO, BLANCO), fontSize: 13 }}>▼ Cae {marcaCae.nombre} {DELTA(marcaCae.varPct)}</span>}
            </div>
          )}
          {marcas5.length > 0
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {marcas5.map((mk, i) => {
                  const real = mk.bruto > 0
                  return (
                    <div key={mk.nombre} style={{ border: `2px solid ${INK}`, background: BLANCO, padding: '12px 16px', display: 'grid', gridTemplateColumns: real ? '1fr 160px' : '1fr', gap: 16, alignItems: 'center', opacity: real ? 1 : 0.82 }}>
                      <div>
                        {real
                          ? <Barra nombre={mk.nombre} pct={mk.pct} color={marcaColor[i % marcaColor.length]} valor={E(mk.bruto)} alto={26} track={CREMA} />
                          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                              <span style={{ ...d('15px'), lineHeight: 1.05 }}>{mk.nombre}</span>
                              <span style={{ ...d('17px'), color: GRIS }}>—</span>
                            </div>}
                        <div style={{ display: 'flex', gap: 18, marginTop: 8, fontFamily: OSW, fontSize: 13, letterSpacing: '0.5px', textTransform: 'uppercase', alignItems: 'center' }}>
                          {real ? <>
                            <span style={{ opacity: 0.55 }}>Fact. bruta <b style={{ color: INK }}>{E2(mk.bruto)}</b></span>
                            <span style={{ opacity: 0.55 }}>TM bruto <b style={{ color: AZUL }}>{mk.tmBruto > 0 ? E2(mk.tmBruto) : '—'}</b></span>
                            {mk.varPct != null && <span style={{ color: mk.varPct >= 0 ? VERDE : ROJO }}><Arrow v={mk.varPct} />{DELTA(mk.varPct)}</span>}
                          </> : <span style={{ color: GRIS }}>Sin datos en 90 días</span>}
                        </div>
                      </div>
                      {real && (
                        <div style={{ borderLeft: `2px solid ${INK}22`, paddingLeft: 14 }}>
                          <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.55, marginBottom: 2 }}>Evolución</div>
                          <Spark serie={mk.serie && mk.serie.length >= 2 ? mk.serie : []} color={marcaColor[i % marcaColor.length]} w={160} h={38} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            : <div style={{ border: `2px solid ${INK}`, background: BLANCO, padding: '18px', fontFamily: LEX, fontWeight: 600 }}>Sin marcas activas configuradas.</div>}
        </Bloque>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Bloque ceja={NAR} style={{ flex: 1 }}>
            <span style={eyebrow(NAR, BLANCO)}>Provisiones</span>
            <div style={{ ...d('clamp(24px,3vw,34px)', NAR), margin: '12px 0 10px' }}>{E(p.provisiones.totalAGuardar)}</div>
            <div style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 600, lineHeight: 1.9 }}>
              <div>IVA · <b>{E(p.provisiones.provIVA)}</b></div>
              <div>IRPF · <b>{E(p.provisiones.provIRPF)}</b></div>
            </div>
            {p.provisiones.proximosPagos.length > 0 && <>
              <div style={{ fontFamily: OSW, fontSize: 11.5, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, margin: '12px 0 6px' }}>Próximos pagos</div>
              {p.provisiones.proximosPagos.slice(0, 5).map((x, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEX, fontSize: 13, fontWeight: 600, padding: '3px 0' }}><span>{x.concepto}</span><span>{E(x.importe)}</span></div>
              ))}
            </>}
          </Bloque>
          <Bloque ceja={ROSA} style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={eyebrow(ROSA, BLANCO)}>Top ventas</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['productos', 'modificadores'] as const).map(t => (
                  <button key={t} onClick={() => p.onTopTab(t)} style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '4px 8px', cursor: 'pointer', border: `2px solid ${INK}`, background: p.topTab === t ? INK : BLANCO, color: p.topTab === t ? BLANCO : INK, boxShadow: p.topTab === t ? 'none' : SHADOW, transform: p.topTab === t ? 'translate(2px,2px)' : 'none' }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              {p.topItems.length === 0 || p.topDatosDemo
                ? <div style={{ fontFamily: OSW, letterSpacing: '0.5px', color: GRIS, fontSize: 13, padding: '8px 0' }}>Sin datos POS de {p.topTab}.</div>
                : p.topItems.slice(0, 5).map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i === 0 ? `2px solid ${INK}` : `1px solid ${INK}22` }}>
                    <span style={{ ...d('18px', i === 0 ? ROSA : INK), width: 26 }}>{String(t.ranking ?? i + 1).padStart(2, '0')}</span>
                    <span style={{ fontFamily: LEX, fontWeight: 600, fontSize: 13.5, flex: 1 }}>{t.producto}</span>
                    <span style={d('16px')}>{E2(t.importe)}</span>
                  </div>
                ))}
            </div>
          </Bloque>
        </div>
      </section>

      {/* 9 · CIERRE */}
      <section style={{ background: INK, color: CREMA, border: `3px solid ${INK}`, padding: `${PAD}`, textAlign: 'center' }}>
        <div style={d('clamp(30px,5vw,60px)', CREMA)}>Binagre es hogar.</div>
        <div style={{ fontFamily: OSW, letterSpacing: '6px', fontSize: 14, color: AMA, marginTop: 10, textTransform: 'uppercase' }}>Comer bien. Aquí y ahora.</div>
      </section>
    </div>
  )
}
