// ocr-config.ts — D02 G07: constantes centralizadas OCR/matching
// Única fuente de verdad para tolerancias y límites compartidos entre frontend y backend

/** Tolerancia matching factura↔banco en euros */
export const TOLERANCIA_IMPORTE = 0.05

/** Fecha límite inferior para conciliación. Facturas anteriores → estado 'historica' */
export const LIMITE_CONCILIACION = '2023-07-01'

// G10: NOTA — existen dos tablas de reglas:
// - reglas_conciliacion: reglas para matching banco↔factura (patron, patron_nif, categoria_codigo, set_proveedor)
// - reglas_ocr: reglas legacy para OCR edge function (patron_nif, categoria_codigo, titular_id, proveedor_canonico)
// El flujo actual (Vercel API) usa reglas_conciliacion. La edge function legacy (desactivada) usaba reglas_ocr.
// Ambas coexisten porque reglas_ocr tiene campo titular_id que reglas_conciliacion no tiene.
// TODO: migrar campos útiles de reglas_ocr a reglas_conciliacion y eliminar reglas_ocr.

// H01: NOTA — api/_lib/ocr.ts solo contiene tipos compartidos (ExtractedFactura).
// Las capas de pago (Anthropic/Mistral) fueron eliminadas por política: OCR 100% gratis.
