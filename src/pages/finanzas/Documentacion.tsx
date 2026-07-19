import { useState, useEffect, Suspense, lazy, type CSSProperties } from 'react'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import { supabase } from '@/lib/supabase'
import { fechaLocalStr } from '@/utils/fechaLocal'
import {
  OSW, LEX, INK, CREMA, CLARO, VERDE, NAR, ROJO, AMA, AZUL, GRANATE, GRIS,
  SHADOW, BORDER, BORDER_CARD, d, eyebrow,
} from '@/styles/neobrutal'
import BandejaEntrada from '@/components/documentacion/BandejaEntrada'
import ResolverPendientes from '@/components/documentacion/ResolverPendientes'

// Monta los módulos EXISTENTES sin tocar su lógica (solo se reubican como pestañas).
// La antigua pestaña "Ventas" (importador CSV) se eliminó: toda subida entra por
// la Bandeja de entrada y las ventas viven en Finanzas → Ventas.
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

interface PendienteTiRow {
  duplicados: number
  sinCategoria: number
  titularDudoso: number
  lecturaManual: number
  avisosAbiertos: number
}
interface EnProcesoRow {
  pendienteRevision: number
  releerOcr: number
  drivePendiente: number
}

const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: true })

// ── 3 cards grandes (estilo neobrutal Food-Pop) ──────────────────────────────
// Sustituyen las 6 mini-cards anteriores: 1 número por bloque de responsabilidad
// (qué necesita a Rubén, qué resuelve el sistema solo, qué ya está cerrado).
function CardsPapeleo({
  kpi, pendienteTi, enProceso, onIrAPendientes,
}: {
  kpi: KpiRow | null
  pendienteTi: PendienteTiRow | null
  enProceso: EnProcesoRow | null
  onIrAPendientes: () => void
}) {
  if (!kpi) return null
  const pct = Number(kpi.pct_cobertura ?? 0)
  const pctColor = pct >= 80 ? VERDE : pct >= 50 ? NAR : ROJO

  const totalPendiente = pendienteTi
    ? pendienteTi.duplicados + pendienteTi.sinCategoria + pendienteTi.titularDudoso + pendienteTi.lecturaManual + pendienteTi.avisosAbiertos
    : 0
  const totalProceso = enProceso ? enProceso.pendienteRevision + enProceso.releerOcr + enProceso.drivePendiente : 0
  const colorPendiente = totalPendiente > 0 ? (totalPendiente > 20 ? ROJO : NAR) : VERDE

  const cardBase: CSSProperties = { background: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '20px 22px' }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
      {/* ── PENDIENTE DE TI: lleva a la Bandeja, donde AvisosBandeja resuelve de 1 clic ── */}
      <button onClick={onIrAPendientes} style={{ ...cardBase, textAlign: 'left', cursor: 'pointer' }}>
        <div style={eyebrow(colorPendiente, colorPendiente === VERDE ? INK : '#fff')}>Pendiente de ti</div>
        <div style={{ ...d('40px', colorPendiente), marginTop: 10 }}>{nf0(totalPendiente)}</div>
        <div style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS, marginTop: 6 }}>
          {totalPendiente > 0 ? 'ver y resolver de un clic ↓' : 'nada esperando tu decisión'}
        </div>
      </button>

      {/* ── EN PROCESO ── */}
      <div style={cardBase}>
        <div style={eyebrow(AZUL, '#fff')}>En proceso</div>
        <div style={{ ...d('40px', AZUL), marginTop: 10 }}>{nf0(totalProceso)}</div>
        <div style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS, marginTop: 6 }}>el sistema lo resuelve solo, no hace falta nada</div>
      </div>

      {/* ── CONCILIADO ── */}
      <div style={cardBase}>
        <div style={eyebrow(pctColor, pctColor === VERDE ? INK : '#fff')}>Conciliado</div>
        <div style={{ ...d('40px', pctColor), marginTop: 10 }}>{pct.toFixed(0)}%</div>
        <div style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS, marginTop: 6 }}>{nf0(kpi.movimientos_con_factura)} de {nf0(kpi.movimientos_total)} movimientos con factura</div>
      </div>
    </div>
  )
}

// ── Frase-cabecera (hero neobrutal: titular gigante + 2 frases semáforo) ──
function FraseCabecera({ kpi }: { kpi: KpiRow | null }) {
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
  if (kpi.facturas_sin_categoria > 0) {
    pequena = `${kpi.facturas_sin_categoria} sin categoría por clasificar para que el P&L cuadre.`
    pequenaColor = NAR
  } else if (kpi.facturas_posible_duplicado > 0) {
    pequena = `${kpi.facturas_posible_duplicado} posible${kpi.facturas_posible_duplicado > 1 ? 's' : ''} duplicado${kpi.facturas_posible_duplicado > 1 ? 's' : ''} esperando que los revises.`
    pequenaColor = NAR
  } else if (kpi.facturas_aviso_aritmetica > 0) {
    pequena = `${kpi.facturas_aviso_aritmetica} con aviso de IVA por revisar.`
    pequenaColor = ROJO
  } else {
    pequena = 'Sin nada pendiente: ni sin categoría, ni duplicados, ni avisos.'
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
  const [pendienteTi, setPendienteTi] = useState<PendienteTiRow | null>(null)
  const [enProceso, setEnProceso] = useState<EnProcesoRow | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  useEffect(() => {
    let alive = true
    const cargar = () => {
      supabase
        .from('v_kpi_cobertura_conciliacion')
        .select('*')
        .then(({ data }) => { if (alive && data && data.length > 0) setKpi(data[0] as KpiRow) })

      // "Pendiente de ti": duplicados + sin categoría + titular dudoso + lectura manual + avisos abiertos.
      Promise.all([
        supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('posible_duplicado', true),
        supabase.from('facturas').select('id', { count: 'exact', head: true }).is('categoria_factura', null).neq('no_conciliable', true),
        supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente_titular_manual'),
        supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente_lectura_manual'),
        supabase.from('avisos_papeleo').select('id', { count: 'exact', head: true }).eq('estado', 'abierto'),
      ]).then(([duplicados, sinCategoria, titularDudoso, lecturaManual, avisosAbiertos]) => {
        if (!alive) return
        setPendienteTi({
          duplicados: duplicados.count ?? 0,
          sinCategoria: sinCategoria.count ?? 0,
          titularDudoso: titularDudoso.count ?? 0,
          lecturaManual: lecturaManual.count ?? 0,
          avisosAbiertos: avisosAbiertos.count ?? 0,
        })
      })

      // "En proceso": lo que el sistema resuelve solo, sin pedir nada.
      Promise.all([
        supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente_revision'),
        supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('pendiente_releer_ocr', true),
        supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('estado', 'drive_pendiente'),
      ]).then(([pendienteRevision, releerOcr, drivePendiente]) => {
        if (!alive) return
        setEnProceso({
          pendienteRevision: pendienteRevision.count ?? 0,
          releerOcr: releerOcr.count ?? 0,
          drivePendiente: drivePendiente.count ?? 0,
        })
      })
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

      <FraseCabecera kpi={kpi} />
      <CardsPapeleo kpi={kpi} pendienteTi={pendienteTi} enProceso={enProceso} onIrAPendientes={() => cambiar('bandeja')} />

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
