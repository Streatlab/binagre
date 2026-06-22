/**
 * Test Visual — Panel Global · estado ACTUAL.
 * Réplica visual del look actual del ERP (paleta Binagre real), para comparar
 * contra los dos diseños creados desde cero. Datos de ejemplo.
 */
import { useState } from 'react'
import { SKIN_ACTUAL as s, cardStyle, lbl, kpi } from '../skins'

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
            <span key={c} style={{ padding: '6px 12px', borderRadius: 9, background: s.cardBg, border: `${s.cardBrdW} solid ${s.cardBrd}`, color: s.textSec, fontSize: 12.5 }}>{c} ▾</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'inline-flex', gap: 4, padding: '4px 6px', borderRadius: 10, background: s.tabContainerBg, border: `${s.cardBrdW} solid ${s.tabContainerBrd}`, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const on = t === tab
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 13px', borderRadius: 6, cursor: 'pointer', fontFamily: s.fontBody, fontSize: 13, fontWeight: on ? 600 : 500,
              border: on ? 'none' : `${s.cardBrdW} solid ${s.tabInactiveBrd}`,
              background: on ? s.tabActiveBg : s.tabInactiveBg, color: on ? s.tabActiveColor : s.tabInactiveColor,
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

function KpiCard({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div style={{ ...cardStyle(s), flex: 1, minWidth: 150 }}>
      <div style={lbl(s, 11)}>{label}</div>
      <div style={{ ...kpi(s, 34), marginTop: 8 }}>{value}</div>
      {delta && <div style={{ fontSize: 12.5, marginTop: 6, color: s.ok, fontWeight: 600 }}>{delta}</div>}
    </div>
  )
}
function Barra({ pct, color }: { pct: number; color: string }) {
  return <div style={{ height: 8, borderRadius: 4, background: s.barTrack, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} /></div>
}
function Badge({ txt, bg, color }: { txt: string; bg: string; color: string }) {
  return <span style={{ fontFamily: s.fontTitle, fontSize: 9, fontWeight: 600, letterSpacing: '0.5px', padding: '1px 6px', borderRadius: 3, background: bg, color }}>{txt}</span>
}

function Resumen() {
  const canales = [{ n: 'Uber Eats', pct: 41, c: s.uber }, { n: 'Glovo', pct: 33, c: s.glovo }, { n: 'Just Eat', pct: 18, c: s.je }, { n: 'Web', pct: 8, c: s.web }]
  const gastos = [{ n: 'Food cost', pct: 30, c: s.warn }, { n: 'Comisiones', pct: 34, c: s.accent }, { n: 'Laboral', pct: 11, c: s.uber }]
  const top = [
    { p: 'Ramen Tonkotsu', m: 'Ninja Ramen', cn: 'UE', cb: s.uber, ct: '#fff', v: '780 €' },
    { p: 'Croquetas caseras', m: 'La Carmucha', cn: 'GL', cb: s.glovo, ct: s.glovoText, v: '540 €' },
    { p: 'Carbonara', m: 'Pasta Manía', cn: 'JE', cb: s.je, ct: '#fff', v: '470 €' },
    { p: 'Bowl Green', m: 'Greta', cn: 'WEB', cb: s.web, ct: '#fff', v: '410 €' },
  ]
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <KpiCard label="Ventas" value="2.847 €" delta="▲ 12,4% vs media 7d" />
        <KpiCard label="Pedidos · Ticket" value="94" delta="Ticket 30,3 €" />
        <KpiCard label="Resultado" value="+713 €" delta="▲ neto positivo" />
        <KpiCard label="Prime cost" value="64 %" delta="en rango" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14, marginBottom: 14 }}>
        <div style={cardStyle(s)}>
          <div style={lbl(s)}>Facturación por canal</div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {canales.map(c => (<div key={c.n}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: s.textSec, marginBottom: 5 }}><span>{c.n}</span><span style={{ fontWeight: 600, color: s.textPri }}>{c.pct}%</span></div><Barra pct={c.pct} color={c.c} /></div>))}
          </div>
        </div>
        <div style={cardStyle(s)}>
          <div style={lbl(s)}>Grupos de gasto</div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {gastos.map(g => (<div key={g.n}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: s.textSec, marginBottom: 5 }}><span>{g.n}</span><span style={{ fontWeight: 600, color: s.textPri }}>{g.pct}%</span></div><Barra pct={g.pct} color={g.c} /></div>))}
          </div>
        </div>
        <div style={cardStyle(s)}>
          <div style={lbl(s)}>Salud OCR</div>
          <div style={{ ...kpi(s, 30), marginTop: 10, color: s.ok }}>97 %</div>
          <div style={{ fontSize: 12.5, color: s.textMut, marginTop: 8 }}>3 facturas pendientes</div>
        </div>
      </div>
      <div style={cardStyle(s)}>
        <div style={lbl(s)}>Top ventas</div>
        <div style={{ marginTop: 12 }}>
          {top.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < top.length - 1 ? `${s.cardBrdW} solid ${s.cardBrd}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge txt={t.cn} bg={t.cb} color={t.ct} />
                <div><div style={{ fontSize: 13.5, color: s.textPri, fontWeight: 500 }}>{t.p}</div><div style={{ fontSize: 11.5, color: s.textMut }}>{t.m}</div></div>
              </div>
              <div style={{ fontFamily: s.fontTitle, fontSize: 16, fontWeight: 600, color: s.textPri }}>{t.v}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function Operaciones() {
  const filas = [{ c: 'Uber Eats', cb: s.uber, ct: '#fff', ped: 39, bru: '1.167 €', tk: '29,9 €' }, { c: 'Glovo', cb: s.glovo, ct: s.glovoText, ped: 31, bru: '939 €', tk: '30,3 €' }, { c: 'Just Eat', cb: s.je, ct: '#fff', ped: 17, bru: '512 €', tk: '30,1 €' }, { c: 'Web', cb: s.web, ct: '#fff', ped: 7, bru: '229 €', tk: '32,7 €' }]
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <KpiCard label="Pedidos" value="94" /><KpiCard label="Ticket medio" value="30,3 €" /><KpiCard label="Cancelaciones" value="2 %" /><KpiCard label="Repetición" value="22 %" />
      </div>
      <div style={cardStyle(s)}>
        <div style={lbl(s)}>Detalle por canal</div>
        <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left' }}>{['Canal', 'Pedidos', 'Bruto', 'Ticket'].map(h => <th key={h} style={{ fontFamily: s.fontTitle, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: s.textMut, padding: '8px 6px', fontWeight: 500 }}>{h}</th>)}</tr></thead>
          <tbody>{filas.map((f, i) => (<tr key={i} style={{ borderTop: `${s.cardBrdW} solid ${s.cardBrd}` }}><td style={{ padding: '10px 6px' }}><Badge txt={f.c} bg={f.cb} color={f.ct} /></td><td style={{ padding: '10px 6px', color: s.textPri, fontSize: 13.5 }}>{f.ped}</td><td style={{ padding: '10px 6px', color: s.textPri, fontSize: 13.5, fontWeight: 600 }}>{f.bru}</td><td style={{ padding: '10px 6px', color: s.textSec, fontSize: 13.5 }}>{f.tk}</td></tr>))}</tbody>
        </table>
      </div>
    </>
  )
}

function Finanzas() {
  const pnl = [{ n: 'Ventas netas', v: '+2.847 €', c: s.textPri, b: true }, { n: 'Food cost (30%)', v: '−854 €', c: s.err }, { n: 'Comisiones (34%)', v: '−968 €', c: s.err }, { n: 'Laboral (11%)', v: '−312 €', c: s.err }, { n: 'Resultado neto', v: '+713 €', c: s.ok, b: true }]
  return (
    <div style={cardStyle(s)}>
      <div style={lbl(s)}>Cuenta de resultados</div>
      <div style={{ marginTop: 12 }}>{pnl.map((r, i) => (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderTop: i > 0 ? `${s.cardBrdW} solid ${s.cardBrd}` : 'none' }}><span style={{ fontSize: 14, color: r.b ? s.textPri : s.textSec, fontWeight: r.b ? 700 : 400 }}>{r.n}</span><span style={{ fontFamily: s.fontTitle, fontSize: 16, fontWeight: 600, color: r.c }}>{r.v}</span></div>))}</div>
    </div>
  )
}

function Cashflow() {
  const cobrar = [{ n: 'Uber Eats', v: '1.840 €', c: s.uber }, { n: 'Glovo', v: '1.210 €', c: s.glovo }, { n: 'Just Eat', v: '760 €', c: s.je }, { n: 'Web', v: '400 €', c: s.web }]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
      {cobrar.map(c => (<div key={c.n} style={cardStyle(s)}><div style={lbl(s, 11)}>{c.n}</div><div style={{ ...kpi(s, 28), marginTop: 8, color: c.c === s.glovo ? s.textPri : c.c }}>{c.v}</div><div style={{ fontSize: 12, color: s.textMut, marginTop: 6 }}>por cobrar</div></div>))}
    </div>
  )
}

function Evolucion() {
  const pts = [40, 52, 48, 63, 58, 72, 68, 81, 76, 88, 84, 95]
  const w = 600, h = 150, step = w / (pts.length - 1)
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (p / 100) * h}`).join(' ')
  return (
    <div style={cardStyle(s)}>
      <div style={lbl(s)}>Evolución de ventas · 12 meses</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 180, marginTop: 14 }} preserveAspectRatio="none">
        <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={s.accentSoft} /><path d={path} fill="none" stroke={s.accent} strokeWidth={2.5} />
      </svg>
    </div>
  )
}

function Marcas() {
  const marcas = [{ n: 'Ninja Ramen & Katsu', v: 780, pct: 100, c: s.uber }, { n: 'La Cocina de Carmucha', v: 540, pct: 69, c: s.accent }, { n: 'Pasta Manía Italiana', v: 470, pct: 60, c: s.je }, { n: 'Greta la Green', v: 410, pct: 53, c: s.web }]
  return (
    <div style={cardStyle(s)}>
      <div style={lbl(s)}>Ranking de marcas · ventas del periodo</div>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>{marcas.map(m => (<div key={m.n}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 14, color: s.textPri, fontWeight: 500 }}>{m.n}</span><span style={{ fontFamily: s.fontTitle, fontSize: 16, fontWeight: 600, color: s.textPri }}>{m.v} €</span></div><Barra pct={m.pct} color={m.c === s.glovo ? s.je : m.c} /></div>))}</div>
    </div>
  )
}
