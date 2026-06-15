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

// ── Frases (mismo patrón que Cashflow: titular grande + 1 frase de apoyo
//     que cambia según los datos). Texto propio de Documentación. ───────────
function FrasesDocumentacion({ kpi }: { kpi: KpiRow | null }) {
  if (!kpi) return null
  const pct = Number(kpi.pct_cobertura ?? 0)
  const pctColor = pct >= 80 ? COLORS.ok : pct >= 50 ? COLORS.warn : COLORS.err

  // Frase de apoyo: el dato operativo más urgente ahora mismo.
  let apoyo: string
  let apoyoColor: string
  if (kpi.facturas_sin_categoria > 0) {
    apoyo = `Te quedan ${kpi.facturas_sin_categoria} factura${kpi.facturas_sin_categoria > 1 ? 's' : ''} sin categoría por clasificar.`
    apoyoColor = COLORS.warn
  } else if (kpi.facturas_posible_duplicado > 0) {
    apoyo = `${kpi.facturas_posible_duplicado} posible${kpi.facturas_posible_duplicado > 1 ? 's' : ''} duplicado${kpi.facturas_posible_duplicado > 1 ? 's' : ''} esperando que los revises.`
    apoyoColor = COLORS.warn
  } else if (kpi.facturas_aviso_aritmetica > 0) {
    apoyo = `${kpi.facturas_aviso_aritmetica} factura${kpi.facturas_aviso_aritmetica > 1 ? 's' : ''} con el IVA descuadrado por revisar.`
    apoyoColor = COLORS.err
  } else {
    apoyo = pct >= 80 ? 'Documentación al día, casi todo cuadrado.' : 'Sin pendientes sueltos: sigue subiendo lo que falte.'
    apoyoColor = pct >= 80 ? COLORS.ok : COLORS.sec
  }

  return (
    <div style={{ background: COLORS.card, border: `0.5px solid ${COLORS.brd}`, borderRadius: 16, padding: '16px 18px', marginBottom: 14 }}>
      <div style={{ fontFamily: OSWALD, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 600, lineHeight: 1.05 }}>
        CONCILIADO <span style={{ color: pctColor }}>{pct.toFixed(0)}%</span>
        <span style={{ color: COLORS.mut, fontSize: '0.42em', marginLeft: 10 }}>· {kpi.movimientos_con_factura}/{kpi.movimientos_total} movimientos con factura</span>
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontFamily: OSWALD, fontSize: 'clamp(16px,2.1vw,20px)', fontWeight: 600, color: apoyoColor, letterSpacing: '0.3px' }}>{apoyo}</div>
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
