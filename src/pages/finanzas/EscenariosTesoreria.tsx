/**
 * Escenarios de Tesorería — proyección semanal a 90 días con variación de ingresos.
 * CANTERA ALEGRE v1.0 (área Tesorería · azul). Solo capa visual; datos/lógica sin tocar.
 */
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { OSW, LEX, INK, CREMA, GRANATE, AMA, VERDE, ROJO, NAR, GRIS, BLANCO, LIMA } from '@/styles/neobrutal'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'

/* ─── Types ─────────────────────────────────────────────── */
interface WeekRow {
  label: string
  cobros: number
  gastos: number
  saldo: number
}

interface ResumenPlataformaRow {
  plataforma: string
  año: number
  mes: number
  neto_real_cobrado: number | null
}

interface GastoFijo {
  importe: number | null
  periodicidad: string | null
  activo: boolean | null
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

function calcGastoSemanal(rows: GastoFijo[]): number {
  let total = 0
  for (const r of rows) {
    if (r.activo === false) continue
    const imp = r.importe ?? 0
    if (r.periodicidad === 'semanal') total += imp
    else if (r.periodicidad === 'mensual') total += imp / 4.33
    else if (r.periodicidad === 'quincenal') total += imp / 2.165
    else if (r.periodicidad === 'anual') total += imp / 52
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
  if (saldo > 5000) return { color: VERDE, title: 'OK' }
  if (saldo >= 1000) return { color: AMA, title: 'Atención' }
  return { color: ROJO, title: 'Crítico' }
}

/* ─── Component ──────────────────────────────────────────── */
export function EscenariosTesoreria({ embedded = false }: { embedded?: boolean } = {}) {
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
      const mes = lastMonth.getMonth() + 1

      const lastDayLM = new Date(yyyy, mes, 0).getDate()
      const iniLM = `${yyyy}-${String(mes).padStart(2,'0')}-01`
      const finLM = `${yyyy}-${String(mes).padStart(2,'0')}-${String(lastDayLM).padStart(2,'0')}`
      const { data: rpData } = await supabase
        .from('ventas_plataforma')
        .select('plataforma, neto, bruto, fecha_fin_periodo')
        .gte('fecha_fin_periodo', iniLM)
        .lte('fecha_fin_periodo', finLM)

      const resRows = (rpData ?? []) as unknown as ResumenPlataformaRow[]
      const sum = { uber: 0, glovo: 0, je: 0, web: 0, directa: 0 }
      for (const r of resRows) {
        const neto = (r as any).neto ?? 0
        const p = ((r.plataforma ?? '') as string).toLowerCase().trim()
        if (p === 'uber') sum.uber += neto
        else if (p === 'glovo') sum.glovo += neto
        else if (p === 'justeat' || p === 'just eat' || p === 'je') sum.je += neto
        else if (p === 'web') sum.web += neto
        else if (p === 'directa' || p === 'dir') sum.directa += neto
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
        .from('gastos_fijos')
        .select('importe,periodicidad,activo')
      setGastoSemanal(calcGastoSemanal((gastosData ?? []) as GastoFijo[]))
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
  const saldoMinColor = saldoMin > 5000 ? VERDE : saldoMin >= 1000 ? AMA : ROJO

  const titular = loading
    ? 'Calculando la proyección de caja.'
    : runwayIdx !== -1 ? 'Se te acaba la caja dentro de la proyección.'
    : saldoMin > 5000 ? 'Tu caja aguanta las 13 semanas sin apuros.'
    : 'Vas a pasar por un valle de tesorería.'

  const atencion = [
    semCritica ? `Semana crítica: ${semCritica.label.split('(')[0].trim()}` : 'Sin semana crítica',
    `Runway ${runwayLabel}`,
    `Variación aplicada ${variacion > 0 ? '+' : ''}${variacion}%`,
  ]

  const filtros = (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ background: BLANCO, border: `3px solid ${INK}`, padding: '10px 16px' }}>
        <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Saldo inicial banco</div>
        {hasSaldoBD ? (
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 18, color: VERDE }}>
            {fmtEur(saldoInicial)}
            <span style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginLeft: 8 }}>desde BD</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              value={saldoManual}
              onChange={e => setSaldoManual(e.target.value)}
              placeholder="0"
              style={{ border: `2px solid ${INK}`, borderRadius: 0, color: INK, background: BLANCO, padding: '6px 10px', fontSize: 15, width: 120, outline: 'none', fontFamily: LEX }}
            />
            <span style={{ fontFamily: LEX, color: GRIS, fontSize: 13 }}>€</span>
          </div>
        )}
      </div>

      <div style={{ background: BLANCO, border: `3px solid ${INK}`, padding: '10px 16px' }}>
        <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS, marginBottom: 6 }}>Variación ingresos</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={-30}
            max={30}
            step={5}
            value={variacion}
            onChange={e => setVariacion(Number(e.target.value))}
            style={{ width: 140, accentColor: LIMA }}
          />
          <span style={{ fontFamily: OSW, fontSize: 15, fontWeight: 700, color: variacion < 0 ? ROJO : variacion > 0 ? VERDE : INK, minWidth: 44, textAlign: 'right' }}>
            {variacion > 0 ? '+' : ''}{variacion}%
          </span>
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <PantallaCantera embedded={embedded}>
        <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando escenarios de tesorería…</div>
      </PantallaCantera>
    )
  }

  return (
    <PantallaCantera embedded={embedded}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{filtros}</div>

      {/* 1 · Héroe del área Tesorería (azul) */}
      <HeroCantera
        area="tesoreria"
        periodo="Próximas 13 semanas"
        titular={titular}
        etiquetaDato="Saldo mínimo proyectado"
        cifra={fmtEur(saldoMin)}
        resumen={<>Saldo actual <b>{fmtEur(saldo0)}</b>. Proyección desde el próximo lunes con variación de ingresos del <b>{variacion > 0 ? '+' : ''}{variacion}%</b>.</>}
        atencion={atencion}
      />

      {/* 2 · Plancha comparativa de KPIs */}
      <div>
        <SeccionLabel bg={AMA} color={INK}>Resumen de la proyección</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={INK} color={BLANCO} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Saldo actual</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(saldo0)}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={saldoMinColor}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Saldo mínimo proyectado</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, lineHeight: 1.05, marginTop: 6 }}>{fmtEur(saldoMin)}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={semCritica ? AMA : VERDE} color={semCritica ? INK : BLANCO}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Semana crítica</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, lineHeight: 1.05, marginTop: 6 }}>{semCritica ? semCritica.label.split('(')[0].trim() : 'Ninguna'}</div>
          </PlanchaCelda>
          <PlanchaCelda bg={runwayIdx === -1 ? VERDE : runwayIdx < 4 ? ROJO : AMA} color={runwayIdx !== -1 && runwayIdx < 4 ? BLANCO : (runwayIdx === -1 ? BLANCO : INK)}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Runway</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, lineHeight: 1.05, marginTop: 6 }}>{runwayLabel}</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* 3 · Frase potente (color por significado, distinta del héroe azul) */}
      {runwayIdx !== -1 ? (
        <FrasePotente significado="peligro">Con la variación aplicada, la caja llega a cero en la semana {runwayIdx}. Ajusta gastos o cobros antes de que llegue.</FrasePotente>
      ) : saldoMin <= 5000 ? (
        <FrasePotente significado="coste">El saldo mínimo proyectado queda ajustado: cualquier imprevisto puede llevarte a zona roja.</FrasePotente>
      ) : (
        <FrasePotente significado="logro">La caja proyectada aguanta holgada las 13 semanas con el patrón actual de cobros y gastos.</FrasePotente>
      )}

      {/* Tabla — papel (sin sombra) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <SeccionLabel bg={NAR}>Proyección semanal · 90 días</SeccionLabel>
          <button
            onClick={() => exportCSV(rows)}
            style={{ background: LIMA, color: INK, border: `3px solid ${INK}`, boxShadow: SHADOW_DURA, borderRadius: 0, padding: '8px 16px', cursor: 'pointer', fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
          >
            Exportar CSV
          </button>
        </div>
        <Papel ceja={NAR} pad="0" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: LEX }}>
            <thead>
              <tr style={{ background: INK }}>
                {['Semana', 'Cobros previstos', 'Gastos fijos', 'Saldo al cierre', 'Estado'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : i === 4 ? 'center' : 'right', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const sem = semaforo(row.saldo)
                return (
                  <tr key={i} style={{ borderBottom: `2px solid ${INK}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: LEX, whiteSpace: 'nowrap' }}>{row.label}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: VERDE, fontFamily: OSW, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtEur(row.cobros)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: GRANATE, fontFamily: OSW, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtEur(row.gastos)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: OSW, fontWeight: 700, color: row.saldo < 0 ? ROJO : INK, whiteSpace: 'nowrap' }}>{fmtEur(row.saldo)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span title={sem.title} style={{ display: 'inline-block', width: 12, height: 12, background: sem.color, border: `2px solid ${INK}` }} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Papel>
      </div>
    </PantallaCantera>
  )
}

export default EscenariosTesoreria
