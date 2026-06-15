import { useState, useEffect, Suspense, lazy } from 'react'
import TabsPastilla from '@/components/ui/TabsPastilla'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import { supabase } from '@/lib/supabase'
import { fechaLocalStr } from '@/utils/fechaLocal'
import { COLORS, OSWALD, LEXEND, CARDS } from '@/components/panel/resumen/tokens'
import BandejaEntrada from '@/components/documentacion/BandejaEntrada'

// Monta los módulos EXISTENTES sin tocar su lógica (solo se reubican como pestañas).
const OcrConToast = lazy(() => import('@/pages/OcrConToast'))
const ImportarVentas = lazy(() => import('@/pages/ImportarVentas'))
const Conciliacion = lazy(() => import('@/pages/Conciliacion'))
const GestionFacturas = lazy(() => import('@/pages/finanzas/GestionFacturas'))

type Tab = 'bandeja' | 'facturas' | 'documental' | 'ventas' | 'conciliacion'

const STORAGE_KEY = 'documentacion:tab'

function loadTab(): Tab {
  try {
    const r = sessionStorage.getItem(STORAGE_KEY)
    if (r === 'bandeja' || r === 'facturas' || r === 'documental' || r === 'ventas' || r === 'conciliacion') return r
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 14 }}>
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

// ── Batería de frases (estilo Cashflow/Evolución, versión breve) ───────────
function FrasesDocumentacion({ kpi }: { kpi: KpiRow | null }) {
  if (!kpi) return null
  const pct = Number(kpi.pct_cobertura ?? 0)
  const pctColor = pct >= 80 ? COLORS.ok : pct >= 50 ? COLORS.warn : COLORS.err

  const titular = pct >= 80
    ? 'Casi todo cuadrado, vas muy bien.'
    : pct >= 50
      ? 'Vas por buen camino, aún queda parte por cuadrar.'
      : 'Hay bastante por conciliar todavía.'

  const frases: { texto: string; color: string }[] = []
  if (kpi.facturas_sin_categoria > 0) frases.push({ texto: `${kpi.facturas_sin_categoria} factura${kpi.facturas_sin_categoria > 1 ? 's' : ''} sin categoría: clasifícalas para que el P&L cuadre.`, color: COLORS.warn })
  else frases.push({ texto: 'Todas las facturas están categorizadas.', color: COLORS.ok })

  if (kpi.facturas_posible_duplicado > 0) frases.push({ texto: `${kpi.facturas_posible_duplicado} posible${kpi.facturas_posible_duplicado > 1 ? 's' : ''} duplicado${kpi.facturas_posible_duplicado > 1 ? 's' : ''} esperando revisión.`, color: COLORS.warn })
  if (kpi.facturas_aviso_aritmetica > 0) frases.push({ texto: `${kpi.facturas_aviso_aritmetica} factura${kpi.facturas_aviso_aritmetica > 1 ? 's' : ''} con aviso de IVA por revisar.`, color: COLORS.err })
  if (kpi.facturas_posible_duplicado === 0 && kpi.facturas_aviso_aritmetica === 0) frases.push({ texto: 'Sin duplicados ni avisos de IVA pendientes.', color: COLORS.ok })

  return (
    <div style={{ ...CARDS.big, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: OSWALD, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.mut }}>Conciliado</span>
        <span style={{ fontFamily: OSWALD, fontSize: 38, fontWeight: 600, color: pctColor, lineHeight: 1 }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ fontFamily: OSWALD, fontSize: 20, fontWeight: 500, color: pctColor, marginTop: 8 }}>{titular}</div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {frases.map((f, i) => (
          <div key={i} style={{ fontFamily: LEXEND, fontSize: 14, color: f.color }}>{f.texto}</div>
        ))}
      </div>
    </div>
  )
}

export default function Documentacion() {
  const [tab, setTab] = useState<Tab>(loadTab())
  const cambiar = (t: Tab) => { setTab(t); try { sessionStorage.setItem(STORAGE_KEY, t) } catch { /* swallow */ } }

  // Periodo global (selector copiado de Panel Global). Persiste y se comparte con
  // los módulos internos vía la clave global del propio SelectorFechaUniversal.
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
    <div style={{ background: COLORS.bg, padding: '24px 28px', minHeight: '100%' }}>
      {/* Cabecera con selector de fechas global (idéntico a Panel Global) */}
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

      {/* Cards-resumen comunes + frases */}
      <CardsResumen kpi={kpi} />
      <FrasesDocumentacion kpi={kpi} />

      <TabsPastilla
        tabs={[
          { id: 'bandeja', label: 'Bandeja entrada' },
          { id: 'facturas', label: 'Facturas' },
          { id: 'documental', label: 'Gestor documental' },
          { id: 'ventas', label: 'Ventas' },
          { id: 'conciliacion', label: 'Conciliación' },
        ]}
        activeId={tab}
        onChange={(id) => cambiar(id as Tab)}
      />

      <Suspense fallback={<div style={{ padding: 24, color: COLORS.mut, fontFamily: LEXEND }}>Cargando…</div>}>
        {tab === 'bandeja' && <BandejaEntrada desde={desdeStr} hasta={hastaStr} onProcesado={() => setReloadTick(x => x + 1)} />}
        {tab === 'facturas' && <OcrConToast periodoExterno={{ desde, hasta }} />}
        {tab === 'documental' && <GestionFacturas />}
        {tab === 'ventas' && <ImportarVentas />}
        {tab === 'conciliacion' && <Conciliacion periodoExterno={{ desde, hasta }} />}
      </Suspense>
    </div>
  )
}
