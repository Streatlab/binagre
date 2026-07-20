import { useState, useEffect, Suspense, lazy } from 'react'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import { supabase } from '@/lib/supabase'
import { fechaLocalStr } from '@/utils/fechaLocal'
import {
  OSW, LEX, INK, CREMA, CLARO, VERDE, NAR, ROJO, AMA, GRANATE, GRIS,
  SHADOW, BORDER, BORDER_CARD, d, eyebrow,
} from '@/styles/neobrutal'
import BandejaEntrada from '@/components/documentacion/BandejaEntrada'
import ResolverPendientes from '@/components/documentacion/ResolverPendientes'

// Monta los módulos EXISTENTES sin tocar su lógica (solo se reubican como pestañas).
// La antigua pestaña "Ventas" (importador CSV) se eliminó: toda subida entra por
// la Bandeja de entrada y las ventas viven en Finanzas → Ventas.
// 20-jul: fuera las 3 cards blancas (Pendiente/En proceso/Conciliado) — repetían
// lo que ya dicen el hero y el panel de Avisos con números distintos. Una sola
// fuente de verdad: hero (conciliado) + Avisos (pendientes).
const OcrConToast = lazy(() => import('@/pages/OcrConToast'))
const Conciliacion = lazy(() => import('@/pages/Conciliacion'))
const GestionFacturas = lazy(() => import('@/pages/finanzas/GestionFacturas'))

type Tab = 'bandeja' | 'facturas' | 'conciliacion' | 'documental'

const STORAGE_KEY = 'documentacion:tab'

function loadTab(): Tab {
  try {
    const r = sessionStorage.getItem(STORAGE_KEY)
    if (r === 'bandeja' || r === 'facturas' || r === 'conciliacion' || r === 'documental') return r
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

// ── Frase-cabecera (hero neobrutal: titular gigante + 2 frases semáforo) ──
function FraseCabecera({ kpi, avisos }: { kpi: KpiRow | null; avisos: number }) {
  if (!kpi) return null
  const pct = Number(kpi.pct_cobertura ?? 0)
  const pctColor = pct >= 80 ? VERDE : pct >= 50 ? NAR : ROJO

  const grande = pct >= 80
    ? 'Casi todo cuadrado, el papeleo te va al día.'
    : pct >= 50
      ? 'Vas por buen camino, todavía queda parte por casar.'
      : 'Aún queda bastante por conciliar este periodo.'

  let pequena: string
  let pequenaColor: string
  if (avisos > 0) {
    pequena = `${nf0(avisos)} aviso${avisos > 1 ? 's' : ''} esperando tu decisión — abajo, de un clic.`
    pequenaColor = NAR
  } else if (kpi.facturas_sin_categoria > 0) {
    pequena = `${nf0(kpi.facturas_sin_categoria)} movimiento${kpi.facturas_sin_categoria > 1 ? 's' : ''} de banco sin categoría (transferencias sin destinatario).`
    pequenaColor = NAR
  } else if (kpi.facturas_aviso_aritmetica > 0) {
    pequena = `${kpi.facturas_aviso_aritmetica} con aviso de IVA por revisar.`
    pequenaColor = ROJO
  } else {
    pequena = 'Sin nada pendiente: ni avisos, ni duplicados, ni sin categoría.'
    pequenaColor = VERDE
  }

  return (
    <div style={{ background: AMA, border: BORDER, boxShadow: SHADOW, padding: '20px 24px', marginBottom: 16 }}>
      <div style={d('clamp(30px,4.4vw,46px)')}>
        CONCILIADO <span style={{ color: pctColor }}>{pct.toFixed(0)}%</span>
        <span style={{ color: INK, fontSize: '0.4em', marginLeft: 12, letterSpacing: '0.5px' }}>· {nf0(kpi.movimientos_con_factura)}/{nf0(kpi.movimientos_total)} movimientos con factura</span>
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontFamily: OSW, fontSize: 'clamp(16px,2.1vw,20px)', fontWeight: 700, color: pctColor, letterSpacing: '0.3px', textTransform: 'uppercase' }}>{grande}</div>
        <div style={{ fontFamily: OSW, fontSize: 'clamp(13px,1.5vw,15px)', fontWeight: 600, color: pequenaColor, letterSpacing: '0.3px', textTransform: 'uppercase' }}>{pequena}</div>
      </div>
    </div>
  )
}

// ── Tabs neobrutal (bloques con borde y sombra dura, activo en granate) ──
const TABS: { id: Tab; label: string }[] = [
  { id: 'bandeja', label: 'Bandeja entrada' },
  { id: 'facturas', label: 'Facturas' },
  { id: 'conciliacion', label: 'Conciliación' },
  { id: 'documental', label: 'Gestor documental' },
]

function TabsNeo({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
      {TABS.map(t => {
        const activo = t.id === tab
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            background: activo ? GRANATE : '#fff',
            color: activo ? '#fff' : INK,
            border: BORDER_CARD,
            boxShadow: activo ? `2px 2px 0 ${INK}` : SHADOW,
            transform: activo ? 'translate(2px, 2px)' : 'none',
            padding: '9px 18px',
            fontFamily: OSW, fontWeight: 700, fontSize: 13, letterSpacing: '1.5px',
            textTransform: 'uppercase', cursor: 'pointer', transition: 'transform 0.08s, box-shadow 0.08s',
          }}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export default function Documentacion() {
  const [tab, setTab] = useState<Tab>(loadTab())
  const cambiar = (t: Tab) => { setTab(t); try { sessionStorage.setItem(STORAGE_KEY, t) } catch { /* swallow */ } }

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
    <div style={{ background: CREMA, padding: '24px 28px', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span style={eyebrow(CLARO)}>Finanzas · Documentos</span>
          <h2 style={{ ...d('clamp(26px,3.4vw,36px)', GRANATE), margin: '8px 0 0 0' }}>PAPELEO</h2>
        </div>
        <SelectorFechaUniversal
          nombreModulo="documentacion"
          defaultOpcion="este_mes"
          onChange={(dd, h) => { setDesde(dd); setHasta(h) }}
        />
      </div>

      <FraseCabecera kpi={kpi} avisos={avisos} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <TabsNeo tab={tab} onChange={cambiar} />
        <ResolverPendientes onDone={() => setReloadTick(x => x + 1)} />
      </div>

      <Suspense fallback={<div style={{ padding: 24, color: GRIS, fontFamily: LEX }}>Cargando…</div>}>
        {tab === 'bandeja' && <BandejaEntrada desde={desdeStr} hasta={hastaStr} onProcesado={() => setReloadTick(x => x + 1)} />}
        {tab === 'facturas' && <OcrConToast periodoExterno={{ desde, hasta }} />}
        {tab === 'conciliacion' && <Conciliacion periodoExterno={{ desde, hasta }} />}
        {tab === 'documental' && <GestionFacturas />}
      </Suspense>
    </div>
  )
}
