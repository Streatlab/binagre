import { BLANCO, GRIS, INK, TRACK, ROSA, ROJO, AMA, VERDE, NAR, AZUL, CORP, CREMA } from '@/styles/neobrutal'
/**
 * CardHoyEnVivo — franja "HOY EN VIVO". Desde el 23-jul vive ARRIBA de la
 * pantalla Hoy (Home.tsx), trasladada desde Panel Global · Resumen.
 *
 * ESTILO: CANTERA ALEGRE v1.0 (LEY-ESTILO-01, 22-jul-2026). Reescrita con las
 * piezas canónicas del kit (Plancha/PlanchaCelda para KPIs pegados, Papel con
 * ceja de familia para los bloques, Pill para eyebrows). Derogada la banda a
 * sangre y las sombras duras en lo no pulsable. Cifras es-ES vía lib/format.
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
import { Papel, Plancha, PlanchaCelda, Pill } from '@/components/kit/cantera'

const OSW = "'Oswald', sans-serif"
const LEX = "'Lexend', sans-serif"

/* etiqueta pequeña de celda/bloque (Oswald 11, tracking, mayúsculas) */
const micro: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, fontWeight: 600 }
/* cifra-bloque de la ley: Oswald 34 */
const cifraBloque = (color = INK): React.CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, color, margin: '8px 0 6px' })
const d = (size: string, color = INK): React.CSSProperties => ({ fontFamily: OSW, fontWeight: 700, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.5px', textTransform: 'uppercase', color })

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

/** Anillo: aro plano con borde de tinta, sin degradados (radio 0 no aplica a un aro). */
function Anillo({ pct, color }: { pct: number; color: string }) {
  const r = 44
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(pct, 100))
  return (
    <svg width="108" height="108" viewBox="0 0 116 116" style={{ flexShrink: 0 }}>
      <circle cx="58" cy="58" r={r} fill="none" stroke={INK} strokeWidth="20" />
      <circle cx="58" cy="58" r={r} fill="none" stroke={TRACK} strokeWidth="14" />
      <circle cx="58" cy="58" r={r} fill="none" stroke={color} strokeWidth="14" strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 58 58)" />
      <text x="58" y="66" textAnchor="middle" style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, fill: INK }}>{Math.round(v)}%</text>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: LEX, color: INK }}>
      {/* cabecera de la franja: pills canónicas, sin banda a sangre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill bg={vivo ? VERDE : GRIS} color={BLANCO} fontSize={12}>{vivo ? '● Hoy en vivo' : '● Robot parado'}</Pill>
        <Pill bg={INK} color={AMA} fontSize={11}>
          {minutos === null ? 'Sin datos del robot' : minutos === 0 ? 'Actualizado ahora mismo' : `Actualizado hace ${minutos} min`}
        </Pill>
        <div style={{ flex: 1 }} />
        <span style={micro}>Rushour · en directo cada 5 min</span>
      </div>

      {/* PLANCHA de KPIs del día: celdas sólidas pegadas (ley de superficies) */}
      <Plancha>
        <PlanchaCelda bg={BLANCO} first>
          <div style={micro}>Pedidos</div>
          <div style={cifraBloque(NAR)}>{N(k?.pedidos ?? 0)}</div>
          <div style={{ ...micro, color: NAR }}>{N(k?.clientes_nuevos ?? 0)} nuevos · {N(k?.clientes_recurrentes ?? 0)} repiten</div>
        </PlanchaCelda>
        <PlanchaCelda bg={AMA}>
          <div style={{ ...micro, color: INK, opacity: 0.75 }}>Facturación bruta</div>
          <div style={cifraBloque(INK)}>{E2(bruto)}</div>
          <div style={{ ...micro, color: INK, opacity: 0.75 }}>hace 7 días · {E2(k?.bruto_hace_7d ?? 0)}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={VERDE}>
          <div style={{ ...micro, color: BLANCO, opacity: 0.85 }}>Neto estimado</div>
          <div style={cifraBloque(BLANCO)}>{calcLista ? E2(netoTotal) : '—'}</div>
          <div title={`Neto calculado con la calculadora del ERP: ${fuenteTxt}`} style={{ ...micro, color: BLANCO, opacity: 0.85, cursor: 'help' }}>{Math.round(pctNeto)}% s/ bruto · {fuenteTxt}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={AZUL}>
          <div style={{ ...micro, color: BLANCO, opacity: 0.85 }}>Ticket medio</div>
          <div style={cifraBloque(BLANCO)}>{E2(k?.ticket_medio ?? 0)}</div>
          <div style={{ ...micro, color: BLANCO, opacity: 0.85 }}>{N(k?.pedidos_hace_7d ?? 0)} ped hace 7 días</div>
        </PlanchaCelda>
        <PlanchaCelda bg={BLANCO} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Anillo pct={pctVs7d} color={colorRitmo} />
          <div>
            <div style={micro}>Ritmo del día</div>
            <div style={{ fontFamily: LEX, fontSize: 12.5, fontWeight: 600, marginTop: 6, lineHeight: 1.4 }}>
              de lo que hiciste el mismo día hace 7 días
            </div>
          </div>
        </PlanchaCelda>
      </Plancha>

      {/* BLOQUES DE PAPEL con ceja de familia: plataformas · marcas · productos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* plataformas + curva · ceja amarilla */}
        <Papel ceja={AMA} pad="16px 18px">
          <Pill bg={AMA} fontSize={11}>Por dónde entran</Pill>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {canales.length === 0 && <span style={{ fontSize: 13, fontWeight: 600, color: GRIS }}>Sin pedidos todavía.</span>}
            {canales.map(c => {
              const pct = bruto > 0 ? (c.euros / bruto) * 100 : 0
              const neto = netoPorCanal.find(x => x.canal === c.canal)?.neto ?? 0
              return (
                <div key={c.canal}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                    <span style={d('15px')}>{CANAL_NOMBRE[c.canal] ?? c.canal}</span>
                    <span style={d('15px')}>
                      <span style={{ color: NAR }}>{N(c.pedidos)}</span>
                      <span style={{ color: GRIS }}> · </span>
                      <span style={{ color: AZUL }}>{E2(c.euros)}</span>
                      <span style={{ color: GRIS }}> · </span>
                      <span style={{ color: VERDE }}>{calcLista ? E2(neto) : '—'}</span>
                    </span>
                  </div>
                  <div style={{ position: 'relative', height: 16, background: TRACK, border: `2px solid ${INK}`, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(3, Math.min(100, pct))}%`, height: '100%', background: CORP[c.canal] ?? GRIS }} />
                    <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontFamily: OSW, fontSize: 11, fontWeight: 700 }}>{Math.round(pct)}%</span>
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
                      style={{ width: '100%', height: Math.max(6, (h.euros / maxEuros) * 38), background: AMA, border: `2px solid ${INK}` }}
                    />
                    <span style={{ fontFamily: OSW, fontSize: 10.5, fontWeight: 600 }}>{new Date(h.hora).getHours()}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Papel>

        {/* marcas · ceja rosa */}
        <Papel ceja={ROSA} pad="16px 18px">
          <Pill bg={ROSA} color={BLANCO} fontSize={11}>Marcas que tiran hoy</Pill>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {marcas.length === 0 && <span style={{ fontSize: 13, fontWeight: 600, color: GRIS }}>Sin pedidos todavía.</span>}
            {marcas.map(mk => {
              const pct = (mk.euros / maxMarca) * 100
              return (
                <div key={mk.marca}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, gap: 10 }}>
                    <span style={{ ...d('14px'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mk.marca}</span>
                    <span style={{ ...d('15px'), whiteSpace: 'nowrap' }}>
                      <span style={{ color: NAR }}>{N(mk.pedidos)}</span>
                      <span style={{ color: GRIS }}> · </span>
                      <span>{E2(mk.euros)}</span>
                    </span>
                  </div>
                  <div style={{ height: 14, background: TRACK, border: `2px solid ${INK}`, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(3, pct)}%`, height: '100%', background: ROSA }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Papel>

        {/* productos · ceja verde */}
        <Papel ceja={VERDE} pad="16px 18px">
          <Pill bg={VERDE} color={BLANCO} fontSize={11}>Lo más vendido hoy</Pill>
          <div style={{ marginTop: 12 }}>
            {platos.length === 0 && <span style={{ fontSize: 13, fontWeight: 600, color: GRIS }}>Sin ventas todavía.</span>}
            {platos.map((pl, i) => (
              <div key={pl.plato} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i === 0 ? `2px solid ${INK}` : `1px solid ${INK}22` }}>
                <span style={{ ...d('17px', i === 0 ? ROSA : INK), width: 26 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.plato}</span>
                <span style={{ width: 46, height: 10, background: TRACK, border: `2px solid ${INK}`, flexShrink: 0 }}>
                  <span style={{ display: 'block', width: `${Math.max(6, (pl.unidades / maxPlato) * 100)}%`, height: '100%', background: AZUL }} />
                </span>
                <span style={d('16px', AZUL)}>{N(pl.unidades)}</span>
              </div>
            ))}
          </div>
        </Papel>
      </div>
    </div>
  )
}
