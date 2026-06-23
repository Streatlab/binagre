/**
 * ResumenLanding — presentación "landing" para la pestaña Resumen del Panel
 * Global, CONSERVANDO toda la densidad informativa de las cards originales:
 * facturación bruto/neto, objetivos con "faltan X de Y", pedidos·TM por canal,
 * P&L por grupo, facturación por canal (bruto/neto/margen), grupos de gasto vs
 * presupuesto, días pico (fuerte/flojo/media), proyecciones, ratio sobre gastos
 * fijos, punto de equilibrio detallado, provisiones y top ventas.
 * No calcula nada: todo llega por props desde TabResumen. Sin datos inventados.
 */
import { useState } from 'react'
import type { CanalStat, ObjetivosVentas, PagoProximoItem, TopVentaItem } from './types'
import type { GrupoGasto } from './ColGruposGasto'
import type { DiaPico } from './ColDiasPico'

const INK = '#140f08'
const CREMA = '#FCEFD6'
const ROSA = '#FF2E63'
const AMA = '#FFC400'
const VERDE = '#0FB86B'
const NAR = '#FF6A1A'
const AZUL = '#2D5BFF'
const OSW = "'Oswald', sans-serif"
const LEX = "'Lexend', sans-serif"

const display = (size: string, color = INK): React.CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color })
const eyebrow = (bg: string, color = INK): React.CSSProperties => ({ display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 12px' })
const cta = (bg: string, color = '#fff'): React.CSSProperties => ({ display: 'inline-block', background: bg, color, border: `3px solid ${INK}`, boxShadow: `5px 5px 0 ${INK}`, fontFamily: OSW, fontWeight: 700, fontSize: 16, letterSpacing: '1px', textTransform: 'uppercase', padding: '12px 22px', cursor: 'pointer' })
const sectionPad = '40px'

const eur0 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
const eur2 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const eur1 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' €'
const pct0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0) + '%'
const pct2 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
const delta = (v: number | null) => (v == null ? '—' : (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v).toFixed(1) + '%')

interface GrupoData { gasto: number; presupuesto: number; pctSobreNetos: number }

interface Props {
  periodoLabel?: string
  datosDemo: boolean
  semanaCodigo: string
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
  pe: { peBruto: number; acumulado: number; pctProgreso: number; faltan: number; diaVerdeEstimado: { fecha: string; diaSemana: string } | null; pedidosDia: number; tmActual: number; realFacDia: number; realPedDia: number }
  provisiones: { totalAGuardar: number; provIVA: number; provIRPF: number; proximosPagos: PagoProximoItem[] }
  topItems: TopVentaItem[]
  topDatosDemo: boolean
  topTab: 'productos' | 'modificadores'
  onTopTab: (t: 'productos' | 'modificadores') => void
  onSaveObjetivoVenta: (tipo: 'semanal' | 'mensual' | 'anual', valor: number | null) => void
  onSaveObjetivoRatio: (valor: number | null) => void
  onSavePresupuestoGrupo: (grupo: GrupoGasto, valor: number | null) => void
  onFiltrarDiaSemana?: (idx: number) => void
}

function EditNum({ value, onSave, suffix = ' €' }: { value: number; onSave: (v: number | null) => void; suffix?: string }) {
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState(String(Math.round(value)))
  if (!edit) return <button onClick={() => { setVal(String(Math.round(value))); setEdit(true) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: OSW, fontWeight: 700, fontSize: 'inherit', color: 'inherit', textDecoration: 'underline dotted', padding: 0 }}>{value > 0 ? Math.round(value).toLocaleString('es-ES') + suffix : 'fijar'}</button>
  const commit = () => { const n = parseFloat(val.replace(',', '.')); onSave(Number.isFinite(n) ? n : null); setEdit(false) }
  return <input autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEdit(false) }} style={{ width: 110, fontFamily: OSW, fontWeight: 700, fontSize: 18, border: `2px solid ${INK}`, padding: '2px 8px', background: '#fff' }} />
}

const Sec: React.FC<{ children: React.ReactNode; bg?: string; pad?: string }> = ({ children, bg = CREMA, pad = `44px ${sectionPad}` }) => (
  <section style={{ background: bg, padding: pad, borderBottom: `4px solid ${INK}` }}>{children}</section>
)
const Head: React.FC<{ tag: string; tagBg: string; tagColor?: string; title: string }> = ({ tag, tagBg, tagColor = INK, title }) => (
  <>
    <span style={eyebrow(tagBg, tagColor)}>{tag}</span>
    <div style={{ ...display('clamp(24px,3vw,38px)'), margin: '14px 0 22px' }}>{title}</div>
  </>
)

export default function ResumenLanding(p: Props) {
  const netoPct = p.ventasPeriodo > 0 ? (p.netoEstimado / p.ventasPeriodo) * 100 : 0
  const comisionPct = p.ventasPeriodo > 0 ? (1 - p.netoEstimado / p.ventasPeriodo) * 100 : 0
  const web = p.canalStats.find(c => c.id === 'web')
  const webPct = web ? web.pct : 0

  const objetivosRows: Array<{ k: 'semanal' | 'mensual' | 'anual'; lbl: string; real: number; obj: number }> = [
    { k: 'semanal', lbl: p.semanaCodigo, real: p.ventasSemana, obj: p.objetivos.semanal },
    { k: 'mensual', lbl: p.mesLabel, real: p.ventasMes, obj: p.objetivos.mensual },
    { k: 'anual', lbl: String(p.anoLabel), real: p.ventasAno, obj: p.objetivos.anual },
  ]
  const gruposMeta: Array<{ k: GrupoGasto; lbl: string; sub: string; obj: number }> = [
    { k: 'producto', lbl: 'Producto', sub: 'COGS · Food cost', obj: 30 },
    { k: 'equipo', lbl: 'Equipo', sub: 'Labor', obj: 40 },
    { k: 'local', lbl: 'Local', sub: 'Occupancy', obj: 15 },
    { k: 'controlables', lbl: 'Controlables', sub: 'Opex', obj: 15 },
  ]
  const maxDia = Math.max(1, ...p.diasPico.map(d => d.valor))
  const diasConV = p.diasPico.filter(d => d.valor > 0)
  const diaFuerte = diasConV.length ? diasConV.reduce((a, d) => d.valor > a.valor ? d : a) : null
  const diaFlojo = diasConV.length ? diasConV.reduce((a, d) => d.valor < a.valor ? d : a) : null
  const margenBruto = p.netoEstimado - p.grupos.producto.gasto
  const resultadoNetoPL = p.netoEstimado - (p.grupos.producto.gasto + p.grupos.equipo.gasto + p.grupos.local.gasto + p.grupos.controlables.gasto)
  const di = 'Datos insuficientes'

  return (
    <div style={{ background: CREMA, fontFamily: LEX, color: INK, border: `4px solid ${INK}`, marginTop: 4 }}>
      {p.datosDemo && <div style={{ background: AMA, borderBottom: `4px solid ${INK}`, padding: `8px ${sectionPad}`, fontFamily: OSW, letterSpacing: '1px', fontSize: 13, textTransform: 'uppercase' }}>Datos demo · BD vacía o sin datos en este periodo</div>}

      {/* 1 · HERO FACTURACIÓN */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', borderBottom: `4px solid ${INK}`, background: AMA }}>
        <div style={{ padding: `48px ${sectionPad} 44px`, borderRight: `4px solid ${INK}` }}>
          <span style={eyebrow('#fff')}>Comer bien. Aquí y ahora.</span>
          <div style={{ ...display('clamp(34px,4.6vw,58px)'), margin: '18px 0 16px', maxWidth: 620 }}>{p.pedidosPeriodo > 0 ? `Has servido ${p.pedidosPeriodo.toLocaleString('es-ES')} pedidos.` : 'Aún no hay pedidos en este periodo.'}</div>
          <div style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Facturación bruta · {p.periodoLabel ?? 'periodo'}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', marginTop: 4 }}>
            <div style={display('clamp(46px,7.5vw,96px)')}>{eur0(p.ventasPeriodo)}</div>
            {p.variacionVentas != null && <div style={{ ...eyebrow(p.variacionVentas >= 0 ? VERDE : ROSA, '#fff'), fontSize: 18, padding: '8px 14px', marginBottom: 12 }}>{delta(p.variacionVentas)}</div>}
          </div>
          <div style={{ fontFamily: LEX, fontSize: 15, marginTop: 10, fontWeight: 600 }}>Neto estimado <b>{eur0(p.netoEstimado)}</b> · {pct2(netoPct)} sobre bruto</div>
        </div>
        <div style={{ background: CREMA, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
          <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, padding: '18px 20px', width: '100%', maxWidth: 280, transform: 'rotate(-3deg)' }}>
            <div style={{ ...display('15px'), borderBottom: `2px dashed ${INK}`, paddingBottom: 10 }}>· Resumen del periodo ·</div>
            {[['Pedidos', p.pedidosPeriodo.toLocaleString('es-ES')], ['Ticket bruto', eur2(p.tmBruto)], ['Ticket neto', eur2(p.tmNeto)], ['EBITDA', eur0(p.ebitda)]].map(([l, v], i) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: i < 3 ? `1px dotted ${INK}55` : 'none' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{l}</span>
                <span style={display('19px', i === 3 ? (p.ebitda >= 0 ? VERDE : ROSA) : INK)}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2 · OBJETIVOS (faltan X de Y, editable) */}
      <Sec>
        <Head tag="Tus objetivos" tagBg={VERDE} tagColor="#fff" title="Cómo vas frente a lo que te marcaste. Toca el objetivo para cambiarlo." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {objetivosRows.map(o => {
            const prog = o.obj > 0 ? (o.real / o.obj) * 100 : 0
            const faltan = Math.max(0, o.obj - o.real)
            return (
              <div key={o.k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <span style={display('20px')}>{o.lbl} · {eur0(o.real)} <span style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>({pct0(prog)})</span></span>
                  <span style={{ fontFamily: LEX, fontSize: 14, fontWeight: 600 }}>Faltan {eur0(faltan)} de objetivo <EditNum value={o.obj} onSave={v => p.onSaveObjetivoVenta(o.k, v)} /></span>
                </div>
                <div style={{ height: 16, border: `3px solid ${INK}`, background: '#fff' }}><div style={{ width: `${Math.min(100, prog)}%`, height: '100%', background: prog >= 100 ? VERDE : prog >= 60 ? AMA : NAR }} /></div>
              </div>
            )
          })}
        </div>
      </Sec>

      {/* 3 · PEDIDOS · TM (por canal) */}
      <Sec bg="#fff">
        <Head tag="Pedidos · ticket medio" tagBg={AZUL} tagColor="#fff" title="Volumen y ticket, en total y por canal." />
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 22 }}>
          <div><div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.6 }}>Pedidos</div><div style={display('clamp(40px,6vw,64px)')}>{p.pedidosPeriodo.toLocaleString('es-ES')}</div></div>
          <div><div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.6 }}>TM bruto</div><div style={display('clamp(40px,6vw,64px)')}>{eur2(p.tmBruto)}</div></div>
          <div><div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.6 }}>TM neto</div><div style={display('clamp(40px,6vw,64px)', VERDE)}>{eur2(p.tmNeto)}</div></div>
          <div style={{ alignSelf: 'flex-end', fontFamily: LEX, fontSize: 13, fontWeight: 600 }}>{delta(p.variacionPedidos)} pedidos · {delta(p.variacionTM)} TM <span style={{ opacity: 0.6 }}>vs anterior</span></div>
        </div>
        <div style={{ border: `3px solid ${INK}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', padding: '8px 14px', background: INK }}>
            {['Canal', 'Pedidos', 'TM bruto', 'TM neto'].map(h => <span key={h} style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA }}>{h}</span>)}
          </div>
          {p.canalStats.map((c, i) => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', padding: '11px 14px', borderTop: i > 0 ? `2px solid ${INK}18` : 'none', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><span style={{ width: 10, height: 10, background: c.color, border: `2px solid ${INK}` }} />{c.label}</span>
              <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 17 }}>{c.pedidos}</span>
              <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 17 }}>{c.pedidos > 0 ? eur2(c.ticket) : '—'}</span>
              <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 17, color: VERDE }}>{c.pedidos > 0 ? eur2(c.neto / c.pedidos) : '—'}</span>
            </div>
          ))}
        </div>
      </Sec>

      {/* 4 · RESULTADO + P&L */}
      <Sec>
        <Head tag="Resultado del periodo" tagBg={VERDE} tagColor="#fff" title="" />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', marginTop: -8, marginBottom: 22 }}>
          <div style={display('clamp(48px,8vw,92px)', p.ebitda >= 0 ? INK : ROSA)}>{eur0(p.ebitda)}</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ ...eyebrow(p.ebitda >= 0 ? VERDE : ROSA, '#fff'), fontSize: 15 }}>EBITDA {pct0(p.ebitdaPct)}</div>
            <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, marginTop: 8 }}>Prime cost <b style={{ color: p.primeCostPct <= 60 ? VERDE : NAR }}>{pct2(p.primeCostPct)}</b> · objetivo 60%</div>
          </div>
        </div>
        <div style={{ border: `3px solid ${INK}`, background: '#fff' }}>
          {[
            ['Facturación', eur2(p.ventasPeriodo), INK, false],
            ['Ingresos netos', eur2(p.netoEstimado), INK, false],
            ['Producto · COGS', p.grupos.producto.gasto > 0 ? '−' + eur2(p.grupos.producto.gasto) : di, p.grupos.producto.gasto > 0 ? NAR : '#9b9384', false],
            ['Margen bruto', eur2(margenBruto), INK, true],
            ['Equipo · Labor', p.grupos.equipo.gasto > 0 ? '−' + eur2(p.grupos.equipo.gasto) : di, p.grupos.equipo.gasto > 0 ? NAR : '#9b9384', false],
            ['Local · Occupancy', p.grupos.local.gasto > 0 ? '−' + eur2(p.grupos.local.gasto) : di, p.grupos.local.gasto > 0 ? NAR : '#9b9384', false],
            ['Controlables · Opex', p.grupos.controlables.gasto > 0 ? '−' + eur2(p.grupos.controlables.gasto) : di, p.grupos.controlables.gasto > 0 ? NAR : '#9b9384', false],
            ['Resultado neto', eur2(resultadoNetoPL), resultadoNetoPL >= 0 ? VERDE : ROSA, true],
          ].map(([l, v, c, bold], i) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 16px', borderTop: i > 0 ? `2px solid ${INK}18` : 'none', background: bold ? `${INK}07` : 'transparent' }}>
              <span style={{ fontSize: 14, fontWeight: bold ? 700 : 500 }}>{l}</span>
              <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: bold ? 22 : 18, color: c as string }}>{v}</span>
            </div>
          ))}
        </div>
      </Sec>

      {/* 5 · FACTURACIÓN POR CANAL (bruto/neto/margen) */}
      <Sec bg="#fff">
        <Head tag="Facturación por canal" tagBg={AMA} title="Bruto, neto y margen de cada plataforma." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {p.canalStats.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'stretch', border: `3px solid ${INK}` }}>
              <div style={{ width: 150, background: c.color, display: 'flex', alignItems: 'center', paddingLeft: 14 }}><span style={display('16px', '#fff')}>{c.label}</span></div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '12px 10px', gap: 10, flexWrap: 'wrap' }}>
                <span><b style={{ fontFamily: OSW, fontSize: 20 }}>{eur0(c.bruto)}</b> <span style={{ fontSize: 11, opacity: 0.6 }}>bruto</span></span>
                <span><b style={{ fontFamily: OSW, fontSize: 20, color: VERDE }}>{eur0(c.neto)}</b> <span style={{ fontSize: 11, opacity: 0.6 }}>neto</span></span>
                <span style={{ ...eyebrow(CREMA), fontSize: 12 }}>Margen {pct2(c.margen)}</span>
              </div>
            </div>
          ))}
        </div>
      </Sec>

      {/* 6 · GANCHO WEB */}
      <section style={{ background: ROSA, color: '#fff', padding: `50px ${sectionPad}`, borderBottom: `4px solid ${INK}` }}>
        <div style={{ ...display('clamp(28px,4.4vw,54px)', '#fff'), maxWidth: 940 }}>Las comisiones se llevan <span style={{ background: '#fff', color: ROSA, padding: '0 10px' }}>{pct0(comisionPct)}</span> de lo que vendes.</div>
        <div style={{ fontSize: 'clamp(16px,1.9vw,21px)', fontWeight: 600, marginTop: 18, maxWidth: 760 }}>Tu web trae el {pct0(webPct)}. Cada cliente que vuelve por la web es comida que cobras entera, sin comisión de plataforma.</div>
        <div style={{ marginTop: 24 }}><span style={cta(INK)}>Empuja tu web →</span></div>
      </section>

      {/* 7 · GRUPOS DE GASTO (consumo vs presupuesto, editable) */}
      <Sec>
        <Head tag="Grupos de gasto · consumo vs presupuesto" tagBg={NAR} tagColor="#fff" title="En qué se va el dinero. Presupuesto editable por grupo." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', border: `3px solid ${INK}` }}>
          {gruposMeta.map((g, i) => {
            const d = p.grupos[g.k]
            const pctObj = d.presupuesto > 0 ? (d.gasto / d.presupuesto) * 100 : 0
            return (
              <div key={g.k} style={{ padding: '16px 18px', borderRight: i % 2 === 0 ? `3px solid ${INK}` : 'none', borderBottom: i < 2 ? `3px solid ${INK}` : 'none', background: '#fff' }}>
                <div style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase' }}>{g.lbl} <span style={{ opacity: 0.5, fontSize: 11 }}>· {g.sub}</span></div>
                <div style={{ ...display('clamp(24px,3.4vw,34px)'), marginTop: 6 }}>{d.gasto > 0 ? eur0(d.gasto) : di}</div>
                <div style={{ fontFamily: LEX, fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>{Math.round(d.pctSobreNetos)}% s/ neto · objetivo {g.obj}%</div>
                <div style={{ fontFamily: LEX, fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>Presupuesto <EditNum value={d.presupuesto} onSave={v => p.onSavePresupuestoGrupo(g.k, v)} /> {d.presupuesto > 0 ? `· ${pct0(pctObj)}` : ''}</div>
              </div>
            )
          })}
        </div>
      </Sec>

      {/* 8 · DÍAS PICO */}
      <Sec bg="#fff">
        <Head tag={`Días pico · ${p.mesLabel}`} tagBg={AZUL} tagColor="#fff" title={`Facturación bruta por día. Media ${eur0(p.mediaDiariaPico)}. Toca un día para filtrar.`} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150, marginBottom: 18 }}>
          {p.diasPico.map(d => (
            <button key={d.idx} onClick={() => p.onFiltrarDiaSemana?.(d.idx)} title={eur0(d.valor)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ fontFamily: OSW, fontSize: 12, fontWeight: 600 }}>{d.valor > 0 ? eur0(d.valor) : ''}</span>
              <div style={{ width: '100%', height: `${(d.valor / maxDia) * 96}px`, minHeight: 4, background: d.color, border: `3px solid ${INK}` }} />
              <span style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase' }}>{d.nombre}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontFamily: LEX, fontSize: 13, fontWeight: 600 }}>
          <span>Día más fuerte · <b>{diaFuerte ? `${diaFuerte.nombre} ${eur0(diaFuerte.valor)}` : '—'}</b></span>
          <span>Día más flojo · <b>{diaFlojo ? `${diaFlojo.nombre} ${eur0(diaFlojo.valor)}` : '—'}</b></span>
          <span>Media diaria · <b>{eur0(p.mediaDiariaPico)}</b></span>
        </div>
      </Sec>

      {/* 9 · PROYECCIONES + RATIO + PE */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: '28px 24px', borderRight: `4px solid ${INK}`, background: '#fff' }}>
          <span style={eyebrow(CREMA)}>Proyecciones</span>
          <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.6, marginTop: 14 }}>Saldo estimado</div>
          <div style={{ ...display('clamp(26px,3.6vw,38px)'), margin: '4px 0 12px' }}>{p.saldo.saldoHoy > 0 ? eur0(p.saldo.saldoHoy) : '—'}</div>
          <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600, lineHeight: 1.9 }}>
            <div style={{ opacity: 0.6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px' }}>Cobros estimados</div>
            <div>7 d · {eur0(p.saldo.cobros7d)}</div>
            <div>30 d · {eur0(p.saldo.cobros30d)}</div>
            <div style={{ opacity: 0.6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', marginTop: 6 }}>Pagos fijos</div>
            <div>7 d · {eur0(p.saldo.pagos7d)}</div>
            <div>30 d · {eur0(p.saldo.pagos30d)}</div>
          </div>
        </div>
        <div style={{ padding: '28px 24px', borderRight: `4px solid ${INK}`, background: '#fff' }}>
          <span style={eyebrow(CREMA)}>Ratio ingresos / gastos</span>
          <div style={{ ...display('clamp(28px,3.8vw,42px)', p.ratioActual >= p.objetivoRatio ? VERDE : NAR), margin: '12px 0 8px' }}>{(Number.isFinite(p.ratioActual) ? p.ratioActual : 0).toFixed(2)}×</div>
          <div style={{ fontFamily: LEX, fontSize: 13, fontWeight: 600 }}>Objetivo <EditNum value={p.objetivoRatio} onSave={p.onSaveObjetivoRatio} suffix="×" /></div>
          <div style={{ height: 12, border: `3px solid ${INK}`, background: CREMA, margin: '12px 0' }}><div style={{ width: `${Math.min(100, p.objetivoRatio > 0 ? (p.ratioActual / p.objetivoRatio) * 100 : 0)}%`, height: '100%', background: p.ratioActual >= p.objetivoRatio ? VERDE : NAR }} /></div>
          <div style={{ fontFamily: LEX, fontSize: 12.5, fontWeight: 600, lineHeight: 1.8 }}>
            <div>Ingresos netos · {eur0(p.netosReales || p.netoEstimado)}</div>
            <div>Gastos fijos · {eur0(p.gastosFijosMes)}</div>
            <div>Gastos reales · {eur0(p.gastosReales)}</div>
          </div>
        </div>
        <div style={{ padding: '28px 24px', background: '#fff' }}>
          <span style={eyebrow(CREMA)}>Punto de equilibrio</span>
          <div style={{ ...display('clamp(28px,3.8vw,42px)'), margin: '12px 0 8px' }}>{eur0(p.pe.peBruto)}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, fontWeight: 600, opacity: 0.7 }}>bruto necesario</div>
          <div style={{ ...eyebrow(p.pe.pctProgreso >= 100 ? VERDE : AMA, p.pe.pctProgreso >= 100 ? '#fff' : INK), fontSize: 14, margin: '10px 0' }}>{Math.round(p.pe.pctProgreso)}%</div>
          <div style={{ fontFamily: LEX, fontSize: 12.5, fontWeight: 600, lineHeight: 1.8 }}>
            <div>Llevamos · {eur0(p.pe.acumulado)}</div>
            <div>Faltan · {eur0(p.pe.faltan)}</div>
            <div>Día verde · {p.pe.diaVerdeEstimado ? `${p.pe.diaVerdeEstimado.fecha} ${p.pe.diaVerdeEstimado.diaSemana}` : '—'}</div>
            <div>Realidad · {eur0(p.pe.realFacDia)}/día · {p.pe.realPedDia} ped</div>
          </div>
        </div>
      </section>

      {/* 10 · TOP + PROVISIONES */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: `32px ${sectionPad}`, borderRight: `4px solid ${INK}` }}>
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
                  <span style={{ ...display('clamp(20px,3vw,30px)', i === 0 ? ROSA : INK), width: 44 }}>{String(t.ranking ?? i + 1).padStart(2, '0')}</span>
                  <span style={{ fontFamily: LEX, fontWeight: 600, fontSize: 15, flex: 1 }}>{t.producto}</span>
                  <span style={{ fontFamily: LEX, fontSize: 12, opacity: 0.6 }}>{t.pedidos} ped</span>
                  <span style={display('clamp(16px,2.2vw,24px)')}>{eur0(t.importe)}</span>
                </div>
              ))}
          </div>
        </div>
        <div style={{ padding: `32px ${sectionPad}`, background: '#fff' }}>
          <span style={eyebrow(AMA)}>Provisiones y próximos pagos</span>
          <div style={{ ...display('clamp(28px,3.8vw,42px)', NAR), margin: '12px 0 12px' }}>{eur0(p.provisiones.totalAGuardar)}</div>
          <div style={{ fontFamily: LEX, fontSize: 12.5, fontWeight: 600, lineHeight: 1.9 }}>
            <div>IVA · {eur0(p.provisiones.provIVA)}</div>
            <div>IRPF · {eur0(p.provisiones.provIRPF)}</div>
          </div>
          {p.provisiones.proximosPagos.length > 0 && <>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.6, margin: '14px 0 8px' }}>Próximos pagos</div>
            {p.provisiones.proximosPagos.slice(0, 6).map((x, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEX, fontSize: 13, fontWeight: 600, padding: '3px 0' }}><span>{x.concepto}</span><span>{eur0(x.importe)}</span></div>
            ))}
          </>}
        </div>
      </section>

      {/* 11 · CIERRE */}
      <section style={{ background: AMA, padding: `50px ${sectionPad}`, borderBottom: `4px solid ${INK}`, textAlign: 'center' }}>
        <span style={eyebrow('#fff')}>Al final del periodo</span>
        <div style={{ ...display('clamp(48px,9vw,108px)', p.ebitda >= 0 ? INK : ROSA), margin: '16px 0 8px' }}>{eur0(p.ebitda)}</div>
        <div style={display('clamp(18px,2.4vw,28px)')}>EBITDA {pct0(p.ebitdaPct)} · comer bien también deja margen.</div>
      </section>

      {/* 12 · FOOTER MARCA */}
      <section style={{ background: INK, color: CREMA, padding: sectionPad, textAlign: 'center' }}>
        <div style={display('clamp(34px,6vw,72px)', CREMA)}>Binagre es hogar.</div>
        <div style={{ fontFamily: OSW, letterSpacing: '6px', fontSize: 15, color: AMA, marginTop: 12, textTransform: 'uppercase' }}>Guisar · Comer bien. Aquí y ahora.</div>
      </section>
    </div>
  )
}
