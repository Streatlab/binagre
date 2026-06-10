import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'

/* ─── Design tokens ─────────────────────────────────────── */
const C = {
  bg: '#111111',
  card: '#1a1a1a',
  border: '#2a2a2a',
  borderStrong: '#383838',
  text: '#ffffff',
  muted: '#777777',
  secondary: '#cccccc',
  rojo: '#B01D23',
  amarillo: '#e8f442',
  verde: '#1D9E75',
}
const LEXEND: React.CSSProperties = { fontFamily: 'Lexend, sans-serif' }
const OSWALD: React.CSSProperties = { fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }

/* ─── Types ─────────────────────────────────────────────── */
interface WeekRow {
  label: string
  cobros: number
  gastos: number
  saldo: number
}

interface ResumenPlataforma {
  fecha: string
  uber_neto: number | null
  glovo_neto: number | null
  je_neto: number | null
  web_neto: number | null
  directa_neto: number | null
}

interface FacturaGasto {
  importe: number | null
  periodicidad: string | null
}

interface AvgWeekly {
  uber: number
  glovo: number
  je: number
  web: number
  directa: number
}

/* ─── Helpers ───────────────────────────────────────────── */
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function fmtWeekLabel(start: Date, idx: number): string {
  const end = addDays(start, 6)
  const fmt = (d: Date) =>
    `${d.getDate()} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()]}`
  return `Sem ${idx + 1} (${fmt(start)} – ${fmt(end)})`
}

function nextMonday(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay() // 0=dom, 1=lun
  const diff = day === 1 ? 0 : day === 0 ? 1 : 8 - day
  r.setDate(r.getDate() + diff)
  return r
}

/**
 * Cobros esperados en la semana que empieza en weekStart.
 * Lógica por ciclos reales de cada plataforma.
 */
function cobrosEnSemana(weekStart: Date, avg: AvgWeekly, factor: number): number {
  const weekEnd = addDays(weekStart, 6)
  let total = 0

  // Uber: paga cada lunes (semana anterior). weekStart siempre es lunes → 1 cobro/semana.
  total += avg.uber * factor

  // Glovo: día 5 (cubre 1ª quincena mes anterior) y día 20 (2ª quincena mes anterior).
  // Si alguno de esos días cae en esta semana → cobramos media quincena = ~2 semanas de media.
  for (let d = new Date(weekStart); d <= weekEnd; d = addDays(d, 1)) {
    const dom = d.getDate()
    if (dom === 5 || dom === 20) {
      total += avg.glovo * 2 * factor
    }
  }

  // JustEat: día 20 mismo mes (1ª quincena) y día 5 mes siguiente (2ª quincena).
  for (let d = new Date(weekStart); d <= weekEnd; d = addDays(d, 1)) {
    const dom = d.getDate()
    if (dom === 20 || dom === 5) {
      total += avg.je * 2 * factor
    }
  }

  // Web + Directa: cobro inmediato, acumulado semanal.
  total += (avg.web + avg.directa) * factor

  return total
}

function calcGastoSemanal(rows: FacturaGasto[]): number {
  let total = 0
  for (const r of rows) {
    const imp = r.importe ?? 0
    if (r.periodicidad === 'semanal') total += imp
    else if (r.periodicidad === 'mensual') total += imp / 4.33
    else if (r.periodicidad === 'quincenal') total += imp / 2.165
  }
  return total
}

function exportCSV(rows: WeekRow[]) {
  const header = 'Semana;Cobros previstos (€);Gastos fijos (€);Saldo al cierre (€)'
  const body = rows
    .map(r => `${r.label};${r.cobros.toFixed(2)};${r.gastos.toFixed(2)};${r.saldo.toFixed(2)}`)
    .join('\n')
  const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'escenarios_tesoreria.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function semaforo(saldo: number): { color: string; title: string } {
  if (saldo > 5000) return { color: C.verde, title: 'OK' }
  if (saldo >= 1000) return { color: C.amarillo, title: 'Atención' }
  return { color: C.rojo, title: 'Crítico' }
}

/* ─── Component ──────────────────────────────────────────── */
export default function EscenariosTesoreria() {
  const [loading, setLoading] = useState(true)
  const [saldoInicial, setSaldoInicial] = useState<number>(0)
  const [saldoManual, setSaldoManual] = useState<string>('')
  const [hasSaldoBD, setHasSaldoBD] = useState(false)
  const [variacion, setVariacion] = useState(0)
  const [avgWeekly, setAvgWeekly] = useState<AvgWeekly>({ uber: 0, glovo: 0, je: 0, web: 0, directa: 0 })
  const [gastoSemanal, setGastoSemanal] = useState(0)
  const [rows, setRows] = useState<WeekRow[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Saldo banco
      const { data: cfgData } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('key', 'saldo_banco_actual')
        .maybeSingle()
      if (cfgData?.valor != null) {
        const v = parseFloat(String(cfgData.valor))
        if (!isNaN(v)) {
          setSaldoInicial(v)
          setHasSaldoBD(true)
        }
      }

      // Último mes completo
      const now = new Date()
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonth = new Date(firstOfThisMonth.getTime() - 1)
      const yyyy = lastMonth.getFullYear()
      const mm = String(lastMonth.getMonth() + 1).padStart(2, '0')
      const mesIso = `${yyyy}-${mm}`

      const { data: rpData } = await supabase
        .from('resumenes_plataforma_marca_mensual')
        .select('fecha,uber_neto,glovo_neto,je_neto,web_neto,directa_neto')
        .gte('fecha', `${mesIso}-01`)
        .lte('fecha', `${mesIso}-31`)

      const resRows = (rpData ?? []) as ResumenPlataforma[]
      const sum = { uber: 0, glovo: 0, je: 0, web: 0, directa: 0 }
      for (const r of resRows) {
        sum.uber += r.uber_neto ?? 0
        sum.glovo += r.glovo_neto ?? 0
        sum.je += r.je_neto ?? 0
        sum.web += r.web_neto ?? 0
        sum.directa += r.directa_neto ?? 0
      }
      setAvgWeekly({
        uber: sum.uber / 4.33,
        glovo: sum.glovo / 4.33,
        je: sum.je / 4.33,
        web: sum.web / 4.33,
        directa: sum.directa / 4.33,
      })

      // Gastos fijos
      const { data: gastosData } = await supabase
        .from('facturas_gastos')
        .select('importe,periodicidad')
      setGastoSemanal(calcGastoSemanal((gastosData ?? []) as FacturaGasto[]))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Recalcular proyección cuando cambian inputs
  useEffect(() => {
    const saldo0 = hasSaldoBD ? saldoInicial : (parseFloat(saldoManual) || 0)
    const factor = 1 + variacion / 100
    const today = new Date()
    let weekStart = nextMonday(today)

    const newRows: WeekRow[] = []
    let saldo = saldo0
    for (let i = 0; i < 13; i++) {
      const cobros = cobrosEnSemana(weekStart, avgWeekly, factor)
      const gastos = gastoSemanal
      saldo = saldo + cobros - gastos
      newRows.push({ label: fmtWeekLabel(weekStart, i), cobros, gastos, saldo })
      weekStart = addDays(weekStart, 7)
    }
    setRows(newRows)
  }, [saldoInicial, saldoManual, hasSaldoBD, variacion, avgWeekly, gastoSemanal])

  // KPIs
  const saldo0 = hasSaldoBD ? saldoInicial : (parseFloat(saldoManual) || 0)
  const saldoMin = rows.length ? Math.min(...rows.map(r => r.saldo)) : saldo0
  const semCritica = rows.find(r => r.saldo < 1000)
  const runwayIdx = rows.findIndex(r => r.saldo <= 0)
  const runwayLabel = runwayIdx === -1 ? `> ${rows.length} sem` : `${runwayIdx} sem`

  const cardStyle: React.CSSProperties = {
    backgroundColor: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '16px 20px',
    ...LEXEND,
  }

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', padding: '24px 32px', color: C.text, ...LEXEND }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ ...OSWALD, fontSize: 22, color: C.text, margin: 0 }}>
          Escenarios de Tesorería
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0', ...LEXEND }}>
          Proyección a 90 días desde hoy — cashflow semanal estimado
        </p>
      </div>

      {loading && (
        <p style={{ color: C.muted }}>Cargando datos...</p>
      )}

      {!loading && (
        <>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>

            <div style={cardStyle}>
              <div style={{ ...OSWALD, fontSize: 11, color: C.muted, marginBottom: 6 }}>
                Saldo inicial banco
              </div>
              {hasSaldoBD ? (
                <div style={{ fontSize: 20, color: C.verde, fontWeight: 600 }}>
                  {fmtEur(saldoInicial)}
                  <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>desde BD</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    value={saldoManual}
                    onChange={e => setSaldoManual(e.target.value)}
                    placeholder="0"
                    style={{
                      backgroundColor: '#1e1e1e',
                      border: `1px solid ${C.borderStrong}`,
                      borderRadius: 4,
                      color: C.text,
                      padding: '6px 10px',
                      fontSize: 16,
                      width: 140,
                      outline: 'none',
                      ...LEXEND,
                    }}
                  />
                  <span style={{ color: C.muted, fontSize: 13 }}>€</span>
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <div style={{ ...OSWALD, fontSize: 11, color: C.muted, marginBottom: 6 }}>
                Variación ingresos
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={-30}
                  max={30}
                  step={5}
                  value={variacion}
                  onChange={e => setVariacion(Number(e.target.value))}
                  style={{ width: 160, accentColor: C.amarillo }}
                />
                <span style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: variacion < 0 ? C.rojo : variacion > 0 ? C.verde : C.text,
                  minWidth: 48,
                  textAlign: 'right',
                }}>
                  {variacion > 0 ? '+' : ''}{variacion}%
                </span>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {([
              { label: 'Saldo actual', value: fmtEur(saldo0), color: C.text },
              {
                label: 'Saldo mínimo proyectado',
                value: fmtEur(saldoMin),
                color: saldoMin > 5000 ? C.verde : saldoMin >= 1000 ? C.amarillo : C.rojo,
              },
              {
                label: 'Semana crítica',
                value: semCritica ? semCritica.label.split('(')[0].trim() : 'Ninguna',
                color: semCritica ? C.amarillo : C.verde,
              },
              {
                label: 'Runway',
                value: runwayLabel,
                color: runwayIdx === -1 ? C.verde : runwayIdx < 4 ? C.rojo : C.amarillo,
              },
            ] as { label: string; value: string; color: string }[]).map(k => (
              <div key={k.label} style={{ ...cardStyle, textAlign: 'center' }}>
                <div style={{ ...OSWALD, fontSize: 10, color: C.muted, marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ ...OSWALD, fontSize: 13, color: C.secondary }}>
                Proyección semanal — 90 días
              </span>
              <button
                onClick={() => exportCSV(rows)}
                style={{
                  backgroundColor: C.amarillo,
                  color: '#111111',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  ...OSWALD,
                  fontSize: 12,
                }}
              >
                Exportar CSV
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', ...LEXEND }}>
                <thead>
                  <tr style={{ backgroundColor: '#0a0a0a' }}>
                    {(
                      ['Semana', 'Cobros previstos', 'Gastos fijos', 'Saldo al cierre', ''] as string[]
                    ).map((h, hi) => (
                      <th
                        key={hi}
                        style={{
                          ...OSWALD,
                          fontSize: 11,
                          color: C.muted,
                          padding: '10px 16px',
                          textAlign: hi === 0 ? 'left' : 'right',
                          borderBottom: `1px solid ${C.border}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const sem = semaforo(row.saldo)
                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom: `1px solid ${C.border}`,
                          backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <td style={{ padding: '10px 16px', color: C.secondary, fontSize: 13, whiteSpace: 'nowrap' }}>
                          {row.label}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: C.verde, fontSize: 13 }}>
                          {fmtEur(row.cobros)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: C.rojo, fontSize: 13 }}>
                          {fmtEur(row.gastos)}
                        </td>
                        <td style={{
                          padding: '10px 16px',
                          textAlign: 'right',
                          color: row.saldo < 0 ? C.rojo : C.text,
                          fontWeight: 600,
                          fontSize: 14,
                        }}>
                          {fmtEur(row.saldo)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 18 }}>
                          <span title={sem.title} style={{ color: sem.color }}>●</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
