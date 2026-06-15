import { useState, Suspense, lazy } from 'react'
import TabsPastilla from '@/components/ui/TabsPastilla'

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
  return 'facturas'
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
            nota="Próxima fase: subir aquí cualquier documento o carpeta y que el sistema lo clasifique (factura / extracto / venta / otro) y lo reparta solo."
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
