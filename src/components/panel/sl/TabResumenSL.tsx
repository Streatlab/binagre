/**
 * TabResumenSL — Resumen del Panel Global con el estilo SL (Ley Visual SL v2).
 *
 * Reutiliza EXCLUSIVAMENTE los datos (mismas props y mismas librerías de cálculo
 * que el resumen neobrutal). Toda la capa visual está escrita desde cero.
 *
 * v2 · las cifras no cambian; cambia lo que se ve de ellas:
 *   · Hero con micrográfico de la serie diaria.
 *   · Cada KPI lleva su tendencia (sparkline) y su variación (pastilla).
 *   · La tabla de canales lleva barra inline: se comparan sin leer números.
 *   · Los insights llevan a una pestaña, no se quedan en el aire.
 */
import { useEffect, useMemo, useState } from 'react'
import type { RowFacturacion } from '@/components/panel/resumen/types'
import {
  loadConfigCanales, loadMarcasPorCanal, recargarConfigCanales,
  type CanalConfig, type MarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'
import { resolverNeto } from '@/lib/panel/netoResolver'
import {
  C, Card, CardHead, Hero, HeroPill, Kpi, KpiGrid, Bar, Nota, Pill, Vacio,
  LineaArea, InBar, CANAL_COLOR, CANAL_LABEL, eur0, num0, pct1, eur2,
} from './uiSL'

interface Props {
  rowsPeriodo: RowFacturacion[]
  rowsAll: RowFacturacion[]
  fechaDesde: Date
  fechaHasta: Date
  canalesFiltro: string[]
  periodoLabel: string
  onNavTab?: (t: string) => void
}

const CANALES = [
  { id: 'uber',  bk: 'uber_bruto',    pk: 'uber_pedidos' },
  { id: 'glovo', bk: 'glovo_bruto',   pk: 'glovo_pedidos' },
  { id: 'je',    bk: 'je_bruto',      pk: 'je_pedidos' },
  { id: 'web',   bk: 'web_bruto',     pk: 'web_pedidos' },
  { id: 'dir',   bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** Nº de barras del sparkline de un KPI. Si hay más días, se agrupan. */
const SPARK_N = 7

function toStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parse(s: string) { return new Date(s.slice(0, 10) + 'T12:00:00') }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(d.getDate() + n); return r }
function fmtDia(s: string) {
  const d = parse(s)
  return `${d.getDate()} ${d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}`
}

/** Comprime una serie a N tramos sumando. Si ya es corta, la devuelve tal cual. */
function comprimir(serie: number[], n = SPARK_N): number[] {
  if (serie.length <= n) return serie
  const tam = Math.ceil(serie.length / n)
  const out: number[] = []
  for (let i = 0; i < serie.length; i += tam) {
    out.push(serie.slice(i, i + tam).reduce((s, v) => s + v, 0))
  }
  return out
}

/** Una fila por día: si el día trae servicio TODO, manda TODO; si no, suma ALM + CENAS. */
function porDia(rows: RowFacturacion[]) {
  const conTodo = new Set<string>()
  for (const r of rows) if ((r as unknown as { servicio?: string }).servicio === 'TODO') conTodo.add(r.fecha)
  const m = new Map<string, Record<string, number>>()
  for (const r of rows) {
    const serv = (r as unknown as { servicio?: string }).servicio
    if (serv !== undefined) {
      if (conTodo.has(r.fecha)) { if (serv !== 'TODO') continue }
      else if (serv !== 'ALM' && serv !== 'CENAS') continue
    }
    const a = m.get(r.fecha) ?? {}
    for (const c of CANALES) {
      a[c.bk] = (a[c.bk] ?? 0) + (Number(r[c.bk as keyof RowFacturacion]) || 0)
      a[c.pk] = (a[c.pk] ?? 0) + (Number(r[c.pk as keyof RowFacturacion]) || 0)
    }
    m.set(r.fecha, a)
  }
  return m
}

export default function TabResumenSL({
  rowsPeriodo, rowsAll, fechaDesde, fechaHasta, canalesFiltro, periodoLabel, onNavTab,
}: Props) {
  const [config, setConfig] = useState<Record<string, CanalConfig>>({})
  const [marcasPorCanal, setMarcasPorCanal] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })

  useEffect(() => {
    loadConfigCanales().then(setConfig)
    loadMarcasPorCanal().then(setMarcasPorCanal)
    const on = () => { recargarConfigCanales().then(setConfig); loadMarcasPorCanal().then(setMarcasPorCanal) }
    window.addEventListener('config_canales:changed', on)
    return () => window.removeEventListener('config_canales:changed', on)
  }, [])

  const activos = CANALES.filter(c => canalesFiltro.length === 0 || canalesFiltro.includes(c.id))

  const dias = useMemo(() => porDia(rowsPeriodo), [rowsPeriodo])

  /* ── Canales del periodo (bruto, pedidos, neto estimado) ── */
  const canales = useMemo(() => {
    const nDias = dias.size || 1
    return activos.map(c => {
      let bruto = 0, pedidos = 0
      for (const a of dias.values()) { bruto += a[c.bk] ?? 0; pedidos += a[c.pk] ?? 0 }
      const { neto } = resolverNeto(c.id, bruto, pedidos, {
        modo: 'agregado_canal', marcasPorCanal, fechaDesde, fechaHasta,
        configCanales: config, diasConDatos: nDias,
      })
      return {
        id: c.id, label: CANAL_LABEL[c.id], color: CANAL_COLOR[c.id],
        bruto, pedidos, neto,
        ticket: pedidos > 0 ? bruto / pedidos : 0,
        margen: bruto > 0 ? (neto / bruto) * 100 : 0,
      }
    }).sort((a, b) => b.bruto - a.bruto)
  }, [dias, activos, config, marcasPorCanal, fechaDesde, fechaHasta])

  const bruto = canales.reduce((s, c) => s + c.bruto, 0)
  const neto = canales.reduce((s, c) => s + c.neto, 0)
  const pedidos = canales.reduce((s, c) => s + c.pedidos, 0)
  const ticket = pedidos > 0 ? bruto / pedidos : 0
  const comision = bruto - neto
  const brutoMax = canales.reduce((m, c) => Math.max(m, c.bruto), 0) || 1

  /* ── Periodo anterior de la misma duración (para comparar) ── */
  const brutoPrevio = useMemo(() => {
    const largoMs = fechaHasta.getTime() - fechaDesde.getTime()
    const prevHasta = addDays(fechaDesde, -1)
    const prevDesde = new Date(prevHasta.getTime() - largoMs)
    const a = toStr(prevDesde), b = toStr(prevHasta)
    const prevRows = rowsAll.filter(r => r.fecha >= a && r.fecha <= b)
    const d = porDia(prevRows)
    let t = 0
    for (const x of d.values()) for (const c of activos) t += x[c.bk] ?? 0
    return t
  }, [rowsAll, fechaDesde, fechaHasta, activos])

  const variacion = brutoPrevio > 0 ? ((bruto - brutoPrevio) / brutoPrevio) * 100 : null

  /* ── Serie diaria: bruto, pedidos y canal propio ── */
  const serie = useMemo(() => {
    const keys = [...dias.keys()].sort()
    return keys.map(k => {
      const a = dias.get(k)!
      let v = 0, p = 0, propio = 0
      for (const c of activos) {
        const b = a[c.bk] ?? 0
        v += b
        p += a[c.pk] ?? 0
        if (c.id === 'web' || c.id === 'dir') propio += b
      }
      return { fecha: k, valor: v, pedidos: p, propio }
    })
  }, [dias, activos])

  /* ── Sparklines de los KPIs (v2) ──
     El margen del periodo se aplica a la serie de bruto: no es un neto diario
     exacto (los costes fijos no se reparten día a día), pero la FORMA de la
     tendencia sí es la real, que es para lo que sirve un sparkline. */
  const margenPeriodo = bruto > 0 ? neto / bruto : 0
  const sparkBruto   = useMemo(() => comprimir(serie.map(s => s.valor)), [serie])
  const sparkNeto    = useMemo(() => sparkBruto.map(v => v * margenPeriodo), [sparkBruto, margenPeriodo])
  const sparkComis   = useMemo(() => sparkBruto.map(v => v * (1 - margenPeriodo)), [sparkBruto, margenPeriodo])
  const sparkPedidos = useMemo(() => comprimir(serie.map(s => s.pedidos)), [serie])
  const sparkPropio  = useMemo(() => comprimir(serie.map(s => s.propio)), [serie])

  const mejorDia = useMemo(
    () => serie.reduce<{ fecha: string; valor: number } | null>((b, x) => (!b || x.valor > b.valor ? x : b), null),
    [serie])

  /* ── Día de la semana más fuerte ── */
  const porSemana = useMemo(() => {
    const acc = new Array(7).fill(0) as number[]
    const cnt = new Array(7).fill(0) as number[]
    for (const s of serie) { const w = parse(s.fecha).getDay(); acc[w] += s.valor; cnt[w] += 1 }
    const medias = acc.map((v, i) => ({ dia: DIAS[i], media: cnt[i] > 0 ? v / cnt[i] : 0 }))
    return medias.sort((a, b) => b.media - a.media)[0] ?? null
  }, [serie])

  const propio = canales.filter(c => c.id === 'web' || c.id === 'dir').reduce((s, c) => s + c.bruto, 0)
  const pesoPropio = bruto > 0 ? (propio / bruto) * 100 : 0
  const pedidosDia = serie.length > 0 ? pedidos / serie.length : 0

  if (bruto === 0) {
    return (
      <Card><Vacio>No hay ventas registradas en el periodo seleccionado.</Vacio></Card>
    )
  }

  const etiquetas = serie.length > 3
    ? [serie[0], serie[Math.floor(serie.length / 3)], serie[Math.floor((2 * serie.length) / 3)], serie[serie.length - 1]].map(s => fmtDia(s.fecha))
    : serie.map(s => fmtDia(s.fecha))

  const titular = variacion == null
    ? 'Facturación del periodo'
    : variacion >= 0
      ? 'Vas por encima del periodo anterior'
      : 'Estás por debajo del periodo anterior'

  return (
    <div>
      <Hero
        eyebrow={`VENTAS · ${periodoLabel.toUpperCase()}`}
        titular={titular}
        valor={eur0(bruto)}
        sub={`${num0(pedidos)} pedidos · neto estimado ${eur0(neto)} · ticket medio ${eur2(ticket)}`}
        spark={sparkBruto.length > 1 ? serie.map(s => s.valor) : undefined}
        right={
          <>
            {variacion != null && (
              <HeroPill solid>{variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(1)}% vs periodo anterior</HeroPill>
            )}
            <HeroPill>Ticket medio {eur2(ticket)}</HeroPill>
            <HeroPill>La plataforma se lleva {eur0(comision)}</HeroPill>
          </>
        }
      />

      <KpiGrid>
        <Kpi
          icono="€" tono="verde" label="Neto estimado" valor={eur0(neto)}
          delta={variacion != null ? <Pill tone={variacion >= 0 ? 'verde' : 'rojo'}>{variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(1)}%</Pill> : undefined}
          pie={<Pill tone={margenPeriodo >= 0.6 ? 'verde' : 'ambar'} dot>{pct1(margenPeriodo * 100)} del bruto</Pill>}
          spark={sparkNeto}
        />
        <Kpi
          icono="#" tono="blu" label="Pedidos" valor={num0(pedidos)}
          delta={<Pill tone="blu">{serie.length} días</Pill>}
          pie={<Pill tone="blu" dot>{num0(pedidosDia)} al día de media</Pill>}
          spark={sparkPedidos}
        />
        <Kpi
          icono="↧" tono="rojo" label="Se queda la plataforma" valor={eur0(comision)}
          pie={<Pill tone="rojo" dot>{pct1(bruto > 0 ? (comision / bruto) * 100 : 0)} sobre ventas</Pill>}
          spark={sparkComis}
        />
        <Kpi
          icono="◈" tono={pesoPropio >= 20 ? 'verde' : 'ambar'} label="Canal propio" valor={pct1(pesoPropio)}
          delta={<Pill tone={pesoPropio >= 20 ? 'verde' : 'ambar'}>Objetivo 20%</Pill>}
          pie={<Pill tone={pesoPropio >= 20 ? 'verde' : 'ambar'} dot>{eur0(propio)} sin comisión alta</Pill>}
          spark={sparkPropio}
        />
      </KpiGrid>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 12, marginBottom: 12 }}>
        <Card style={{ marginBottom: 0 }}>
          <CardHead
            title="Evolución de ventas"
            sub={`${serie.length} días · bruto por día`}
            right={variacion != null ? <Pill tone={variacion >= 0 ? 'verde' : 'rojo'}>{variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(1)}%</Pill> : undefined}
          />
          <LineaArea puntos={serie.map(s => s.valor)} etiquetas={etiquetas} fmt={eur0} />
          {mejorDia && (
            <Nota
              tono="verde"
              accion={porSemana && porSemana.media > 0 ? `Reforzar ${porSemana.dia}` : undefined}
              onAccion={() => onNavTab?.('evolucion')}
            >
              Tu mejor día fue el {fmtDia(mejorDia.fecha)} con {eur0(mejorDia.valor)}
              {porSemana && porSemana.media > 0 ? `. De media, el ${porSemana.dia} es el día que más vende.` : '.'}
            </Nota>
          )}
        </Card>

        <Card style={{ marginBottom: 0 }}>
          <CardHead title="Ventas por canal" sub="Peso sobre el bruto del periodo" />
          {canales.map(c => (
            <Bar key={c.id} label={c.label}
              valor={pct1(bruto > 0 ? (c.bruto / bruto) * 100 : 0)}
              pct={bruto > 0 ? (c.bruto / bruto) * 100 : 0}
              color={c.color} />
          ))}
          <Nota
            tono={pesoPropio >= 20 ? 'verde' : 'ambar'}
            accion={pesoPropio >= 20 ? undefined : 'Ver canales'}
            onAccion={() => onNavTab?.('operaciones')}
          >
            {pesoPropio >= 20
              ? `Web y directa ya son el ${pct1(pesoPropio)} de tus ventas. Ese euro es el que más margen deja.`
              : `Web y directa solo son el ${pct1(pesoPropio)}. Cada punto que muevas aquí vale más que vender más en plataforma.`}
          </Nota>
        </Card>
      </div>

      <Card>
        <CardHead
          title="Detalle por canal"
          sub="Bruto, neto estimado y lo que te queda"
          right={propio === 0 ? <Pill tone="rojo">Canal propio a 0 €</Pill> : undefined}
        />
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Canal</th>
                <th className="r">Pedidos</th>
                <th className="r">Ticket medio</th>
                <th>Bruto</th>
                <th className="r">Neto est.</th>
                <th className="r">% que te queda</th>
              </tr>
            </thead>
            <tbody>
              {canales.map(c => (
                <tr key={c.id}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color, display: 'inline-block', flexShrink: 0 }} />
                      {c.label}
                    </span>
                    <small className="slsub">{pct1(bruto > 0 ? (c.bruto / bruto) * 100 : 0)} del total</small>
                  </td>
                  <td className="r slnum">{num0(c.pedidos)}</td>
                  <td className="r slnum">{c.ticket > 0 ? eur2(c.ticket) : '—'}</td>
                  {/* v2 · barra inline: los canales se comparan sin leer el número */}
                  <td>
                    <span className="slnum">{eur0(c.bruto)}</span>
                    <InBar pct={(c.bruto / brutoMax) * 100} color={c.color} />
                  </td>
                  <td className="r slnum" style={{ color: C.verde }}>{eur0(c.neto)}</td>
                  <td className="r">
                    <Pill tone={c.margen >= 58 ? 'verde' : c.margen >= 40 ? 'ambar' : 'rojo'}>{pct1(c.margen)}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="r slnum">{num0(pedidos)}</td>
                <td className="r slnum">{eur2(ticket)}</td>
                <td className="slnum">{eur0(bruto)}</td>
                <td className="r slnum">{eur0(neto)}</td>
                <td className="r slnum">{pct1(bruto > 0 ? (neto / bruto) * 100 : 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}
