import { useState, useEffect, Suspense, lazy } from 'react'
import TabsPastilla from '@/components/ui/TabsPastilla'
import { supabase } from '@/lib/supabase'

// Monta los módulos EXISTENTES sin tocar su lógica (solo se reubican como pestañas).
// Cada módulo entra ENTERO con todas sus funciones (el cartero de OCR, subida por
// carpeta/archivo, modales, etc.). Aquí no se borra nada: solo se trasladan.
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

function CardsResumen() {
  const [kpi, setKpi] = useState<KpiRow | null>(null)

  useEffect(() => {
    let alive = true
    const cargar = () => {
      supabase
        .from('v_kpi_cobertura_conciliacion')
        .select('*')
        .then(({ data }) => {
          if (alive && data && data.length > 0) setKpi(data[0] as KpiRow)
        })
    }
    cargar()
    const t = setInterval(cargar, 30_000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  if (!kpi) return null

  const pct = Number(kpi.pct_cobertura ?? 0)
  const pctColor = pct >= 80 ? '#1d9e75' : pct >= 50 ? '#c98a00' : '#B01D23'

  const cards = [
    { label: 'Facturas totales', value: kpi.facturas_total, color: '#1e2233' },
    { label: 'Mov. cuadrados', value: `${kpi.movimientos_con_factura} / ${kpi.movimientos_total}`, color: '#1e2233' },
    { label: 'Cobertura', value: `${pct.toFixed(1)}%`, color: pctColor },
    { label: 'Facturas sin categoría', value: kpi.facturas_sin_categoria, color: kpi.facturas_sin_categoria > 0 ? '#c98a00' : '#1d9e75' },
    { label: 'Facturas duplicadas', value: kpi.facturas_posible_duplicado, color: kpi.facturas_posible_duplicado > 0 ? '#c98a00' : '#1d9e75' },
    { label: 'Facturas aviso IVA', value: kpi.facturas_aviso_aritmetica, color: kpi.facturas_aviso_aritmetica > 0 ? '#B01D23' : '#1d9e75' },
  ]

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            flex: '1 1 140px',
            minWidth: 140,
            background: '#fff',
            border: '1px solid #e5e2dc',
            borderRadius: 12,
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(30,34,51,0.05)',
          }}
        >
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, letterSpacing: '1.5px', color: '#7a8090', textTransform: 'uppercase' }}>
            {c.label}
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 28, fontWeight: 700, color: c.color, lineHeight: 1.1, marginTop: 4 }}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function Placeholder({ titulo, nota }: { titulo: string; nota: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e2dc',
        borderRadius: 12,
        padding: '40px 28px',
        textAlign: 'center',
        marginTop: 16,
      }}
    >
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: '#1e2233', letterSpacing: 1 }}>{titulo}</div>
      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090', marginTop: 8 }}>{nota}</div>
    </div>
  )
}

export default function Documentacion() {
  const [tab, setTab] = useState<Tab>(loadTab())
  const cambiar = (t: Tab) => { setTab(t); try { sessionStorage.setItem(STORAGE_KEY, t) } catch { /* swallow */ } }

  return (
    <div style={{ background: '#f5f3ef', padding: '24px 28px', minHeight: '100%' }}>
      <div style={{ marginBottom: 18 }}>
        <h2
          style={{
            color: '#B01D23',
            fontFamily: 'Oswald, sans-serif',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '3px',
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          DOCUMENTACIÓN
        </h2>
        <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090', display: 'block', marginTop: 4 }}>
          Entrada única de documentos · todo en un sitio
        </span>
      </div>

      {/* Cards-resumen comunes a todas las pestañas (datos reales de facturas + conciliación) */}
      <CardsResumen />

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

      <Suspense fallback={<div style={{ padding: 24, color: '#7a8090', fontFamily: 'Lexend, sans-serif' }}>Cargando…</div>}>
        {tab === 'bandeja' && (
          <Placeholder
            titulo="Bandeja de entrada — clasificador"
            nota="Próxima fase: subir aquí cualquier documento o carpeta y que el sistema lo clasifique (factura / extracto / venta / otro) y lo reparta solo. Arriba tienes el resumen global de facturación y conciliación."
          />
        )}
        {tab === 'facturas' && <OcrConToast />}
        {tab === 'documental' && <GestionFacturas />}
        {tab === 'ventas' && <ImportarVentas />}
        {tab === 'conciliacion' && <Conciliacion />}
      </Suspense>
    </div>
  )
}
