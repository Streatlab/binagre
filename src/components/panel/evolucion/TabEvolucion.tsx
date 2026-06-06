/**
 * TabEvolucion — Panel Global · Comparativas
 * Cards grandes estilo Resumen (CardVentas / CardPedidosTM / ColFacturacionCanal).
 * Todo depende del periodo del desplegable. Comparador editable (periodo/mes/año anterior).
 * Desgloses día a día, semana a semana y mes a mes con las 3 comparativas simultáneas.
 */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNum, fmtPct } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, cardBig, lbl, lblXs, fmtDec, SUBTABS } from '@/components/panel/resumen/tokens'
import {
  calcNetoPorCanal, useConfigCanales, useMarcasPorCanal,
  type CanalConfig, type MarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'
import CardPedidosTM from '@/components/panel/resumen/CardPedidosTM'
import type { CanalStat } from '@/components/panel/resumen/types'

/* ── fechas ── */
function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function addMonthsClamp(d: Date, n: number): Date {
  const day = d.getDate(); const x = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const dim = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(day, dim)); return x
}
function addYears(d: Date, n: number): Date { return new Date(d.getFullYear() + n, d.getMonth(), d.getDate()) }
function minDate(a: Date, b: Date) { return a < b ? a : b }
function isoDow(s: string): number { const d = new Date(s + 'T00:00:00'); return ((d.getDay() + 6) % 7) + 1 }
function mondayOf(d: Date): Date { return addDays(d, -((d.getDay() + 6) % 7)) }
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fdShort(d: Date): string { return `${d.getDate()} ${MESES[d.getMonth()]}` }
function diffDias(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000) + 1 }

function rangoPrevio(desde: Date, hasta: Date) {
  const n = diffDias(desde, hasta); const h = addDays(desde, -1); return { desde: addDays(h, -(n - 1)), hasta: h }
}

/* ── datos ── */
interface RowFac {
  fecha: string; servicio: string | null
  uber_bruto: number; uber_pedidos: number
  glovo_bruto: number; glovo_pedidos: number
  je_bruto: number; je_pedidos: number
  web_bruto: number; web_pedidos: number
  directa_bruto: number; directa_pedidos: number
}
interface Props { fechaDesde: Date; fechaHasta: Date; canalesFiltro: string[] }

const CANALES = [
  { id: 'uber', label: 'Uber Eats', color: '#06C167', bk: 'uber_bruto', pk: 'uber_pedidos' },
  { id: 'glovo', label: 'Glovo', color: '#e8f442', bk: 'glovo_bruto', pk: 'glovo_pedidos' },
  { id: 'je', label: 'Just Eat', color: '#f5a623', bk: 'je_bruto', pk: 'je_pedidos' },
  { id: 'web', label: 'Web', color: '#8B5CF6', bk: 'web_bruto', pk: 'web_pedidos' },
  { id: 'dir', label: 'Directa', color: '#06B6D4', bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const
const SELECT_COLS = 'fecha,servicio,uber_bruto,uber_pedidos,glovo_bruto,glovo_pedidos,je_bruto,je_pedidos,web_bruto,web_pedidos,directa_bruto,directa_pedidos'

type Cmp = 'previo' | 'mes' | 'ano'

interface Agg {
  porCanal: Record<string, { bruto: number; pedidos: number; neto: number }>
  bruto: number; pedidos: number; neto: number; alm: number; cena: number
}

function dayBrutoOf(r: RowFac, on: (id: string) => boolean): number {
  let b = 0
  for (const c of CANALES) if (on(c.id)) b += Number((r as unknown as Record<string, number>)[c.bk] || 0)
  return b
}

function aggregate(rows: RowFac[], canales: string[], desde: Date, hasta: Date, cfg: Record<string, CanalConfig>, marcas: MarcasPorCanal): Agg {
  const on = (id: string) => canales.length === 0 || canales.includes(id)
  const porCanal: Record<string, { bruto: number; pedidos: number; neto: number }> = {}
  for (const c of CANALES) porCanal[c.id] = { bruto: 0, pedidos: 0, neto: 0 }
  const fechasConDatos = new Set<string>(); let alm = 0, cena = 0
  for (const r of rows) {
    const db = dayBrutoOf(r, on); if (db > 0) fechasConDatos.add(r.fecha)
    for (const c of CANALES) {
      if (!on(c.id)) continue
      porCanal[c.id].bruto += Number((r as unknown as Record<string, number>)[c.bk] || 0)
      porCanal[c.id].pedidos += Number((r as unknown as Record<string, number>)[c.pk] || 0)
    }
    const s = (r.servicio || '').toUpperCase()
    if (s === 'ALM') alm += db; else if (s === 'CENAS') cena += db
  }
  const dias = fechasConDatos.size
  let bruto = 0, pedidos = 0, neto = 0
  for (const c of CANALES) {
    const pc = porCanal[c.id]
    const { neto: n } = calcNetoPorCanal(c.id, pc.bruto, pc.pedidos, { modo: 'agregado_canal', marcasPorCanal: marcas, fechaDesde: desde, fechaHasta: hasta, configCanales: cfg, diasConDatos: dias })
    pc.neto = n; bruto += pc.bruto; pedidos += pc.pedidos; neto += n
  }
  return { porCanal, bruto, pedidos, neto, alm, cena }
}

function delta(a: number, b: number): number | null {
  if (!isFinite(a) || !isFinite(b) || b <= 0) return null
  return ((a - b) / b) * 100
}

/* ── UI helpers ── */
function Delta({ pct, fallback = '—' }: { pct: number | null; fallback?: string }) {
  if (pct == null) return <span style={{ fontFamily: OSWALD, fontSize: 12, color: COLOR.textMut }}>{fallback}</span>
  const up = pct >= 0
  return <span style={{ fontFamily: OSWALD, fontSize: 12, fontWeight: 600, color: up ? COLOR.verde : COLOR.rojo }}>{up ? '▲' : '▼'} {fmtDec(Math.abs(pct), 1)}%</span>
}
const th: React.CSSProperties = { padding: '5px 6px', fontFamily: OSWALD, fontWeight: 500, color: COLOR.textMut, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase' }
const tdR: React.CSSProperties = { padding: '5px 6px', textAlign: 'right' }

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: LEXEND, fontSize: 11, fontWeight: 500,
      border: `0.5px solid ${on ? COLOR.rojoSL : COLOR.brd}`, background: on ? COLOR.rojoSL : '#fff', color: on ? '#fff' : COLOR.textMut,
    }}>{children}</button>
  )
}

export default function TabEvolucion({ fechaDesde, fechaHasta, canalesFiltro }: Props) {
  const [cmp, setCmp] = useState<Cmp>('previo')
  const [colSem, setColSem] = useState(true)
  const [colMes, setColMes] = useState(true)
  const [colAno, setColAno] = useState(true)
  const [rows, setRows] = useState<RowFac[]>([])
  const [objMap, setObjMap] = useState<Record<number, number>>({})
  const cfg = useConfigCanales()
  const marcas = useMarcasPorCanal()

  const wideDesde = useMemo(() => minDate(addDays(addYears(fechaDesde, -1), -40), addDays(mondayOf(fechaDesde), -40)), [fechaDesde])

  useEffect(() => {
    supabase.from('facturacion_diario').select(SELECT_COLS)
      .gte('fecha', toStr(wideDesde)).lte('fecha', toStr(fechaHasta)).order('fecha', { ascending: true })
      .then(({ data }) => setRows((data ?? []) as RowFac[]))
  }, [wideDesde, fechaHasta])

  useEffect(() => {
    supabase.from('objetivos_dia_semana').select('dia,importe').then(({ data }) => {
      const m: Record<number, number> = {}
      for (const r of (data ?? []) as { dia: number; importe: number }[]) m[Number(r.dia)] = Number(r.importe)
      setObjMap(m)
    })
  }, [])

  const on = useMemo(() => (id: string) => canalesFiltro.length === 0 || canalesFiltro.includes(id), [canalesFiltro])
  const inRange = (f: string, d: Date, h: Date) => f >= toStr(d) && f <= toStr(h)

  const dayMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.fecha, (m.get(r.fecha) || 0) + dayBrutoOf(r, on))
    return m
  }, [rows, on])

  // rangos comparados
  const rPrev = useMemo(() => rangoPrevio(fechaDesde, fechaHasta), [fechaDesde, fechaHasta])
  const rMes = useMemo(() => ({ desde: addMonthsClamp(fechaDesde, -1), hasta: addMonthsClamp(fechaHasta, -1) }), [fechaDesde, fechaHasta])
  const rAno = useMemo(() => ({ desde: addYears(fechaDesde, -1), hasta: addYears(fechaHasta, -1) }), [fechaDesde, fechaHasta])

  const aggOf = (d: Date, h: Date) => aggregate(rows.filter(r => inRange(r.fecha, d, h)), canalesFiltro, d, h, cfg, marcas)
  const A = useMemo(() => aggOf(fechaDesde, fechaHasta), [rows, canalesFiltro, fechaDesde, fechaHasta, cfg, marcas])
  const P = useMemo(() => aggOf(rPrev.desde, rPrev.hasta), [rows, canalesFiltro, rPrev, cfg, marcas])
  const M = useMemo(() => aggOf(rMes.desde, rMes.hasta), [rows, canalesFiltro, rMes, cfg, marcas])
  const Y = useMemo(() => aggOf(rAno.desde, rAno.hasta), [rows, canalesFiltro, rAno, cfg, marcas])

  const C = cmp === 'previo' ? P : cmp === 'mes' ? M : Y
  const cmpFb = cmp === 'ano' ? 'sin hist.' : '—'
  const cmpLabel = cmp === 'previo' ? 'periodo anterior' : cmp === 'mes' ? 'mes anterior' : 'año anterior'

  const tmB = A.pedidos > 0 ? A.bruto / A.pedidos : 0
  const tmN = A.pedidos > 0 ? A.neto / A.pedidos : 0
  const tmBC = C.pedidos > 0 ? C.bruto / C.pedidos : 0

  const canalStats: CanalStat[] = useMemo(() => CANALES.filter(c => on(c.id)).map(c => {
    const pc = A.porCanal[c.id]
    return {
      id: c.id, label: c.label, color: c.color, bruto: pc.bruto, neto: pc.neto, pedidos: pc.pedidos,
      pct: A.bruto > 0 ? (pc.bruto / A.bruto) * 100 : 0,
      ticket: pc.pedidos > 0 ? pc.bruto / pc.pedidos : 0,
      margen: pc.bruto > 0 ? (pc.neto / pc.bruto) * 100 : 0,
    }
  }), [A, on])

  const totalServ = A.alm + A.cena, totalServC = C.alm + C.cena
  const sinDesglose = totalServ === 0 && A.bruto > 0

  // patrón por día de semana
  const patron = useMemo(() => {
    const acc = Array.from({ length: 7 }, () => ({ s: 0, n: 0 }))
    const vistos = new Set<string>()
    for (const r of rows) {
      if (!inRange(r.fecha, fechaDesde, fechaHasta) || vistos.has(r.fecha)) continue
      vistos.add(r.fecha); const v = dayMap.get(r.fecha) || 0; if (v <= 0) continue
      const i = isoDow(r.fecha) - 1; acc[i].s += v; acc[i].n++
    }
    return acc.map((a, i) => ({ dia: DIAS[i], avg: a.n ? a.s / a.n : 0, n: a.n })).filter(p => p.n > 0).sort((a, b) => b.avg - a.avg)
  }, [rows, dayMap, fechaDesde, fechaHasta])
  const patronMax = Math.max(...patron.map(p => p.avg), 1)

  // día a día
  const diaADia = useMemo(() => {
    const out: { f: string; bruto: number | null; dSem: number | null; dMes: number | null; dAno: number | null }[] = []
    let d = new Date(fechaDesde)
    while (d <= fechaHasta) {
      const f = toStr(d)
      const bruto = dayMap.has(f) ? (dayMap.get(f) || 0) : null
      const sv = dayMap.get(toStr(addDays(d, -7)))
      const mv = dayMap.get(toStr(addMonthsClamp(d, -1)))
      const yv = dayMap.get(toStr(addYears(d, -1)))
      out.push({
        f, bruto,
        dSem: bruto != null && sv != null ? delta(bruto, sv) : null,
        dMes: bruto != null && mv != null ? delta(bruto, mv) : null,
        dAno: bruto != null && yv != null ? delta(bruto, yv) : null,
      })
      d = addDays(d, 1)
    }
    return out
  }, [fechaDesde, fechaHasta, dayMap])

  // semana a semana
  const semanas = useMemo(() => {
    const hoy = toStr(new Date())
    const buckets = new Map<string, string[]>()
    let d = new Date(fechaDesde)
    while (d <= fechaHasta) { const k = toStr(mondayOf(d)); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push(toStr(d)); d = addDays(d, 1) }
    return [...buckets.entries()].map(([, fechas]) => {
      let v = 0, obj = 0, sem = 0, mes = 0, ano = 0
      for (const f of fechas) {
        const fd = new Date(f + 'T00:00:00')
        v += dayMap.get(f) || 0
        if (f <= hoy) obj += objMap[isoDow(f)] || 0
        sem += dayMap.get(toStr(addDays(fd, -7))) || 0
        mes += dayMap.get(toStr(addMonthsClamp(fd, -1))) || 0
        ano += dayMap.get(toStr(addYears(fd, -1))) || 0
      }
      const ini = new Date(fechas[0] + 'T00:00:00'); const fin = new Date(fechas[fechas.length - 1] + 'T00:00:00')
      return {
        label: `${fdShort(ini)}–${fin.getDate()}`, v, obj,
        pct: obj > 0 ? (v / obj) * 100 : null, cumple: obj > 0 ? v >= obj : null,
        dSem: sem > 0 ? delta(v, sem) : null, dMes: mes > 0 ? delta(v, mes) : null, dAno: ano > 0 ? delta(v, ano) : null,
      }
    }).filter(s => s.v > 0 || s.obj > 0)
  }, [fechaDesde, fechaHasta, dayMap, objMap])

  // mes a mes
  const meses = useMemo(() => {
    const buckets = new Map<string, string[]>()
    let d = new Date(fechaDesde)
    while (d <= fechaHasta) { const k = `${d.getFullYear()}-${d.getMonth()}`; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push(toStr(d)); d = addDays(d, 1) }
    return [...buckets.entries()].map(([k, fechas]) => {
      let v = 0, mes = 0, ano = 0
      for (const f of fechas) {
        const fd = new Date(f + 'T00:00:00')
        v += dayMap.get(f) || 0
        mes += dayMap.get(toStr(addMonthsClamp(fd, -1))) || 0
        ano += dayMap.get(toStr(addYears(fd, -1))) || 0
      }
      const [yy, mm] = k.split('-').map(Number)
      return { label: `${MESES[mm]} ${yy}`, v, dMes: mes > 0 ? delta(v, mes) : null, dAno: ano > 0 ? delta(v, ano) : null }
    }).filter(m => m.v > 0)
  }, [fechaDesde, fechaHasta, dayMap])

  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 14 }
  const numBig = (color: string): React.CSSProperties => ({ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color })

  return (
    <div style={{ marginTop: 18, color: COLOR.textPri, fontFamily: LEXEND }}>

      {/* comparador global */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ ...lbl, fontSize: 11 }}>Comparar contra</span>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          {([['previo', 'Periodo anterior'], ['mes', 'Mes anterior'], ['ano', 'Año anterior']] as [Cmp, string][]).map(([id, t]) => (
            <button key={id} onClick={() => setCmp(id)} style={cmp === id ? SUBTABS.active : SUBTABS.inactive}>{t}</button>
          ))}
        </div>
      </div>

      {/* FILA 1: Facturación + Pedidos/TM + Plataformas */}
      <div style={grid}>
        {/* FACTURACIÓN */}
        <div style={cardBig}>
          <div style={lbl}>FACTURACIÓN</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={numBig('#111111')}>{fmtEur(A.bruto, { showEuro: false, decimals: 2 })}</div>
              <div style={lblXs}>BRUTO</div>
            </div>
            <div>
              <div style={numBig(COLOR.verde)}>{fmtEur(A.neto, { showEuro: false, decimals: 2 })}</div>
              <div style={{ ...lblXs, color: COLOR.verde }}>NETO · {A.bruto > 0 ? fmtNum((A.neto / A.bruto) * 100, 1) : '0'}%</div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[['Periodo anterior', P], ['Mes anterior', M], ['Año anterior', Y]].map(([t, ref]) => {
              const r = ref as Agg
              const fb = t === 'Año anterior' ? 'sin hist.' : '—'
              return (
                <div key={t as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, fontFamily: LEXEND }}>
                  <span style={{ color: COLOR.textMut }}>{t as string}</span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: OSWALD }}>{fmtEur(r.bruto, { showEuro: true, decimals: 0 })}</span>
                    <Delta pct={delta(A.bruto, r.bruto)} fallback={fb} />
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* PEDIDOS · TM (componente real de Resumen) */}
        <CardPedidosTM pedidos={A.pedidos} tmBruto={tmB} tmNeto={tmN} pedidosDeltaPct={delta(A.pedidos, C.pedidos)} tmDeltaPct={delta(tmB, tmBC)} canales={canalStats} />

        {/* PLATAFORMAS (estilo ColFacturacionCanal, comparadas) */}
        <div style={cardBig}>
          <div style={lbl}>PLATAFORMAS · vs {cmpLabel}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {CANALES.filter(c => on(c.id)).map(c => {
              const b = A.porCanal[c.id].bruto, bC = C.porCanal[c.id].bruto
              const pct = A.bruto > 0 ? (b / A.bruto) * 100 : 0
              return (
                <div key={c.id} style={{ background: `${c.color}1f`, border: `0.5px solid ${c.color}`, borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ ...lblXs, color: COLOR.textSec }}>{c.label}</span>
                    <Delta pct={delta(b, bC)} fallback={cmpFb} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
                    <span style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 600, color: '#111' }}>{fmtEur(b, { showEuro: false, decimals: 0 })}</span>
                    <span style={{ fontFamily: OSWALD, fontSize: 12, color: COLOR.textMut }}>{fmtDec(pct, 0)}% · ant. {fmtEur(bC, { showEuro: false, decimals: 0 })}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* FILA 2: Comida·Cena + Patrón */}
      <div style={grid}>
        {/* COMIDA · CENA */}
        <div style={cardBig}>
          <div style={lbl}>COMIDA · CENA · vs {cmpLabel}</div>
          {sinDesglose ? (
            <div style={{ fontSize: 12, color: COLOR.textMut, marginTop: 14, fontFamily: LEXEND }}>Periodo sin desglose por servicio.</div>
          ) : totalServ === 0 ? (
            <div style={{ fontSize: 12, color: COLOR.textMut, marginTop: 14, fontFamily: LEXEND }}>Sin datos.</div>
          ) : (
            <div style={{ marginTop: 12 }}>
              {[{ n: 'Comida', v: A.alm, vc: C.alm, c: '#F26B1F' }, { n: 'Cena', v: A.cena, vc: C.cena, c: '#1E5BCC' }].map(g => {
                const pct = totalServ > 0 ? (g.v / totalServ) * 100 : 0
                const pctC = totalServC > 0 ? (g.vc / totalServC) * 100 : 0
                return (
                  <div key={g.n} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{g.n}</span>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <b style={{ fontFamily: OSWALD, fontSize: 20, color: g.c }}>{fmtEur(g.v, { showEuro: false, decimals: 0 })}</b>
                        <span style={{ fontFamily: OSWALD, fontSize: 12, color: COLOR.textMut }}>{fmtDec(pct, 0)}%</span>
                        <Delta pct={delta(g.v, g.vc)} fallback={cmpFb} />
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: COLOR.bordeClaro, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: g.c }} />
                    </div>
                    <div style={{ fontSize: 11, color: COLOR.textMut, marginTop: 3, fontFamily: LEXEND }}>{cmpLabel}: {fmtEur(g.vc, { showEuro: true, decimals: 0 })} · {fmtDec(pctC, 0)}%</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* PATRÓN POR DÍA */}
        <div style={cardBig}>
          <div style={lbl}>PATRÓN POR DÍA · facturación media</div>
          {patron.length === 0 ? <div style={{ fontSize: 12, color: COLOR.textMut, marginTop: 14, fontFamily: LEXEND }}>Sin datos.</div> : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150, marginTop: 16 }}>
              {DIAS.map(dl => {
                const p = patron.find(x => x.dia === dl)
                const avg = p?.avg || 0
                const best = p && avg === patronMax
                return (
                  <div key={dl} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <div style={{ fontSize: 10, color: COLOR.textMut, fontFamily: OSWALD }}>{avg > 0 ? fmtEur(avg, { showEuro: false, decimals: 0 }) : ''}</div>
                    <div style={{ width: '100%', height: `${(avg / patronMax) * 110}px`, minHeight: avg > 0 ? 3 : 0, background: best ? COLOR.rojoSL : '#c9bfae', borderRadius: '4px 4px 0 0' }} />
                    <div style={{ fontSize: 11, color: best ? COLOR.rojoSL : COLOR.textMut, fontWeight: best ? 600 : 400 }}>{dl}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* toggles columnas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ ...lbl, fontSize: 11 }}>Columnas</span>
        <Pill on={colSem} onClick={() => setColSem(v => !v)}>vs semana ant.</Pill>
        <Pill on={colMes} onClick={() => setColMes(v => !v)}>vs mes ant.</Pill>
        <Pill on={colAno} onClick={() => setColAno(v => !v)}>vs año ant.</Pill>
      </div>

      {/* DÍA A DÍA */}
      <div style={{ ...cardBig, marginBottom: 14 }}>
        <div style={lbl}>DÍA A DÍA</div>
        <div style={{ marginTop: 12, maxHeight: 340, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: LEXEND, fontSize: 12 }}>
            <thead><tr style={{ textAlign: 'left' }}>
              <th style={th}>Día</th>
              <th style={{ ...th, textAlign: 'right' }}>Bruto €</th>
              {colSem && <th style={{ ...th, textAlign: 'right' }}>vs mismo día sem. ant.</th>}
              {colMes && <th style={{ ...th, textAlign: 'right' }}>vs mismo día mes ant.</th>}
              {colAno && <th style={{ ...th, textAlign: 'right' }}>vs mismo día año ant.</th>}
            </tr></thead>
            <tbody>
              {diaADia.map(d => (
                <tr key={d.f} style={{ borderTop: `0.5px solid ${COLOR.bordeClaro}` }}>
                  <td style={{ padding: '5px 6px' }}>{DIAS[isoDow(d.f) - 1]} {fdShort(new Date(d.f + 'T00:00:00'))}</td>
                  <td style={{ ...tdR, fontFamily: OSWALD, color: '#111' }}>{d.bruto == null ? '—' : fmtEur(d.bruto, { showEuro: false, decimals: 0 })}</td>
                  {colSem && <td style={tdR}><Delta pct={d.dSem} /></td>}
                  {colMes && <td style={tdR}><Delta pct={d.dMes} /></td>}
                  {colAno && <td style={tdR}><Delta pct={d.dAno} fallback="sin hist." /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEMANA A SEMANA */}
      <div style={{ ...cardBig, marginBottom: 14 }}>
        <div style={lbl}>SEMANA A SEMANA · cumplimiento objetivo</div>
        {semanas.length === 0 ? <div style={{ fontSize: 12, color: COLOR.textMut, marginTop: 14, fontFamily: LEXEND }}>Sin datos.</div> : (
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: LEXEND, fontSize: 12 }}>
              <thead><tr style={{ textAlign: 'left' }}>
                <th style={th}>Semana</th>
                <th style={{ ...th, textAlign: 'right' }}>Ventas €</th>
                <th style={{ ...th, textAlign: 'right' }}>Objetivo</th>
                <th style={{ ...th, textAlign: 'right' }}>%</th>
                <th style={{ ...th, textAlign: 'center' }}>Cumple</th>
                {colSem && <th style={{ ...th, textAlign: 'right' }}>vs sem. ant.</th>}
                {colMes && <th style={{ ...th, textAlign: 'right' }}>vs mes ant.</th>}
                {colAno && <th style={{ ...th, textAlign: 'right' }}>vs año ant.</th>}
              </tr></thead>
              <tbody>
                {semanas.map(s => (
                  <tr key={s.label} style={{ borderTop: `0.5px solid ${COLOR.bordeClaro}` }}>
                    <td style={{ padding: '5px 6px' }}>{s.label}</td>
                    <td style={{ ...tdR, fontFamily: OSWALD, color: '#111' }}>{fmtEur(s.v, { showEuro: false, decimals: 0 })}</td>
                    <td style={{ ...tdR, fontFamily: OSWALD, color: COLOR.textMut }}>{s.obj > 0 ? fmtEur(s.obj, { showEuro: false, decimals: 0 }) : '—'}</td>
                    <td style={{ ...tdR, fontFamily: OSWALD, color: s.pct == null ? COLOR.textMut : s.cumple ? COLOR.verde : COLOR.rojo }}>{s.pct == null ? '—' : `${fmtDec(s.pct, 0)}%`}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center', color: s.cumple == null ? COLOR.textMut : s.cumple ? COLOR.verde : COLOR.rojo, fontWeight: 700 }}>{s.cumple == null ? '—' : s.cumple ? '✓' : '✗'}</td>
                    {colSem && <td style={tdR}><Delta pct={s.dSem} /></td>}
                    {colMes && <td style={tdR}><Delta pct={s.dMes} /></td>}
                    {colAno && <td style={tdR}><Delta pct={s.dAno} fallback="sin hist." /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MES A MES */}
      <div style={cardBig}>
        <div style={lbl}>MES A MES</div>
        {meses.length === 0 ? <div style={{ fontSize: 12, color: COLOR.textMut, marginTop: 14, fontFamily: LEXEND }}>Sin datos.</div> : (
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: LEXEND, fontSize: 12 }}>
              <thead><tr style={{ textAlign: 'left' }}>
                <th style={th}>Mes</th>
                <th style={{ ...th, textAlign: 'right' }}>Ventas €</th>
                <th style={{ ...th, textAlign: 'right' }}>vs mes ant.</th>
                <th style={{ ...th, textAlign: 'right' }}>vs año ant.</th>
              </tr></thead>
              <tbody>
                {meses.map(m => (
                  <tr key={m.label} style={{ borderTop: `0.5px solid ${COLOR.bordeClaro}` }}>
                    <td style={{ padding: '5px 6px' }}>{m.label}</td>
                    <td style={{ ...tdR, fontFamily: OSWALD, color: '#111' }}>{fmtEur(m.v, { showEuro: false, decimals: 0 })}</td>
                    <td style={tdR}><Delta pct={m.dMes} /></td>
                    <td style={tdR}><Delta pct={m.dAno} fallback="sin hist." /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
