/* ── Tipos compartidos del módulo Escandallo ── */
import { fmtDate } from '@/utils/format'

export interface Ingrediente {
  id: string
  iding?: string
  nombre_base?: string
  abv?: string
  nombre: string
  categoria?: string
  /** FK -> categorias_ingredientes(id). Fuente única de categoría (Config y Escandallo comparten tabla). */
  categoria_id?: string | null
  marca?: string
  formato?: string
  uds?: number
  ud_std?: string
  ud_min?: string
  usos?: number
  precio1?: number
  precio2?: number
  precio3?: number
  precio_activo?: number
  ultimo_precio?: number
  selector_precio?: 'ultimo' | 'media'
  activo?: boolean
  eur_std?: number
  eur_min?: number
  tipo_merma?: 'Tecnica' | 'Manual' | null
  merma_pct?: number
  merma_ef?: number
  coste_neto_std?: number
  ud_neto_std?: string
  coste_neto_min?: number
  ud_neto_min?: string
  /** T-F4-03: proveedor principal asignable */
  proveedor_principal?: string | null
}

export interface Merma {
  id: string
  iding?: string
  nombre_base?: string
  abv?: string
  nombre: string
  categoria?: string
  marca?: string
  formato?: string
  uds?: number
  ud_std?: string
  precio_total?: number
  sp1_nombre?: string
  sp1_peso_g?: number
  sp1_pct?: number
  sp1_euros?: number
  sp1_valorable?: boolean
  sp2_nombre?: string
  sp2_peso_g?: number
  sp2_pct?: number
  sp2_euros?: number
  sp2_valorable?: boolean
  pct_sp1?: number
  pct_sp2?: number
  pct_descarte?: number
  pct_merma?: number
  pct_limpio?: number
  eur_pieza_limpia?: number
  eur_kg_neto?: number
  neto_kg?: number
  num_porciones?: number
  peso_porcion_g?: number
  eur_porcion?: number
}

export interface EPS {
  id: string
  codigo?: string
  nombre: string
  categoria?: string
  raciones: number
  tamano_rac?: number
  unidad: string
  coste_tanda: number
  coste_rac: number
  usos?: number
  fecha?: string
  preparacion?: string | null
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
  categoria?: string
  raciones: number
  tamano_rac?: number
  unidad?: string
  coste_tanda: number
  coste_rac: number
  pvp_uber: number
  pvp_glovo: number
  pvp_je: number
  pvp_web: number
  pvp_directa: number
  fecha?: string
  margen_deseado_pct?: number | null   // LEY-MARGEN-01: override por receta; null => usa el global
}

export interface RecetaLinea {
  linea: number
  tipo: 'ING' | 'EPS' | 'ENV'
  ingrediente_nombre: string
  ingrediente_id: string | null
  eps_id: string | null
  cantidad: number
  unidad: string
  eur_ud_neta: number
}

/* ── Canales (solo tipo, valores reales viven en config_canales Supabase) ── */

export type CanalKey = 'pvp_uber' | 'pvp_glovo' | 'pvp_je' | 'pvp_web' | 'pvp_directa'

export interface Canal { key: CanalKey; label: string }

export const UNIDADES = ['gr.', 'Kg.', 'ml.', 'L.', 'ud.', 'Ud.', 'Ración']

/* ── marcaMap (ABV → proveedor completo) ── */

export const MARCA_MAP: Record<string, string> = {
  MER: 'Mercadona',
  ALC: 'Alcampo',
  MRM: 'Merma',
  EPS: 'Cocina Interna',
  CHI: 'China Caliente',
  CHO: 'China Gruñona',
  JAS: 'Jasa',
  ENV: 'Envapro',
  EMB: 'Embajadores',
  TGT: 'Target',
  LID: 'Lidl',
}

export const getProveedor = (abv?: string | null): string => {
  if (!abv) return ''
  return MARCA_MAP[abv.toUpperCase()] ?? abv
}

/* ── Helpers ── */

export const n = (v: number | null | undefined) => v ?? 0

/** Precio por unidad que debe cargar una línea de EPS/receta: SIEMPRE el neto con
 *  merma si existe (Tanda D2 · divergencia B), con fallback al bruto para
 *  ingredientes recién pre-creados que aún no tienen coste_neto calculado. */
export const precioNeto = (ing: { eur_min?: number | null; eur_std?: number | null; coste_neto_min?: number | null; coste_neto_std?: number | null } | null | undefined) =>
  n(ing?.coste_neto_min) || n(ing?.coste_neto_std) || n(ing?.eur_min) || n(ing?.eur_std)

/* ── Formato ES obligatorio: coma decimal, punto miles. Null/undefined → '' ── */
export const fmtES = (v: number | null | undefined, d = 2): string => {
  if (v == null || isNaN(v as number)) return ''
  return (v as number).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export const fmtEurES = (v: number | null | undefined, d = 2): string => {
  const s = fmtES(v, d)
  return s ? s + ' €' : ''
}

export const fmtPctES = (v: number | null | undefined, d = 2): string => {
  const s = fmtES(v, d)
  return s ? s + '%' : ''
}

/** Versión que recibe % como fracción (0.3 → 30%) */
export const fmtPctFracES = (v: number | null | undefined, d = 2): string => {
  if (v == null || isNaN(v as number)) return ''
  return fmtES((v as number) * 100, d) + '%'
}

/** Compatibilidad retroactiva */
export const fmt = fmtES
export const fmtPct = (v: number | null | undefined) => {
  if (v == null) return ''
  return fmtES(v, 1) + '%'
}

/** dd/mm/aa desde string ISO o Date. Null → '' */
export const fmtDateES = fmtDate

/** Semáforo para márgenes: verde >10%, amarillo >=0%, rojo <0% */
export const semaforoClasses = (pct: number) => {
  if (pct > 10) return 'bg-[#1e3a1e] text-[#6ee7b7]'
  if (pct >= 0) return 'bg-[#3a2a0a] text-[#fbbf24]'
  return 'bg-[#3a1a1a] text-[#fca5a5]'
}

/** Semáforo USOS: sin usos=gris neutro, en uso=rojo corporativo */
export const semaforoUsos = (usos: number) => {
  if (usos === 0) return 'bg-[var(--sl-app)] text-[var(--sl-text-muted)] border-transparent'
  return 'bg-[var(--sl-red)] text-white border-transparent'
}

/* ── CSS compartido — DESIGN SYSTEM (fondo oscuro azul-púrpura) ── */

export const inputCls =
  'w-full bg-[var(--sl-input-edit)] border border-[var(--sl-border-strong)] rounded-md px-3 py-2 text-[13px] text-[var(--sl-text-primary)] placeholder:text-[var(--sl-text-muted)] focus:outline-none focus:border-accent font-sans'

/** Cabecera de tabla — Oswald uppercase */
export const thCls =
  'px-3.5 py-2.5 text-[11px] uppercase tracking-[0.1em] text-[var(--sl-text-muted)] font-semibold text-left whitespace-nowrap bg-[var(--sl-thead)] border-b border-[var(--sl-border)] font-ui'

export const tdCls =
  'px-3.5 py-2.5 text-[13px] text-[var(--sl-text-secondary)] tabular-nums whitespace-nowrap border-b border-[var(--sl-border)] font-sans'

/** Botón Guardar (Oswald + rojo corporativo) */
export const btnPrimary =
  'px-[22px] py-2 bg-[var(--sl-red)] text-white text-[14px] font-medium rounded-md hover:brightness-110 transition font-ui uppercase tracking-[0.04em]'

/** Botón Añadir (Oswald + amarillo) */
export const btnAdd =
  'px-[22px] py-2 bg-[var(--sl-btn-add-alt-bg)] text-[var(--sl-btn-add-alt-text)] text-[14px] font-medium rounded-md hover:brightness-110 transition font-ui uppercase tracking-[0.04em]'

/** Botón Cancelar (Lexend + gris neutro) */
export const btnSecondary =
  'px-[22px] py-2 bg-[var(--sl-btn-cancel-bg)] border border-[var(--sl-btn-cancel-border)] text-[var(--sl-btn-cancel-text)] text-[13px] rounded-md hover:brightness-110 transition font-sans'

/** Tab activo/inactivo */
export const tabActiveCls = 'bg-accent text-[var(--sl-btn-add-alt-text)] border-accent font-ui uppercase tracking-[0.06em]'
export const tabInactiveCls = 'text-[var(--sl-text-muted)] border-[var(--sl-border)] hover:text-[var(--sl-text-primary)] hover:border-[var(--sl-border-strong)] font-ui uppercase tracking-[0.06em]'
