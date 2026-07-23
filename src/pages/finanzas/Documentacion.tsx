import { useState, useEffect, Suspense, lazy } from 'react'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import RutaPantalla from '@/components/ui/RutaPantalla'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { supabase } from '@/lib/supabase'
import { fechaLocalStr } from '@/utils/fechaLocal'
import { LEX, GRIS } from '@/styles/neobrutal'
import BandejaEntrada from '@/components/documentacion/BandejaEntrada'
import ResolverPendientes from '@/components/documentacion/ResolverPendientes'
import { HeroCantera, FrasePotente, PantallaCantera } from '@/components/kit/cantera'

// Monta los módulos EXISTENTES sin tocar su lógica (solo se reubican como pestañas).
// La antigua pestaña "Ventas" (importador CSV) se eliminó: toda subida entra por
// la Bandeja de entrada y las ventas viven en Finanzas → Ventas.
// 20-jul: fuera las 3 cards blancas (Pendiente/En proceso/Conciliado) — repetían
// lo que ya dicen el hero y el panel de Avisos con números distintos. Una sola
// fuente de verdad: hero (conciliado) + Avisos (pendientes).
// 23-jul: fuera la pestaña "Equipo". Duplicaba el botón EQUIPO de la Bandeja de
// entrada pero por una vía peor: subía directa a /api/equipo/subir sin guardar
// antes ni apuntar el archivo, así que un fallo de red dejaba el documento
// perdido y sin repesca. El botón de la Bandeja usa enviarAEquipoSeguro
// (guarda → apunta en equipo_manifiesto → lee, y lo que falla lo rescata el
// barrido). Una sola puerta de entrada, la que no pierde nada.
const OcrConToast = lazy(() => import('@/pages/OcrConToast'))
const Conciliacion = lazy(() => import('@/pages/Conciliacion'))
const GestionFacturas = lazy(() => import('@/pages/finanzas/GestionFacturas'))
const Facturacion = lazy(() => import('@/pages/Facturacion'))
const Gestoria = lazy(() => import('@/pages/finanzas/Gestoria'))

type Tab = 'bandeja' | 'facturas' | 'conciliacion' | 'documental' | 'facturacion' | 'gestoria'
const VALID_TABS: Tab[] = ['bandeja', 'facturas', 'conciliacion', 'documental', 'facturacion', 'gestoria']

const STORAGE_KEY = 'documentacion:tab'

function loadTab(): Tab {
  try {
    const q = new URLSearchParams(window.location.search).get('tab')
    if (q && (VALID_TABS as string[]).includes(q)) return q as Tab
  } catch { /* swallow */ }
  try {
    const r = sessionStorage.getItem(STORAGE_KEY)
    if (r && (VALID_TABS as string[]).includes(r)) return r as Tab
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

// ── Hero papeleo (área granate): titular natural + % conciliado + tira de atención ──
function FraseCabecera({ kpi, avisos }: { kpi: KpiRow | null; avisos: number }) {
  if (!kpi) return null
  const pct = Number(kpi.pct_cobertura ?? 0)

  const titular = pct >= 80
    ? 'Casi todo cuadrado, el papeleo te va al día.'
    : pct >= 50
      ? 'Vas por buen camino, todavía queda parte por casar.'
      : 'Aún queda bastante por conciliar este periodo.'

  let resumen: string
  if (avisos > 0) {
    resumen = `${nf0(avisos)} aviso${avisos > 1 ? 's' : ''} esperando tu decisión — abajo, de un clic.`
  } else if (kpi.facturas_sin_categoria > 0) {
    resumen = `${nf0(kpi.facturas_sin_categoria)} movimiento${kpi.facturas_sin_categoria > 1 ? 's' : ''} de banco sin categoría (transferencias sin destinatario).`
  } else if (kpi.facturas_aviso_aritmetica > 0) {
    resumen = `${kpi.facturas_aviso_aritmetica} con aviso de IVA por revisar.`
  } else {
    resumen = 'Sin nada pendiente: ni avisos, ni duplicados, ni sin categoría.'
  }

  const atencion = [
    avisos > 0 ? `${nf0(avisos)} aviso${avisos > 1 ? 's' : ''}` : null,
    kpi.facturas_sin_categoria > 0 ? `${nf0(kpi.facturas_sin_categoria)} sin categoría` : null,
    kpi.facturas_aviso_aritmetica > 0 ? `${nf0(kpi.facturas_aviso_aritmetica)} aviso IVA` : null,
    kpi.facturas_posible_duplicado > 0 ? `${nf0(kpi.facturas_posible_duplicado)} posibles duplicados` : null,
  ].filter(Boolean) as string[]

  return (
    <HeroCantera
      area="papeleo"
      titular={titular}
      etiquetaDato="Movimientos conciliados con factura"
      cifra={`${pct.toFixed(0)}%`}
      resumen={<>{resumen} · {nf0(kpi.movimientos_con_factura)}/{nf0(kpi.movimientos_total)} movimientos con factura</>}
      atencion={atencion}
    />
  )
}

// ── Frase potente: significado distinto del héroe (papeleo · granate) ──
function FraseEstado({ kpi, avisos }: { kpi: KpiRow | null; avisos: number }) {
  if (!kpi) return null
  const limpio = avisos === 0 && kpi.facturas_sin_categoria === 0 && kpi.facturas_aviso_aritmetica === 0 && kpi.facturas_posible_duplicado === 0
  if (limpio) return <FrasePotente significado="logro">Nada pendiente: sin avisos, sin duplicados, sin facturas sin categoría.</FrasePotente>
  if (kpi.facturas_aviso_aritmetica > 0) return <FrasePotente significado="peligro">Hay facturas con aviso de IVA: revísalas antes de que se acumulen.</FrasePotente>
  return <FrasePotente significado="oportunidad">Resuelve los avisos abiertos: cada uno de un clic, y el papeleo queda al día.</FrasePotente>
}

// ── Tabs neobrutal (bloques con borde y sombra dura, activo en granate) ──
const TABS: { id: Tab; label: string }[] = [
  { id: 'bandeja', label: 'Bandeja entrada' },
  { id: 'facturas', label: 'Facturas' },
  { id: 'conciliacion', label: 'Conciliación' },
  { id: 'documental', label: 'Gestor documental' },
  { id: 'facturacion', label: 'Facturación' },
  { id: 'gestoria', label: 'Gestoría' },
]

export default function Documentacion() {
  const [tab, setTab] = useState<Tab>(loadTab())
  const cambiar = (t: Tab) => {
    setTab(t)
    try { sessionStorage.setItem(STORAGE_KEY, t) } catch { /* swallow */ }
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', t)
      window.history.replaceState({}, '', url)
    } catch { /* swallow */ }
  }

  const [desde, setDesde] = useState<Date>(new Date())
  const [hasta, setHasta] = useState<Date>(new Date())

  const [kpi, setKpi] = useState<KpiRow | null>(null)
  const [avisos, setAvisos] = useState(0)
  const [reloadTick, setReloadTick] = useState(0)
  useEffect(() => {
    let alive = true
    const cargar = () => {
      supabase
        .from('v_kpi_cobertura_conciliacion')
        .select('*')
        .then(({ data }) => { if (alive && data && data.length > 0) setKpi(data[0] as KpiRow) })
      supabase
        .from('avisos_papeleo')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'abierto')
        .then(({ count }) => { if (alive) setAvisos(count ?? 0) })
    }
    cargar()
    const t = setInterval(cargar, 30_000)
    return () => { alive = false; clearInterval(t) }
  }, [reloadTick])

  const desdeStr = fechaLocalStr(desde)
  const hastaStr = fechaLocalStr(hasta)

  return (
    <PantallaCantera>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <RutaPantalla niveles={['Papeleo', TABS.find(t => t.id === tab)?.label ?? '']} />
        <SelectorFechaUniversal
          nombreModulo="documentacion"
          defaultOpcion="este_mes"
          onChange={(dd, h) => { setDesde(dd); setHasta(h) }}
        />
      </div>

      <FraseCabecera kpi={kpi} avisos={avisos} />
      <FraseEstado kpi={kpi} avisos={avisos} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <TabsPastilla tabs={TABS} activeId={tab} onChange={id => cambiar(id as Tab)} />
        <ResolverPendientes onDone={() => setReloadTick(x => x + 1)} />
      </div>

      <Suspense fallback={<div style={{ padding: 24, color: GRIS, fontFamily: LEX }}>Cargando…</div>}>
        {tab === 'bandeja' && <BandejaEntrada desde={desdeStr} hasta={hastaStr} onProcesado={() => setReloadTick(x => x + 1)} />}
        {tab === 'facturas' && <OcrConToast periodoExterno={{ desde, hasta }} />}
        {tab === 'conciliacion' && <Conciliacion periodoExterno={{ desde, hasta }} />}
        {tab === 'documental' && <GestionFacturas />}
        {tab === 'facturacion' && <Facturacion embedded />}
        {tab === 'gestoria' && <Gestoria embedded />}
      </Suspense>
    </PantallaCantera>
  )
}
