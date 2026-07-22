// splitNominas.ts — la gestoría manda SIEMPRE un único PDF con TODAS las nóminas
// del mes pegadas (varios "LÍQUIDO A PERCIBIR" en el mismo archivo). Este módulo
// lo parte en un PDF por nómina para que cada una se procese por su trabajador,
// igual que si hubieran llegado por separado.
//
// Criterio de corte (determinista, sin IA): se lee el texto página a página y un
// segmento (=una nómina) termina en la página que contiene el "LÍQUIDO A PERCIBIR".
// Una nómina de varias páginas queda entera en su segmento; una nómina por página
// da un segmento por página. Si el recuento de segmentos no casa con el nº de
// recibos detectados, el llamador manda el documento a revisión (cero pérdidas).
import { PDFDocument } from 'pdf-lib'
import { extraerTextoPDFPorPaginas } from './extractores.js'

export interface SegmentoNomina {
  buffer: Buffer
  texto: string
  paginas: number[] // índices 0-based dentro del PDF original (para trazas)
}

function normalizar(t: string): string {
  return t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function contarRecibos(texto: string): number {
  return (normalizar(texto).match(/LIQUIDO A PERCIBIR/g) || []).length
}

/**
 * Parte el PDF en un segmento por nómina. Devuelve null si no se puede partir
 * con seguridad (texto ilegible por páginas, o recuento que no casa): en ese
 * caso el llamador conserva el comportamiento antiguo (documento a revisión).
 */
export async function partirNominas(buffer: Buffer): Promise<SegmentoNomina[] | null> {
  const paginas = await extraerTextoPDFPorPaginas(buffer)
  if (paginas.length === 0) return null

  const norm = paginas.map(normalizar)
  const totalRecibos = contarRecibos(norm.join('\n'))
  if (totalRecibos < 2) return null

  // Grupos de páginas: cada grupo cierra en la página con "LIQUIDO A PERCIBIR".
  const grupos: number[][] = []
  let actual: number[] = []
  for (let i = 0; i < norm.length; i++) {
    actual.push(i)
    if (contarRecibos(norm[i]) >= 1) {
      grupos.push(actual)
      actual = []
    }
  }
  // Páginas sueltas al final sin cierre (anexos): se pegan al último grupo.
  if (actual.length && grupos.length) grupos[grupos.length - 1].push(...actual)
  else if (actual.length) return null

  // Seguridad: el nº de grupos debe casar con el nº de recibos. Si una página
  // contiene DOS recibos (dos nóminas en la misma cara) no se puede partir por
  // páginas: se devuelve null y el documento va a revisión con motivo claro.
  if (grupos.length !== totalRecibos) return null

  const src = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true })
  const segmentos: SegmentoNomina[] = []
  for (const grupo of grupos) {
    const out = await PDFDocument.create()
    const copiadas = await out.copyPages(src, grupo)
    for (const p of copiadas) out.addPage(p)
    const bytes = await out.save()
    segmentos.push({
      buffer: Buffer.from(bytes),
      texto: grupo.map(i => paginas[i]).join('\n'),
      paginas: grupo,
    })
  }
  return segmentos
}
