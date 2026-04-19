/**
 * Cálculo de waterfall unificado para recetas.
 * Implementa fórmulas exactas de coste, margen, IVA y PVP recomendado.
 */

// ============================================================================
// TIPOS
// ============================================================================

export interface ConfigCanal {
  nombre: string;
  comision_pct: number; // 0-1 (ej: 0.30 = 30%)
  estructura_pct: number; // 0-1 (ej: 0.25 = 25%)
  margen_deseado_pct: number; // 0-1 (ej: 0.15 = 15%)
}

export interface FilaWaterfall {
  coste_mp: number; // Coste de materia prima
  coste_plataforma: number; // Comisión plataforma
  coste_estructura: number; // % de estructura sobre ingreso neto
  coste_total: number; // Suma de todos los costes
  margen_deseado: number; // Margen objetivo en euros
  pvp_recomendado: number; // PVP que garantiza margen deseado
  pvp_real: number; // PVP introducido por usuario
  factor_k: number; // Multiplicador pvp_real / coste_mp
  margen_eur: number; // Margen en euros (pvp_real - coste_total)
  margen_pct: number; // Margen en % (margen_eur / pvp_real)
  iva_repercutido: number; // IVA que repercutes (Real: IVA comisión incluido)
  iva_soportado: number; // IVA que recuperas (Cash: IVA comisión deducible)
}

export interface ResultadoCanal {
  real: FilaWaterfall; // Impacto real (IVA comisión incluido)
  cash: FilaWaterfall; // Cashflow (IVA comisión deducible)
}

export interface ResultadoWaterfall {
  [canalKey: string]: ResultadoCanal;
}

// ============================================================================
// FUNCIONES INTERNAS
// ============================================================================

/**
 * Redondea a 4 decimales para operaciones internas.
 */
function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/**
 * Calcula una fila de waterfall (real o cash) con fórmulas exactas.
 *
 * @param coste_mp Coste de materia prima
 * @param pvp_real PVP introducido por usuario (0 = sin PVP aún)
 * @param comision_pct Porcentaje de comisión (0-1)
 * @param estructura_pct Porcentaje de estructura (0-1)
 * @param margen_deseado_pct Margen deseado (0-1)
 * @param conIvaComision Si true, aplica 1.21 a comisión; si false, solo comisión sin IVA
 * @returns FilaWaterfall con todos los campos calculados
 */
function calcFilaWaterfall(
  coste_mp: number,
  pvp_real: number,
  comision_pct: number,
  estructura_pct: number,
  margen_deseado_pct: number,
  conIvaComision: boolean
): FilaWaterfall {
  // Normalizar % si vienen sin normalizar (ej: 33 → 0.33)
  comision_pct = comision_pct > 1 ? comision_pct / 100 : comision_pct
  estructura_pct = estructura_pct > 1 ? estructura_pct / 100 : estructura_pct
  margen_deseado_pct = margen_deseado_pct > 1 ? margen_deseado_pct / 100 : margen_deseado_pct

  // Garantizar decimales correctos
  coste_mp = round4(coste_mp);
  pvp_real = round4(pvp_real);
  comision_pct = round4(comision_pct);
  estructura_pct = round4(estructura_pct);
  margen_deseado_pct = round4(margen_deseado_pct);

  // Coste plataforma: comisión base
  const coste_plataforma = conIvaComision
    ? round4(pvp_real * comision_pct * 1.21)
    : round4(pvp_real * comision_pct);

  // Ingreso neto: lo que entra menos comisión
  const ingreso_neto = round4(pvp_real - coste_plataforma);

  // Coste estructura: % sobre ingreso neto
  const coste_estructura = round4(ingreso_neto * estructura_pct);

  // Coste total: MP + estructura + plataforma
  const coste_total = round4(coste_mp + coste_estructura + coste_plataforma);

  // Margen en euros y %
  const margen_eur = round4(pvp_real - coste_total);
  const margen_pct = pvp_real > 0 ? round4((margen_eur / pvp_real) * 100) : 0;

  // IVA (diferencia entre Real y Cash)
  let iva_repercutido = 0;
  let iva_soportado = 0;

  if (pvp_real > 0) {
    if (conIvaComision) {
      // Real: IVA que repercutes (IVA sobre ingreso neto a 10%, menos IVA soportado en comisión)
      iva_repercutido = round4((ingreso_neto / 1.1) * 0.1);
      // IVA soportado es el IVA en la comisión
      iva_soportado = round4(pvp_real * comision_pct * 0.21);
    } else {
      // Cash: sin IVA comisión
      iva_repercutido = round4((ingreso_neto / 1.1) * 0.1);
      iva_soportado = 0;
    }
  }

  // PVP recomendado: el mínimo para garantizar margen deseado
  let pvp_recomendado = 0;
  const denominador = round4(1 - comision_pct * (conIvaComision ? 1.21 : 1) - estructura_pct - margen_deseado_pct);
  if (denominador > 0) {
    pvp_recomendado = round4(coste_mp / denominador);
  }

  // Factor K: multiplicador coste
  const factor_k = coste_mp > 0 && pvp_real > 0 ? round4(pvp_real / coste_mp) : 0;

  return {
    coste_mp,
    coste_plataforma,
    coste_estructura,
    coste_total,
    margen_deseado: round4(margen_deseado_pct * pvp_real),
    pvp_recomendado,
    pvp_real,
    factor_k,
    margen_eur,
    margen_pct,
    iva_repercutido,
    iva_soportado,
  };
}

// ============================================================================
// FUNCIONES PÚBLICAS
// ============================================================================

/**
 * Calcula waterfall para un canal (real + cash).
 *
 * @param coste_mp Coste de materia prima
 * @param pvp_real PVP introducido (0 = sin PVP)
 * @param canal Configuración del canal
 * @returns ResultadoCanal con real y cash
 */
export function calcWaterfall(
  coste_mp: number,
  pvp_real: number,
  canal: ConfigCanal
): ResultadoCanal {
  return {
    real: calcFilaWaterfall(
      coste_mp,
      pvp_real,
      canal.comision_pct,
      canal.estructura_pct,
      canal.margen_deseado_pct,
      true // Real: incluye IVA en comisión
    ),
    cash: calcFilaWaterfall(
      coste_mp,
      pvp_real,
      canal.comision_pct,
      canal.estructura_pct,
      canal.margen_deseado_pct,
      false // Cash: sin IVA comisión (deducible)
    ),
  };
}

/**
 * Calcula waterfall para todos los canales.
 *
 * @param coste_mp Coste de materia prima
 * @param pvp_real PVP introducido
 * @param canales Array de canales configurados
 * @returns Objeto con waterfall por cada canal
 */
export function calcWaterfallTodosCanales(
  coste_mp: number,
  pvp_real: number,
  canales: ConfigCanal[]
): ResultadoWaterfall {
  const resultado: ResultadoWaterfall = {};

  for (const canal of canales) {
    resultado[canal.nombre] = calcWaterfall(coste_mp, pvp_real, canal);
  }

  return resultado;
}
