import { useState, useEffect, Suspense, lazy } from 'react'
import TabsPastilla from '@/components/ui/TabsPastilla'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import { supabase } from '@/lib/supabase'
import { fechaLocalStr } from '@/utils/fechaLocal'
import { COLOR, COLORS, OSWALD, LEXEND, CARDS } from '@/components/panel/resumen/tokens'
import BandejaEntrada from '@/components/documentacion/BandejaEntrada'

// Monta los módulos EXISTENTES sin tocar su lógica (solo se reubican como pestañas).
const OcrConToast = lazy(() => import('@/pages/OcrConToast'))
const ImportarVentas = lazy(() => import('@/pages/ImportarVentas'))
const Conciliacion = lazy(() => import('@/pages/Conciliacion'))
const GestionFacturas = lazy(() => import('@/pages/finanzas/GestionFacturas'))

type Tab = 'bandeja' | 'facturas' | 'ventas' | 'conciliacion' | 'documental'

const STORAGE_KEY = 'documentacion:tab'

function loadTab(): Tab {
  try {
    const r = sessionStorage.getItem(STORAGE_KEY)
    if (r === 'bandeja' || r === 'facturas' || r === 'ventas' || r === 'conciliacion' || r === 'documental') return r
  } catch { /* swallow */ }
  return 'bandeja'
}

interface KpiRow {
  movimientos_total: number
  movimientos_con_factura: number
  pct_cobertura: number
  facturas_total: number
  facturas_sin_categoria: number
  facturas_posible_duplicado: number
  facturas_aviso_aritmetica: number
}

const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: true })

// ── Cards-resumen comunes (estilo canónico Panel Global) ───────────────────
function CardsResumen({ kpi }: { kpi: KpiRow | null }) {
  if (!kpi) return null
  const pct = Number(kpi.pct_cobertura ?? 0)
  const pctColor = pct >= 80 ? COLORS.ok : pct >= 50 ? COLORS.warn : COLORS.err

  const cards: { label: string; value: string | number; sub?: string; color: string }[] = [
    { label: 'Facturas', value: kpi.facturas_total, sub: 'en el sistema', color: COLORS.pri },
    { label: 'Cuadradas', value: `${kpi.movimientos_con_factura}/${kpi.movimientos_total}`, sub: 'mov. con factura', color: COLORS.pri },
    { label: 'Cobertura', value: `${pct.toFixed(0)}%`, sub: 'conciliado', color: pctColor },
    { label: 'Sin categoría', value: kpi.facturas_sin_categoria, sub: kpi.facturas_sin_categoria > 0 ? 'por clasificar' : 'al día', color: kpi.facturas_sin_categoria > 0 ? COLORS.warn : COLORS.ok },
    { label: 'Duplicadas', value: kpi.facturas_posible_duplicado, sub: kpi.facturas_posible_duplicado > 0 ? 'a revisar' : 'limpio', color: kpi.facturas_posible_duplicado > 0 ? COLORS.warn : COLORS.ok },
    { label: 'Aviso IVA', value: kpi.facturas_aviso_aritmetica, sub: kpi.facturas_aviso_aritmetica > 0 ? 'a revisar' : 'cuadra', color: kpi.facturas_aviso_aritmetica > 0 ? COLORS.err : COLORS.ok },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 12 }}>
      {cards.map((c) => (
        <div key={c.label} style={{ ...CARDS.std }}>
          <div style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 500, letterSpacing: '1.5px', color: COLORS.mut, textTransform: 'uppercase' }}>{c.label}</div>
          <div style={{ fontFamily: OSWALD, fontSize: 34, fontWeight: 600, color: c.color, lineHeight: 1.05, marginTop: 6 }}>{c.value}</div>
          {c.sub && <div style={{ fontFamily: LEXEND, fontSize: 11, color: COLORS.mut, marginTop: 4 }}>{c.sub}</div>}
        </div>
      ))}
    </div>
  )
}

// ── Frase-cabecera (MISMO estilo que Cashflow: titular gigante Oswald + frases
//    Oswald color semáforo). Batería propia, 2 frases: una grande, una pequeña. ──
function FraseCabecera({ kpi }: { kpi: KpiRow | null }) {
  if (!kpi) return null
  const pct = Number(kpi.pct_cobertura ?? 0)
  const POS = COLORS.ok, WARN = COLORS.warn, NEG = COLORS.err
  const pctColor = pct >= 80 ? POS : pct >= 50 ? WARN : NEG

  const grande = pct >= 80
    ? 'Casi todo cuadrado, el papeleo te va al día.'
    : pct >= 50
      ? 'Vas por buen camino, todavía queda parte por casar.'
      : 'Aún queda bastante por conciliar este periodo.'

  let pequena: string
  let pequenaColor: string
  if (kpi.facturas_sin_categoria > 0) {
    pequena = `${kpi.facturas_sin_categoria} sin categoría por clasificar para que el P&L cuadre.`
    pequenaColor = WARN
  } else if (kpi.facturas_posible_duplicado > 0) {
    pequena = `${kpi.facturas_posible_duplicado} posible${kpi.facturas_posible_duplicado > 1 ? 's' : ''} duplicado${kpi.facturas_posible_duplicado > 1 ? 's' : ''} esperando que los revises.`
    pequenaColor = WARN
  } else if (kpi.facturas_aviso_aritmetica > 0) {
    pequena = `${kpi.facturas_aviso_aritmetica} con aviso de IVA por revisar.`
    pequenaColor = NEG
  } else {
    pequena = 'Sin nada pendiente: ni sin categoría, ni duplicados, ni avisos.'
    pequenaColor = POS
  }

  return (
    <div style={{ ...CARDS.big, marginBottom: 12 }}>
      <div style={{ fontFamily: OSWALD, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 600, lineHeight: 1.05 }}>
        CONCILIADO <span style={{ color: pctColor }}>{pct.toFixed(0)}%</span>
        <span style={{ color: COLORS.mut, fontSize: '0.42em', marginLeft: 10 }}>· {nf0(kpi.movimientos_con_factura)}/{nf0(kpi.movimientos_total)} movimientos con factura</span>
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontFamily: OSWALD, fontSize: 'clamp(16px,2.1vw,20px)', fontWeight: 600, color: pctColor, letterSpacing: '0.3px' }}>{grande}</div>
        <div style={{ fontFamily: OSWALD, fontSize: 'clamp(13px,1.5vw,15px)', fontWeight: 500, color: pequenaColor, letterSpacing: '0.3px' }}>{pequena}</div>
      </div>
    </div>
  )
}

export default function Documentacion() {
  const [tab, setTab] = useState<Tab>(loadTab())
  const cambiar = (t: Tab) => { setTab(t); try { sessionStorage.setItem(STORAGE_KEY, t) } catch { /* swallow */ } }

  const [desde, setDesde] = useState<Date>(new Date())
  const [hasta, setHasta] = useState<Date>(new Date())

  const [kpi, setKpi] = useState<KpiRow | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  useEffect(() => {
    let alive = true
    const cargar = () => {
      supabase
        .from('v_kpi_cobertura_conciliacion')
        .select('*')
        .then(({ data }) => { if (alive && data && data.length > 0) setKpi(data[0] as KpiRow) })
    }
    cargar()
    const t = setInterval(cargar, 30_000)
    return () => { alive = false; clearInterval(t) }
  }, [reloadTick])

  const desdeStr = fechaLocalStr(desde)
  const hastaStr = fechaLocalStr(hasta)

  return (
    <div style={{ background: COLOR.bgPagina, padding: '24px 28px', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ color: COLORS.redSL, fontFamily: OSWALD, fontSize: 22, fontWeight: 600, letterSpacing: '3px', margin: 0, textTransform: 'uppercase' }}>
          DOCUMENTACIÓN
        </h2>
        <SelectorFechaUniversal
          nombreModulo="documentacion"
          defaultOpcion="este_mes"
          onChange={(d, h) => { setDesde(d); setHasta(h) }}
        />
      </div>

      <FraseCabecera kpi={kpi} />
      <CardsResumen kpi={kpi} />

      <TabsPastilla
        tabs={[
          { id: 'bandeja', label: 'Bandeja entrada' },
          { id: 'facturas', label: 'Facturas' },
          { id: 'ventas', label: 'Ventas' },
          { id: 'conciliacion', label: 'Conciliación' },
          { id: 'documental', label: 'Gestor documental' },
        ]}
        activeId={tab}
        onChange={(id) => cambiar(id as Tab)}
      />

      <Suspense fallback={<div style={{ padding: 24, color: COLORS.mut, fontFamily: LEXEND }}>Cargando…</div>}>
        {tab === 'bandeja' && <BandejaEntrada desde={desdeStr} hasta={hastaStr} onProcesado={() => setReloadTick(x => x + 1)} />}
        {tab === 'facturas' && <OcrConToast periodoExterno={{ desde, hasta }} />}
        {tab === 'ventas' && <ImportarVentas />}
        {tab === 'conciliacion' && <Conciliacion periodoExterno={{ desde, hasta }} />}
        {tab === 'documental' && <GestionFacturas />}
      </Suspense>
    </div>
  )
}
