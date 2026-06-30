/**
 * Adaptador de compatibilidad para la pestaña Evolución del Panel Global.
 *
 * La pestaña se reescribió (estilo neobrutal) en '@/components/panel/TabEvolucion'
 * con una firma de props nueva: { rowsAll, periodoDesde?, periodoHasta?, periodoOpcion? }.
 * Dashboard.tsx la sigue invocando por esta ruta antigua y con props antiguas,
 * así que este shim traduce las props sin necesidad de tocar el Dashboard.
 *
 * TODO (limpieza futura): actualizar el import y las props en Dashboard.tsx y
 * eliminar este adaptador.
 */
import TabEvolucionLanding from '@/components/panel/TabEvolucion'
import type { RowFacturacion } from '@/components/panel/resumen/types'

interface LegacyProps {
  rowsPeriodo?: RowFacturacion[]
  rowsAll: RowFacturacion[]
  fechaDesde?: Date
  fechaHasta?: Date
  fechaOpcion?: string
  canalesFiltro?: string[]
  onFiltrarDiaSemana?: (idx: number) => void
}

export default function TabEvolucion(props: LegacyProps) {
  return (
    <TabEvolucionLanding
      rowsAll={props.rowsAll}
      periodoDesde={props.fechaDesde}
      periodoHasta={props.fechaHasta}
      periodoOpcion={props.fechaOpcion}
    />
  )
}
