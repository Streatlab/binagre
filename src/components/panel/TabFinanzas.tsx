/**
 * TabFinanzas — Panel Global · pestaña Finanzas
 * CANTERA ALEGRE v1.0 (área Finanzas · verde). Solo capa visual; datos/lógica intactos.
 */

import { useMemo } from 'react'
import { INK, GRIS, OSW, LEX, VERDE, ROJO, ROJO_S, NAR, AMA, CORP, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
import { fmtEur } from '@/utils/format'
import { resolverNeto } from '@/lib/panel/netoResolver'
import { useNetoContext } from '@/lib/panel/useNetoContext'
import { toLocalDateStr } from '@/lib/dateRange'

interface Row {
  fecha: string
  uber_bruto: number; uber_pedidos: number
  glovo_bruto: number; glovo_pedidos: number
  je_bruto: number; je_pedidos: number
  web_bruto: number; web_pedidos: number
  directa_bruto: number; directa_pedidos: number
  total_bruto: number; total_pedidos: number
}

interface Props { rows: Row[]; rowsAll?: Row[]; fechaDesde: Date; fechaHasta: Date }

const CANALES = [
  { id: 'uber',  label: 'Uber Eats', color: CORP.uber,  bk: 'uber_bruto',    pk: 'uber_pedidos' },
  { id: 'glovo', label: 'Glovo',     color: CORP.glovo, bk: 'glovo_bruto',   pk: 'glovo_pedidos' },
  { id: 'je',    label: 'Just Eat',  color: CORP.je,    bk: 'je_bruto',      pk: 'je_pedidos' },
  { id: 'web',   label: 'Web',       color: CORP.web,   bk: 'web_bruto',     pk: 'web_pedidos' },
  { id: 'dir',   label: 'Directa',   color: CORP.dir,   bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Número → texto Excel español (coma decimal, sin separador de miles).
const numES = (n: number) => (Number(n) || 0).toFixed(2).replace('.', ',')

// Exporta la facturación diaria del periodo a CSV (delimitador ; para Excel es).
function exportarCSV(rows: Row[], fechaDesde: Date, fechaHasta: Date) {
  const cab = ['Fecha']
  for (const c of CANALES) { cab.push(`${c.label} bruto`, `${c.label} pedidos`) }
  cab.push('Total bruto', 'Total pedidos')
  const lineas = [cab.join(';')]
  for (const r of [...rows].sort((a, b) => (a.fecha < b.fecha ? -1 : 1))) {
    const celdas = [r.fecha]
    for (const c of CANALES) {
      celdas.push(numES(r[c.bk] as number), String((r[c.pk] as number) ?? 0))
    }
    celdas.push(numES(r.total_bruto), String(r.total_pedidos ?? 0))
    lineas.push(celdas.join(';'))
  }
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const csv = '﻿' + lineas.join('\r\n')  // BOM para acentos en Excel
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `facturacion_${iso(fechaDesde)}_${iso(fechaHasta)}.csv`
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

export default function TabFinanzas({ rows, rowsAll, fechaDesde, fechaHasta }: Props) {
  const { configCanales: config, marcasPorCanal, ventasListas } = useNetoContext()

  const totalBruto = useMemo(() => rows.reduce((s, r) => s + r.total_bruto, 0), [rows])

  // Comisiones y neto por canal (LEY-NETO-01: resolverNeto es la única fuente)
  const canalStats = useMemo(() => {
    const nDias = new Set(rows.filter(r => r.total_bruto > 0).map(r => r.fecha)).size || 1
    return CANALES.map(c => {
      const bruto = rows.reduce((s, r) => s + (r[c.bk] as number), 0)
      const pedidos = rows.reduce((s, r) => s + (r[c.pk] as number), 0)
      const { neto } = resolverNeto(c.id, bruto, pedidos, {
        modo: 'agregado_canal', marcasPorCanal, fechaDesde, fechaHasta,
        configCanales: config, diasConDatos: nDias,
      })
      const comision = bruto - neto
      const pct = totalBruto > 0 ? (bruto / totalBruto) * 100 : 0
      return { ...c, bruto, comision, neto, pct }
    })
  }, [rows, config, marcasPorCanal, fechaDesde, fechaHasta, totalBruto, ventasListas])

  const totalComision = canalStats.reduce((s, c) => s + c.comision, 0)
  const totalNeto     = totalBruto - totalComision
  const margenPct     = totalBruto > 0 ? (totalNeto / totalBruto) * 100 : 0

  // Periodo anterior de la misma duración → deltas de tendencia en las KPI.
  const prev = useMemo(() => {
    if (!rowsAll || !rowsAll.length) return null
    const unDia = 86400000
    const largoMs = fechaHasta.getTime() - fechaDesde.getTime()
    const prevHasta = new Date(fechaDesde.getTime() - unDia)
    const prevDesde = new Date(prevHasta.getTime() - largoMs)
    const a = toLocalDateStr(prevDesde), b = toLocalDateStr(prevHasta)
    const rs = rowsAll.filter(r => r.fecha >= a && r.fecha <= b)
    if (!rs.length) return null
    const bruto = rs.reduce((s, r) => s + r.total_bruto, 0)
    const nD = new Set(rs.filter(r => r.total_bruto > 0).map(r => r.fecha)).size || 1
    let neto = 0
    for (const c of CANALES) {
      const bk = rs.reduce((s, r) => s + (r[c.bk] as number), 0)
      const pk = rs.reduce((s, r) => s + (r[c.pk] as number), 0)
      neto += resolverNeto(c.id, bk, pk, {
        modo: 'agregado_canal', marcasPorCanal, fechaDesde: prevDesde, fechaHasta: prevHasta,
        configCanales: config, diasConDatos: nD,
      }).neto
    }
    return { bruto, neto }
  }, [rowsAll, fechaDesde, fechaHasta, config, marcasPorCanal, ventasListas])

  const deltaPct = (actual: number, previo: number): number | null =>
    previo > 0 ? ((actual - previo) / previo) * 100 : null
  const deltaBruto = prev ? deltaPct(totalBruto, prev.bruto) : null
  const deltaNeto  = prev ? deltaPct(totalNeto, prev.neto) : null

  // Coste de las plataformas: cuánto se llevan Uber/Glovo/JE (comisión real vía
  // resolverNeto) y a qué ritmo anual, para dimensionar la dependencia.
  const plat = useMemo(() => {
    const platIds = new Set(['uber', 'glovo', 'je'])
    const plataformas = canalStats.filter(c => platIds.has(c.id) && c.bruto > 0)
    const brutoPlat = plataformas.reduce((s, c) => s + c.bruto, 0)
    const comPlat = plataformas.reduce((s, c) => s + c.comision, 0)
    const pctPlat = brutoPlat > 0 ? (comPlat / brutoPlat) * 100 : 0
    const nDiasDatos = new Set(rows.filter(r => r.total_bruto > 0).map(r => r.fecha)).size || 1
    const comAnual = (comPlat / nDiasDatos) * 365
    const comMax = plataformas.reduce((m, c) => Math.max(m, c.comision), 0) || 1
    return { plataformas, brutoPlat, comPlat, pctPlat, comAnual, comMax, nDiasDatos }
  }, [canalStats, rows])

  // Evolución mensual (neto por canal y mes vía resolverNeto)
  const { meses, mesMap } = useMemo(() => {
    const rowsPorMes: Record<string, Row[]> = {}
    rows.forEach(r => { (rowsPorMes[r.fecha.slice(0, 7)] ??= []).push(r) })
    const keys = Object.keys(rowsPorMes).sort()
    const map: Record<string, { bruto: number; neto: number }> = {}
    for (const k of keys) {
      const rs = rowsPorMes[k]
      const [y, m] = k.split('-').map(Number)
      const mDesde = new Date(y, m - 1, 1)
      const mHasta = new Date(y, m, 0)
      const nD = new Set(rs.filter(r => r.total_bruto > 0).map(r => r.fecha)).size || 1
      let bruto = 0, neto = 0
      for (const c of CANALES) {
        const b = rs.reduce((s, r) => s + (r[c.bk] as number), 0)
        const p = rs.reduce((s, r) => s + (r[c.pk] as number), 0)
        bruto += b
        neto += resolverNeto(c.id, b, p, {
          modo: 'agregado_canal', marcasPorCanal, fechaDesde: mDesde, fechaHasta: mHasta,
          configCanales: config, diasConDatos: nD,
        }).neto
      }
      map[k] = { bruto, neto }
    }
    return { meses: keys, mesMap: map }
  }, [rows, config, marcasPorCanal, ventasListas])

  const mostrarEvolucion = meses.length > 1

  if (!rows.length) {
    return (
      <PantallaCantera embedded>
        <Papel ceja={VERDE}><div style={{ color: GRIS, fontFamily: LEX }}>Sin datos para el período seleccionado.</div></Papel>
      </PantallaCantera>
    )
  }

  // Resumen inteligente del periodo (canal líder, mejor margen, coste plataformas)
  const conVentas = canalStats.filter(c => c.bruto > 0)
  const topBruto = conVentas.length ? conVentas.reduce((a, c) => (c.bruto > a.bruto ? c : a)) : null
  const bestMargen = conVentas.length ? conVentas.reduce((a, c) => ((c.neto / c.bruto) > (a.neto / a.bruto) ? c : a)) : null
  const margenBest = bestMargen ? (bestMargen.neto / bestMargen.bruto) * 100 : 0

  const titular = topBruto
    ? <>Ingresos netos estimados de <b>{fmtEur(totalNeto)}</b>, margen <b>{margenPct.toFixed(1)}%</b> sobre {fmtEur(totalBruto)} bruto.</>
    : 'Finanzas del periodo.'

  const atencion = [
    topBruto ? `${topBruto.label} lidera con ${fmtEur(topBruto.bruto)} (${topBruto.pct.toFixed(0)}%)` : null,
    bestMargen ? `Mejor margen: ${bestMargen.label} (${margenBest.toFixed(0)}%)` : null,
    plat.brutoPlat > 0 ? `Plataformas se llevaron ${fmtEur(plat.comPlat)} (${plat.pctPlat.toFixed(0)}%)` : null,
  ].filter(Boolean) as string[]

  return (
    <PantallaCantera embedded>
      {/* 1 · Héroe del área Finanzas (verde) */}
      <HeroCantera
        area="facturacion"
        titular={titular}
        etiquetaDato="Ingresos brutos del periodo"
        cifra={fmtEur(totalBruto)}
        variacionPct={deltaBruto}
        atencion={atencion}
      />

      {/* Barra de acciones */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => exportarCSV(rows, fechaDesde, fechaHasta)}
          title="Descarga la facturación diaria del periodo en CSV (Excel español) para la gestoría"
          style={{ fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: INK, background: AMA, border: `3px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, padding: '8px 14px', cursor: 'pointer' }}
        >
          ↓ Exportar CSV
        </button>
      </div>

      {/* 2 · Plancha KPIs */}
      <Plancha>
        <PlanchaCelda bg={VERDE} color={BLANCO} first>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Ingresos brutos</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(totalBruto)}</div>
          {prev && <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>vs periodo anterior</div>}
        </PlanchaCelda>
        <PlanchaCelda bg={ROJO} color={BLANCO}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Comisiones est.</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(totalComision)}</div>
          {totalBruto > 0 && <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{(totalComision / totalBruto * 100).toFixed(1)}% del bruto</div>}
        </PlanchaCelda>
        <PlanchaCelda bg={AMA} color={INK}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Ingresos netos est.</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(totalNeto)}</div>
          {prev && <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>vs periodo anterior</div>}
        </PlanchaCelda>
        <PlanchaCelda bg={NAR} color={BLANCO}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Margen est.</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{margenPct.toFixed(1)}%</div>
          <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>neto / bruto</div>
        </PlanchaCelda>
      </Plancha>

      {/* 3 · Frase potente (coste · granate, distinta del héroe verde) */}
      {plat.brutoPlat > 0 && (
        <FrasePotente significado="coste">Las plataformas se llevaron {fmtEur(plat.comPlat)} este periodo — a este ritmo, {fmtEur(plat.comAnual)}/año.</FrasePotente>
      )}

      {/* Desglose por canal */}
      <div>
        <SeccionLabel bg={VERDE}>Desglose por canal</SeccionLabel>
        <Papel ceja={VERDE} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
            <thead>
              <tr style={{ background: INK }}>
                {['Canal', 'Bruto', 'Comisión est.', 'Neto est.', '% total'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : 'right', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff8e7', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {canalStats.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: `2px solid ${INK}`, background: i % 2 ? '#00000006' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, background: c.color, border: `1px solid ${INK}`, display: 'inline-block' }} />
                    {c.label}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmtEur(c.bruto)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: ROJO }}>{fmtEur(c.comision)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: VERDE }}>{fmtEur(c.neto)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{c.pct.toFixed(1)}%</td>
                </tr>
              ))}
              <tr style={{ background: INK }}>
                <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 700, color: '#fff8e7' }}>TOTAL</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: '#fff8e7' }}>{fmtEur(totalBruto)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: ROJO_S }}>{fmtEur(totalComision)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: VERDE }}>{fmtEur(totalNeto)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: '#fff8e7' }}>100%</td>
              </tr>
            </tbody>
          </table>
        </Papel>
      </div>

      {/* Coste de las plataformas — cuánto se llevan Uber/Glovo/JE */}
      {plat.brutoPlat > 0 && (
        <div>
          <SeccionLabel bg={ROJO}>Coste de las plataformas</SeccionLabel>
          <Papel ceja={ROJO}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px', minWidth: 220 }}>
                <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Se han llevado las plataformas</div>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 40, color: ROJO, marginTop: 6 }}>{fmtEur(plat.comPlat)}</div>
                <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, marginTop: 4 }}>
                  {plat.pctPlat.toFixed(1)}% del bruto de plataforma ({fmtEur(plat.brutoPlat)})
                </div>
                <div style={{ marginTop: 12, display: 'inline-block', background: INK, color: '#fff8e7', fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '6px 10px' }}>
                  A este ritmo · {fmtEur(plat.comAnual)}/año est.
                </div>
                <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 8, maxWidth: 320 }}>
                  Es lo que recuperarías moviendo esos pedidos a tu canal directo.
                </div>
              </div>
              <div style={{ flex: '2 1 320px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                {plat.plataformas.map(c => {
                  const w = (c.comision / plat.comMax) * 100
                  const pctCanal = c.bruto > 0 ? (c.comision / c.bruto) * 100 : 0
                  return (
                    <div key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: INK, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 9, height: 9, background: c.color, border: `1px solid ${INK}`, display: 'inline-block' }} />{c.label}
                        </span>
                        <span style={{ fontFamily: LEX, fontSize: 13, color: ROJO, fontWeight: 600 }}>
                          {fmtEur(c.comision)} <span style={{ color: GRIS, fontWeight: 400 }}>({pctCanal.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div style={{ height: 14, background: BLANCO, border: `2px solid ${INK}` }}>
                        <div style={{ width: `${w}%`, height: '100%', background: c.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Papel>
        </div>
      )}

      {/* Evolución mensual — solo si hay más de 1 mes */}
      {mostrarEvolucion && (
        <div>
          <SeccionLabel bg={AMA} color={INK}>Evolución mensual</SeccionLabel>
          <Papel ceja={AMA} pad="0" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
              <thead>
                <tr style={{ background: INK }}>
                  {['Mes', 'Bruto', 'Neto est.', 'Margen est.'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : 'right', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#fff8e7', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const mejorMes = meses.reduce((best, k) => (mesMap[k].neto > mesMap[best].neto ? k : best), meses[0])
                  return meses.map((key, i) => {
                    const { bruto, neto } = mesMap[key]
                    const margen = bruto > 0 ? (neto / bruto) * 100 : 0
                    const [y, m] = key.split('-')
                    const label = `${MESES_ES[parseInt(m, 10) - 1]} ${y}`
                    const esMejor = key === mejorMes && meses.length > 1
                    return (
                      <tr key={key} style={{ borderBottom: `2px solid ${INK}`, background: esMejor ? `${VERDE}22` : (i % 2 ? `${INK}0d` : 'transparent') }}>
                        <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600 }}>{label}{esMejor && <span style={{ fontFamily: OSW, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: VERDE, marginLeft: 8 }}>★ MEJOR</span>}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmtEur(bruto)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: VERDE }}>{fmtEur(neto)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: margen >= 70 ? VERDE : NAR }}>{margen.toFixed(1)}%</td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </Papel>
        </div>
      )}
    </PantallaCantera>
  )
}
