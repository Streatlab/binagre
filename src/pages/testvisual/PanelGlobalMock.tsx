/**
 * Test Visual — Panel Global · selector de diseño.
 * Cada estado del toggle es un diseño DISTINTO creado para su lenguaje:
 *   actual  → réplica del look real
 *   foodpop → diseño desde cero (apetito/pop)
 *   dark    → diseño desde cero (centro de control)
 */
import type { Skin } from './skins'
import PanelGlobalActual from './panelglobal/Actual'
import PanelGlobalFoodPop from './panelglobal/FoodPop'
import PanelGlobalDark from './panelglobal/Dark'

export default function PanelGlobalMock({ s }: { s: Skin }) {
  if (s.id === 'foodpop') return <PanelGlobalFoodPop />
  if (s.id === 'dark') return <PanelGlobalDark />
  return <PanelGlobalActual />
}
