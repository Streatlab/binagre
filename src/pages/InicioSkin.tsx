/**
 * InicioSkin — pantalla de inicio (ruta "/").
 *
 * Temporal, mientras se valida la Ley Visual SL:
 *  · NEO → Dashboard actual (neobrutal, intacto).
 *  · SL  → Panel Global con el skin SL (Resumen / Cashflow / Evolución migrados).
 * El interruptor vive arriba a la derecha en ambos casos.
 */
import { useSkin, SkinToggle } from '@/context/skin'
import Dashboard from '@/pages/Dashboard'
import PanelGlobal from '@/pages/PanelGlobal'

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
      <Dashboard />
    </div>
  )
}
