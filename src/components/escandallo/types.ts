/* ── Tipos compartidos del módulo Escandallo ── */

export interface Ingrediente {
  id: string
  iding?: string
  categoria?: string
  nombre_base?: string
  abv?: string
  nombre: string
  marca?: string
  formato?: string
  uds?: number
  ud_std: string
  ud_min: string
  precio_activo?: number
  eur_std: number
  eur_min: number
  merma_pct?: number
  coste_neto_std?: number
  coste_neto_min?: number
  tipo_merma?: string
  usos?: number
}

export interface Merma {
  id: string
  iding?: string
  nombre_base?: string
  abv?: string
  nombre: string
  ud_std?: string
  uds?: number
  precio_total?: number
  pct_merma?: number
  pct_limpio?: number
  eur_kg_neto?: number
  num_porciones?: number
  eur_porcion?: number
  peso_porcion_g?: number
}

export interface EPS {
  id: string
  codigo?: string
  nombre: string
  raciones: number
  tamano_rac?: number
  unidad: string
  coste_tanda: number
  coste_rac: number
}

export interface EPSLinea {
  linea: number
  ingrediente_nombre: string
  ingrediente_id: string | null
  cantidad: number
  unidad: string
  eur_ud_neta: number
}

export interface Receta {
  id: string
  codigo?: string
  nombre: string
  raciones: number
  categoria?: string
  coste_tanda: number
  coste_rac: number
  pvp_uber: number
  pvp_glovo: number
  pvp_je: number
  pvp_web: number
  pvp_directa: number
}

export interface RecetaLinea {
  linea: number
  tipo: 'ING' | 'EPS'
  ingrediente_nombre: string
  ingrediente_id: string | null
  eps_id: string | null
  cantidad: number
  unidad: string
  eur_ud_neta: number
}

/* ── Canales ── */

export type CanalKey = 'pvp_uber' | 'pvp_glovo' | 'pvp_je' | 'pvp_web' | 'pvp_directa'

export interface Canal {
  key: CanalKey
  label: string
  comision: number
}

export const CANALES: Canal[] = [
  { key: 'pvp_uber', label: 'Uber Eats', comision: 0.30 },
  { key: 'pvp_glovo', label: 'Glovo', comision: 0.30 },
  { key: 'pvp_je', label: 'Just Eat', comision: 0.20 },
  { key: 'pvp_web', label: 'Web', comision: 0.07 },
  { key: 'pvp_directa', label: 'Directa', comision: 0 },
]

export const UNIDADES = ['gr.', 'Kg.', 'ml.', 'L.', 'ud.', 'Ud.', 'Ración']

/* ── Helpers ── */

export const semaforoClasses = (pct: number) => {
  if (pct >= 15) return 'bg-green-500/10 text-green-400'
  if (pct >= 10) return 'bg-amber-500/10 text-amber-400'
  return 'bg-red-500/10 text-red-400'
}

export const fmt = (n: number | null | undefined, decimals = 2) =>
  (n ?? 0).toFixed(decimals)

export const fmtPct = (n: number | null | undefined) =>
  (n ?? 0).toFixed(1) + '%'

/* ── CSS compartido ── */

export const inputCls = 'w-full bg-base border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-accent'
export const thCls = 'px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500 font-medium text-left whitespace-nowrap'
export const tdCls = 'px-3 py-2 text-sm text-neutral-300 tabular-nums whitespace-nowrap'
