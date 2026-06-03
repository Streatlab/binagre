/**
 * Cálculo de waterfall unificado para recetas.
 * Implementa fórmulas exactas de coste, margen, IVA y PVP recomendado.
 *
 * OPCIÓN B ACTIVA: comisión ponderada con mezcla Prime/Promo.
 * Los % se auto-actualizan vía trigger estadisticas_prime_promo → config_canales.
 *
 * Ref: Notion 366c8b1f-6139-81a8-95a7-dd0abdf63a91
 */

export interface ConfigCanal {
  nombre: string;
  comision_pct: number;          // 0-1 base
  comision_pct_prime: number;    // 0-1 prime (0 si no aplica)
  estructura_pct: number;        // 0-1
  margen_deseado_pct: number;    // 0-1
  pct_pedidos_prime: number;     // 0-1 media últimos 3 meses
  pct_pedidos_promo: number;     // 0-1
  fee_prime_eur: number;         // € por pedido prime
  fee_promo_eur: number;         // € por pedido promo
  fijo_eur: number;              // € fijo por pedido
}

export interface FilaWaterfall {
  coste_mp: number;
  coste_plataforma: number;
  coste_estructura: number;
  coste_total: number;
  margen_deseado: number;
  pvp_recomendado: number;
  pvp_real: number;
  factor_k: number;
  margen_eur: number;
  margen_pct: number;
  iva_repercutido: number;
  iva_soportado: number;
}

export interface ResultadoCanal {
  real: FilaWaterfall;
  cash: FilaWaterfall;
}

export interface ResultadoWaterfall {
  [canalKey: string]: ResultadoCanal;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/**
 * Calcula comisión ponderada con mezcla Prime/Promo.
 */
function comisionPonderada(canal: ConfigCanal): number {
  if (canal.comision_pct_prime > 0 && canal.pct_pedidos_prime > 0) {
    return (1 - canal.pct_pedidos_prime) * canal.comision_pct
         + canal.pct_pedidos_prime * canal.comision_pct_prime;
  }
  return canal.comision_pct;
}

/**
 * Fee medio ponderado por pedido (Prime + Promo + fijo).
 */
function feeMedioPorPedido(canal: ConfigCanal): number {
  return canal.fijo_eur
       + canal.fee_prime_eur * canal.pct_pedidos_prime
       + canal.fee_promo_eur * canal.pct_pedidos_promo;
}

function calcFilaWaterfall(
  coste_mp: number,
  pvp_real: number,
  canal: ConfigCanal,
  conIvaComision: boolean
): FilaWaterfall {
  coste_mp = round4(coste_mp);
  pvp_real = round4(pvp_real);

  const comPct = round4(comisionPonderada(canal));
  const feeMedio = round4(feeMedioPorPedido(canal));
  const estructura_pct = round4(canal.estructura_pct);
  const margen_deseado_pct = round4(canal.margen_deseado_pct);

  const comisionBase = pvp_real * comPct + feeMedio;
  const coste_plataforma = conIvaComision
    ? round4(comisionBase * 1.21)
    : round4(comisionBase);

  const ingreso_neto = round4(pvp_real - coste_plataforma);
  const coste_estructura = round4(ingreso_neto * estructura_pct);
  const coste_total = round4(coste_mp + coste_estructura + coste_plataforma);

  const margen_eur = round4(pvp_real - coste_total);
  const margen_pct = pvp_real > 0 ? round4((margen_eur / pvp_real) * 100) : 0;

  let iva_repercutido = 0;
  let iva_soportado = 0;
  if (pvp_real > 0) {
    iva_repercutido = round4((ingreso_neto / 1.1) * 0.1);
    if (conIvaComision) {
      iva_soportado = round4(comisionBase * 0.21);
    }
  }

  const comPctEfectivo = comPct + (pvp_real > 0 ? feeMedio / pvp_real : 0);
  const denominador = round4(1 - comPctEfectivo * (conIvaComision ? 1.21 : 1) - estructura_pct - margen_deseado_pct);
  const pvp_recomendado = denominador > 0 ? round4(coste_mp / denominador) : 0;
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

export function calcWaterfall(
  coste_mp: number,
  pvp_real: number,
  canal: ConfigCanal
): ResultadoCanal {
  return {
    real: calcFilaWaterfall(coste_mp, pvp_real, canal, true),
    cash: calcFilaWaterfall(coste_mp, pvp_real, canal, false),
  };
}

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
