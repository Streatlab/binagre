/**
 * Test Visual — Panel Global · diseño DARK OPERATIVO (creado desde cero).
 * Lenguaje: centro de control. Fondo profundo, datos que brillan,
 * tipografía técnica/mono, color solo ligado a estado, densidad ordenada.
 * Titular de estado + frases-titular en tono control. Datos de ejemplo.
 */
import { useState } from 'react'

const BG = '#0a0d14'
const PANEL = '#10141f'
const CARD = '#131826'
const BRD = '#1f2636'
const PRI = '#e6e9f2'
const SEC = '#9aa3b8'
const MUT = '#5d6678'
const OK = '#3ddc84'
const AMBAR = '#f5b13d'
const ROJO = '#ff5470'
const ACC = '#7c6cff'
const CYAN = '#38bdf8'
const OSW = "'Oswald', sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"
const LEX = "'Lexend', sans-serif"

const card: React.CSSProperties = { background: CARD, border: `1px solid ${BRD}`, borderRadius: 12 }
const label = (c = MUT): React.CSSProperties => ({ fontFamily: OSW, fontSize: 11, fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: c })
const num = (c = PRI, size = 30): React.CSSProperties => ({ fontFamily: MONO, fontSize: size, fontWeight: 600, color: c, letterSpacing: '-0.5px' })

const TABS = ['Resumen', 'Operaciones', 'Finanzas', 'Cashflow', 'Evolución', 'Marcas'] as const
type Tab = typeof TABS[number]

export default function PanelGlobalDark() {
  const [tab, setTab] = useState<Tab>('Resumen')
  return (
    <div style={{ minHeight: '100%', background: BG, padding: '20px 26px', fontFamily: LEX, color: PRI }}>
      {/* barra de estado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <span style={{ fontFamily: OSW, fontSize: 18, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Panel Global</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 12, color: OK, border: `1px solid ${OK}44`, background: `${OK}11`, borderRadius: 999, padding: '3px 11px' }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: OK, boxShadow: `0 0 8px ${OK}` }} /> OPERATIVO · +12,4% vs media 7d
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 12, color: MUT }}>23 jun 2026 · mes en curso</span>
      </div>

      {/* nav terminal */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20, borderBottom: `1px solid ${BRD}`, paddingBottom: 12 }}>
        {TABS.map(t => {
          const on = t === tab
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              fontFamily: OSW, fontSize: 12.5, fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase',
              padding: '6px 13px', borderRadius: 7, cursor: 'pointer',
              border: `1px solid ${on ? ACC : BRD}`, background: on ? `${ACC}22` : 'transparent', color: on ? PRI : SEC,
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

function titular(texto: React.ReactNode) {
  return (
    <div style={{ ...card, borderLeft: `3px solid ${ACC}`, padding: '16px 20px', marginBottom: 18 }}>
      <div style={{ fontSize: 16, color: SEC, lineHeight: 1.5 }}>{texto}</div>
    </div>
  )
}

function Kpi({ l, v, c, delta, size = 30 }: { l: string; v: string; c?: string; delta?: string; size?: number }) {
  return (
    <div style={{ ...card, padding: '16px 18px', flex: 1, minWidth: 150 }}>
      <div style={label()}>{l}</div>
      <div style={{ ...num(c, size), marginTop: 8, textShadow: c && c !== PRI ? `0 0 18px ${c}55` : 'none' }}>{v}</div>
      {delta && <div style={{ fontFamily: MONO, fontSize: 12, color: OK, marginTop: 6 }}>{delta}</div>}
    </div>
  )
}

function barra(pct: number, c: string) {
  return (
    <div style={{ height: 6, background: '#0c1019', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: c, boxShadow: `0 0 10px ${c}99` }} />
    </div>
  )
}

function Resumen() {
  const canales = [
    { n: 'UBER', pct: 41, c: OK }, { n: 'GLOVO', pct: 33, c: AMBAR },
    { n: 'JUST EAT', pct: 18, c: CYAN }, { n: 'WEB', pct: 8, c: ACC },
  ]
  return (
    <>
      {titular(<>Hoy <b style={{ color: PRI, fontFamily: MONO }}>2.847 €</b> en <b style={{ color: PRI, fontFamily: MONO }}>94</b> pedidos. Ritmo <b style={{ color: OK }}>+12,4%</b> sobre tu media. Sin incidencias.</>)}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <Kpi l="Ventas hoy" v="2.847 €" c={PRI} delta="▲ 12,4%" size={32} />
        <Kpi l="Pedidos" v="94" delta="▲ 9 vs ayer" />
        <Kpi l="Ticket medio" v="30,3 €" c={CYAN} />
        <Kpi l="Resultado" v="+713 €" c={OK} delta="25% s/ventas" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div style={{ ...card, padding: '18px 20px' }}>
          <div style={label()}>Reparto por canal</div>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {canales.map(c => (
              <div key={c.n}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 12.5, color: SEC, letterSpacing: '0.5px' }}>{c.n}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12.5, color: PRI }}>{c.pct}%</span>
                </div>
                {barra(c.pct, c.c)}
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...card, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={label(ROJO)}>Vigilar</div>
          <div style={{ ...num(ROJO, 30), marginTop: 8, textShadow: `0 0 18px ${ROJO}55` }}>34%</div>
          <div style={{ fontSize: 14, color: SEC, marginTop: 8, lineHeight: 1.5 }}>de comisión sobre ventas. Tu web (8%) es el canal que más margen libera.</div>
        </div>
      </div>
    </>
  )
}

function Operaciones() {
  const filas = [
    { c: 'Uber Eats', ped: 39, bru: '1.167 €', tk: '29,9 €', st: OK }, { c: 'Glovo', ped: 31, bru: '939 €', tk: '30,3 €', st: OK },
    { c: 'Just Eat', ped: 17, bru: '512 €', tk: '30,1 €', st: AMBAR }, { c: 'Web', ped: 7, bru: '229 €', tk: '32,7 €', st: ACC },
  ]
  return (
    <>
      {titular(<><b style={{ color: PRI, fontFamily: MONO }}>94</b> pedidos · <b style={{ color: OK }}>2%</b> cancelación · repetición <b style={{ color: PRI, fontFamily: MONO }}>22%</b>.</>)}
      <div style={{ ...card, padding: '6px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', padding: '10px 20px', borderBottom: `1px solid ${BRD}` }}>
          {['CANAL', 'PEDIDOS', 'BRUTO', 'TICKET'].map(h => <span key={h} style={label()}>{h}</span>)}
        </div>
        {filas.map(f => (
          <div key={f.c} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', padding: '13px 20px', borderBottom: `1px solid ${BRD}55`, alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: PRI, fontSize: 14 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: f.st, boxShadow: `0 0 8px ${f.st}` }} />{f.c}</span>
            <span style={{ fontFamily: MONO, color: PRI }}>{f.ped}</span>
            <span style={{ fontFamily: MONO, color: PRI }}>{f.bru}</span>
            <span style={{ fontFamily: MONO, color: SEC }}>{f.tk}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function Finanzas() {
  const pnl = [
    { n: 'Ventas netas', v: '+2.847 €', c: PRI }, { n: 'Food cost · 30%', v: '−854 €', c: ROJO },
    { n: 'Comisiones · 34%', v: '−968 €', c: ROJO }, { n: 'Laboral · 11%', v: '−312 €', c: ROJO },
    { n: 'Resultado neto', v: '+713 €', c: OK },
  ]
  return (
    <>
      {titular(<>De cada euro vendido te quedan <b style={{ color: OK }}>0,25 €</b> limpios tras costes.</>)}
      <div style={{ ...card, padding: '8px 0' }}>
        {pnl.map((r, i) => (
          <div key={r.n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px', borderTop: i > 0 ? `1px solid ${BRD}55` : 'none' }}>
            <span style={{ fontSize: 14.5, color: i === pnl.length - 1 ? PRI : SEC, fontWeight: i === pnl.length - 1 ? 600 : 400 }}>{r.n}</span>
            <span style={{ ...num(r.c, 20), textShadow: r.c !== PRI ? `0 0 14px ${r.c}44` : 'none' }}>{r.v}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function Cashflow() {
  const cobrar = [
    { n: 'UBER', v: '1.840 €', c: OK, pct: 44 }, { n: 'GLOVO', v: '1.210 €', c: AMBAR, pct: 29 },
    { n: 'JUST EAT', v: '760 €', c: CYAN, pct: 18 }, { n: 'WEB', v: '400 €', c: ACC, pct: 9 },
  ]
  return (
    <>
      {titular(<>Pendiente de cobro: <b style={{ color: PRI, fontFamily: MONO }}>4.210 €</b>. Uber concentra el <b style={{ color: OK }}>44%</b>.</>)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cobrar.map(c => (
          <div key={c.n} style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: SEC, width: 80 }}>{c.n}</span>
            <div style={{ flex: 1 }}>{barra(c.pct, c.c)}</div>
            <span style={{ ...num(PRI, 18), width: 90, textAlign: 'right' }}>{c.v}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function Evolucion() {
  const pts = [40, 52, 48, 63, 58, 72, 68, 81, 76, 88, 84, 95]
  const w = 600, h = 150, step = w / (pts.length - 1)
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (p / 100) * h}`).join(' ')
  return (
    <>
      {titular(<>Mes en curso <b style={{ color: PRI, fontFamily: MONO }}>74.200 €</b> · <b style={{ color: OK }}>+8,3%</b> vs mes anterior.</>)}
      <div style={{ ...card, padding: '18px 20px' }}>
        <div style={label()}>Ventas · 12 meses</div>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 190, marginTop: 12 }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="dkg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACC} stopOpacity="0.35" />
              <stop offset="100%" stopColor={ACC} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#dkg)" />
          <path d={path} fill="none" stroke={ACC} strokeWidth={2.5} style={{ filter: `drop-shadow(0 0 6px ${ACC})` }} />
        </svg>
      </div>
    </>
  )
}

function Marcas() {
  const marcas = [
    { n: 'Ninja Ramen & Katsu', v: 780, pct: 100, c: OK }, { n: 'La Cocina de Carmucha', v: 540, pct: 69, c: AMBAR },
    { n: 'Pasta Manía Italiana', v: 470, pct: 60, c: CYAN }, { n: 'Greta la Green', v: 410, pct: 53, c: ACC },
  ]
  return (
    <>
      {titular(<><b style={{ color: PRI }}>Ninja Ramen</b> lidera con <b style={{ color: PRI, fontFamily: MONO }}>780 €</b>.</>)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {marcas.map((m, i) => (
          <div key={m.n} style={{ ...card, padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14.5, color: PRI }}><span style={{ fontFamily: MONO, color: MUT, marginRight: 10 }}>{String(i + 1).padStart(2, '0')}</span>{m.n}</span>
              <span style={{ ...num(PRI, 17) }}>{m.v} €</span>
            </div>
            {barra(m.pct, m.c)}
          </div>
        ))}
      </div>
    </>
  )
}
