import { supabase } from '@/lib/supabase'

const OLD_TO_NEW: Record<string, string> = {
  'ING-UE': '1.1.1',
  'ING-GL': '1.1.2',
  'ING-JE': '1.1.3',
  'ING-WEB': '1.1.4',
  'ING-DIR': '1.1.5',
  'PRD-MP': '2.11.1',
  'PRD-PCK': '2.12.1',
  'EQP-NOM': '2.21.1',
  'EQP-RUB': '2.21.2',
  'EQP-EMI': '2.21.3',
  'EQP-SS': '2.21.11',
  'EQP-FOR': '2.22.3',
  'LOC-ALQ': '2.31.1',
  'LOC-IRP': '2.31.2',
  'LOC-SUM': '2.44.2',
  'LOC-NET': '2.44.1',
  'LOC-MTO': '2.31.5',
  'CTR-MKT': '2.41.1',
  'CTR-SW': '2.43.2',
  'CTR-SEG': '2.43.10',
  'CTR-OTR': '2.43.10',
  'INT-TRF': '3.1',
  'INT-PRS': '3.3',
  'INT-IVA': '3.2',
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
