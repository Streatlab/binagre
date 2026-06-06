/**
 * Tab Evolución — Panel Global · v7 (16 correcciones)
 * Foco: la SEMANA en curso (lunes→domingo). Subtabs a la derecha comparan
 * contra semana / mes / año anterior y cambian de verdad los datos.
 * Barras verticales con objetivo REAL (objetivos_dia_semana) en rojo de base
 * que se rellena en naranja/verde según cumplimiento. Sin hardcodes.
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { calcNetoPorCanal, loadConfigCanales, recargarConfigCanales, loadMarcasPorCanal, type CanalConfig, type MarcasPorCanal } from '@/lib/panel/calcNetoPlataforma'
import { fmtEur } from '@/lib/format'
import { COLOR, LEXEND, OSWALD, row3, cardBig, lbl, SUBTABS } from '../resumen/tokens'
import CardPedidosTM from '../resumen/CardPedidosTM'
import ColFacturacionCanal from '../resumen/ColFacturacionCanal'
import type { RowFacturacion, CanalStat } from '../resumen/types'

interface Props {
  rowsPeriodo: RowFacturacion[]
  rowsAll: RowFacturacion[]
  fechaDesde: Date
  fechaHasta: Date
  canalesFiltro: string[]
  onFiltrarDiaSemana?: (idx: number) => void
}

type Comparar = 'semana' | 'mes' | 'anio'

const ROJO_OBJ = '#B01D23'   // rojo base de cumplimiento (tabla Objetivos)
const VERDE = COLOR.verde     // #1D9E75
const NARANJA = COLOR.ambar   // #f5a623
const GRIS = '#c7c0b4'

const NOMBRES_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function toLocal(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function mondayOf(d: Date): Date {
  const r = new Date(d); const dow = r.getDay() || 7
  r.setDate(r.getDate() - dow + 1); r.setHours(0, 0, 0, 0); return r
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(d.getDate() + n); return r }
function shiftDate(d: Date, modo: Comparar): Date {
  const r = new Date(d)
  if (modo === 'semana') r.setDate(r.getDate() - 7)
  else if (modo === 'mes') r.setMonth(r.getMonth() - 1)
  else r.setFullYear(r.getFullYear() - 1)
  return r
}
// color del relleno según % de cumplimiento
function colorRelleno(pct: number): string {
  if (pct >= 100) return VERDE
  return NARANJA
}

export default function TabEvolucion({ rowsAll, fechaDesde, canalesFiltro }: Props) {
  const [comparar, setComparar] = useState<Comparar>(() => (localStorage.getItem('evolucion_comparar') as Comparar) || 'semana')
  const setCompararPersist = useCallback((c: Comparar) => { setComparar(c); localStorage.setItem('evolucion_comparar', c) }, [])

  const [objDia, setObjDia] = useState<Record<number, number>>({})   // 1=Lun..7=Dom
  const [objDiarioBase, setObjDiarioBase] = useState(0)
  const [configCanales, setConfigCanales] = useState<Record<string, CanalConfig>>({})
  const [marcasPorCanal, setMarcasPorCanal] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })

  useEffect(() => {
    loadConfigCanales().then(setConfigCanales)
    loadMarcasPorCanal().then(setMarcasPorCanal)
    const onChange = () => { recargarConfigCanales().then(setConfigCanales); loadMarcasPorCanal().then(setMarcasPorCanal) }
    window.addEventListener('config_canales:changed', onChange)
    return () => window.removeEventListener('config_canales:changed', onChange)
  }, [])

  useEffect(() => {
    Promise.all([
      supabase.from('objetivos').select('tipo,importe').eq('tipo', 'diario'),
      supabase.from('objetivos_dia_semana').select('dia,importe'),
    ]).then(([resD, resDias]) => {
      const base = Number(((resD.data ?? [])[0] as { importe: number })?.importe || 0)
      setObjDiarioBase(base)
      const map: Record<number, number> = {}
      for (const r of (resDias.data ?? []) as { dia: number; importe: number }[]) map[Number(r.dia)] = Number(r.importe)
      setObjDia(map)
    })
  }, [])

  // Semana en curso (lunes de la fecha seleccionada arriba) → L-D
  const lunes = useMemo(() => mondayOf(fechaDesde), [fechaDesde])
  const domingo = useMemo(() => addDays(lunes, 6), [lunes])
  const hoyStr = toLocal(new Date())

  const byFecha = useMemo(() => {
    const m = new Map<string, RowFacturacion>()
    for (const r of rowsAll) m.set(r.fecha, r)
    return m
  }, [rowsAll])

  const brutoDe = useCallback((r: RowFacturacion | undefined): number => {
    if (!r) return 0
    if (canalesFiltro.length === 0) return r.total_bruto || 0
    let s = 0
    for (const id of canalesFiltro) {
      const k = `${id === 'dir' ? 'directa' : id}_bruto` as keyof RowFacturacion
      s += Number(r[k]) || 0
    }
    return s
  }, [canalesFiltro])
  const pedidosDe = useCallback((r: RowFacturacion | undefined): number => {
    if (!r) return 0
    if (canalesFiltro.length === 0) return r.total_pedidos || 0
    let s = 0
    for (const id of canalesFiltro) {
      const k = `${id === 'dir' ? 'directa' : id}_pedidos` as keyof RowFacturacion
      s += Number(r[k]) || 0
    }
    return s
  }, [canalesFiltro])

  const objetivoDeDia = useCallback((diaIdx0: number): number => {
    const diaNum = diaIdx0 + 1 // 0=Lun→1
    return objDia[diaNum] || objDiarioBase || 0
  }, [objDia, objDiarioBase])

  const labelComp = comparar === 'semana' ? 'la semana anterior' : comparar === 'mes' ? 'el mes anterior' : 'el año anterior'

  // ── Barras L-D ──
  const barras = useMemo(() => {
    return NOMBRES_DIAS.map((nombre, i) => {
      const dia = addDays(lunes, i)
      const fecha = toLocal(dia)
      const real = byFecha.has(fecha) ? brutoDe(byFecha.get(fecha)) : null
      const compFecha = toLocal(shiftDate(dia, comparar))
      const hist = byFecha.has(compFecha) ? brutoDe(byFecha.get(compFecha)) : null
      const obj = objetivoDeDia(i)
      const futuro = fecha > hoyStr
      const deltaPct = real != null && hist != null && hist > 0 ? ((real - hist) / hist) * 100 : null
      return { nombre, fecha, real, hist, obj, futuro, deltaPct, esHoy: fecha === hoyStr }
    })
  }, [lunes, byFecha, comparar, brutoDe, objetivoDeDia, hoyStr])

  const totalSemana = useMemo(() => barras.reduce((a, b) => a + (b.real || 0), 0), [barras])
  const objSemana = useMemo(() => barras.reduce((a, b) => a + (b.obj || 0), 0), [barras])
  const pctSemana = objSemana > 0 ? (totalSemana / objSemana) * 100 : 0

  // escala vertical (incluye objetivo y real, deja aire para sobrebarra)
  const escala = useMemo(() => {
    const maxV = Math.max(...barras.map(b => Math.max(b.real || 0, b.obj || 0)), 1)
    return maxV * 1.15
  }, [barras])

  // ── Totales semana comparada (para titular) ──
  const compSemana = useMemo(() => {
    let tot = 0, hay = false, ped = 0
    for (let i = 0; i < 7; i++) {
      const f = toLocal(shiftDate(addDays(lunes, i), comparar))
      if (byFecha.has(f)) { hay = true; tot += brutoDe(byFecha.get(f)); ped += pedidosDe(byFecha.get(f)) }
    }
    return { tot: hay ? tot : null, ped: hay ? ped : null }
  }, [lunes, comparar, byFecha, brutoDe, pedidosDe])

  const pedidosSemana = useMemo(() => barras.reduce((a, b) => a + pedidosDe(byFecha.get(b.fecha)), 0), [barras, byFecha, pedidosDe])
  const tmSemana = pedidosSemana > 0 ? totalSemana / pedidosSemana : 0
  const deltaVentas = compSemana.tot != null && compSemana.tot > 0 ? ((totalSemana - compSemana.tot) / compSemana.tot) * 100 : null
  const deltaPedidos = compSemana.ped != null && compSemana.ped > 0 ? ((pedidosSemana - compSemana.ped) / compSemana.ped) * 100 : null

  // ── canalStats de la semana (para ColFacturacionCanal + CardPedidosTM) ──
  const rowsSemana = useMemo(() => barras.map(b => byFecha.get(b.fecha)).filter(Boolean) as RowFacturacion[], [barras, byFecha])
  const diasConDatos = useMemo(() => rowsSemana.filter(r => (r.total_bruto || 0) > 0).length, [rowsSemana])
  const canalStats: CanalStat[] = useMemo(() => {
    const ids: Array<CanalStat['id']> = ['uber', 'glovo', 'je', 'web', 'dir']
    const visibles = canalesFiltro.length ? ids.filter(id => canalesFiltro.includes(id)) : ids
    const labels: Record<CanalStat['id'], string> = { uber: 'Uber Eats', glovo: 'Glovo', je: 'Just Eat', web: 'Web', dir: 'Directa' }
    const colores: Record<CanalStat['id'], string> = { uber: COLOR.uber, glovo: COLOR.glovo, je: COLOR.je, web: COLOR.webSL, dir: COLOR.directa }
    const totalBruto = rowsSemana.reduce((a, r) => a + (r.total_bruto || 0), 0)
    return visibles.map(id => {
      const bk = `${id === 'dir' ? 'directa' : id}_bruto` as keyof RowFacturacion
      const pk = `${id === 'dir' ? 'directa' : id}_pedidos` as keyof RowFacturacion
      const bruto = rowsSemana.reduce((a, r) => a + (Number(r[bk]) || 0), 0)
      const pedidos = rowsSemana.reduce((a, r) => a + (Number(r[pk]) || 0), 0)
      const { neto, margenPct } = calcNetoPorCanal(id, bruto, pedidos, { modo: 'agregado_canal', marcasPorCanal, fechaDesde: lunes, fechaHasta: domingo, configCanales, diasConDatos })
      return { id, label: labels[id], color: colores[id], bruto, neto, pedidos, pct: totalBruto > 0 ? (bruto / totalBruto) * 100 : 0, ticket: pedidos > 0 ? bruto / pedidos : 0, margen: margenPct }
    })
  }, [rowsSemana, canalesFiltro, marcasPorCanal, configCanales, lunes, domingo, diasConDatos])
  const netoSemana = useMemo(() => canalStats.reduce((a, c) => a + c.neto, 0), [canalStats])
  const tmNetoSemana = pedidosSemana > 0 ? netoSemana / pedidosSemana : 0
  // delta TM
  const tmComp = compSemana.tot != null && compSemana.ped != null && compSemana.ped > 0 ? compSemana.tot / compSemana.ped : null
  const deltaTM = tmComp != null && tmComp > 0 ? ((tmSemana - tmComp) / tmComp) * 100 : null

  // ── Titular dinámico ──
  const colDelta = (v: number | null) => v == null ? COLOR.textMut : v >= 0 ? VERDE : COLOR.rojo
  const titular = useMemo(() => {
    const frases: { txt: string; color: string }[] = []
    // estado vs objetivo
    if (objSemana > 0) {
      const colObj = pctSemana >= 100 ? VERDE : pctSemana >= 50 ? NARANJA : ROJO_OBJ
      frases.push({ txt: `Semana: ${fmtEur(totalSemana, { decimals: 2 })} de ${fmtEur(objSemana, { decimals: 0 })} de objetivo (${pctSemana.toFixed(0)}%).`, color: colObj })
    } else {
      frases.push({ txt: `Llevas ${fmtEur(totalSemana, { decimals: 2 })} esta semana.`, color: COLOR.textSec })
    }
    // pedidos + ticket
    frases.push({
      txt: `${pedidosSemana} pedidos · ticket medio ${fmtEur(tmSemana, { decimals: 2 })}${deltaPedidos != null ? ` · ${deltaPedidos >= 0 ? '+' : ''}${deltaPedidos.toFixed(1)}% pedidos vs ${labelComp}` : ''}.`,
      color: deltaPedidos == null ? COLOR.textSec : colDelta(deltaPedidos),
    })
    // dónde apretar
    if (objSemana > 0 && pctSemana < 100) {
      const diasRestantes = barras.filter(b => b.futuro || b.esHoy).length
      const falta = Math.max(objSemana - totalSemana, 0)
      if (diasRestantes > 0) frases.push({ txt: `Faltan ${fmtEur(falta, { decimals: 0 })} en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} para llegar al objetivo.`, color: pctSemana >= 50 ? NARANJA : ROJO_OBJ })
    }
    return frases
  }, [objSemana, pctSemana, totalSemana, pedidosSemana, tmSemana, deltaPedidos, labelComp, barras])

  const compararTabs: { id: Comparar; label: string }[] = [
    { id: 'semana', label: 'vs sem. ant.' },
    { id: 'mes', label: 'vs mes ant.' },
    { id: 'anio', label: 'vs año ant.' },
  ]

  const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  const BAR_AREA = 200

  return (
    <div style={{ background: COLOR.bgPagina, color: COLOR.textPri, fontFamily: LEXEND, padding: '20px 0', borderRadius: 12, marginTop: 18 }}>

      {/* ── TITULAR DINÁMICO + SUBTABS DERECHA ── */}
      <div style={{ ...cardBig, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={lbl}>EVOLUCIÓN · SEMANA EN CURSO</div>
          <div style={{ display: 'inline-flex', gap: 6 }}>
            {compararTabs.map(t => (
              <button key={t.id} onClick={() => setCompararPersist(t.id)} style={comparar === t.id ? SUBTABS.active : SUBTABS.inactive}>{t.label}</button>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: OSWALD, fontSize: 'clamp(26px,4vw,40px)', fontWeight: 600, lineHeight: 1.05, color: COLOR.textPri, marginTop: 2 }}>
          {deltaVentas == null ? 'SEMANA EN MARCHA' : 'EL NEGOCIO VA'}{' '}
          {deltaVentas != null && (
            <span style={{ color: colDelta(deltaVentas), background: `${colDelta(deltaVentas)}22`, padding: '0 8px', borderRadius: 6 }}>
              {deltaVentas >= 0 ? '+' : ''}{deltaVentas.toFixed(1)}%
            </span>
          )}{' '}
          {deltaVentas != null && <span>VS {labelComp.toUpperCase()}.</span>}
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {titular.map((f, i) => (
            <div key={i} style={{ fontFamily: LEXEND, fontSize: 14, color: f.color, fontWeight: 500 }}>{f.txt}</div>
          ))}
        </div>
      </div>

      {/* ── CARD GRANDE SEMANAL: barras verticales con objetivo (ancho completo = 2 cards) ── */}
      <div style={{ ...cardBig, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <div style={lbl}>FACTURACIÓN SEMANA · {ddmm(lunes)} — {ddmm(domingo)}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: OSWALD, fontSize: 34, fontWeight: 600, color: pctSemana >= 100 ? VERDE : pctSemana >= 50 ? NARANJA : ROJO_OBJ }}>{fmtEur(totalSemana, { decimals: 2 })}</span>
            {objSemana > 0 && <span style={{ fontFamily: LEXEND, fontSize: 13, color: COLOR.textMut }}>objetivo {fmtEur(objSemana, { decimals: 0 })}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: BAR_AREA + 44 }}>
          {barras.map((b, i) => {
            const hObj = b.obj > 0 ? Math.max((b.obj / escala) * BAR_AREA, 4) : 0
            const hReal = b.real != null ? Math.max((b.real / escala) * BAR_AREA, b.real > 0 ? 3 : 0) : 0
            const relleno = Math.min(hReal, hObj)
            const sobre = Math.max(hReal - hObj, 0)
            const pct = b.obj > 0 && b.real != null ? (b.real / b.obj) * 100 : 0
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                {/* importe del día */}
                <span style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, color: b.futuro ? COLOR.textMut : b.real != null ? (pct >= 100 ? VERDE : COLOR.textPri) : COLOR.textMut, marginBottom: 2 }}>
                  {b.real != null ? fmtEur(b.real, { decimals: 0 }) : '—'}
                </span>
                {/* delta vs comparado */}
                {b.deltaPct != null && (
                  <span style={{ fontSize: 9, color: colDelta(b.deltaPct), fontFamily: LEXEND, marginBottom: 3 }}>
                    {b.deltaPct >= 0 ? '▲' : '▼'}{Math.abs(b.deltaPct).toFixed(0)}%
                  </span>
                )}
                {/* sobrebarra (objetivo superado) */}
                {sobre > 0 && (
                  <div style={{ width: '58%', height: sobre, background: VERDE, borderRadius: '4px 4px 0 0', opacity: 0.9, position: 'relative' }}>
                    <span style={{ position: 'absolute', top: -2, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: VERDE }}>⋯</span>
                  </div>
                )}
                {/* barra objetivo (roja) con relleno */}
                <div style={{ width: '58%', height: hObj, background: b.futuro ? GRIS : ROJO_OBJ, borderRadius: sobre > 0 ? 0 : '4px 4px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', opacity: b.futuro ? 0.4 : 1, overflow: 'hidden' }}>
                  {!b.futuro && relleno > 0 && (
                    <div style={{ width: '100%', height: relleno, background: colorRelleno(pct) }} />
                  )}
                </div>
                {/* día */}
                <span style={{ fontFamily: LEXEND, fontSize: 12, color: b.esHoy ? COLOR.textPri : COLOR.textMut, fontWeight: b.esHoy ? 700 : 400, marginTop: 6 }}>{b.nombre}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── FILA: Facturación por canal + Pedidos/TM (cards reales del Resumen) ── */}
      <div style={{ ...row3, gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <ColFacturacionCanal canales={canalStats} />
        <CardPedidosTM
          pedidos={pedidosSemana}
          tmBruto={tmSemana}
          tmNeto={tmNetoSemana}
          pedidosDeltaPct={deltaPedidos}
          tmDeltaPct={deltaTM}
          canales={canalStats}
        />
      </div>
    </div>
  )
}
