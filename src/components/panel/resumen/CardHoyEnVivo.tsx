/**
 * CardHoyEnVivo — tarjeta de ventas del día en tiempo real.
 * Fuente: robot rushour_vivo (cada 5 min) → vistas v_vivo_hoy, v_vivo_horas, v_vivo_top_platos.
 * Se refresca sola cada 60 s. Solo lectura.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

const eur = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export default function CardHoyEnVivo({ sl = false }: { sl?: boolean }) {
  const [k, setK] = useState<Kpis | null>(null)
  const [horas, setHoras] = useState<Hora[]>([])
  const [platos, setPlatos] = useState<Plato[]>([])
  const [ahora, setAhora] = useState(Date.now())

  async function cargar() {
    const [a, b, c] = await Promise.all([
      supabase.from('v_vivo_hoy').select('*').maybeSingle(),
      supabase.from('v_vivo_horas').select('*'),
      supabase.from('v_vivo_top_platos').select('*').limit(4),
    ])
    if (a.data) {
      const d = a.data as Record<string, unknown>
      setK({
        actualizado: (d.actualizado as string) ?? null,
        pedidos: Number(d.pedidos) || 0,
        facturacion: Number(d.facturacion) || 0,
        ticket_medio: Number(d.ticket_medio) || 0,
        clientes_nuevos: Number(d.clientes_nuevos) || 0,
        clientes_recurrentes: Number(d.clientes_recurrentes) || 0,
        pedidos_hace_7d: Number(d.pedidos_hace_7d) || 0,
        bruto_hace_7d: Number(d.bruto_hace_7d) || 0,
      })
    }
    setHoras(((b.data ?? []) as Hora[]).map(h => ({ ...h, euros: Number(h.euros) || 0, pedidos: Number(h.pedidos) || 0 })))
    setPlatos(((c.data ?? []) as Plato[]).map(p => ({ ...p, unidades: Number(p.unidades) || 0, euros: Number(p.euros) || 0 })))
    setAhora(Date.now())
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60_000)
    return () => clearInterval(t)
  }, [])

  const minutos = k?.actualizado
    ? Math.max(0, Math.round((ahora - new Date(k.actualizado).getTime()) / 60000))
    : null

  const vivo = minutos !== null && minutos <= 12
  const maxEuros = Math.max(1, ...horas.map(h => h.euros))
  const pctVs7d = k && k.bruto_hace_7d > 0 ? (k.facturacion / k.bruto_hace_7d) * 100 : null

  const card: React.CSSProperties = sl
    ? { background: 'var(--slx-card)', border: '1px solid var(--slx-line)', borderRadius: 16, padding: 18, marginBottom: 18 }
    : { background: 'var(--sl-card)', border: '3px solid var(--neo-ink)', borderRadius: 0, padding: 18, marginBottom: 18, boxShadow: '4px 4px 0 var(--neo-shadow-color)' }

  const eyebrow: React.CSSProperties = {
    fontFamily: sl ? "'Nunito', sans-serif" : 'Oswald, sans-serif',
    fontSize: 11, fontWeight: 800, letterSpacing: sl ? '0.5px' : '2px',
    textTransform: 'uppercase', color: 'var(--sl-text-secondary)',
  }
  const num: React.CSSProperties = {
    fontFamily: sl ? "'Nunito', sans-serif" : 'Oswald, sans-serif',
    fontSize: 40, fontWeight: sl ? 900 : 600, lineHeight: 1.05,
  }
  const sub: React.CSSProperties = {
    fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--sl-text-secondary)', marginTop: 4,
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 9, height: 9, borderRadius: '50%',
            background: vivo ? '#1D9E75' : '#B01D23', display: 'inline-block',
          }} />
          <span style={eyebrow}>Hoy en vivo</span>
        </div>
        <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--sl-text-secondary)' }}>
          {minutos === null ? 'sin datos del robot' : minutos === 0 ? 'actualizado ahora mismo' : `actualizado hace ${minutos} min`}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', marginTop: 14 }}>
        <div>
          <div style={{ ...num, color: '#1E5BCC' }}>{k?.pedidos ?? 0}</div>
          <div style={sub}>PEDIDOS</div>
        </div>
        <div>
          <div style={{ ...num, color: '#F26B1F' }}>{eur(k?.facturacion ?? 0)}</div>
          <div style={sub}>FACTURACIÓN</div>
        </div>
        <div>
          <div style={{ ...num, color: '#1D9E75' }}>{eur(k?.ticket_medio ?? 0)}</div>
          <div style={sub}>TICKET MEDIO</div>
        </div>
        <div>
          <div style={{ ...num, color: 'var(--sl-text-primary, #111)' }}>
            {(k?.clientes_nuevos ?? 0)}/{(k?.clientes_recurrentes ?? 0)}
          </div>
          <div style={sub}>NUEVOS / REPITEN</div>
        </div>
      </div>

      {k && k.bruto_hace_7d > 0 && (
        <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-secondary)', marginTop: 10 }}>
          Mismo día hace 7 días (día completo): {k.pedidos_hace_7d} pedidos · {eur(k.bruto_hace_7d)}
          {pctVs7d !== null && <> · llevas el <b>{pctVs7d.toFixed(0)}%</b></>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 260 }}>
          <div style={{ ...eyebrow, marginBottom: 8 }}>Curva del día</div>
          {horas.length === 0 ? (
            <div style={sub}>Sin pedidos todavía.</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 70 }}>
              {horas.map(h => {
                const hh = new Date(h.hora).getHours()
                return (
                  <div key={h.hora} style={{ flex: 1, textAlign: 'center' }}>
                    <div
                      title={`${h.pedidos} pedidos · ${eur(h.euros)}`}
                      style={{
                        height: Math.max(4, (h.euros / maxEuros) * 56),
                        background: '#e8f442',
                        border: sl ? 'none' : '2px solid var(--neo-ink)',
                        borderRadius: sl ? 6 : 0,
                      }}
                    />
                    <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 9, color: 'var(--sl-text-secondary)', marginTop: 3 }}>
                      {hh}h
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 240px', minWidth: 220 }}>
          <div style={{ ...eyebrow, marginBottom: 8 }}>Más vendido hoy</div>
          {platos.length === 0 ? (
            <div style={sub}>Sin ventas todavía.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {platos.map(p => (
                <div key={p.plato} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 10,
                  fontFamily: 'Lexend, sans-serif', fontSize: 12,
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.plato}</span>
                  <span style={{ whiteSpace: 'nowrap', color: 'var(--sl-text-secondary)' }}>
                    <b style={{ color: '#1E5BCC' }}>{p.unidades}</b> · {eur(p.euros)}
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
