/**
 * CardHoyEnVivo — bloque "HOY EN VIVO" que vive DENTRO del Resumen del Panel Global,
 * en la misma fila que "Ojo, un par de cosas" (70% este bloque / 30% el estado de salud).
 *
 * Datos 100% reales, del robot rushour_vivo (Rushour, cada 5 min):
 *  · pedidos, facturación bruta y ticket medio del día
 *  · neto estimado = bruto × ratio neto/bruto REAL de cada canal (últimas liquidaciones)
 *  · reparto por plataforma (Uber Eats / Glovo / Just Eat) y por marca — traducidos con el
 *    diccionario real de Rushour (tabla rushour_mapa)
 *  · productos más vendidos, clientes nuevos vs repiten y curva por horas
 *
 * Solo se pinta en horario de servicio (11:00–23:59 Madrid), igual que el robot.
 * Estilo: tokens neobrutal de src/styles/neobrutal.ts. Sin marco propio: el marco lo pone
 * la fila del Resumen.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  INK, CREMA, CLARO, AMA, VERDE, NAR, AZUL, GRANATE, ROJO, GRIS,
  OSW, LEX, CORP, d, eyebrow,
} from '@/styles/neobrutal'
import { fmtEur, fmtNum } from '@/lib/format'

const HORA_ABRE = 11
const HORA_CIERRA = 24

/** Hora actual en Madrid (la del restaurante, no la del navegador). */
export function horaMadrid(): number {
  return Number(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(new Date()))
}
/** ¿Estamos en horario de servicio? */
export function enHorarioServicio(): boolean {
  const h = horaMadrid()
  return h >= HORA_ABRE && h < HORA_CIERRA
}

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
interface Canal { canal: string; pedidos: number; euros: number }
interface Marca { marca: string; pedidos: number; euros: number }
interface Plato { plato: string; unidades: number; euros: number }
interface Hora { hora: string; euros: number; pedidos: number }

const E2 = (n: number) => fmtEur(n, { showEuro: false, decimals: 2 })
const N = (n: number) => fmtNum(n, 0)

const CANAL_NOMBRE: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat', web: 'Web', dir: 'Directa', otro: 'Otro',
}

/** Anillo neobrutal: aro con borde de tinta, relleno plano. */
function Anillo({ pct, color }: { pct: number; color: string }) {
  const r = 46
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(pct, 100))
  return (
    <svg width="118" height="118" viewBox="0 0 118 118" style={{ flexShrink: 0 }}>
      <circle cx="59" cy="59" r={r} fill="none" stroke={INK} strokeWidth="20" />
      <circle cx="59" cy="59" r={r} fill="none" stroke={CLARO} strokeWidth="14" />
      <circle
        cx="59" cy="59" r={r} fill="none" stroke={color} strokeWidth="14"
        strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 59 59)"
      />
      <text x="59" y="66" textAnchor="middle" style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, fill: INK }}>{Math.round(v)}%</text>
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
    setCanales(((b.data ?? []) as Canal[]).map(x => ({ ...x, pedidos: Number(x.pedidos) || 0, euros: Number(x.euros) || 0 })))
    setMarcas(((c.data ?? []) as Marca[]).map(x => ({ ...x, pedidos: Number(x.pedidos) || 0, euros: Number(x.euros) || 0 })))
    setPlatos(((e.data ?? []) as Plato[]).map(x => ({ ...x, unidades: Number(x.unidades) || 0, euros: Number(x.euros) || 0 })))
    setHoras(((f.data ?? []) as Hora[]).map(x => ({ ...x, euros: Number(x.euros) || 0, pedidos: Number(x.pedidos) || 0 })))
    setAhora(Date.now())
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60_000)
    return () => clearInterval(t)
  }, [])

  const minutos = k?.actualizado ? Math.max(0, Math.round((ahora - new Date(k.actualizado).getTime()) / 60000)) : null
  const vivo = minutos !== null && minutos <= 12
  const bruto = k?.facturacion ?? 0
  const maxEuros = Math.max(1, ...horas.map(h => h.euros))
  const pctVs7d = k && k.bruto_hace_7d > 0 ? (bruto / k.bruto_hace_7d) * 100 : 0
  const colorRitmo = pctVs7d >= 90 ? VERDE : pctVs7d >= 50 ? AMA : ROJO
  const pctNeto = bruto > 0 ? ((k?.neto_estimado ?? 0) / bruto) * 100 : 0

  const micro: React.CSSProperties = { fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: INK, opacity: 0.7 }

  return (
    <div style={{ background: CREMA, color: INK, fontFamily: LEX, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: AMA, borderBottom: `4px solid ${INK}`, padding: '10px 24px' }}>
        <span style={eyebrow(vivo ? VERDE : GRIS, '#fff')}>{vivo ? '● Hoy en vivo' : '● Robot parado'}</span>
        <span style={micro}>
          {minutos === null ? 'sin datos del robot' : minutos === 0 ? 'actualizado ahora mismo' : `actualizado hace ${minutos} min`}
        </span>
      </div>

      {/* Cifras del día + anillo de ritmo */}
      <div style={{ padding: '18px 24px', display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', flex: 1 }}>
          <div>
            <div style={d('clamp(26px,3vw,40px)', NAR)}>{N(k?.pedidos ?? 0)}</div>
            <div style={{ ...micro, marginTop: 6 }}>Pedidos</div>
          </div>
          <div>
            <div style={d('clamp(26px,3vw,40px)', GRANATE)}>{E2(bruto)} €</div>
            <div style={{ ...micro, marginTop: 6 }}>Facturación bruta</div>
          </div>
          <div>
            <div style={d('clamp(26px,3vw,40px)', VERDE)}>{E2(k?.neto_estimado ?? 0)} €</div>
            <div style={{ ...micro, marginTop: 6 }}>Neto estimado · {Math.round(pctNeto)}% s/ bruto</div>
          </div>
          <div>
            <div style={d('clamp(26px,3vw,40px)', AZUL)}>{E2(k?.ticket_medio ?? 0)} €</div>
            <div style={{ ...micro, marginTop: 6 }}>Ticket medio</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Anillo pct={pctVs7d} color={colorRitmo} />
          <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 150 }}>
            <b style={{ fontFamily: OSW, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Del mismo día hace 7 días</b><br />
            {N(k?.pedidos_hace_7d ?? 0)} ped · {E2(k?.bruto_hace_7d ?? 0)} €<br />
            Nuevos <b style={{ color: VERDE }}>{N(k?.clientes_nuevos ?? 0)}</b> · Repiten <b style={{ color: AZUL }}>{N(k?.clientes_recurrentes ?? 0)}</b>
          </div>
        </div>
      </div>

      {/* Plataformas · marcas · productos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: `4px solid ${INK}`, flex: 1 }}>
        <div style={{ padding: '14px 22px', borderRight: `4px solid ${INK}`, background: CLARO }}>
          <span style={eyebrow(CREMA)}>Plataformas</span>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {canales.length === 0 && <span style={{ fontSize: 12.5 }}>Sin pedidos todavía.</span>}
            {canales.map(c => {
              const pct = bruto > 0 ? (c.euros / bruto) * 100 : 0
              return (
                <div key={c.canal}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                    <span>{CANAL_NOMBRE[c.canal] ?? c.canal}</span>
                    <span style={{ fontFamily: OSW, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      <span style={{ color: NAR }}>{N(c.pedidos)}</span>{' · '}
                      <span style={{ color: GRANATE }}>{E2(c.euros)} €</span>
                    </span>
                  </div>
                  <div style={{ height: 10, border: `2px solid ${INK}`, background: CREMA }}>
                    <div style={{ width: `${Math.max(pct, 3)}%`, height: '100%', background: CORP[c.canal] ?? GRIS }} />
                  </div>
                </div>
              )
            })}
          </div>

          {horas.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ ...micro, marginBottom: 6 }}>Por horas</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
                {horas.map(h => (
                  <div
                    key={h.hora}
                    title={`${new Date(h.hora).getHours()}h · ${N(h.pedidos)} ped · ${E2(h.euros)} €`}
                    style={{ flex: 1, height: Math.max(5, (h.euros / maxEuros) * 38), background: AMA, border: `2px solid ${INK}` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderRight: `4px solid ${INK}`, background: '#fff' }}>
          <span style={eyebrow(AMA)}>Marcas que tiran</span>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
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

        <div style={{ padding: '14px 22px', background: '#fff' }}>
          <span style={eyebrow(AMA)}>Lo más vendido</span>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
  )
}
