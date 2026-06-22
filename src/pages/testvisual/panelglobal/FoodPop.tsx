/**
 * Test Visual — Panel Global · FOOD POP (rehecho con composición de cartel).
 * Neobrutalismo de marca de comida: tipografía masiva que manda, color a
 * sangre, bloques full-bleed, asimetría, sombras duras. Titulares integrados.
 * No es una rejilla de tarjetas: es un póster que se lee de arriba a abajo.
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
  fontFamily: OSW, fontWeight: 700, fontSize: size, lineHeight: 0.92,
  letterSpacing: '-0.5px', textTransform: 'uppercase', color,
})
const eyebrow = (bg: string, color = INK): React.CSSProperties => ({
  display: 'inline-block', background: bg, color, border: `2px solid ${INK}`,
  fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '2px',
  textTransform: 'uppercase', padding: '3px 10px',
})

export default function PanelGlobalFoodPop() {
  const [tab, setTab] = useState<Tab>('Resumen')
  return (
    <div style={{ minHeight: '100%', background: CREMA, fontFamily: LEX, color: INK }}>
      {/* TOP BAR negra a sangre */}
      <div style={{ background: INK, color: CREMA, padding: '12px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ ...display('20px', CREMA) }}>Binagre — Panel Global</span>
        <span style={{ fontFamily: OSW, letterSpacing: '2px', fontSize: 13, color: AMA }}>HOY · 23 JUN 2026</span>
      </div>

      {/* NAV chunky a sangre */}
      <div style={{ display: 'flex', borderBottom: `4px solid ${INK}`, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const on = t === tab
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: '1 0 auto', fontFamily: OSW, fontWeight: 600, fontSize: 14, letterSpacing: '1px',
              textTransform: 'uppercase', padding: '12px 18px', cursor: 'pointer',
              border: 'none', borderRight: `2px solid ${INK}`,
              background: on ? ROSA : CREMA, color: on ? '#fff' : INK,
            }}>{t}</button>
          )
        })}
      </div>

      <div style={{ padding: '0 0 40px' }}>
        {tab === 'Resumen' && <Resumen />}
        {tab === 'Operaciones' && <Operaciones />}
        {tab === 'Finanzas' && <Finanzas />}
        {tab === 'Cashflow' && <Cashflow />}
        {tab === 'Evolución' && <Evolucion />}
        {tab === 'Marcas' && <Marcas />}
      </div>
    </div>
  )
}

function Resumen() {
  const canales = [
    { n: 'UBER EATS', pct: 41, c: VERDE }, { n: 'GLOVO', pct: 33, c: AMA },
    { n: 'JUST EAT', pct: 18, c: NAR }, { n: 'WEB', pct: 8, c: AZUL },
  ]
  const marcas = [
    { n: 'Ninja Ramen', v: '780 €' }, { n: 'La Carmucha', v: '540 €' },
    { n: 'Pasta Manía', v: '470 €' }, { n: 'Greta', v: '410 €' },
  ]
  return (
    <>
      {/* HERO asimétrico a sangre */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ background: AMA, padding: '34px 32px', borderRight: `4px solid ${INK}`, position: 'relative' }}>
          <span style={eyebrow('#fff')}>Ventas de hoy</span>
          <div style={{ ...display('clamp(64px, 11vw, 132px)'), margin: '14px 0 10px' }}>2.847&nbsp;€</div>
          <div style={{ fontSize: 'clamp(18px,2vw,24px)', fontWeight: 700, maxWidth: 560, lineHeight: 1.2 }}>
            Vas <span style={{ background: VERDE, color: '#fff', padding: '0 8px' }}>+12,4 %</span> por encima de tu media semanal.
          </div>
          <div style={{ position: 'absolute', top: 24, right: -2, transform: 'rotate(8deg)', ...eyebrow(ROSA, '#fff'), fontSize: 14, padding: '6px 12px', boxShadow: `4px 4px 0 ${INK}` }}>BUEN DÍA</div>
        </div>
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr' }}>
          <div style={{ background: ROSA, color: '#fff', padding: '22px 26px', borderBottom: `4px solid ${INK}` }}>
            <span style={eyebrow('#fff')}>Pedidos</span>
            <div style={{ ...display('clamp(48px,7vw,80px)', '#fff'), marginTop: 8 }}>94</div>
          </div>
          <div style={{ background: VERDE, color: '#fff', padding: '22px 26px' }}>
            <span style={eyebrow('#fff')}>Ticket medio</span>
            <div style={{ ...display('clamp(40px,6vw,68px)', '#fff'), marginTop: 8 }}>30,3 €</div>
          </div>
        </div>
      </div>

      {/* TICKER negro */}
      <div style={{ background: INK, color: CREMA, padding: '14px 28px', borderBottom: `4px solid ${INK}`, display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'baseline' }}>
        {[['Resultado', '+713 €', VERDE], ['Prime cost', '64 %', AMA], ['Repetición', '22 %', ROSA], ['Comisión', '34 %', NAR]].map(([l, v, c]) => (
          <span key={l as string} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: OSW, letterSpacing: '1.5px', fontSize: 12, color: '#9b9384', textTransform: 'uppercase' }}>{l}</span>
            <span style={{ ...display('26px', c as string) }}>{v}</span>
          </span>
        ))}
      </div>

      {/* CANALES (barras a sangre) + banda titular */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', borderBottom: `4px solid ${INK}` }}>
        <div style={{ padding: '26px 32px', borderRight: `4px solid ${INK}` }}>
          <span style={eyebrow(AMA)}>Por dónde entra</span>
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {canales.map(c => (
              <div key={c.n} style={{ display: 'flex', alignItems: 'center', height: 38, border: `3px solid ${INK}` }}>
                <div style={{ width: `${c.pct}%`, height: '100%', background: c.c, display: 'flex', alignItems: 'center', paddingLeft: 12, minWidth: 90 }}>
                  <span style={{ ...display('15px', '#fff') }}>{c.n}</span>
                </div>
                <span style={{ ...display('22px'), marginLeft: 'auto', paddingRight: 14 }}>{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: ROSA, color: '#fff', padding: '30px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ ...display('clamp(26px,3.2vw,40px)', '#fff') }}>Las comisiones se comen <span style={{ background: '#fff', color: ROSA, padding: '0 8px' }}>1 de cada 3 €</span></div>
          <div style={{ marginTop: 14, fontSize: 16, fontWeight: 600 }}>Tu web solo trae el 8 %. Ahí está el margen que no pagas.</div>
        </div>
      </div>

      {/* MARCAS ranking editorial */}
      <div style={{ padding: '26px 32px' }}>
        <span style={eyebrow(VERDE, '#fff')}>Tus marcas hoy</span>
        <div style={{ marginTop: 16 }}>
          {marcas.map((m, i) => (
            <div key={m.n} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 0', borderTop: i === 0 ? `3px solid ${INK}` : `2px solid ${INK}33` }}>
              <span style={{ ...display('clamp(34px,5vw,56px)', i === 0 ? ROSA : INK), width: 70 }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ ...display('clamp(20px,2.6vw,30px)') }}>{m.n}</span>
              <span style={{ ...display('clamp(22px,3vw,34px)'), marginLeft: 'auto' }}>{m.v}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/* banda titular full-bleed reutilizable */
function Banda({ children, bg, color = '#fff' }: { children: React.ReactNode; bg: string; color?: string }) {
  return (
    <div style={{ background: bg, color, padding: '30px 32px', borderBottom: `4px solid ${INK}` }}>
      <div style={{ ...display('clamp(24px,3.2vw,40px)', color) }}>{children}</div>
    </div>
  )
}

function Operaciones() {
  const filas = [
    { c: 'UBER EATS', ped: 39, tk: '29,9 €', cc: VERDE }, { c: 'GLOVO', ped: 31, tk: '30,3 €', cc: AMA },
    { c: 'JUST EAT', ped: 17, tk: '30,1 €', cc: NAR }, { c: 'WEB', ped: 7, tk: '32,7 €', cc: AZUL },
  ]
  return (
    <>
      <Banda bg={NAR}>Hoy llevas <span style={{ background: '#fff', color: NAR, padding: '0 8px' }}>94 pedidos</span> y solo 2 caídas.</Banda>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)' }}>
        {filas.map((f, i) => (
          <div key={f.c} style={{ padding: '24px 30px', borderRight: i % 2 === 0 ? `4px solid ${INK}` : 'none', borderBottom: `4px solid ${INK}` }}>
            <span style={eyebrow(f.cc, '#fff')}>{f.c}</span>
            <div style={{ ...display('clamp(48px,7vw,76px)'), marginTop: 10 }}>{f.ped}</div>
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
          <div key={r.n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', borderTop: i === 0 ? 'none' : `2px solid ${INK}33` }}>
            <span style={{ ...display('clamp(20px,2.4vw,28px)') }}>{r.n}</span>
            <span style={{ ...display('clamp(24px,3vw,38px)', r.c) }}>{r.v}</span>
          </div>
        ))}
      </div>
      <div style={{ background: AMA, padding: '28px 32px' }}>
        <span style={eyebrow('#fff')}>Resultado neto</span>
        <div style={{ ...display('clamp(56px,9vw,104px)'), marginTop: 8 }}>+713 €</div>
      </div>
    </>
  )
}

function Cashflow() {
  const cobrar = [{ n: 'UBER', v: '1.840 €', c: VERDE }, { n: 'GLOVO', v: '1.210 €', c: AMA }, { n: 'JUST EAT', v: '760 €', c: NAR }, { n: 'WEB', v: '400 €', c: AZUL }]
  return (
    <>
      <Banda bg={ROSA}>Te deben <span style={{ background: '#fff', color: ROSA, padding: '0 8px' }}>4.210 €</span>. Uber, casi la mitad.</Banda>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)' }}>
        {cobrar.map((c, i) => (
          <div key={c.n} style={{ padding: '24px 30px', borderRight: i % 2 === 0 ? `4px solid ${INK}` : 'none', borderBottom: `4px solid ${INK}` }}>
            <span style={eyebrow(c.c, '#fff')}>{c.n}</span>
            <div style={{ ...display('clamp(40px,6vw,68px)'), marginTop: 10 }}>{c.v}</div>
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
      <div style={{ padding: '26px 32px' }}>
        <span style={eyebrow(AMA)}>Ventas · 12 meses</span>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 220, marginTop: 16, border: `3px solid ${INK}`, background: '#fff' }} preserveAspectRatio="none">
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
      <div style={{ padding: '8px 32px 0' }}>
        {marcas.map((m, i) => (
          <div key={m.n} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '18px 0', borderTop: i === 0 ? 'none' : `2px solid ${INK}33` }}>
            <span style={{ ...display('clamp(40px,6vw,64px)', i === 0 ? ROSA : INK), width: 80 }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{ ...display('clamp(20px,2.8vw,32px)') }}>{m.n}</span>
            <span style={{ ...display('clamp(24px,3.4vw,40px)'), marginLeft: 'auto' }}>{m.v}</span>
          </div>
        ))}
      </div>
    </>
  )
}
