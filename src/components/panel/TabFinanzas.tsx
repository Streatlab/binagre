/**
 * TabFinanzas — Panel Global · pestaña Finanzas (estilo neobrutal Food-Pop)
 */

import { useMemo } from 'react'
import { INK, CREMA, OSW, LEX, VERDE, ROJO, NAR, GRIS, CORP, BORDER_CARD, SHADOW, d, eyebrow } from '@/styles/neobrutal'
import { tablaNeo, theadNeo, thNeo, thNeoR, tdNeo, tdNeoR, filaAlt, dotNeo, totalRow, tdTotal, tdTotalR, vacioNeo } from '@/styles/tablaNeo'
import { fmtEur } from '@/utils/format'
import { resolverNeto } from '@/lib/panel/netoResolver'
import { useNetoContext } from '@/lib/panel/useNetoContext'

interface Row {
  fecha: string
  uber_bruto: number; uber_pedidos: number
  glovo_bruto: number; glovo_pedidos: number
  je_bruto: number; je_pedidos: number
  web_bruto: number; web_pedidos: number
  directa_bruto: number; directa_pedidos: number
  total_bruto: number; total_pedidos: number
}

interface Props { rows: Row[]; fechaDesde: Date; fechaHasta: Date }

const CANALES = [
  { id: 'uber',  label: 'Uber Eats', color: CORP.uber,  bk: 'uber_bruto',    pk: 'uber_pedidos' },
  { id: 'glovo', label: 'Glovo',     color: CORP.glovo, bk: 'glovo_bruto',   pk: 'glovo_pedidos' },
  { id: 'je',    label: 'Just Eat',  color: CORP.je,    bk: 'je_bruto',      pk: 'je_pedidos' },
  { id: 'web',   label: 'Web',       color: CORP.web,   bk: 'web_bruto',     pk: 'web_pedidos' },
  { id: 'dir',   label: 'Directa',   color: CORP.dir,   bk: 'directa_bruto', pk: 'directa_pedidos' },
] as const

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function kpiCard(label: string, value: string, sub?: string) {
  return (
    <div style={{ flex: 1, minWidth: 160, background: CREMA, border: BORDER_CARD, boxShadow: SHADOW, padding: '14px 16px' }}>
      <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>{label}</div>
      <div style={{ ...d('30px'), marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const tituloSec: React.CSSProperties = { marginBottom: 12 }

export default function TabFinanzas({ rows, fechaDesde, fechaHasta }: Props) {
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
    return <div style={{ ...vacioNeo, marginTop: 12 }}>Sin datos para el período seleccionado</div>
  }

  return (
    <div style={{ paddingTop: 12 }}>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
        {kpiCard('Ingresos brutos', fmtEur(totalBruto))}
        {kpiCard('Comisiones est.', fmtEur(totalComision), totalBruto > 0 ? `${(totalComision / totalBruto * 100).toFixed(1)}% del bruto` : undefined)}
        {kpiCard('Ingresos netos est.', fmtEur(totalNeto))}
        {kpiCard('Margen est.', `${margenPct.toFixed(1)}%`, 'neto / bruto')}
      </div>

      {/* Desglose por canal */}
      <div style={{ marginBottom: 28 }}>
        <div style={tituloSec}><span style={eyebrow(CREMA)}>Desglose por canal</span></div>
        <table style={tablaNeo}>
          <thead style={theadNeo}>
            <tr>
              <th style={thNeo}>Canal</th>
              <th style={thNeoR}>Bruto</th>
              <th style={thNeoR}>Comisión est.</th>
              <th style={thNeoR}>Neto est.</th>
              <th style={thNeoR}>% total</th>
            </tr>
          </thead>
          <tbody>
            {canalStats.map((c, i) => (
              <tr key={c.id} style={filaAlt(i)}>
                <td style={tdNeo}>
                  <span style={dotNeo(c.color)} />
                  {c.label}
                </td>
                <td style={tdNeoR}>{fmtEur(c.bruto)}</td>
                <td style={{ ...tdNeoR, color: ROJO }}>{fmtEur(c.comision)}</td>
                <td style={{ ...tdNeoR, color: VERDE }}>{fmtEur(c.neto)}</td>
                <td style={tdNeoR}>{c.pct.toFixed(1)}%</td>
              </tr>
            ))}
            {/* Totales */}
            <tr style={totalRow}>
              <td style={tdTotal}>TOTAL</td>
              <td style={tdTotalR}>{fmtEur(totalBruto)}</td>
              <td style={{ ...tdTotalR, color: ROJO }}>{fmtEur(totalComision)}</td>
              <td style={{ ...tdTotalR, color: VERDE }}>{fmtEur(totalNeto)}</td>
              <td style={tdTotalR}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Coste de las plataformas — cuánto se llevan Uber/Glovo/JE */}
      {plat.brutoPlat > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={tituloSec}><span style={eyebrow(CREMA)}>Coste de las plataformas</span></div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', background: CREMA, border: BORDER_CARD, boxShadow: SHADOW, padding: '18px 20px' }}>
            {/* Bloque cifra */}
            <div style={{ flex: '1 1 220px', minWidth: 220 }}>
              <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS }}>Se han llevado las plataformas</div>
              <div style={{ ...d('40px'), color: ROJO, marginTop: 6 }}>{fmtEur(plat.comPlat)}</div>
              <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS, marginTop: 4 }}>
                {plat.pctPlat.toFixed(1)}% del bruto de plataforma ({fmtEur(plat.brutoPlat)})
              </div>
              <div style={{ marginTop: 12, display: 'inline-block', background: INK, color: CREMA, fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '6px 10px' }}>
                A este ritmo · {fmtEur(plat.comAnual)}/año est.
              </div>
              <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 8, maxWidth: 320 }}>
                Es lo que recuperarías moviendo esos pedidos a tu canal directo.
              </div>
            </div>
            {/* Barras por plataforma */}
            <div style={{ flex: '2 1 320px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
              {plat.plataformas.map(c => {
                const w = (c.comision / plat.comMax) * 100
                const pctCanal = c.bruto > 0 ? (c.comision / c.bruto) * 100 : 0
                return (
                  <div key={c.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: INK }}>
                        <span style={dotNeo(c.color)} />{c.label}
                      </span>
                      <span style={{ fontFamily: LEX, fontSize: 13, color: ROJO, fontWeight: 600 }}>
                        {fmtEur(c.comision)} <span style={{ color: GRIS, fontWeight: 400 }}>({pctCanal.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div style={{ height: 14, background: '#ffffff', border: `2px solid ${INK}` }}>
                      <div style={{ width: `${w}%`, height: '100%', background: c.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Evolución mensual — solo si hay más de 1 mes */}
      {mostrarEvolucion && (
        <div>
          <div style={tituloSec}><span style={eyebrow(CREMA)}>Evolución mensual</span></div>
          <table style={tablaNeo}>
            <thead style={theadNeo}>
              <tr>
                <th style={thNeo}>Mes</th>
                <th style={thNeoR}>Bruto</th>
                <th style={thNeoR}>Neto est.</th>
                <th style={thNeoR}>Margen est.</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((key, i) => {
                const { bruto, neto } = mesMap[key]
                const margen = bruto > 0 ? (neto / bruto) * 100 : 0
                const [y, m] = key.split('-')
                const label = `${MESES_ES[parseInt(m, 10) - 1]} ${y}`
                return (
                  <tr key={key} style={filaAlt(i)}>
                    <td style={tdNeo}>{label}</td>
                    <td style={tdNeoR}>{fmtEur(bruto)}</td>
                    <td style={{ ...tdNeoR, color: VERDE }}>{fmtEur(neto)}</td>
                    <td style={{ ...tdNeoR, color: margen >= 70 ? VERDE : NAR }}>{margen.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
