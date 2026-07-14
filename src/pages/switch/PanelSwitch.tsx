/**
 * Panel Global — decide qué versión se ve según el interruptor NEO / SL.
 *  · SL  → Cuadro de mando nuevo (Ley Visual SL v2, una sola vista)
 *  · NEO → Panel Global antiguo, intacto
 */
import { useSkin } from '@/context/skin'
import PanelGlobalNeo from '@/pages/PanelGlobal'
import CuadroMandoSL from '@/pages/lab/LabPanel'
import { ConNeo } from './SkinFrame'

export default function PanelSwitch() {
  const { skin } = useSkin()
  return (
    <ConNeo>{skin === 'sl' ? <CuadroMandoSL /> : <PanelGlobalNeo />}</ConNeo>
  )
}
