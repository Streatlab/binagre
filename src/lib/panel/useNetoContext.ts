/**
 * useNetoContext — precarga única para consumir el neto de plataforma.
 *
 * LEY-NETO-01: el neto SIEMPRE sale de resolverNeto. Este hook centraliza la
 * precarga que necesita ese resolver (config de canales, nº de marcas por canal
 * y las liquidaciones/ratios reales) y el refresco en vivo, para que todas las
 * pestañas del Panel Global lo consuman igual y cuadren entre sí.
 *
 * Devuelve:
 *   - configCanales   → config_canales (con listener 'config_canales:changed')
 *   - marcasPorCanal  → nº de marcas por canal
 *   - ventasListas    → true cuando las liquidaciones reales ya están en caché;
 *                       úsalo en las deps del useMemo del neto para recalcular
 *                       en cuanto llega el dato real (o cuando cambia).
 */

import { useEffect, useState } from 'react'
import {
  loadConfigCanales, recargarConfigCanales, loadMarcasPorCanal,
  type CanalConfig, type MarcasPorCanal,
} from '@/lib/panel/calcNetoPlataforma'
import { useVentasRealesListas } from '@/lib/panel/netoResolver'

export interface NetoContext {
  configCanales: Record<string, CanalConfig>
  marcasPorCanal: MarcasPorCanal
  ventasListas: boolean
}

export function useNetoContext(): NetoContext {
  const [configCanales, setConfigCanales] = useState<Record<string, CanalConfig>>({})
  const [marcasPorCanal, setMarcasPorCanal] = useState<MarcasPorCanal>({ uber: 1, glovo: 1, je: 1, web: 1, dir: 1 })
  // Precarga + realtime de las liquidaciones reales y sus ratios calibrados.
  const ventasListas = useVentasRealesListas()

  useEffect(() => {
    loadConfigCanales().then(setConfigCanales)
    loadMarcasPorCanal().then(setMarcasPorCanal)
    const on = () => {
      recargarConfigCanales().then(setConfigCanales)
      loadMarcasPorCanal().then(setMarcasPorCanal)
    }
    window.addEventListener('config_canales:changed', on)
    return () => window.removeEventListener('config_canales:changed', on)
  }, [])

  return { configCanales, marcasPorCanal, ventasListas }
}
