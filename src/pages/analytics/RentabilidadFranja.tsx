/**
 * RentabilidadFranja — B3 · A qué horas y qué días ganas dinero.
 *
 * Usa `ventas_franja` (una fila por marca / fecha / hora) y le descuenta la
 * comisión de cada canal con el mismo motor que el resto del ERP (netoResolver),
 * para que el neto de aquí no discuta con el del Panel Global.
 *
 * Lo que NO hace todavía: descontar el coste de la materia prima. Eso necesita
 * que los platos tengan receta enlazada (Cocina → Coste por plato). Hasta
 * entonces, esto es margen sobre comisión, no margen final. Se avisa en pantalla.
 *
 * Estilo: Neobrutal (@/styles/neobrutal).
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  loadConfigCanales, loadMarcasPorCanal,
  type CanalConfig, type MarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'
import { resolverNeto } from '@/lib/panel/netoResolver'
import {
  OSW, LEX, INK, CREMA, CLARO, GRIS, GRANATE, VERDE, ROJO, AMA, NAR, BLANCO,
  VERDE_S, AMA_S, ROSA_S,
  SHADOW, BORDER, BORDER_CARD, d, eyebrow, cardWash, cardHead, pill,
} from '@/styles/neobrutal'

interface Franja {
  canal: string
  marca: string | null
  fecha: string
  hora: number
  dia_semana: number   // 0 = lunes
  pedidos: number
  unidades: number
  importe: number
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: true })
const eur0 = (n: number) => `${nf0(n)} €`
const eur2 = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const pct1 = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

/** Canal de ventas_franja → canal del motor de comisiones. */
function canalMotor(c: string): string {
  const x = (c || '').toLowerCase()
  if (x.includes('uber')) return 'uber'
  if (x.includes('glovo')) return 'glovo'
  if (x.includes('just') || x.includes('je') || x.includes('sinqro')) return 'je'
  if (x.includes('web')) return 'web'
  return 'dir'
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX, fontSize: 13, fontWeight: 600 }}>{children}</div>
}

function Nota({ tono = 'verde', children }: { tono?: 'verde' | 'rojo' | 'ambar' | 'blu'; children: React.ReactNode }) {
  const map = { verde: VERDE_S, rojo: ROSA_S, ambar: AMA_S, blu: CLARO } as const
  const borde = { verde: VERDE, rojo: GRANATE, ambar: AMA, blu: INK } as const
  return (
    <div style={{ marginTop: 14, padding: '11px 14px', background: map[tono], border: `2px solid ${borde[tono]}`, fontFamily: LEX, fontSize: 12.5, fontWeight: 600, color: INK, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

function InBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 8, background: CLARO, border: `2px solid ${INK}`, marginTop: 4, overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${Math.max(1, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
}

export function RentabilidadFranja({ embedded = false }: { embedded?: boolean } = {}) {
  const [franjas, setFranjas] = useState<Franja[]>([])
  const [config, setConfig] = useState<Record<string, CanalConfig>>({})
  const [marcasPorCanal, setMarcasPorCanal] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data }, cfg, mk] = await Promise.all([
        supabase.from('ventas_franja')
          .select('canal, marca, fecha, hora, dia_semana, pedidos, unidades, importe')
          .gt('importe', 0)
          .order('fecha', { ascending: false })
          .limit(20000),
        loadConfigCanales(),
        loadMarcasPorCanal(),
      ])
      setFranjas((data ?? []) as Franja[])
      setConfig(cfg)
      setMarcasPorCanal(mk)
      setCargando(false)
    })()
  }, [])

  /* ── Neto por franja: bruto menos la comisión de su canal ── */
  const conNeto = useMemo(() => {
    if (franjas.length === 0) return []
    const fechas = franjas.map(f => f.fecha).sort()
    const desde = new Date(fechas[0] + 'T12:00:00')
    const hasta = new Date(fechas[fechas.length - 1] + 'T12:00:00')
    const dias = new Set(fechas).size || 1

    return franjas.map(f => {
      const cm = canalMotor(f.canal)
      const { neto } = resolverNeto(cm, f.importe, f.pedidos, {
        modo: 'agregado_canal', marcasPorCanal, fechaDesde: desde, fechaHasta: hasta,
        configCanales: config, diasConDatos: dias,
      })
      return { ...f, neto: Number.isFinite(neto) ? neto : f.importe }
    })
  }, [franjas, config, marcasPorCanal])

  /* ── Agregado por hora ── */
  const porHora = useMemo(() => {
    const m = new Map<number, { pedidos: number; bruto: number; neto: number }>()
    for (const f of conNeto) {
      const a = m.get(f.hora) ?? { pedidos: 0, bruto: 0, neto: 0 }
      a.pedidos += f.pedidos; a.bruto += f.importe; a.neto += f.neto
      m.set(f.hora, a)
    }
    return [...m.entries()]
      .map(([hora, a]) => ({
        hora, ...a,
        ticket: a.pedidos > 0 ? a.bruto / a.pedidos : 0,
        margen: a.bruto > 0 ? (a.neto / a.bruto) * 100 : 0,
      }))
      .sort((a, b) => a.hora - b.hora)
  }, [conNeto])

  /* ── Agregado por día de la semana ── */
  const porDia = useMemo(() => {
    const m = new Map<number, { pedidos: number; bruto: number; neto: number; dias: Set<string> }>()
    for (const f of conNeto) {
      const a = m.get(f.dia_semana) ?? { pedidos: 0, bruto: 0, neto: 0, dias: new Set<string>() }
      a.pedidos += f.pedidos; a.bruto += f.importe; a.neto += f.neto; a.dias.add(f.fecha)
      m.set(f.dia_semana, a)
    }
    return Array.from({ length: 7 }, (_, d) => {
      const a = m.get(d)
      const nd = a ? a.dias.size : 0
      return {
        dia: d,
        label: DIAS[d],
        pedidos: a?.pedidos ?? 0,
        bruto: a?.bruto ?? 0,
        neto: a?.neto ?? 0,
        brutoMedio: a && nd > 0 ? a.bruto / nd : 0,
        ticket: a && a.pedidos > 0 ? a.bruto / a.pedidos : 0,
      }
    })
  }, [conNeto])

  /* ── Mapa de calor día × hora ── */
  const heat = useMemo(() => {
    const m = new Map<string, number>()
    let max = 0
    for (const f of conNeto) {
      const k = `${f.dia_semana}-${f.hora}`
      const v = (m.get(k) ?? 0) + f.neto
      m.set(k, v)
      if (v > max) max = v
    }
    return { m, max: max || 1 }
  }, [conNeto])

  const horasActivas = useMemo(() => {
    const hs = porHora.filter(h => h.pedidos >= 3).map(h => h.hora)
    return hs.length > 0 ? { min: Math.min(...hs), max: Math.max(...hs) } : { min: 11, max: 23 }
  }, [porHora])

  const rango = useMemo(() => {
    const out: number[] = []
    for (let h = horasActivas.min; h <= horasActivas.max; h++) out.push(h)
    return out
  }, [horasActivas])

  const totalBruto = conNeto.reduce((s, f) => s + f.importe, 0)
  const totalNeto = conNeto.reduce((s, f) => s + f.neto, 0)
  const totalPedidos = conNeto.reduce((s, f) => s + f.pedidos, 0)

  const mejorHora = useMemo(
    () => porHora.reduce<typeof porHora[0] | null>((b, h) => (!b || h.neto > b.neto ? h : b), null),
    [porHora])
  const mejorDia = useMemo(
    () => porDia.reduce<typeof porDia[0] | null>((b, d) => (!b || d.neto > b.neto ? d : b), null),
    [porDia])
  const peorDia = useMemo(
    () => porDia.filter(d => d.pedidos > 0).reduce<typeof porDia[0] | null>((b, d) => (!b || d.neto < b.neto ? d : b), null),
    [porDia])

  /* ── Horas flojas: abiertas pero con muy poco ── */
  const horasFlojas = useMemo(() => {
    if (porHora.length === 0) return []
    const medio = totalNeto / porHora.length
    return porHora.filter(h => h.pedidos > 0 && h.neto < medio * 0.15).sort((a, b) => a.neto - b.neto)
  }, [porHora, totalNeto])

  /* ── Madrugada: aviso de zona horaria ── */
  const madrugada = useMemo(
    () => porHora.filter(h => h.hora >= 0 && h.hora <= 5).reduce((s, h) => s + h.bruto, 0),
    [porHora])

  const maxNetoHora = porHora.reduce((m, h) => Math.max(m, h.neto), 0) || 1
  const maxBrutoDia = porDia.reduce((m, d) => Math.max(m, d.bruto), 0) || 1

  const wrapStyle: React.CSSProperties = { fontFamily: LEX, padding: embedded ? 0 : 28, background: embedded ? 'transparent' : CREMA, minHeight: embedded ? 'auto' : '100vh', color: INK }

  if (cargando) {
    return <div style={wrapStyle}><div style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW }}><Vacio>Cargando franjas…</Vacio></div></div>
  }
  if (conNeto.length === 0) {
    return <div style={wrapStyle}><div style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW }}><Vacio>No hay datos de franjas horarias todavía.</Vacio></div></div>
  }

  const th: React.CSSProperties = { padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '9px 12px', fontFamily: LEX, fontSize: 13, color: INK, borderBottom: `2px solid ${INK}` }

  return (
    <div style={wrapStyle}>
      {!embedded && (
        <div style={{ marginBottom: 20 }}>
          <span style={eyebrow(CLARO)}>ANALÍTICA</span>
          <h1 style={{ ...d('clamp(26px,3.4vw,36px)', GRANATE), margin: '10px 0 6px' }}>RENTABILIDAD POR FRANJA</h1>
          <span style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>A qué horas y qué días te queda dinero de verdad.</span>
        </div>
      )}

      {/* Hero */}
      <div style={{ background: GRANATE, border: BORDER_CARD, boxShadow: SHADOW, padding: '18px 22px', marginBottom: 16, color: BLANCO }}>
        <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.85 }}>MEJOR FRANJA</div>
        <div style={{ fontFamily: OSW, fontSize: 16, fontWeight: 700, margin: '6px 0 10px' }}>
          {mejorHora && mejorDia
            ? `Tu hora fuerte son las ${mejorHora.hora}:00 y tu día fuerte el ${DIAS_LARGO[mejorDia.dia]}`
            : 'Ventas por franja horaria'}
        </div>
        <div style={{ ...d('clamp(30px,4.2vw,40px)', BLANCO) }}>{mejorHora ? eur0(mejorHora.neto) : '—'}</div>
        {mejorHora && (
          <div style={{ fontFamily: LEX, fontSize: 12, opacity: 0.92, fontWeight: 600, marginTop: 8 }}>
            Neto acumulado a las {mejorHora.hora}:00 · {nf0(mejorHora.pedidos)} pedidos · ticket {eur2(mejorHora.ticket)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ background: BLANCO, color: GRANATE, border: `2px solid ${BLANCO}`, padding: '4px 10px', fontFamily: OSW, fontWeight: 700, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{eur0(totalNeto)} neto total</span>
          <span style={{ background: 'transparent', color: BLANCO, border: `2px solid ${BLANCO}`, padding: '4px 10px', fontFamily: OSW, fontWeight: 700, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{nf0(totalPedidos)} pedidos</span>
          {peorDia && <span style={{ background: 'transparent', color: BLANCO, border: `2px solid ${BLANCO}`, padding: '4px 10px', fontFamily: OSW, fontWeight: 700, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Tu día flojo: {DIAS_LARGO[peorDia.dia]}</span>}
        </div>
      </div>

      <div style={{ background: AMA_S, border: `3px solid ${AMA}`, boxShadow: SHADOW, padding: '12px 16px', marginBottom: 16, fontFamily: LEX, fontSize: 13, fontWeight: 600, color: INK }}>
        <b>Esto es lo que te queda después de la comisión, no después de cocinar.</b> Para saber el margen de verdad
        hace falta el coste de la materia prima de cada plato. Lo tienes a un paso en Cocina → Coste por plato.
      </div>

      {madrugada > 0 && (
        <div style={{ background: CLARO, border: `3px solid ${INK}`, boxShadow: SHADOW, padding: '12px 16px', marginBottom: 16, fontFamily: LEX, fontSize: 13, fontWeight: 600, color: INK }}>
          <b>Hay ventas registradas entre las 00:00 y las 05:00 ({eur0(madrugada)}).</b> Si la cocina no está abierta a esas horas,
          las plataformas están mandando la hora en otro huso y hay que corregirlo: te desplaza todos los picos.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
        <div style={cardWash(VERDE_S)}>
          <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Neto tras comisión</div>
          <div style={{ ...d('26px', VERDE), margin: '6px 0' }}>{eur0(totalNeto)}</div>
          <span style={pill(VERDE_S, VERDE)}>{pct1(totalBruto > 0 ? (totalNeto / totalBruto) * 100 : 0)} del bruto</span>
        </div>
        <div style={cardWash(CLARO)}>
          <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Hora más rentable</div>
          <div style={{ ...d('26px', INK), margin: '6px 0' }}>{mejorHora ? `${mejorHora.hora}:00` : '—'}</div>
          {mejorHora && <span style={pill(CLARO, INK)}>{eur0(mejorHora.neto)} netos</span>}
        </div>
        <div style={cardWash(AMA_S)}>
          <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Día más fuerte</div>
          <div style={{ ...d('26px', INK), margin: '6px 0' }}>{mejorDia ? DIAS[mejorDia.dia] : '—'}</div>
          {mejorDia && <span style={pill(AMA_S, AMA)}>{eur0(mejorDia.brutoMedio)} de media</span>}
        </div>
        <div style={cardWash(ROSA_S)}>
          <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Horas que casi no venden</div>
          <div style={{ ...d('26px', GRANATE), margin: '6px 0' }}>{nf0(horasFlojas.length)}</div>
          <span style={pill(ROSA_S, GRANATE)}>abiertas y a media máquina</span>
        </div>
      </div>

      {/* Mapa de calor */}
      <div style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ ...cardHead(GRANATE), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div>Dónde está el dinero, hora a hora</div>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>Cuanto más oscura la casilla, más neto deja esa franja</div>
          </div>
          <span style={{ fontFamily: OSW, fontSize: 11, fontWeight: 700, color: BLANCO }}>{rango.length} horas activas</span>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 3 }}>
              <thead>
                <tr>
                  <th style={{ border: 'none', paddingBottom: 4 }}></th>
                  {rango.map(h => (
                    <th key={h} style={{
                      border: 'none', textAlign: 'center', fontSize: 10, fontFamily: OSW,
                      color: GRIS, padding: '0 0 4px', minWidth: 34,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIAS.map((dia, di) => (
                  <tr key={dia}>
                    <td style={{
                      border: 'none', padding: '0 8px 0 0', fontSize: 11.5, fontFamily: OSW,
                      fontWeight: 700, color: INK, whiteSpace: 'nowrap',
                    }}>{dia}</td>
                    {rango.map(h => {
                      const v = heat.m.get(`${di}-${h}`) ?? 0
                      const int = v / heat.max
                      return (
                        <td key={h} title={`${DIAS_LARGO[di]} ${h}:00 · ${eur0(v)} netos`}
                          style={{
                            border: `2px solid ${INK}`, padding: 0, height: 30, minWidth: 34,
                            background: v === 0 ? CLARO : `rgba(176,29,35,${0.12 + int * 0.82})`,
                            color: int > 0.55 ? BLANCO : INK,
                            textAlign: 'center', fontSize: 9.5, fontFamily: OSW, fontWeight: 700,
                          }}>
                          {v >= 200 ? Math.round(v) : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mejorDia && mejorHora && (
            <Nota tono="verde">
              El pico está el <b>{DIAS_LARGO[mejorDia.dia]}</b> a las <b>{mejorHora.hora}:00</b>. Ahí es donde tiene sentido
              meter promoción, personal y stock: un euro invertido en tu pico rinde más que uno en tu valle.
            </Nota>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <div style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW, overflow: 'hidden' }}>
          <div style={cardHead(GRANATE)}>
            <div>Hora a hora</div>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>Bruto, neto tras comisión y ticket medio</div>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: INK }}>
                    <th style={th}>Hora</th>
                    <th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
                    <th style={th}>Neto</th>
                    <th style={{ ...th, textAlign: 'right' }}>Ticket</th>
                    <th style={{ ...th, textAlign: 'right' }}>Te queda</th>
                  </tr>
                </thead>
                <tbody>
                  {porHora.map(h => (
                    <tr key={h.hora}>
                      <td style={td}>{String(h.hora).padStart(2, '0')}:00</td>
                      <td style={{ ...td, textAlign: 'right' }}>{nf0(h.pedidos)}</td>
                      <td style={{ ...td, minWidth: 120 }}>
                        <span>{eur0(h.neto)}</span>
                        <InBar pct={(h.neto / maxNetoHora) * 100} color={ROJO} />
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>{h.ticket > 0 ? eur2(h.ticket) : '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <span style={pill(h.margen >= 65 ? VERDE_S : h.margen >= 50 ? AMA_S : ROSA_S, h.margen >= 65 ? VERDE : h.margen >= 50 ? AMA : GRANATE)}>{pct1(h.margen)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {horasFlojas.length > 0 && (
              <Nota tono="rojo">
                <b>Horas abiertas casi sin ventas:</b> {horasFlojas.slice(0, 5).map(h => `${h.hora}:00`).join(', ')}.
                Si tienes gente en cocina en esas franjas, ahí se te va el margen sin que lo veas.
              </Nota>
            )}
          </div>
        </div>

        <div style={{ background: BLANCO, border: BORDER, boxShadow: SHADOW, overflow: 'hidden' }}>
          <div style={cardHead(GRANATE)}>
            <div>Día de la semana</div>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>Facturación media de cada día</div>
          </div>
          <div style={{ padding: '14px 16px' }}>
            {porDia.map(dd => (
              <div key={dd.dia} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: OSW, fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
                  <span>{DIAS_LARGO[dd.dia].charAt(0).toUpperCase() + DIAS_LARGO[dd.dia].slice(1)}</span>
                  <span style={{ color: GRIS, fontSize: 12 }}>{eur0(dd.bruto)}</span>
                </div>
                <div style={{ height: 10, background: CLARO, border: `2px solid ${INK}`, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(dd.bruto / maxBrutoDia) * 100}%`,
                    background: mejorDia && dd.dia === mejorDia.dia ? VERDE : NAR,
                  }} />
                </div>
              </div>
            ))}
            {peorDia && mejorDia && peorDia.bruto > 0 && (
              <Nota tono="ambar">
                El <b>{DIAS_LARGO[mejorDia.dia]}</b> vendes {(mejorDia.bruto / peorDia.bruto).toFixed(1)} veces más que el <b>{DIAS_LARGO[peorDia.dia]}</b>.
                Si abres las mismas horas los dos días con la misma gente, el {DIAS_LARGO[peorDia.dia]} te está costando dinero.
              </Nota>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RentabilidadFranja
