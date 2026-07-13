/**
 * InicioSkin — pantalla de inicio (ruta "/").
 *
 * Ahora la pantalla de inicio es SIEMPRE el módulo Panel Global (mismo módulo que /panel),
 * en su versión Neobrutal (NEO) o Ley Visual SL según el interruptor.
 * Antes, en NEO, se pintaba una copia antigua del panel (Dashboard) que se quedaba desfasada.
 */
import PanelGlobal from '@/pages/PanelGlobal'

export default function InicioSkin() {
  return <PanelGlobal />
}
