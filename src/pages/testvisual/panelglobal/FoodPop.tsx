/**
 * Test Visual — Panel Global · diseño FOOD POP (creado desde cero).
 * Lenguaje: apetito + energía. Titular protagonista, color saturado cálido,
 * bloques rotundos con borde grueso y sombra dura, jerarquía descarada.
 * Frases-titular integradas. Datos de ejemplo.
 */
import { useState } from 'react'

const INK = '#1A1206'
const CREMA = '#FFF3DF'
const ROSA = '#FF2E6E'
const AMA = '#FFC53D'
const VERDE = '#16B364'
const NAR = '#FF6B2C'
const AZUL = '#3E6DFF'
const OSW = "'Oswald', sans-serif"
const LEX = "'Lexend', sans-serif"

const box = (bg: string): React.CSSProperties => ({
  background: bg, border: `3px solid ${INK}`, borderRadius: 18, boxShadow: `6px 6px 0 ${INK}`,
})
const sticker = (bg: string): React.CSSProperties => ({
  display: 'inline-block', background: bg, color: INK, border: `2px solid ${INK}`,
  borderRadius: 999, padding: '3px 12px', fontFamily: OSW, fontWeight: 600,
  fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase',
})

const TABS = ['Resumen', 'Operaciones', 'Finanzas', 'Cashflow', 'Evolución', 'Marcas'] as const
type Tab = typeof TABS[number]

export default function PanelGlobalFoodPop() {
  const [tab, setTab] = useState<Tab>('Resumen')
  return (
    <div style={{ minHeight: '100%', background: CREMA, padding: '26px 30px', fontFamily: LEX, color: INK }}>
      {/* cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: OSW, fontSize: 34, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Panel Global</span>
          <span style={sticker(AMA)}>Hoy · 23 jun</span>
        </div>
        <span style={{ ...sticker(CREMA), boxShadow: `3px 3px 0 ${INK}` }}>Todas las marcas ▾</span>
      </div>

      {/* nav chunky */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        {TABS.map(t => {
          const on = t === tab
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              fontFamily: OSW, fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
              padding: '8px 16px', borderRadius: 999, cursor: 'pointer', border: `2.5px solid ${INK}`,
              background: on ? ROSA : '#fff', color: on ? '#fff' : INK,
              boxShadow: on ? `4px 4px 0 ${INK}` : 'none',
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

function Resumen() {
  const canales = [
    { n: 'Uber Eats', pct: 41, c: VERDE }, { n: 'Glovo', pct: 33, c: AMA },
    { n: 'Just Eat', pct: 18, c: NAR }, { n: 'Web', pct: 8, c: ROSA },
  ]
  const marcas = [
    { n: 'Ninja Ramen', v: 780, pct: 100, c: ROSA }, { n: 'La Carmucha', v: 540, pct: 69, c: AMA },
    { n: 'Pasta Manía', v: 470, pct: 60, c: AZUL }, { n: 'Greta', v: 410, pct: 53, c: VERDE },
  ]
  return (
    <>
      {/* HERO titular */}
      <div style={{ ...box(AMA), padding: '26px 30px', marginBottom: 20 }}>
        <div style={sticker('#fff')}>Ventas de hoy</div>
        <div style={{ fontFamily: OSW, fontSize: 88, fontWeight: 700, lineHeight: 0.95, margin: '10px 0 6px' }}>2.847&nbsp;€</div>
        <div style={{ fontSize: 20, fontWeight: 600, maxWidth: 640 }}>
          Vas un <span style={{ background: VERDE, color: '#fff', padding: '0 8px', borderRadius: 6 }}>+12,4 %</span> por encima de tu media de la semana. Buen día.
        </div>
      </div>

      {/* píldoras KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 20 }}>
        {[
          { l: 'Pedidos', v: '94', c: ROSA, tc: '#fff' },
          { l: 'Ticket medio', v: '30,3 €', c: VERDE, tc: '#fff' },
          { l: 'Resultado', v: '+713 €', c: NAR, tc: '#fff' },
          { l: 'Repetición', v: '22 %', c: AZUL, tc: '#fff' },
        ].map(k => (
          <div key={k.l} style={{ ...box(k.c), padding: '18px 20px', color: k.tc }}>
            <div style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.95 }}>{k.l}</div>
            <div style={{ fontFamily: OSW, fontSize: 42, fontWeight: 700, lineHeight: 1, marginTop: 6 }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* canales + banda titular */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ ...box('#fff'), padding: '22px 24px' }}>
          <div style={sticker(AMA)}>Por dónde entra</div>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {canales.map(c => (
              <div key={c.n}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: 6 }}><span>{c.n}</span><span>{c.pct}%</span></div>
                <div style={{ height: 18, border: `2.5px solid ${INK}`, borderRadius: 999, background: CREMA, overflow: 'hidden' }}>
                  <div style={{ width: `${c.pct}%`, height: '100%', background: c.c }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...box(ROSA), padding: '24px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: OSW, fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>Las comisiones se comen <span style={{ background: '#fff', color: ROSA, padding: '0 8px', borderRadius: 6 }}>1 de cada 3 €</span> que facturas.</div>
          <div style={{ marginTop: 12, fontSize: 15, opacity: 0.95 }}>Tu web solo trae el 8 %. Ahí está el margen.</div>
        </div>
      </div>

      {/* marcas */}
      <div style={{ ...box('#fff'), padding: '22px 24px' }}>
        <div style={sticker(VERDE)}>Tus marcas hoy</div>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {marcas.map(m => (
            <div key={m.n}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{m.n}</span>
                <span style={{ fontFamily: OSW, fontSize: 22, fontWeight: 700 }}>{m.v} €</span>
              </div>
              <div style={{ height: 16, border: `2.5px solid ${INK}`, borderRadius: 999, background: CREMA, overflow: 'hidden' }}>
                <div style={{ width: `${m.pct}%`, height: '100%', background: m.c }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function bandaTitular(texto: React.ReactNode, bg: string, tc: string) {
  return (
    <div style={{ ...box(bg), padding: '24px 28px', color: tc, marginBottom: 20 }}>
      <div style={{ fontFamily: OSW, fontSize: 26, fontWeight: 700, lineHeight: 1.15 }}>{texto}</div>
    </div>
  )
}

function Operaciones() {
  const filas = [
    { c: 'Uber Eats', ped: 39, tk: '29,9 €', cc: VERDE }, { c: 'Glovo', ped: 31, tk: '30,3 €', cc: AMA },
    { c: 'Just Eat', ped: 17, tk: '30,1 €', cc: NAR }, { c: 'Web', ped: 7, tk: '32,7 €', cc: ROSA },
  ]
  return (
    <>
      {bandaTitular(<>Hoy llevas <span style={{ background: '#fff', color: NAR, padding: '0 8px', borderRadius: 6 }}>94 pedidos</span> y solo 2 cancelaciones.</>, NAR, '#fff')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
        {filas.map(f => (
          <div key={f.c} style={{ ...box('#fff'), padding: '18px 20px' }}>
            <span style={sticker(f.cc)}>{f.c}</span>
            <div style={{ fontFamily: OSW, fontSize: 40, fontWeight: 700, marginTop: 10 }}>{f.ped}</div>
            <div style={{ fontWeight: 600, color: '#6b5d45' }}>pedidos · ticket {f.tk}</div>
          </div>
        ))}
      </div>
    </>
  )
}

function Finanzas() {
  const pnl = [
    { n: 'Ventas', v: '+2.847 €', c: VERDE }, { n: 'Food cost', v: '−854 €', c: NAR },
    { n: 'Comisiones', v: '−968 €', c: ROSA }, { n: 'Laboral', v: '−312 €', c: AZUL },
  ]
  return (
    <>
      {bandaTitular(<>De cada venta, te quedan <span style={{ background: '#fff', color: VERDE, padding: '0 8px', borderRadius: 6 }}>25 céntimos</span> limpios.</>, VERDE, '#fff')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 20 }}>
        {pnl.map(r => (
          <div key={r.n} style={{ ...box('#fff'), padding: '18px 20px' }}>
            <div style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#6b5d45' }}>{r.n}</div>
            <div style={{ fontFamily: OSW, fontSize: 34, fontWeight: 700, marginTop: 6, color: r.c }}>{r.v}</div>
          </div>
        ))}
      </div>
      <div style={{ ...box(AMA), padding: '22px 26px' }}>
        <div style={{ fontFamily: OSW, fontSize: 15, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Resultado neto</div>
        <div style={{ fontFamily: OSW, fontSize: 56, fontWeight: 700, lineHeight: 1, marginTop: 4 }}>+713 €</div>
      </div>
    </>
  )
}

function Cashflow() {
  const cobrar = [
    { n: 'Uber Eats', v: '1.840 €', c: VERDE }, { n: 'Glovo', v: '1.210 €', c: AMA },
    { n: 'Just Eat', v: '760 €', c: NAR }, { n: 'Web', v: '400 €', c: ROSA },
  ]
  return (
    <>
      {bandaTitular(<>Te deben <span style={{ background: '#fff', color: ROSA, padding: '0 8px', borderRadius: 6 }}>4.210 €</span>. Uber concentra casi la mitad.</>, ROSA, '#fff')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16 }}>
        {cobrar.map(c => (
          <div key={c.n} style={{ ...box('#fff'), padding: '18px 20px' }}>
            <span style={sticker(c.c)}>{c.n}</span>
            <div style={{ fontFamily: OSW, fontSize: 34, fontWeight: 700, marginTop: 10 }}>{c.v}</div>
            <div style={{ fontWeight: 600, color: '#6b5d45' }}>por cobrar</div>
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
      {bandaTitular(<>Este mes facturas <span style={{ background: '#fff', color: AZUL, padding: '0 8px', borderRadius: 6 }}>74.200 €</span>, un 8,3 % más que el anterior.</>, AZUL, '#fff')}
      <div style={{ ...box('#fff'), padding: '22px 24px' }}>
        <div style={sticker(AMA)}>Ventas · 12 meses</div>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 190, marginTop: 14 }} preserveAspectRatio="none">
          <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={`${ROSA}22`} />
          <path d={path} fill="none" stroke={ROSA} strokeWidth={4} strokeLinejoin="round" />
        </svg>
      </div>
    </>
  )
}

function Marcas() {
  const marcas = [
    { n: 'Ninja Ramen & Katsu', v: 780, pct: 100, c: ROSA }, { n: 'La Cocina de Carmucha', v: 540, pct: 69, c: AMA },
    { n: 'Pasta Manía Italiana', v: 470, pct: 60, c: AZUL }, { n: 'Greta la Green', v: 410, pct: 53, c: VERDE },
  ]
  return (
    <>
      {bandaTitular(<><span style={{ background: '#fff', color: ROSA, padding: '0 8px', borderRadius: 6 }}>Ninja Ramen</span> es tu marca estrella hoy.</>, ROSA, '#fff')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {marcas.map((m, i) => (
          <div key={m.n} style={{ ...box(i === 0 ? AMA : '#fff'), padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontFamily: OSW, fontSize: 30, fontWeight: 700, opacity: 0.5 }}>{i + 1}</span>
              <span style={{ fontWeight: 600, fontSize: 17 }}>{m.n}</span>
            </div>
            <span style={{ fontFamily: OSW, fontSize: 28, fontWeight: 700 }}>{m.v} €</span>
          </div>
        ))}
      </div>
    </>
  )
}
