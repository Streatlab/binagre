/**
 * TabEvolucion — Panel Global · Comparativas de facturación
 *
 * 100% datos reales:
 *  - facturacion_diario (fecha, servicio ALM/CENAS/TODO, brutos y pedidos por canal)
 *  - objetivos_dia_semana (objetivo por día de la semana)
 *
 * Anclado al día de HOY. Nada inventado. Lo que no hay histórico → "sin dato".
 *
 * Cards:
 *  1. HOY            · vs mismo día mes pasado y mismo día año pasado
 *  2. MES EN CURSO   · MTD vs mismo tramo mes anterior y mismo mes año pasado
 *  3. TICKET MEDIO   · MTD vs mes anterior
 *  4. ESTA SEMANA    · día a día vs semana pasada y vs mes pasado
 *  5. COMIDA vs CENA · reparto del mes en curso (ALM vs CENAS)
 *  6. RACHA OBJETIVO · días seguidos cumpliendo el objetivo diario + últimos 14 días
 *  7. PATRÓN DÍA     · facturación media por día de la semana (mejor → peor)
 */

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/lib/format'
import { COLORS, OSWALD, LEXEND, card, lbl } from '@/components/panel/resumen/tokens'

/* ── helpers fecha ── */
function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function addMonthsClamp(d: Date, n: number): Date {
  const day = d.getDate()
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const dim = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(day, dim))
  return x
}
function addYears(d: Date, n: number): Date { return new Date(d.getFullYear() + n, d.getMonth(), d.getDate()) }
function isoDow(d: Date): number { return ((d.getDay() + 6) % 7) + 1 } // 1=Lun..7=Dom
function startOfWeekMon(d: Date): Date { return addDays(d, -(isoDow(d) - 1)) }
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fdShort(d: Date): string { return `${d.getDate()} ${MESES[d.getMonth()]}` }

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
  { id: 'uber', b: 'uber_bruto', p: 'uber_pedidos' },
  { id: 'glovo', b: 'glovo_bruto', p: 'glovo_pedidos' },
  { id: 'je', b: 'je_bruto', p: 'je_pedidos' },
  { id: 'web', b: 'web_bruto', p: 'web_pedidos' },
  { id: 'dir', b: 'directa_bruto', p: 'directa_pedidos' },
] as const

function filtRow(r: RowFac, canales: string[]): { bruto: number; pedidos: number } {
  const on = (id: string) => canales.length === 0 || canales.includes(id)
  const rec = r as unknown as Record<string, number>
  let bruto = 0, pedidos = 0
  for (const c of CANALES) if (on(c.id)) { bruto += Number(rec[c.b] || 0); pedidos += Number(rec[c.p] || 0) }
  return { bruto, pedidos }
}

const eur0 = (v: number) => fmtEur(v, { showEuro: true, decimals: 0 })
const eur2 = (v: number) => fmtEur(v, { showEuro: true, decimals: 2 })

function delta(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null
  return ((a - b) / b) * 100
}

/* ── sub-componentes UI ── */
function DeltaBadge({ pct, fallback = 'sin dato' }: { pct: number | null; fallback?: string }) {
  if (pct == null || !isFinite(pct)) {
    return <span style={{ fontFamily: OSWALD, fontSize: 11, color: COLORS.mut }}>{fallback}</span>
  }
  const up = pct >= 0
  return (
    <span style={{ fontFamily: OSWALD, fontSize: 12, fontWeight: 600, color: up ? COLORS.ok : COLORS.redSL }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function Box({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...card, padding: '18px 20px', ...style }}>{children}</div>
}

function CardTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
      <div style={lbl}>{children}</div>
      {right}
    </div>
  )
}

const bigNum: React.CSSProperties = { fontFamily: OSWALD, fontSize: 34, fontWeight: 600, color: COLORS.pri, lineHeight: 1 }
const midNum: React.CSSProperties = { fontFamily: OSWALD, fontSize: 26, fontWeight: 600, color: COLORS.pri, lineHeight: 1 }
const lineMut: React.CSSProperties = { fontFamily: LEXEND, fontSize: 12, color: COLORS.mut }

/* ── componente principal ── */
export default function TabEvolucion({ canalesFiltro }: Props) {
  const [rows, setRows] = useState<RowFac[]>([])
  const [objMap, setObjMap] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  const hoy = useMemo(() => new Date(), [])

  useEffect(() => {
    const desde = `${hoy.getFullYear() - 2}-01-01`
    const hasta = toStr(hoy)
    supabase
      .from('facturacion_diario')
      .select('fecha,servicio,uber_bruto,uber_pedidos,glovo_bruto,glovo_pedidos,je_bruto,je_pedidos,web_bruto,web_pedidos,directa_bruto,directa_pedidos')
      .gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: true })
      .then(({ data }) => { setRows((data ?? []) as RowFac[]); setLoading(false) })
  }, [hoy])

  useEffect(() => {
    supabase.from('objetivos_dia_semana').select('dia,importe').then(({ data }) => {
      const m: Record<number, number> = {}
      for (const r of (data ?? []) as { dia: number; importe: number }[]) m[Number(r.dia)] = Number(r.importe)
      setObjMap(m)
    })
  }, [])

  const { byDate, byServ } = useMemo(() => {
    const bd = new Map<string, { bruto: number; pedidos: number }>()
    const bs = new Map<string, { alm: number; cena: number }>()
    for (const r of rows) {
      const { bruto, pedidos } = filtRow(r, canalesFiltro)
      const cur = bd.get(r.fecha) ?? { bruto: 0, pedidos: 0 }
      cur.bruto += bruto; cur.pedidos += pedidos; bd.set(r.fecha, cur)
      const s = (r.servicio || '').toUpperCase()
      const cs = bs.get(r.fecha) ?? { alm: 0, cena: 0 }
      if (s === 'ALM') cs.alm += bruto
      else if (s === 'CENAS') cs.cena += bruto
      bs.set(r.fecha, cs)
    }
    return { byDate: bd, byServ: bs }
  }, [rows, canalesFiltro])

  const getB = (d: Date): number | null => { const k = toStr(d); return byDate.has(k) ? byDate.get(k)!.bruto : null }
  const sumRange = (from: Date, to: Date) => {
    let bruto = 0, pedidos = 0, any = false
    let d = new Date(from)
    while (d <= to) { const k = toStr(d); if (byDate.has(k)) { any = true; const v = byDate.get(k)!; bruto += v.bruto; pedidos += v.pedidos } d = addDays(d, 1) }
    return { bruto, pedidos, any }
  }

  /* HOY */
  const hoyVal = getB(hoy)
  const hoyMesAnt = getB(addMonthsClamp(hoy, -1))
  const hoyAnioAnt = getB(addYears(hoy, -1))

  /* MES EN CURSO (month-to-date) */
  const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const mtd = sumRange(ini, hoy)
  const mtdPrev = sumRange(addMonthsClamp(ini, -1), addMonthsClamp(hoy, -1))
  const mtdLy = sumRange(addYears(ini, -1), addYears(hoy, -1))
  const ticketAct = mtd.pedidos > 0 ? mtd.bruto / mtd.pedidos : null
  const ticketPrev = mtdPrev.pedidos > 0 ? mtdPrev.bruto / mtdPrev.pedidos : null

  /* ESTA SEMANA */
  const lunes = startOfWeekMon(hoy)
  const semana = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(lunes, i)
    const esFuturo = d > hoy
    const actual = esFuturo ? null : getB(d)
    const semPasada = getB(addDays(d, -7))
    const mesPasado = getB(addMonthsClamp(d, -1))
    const esHoy = toStr(d) === toStr(hoy)
    return { d, esFuturo, esHoy, actual, semPasada, mesPasado }
  })

  /* COMIDA vs CENA · mes en curso */
  let alm = 0, cena = 0
  { let d = new Date(ini); while (d <= hoy) { const cs = byServ.get(toStr(d)); if (cs) { alm += cs.alm; cena += cs.cena } d = addDays(d, 1) } }
  const totalServ = alm + cena
  const sinDesglose = totalServ === 0 && mtd.bruto > 0

  /* PATRÓN por día de la semana */
  const patron = useMemo(() => {
    const acc = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }))
    for (const [k, v] of byDate) { const dow = isoDow(new Date(k + 'T00:00:00')); acc[dow - 1].sum += v.bruto; acc[dow - 1].n += 1 }
    return acc.map((a, i) => ({ dia: DIAS[i], avg: a.n > 0 ? a.sum / a.n : 0, n: a.n }))
  }, [byDate])
  const patronOrden = [...patron].filter(p => p.n > 0).sort((a, b) => b.avg - a.avg)
  const patronMax = Math.max(...patronOrden.map(p => p.avg), 1)

  /* RACHA objetivo */
  const racha = useMemo(() => {
    const fechas = [...byDate.keys()].sort()
    let streak = 0
    for (let i = fechas.length - 1; i >= 0; i--) {
      const k = fechas[i]; const dow = isoDow(new Date(k + 'T00:00:00')); const obj = objMap[dow]
      if (obj == null) break
      if (byDate.get(k)!.bruto >= obj) streak++; else break
    }
    const dots = Array.from({ length: 14 }, (_, i) => {
      const d = addDays(hoy, -(13 - i)); const k = toStr(d); const obj = objMap[isoDow(d)]
      if (!byDate.has(k) || obj == null) return { d, estado: 'nd' as const }
      return { d, estado: byDate.get(k)!.bruto >= obj ? 'ok' as const : 'no' as const }
    })
    return { streak, dots }
  }, [byDate, objMap, hoy])

  if (loading) {
    return <div style={{ padding: 40, color: COLORS.mut, fontFamily: LEXEND, fontSize: 13 }}>Cargando comparativas…</div>
  }

  const filtroNota = canalesFiltro.length === 0 || canalesFiltro.length === CANALES.length
    ? 'todos los canales' : `${canalesFiltro.length} canal(es) filtrados`

  return (
    <div style={{ marginTop: 18, color: COLORS.pri, fontFamily: LEXEND }}>

      <div style={{ marginBottom: 14 }}>
        <div style={lbl}>Comparativas · ancladas a hoy</div>
        <div style={lineMut}>{`${DIAS[isoDow(hoy) - 1]} ${fdShort(hoy)} ${hoy.getFullYear()} · ${filtroNota}`}</div>
      </div>

      {/* FILA 1 — HOY / MES EN CURSO / TICKET MEDIO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
        <Box>
          <CardTitle>{`Hoy · ${fdShort(hoy)}`}</CardTitle>
          <div style={bigNum}>{hoyVal == null ? '—' : eur0(hoyVal)}</div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={lineMut}>vs mismo día mes pasado</span><DeltaBadge pct={delta(hoyVal, hoyMesAnt)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={lineMut}>vs mismo día año pasado</span><DeltaBadge pct={delta(hoyVal, hoyAnioAnt)} fallback="sin histórico" />
            </div>
          </div>
        </Box>

        <Box>
          <CardTitle right={<DeltaBadge pct={delta(mtd.bruto, mtdPrev.bruto)} />}>
            {`Mes en curso · 1–${hoy.getDate()} ${MESES[hoy.getMonth()]}`}
          </CardTitle>
          <div style={bigNum}>{eur0(mtd.bruto)}</div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={lineMut}>vs mismo tramo mes anterior</span><DeltaBadge pct={delta(mtd.bruto, mtdPrev.bruto)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={lineMut}>vs mismo mes año pasado</span><DeltaBadge pct={delta(mtd.bruto, mtdLy.any ? mtdLy.bruto : null)} fallback="sin histórico" />
            </div>
          </div>
        </Box>

        <Box>
          <CardTitle right={<DeltaBadge pct={delta(ticketAct, ticketPrev)} />}>Ticket medio · mes en curso</CardTitle>
          <div style={bigNum}>{ticketAct == null ? '—' : eur2(ticketAct)}</div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={lineMut}>mes anterior</span>
              <span style={{ fontFamily: OSWALD, fontSize: 13, color: COLORS.sec }}>{ticketPrev == null ? '—' : eur2(ticketPrev)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={lineMut}>pedidos mes</span>
              <span style={{ fontFamily: OSWALD, fontSize: 13, color: COLORS.sec }}>{mtd.pedidos.toLocaleString('es-ES')}</span>
            </div>
          </div>
        </Box>
      </div>

      {/* FILA 2 — ESTA SEMANA día a día */}
      <Box style={{ marginBottom: 14 }}>
        <CardTitle>Esta semana · día a día</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
          {semana.map((s, i) => (
            <div key={i} style={{
              border: `1px solid ${s.esHoy ? COLORS.redSL : COLORS.brd}`,
              background: s.esHoy ? '#B01D2308' : '#fff',
              borderRadius: 10, padding: '12px 10px', opacity: s.esFuturo ? 0.5 : 1,
            }}>
              <div style={{ fontFamily: OSWALD, fontSize: 12, letterSpacing: 1, color: s.esHoy ? COLORS.redSL : COLORS.mut, textTransform: 'uppercase' }}>
                {DIAS[i]} {s.d.getDate()}
              </div>
              <div style={{ fontFamily: OSWALD, fontSize: 19, fontWeight: 600, color: COLORS.pri, margin: '6px 0 10px' }}>
                {s.actual == null ? (s.esFuturo ? '—' : 'sin dato') : eur0(s.actual)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontFamily: LEXEND, fontSize: 10, color: COLORS.mut }}>sem. ant.</div>
                <DeltaBadge pct={delta(s.actual, s.semPasada)} fallback="—" />
                <div style={{ fontFamily: LEXEND, fontSize: 10, color: COLORS.mut, marginTop: 4 }}>mes ant.</div>
                <DeltaBadge pct={delta(s.actual, s.mesPasado)} fallback="—" />
              </div>
            </div>
          ))}
        </div>
      </Box>

      {/* FILA 3 — COMIDA vs CENA / RACHA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Box>
          <CardTitle>{`Comida vs cena · mes en curso`}</CardTitle>
          {sinDesglose ? (
            <div style={{ ...lineMut, padding: '20px 0' }}>
              Este periodo no tiene servicio desglosado (entró como “TODO”). El reparto comida/cena está disponible desde que la facturación se registra por servicio (ALM/CENAS).
            </div>
          ) : totalServ === 0 ? (
            <div style={{ ...lineMut, padding: '20px 0' }}>Sin datos en el mes en curso.</div>
          ) : (
            <div style={{ paddingTop: 4 }}>
              {[
                { n: 'Comida (almuerzo)', v: alm, c: COLORS.warn },
                { n: 'Cena', v: cena, c: COLORS.sidebar },
              ].map(g => {
                const pct = totalServ > 0 ? (g.v / totalServ) * 100 : 0
                return (
                  <div key={g.n} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                      <span style={{ fontFamily: LEXEND, fontSize: 13, color: COLORS.pri }}>{g.n}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <span style={{ fontFamily: OSWALD, fontSize: 15, fontWeight: 600, color: COLORS.pri }}>{eur0(g.v)}</span>
                        <span style={{ fontFamily: OSWALD, fontSize: 12, color: COLORS.mut }}>{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div style={{ height: 8, background: '#ebe8e2', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: 8, width: `${Math.min(pct, 100)}%`, background: g.c }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Box>

        <Box>
          <CardTitle right={
            <span style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 600, color: racha.streak > 0 ? COLORS.ok : COLORS.mut }}>
              {racha.streak}
            </span>
          }>Racha · objetivo diario</CardTitle>
          <div style={lineMut}>{racha.streak > 0 ? `días seguidos cumpliendo el objetivo` : 'sin racha activa ahora mismo'}</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 18, alignItems: 'flex-end' }}>
            {racha.dots.map((d, i) => (
              <div key={i} title={fdShort(d.d)} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  height: 28, borderRadius: 5,
                  background: d.estado === 'ok' ? COLORS.ok : d.estado === 'no' ? COLORS.redSL : '#ebe8e2',
                }} />
                <div style={{ fontFamily: LEXEND, fontSize: 9, color: COLORS.mut, marginTop: 3 }}>{d.d.getDate()}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 12, fontFamily: LEXEND, fontSize: 11, color: COLORS.mut }}>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: COLORS.ok, marginRight: 4 }} />cumplido</span>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: COLORS.redSL, marginRight: 4 }} />no</span>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: '#ebe8e2', marginRight: 4 }} />sin dato</span>
          </div>
        </Box>
      </div>

      {/* FILA 4 — PATRÓN por día de la semana */}
      <Box>
        <CardTitle>Patrón por día de la semana · facturación media</CardTitle>
        {patronOrden.length === 0 ? (
          <div style={{ ...lineMut, padding: '20px 0' }}>Sin datos suficientes.</div>
        ) : (
          <div style={{ paddingTop: 4 }}>
            {patronOrden.map((p, idx) => {
              const esMejor = idx === 0, esPeor = idx === patronOrden.length - 1
              const col = esMejor ? COLORS.ok : esPeor ? COLORS.redSL : COLORS.sec
              return (
                <div key={p.dia} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontFamily: LEXEND, fontSize: 13, color: COLORS.pri }}>
                      {p.dia}
                      {esMejor && <span style={{ fontFamily: OSWALD, fontSize: 10, color: COLORS.ok, marginLeft: 8 }}>MEJOR</span>}
                      {esPeor && <span style={{ fontFamily: OSWALD, fontSize: 10, color: COLORS.redSL, marginLeft: 8 }}>MÁS FLOJO</span>}
                    </span>
                    <span style={{ fontFamily: OSWALD, fontSize: 14, fontWeight: 600, color: COLORS.pri }}>{eur0(p.avg)}</span>
                  </div>
                  <div style={{ height: 8, background: '#ebe8e2', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: 8, width: `${Math.min((p.avg / patronMax) * 100, 100)}%`, background: col }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Box>

    </div>
  )
}
