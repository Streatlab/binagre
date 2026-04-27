/**
 * T-F2-06 — Parser Just Eat (stub)
 *
 * Sin archivos de ejemplo reales. Devuelve error informativo.
 * No bloquea la importación — UI muestra toast amarillo con instrucción.
 */

import type { ParserOutput } from './types.js'

export function parseJustEatFactura(
  _texto: string,
): ParserOutput {
  return {
    ok: false,
    pendiente: true,
    mensaje: 'Sin parser Just Eat — subir archivo ejemplo a Rubén para implementar',
  }
}
