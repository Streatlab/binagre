// waterfallReceta.ts — fuente ÚNICA e importable del waterfall VIVO del Escandallo
// (antes inline en ModalReceta.tsx). Extraído tal cual, sin cambiar la fórmula, para
// poder blindarlo con test (Bloque D). La cadena de coste es:
//   eur_ud_neta por línea → coste por ración (EP o receta) → coste_mp del waterfall → margen.
//
// (Tanda D2, docs/BLOQUE_D2_COSTE_REAL.md): las huérfanas de docs/BLOQUE_D_WATERFALL.md
// (src/utils/calcWaterfall.ts y el calcWaterfall() de useConfig.ts) ya se han borrado.
// Las divergencias B/D/E/F de esa auditoría están cerradas: la merma entra en coste_mp
// vía precioNeto() en ModalEPS/ModalReceta, los fees fijos y la comisión real por canal
// llegan aquí ya resueltos en `comision` (ver comisionEfectivaCanal en ModalReceta.tsx).
// Este módulo sigue siendo puro/testeable: no llama a Supabase ni a netoResolver.

export interface Waterfall {
  costePlatR: number; costeEstrR: number; costeTotalR: number; margenR: number; margenPctR: number; ivaRepercutido: number
  costePlatC: number; costeEstrC: number; costeTotalC: number; margenC: number; margenPctC: number; ivaSoportado: number
  pvpRecR: number; pvpRecC: number; factorK: number
}

/** Normaliza un porcentaje que puede venir como 30 (→0.30) o ya como 0.30. */
export function norm(v: number): number { return v > 1 ? v / 100 : v }

/**
 * LEY-MARGEN-01 · cascada del margen deseado (decisión Rubén 22-jul).
 * Dos niveles, gana el más específico:
 *   1. override por receta (`recetas.margen_deseado_pct`, nullable) — si existe, manda.
 *   2. % global editable en Configuración (`margen_deseado_pct`).
 *   3. default (20) si no hay ni override ni global.
 * El `margen_deseado_pct` de `config_canales` YA NO se lee para el PVP recomendado.
 * Entrada en % (20) o decimal (0.20); salida SIEMPRE decimal.
 */
export function resolveMargenDeseado(overrideReceta: number | null | undefined, global: number | null | undefined, def = 20): number {
  const num = (v: number | null | undefined): number | null => (v == null || Number.isNaN(v) ? null : v)
  const pick = num(overrideReceta) ?? num(global) ?? def
  return norm(pick)
}

export interface PvpRec { viable: boolean; pvp: number }

/**
 * LEY-MARGEN-01 · PVP recomendado LIMPIO (modelo cash/C, sin tratar el IVA de la
 * comisión como coste — ver LEY-MARGEN-02). Denominador = 1 − comisión − estructura
 * − margenDeseado. Si el denominador es ≤ 0 no hay precio viable con esos parámetros
 * (la UI muestra "Sin precio viable con estos parámetros", nunca un 0 mudo).
 * `comision`/`estructura`/`margenDeseado` en decimal.
 */
export function pvpRecomendado(costeMP: number, comision: number, estructura: number, margenDeseado: number): PvpRec {
  const denom = 1 - comision - estructura - margenDeseado
  if (denom <= 0) return { viable: false, pvp: 0 }
  return { viable: true, pvp: costeMP / denom }
}

/** Coste por ración de un EP o receta = Σ(cantidad · eur_ud_neta) / raciones.
 *  Para líneas que son un EP, eur_ud_neta es el coste_rac de ese EP (snapshot). */
export function costeRacion(lineas: { cantidad: number; eur_ud_neta: number }[], raciones: number): number {
  const costeTanda = lineas.reduce((s, l) => s + l.cantidad * l.eur_ud_neta, 0)
  return raciones > 0 ? costeTanda / raciones : 0
}

/** Waterfall de un plato por canal. `comision`/`estructura`/`margenDeseado` en decimal. */
export function computeWaterfall(costeMP: number, pvp: number, comision: number, estructura: number, margenDeseado: number): Waterfall {
  const costePlatR = pvp * comision * 1.21
  const ingresoNetoR = pvp - costePlatR
  const costeEstrR = ingresoNetoR * estructura
  const costeTotalR = costeMP + costePlatR + costeEstrR
  const margenR = pvp - costeTotalR
  const margenPctR = pvp > 0 ? (margenR / pvp) * 100 : 0
  const ivaRepercutido = pvp > 0 ? (ingresoNetoR / 1.10) * 0.10 : 0

  const costePlatC = pvp * comision
  const ingresoNetoC = pvp - costePlatC
  const costeEstrC = ingresoNetoC * estructura
  const costeTotalC = costeMP + costePlatC + costeEstrC
  const margenC = pvp - costeTotalC
  const margenPctC = pvp > 0 ? (margenC / pvp) * 100 : 0
  const ivaSoportado = pvp * comision * 0.21

  const denomR = 1 - comision * 1.21 - estructura - margenDeseado
  const denomC = 1 - comision - estructura - margenDeseado
  const pvpRecR = denomR > 0 ? costeMP / denomR : 0
  const pvpRecC = denomC > 0 ? costeMP / denomC : 0
  const factorK = pvp > 0 && costeMP > 0 ? pvp / costeMP : 0

  return { costePlatR, costeEstrR, costeTotalR, margenR, margenPctR, ivaRepercutido, costePlatC, costeEstrC, costeTotalC, margenC, margenPctC, ivaSoportado, pvpRecR, pvpRecC, factorK }
}
