import { SECCIONES } from '@/mobile/mapaMovil'

/**
 * Pantallas propias de la app móvil (estructura Delasalud: una columna,
 * máx 480px, sin scroll horizontal). Estilo Neobrutal Food-Pop.
 * Se construyen una a una; las no construidas muestran Pendiente.
 */

const OSW = 'Oswald, sans-serif'
const INK = '#0a0a0a'

const est = {
  hero: (bg: string, color = '#0a0a0a') => ({
    background: bg, color, border: `4px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}`,
    padding: 14, marginBottom: 12,
  }),
  lab: { fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase' } as const,
  num: { fontFamily: OSW, fontWeight: 700, lineHeight: 0.9, letterSpacing: '-1.2px' } as const,
  card: { background: '#fff', border: `3px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}`, padding: 11 } as const,
  eyebrow: (bg: string, color = '#0a0a0a') => ({
    display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW,
    fontWeight: 600, fontSize: 9.5, letterSpacing: 1.6, textTransform: 'uppercase' as const, padding: '2px 7px',
  }),
}

function Kpi({ label, valor, delta, color }: { label: string; valor: string; delta?: string; color?: string }) {
  return (
    <div style={est.card}>
      <div style={{ ...est.lab, fontSize: 9.5, letterSpacing: 1.2, opacity: 0.8 }}>{label}</div>
      <div style={{ ...est.num, fontSize: 26, marginTop: 5, color: color || INK }}>{valor}</div>
      {delta && <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 2, color: color || '#6b5f4c' }}>{delta}</div>}
    </div>
  )
}

function Canal({ nombre, valor, pct, color, izq, der }: { nombre: string; valor: string; pct: number; color: string; izq: string; der: string }) {
  return (
    <div style={{ ...est.card, marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 14, textTransform: 'uppercase' }}>{nombre}</span>
        <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 15 }}>{valor}</span>
      </div>
      <div style={{ height: 14, border: `2px solid ${INK}`, background: '#ecdcb8', position: 'relative', overflow: 'hidden' }}>
        <b style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, display: 'block' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 10, fontWeight: 600, color: '#6b5f4c' }}>
        <span>{izq}</span><span>{der}</span>
      </div>
    </div>
  )
}

// ═══════════ PANEL GLOBAL (móvil) ═══════════
export function PanelMovil() {
  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <span style={est.eyebrow('#fff')}>Datos de ejemplo · conexión en la siguiente tanda</span>
      </div>

      <div style={est.hero('#FFC400')}>
        <div style={est.lab}>Ventas netas · Julio</div>
        <div style={{ ...est.num, fontSize: 44, margin: '7px 0 3px' }}>24.180 €</div>
        <div style={{ fontWeight: 600, fontSize: 11.5 }}>+12,4% vs junio · 1.312 pedidos</div>
        <div style={{ display: 'flex', gap: 4, height: 40, alignItems: 'flex-end', marginTop: 12 }}>
          {[36, 58, 45, 70, 100, 80, 52].map((h, i) => (
            <i key={i} style={{ flex: 1, height: `${h}%`, background: h === 100 ? '#0FB86B' : '#ecdcb8', border: `2px solid ${INK}` }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Kpi label="Ticket medio" valor="18,4 €" delta="+0,9 €" color="#0FB86B" />
        <Kpi label="Food cost" valor="31,2 %" delta="+1,8 pts" color="#FF1E27" />
        <Kpi label="Pedidos" valor="1.312" delta="+7,1 %" color="#FF6A1A" />
        <Kpi label="Margen neto" valor="8,6 %" delta="+1,1 pts" color="#0FB86B" />
      </div>

      <div style={{ margin: '18px 0 9px' }}><span style={est.eyebrow('#FFC400')}>Por canal</span></div>
      <Canal nombre="Uber Eats" valor="9.740 €" pct={40} color="#06C167" izq="512 pedidos" der="Neto 54%" />
      <Canal nombre="Glovo" valor="7.860 €" pct={32} color="#e8f442" izq="438 pedidos" der="Neto 52%" />
      <Canal nombre="Just Eat" valor="4.290 €" pct={18} color="#f5a623" izq="248 pedidos" der="Neto 51%" />
      <Canal nombre="Web propia" valor="2.290 €" pct={10} color="#B01D23" izq="114 pedidos" der="Neto 88%" />

      <div style={{ margin: '18px 0 9px' }}><span style={est.eyebrow('#FF1E27', '#fff')}>Requiere acción</span></div>
      {[
        ['🧾', '#FF1E27', '7 facturas sin conciliar', 'Alcampo · Makro · Glovo'],
        ['💸', '#FF6A1A', '2 reclamaciones abiertas', 'Uber Eats · 34,20 €'],
        ['📦', '#2D5BFF', 'Cachopo sin stock', 'Lista de compra lista'],
      ].map(([e, bg, t, s]) => (
        <div key={t} style={{ ...est.card, display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
          <div style={{ width: 36, height: 36, flex: '0 0 36px', border: `3px solid ${INK}`, background: bg as string, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{e}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ display: 'block', fontFamily: OSW, fontWeight: 600, fontSize: 14, textTransform: 'uppercase' }}>{t}</b>
            <span style={{ fontSize: 10.5, fontWeight: 500, color: '#6b5f4c' }}>{s}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════ PENDIENTE ═══════════
export function PantallaPendiente({ titulo, emoji }: { titulo: string; emoji?: string }) {
  return (
    <div style={{ border: `4px dashed ${INK}`, padding: '30px 14px', textAlign: 'center', background: '#fff' }}>
      <div style={{ fontSize: 34 }}>{emoji || '🚧'}</div>
      <b style={{ display: 'block', fontFamily: OSW, fontWeight: 700, fontSize: 18, textTransform: 'uppercase', marginTop: 8 }}>{titulo}</b>
      <span style={{ fontSize: 12, color: '#6b5f4c', fontWeight: 500 }}>Pantalla móvil en construcción. La montamos en la siguiente tanda.</span>
    </div>
  )
}

// Emoji de una ruta (para la pantalla pendiente)
export function emojiDeRuta(pathname: string): string {
  for (const s of SECCIONES) {
    const hit = s.items.find(i => pathname === i.path || pathname.startsWith(i.path + '/'))
    if (hit) return hit.emoji
  }
  return '🚧'
}
