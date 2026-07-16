/**
 * CUADRO DE MANDO (Ley Visual SL v2 · acento oliva)
 *
 * Una sola vista para saber cómo va el negocio de un vistazo: venta, lo que te
 * queda, canales, marcas, platos, curva del día, caja y frentes abiertos.
 * Resumen + Evolución + Cashflow fundidos.
 *
 * Palancas: periodo (hoy / 7 / 30 / 90 días) y unidad (€ / % / pedidos).
 * Toda cifra lleva su comparativa: vs periodo anterior y vs mismo tramo del mes
 * pasado. El neto SIEMPRE sale de netoResolver (LEY DEL NETO).
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useVentasRealesListas, resolverNetoCanal } from '@/lib/panel/netoResolver'
import { useTesoreria13Semanas, type SemanaTesoreria } from '@/lib/finanzas/useTesoreria13Semanas'
import {
  C, Card, CardHead, Pill, Nota, Vacio, InBar, LineaArea,
  eur0, eur2, num0, pct1, CANAL_COLOR, CANAL_LABEL,
} from '@/components/panel/sl/uiSL'
import { PageHead, SkeletonTabla, Tabla, Fila, Celda } from '@/components/panel/sl/uiSLTabla'
import { OLIVA, Ranking, Leyenda, AnilloHero } from '@/components/panel/sl/uiSLFoco'
import {
  Palanca, Frentes, PulsoRobot, Reparto, BarraDoble, CurvaDia, Tarjeta,
} from '@/components/panel/sl/uiSLPanel'

type Unidad = 'eur' | 'pct' | 'ped'
type Periodo = 'hoy' | '7d' | '30d' | '90d'

const PERIODOS: Array<{ id: Periodo; label: string; dias: number }> = [
  { id: 'hoy', label: 'Hoy', dias: 1 },
  { id: '7d', label: '7 días', dias: 7 },
  { id: '30d', label: '30 días', dias: 30 },
  { id: '90d', label: '90 días', dias: 90 },
]

const CANALES = ['uber', 'glovo', 'je', 'web', 'dir'] as const
type CanalId = typeof CANALES[number]

interface RowFact {
  fecha: string
  uber_bruto: number | null; uber_pedidos: number | null
  glovo_bruto: number | null; glovo_pedidos: number | null
  je_bruto: number | null; je_pedidos: number | null
  web_bruto: number | null; web_pedidos: number | null
  directa_bruto: number | null; directa_pedidos: number | null
  total_bruto: number | null; total_pedidos: number | null
}

const bru = (r: RowFact, c: CanalId): number => Number(
  c === 'uber' ? r.uber_bruto : c === 'glovo' ? r.glovo_bruto : c === 'je' ? r.je_bruto
    : c === 'web' ? r.web_bruto : r.directa_bruto
) || 0
const ped = (r: RowFact, c: CanalId): number => Number(
  c === 'uber' ? r.uber_pedidos : c === 'glovo' ? r.glovo_pedidos : c === 'je' ? r.je_pedidos
    : c === 'web' ? r.web_pedidos : r.directa_pedidos
) || 0

const dStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const restaDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() - n); return x }
const restaMes = (d: Date) => { const x = new Date(d); x.setMonth(x.getMonth() - 1); return x }

const delta = (a: number, b: number): { txt: string; sube: boolean } => {
  if (!b) return { txt: '—', sube: true }
  const v = ((a - b) / b) * 100
  return {
    txt: `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
    sube: v >= 0,
  }
}
const deltaPts = (a: number, b: number): { txt: string; sube: boolean } => {
  const v = a - b
  return {
    txt: `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts`,
    sube: v >= 0,
  }
}

export default function LabPanel() {
  const [unidad, setUnidad] = useState<Unidad>('eur')
  const [periodo, setPeriodo] = useState<Periodo>('7d')
  const [cargando, setCargando] = useState(true)

  const [act, setAct] = useState<RowFact[]>([])
  const [ant, setAnt] = useState<RowFact[]>([])
  const [mes, setMes] = useState<RowFact[]>([])
  const [franjaHoy, setFranjaHoy] = useState<Array<{ hora: number; importe: number }>>([])
  const [franjaPrev, setFranjaPrev] = useState<Array<{ hora: number; importe: number }>>([])
  const [marcas, setMarcas] = useState<Array<{ marca: string; pedidos: number; euros: number }>>([])
  const [platos, setPlatos] = useState<Array<{ plato: string; unidades: number; euros: number }>>([])
  const [ultimo, setUltimo] = useState<Date | null>(null)
  const [sinFactura, setSinFactura] = useState<{ n: number; importe: number }>({ n: 0, importe: 0 })
  const [sinPrecio, setSinPrecio] = useState(0)

  const netoListo = useVentasRealesListas()
  const tes = useTesoreria13Semanas()

  const dias = PERIODOS.find(p => p.id === periodo)!.dias

  useEffect(() => {
    setCargando(true)
    const hoy = new Date()
    const desde = restaDias(hoy, dias - 1)
    const antHasta = restaDias(desde, 1)
    const antDesde = restaDias(antHasta, dias - 1)
    const mesHasta = restaMes(hoy)
    const mesDesde = restaDias(mesHasta, dias - 1)
    const haceSemana = restaDias(hoy, 7)

    const cols = 'fecha, uber_bruto, uber_pedidos, glovo_bruto, glovo_pedidos, je_bruto, je_pedidos, web_bruto, web_pedidos, directa_bruto, directa_pedidos, total_bruto, total_pedidos'

    Promise.all([
      supabase.from('facturacion_diario').select(cols).gte('fecha', dStr(desde)).lte('fecha', dStr(hoy)).order('fecha'),
      supabase.from('facturacion_diario').select(cols).gte('fecha', dStr(antDesde)).lte('fecha', dStr(antHasta)).order('fecha'),
      supabase.from('facturacion_diario').select(cols).gte('fecha', dStr(mesDesde)).lte('fecha', dStr(mesHasta)).order('fecha'),
      supabase.from('v_ventas_franja').select('hora, importe_bruto').eq('fecha', dStr(hoy)),
      supabase.from('v_ventas_franja').select('hora, importe_bruto').eq('fecha', dStr(haceSemana)),
      supabase.from('v_vivo_marcas').select('marca, pedidos, euros'),
      supabase.from('v_vivo_top_platos').select('plato, unidades, euros'),
      supabase.from('ventas_vivo').select('momento').order('momento', { ascending: false }).limit(1),
      supabase.from('conciliacion').select('importe').lt('importe', 0).is('factura_id', null),
      supabase.from('ingredientes').select('precio_kg'),
    ]).then(([a, b, m, fh, fp, mk, pl, uv, cf, ing]) => {
      setAct((a.data ?? []) as unknown as RowFact[])
      setAnt((b.data ?? []) as unknown as RowFact[])
      setMes((m.data ?? []) as unknown as RowFact[])

      const agrupa = (rows: any[]) => {
        const acc: Record<number, number> = {}
        rows.forEach(r => { acc[Number(r.hora)] = (acc[Number(r.hora)] ?? 0) + Number(r.importe_bruto ?? 0) })
        return Object.entries(acc).map(([h, v]) => ({ hora: Number(h), importe: v })).sort((x, y) => x.hora - y.hora)
      }
      setFranjaHoy(agrupa(fh.data ?? []))
      setFranjaPrev(agrupa(fp.data ?? []))

      setMarcas(((mk.data ?? []) as any[]).map(r => ({
        marca: r.marca ?? '—', pedidos: Number(r.pedidos ?? 0), euros: Number(r.euros ?? 0),
      })).sort((x, y) => y.euros - x.euros))

      setPlatos(((pl.data ?? []) as any[]).map(r => ({
        plato: r.plato ?? '—', unidades: Number(r.unidades ?? 0), euros: Number(r.euros ?? 0),
      })).slice(0, 6))

      const mom = (uv.data ?? [])[0] as any
      setUltimo(mom?.momento ? new Date(mom.momento) : null)

      const gastos = (cf.data ?? []) as any[]
      setSinFactura({
        n: gastos.length,
        importe: gastos.reduce((s, g) => s + Math.abs(Number(g.importe ?? 0)), 0),
      })

      const ings = (ing.data ?? []) as any[]
      setSinPrecio(ings.filter(i => !(Number(i.precio_kg ?? 0) > 0)).length)

      setCargando(false)
    })
  }, [dias])

  const d = useMemo(() => {
    const suma = (rows: RowFact[]) => ({
      bruto: rows.reduce((s, r) => s + (Number(r.total_bruto ?? 0) || 0), 0),
      pedidos: rows.reduce((s, r) => s + (Number(r.total_pedidos ?? 0) || 0), 0),
    })
    const a = suma(act), b = suma(ant), m = suma(mes)

    const ticket = a.pedidos > 0 ? a.bruto / a.pedidos : 0
    const ticketAnt = b.pedidos > 0 ? b.bruto / b.pedidos : 0
    const ticketMes = m.pedidos > 0 ? m.bruto / m.pedidos : 0

    const hoy = new Date()
    const desde = restaDias(hoy, dias - 1)

    const canales = CANALES.map(c => {
      const bruto = act.reduce((s, r) => s + bru(r, c), 0)
      const pedidos = act.reduce((s, r) => s + ped(r, c), 0)
      const brutoAnt = ant.reduce((s, r) => s + bru(r, c), 0)
      const res = netoListo && bruto > 0
        ? resolverNetoCanal(c, bruto, pedidos, { fechaDesde: desde, fechaHasta: hoy } as any)
        : { neto: 0, margenPct: 0, fuente: 'estimado' as const }
      return {
        id: c,
        label: CANAL_LABEL[c] ?? c,
        color: CANAL_COLOR[c] ?? C.rojo,
        bruto, pedidos,
        neto: res.neto,
        margen: res.margenPct,
        fuente: res.fuente,
        varia: brutoAnt > 0 ? ((bruto - brutoAnt) / brutoAnt) * 100 : null,
      }
    }).filter(c => c.bruto > 0 || c.pedidos > 0).sort((x, y) => y.bruto - x.bruto)

    const neto = canales.reduce((s, c) => s + c.neto, 0)
    const netoPct = a.bruto > 0 ? (neto / a.bruto) * 100 : 0

    // neto del periodo anterior, para comparar el margen
    const desdeAnt = restaDias(restaDias(hoy, dias), dias - 1)
    const hastaAnt = restaDias(hoy, dias)
    const netoAnt = netoListo ? CANALES.reduce((s, c) => {
      const bAnt = ant.reduce((x, r) => x + bru(r, c), 0)
      const pAnt = ant.reduce((x, r) => x + ped(r, c), 0)
      if (bAnt <= 0) return s
      return s + resolverNetoCanal(c, bAnt, pAnt, { fechaDesde: desdeAnt, fechaHasta: hastaAnt } as any).neto
    }, 0) : 0
    const netoPctAnt = b.bruto > 0 ? (netoAnt / b.bruto) * 100 : 0

    const comision = Math.max(0, a.bruto - neto)
    const propio = canales.filter(c => c.id === 'web' || c.id === 'dir').reduce((s, c) => s + c.bruto, 0)
    const propioPct = a.bruto > 0 ? (propio / a.bruto) * 100 : 0
    const propioAnt = CANALES.filter(c => c === 'web' || c === 'dir')
      .reduce((s, c) => s + ant.reduce((x, r) => x + bru(r, c as CanalId), 0), 0)
    const propioPctAnt = b.bruto > 0 ? (propioAnt / b.bruto) * 100 : 0
    const propioMes = CANALES.filter(c => c === 'web' || c === 'dir')
      .reduce((s, c) => s + mes.reduce((x, r) => x + bru(r, c as CanalId), 0), 0)
    const propioPctMes = m.bruto > 0 ? (propioMes / m.bruto) * 100 : 0

    const serie = act.map(r => Number(r.total_bruto ?? 0) || 0)
    const serieP = act.map(r => Number(r.total_pedidos ?? 0) || 0)
    const etiquetas = act
      .filter((_, i) => i % Math.max(1, Math.ceil(act.length / 8)) === 0)
      .map(r => r.fecha.slice(8, 10) + '/' + r.fecha.slice(5, 7))

    const ritmo = b.bruto > 0 ? Math.min(150, (a.bruto / b.bruto) * 100) : 0

    return {
      bruto: a.bruto, pedidos: a.pedidos, ticket,
      brutoAnt: b.bruto, pedidosAnt: b.pedidos, ticketAnt,
      brutoMes: m.bruto, pedidosMes: m.pedidos, ticketMes,
      neto, netoPct, netoPctAnt, comision,
      canales, propio, propioPct, propioPctAnt, propioPctMes,
      serie, serieP, etiquetas, ritmo,
      porDia: a.pedidos / Math.max(1, act.length),
    }
  }, [act, ant, mes, netoListo, dias])

  const horas = useMemo(() => {
    const set = new Set<number>()
    franjaHoy.forEach(f => set.add(f.hora))
    franjaPrev.forEach(f => set.add(f.hora))
    return Array.from(set).sort((a, b) => a - b)
  }, [franjaHoy, franjaPrev])

  const curva = useMemo(() => ({
    hoy: horas.map(h => franjaHoy.find(f => f.hora === h)?.importe ?? 0),
    prev: horas.map(h => franjaPrev.find(f => f.hora === h)?.importe ?? 0),
  }), [horas, franjaHoy, franjaPrev])

  const minutos = ultimo ? Math.round((Date.now() - ultimo.getTime()) / 60000) : null
  const vivo = minutos != null && minutos < 30
  const haceTxt = minutos == null ? '' : minutos < 60 ? `HACE ${minutos} MIN` : `HACE ${Math.round(minutos / 60)} H`

  const frentes = [
    sinFactura.n > 0 ? { texto: `${num0(sinFactura.n)} gastos sin factura (${eur2(sinFactura.importe)})` } : null,
    tes.semanaCritica && tes.semanaCritica.estado !== 'verde'
      ? { texto: `Caja ${tes.semanaCritica.estado === 'rojo' ? 'en rojo' : 'ajustada'} la semana ${tes.semanaCritica.semana}` }
      : null,
    sinPrecio > 0 ? { texto: `${num0(sinPrecio)} ingredientes sin precio` } : null,
  ].filter(Boolean) as Array<{ texto: string }>

  const totalCanal = Math.max(1, d.canales.reduce((s, c) => s + c.bruto, 0))
  const valorCanal = (c: typeof d.canales[number]) =>
    unidad === 'eur' ? eur2(c.bruto) : unidad === 'pct' ? pct1((c.bruto / totalCanal) * 100) : `${num0(c.pedidos)} ped.`

  const totalMarca = Math.max(1, marcas.reduce((s, m) => s + m.euros, 0))
  const dTicket = delta(d.ticket, d.ticketAnt)
  const dTicketMes = delta(d.ticket, d.ticketMes)
  const dPedidos = delta(d.pedidos, d.pedidosAnt)
  const dPedidosMes = delta(d.pedidos, d.pedidosMes)
  const dBruto = delta(d.bruto, d.brutoAnt)
  const dBrutoMes = delta(d.bruto, d.brutoMes)
  const dNeto = deltaPts(d.netoPct, d.netoPctAnt)
  const dPropio = deltaPts(d.propioPct, d.propioPctAnt)
  const dPropioMes = deltaPts(d.propioPct, d.propioPctMes)
  const comisionPct = d.bruto > 0 ? (d.comision / d.bruto) * 100 : 0

  const val = (e: number, p: number, pe: number) =>
    unidad === 'eur' ? eur2(e) : unidad === 'pct' ? pct1(p) : num0(pe)

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <PageHead
        titulo="Cuadro de mando"
        sub={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        right={
          <>
            <PulsoRobot vivo={vivo} hace={haceTxt} />
            <Palanca opciones={PERIODOS.map(p => ({ id: p.id, label: p.label }))} valor={periodo} onChange={setPeriodo} compacta />
            <Palanca
              opciones={[{ id: 'eur' as Unidad, label: '€' }, { id: 'pct' as Unidad, label: '%' }, { id: 'ped' as Unidad, label: 'Pedidos' }]}
              valor={unidad}
              onChange={setUnidad}
              compacta
            />
          </>
        }
      />

      <Frentes items={frentes} />

      {cargando ? (
        <SkeletonTabla filas={10} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{
              background: 'linear-gradient(115deg, #951218 0%, #B01D23 46%, #EE8A4E 100%)',
              borderRadius: 18, padding: '16px 18px', color: '#fff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '1.3px', opacity: 0.82 }}>
                    VENTA BRUTA · {PERIODOS.find(p => p.id === periodo)!.label.toUpperCase()}
                  </div>
                  <div className="slnum" style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1.6px', margin: '2px 0' }}>
                    {eur2(d.bruto)}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.92 }}>
                    {num0(d.pedidos)} pedidos · ticket medio {eur2(d.ticket)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                    <span style={{ background: OLIVA.claro, color: OLIVA.tinta, fontSize: 10.5, fontWeight: 900, padding: '3px 9px', borderRadius: 999 }}>
                      {dBruto.txt} vs periodo anterior
                    </span>
                    <span style={{ border: '1px solid rgba(255,255,255,0.5)', fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999 }}>
                      {dBrutoMes.txt} vs mismo tramo mes pasado
                    </span>
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <AnilloHero pct={d.ritmo} label="DEL RITMO" />
                </div>
              </div>
              {d.serie.length > 1 && (
                <div style={{ marginTop: 6, opacity: 0.95 }}>
                  <svg width="100%" height="34" viewBox="0 0 320 34" preserveAspectRatio="none" aria-hidden="true">
                    <polyline
                      points={d.serie.map((v, i) => {
                        const mx = Math.max(...d.serie, 1)
                        return `${(i * (320 / Math.max(1, d.serie.length - 1))).toFixed(1)},${(30 - (v / mx) * 26).toFixed(1)}`
                      }).join(' ')}
                      fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>

            <Card style={{ marginBottom: 0 }}>
              <CardHead
                title="Lo que te queda"
                sub={`${pct1(d.netoPct)} del bruto · ${dNeto.txt} vs periodo anterior`}
                right={<Pill tone="neutro">{d.canales[0]?.fuente === 'real' ? 'Neto real' : 'Neto estimado'}</Pill>}
              />
              <div className="slnum" style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-1.2px', color: OLIVA.hondo, marginBottom: 10 }}>
                {eur2(d.neto)}
              </div>
              <Reparto
                total={Math.max(1, d.bruto)}
                tramos={[
                  { label: 'Comisión y costes de plataforma', importe: d.comision, color: C.rojoSem },
                  { label: 'Te queda', importe: d.neto, color: OLIVA.medio },
                ]}
              />
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
            <Tarjeta
              label="Venta bruta"
              valor={val(d.bruto, 100, d.pedidos)}
              d1={dBruto.txt} d2={dBrutoMes.txt} sube={dBruto.sube}
              pie={`Periodo anterior: ${eur2(d.brutoAnt)}`}
              spark={d.serie}
            />
            <Tarjeta
              label="Pedidos"
              valor={num0(d.pedidos)}
              d1={dPedidos.txt} d2={dPedidosMes.txt} sube={dPedidos.sube}
              pie={`${d.porDia.toFixed(1)} al día`}
              spark={d.serieP}
            />
            <Tarjeta
              label="Ticket medio"
              valor={eur2(d.ticket)}
              d1={dTicket.txt} d2={dTicketMes.txt} sube={dTicket.sube}
              pie="Sube el ticket antes que el volumen"
              spark={act.map(r => {
                const b = Number(r.total_bruto ?? 0) || 0
                const p = Number(r.total_pedidos ?? 0) || 0
                return p > 0 ? b / p : 0
              })}
            />
            <Tarjeta
              label="Lo que te queda"
              valor={unidad === 'pct' ? pct1(d.netoPct) : eur2(d.neto)}
              d1={dNeto.txt} d2="—" sube={dNeto.sube}
              pie={`${pct1(d.netoPct)} del bruto`}
              spark={d.serie}
            />
            <Tarjeta
              label="Comisión de plataformas"
              valor={unidad === 'pct' ? pct1(comisionPct) : eur2(d.comision)}
              d1={deltaPts(comisionPct, 100 - d.netoPctAnt).txt}
              d2="—"
              sube={comisionPct <= (100 - d.netoPctAnt)}
              pie={`${pct1(comisionPct)} de cada euro que facturas`}
              spark={d.serie}
            />
            <Tarjeta
              label="Venta propia"
              valor={unidad === 'pct' ? pct1(d.propioPct) : eur2(d.propio)}
              d1={dPropio.txt} d2={dPropioMes.txt} sube={dPropio.sube}
              pie="El único euro sin comisión"
              spark={act.map(r => (Number(r.web_bruto ?? 0) || 0) + (Number(r.directa_bruto ?? 0) || 0))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 12 }}>
            <Card style={{ marginBottom: 0 }}>
              <CardHead title="Curva del día" sub="Hoy contra el mismo día de la semana pasada" />
              <Leyenda items={[
                { label: 'Hoy', color: C.naranja },
                { label: 'Mismo día semana pasada', color: '#D3D1C7' },
                { label: 'Acumulado de hoy', color: OLIVA.medio },
              ]} />
              {horas.length === 0
                ? <Vacio>Todavía no hay ventas por hora de hoy.</Vacio>
                : <CurvaDia horas={horas} hoy={curva.hoy} pasado={curva.prev} />}
            </Card>

            <Card style={{ marginBottom: 0 }}>
              <CardHead title="Por dónde entra" sub="Barra clara: bruto · sólida: lo que te queda" />
              {d.canales.length === 0 ? <Vacio>Sin ventas en el periodo.</Vacio> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {d.canales.map(c => (
                    <BarraDoble
                      key={c.id}
                      label={c.label}
                      bruto={c.bruto}
                      neto={c.neto}
                      maximo={d.canales[0].bruto}
                      color={c.color}
                      pie={valorCanal(c)}
                    />
                  ))}
                  <Nota tono="blu">
                    De cada euro de plataforma te quedas {pct1(d.netoPct)}. En la web propia, casi todo.
                  </Nota>
                </div>
              )}
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
            <Card style={{ marginBottom: 0 }}>
              <CardHead title="Marcas que tiran" sub="Venta viva de hoy" />
              {marcas.length === 0 ? <Vacio>Sin datos del robot todavía.</Vacio> : (
                <Ranking
                  filas={marcas.slice(0, 5).map((m, i) => ({
                    label: m.marca,
                    valor: unidad === 'ped' ? m.pedidos : m.euros,
                    color: i === 0 ? OLIVA.medio : C.naranja,
                  }))}
                  fmt={(n) => unidad === 'ped' ? `${num0(n)} ped.` : unidad === 'pct' ? pct1((n / totalMarca) * 100) : eur2(n)}
                />
              )}
            </Card>

            <Card style={{ marginBottom: 0 }}>
              <CardHead title="Lo más vendido" sub="Hoy, por unidades" />
              {platos.length === 0 ? <Vacio>Sin platos vendidos todavía hoy.</Vacio> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {platos.map((p, i) => (
                    <div key={p.plato} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="slnum" style={{ fontSize: 11, fontWeight: 800, color: C.grisCl }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{
                        flex: 1, fontSize: 11.5, fontWeight: 800,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{p.plato}</span>
                      <span className="slnum" style={{ fontSize: 11.5, fontWeight: 900 }}>
                        {unidad === 'ped' ? `${num0(p.unidades)} uds` : eur2(p.euros)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card style={{ marginBottom: 0 }}>
              <CardHead
                title="Caja a 13 semanas"
                sub={tes.semanaCritica ? `Semana peor: ${tes.semanaCritica.semana}` : 'Sin semanas críticas'}
                right={
                  <Pill tone={tes.semanaCritica?.estado === 'rojo' ? 'rojo' : tes.semanaCritica?.estado === 'ambar' ? 'ambar' : 'verde'} dot>
                    {tes.semanaCritica?.estado === 'rojo' ? 'En rojo' : tes.semanaCritica?.estado === 'ambar' ? 'Ajustado' : 'Holgado'}
                  </Pill>
                }
              />
              {tes.loading ? <Vacio>Calculando la previsión…</Vacio> : (
                <>
                  <div className="slnum" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-1px', marginBottom: 8 }}>
                    {eur2(tes.saldoMinimo)}
                  </div>
                  <LineaArea
                    puntos={tes.semanas.map((s: SemanaTesoreria) => s.saldoAcumulado)}
                    etiquetas={tes.semanas.filter((_, i) => i % 4 === 0).map((s: SemanaTesoreria) => s.semana.slice(0, 6))}
                    fmt={eur0}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, marginTop: 8 }}>
                    <span style={{ color: OLIVA.hondo }}>
                      Entra {eur2(tes.semanas.reduce((s: number, x: SemanaTesoreria) => s + x.entradas, 0))}
                    </span>
                    <span style={{ color: C.rojoSem }}>
                      Sale {eur2(tes.semanas.reduce((s: number, x: SemanaTesoreria) => s + x.salidas, 0))}
                    </span>
                  </div>
                </>
              )}
            </Card>
          </div>

          <Tabla
            cabeceras={[
              { label: 'Comparativa' },
              { label: 'Bruto', alinea: 'der' },
              { label: 'Pedidos', alinea: 'der' },
              { label: 'Ticket', alinea: 'der' },
              { label: 'Peso', alinea: 'der', ancho: 140 },
              { label: 'Diferencia', alinea: 'der', ancho: 130 },
            ]}
          >
            {[
              { n: 'Periodo actual', b: d.bruto, p: d.pedidos, t: d.ticket, dif: null as number | null, tono: 'rojo' as const },
              { n: 'Periodo anterior', b: d.brutoAnt, p: d.pedidosAnt, t: d.ticketAnt, dif: d.brutoAnt > 0 ? ((d.bruto - d.brutoAnt) / d.brutoAnt) * 100 : null, tono: 'neutro' as const },
              { n: 'Mismo tramo, mes pasado', b: d.brutoMes, p: d.pedidosMes, t: d.ticketMes, dif: d.brutoMes > 0 ? ((d.bruto - d.brutoMes) / d.brutoMes) * 100 : null, tono: 'neutro' as const },
            ].map(f => {
              const mx = Math.max(d.bruto, d.brutoAnt, d.brutoMes, 1)
              return (
                <Fila key={f.n} tono={f.tono}>
                  <Celda fuerte>{f.n}</Celda>
                  <Celda der mono fuerte>{eur2(f.b)}</Celda>
                  <Celda der mono>{num0(f.p)}</Celda>
                  <Celda der mono>{eur2(f.t)}</Celda>
                  <Celda der><InBar pct={(f.b / mx) * 100} color={C.naranja} /></Celda>
                  <Celda der>
                    {f.dif == null ? <Pill tone="neutro">referencia</Pill> : (
                      <span className="slnum" style={{ fontWeight: 900, color: f.dif >= 0 ? OLIVA.hondo : C.rojoSem }}>
                        {f.dif >= 0 ? '▲' : '▼'} {Math.abs(f.dif).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                      </span>
                    )}
                  </Celda>
                </Fila>
              )
            })}
          </Tabla>
        </>
      )}
    </div>
  )
}
