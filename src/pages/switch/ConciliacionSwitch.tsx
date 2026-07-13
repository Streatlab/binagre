/**
 * Conciliación — decide qué versión se ve según el interruptor NEO / SL.
 *  · SL  → pantalla nueva (Ley Visual SL v2)
 *  · NEO → pantalla antigua, intacta
 */
import { useSkin } from '@/context/skin'
import ConciliacionNeo from '@/pages/Conciliacion'
import ConciliacionSL from '@/pages/lab/LabConciliacion'
import { ConNeo } from './SkinFrame'

export default function ConciliacionSwitch() {
  const { skin } = useSkin()
  if (skin === 'sl') return <ConciliacionSL />
  return <ConNeo><ConciliacionNeo /></ConNeo>
}
