// Shim de compatibilidad: el antiguo ocr.ts fue dividido y sus tipos viven en
// ocr-types.ts. Varios módulos (matching, extractores, procesarArchivo) siguen
// importando desde './ocr.js'; este re-export evita romper el build.
export type { ExtractedFactura } from './ocr-types.js'
