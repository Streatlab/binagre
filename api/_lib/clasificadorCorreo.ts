// clasificadorCorreo.ts — CLASIFICADOR UNIVERSAL DEL CARTERO (Prompt 1, task 7).
//
// Los proveedores y la gestoría envían TODO al buzón: nóminas, resúmenes de
// nóminas, Seguridad Social (RNT/RLC), extractos bancarios, facturas y ventas.
// Antes de mandar un adjunto al motor de facturas, se clasifica por CONTENIDO para
// que una nómina o un extracto NO se procese como factura.
//
// Nota de alcance: los handlers de ingesta específicos (subidaDocEquipo,
// titular_por_nif) que asumía el prompt no existen en el repo. Este clasificador
// DESVÍA el documento del motor de facturas y deja un aviso de papeleo con el
// destino detectado (nada se ingesta a ciegas en tablas de producción); el
// aprendizaje por remitente (reglas_correo_ocr) queda operativo desde el backend.

export type DestinoCorreo = 'doc_equipo' | 'extracto' | 'factura'

export interface ClasificacionCorreo {
  destino: DestinoCorreo
  subtipo: string | null      // 'nomina' | 'resumen_nominas' | 'seguridad_social' | 'rnt' | null
  motivo: string
}

const RE_NOMINA = /(?<![a-záéíóúü])n[oó]minas?(?![a-záéíóúü])|recibo\s+de\s+salarios?|l[ií]quido\s+a\s+percibir|devengos?\s+y\s+deducciones/i
const RE_RESUMEN_NOMINAS = /resumen\s+de\s+n[oó]minas|listado\s+de\s+n[oó]minas/i
const RE_SEG_SOCIAL = /seguridad\s+social|tesorer[ií]a\s+general|\bTGSS\b|\bRLC\b|\bTC1\b|\bTC2\b|cotizaci[oó]n(?:es)?\s+sociales/i
const RE_RNT = /\bRNT\b|relaci[oó]n\s+nominal\s+de\s+trabajadores/i

// Clasifica un adjunto por su nombre + texto. Devuelve 'factura' si no reconoce
// ninguna señal fuerte de documento de equipo (el motor de facturas ya detecta
// ventas de plataforma internamente, así que 'factura' cubre también ventas).
export function clasificarPorContenido(nombre: string, texto: string | null | undefined): ClasificacionCorreo {
  const base = `${nombre || ''}\n${texto || ''}`
  if (RE_RNT.test(base)) return { destino: 'doc_equipo', subtipo: 'rnt', motivo: 'Relación Nominal de Trabajadores (RNT)' }
  if (RE_SEG_SOCIAL.test(base)) return { destino: 'doc_equipo', subtipo: 'seguridad_social', motivo: 'documento de Seguridad Social' }
  if (RE_RESUMEN_NOMINAS.test(base)) return { destino: 'doc_equipo', subtipo: 'resumen_nominas', motivo: 'resumen de nóminas' }
  if (RE_NOMINA.test(base)) return { destino: 'doc_equipo', subtipo: 'nomina', motivo: 'nómina' }
  return { destino: 'factura', subtipo: null, motivo: 'sin señal de documento de equipo' }
}

// ¿El asunto/remitente casa con una regla de aprendizaje (reglas_correo_ocr)?
// remitente: match por inclusión (case-insensitive); asunto_contiene: substring.
export function reglaCasa(
  regla: { remitente?: string | null; asunto_contiene?: string | null },
  remitente: string | null | undefined, asunto: string | null | undefined,
): boolean {
  const rem = (remitente || '').toLowerCase()
  const asu = (asunto || '').toLowerCase()
  const rReg = (regla.remitente || '').toLowerCase().trim()
  const aReg = (regla.asunto_contiene || '').toLowerCase().trim()
  if (rReg && !rem.includes(rReg)) return false
  if (aReg && !asu.includes(aReg)) return false
  return !!(rReg || aReg)
}
