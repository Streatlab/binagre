// colaRecetasPendientes — lógica pura (sin red, sin JSX) de la cola priorizada por euros de
// Coste por plato (Plato maestro, Pieza 4a/4b/4d). Agrupa filas de v_mapeo_resuelto por
// plato_maestro: un alta de receta cierra de golpe TODOS los alias que cuelgan del mismo
// maestro_id (Pieza 4b). Las filas sin maestro (aún no enlazadas a platos_alias) forman su
// propio grupo de un solo nombre.
//
// Pieza 4d: bebidas y extras (tipo_linea='bebida'|'extra') se marcan en Supabase pero NUNCA
// se borran — siguen contando en informes de ventas (tablas independientes: pedidos_plataforma,
// lineas_producto_operativa). Lo único que hace esCandidataACola() es decidir si una fila entra
// en ESTA cola de escandallo; no toca su visibilidad en ningún otro sitio.
//
// Vive fuera de src/components para poder testearse con import relativo simple desde tests/,
// igual que src/utils/fichasHuerfanas.ts.

export type TipoLinea = 'plato' | 'ruido' | 'bebida' | 'extra' | null | undefined

/** Solo las filas 'plato' entran en la cola de recetas pendientes. Ruido, bebidas y extras
 *  quedan fuera de AQUÍ — pero no se tocan en ningún otro sitio (KPIs de ventas incluidos). */
export function esCandidataACola(tipoLinea: TipoLinea | string | null | undefined): boolean {
  return tipoLinea === 'plato'
}

export interface FilaColaPendiente {
  id: number
  plato_norm: string
  plato_muestra: string | null
  receta_id: string | null
  maestro_id: number | null
  euros: number
  unidades: number
  tipo_linea?: TipoLinea | string
}

export interface GrupoColaPendiente {
  /** Clave estable de agrupación: 'm:<maestro_id>' o 's:<mapeo_id>' si no tiene maestro. */
  key: string
  nombre: string
  maestroId: number | null
  /** id de la fila de mapeo_plato_receta a enlazar directamente cuando NO hay maestro (grupo de 1). */
  mapeoIdSolo: number | null
  euros: number
  unidades: number
  nNombres: number
}

/**
 * Agrupa filas ya resueltas (v_mapeo_resuelto) SIN receta en la cola de altas pendientes,
 * ordenada por euros descendente. Si `filas` trae tipo_linea, las que no sean 'plato' se
 * descartan aquí mismo (defensa en profundidad; la query de Supabase ya filtra por 'plato').
 */
export function agruparColaPendientes(
  filas: FilaColaPendiente[],
  nombrePorMaestro: Map<number, string>,
): GrupoColaPendiente[] {
  const grupos = new Map<string, GrupoColaPendiente>()
  for (const f of filas) {
    if (f.tipo_linea !== undefined && !esCandidataACola(f.tipo_linea)) continue
    if (f.receta_id) continue
    const key = f.maestro_id != null ? `m:${f.maestro_id}` : `s:${f.id}`
    let g = grupos.get(key)
    if (!g) {
      const nombre = f.maestro_id != null
        ? (nombrePorMaestro.get(f.maestro_id) ?? f.plato_muestra ?? f.plato_norm)
        : (f.plato_muestra ?? f.plato_norm)
      g = { key, nombre, maestroId: f.maestro_id, mapeoIdSolo: f.maestro_id == null ? f.id : null, euros: 0, unidades: 0, nNombres: 0 }
      grupos.set(key, g)
    }
    g.euros += Number(f.euros) || 0
    g.unidades += Number(f.unidades) || 0
    g.nNombres += 1
  }
  return Array.from(grupos.values()).sort((a, b) => b.euros - a.euros)
}

/** Formato pedido en el spec: "Salmorejo: 3 nombres, 1.066 €". */
export function formatoCierreAlta(g: GrupoColaPendiente): string {
  const euros = Math.round(g.euros).toLocaleString('es-ES', { useGrouping: true })
  const nombres = g.nNombres === 1 ? '1 nombre' : `${g.nNombres} nombres`
  return `${g.nombre}: ${nombres}, ${euros} €`
}
