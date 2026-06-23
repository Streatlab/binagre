/**
 * Test Visual — Panel Global · estado ACTUAL (foto fija).
 * Replica la ESTRUCTURA REAL del Panel Global: pestaña Resumen = rejilla 3×4
 * (Ventas · Pedidos/Ticket · Resultado / Facturación canal · Grupos gasto ·
 * Días pico / Saldo · Ratio · Punto equilibrio / Provisiones · Top ventas).
 * Look Binagre real. Datos de ejemplo.
 */
import { useState } from 'react'
import { SKIN_ACTUAL as s } from '../skins'

const card: React.CSSProperties = { background: s.cardBg, border: `${s.cardBrdW} solid ${s.cardBrd}`, borderRadius: 14, padding: '16px 18px' }
const lab: React.CSSProperties = { fontFamily: s.fontTitle, fontSize: 12, fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: s.textMut }
const big = (c = s.textPri, size = 34): React.CSSProperties => ({ fontFamily: s.fontTitle, fontSize: size, fontWeight: 600, color: c, lineHeight: 1 })
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }

const TABS = ['Resumen', 'Operaciones', 'Finanzas', 'Cashflow', 'Evolución', 'Marcas'] as const
type Tab = typeof TABS[number]

export default function PanelGlobalActual() {
  const [tab, setTab] = useState<Tab>('Resumen')
  return (
    <div style={{ minHeight: '100%', background: s.pageBg, padding: '24px 28px', fontFamily: s.fontBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: s.fontTitle, fontSize: 22, fontWeight: 600, color: s.title, letterSpacing: '3px', textTransform: 'uppercase' }}>Panel Global</div>
          <div style={{ fontSize: 13, color: s.textMut, marginTop: 3 }}>Mes en curso · 1 abr 2026 — 30 abr 2026</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Mes en curso', 'Todas las marcas', 'Canales'].map(c => (
            <span key={c} style={{ padding: '6px 10px', borderRadius: 8, background: s.cardBg, border: `${s.cardBrdW} solid ${s.cardBrd}`, color: s.textSec, fontSize: 13 }}>{c} ▾</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'inline-flex', gap: 4, padding: '4px 6px', borderRadius: 10, background: s.cardBg, border: `${s.cardBrdW} solid ${s.cardBrd}`, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const on = t === tab
          return <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 13px', borderRadius: 6, cursor: 'pointer', fontFamily: s.fontBody, fontSize: 13, fontWeight: 500, border: on ? 'none' : `${s.cardBrdW} solid ${s.cardBrd}`, background: on ? s.accent : 'transparent', color: on ? '#fff' : s.textSec }}>{t}</button>
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

function Delta({ v, ok = true }: { v: string; ok?: boolean }) {
  return <span style={{ fontSize: 12.5, fontWeight: 600, color: ok ? s.ok : s.err }}>{v}</span>
}
function MiniBar({ pct, c, h = 6 }: { pct: number; c: string; h?: number }) {
  return <div style={{ height: h, background: s.barTrack, borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 3 }} /></div>
}
function row(l: string, r: React.ReactNode) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: s.textSec, padding: '3px 0' }}><span>{l}</span><span style={{ color: s.textPri, fontWeight: 600 }}>{r}</span></div>
}

function Resumen() {
  const canales = [{ n: 'Uber Eats', pct: 41, c: s.uber }, { n: 'Glovo', pct: 33, c: s.glovo }, { n: 'Just Eat', pct: 18, c: s.je }, { n: 'Web', pct: 8, c: s.web }, { n: 'Directa', pct: 0, c: '#66aaff' }]
  const grupos = [{ n: 'Producto', pct: 28, pres: 'pres. 30%' }, { n: 'Equipo', pct: 32, pres: 'pres. 32%' }, { n: 'Local', pct: 7, pres: 'pres. 7%' }, { n: 'Controlables', pct: 15, pres: 'pres. 15%' }]
  const dias = [{ d: 'Lun', v: 55, c: '#1E5BCC' }, { d: 'Mar', v: 48, c: s.uber }, { d: 'Mié', v: 62, c: s.je }, { d: 'Jue', v: 70, c: s.web }, { d: 'Vie', v: 95, c: '#66aaff' }, { d: 'Sáb', v: 100, c: '#F26B1F' }, { d: 'Dom', v: 88, c: '#1D9E75' }]
  const top = [{ p: 'Ramen Tonkotsu', cn: 'UE', cb: s.uber, ct: '#fff', v: '780 €' }, { p: 'Croquetas caseras', cn: 'GL', cb: s.glovo, ct: s.glovoText, v: '540 €' }, { p: 'Carbonara', cn: 'JE', cb: s.je, ct: '#fff', v: '470 €' }, { p: 'Bowl Green', cn: 'WEB', cb: s.web, ct: '#fff', v: '410 €' }]
  return (
    <>
      {/* fila 1 */}
      <div style={grid3}>
        <div style={card}>
          <div style={lab}>Ventas</div>
          <div style={{ ...big(), marginTop: 8 }}>2.847 €</div>
          <div style={{ marginTop: 4 }}><Delta v="▲ 12,4% vs periodo anterior" /></div>
          <div style={{ fontSize: 12, color: s.textMut, marginTop: 8 }}>Neto estimado 1.880 €</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div>{row('Semana', '68%')}<MiniBar pct={68} c={s.ok} /></div>
            <div>{row('Mes', '42%')}<MiniBar pct={42} c={s.warn} /></div>
            <div>{row('Año', '31%')}<MiniBar pct={31} c={s.accent} /></div>
          </div>
        </div>
        <div style={card}>
          <div style={lab}>Pedidos · Ticket</div>
          <div style={{ ...big(), marginTop: 8 }}>94</div>
          <div style={{ marginTop: 4 }}><Delta v="▲ 9 vs anterior" /></div>
          <div style={{ marginTop: 10 }}>
            {row('Ticket bruto', '30,3 €')}
            {row('Ticket neto', '20,1 €')}
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {canales.slice(0, 4).map(c => <div key={c.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 11.5, color: s.textMut, width: 64 }}>{c.n}</span><div style={{ flex: 1 }}><MiniBar pct={c.pct} c={c.c} h={5} /></div></div>)}
          </div>
        </div>
        <div style={card}>
          <div style={lab}>Resultado periodo</div>
          <div style={{ ...big(s.ok), marginTop: 8 }}>+713 €</div>
          <div style={{ marginTop: 4 }}><Delta v="margen 25%" /></div>
          <div style={{ marginTop: 10 }}>
            {row('Prime cost', '64%')}
            {row('Food cost', '30%')}
            {row('Coste laboral', '11%')}
            {row('Gastos periodo', '2.134 €')}
          </div>
        </div>
      </div>

      {/* fila 2 */}
      <div style={grid3}>
        <div style={card}>
          <div style={lab}>Facturación por canal</div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {canales.map(c => <div key={c.n}>{row(c.n, `${c.pct}%`)}<MiniBar pct={c.pct} c={c.c} /></div>)}
          </div>
        </div>
        <div style={card}>
          <div style={lab}>Grupos de gasto</div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {grupos.map(g => <div key={g.n}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: s.textSec }}><span>{g.n}</span><span style={{ color: s.textPri, fontWeight: 600 }}>{g.pct}% · <span style={{ color: s.textMut, fontWeight: 400 }}>{g.pres}</span></span></div><div style={{ marginTop: 4 }}><MiniBar pct={g.pct * 2.6} c={s.ok} /></div></div>)}
          </div>
        </div>
        <div style={card}>
          <div style={lab}>Días pico · abril</div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
            {dias.map(d => <div key={d.d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}><div style={{ width: '100%', height: d.v, background: d.c, borderRadius: 4 }} /><span style={{ fontSize: 10.5, color: s.textMut }}>{d.d}</span></div>)}
          </div>
          <div style={{ fontSize: 11.5, color: s.textMut, marginTop: 8 }}>Media diaria 2.473 €</div>
        </div>
      </div>

      {/* fila 3 */}
      <div style={grid3}>
        <div style={card}>
          <div style={lab}>Saldo bancario</div>
          <div style={{ ...big(), marginTop: 8 }}>18.420 €</div>
          <div style={{ marginTop: 10 }}>
            {row('Cobros 7 d', '+6.240 €')}
            {row('Pagos 7 d', '−3.110 €')}
            {row('Cobros 30 d', '+24.800 €')}
            {row('Pagos 30 d', '−19.400 €')}
          </div>
        </div>
        <div style={card}>
          <div style={lab}>Ratio ingresos / gastos</div>
          <div style={{ ...big(s.ok), marginTop: 8 }}>2,8×</div>
          <div style={{ marginTop: 4 }}><Delta v="objetivo 2,5× · OK" /></div>
          <div style={{ marginTop: 12 }}><MiniBar pct={88} c={s.ok} h={8} /></div>
          <div style={{ fontSize: 11.5, color: s.textMut, marginTop: 8 }}>Ingresos 1.880 € · Gastos 670 €</div>
        </div>
        <div style={card}>
          <div style={lab}>Punto de equilibrio</div>
          <div style={{ ...big(), marginTop: 8 }}>78%</div>
          <div style={{ marginTop: 4 }}><Delta v="día verde estimado · vie 26" /></div>
          <div style={{ marginTop: 12 }}><MiniBar pct={78} c={s.warn} h={8} /></div>
          <div style={{ fontSize: 11.5, color: s.textMut, marginTop: 8 }}>Acumulado 18.500 € / 23.700 €</div>
        </div>
      </div>

      {/* fila 4 */}
      <div style={{ ...grid3, marginBottom: 0 }}>
        <div style={card}>
          <div style={lab}>A guardar · IVA + IRPF</div>
          <div style={{ ...big(s.warn), marginTop: 8 }}>1.240 €</div>
          <div style={{ marginTop: 10 }}>
            {row('IVA', '980 €')}
            {row('IRPF alquiler', '260 €')}
            <div style={{ height: 1, background: s.cardBrd, margin: '8px 0' }} />
            {row('Próx. Alquiler', '1.450 €')}
            {row('Próx. Gestoría', '180 €')}
          </div>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={lab}>Top ventas</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: '#3a4050', color: '#fff' }}>Productos</span>
              <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: s.cardBg, border: `${s.cardBrdW} solid ${s.cardBrd}`, color: s.textMut }}>Modificadores</span>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            {top.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < top.length - 1 ? `${s.cardBrdW} solid ${s.cardBrd}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: s.fontTitle, fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: t.cb, color: t.ct }}>{t.cn}</span>
                  <span style={{ fontSize: 13, color: s.textPri }}>{t.p}</span>
                </div>
                <span style={{ fontFamily: s.fontTitle, fontSize: 15, fontWeight: 600, color: s.textPri }}>{t.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div />
      </div>
    </>
  )
}

/* ── otras pestañas (estructura del módulo real) ── */
function Operaciones() {
  const filas = [{ c: 'Uber Eats', cb: s.uber, ct: '#fff', ped: 39, bru: '1.167 €', tk: '29,9 €' }, { c: 'Glovo', cb: s.glovo, ct: s.glovoText, ped: 31, bru: '939 €', tk: '30,3 €' }, { c: 'Just Eat', cb: s.je, ct: '#fff', ped: 17, bru: '512 €', tk: '30,1 €' }, { c: 'Web', cb: s.web, ct: '#fff', ped: 7, bru: '229 €', tk: '32,7 €' }]
  return (
    <>
      <div style={grid3}>
        <div style={card}><div style={lab}>Pedidos</div><div style={{ ...big(), marginTop: 8 }}>94</div></div>
        <div style={card}><div style={lab}>Ticket medio</div><div style={{ ...big(), marginTop: 8 }}>30,3 €</div></div>
        <div style={card}><div style={lab}>Repetición</div><div style={{ ...big(), marginTop: 8 }}>22 %</div></div>
      </div>
      <div style={card}>
        <div style={lab}>Detalle por canal</div>
        <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left' }}>{['Canal', 'Pedidos', 'Bruto', 'Ticket'].map(h => <th key={h} style={{ ...lab, fontSize: 11, padding: '8px 6px' }}>{h}</th>)}</tr></thead>
          <tbody>{filas.map((f, i) => <tr key={i} style={{ borderTop: `${s.cardBrdW} solid ${s.cardBrd}` }}><td style={{ padding: '10px 6px' }}><span style={{ fontFamily: s.fontTitle, fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: f.cb, color: f.ct }}>{f.c}</span></td><td style={{ padding: '10px 6px', color: s.textPri, fontSize: 13.5 }}>{f.ped}</td><td style={{ padding: '10px 6px', color: s.textPri, fontSize: 13.5, fontWeight: 600 }}>{f.bru}</td><td style={{ padding: '10px 6px', color: s.textSec, fontSize: 13.5 }}>{f.tk}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  )
}
function Finanzas() {
  const pnl = [{ n: 'Ventas netas', v: '+2.847 €', c: s.textPri, b: true }, { n: 'Food cost (30%)', v: '−854 €', c: s.err }, { n: 'Comisiones (34%)', v: '−968 €', c: s.err }, { n: 'Laboral (11%)', v: '−312 €', c: s.err }, { n: 'Resultado neto', v: '+713 €', c: s.ok, b: true }]
  return <div style={card}><div style={lab}>Cuenta de resultados</div><div style={{ marginTop: 12 }}>{pnl.map((r, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderTop: i > 0 ? `${s.cardBrdW} solid ${s.cardBrd}` : 'none' }}><span style={{ fontSize: 14, color: r.b ? s.textPri : s.textSec, fontWeight: r.b ? 700 : 400 }}>{r.n}</span><span style={{ fontFamily: s.fontTitle, fontSize: 16, fontWeight: 600, color: r.c }}>{r.v}</span></div>)}</div></div>
}
function Cashflow() {
  const c = [{ n: 'Uber Eats', v: '1.840 €', c: s.uber }, { n: 'Glovo', v: '1.210 €', c: s.glovo }, { n: 'Just Eat', v: '760 €', c: s.je }, { n: 'Web', v: '400 €', c: s.web }]
  return <div style={grid3}>{c.map(x => <div key={x.n} style={card}><div style={lab}>{x.n}</div><div style={{ ...big(x.c === s.glovo ? s.textPri : x.c, 28), marginTop: 8 }}>{x.v}</div><div style={{ fontSize: 12, color: s.textMut, marginTop: 6 }}>por cobrar</div></div>)}</div>
}
function Evolucion() {
  const pts = [40, 52, 48, 63, 58, 72, 68, 81, 76, 88, 84, 95]; const w = 600, h = 150, step = w / (pts.length - 1)
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (p / 100) * h}`).join(' ')
  return <div style={card}><div style={lab}>Evolución de ventas · 12 meses</div><svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 180, marginTop: 14 }} preserveAspectRatio="none"><path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={s.accentSoft} /><path d={path} fill="none" stroke={s.accent} strokeWidth={2.5} /></svg></div>
}
function Marcas() {
  const m = [{ n: 'Ninja Ramen & Katsu', v: 780, pct: 100, c: s.uber }, { n: 'La Cocina de Carmucha', v: 540, pct: 69, c: s.accent }, { n: 'Pasta Manía Italiana', v: 470, pct: 60, c: s.je }, { n: 'Greta la Green', v: 410, pct: 53, c: s.web }]
  return <div style={card}><div style={lab}>Ranking de marcas · ventas del periodo</div><div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>{m.map(x => <div key={x.n}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 14, color: s.textPri, fontWeight: 500 }}>{x.n}</span><span style={{ fontFamily: s.fontTitle, fontSize: 16, fontWeight: 600, color: s.textPri }}>{x.v} €</span></div><MiniBar pct={x.pct} c={x.c === s.glovo ? s.je : x.c} h={8} /></div>)}</div></div>
}
