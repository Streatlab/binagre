/**
 * Punto de Equilibrio — refactor v4 — 3 may 2026
 *
 * 3 cards compactas estilo Panel Global (caben 3 en pantalla):
 *   1) FACTURACIÓN — bruto + neto + 5 plataformas (Uber/Glovo/JE/Web/Directa)
 *   2) PUNTO DE EQUILIBRIO — bruto necesario + día que se cubre + barra progreso
 *   3) RESULTADO — beneficio del periodo + EBITDA % + objetivo
 *
 * Después: 2 cards COSTES FIJOS / VARIABLES (filas limpias, sin "Sin IVA plan contable")
 */
import { useState, useMemo, useEffect, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, fmtFechaCorta } from '@/styles/tokens'
import { useCalendario } from '@/contexts/CalendarioContext'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import TabsPastilla from '@/components/ui/TabsPastilla'
import {
  CATEGORIA_NOMBRE, CATEGORIA_COLOR,
  GASTOS_FIJOS, GASTOS_VARIABLES,
  type Categoria, type PeriodoRango,
} from '@/lib/running'
import { useRunning } from '@/hooks/useRunning'
import {
  cardBig, lbl, lblXs, OSWALD, LEXEND, COLOR,
} from '@/components/panel/resumen/tokens'
import { fmtEur, fmtPct } from '@/lib/format'

const ROJO   = COLOR.rojoSL
const VERDE  = COLOR.verde
const AMBAR  = COLOR.ambar
const ERR    = COLOR.rojo

const MESES_CORTO = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']

type Tab = 'resumen' | 'simulador'

interface CanalDatos {
  bruto: number
  neto: number
  margenPct: number
  pedidos: number
}

const CANAL_INFO: Array<{ id: 'uber'|'glovo'|'just_eat'|'web'|'directa'; label: string; color: string }> = [
  { id: 'uber',     label: 'Uber Eats', color: COLOR.uber    },
  { id: 'glovo',    label: 'Glovo',     color: COLOR.glovo   },
  { id: 'just_eat', label: 'Just Eat',  color: COLOR.je      },
  { id: 'web',      label: 'Web',       color: COLOR.webSL   },
  { id: 'directa',  label: 'Directa',   color: COLOR.directa },
]

export default function PuntoEquilibrio() {
  const { T } = useTheme()
  const [tab, setTab] = useState<Tab>('resumen')

  const [periodoDesde, setPeriodoDesde] = useState<Date>(() => {
    const h = new Date(); h.setDate(1); h.setHours(0,0,0,0); return h
  })
  const [periodoHasta, setPeriodoHasta] = useState<Date>(() => {
    const h = new Date(); h.setHours(23,59,59,999); return h
  })
  const [periodoLabel, setPeriodoLabel] = useState('Mes en curso')

  const periodo: PeriodoRango = useMemo(() => ({
    desde: periodoDesde,
    hasta: periodoHasta,
    key: 'pe',
    label: periodoLabel,
  }), [periodoDesde, periodoHasta, periodoLabel])
  const anio = periodo.desde.getFullYear()

  const { loading, error, gastos, facturacion } = useRunning(
    periodo, anio, null, null, 'sin',
  )
  const { diasOperativosEnRango } = useCalendario()

  const brutoPorCanal = useMemo(() => {
    const m: Record<string, number> = { uber: 0, glovo: 0, just_eat: 0, web: 0, directa: 0 }
    const ped: Record<string, number> = { uber: 0, glovo: 0, just_eat: 0, web: 0, directa: 0 }
    for (const f of facturacion) {
      m.uber     += Number(f.uber_bruto || 0)
      m.glovo    += Number(f.glovo_bruto || 0)
      m.just_eat += Number(f.je_bruto || 0)
      m.web      += Number(f.web_bruto || 0)
      m.directa  += Number(f.directa_bruto || 0)
      ped.uber     += Number(f.uber_pedidos || 0)
      ped.glovo    += Number(f.glovo_pedidos || 0)
      ped.just_eat += Number(f.je_pedidos || 0)
      ped.web      += Number(f.web_pedidos || 0)
      ped.directa  += Number(f.directa_pedidos || 0)
    }
    return { bruto: m, pedidos: ped }
  }, [facturacion])

  const totalBruto = useMemo(
    () => Object.values(brutoPorCanal.bruto).reduce((a, v) => a + v, 0),
    [brutoPorCanal]
  )

  const totalPedidos = useMemo(
    () => facturacion.reduce((a, f) => a + Number(f.total_pedidos || 0), 0),
    [facturacion]
  )

  const meses = useMemo(() => {
    const set = new Set<string>()
    const cur = new Date(periodo.desde)
    while (cur <= periodo.hasta) {
      set.add(`${cur.getFullYear()}-${cur.getMonth() + 1}`)
      cur.setDate(cur.getDate() + 1)
    }
    return Array.from(set).map(s => {
      const [y, m] = s.split('-').map(Number)
      return { anio: y, mes: m }
    })
  }, [periodo])

  const [resumenes, setResumenes] = useState<Array<{
    plataforma: string; mes: number; año: number;
    bruto: number | null; comisiones: number | null;
    fees: number | null; cargos_promocion: number | null;
    neto_real_cobrado: number | null;
  }>>([])

  useEffect(() => {
    if (meses.length === 0) return
    let cancel = false
    ;(async () => {
      const conditions = meses.map(m => `and(mes.eq.${m.mes},año.eq.${m.anio})`).join(',')
      const { data } = await supabase
        .from('resumenes_plataforma_marca_mensual')
        .select('plataforma, mes, año, bruto, comisiones, fees, cargos_promocion, neto_real_cobrado')
        .or(conditions)
      if (cancel) return
      setResumenes((data ?? []) as any)
    })()
    return () => { cancel = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meses.map(m => `${m.anio}-${m.mes}`).join('|')])

  const datosPorCanal = useMemo<Record<string, CanalDatos>>(() => {
    const out: Record<string, CanalDatos> = {}
    const canalIds: Array<'uber'|'glovo'|'just_eat'|'web'|'directa'> = ['uber','glovo','just_eat','web','directa']
    for (const c of canalIds) {
      const filas = resumenes.filter(r => r.plataforma === c)
      const brutoFD = brutoPorCanal.bruto[c] ?? 0
      const pedidosFD = brutoPorCanal.pedidos[c] ?? 0
      let neto = 0
      let brutoCalc = 0
      if (filas.length > 0) {
        const tieneRealCobrado = filas.some(f => f.neto_real_cobrado != null)
        brutoCalc = filas.reduce((s, f) => s + (f.bruto ?? 0), 0)
        if (tieneRealCobrado) {
          neto = filas.reduce((s, f) => s + (f.neto_real_cobrado ?? 0), 0)
        } else {
          const com = filas.reduce((s, f) => s + (f.comisiones ?? 0), 0)
          const fee = filas.reduce((s, f) => s + (f.fees ?? 0), 0)
          const car = filas.reduce((s, f) => s + (f.cargos_promocion ?? 0), 0)
          const ivaCom = (com + fee + car) * 0.21
          neto = brutoCalc - com - fee - car - ivaCom
        }
      } else {
        if (c === 'directa') neto = brutoFD
        else if (c === 'web') neto = brutoFD * 0.95
        else neto = brutoFD * 0.70
      }
      const brutoFinal = filas.length > 0 ? brutoCalc : brutoFD
      const margenPct = brutoFinal > 0 ? (neto / brutoFinal) * 100 : 0
      out[c] = { bruto: brutoFinal, neto, margenPct, pedidos: pedidosFD }
    }
    return out
  }, [resumenes, brutoPorCanal])

  const totalNeto = useMemo(
    () => Object.values(datosPorCanal).reduce((a, c) => a + c.neto, 0),
    [datosPorCanal]
  )

  const margenNetoPct = totalBruto > 0 ? (totalNeto / totalBruto) * 100 : 0

  const gastosPorCategoria = useMemo(() => {
    const m: Partial<Record<Categoria, number>> = {}
    for (const g of gastos) {
      m[g.categoria] = (m[g.categoria] ?? 0) + Number(g.importe || 0)
    }
    return m
  }, [gastos])

  const totalFijos = useMemo(
    () => GASTOS_FIJOS.reduce((a, c) => a + (gastosPorCategoria[c] ?? 0), 0),
    [gastosPorCategoria]
  )

  const totalVariablesGasto = useMemo(
    () => GASTOS_VARIABLES.reduce((a, c) => a + (gastosPorCategoria[c] ?? 0), 0),
    [gastosPorCategoria]
  )

  const totalComisiones = totalBruto - totalNeto
  const totalVariables = totalVariablesGasto + totalComisiones

  const margenContribucion = totalBruto - totalVariables
  const margenContribPct = totalBruto > 0 ? (margenContribucion / totalBruto) * 100 : 0
  const peMensual = margenContribPct > 0 ? totalFijos / (margenContribPct / 100) : null

  const beneficio = totalBruto - totalVariables - totalFijos
  const ebitdaPct = totalBruto > 0 ? (beneficio / totalBruto) * 100 : 0

  const diasOperativos = useMemo(
    () => diasOperativosEnRango(periodo.desde, periodo.hasta) || 1,
    [diasOperativosEnRango, periodo.desde, periodo.hasta]
  )

  const brutoMedioDiario = totalBruto / diasOperativos

  const diaCubreInfo = useMemo(() => {
    if (!peMensual || brutoMedioDiario <= 0) {
      return { fecha: null as Date | null, diasNecesarios: null as number | null, pasaElMes: false }
    }
    const diasNecesarios = Math.ceil(peMensual / brutoMedioDiario)
    const inicioMes = new Date(periodo.desde.getFullYear(), periodo.desde.getMonth(), 1)
    const cur = new Date(inicioMes)
    let contados = 0
    let safety = 0
    while (contados < diasNecesarios && safety < 365) {
      if (diasOperativosEnRango(cur, cur) === 1) contados++
      if (contados >= diasNecesarios) break
      cur.setDate(cur.getDate() + 1)
      safety++
    }
    const finMes = new Date(periodo.desde.getFullYear(), periodo.desde.getMonth() + 1, 0)
    return { fecha: cur, diasNecesarios, pasaElMes: cur > finMes }
  }, [peMensual, brutoMedioDiario, periodo.desde, diasOperativosEnRango])

  const estado: 'cubre' | 'ajustado' | 'pierde' =
    peMensual == null ? 'pierde'
      : totalBruto >= peMensual * 1.05 ? 'cubre'
      : totalBruto >= peMensual ? 'ajustado'
      : 'pierde'

  const colorEstado = estado === 'cubre' ? VERDE : estado === 'ajustado' ? AMBAR : ERR

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{
            color: ROJO,
            fontFamily: OSWALD,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '3px',
            margin: 0,
            textTransform: 'uppercase',
          }}>
            PUNTO DE EQUILIBRIO
          </h2>
          <span style={{ fontFamily: LEXEND, fontSize: 13, color: '#7a8090', display: 'block', marginTop: 4 }}>
            {fmtFechaCorta(periodo.desde.toISOString().slice(0,10))} — {fmtFechaCorta(periodo.hasta.toISOString().slice(0,10))}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SelectorFechaUniversal
            nombreModulo="punto_equilibrio"
            defaultOpcion="mes_en_curso"
            onChange={(desde, hasta, label) => {
              setPeriodoDesde(desde)
              setPeriodoHasta(hasta)
              setPeriodoLabel(label)
            }}
          />
        </div>
      </div>

      <TabsPastilla
        tabs={[
          { id: 'resumen', label: 'Resumen' },
          { id: 'simulador', label: 'Simulador' },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {error && (
        <div style={{ background: '#FCEBEB', border: `1px solid ${ROJO}`, color: '#A32D2D', padding: 16, borderRadius: 8, fontFamily: FONT.body, fontSize: 13, marginTop: 16 }}>
          Error: {error}
        </div>
      )}

      {loading && !error && (
        <div style={{ padding: 40, color: T.mut, fontFamily: FONT.body }}>Cargando datos reales...</div>
      )}

      {!loading && !error && tab === 'resumen' && (
        <TabResumen
          totalBruto={totalBruto}
          totalNeto={totalNeto}
          totalPedidos={totalPedidos}
          totalFijos={totalFijos}
          totalVariablesGasto={totalVariablesGasto}
          totalComisiones={totalComisiones}
          totalVariables={totalVariables}
          margenContribPct={margenContribPct}
          margenNetoPct={margenNetoPct}
          peMensual={peMensual}
          diaCubreInfo={diaCubreInfo}
          datosPorCanal={datosPorCanal}
          gastosPorCategoria={gastosPorCategoria}
          diasOperativos={diasOperativos}
          brutoMedioDiario={brutoMedioDiario}
          colorEstado={colorEstado}
          beneficio={beneficio}
          ebitdaPct={ebitdaPct}
          periodoDesde={periodo.desde}
        />
      )}

      {!loading && !error && tab === 'simulador' && (
        <TabSimulador
          totalBruto={totalBruto}
          totalFijos={totalFijos}
          totalVariables={totalVariables}
          margenContribPct={margenContribPct}
          peMensual={peMensual}
          diasOperativos={diasOperativos}
          totalPedidos={totalPedidos}
          datosPorCanal={datosPorCanal}
          brutoMedioDiario={brutoMedioDiario}
        />
      )}
    </div>
  )
}

interface TabResumenProps {
  totalBruto: number
  totalNeto: number
  totalPedidos: number
  totalFijos: number
  totalVariablesGasto: number
  totalComisiones: number
  totalVariables: number
  margenContribPct: number
  margenNetoPct: number
  peMensual: number | null
  diaCubreInfo: { fecha: Date | null; diasNecesarios: number | null; pasaElMes: boolean }
  datosPorCanal: Record<string, CanalDatos>
  gastosPorCategoria: Partial<Record<Categoria, number>>
  diasOperativos: number
  brutoMedioDiario: number
  colorEstado: string
  beneficio: number
  ebitdaPct: number
  periodoDesde: Date
}

function TabResumen(p: TabResumenProps) {
  const filasFijos = GASTOS_FIJOS
    .map(cat => ({
      label: CATEGORIA_NOMBRE[cat],
      valor: p.gastosPorCategoria[cat] ?? 0,
      color: CATEGORIA_COLOR[cat],
    }))
    .filter(f => f.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  const filasVariables = [
    ...GASTOS_VARIABLES.map(cat => ({
      label: CATEGORIA_NOMBRE[cat],
      valor: p.gastosPorCategoria[cat] ?? 0,
      color: CATEGORIA_COLOR[cat],
    })),
    { label: 'Comisiones plataformas', valor: p.totalComisiones, color: '#F26B1F' },
  ].filter(f => f.valor > 0)
  .sort((a, b) => b.valor - a.valor)

  return (
    <div style={{ marginTop: 16 }}>
      {/* 3 cards estilo Panel Global */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14,
        marginBottom: 14,
      }}>
        <CardFacturacion
          totalBruto={p.totalBruto}
          totalNeto={p.totalNeto}
          margenNetoPct={p.margenNetoPct}
          datosPorCanal={p.datosPorCanal}
        />

        <CardPE
          peMensual={p.peMensual}
          totalBruto={p.totalBruto}
          diaCubreInfo={p.diaCubreInfo}
          colorEstado={p.colorEstado}
          brutoMedioDiario={p.brutoMedioDiario}
          periodoDesde={p.periodoDesde}
        />

        <CardResultado
          beneficio={p.beneficio}
          ebitdaPct={p.ebitdaPct}
          totalBruto={p.totalBruto}
          totalNeto={p.totalNeto}
          totalFijos={p.totalFijos}
          totalVariables={p.totalVariables}
        />
      </div>

      {/* 2 cards costes simplificadas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 14,
      }}>
        <CardCostes
          titulo="COSTES FIJOS"
          total={p.totalFijos}
          filas={filasFijos}
          totalBruto={p.totalBruto}
        />

        <CardCostes
          titulo="COSTES VARIABLES"
          total={p.totalVariables}
          filas={filasVariables}
          totalBruto={p.totalBruto}
        />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   CARD 1: FACTURACIÓN
   ───────────────────────────────────────────────────── */
function CardFacturacion({ totalBruto, totalNeto, margenNetoPct, datosPorCanal }: {
  totalBruto: number
  totalNeto: number
  margenNetoPct: number
  datosPorCanal: Record<string, CanalDatos>
}) {
  return (
    <div style={cardBig}>
      <div style={lbl}>FACTURACIÓN</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 32, fontWeight: 600, color: '#111111' }}>
            {fmtEur(totalBruto, { showEuro: false, decimals: 2 })}
          </div>
          <div style={lblXs}>BRUTO</div>
        </div>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 32, fontWeight: 600, color: VERDE }}>
            {fmtEur(totalNeto, { showEuro: false, decimals: 2 })}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: VERDE, textTransform: 'uppercase', fontWeight: 500 }}>
            NETO · {fmtPct(margenNetoPct, 1)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
        {CANAL_INFO.map(canal => {
          const datos = datosPorCanal[canal.id]
          const bruto = datos?.bruto ?? 0
          const neto = datos?.neto ?? 0
          const margen = datos?.margenPct ?? 0
          const pctMix = totalBruto > 0 ? (bruto / totalBruto) * 100 : 0

          return (
            <div key={canal.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: LEXEND, fontSize: 13, color: '#3a4050' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: canal.color }} />
                    {canal.label}
                  </span>
                  <span style={{ fontFamily: OSWALD, fontSize: 11, color: '#7a8090', letterSpacing: '0.5px' }}>
                    {fmtPct(pctMix, 1)}
                  </span>
                </div>
                <div style={{ height: 5, background: '#ebe8e2', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pctMix}%`, height: '100%', background: canal.color, transition: 'width 0.4s ease' }} />
                </div>
              </div>
              <div style={{ minWidth: 110, textAlign: 'right' }}>
                <div style={{ fontFamily: OSWALD, fontSize: 14, fontWeight: 600, color: '#111111' }}>
                  {fmtEur(bruto, { showEuro: false, decimals: 0 })}
                </div>
                <div style={{ fontFamily: LEXEND, fontSize: 10, color: VERDE }}>
                  {fmtEur(neto, { showEuro: false, decimals: 0 })} · {fmtPct(margen, 0)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   CARD 2: PUNTO DE EQUILIBRIO
   ───────────────────────────────────────────────────── */
function CardPE({ peMensual, totalBruto, diaCubreInfo, colorEstado, brutoMedioDiario, periodoDesde }: {
  peMensual: number | null
  totalBruto: number
  diaCubreInfo: { fecha: Date | null; diasNecesarios: number | null; pasaElMes: boolean }
  colorEstado: string
  brutoMedioDiario: number
  periodoDesde: Date
}) {
  const pctCubierto = peMensual ? Math.min(100, (totalBruto / peMensual) * 100) : 0
  const fechaPE = diaCubreInfo.fecha
  const mesPeriodo = periodoDesde.getMonth()
  const anioPeriodo = periodoDesde.getFullYear()

  let circuloLinea1 = '—'
  let circuloLinea2 = ''
  let circuloColor = colorEstado

  if (fechaPE && peMensual) {
    if (!diaCubreInfo.pasaElMes) {
      circuloLinea1 = String(fechaPE.getDate())
      circuloLinea2 = MESES_CORTO[fechaPE.getMonth()]
    } else {
      const mesesDelta = (fechaPE.getFullYear() - anioPeriodo) * 12 + (fechaPE.getMonth() - mesPeriodo)
      circuloLinea1 = `+${mesesDelta}M`
      circuloLinea2 = MESES_CORTO[fechaPE.getMonth()]
      circuloColor = ERR
    }
  } else {
    circuloColor = ERR
  }

  const faltan = peMensual ? Math.max(0, peMensual - totalBruto) : 0

  return (
    <div style={cardBig}>
      <div style={lbl}>PUNTO DE EQUILIBRIO</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 32, fontWeight: 600, color: '#111111' }}>
            {peMensual != null ? fmtEur(peMensual, { showEuro: false, decimals: 0 }) : '—'}
          </div>
          <div style={lblXs}>BRUTO PARA NO PERDER</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#7a8090', margin: '10px 0 16px', fontFamily: LEXEND }}>
        {peMensual != null && totalBruto < peMensual
          ? <>Faltan <strong style={{ color: colorEstado }}>{fmtEur(faltan, { showEuro: false, decimals: 0 })}</strong> de bruto</>
          : peMensual != null
          ? <>Cubierto · sobran {fmtEur(totalBruto - peMensual, { showEuro: false, decimals: 0 })}</>
          : 'Datos insuficientes'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 76, height: 76, borderRadius: '50%',
          background: circuloColor, color: '#fff',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 600, lineHeight: 1 }}>
            {circuloLinea1}
          </div>
          {circuloLinea2 && (
            <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 500, letterSpacing: 1, marginTop: 4 }}>
              {circuloLinea2}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: LEXEND, fontSize: 12, color: '#3a4050', marginBottom: 4 }}>
            Día estimado en que se cubre el PE
          </div>
          <div style={{ fontFamily: LEXEND, fontSize: 11, color: '#7a8090' }}>
            Ritmo actual: {fmtEur(brutoMedioDiario, { showEuro: false, decimals: 0 })} / día
          </div>
        </div>
      </div>

      {peMensual != null && (
        <>
          <div style={{
            height: 8, borderRadius: 4, background: '#ebe8e2',
            overflow: 'hidden', marginTop: 18,
          }}>
            <div style={{
              width: `${pctCubierto}%`,
              height: '100%',
              background: colorEstado,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND, fontSize: 11, color: '#7a8090', marginTop: 6 }}>
            <span>Cubierto</span>
            <strong style={{ color: colorEstado, fontFamily: OSWALD, fontSize: 12 }}>{fmtPct(pctCubierto, 1)}</strong>
          </div>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   CARD 3: RESULTADO
   ───────────────────────────────────────────────────── */
function CardResultado({ beneficio, ebitdaPct, totalBruto, totalNeto, totalFijos, totalVariables }: {
  beneficio: number
  ebitdaPct: number
  totalBruto: number
  totalNeto: number
  totalFijos: number
  totalVariables: number
}) {
  const colorBen = beneficio >= 0 ? VERDE : ERR

  const filas = [
    { label: 'Bruto',           valor: totalBruto,       color: '#111111' },
    { label: 'Neto estimado',   valor: totalNeto,        color: VERDE },
    { label: 'Costes variables', valor: -totalVariables, color: '#3a4050' },
    { label: 'Costes fijos',    valor: -totalFijos,      color: '#3a4050' },
  ]

  return (
    <div style={cardBig}>
      <div style={lbl}>RESULTADO</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 32, fontWeight: 600, color: colorBen }}>
            {fmtEur(beneficio, { showEuro: false, decimals: 0, signed: true })}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: colorBen, textTransform: 'uppercase', fontWeight: 500 }}>
            BENEFICIO · EBITDA
          </div>
        </div>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 600, color: colorBen }}>
            {fmtPct(ebitdaPct, 1)}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: '#7a8090', textTransform: 'uppercase', fontWeight: 500 }}>
            % s/bruto
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filas.map((f, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LEXEND, fontSize: 13 }}>
            <span style={{ color: '#3a4050' }}>{f.label}</span>
            <span style={{ fontFamily: OSWALD, fontWeight: 600, color: f.color }}>
              {fmtEur(f.valor, { showEuro: false, decimals: 0, signed: f.valor < 0 })}
            </span>
          </div>
        ))}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: LEXEND, fontSize: 13, paddingTop: 8,
          borderTop: '0.5px solid #d0c8bc',
        }}>
          <span style={{ color: '#3a4050', fontWeight: 600 }}>Resultado</span>
          <span style={{ fontFamily: OSWALD, fontWeight: 600, color: colorBen }}>
            {fmtEur(beneficio, { showEuro: false, decimals: 0, signed: true })}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   CARDS COSTES (FIJOS / VARIABLES)
   Sin "Sin IVA · plan contable", filas limpias sin separadores
   ───────────────────────────────────────────────────── */
function CardCostes({ titulo, total, filas, totalBruto }: {
  titulo: string
  total: number
  filas: Array<{ label: string; valor: number; color: string }>
  totalBruto: number
}) {
  const pctSobreBruto = totalBruto > 0 ? (total / totalBruto) * 100 : 0

  return (
    <div style={cardBig}>
      <div style={lbl}>{titulo}</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 32, fontWeight: 600, color: '#111111' }}>
            {fmtEur(total, { showEuro: false, decimals: 0 })}
          </div>
          <div style={lblXs}>TOTAL</div>
        </div>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 600, color: '#7a8090' }}>
            {fmtPct(pctSobreBruto, 1)}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: '#7a8090', textTransform: 'uppercase', fontWeight: 500 }}>
            S/BRUTO
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filas.length === 0 && (
          <div style={{ fontFamily: LEXEND, fontSize: 12, color: '#7a8090', fontStyle: 'italic', padding: '8px 0' }}>
            Sin gastos en el periodo
          </div>
        )}
        {filas.map((f, i) => {
          const pct = totalBruto > 0 ? (f.valor / totalBruto) * 100 : 0
          return (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              alignItems: 'center',
              gap: 12,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: LEXEND, fontSize: 13, color: '#3a4050' }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: f.color }} />
                {f.label}
              </span>
              <span style={{ fontFamily: OSWALD, fontSize: 14, fontWeight: 600, color: '#111111', minWidth: 90, textAlign: 'right' }}>
                {fmtEur(f.valor, { showEuro: false, decimals: 0 })}
              </span>
              <span style={{ fontFamily: OSWALD, fontSize: 11, color: '#7a8090', minWidth: 50, textAlign: 'right' }}>
                {fmtPct(pct, 1)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   SIMULADOR (sin cambios funcionales — solo mantenido)
   ───────────────────────────────────────────────────── */
interface Escenario {
  id: string
  titulo: string
  preset: PresetKey
  ticketMedio: number
  margenPct: number
  fijos: number
  pedidosMes: number
  bloqueado?: boolean
}

type PresetKey =
  | 'base' | 'subir-ticket' | 'bajar-ticket' | 'mas-pedidos' | 'menos-pedidos'
  | 'add-cocinero' | 'gastar-mas' | 'gastar-menos' | 'subir-margen' | 'bajar-margen' | 'custom'

const PRESETS: Array<{ key: PresetKey; label: string; tipo: 'mejora' | 'empeora' | 'mixto' | 'base' }> = [
  { key: 'base',           label: '— Datos reales (base)',          tipo: 'base' },
  { key: 'subir-ticket',   label: '↑ Subir ticket medio (+1,00)',   tipo: 'mejora' },
  { key: 'bajar-ticket',   label: '↓ Bajar ticket medio (−1,00)',   tipo: 'empeora' },
  { key: 'mas-pedidos',    label: '↑ +20% pedidos',                 tipo: 'mejora' },
  { key: 'menos-pedidos',  label: '↓ −20% pedidos',                 tipo: 'empeora' },
  { key: 'add-cocinero',   label: '+ Añadir cocinero (+1.800 fijo)', tipo: 'empeora' },
  { key: 'gastar-mas',     label: '↑ Gastar más (+10% fijos)',      tipo: 'empeora' },
  { key: 'gastar-menos',   label: '↓ Gastar menos (−10% fijos)',    tipo: 'mejora' },
  { key: 'subir-margen',   label: '↑ Subir margen +3pp',            tipo: 'mejora' },
  { key: 'bajar-margen',   label: '↓ Bajar margen −3pp',            tipo: 'empeora' },
  { key: 'custom',         label: '✎ Personalizado',                tipo: 'mixto' },
]

function aplicarPreset(preset: PresetKey, base: { ticketMedio: number; margenPct: number; fijos: number; pedidos: number }): Omit<Escenario, 'id' | 'titulo' | 'preset'> {
  switch (preset) {
    case 'subir-ticket':   return { ticketMedio: base.ticketMedio + 1, margenPct: base.margenPct, fijos: base.fijos, pedidosMes: base.pedidos }
    case 'bajar-ticket':   return { ticketMedio: Math.max(0, base.ticketMedio - 1), margenPct: base.margenPct, fijos: base.fijos, pedidosMes: base.pedidos }
    case 'mas-pedidos':    return { ticketMedio: base.ticketMedio, margenPct: base.margenPct, fijos: base.fijos, pedidosMes: Math.round(base.pedidos * 1.2) }
    case 'menos-pedidos':  return { ticketMedio: base.ticketMedio, margenPct: base.margenPct, fijos: base.fijos, pedidosMes: Math.round(base.pedidos * 0.8) }
    case 'add-cocinero':   return { ticketMedio: base.ticketMedio, margenPct: base.margenPct, fijos: base.fijos + 1800, pedidosMes: base.pedidos }
    case 'gastar-mas':     return { ticketMedio: base.ticketMedio, margenPct: base.margenPct, fijos: base.fijos * 1.10, pedidosMes: base.pedidos }
    case 'gastar-menos':   return { ticketMedio: base.ticketMedio, margenPct: base.margenPct, fijos: base.fijos * 0.90, pedidosMes: base.pedidos }
    case 'subir-margen':   return { ticketMedio: base.ticketMedio, margenPct: base.margenPct + 3, fijos: base.fijos, pedidosMes: base.pedidos }
    case 'bajar-margen':   return { ticketMedio: base.ticketMedio, margenPct: Math.max(0.1, base.margenPct - 3), fijos: base.fijos, pedidosMes: base.pedidos }
    default:               return { ticketMedio: base.ticketMedio, margenPct: base.margenPct, fijos: base.fijos, pedidosMes: base.pedidos }
  }
}

function TabSimulador(p: {
  totalBruto: number
  totalFijos: number
  totalVariables: number
  margenContribPct: number
  peMensual: number | null
  diasOperativos: number
  totalPedidos: number
  datosPorCanal: Record<string, CanalDatos>
  brutoMedioDiario: number
}) {
  const ticketMedioBase = p.totalPedidos > 0 ? p.totalBruto / p.totalPedidos : 0
  const baseValores = { ticketMedio: ticketMedioBase, margenPct: p.margenContribPct, fijos: p.totalFijos, pedidos: p.totalPedidos }

  const baseEscenario: Escenario = {
    id: 'base',
    titulo: 'Datos reales del periodo',
    preset: 'base',
    ticketMedio: ticketMedioBase,
    margenPct: p.margenContribPct,
    fijos: p.totalFijos,
    pedidosMes: p.totalPedidos,
    bloqueado: true,
  }

  const [escenarios, setEscenarios] = useState<Escenario[]>(() => [
    baseEscenario,
    { id: 'esc-1', titulo: 'Subir ticket medio', preset: 'subir-ticket', ...aplicarPreset('subir-ticket', baseValores) },
    { id: 'esc-2', titulo: 'Añadir cocinero',    preset: 'add-cocinero', ...aplicarPreset('add-cocinero', baseValores) },
    { id: 'esc-3', titulo: '+20% pedidos',       preset: 'mas-pedidos',  ...aplicarPreset('mas-pedidos', baseValores) },
  ])

  useEffect(() => {
    setEscenarios(prev => {
      if (prev.length === 0) return prev
      const updated = prev.map(e => {
        if (e.id === 'base') return baseEscenario
        if (e.preset === 'custom') return e
        return { ...e, ...aplicarPreset(e.preset, baseValores) }
      })
      return updated
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.totalBruto, p.totalFijos, p.margenContribPct, p.totalPedidos])

  function cambiarPreset(id: string, preset: PresetKey) {
    setEscenarios(prev => prev.map(e => {
      if (e.id !== id) return e
      const valores = aplicarPreset(preset, baseValores)
      const titulo = PRESETS.find(p => p.key === preset)?.label.replace(/^[↑↓+✎—]\s*/, '').replace(/\s*\(.*\)$/, '') ?? 'Personalizado'
      return { ...e, preset, titulo, ...valores }
    }))
  }

  function actualizarEscenario(id: string, campo: keyof Escenario, valor: number) {
    setEscenarios(prev => prev.map(e => e.id === id ? { ...e, [campo]: valor, preset: 'custom' as PresetKey } : e))
  }

  function añadirEscenario() {
    setEscenarios(prev => {
      if (prev.length >= 6) return prev
      const id = `esc-${Date.now()}`
      return [...prev, { id, titulo: 'Personalizado', preset: 'custom', ticketMedio: ticketMedioBase, margenPct: p.margenContribPct, fijos: p.totalFijos, pedidosMes: p.totalPedidos }]
    })
  }

  function eliminarEscenario(id: string) {
    if (id === 'base') return
    setEscenarios(prev => prev.filter(e => e.id !== id))
  }

  function calcularEscenario(e: Escenario) {
    const brutoEsperado = e.ticketMedio * e.pedidosMes
    const peValor = e.margenPct > 0 ? e.fijos / (e.margenPct / 100) : null
    const diasNecesarios = peValor && p.brutoMedioDiario > 0 ? Math.ceil(peValor / p.brutoMedioDiario) : null
    const pedidosNecesarios = peValor && e.ticketMedio > 0 ? Math.ceil(peValor / e.ticketMedio) : null
    const beneficio = peValor != null ? brutoEsperado - peValor : 0
    return { peValor, diasNecesarios, pedidosNecesarios, brutoEsperado, beneficio }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 14,
      }}>
        {escenarios.map(e => {
          const calc = calcularEscenario(e)
          const calcBase = calcularEscenario(baseEscenario)
          return (
            <CardEscenario
              key={e.id}
              escenario={e}
              calc={calc}
              calcBase={calcBase}
              onChangePreset={(preset) => cambiarPreset(e.id, preset)}
              onChange={(campo, valor) => actualizarEscenario(e.id, campo, valor)}
              onDelete={() => eliminarEscenario(e.id)}
            />
          )
        })}

        {escenarios.length < 6 && (
          <button
            onClick={añadirEscenario}
            style={{
              ...cardBig,
              border: '1.5px dashed #d0c8bc',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              minHeight: 200,
              background: 'transparent',
              fontFamily: OSWALD,
              color: '#7a8090',
              fontSize: 14,
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ fontSize: 32, fontWeight: 300 }}>+</span>
            Añadir escenario
          </button>
        )}
      </div>
    </div>
  )
}

function CardEscenario({ escenario, calc, calcBase, onChangePreset, onChange, onDelete }: {
  escenario: Escenario
  calc: { peValor: number | null; diasNecesarios: number | null; pedidosNecesarios: number | null; brutoEsperado: number; beneficio: number }
  calcBase: { peValor: number | null; diasNecesarios: number | null; pedidosNecesarios: number | null; brutoEsperado: number; beneficio: number }
  onChangePreset: (preset: PresetKey) => void
  onChange: (campo: keyof Escenario, valor: number) => void
  onDelete: () => void
}) {
  const e = escenario

  const tipo = PRESETS.find(p => p.key === e.preset)?.tipo ?? 'mixto'
  const PILL_BG: Record<string, string> = {
    base: '#3a4050', mejora: VERDE, empeora: ERR, mixto: AMBAR,
  }
  const PILL_LABEL: Record<string, string> = {
    base: 'Base', mejora: 'Mejora', empeora: 'Empeora', mixto: 'Custom',
  }

  const deltaPE = calc.peValor != null && calcBase.peValor != null ? calc.peValor - calcBase.peValor : null
  const deltaBeneficio = calc.beneficio - calcBase.beneficio

  return (
    <div style={{
      ...cardBig,
      borderWidth: e.bloqueado ? '1.5px' : '0.5px',
      borderColor: e.bloqueado ? '#3a4050' : '#d0c8bc',
      borderStyle: 'solid',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          {e.bloqueado ? (
            <div style={{
              fontFamily: OSWALD, fontSize: 13, fontWeight: 600,
              letterSpacing: '1px', textTransform: 'uppercase', color: '#111111',
            }}>
              {e.titulo}
            </div>
          ) : (
            <select
              value={e.preset}
              onChange={(ev) => onChangePreset(ev.target.value as PresetKey)}
              style={{
                fontFamily: OSWALD, fontSize: 13, fontWeight: 600,
                letterSpacing: '1px', textTransform: 'uppercase', color: '#111111',
                background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 6,
                padding: '4px 8px', cursor: 'pointer', width: '100%',
              }}
            >
              {PRESETS.filter(p => p.key !== 'base').map(p => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <span style={{
            fontFamily: OSWALD, fontSize: 10, fontWeight: 500,
            letterSpacing: '1px', padding: '3px 8px', borderRadius: 4,
            textTransform: 'uppercase', background: PILL_BG[tipo], color: '#fff',
          }}>
            {PILL_LABEL[tipo]}
          </span>
          {!e.bloqueado && (
            <button onClick={onDelete} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#7a8090', fontSize: 18, lineHeight: 1, padding: '0 4px',
            }} title="Eliminar escenario">×</button>
          )}
        </div>
      </div>

      <RowInput label="Ticket medio" value={e.ticketMedio} decimales={2} onChange={v => onChange('ticketMedio', v)} bloqueado={e.bloqueado} />
      <RowInput label="Margen contribución (%)" value={e.margenPct} decimales={2} onChange={v => onChange('margenPct', v)} bloqueado={e.bloqueado} />
      <RowInput label="Costes fijos" value={e.fijos} decimales={2} onChange={v => onChange('fijos', v)} bloqueado={e.bloqueado} />
      <RowInput label="Pedidos mes" value={e.pedidosMes} decimales={0} onChange={v => onChange('pedidosMes', v)} bloqueado={e.bloqueado} />

      <div style={{ background: '#ebe8e2', borderRadius: 10, padding: 14, marginTop: 14 }}>
        <RowResultado label="Bruto esperado" valor={fmtEur(calc.brutoEsperado, { showEuro: false, decimals: 0 })} color="#111111" />
        <RowResultado label="Punto equilibrio" valor={calc.peValor != null ? fmtEur(calc.peValor, { showEuro: false, decimals: 0 }) : '—'} color="#111111" />
        <RowResultado label="Pedidos para PE" valor={calc.pedidosNecesarios != null ? fmtEur(calc.pedidosNecesarios, { showEuro: false, decimals: 0 }) : '—'} color="#111111" />
        <RowResultado label="Días para PE" valor={calc.diasNecesarios != null ? `${fmtEur(calc.diasNecesarios, { showEuro: false, decimals: 0 })} días` : '—'} color="#111111" />
        <RowResultado
          label="Beneficio esperado"
          valor={fmtEur(calc.beneficio, { showEuro: false, decimals: 0, signed: true })}
          color={calc.beneficio >= 0 ? VERDE : ERR}
          big
        />
        {!e.bloqueado && deltaPE != null && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginTop: 10, paddingTop: 8, borderTop: '0.5px solid #d0c8bc',
          }}>
            <span style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: '#7a8090' }}>
              Vs base · beneficio
            </span>
            <span style={{ fontFamily: OSWALD, fontSize: 14, fontWeight: 600, color: deltaBeneficio > 0 ? VERDE : deltaBeneficio < 0 ? ERR : '#7a8090' }}>
              {fmtEur(deltaBeneficio, { showEuro: false, decimals: 0, signed: true })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function RowResultado({ label, valor, color, big }: { label: string; valor: string; color: string; big?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      marginBottom: 5,
    }}>
      <span style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', color: '#7a8090' }}>
        {label}
      </span>
      <span style={{ fontFamily: OSWALD, fontSize: big ? 22 : 15, fontWeight: 600, color }}>
        {valor}
      </span>
    </div>
  )
}

function RowInput({ label, value, decimales, onChange, bloqueado }: {
  label: string
  value: number
  decimales: number
  onChange: (v: number) => void
  bloqueado?: boolean
}) {
  const styleInput: CSSProperties = {
    width: '100%', padding: '6px 10px',
    border: '0.5px solid #d0c8bc',
    borderRadius: 6, fontSize: 13,
    fontFamily: OSWALD, fontWeight: 500,
    background: bloqueado ? '#ebe8e2' : '#fff',
    color: bloqueado ? '#7a8090' : '#111111',
    textAlign: 'right',
    outline: 'none',
    cursor: bloqueado ? 'not-allowed' : 'text',
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10, alignItems: 'center', padding: '5px 0' }}>
      <span style={{ fontFamily: LEXEND, fontSize: 12, color: '#3a4050' }}>{label}</span>
      <input
        type="number"
        step={decimales > 0 ? 0.01 : 1}
        value={Number.isFinite(value) ? value.toFixed(decimales) : ''}
        disabled={bloqueado}
        onChange={(ev) => {
          const n = parseFloat(ev.target.value)
          if (!isNaN(n)) onChange(n)
        }}
        style={styleInput}
      />
    </div>
  )
}
