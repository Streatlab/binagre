/**
 * InicioSkin — pantalla de inicio (ruta "/").
 *
 * Temporal, mientras se valida la Ley Visual SL:
 *  · NEO → Dashboard actual (neobrutal, intacto).
 *  · SL  → Panel Global con el skin SL (Resumen / Cashflow / Evolución migrados).
 * El interruptor vive arriba a la derecha en ambos casos.
 *
 * La tarjeta HOY EN VIVO (ventas del día, robot cada 5 min) se muestra arriba del todo.
 */
import { useSkin, SkinToggle } from '@/context/skin'
import Dashboard from '@/pages/Dashboard'
import PanelGlobal from '@/pages/PanelGlobal'
import CardHoyEnVivo from '@/components/panel/resumen/CardHoyEnVivo'

export default function InicioSkin() {
  const { skin } = useSkin()

  if (skin === 'sl') {
    // PanelGlobal ya monta su propio <SkinToggle /> dentro de la vista SL.
    return <PanelGlobal />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <SkinToggle />
      </div>
      <div style={{ padding: '0 28px' }}>
        <CardHoyEnVivo />
      </div>
      <Dashboard />
    </div>
  )
}
