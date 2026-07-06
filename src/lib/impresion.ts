/**
 * impresion.ts — LEY DE IMPRESIÓN · ESTÁNDAR ÚNICO de documentos impresos del ERP Streat Lab.
 *
 * TODO documento imprimible del ERP (checklists, listas, inventarios, informes de papel)
 * DEBE construirse con este módulo. Norma completa: docs/LEY_IMPRESION.md.
 *
 * Resumen de la ley:
 *  1. Siempre PDF real (jsPDF) — nunca window.print() del DOM.
 *  2. Marco exterior rojo Binagre en todas las hojas.
 *  3. Cabecera: banda rosa suave + título Oswald-like bold uppercase granate + marca STREAT LAB.
 *  4. Línea de identificación: FECHA / RESPONSABLE / HORA (las que apliquen).
 *  5. Zonas de escritura a mano: línea continua gris, sin puntos.
 *  6. Pie: Observaciones + Firma + micro-instrucción.
 *  7. Paleta cerrada (abajo). Prohibido inventar colores.
 *  8. Nombre de archivo: tipo-documento-fecha.pdf (minúsculas, sin acentos).
 */

import { jsPDF } from 'jspdf'

/* ── PALETA CERRADA DE IMPRESIÓN (no inventar) ───────────────────── */
export const P_RED: [number, number, number]        = [176, 29, 35]    // #B01D23 marco, acentos
export const P_RED_DARK: [number, number, number]   = [138, 26, 34]    // títulos
export const P_RED_SOFT: [number, number, number]   = [240, 216, 218]  // banda cabecera
export const P_RED_SOFT2: [number, number, number]  = [245, 226, 227]  // subcabeceras
export const P_INK: [number, number, number]        = [17, 17, 17]     // texto
export const P_GREY: [number, number, number]       = [90, 90, 90]     // texto secundario
export const P_LINE: [number, number, number]       = [201, 201, 201]  // separadores
export const P_WRITE: [number, number, number]      = [201, 201, 210]  // líneas de escritura

/* ── MEDIDAS CANÓNICAS ───────────────────────────────────────────── */
export const MARGEN = 12          // mm, margen exterior
export const CAB_H = 15           // mm, alto banda cabecera
export const BOX = 7              // mm, casilla de check

export function nombreArchivo(tipo: string): string {
  const fecha = new Date().toISOString().slice(0, 10)
  const limpio = tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
  return `${limpio}-${fecha}.pdf`
}

export function nuevoDocA4(orientation: 'portrait' | 'landscape' = 'portrait'): jsPDF {
  return new jsPDF({ orientation, unit: 'mm', format: 'a4' })
}

/** Marco exterior rojo obligatorio en cada página. Llamar al final de pintar la página. */
export function pintarMarco(doc: jsPDF) {
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...P_RED); doc.setLineWidth(0.8)
  doc.rect(MARGEN - 2, MARGEN - 2, PW - (MARGEN - 2) * 2, PH - (MARGEN - 2) * 2)
}

/** Cabecera estándar: banda rosa + título granate + marca. Devuelve la Y donde sigue el contenido. */
export function pintarCabecera(doc: jsPDF, titulo: string, subtitulo?: string, paginado?: { actual: number; total: number }): number {
  const PW = doc.internal.pageSize.getWidth()
  const usableW = PW - MARGEN * 2
  doc.setFillColor(...P_RED_SOFT); doc.rect(MARGEN, MARGEN, usableW, CAB_H, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...P_RED_DARK)
  doc.text(titulo.toUpperCase(), MARGEN + 5, MARGEN + 9.6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...P_RED_DARK)
  const marca = subtitulo ? `STREAT LAB · ${subtitulo}` : 'STREAT LAB'
  doc.text(marca, PW - MARGEN - 4, MARGEN + 6, { align: 'right' })
  if (paginado && paginado.total > 1) {
    doc.text(`Página ${paginado.actual} de ${paginado.total}`, PW - MARGEN - 4, MARGEN + 11, { align: 'right' })
  }
  return MARGEN + CAB_H + 4
}

/** Línea de identificación: campos con hueco para rellenar a mano (FECHA, RESPONSABLE, HORA...). */
export function pintarCamposId(doc: jsPDF, y: number, campos: string[]): number {
  const PW = doc.internal.pageSize.getWidth()
  const usableW = PW - MARGEN * 2
  const w = usableW / campos.length
  campos.forEach((c, i) => {
    const x = MARGEN + i * w
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...P_GREY)
    doc.text(c.toUpperCase(), x + 1, y + 3)
    doc.setDrawColor(...P_INK); doc.setLineWidth(0.3)
    doc.line(x + 1, y + 9.5, x + w - 6, y + 9.5)
  })
  return y + 14
}

/** Bloque de pie estándar: Observaciones (2 líneas) + Firma + micro-instrucción. Pintar al final de la página. */
export function pintarPie(doc: jsPDF, microInstruccion?: string) {
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const usableW = PW - MARGEN * 2
  let y = PH - MARGEN - 34

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...P_GREY)
  doc.text('OBSERVACIONES / INCIDENCIAS', MARGEN + 1, y)
  doc.setDrawColor(...P_WRITE); doc.setLineWidth(0.3)
  doc.line(MARGEN + 1, y + 7, MARGEN + usableW - 1, y + 7)
  doc.line(MARGEN + 1, y + 14, MARGEN + usableW - 1, y + 14)
  y += 20

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...P_GREY)
  doc.text('FIRMA RESPONSABLE', MARGEN + 1, y)
  doc.setDrawColor(...P_INK); doc.setLineWidth(0.3)
  doc.line(MARGEN + 1, y + 9, MARGEN + usableW * 0.45, y + 9)

  if (microInstruccion) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...P_GREY)
    doc.text(microInstruccion, PW - MARGEN - 1, y + 9, { align: 'right' })
  }
}

/** Abre el PDF en pestaña nueva y lanza el diálogo de impresión (evita cola colgada WiFi). */
export function abrirImprimir(doc: jsPDF) {
  const url = doc.output('bloburl')
  const win = window.open(url as unknown as string, '_blank')
  if (win) {
    win.addEventListener('load', () => { try { win.focus(); win.print() } catch { /* imprime desde el visor */ } })
  }
}

export function descargar(doc: jsPDF, tipo: string) {
  doc.save(nombreArchivo(tipo))
}
