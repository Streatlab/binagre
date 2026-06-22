/**
 * Test Visual — Panel Global · FOOD POP v3 (landing conversora a ventas).
 * Mantiene el lenguaje pop/neobrutalista, pero la pestaña Resumen se reescribe
 * con la GRAMÁTICA de una web que vende: hero-tesis, banda de prueba social,
 * sección de canales, gancho de conversión a web, bestsellers y cierre.
 * Esencia Binagre: HOGAR · COMER BIEN. AQUÍ Y AHORA. · GUISAR. Datos de ejemplo.
 */
import { useState } from 'react'

const INK = '#140f08'
const CREMA = '#FCEFD6'
const ROSA = '#FF2E63'
const AMA = '#FFC400'
const VERDE = '#0FB86B'
const NAR = '#FF6A1A'
const AZUL = '#2D5BFF'
const OSW = "'Oswald', sans-serif"
const LEX = "'Lexend', sans-serif"

const TABS = ['Resumen', 'Operaciones', 'Finanzas', 'Cashflow', 'Evolución', 'Marcas'] as const
type Tab = typeof TABS[number]

const display = (size: string, color = INK): React.CSSProperties => ({
  fontFamily: OSW, fontWeight: 700, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color,
})
const eyebrow = (bg: string, color = INK): React.CSSProperties => ({
  display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600,
  fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 12px',
})
const cta = (bg: string, color = '#fff'): React.CSSProperties => ({
  display: 'inline-block', background: bg, color, border: `3px solid ${INK}`, boxShadow: `5px 5px 0 ${INK}`,
  fontFamily: OSW, fontWeight: 700, fontSize: 16, letterSpacing: '1px', textTransform: 'uppercase', padding: '12px 22px', cursor: 'pointer',
})

export default function PanelGlobalFoodPop() {
  const [tab, setTab] = useState<Tab>('Resumen')
  return (
    <div style={{ minHeight: '100%', background: CREMA, fontFamily: LEX, color: INK }}>
      <div style={{ background: INK, color: CREMA, padding: '12px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span style={display('20px', CREMA)}>Binagre — Panel Global</span>
        <span style={{ fontFamily: OSW, letterSpacing: '2px', fontSize: 13, color: AMA }}>HOY · 23 JUN 2026</span>
      </div>

      <div style={{ display: 'flex', borderBottom: `4px solid ${INK}`, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const on = t === tab
          return (
            <button key={t} onClick={() => setTab(t)} style={{ flex: '1 0 auto', fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: '1px', textTransform: 'uppercase', padding: '12px 18px', cursor: 'pointer', border: 'none', borderRight: `2px solid ${INK}`, background: on ? ROSA : CREMA, color: on ? '#fff' : INK }}>{t}</button>
          )
        })}
      </div>

      <div style={{ paddingBottom: 0 }}>
        {tab === 'Resumen' && <Landing />}
        {tab === 'Operaciones' && <Operaciones />}
        {tab === 'Finanzas' && <Finanzas />}
        {tab === 'Cashflow' && <Cashflow />}
        {tab === 'Evolución' && <Evolucion />}
        {tab === 'Marcas' && <Marcas />}
      </div>
    </div>
  )
}

/* ════════ LANDING CONVERSORA (pestaña Resumen) ════════ */
function Landing() {
  const canales = [
    { n: 'UBER EATS', pct: 41, c: VERDE, eur: '1.167 €' },
    { n: 'GLOVO', pct: 33, c: AMA, eur: '939 €' },
    { n: 'JUST EAT', pct: 18, c: NAR, eur: '512 €' },
    { n: 'TU WEB', pct: 8, c: AZUL, eur: '229 €' },
  ]
  const marcas = [
    { n: 'Ninja Ramen', d: 'Ramen & katsu', v: '780 €', pct: 100, c: ROSA },
    { n: 'La Carmucha', d: 'Cocina de la abuela', v: '540 €', pct: 69, c: AMA },
    { n: 'Pasta Manía', d: 'Italiana de verdad', v: '470 €', pct: 60, c: AZUL },
    { n: 'Greta la Green', d: 'Bowls y verde', v: '410 €', pct: 53, c: VERDE },
  ]
  return (
    <>
      {/* 1 · HERO TESIS */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', borderBottom: `4px solid ${INK}`, background: AMA }}>
        <div style={{ padding: '54px 40px 48px', borderRight: `4px solid ${INK}` }}>
          <span style={eyebrow('#fff')}>Comer bien. Aquí y ahora.</span>
          <div style={{ ...display('clamp(38px, 5.4vw, 68px)'), margin: '20px 0 18px', maxWidth: 620 }}>Hoy hemos guisado para 94 hogares.</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Servido hoy</div>
              <div style={display('clamp(56px,9vw,108px)')}>2.847 €</div>
            </div>
            <div style={{ ...eyebrow(VERDE, '#fff'), fontSize: 18, padding: '8px 14px', marginBottom: 14 }}>▲ +12,4 %</div>
          </div>
          <div style={{ marginTop: 22 }}><span style={cta(INK)}>Ver el día completo ↓</span></div>
        </div>
        {/* signature: ticket de cocina rotado */}
        <div style={{ background: CREMA, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, padding: '20px 22px', width: '100%', maxWidth: 280, transform: 'rotate(-3deg)' }}>
            <div style={{ ...display('15px'), borderBottom: `2px dashed ${INK}`, paddingBottom: 10 }}>· Resumen del día ·</div>
            {[['Pedidos', '94'], ['Ticket medio', '30,3 €'], ['Vuelven a casa', '22 %'], ['Resultado', '+713 €']].map(([l, v], i) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0', borderBottom: i < 3 ? `1px dotted ${INK}55` : 'none' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{l}</span>
                <span style={display('22px', i === 3 ? VERDE : INK)}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2 · PRUEBA SOCIAL (banda negra) */}
      <section style={{ background: INK, borderBottom: `4px solid ${INK}`, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[['+12,4 %', 'sobre tu media', VERDE], ['30,3 €', 'ticket medio', AMA], ['22 %', 'vuelven a casa', ROSA], ['+713 €', 'limpios hoy', NAR]].map(([v, l, c], i) => (
          <div key={l as string} style={{ padding: '26px 22px', borderRight: i < 3 ? `1px solid #3a342a` : 'none' }}>
            <div style={display('clamp(26px,3.6vw,42px)', c as string)}>{v}</div>
            <div style={{ fontFamily: OSW, letterSpacing: '1.5px', fontSize: 12, color: '#9b9384', textTransform: 'uppercase', marginTop: 6 }}>{l}</div>
          </div>
        ))}
      </section>

      {/* 3 · CANALES (sección features) */}
      <section style={{ padding: '50px 40px', borderBottom: `4px solid ${INK}` }}>
        <span style={eyebrow(AMA)}>Por dónde entra el hambre</span>
        <div style={{ ...display('clamp(28px,3.6vw,44px)'), margin: '16px 0 26px', maxWidth: 680 }}>Cada pedido llega desde uno de estos cuatro sitios.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {canales.map(c => (
            <div key={c.n} style={{ display: 'flex', alignItems: 'center', height: 52, border: `3px solid ${INK}`, background: '#fff' }}>
              <div style={{ width: `${c.pct}%`, height: '100%', background: c.c, display: 'flex', alignItems: 'center', paddingLeft: 16, minWidth: 130 }}>
                <span style={display('18px', '#fff')}>{c.n}</span>
              </div>
              <span style={{ ...display('20px'), marginLeft: 18 }}>{c.pct}%</span>
              <span style={{ fontFamily: OSW, fontSize: 15, color: INK, marginLeft: 'auto', paddingRight: 18, opacity: 0.6 }}>{c.eur}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4 · GANCHO DE CONVERSIÓN A WEB (value prop) */}
      <section style={{ background: ROSA, color: '#fff', padding: '56px 40px', borderBottom: `4px solid ${INK}` }}>
        <div style={{ ...display('clamp(32px,5vw,60px)', '#fff'), maxWidth: 920 }}>Las comisiones se comen <span style={{ background: '#fff', color: ROSA, padding: '0 10px' }}>1 de cada 3 €</span>.</div>
        <div style={{ fontSize: 'clamp(17px,2vw,22px)', fontWeight: 600, marginTop: 20, maxWidth: 720 }}>Tu web solo trae el 8 %. Ese margen es tuyo, no de la plataforma. Cada cliente que vuelve por la web es comida que cobras entera.</div>
        <div style={{ marginTop: 26 }}><span style={cta(INK)}>Empuja tu web →</span></div>
      </section>

      {/* 5 · BESTSELLERS (marcas) */}
      <section style={{ padding: '50px 40px', borderBottom: `4px solid ${INK}` }}>
        <span style={eyebrow(VERDE, '#fff')}>Lo que más sale de la cocina</span>
        <div style={{ ...display('clamp(28px,3.6vw,44px)'), margin: '16px 0 24px' }}>Tus marcas, ordenadas por lo que han dado hoy.</div>
        <div>
          {marcas.map((m, i) => (
            <div key={m.n} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '20px 0', borderTop: i === 0 ? `3px solid ${INK}` : `2px solid ${INK}22` }}>
              <span style={{ ...display('clamp(36px,5.5vw,60px)', i === 0 ? ROSA : INK), width: 78 }}>{String(i + 1).padStart(2, '0')}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={display('clamp(20px,2.8vw,32px)')}>{m.n}</div>
                <div style={{ fontFamily: OSW, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', color: INK, opacity: 0.55, marginTop: 2 }}>{m.d}</div>
                <div style={{ marginTop: 10, height: 10, border: `2px solid ${INK}`, background: CREMA, maxWidth: 380 }}><div style={{ width: `${m.pct}%`, height: '100%', background: m.c }} /></div>
              </div>
              <span style={display('clamp(24px,3.4vw,40px)')}>{m.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 6 · CIERRE RESULTADO */}
      <section style={{ background: AMA, padding: '54px 40px', borderBottom: `4px solid ${INK}`, textAlign: 'center' }}>
        <span style={eyebrow('#fff')}>Al final del día</span>
        <div style={{ ...display('clamp(60px,11vw,128px)'), margin: '16px 0 8px' }}>+713 € limpios</div>
        <div style={{ ...display('clamp(20px,2.6vw,30px)') }}>Margen 25 % · comer bien también deja margen.</div>
      </section>

      {/* 7 · FOOTER MARCA */}
      <section style={{ background: INK, color: CREMA, padding: '46px 40px', textAlign: 'center' }}>
        <div style={display('clamp(40px,7vw,84px)', CREMA)}>Binagre es hogar.</div>
        <div style={{ fontFamily: OSW, letterSpacing: '6px', fontSize: 16, color: AMA, marginTop: 14, textTransform: 'uppercase' }}>Guisar · Comer bien. Aquí y ahora.</div>
      </section>
    </>
  )
}

/* ════════ otras pestañas (lenguaje pop) ════════ */
function Banda({ children, bg, color = '#fff' }: { children: React.ReactNode; bg: string; color?: string }) {
  return <div style={{ background: bg, color, padding: '34px 40px', borderBottom: `4px solid ${INK}` }}><div style={display('clamp(26px,3.6vw,44px)', color)}>{children}</div></div>
}

function Operaciones() {
  const filas = [{ c: 'UBER EATS', ped: 39, tk: '29,9 €', cc: VERDE }, { c: 'GLOVO', ped: 31, tk: '30,3 €', cc: AMA }, { c: 'JUST EAT', ped: 17, tk: '30,1 €', cc: NAR }, { c: 'TU WEB', ped: 7, tk: '32,7 €', cc: AZUL }]
  return (
    <>
      <Banda bg={NAR}>Hoy llevas <span style={{ background: '#fff', color: NAR, padding: '0 8px' }}>94 pedidos</span> y solo 2 caídas.</Banda>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)' }}>
        {filas.map((f, i) => (
          <div key={f.c} style={{ padding: '30px 36px', borderRight: i % 2 === 0 ? `4px solid ${INK}` : 'none', borderBottom: `4px solid ${INK}` }}>
            <span style={eyebrow(f.cc, '#fff')}>{f.c}</span>
            <div style={{ ...display('clamp(48px,7vw,80px)'), marginTop: 12 }}>{f.ped}</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>pedidos · ticket {f.tk}</div>
          </div>
        ))}
      </div>
    </>
  )
}

function Finanzas() {
  const pnl = [{ n: 'VENTAS', v: '+2.847 €', c: VERDE }, { n: 'FOOD COST', v: '−854 €', c: NAR }, { n: 'COMISIONES', v: '−968 €', c: ROSA }, { n: 'LABORAL', v: '−312 €', c: AZUL }]
  return (
    <>
      <Banda bg={VERDE}>De cada venta, <span style={{ background: '#fff', color: VERDE, padding: '0 8px' }}>25 cént.</span> limpios.</Banda>
      <div style={{ borderBottom: `4px solid ${INK}` }}>
        {pnl.map((r, i) => (
          <div key={r.n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px', borderTop: i === 0 ? 'none' : `2px solid ${INK}22` }}>
            <span style={display('clamp(20px,2.4vw,28px)')}>{r.n}</span>
            <span style={display('clamp(24px,3vw,38px)', r.c)}>{r.v}</span>
          </div>
        ))}
      </div>
      <div style={{ background: AMA, padding: '34px 40px' }}>
        <span style={eyebrow('#fff')}>Resultado neto</span>
        <div style={{ ...display('clamp(56px,9vw,104px)'), marginTop: 10 }}>+713 €</div>
      </div>
    </>
  )
}

function Cashflow() {
  const cobrar = [{ n: 'UBER', v: '1.840 €', c: VERDE }, { n: 'GLOVO', v: '1.210 €', c: AMA }, { n: 'JUST EAT', v: '760 €', c: NAR }, { n: 'TU WEB', v: '400 €', c: AZUL }]
  return (
    <>
      <Banda bg={ROSA}>Te deben <span style={{ background: '#fff', color: ROSA, padding: '0 8px' }}>4.210 €</span>. Uber, casi la mitad.</Banda>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)' }}>
        {cobrar.map((c, i) => (
          <div key={c.n} style={{ padding: '30px 36px', borderRight: i % 2 === 0 ? `4px solid ${INK}` : 'none', borderBottom: `4px solid ${INK}` }}>
            <span style={eyebrow(c.c, '#fff')}>{c.n}</span>
            <div style={{ ...display('clamp(40px,6vw,68px)'), marginTop: 12 }}>{c.v}</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>por cobrar</div>
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
      <Banda bg={AZUL}>Este mes <span style={{ background: '#fff', color: AZUL, padding: '0 8px' }}>74.200 €</span>, +8,3 %.</Banda>
      <div style={{ padding: '40px' }}>
        <span style={eyebrow(AMA)}>Ventas · 12 meses</span>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 240, marginTop: 18, border: `3px solid ${INK}`, background: '#fff' }} preserveAspectRatio="none">
          <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={`${ROSA}22`} />
          <path d={path} fill="none" stroke={ROSA} strokeWidth={5} strokeLinejoin="round" />
        </svg>
      </div>
    </>
  )
}

function Marcas() {
  const marcas = [{ n: 'Ninja Ramen & Katsu', v: '780 €' }, { n: 'La Cocina de Carmucha', v: '540 €' }, { n: 'Pasta Manía Italiana', v: '470 €' }, { n: 'Greta la Green', v: '410 €' }]
  return (
    <>
      <Banda bg={ROSA}><span style={{ background: '#fff', color: ROSA, padding: '0 8px' }}>Ninja Ramen</span> es tu estrella hoy.</Banda>
      <div style={{ padding: '12px 40px 40px' }}>
        {marcas.map((m, i) => (
          <div key={m.n} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '22px 0', borderTop: i === 0 ? 'none' : `2px solid ${INK}22` }}>
            <span style={{ ...display('clamp(40px,6vw,64px)', i === 0 ? ROSA : INK), width: 84 }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={display('clamp(20px,2.8vw,32px)')}>{m.n}</span>
            <span style={{ ...display('clamp(24px,3.4vw,40px)'), marginLeft: 'auto' }}>{m.v}</span>
          </div>
        ))}
      </div>
    </>
  )
}
