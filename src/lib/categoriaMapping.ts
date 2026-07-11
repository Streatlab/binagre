// Mapeo de categorias P&G.
//
// ACTUALIZADO 11-jul-2026 (unificacion 65 -> 32 categorias).
// La fuente de verdad es la tabla `categorias_pyg` en Supabase. Este archivo solo
// traduce codigos LEGACY (los antiguos PRD-/RRH-/ALQ-/CTR-/ING-/EQP-/LOC-/INT-) a los
// codigos jerarquicos vivos, y agrupa los codigos vivos para los paneles.
//
// Los codigos legacy YA NO existen en la base de datos: no hay ni una sola fila en
// conciliacion, facturas, reglas ni presupuestos con ellos. Este mapa se mantiene solo
// para datos importados antiguos y se puede retirar cuando no quede nada que traducir.

import { supabase } from '@/lib/supabase'

// ─── Agrupacion de los codigos VIVOS (jerarquicos) ─────────────────────────

const SUBCATEGORIA: Record<string, string> = {
  '2.11.1': 'ALIMENTOS',        // Alimentos y bebidas
  '2.12.1': 'ALIMENTOS',        // Packaging
  '2.13.2': 'ENTREGAS',         // Repartos propios
  '2.21.1': 'FIJOS_RRHH',       // Seguridad Social e IRPF
  '2.21.2': 'FIJOS_RRHH',       // Sueldo direccion
  '2.21.4': 'FIJOS_RRHH',       // Sueldo equipo
  '2.22.4': 'VARIABLES_RRHH',   // Gastos de equipo
  '2.31.1': 'ALQUILER_INMUEBLE',// Alquiler local
  '2.31.3': 'ALQUILER_INMUEBLE',// Gastos local
  '2.41.1': 'MARKETING',        // Marketing interno
  '2.41.5': 'MARKETING',        // Marketing plataformas
  '2.42.1': 'INTERNET_VENTAS',  // Web y tienda online
  '2.43.1': 'ADMIN_GENERALES',  // Servicios profesionales
  '2.43.2': 'ADMIN_GENERALES',  // Integraciones
  '2.43.8': 'ADMIN_GENERALES',  // Administracion
  '2.43.9': 'ADMIN_GENERALES',  // Comisiones banco
  '2.44.2': 'SUMINISTROS',      // Suministros
}

export function categoriaToSubcategoria(codigo: string | null | undefined): string {
  if (!codigo) return 'ADMIN_GENERALES'
  return SUBCATEGORIA[codigo] ?? 'ADMIN_GENERALES'
}

// Grupo por prefijo jerarquico. Coincide con los bloques de nivel 1/2 de categorias_pyg.
export function grupoFromCategoria(
  codigo: string | null | undefined,
  grupoDB: string | null | undefined,
): string {
  if (!codigo) return 'ADMIN_GENERALES'
  if (grupoDB && grupoDB !== 'CONTROLABLES') return grupoDB
  if (codigo.startsWith('1.')) return 'INGRESOS'
  if (codigo.startsWith('2.1')) return 'PRODUCTO'
  if (codigo.startsWith('2.2')) return 'RRHH'
  if (codigo.startsWith('2.31')) return 'ALQUILER'
  if (codigo.startsWith('2.41')) return 'MARKETING'
  if (codigo.startsWith('2.42')) return 'INTERNET_VENTAS'
  if (codigo.startsWith('2.44')) return 'SUMINISTROS'
  if (codigo.startsWith('3.')) return 'MOVIMIENTOS_INTERNOS'
  if (codigo.startsWith('4.')) return 'FINANCIACION'
  return 'ADMIN_GENERALES'
}

// Prefijos de codigo vivo por grupo. Lo usan los paneles para sumar presupuestos.
export const PREFIJOS_GRUPO: Record<string, string[]> = {
  producto:     ['2.11.', '2.12.', '2.13.'],
  equipo:       ['2.21.', '2.22.'],
  local:        ['2.31.'],
  controlables: ['2.41.', '2.42.', '2.43.', '2.44.'],
}

// ─── Traduccion LEGACY -> codigo vivo ──────────────────────────────────────
// Todos los destinos son categorias ACTIVAS tras la unificacion del 11-jul-2026.

const OLD_TO_NEW: Record<string, string> = {
  // Ingresos
  'ING-UE': '1.1.1',
  'ING-GL': '1.1.2',
  'ING-JE': '1.1.3',
  'ING-WEB': '1.1.4',
  'ING-DIR': '1.1.5',
  // Producto
  'PRD-MP': '2.11.1',
  'PRD-ALI': '2.11.1',
  'PRD-BEB': '2.11.1',
  'PRD-MER': '2.11.1',
  'PRD-PCK': '2.12.1',
  'PRD-PKG': '2.12.1',
  'PRD-ENT': '2.13.2',
  // Equipo
  'EQP-NOM': '2.21.4',   // sueldos empleados -> Sueldo equipo
  'EQP-RUB': '2.21.2',   // -> Sueldo direccion
  'EQP-EMI': '2.21.2',   // -> Sueldo direccion
  'EQP-SS': '2.21.1',    // -> Seguridad Social e IRPF
  'RRH-CAU': '2.21.1',
  'RRH-SS': '2.21.1',
  'RRH-IRP': '2.21.1',
  'RRH-SUE': '2.21.2',
  'RRH-GES': '2.22.4',   // gestoria laboral -> Gastos de equipo
  'EQP-GES': '2.22.4',
  'RRH-SEL': '2.22.4',
  'RRH-INC': '2.22.4',
  'RRH-UNI': '2.22.4',
  'RRH-FOR': '2.22.4',
  'EQP-FOR': '2.22.4',
  'RRH-COM': '2.22.4',
  'CTR-WOR': '2.22.4',   // Workana
  // Local
  'LOC-ALQ': '2.31.1',
  'ALQ-LOC': '2.31.1',
  'LOC-IRP': '2.31.1',   // retencion IRPF alquiler -> misma factura
  'ALQ-SEG': '2.31.3',
  'CTR-SEG': '2.31.3',
  'ALQ-RSU': '2.31.3',
  'ALQ-REP': '2.31.3',
  'LOC-MTO': '2.31.3',
  'LOC-LIM': '2.31.3',
  'LOC-COM': '2.31.3',
  // Marketing
  'CTR-MKT': '2.41.1',
  'CTR-PUB': '2.41.1',
  'CTR-DIS': '2.41.1',
  'CTR-IGF': '2.41.1',
  'CTR-GGL': '2.41.1',
  'CTR-ADS': '2.41.5',   // ads de plataforma
  // Web y tienda online
  'CTR-DOM': '2.42.1',
  'CTR-HOS': '2.42.1',
  'CTR-TOL': '2.42.1',
  'CTR-WEB': '2.42.1',
  // Servicios profesionales
  'CTR-GEF': '2.43.1',
  'CTR-GCO': '2.43.1',
  'CTR-SAV': '2.43.1',
  // Integraciones
  'CTR-SW': '2.43.2',
  'CTR-RUS': '2.43.2',
  'CTR-SIN': '2.43.2',
  // Administracion
  'CTR-IA': '2.43.8',
  'CTR-MOF': '2.43.8',
  'CTR-LIC': '2.43.8',
  'CTR-TRP': '2.43.8',
  'CTR-OTR': '2.43.8',
  'CTR-BAN': '2.43.9',
  'CTR-BNK': '2.43.9',
  // Suministros
  'LOC-SUM': '2.44.2',
  'LOC-NET': '2.44.2',
  'CTR-AGU': '2.44.2',
  'CTR-GAS': '2.44.2',
  'CTR-ELE': '2.44.2',
  'CTR-TEL': '2.44.2',
  // Movimientos internos
  'INT-TRF': '3.1',
  'INT-IVA': '3.2',
  'INT-PRS': '3.3',
}

// Cache de nombres
let _nombresCache: Record<string, string> | null = null

async function loadNombres(): Promise<Record<string, string>> {
  if (_nombresCache) return _nombresCache
  const { data } = await supabase.from('categorias_pyg').select('id, nombre').eq('activa', true)
  _nombresCache = {}
  for (const row of (data ?? [])) {
    _nombresCache[row.id] = row.nombre
  }
  return _nombresCache
}

export function mapCategoriaSync(old: string | null): { id: string; nombre: string } | null {
  if (!old) return null
  const newId = OLD_TO_NEW[old]
  if (!newId) return null
  const nombre = _nombresCache?.[newId] ?? newId
  return { id: newId, nombre }
}

export async function mapCategoria(old: string | null): Promise<{ id: string; nombre: string } | null> {
  if (!old) return null
  const newId = OLD_TO_NEW[old]
  if (!newId) return null
  const nombres = await loadNombres()
  return { id: newId, nombre: nombres[newId] ?? newId }
}

export function getNewId(old: string | null): string | null {
  if (!old) return null
  return OLD_TO_NEW[old] ?? null
}

export function getNombresCache(): Record<string, string> {
  return _nombresCache ?? {}
}

export function preloadNombres() {
  loadNombres()
}
