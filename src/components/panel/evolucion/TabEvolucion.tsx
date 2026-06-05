/**
 * TabEvolucion — Panel Global · Comparativas
 * Mismo lenguaje visual que Tab Resumen (cards grandes, tokens ERP).
 * Todo depende del periodo seleccionado arriba y se compara contra el periodo elegido.
 */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtNum } from '@/lib/format'
import { COLOR, OSWALD, LEXEND, cardBig, lbl, lblXs, fmtDec } from '@/components/panel/resumen/tokens'
import {
  calcNetoPorCanal, useConfigCanales, useMarcasPorCanal,
  type CanalConfig, type MarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'

/* ── fechas ── */
function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function isoDow(s: string): number { const d = new Date(s + 'T00:00:00'); return ((d.getDay() + 6) % 7) + 1 }
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function rangoPrevio(desde: Date, hasta: Date) {
  const dias = Math.round((hasta.getTime() - desde.getTime()) / 86400000) + 1
  const h = addDays(desde, -1)
  const d = addDays(h, -(dias - 1))
  return { desde: d, hasta: h }
}
function rangoAnioAnterior(desde: Date, hasta: Date) {
  return {
    desde: new Date(desde.getFullYear() - 1, desde.getMonth(), desde.getDate()),
    hasta: new Date(hasta.getFullYear() - 1, hasta.getMonth(), hasta.getDate()),
  }
}

/* ── datos ── */
interface RowFac {
  fecha: string; servicio: string | null
  uber_bruto: number; uber_pedidos: number
  glovo_bruto: number; glovo_pedidos: number
  je_bruto: number; je_pedidos: number
  web_bruto: number; web_pedidos: number
  directa_bruto: number; directa_pedidos: number
  total_bruto: number; total_pedidos: number
}

interface Props { fechaDesde: Date; fechaHasta: Date; canalesFiltro: string[] }

const CANALES = [
  { id: 'uber', label: 'Uber Eats', color: '#06C167', bk: 'uber_bruto', pk: 'uber_pedidos' },
  { id: 'glovo', label: 'Glovo', color: '#e8f442', bk: 'glovo_bruto', pk: 'glovo_pedidos' },
  { id: 'je', label: 'Just Eat', color: '#f5a623', bk: 'je_bruto', pk: 'je_pedidos' },
  { id: 'web', label: 'Web', color: '#8B5CF6', bk: 'web_bruto', pk: 'web_pedidos' },
  { id: 'dir', label: 'Directa', color: '#06B6D4', bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

const SELECT_COLS = 'fecha,servicio,uber_bruto,uber_pedidos,glovo_bruto,glovo_pedidos,je_bruto,je_pedidos,web_bruto,web_pedidos,directa_bruto,directa_pedidos,total_bruto,total_pedidos'

type Compare = 'previo' | 'y1'

interface Agg {
  porCanal: Record<string, { bruto: number; pedidos: number; neto: number }>
  bruto: number; pedidos: number; neto: number
  alm: number; cena: number
  porFecha: Map<string, number>
  dias: number
}

function aggregate(
  rows: RowFac[], canales: string[], desde: Date, hasta: Date,
  cfg: Record<string, CanalConfig>, marcas: MarcasPorCanal,
): Agg {
  const on = (id: string) => canales.length === 0 || canales.includes(id)
  const porCanal: Record<string, { bruto: number; pedidos: number; neto: number }> = {}
  for (const c of CANALES) porCanal[c.id] = { bruto: 0, pedidos: 0, neto: 0 }
  const porFecha = new Map<string, number>()
  let alm = 0, cena = 0
  for (const r of rows) {
    let dayBruto = 0
    for (const c of CANALES) {
      if (!on(c.id)) continue
      const b = Number((r as unknown as Record<string, number>)[c.bk] || 0)
      const p = Number((r as unknown as Record<string, number>)[c.pk] || 0)
      porCanal[c.id].bruto += b; porCanal[c.id].pedidos += p; dayBruto += b
    }
    porFecha.set(r.fecha, (porFecha.get(r.fecha) || 0) + dayBruto)
    const s = (r.servicio || '').toUpperCase()
    if (s === 'ALM') alm += dayBruto
    else if (s === 'CENAS') cena += dayBruto
  }
  const dias = [...porFecha.entries()].filter(([, v]) => v > 0).length
  let bruto = 0, pedidos = 0, neto = 0
  for (const c of CANALES) {
    const pc = porCanal[c.id]
    const { neto: n } = calcNetoPorCanal(c.id, pc.bruto, pc.pedidos, {
      modo: 'agregado_canal', marcasPorCanal: marcas, fechaDesde: desde, fechaHasta: hasta,
      configCanales: cfg, diasConDatos: dias,
    })
    pc.neto = n
    bruto += pc.bruto; pedidos += pc.pedidos; neto += n
  }
  return { porCanal, bruto, pedidos, neto, alm, cena, porFecha, dias }
}

function delta(a: number, b: number): number | null {
  if (!isFinite(a) || !isFinite(b) || b <= 0) return null
  return ((a - b) / b) * 100
}

/* ── UI ── */
function Delta({ pct, fallback = '—' }: { pct: number | null; fallback?: string }) {
  if (pct == null) return <span style={{ fontFamily: OSWALD, fontSize: 12, color: COLOR.textMut }}>{fallback}</span>
  const up = pct >= 0
  return (
    <span style={{ fontFamily: OSWALD, fontSize: 12, fontWeight: 600, color: up ? COLOR.verde : COLOR.rojo }}>
      {up ? '▲' : '▼'} {fmtDec(Math.abs(pct), 1)}%
    </span>
  )
}

const numBig: React.CSSProperties = { fontFamily: OSWALD, fontSize: 38, fontWeight: 600 }
const numMid: React.CSSProperties = { fontFamily: OSWALD, fontSize: 22, fontWeight: 600 }

export default function TabEvolucion({ fechaDesde, fechaHasta, canalesFiltro }: Props) {
  const [compare, setCompare] = useState<Compare>('previo')
  const [rows, setRows] = useState<RowFac[]>([])
  const [rowsCmp, setRowsCmp] = useState<RowFac[]>([])
  const [objMap, setObjMap] = useState<Record<number, number>>({})

  const cfg = useConfigCanales()
  const marcas = useMarcasPorCanal()

  const cmpRange = useMemo(
    () => compare === 'previo' ? rangoPrevio(fechaDesde, fechaHasta) : rangoAnioAnterior(fechaDesde, fechaHasta),
    [compare, fechaDesde, fechaHasta],
  )

  useEffect(() => {
    supabase.from('facturacion_diario').select(SELECT_COLS)
      .gte('fecha', toStr(fechaDesde)).lte('fecha', toStr(fechaHasta))
      .then(({ data }) => setRows((data ?? []) as RowFac[]))
  }, [fechaDesde, fechaHasta])

  useEffect(() => {
    supabase.from('facturacion_diario').select(SELECT_COLS)
      .gte('fecha', toStr(cmpRange.desde)).lte('fecha', toStr(cmpRange.hasta))
      .then(({ data }) => setRowsCmp((data ?? []) as RowFac[]))
  }, [cmpRange])

  useEffect(() => {
    supabase.from('objetivos_dia_semana').select('dia,importe').then(({ data }) => {
      const m: Record<number, number> = {}
      for (const r of (data ?? []) as { dia: number; importe: number }[]) m[Number(r.dia)] = Number(r.importe)
      setObjMap(m)
    })
  }, [])

  const A = useMemo(() => aggregate(rows, canalesFiltro, fechaDesde, fechaHasta, cfg, marcas),
    [rows, canalesFiltro, fechaDesde, fechaHasta, cfg, marcas])
  const C = useMemo(() => aggregate(rowsCmp, canalesFiltro, cmpRange.desde, cmpRange.hasta, cfg, marcas),
    [rowsCmp, canalesFiltro, cmpRange, cfg, marcas])

  const tmBruto = A.pedidos > 0 ? A.bruto / A.pedidos : 0
  const tmNeto = A.pedidos > 0 ? A.neto / A.pedidos : 0
  const tmBrutoC = C.pedidos > 0 ? C.bruto / C.pedidos : 0
  const tmNetoC = C.pedidos > 0 ? C.neto / C.pedidos : 0

  const totalServ = A.alm + A.cena
  const totalServC = C.alm + C.cena
  const sinDesglose = totalServ === 0 && A.bruto > 0

  const patron = useMemo(() => {
    const acc = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }))
    for (const [k, v] of A.porFecha) { if (v <= 0) continue; const i = isoDow(k) - 1; acc[i].sum += v; acc[i].n += 1 }
    return acc.map((a, i) => ({ dia: DIAS[i], avg: a.n > 0 ? a.sum / a.n : 0, n: a.n }))
      .filter(p => p.n > 0).sort((a, b) => b.avg - a.avg)
  }, [A.porFecha])
  const patronMax = Math.max(...patron.map(p => p.avg), 1)

  const racha = useMemo(() => {
    const fechas = [...A.porFecha.keys()].filter(k => (A.porFecha.get(k) || 0) > 0).sort()
    let streak = 0, cumplidos = 0, total = 0
    for (const k of fechas) { const o = objMap[isoDow(k)]; if (o == null) continue; total++; if ((A.porFecha.get(k) || 0) >= o) cumplidos++ }
    for (let i = fechas.length - 1; i >= 0; i--) {
      const k = fechas[i]; const o = objMap[isoDow(k)]; if (o == null) break
      if ((A.porFecha.get(k) || 0) >= o) streak++; else break
    }
    const ult = fechas.slice(-14).map(k => ({ k, ok: (A.porFecha.get(k) || 0) >= (objMap[isoDow(k)] ?? Infinity) }))
    return { streak, cumplidos, total, ult }
  }, [A.porFecha, objMap])

  const cmpLabel = compare === 'previo' ? 'periodo anterior' : 'año anterior'
  const y1Fallback = compare === 'y1' ? 'sin histórico' : '—'
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 14 }

  return (
    <div style={{ marginTop: 18, color: COLOR.textPri, fontFamily: LEXEND }}>

      {/* Comparar contra */}
      <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: '#fff', border: `0.5px solid ${COLOR.brd}`, borderRadius: 8, marginBottom: 16 }}>
        {([['previo', 'Periodo anterior'], ['y1', 'Año anterior']] as [Compare, string][]).map(([id, t]) => (
          <button key={id} onClick={() => setCompare(id)} style={{
            padding: '5px 14px', borderRadius: 5, border: 'none', cursor: 'pointer',
            fontFamily: LEXEND, fontSize: 12, fontWeight: 500,
            background: compare === id ? '#3a4050' : 'transparent',
            color: compare === id ? '#fff' : COLOR.textMut,
          }}>{t}</button>
        ))}
      </div>

      {/* FILA 1 */}
      <div style={grid}>
        {/* Ventas */}
        <div style={cardBig}>
          <div style={lbl}>VENTAS</div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'baseline', marginTop: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...numBig, color: COLOR.rojoSL }}>{fmtEur(A.bruto, { showEuro: true, decimals: 0 })}</div>
              <div style={lblXs}>BRUTO</div>
            </div>
            <div>
              <div style={{ ...numBig, color: COLOR.verde }}>{fmtEur(A.neto, { showEuro: true, decimals: 0 })}</div>
              <div style={{ ...lblXs, color: COLOR.verde }}>NETO</div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row label={`Bruto · ${cmpLabel}`} val={fmtEur(C.bruto, { showEuro: true, decimals: 0 })} right={<Delta pct={delta(A.bruto, C.bruto)} fallback={y1Fallback} />} />
            <Row label={`Neto · ${cmpLabel}`} val={fmtEur(C.neto, { showEuro: true, decimals: 0 })} right={<Delta pct={delta(A.neto, C.neto)} fallback={y1Fallback} />} />
          </div>
        </div>

        {/* Pedidos · TM */}
        <div style={cardBig}>
          <div style={lbl}>PEDIDOS · TM</div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginTop: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...numBig, color: '#1E5BCC' }}>{fmtNum(A.pedidos, 0)}</div>
              <div style={{ ...lblXs, color: '#1E5BCC' }}>PEDIDOS</div>
            </div>
            <div>
              <div style={{ ...numBig, color: '#F26B1F' }}>{fmtEur(tmBruto, { showEuro: true, decimals: 2 })}</div>
              <div style={{ ...lblXs, color: '#F26B1F' }}>TM BRUTO</div>
            </div>
            <div>
              <div style={{ ...numBig, color: COLOR.verde }}>{fmtEur(tmNeto, { showEuro: true, decimals: 2 })}</div>
              <div style={{ ...lblXs, color: COLOR.verde }}>TM NETO</div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row label={`Pedidos · ${cmpLabel}`} val={fmtNum(C.pedidos, 0)} right={<Delta pct={delta(A.pedidos, C.pedidos)} fallback={y1Fallback} />} />
            <Row label="TM bruto" val={fmtEur(tmBrutoC, { showEuro: true, decimals: 2 })} right={<Delta pct={delta(tmBruto, tmBrutoC)} fallback={y1Fallback} />} />
            <Row label="TM neto" val={fmtEur(tmNetoC, { showEuro: true, decimals: 2 })} right={<Delta pct={delta(tmNeto, tmNetoC)} fallback={y1Fallback} />} />
          </div>
        </div>

        {/* Plataformas */}
        <div style={cardBig}>
          <div style={lbl}>PLATAFORMAS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {CANALES.filter(c => canalesFiltro.length === 0 || canalesFiltro.includes(c.id)).map(c => {
              const b = A.porCanal[c.id].bruto
              const bC = C.porCanal[c.id].bruto
              const pct = A.bruto > 0 ? (b / A.bruto) * 100 : 0
              return (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3, fontFamily: LEXEND }}>
                    <span><span style={{ color: c.color }}>●</span> {c.label}</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <b style={{ fontFamily: OSWALD }}>{fmtEur(b, { showEuro: true, decimals: 0 })}</b>
                      <span style={{ color: COLOR.textMut, fontFamily: OSWALD }}>{fmtDec(pct, 0)}%</span>
                      <Delta pct={delta(b, bC)} fallback={y1Fallback} />
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
        {/* Comida vs cena */}
        <div style={cardBig}>
          <div style={lbl}>COMIDA · CENA</div>
          {sinDesglose ? (
            <div style={{ fontSize: 12, color: COLOR.textMut, marginTop: 14, fontFamily: LEXEND }}>
              Periodo sin desglose por servicio.
            </div>
          ) : totalServ === 0 ? (
            <div style={{ fontSize: 12, color: COLOR.textMut, marginTop: 14, fontFamily: LEXEND }}>Sin datos.</div>
          ) : (
            <div style={{ marginTop: 12 }}>
              {[
                { n: 'Comida', v: A.alm, vc: C.alm, c: '#F26B1F' },
                { n: 'Cena', v: A.cena, vc: C.cena, c: '#1E5BCC' },
              ].map(g => {
                const pct = totalServ > 0 ? (g.v / totalServ) * 100 : 0
                const pctC = totalServC > 0 ? (g.vc / totalServC) * 100 : 0
                return (
                  <div key={g.n} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{g.n}</span>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <b style={{ ...numMid, fontSize: 18, color: g.c }}>{fmtEur(g.v, { showEuro: true, decimals: 0 })}</b>
                        <span style={{ fontFamily: OSWALD, fontSize: 12, color: COLOR.textMut }}>{fmtDec(pct, 0)}%</span>
                        <Delta pct={delta(g.v, g.vc)} fallback={y1Fallback} />
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: COLOR.bordeClaro, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: g.c }} />
                    </div>
                    <div style={{ fontSize: 11, color: COLOR.textMut, marginTop: 3, fontFamily: LEXEND }}>
                      {cmpLabel}: {fmtEur(g.vc, { showEuro: true, decimals: 0 })} · {fmtDec(pctC, 0)}%
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Patrón por día */}
        <div style={cardBig}>
          <div style={lbl}>PATRÓN POR DÍA</div>
          {patron.length === 0 ? (
            <div style={{ fontSize: 12, color: COLOR.textMut, marginTop: 14, fontFamily: LEXEND }}>Sin datos.</div>
          ) : (
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

        {/* Racha objetivo */}
        <div style={cardBig}>
          <div style={lbl}>OBJETIVO DIARIO</div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'baseline', marginTop: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...numBig, color: racha.streak > 0 ? COLOR.verde : COLOR.textMut }}>{racha.streak}</div>
              <div style={lblXs}>RACHA</div>
            </div>
            <div>
              <div style={{ ...numBig, color: COLOR.textPri }}>{racha.total > 0 ? `${Math.round((racha.cumplidos / racha.total) * 100)}%` : '—'}</div>
              <div style={lblXs}>CUMPLIMIENTO</div>
            </div>
          </div>
          {racha.ult.length > 0 && (
            <div style={{ display: 'flex', gap: 5, marginTop: 16, alignItems: 'flex-end' }}>
              {racha.ult.map((d, i) => (
                <div key={i} style={{ flex: 1, height: 26, borderRadius: 4, background: d.ok ? COLOR.verde : COLOR.rojo }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, val, right }: { label: string; val: string; right: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, fontFamily: LEXEND }}>
      <span style={{ color: COLOR.textMut }}>{label}</span>
      <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontFamily: OSWALD, color: COLOR.textPri }}>{val}</span>
        {right}
      </span>
    </div>
  )
}
