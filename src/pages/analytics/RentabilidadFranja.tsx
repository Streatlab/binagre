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
 * Estilo: Ley Visual SL v2.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  loadConfigCanales, loadMarcasPorCanal,
  type CanalConfig, type MarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'
import { resolverNeto } from '@/lib/panel/netoResolver'
import {
  C, Card, CardHead, Hero, HeroPill, Kpi, KpiGrid, Pill, Nota, Vacio, Atencion, InBar,
  eur0, eur2, num0, pct1,
} from '@/components/panel/sl/uiSL'

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

/** Canal de ventas_franja → canal del motor de comisiones. */
function canalMotor(c: string): string {
  const x = (c || '').toLowerCase()
  if (x.includes('uber')) return 'uber'
  if (x.includes('glovo')) return 'glovo'
  if (x.includes('just') || x.includes('je') || x.includes('sinqro')) return 'je'
  if (x.includes('web')) return 'web'
  return 'dir'
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

  if (cargando) {
    return <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}><Card><Vacio>Cargando franjas…</Vacio></Card></div>
  }
  if (conNeto.length === 0) {
    return <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}><Card><Vacio>No hay datos de franjas horarias todavía.</Vacio></Card></div>
  }

  return (
    <div className="sl-skin" style={{ minHeight: embedded ? 'auto' : '100vh', padding: embedded ? 0 : '24px 28px' }}>
      {!embedded && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>Rentabilidad por franja</div>
          <div style={{ fontSize: 12, color: C.grisCl, fontWeight: 700, marginTop: 2 }}>
            A qué horas y qué días te queda dinero de verdad.
          </div>
        </div>
      )}

      <Hero
        eyebrow="MEJOR FRANJA"
        titular={mejorHora && mejorDia
          ? `Tu hora fuerte son las ${mejorHora.hora}:00 y tu día fuerte el ${DIAS_LARGO[mejorDia.dia]}`
          : 'Ventas por franja horaria'}
        valor={mejorHora ? eur0(mejorHora.neto) : '—'}
        sub={mejorHora
          ? `Neto acumulado a las ${mejorHora.hora}:00 · ${num0(mejorHora.pedidos)} pedidos · ticket ${eur2(mejorHora.ticket)}`
          : undefined}
        spark={porHora.map(h => h.neto)}
        right={
          <>
            <HeroPill solid>{eur0(totalNeto)} neto total</HeroPill>
            <HeroPill>{num0(totalPedidos)} pedidos</HeroPill>
            {peorDia && <HeroPill>Tu día flojo: {DIAS_LARGO[peorDia.dia]}</HeroPill>}
          </>
        }
      />

      <Atencion tono="ambar">
        <b>Esto es lo que te queda después de la comisión, no después de cocinar.</b> Para saber el margen de verdad
        hace falta el coste de la materia prima de cada plato. Lo tienes a un paso en Cocina → Coste por plato.
      </Atencion>

      {madrugada > 0 && (
        <Atencion tono="blu" cifra={eur0(madrugada)}>
          <b>Hay ventas registradas entre las 00:00 y las 05:00.</b> Si la cocina no está abierta a esas horas,
          las plataformas están mandando la hora en otro huso y hay que corregirlo: te desplaza todos los picos.
        </Atencion>
      )}

      <KpiGrid>
        <Kpi icono="€" tono="verde" label="Neto tras comisión" valor={eur0(totalNeto)}
          pie={<Pill tone="verde" dot>{pct1(totalBruto > 0 ? (totalNeto / totalBruto) * 100 : 0)} del bruto</Pill>} />
        <Kpi icono="◷" tono="blu" label="Hora más rentable"
          valor={mejorHora ? `${mejorHora.hora}:00` : '—'}
          pie={mejorHora ? <Pill tone="blu" dot>{eur0(mejorHora.neto)} netos</Pill> : undefined} />
        <Kpi icono="★" tono="ambar" label="Día más fuerte"
          valor={mejorDia ? DIAS[mejorDia.dia] : '—'}
          pie={mejorDia ? <Pill tone="ambar" dot>{eur0(mejorDia.brutoMedio)} de media</Pill> : undefined} />
        <Kpi icono="↧" tono="rojo" label="Horas que casi no venden" valor={num0(horasFlojas.length)}
          pie={<Pill tone="rojo" dot>abiertas y a media máquina</Pill>} />
      </KpiGrid>

      {/* ── Mapa de calor ── */}
      <Card>
        <CardHead
          title="Dónde está el dinero, hora a hora"
          sub="Cuanto más oscura la casilla, más neto deja esa franja"
          right={<Pill tone="neutro">{rango.length} horas activas</Pill>}
        />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 3 }}>
            <thead>
              <tr>
                <th style={{ borderBottom: 'none', paddingBottom: 4 }}></th>
                {rango.map(h => (
                  <th key={h} className="slnum" style={{
                    borderBottom: 'none', textAlign: 'center', fontSize: 10,
                    color: C.grisCl, padding: '0 0 4px', minWidth: 34,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIAS.map((d, di) => (
                <tr key={d}>
                  <td style={{
                    border: 'none', padding: '0 8px 0 0', fontSize: 11.5,
                    fontWeight: 900, color: C.gris, whiteSpace: 'nowrap',
                  }}>{d}</td>
                  {rango.map(h => {
                    const v = heat.m.get(`${di}-${h}`) ?? 0
                    const int = v / heat.max
                    return (
                      <td key={h} title={`${DIAS_LARGO[di]} ${h}:00 · ${eur0(v)} netos`}
                        style={{
                          border: 'none', padding: 0, height: 30, minWidth: 34,
                          borderRadius: 7,
                          background: v === 0 ? C.track : `rgba(176,29,35,${0.10 + int * 0.85})`,
                          color: int > 0.55 ? '#fff' : C.gris,
                          textAlign: 'center', fontSize: 9.5, fontWeight: 800,
                          fontFamily: "'JetBrains Mono', monospace",
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
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <Card>
          <CardHead title="Hora a hora" sub="Bruto, neto tras comisión y ticket medio" />
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th className="r">Pedidos</th>
                  <th>Neto</th>
                  <th className="r">Ticket</th>
                  <th className="r">Te queda</th>
                </tr>
              </thead>
              <tbody>
                {porHora.map(h => (
                  <tr key={h.hora}>
                    <td className="slnum">{String(h.hora).padStart(2, '0')}:00</td>
                    <td className="r slnum">{num0(h.pedidos)}</td>
                    <td style={{ minWidth: 120 }}>
                      <span className="slnum">{eur0(h.neto)}</span>
                      <InBar pct={(h.neto / maxNetoHora) * 100} color={C.rojo} />
                    </td>
                    <td className="r slnum">{h.ticket > 0 ? eur2(h.ticket) : '—'}</td>
                    <td className="r">
                      <Pill tone={h.margen >= 65 ? 'verde' : h.margen >= 50 ? 'ambar' : 'rojo'}>{pct1(h.margen)}</Pill>
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
        </Card>

        <Card>
          <CardHead title="Día de la semana" sub="Facturación media de cada día" />
          {porDia.map(d => (
            <div key={d.dia} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 900, marginBottom: 5 }}>
                <span>{DIAS_LARGO[d.dia].charAt(0).toUpperCase() + DIAS_LARGO[d.dia].slice(1)}</span>
                <span className="slnum" style={{ color: C.gris, fontSize: 12 }}>{eur0(d.bruto)}</span>
              </div>
              <div style={{ height: 9, background: C.track, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  width: `${(d.bruto / maxBrutoDia) * 100}%`,
                  background: mejorDia && d.dia === mejorDia.dia ? C.verde : C.rojo,
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
        </Card>
      </div>
    </div>
  )
}

export default RentabilidadFranja
