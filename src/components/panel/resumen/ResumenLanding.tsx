/**
 * ResumenLanding v2 — pestaña Resumen del Panel Global con look "landing" y la
 * densidad informativa completa, reorganizada como RESUMEN GENERAL con highlights.
 * Reglas aplicadas: separadores de miles en todo; ticket SIEMPRE sin €; neto
 * destacado; canales unificados (bruto+neto+margen+pedidos+ticket en un solo
 * sitio); P&L + grupos de gasto juntos sobre fondo oscuro; objetivos con
 * semáforo y línea diaria opcional; frase-insight dinámica (sin botón); layout
 * no lineal (66/33) y fondos variados (claro/oscuro/color). No calcula nada.
 */
import { useState } from 'react'
import type { CanalStat, ObjetivosVentas, PagoProximoItem, TopVentaItem } from './types'
import type { GrupoGasto } from './ColGruposGasto'
import type { DiaPico } from './ColDiasPico'
import type { FraseInsight } from './frasesInsight'

const INK = '#140f08'
const CREMA = '#FCEFD6'
const ROSA = '#FF2E63'
const AMA = '#FFC400'
const VERDE = '#0FB86B'
const NAR = '#FF6A1A'
const AZUL = '#2D5BFF'
const CLARO = '#F3D9A8'
const OSW = "'Oswald', sans-serif"
const LEX = "'Lexend', sans-serif"
const PAD = '40px'

const d = (size: string, color = INK): React.CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color })
const eyebrow = (bg: string, color = INK): React.CSSProperties => ({ display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 12px' })

const E0 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
const E2 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const TK = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) // ticket: SIN €
const INT = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })
const PC = (n: number) => Math.round(Number.isFinite(n) ? n : 0) + '%'
const PC2 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
const DELTA = (v: number | null) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%')
const semaforo = (pct: number) => (pct > 50 ? VERDE : NAR)

interface GrupoData { gasto: number; presupuesto: number; pctSobreNetos: number }

interface Props {
  datosDemo: boolean
  semanaLabel: string
  semanaRango: string
  mesLabel: string
  anoLabel: number
  ventasPeriodo: number
  netoEstimado: number
  variacionVentas: number | null
  pedidosPeriodo: number
  tmBruto: number
  tmNeto: number
  variacionPedidos: number | null
  variacionTM: number | null
  ebitda: number
  ebitdaPct: number
  primeCostPct: number
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
  frase: FraseInsight
  onSaveObjetivoVenta: (tipo: 'semanal' | 'mensual' | 'anual', valor: number | null) => void
  onSaveObjetivoRatio: (valor: number | null) => void
  onSavePresupuestoGrupo: (grupo: GrupoGasto, valor: number | null) => void
  onFiltrarDiaSemana?: (idx: number) => void
}

/* editable con la MISMA tipografía que las cifras (Oswald), marcado con subrayado punteado */
function Edit({ value, onSave, suffix = ' €', color = INK }: { value: number; onSave: (v: number | null) => void; suffix?: string; color?: string }) {
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState(String(Math.round(value)))
  if (!edit) return <button onClick={() => { setVal(String(Math.round(value))); setEdit(true) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: OSW, fontWeight: 700, fontSize: 'inherit', color, textDecoration: 'underline dotted', textUnderlineOffset: 3, padding: 0, letterSpacing: '-0.5px' }}>{value > 0 ? INT(value) + suffix : 'fijar'}</button>
  const commit = () => { const n = parseFloat(val.replace(',', '.')); onSave(Number.isFinite(n) ? n : null); setEdit(false) }
  return <input autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEdit(false) }} style={{ width: 120, fontFamily: OSW, fontWeight: 700, fontSize: 'inherit', border: `2px solid ${INK}`, padding: '0 6px', background: '#fff', color: INK }} />
}

const Sec: React.FC<{ children: React.ReactNode; bg?: string; pad?: string; dark?: boolean }> = ({ children, bg = CREMA, pad = `44px ${PAD}` }) => (
  <section style={{ background: bg, padding: pad, borderBottom: `4px solid ${INK}` }}>{children}</section>
)
const Head: React.FC<{ tag: string; tagBg: string; tagColor?: string; title: string; dark?: boolean }> = ({ tag, tagBg, tagColor = INK, title, dark }) => (
  <>
    <span style={eyebrow(tagBg, tagColor)}>{tag}</span>
    {title && <div style={{ ...d('clamp(26px,3.2vw,40px)', dark ? CREMA : INK), margin: '14px 0 22px' }}>{title}</div>}
  </>
)

export default function ResumenLanding(p: Props) {
  const netoPct = p.ventasPeriodo > 0 ? (p.netoEstimado / p.ventasPeriodo) * 100 : 0
  const comisionPct = p.ventasPeriodo > 0 ? (1 - p.netoEstimado / p.ventasPeriodo) * 100 : 0
  const maxDia = Math.max(1, ...p.diasPico.map(x => x.valor))
  const diasConV = p.diasPico.filter(x => x.valor > 0)
  const diaFuerte = diasConV.length ? diasConV.reduce((a, x) => x.valor > a.valor ? x : a) : null
  const diaFlojo = diasConV.length ? diasConV.reduce((a, x) => x.valor < a.valor ? x : a) : null
  const margenBruto = p.netoEstimado - p.grupos.producto.gasto
  const resultadoNetoPL = p.netoEstimado - (p.grupos.producto.gasto + p.grupos.equipo.gasto + p.grupos.local.gasto + p.grupos.controlables.gasto)
  const DI = 'Datos insuf.'

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
    ['Producto · COGS', p.grupos.producto.gasto > 0 ? '−' + E2(p.grupos.producto.gasto) : DI, p.grupos.producto.gasto > 0 ? '#ff8f6a' : '#8a8275', false],
    ['Margen bruto', E2(margenBruto), AMA, true],
    ['Equipo · Labor', p.grupos.equipo.gasto > 0 ? '−' + E2(p.grupos.equipo.gasto) : DI, p.grupos.equipo.gasto > 0 ? '#ff8f6a' : '#8a8275', false],
    ['Local · Occupancy', p.grupos.local.gasto > 0 ? '−' + E2(p.grupos.local.gasto) : DI, p.grupos.local.gasto > 0 ? '#ff8f6a' : '#8a8275', false],
    ['Controlables · Opex', p.grupos.controlables.gasto > 0 ? '−' + E2(p.grupos.controlables.gasto) : DI, p.grupos.controlables.gasto > 0 ? '#ff8f6a' : '#8a8275', false],
    ['Resultado neto', E2(resultadoNetoPL), resultadoNetoPL >= 0 ? '#3ff0a0' : '#ff8f9f', true],
  ]

  return (
    <div style={{ background: CREMA, fontFamily: LEX, color: INK, border: `4px solid ${INK}`, marginTop: 4 }}>
      {p.datosDemo && <div style={{ background: AMA, borderBottom: `4px solid ${INK}`, padding: `8px ${PAD}`, fontFamily: OSW, letterSpacing: '1px', fontSize: 13, textTransform: 'uppercase' }}>Datos demo · BD vacía o sin datos en este periodo</div>}

      {/* 1 · HERO */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', borderBottom: `4px solid ${INK}`, background: AMA }}>
        <div style={{ padding: `46px ${PAD} 42px`, borderRight: `4px solid ${INK}` }}>
          <span style={eyebrow('#fff')}>Comer bien. Aquí y ahora.</span>
          <div style={{ ...d('clamp(34px,4.4vw,58px)'), margin: '16px 0 18px', maxWidth: 600 }}>{p.pedidosPeriodo > 0 ? `Has entregado ${INT(p.pedidosPeriodo)} pedidos.` : 'Aún no hay pedidos entregados.'}</div>
          <div style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Facturación bruta</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginTop: 2 }}>
            <div style={d('clamp(46px,7.2vw,96px)')}>{E0(p.ventasPeriodo)}</div>
            {p.variacionVentas != null && <div style={{ ...eyebrow(p.variacionVentas >= 0 ? VERDE : ROSA, '#fff'), fontSize: 19, padding: '8px 14px', marginBottom: 12 }}>{DELTA(p.variacionVentas)}</div>}
          </div>
          {/* neto destacado */}
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

      {/* 2 · HIGHLIGHTS (oscuro) */}
      <section style={{ background: INK, borderBottom: `4px solid ${INK}`, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[
          { v: DELTA(p.variacionVentas), l: 'vs periodo anterior', c: p.variacionVentas != null && p.variacionVentas < 0 ? ROSA : VERDE, big: true },
          { v: TK(p.tmBruto), l: 'ticket medio', c: AMA, big: false },
          { v: PC(p.ventasPeriodo > 0 ? (p.netoEstimado / p.ventasPeriodo) * 100 : 0), l: 'margen neto', c: ROSA, big: false },
          { v: E0(p.ebitda), l: 'resultado', c: p.ebitda >= 0 ? VERDE : ROSA, big: false },
        ].map((x, i) => (
          <div key={i} style={{ padding: '26px 22px', borderRight: i < 3 ? '1px solid #3a342a' : 'none' }}>
            <div style={d(x.big ? 'clamp(30px,4.4vw,52px)' : 'clamp(24px,3.2vw,40px)', x.c)}>{x.v}</div>
            <div style={{ fontFamily: OSW, letterSpacing: '1.5px', fontSize: 12, color: '#9b9384', textTransform: 'uppercase', marginTop: 6 }}>{x.l}</div>
          </div>
        ))}
      </section>

      {/* 3 · FRASE INSIGHT dinámica (sin botón) */}
      <section style={{ background: ROSA, color: '#fff', padding: `48px ${PAD}`, borderBottom: `4px solid ${INK}` }}>
        <div style={{ ...d('clamp(28px,4.4vw,54px)', '#fff'), maxWidth: 1000 }}>{p.frase.lead} <span style={{ background: '#fff', color: ROSA, padding: '0 10px' }}>{p.frase.mark}</span> {p.frase.tail}</div>
        <div style={{ fontSize: 'clamp(16px,1.9vw,21px)', fontWeight: 600, marginTop: 18, maxWidth: 820 }}>{p.frase.sub}</div>
      </section>

      {/* 4 · CANALES UNIFICADO (bruto + neto + margen + pedidos + ticket) */}
      <Sec>
        <Head tag="Por dónde entra el hambre" tagBg={AMA} title="Cada canal: peso, bruto, neto, margen, pedidos y ticket." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {p.canalStats.map(c => (
            <div key={c.id} style={{ border: `3px solid ${INK}`, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: 40, borderBottom: `2px solid ${INK}18` }}>
                <div style={{ width: `${Math.max(c.pct, 8)}%`, height: '100%', background: c.color, display: 'flex', alignItems: 'center', paddingLeft: 14, minWidth: 120 }}>
                  <span style={d('16px', '#fff')}>{c.label}</span>
                </div>
                <span style={{ ...d('20px'), marginLeft: 14 }}>{PC(c.pct)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', padding: '10px 14px', gap: 6 }}>
                {[['Bruto', E0(c.bruto), INK], ['Neto', E0(c.neto), VERDE], ['Margen', PC2(c.margen), INK], ['Pedidos', INT(c.pedidos), INK], ['Ticket', c.pedidos > 0 ? TK(c.ticket) : '—', AZUL]].map(([l, v, col]) => (
                  <div key={l as string}>
                    <div style={{ fontFamily: OSW, fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.55 }}>{l}</div>
                    <div style={d('clamp(15px,1.8vw,20px)', col as string)}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Sec>

      {/* 5 · RESULTADO + P&L + GRUPOS DE GASTO (oscuro, unificado) */}
      <section style={{ background: INK, color: CREMA, padding: `44px ${PAD}`, borderBottom: `4px solid ${INK}` }}>
        <Head tag="Resultado del periodo" tagBg={VERDE} tagColor="#fff" title="" dark />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
          <div style={d('clamp(48px,8vw,92px)', p.ebitda >= 0 ? '#3ff0a0' : '#ff8f9f')}>{E0(p.ebitda)}</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ ...eyebrow(p.ebitda >= 0 ? VERDE : ROSA, '#fff') }}>EBITDA {PC(p.ebitdaPct)}</div>
            <div style={{ ...d('clamp(20px,2.6vw,30px)', p.primeCostPct <= 60 ? '#3ff0a0' : '#ffb27a'), marginTop: 10 }}>Prime cost {PC2(p.primeCostPct)}</div>
            <div style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', color: '#9b9384', textTransform: 'uppercase' }}>objetivo 60% de los ingresos</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 22 }}>
          {/* P&L */}
          <div style={{ border: `2px solid #ffffff22` }}>
            {pnl.map(([l, v, c, bold], i) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 16px', borderTop: i > 0 ? `1px solid #ffffff14` : 'none', background: bold ? '#ffffff0d' : 'transparent' }}>
                <span style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color: bold ? CREMA : '#cfc7b6' }}>{l}</span>
                <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: bold ? 23 : 18, color: c, letterSpacing: '-0.5px' }}>{v}</span>
              </div>
            ))}
          </div>
          {/* grupos de gasto */}
          <div>
            <div style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#9b9384', marginBottom: 12 }}>Grupos de gasto · consumo vs presupuesto</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {grupos.map(g => {
                const gd = p.grupos[g.k]
                return (
                  <div key={g.k} style={{ border: `2px solid #ffffff22`, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: OSW, fontSize: 15, letterSpacing: '0.5px', textTransform: 'uppercase', color: CREMA }}>{g.lbl} <span style={{ fontSize: 11, color: '#8a8275' }}>{g.sub}</span></span>
                      <span style={d('clamp(18px,2.2vw,24px)', CREMA)}>{gd.gasto > 0 ? E0(gd.gasto) : DI}</span>
                    </div>
                    <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, color: '#cfc7b6', marginTop: 6 }}>{Math.round(gd.pctSobreNetos)}% s/ neto · objetivo {g.obj}% · pres. <span style={{ color: AMA }}><Edit value={gd.presupuesto} onSave={v => p.onSavePresupuestoGrupo(g.k, v)} color={AMA} /></span></div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 6 · OBJETIVOS (semáforo, línea diaria opcional) */}
      <Sec bg="#fff">
        <Head tag="Tus objetivos" tagBg={VERDE} tagColor="#fff" title="Cómo vas frente a lo que te marcaste. Toca el objetivo para cambiarlo." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {p.diario && (() => {
            const prog = p.diario!.objetivo > 0 ? (p.diario!.real / p.diario!.objetivo) * 100 : 0
            const faltan = Math.max(0, p.diario!.objetivo - p.diario!.real)
            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <span style={d('22px')}>Hoy · {INT(p.diario!.real)} <span style={d('22px', semaforo(prog))}>{PC(prog)}</span></span>
                  <span style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600 }}>Faltan <span style={d('20px', semaforo(prog))}>{INT(faltan)}</span> de objetivo <span style={d('20px')}>{INT(p.diario!.objetivo)}</span></span>
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
                  <span style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600 }}>Faltan <span style={d('20px', semaforo(prog))}>{INT(faltan)}</span> de objetivo <Edit value={o.obj} onSave={v => p.onSaveObjetivoVenta(o.k, v)} suffix="" /></span>
                </div>
                <div style={{ height: 16, border: `3px solid ${INK}`, background: '#fff' }}><div style={{ width: `${Math.min(100, prog)}%`, height: '100%', background: semaforo(prog) }} /></div>
              </div>
            )
          })}
        </div>
      </Sec>

      {/* 7 · DÍAS PICO (66) + PROYECCIONES (33) */}
      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `44px ${PAD}`, borderRight: `4px solid ${INK}`, background: CREMA }}>
          <Head tag={`Días pico · ${p.mesLabel}`} tagBg={AZUL} tagColor="#fff" title={`Facturación bruta por día. Media ${E0(p.mediaDiariaPico)}.`} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150, marginBottom: 16 }}>
            {p.diasPico.map(x => (
              <button key={x.idx} onClick={() => p.onFiltrarDiaSemana?.(x.idx)} title={E0(x.valor)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ fontFamily: OSW, fontSize: 11.5, fontWeight: 600 }}>{x.valor > 0 ? E0(x.valor) : ''}</span>
                <div style={{ width: '100%', height: `${(x.valor / maxDia) * 96}px`, minHeight: 4, background: x.color, border: `3px solid ${INK}` }} />
                <span style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase' }}>{x.nombre}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontFamily: LEX, fontSize: 14, fontWeight: 600 }}>
            <span>Más fuerte · <b>{diaFuerte ? `${diaFuerte.nombre} ${E0(diaFuerte.valor)}` : '—'}</b></span>
            <span>Más flojo · <b>{diaFlojo ? `${diaFlojo.nombre} ${E0(diaFlojo.valor)}` : '—'}</b></span>
          </div>
        </div>
        <div style={{ padding: `44px ${PAD}`, background: AMA }}>
          <span style={eyebrow('#fff')}>Proyecciones</span>
          <div style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.65, marginTop: 16 }}>Saldo estimado</div>
          <div style={d('clamp(30px,4vw,44px)')}>{p.saldo.saldoHoy > 0 ? E0(p.saldo.saldoHoy) : '—'}</div>
          <div style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600, lineHeight: 2, marginTop: 12 }}>
            <div>Cobros 7 d · <b>{E0(p.saldo.cobros7d)}</b></div>
            <div>Cobros 30 d · <b>{E0(p.saldo.cobros30d)}</b></div>
            <div>Pagos 7 d · <b>{E0(p.saldo.pagos7d)}</b></div>
            <div>Pagos 30 d · <b>{E0(p.saldo.pagos30d)}</b></div>
          </div>
        </div>
      </section>

      {/* 8 · RATIO + PUNTO DE EQUILIBRIO (oscuro, 2 col) */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `4px solid ${INK}`, background: INK, color: CREMA }}>
        <div style={{ padding: `40px ${PAD}`, borderRight: `4px solid ${INK}` }}>
          <span style={eyebrow(VERDE, '#fff')}>Ratio ingresos / gastos</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, margin: '14px 0 10px' }}>
            <div style={d('clamp(40px,6vw,68px)', p.ratioActual >= p.objetivoRatio ? '#3ff0a0' : '#ffb27a')}>{(Number.isFinite(p.ratioActual) ? p.ratioActual : 0).toFixed(2)}×</div>
            <div style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>objetivo <Edit value={p.objetivoRatio} onSave={p.onSaveObjetivoRatio} suffix="×" color={AMA} /></div>
          </div>
          <div style={{ height: 14, border: `2px solid #ffffff33`, background: '#ffffff10' }}><div style={{ width: `${Math.min(100, p.objetivoRatio > 0 ? (p.ratioActual / p.objetivoRatio) * 100 : 0)}%`, height: '100%', background: p.ratioActual >= p.objetivoRatio ? VERDE : NAR }} /></div>
          <div style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 600, color: '#cfc7b6', lineHeight: 2, marginTop: 12 }}>
            <div>Ingresos netos · <b style={{ color: CREMA }}>{E0(p.netosReales || p.netoEstimado)}</b></div>
            <div>Gastos fijos · <b style={{ color: CREMA }}>{E0(p.gastosFijosMes)}</b></div>
            <div>Gastos reales · <b style={{ color: CREMA }}>{E0(p.gastosReales)}</b></div>
          </div>
        </div>
        <div style={{ padding: `40px ${PAD}` }}>
          <span style={eyebrow(AMA)}>Punto de equilibrio</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, margin: '14px 0 10px' }}>
            <div style={d('clamp(40px,6vw,68px)', CREMA)}>{E0(p.pe.peBruto)}</div>
            <div style={{ ...eyebrow(p.pe.pctProgreso >= 100 ? VERDE : AMA, p.pe.pctProgreso >= 100 ? '#fff' : INK), marginBottom: 12 }}>{PC(p.pe.pctProgreso)}</div>
          </div>
          <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: '#9b9384' }}>bruto necesario este mes</div>
          <div style={{ fontFamily: LEX, fontSize: 13.5, fontWeight: 600, color: '#cfc7b6', lineHeight: 2, marginTop: 10 }}>
            <div>Llevamos · <b style={{ color: CREMA }}>{E0(p.pe.acumulado)}</b></div>
            <div>Faltan · <b style={{ color: p.pe.faltan > 0 ? '#ffb27a' : '#3ff0a0' }}>{E0(p.pe.faltan)}</b></div>
            <div>Día verde · <b style={{ color: CREMA }}>{p.pe.diaVerdeEstimado ? `${p.pe.diaVerdeEstimado.fecha} ${p.pe.diaVerdeEstimado.diaSemana}` : '—'}</b></div>
            <div>Realidad · <b style={{ color: CREMA }}>{E0(p.pe.realFacDia)}/día · {INT(p.pe.realPedDia)} ped</b></div>
          </div>
        </div>
      </section>

      {/* 9 · TOP VENTAS (1.3) + PROVISIONES (1) */}
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
                  <span style={{ fontFamily: LEX, fontSize: 12, opacity: 0.6 }}>{INT(t.pedidos)} ped</span>
                  <span style={d('clamp(16px,2.2vw,24px)')}>{E0(t.importe)}</span>
                </div>
              ))}
          </div>
        </div>
        <div style={{ padding: `36px ${PAD}`, background: CLARO }}>
          <span style={eyebrow('#fff')}>Provisiones y próximos pagos</span>
          <div style={{ ...d('clamp(30px,4vw,44px)', NAR), margin: '12px 0 12px' }}>{E0(p.provisiones.totalAGuardar)}</div>
          <div style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600, lineHeight: 1.9 }}>
            <div>IVA · <b>{E0(p.provisiones.provIVA)}</b></div>
            <div>IRPF · <b>{E0(p.provisiones.provIRPF)}</b></div>
          </div>
          {p.provisiones.proximosPagos.length > 0 && <>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.6, margin: '14px 0 8px' }}>Próximos pagos</div>
            {p.provisiones.proximosPagos.slice(0, 6).map((x, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEX, fontSize: 13.5, fontWeight: 600, padding: '4px 0' }}><span>{x.concepto}</span><span>{E0(x.importe)}</span></div>
            ))}
          </>}
        </div>
      </section>

      {/* 10 · FOOTER MARCA */}
      <section style={{ background: INK, color: CREMA, padding: PAD, textAlign: 'center' }}>
        <div style={d('clamp(34px,6vw,72px)', CREMA)}>Binagre es hogar.</div>
        <div style={{ fontFamily: OSW, letterSpacing: '6px', fontSize: 15, color: AMA, marginTop: 12, textTransform: 'uppercase' }}>Comer bien. Aquí y ahora.</div>
      </section>
    </div>
  )
}
