/* ==============================================================================
 * CHECKLIST SEMANAL — PDF APAISADO (L–D) BAJO EL MARCO UNICO DE DOCUMENTOS
 * Fuente de verdad del marco: src/lib/marcoDoc.ts + docs/MARCO_DOCUMENTOS.md.
 * Este archivo SOLO aporta el contenido (rejilla de puntos de control x dias),
 * nunca cambia paleta, medidas, fuentes ni estructura del marco.
 *
 * Estructura de la hoja:
 *   columna "Punto de control" ancha + por cada dia dos columnas estrechas
 *   "Hizo" (iniciales de quien lo hace) y "Vf" (verificacion, en acento).
 *   Recuadro de incentivo en cabecera.
 * ============================================================================== */
import type { jsPDF } from 'jspdf'
import * as M from '@/lib/marcoDoc'

const AREA: M.Area = 'cocina'
const VERDE_INC: M.RGB = [92, 138, 110]

export const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
export const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export interface FilaChecklist {
  nombre: string
  requiereDato?: boolean
  tipoDato?: string | null
  /** celdas[diaIdx] = { hizo, vf } — si vienen vacías se imprime la hoja en blanco. */
  celdas?: { hizo?: string; vf?: string }[]
}

export interface OpcionesChecklistPdf {
  docNombre: string
  tituloCentrado?: string
  meta?: string
  filas: FilaChecklist[]
  incentivoTexto?: string | null
  notaPie?: string | null
  bn?: boolean
}

/** Lunes de la semana ISO a la que pertenece una fecha. */
export function lunesDe(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return d
}

/** Clave "2026-W31" de la semana ISO. */
export function semanaIso(fecha: Date): string {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const semana = 1 + Math.round(((d.getTime() - primerJueves.getTime()) / 86400000 - 3 + ((primerJueves.getUTCDay() + 6) % 7)) / 7)
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`
}

/** "Semana 31 · 27 jul – 2 ago 2026" */
export function rotuloSemana(lunes: Date): string {
  const domingo = new Date(lunes); domingo.setDate(domingo.getDate() + 6)
  const f = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  const num = semanaIso(lunes).split('-W')[1]
  return `Semana ${num} · ${f(lunes)} – ${f(domingo)} ${domingo.getFullYear()}`
}

/** Fechas de los 7 dias de la semana, empezando en lunes. */
export function fechasSemana(lunes: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes); d.setDate(d.getDate() + i); return d
  })
}

export function crearChecklistSemanaPdf(rec: M.Recursos, o: OpcionesChecklistPdf): jsPDF {
  const bn = !!o.bn
  const doc = M.nuevaHoja({ orientation: 'landscape' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)

  M.pintarEspina(doc, AREA, ctx, bn)
  let y = M.pintarCabecera(doc, ctx, {
    docNombre: o.docNombre,
    meta: o.meta,
    tituloCentrado: o.tituloCentrado,
    area: AREA,
    bn,
  })

  // ── Recuadro de incentivo (verde equipo; en B/N cae a la paleta neutra) ──
  if (o.incentivoTexto) {
    const col: M.RGB = bn ? pal.acento : VERDE_INC
    const hInc = 7
    M.fDato(doc, ctx, true); doc.setFontSize(8.6)
    const tw = doc.getTextWidth(o.incentivoTexto) + 8
    const xInc = cb.x1 - tw
    doc.setFillColor(col[0], col[1], col[2])
    doc.roundedRect(xInc, y - 1.5, tw, hInc, M.R, M.R, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(o.incentivoTexto, xInc + 4, y + 3.4)
    y += hInc + 2
  }

  // ── Geometria de la rejilla ──
  const nFilas = Math.max(o.filas.length, 1)
  const wPC = Math.round(cb.w * 0.42 * 10) / 10
  const wDia = (cb.w - wPC) / 7
  const wHizo = wDia * 0.55
  const hCab = 8
  const dispon = cb.bottom - y - (o.notaPie ? 8 : 2) - hCab
  const rowH = Math.max(4.6, Math.min(9, dispon / nFilas))
  const hTabla = hCab + rowH * nFilas

  // Marco de la tabla
  M.tablaWrap(doc, cb.x0, y, cb.w, hTabla)

  // Cabecera de la tabla
  doc.setFillColor(pal.soft[0], pal.soft[1], pal.soft[2])
  doc.roundedRect(cb.x0, y, cb.w, hCab, M.R, M.R, 'F')
  doc.setFillColor(pal.soft[0], pal.soft[1], pal.soft[2])
  doc.rect(cb.x0, y + hCab - M.R, cb.w, M.R, 'F')

  M.fTitulo(doc, ctx, true); doc.setFontSize(8.4)
  doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
  doc.text('PUNTO DE CONTROL', cb.x0 + 2.5, y + hCab - 2.8)

  const fechas = fechasSemana(lunesDe(new Date()))
  for (let d = 0; d < 7; d++) {
    const xd = cb.x0 + wPC + wDia * d
    // separador de dia
    doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.45)
    doc.line(xd, y, xd, y + hTabla)
    M.fTitulo(doc, ctx, true); doc.setFontSize(7.6)
    doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.text(`${DIAS_CORTOS[d]} ${fechas[d].getDate()}`, xd + wDia / 2, y + 3.6, { align: 'center' })
    M.fDato(doc, ctx, false); doc.setFontSize(5.9); doc.setTextColor(...M.GRIS)
    doc.text('Hizo', xd + wHizo / 2, y + hCab - 1.6, { align: 'center' })
    doc.text('Vf', xd + wHizo + (wDia - wHizo) / 2, y + hCab - 1.6, { align: 'center' })
    // separador interno Hizo/Vf
    doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.2)
    doc.line(xd + wHizo, y + hCab, xd + wHizo, y + hTabla)
  }
  // separador columna punto de control
  doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.45)
  doc.line(cb.x0 + wPC, y, cb.x0 + wPC, y + hTabla)
  doc.line(cb.x0, y + hCab, cb.x1, y + hCab)

  // ── Filas ──
  let yy = y + hCab
  o.filas.forEach((fila, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2])
      doc.rect(cb.x0 + 0.3, yy, cb.w - 0.6, rowH, 'F')
    }
    // numero + texto (ocupa ~88% del alto de fila, sin agrandar la fila)
    const baseFs = Math.min(8.6, rowH * 0.88)
    M.fDato(doc, ctx, false); doc.setTextColor(...M.GRIS); doc.setFontSize(baseFs * 0.78)
    doc.text(String(i + 1), cb.x0 + 3.4, yy + rowH / 2 + baseFs * 0.28, { align: 'right' })

    M.fDato(doc, ctx, !!fila.requiereDato); doc.setTextColor(...M.TINTA)
    const marca = fila.requiereDato ? ` [${(fila.tipoDato || 'dato').toUpperCase()}]` : ''
    const texto = fila.nombre + marca
    const fs = M.fitFont(doc, texto, wPC - 8, baseFs, 4.6)
    doc.setFontSize(fs)
    doc.text(texto, cb.x0 + 5, yy + rowH / 2 + fs * 0.3)

    // celdas de dia
    for (let d = 0; d < 7; d++) {
      const xd = cb.x0 + wPC + wDia * d
      const c = fila.celdas?.[d]
      if (c?.hizo) {
        M.fDato(doc, ctx, true); doc.setFontSize(Math.min(7.4, rowH * 0.8)); doc.setTextColor(...M.TINTA)
        doc.text(c.hizo, xd + wHizo / 2, yy + rowH / 2 + 1.2, { align: 'center' })
      }
      if (c?.vf) {
        M.fDato(doc, ctx, true); doc.setFontSize(Math.min(7.4, rowH * 0.8))
        const cv: M.RGB = bn ? M.GRIS : VERDE_INC
        doc.setTextColor(cv[0], cv[1], cv[2])
        doc.text(c.vf, xd + wHizo + (wDia - wHizo) / 2, yy + rowH / 2 + 1.2, { align: 'center' })
      }
    }

    yy += rowH
    if (i < o.filas.length - 1) {
      doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.15)
      doc.line(cb.x0 + 0.3, yy, cb.x1 - 0.3, yy)
    }
  })

  if (o.notaPie) {
    M.fDato(doc, ctx, false); doc.setFontSize(6.8); doc.setTextColor(...M.GRIS)
    doc.text(o.notaPie, cb.x0, cb.bottom + 2)
  }

  M.pintarPaginado(doc, 1, 1, ctx)
  return doc
}

/** Hoja de solo lectura (estandar de servicio / calendario): bloques de texto. */
export interface BloqueTexto { titulo: string; lineas: string[] }

export function crearHojaTextoPdf(rec: M.Recursos, o: { docNombre: string; tituloCentrado?: string; meta?: string; bloques: BloqueTexto[]; bn?: boolean }): jsPDF {
  const bn = !!o.bn
  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)

  const cabecera = () => {
    M.pintarEspina(doc, AREA, ctx, bn)
    return M.pintarCabecera(doc, ctx, { docNombre: o.docNombre, meta: o.meta, tituloCentrado: o.tituloCentrado, area: AREA, bn })
  }
  let y = cabecera()

  const salto = (alto: number) => {
    if (y + alto <= cb.bottom) return
    doc.addPage()
    y = cabecera()
  }

  o.bloques.forEach(b => {
    salto(14)
    M.fTitulo(doc, ctx, true); doc.setFontSize(10)
    doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.text(b.titulo.toUpperCase(), cb.x0, y + 4)
    y += 7
    b.lineas.forEach(l => {
      M.fDato(doc, ctx, false); doc.setFontSize(9); doc.setTextColor(...M.TINTA)
      const partes = doc.splitTextToSize(`· ${l}`, cb.w - 4) as string[]
      partes.forEach(p => {
        salto(5)
        doc.text(p, cb.x0 + 2, y + 3.4)
        y += 4.6
      })
    })
    y += 4
  })

  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) { doc.setPage(p); M.pintarPaginado(doc, p, total, ctx) }
  return doc
}
