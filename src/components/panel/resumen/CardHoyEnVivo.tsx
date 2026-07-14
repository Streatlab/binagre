/**
 * CardHoyEnVivo — sección "HOY EN VIVO" del Resumen (Panel Global), a ancho completo,
 * justo encima del estado de salud del periodo.
 *
 * NETO: usa la calculadora central del ERP (netoResolver sobre calcNetoPlataforma).
 * Regla "real manda": si hay liquidación real la usa; si no, aplica el ratio calibrado del
 * canal (autoaprendido de las liquidaciones que van entrando); y si el canal aún no tiene
 * muestra suficiente, cae a la fórmula de comisiones de config_canales. Aquí nunca hay
 * liquidación real (es el día de hoy), así que la etiqueta dirá "calibrado" o "fórmula".
 *
 * Resto de datos: robot rushour_vivo (Rushour, cada 5 min) — pedidos, bruto, ticket medio,
 * plataformas y marcas con su nombre real (rushour_mapa), productos más vendidos,
 * clientes nuevos vs repiten y curva por horas.
 *
 * Solo se pinta en horario de servicio (11:00–24:00 Madrid), igual que el robot.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNum } from '@/lib/format'
import { loadConfigCanales, recargarConfigCanales, loadMarcasPorCanal, type CanalConfig, type MarcasPorCanal } from '@/lib/panel/calcNetoPlataforma'
import { resolverNetoCanal, loadVentasReales, loadRatiosCalibrados, type FuenteNeto } from '@/lib/panel/netoResolver'

/* ── tokens idénticos a ResumenLanding ── */
const INK = '#140f08'
const CLARO = '#F3D9A8'
const TRACK = '#ecdcb8'
const ROSA = '#FF2E63'
const ROJO = '#FF1E27'
const AMA = '#FFC400'
const VERDE = '#0FB86B'
const NAR = '#FF6A1A'
const AZUL = '#2D5BFF'
const GRIS = '#9a8f78'
const SHADOW = `4px 4px 0 ${INK}`
const OSW = "'Oswald', sans-serif"
const LEX = "'Lexend', sans-serif"
const PAD = '40px'
const CORP: Record<string, string> = { uber: '#06C167', glovo: '#FFC244', je: '#FF8000', web: '#B01D23', dir: '#1e2233' }

const d = (size: string, color = INK): React.CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color })
const eyebrow = (bg: string, color = INK): React.CSSProperties => ({ display: 'inline-block', background: bg, color, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 12px' })
const micro: React.CSSProperties = { fontFamily: OSW, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b5d45' }

const E2 = (n: number) => fmtEur(n, { showEuro: false, decimals: 2 })
const N = (n: number) => fmtNum(n, 0)

const HORA_ABRE = 11
const HORA_CIERRA = 24

export function horaMadrid(): number {
  return Number(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(new Date()))
}
export function enHorarioServicio(): boolean {
  const h = horaMadrid()
  return h >= HORA_ABRE && h < HORA_CIERRA
}

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
interface Canal { canal: string; pedidos: number; euros: number }
interface Marca { marca: string; pedidos: number; euros: number }
interface Plato { plato: string; unidades: number; euros: number }
interface Hora { hora: string; euros: number; pedidos: number }

const CANAL_NOMBRE: Record<string, string> = {
  uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat', web: 'Web', dir: 'Directa', otro: 'Otro',
}
const FUENTE_TXT: Record<FuenteNeto, string> = {
  real: 'liquidación real',
  mixto: 'real + estimado',
  estimado_calibrado: 'calibrado con tu histórico',
  estimado: 'fórmula de comisiones',
}

/** Anillo neobrutal: aro con borde de tinta, relleno plano, sin degradados. */
function Anillo({ pct, color }: { pct: number; color: string }) {
  const r = 44
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(pct, 100))
  return (
    <svg width="116" height="116" viewBox="0 0 116 116" style={{ flexShrink: 0 }}>
      <circle cx="58" cy="58" r={r} fill="none" stroke={INK} strokeWidth="22" />
      <circle cx="58" cy="58" r={r} fill="none" stroke={TRACK} strokeWidth="16" />
      <circle cx="58" cy="58" r={r} fill="none" stroke={color} strokeWidth="16" strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 58 58)" />
      <text x="58" y="66" textAnchor="middle" style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, fill: INK }}>{Math.round(v)}%</text>
    </svg>
  )
}

function Kpi({ label, valor, color, pie }: { label: string; valor: string; color: string; pie?: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '16px 18px' }}>
      <div style={micro}>{label}</div>
      <div style={{ ...d('clamp(26px,3.6vw,44px)', color), margin: '8px 0 8px' }}>{valor}</div>
      {pie}
    </div>
  )
}

export default function CardHoyEnVivo() {
  const [k, setK] = useState<Kpis | null>(null)
  const [canales, setCanales] = useState<Canal[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [platos, setPlatos] = useState<Plato[]>([])
  const [horas, setHoras] = useState<Hora[]>([])
  const [ahora, setAhora] = useState(Date.now())

  // calculadora de neto del ERP (config + autoaprendizaje de liquidaciones)
  const [configCanales, setConfigCanales] = useState<Record<string, CanalConfig>>({})
  const [marcasPorCanal, setMarcasPorCanal] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })
  const [calcLista, setCalcLista] = useState(false)

  useEffect(() => {
    loadConfigCanales().then(cfg => setConfigCanales(cfg))
    loadMarcasPorCanal().then(m => setMarcasPorCanal(m))
    loadVentasReales().then(() => loadRatiosCalibrados()).then(() => setCalcLista(true))
    const onChange = () => {
      recargarConfigCanales().then(cfg => setConfigCanales(cfg))
      loadMarcasPorCanal().then(m => setMarcasPorCanal(m))
    }
    window.addEventListener('config_canales:changed', onChange)
    return () => window.removeEventListener('config_canales:changed', onChange)
  }, [])

  async function cargar() {
    const [a, b, c, e, f] = await Promise.all([
      supabase.from('v_vivo_hoy').select('*').maybeSingle(),
      supabase.from('v_vivo_plataformas').select('*'),
      supabase.from('v_vivo_marcas').select('*').limit(4),
      supabase.from('v_vivo_top_platos').select('*').limit(5),
      supabase.from('v_vivo_horas').select('*'),
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
  const maxMarca = Math.max(1, ...marcas.map(m => m.euros))
  const maxPlato = Math.max(1, ...platos.map(pl => pl.unidades))

  /* ── NETO con la calculadora central (real manda → calibrado → fórmula) ── */
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const netoPorCanal = canales.map(c => {
    const id = ['uber', 'glovo', 'je', 'web', 'dir'].includes(c.canal) ? c.canal : 'dir'
    const r = resolverNetoCanal(id, c.euros, c.pedidos, {
      modo: 'agregado_canal',
      marcasPorCanal,
      configCanales,
      fechaDesde: hoy,
      fechaHasta: hoy,
      diasConDatos: 1,
    })
    return { canal: c.canal, neto: r.neto, fuente: r.fuente }
  })
  const netoTotal = netoPorCanal.reduce((s, x) => s + x.neto, 0)
  const pctNeto = bruto > 0 ? (netoTotal / bruto) * 100 : 0
  const fuentes = new Set(netoPorCanal.map(x => x.fuente))
  const fuenteTxt = fuentes.size === 0
    ? '—'
    : fuentes.size === 1
      ? FUENTE_TXT[[...fuentes][0] as FuenteNeto]
      : 'mezcla calibrado + fórmula'

  return (
    <section style={{ background: CLARO, borderBottom: `4px solid ${INK}`, padding: `32px ${PAD} 36px`, fontFamily: LEX, color: INK }}>
      {/* cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <span style={eyebrow(vivo ? VERDE : GRIS, '#fff')}>{vivo ? '● Hoy en vivo' : '● Robot parado'}</span>
        <span style={{ ...eyebrow(INK, AMA), fontSize: 12 }}>
          {minutos === null ? 'Sin datos del robot' : minutos === 0 ? 'Actualizado ahora mismo' : `Actualizado hace ${minutos} min`}
        </span>
        <div style={{ flex: 1 }} />
        <span style={micro}>Rushour · en directo cada 5 min</span>
      </div>

      {/* métricas del día */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) 280px', gap: 16, alignItems: 'stretch' }}>
        <Kpi
          label="Pedidos"
          valor={N(k?.pedidos ?? 0)}
          color={NAR}
          pie={<span style={{ ...eyebrow(NAR, '#fff'), fontSize: 11 }}>{N(k?.clientes_nuevos ?? 0)} nuevos · {N(k?.clientes_recurrentes ?? 0)} repiten</span>}
        />
        <Kpi
          label="Facturación bruta"
          valor={E2(bruto)}
          color={INK}
          pie={<span style={{ ...eyebrow(AMA), fontSize: 11 }}>hace 7 días · {E2(k?.bruto_hace_7d ?? 0)}</span>}
        />
        <Kpi
          label="Neto estimado"
          valor={calcLista ? E2(netoTotal) : '—'}
          color={VERDE}
          pie={<span title={`Neto calculado con la calculadora del ERP: ${fuenteTxt}`} style={{ ...eyebrow(VERDE, '#fff'), fontSize: 11, cursor: 'help' }}>{Math.round(pctNeto)}% s/ bruto · {fuenteTxt}</span>}
        />
        <Kpi
          label="Ticket medio"
          valor={E2(k?.ticket_medio ?? 0)}
          color={AZUL}
          pie={<span style={{ ...eyebrow(AZUL, '#fff'), fontSize: 11 }}>{N(k?.pedidos_hace_7d ?? 0)} ped hace 7 días</span>}
        />

        <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Anillo pct={pctVs7d} color={colorRitmo} />
          <div>
            <div style={micro}>Ritmo del día</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, lineHeight: 1.45 }}>
              de lo que hiciste<br />el mismo día<br />hace 7 días
            </div>
          </div>
        </div>
      </div>

      {/* plataformas · marcas · productos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 1fr', gap: 16, marginTop: 16 }}>
        {/* plataformas + curva */}
        <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '16px 18px' }}>
          <span style={{ ...eyebrow(AMA), fontSize: 12 }}>Por dónde entran</span>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {canales.length === 0 && <span style={{ fontSize: 13, fontWeight: 600, color: GRIS }}>Sin pedidos todavía.</span>}
            {canales.map(c => {
              const pct = bruto > 0 ? (c.euros / bruto) * 100 : 0
              const neto = netoPorCanal.find(x => x.canal === c.canal)?.neto ?? 0
              return (
                <div key={c.canal}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                    <span style={d('16px')}>{CANAL_NOMBRE[c.canal] ?? c.canal}</span>
                    <span style={d('16px')}>
                      <span style={{ color: NAR }}>{N(c.pedidos)}</span>
                      <span style={{ color: GRIS }}> · </span>
                      <span>{E2(c.euros)}</span>
                      <span style={{ color: GRIS }}> · </span>
                      <span style={{ color: VERDE }}>{calcLista ? E2(neto) : '—'}</span>
                    </span>
                  </div>
                  <div style={{ position: 'relative', height: 20, background: TRACK, border: `3px solid ${INK}`, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(3, Math.min(100, pct))}%`, height: '100%', background: CORP[c.canal] ?? GRIS }} />
                    <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontFamily: OSW, fontSize: 12, fontWeight: 700 }}>{Math.round(pct)}%</span>
                  </div>
                </div>
              )
            })}
          </div>

          {horas.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={micro}>Curva del día</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 58, marginTop: 10 }}>
                {horas.map(h => (
                  <div key={h.hora} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div
                      title={`${N(h.pedidos)} pedidos · ${E2(h.euros)}`}
                      style={{ width: '100%', height: Math.max(6, (h.euros / maxEuros) * 38), background: AMA, border: `3px solid ${INK}` }}
                    />
                    <span style={{ fontFamily: OSW, fontSize: 10.5, fontWeight: 600 }}>{new Date(h.hora).getHours()}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* marcas */}
        <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '16px 18px' }}>
          <span style={{ ...eyebrow(ROSA, '#fff'), fontSize: 12 }}>Marcas que tiran hoy</span>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {marcas.length === 0 && <span style={{ fontSize: 13, fontWeight: 600, color: GRIS }}>Sin pedidos todavía.</span>}
            {marcas.map(mk => {
              const pct = (mk.euros / maxMarca) * 100
              return (
                <div key={mk.marca}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, gap: 10 }}>
                    <span style={{ ...d('15px'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mk.marca}</span>
                    <span style={{ ...d('16px'), whiteSpace: 'nowrap' }}>
                      <span style={{ color: NAR }}>{N(mk.pedidos)}</span>
                      <span style={{ color: GRIS }}> · </span>
                      <span>{E2(mk.euros)}</span>
                    </span>
                  </div>
                  <div style={{ height: 18, background: TRACK, border: `3px solid ${INK}`, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(3, pct)}%`, height: '100%', background: ROSA }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* productos */}
        <div style={{ background: '#fff', border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '16px 18px' }}>
          <span style={{ ...eyebrow(VERDE, '#fff'), fontSize: 12 }}>Lo más vendido hoy</span>
          <div style={{ marginTop: 12 }}>
            {platos.length === 0 && <span style={{ fontSize: 13, fontWeight: 600, color: GRIS }}>Sin ventas todavía.</span>}
            {platos.map((pl, i) => (
              <div key={pl.plato} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i === 0 ? `2px solid ${INK}` : `1px solid ${INK}22` }}>
                <span style={{ ...d('18px', i === 0 ? ROSA : INK), width: 26 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.plato}</span>
                <span style={{ width: 46, height: 10, background: TRACK, border: `2px solid ${INK}`, flexShrink: 0 }}>
                  <span style={{ display: 'block', width: `${Math.max(6, (pl.unidades / maxPlato) * 100)}%`, height: '100%', background: AZUL }} />
                </span>
                <span style={d('16px', AZUL)}>{N(pl.unidades)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
