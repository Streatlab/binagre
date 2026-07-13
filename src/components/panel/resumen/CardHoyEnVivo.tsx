/**
 * CardHoyEnVivo — fila "HOY EN VIVO" del Panel Global (Neobrutal Food Pop).
 *
 * Dos tarjetas: 70% detalle del día en vivo + 30% ritmo del día (anillo).
 * Fuente: robot rushour_vivo (cada 5 min, Rushour) → vistas v_vivo_hoy, v_vivo_plataformas,
 * v_vivo_marcas, v_vivo_top_platos, v_vivo_horas. Marca y plataforma se traducen con el
 * diccionario real de Rushour (tabla rushour_mapa). Neto estimado = bruto × ratio neto/bruto
 * real de cada canal en las últimas liquidaciones. Nada inventado.
 *
 * Solo se pinta en horario de servicio (11:00–23:59 Madrid), igual que el robot.
 * Tokens: src/styles/neobrutal.ts.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  INK, CREMA, CLARO, AMA, VERDE, NAR, AZUL, GRANATE, ROJO, GRIS,
  SHADOW, BORDER, OSW, LEX, PAD, CORP, d, eyebrow,
} from '@/styles/neobrutal'
import { fmtEur, fmtNum } from '@/lib/format'

const HORA_ABRE = 11
const HORA_CIERRA = 24

interface Kpis {
  actualizado: string | null
  pedidos: number
  facturacion: number
  ticket_medio: number
  neto_estimado: number
  clientes_nuevos: number
  clientes_recurrentes: number
  pedidos_hace_7d: number
  bruto_hace_7d: number
}
interface Canal { canal: string; pedidos: number; euros: number; neto_estimado: number }
interface Marca { marca: string; pedidos: number; euros: number }
interface Plato { plato: string; unidades: number; euros: number }
interface Hora { hora: string; euros: number; pedidos: number }

const E2 = (n: number) => fmtEur(n, { showEuro: false, decimals: 2 })
const N = (n: number) => fmtNum(n, 0)

const CANAL_NOMBRE: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat', web: 'Web', dir: 'Directa', otro: 'Otro',
}

function horaMadrid(): number {
  return Number(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(new Date()))
}

/** Anillo neobrutal: aro grueso con borde de tinta, sin degradados. */
function Anillo({ pct, color }: { pct: number; color: string }) {
  const r = 54
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(pct, 100))
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke={INK} strokeWidth="22" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={CLARO} strokeWidth="16" />
      <circle
        cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="16"
        strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 70 70)"
      />
      <text x="70" y="78" textAnchor="middle" style={{ fontFamily: OSW, fontWeight: 700, fontSize: 30, fill: INK }}>
        {Math.round(v)}%
      </text>
    </svg>
  )
}

export default function CardHoyEnVivo() {
  const [k, setK] = useState<Kpis | null>(null)
  const [canales, setCanales] = useState<Canal[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [platos, setPlatos] = useState<Plato[]>([])
  const [horas, setHoras] = useState<Hora[]>([])
  const [ahora, setAhora] = useState(Date.now())
  const [hora, setHora] = useState<number>(horaMadrid())

  const abierto = hora >= HORA_ABRE && hora < HORA_CIERRA

  async function cargar() {
    const [a, b, c, e, f] = await Promise.all([
      supabase.from('v_vivo_hoy').select('*').maybeSingle(),
      supabase.from('v_vivo_plataformas').select('*'),
      supabase.from('v_vivo_marcas').select('*').limit(4),
      supabase.from('v_vivo_top_platos').select('*').limit(4),
      supabase.from('v_vivo_horas').select('*'),
    ])
    if (a.data) {
      const x = a.data as Record<string, unknown>
      setK({
        actualizado: (x.actualizado as string) ?? null,
        pedidos: Number(x.pedidos) || 0,
        facturacion: Number(x.facturacion) || 0,
        ticket_medio: Number(x.ticket_medio) || 0,
        neto_estimado: Number(x.neto_estimado) || 0,
        clientes_nuevos: Number(x.clientes_nuevos) || 0,
        clientes_recurrentes: Number(x.clientes_recurrentes) || 0,
        pedidos_hace_7d: Number(x.pedidos_hace_7d) || 0,
        bruto_hace_7d: Number(x.bruto_hace_7d) || 0,
      })
    }
    setCanales(((b.data ?? []) as Canal[]).map(x => ({ ...x, pedidos: Number(x.pedidos) || 0, euros: Number(x.euros) || 0, neto_estimado: Number(x.neto_estimado) || 0 })))
    setMarcas(((c.data ?? []) as Marca[]).map(x => ({ ...x, pedidos: Number(x.pedidos) || 0, euros: Number(x.euros) || 0 })))
    setPlatos(((e.data ?? []) as Plato[]).map(x => ({ ...x, unidades: Number(x.unidades) || 0, euros: Number(x.euros) || 0 })))
    setHoras(((f.data ?? []) as Hora[]).map(x => ({ ...x, euros: Number(x.euros) || 0, pedidos: Number(x.pedidos) || 0 })))
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

  const minutos = k?.actualizado ? Math.max(0, Math.round((ahora - new Date(k.actualizado).getTime()) / 60000)) : null
  const vivo = minutos !== null && minutos <= 12
  const bruto = k?.facturacion ?? 0
  const maxEuros = Math.max(1, ...horas.map(h => h.euros))
  const pctVs7d = k && k.bruto_hace_7d > 0 ? (bruto / k.bruto_hace_7d) * 100 : 0
  const colorRitmo = pctVs7d >= 90 ? VERDE : pctVs7d >= 50 ? AMA : ROJO
  const pctNeto = bruto > 0 ? ((k?.neto_estimado ?? 0) / bruto) * 100 : 0

  const card: React.CSSProperties = { background: CREMA, border: BORDER, boxShadow: SHADOW, color: INK, fontFamily: LEX }
  const cabecera: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    background: AMA, borderBottom: `4px solid ${INK}`, padding: '10px 20px',
  }
  const micro: React.CSSProperties = { fontFamily: OSW, fontWeight: 600, fontSize: 11.5, letterSpacing: '1.5px', textTransform: 'uppercase', color: INK, opacity: 0.75 }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: 18, marginBottom: 18, alignItems: 'stretch' }}>
      {/* ─────────── 70% · Detalle del día en vivo ─────────── */}
      <div style={card}>
        <div style={cabecera}>
          <span style={eyebrow(vivo ? VERDE : GRIS, '#fff')}>{vivo ? '● Hoy en vivo' : '● Robot parado'}</span>
          <span style={micro}>
            {minutos === null ? 'sin datos del robot' : minutos === 0 ? 'actualizado ahora mismo' : `actualizado hace ${minutos} min`}
          </span>
        </div>

        <div style={{ padding: `18px ${PAD}`, display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          <div>
            <div style={d('clamp(28px,3.4vw,42px)', NAR)}>{N(k?.pedidos ?? 0)}</div>
            <div style={{ ...micro, marginTop: 6 }}>Pedidos</div>
          </div>
          <div>
            <div style={d('clamp(28px,3.4vw,42px)', GRANATE)}>{E2(bruto)} €</div>
            <div style={{ ...micro, marginTop: 6 }}>Facturación bruta</div>
          </div>
          <div>
            <div style={d('clamp(28px,3.4vw,42px)', VERDE)}>{E2(k?.neto_estimado ?? 0)} €</div>
            <div style={{ ...micro, marginTop: 6 }}>Neto estimado · {Math.round(pctNeto)}% s/ bruto</div>
          </div>
          <div>
            <div style={d('clamp(28px,3.4vw,42px)', AZUL)}>{E2(k?.ticket_medio ?? 0)} €</div>
            <div style={{ ...micro, marginTop: 6 }}>Ticket medio</div>
          </div>
        </div>

        {/* Plataformas · marcas · productos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: `4px solid ${INK}` }}>
          <div style={{ padding: '14px 20px', borderRight: `4px solid ${INK}`, background: CLARO }}>
            <span style={eyebrow(CREMA)}>Plataformas</span>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {canales.length === 0 && <span style={{ fontSize: 12.5 }}>Sin pedidos todavía.</span>}
              {canales.map(c => {
                const pct = bruto > 0 ? (c.euros / bruto) * 100 : 0
                return (
                  <div key={c.canal}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                      <span>{CANAL_NOMBRE[c.canal] ?? c.canal}</span>
                      <span style={{ fontFamily: OSW, fontWeight: 700 }}>
                        <span style={{ color: NAR }}>{N(c.pedidos)}</span>{' · '}
                        <span style={{ color: GRANATE }}>{E2(c.euros)} €</span>
                      </span>
                    </div>
                    <div style={{ height: 10, border: `2px solid ${INK}`, background: CREMA }}>
                      <div style={{ height: '100%', width: `${Math.max(pct, 3)}%`, background: CORP[c.canal] ?? GRIS }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ padding: '14px 20px', borderRight: `4px solid ${INK}` }}>
            <span style={eyebrow(AMA)}>Marcas que tiran</span>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {marcas.length === 0 && <span style={{ fontSize: 12.5 }}>Sin pedidos todavía.</span>}
              {marcas.map(m => (
                <div key={m.marca} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.marca}</span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <span style={{ color: NAR }}>{N(m.pedidos)}</span>{' · '}
                    <span style={{ color: GRANATE }}>{E2(m.euros)} €</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '14px 20px' }}>
            <span style={eyebrow(AMA)}>Lo más vendido</span>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {platos.length === 0 && <span style={{ fontSize: 12.5 }}>Sin ventas todavía.</span>}
              {platos.map(p => (
                <div key={p.plato} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.plato}</span>
                  <span style={{ fontFamily: OSW, fontWeight: 700, whiteSpace: 'nowrap', color: AZUL }}>{N(p.unidades)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────── 30% · Ritmo del día ─────────── */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...cabecera, background: colorRitmo }}>
          <span style={eyebrow(CREMA)}>Ritmo del día</span>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1 }}>
          <Anillo pct={pctVs7d} color={colorRitmo} />
          <div style={{ textAlign: 'center', fontSize: 12.5, lineHeight: 1.5 }}>
            del mismo día hace 7 días<br />
            <b style={{ fontFamily: OSW, letterSpacing: '0.5px' }}>
              {N(k?.pedidos_hace_7d ?? 0)} ped · {E2(k?.bruto_hace_7d ?? 0)} €
            </b>
          </div>

          <div style={{ width: '100%', borderTop: `3px solid ${INK}`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
            <span>Clientes nuevos</span>
            <b style={{ fontFamily: OSW, color: VERDE }}>{N(k?.clientes_nuevos ?? 0)}</b>
          </div>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
            <span>Repiten</span>
            <b style={{ fontFamily: OSW, color: AZUL }}>{N(k?.clientes_recurrentes ?? 0)}</b>
          </div>

          {horas.length > 0 && (
            <div style={{ width: '100%', marginTop: 'auto' }}>
              <div style={{ ...micro, marginBottom: 6 }}>Por horas</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 46 }}>
                {horas.map(h => (
                  <div
                    key={h.hora}
                    title={`${new Date(h.hora).getHours()}h · ${N(h.pedidos)} ped · ${E2(h.euros)} €`}
                    style={{
                      flex: 1,
                      height: Math.max(5, (h.euros / maxEuros) * 44),
                      background: AMA,
                      border: `2px solid ${INK}`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
