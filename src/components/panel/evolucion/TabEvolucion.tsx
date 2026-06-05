/**
 * TabEvolucion — Panel Global · Comparativas
 * Reutiliza componentes y tokens de Resumen. Todo depende del periodo seleccionado
 * y se compara contra el periodo anterior o el mismo periodo del año anterior.
 */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNum } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, cardBig, lbl, lblXs, fmtDec } from '@/components/panel/resumen/tokens'
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
  const day = d.getDate()
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const dim = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(day, dim)); return x
}
function minDate(a: Date, b: Date) { return a < b ? a : b }
function isoDow(s: string): number { const d = new Date(s + 'T00:00:00'); return ((d.getDay() + 6) % 7) + 1 }
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Jue', 'Sáb', 'Dom']
const DIAS_OK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fdShort(d: Date): string { return `${d.getDate()} ${MESES[d.getMonth()]}` }

function rangoPrevio(desde: Date, hasta: Date) {
  const dias = Math.round((hasta.getTime() - desde.getTime()) / 86400000) + 1
  const h = addDays(desde, -1); const d = addDays(h, -(dias - 1))
  return { desde: d, hasta: h }
}
function rangoAnio(desde: Date, hasta: Date) {
  return {
    desde: new Date(desde.getFullYear() - 1, desde.getMonth(), desde.getDate()),
    hasta: new Date(hasta.getFullYear() - 1, hasta.getMonth(), hasta.getDate()),
  }
}

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

type Compare = 'previo' | 'y1'

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
  const fechasConDatos = new Set<string>()
  let alm = 0, cena = 0
  for (const r of rows) {
    const db = dayBrutoOf(r, on)
    if (db > 0) fechasConDatos.add(r.fecha)
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

function Delta({ pct, fallback = '—' }: { pct: number | null; fallback?: string }) {
  if (pct == null) return <span style={{ fontFamily: OSWALD, fontSize: 12, color: COLOR.textMut }}>{fallback}</span>
  const up = pct >= 0
  return <span style={{ fontFamily: OSWALD, fontSize: 12, fontWeight: 600, color: up ? COLOR.verde : COLOR.rojo }}>{up ? '▲' : '▼'} {fmtDec(Math.abs(pct), 1)}%</span>
}
function Row({ label, val, right }: { label: string; val: string; right: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, fontFamily: LEXEND }}>
      <span style={{ color: COLOR.textMut }}>{label}</span>
      <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontFamily: OSWALD, color: COLOR.textPri }}>{val}</span>{right}
      </span>
    </div>
  )
}
const numBig: React.CSSProperties = { fontFamily: OSWALD, fontSize: 38, fontWeight: 600 }

export default function TabEvolucion({ fechaDesde, fechaHasta, canalesFiltro }: Props) {
  const [compare, setCompare] = useState<Compare>('previo')
  const [rows, setRows] = useState<RowFac[]>([])
  const [objMap, setObjMap] = useState<Record<number, number>>({})
  const cfg = useConfigCanales()
  const marcas = useMarcasPorCanal()

  const cmpRange = useMemo(() => compare === 'previo' ? rangoPrevio(fechaDesde, fechaHasta) : rangoAnio(fechaDesde, fechaHasta), [compare, fechaDesde, fechaHasta])
  const wideDesde = useMemo(() => minDate(cmpRange.desde, addDays(fechaDesde, -35)), [cmpRange, fechaDesde])

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

  const dayMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.fecha, (m.get(r.fecha) || 0) + dayBrutoOf(r, on))
    return m
  }, [rows, on])

  const inRange = (f: string, d: Date, h: Date) => f >= toStr(d) && f <= toStr(h)
  const rowsPeriodo = useMemo(() => rows.filter(r => inRange(r.fecha, fechaDesde, fechaHasta)), [rows, fechaDesde, fechaHasta])
  const rowsCmp = useMemo(() => rows.filter(r => inRange(r.fecha, cmpRange.desde, cmpRange.hasta)), [rows, cmpRange])

  const A = useMemo(() => aggregate(rowsPeriodo, canalesFiltro, fechaDesde, fechaHasta, cfg, marcas), [rowsPeriodo, canalesFiltro, fechaDesde, fechaHasta, cfg, marcas])
  const C = useMemo(() => aggregate(rowsCmp, canalesFiltro, cmpRange.desde, cmpRange.hasta, cfg, marcas), [rowsCmp, canalesFiltro, cmpRange, cfg, marcas])

  const tmB = A.pedidos > 0 ? A.bruto / A.pedidos : 0
  const tmN = A.pedidos > 0 ? A.neto / A.pedidos : 0
  const tmBC = C.pedidos > 0 ? C.bruto / C.pedidos : 0

  const canalStats: CanalStat[] = useMemo(() =>
    CANALES.filter(c => on(c.id)).map(c => {
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

  const patron = useMemo(() => {
    const acc = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }))
    for (const r of rowsPeriodo) {
      const v = dayMap.get(r.fecha) || 0
      // contamos cada fecha una vez
    }
    const vistos = new Set<string>()
    for (const r of rowsPeriodo) {
      if (vistos.has(r.fecha)) continue; vistos.add(r.fecha)
      const v = dayMap.get(r.fecha) || 0; if (v <= 0) continue
      const i = isoDow(r.fecha) - 1; acc[i].sum += v; acc[i].n += 1
    }
    return acc.map((a, i) => ({ dia: DIAS_OK[i], avg: a.n > 0 ? a.sum / a.n : 0, n: a.n })).filter(p => p.n > 0).sort((a, b) => b.avg - a.avg)
  }, [rowsPeriodo, dayMap])
  const patronMax = Math.max(...patron.map(p => p.avg), 1)

  const racha = useMemo(() => {
    const fechas = [...new Set(rowsPeriodo.map(r => r.fecha))].filter(f => (dayMap.get(f) || 0) > 0).sort()
    let streak = 0, cumpl = 0, tot = 0
    for (const f of fechas) { const o = objMap[isoDow(f)]; if (o == null) continue; tot++; if ((dayMap.get(f) || 0) >= o) cumpl++ }
    for (let i = fechas.length - 1; i >= 0; i--) { const o = objMap[isoDow(fechas[i])]; if (o == null) break; if ((dayMap.get(fechas[i]) || 0) >= o) streak++; else break }
    return { streak, cumpl, tot }
  }, [rowsPeriodo, dayMap, objMap])

  const diaADia = useMemo(() => {
    const out: { f: string; bruto: number | null; dSem: number | null; dMes: number | null }[] = []
    let d = new Date(fechaDesde)
    while (d <= fechaHasta) {
      const f = toStr(d)
      const bruto = dayMap.has(f) ? (dayMap.get(f) || 0) : null
      const semF = toStr(addDays(d, -7)); const mesF = toStr(addMonthsClamp(d, -1))
      const semV = dayMap.has(semF) ? (dayMap.get(semF) || 0) : null
      const mesV = dayMap.has(mesF) ? (dayMap.get(mesF) || 0) : null
      out.push({
        f, bruto,
        dSem: bruto != null && semV != null ? delta(bruto, semV) : null,
        dMes: bruto != null && mesV != null ? delta(bruto, mesV) : null,
      })
      d = addDays(d, 1)
    }
    return out
  }, [fechaDesde, fechaHasta, dayMap])

  const cmpLabel = compare === 'previo' ? 'periodo anterior' : 'año anterior'
  const y1fb = compare === 'y1' ? 'sin histórico' : '—'
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 14 }

  return (
    <div style={{ marginTop: 18, color: COLOR.textPri, fontFamily: LEXEND }}>

      <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: '#fff', border: `0.5px solid ${COLOR.brd}`, borderRadius: 8, marginBottom: 16 }}>
        {([['previo', 'Periodo anterior'], ['y1', 'Año anterior']] as [Compare, string][]).map(([id, t]) => (
          <button key={id} onClick={() => setCompare(id)} style={{
            padding: '5px 14px', borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: LEXEND, fontSize: 12, fontWeight: 500,
            background: compare === id ? '#3a4050' : 'transparent', color: compare === id ? '#fff' : COLOR.textMut,
          }}>{t}</button>
        ))}
      </div>

      {/* FILA 1 */}
      <div style={grid}>
        <div style={cardBig}>
          <div style={lbl}>VENTAS</div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'baseline', marginTop: 8, flexWrap: 'wrap' }}>
            <div><div style={{ ...numBig, color: COLOR.rojoSL }}>{fmtEur(A.bruto, { showEuro: true, decimals: 0 })}</div><div style={lblXs}>BRUTO</div></div>
            <div><div style={{ ...numBig, color: COLOR.verde }}>{fmtEur(A.neto, { showEuro: true, decimals: 0 })}</div><div style={{ ...lblXs, color: COLOR.verde }}>NETO</div></div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row label={`Bruto · ${cmpLabel}`} val={fmtEur(C.bruto, { showEuro: true, decimals: 0 })} right={<Delta pct={delta(A.bruto, C.bruto)} fallback={y1fb} />} />
            <Row label={`Neto · ${cmpLabel}`} val={fmtEur(C.neto, { showEuro: true, decimals: 0 })} right={<Delta pct={delta(A.neto, C.neto)} fallback={y1fb} />} />
          </div>
        </div>

        <CardPedidosTM pedidos={A.pedidos} tmBruto={tmB} tmNeto={tmN} pedidosDeltaPct={delta(A.pedidos, C.pedidos)} tmDeltaPct={delta(tmB, tmBC)} canales={canalStats} />

        <div style={cardBig}>
          <div style={lbl}>PLATAFORMAS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {CANALES.filter(c => on(c.id)).map(c => {
              const b = A.porCanal[c.id].bruto, bC = C.porCanal[c.id].bruto
              const pct = A.bruto > 0 ? (b / A.bruto) * 100 : 0
              return (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3, fontFamily: LEXEND }}>
                    <span><span style={{ color: c.color }}>●</span> {c.label}</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <b style={{ fontFamily: OSWALD }}>{fmtEur(b, { showEuro: true, decimals: 0 })}</b>
                      <span style={{ color: COLOR.textMut, fontFamily: OSWALD }}>{fmtDec(pct, 0)}%</span>
                      <Delta pct={delta(b, bC)} fallback={y1fb} />
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: COLOR.bordeClaro, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(pct, b > 0 ? 2 : 0)}%`, background: c.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* FILA 2 */}
      <div style={grid}>
        <div style={cardBig}>
          <div style={lbl}>COMIDA · CENA</div>
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
                        <b style={{ fontFamily: OSWALD, fontSize: 18, color: g.c }}>{fmtEur(g.v, { showEuro: true, decimals: 0 })}</b>
                        <span style={{ fontFamily: OSWALD, fontSize: 12, color: COLOR.textMut }}>{fmtDec(pct, 0)}%</span>
                        <Delta pct={delta(g.v, g.vc)} fallback={y1fb} />
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

        <div style={cardBig}>
          <div style={lbl}>PATRÓN POR DÍA</div>
          {patron.length === 0 ? <div style={{ fontSize: 12, color: COLOR.textMut, marginTop: 14, fontFamily: LEXEND }}>Sin datos.</div> : (
            <div style={{ marginTop: 12 }}>
              {patron.map((p, i) => {
                const c = i === 0 ? COLOR.verde : i === patron.length - 1 ? COLOR.rojo : COLOR.textSec
                return (
                  <div key={p.dia} style={{ marginBottom: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{p.dia}</span>
                      <b style={{ fontFamily: OSWALD, fontSize: 14, color: c }}>{fmtEur(p.avg, { showEuro: true, decimals: 0 })}</b>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: COLOR.bordeClaro, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((p.avg / patronMax) * 100, 100)}%`, background: c }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={cardBig}>
          <div style={lbl}>OBJETIVO DIARIO</div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'baseline', marginTop: 8, flexWrap: 'wrap' }}>
            <div><div style={{ ...numBig, color: racha.streak > 0 ? COLOR.verde : COLOR.textMut }}>{racha.streak}</div><div style={lblXs}>RACHA</div></div>
            <div><div style={{ ...numBig, color: COLOR.textPri }}>{racha.tot > 0 ? `${Math.round((racha.cumpl / racha.tot) * 100)}%` : '—'}</div><div style={lblXs}>CUMPLIMIENTO</div></div>
          </div>
          <div style={{ fontSize: 11, color: COLOR.textMut, marginTop: 12, fontFamily: LEXEND }}>{racha.tot > 0 ? `${racha.cumpl}/${racha.tot} días del periodo` : 'sin datos en el periodo'}</div>
        </div>
      </div>

      {/* FILA 3 — día a día */}
      <div style={cardBig}>
        <div style={lbl}>DÍA A DÍA · vs semana anterior · vs mes anterior</div>
        <div style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: LEXEND, fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: COLOR.textMut }}>
                <th style={{ padding: '4px 6px', fontFamily: OSWALD, fontWeight: 500 }}>Día</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', fontFamily: OSWALD, fontWeight: 500 }}>Bruto</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', fontFamily: OSWALD, fontWeight: 500 }}>vs sem. ant.</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', fontFamily: OSWALD, fontWeight: 500 }}>vs mes ant.</th>
              </tr>
            </thead>
            <tbody>
              {diaADia.map(d => (
                <tr key={d.f} style={{ borderTop: `0.5px solid ${COLOR.bordeClaro}` }}>
                  <td style={{ padding: '5px 6px' }}>{DIAS_OK[isoDow(d.f) - 1]} {fdShort(new Date(d.f + 'T00:00:00'))}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: OSWALD, color: COLOR.textPri }}>{d.bruto == null ? '—' : fmtEur(d.bruto, { showEuro: true, decimals: 0 })}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right' }}><Delta pct={d.dSem} /></td>
                  <td style={{ padding: '5px 6px', textAlign: 'right' }}><Delta pct={d.dMes} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
