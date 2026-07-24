/**
 * Configuración — hub del área Ajustes (D·Tanda 6).
 * Reúne los apartados de configuración en una sola entrada de menú.
 * No reescribe ninguna pantalla: solo enlaza a las existentes.
 * Claves (bóveda) vive aquí dentro como ?tab=claves, igual que otras pantallas
 * del ERP usan ?tab= (Papeleo, Tesorería…), para no abrir ruta nueva.
 */
import { Link, useSearchParams } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { FONT } from '@/styles/tokens'
import RutaPantalla from '@/components/ui/RutaPantalla'
import { PantallaCantera, SHADOW_DURA } from '@/components/kit/cantera'
import { INK, BLANCO, GRIS, LEX } from '@/styles/neobrutal'

const ClavesPanel = lazy(() => import('./ClavesPanel'))

const APARTADOS = [
  { to: '/configuracion/cocina',               emoji: '🍳', label: 'Cocina',               desc: 'Categorías, unidades, proveedores y formato de números' },
  { to: '/configuracion/integraciones',        emoji: '🔌', label: 'Integraciones',        desc: 'Marcas, canales y Drive' },
  { to: '/configuracion/reglas',               emoji: '📐', label: 'Reglas',               desc: 'Ingredientes, conciliación, OCR' },
  { to: '/configuracion/bancos-y-cuentas',     emoji: '🏦', label: 'Bancos y Cuentas',     desc: 'Cuentas, categorías y matching' },
  { to: '/configuracion/usuarios',             emoji: '👤', label: 'Usuarios',             desc: 'Altas y perfiles' },
  { to: '/configuracion?tab=claves',           emoji: '🔐', label: 'Claves',               desc: 'PIN del equipo y llaves de servicios, bajo clave maestra' },
  { to: '/configuracion/impresion',            emoji: '🖨️', label: 'Impresión',            desc: 'Tinta, orientación y copias por documento' },
  { to: '/configuracion/calendario',           emoji: '📅', label: 'Calendario operativo', desc: 'Festivos y días cerrados' },
  { to: '/configuracion/aprendizajes',         emoji: '🧠', label: 'Aprendizajes ERP',     desc: 'Correcciones aprendidas' },
  { to: '/configuracion/calcneto-aprendizaje', emoji: '⚖️', label: 'Ajuste calcNeto',      desc: 'Afinado del cálculo de neto' },
  { to: '/configuracion/mapeo-marcas',         emoji: '🏷️', label: 'Mapeo de Marcas',      desc: 'Venta ciega Glovo / Just Eat' },
]

export default function ConfiguracionHub() {
  const [params] = useSearchParams()
  const tab = params.get('tab')

  if (tab === 'claves') {
    return (
      <PantallaCantera embedded>
        <RutaPantalla niveles={['Configuración', 'Claves']} />
        <Suspense fallback={<p style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>Cargando…</p>}>
          <ClavesPanel />
        </Suspense>
      </PantallaCantera>
    )
  }

  return (
    <PantallaCantera embedded>
      <RutaPantalla niveles={['Configuración']} />
      {/* Config pura sin métrica propia: se omite el héroe (D·6 criterio 2). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {APARTADOS.map(a => (
          <Link key={a.to} to={a.to} style={{
            display: 'block', textDecoration: 'none',
            background: BLANCO, border: `3px solid ${INK}`, borderTop: `7px solid ${GRIS}`, borderRadius: 0,
            boxShadow: SHADOW_DURA, padding: '18px 20px',
          }}>
            <div style={{ fontSize: 24 }}>{a.emoji}</div>
            <div style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, color: INK, marginTop: 8 }}>{a.label}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 3 }}>{a.desc}</div>
          </Link>
        ))}
      </div>
    </PantallaCantera>
  )
}
