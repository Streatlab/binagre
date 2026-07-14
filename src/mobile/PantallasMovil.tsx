/**
 * Pantallas de la app móvil.
 * Medidas y aire copiados de Delasalud (todo en rem, tarjetas grandes,
 * mucho padding, tipografía legible). Estética: Neobrutal Binagre.
 */
import { useNavigate } from 'react-router-dom'
import { INK, BLANCO, AMA, VERDE, ROJO, NARANJA, GRANATE } from '@/mobile/mapaMovil'
import { usePanelMovil } from '@/mobile/usePanelMovil'

const OSW = 'Oswald, sans-serif'
const SH = `4px 4px 0 ${INK}`

export const card = {
  background: BLANCO, border: `3px solid ${INK}`, boxShadow: SH, padding: '1.1rem',
} as const

const eur = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
const eur2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const num = (n: number) => n.toLocaleString('es-ES')
const pct = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' %'

export function Eyebrow({ children, bg = AMA, color = INK }: { children: React.ReactNode; bg?: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW,
      fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '0.2rem 0.55rem',
    }}>{children}</span>
  )
}

function Kpi({ label, valor, sub, color }: { label: string; valor: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...card, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <span style={{ fontSize: '0.72rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</span>
      <span style={{ fontFamily: OSW, fontSize: '1.9rem', fontWeight: 700, lineHeight: 1, color: color || INK }}>{valor}</span>
      {sub && <span style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.6 }}>{sub}</span>}
    </div>
  )
}

function Canal({ nombre, valor, pctBarra, color, izq, der }: { nombre: string; valor: string; pctBarra: number; color: string; izq: string; der: string }) {
  return (
    <div style={{ ...card, padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
        <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: '1.05rem', textTransform: 'uppercase' }}>{nombre}</span>
        <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: '1.1rem' }}>{valor}</span>
      </div>
      <div style={{ height: '1rem', border: `2px solid ${INK}`, background: '#ecdcb8', position: 'relative', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, pctBarra)}%`, background: color, display: 'block' }} />
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

function Cargando() {
  return (
    <div style={{ ...card, padding: '2.5rem 1rem', textAlign: 'center' }}>
      <p style={{ fontFamily: OSW, fontWeight: 700, fontSize: '1.1rem', textTransform: 'uppercase' }}>Cargando…</p>
    </div>
  )
}

// ═══════════ PANEL (datos reales) ═══════════
export function PanelMovil() {
  const nav = useNavigate()
  const d = usePanelMovil()

  const mes = new Date().toLocaleDateString('es-ES', { month: 'long' })
  const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1)

  if (d.loading) return <Cargando />
  if (d.error) {
    return <div style={{ ...card, borderColor: ROJO }}>
      <p style={{ fontFamily: OSW, fontWeight: 700, textTransform: 'uppercase' }}>No se pudieron cargar los datos</p>
      <p style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.3rem' }}>{d.error}</p>
    </div>
  }

  const maxBruto = Math.max(...d.canales.map(c => c.bruto), 1)
  const maxDia = Math.max(...d.serieDias.map(s => s.bruto), 1)
  const margen = d.netoMes > 0 ? (d.resultadoMes / d.netoMes) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      <div style={{ ...card, background: AMA, borderWidth: 4 }}>
        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, opacity: 0.75 }}>
          Ventas netas · {mesCap}
        </span>
        <div style={{ fontFamily: OSW, fontSize: '3rem', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', margin: '0.4rem 0 0.2rem' }}>
          {eur(d.netoMes)}
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
          Bruto {eur(d.brutoMes)} · {num(d.pedidosMes)} pedidos
        </div>
        <div style={{ display: 'flex', gap: '0.2rem', height: '3rem', alignItems: 'flex-end', marginTop: '1rem' }}>
          {d.serieDias.map(s => (
            <span key={s.fecha} title={s.fecha}
              style={{ flex: 1, height: `${Math.max(6, (s.bruto / maxDia) * 100)}%`, background: '#ecdcb8', border: `2px solid ${INK}` }} />
          ))}
        </div>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.6, marginTop: '0.3rem' }}>Últimos días (bruto)</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Kpi label="Ticket medio" valor={eur2(d.ticketMedio)} sub="Bruto por pedido" />
        <Kpi label="Pedidos" valor={num(d.pedidosMes)} sub={mesCap} color={NARANJA} />
        <Kpi label="Gasto del mes" valor={eur(d.gastoMes)} sub="Facturas registradas" color={ROJO} />
        <Kpi label="Resultado" valor={eur(d.resultadoMes)} sub={`Margen ${pct(margen)}`}
          color={d.resultadoMes >= 0 ? VERDE : ROJO} />
      </div>

      <div style={{ marginTop: '0.75rem' }}><Eyebrow>Por canal</Eyebrow></div>
      {d.canales.map(c => (
        <Canal key={c.id} nombre={c.nombre} valor={eur(c.neto)} pctBarra={(c.bruto / maxBruto) * 100} color={c.color}
          izq={`${num(c.pedidos)} pedidos`} der={`Bruto ${eur(c.bruto)}`} />
      ))}

      <div style={{ marginTop: '0.75rem' }}><Eyebrow bg={ROJO} color="#fff">Requiere acción</Eyebrow></div>
      <Fila emoji="🧾" bg={ROJO} titulo={`${num(d.facturasSinConciliar)} facturas sin conciliar`}
        desc="Sin movimiento bancario asociado" chip="Ver" chipBg={ROJO} chipColor="#fff"
        onClick={() => nav('/facturacion')} />
      <Fila emoji="💸" bg={NARANJA} titulo={`${num(d.reclamacionesPendientes)} reclamaciones abiertas`}
        desc="Dinero pendiente de recuperar" chip="Ver"
        onClick={() => nav('/ops/reembolsos')} />
      <Fila emoji="🔔" bg={GRANATE} titulo={`${num(d.tareasPendientes)} tareas pendientes`}
        desc="Del ERP y del equipo" chip="Ver" chipBg={GRANATE} chipColor="#fff"
        onClick={() => nav('/tareas')} />
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
