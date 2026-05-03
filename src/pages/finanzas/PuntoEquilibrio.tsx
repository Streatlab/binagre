/**
 * Punto de Equilibrio — refactor v3.1 — 3 may 2026
 *
 * Datos REALES, sin parámetros hardcoded:
 *   - Bruto + pedidos: facturacion_diario
 *   - Neto: resumenes_plataforma_marca_mensual (cuando hay) o estimación
 *   - Gastos: tabla `gastos` SIEMPRE SIN IVA (base_imponible)
 *   - 7 categorías canónicas: PRODUCTO=variable / RRHH+ALQUILER+MARKETING+INTERNET_VENTAS+SUMINISTROS+ADMIN_GENERALES=fijos
 *   - Días operativos: useCalendario
 *
 * Estilo: cards Panel Global (cardBig + lbl + kpiBig), bruto NEGRO + neto VERDE + margen %
 * Formato: SIEMPRE 2 decimales y separador de miles es-ES, sin símbolo €
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
  cardBig, lbl, lblXs, kpiBig, OSWALD, LEXEND, COLOR,
} from '@/components/panel/resumen/tokens'
import { fmtEur, fmtPct } from '@/lib/format'

const ROJO   = COLOR.rojoSL
const VERDE  = COLOR.verde
const AMBAR  = COLOR.ambar
const ERR    = COLOR.rojo

const MESES_CORTO = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']

const CANAL_INFO: Record<string, { id: 'uber'|'glovo'|'just_eat'|'web'|'directa'; label: string; color: string; bg: string; border: string }> = {
  'UBER EATS':  { id: 'uber',     label: 'UBER EATS', color: COLOR.verdeOscuro, bg: `${COLOR.uber}20`,    border: COLOR.uber },
  'GLOVO':      { id: 'glovo',    label: 'GLOVO',     color: COLOR.glovoDark,   bg: `${COLOR.glovo}30`,   border: 'rgba(200,180,0,0.30)' },
  'JUST EAT':   { id: 'just_eat', label: 'JUST EAT',  color: COLOR.jeDark,      bg: `${COLOR.je}20`,      border: COLOR.je },
  'WEB':        { id: 'web',      label: 'WEB',       color: COLOR.webDark,     bg: `${COLOR.webSL}10`,   border: `${COLOR.webSL}50` },
  'DIRECTA':    { id: 'directa',  label: 'DIRECTA',   color: COLOR.directaDark, bg: `${COLOR.directa}20`, border: COLOR.directa },
}

type Tab = 'resumen' | 'simulador'

interface CanalDatos {
  bruto: number
  neto: number
  margenPct: number
  pedidos: number
}

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

  /* useRunning con IVA SIN forzado (gastos en base_imponible) */
  const { loading, error, gastos, facturacion } = useRunning(
    periodo, anio, null, null, 'sin',
  )
  const { diasOperativosEnRango } = useCalendario()

  /* Bruto por canal real desde facturacion_diario */
  const brutoPorCanal = useMemo(() => {
    const m: Record<string, number> = { uber: 0, glovo: 0, just_eat: 0, web: 0, directa: 0 }
    for (const f of facturacion) {
      m.uber     += Number(f.uber_bruto || 0)
      m.glovo    += Number(f.glovo_bruto || 0)
      m.just_eat += Number(f.je_bruto || 0)
      m.web      += Number(f.web_bruto || 0)
      m.directa  += Number(f.directa_bruto || 0)
    }
    return m
  }, [facturacion])

  const totalBruto = useMemo(
    () => Object.values(brutoPorCanal).reduce((a, v) => a + v, 0),
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
      const brutoFD = brutoPorCanal[c] ?? 0
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
      out[c] = { bruto: brutoFinal, neto, margenPct, pedidos: 0 }
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
          estado={estado}
          colorEstado={colorEstado}
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
  estado: 'cubre' | 'ajustado' | 'pierde'
  colorEstado: string
  periodoDesde: Date
}

function TabResumen(p: TabResumenProps) {
  const ticketMedioBruto = p.totalPedidos > 0 ? p.totalBruto / p.totalPedidos : 0
  const ticketMedioNeto = p.totalPedidos > 0 ? p.totalNeto / p.totalPedidos : 0

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
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: 14,
        marginBottom: 14,
      }}>
        <CardIngresos
          totalBruto={p.totalBruto}
          totalNeto={p.totalNeto}
          margenNetoPct={p.margenNetoPct}
          totalPedidos={p.totalPedidos}
          ticketMedioBruto={ticketMedioBruto}
          ticketMedioNeto={ticketMedioNeto}
          datosPorCanal={p.datosPorCanal}
        />

        <CardPE
          peMensual={p.peMensual}
          totalBruto={p.totalBruto}
          diaCubreInfo={p.diaCubreInfo}
          colorEstado={p.colorEstado}
          estado={p.estado}
          diasOperativos={p.diasOperativos}
          brutoMedioDiario={p.brutoMedioDiario}
          margenContribPct={p.margenContribPct}
          totalPedidos={p.totalPedidos}
          ticketMedioBruto={ticketMedioBruto}
          periodoDesde={p.periodoDesde}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: 14,
      }}>
        <CardCostes
          titulo="COSTES FIJOS"
          subtitulo="Sin IVA · plan contable"
          total={p.totalFijos}
          filas={filasFijos}
          totalBruto={p.totalBruto}
        />

        <CardCostes
          titulo="COSTES VARIABLES"
          subtitulo={`Sin IVA · ${fmtPct(p.totalVariables / Math.max(1, p.totalBruto) * 100, 2)} sobre bruto · margen contrib. ${fmtPct(p.margenContribPct, 2)}`}
          total={p.totalVariables}
          filas={filasVariables}
          totalBruto={p.totalBruto}
        />
      </div>
    </div>
  )
}

function CardIngresos({ totalBruto, totalNeto, margenNetoPct, totalPedidos, ticketMedioBruto, ticketMedioNeto, datosPorCanal }: {
  totalBruto: number
  totalNeto: number
  margenNetoPct: number
  totalPedidos: number
  ticketMedioBruto: number
  ticketMedioNeto: number
  datosPorCanal: Record<string, CanalDatos>
}) {
  const canales: Array<keyof typeof CANAL_INFO> = ['UBER EATS', 'GLOVO', 'JUST EAT', 'WEB', 'DIRECTA']

  return (
    <div style={cardBig}>
      <div style={lbl}>INGRESOS DEL PERIODO</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...kpiBig, color: '#111111' }}>
            {fmtEur(totalBruto, { showEuro: false, decimals: 2 })}
          </div>
          <div style={lblXs}>BRUTO</div>
        </div>
        <div>
          <div style={{ ...kpiBig, color: VERDE }}>
            {fmtEur(totalNeto, { showEuro: false, decimals: 2 })}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: VERDE, textTransform: 'uppercase', fontWeight: 500 }}>
            NETO · {fmtPct(margenNetoPct, 2)}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#7a8090', marginTop: 10, marginBottom: 14, fontFamily: LEXEND }}>
        {fmtEur(totalPedidos, { showEuro: false, decimals: 0 })} pedidos · ticket medio {fmtEur(ticketMedioBruto, { showEuro: false, decimals: 2 })} bruto / {fmtEur(ticketMedioNeto, { showEuro: false, decimals: 2 })} neto
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {canales.map(canalKey => {
          const info = CANAL_INFO[canalKey]
          const datos = datosPorCanal[info.id]
          if (!datos || datos.bruto <= 0) return null
          const pctMix = totalBruto > 0 ? (datos.bruto / totalBruto) * 100 : 0
          return (
            <FilaCanal
              key={canalKey}
              label={info.label}
              bg={info.bg}
              border={info.border}
              colorLabel={info.color}
              bruto={datos.bruto}
              neto={datos.neto}
              margenPct={datos.margenPct}
              pctMix={pctMix}
            />
          )
        })}
      </div>
    </div>
  )
}

function FilaCanal({ label, bg, border, colorLabel, bruto, neto, margenPct, pctMix }: {
  label: string
  bg: string
  border: string
  colorLabel: string
  bruto: number
  neto: number
  margenPct: number
  pctMix: number
}) {
  return (
    <div style={{
      background: bg,
      border: `0.5px solid ${border}`,
      borderRadius: 12,
      padding: '10px 14px',
      display: 'grid',
      gridTemplateColumns: '1fr auto auto auto',
      alignItems: 'center',
      gap: 14,
    }}>
      <div>
        <div style={{ ...lblXs, color: colorLabel }}>{label}</div>
        <div style={{ fontFamily: LEXEND, fontSize: 11, color: '#7a8090', marginTop: 2 }}>
          {fmtPct(pctMix, 2)} del bruto
        </div>
      </div>

      <div style={{ textAlign: 'right', minWidth: 110 }}>
        <div style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: '#111111' }}>
          {fmtEur(bruto, { showEuro: false, decimals: 2 })}
        </div>
        <div style={{ fontSize: 10, color: '#3a4050', fontFamily: LEXEND }}>Bruto</div>
      </div>

      <div style={{ textAlign: 'right', minWidth: 110 }}>
        <div style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: VERDE }}>
          {fmtEur(neto, { showEuro: false, decimals: 2 })}
        </div>
        <div style={{ fontSize: 10, color: VERDE, fontFamily: LEXEND }}>Neto</div>
      </div>

      <div style={{ textAlign: 'right', minWidth: 70 }}>
        <div style={{ fontFamily: OSWALD, fontSize: 16, fontWeight: 600, color: VERDE }}>
          {fmtPct(margenPct, 2)}
        </div>
        <div style={{ fontSize: 10, color: '#7a8090', fontFamily: LEXEND }}>Margen</div>
      </div>
    </div>
  )
}

function CardPE(props: {
  peMensual: number | null
  totalBruto: number
  diaCubreInfo: { fecha: Date | null; diasNecesarios: number | null; pasaElMes: boolean }
  colorEstado: string
  estado: 'cubre' | 'ajustado' | 'pierde'
  diasOperativos: number
  brutoMedioDiario: number
  margenContribPct: number
  totalPedidos: number
  ticketMedioBruto: number
  periodoDesde: Date
}) {
  const { peMensual, totalBruto, diaCubreInfo, colorEstado, diasOperativos, brutoMedioDiario, margenContribPct, ticketMedioBruto, periodoDesde } = props

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

  const pedidosNecesarios = peMensual && ticketMedioBruto > 0 ? Math.ceil(peMensual / ticketMedioBruto) : null
  const diasNecesarios = diaCubreInfo.diasNecesarios

  return (
    <div style={{
      ...cardBig,
      background: 'linear-gradient(180deg, #fff 0%, #1D9E7508 100%)',
    }}>
      <div style={lbl}>PUNTO DE EQUILIBRIO</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...kpiBig, color: '#111111' }}>
            {peMensual != null ? fmtEur(peMensual, { showEuro: false, decimals: 2 }) : '—'}
          </div>
          <div style={lblXs}>BRUTO PARA NO PERDER</div>
        </div>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 600, color: VERDE }}>
            {fmtPct(margenContribPct, 2)}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: VERDE, textTransform: 'uppercase', fontWeight: 500 }}>
            MARGEN CONTRIBUCIÓN
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18 }}>
        <div style={{
          width: 86, height: 86, borderRadius: '50%',
          background: circuloColor, color: '#fff',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 600, lineHeight: 1 }}>
            {circuloLinea1}
          </div>
          {circuloLinea2 && (
            <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 500, letterSpacing: 1, marginTop: 4 }}>
              {circuloLinea2}
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: '#111111' }}>
              {pedidosNecesarios != null ? fmtEur(pedidosNecesarios, { showEuro: false, decimals: 0 }) : '—'}
            </div>
            <div style={lblXs}>PEDIDOS NECESARIOS</div>
          </div>
          <div>
            <div style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: '#111111' }}>
              {diasNecesarios != null ? `${fmtEur(diasNecesarios, { showEuro: false, decimals: 0 })} días` : '—'}
            </div>
            <div style={lblXs}>DÍAS NECESARIOS</div>
          </div>
          <div>
            <div style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: '#111111' }}>
              {fmtEur(brutoMedioDiario, { showEuro: false, decimals: 2 })}
            </div>
            <div style={lblXs}>BRUTO/DÍA REAL</div>
          </div>
          <div>
            <div style={{ fontFamily: OSWALD, fontSize: 18, fontWeight: 600, color: peMensual && peMensual > 0 ? '#111111' : '#7a8090' }}>
              {peMensual != null ? fmtEur(peMensual / diasOperativos, { showEuro: false, decimals: 2 }) : '—'}
            </div>
            <div style={lblXs}>BRUTO/DÍA OBJETIVO</div>
          </div>
        </div>
      </div>

      {peMensual != null && (
        <>
          <div style={{
            height: 8, borderRadius: 4, background: '#ebe8e2',
            overflow: 'hidden', marginTop: 16,
          }}>
            <div style={{
              width: `${pctCubierto}%`,
              height: '100%',
              background: colorEstado,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontFamily: LEXEND, fontSize: 12, color: '#3a4050', marginTop: 6 }}>
            <strong style={{ color: colorEstado }}>{fmtPct(pctCubierto, 2)} cubierto</strong>
          </div>
        </>
      )}
    </div>
  )
}

function CardCostes({ titulo, subtitulo, total, filas, totalBruto }: {
  titulo: string
  subtitulo: string
  total: number
  filas: Array<{ label: string; valor: number; color: string }>
  totalBruto: number
}) {
  return (
    <div style={cardBig}>
      <div style={lbl}>{titulo}</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...kpiBig, color: '#111111' }}>
            {fmtEur(total, { showEuro: false, decimals: 2 })}
          </div>
          <div style={lblXs}>TOTAL · SIN IVA</div>
        </div>
        <div>
          <div style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 600, color: '#7a8090' }}>
            {totalBruto > 0 ? fmtPct(total / totalBruto * 100, 2) : '—'}
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: '1.5px', color: '#7a8090', textTransform: 'uppercase', fontWeight: 500 }}>
            SOBRE BRUTO
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#7a8090', marginTop: 10, marginBottom: 14, fontFamily: LEXEND }}>
        {subtitulo}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {filas.length === 0 && (
          <div style={{ fontFamily: LEXEND, fontSize: 12, color: '#7a8090', fontStyle: 'italic', padding: '12px 0' }}>
            Sin gastos en el periodo seleccionado
          </div>
        )}
        {filas.map((f, i) => {
          const pctSobreBruto = totalBruto > 0 ? (f.valor / totalBruto) * 100 : 0
          return (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              alignItems: 'center',
              gap: 12,
              padding: '10px 0',
              borderBottom: i < filas.length - 1 ? '0.5px solid #ebe8e2' : 'none',
            }}>
              <span style={{ fontFamily: LEXEND, fontSize: 13, color: '#3a4050', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: f.color, display: 'inline-block' }} />
                {f.label}
              </span>
              <span style={{ fontFamily: OSWALD, fontSize: 16, fontWeight: 600, color: '#111111', minWidth: 110, textAlign: 'right' }}>
                {fmtEur(f.valor, { showEuro: false, decimals: 2 })}
              </span>
              <span style={{ fontFamily: OSWALD, fontSize: 13, fontWeight: 500, color: '#7a8090', minWidth: 70, textAlign: 'right' }}>
                {fmtPct(pctSobreBruto, 2)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
        <RowResultado label="Bruto esperado" valor={fmtEur(calc.brutoEsperado, { showEuro: false, decimals: 2 })} color="#111111" />
        <RowResultado label="Punto equilibrio" valor={calc.peValor != null ? fmtEur(calc.peValor, { showEuro: false, decimals: 2 }) : '—'} color="#111111" />
        <RowResultado label="Pedidos para PE" valor={calc.pedidosNecesarios != null ? fmtEur(calc.pedidosNecesarios, { showEuro: false, decimals: 0 }) : '—'} color="#111111" />
        <RowResultado label="Días para PE" valor={calc.diasNecesarios != null ? `${fmtEur(calc.diasNecesarios, { showEuro: false, decimals: 0 })} días` : '—'} color="#111111" />
        <RowResultado
          label="Beneficio esperado"
          valor={fmtEur(calc.beneficio, { showEuro: false, decimals: 2, signed: true })}
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
              {fmtEur(deltaBeneficio, { showEuro: false, decimals: 2, signed: true })}
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
