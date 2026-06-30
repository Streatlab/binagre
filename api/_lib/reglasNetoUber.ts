// reglasNetoUber.ts — REGLAS CANÓNICAS del cálculo de neto/bruto de Uber Eats.
// Centraliza la lógica para que TODOS los formatos (PDF mensual, resumen semanal,
// CSV de ganancias) calculen el neto igual y cuadren con lo que Uber deposita.
//
// ───────────────────────────────────────────────────────────────────────────
// REGLAS DE NEGOCIO (validadas con La Cocina de Carmucha, mayo 2026, al céntimo):
//
// R1 · "Ventas" del documento es un precio INFLADO. El precio real que paga el
//      cliente = Ventas − "Promociones en artículos".
//      → BRUTO REAL = ventas − promocionesEnArticulos
//      "Promociones en artículos" NO es un gasto: es el descuento del inflado.
//
// R2 · Sobre ese bruto real, Uber descuenta:
//        − Tasas de mercado        (comisión 30% / 33% prime, con IVA)
//        − Otros cargos promoción   (fee por pedido en promo)
//        − Gastos en anuncios (ads) − Créditos de anuncios
//        − Ajustes                  (reembolsos/retenciones)
//      Y suma de vuelta:
//        + Otros cargos (ajuste de IVA, normalmente céntimos, puede ser +/−)
//        + Cupones                  (parte cobrada vía cupón = ingreso)
//        + Otras ganancias / propinas (si las hubiera)
//
// R3 · NETO = brutoReal − comisión − feePromo − ads + creditosAds − ajustes
//             + otrosCargos + cupones + otrasGanancias
//      (El "Gasto total de marketing" del PDF NO se usa tal cual: agrupa promo
//       en artículos —que NO es gasto— con ads y fee promo. Hay que separarlo.)
//
// R4 · RATIO NETO = neto / brutoReal   (NO neto / ventasInfladas)
//
// R5 · Fees semanales/periódicos de Uber: van incluidos dentro de "Ajustes" o
//      "Tasas de mercado" en estos documentos. No se añaden aparte.
// ───────────────────────────────────────────────────────────────────────────

export interface ComponentesUber {
  ventasInfladas: number         // "Ventas" tal cual del documento
  promoArticulos: number         // "Promociones en artículos" (descuento del inflado)
  comision: number               // "Tasas de mercado"
  feePromo: number               // "Otros cargos de la promoción"
  ads: number                    // "Gastos en anuncios"
  creditosAds: number            // "Créditos de los anuncios"
  ajustes: number                // "Ajustes" (reembolsos)
  otrosCargos: number            // "Otros cargos" (ajuste IVA, +/−)
  cupones: number                // "Cupones"
  otrasGanancias: number         // "Otras ganancias" + propinas + envases
  pedidos: number
}

export interface NetoUberCalculado {
  brutoReal: number
  neto: number
  ratio: number                  // neto / brutoReal (0..1)
  // desglose para guardar en columnas
  comision_eur: number
  ads_eur: number
  promo_eur: number              // fee promo (coste real), NO la promo en artículos
  cupones_eur: number
  ajustes_eur: number
  promo_articulos_eur: number    // el descuento del inflado (informativo)
}

// Aplica las reglas R1–R4 sobre los componentes leídos del documento.
// `otrosCargosSigno`: "Otros cargos" puede venir + o −; pásalo con su signo real.
export function calcularNetoUber(c: ComponentesUber): NetoUberCalculado {
  // R1: bruto real = ventas infladas − promo en artículos
  const brutoReal = Math.max(0, c.ventasInfladas - c.promoArticulos)

  const adsNeto = Math.max(0, c.ads - c.creditosAds)

  // R3: neto
  const neto =
    brutoReal
    - c.comision
    - c.feePromo
    - adsNeto
    - c.ajustes
    + c.otrosCargos
    + c.cupones
    + c.otrasGanancias

  // R4: ratio sobre bruto real
  const ratio = brutoReal > 0 ? neto / brutoReal : 0

  return {
    brutoReal,
    neto,
    ratio,
    comision_eur: c.comision,
    ads_eur: adsNeto,
    promo_eur: c.feePromo,
    cupones_eur: c.cupones,
    ajustes_eur: c.ajustes,
    promo_articulos_eur: c.promoArticulos,
  }
}

// Validación: ¿el neto calculado cuadra con el "Total neto" que dice el documento?
// Devuelve la diferencia absoluta. Si > 0.05€, el parser leyó algún campo mal.
export function validarContraDocumento(calc: NetoUberCalculado, totalNetoDoc: number): number {
  return Math.abs(calc.neto - totalNetoDoc)
}
