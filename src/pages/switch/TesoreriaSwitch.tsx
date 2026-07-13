/**
 * Tesorería 13 semanas — decide qué versión se ve según el interruptor NEO / SL.
 */
import { useSkin } from '@/context/skin'
import TesoreriaNeo from '@/pages/finanzas/Tesoreria13Semanas'
import TesoreriaSL from '@/pages/lab/LabTesoreria'
import { ConNeo } from './SkinFrame'

export default function TesoreriaSwitch() {
  const { skin } = useSkin()
  return (
    <ConNeo>{skin === 'sl' ? <TesoreriaSL /> : <TesoreriaNeo />}</ConNeo>
  )
}
