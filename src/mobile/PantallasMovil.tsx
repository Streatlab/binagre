/**
 * Pantallas de la app móvil.
 * Medidas y aire copiados de Delasalud (todo en rem, tarjetas grandes,
 * mucho padding, tipografía legible). Estética: Neobrutal Binagre.
 */
import { INK, BLANCO, AMA, VERDE, ROJO, NARANJA, GRANATE } from '@/mobile/mapaMovil'

const OSW = 'Oswald, sans-serif'
const SH = `4px 4px 0 ${INK}`

export const card = {
  background: BLANCO, border: `3px solid ${INK}`, boxShadow: SH, padding: '1.1rem',
} as const

export function Eyebrow({ children, bg = AMA, color = INK }: { children: React.ReactNode; bg?: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW,
      fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '0.2rem 0.55rem',
    }}>{children}</span>
  )
}

function Kpi({ label, valor, delta, color }: { label: string; valor: string; delta?: string; color?: string }) {
  return (
    <div style={{ ...card, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <span style={{ fontSize: '0.72rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</span>
      <span style={{ fontFamily: OSW, fontSize: '2rem', fontWeight: 700, lineHeight: 1, color: color || INK }}>{valor}</span>
      {delta && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: color || INK, opacity: 0.9 }}>{delta}</span>}
    </div>
  )
}

function Canal({ nombre, valor, pct, color, izq, der }: { nombre: string; valor: string; pct: number; color: string; izq: string; der: string }) {
  return (
    <div style={{ ...card, padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
        <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: '1.05rem', textTransform: 'uppercase' }}>{nombre}</span>
        <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: '1.1rem' }}>{valor}</span>
      </div>
      <div style={{ height: '1rem', border: `2px solid ${INK}`, background: '#ecdcb8', position: 'relative', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, display: 'block' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.45rem', fontSize: '0.78rem', fontWeight: 600, opacity: 0.6 }}>
        <span>{izq}</span><span>{der}</span>
      </div>
    </div>
  )
}

export function Fila({ emoji, bg, titulo, desc, chip, chipBg, chipColor, onClick }: {
  emoji: string; bg?: string; titulo: string; desc: string
  chip?: string; chipBg?: string; chipColor?: string; onClick?: () => void
}) {
  return (
    <div onClick={onClick} style={{
      ...card, display: 'flex', gap: '1rem', alignItems: 'center', cursor: onClick ? 'pointer' : 'default',
    }}>
      <span style={{
        fontSize: '1.6rem', flexShrink: 0, width: '3rem', height: '3rem', border: `3px solid ${INK}`,
        background: bg || '#F3D9A8', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{emoji}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontFamily: OSW, fontWeight: 700, fontSize: '1.02rem', textTransform: 'uppercase', lineHeight: 1.15 }}>{titulo}</p>
        <p style={{ fontSize: '0.82rem', opacity: 0.55, marginTop: '0.1rem' }}>{desc}</p>
      </div>
      {chip
        ? <span style={{
            marginLeft: 'auto', background: chipBg || AMA, color: chipColor || INK, border: `2px solid ${INK}`,
            fontFamily: OSW, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em',
            textTransform: 'uppercase', padding: '0.25rem 0.5rem', whiteSpace: 'nowrap',
          }}>{chip}</span>
        : <span style={{ marginLeft: 'auto', opacity: 0.3, fontSize: '1.4rem', fontFamily: OSW }}>›</span>}
    </div>
  )
}

// ═══════════ PANEL ═══════════
export function PanelMovil() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      <div><Eyebrow bg={BLANCO}>Datos de ejemplo · pendiente de conectar</Eyebrow></div>

      <div style={{ ...card, background: AMA, borderWidth: 4 }}>
        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, opacity: 0.75 }}>
          Ventas netas · Julio
        </span>
        <div style={{ fontFamily: OSW, fontSize: '3rem', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', margin: '0.4rem 0 0.2rem' }}>
          24.180 €
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>+12,4% vs junio · 1.312 pedidos</div>
        <div style={{ display: 'flex', gap: '0.3rem', height: '3rem', alignItems: 'flex-end', marginTop: '1rem' }}>
          {[36, 58, 45, 70, 100, 80, 52].map((h, i) => (
            <span key={i} style={{ flex: 1, height: `${h}%`, background: h === 100 ? VERDE : '#ecdcb8', border: `2px solid ${INK}` }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Kpi label="Ticket medio" valor="18,4 €" delta="+0,9 €" color={VERDE} />
        <Kpi label="Food cost" valor="31,2 %" delta="+1,8 pts" color={ROJO} />
        <Kpi label="Pedidos" valor="1.312" delta="+7,1 %" color={NARANJA} />
        <Kpi label="Margen neto" valor="8,6 %" delta="+1,1 pts" color={VERDE} />
      </div>

      <div style={{ marginTop: '0.75rem' }}><Eyebrow>Por canal</Eyebrow></div>
      <Canal nombre="Uber Eats" valor="9.740 €" pct={40} color="#06C167" izq="512 pedidos" der="Neto 54%" />
      <Canal nombre="Glovo" valor="7.860 €" pct={32} color="#e8f442" izq="438 pedidos" der="Neto 52%" />
      <Canal nombre="Just Eat" valor="4.290 €" pct={18} color="#f5a623" izq="248 pedidos" der="Neto 51%" />
      <Canal nombre="Web propia" valor="2.290 €" pct={10} color={GRANATE} izq="114 pedidos" der="Neto 88%" />

      <div style={{ marginTop: '0.75rem' }}><Eyebrow bg={ROJO} color="#fff">Requiere acción</Eyebrow></div>
      <Fila emoji="🧾" bg={ROJO} titulo="7 facturas sin conciliar" desc="Alcampo · Makro · Glovo" chip="Ver" chipBg={ROJO} chipColor="#fff" />
      <Fila emoji="💸" bg={NARANJA} titulo="2 reclamaciones abiertas" desc="Uber Eats · 34,20 €" chip="Ver" />
      <Fila emoji="📦" bg="#2D5BFF" titulo="Cachopo sin stock" desc="Lista de compra lista" chip="Ver" chipBg={ROJO} chipColor="#fff" />
    </div>
  )
}

// ═══════════ PENDIENTE ═══════════
export function PantallaPendiente({ titulo, emoji }: { titulo: string; emoji?: string }) {
  return (
    <div style={{ border: `4px dashed ${INK}`, padding: '3rem 1rem', textAlign: 'center', background: BLANCO }}>
      <div style={{ fontSize: '2.6rem' }}>{emoji || '🚧'}</div>
      <p style={{ fontFamily: OSW, fontWeight: 700, fontSize: '1.3rem', textTransform: 'uppercase', marginTop: '0.6rem' }}>{titulo}</p>
      <p style={{ fontSize: '0.9rem', opacity: 0.55, marginTop: '0.3rem' }}>Pantalla móvil en construcción</p>
    </div>
  )
}

export { emojiDeRuta } from '@/mobile/mapaMovil'
