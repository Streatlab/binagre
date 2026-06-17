import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, pageTitleStyle, FONT } from '@/styles/tokens'
import { fmtEur, fmtPct } from '@/utils/format'
import { calcNetoPorCanal, loadConfigCanales } from '@/lib/panel/calcNetoPlataforma'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

interface GrupoGasto {
  grupo: string
  total: number
}

interface GastoFijo {
  id: number
  concepto: string
  importe: number
  periodicidad: string
  categoria: string | null
}

function monthLabel(year: number, month: number) {
  return `${MESES[month - 1]} ${year}`
}

function toMonthly(importe: number, periodicidad: string): number {
  if (periodicidad === 'anual') return importe / 12
  if (periodicidad === 'trimestral') return importe / 3
  return importe
}

export default function PyG() {
  const { T } = useTheme()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(false)

  const [ingresosBrutos, setIngresosBrutos] = useState(0)
  const [ingresosNetos, setIngresosNetos] = useState(0)
  const [gruposGasto, setGruposGasto] = useState<GrupoGasto[]>([])
  const [totalGastos, setTotalGastos] = useState(0)
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([])
  const [totalFijos, setTotalFijos] = useState(0)

  useEffect(() => { loadData() }, [year, month])

  async function loadData() {
    setLoading(true)
    const fechaIni = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const fechaFin = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    // Pre-cargar config de canales para que calcNetoPorCanal pueda usarla en modo síncrono
    await loadConfigCanales()

    const [facturacionRes, gastosRes, fijosRes] = await Promise.all([
      supabase
        .from('facturacion_diario')
        .select('uber_bruto,glovo_bruto,je_bruto,web_bruto,directa_bruto')
        .gte('fecha', fechaIni)
        .lte('fecha', fechaFin),
      supabase
        .from('gastos')
        .select('grupo,importe')
        .gte('fecha', fechaIni)
        .lte('fecha', fechaFin),
      supabase
        .from('gastos_fijos')
        .select('id,concepto,importe,periodicidad,categoria')
        .eq('activo', true),
    ])

    // Ingresos
    let brutos = 0, netos = 0
    if (facturacionRes.data) {
      let bUber = 0, bGlovo = 0, bJe = 0, bWeb = 0, bDir = 0
      for (const row of facturacionRes.data) {
        bUber  += Number(row.uber_bruto ?? 0)
        bGlovo += Number(row.glovo_bruto ?? 0)
        bJe    += Number(row.je_bruto ?? 0)
        bWeb   += Number(row.web_bruto ?? 0)
        bDir   += Number(row.directa_bruto ?? 0)
      }
      brutos = bUber + bGlovo + bJe + bWeb + bDir
      // REAL MANDA: agregado de canal con periodo del mes → usa liquidación real
      // si existe; si no, estimado central (config_canales).
      const dDesde = new Date(`${fechaIni}T00:00:00`)
      const dHasta = new Date(`${fechaFin}T00:00:00`)
      const opt = { modo: 'agregado_canal' as const, fechaDesde: dDesde, fechaHasta: dHasta }
      netos =
        calcNetoPorCanal('uber',  bUber,  0, opt).neto +
        calcNetoPorCanal('glovo', bGlovo, 0, opt).neto +
        calcNetoPorCanal('je',    bJe,    0, opt).neto +
        calcNetoPorCanal('web',   bWeb,   0, opt).neto +
        calcNetoPorCanal('dir',   bDir,   0, opt).neto
    }
    setIngresosBrutos(brutos)
    setIngresosNetos(netos)

    // Gastos variables agrupados por grupo
    const mapa: Record<string, number> = {}
    let totalG = 0
    if (gastosRes.data) {
      for (const row of gastosRes.data) {
        const g = row.grupo ?? 'Sin categoría'
        const imp = Math.abs(Number(row.importe ?? 0))
        mapa[g] = (mapa[g] ?? 0) + imp
        totalG += imp
      }
    }
    setGruposGasto(
      Object.entries(mapa)
        .map(([grupo, total]) => ({ grupo, total }))
        .sort((a, b) => b.total - a.total)
    )
    setTotalGastos(totalG)

    // Gastos fijos activos
    const fijos: GastoFijo[] = (fijosRes.data ?? []).map(r => ({
      id: r.id,
      concepto: r.concepto,
      importe: Number(r.importe ?? 0),
      periodicidad: r.periodicidad ?? 'mensual',
      categoria: r.categoria,
    }))
    setGastosFijos(fijos)
    setTotalFijos(fijos.reduce((s, f) => s + toMonthly(f.importe, f.periodicidad), 0))
    setLoading(false)
  }

  const totalGastosAll = totalGastos + totalFijos
  const resultado = ingresosNetos - totalGastosAll
  const margen = ingresosNetos > 0 ? resultado / ingresosNetos : 0
  const ebitda = ingresosNetos - totalGastos
  const resColor = resultado >= 0 ? '#e8f442' : '#B01D23'

  const years = [now.getFullYear() - 1, now.getFullYear()]

  const sel: React.CSSProperties = {
    background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6,
    color: '#ffffff', padding: '6px 10px', fontFamily: FONT.body, fontSize: 13, cursor: 'pointer',
  }
  const card: React.CSSProperties = {
    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '18px 20px',
  }
  const kpiCard: React.CSSProperties = {
    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '16px 20px',
  }
  const kpiLbl: React.CSSProperties = {
    fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: '2px',
    textTransform: 'uppercase', color: '#777777', marginBottom: 6,
  }
  const kpiVal: React.CSSProperties = {
    fontFamily: 'Oswald,sans-serif', fontSize: '1.9rem', fontWeight: 600, lineHeight: 1, color: '#ffffff',
  }
  const secTitle: React.CSSProperties = {
    fontFamily: 'Oswald,sans-serif', fontSize: 13, letterSpacing: '2px',
    textTransform: 'uppercase', color: '#cccccc', marginBottom: 12, marginTop: 0,
  }
  const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
  const th: React.CSSProperties = {
    fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: '1.5px',
    textTransform: 'uppercase', color: '#777777', padding: '8px 12px',
    textAlign: 'left', borderBottom: '1px solid #2a2a2a', background: '#0a0a0a',
  }
  const thR: React.CSSProperties = { ...th, textAlign: 'right' }
  const td: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #1e1e1e', color: '#cccccc' }
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
  const empty: React.CSSProperties = { color: '#777777', fontSize: 13, padding: '12px 0' }

  return (
    <div style={{ padding: 28, fontFamily: FONT.body, background: '#111111', minHeight: '100vh' }}>
      <h1 style={pageTitleStyle(T)}>Cuenta de Resultados</h1>

      {/* Selector */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 24 }}>
        <select style={sel} value={month} onChange={e => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{MESES[m - 1]}</option>
          ))}
        </select>
        <select style={sel} value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ color: '#777777', fontSize: 13 }}>
          {loading ? 'Cargando...' : monthLabel(year, month)}
        </span>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 24 }}>
        <div style={kpiCard}>
          <div style={kpiLbl}>Ingresos brutos</div>
          <div style={kpiVal}>{fmtEur(ingresosBrutos)}</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLbl}>Ingresos netos</div>
          <div style={{ ...kpiVal, color: '#e8f442' }}>{fmtEur(ingresosNetos)}</div>
          <div style={{ fontSize: 11, color: '#777777', marginTop: 4 }}>Tras comisiones</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLbl}>Total gastos</div>
          <div style={{ ...kpiVal, color: '#B01D23' }}>{fmtEur(totalGastosAll)}</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLbl}>Resultado neto</div>
          <div style={{ ...kpiVal, color: resColor }}>{fmtEur(resultado)}</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLbl}>Margen neto</div>
          <div style={{ ...kpiVal, color: resColor }}>{fmtPct(margen)}</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLbl}>EBITDA estimado</div>
          <div style={{ ...kpiVal, color: ebitda >= 0 ? '#e8f442' : '#B01D23' }}>{fmtEur(ebitda)}</div>
          <div style={{ fontSize: 11, color: '#777777', marginTop: 4 }}>Sin gastos fijos</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Gastos variables */}
        <div style={card}>
          <h3 style={secTitle}>Gastos variables por categoría</h3>
          {gruposGasto.length === 0 && !loading
            ? <div style={empty}>Sin gastos registrados para este periodo</div>
            : (
              <table style={tbl}>
                <thead>
                  <tr>
                    <th style={th}>Categoría</th>
                    <th style={thR}>Importe</th>
                    <th style={thR}>% ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposGasto.map((g, i) => (
                    <tr key={g.grupo} style={{ background: i % 2 === 0 ? 'transparent' : '#141414' }}>
                      <td style={td}>{g.grupo}</td>
                      <td style={tdR}>{fmtEur(g.total)}</td>
                      <td style={tdR}>{ingresosNetos > 0 ? fmtPct(g.total / ingresosNetos) : '—'}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#0a0a0a' }}>
                    <td style={{ ...td, fontWeight: 600, color: '#ffffff' }}>TOTAL VARIABLES</td>
                    <td style={{ ...tdR, fontWeight: 600, color: '#B01D23' }}>{fmtEur(totalGastos)}</td>
                    <td style={{ ...tdR, color: '#777777' }}>{ingresosNetos > 0 ? fmtPct(totalGastos / ingresosNetos) : '—'}</td>
                  </tr>
                </tbody>
              </table>
            )
          }
        </div>

        {/* Gastos fijos */}
        <div style={card}>
          <h3 style={secTitle}>Gastos fijos activos</h3>
          {gastosFijos.length === 0 && !loading
            ? <div style={empty}>Sin gastos fijos configurados</div>
            : (
              <table style={tbl}>
                <thead>
                  <tr>
                    <th style={th}>Concepto</th>
                    <th style={th}>Periodicidad</th>
                    <th style={thR}>Imp./mes</th>
                  </tr>
                </thead>
                <tbody>
                  {gastosFijos.map((f, i) => (
                    <tr key={f.id} style={{ background: i % 2 === 0 ? 'transparent' : '#141414' }}>
                      <td style={td}>{f.concepto}</td>
                      <td style={{ ...td, color: '#777777', fontSize: 11 }}>{f.periodicidad}</td>
                      <td style={tdR}>{fmtEur(toMonthly(f.importe, f.periodicidad))}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#0a0a0a' }}>
                    <td colSpan={2} style={{ ...td, fontWeight: 600, color: '#ffffff' }}>TOTAL FIJOS / MES</td>
                    <td style={{ ...tdR, fontWeight: 600, color: '#B01D23' }}>{fmtEur(totalFijos)}</td>
                  </tr>
                </tbody>
              </table>
            )
          }
        </div>
      </div>

      {/* Resumen P&G */}
      <div style={card}>
        <h3 style={secTitle}>Resumen P&amp;G — {monthLabel(year, month)}</h3>
        <table style={tbl}>
          <tbody>
            <tr>
              <td style={{ ...td, color: '#cccccc', width: '55%' }}>Ingresos brutos (plataformas)</td>
              <td style={tdR}>{fmtEur(ingresosBrutos)}</td>
              <td style={{ ...tdR, color: '#777777', width: 100 }}>—</td>
            </tr>
            <tr style={{ background: '#141414' }}>
              <td style={{ ...td, color: '#777777', paddingLeft: 28 }}>– Comisiones plataformas</td>
              <td style={{ ...tdR, color: '#B01D23' }}>{fmtEur(-(ingresosBrutos - ingresosNetos))}</td>
              <td style={{ ...tdR, color: '#777777' }}>
                {ingresosBrutos > 0 ? fmtPct((ingresosBrutos - ingresosNetos) / ingresosBrutos) : '—'}
              </td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 600, color: '#ffffff' }}>= INGRESOS NETOS</td>
              <td style={{ ...tdR, fontWeight: 600, color: '#e8f442' }}>{fmtEur(ingresosNetos)}</td>
              <td style={{ ...tdR, color: '#777777' }}>100%</td>
            </tr>
            <tr style={{ background: '#141414' }}>
              <td style={{ ...td, color: '#777777', paddingLeft: 28 }}>– Gastos variables</td>
              <td style={{ ...tdR, color: '#B01D23' }}>{fmtEur(-totalGastos)}</td>
              <td style={{ ...tdR, color: '#777777' }}>
                {ingresosNetos > 0 ? fmtPct(totalGastos / ingresosNetos) : '—'}
              </td>
            </tr>
            <tr>
              <td style={{ ...td, color: '#777777', paddingLeft: 28 }}>– Gastos fijos (mensualizado)</td>
              <td style={{ ...tdR, color: '#B01D23' }}>{fmtEur(-totalFijos)}</td>
              <td style={{ ...tdR, color: '#777777' }}>
                {ingresosNetos > 0 ? fmtPct(totalFijos / ingresosNetos) : '—'}
              </td>
            </tr>
            <tr style={{ background: '#0a0a0a' }}>
              <td style={{ ...td, fontWeight: 700, fontSize: 15, color: '#ffffff' }}>= RESULTADO NETO</td>
              <td style={{ ...tdR, fontWeight: 700, fontSize: 15, color: resColor }}>{fmtEur(resultado)}</td>
              <td style={{ ...tdR, fontWeight: 600, color: resColor }}>{fmtPct(margen)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
