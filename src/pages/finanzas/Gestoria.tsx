import { BLANCO, GRANATE, GRIS, INK, LIMA, VERDE } from '@/styles/neobrutal'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur, fmtDate } from '@/utils/format'
import * as XLSX from 'xlsx'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Titular {
  id: string
  nombre: string
  activo: boolean
  orden: number
}

interface Factura {
  id: string
  proveedor_nombre: string | null
  fecha_factura: string | null
  total: number | null
  base_4: number | null
  iva_4: number | null
  base_10: number | null
  iva_10: number | null
  base_21: number | null
  iva_21: number | null
  total_base: number | null
  total_iva: number | null
  estado: string | null
  titular_id: string | null
  tipo: string | null
}

interface Conciliacion {
  id: string
  fecha: string | null
  concepto: string | null
  importe: number | null
  tipo: string | null
  categoria: string | null
  proveedor: string | null
  titular_id: string | null
  iva_soportado: number | null
  base_imponible: number | null
}

interface FacturacionDiario {
  fecha: string
  total_bruto: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ANOS = [2024, 2025, 2026]
const TRIMESTRES = [
  { value: 'Q1', label: 'Q1 (Ene-Mar)' },
  { value: 'Q2', label: 'Q2 (Abr-Jun)' },
  { value: 'Q3', label: 'Q3 (Jul-Sep)' },
  { value: 'Q4', label: 'Q4 (Oct-Dic)' },
  { value: 'anual', label: 'Anual' },
]

function getPeriodRange(ano: number, trimestre: string): { desde: string; hasta: string } {
  if (trimestre === 'anual') {
    return { desde: `${ano}-01-01`, hasta: `${ano}-12-31` }
  }
  const meses: Record<string, [number, number]> = {
    Q1: [1, 3], Q2: [4, 6], Q3: [7, 9], Q4: [10, 12],
  }
  const [m1, m2] = meses[trimestre]
  const lastDay = new Date(ano, m2, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    desde: `${ano}-${pad(m1)}-01`,
    hasta: `${ano}-${pad(m2)}-${lastDay}`,
  }
}

function getNombreMes(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00')
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div style={{
      background: INK,
      border: '1px solid #2a2a2a',
      borderRadius: 10,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, color: GRIS, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 8 }}>
        {label}
        {badge && (
          <span style={{ background: LIMA, color: INK, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, color: BLANCO, fontWeight: 500 }}>
        {value}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Gestoria({ embedded = false }: { embedded?: boolean } = {}) {
  const [titulares, setTitulares] = useState<Titular[]>([])
  const [selectedTitularId, setSelectedTitularId] = useState<string>('todos')
  const [ano, setAno] = useState(2025)
  const [trimestre, setTrimestre] = useState('Q1')
  const [activeTab, setActiveTab] = useState<'resumen' | 'iva-soportado' | 'iva-repercutido' | 'exports'>('resumen')

  const [facturas, setFacturas] = useState<Factura[]>([])
  const [conciliacion, setConciliacion] = useState<Conciliacion[]>([])
  const [facturacionDiario, setFacturacionDiario] = useState<FacturacionDiario[]>([])
  const [loading, setLoading] = useState(false)
  const [agruparMes, setAgruparMes] = useState(false)

  // Cargar titulares
  useEffect(() => {
    supabase
      .from('titulares')
      .select('id, nombre, activo, orden')
      .eq('activo', true)
      .order('orden')
      .then(({ data }) => {
        if (data) setTitulares(data as Titular[])
      })
  }, [])

  const { desde, hasta } = getPeriodRange(ano, trimestre)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      // Facturas gastos
      let qFacturas = supabase
        .from('facturas')
        .select('id, proveedor_nombre, fecha_factura, total, base_4, iva_4, base_10, iva_10, base_21, iva_21, total_base, total_iva, estado, titular_id, tipo')
        .eq('tipo', 'gasto')
        .eq('estado', 'ok')
        .gte('fecha_factura', desde)
        .lte('fecha_factura', hasta)
      if (selectedTitularId !== 'todos') {
        qFacturas = qFacturas.eq('titular_id', selectedTitularId)
      }

      // Conciliacion
      let qConc = supabase
        .from('conciliacion')
        .select('id, fecha, concepto, importe, tipo, categoria, proveedor, titular_id, iva_soportado, base_imponible')
        .gte('fecha', desde)
        .lte('fecha', hasta)
      if (selectedTitularId !== 'todos') {
        qConc = qConc.eq('titular_id', selectedTitularId)
      }

      // Facturacion diario (no tiene titular)
      const qFact = supabase
        .from('facturacion_diario')
        .select('fecha, total_bruto')
        .gte('fecha', desde)
        .lte('fecha', hasta)

      const [resFacturas, resConc, resFact] = await Promise.all([
        qFacturas, qConc, qFact,
      ])

      setFacturas((resFacturas.data as Factura[]) ?? [])
      setConciliacion((resConc.data as Conciliacion[]) ?? [])
      setFacturacionDiario((resFact.data as FacturacionDiario[]) ?? [])
    } finally {
      setLoading(false)
    }
  }, [desde, hasta, selectedTitularId])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // ─── KPIs ────────────────────────────────────────────────────────────────
  const totalIngresos = facturacionDiario.reduce((s, r) => s + (r.total_bruto ?? 0), 0)
  const totalGastos = conciliacion.reduce((s, r) => {
    const imp = r.importe ?? 0
    return s + (imp < 0 ? Math.abs(imp) : 0)
  }, 0)
  const ivaSoportado = facturas.reduce((s, r) => s + (r.total_iva ?? 0), 0)
  const ivaRepercutidoEstimado = totalIngresos * 0.21

  // ─── Tab IVA Soportado ───────────────────────────────────────────────────
  const totalBaseFacturas = facturas.reduce((s, r) => s + (r.total_base ?? 0), 0)
  const totalIvaFacturas = facturas.reduce((s, r) => s + (r.total_iva ?? 0), 0)

  // Agrupacion por mes
  type MesGroup = { mes: string; base: number; iva: number; filas: Factura[] }
  const facturasPorMes: MesGroup[] = []
  if (agruparMes) {
    const mapa: Record<string, MesGroup> = {}
    for (const f of facturas) {
      const mes = f.fecha_factura ? getNombreMes(f.fecha_factura) : 'Sin fecha'
      if (!mapa[mes]) mapa[mes] = { mes, base: 0, iva: 0, filas: [] }
      mapa[mes].base += f.total_base ?? 0
      mapa[mes].iva += f.total_iva ?? 0
      mapa[mes].filas.push(f)
    }
    facturasPorMes.push(...Object.values(mapa).sort((a, b) => a.mes.localeCompare(b.mes)))
  }

  // ─── Tab IVA Repercutido ─────────────────────────────────────────────────
  type FDiarioGroup = { periodo: string; ventas: number }
  const ventasPorMes: FDiarioGroup[] = (() => {
    const mapa: Record<string, number> = {}
    for (const r of facturacionDiario) {
      const mes = r.fecha ? getNombreMes(r.fecha) : 'Sin fecha'
      mapa[mes] = (mapa[mes] ?? 0) + (r.total_bruto ?? 0)
    }
    return Object.entries(mapa)
      .map(([periodo, ventas]) => ({ periodo, ventas }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo))
  })()

  const titularNombre = (id: string | null) => {
    const t = titulares.find(t => t.id === id)
    return t ? t.nombre : '—'
  }

  // ─── Exports ─────────────────────────────────────────────────────────────
  function exportarModelo303() {
    const baseRep = totalIngresos / 1.21
    const ivaRep = totalIngresos - baseRep
    const baseSop = totalBaseFacturas
    const ivaSop = totalIvaFacturas
    const cuota = ivaRep - ivaSop
    const rows = [{
      trimestre: `${ano} ${trimestre}`,
      base_imponible_repercutido_estimado: baseRep.toFixed(2),
      iva_repercutido_estimado: ivaRep.toFixed(2),
      base_iva_soportado: baseSop.toFixed(2),
      iva_soportado: ivaSop.toFixed(2),
      cuota_diferencial: cuota.toFixed(2),
    }]
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => Object.values(r).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `modelo303_${ano}_${trimestre}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportarGastos() {
    const data = facturas.map(f => ({
      Fecha: fmtDate(f.fecha_factura),
      'Número factura': f.id,
      Proveedor: f.proveedor_nombre ?? '',
      Base: f.total_base ?? 0,
      IVA: f.total_iva ?? 0,
      Total: f.total ?? 0,
      Categoría: '',
      Titular: titularNombre(f.titular_id),
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos')
    XLSX.writeFile(wb, `gastos_${ano}_${trimestre}.xlsx`)
  }

  function exportarMovimientos() {
    const data = conciliacion.map(c => ({
      Fecha: fmtDate(c.fecha),
      Concepto: c.concepto ?? '',
      Importe: c.importe ?? 0,
      Categoría: c.categoria ?? '',
      Proveedor: c.proveedor ?? '',
      Titular: titularNombre(c.titular_id),
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
    XLSX.writeFile(wb, `movimientos_${ano}_${trimestre}.xlsx`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  const TABS = [
    { key: 'resumen' as const, label: 'Resumen' },
    { key: 'iva-soportado' as const, label: 'IVA Soportado' },
    { key: 'iva-repercutido' as const, label: 'IVA Repercutido' },
    { key: 'exports' as const, label: 'Exports' },
  ]

  const selectStyle: React.CSSProperties = {
    background: INK,
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    color: BLANCO,
    fontFamily: 'Oswald, sans-serif',
    fontSize: 13,
    padding: '7px 12px',
    cursor: 'pointer',
    outline: 'none',
  }

  const btnStyle: React.CSSProperties = {
    background: GRANATE,
    color: BLANCO,
    border: 'none',
    borderRadius: 6,
    fontFamily: 'Oswald, sans-serif',
    fontSize: 13,
    padding: '9px 18px',
    cursor: 'pointer',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  }

  const thStyle: React.CSSProperties = {
    background: INK,
    color: GRIS,
    fontFamily: 'Oswald, sans-serif',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '10px 12px',
    textAlign: 'left',
    borderBottom: '1px solid #2a2a2a',
  }

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid #1a1a1a',
    color: GRIS,
    fontFamily: 'Lexend, sans-serif',
    fontSize: 13,
  }

  return (
    <div style={{ background: embedded ? 'transparent' : INK, minHeight: embedded ? 'auto' : '100vh', padding: embedded ? 0 : '28px 32px', color: BLANCO }}>
      {/* Header */}
      {!embedded && (
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, color: BLANCO, margin: 0, letterSpacing: '0.06em' }}>
            GESTORÍA — EXPORTS FISCALES
          </h1>
          <p style={{ color: GRIS, fontFamily: 'Lexend, sans-serif', fontSize: 13, margin: '6px 0 0' }}>
            Resumen fiscal y exportación de datos para gestoría
          </p>
        </div>
      )}

      {/* Selectores */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, color: GRIS, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Titular</label>
          <select value={selectedTitularId} onChange={e => setSelectedTitularId(e.target.value)} style={selectStyle}>
            <option value="todos">Todos</option>
            {titulares.map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, color: GRIS, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Año</label>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} style={selectStyle}>
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, color: GRIS, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Período</label>
          <select value={trimestre} onChange={e => setTrimestre(e.target.value)} style={selectStyle}>
            {TRIMESTRES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div style={{ color: GRIS, fontFamily: 'Lexend, sans-serif', fontSize: 12, paddingBottom: 8 }}>
          {desde} → {hasta}
          {loading && <span style={{ marginLeft: 12, color: LIMA }}>Cargando...</span>}
        </div>
      </div>

      {/* Tabs pastilla */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: INK, border: '1px solid #2a2a2a', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: activeTab === tab.key ? GRANATE : 'transparent',
              color: activeTab === tab.key ? BLANCO : GRIS,
              border: 'none',
              borderRadius: 6,
              fontFamily: 'Oswald, sans-serif',
              fontSize: 13,
              padding: '8px 18px',
              cursor: 'pointer',
              letterSpacing: '0.05em',
              transition: 'background 150ms',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB RESUMEN ──────────────────────────────────────────────────────── */}
      {activeTab === 'resumen' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <KpiCard label="Total Ingresos" value={fmtEur(totalIngresos)} />
            <KpiCard label="Total Gastos" value={fmtEur(totalGastos)} />
            <KpiCard label="IVA Soportado" value={fmtEur(ivaSoportado)} />
            <KpiCard label="IVA Repercutido" value={fmtEur(ivaRepercutidoEstimado)} badge="ESTIMADO" />
          </div>
          {selectedTitularId !== 'todos' && (
            <div style={{
              background: INK,
              border: '1px solid #383838',
              borderRadius: 8,
              padding: '12px 16px',
              color: GRIS,
              fontFamily: 'Lexend, sans-serif',
              fontSize: 12,
            }}>
              Nota: los datos de <strong style={{ color: GRIS }}>facturacion_diario</strong> (ingresos de plataformas) no tienen desglose por titular. Se muestra el total del período independientemente del titular seleccionado.
            </div>
          )}
        </div>
      )}

      {/* ── TAB IVA SOPORTADO ────────────────────────────────────────────────── */}
      {activeTab === 'iva-soportado' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: BLANCO, margin: 0, letterSpacing: '0.05em' }}>
              FACTURAS DE GASTOS — IVA SOPORTADO
            </h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: GRIS, fontFamily: 'Lexend, sans-serif', fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={agruparMes}
                onChange={e => setAgruparMes(e.target.checked)}
                style={{ accentColor: LIMA }}
              />
              Agrupar por mes
            </label>
          </div>

          <div style={{ background: INK, border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Proveedor</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Base</th>
                  <th style={thStyle}>IVA %</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>IVA €</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                  <th style={thStyle}>Titular</th>
                </tr>
              </thead>
              <tbody>
                {agruparMes ? (
                  facturasPorMes.length === 0 ? (
                    <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: GRIS, padding: '32px' }}>Sin datos para el período</td></tr>
                  ) : (
                    facturasPorMes.map(grupo => (
                      <GrupoMesRows
                        key={grupo.mes}
                        grupo={grupo}
                        tdStyle={tdStyle}
                        titularNombre={titularNombre}
                      />
                    ))
                  )
                ) : (
                  facturas.length === 0 ? (
                    <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: GRIS, padding: '32px' }}>Sin datos para el período</td></tr>
                  ) : (
                    facturas.map(f => (
                      <FacturaRow key={f.id} f={f} tdStyle={tdStyle} titularNombre={titularNombre} />
                    ))
                  )
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: INK }}>
                  <td colSpan={2} style={{ ...tdStyle, fontFamily: 'Oswald, sans-serif', fontSize: 12, color: GRIS }}>TOTALES</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: BLANCO, fontFamily: 'Oswald, sans-serif' }}>{fmtEur(totalBaseFacturas)}</td>
                  <td style={tdStyle}></td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: GRANATE, fontFamily: 'Oswald, sans-serif' }}>{fmtEur(totalIvaFacturas)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: BLANCO, fontFamily: 'Oswald, sans-serif' }}>{fmtEur(totalBaseFacturas + totalIvaFacturas)}</td>
                  <td style={tdStyle}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB IVA REPERCUTIDO ──────────────────────────────────────────────── */}
      {activeTab === 'iva-repercutido' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: BLANCO, margin: 0, letterSpacing: '0.05em' }}>
              IVA REPERCUTIDO ESTIMADO
            </h2>
            <span style={{ background: LIMA, color: INK, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontFamily: 'Oswald, sans-serif' }}>
              #ESTIMADO
            </span>
          </div>

          <div style={{
            background: INK,
            border: '1px solid #383838',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            color: GRIS,
            fontFamily: 'Lexend, sans-serif',
            fontSize: 12,
          }}>
            Este cálculo es orientativo. Para modelo 303/130 real se requieren datos de facturación formal. El IVA se estima aplicando 21% sobre ventas brutas de plataformas.
          </div>

          <div style={{ background: INK, border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Período</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Ventas brutas</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Base imponible est.</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>IVA 21% est.</th>
                </tr>
              </thead>
              <tbody>
                {ventasPorMes.length === 0 ? (
                  <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: GRIS, padding: '32px' }}>Sin datos para el período</td></tr>
                ) : (
                  ventasPorMes.map(row => {
                    const base = row.ventas / 1.21
                    const iva = row.ventas - base
                    return (
                      <tr key={row.periodo}>
                        <td style={tdStyle}>{row.periodo}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtEur(row.ventas)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: GRIS }}>{fmtEur(base)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: LIMA }}>{fmtEur(iva)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: INK }}>
                  <td style={{ ...tdStyle, fontFamily: 'Oswald, sans-serif', fontSize: 12, color: GRIS }}>TOTALES</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: BLANCO, fontFamily: 'Oswald, sans-serif' }}>{fmtEur(totalIngresos)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: GRIS, fontFamily: 'Oswald, sans-serif' }}>{fmtEur(totalIngresos / 1.21)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: LIMA, fontFamily: 'Oswald, sans-serif' }}>{fmtEur(ivaRepercutidoEstimado)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB EXPORTS ──────────────────────────────────────────────────────── */}
      {activeTab === 'exports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: BLANCO, margin: 0, letterSpacing: '0.05em' }}>
            EXPORTACIONES PARA GESTORÍA
          </h2>

          {/* Modelo 303 */}
          <div style={{ background: INK, border: '1px solid #2a2a2a', borderRadius: 10, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, color: BLANCO, marginBottom: 6 }}>
                  Modelo 303 — IVA Trimestral
                </div>
                <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS, maxWidth: 500 }}>
                  CSV con base imponible repercutida estimada, IVA repercutido estimado, base IVA soportado, IVA soportado y cuota diferencial.
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 16, fontFamily: 'Lexend, sans-serif', fontSize: 12, flexWrap: 'wrap' }}>
                  <span style={{ color: GRIS }}>IVA rep. est.: <strong style={{ color: LIMA }}>{fmtEur(ivaRepercutidoEstimado)}</strong></span>
                  <span style={{ color: GRIS }}>IVA soportado: <strong style={{ color: GRANATE }}>{fmtEur(ivaSoportado)}</strong></span>
                  <span style={{ color: GRIS }}>Cuota diferencial: <strong style={{ color: ivaRepercutidoEstimado - ivaSoportado >= 0 ? VERDE : GRANATE }}>{fmtEur(ivaRepercutidoEstimado - ivaSoportado)}</strong></span>
                </div>
              </div>
              <button onClick={exportarModelo303} style={btnStyle}>
                Descargar CSV
              </button>
            </div>
          </div>

          {/* Export gastos */}
          <div style={{ background: INK, border: '1px solid #2a2a2a', borderRadius: 10, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, color: BLANCO, marginBottom: 6 }}>
                  Export Gastos Completo
                </div>
                <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS, maxWidth: 500 }}>
                  Excel con todas las facturas de gastos del período seleccionado. Incluye proveedor, base, IVA, total y titular.
                </div>
                <div style={{ marginTop: 8, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS }}>
                  {facturas.length} facturas — Total IVA: <strong style={{ color: GRANATE }}>{fmtEur(totalIvaFacturas)}</strong>
                </div>
              </div>
              <button onClick={exportarGastos} style={btnStyle}>
                Descargar Excel
              </button>
            </div>
          </div>

          {/* Export movimientos */}
          <div style={{ background: INK, border: '1px solid #2a2a2a', borderRadius: 10, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, color: BLANCO, marginBottom: 6 }}>
                  Export Movimientos Bancarios
                </div>
                <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS, maxWidth: 500 }}>
                  Excel con todos los movimientos de conciliación del período. Incluye fecha, concepto, importe, categoría y titular.
                </div>
                <div style={{ marginTop: 8, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS }}>
                  {conciliacion.length} movimientos
                </div>
              </div>
              <button onClick={exportarMovimientos} style={btnStyle}>
                Descargar Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
type MesGroup = { mes: string; base: number; iva: number; filas: { id: string; proveedor_nombre: string | null; fecha_factura: string | null; total: number | null; base_4: number | null; iva_4: number | null; base_10: number | null; iva_10: number | null; base_21: number | null; iva_21: number | null; total_base: number | null; total_iva: number | null; estado: string | null; titular_id: string | null; tipo: string | null }[] }

function GrupoMesRows({ grupo, tdStyle, titularNombre }: { grupo: MesGroup; tdStyle: React.CSSProperties; titularNombre: (id: string | null) => string }) {
  return (
    <>
      <tr style={{ background: INK }}>
        <td colSpan={7} style={{ ...tdStyle, fontFamily: 'Oswald, sans-serif', fontSize: 12, color: LIMA, letterSpacing: '0.06em' }}>
          {grupo.mes} — {grupo.filas.length} facturas
        </td>
      </tr>
      {grupo.filas.map(f => (
        <FacturaRow key={f.id} f={f} tdStyle={tdStyle} titularNombre={titularNombre} />
      ))}
    </>
  )
}

function FacturaRow({
  f,
  tdStyle,
  titularNombre,
}: {
  f: { id: string; proveedor_nombre: string | null; fecha_factura: string | null; total: number | null; base_4: number | null; iva_4: number | null; base_10: number | null; iva_10: number | null; base_21: number | null; iva_21: number | null; total_base: number | null; total_iva: number | null; estado: string | null; titular_id: string | null; tipo: string | null }
  tdStyle: React.CSSProperties
  titularNombre: (id: string | null) => string
}) {
  let ivaPct = '—'
  if ((f.base_21 ?? 0) > 0) ivaPct = '21%'
  else if ((f.base_10 ?? 0) > 0) ivaPct = '10%'
  else if ((f.base_4 ?? 0) > 0) ivaPct = '4%'

  return (
    <tr>
      <td style={tdStyle}>{fmtDate(f.fecha_factura)}</td>
      <td style={tdStyle}>{f.proveedor_nombre ?? '—'}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtEur(f.total_base)}</td>
      <td style={{ ...tdStyle, color: GRIS }}>{ivaPct}</td>
      <td style={{ ...tdStyle, textAlign: 'right', color: GRANATE }}>{fmtEur(f.total_iva)}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtEur(f.total)}</td>
      <td style={{ ...tdStyle, color: GRIS }}>{titularNombre(f.titular_id)}</td>
    </tr>
  )
}
