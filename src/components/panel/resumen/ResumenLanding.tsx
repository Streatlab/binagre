/**
 * ResumenLanding v3 — pestaña Resumen del Panel Global.
 * Fixes: separadores de miles en TODOS los números; oscuro suavizado (no negro);
 * inline editable del MISMO tamaño que su línea; recuperada la desviación de
 * pedidos/ticket. Mejoras: franja de alertas accionables (7), mini-gráfico de
 * evolución en el hero (9), canal más rentable por € netos/pedido (14), frases
 * por impacto € reutilizadas en varias cards (15), comparativa en más métricas (3),
 * periodo nombrado en el hero (2). No calcula nada: todo llega por props.
 */
import { useState } from 'react'
import type { CanalStat, ObjetivosVentas, PagoProximoItem, TopVentaItem } from './types'
import type { GrupoGasto } from './ColGruposGasto'
import type { DiaPico } from './ColDiasPico'
import { elegirFrase, type MetricasInsight } from './frasesInsight'

const INK = '#140f08'
const OSC = '#2b2117'          // oscuro cálido (suave, no negro)
const CREMA = '#FCEFD6'
const CLARO = '#F3D9A8'
const ROSA = '#FF2E63'
const AMA = '#FFC400'
const VERDE = '#0FB86B'
const NAR = '#FF6A1A'
const AZUL = '#2D5BFF'
const VERDE_CL = '#3ff0a0'
const NAR_CL = '#ffb27a'
const OSW = "'Oswald', sans-serif"
const LEX = "'Lexend', sans-serif"
const PAD = '40px'

const d = (size: string, color = INK): React.CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color })
const eyebrow = (bg: string, color = INK): React.CSSProperties => ({ display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 12px' })

const E0 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
const E2 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const TK = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) // ticket SIN €
const INT = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })
const PC = (n: number) => Math.round(Number.isFinite(n) ? n : 0) + '%'
const PC2 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
const DELTA = (v: number | null) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%')
const semaforo = (pct: number) => (pct > 50 ? VERDE : NAR)

interface GrupoData { gasto: number; presupuesto: number; pctSobreNetos: number }

interface Props {
  datosDemo: boolean
  periodoLabel?: string
  semanaLabel: string
  semanaRango: string
  mesLabel: string
  anoLabel: number
  ventasPeriodo: number
  netoEstimado: number
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
  topItems: TopVentaItem[]
  topDatosDemo: boolean
  topTab: 'productos' | 'modificadores'
  onTopTab: (t: 'productos' | 'modificadores') => void
  metricas: MetricasInsight
  onSaveObjetivoVenta: (tipo: 'semanal' | 'mensual' | 'anual', valor: number | null) => void
  onSaveObjetivoRatio: (valor: number | null) => void
  onSavePresupuestoGrupo: (grupo: GrupoGasto, valor: number | null) => void
  onFiltrarDiaSemana?: (idx: number) => void
}

/* editable: hereda tamaño y fuente de su línea (Oswald), marcado punteado */
function Edit({ value, onSave, suffix = ' €', color = INK }: { value: number; onSave: (v: number | null) => void; suffix?: string; color?: string }) {
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState(String(Math.round(value)))
  if (!edit) return <button onClick={() => { setVal(String(Math.round(value))); setEdit(true) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', fontFamily: OSW, fontWeight: 700, fontSize: 'inherit', letterSpacing: '-0.5px', color, textDecoration: 'underline dotted', textUnderlineOffset: 3, padding: 0 }}>{value > 0 ? INT(value) + suffix : 'fijar'}</button>
  const commit = () => { const n = parseFloat(val.replace(/\./g, '').replace(',', '.')); onSave(Number.isFinite(n) ? n : null); setEdit(false) }
  return <input autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEdit(false) }} style={{ width: '4.5em', fontFamily: OSW, fontWeight: 700, fontSize: 'inherit', letterSpacing: '-0.5px', border: `2px solid ${INK}`, padding: '0 4px', background: '#fff', color: INK }} />
}

const Sec: React.FC<{ children: React.ReactNode; bg?: string; pad?: string }> = ({ children, bg = CREMA, pad = `44px ${PAD}` }) => (
  <section style={{ background: bg, padding: pad, borderBottom: `4px solid ${INK}` }}>{children}</section>
)
const Title: React.FC<{ tag: string; tagBg: string; tagColor?: string; title: string; dark?: boolean }> = ({ tag, tagBg, tagColor = INK, title, dark }) => (
  <>
    <span style={eyebrow(tagBg, tagColor)}>{tag}</span>
    {title && <div style={{ ...d('clamp(26px,3.2vw,40px)', dark ? CREMA : INK), margin: '14px 0 22px' }}>{title}</div>}
  </>
)

function Spark({ serie, color = INK }: { serie: number[]; color?: string }) {
  if (!serie || serie.length < 2) return null
  const w = 240, h = 54, max = Math.max(1, ...serie), step = w / (serie.length - 1)
  const path = serie.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(h - (v / max) * h).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: 240, maxWidth: '100%', height: 54 }} preserveAspectRatio="none">
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={`${color}22`} />
      <path d={path} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
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
  const DI = 'Datos insuf.'

  // canal más rentable por € netos / pedido (mejora 14)
  const canalRent = p.canalStats.filter(c => c.pedidos > 0).map(c => ({ id: c.id, np: c.neto / c.pedidos })).sort((a, b) => b.np - a.np)[0]?.id

  // frases por impacto € (mejora 15), reutilizadas en varias cards
  const frase = elegirFrase(p.metricas)
  const fraseCostes = elegirFrase(p.metricas, 'costes')
  const mostrarCostes = fraseCostes.lead !== 'Comer bien'

  // franja de alertas accionables (mejora 7)
  const m = p.metricas
  const alertas: Array<{ t: string; c: string }> = []
  if (m.variacionVentas != null && m.variacionVentas < -3) alertas.push({ t: `Ventas ${DELTA(m.variacionVentas)} vs media`, c: ROSA })
  if (m.primeCostPct > 65) alertas.push({ t: `Prime cost ${PC(m.primeCostPct)}`, c: NAR })
  if (m.faltaPE > 0 && m.pePctProgreso < 70) alertas.push({ t: `Faltan ${E0(m.faltaPE)} para cubrir gastos`, c: NAR })
  if (m.ratioGap < 0) alertas.push({ t: `Ratio ${m.ratioActual.toFixed(2)}× bajo objetivo`, c: NAR })
  if (m.webPct < 10) alertas.push({ t: `Web solo ${PC(m.webPct)} de ventas`, c: AZUL })
  if (diaFlojo) alertas.push({ t: `Día flojo: ${diaFlojo.nombre} ${E0(diaFlojo.valor)}`, c: AZUL })

  const objetivos: Array<{ k: 'semanal' | 'mensual' | 'anual'; lbl: string; real: number; obj: number }> = [
    { k: 'semanal', lbl: `${p.semanaLabel} · ${p.semanaRango}`, real: p.ventasSemana, obj: p.objetivos.semanal },
    { k: 'mensual', lbl: p.mesLabel, real: p.ventasMes, obj: p.objetivos.mensual },
    { k: 'anual', lbl: String(p.anoLabel), real: p.ventasAno, obj: p.objetivos.anual },
  ]
  const grupos: Array<{ k: GrupoGasto; lbl: string; sub: string; obj: number }> = [
    { k: 'producto', lbl: 'Producto', sub: 'COGS · Food cost', obj: 30 },
    { k: 'equipo', lbl: 'Equipo', sub: 'Labor', obj: 40 },
    { k: 'local', lbl: 'Local', sub: 'Occupancy', obj: 15 },
    { k: 'controlables', lbl: 'Controlables', sub: 'Opex', obj: 15 },
  ]
  const pnl: Array<[string, string, string, boolean]> = [
    ['Facturación', E2(p.ventasPeriodo), CREMA, false],
    ['Ingresos netos', E2(p.netoEstimado), CREMA, false],
    ['Producto · COGS', p.grupos.producto.gasto > 0 ? '−' + E2(p.grupos.producto.gasto) : DI, p.grupos.producto.gasto > 0 ? NAR_CL : '#8a8275', false],
    ['Margen bruto', E2(margenBruto), AMA, true],
    ['Equipo · Labor', p.grupos.equipo.gasto > 0 ? '−' + E2(p.grupos.equipo.gasto) : DI, p.grupos.equipo.gasto > 0 ? NAR_CL : '#8a8275', false],
    ['Local · Occupancy', p.grupos.local.gasto > 0 ? '−' + E2(p.grupos.local.gasto) : DI, p.grupos.local.gasto > 0 ? NAR_CL : '#8a8275', false],
    ['Controlables · Opex', p.grupos.controlables.gasto > 0 ? '−' + E2(p.grupos.controlables.gasto) : DI, p.grupos.controlables.gasto > 0 ? NAR_CL : '#8a8275', false],
    ['Resultado neto', E2(resultadoNetoPL), resultadoNetoPL >= 0 ? VERDE_CL : '#ff8f9f', true],
  ]
  const desv = [
    { v: DELTA(p.variacionVentas), l: 'ventas vs media', c: p.variacionVentas != null && p.variacionVentas < 0 ? ROSA : VERDE, big: true },
    { v: DELTA(p.variacionPedidos), l: 'pedidos vs media', c: p.variacionPedidos != null && p.variacionPedidos < 0 ? ROSA : VERDE, big: true },
    { v: DELTA(p.variacionTM), l: 'ticket vs media', c: p.variacionTM != null && p.variacionTM < 0 ? ROSA : VERDE, big: true },
    { v: E0(p.ebitda), l: 'resultado', c: p.ebitda >= 0 ? VERDE : ROSA, big: false },
  ]

  return (
    <div style={{ background: CREMA, fontFamily: LEX, color: INK, border: `4px solid ${INK}`, marginTop: 4 }}>
      {p.datosDemo && <div style={{ background: AMA, borderBottom: `4px solid ${INK}`, padding: `8px ${PAD}`, fontFamily: OSW, letterSpacing: '1px', fontSize: 13, textTransform: 'uppercase' }}>Datos demo · BD vacía o sin datos en este periodo</div>}

      {/* 1 · HERO */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', borderBottom: `4px solid ${INK}`, background: AMA }}>
        <div style={{ padding: `42px ${PAD} 40px`, borderRight: `4px solid ${INK}` }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={eyebrow('#fff')}>Comer bien. Aquí y ahora.</span>
            {p.periodoLabel && <span style={{ ...eyebrow(INK, AMA), fontSize: 12 }}>{p.periodoLabel}</span>}
          </div>
          <div style={{ ...d('clamp(32px,4.2vw,56px)'), margin: '16px 0 16px', maxWidth: 600 }}>{p.pedidosPeriodo > 0 ? `Has entregado ${INT(p.pedidosPeriodo)} pedidos.` : 'Aún no hay pedidos entregados.'}</div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Facturación bruta</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
                <div style={d('clamp(44px,6.8vw,92px)')}>{E0(p.ventasPeriodo)}</div>
                {p.variacionVentas != null && <div style={{ ...eyebrow(p.variacionVentas >= 0 ? VERDE : ROSA, '#fff'), fontSize: 18, padding: '7px 12px', marginBottom: 10 }}>{DELTA(p.variacionVentas)}</div>}
              </div>
            </div>
            <div style={{ marginBottom: 4 }}><Spark serie={p.serie} color={INK} /></div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 12, background: VERDE, color: '#fff', border: `3px solid ${INK}`, padding: '8px 16px', marginTop: 16 }}>
            <span style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Neto estimado</span>
            <span style={d('clamp(24px,3.4vw,40px)', '#fff')}>{E0(p.netoEstimado)}</span>
            <span style={{ fontFamily: OSW, fontSize: 15, fontWeight: 600 }}>{PC2(netoPct)} s/ bruto</span>
          </div>
        </div>
        <div style={{ background: CLARO, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
          <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: `10px 10px 0 ${INK}`, padding: '26px 28px', width: '100%', maxWidth: 380 }}>
            <div style={{ ...d('17px'), borderBottom: `2px dashed ${INK}`, paddingBottom: 12, marginBottom: 4 }}>· Resumen del periodo ·</div>
            {[['Ticket bruto', TK(p.tmBruto)], ['Ticket neto', TK(p.tmNeto)], ['EBITDA', E0(p.ebitda)], ['Margen', PC(p.ebitdaPct)]].map(([l, v], i) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '13px 0', borderBottom: i < 3 ? `1px dotted ${INK}55` : 'none' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{l}</span>
                <span style={d('clamp(22px,3vw,30px)', i === 2 ? (p.ebitda >= 0 ? VERDE : ROSA) : INK)}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2 · ALERTAS accionables */}
      <section style={{ background: CLARO, borderBottom: `4px solid ${INK}`, padding: `18px ${PAD}`, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ ...d('16px'), marginRight: 4 }}>Atención →</span>
        {alertas.length === 0
          ? <span style={{ ...eyebrow(VERDE, '#fff'), fontSize: 13 }}>Todo en orden</span>
          : alertas.slice(0, 4).map((a, i) => (
            <span key={i} style={{ display: 'inline-block', background: '#fff', border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${a.c}`, fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '6px 12px' }}>{a.t}</span>
          ))}
      </section>

      {/* 3 · DESVIACIONES (recuperado: pedidos/ticket) */}
      <section style={{ background: CREMA, borderBottom: `4px solid ${INK}`, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
        {desv.map((x, i) => (
          <div key={i} style={{ padding: '24px 22px', borderRight: i < 3 ? `2px solid ${INK}22` : 'none' }}>
            <div style={d(x.big ? 'clamp(30px,4.4vw,52px)' : 'clamp(24px,3.2vw,40px)', x.c)}>{x.v}</div>
            <div style={{ fontFamily: OSW, letterSpacing: '1.5px', fontSize: 12.5, color: '#6b5d45', textTransform: 'uppercase', marginTop: 6 }}>{x.l}</div>
          </div>
        ))}
      </section>

      {/* 4 · FRASE INSIGHT general (por impacto €) */}
      <section style={{ background: ROSA, color: '#fff', padding: `46px ${PAD}`, borderBottom: `4px solid ${INK}` }}>
        <div style={{ ...d('clamp(28px,4.4vw,54px)', '#fff'), maxWidth: 1000 }}>{frase.lead} <span style={{ background: '#fff', color: ROSA, padding: '0 10px' }}>{frase.mark}</span> {frase.tail}</div>
        <div style={{ fontSize: 'clamp(16px,1.9vw,21px)', fontWeight: 600, marginTop: 18, maxWidth: 820 }}>{frase.sub}</div>
      </section>

      {/* 5 · CANALES unificado (+ rentabilidad por pedido) */}
      <Sec>
        <Title tag="Por dónde entra el hambre" tagBg={AMA} title="Cada canal: peso, bruto, neto, margen, pedidos, ticket y € que te deja por pedido." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {p.canalStats.map(c => (
            <div key={c.id} style={{ border: `3px solid ${INK}`, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: 40, borderBottom: `2px solid ${INK}18` }}>
                <div style={{ width: `${Math.max(c.pct, 8)}%`, height: '100%', background: c.color, display: 'flex', alignItems: 'center', paddingLeft: 14, minWidth: 120 }}>
                  <span style={d('16px', '#fff')}>{c.label}</span>
                </div>
                <span style={{ ...d('20px'), marginLeft: 14 }}>{PC(c.pct)}</span>
                {c.id === canalRent && <span style={{ ...eyebrow(VERDE, '#fff'), fontSize: 11, marginLeft: 'auto', marginRight: 12 }}>+ rentable</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', padding: '10px 14px', gap: 6 }}>
                {[['Bruto', E0(c.bruto), INK], ['Neto', E0(c.neto), VERDE], ['Margen', PC2(c.margen), INK], ['Pedidos', INT(c.pedidos), INK], ['Ticket', c.pedidos > 0 ? TK(c.ticket) : '—', AZUL], ['€/ped neto', c.pedidos > 0 ? TK(c.neto / c.pedidos) : '—', VERDE]].map(([l, v, col]) => (
                  <div key={l as string}>
                    <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '0.8px', textTransform: 'uppercase', opacity: 0.55 }}>{l}</div>
                    <div style={d('clamp(15px,1.8vw,20px)', col as string)}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Sec>

      {/* 6 · RESULTADO + P&L + GRUPOS (oscuro suave) */}
      <section style={{ background: OSC, color: CREMA, padding: `44px ${PAD}`, borderBottom: `4px solid ${INK}` }}>
        <Title tag="Resultado del periodo" tagBg={VERDE} tagColor="#fff" title="" dark />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
          <div style={d('clamp(48px,8vw,92px)', p.ebitda >= 0 ? VERDE_CL : '#ff8f9f')}>{E0(p.ebitda)}</div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ ...eyebrow(p.ebitda >= 0 ? VERDE : ROSA, '#fff') }}>EBITDA {PC(p.ebitdaPct)}</div>
            <div style={{ ...d('clamp(22px,3vw,34px)', p.primeCostPct <= 60 ? VERDE_CL : NAR_CL), marginTop: 12 }}>Prime cost {PC2(p.primeCostPct)}</div>
            <div style={{ fontFamily: OSW, fontSize: 13.5, letterSpacing: '1px', color: '#b8ad97', textTransform: 'uppercase' }}>objetivo: máx. 60% de los ingresos</div>
          </div>
        </div>
        {mostrarCostes && <div style={{ borderLeft: `3px solid ${AMA}`, paddingLeft: 14, marginBottom: 22, fontSize: 16, color: '#e7dcc6', maxWidth: 820 }}><b style={{ color: AMA }}>{fraseCostes.mark}</b> — {fraseCostes.sub}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 22 }}>
          <div style={{ border: `2px solid #ffffff22` }}>
            {pnl.map(([l, v, c, bold], i) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '13px 16px', borderTop: i > 0 ? `1px solid #ffffff14` : 'none', background: bold ? '#ffffff0d' : 'transparent' }}>
                <span style={{ fontSize: 15, fontWeight: bold ? 700 : 500, color: bold ? CREMA : '#cfc7b6' }}>{l}</span>
                <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: bold ? 24 : 19, color: c, letterSpacing: '-0.5px' }}>{v}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontFamily: OSW, fontSize: 14, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#b8ad97', marginBottom: 12 }}>Grupos de gasto · consumo vs presupuesto</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {grupos.map(g => {
                const gd = p.grupos[g.k]
                return (
                  <div key={g.k} style={{ border: `2px solid #ffffff22`, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: OSW, fontSize: 16, letterSpacing: '0.5px', textTransform: 'uppercase', color: CREMA }}>{g.lbl} <span style={{ fontSize: 12, color: '#9c917b' }}>{g.sub}</span></span>
                      <span style={d('clamp(20px,2.4vw,26px)', CREMA)}>{gd.gasto > 0 ? E0(gd.gasto) : DI}</span>
                    </div>
                    <div style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600, color: '#cfc7b6', marginTop: 6 }}>{Math.round(gd.pctSobreNetos)}% s/ neto · objetivo {g.obj}% · pres. <span style={{ color: AMA, fontFamily: OSW, fontSize: 18 }}><Edit value={gd.presupuesto} onSave={v => p.onSavePresupuestoGrupo(g.k, v)} color={AMA} /></span></div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 7 · OBJETIVOS (semáforo · inline mismo tamaño · diario opcional) */}
      <Sec bg="#fff">
        <Title tag="Tus objetivos" tagBg={VERDE} tagColor="#fff" title="Cómo vas frente a lo que te marcaste. Toca el objetivo para cambiarlo." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {p.diario && (() => {
            const prog = p.diario!.objetivo > 0 ? (p.diario!.real / p.diario!.objetivo) * 100 : 0
            const faltan = Math.max(0, p.diario!.objetivo - p.diario!.real)
            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <span style={d('22px')}>Hoy · {INT(p.diario!.real)} <span style={d('22px', semaforo(prog))}>{PC(prog)}</span></span>
                  <span style={d('20px')}>Faltan <span style={{ color: semaforo(prog) }}>{INT(faltan)}</span> de objetivo <span style={d('20px')}>{INT(p.diario!.objetivo)}</span></span>
                </div>
                <div style={{ height: 18, border: `3px solid ${INK}`, background: '#fff' }}><div style={{ width: `${Math.min(100, prog)}%`, height: '100%', background: semaforo(prog) }} /></div>
              </div>
            )
          })()}
          {objetivos.map(o => {
            const prog = o.obj > 0 ? (o.real / o.obj) * 100 : 0
            const faltan = Math.max(0, o.obj - o.real)
            return (
              <div key={o.k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <span style={d('22px')}>{o.lbl} · {INT(o.real)} <span style={d('22px', semaforo(prog))}>{PC(prog)}</span></span>
                  <span style={d('20px')}>Faltan <span style={{ color: semaforo(prog) }}>{INT(faltan)}</span> de objetivo <Edit value={o.obj} onSave={v => p.onSaveObjetivoVenta(o.k, v)} suffix="" /></span>
                </div>
                <div style={{ height: 16, border: `3px solid ${INK}`, background: '#fff' }}><div style={{ width: `${Math.min(100, prog)}%`, height: '100%', background: semaforo(prog) }} /></div>
              </div>
            )
          })}
        </div>
      </Sec>

      {/* 8 · DÍAS PICO (66) + PROYECCIONES (33) */}
      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `44px ${PAD}`, borderRight: `4px solid ${INK}`, background: CREMA }}>
          <Title tag={`Días pico · ${p.mesLabel}`} tagBg={AZUL} tagColor="#fff" title={`Facturación bruta por día. Media ${E0(p.mediaDiariaPico)}.`} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150, marginBottom: 16 }}>
            {p.diasPico.map(x => (
              <button key={x.idx} onClick={() => p.onFiltrarDiaSemana?.(x.idx)} title={E0(x.valor)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ fontFamily: OSW, fontSize: 12, fontWeight: 600 }}>{x.valor > 0 ? E0(x.valor) : ''}</span>
                <div style={{ width: '100%', height: `${(x.valor / maxDia) * 96}px`, minHeight: 4, background: x.color, border: `3px solid ${INK}` }} />
                <span style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase' }}>{x.nombre}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontFamily: LEX, fontSize: 14.5, fontWeight: 600 }}>
            <span>Más fuerte · <b>{diaFuerte ? `${diaFuerte.nombre} ${E0(diaFuerte.valor)}` : '—'}</b></span>
            <span>Más flojo · <b>{diaFlojo ? `${diaFlojo.nombre} ${E0(diaFlojo.valor)}` : '—'}</b></span>
          </div>
        </div>
        <div style={{ padding: `44px ${PAD}`, background: AMA }}>
          <span style={eyebrow('#fff')}>Proyecciones</span>
          <div style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.65, marginTop: 16 }}>Saldo estimado</div>
          <div style={d('clamp(30px,4vw,44px)')}>{p.saldo.saldoHoy > 0 ? E0(p.saldo.saldoHoy) : '—'}</div>
          <div style={{ fontFamily: LEX, fontSize: 14.5, fontWeight: 600, lineHeight: 2, marginTop: 12 }}>
            <div>Cobros 7 d · <b>{E0(p.saldo.cobros7d)}</b></div>
            <div>Cobros 30 d · <b>{E0(p.saldo.cobros30d)}</b></div>
            <div>Pagos 7 d · <b>{E0(p.saldo.pagos7d)}</b></div>
            <div>Pagos 30 d · <b>{E0(p.saldo.pagos30d)}</b></div>
          </div>
        </div>
      </section>

      {/* 9 · RATIO + PE (claro, 2 col) */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `40px ${PAD}`, borderRight: `4px solid ${INK}`, background: CREMA }}>
          <span style={eyebrow(VERDE, '#fff')}>Ratio ingresos / gastos</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, margin: '14px 0 10px' }}>
            <div style={d('clamp(40px,6vw,68px)', p.ratioActual >= p.objetivoRatio ? VERDE : NAR)}>{(Number.isFinite(p.ratioActual) ? p.ratioActual : 0).toFixed(2)}×</div>
            <div style={d('20px')}>objetivo <Edit value={p.objetivoRatio} onSave={p.onSaveObjetivoRatio} suffix="×" /></div>
          </div>
          <div style={{ height: 14, border: `3px solid ${INK}`, background: '#fff' }}><div style={{ width: `${Math.min(100, p.objetivoRatio > 0 ? (p.ratioActual / p.objetivoRatio) * 100 : 0)}%`, height: '100%', background: p.ratioActual >= p.objetivoRatio ? VERDE : NAR }} /></div>
          <div style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600, lineHeight: 2, marginTop: 12 }}>
            <div>Ingresos netos · <b>{E0(p.netosReales || p.netoEstimado)}</b></div>
            <div>Gastos fijos · <b>{E0(p.gastosFijosMes)}</b></div>
            <div>Gastos reales · <b>{E0(p.gastosReales)}</b></div>
          </div>
        </div>
        <div style={{ padding: `40px ${PAD}`, background: CLARO }}>
          <span style={eyebrow('#fff')}>Punto de equilibrio</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, margin: '14px 0 10px' }}>
            <div style={d('clamp(40px,6vw,68px)')}>{E0(p.pe.peBruto)}</div>
            <div style={{ ...eyebrow(p.pe.pctProgreso >= 100 ? VERDE : NAR, '#fff'), marginBottom: 12 }}>{PC(p.pe.pctProgreso)}</div>
          </div>
          <div style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.6 }}>bruto necesario este mes</div>
          <div style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600, lineHeight: 2, marginTop: 10 }}>
            <div>Llevamos · <b>{E0(p.pe.acumulado)}</b></div>
            <div>Faltan · <b style={{ color: p.pe.faltan > 0 ? NAR : VERDE }}>{E0(p.pe.faltan)}</b></div>
            <div>Día verde · <b>{p.pe.diaVerdeEstimado ? `${p.pe.diaVerdeEstimado.fecha} ${p.pe.diaVerdeEstimado.diaSemana}` : '—'}</b></div>
            <div>Realidad · <b>{E0(p.pe.realFacDia)}/día · {INT(p.pe.realPedDia)} ped</b></div>
          </div>
        </div>
      </section>

      {/* 10 · TOP (1.3) + PROVISIONES (1) */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `36px ${PAD}`, borderRight: `4px solid ${INK}`, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <span style={eyebrow(VERDE, '#fff')}>Top ventas</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['productos', 'modificadores'] as const).map(t => (
                <button key={t} onClick={() => p.onTopTab(t)} style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', padding: '5px 12px', cursor: 'pointer', border: `2px solid ${INK}`, background: p.topTab === t ? INK : '#fff', color: p.topTab === t ? '#fff' : INK }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            {p.topItems.length === 0 || p.topDatosDemo
              ? <div style={{ fontFamily: OSW, letterSpacing: '1px', opacity: 0.5, padding: '20px 0' }}>Sin datos POS de {p.topTab} en el periodo.</div>
              : p.topItems.slice(0, 6).map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderTop: i === 0 ? `3px solid ${INK}` : `2px solid ${INK}18` }}>
                  <span style={{ ...d('clamp(20px,3vw,30px)', i === 0 ? ROSA : INK), width: 44 }}>{String(t.ranking ?? i + 1).padStart(2, '0')}</span>
                  <span style={{ fontFamily: LEX, fontWeight: 600, fontSize: 15, flex: 1 }}>{t.producto}</span>
                  <span style={{ fontFamily: LEX, fontSize: 13, opacity: 0.6 }}>{INT(t.pedidos)} ped</span>
                  <span style={d('clamp(16px,2.2vw,24px)')}>{E0(t.importe)}</span>
                </div>
              ))}
          </div>
        </div>
        <div style={{ padding: `36px ${PAD}`, background: CLARO }}>
          <span style={eyebrow('#fff')}>Provisiones y próximos pagos</span>
          <div style={{ ...d('clamp(30px,4vw,44px)', NAR), margin: '12px 0 12px' }}>{E0(p.provisiones.totalAGuardar)}</div>
          <div style={{ fontFamily: LEX, fontSize: 14.5, fontWeight: 600, lineHeight: 1.9 }}>
            <div>IVA · <b>{E0(p.provisiones.provIVA)}</b></div>
            <div>IRPF · <b>{E0(p.provisiones.provIRPF)}</b></div>
          </div>
          {p.provisiones.proximosPagos.length > 0 && <>
            <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.6, margin: '14px 0 8px' }}>Próximos pagos</div>
            {p.provisiones.proximosPagos.slice(0, 6).map((x, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEX, fontSize: 14, fontWeight: 600, padding: '4px 0' }}><span>{x.concepto}</span><span>{E0(x.importe)}</span></div>
            ))}
          </>}
        </div>
      </section>

      {/* 11 · FOOTER MARCA (oscuro suave) */}
      <section style={{ background: OSC, color: CREMA, padding: PAD, textAlign: 'center' }}>
        <div style={d('clamp(34px,6vw,72px)', CREMA)}>Binagre es hogar.</div>
        <div style={{ fontFamily: OSW, letterSpacing: '6px', fontSize: 15, color: AMA, marginTop: 12, textTransform: 'uppercase' }}>Comer bien. Aquí y ahora.</div>
      </section>
    </div>
  )
}
