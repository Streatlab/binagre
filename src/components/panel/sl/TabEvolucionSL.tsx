/**
 * TabEvolucionSL — Evolución del Panel Global con el estilo SL (Ley Visual SL v1).
 * Mismos datos que la versión neobrutal (rowsAll + librerías de neto). Visual desde cero.
 */
import { useEffect, useMemo, useState } from 'react'
import type { RowFacturacion } from '@/components/panel/resumen/types'
import {
  loadConfigCanales, loadMarcasPorCanal, recargarConfigCanales,
  type CanalConfig, type MarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'
import { resolverNeto } from '@/lib/panel/netoResolver'
import {
  C, Card, CardHead, Hero, HeroPill, Kpi, KpiGrid, Nota, Pill, Vacio, Barras,
  CANAL_COLOR, CANAL_LABEL, eur0, num0, pct1, eur2,
} from './uiSL'

interface Props {
  rowsAll: RowFacturacion[]
  periodoDesde: Date
  periodoHasta: Date
}

const CANALES = [
  { id: 'uber',  bk: 'uber_bruto',    pk: 'uber_pedidos' },
  { id: 'glovo', bk: 'glovo_bruto',   pk: 'glovo_pedidos' },
  { id: 'je',    bk: 'je_bruto',      pk: 'je_pedidos' },
  { id: 'web',   bk: 'web_bruto',     pk: 'web_pedidos' },
  { id: 'dir',   bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function labelMes(ym: string) {
  const m = parseInt(ym.slice(5, 7), 10) - 1
  return `${MES[m]} ${ym.slice(2, 4)}`
}

/** Deduplica servicios (TODO manda sobre ALM/CENAS) y agrega por mes. */
function porMes(rows: RowFacturacion[]) {
  const conTodo = new Set<string>()
  for (const r of rows) if ((r as unknown as { servicio?: string }).servicio === 'TODO') conTodo.add(r.fecha)
  const m = new Map<string, { bruto: Record<string, number>; ped: Record<string, number>; dias: Set<string> }>()
  for (const r of rows) {
    const serv = (r as unknown as { servicio?: string }).servicio
    if (serv !== undefined) {
      if (conTodo.has(r.fecha)) { if (serv !== 'TODO') continue }
      else if (serv !== 'ALM' && serv !== 'CENAS') continue
    }
    const ym = r.fecha.slice(0, 7)
    const e = m.get(ym) ?? { bruto: {}, ped: {}, dias: new Set<string>() }
    for (const c of CANALES) {
      e.bruto[c.id] = (e.bruto[c.id] ?? 0) + (Number(r[c.bk as keyof RowFacturacion]) || 0)
      e.ped[c.id] = (e.ped[c.id] ?? 0) + (Number(r[c.pk as keyof RowFacturacion]) || 0)
    }
    e.dias.add(r.fecha)
    m.set(ym, e)
  }
  return m
}

export default function TabEvolucionSL({ rowsAll }: Props) {
  const [config, setConfig] = useState<Record<string, CanalConfig>>({})
  const [marcasPorCanal, setMarcasPorCanal] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })

  useEffect(() => {
    loadConfigCanales().then(setConfig)
    loadMarcasPorCanal().then(setMarcasPorCanal)
    const on = () => { recargarConfigCanales().then(setConfig); loadMarcasPorCanal().then(setMarcasPorCanal) }
    window.addEventListener('config_canales:changed', on)
    return () => window.removeEventListener('config_canales:changed', on)
  }, [])

  const meses = useMemo(() => {
    const agg = porMes(rowsAll)
    return [...agg.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([ym, e]) => {
        let bruto = 0, pedidos = 0, neto = 0
        for (const c of CANALES) {
          const b = e.bruto[c.id] ?? 0
          const p = e.ped[c.id] ?? 0
          bruto += b; pedidos += p
          if (b > 0) {
            const r = resolverNeto(c.id, b, p, {
              modo: 'agregado_canal', marcasPorCanal,
              fechaDesde: new Date(`${ym}-01T12:00:00`),
              fechaHasta: new Date(`${ym}-28T12:00:00`),
              configCanales: config, diasConDatos: e.dias.size,
            })
            neto += r.neto
          }
        }
        return {
          ym, label: labelMes(ym), bruto, pedidos, neto,
          ticket: pedidos > 0 ? bruto / pedidos : 0,
          margen: bruto > 0 ? (neto / bruto) * 100 : 0,
          canales: CANALES.map(c => ({ id: c.id, bruto: e.bruto[c.id] ?? 0 })),
        }
      })
      .filter(m => m.bruto > 0)
  }, [rowsAll, config, marcasPorCanal])

  const ult12 = useMemo(() => meses.slice(-12), [meses])

  const mismoMesAnterior = useMemo(() => {
    if (ult12.length === 0) return null
    const u = ult12[ult12.length - 1]
    const y = parseInt(u.ym.slice(0, 4), 10) - 1
    const target = `${y}${u.ym.slice(4)}`
    return meses.find(m => m.ym === target) ?? null
  }, [meses, ult12])

  const tendencia = useMemo(() => {
    if (ult12.length < 6) return null
    const a = ult12.slice(-3).reduce((s, m) => s + m.bruto, 0) / 3
    const b = ult12.slice(-6, -3).reduce((s, m) => s + m.bruto, 0) / 3
    return b > 0 ? ((a - b) / b) * 100 : null
  }, [ult12])

  if (ult12.length === 0) {
    return <Card><Vacio>Todavía no hay histórico de facturación para comparar.</Vacio></Card>
  }

  const ultimo = ult12[ult12.length - 1]
  const anterior = ult12.length > 1 ? ult12[ult12.length - 2] : null
  const varMes = anterior && anterior.bruto > 0
    ? ((ultimo.bruto - anterior.bruto) / anterior.bruto) * 100
    : null
  const varAnual = mismoMesAnterior && mismoMesAnterior.bruto > 0
    ? ((ultimo.bruto - mismoMesAnterior.bruto) / mismoMesAnterior.bruto) * 100
    : null

  const mejor = [...ult12].sort((a, b) => b.bruto - a.bruto)[0]
  const peor = [...ult12].sort((a, b) => a.bruto - b.bruto)[0]
  const bruto12 = ult12.reduce((s, m) => s + m.bruto, 0)
  const ped12 = ult12.reduce((s, m) => s + m.pedidos, 0)
  const tm12 = ped12 > 0 ? bruto12 / ped12 : 0
  const neto12 = ult12.reduce((s, m) => s + m.neto, 0)

  const titular = varMes == null
    ? 'Primer mes con datos'
    : varMes >= 0
      ? `${ultimo.label} va mejor que ${anterior!.label}`
      : `${ultimo.label} baja respecto a ${anterior!.label}`

  return (
    <div>
      <Hero
        eyebrow="EVOLUCIÓN · ÚLTIMOS 12 MESES"
        titular={titular}
        valor={eur0(ultimo.bruto)}
        sub={`Facturación bruta de ${ultimo.label} · ${num0(ultimo.pedidos)} pedidos`}
        right={
          <>
            {varMes != null && <HeroPill>{varMes >= 0 ? '▲' : '▼'} {Math.abs(varMes).toFixed(1)}% vs mes anterior</HeroPill>}
            <HeroPill>Neto estimado {eur0(ultimo.neto)}</HeroPill>
            {varAnual != null && <HeroPill>{varAnual >= 0 ? '▲' : '▼'} {Math.abs(varAnual).toFixed(1)}% interanual</HeroPill>}
          </>
        }
      />

      <KpiGrid>
        <Kpi icono="↑" tono="verde" label="Mejor mes (12m)" valor={mejor.label}
          pie={<Pill tone="verde">{eur0(mejor.bruto)}</Pill>} />
        <Kpi icono="↓" tono="rojo" label="Peor mes (12m)" valor={peor.label}
          pie={<Pill tone="rojo">{eur0(peor.bruto)}</Pill>} />
        <Kpi icono="€" tono="ambar" label="Ticket medio 12m" valor={eur2(tm12)}
          pie={<Pill tone="ambar">{num0(ped12)} pedidos</Pill>} />
        <Kpi icono="◈" tono="blu" label="Neto estimado 12m" valor={eur0(neto12)}
          pie={<Pill tone="blu">{pct1(bruto12 > 0 ? (neto12 / bruto12) * 100 : 0)} del bruto</Pill>} />
      </KpiGrid>

      <Card>
        <CardHead
          title="Facturación bruta mes a mes"
          sub={`${ult12.length} meses con datos`}
          right={tendencia != null ? <Pill tone={tendencia >= 0 ? 'verde' : 'rojo'}>Tendencia {tendencia >= 0 ? '▲' : '▼'} {Math.abs(tendencia).toFixed(1)}%</Pill> : undefined}
        />
        <Barras
          datos={ult12.map(m => ({
            label: m.label,
            valor: Math.round(m.bruto),
            color: m.ym === ultimo.ym ? C.rojo : C.naranja,
          }))}
          alto={220}
          fmt={num0}
        />
        {tendencia != null && (
          <Nota tono={tendencia >= 0 ? 'verde' : 'ambar'}>
            {tendencia >= 0
              ? `Los últimos 3 meses facturan un ${Math.abs(tendencia).toFixed(1)}% más que los 3 anteriores. La curva va hacia arriba.`
              : `Los últimos 3 meses facturan un ${Math.abs(tendencia).toFixed(1)}% menos que los 3 anteriores. Merece la pena mirar qué cambió.`}
          </Nota>
        )}
      </Card>

      <Card>
        <CardHead title="Detalle mes a mes" sub="Bruto, pedidos, ticket medio y neto estimado" />
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                <th className="r">Bruto</th>
                <th className="r">Pedidos</th>
                <th className="r">Ticket medio</th>
                <th className="r">Neto est.</th>
                <th className="r">Var. mes</th>
              </tr>
            </thead>
            <tbody>
              {[...ult12].reverse().map((m, i, arr) => {
                const prev = arr[i + 1]
                const v = prev && prev.bruto > 0 ? ((m.bruto - prev.bruto) / prev.bruto) * 100 : null
                return (
                  <tr key={m.ym}>
                    <td>
                      {m.label}
                      <small className="slsub">{m.ym}</small>
                    </td>
                    <td className="r slnum">{eur0(m.bruto)}</td>
                    <td className="r slnum">{num0(m.pedidos)}</td>
                    <td className="r slnum">{m.ticket > 0 ? eur2(m.ticket) : '—'}</td>
                    <td className="r slnum" style={{ color: C.verde }}>{eur0(m.neto)}</td>
                    <td className="r">
                      {v == null ? <span style={{ color: C.grisCl }}>—</span>
                        : <Pill tone={v >= 0 ? 'verde' : 'rojo'}>{v >= 0 ? '▲' : '▼'} {Math.abs(v).toFixed(1)}%</Pill>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total 12 meses</td>
                <td className="r slnum">{eur0(bruto12)}</td>
                <td className="r slnum">{num0(ped12)}</td>
                <td className="r slnum">{eur2(tm12)}</td>
                <td className="r slnum">{eur0(neto12)}</td>
                <td className="r slnum">{pct1(bruto12 > 0 ? (neto12 / bruto12) * 100 : 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card>
        <CardHead title="Cómo ha cambiado el reparto por canal" sub={`${ult12[0].label} frente a ${ultimo.label}`} />
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Canal</th>
                <th className="r">Peso en {ult12[0].label}</th>
                <th className="r">Peso en {ultimo.label}</th>
                <th className="r">Movimiento</th>
              </tr>
            </thead>
            <tbody>
              {CANALES.map(c => {
                const b0 = ult12[0].canales.find(x => x.id === c.id)?.bruto ?? 0
                const b1 = ultimo.canales.find(x => x.id === c.id)?.bruto ?? 0
                const t0 = ult12[0].bruto || 1
                const t1 = ultimo.bruto || 1
                const p0 = (b0 / t0) * 100
                const p1 = (b1 / t1) * 100
                const dif = p1 - p0
                return (
                  <tr key={c.id}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: CANAL_COLOR[c.id], display: 'inline-block' }} />
                        {CANAL_LABEL[c.id]}
                      </span>
                    </td>
                    <td className="r slnum">{pct1(p0)}</td>
                    <td className="r slnum">{pct1(p1)}</td>
                    <td className="r">
                      <Pill tone={Math.abs(dif) < 0.5 ? 'neutro' : dif > 0 ? 'verde' : 'rojo'}>
                        {dif >= 0 ? '+' : '−'}{Math.abs(dif).toFixed(1)} pts
                      </Pill>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
