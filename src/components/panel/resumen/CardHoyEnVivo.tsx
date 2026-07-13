/**
 * CardHoyEnVivo — banda "HOY EN VIVO" del Panel Global (estilo Neobrutal Food Pop).
 *
 * Fuente: robot rushour_vivo (escribe cada 5 min) → vistas v_vivo_hoy, v_vivo_horas, v_vivo_top_platos.
 * Solo se muestra en horario de servicio del restaurante (11:00–23:59 hora de Madrid).
 * Fuera de ese horario no se pinta nada.
 * Tokens: src/styles/neobrutal.ts (NO improvisar hex ni medidas).
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  INK, CREMA, CLARO, AMA, VERDE, NAR, AZUL, GRANATE, GRIS,
  SHADOW, BORDER, OSW, LEX, PAD, d, eyebrow,
} from '@/styles/neobrutal'
import { fmtEur, fmtNum } from '@/lib/format'

/* Horario de servicio (hora de Madrid). Fuera de esta franja la banda no se muestra. */
const HORA_ABRE = 11
const HORA_CIERRA = 24

interface Kpis {
  actualizado: string | null
  pedidos: number
  facturacion: number
  ticket_medio: number
  clientes_nuevos: number
  clientes_recurrentes: number
  pedidos_hace_7d: number
  bruto_hace_7d: number
}
interface Hora { hora: string; euros: number; pedidos: number }
interface Plato { plato: string; unidades: number; euros: number }

const E2 = (n: number) => fmtEur(n, { showEuro: false, decimals: 2 })
const N = (n: number) => fmtNum(n, 0)

function horaMadrid(): number {
  const s = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false,
  }).format(new Date())
  return Number(s)
}

export default function CardHoyEnVivo() {
  const [k, setK] = useState<Kpis | null>(null)
  const [horas, setHoras] = useState<Hora[]>([])
  const [platos, setPlatos] = useState<Plato[]>([])
  const [ahora, setAhora] = useState(Date.now())
  const [hora, setHora] = useState<number>(horaMadrid())

  const abierto = hora >= HORA_ABRE && hora < HORA_CIERRA

  async function cargar() {
    const [a, b, c] = await Promise.all([
      supabase.from('v_vivo_hoy').select('*').maybeSingle(),
      supabase.from('v_vivo_horas').select('*'),
      supabase.from('v_vivo_top_platos').select('*').limit(3),
    ])
    if (a.data) {
      const x = a.data as Record<string, unknown>
      setK({
        actualizado: (x.actualizado as string) ?? null,
        pedidos: Number(x.pedidos) || 0,
        facturacion: Number(x.facturacion) || 0,
        ticket_medio: Number(x.ticket_medio) || 0,
        clientes_nuevos: Number(x.clientes_nuevos) || 0,
        clientes_recurrentes: Number(x.clientes_recurrentes) || 0,
        pedidos_hace_7d: Number(x.pedidos_hace_7d) || 0,
        bruto_hace_7d: Number(x.bruto_hace_7d) || 0,
      })
    }
    setHoras(((b.data ?? []) as Hora[]).map(h => ({ ...h, euros: Number(h.euros) || 0, pedidos: Number(h.pedidos) || 0 })))
    setPlatos(((c.data ?? []) as Plato[]).map(p => ({ ...p, unidades: Number(p.unidades) || 0, euros: Number(p.euros) || 0 })))
    setAhora(Date.now())
    setHora(horaMadrid())
  }

  useEffect(() => {
    if (!abierto) return
    cargar()
    const t = setInterval(cargar, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  if (!abierto) return null

  const minutos = k?.actualizado
    ? Math.max(0, Math.round((ahora - new Date(k.actualizado).getTime()) / 60000))
    : null
  const vivo = minutos !== null && minutos <= 12
  const maxEuros = Math.max(1, ...horas.map(h => h.euros))
  const pctVs7d = k && k.bruto_hace_7d > 0 ? (k.facturacion / k.bruto_hace_7d) * 100 : null

  const kpi = (valor: string, label: string, color: string) => (
    <div>
      <div style={d('clamp(28px,3.6vw,44px)', color)}>{valor}</div>
      <div style={{ fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: INK, opacity: 0.72, marginTop: 6 }}>
        {label}
      </div>
    </div>
  )

  return (
    <div style={{ background: CREMA, border: BORDER, boxShadow: SHADOW, color: INK, fontFamily: LEX, marginBottom: 18 }}>
      {/* Cabecera de la banda */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        borderBottom: `4px solid ${INK}`, background: AMA, padding: `10px ${PAD}`,
      }}>
        <span style={eyebrow(vivo ? VERDE : GRIS, '#fff')}>
          {vivo ? '● Hoy en vivo' : '● Robot parado'}
        </span>
        <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: INK }}>
          {minutos === null ? 'sin datos del robot' : minutos === 0 ? 'actualizado ahora mismo' : `actualizado hace ${minutos} min`}
        </span>
      </div>

      {/* Cifras del día */}
      <div style={{ padding: `20px ${PAD}`, display: 'flex', gap: 44, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {kpi(N(k?.pedidos ?? 0), 'Pedidos', NAR)}
        {kpi(`${E2(k?.facturacion ?? 0)} €`, 'Facturación', GRANATE)}
        {kpi(`${E2(k?.ticket_medio ?? 0)} €`, 'Ticket medio', AZUL)}
        {kpi(`${N(k?.clientes_nuevos ?? 0)}/${N(k?.clientes_recurrentes ?? 0)}`, 'Nuevos / repiten', VERDE)}
        {k && k.bruto_hace_7d > 0 && (
          <div style={{ marginLeft: 'auto', textAlign: 'right', fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', color: INK, opacity: 0.8, lineHeight: 1.5 }}>
            <div>Mismo día hace 7 días · {N(k.pedidos_hace_7d)} ped · {E2(k.bruto_hace_7d)} €</div>
            {pctVs7d !== null && <div>Llevas el {Math.round(pctVs7d)}% del día completo</div>}
          </div>
        )}
      </div>

      {/* Curva del día + más vendido */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', borderTop: `4px solid ${INK}` }}>
        <div style={{ padding: `16px ${PAD}`, borderRight: `4px solid ${INK}`, background: CLARO }}>
          <span style={eyebrow(CREMA)}>Curva del día</span>
          {horas.length === 0 ? (
            <div style={{ fontFamily: LEX, fontSize: 13, color: INK, opacity: 0.7, marginTop: 12 }}>Sin pedidos todavía.</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 92, marginTop: 14 }}>
              {horas.map(h => {
                const hh = new Date(h.hora).getHours()
                return (
                  <div key={h.hora} style={{ flex: 1, textAlign: 'center' }}>
                    <div
                      title={`${N(h.pedidos)} pedidos · ${E2(h.euros)} €`}
                      style={{
                        height: Math.max(6, (h.euros / maxEuros) * 62),
                        background: AMA, border: `3px solid ${INK}`, boxShadow: SHADOW,
                      }}
                    />
                    <div style={{ fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '0.5px', color: INK, marginTop: 8 }}>
                      {hh}h
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ padding: `16px ${PAD}` }}>
          <span style={eyebrow(AMA)}>Más vendido hoy</span>
          {platos.length === 0 ? (
            <div style={{ fontFamily: LEX, fontSize: 13, color: INK, opacity: 0.7, marginTop: 12 }}>Sin ventas todavía.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {platos.map(p => (
                <div key={p.plato} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: LEX, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.plato}</span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 14, letterSpacing: '0.5px', whiteSpace: 'nowrap', color: INK }}>
                    <span style={{ color: NAR }}>{N(p.unidades)}</span>{' · '}
                    <span style={{ color: GRANATE }}>{E2(p.euros)} €</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
