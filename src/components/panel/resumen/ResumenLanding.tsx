/**
 * ResumenLanding v8 — pestaña Resumen del Panel Global.
 * v8 añade (tanda 1 de mejoras): tarjeta de ESTADO DE SALUD arriba del todo (semáforo +
 * titular + frente abierto), fecha de periodo + hora de actualización, etiquetas «est.» como
 * norma viva sobre los datos estimados, tooltips al pasar el ratón en los números clave y
 * flechitas de tendencia ↑↓ en las desviaciones y la facturación.
 * Layout v7 intacto. No calcula nada salvo la curva estimada de marca y el nivel de salud (visual).
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
const TRACK = '#ecdcb8'
const TRACK_CANAL = '#e2dac9'
const ROSA = '#FF2E63'
const AMA = '#FFC400'
const VERDE = '#0FB86B'
const NAR = '#FF6A1A'
const AZUL = '#2D5BFF'
const VERDE_CL = '#46e6a0'
const NAR_CL = '#ffb27a'
const FLUOR = '#CDFF00'
const GRIS = '#9a8f78'
const OSW = "'Oswald', sans-serif"
const LEX = "'Lexend', sans-serif"
const PAD = '40px'

// colores corporativos de plataforma
const CORP: Record<string, string> = { uber: '#06C167', glovo: '#FFC244', je: '#FF8000', web: '#B01D23', dir: '#1e2233' }

// textos sobre fondo oscuro
const D1 = CREMA
const D2 = '#e3d9c2'
const D3 = '#cabd9f'

const d = (size: string, color = INK): React.CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color })
const eyebrow = (bg: string, color = INK): React.CSSProperties => ({ display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 12px' })

const EUR = (n: number) => fmtEur(n, { decimals: 0 })
const E = (n: number) => fmtEur(n, { showEuro: false, decimals: 0 })
const E2 = (n: number) => fmtEur(n, { showEuro: false, decimals: 2 })
const N = (n: number) => fmtNum(n, 0)
const P0 = (n: number) => fmtPct(n, 0)
const P2 = (n: number) => fmtPct(n, 2)
const DELTA = (v: number | null) => (v == null ? '—' : fmtEur(v, { signed: true, showEuro: false, decimals: 1 }) + '%')

// curva estimada (solo visual) para una marca sin histórico por periodos.
function serieEstimada(bruto: number): number[] {
  if (bruto <= 0) return []
  const factores = [0.62, 0.71, 0.79, 0.88, 0.95, 1]
  return factores.map(f => bruto * f)
}

// badge «est.» reutilizable — norma viva: marca cualquier dato que aún no sea real.
function Est({ light = false, tip = 'Dato estimado · todavía no proviene del Running / datos reales' }: { light?: boolean; tip?: string }) {
  return <span title={tip} style={{ fontFamily: OSW, fontSize: 9, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', border: `1px solid ${light ? '#ffffff66' : '#00000044'}`, color: light ? '#ffffffcc' : '#00000088', padding: '0 4px', marginLeft: 6, verticalAlign: 'middle', cursor: 'help', borderRadius: 3 }}>est</span>
}

// flechita de tendencia ↑↓ (verde sube / rosa baja).
function Arrow({ v }: { v: number | null }) {
  if (v == null) return null
  const up = v >= 0
  return <span style={{ fontSize: '0.62em', marginRight: 5, color: up ? VERDE : ROSA }}>{up ? '▲' : '▼'}</span>
}

// semáforo vertical para el estado de salud.
function Semaforo({ nivel }: { nivel: 'verde' | 'ambar' | 'rojo' }) {
  const luz = (c: string, on: boolean): React.CSSProperties => ({ width: 22, height: 22, borderRadius: '50%', background: on ? c : '#00000022', border: `3px solid ${INK}`, boxShadow: on ? `0 0 0 3px ${c}66` : 'none' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, background: '#00000018', border: `3px solid ${INK}`, padding: '11px 9px', borderRadius: 40, flexShrink: 0 }}>
      <span style={luz('#ff3b3b', nivel === 'rojo')} />
      <span style={luz('#ffb800', nivel === 'ambar')} />
      <span style={luz('#1ec773', nivel === 'verde')} />
    </div>
  )
}

interface GrupoData { gasto: number; presupuesto: number; pctSobreNetos: number }
interface RepartoRow { nombre: string; bruto: number; neto: number; pedidos: number; pct: number }
interface MarcaRealRow { nombre: string; neto: number; bruto: number; pedidos: number; tmBruto: number; pct: number; serie?: number[] }
type NavTab = 'operaciones' | 'finanzas' | 'cashflow' | 'marcas' | 'evolucion'

interface Props {
  datosDemo: boolean
  periodoLabel?: string
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

/* barra de progreso: nombre + track (diferenciado del fondo) + relleno color + % + valor */
function Barra({ nombre, pct, color, valor, alto = 34, track = TRACK }: { nombre: string; pct: number; color: string; valor: string; alto?: number; track?: string }) {
  const fill = Math.min(100, Math.max(0, pct))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ ...d('15px'), width: 104, flexShrink: 0, lineHeight: 1.05 }}>{nombre}</span>
      <div style={{ position: 'relative', flex: 1, height: alto, background: track, border: `3px solid ${INK}`, overflow: 'hidden', boxShadow: `inset 0 0 0 2px #ffffff` }}>
        <div style={{ width: `${fill}%`, height: '100%', background: color, transition: 'width .3s', boxShadow: `2px 0 0 ${INK}` }} />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', ...d('17px') }}>{P0(pct)}</span>
      </div>
      <span style={{ ...d('17px'), width: 96, textAlign: 'right', flexShrink: 0 }}>{valor}</span>
    </div>
  )
}

export default function ResumenLanding(p: Props) {
  const netoPct = p.ventasPeriodo > 0 ? (p.netoEstimado / p.ventasPeriodo) * 100 : 0
  const maxDia = Math.max(1, ...p.diasPico.map(x => x.valor))
  const diasConV = p.diasPico.filter(x => x.valor > 0)
  const diaFuerte = diasConV.length ? diasConV.reduce((a, x) => x.valor > a.valor ? x : a) : null
  const diaFlojo = diasConV.length ? diasConV.reduce((a, x) => x.valor < a.valor ? x : a) : null
  const margenBruto = p.netoEstimado - p.grupos.producto.gasto
  const resultadoNetoPL = p.netoEstimado - (p.grupos.producto.gasto + p.grupos.equipo.gasto + p.grupos.local.gasto + p.grupos.controlables.gasto)
  const totalCanal = p.canalStats.reduce((a, c) => a + c.bruto, 0)
  const DI = 'Datos insuf.'
  const canalRent = p.canalStats.filter(c => c.pedidos > 0).map(c => ({ id: c.id, np: c.neto / c.pedidos })).sort((a, b) => b.np - a.np)[0]?.id

  const frase = elegirFrase(p.metricas)
  const fraseCostes = elegirFrase(p.metricas, 'costes')
  const mostrarCostes = fraseCostes.lead !== 'Comer bien'

  const m = p.metricas

  // ── ESTADO DE SALUD (visual): cuenta de frentes abiertos ──
  const saludFlags: string[] = []
  if (m.variacionVentas != null && m.variacionVentas < -3) saludFlags.push(`Ventas ${DELTA(m.variacionVentas)} vs periodo anterior`)
  if (m.primeCostPct > 65) saludFlags.push(`Prime cost alto (${P0(m.primeCostPct)})`)
  if (m.ratioGap < 0) saludFlags.push('Ratio ingresos/gastos por debajo del objetivo')
  if (m.faltaPE > 0 && m.pePctProgreso < 70) saludFlags.push(`Aún lejos de cubrir gastos (${P0(m.pePctProgreso)})`)
  if (m.margenNetoPct > 0 && m.margenNetoPct < 55) saludFlags.push(`Margen neto ajustado (${P0(m.margenNetoPct)})`)
  const saludNivel: 'verde' | 'ambar' | 'rojo' = saludFlags.length === 0 ? 'verde' : saludFlags.length <= 2 ? 'ambar' : 'rojo'
  const saludBg = saludNivel === 'verde' ? VERDE : saludNivel === 'ambar' ? AMA : ROSA
  const saludTxt = saludNivel === 'ambar' ? INK : '#fff'
  const saludTitulo = saludNivel === 'verde' ? 'Semana sana' : saludNivel === 'ambar' ? 'Ojo, un par de cosas' : 'Atención: varios frentes'
  const saludPuntos = saludFlags.length
    ? saludFlags.slice(0, 3)
    : [
        p.ebitda >= 0 ? `EBITDA positivo (${P0(p.ebitdaPct)})` : '',
        `Margen neto ${P0(m.margenNetoPct)}`,
        p.porCobrar.total > 0 ? `${E(p.porCobrar.total)} por cobrar en camino` : '',
      ].filter(Boolean)
  const actualizado = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  const alertas: Array<{ t: string; c: string }> = []
  if (m.variacionVentas != null && m.variacionVentas < -3) alertas.push({ t: `Ventas ${DELTA(m.variacionVentas)} vs periodo ant.`, c: ROSA })
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

  // Tabla fusionada de resultado: P&L con presupuesto integrado en una sola tabla.
  type Fila = { l: string; imp: string; impC: string; pct?: string; grupo?: GrupoGasto; bold?: boolean }
  const filas: Fila[] = [
    { l: 'Facturación', imp: E2(p.ventasPeriodo), impC: D1 },
    { l: 'Ingresos netos', imp: E2(p.netoEstimado), impC: VERDE_CL, pct: P0(netoPct), bold: true },
    { l: 'Producto · COGS', imp: p.grupos.producto.gasto > 0 ? '−' + E2(p.grupos.producto.gasto) : DI, impC: p.grupos.producto.gasto > 0 ? NAR_CL : D3, pct: p.grupos.producto.gasto > 0 ? P0(pctN(p.grupos.producto.gasto)) : undefined, grupo: 'producto' },
    { l: 'Margen bruto', imp: E2(margenBruto), impC: AMA, bold: true },
    { l: 'Equipo · Labor', imp: p.grupos.equipo.gasto > 0 ? '−' + E2(p.grupos.equipo.gasto) : DI, impC: p.grupos.equipo.gasto > 0 ? NAR_CL : D3, pct: p.grupos.equipo.gasto > 0 ? P0(pctN(p.grupos.equipo.gasto)) : undefined, grupo: 'equipo' },
    { l: 'Local · Occupancy', imp: p.grupos.local.gasto > 0 ? '−' + E2(p.grupos.local.gasto) : DI, impC: p.grupos.local.gasto > 0 ? NAR_CL : D3, pct: p.grupos.local.gasto > 0 ? P0(pctN(p.grupos.local.gasto)) : undefined, grupo: 'local' },
    { l: 'Controlables · Opex', imp: p.grupos.controlables.gasto > 0 ? '−' + E2(p.grupos.controlables.gasto) : DI, impC: p.grupos.controlables.gasto > 0 ? NAR_CL : D3, pct: p.grupos.controlables.gasto > 0 ? P0(pctN(p.grupos.controlables.gasto)) : undefined, grupo: 'controlables' },
    { l: 'Resultado neto', imp: E2(resultadoNetoPL), impC: resultadoNetoPL >= 0 ? VERDE_CL : '#ff9aa8', bold: true },
  ]

  const desv = [
    { v: DELTA(p.variacionVentas), raw: p.variacionVentas, l: 'ventas', c: p.variacionVentas != null && p.variacionVentas < 0 ? ROSA : VERDE },
    { v: DELTA(p.variacionPedidos), raw: p.variacionPedidos, l: 'pedidos', c: p.variacionPedidos != null && p.variacionPedidos < 0 ? ROSA : VERDE },
    { v: DELTA(p.variacionTM), raw: p.variacionTM, l: 'ticket medio', c: p.variacionTM != null && p.variacionTM < 0 ? ROSA : VERDE },
  ]
  const heroStats: Array<{ l: string; v: string; c: string; est?: boolean; tip?: string }> = [
    { l: 'TM bruto', v: E2(p.tmBruto), c: AZUL, tip: 'Ticket medio bruto = facturación / pedidos' },
    { l: 'TM neto', v: E2(p.tmNeto), c: VERDE, tip: 'Ticket medio neto = ingresos netos / pedidos', est: true },
    { l: 'EBITDA est.', v: E(p.ebitda), c: p.ebitda >= 0 ? VERDE : ROSA, est: true, tip: 'Beneficio operativo estimado: ingresos − producto − personal − resto de gastos' },
    { l: 'Margen neto', v: P2(p.margenNetoReal), c: INK, tip: 'Ingresos netos sobre facturación bruta' },
  ]
  const servColor = [AMA, AZUL, VERDE, NAR, ROSA]
  const marcaColor = [ROSA, AZUL, VERDE, NAR, AMA, '#8A4FFF', '#0FB8B8']
  const marcas5 = p.marcasReales.filter(mk => mk.bruto > 0).slice(0, 5)

  const sec = (bg: string, pad = `44px ${PAD}`): React.CSSProperties => ({ background: bg, padding: pad, borderBottom: `4px solid ${INK}` })

  return (
    <div style={{ background: CREMA, fontFamily: LEX, color: INK, border: `4px solid ${INK}`, marginTop: 4 }}>
      {p.datosDemo && <div style={{ background: AMA, borderBottom: `4px solid ${INK}`, padding: `8px ${PAD}`, fontFamily: OSW, letterSpacing: '1px', fontSize: 13, textTransform: 'uppercase' }}>Datos demo · BD vacía o sin datos en este periodo</div>}

      {/* 0 · ESTADO DE SALUD (arriba del todo) */}
      <section style={{ background: saludBg, color: saludTxt, borderBottom: `4px solid ${INK}`, padding: `22px ${PAD}`, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Semaforo nivel={saludNivel} />
          <div>
            <div style={{ ...d('clamp(26px,3.4vw,42px)', saludTxt) }}>{saludTitulo}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {saludPuntos.map((t, i) => (
                <span key={i} style={{ fontFamily: LEX, fontWeight: 600, fontSize: 13, background: saludNivel === 'ambar' ? '#ffffffcc' : '#ffffff26', border: `2px solid ${saludNivel === 'ambar' ? INK : '#ffffff66'}`, color: saludTxt, padding: '4px 10px' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.85 }}>Periodo</div>
          <div style={d('clamp(16px,2vw,24px)', saludTxt)}>{p.periodoLabel ?? '—'}</div>
          <div style={{ fontFamily: OSW, fontSize: 11.5, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8, marginTop: 10 }}>Actualizado {actualizado} · Panel Global</div>
        </div>
      </section>

      {/* 1 · HERO — amarillo */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', borderBottom: `4px solid ${INK}`, background: AMA }}>
        <div style={{ padding: `42px ${PAD} 40px`, borderRight: `4px solid ${INK}` }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={eyebrow('#fff')}>Comer bien. Aquí y ahora.</span>
            {p.periodoLabel && <span style={{ ...eyebrow(INK, AMA), fontSize: 12 }}>{p.periodoLabel}</span>}
          </div>
          <div style={{ ...d('clamp(32px,4.2vw,56px)'), margin: '18px 0 18px', maxWidth: 640 }}>
            {p.pedidosPeriodo > 0
              ? <>Has entregado <span style={{ background: INK, color: FLUOR, padding: '0 .14em', display: 'inline-block' }}>{N(p.pedidosPeriodo)}</span> pedidos.</>
              : 'Aún no hay pedidos entregados.'}
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Facturación bruta</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
                <div style={d('clamp(44px,6.8vw,92px)')}>{EUR(p.ventasPeriodo)}</div>
                {p.variacionVentas != null && <div style={{ ...eyebrow(p.variacionVentas >= 0 ? VERDE : ROSA, '#fff'), fontSize: 18, padding: '7px 12px', marginBottom: 10 }}><Arrow v={p.variacionVentas} />{DELTA(p.variacionVentas)}</div>}
              </div>
            </div>
            <div style={{ marginBottom: 4 }}><Spark serie={p.serie} color={INK} /></div>
          </div>
          <div title="Lo que te queda tras las comisiones de plataforma. Estimado a partir de las fórmulas de comisión." style={{ display: 'inline-flex', alignItems: 'baseline', gap: 12, background: VERDE, color: '#fff', border: `3px solid ${INK}`, boxShadow: `5px 5px 0 ${INK}`, padding: '8px 16px', marginTop: 18, cursor: 'help' }}>
            <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Neto estimado</span>
            <span style={d('clamp(24px,3.4vw,40px)', '#fff')}>{EUR(p.netoEstimado)}</span>
            <span style={{ fontFamily: OSW, fontSize: 15, fontWeight: 600 }}>{P2(netoPct)} s/ bruto</span>
            <Est light />
          </div>
        </div>
        <div style={{ background: CLARO, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
          <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: `10px 10px 0 ${INK}`, padding: '26px 28px', width: '100%', maxWidth: 380 }}>
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

      {/* 2 · ALERTAS (oscuro) */}
      <section style={{ background: OSC, borderBottom: `4px solid ${INK}`, padding: `18px ${PAD}`, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ ...d('16px', D1), marginRight: 4 }}>Atención →</span>
        {alertas.length === 0
          ? <span style={{ ...eyebrow(VERDE, '#fff'), fontSize: 13 }}>Todo en orden</span>
          : alertas.slice(0, 5).map((a, i) => (
            <span key={i} style={{ display: 'inline-block', background: '#fff', border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${a.c}`, fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '6px 12px' }}>{a.t}</span>
          ))}
      </section>

      {/* 3 · DESVIACIONES (CREMA) — vs mismo periodo anterior */}
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

      {/* 4 · FRASE (ROSA) */}
      <section style={{ background: ROSA, color: '#fff', padding: `46px ${PAD}`, borderBottom: `4px solid ${INK}` }}>
        <div style={{ ...d('clamp(28px,4.4vw,54px)', '#fff'), maxWidth: 1000 }}>{frase.lead} <span style={{ background: '#fff', color: ROSA, padding: '0 10px' }}>{frase.mark}</span> {frase.tail}</div>
        <div style={{ fontSize: 'clamp(16px,1.9vw,21px)', fontWeight: 600, marginTop: 18, maxWidth: 820 }}>{frase.sub}</div>
      </section>

      {/* 5 · CANALES 66% (blanco) | ALMUERZO-CENA 33% (tarjeta propia, otro color) */}
      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `44px ${PAD}`, borderRight: `4px solid ${INK}`, background: '#fff' }}>
          <Title tag="Por dónde entra el hambre" tagBg={AMA} title="Cada canal: peso, neto, margen, pedidos y TM bruto/neto." nav={{ label: 'Operaciones', onClick: () => p.onNavTab?.('operaciones') }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {p.canalStats.map(c => {
              const col = CORP[c.id] ?? c.color
              return (
                <div key={c.id} style={{ border: `3px solid ${INK}`, background: '#fff', boxShadow: `5px 5px 0 ${INK}`, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Barra nombre={c.label} pct={totalCanal > 0 ? (c.bruto / totalCanal) * 100 : 0} color={col} valor={E2(c.bruto)} track={TRACK_CANAL} />
                    {c.id === canalRent && <span style={{ ...eyebrow(VERDE, '#fff'), fontSize: 11 }}>+ rentable</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
                    {[['Neto', E2(c.neto), VERDE], ['Margen', P2(c.margen), INK], ['Pedidos', N(c.pedidos), INK], ['TM bruto', c.pedidos > 0 ? E2(c.ticket) : '—', AZUL], ['TM neto', c.pedidos > 0 ? E2(c.neto / c.pedidos) : '—', VERDE]].map(([l, v, cc]) => (
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
        <div style={{ padding: `44px ${PAD}`, background: CLARO }}>
          <span style={eyebrow(NAR, '#fff')}>Almuerzo y cena</span>
          <div style={{ ...d('clamp(20px,2.4vw,28px)'), margin: '14px 0 20px' }}>Cuándo te compran.</div>
          {p.serviciosHay
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {p.servicios.slice(0, 4).map((s, i) => (
                  <div key={s.nombre} style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}`, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                      <span style={{ ...d('18px', INK) }}>{s.nombre}</span>
                      <span style={d('22px', servColor[i % servColor.length] === AMA ? INK : servColor[i % servColor.length])}>{P0(s.pct)}</span>
                    </div>
                    <div style={{ height: 22, background: TRACK, border: `3px solid ${INK}`, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, s.pct)}%`, height: '100%', background: servColor[i % servColor.length] }} /></div>
                    <div style={{ fontFamily: LEX, fontSize: 12.5, fontWeight: 600, marginTop: 8, color: '#5c5340' }}>{E2(s.bruto)} bruto · {N(s.pedidos)} ped · TM {s.pedidos > 0 ? E2(s.bruto / s.pedidos) : '—'}</div>
                  </div>
                ))}
              </div>
            : <div style={{ background: '#fff', border: `3px solid ${INK}`, padding: '16px', fontFamily: LEX, fontWeight: 600, fontSize: 13.5, color: '#5c5340' }}>Sin reparto por momento del día: el campo «servicio» no viene informado en las ventas de este periodo.</div>}
        </div>
      </section>

      {/* 6 · DEUDA DE PLATAFORMAS A HOY (AZUL) */}
      <section style={{ background: AZUL, color: '#fff', padding: `40px ${PAD}`, borderBottom: `4px solid ${INK}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={eyebrow('#fff')}>Te deben las plataformas</span>
          <button onClick={() => p.onNavTab?.('cashflow')} style={{ ...eyebrow('#fff'), cursor: 'pointer', fontSize: 12 }}>Cashflow →</button>
        </div>
        {p.porCobrar.total > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 26, marginTop: 18, alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.85 }}>Pendiente de cobro</div>
              <div style={d('clamp(44px,6.5vw,86px)', '#fff')}>{EUR(p.porCobrar.total)}</div>
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, background: '#fff', color: AZUL, border: `3px solid ${INK}`, padding: '6px 14px', marginTop: 8 }}>
                <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase' }}>Entra antes de fin de mes</span>
                <span style={d('22px', AZUL)}>{E(p.porCobrar.hastaFinMes)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {p.porCobrar.porCanal.filter(c => c.neto > 0).map(c => {
                const pct = p.porCobrar.total > 0 ? (c.neto / p.porCobrar.total) * 100 : 0
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ ...d('15px', '#fff'), width: 96, flexShrink: 0 }}>{c.label}</span>
                    <div style={{ position: 'relative', flex: 1, height: 28, background: '#ffffff33', border: `3px solid ${INK}`, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: CORP[c.id] ?? c.color }} />
                    </div>
                    <span style={{ ...d('17px', '#fff'), width: 92, textAlign: 'right', flexShrink: 0 }}>{E(c.neto)}</span>
                  </div>
                )
              })}
              <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, opacity: 0.85, marginTop: 2 }}>{p.porCobrar.nLiquidaciones} liquidaciones pendientes · neto estimado · cierre histórico al 19-jun</div>
            </div>
          </div>
        ) : (
          <div style={{ ...d('clamp(22px,3vw,34px)', '#fff'), marginTop: 16 }}>Todo cobrado al día. No hay liquidaciones pendientes.</div>
        )}
      </section>

      {/* 7 · DÍAS PICO 33% (CREMA) | RESULTADO 66% (oscuro, tabla única) */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `44px ${PAD}`, borderRight: `4px solid ${INK}`, background: CREMA }}>
          <Title tag={`Días pico · ${p.mesLabel}`} tagBg={AZUL} tagColor="#fff" title={`Bruto por día. Media ${E(p.mediaDiariaPico)}.`} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150, marginBottom: 16 }}>
            {p.diasPico.map(x => (
              <button key={x.idx} onClick={() => p.onFiltrarDiaSemana?.(x.idx)} title={E(x.valor)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ fontFamily: OSW, fontSize: 10.5, fontWeight: 600 }}>{x.valor > 0 ? E(x.valor) : ''}</span>
                <div style={{ width: '100%', height: `${(x.valor / maxDia) * 96}px`, minHeight: 4, background: x.color, border: `3px solid ${INK}` }} />
                <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{x.nombre}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: LEX, fontSize: 14, fontWeight: 600 }}>
            <span>Más fuerte · <b>{diaFuerte ? `${diaFuerte.nombre} ${E(diaFuerte.valor)}` : '—'}</b></span>
            <span>Más flojo · <b>{diaFlojo ? `${diaFlojo.nombre} ${E(diaFlojo.valor)}` : '—'}</b></span>
          </div>
        </div>
        <div style={{ padding: `44px ${PAD}`, background: OSC, color: D1 }}>
          <Title tag="Resultado del periodo" tagBg={VERDE} tagColor="#fff" title="" dark nav={{ label: 'Finanzas', onClick: () => p.onNavTab?.('finanzas') }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', margin: '18px 0 22px' }}>
            <div title="Beneficio operativo estimado: ingresos − producto − personal − resto de gastos" style={{ ...d('clamp(44px,7vw,84px)', p.ebitda >= 0 ? VERDE_CL : '#ff9aa8'), cursor: 'help', display: 'flex', alignItems: 'center' }}>{E(p.ebitda)}<Est light /></div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ ...eyebrow(p.ebitda >= 0 ? VERDE : ROSA, '#fff') }}>EBITDA {P0(p.ebitdaPct)}</div>
              <div title="Coste de producto + personal sobre ingresos. Objetivo ≤ 60%." style={{ ...d('clamp(20px,2.6vw,30px)', p.primeCostPct <= 60 ? VERDE_CL : NAR_CL), marginTop: 12, cursor: 'help', display: 'flex', alignItems: 'center' }}>Prime cost {P2(p.primeCostPct)}<Est light /></div>
              <div style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', color: D2, textTransform: 'uppercase' }}>objetivo: máx. 60% de los ingresos</div>
            </div>
          </div>
          {mostrarCostes && <div style={{ borderLeft: `3px solid ${AMA}`, paddingLeft: 14, marginBottom: 22, fontSize: 15, color: D1, maxWidth: 760 }}><b style={{ color: AMA }}>{fraseCostes.mark}</b> — {fraseCostes.sub}</div>}

          <div style={{ border: `2px solid #ffffff33`, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr 0.7fr 1.3fr', gap: 8, padding: '10px 16px', background: '#ffffff14', fontFamily: OSW, fontSize: 11.5, letterSpacing: '1px', textTransform: 'uppercase', color: D2 }}>
              <span>Concepto</span><span style={{ textAlign: 'right' }}>Importe</span><span style={{ textAlign: 'right' }}>% s/neto</span><span style={{ textAlign: 'right' }}>Presupuesto</span>
            </div>
            {filas.map((r, i) => {
              const gd = r.grupo ? p.grupos[r.grupo] : null
              const meta = r.grupo ? grupoMeta[r.grupo] : null
              const sobre = gd && gd.presupuesto > 0 && gd.gasto > gd.presupuesto
              const esEstimado = !!r.grupo && (!gd || gd.gasto === 0)
              return (
                <div key={r.l} style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr 0.7fr 1.3fr', gap: 8, alignItems: 'center', padding: '12px 16px', borderTop: `1px solid #ffffff1a`, background: r.bold ? '#ffffff14' : (i % 2 ? '#ffffff08' : 'transparent') }}>
                  <span style={{ fontFamily: LEX, fontSize: 14, fontWeight: r.bold ? 700 : 500, color: r.bold ? D1 : D2, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, flexShrink: 0, background: r.impC === NAR_CL ? NAR : (r.impC === AMA ? AMA : (r.impC === VERDE_CL ? VERDE : '#ffffff44')) }} />
                    {r.l}{meta && <span style={{ fontSize: 11, color: D3 }}> · obj {meta.obj}%</span>}{esEstimado && <Est light />}
                  </span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: r.bold ? 20 : 17, color: r.impC, letterSpacing: '-0.5px', textAlign: 'right' }}>{r.imp}</span>
                  <span style={{ fontFamily: OSW, fontSize: 13, color: D3, textAlign: 'right' }}>{r.pct ?? ''}</span>
                  <span style={{ textAlign: 'right', fontFamily: OSW, fontSize: 15 }}>
                    {gd ? <><Edit value={gd.presupuesto} onSave={v => p.onSavePresupuestoGrupo(r.grupo as GrupoGasto, v)} color={AMA} />{sobre && <span style={{ color: ROSA, fontSize: 11, marginLeft: 6 }}>▲</span>}</> : <span style={{ color: '#ffffff33' }}>—</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 8 · OBJETIVOS (AMA) — editable en azul */}
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

      {/* 9 · PROYECCIONES 33% | RATIO 33% | PE 33% */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `40px ${PAD}`, borderRight: `4px solid ${INK}`, background: VERDE, color: '#fff' }}>
          <span style={eyebrow('#fff')}>Proyecciones</span>
          <button onClick={() => p.onNavTab?.('cashflow')} style={{ ...eyebrow('#fff'), cursor: 'pointer', fontSize: 12, marginLeft: 8 }}>Cashflow →</button>
          <div title="Saldo estimado a partir de cobros y pagos medios, no del extracto bancario real" style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.85, marginTop: 16, cursor: 'help' }}>Saldo estimado<Est light /></div>
          <div style={d('clamp(28px,3.4vw,42px)', '#fff')}>{p.saldo.saldoHoy > 0 ? E(p.saldo.saldoHoy) : '—'}</div>
          <div style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600, lineHeight: 1.95, marginTop: 12 }}>
            <div>Cobros 7 d · <b>{E(p.saldo.cobros7d)}</b></div>
            <div>Cobros 30 d · <b>{E(p.saldo.cobros30d)}</b></div>
            <div>Pagos 7 d · <b>{E(p.saldo.pagos7d)}</b></div>
            <div>Pagos 30 d · <b>{E(p.saldo.pagos30d)}</b></div>
          </div>
        </div>
        <div style={{ padding: `40px ${PAD}`, borderRight: `4px solid ${INK}`, background: '#ffe0ea' }}>
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
        <div style={{ padding: `40px ${PAD}`, background: CLARO }}>
          <span style={eyebrow('#fff')}>Punto de equilibrio</span>
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

      {/* 10 · MARCAS 75% (blanco) | PROVISIONES + TOP VENTAS 25% (columna) */}
      <section style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `44px ${PAD}`, borderRight: `4px solid ${INK}`, background: '#fff' }}>
          <Title tag="Tus marcas" tagBg={ROSA} tagColor="#fff" title="Las 5 que más facturan, con su TM bruto y su evolución." nav={{ label: 'Marcas', onClick: () => p.onNavTab?.('marcas') }} />
          {marcas5.length > 0
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {marcas5.map((mk, i) => {
                  const real = !!(mk.serie && mk.serie.length >= 2)
                  const curva = real ? (mk.serie as number[]) : serieEstimada(mk.bruto)
                  return (
                    <div key={mk.nombre} style={{ border: `3px solid ${INK}`, background: '#fff', boxShadow: `5px 5px 0 ${INK}`, padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16, alignItems: 'center' }}>
                      <div>
                        <Barra nombre={mk.nombre} pct={mk.pct} color={marcaColor[i % marcaColor.length]} valor={E(mk.bruto)} alto={28} />
                        <div style={{ display: 'flex', gap: 18, marginTop: 8, fontFamily: OSW, fontSize: 13, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                          <span style={{ opacity: 0.55 }}>Fact. bruta <b style={{ color: INK }}>{E2(mk.bruto)}</b></span>
                          <span style={{ opacity: 0.55 }}>TM bruto <b style={{ color: AZUL }}>{mk.tmBruto > 0 ? E2(mk.tmBruto) : '—'}</b></span>
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
            : <div style={{ border: `3px solid ${INK}`, background: '#fff', padding: '18px', fontFamily: LEX, fontWeight: 600 }}>Sin ventas por marca en los últimos 90 días. Se nutre de las liquidaciones de plataforma por marca.</div>}
        </div>
        <div style={{ padding: `44px ${PAD}`, background: CLARO, display: 'flex', flexDirection: 'column', gap: 26 }}>
          {/* Provisiones */}
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
          {/* Top ventas */}
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

      {/* 11 · FOOTER (oscuro) */}
      <section style={{ background: OSC, color: D1, padding: PAD, textAlign: 'center' }}>
        <div style={d('clamp(34px,6vw,72px)', D1)}>Binagre es hogar.</div>
        <div style={{ fontFamily: OSW, letterSpacing: '6px', fontSize: 15, color: AMA, marginTop: 12, textTransform: 'uppercase' }}>Comer bien. Aquí y ahora.</div>
      </section>
    </div>
  )
}
