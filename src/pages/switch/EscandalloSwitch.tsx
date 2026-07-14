/**
 * Escandallo — decide qué versión se ve según el interruptor NEO / SL.
 */
import { useSkin } from '@/context/skin'
import EscandalloNeo from '@/pages/Escandallo'
import EscandalloSL from '@/pages/lab/LabEscandallo'
import { ConNeo } from './SkinFrame'

export default function EscandalloSwitch() {
  const { skin } = useSkin()
  return (
    <ConNeo>{skin === 'sl' ? <EscandalloSL /> : <EscandalloNeo />}</ConNeo>
  )
}
