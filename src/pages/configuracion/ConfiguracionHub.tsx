/**
 * Configuración — hub del área Ajustes (D·Tanda 6).
 * Reúne los apartados de configuración en una sola entrada de menú.
 * No reescribe ninguna pantalla: solo enlaza a las existentes.
 */
import { Link } from 'react-router-dom'
import { useTheme, FONT } from '@/styles/tokens'
import RutaPantalla from '@/components/ui/RutaPantalla'

const APARTADOS = [
  { to: '/configuracion/cocina',               emoji: '🍳', label: 'Cocina',               desc: 'Categorías, unidades, proveedores y formato de números' },
  { to: '/configuracion/integraciones',        emoji: '🔌', label: 'Integraciones',        desc: 'Marcas, canales y Drive' },
  { to: '/configuracion/reglas',               emoji: '📐', label: 'Reglas',               desc: 'Ingredientes, conciliación, OCR' },
  { to: '/configuracion/bancos-y-cuentas',     emoji: '🏦', label: 'Bancos y Cuentas',     desc: 'Cuentas, categorías y matching' },
  { to: '/configuracion/usuarios',             emoji: '👤', label: 'Usuarios',             desc: 'Altas y perfiles' },
  { to: '/configuracion/calendario',           emoji: '📅', label: 'Calendario operativo', desc: 'Festivos y días cerrados' },
  { to: '/configuracion/aprendizajes',         emoji: '🧠', label: 'Aprendizajes ERP',     desc: 'Correcciones aprendidas' },
  { to: '/configuracion/calcneto-aprendizaje', emoji: '⚖️', label: 'Ajuste calcNeto',      desc: 'Afinado del cálculo de neto' },
  { to: '/configuracion/mapeo-marcas',         emoji: '🏷️', label: 'Mapeo de Marcas',      desc: 'Venta ciega Glovo / Just Eat' },
]

export default function ConfiguracionHub() {
  const { T } = useTheme()
  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <RutaPantalla niveles={['Configuración']} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {APARTADOS.map(a => (
          <Link key={a.to} to={a.to} style={{
            display: 'block', textDecoration: 'none',
            background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 12, padding: '18px 20px',
          }}>
            <div style={{ fontSize: 24 }}>{a.emoji}</div>
            <div style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, color: T.pri, marginTop: 8 }}>{a.label}</div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, marginTop: 3 }}>{a.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
