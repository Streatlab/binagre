/**
 * Test Visual — Panel Global · DARK OPERATIVO (rehecho como cockpit).
 * Centro de control: paneles pegados de distinto peso, un metric-hero con
 * gráfico de fondo, rail de métricas denso, tablas con estado. Tipografía
 * técnica, color solo ligado a estado, glow sutil. No es grid de tarjetas.
 */
import { useState } from 'react'

const BG = '#080b11'
const CARD = '#0e121b'
const PANEL = '#0b0f17'
const BRD = '#1b2230'
const PRI = '#eef1f8'
const SEC = '#98a1b5'
const MUT = '#586073'
const OK = '#34e29b'
const AMBAR = '#f5b13d'
const ROJO = '#ff5470'
const ACC = '#8a7bff'
const CYAN = '#39c0f7'
const OSW = "'Oswald', sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"
const LEX = "'Lexend', sans-serif"

const label = (c = MUT): React.CSSProperties => ({ fontFamily: OSW, fontSize: 11, fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: c })
const mono = (c = PRI, size = 30): React.CSSProperties => ({ fontFamily: MONO, fontSize: size, fontWeight: 600, color: c, letterSpacing: '-1px' })

const TABS = ['Resumen', 'Operaciones', 'Finanzas', 'Cashflow', 'Evolución', 'Marcas'] as const
type Tab = typeof TABS[number]

export default function PanelGlobalDark() {
  const [tab, setTab] = useState<Tab>('Resumen')
  return (
    <div style={{ minHeight: '100%', background: BG, padding: '18px 22px 40px', fontFamily: LEX, color: PRI }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontFamily: OSW, fontSize: 17, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Panel Global</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 11.5, color: OK, border: `1px solid ${OK}44`, background: `${OK}10`, borderRadius: 6, padding: '3px 10px' }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: OK, boxShadow: `0 0 8px ${OK}` }} /> OPERATIVO · +12,4% vs 7d
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: MUT }}>23·06·2026 / mes en curso</span>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map(t => {
          const on = t === tab
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              fontFamily: OSW, fontSize: 12, fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase',
              padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${on ? ACC : BRD}`, background: on ? `${ACC}1f` : 'transparent', color: on ? PRI : SEC,
            }}>{t}</button>
          )
        })}
      </div>

      {tab === 'Resumen' && <Resumen />}
      {tab === 'Operaciones' && <Operaciones />}
      {tab === 'Finanzas' && <Finanzas />}
      {tab === 'Cashflow' && <Cashflow />}
      {tab === 'Evolución' && <Evolucion />}
      {tab === 'Marcas' && <Marcas />}
    </div>
  )
}

function Spark({ color, h = 90 }: { color: string; h?: number }) {
  const pts = [38, 50, 44, 60, 54, 70, 64, 80, 74, 88, 82, 96]
  const w = 600, step = w / (pts.length - 1)
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (p / 100) * h}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: h, opacity: 0.55 }}>
      <defs><linearGradient id={`g${color}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.4" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={`url(#g${color})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
    </svg>
  )
}

function Metric({ l, v, c = PRI, sub, subc = MUT }: { l: string; v: string; c?: string; sub?: string; subc?: string }) {
  return (
    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BRD}` }}>
      <div style={label()}>{l}</div>
      <div style={{ ...mono(c, 26), marginTop: 6, textShadow: c !== PRI ? `0 0 16px ${c}44` : 'none' }}>{v}</div>
      {sub && <div style={{ fontFamily: MONO, fontSize: 11.5, color: subc, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Resumen() {
  const canales = [
    { n: 'UBER', pct: 41, eur: '1.167 €', c: OK }, { n: 'GLOVO', pct: 33, eur: '939 €', c: AMBAR },
    { n: 'JUST EAT', pct: 18, eur: '512 €', c: CYAN }, { n: 'WEB', pct: 8, eur: '229 €', c: ACC },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.75fr 1fr', border: `1px solid ${BRD}`, borderRadius: 14, overflow: 'hidden', background: CARD }}>
      {/* columna principal */}
      <div style={{ borderRight: `1px solid ${BRD}` }}>
        {/* metric-hero con gráfico de fondo */}
        <div style={{ position: 'relative', padding: '22px 24px 0', borderBottom: `1px solid ${BRD}`, minHeight: 168, overflow: 'hidden' }}>
          <div style={label()}>Ventas de hoy</div>
          <div style={{ ...mono(PRI, 'clamp(48px,7vw,80px)' as unknown as number), marginTop: 6 }}>2.847 €</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, position: 'relative', zIndex: 2 }}>
            <span style={{ fontFamily: MONO, fontSize: 13, color: OK }}>▲ 12,4%</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: MUT }}>vs media 7d · 94 pedidos</span>
          </div>
          <Spark color={ACC} h={86} />
        </div>
        {/* tabla canales densa */}
        <div style={{ padding: '6px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 0.7fr 0.8fr', padding: '8px 24px', borderBottom: `1px solid ${BRD}` }}>
            {['CANAL', 'REPARTO', '%', 'BRUTO'].map(h => <span key={h} style={label()}>{h}</span>)}
          </div>
          {canales.map(c => (
            <div key={c.n} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 0.7fr 0.8fr', padding: '11px 24px', borderBottom: `1px solid ${BRD}55`, alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 12.5, color: PRI }}><span style={{ width: 6, height: 6, borderRadius: 999, background: c.c, boxShadow: `0 0 7px ${c.c}` }} />{c.n}</span>
              <div style={{ height: 6, background: '#0a0e16', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${c.pct}%`, height: '100%', background: c.c, boxShadow: `0 0 9px ${c.c}99` }} /></div>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: SEC }}>{c.pct}%</span>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: PRI }}>{c.eur}</span>
            </div>
          ))}
        </div>
      </div>
      {/* rail de métricas */}
      <div style={{ background: PANEL }}>
        <Metric l="Pedidos" v="94" sub="▲ 9 vs ayer" subc={OK} />
        <Metric l="Ticket medio" v="30,3 €" c={CYAN} />
        <Metric l="Resultado neto" v="+713 €" c={OK} sub="25% s/ ventas" subc={OK} />
        <Metric l="Repetición" v="22 %" />
        <Metric l="Comisión s/ ventas" v="34 %" c={ROJO} sub="● vigilar" subc={ROJO} />
        <div style={{ padding: '14px 18px' }}>
          <div style={label()}>Prime cost</div>
          <div style={{ ...mono(OK, 26), marginTop: 6, textShadow: `0 0 16px ${OK}44` }}>64 %</div>
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: OK, marginTop: 4 }}>● en rango</div>
        </div>
      </div>
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div style={{ border: `1px solid ${BRD}`, borderRadius: 14, background: CARD, overflow: 'hidden' }}>{children}</div>
}
function Titular({ children }: { children: React.ReactNode }) {
  return <div style={{ borderLeft: `3px solid ${ACC}`, background: `${ACC}0e`, borderRadius: 8, padding: '13px 18px', marginBottom: 14, fontSize: 15, color: SEC, lineHeight: 1.5 }}>{children}</div>
}

function Operaciones() {
  const filas = [
    { c: 'Uber Eats', ped: 39, bru: '1.167 €', tk: '29,9 €', st: OK }, { c: 'Glovo', ped: 31, bru: '939 €', tk: '30,3 €', st: OK },
    { c: 'Just Eat', ped: 17, bru: '512 €', tk: '30,1 €', st: AMBAR }, { c: 'Web', ped: 7, bru: '229 €', tk: '32,7 €', st: ACC },
  ]
  return (
    <>
      <Titular><b style={{ color: PRI, fontFamily: MONO }}>94</b> pedidos · cancelación <b style={{ color: OK }}>2%</b> · repetición <b style={{ color: PRI, fontFamily: MONO }}>22%</b></Titular>
      <Panel>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', padding: '10px 22px', borderBottom: `1px solid ${BRD}` }}>{['CANAL', 'PEDIDOS', 'BRUTO', 'TICKET'].map(h => <span key={h} style={label()}>{h}</span>)}</div>
        {filas.map(f => (
          <div key={f.c} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', padding: '13px 22px', borderBottom: `1px solid ${BRD}55`, alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: PRI }}><span style={{ width: 6, height: 6, borderRadius: 999, background: f.st, boxShadow: `0 0 7px ${f.st}` }} />{f.c}</span>
            <span style={mono(PRI, 15)}>{f.ped}</span><span style={mono(PRI, 15)}>{f.bru}</span><span style={mono(SEC, 15)}>{f.tk}</span>
          </div>
        ))}
      </Panel>
    </>
  )
}

function Finanzas() {
  const pnl = [{ n: 'Ventas netas', v: '+2.847 €', c: PRI }, { n: 'Food cost · 30%', v: '−854 €', c: ROJO }, { n: 'Comisiones · 34%', v: '−968 €', c: ROJO }, { n: 'Laboral · 11%', v: '−312 €', c: ROJO }, { n: 'Resultado neto', v: '+713 €', c: OK }]
  return (
    <>
      <Titular>De cada euro vendido quedan <b style={{ color: OK }}>0,25 €</b> tras costes.</Titular>
      <Panel>
        {pnl.map((r, i) => (
          <div key={r.n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 22px', borderTop: i > 0 ? `1px solid ${BRD}55` : 'none', background: i === pnl.length - 1 ? `${OK}08` : 'transparent' }}>
            <span style={{ fontSize: 14.5, color: i === pnl.length - 1 ? PRI : SEC, fontWeight: i === pnl.length - 1 ? 600 : 400 }}>{r.n}</span>
            <span style={{ ...mono(r.c, 19), textShadow: r.c !== PRI ? `0 0 14px ${r.c}44` : 'none' }}>{r.v}</span>
          </div>
        ))}
      </Panel>
    </>
  )
}

function Cashflow() {
  const cobrar = [{ n: 'UBER', v: '1.840 €', c: OK, pct: 44 }, { n: 'GLOVO', v: '1.210 €', c: AMBAR, pct: 29 }, { n: 'JUST EAT', v: '760 €', c: CYAN, pct: 18 }, { n: 'WEB', v: '400 €', c: ACC, pct: 9 }]
  return (
    <>
      <Titular>Pendiente de cobro <b style={{ color: PRI, fontFamily: MONO }}>4.210 €</b> · Uber concentra el <b style={{ color: OK }}>44%</b>.</Titular>
      <Panel>
        {cobrar.map((c, i) => (
          <div key={c.n} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 22px', borderTop: i > 0 ? `1px solid ${BRD}55` : 'none' }}>
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: SEC, width: 78 }}>{c.n}</span>
            <div style={{ flex: 1, height: 6, background: '#0a0e16', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${c.pct}%`, height: '100%', background: c.c, boxShadow: `0 0 9px ${c.c}99` }} /></div>
            <span style={{ ...mono(PRI, 18), width: 92, textAlign: 'right' }}>{c.v}</span>
          </div>
        ))}
      </Panel>
    </>
  )
}

function Evolucion() {
  const pts = [40, 52, 48, 63, 58, 72, 68, 81, 76, 88, 84, 95]
  const w = 600, h = 170, step = w / (pts.length - 1)
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (p / 100) * h}`).join(' ')
  return (
    <>
      <Titular>Mes en curso <b style={{ color: PRI, fontFamily: MONO }}>74.200 €</b> · <b style={{ color: OK }}>+8,3%</b> vs anterior.</Titular>
      <Panel>
        <div style={{ padding: '16px 20px' }}>
          <div style={label()}>Ventas · 12 meses</div>
          <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 220, marginTop: 12 }} preserveAspectRatio="none">
            <defs><linearGradient id="dkev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACC} stopOpacity="0.35" /><stop offset="100%" stopColor={ACC} stopOpacity="0" /></linearGradient></defs>
            <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#dkev)" />
            <path d={path} fill="none" stroke={ACC} strokeWidth={2.5} style={{ filter: `drop-shadow(0 0 6px ${ACC})` }} />
          </svg>
        </div>
      </Panel>
    </>
  )
}

function Marcas() {
  const marcas = [{ n: 'Ninja Ramen & Katsu', v: '780 €', pct: 100, c: OK }, { n: 'La Cocina de Carmucha', v: '540 €', pct: 69, c: AMBAR }, { n: 'Pasta Manía Italiana', v: '470 €', pct: 60, c: CYAN }, { n: 'Greta la Green', v: '410 €', pct: 53, c: ACC }]
  return (
    <>
      <Titular><b style={{ color: PRI }}>Ninja Ramen</b> lidera con <b style={{ color: PRI, fontFamily: MONO }}>780 €</b>.</Titular>
      <Panel>
        {marcas.map((m, i) => (
          <div key={m.n} style={{ padding: '14px 22px', borderTop: i > 0 ? `1px solid ${BRD}55` : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14.5, color: PRI }}><span style={{ fontFamily: MONO, color: MUT, marginRight: 10 }}>{String(i + 1).padStart(2, '0')}</span>{m.n}</span>
              <span style={mono(PRI, 17)}>{m.v}</span>
            </div>
            <div style={{ height: 6, background: '#0a0e16', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${m.pct}%`, height: '100%', background: m.c, boxShadow: `0 0 9px ${m.c}99` }} /></div>
          </div>
        ))}
      </Panel>
    </>
  )
}
