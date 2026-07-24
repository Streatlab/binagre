/* ==============================================================================
 * FICHA TÉCNICA — PDF (modelo validado por Rubén, 24-jul-2026)
 * ÚNICO generador para EPs y RECETAS: mismo papel, cambia solo el rótulo del
 * tipo de documento. Es el gemelo exacto de la hoja de pantalla
 * (src/components/marco/FichaTecnicaHoja.tsx): mismas secciones, mismo orden,
 * mismas medidas relativas, mismo radio y misma paleta de área.
 *
 * Anatomía: cabecera (logo · pastilla de área + tipo · nombre · gama · caja
 * Código/Revisión/Fecha) → regla → meta de 4 celdas → Ingredientes →
 * Preparación → Conservación + Alérgenos.
 * PROHIBIDO tocar medidas o estructura sin orden explícita de Rubén.
 * ============================================================================== */
import type { jsPDF } from 'jspdf'
import * as M from '@/lib/marcoDoc'

export interface FichaLineaIng { ingrediente: string; cantidad: string; unidad: string; equivalencia?: string }
export interface FichaConserva { metodo: string; tiempo: string }

export interface FichaPdfDatos {
  area?: M.Area
  tipoDoc: string
  nombre: string
  gama?: string | null
  codigo?: string | null
  revision?: number | null
  fecha?: string | null
  tiempoPrep?: string | null
  rendimiento?: string | null
  costeTanda: string
  costeRacion: string
  ingredientes: FichaLineaIng[]
  pasos: string[]
  conservacion: FichaConserva[]
  alergenos: string[]
}

export const ALERGENOS_PDF = [
  'Gluten', 'Lácteos', 'Huevos',
  'Soja', 'Frutos secos', 'Crustáceos',
  'Pescado', 'Moluscos', 'Cacahuetes',
  'Apio', 'Mostaza', 'Sésamo',
]
export const ALERGENOS_PDF_PIE = ['Sulfitos', 'Altramuces']
const METODOS_CONSERVA = ['Táper', 'Biberón', 'Vacío', 'Congelación']

// Paleta de papel (idéntica a la hoja de pantalla)
const BORDE: M.RGB = [222, 215, 208]      // #ded7d0
const BORDE_FILA: M.RGB = [236, 231, 226] // #ece7e2
const CABEZA: M.RGB = [242, 238, 234]     // #f2eeea
const ZEBRA: M.RGB = [250, 247, 245]      // #faf7f5
const TXT_CAB: M.RGB = [74, 68, 62]       // #4a443e
const TXT_SUAVE: M.RGB = [122, 114, 105]  // #7a7269
const TXT_LBL: M.RGB = [139, 130, 121]    // #8b8279

const MG = 12        // margen de hoja (mm)
const R = M.R        // radio único

function setFill(doc: jsPDF, c: M.RGB) { doc.setFillColor(c[0], c[1], c[2]) }
function setDraw(doc: jsPDF, c: M.RGB) { doc.setDrawColor(c[0], c[1], c[2]) }
function setText(doc: jsPDF, c: M.RGB) { doc.setTextColor(c[0], c[1], c[2]) }

/** Texto con espaciado de letra ancho (etiquetas del modelo). */
function etiqueta(doc: jsPDF, ctx: M.Ctx, txt: string, x: number, y: number, size = 5.6, color: M.RGB = TXT_LBL) {
  M.fTitulo(doc, ctx, false); doc.setFontSize(size); setText(doc, color)
  doc.text(txt.toUpperCase(), x, y, { charSpace: ctx.emb ? 0.55 : 0.3 })
}

/** Marco redondeado neutro del modelo. */
function marco(doc: jsPDF, x: number, y: number, w: number, h: number) {
  setDraw(doc, BORDE); doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, R, R, 'S')
}

/** Reparte un texto en segmentos normales/negrita según los ingredientes citados. */
function segmentar(texto: string, ingredientes: FichaLineaIng[]): { t: string; b: boolean }[] {
  const terminos = new Set<string>()
  ingredientes.forEach(i => {
    const n = (i.ingrediente || '').trim().toLowerCase()
    if (!n) return
    terminos.add(n)
    const prim = n.split(/\s+/)[0]
    if (prim.length >= 4) terminos.add(prim)
  })
  if (!terminos.size) return [{ t: texto, b: false }]
  const lista = [...terminos].sort((a, b) => b.length - a.length)
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b(${lista.map(esc).join('|')})\\b`, 'gi')
  const out: { t: string; b: boolean }[] = []
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    if (m.index > last) out.push({ t: texto.slice(last, m.index), b: false })
    out.push({ t: m[0], b: true })
    last = m.index + m[0].length
  }
  if (last < texto.length) out.push({ t: texto.slice(last), b: false })
  return out.length ? out : [{ t: texto, b: false }]
}

/** Pinta texto con negritas embebidas y salto de línea automático. Devuelve el alto usado. */
function textoRico(doc: jsPDF, ctx: M.Ctx, segs: { t: string; b: boolean }[], x: number, y: number, maxW: number, size: number, lineH: number): number {
  doc.setFontSize(size); setText(doc, M.TINTA)
  let cx = x, cy = y, lineas = 1
  segs.forEach(seg => {
    const palabras = seg.t.split(/(\s+)/).filter(p => p !== '')
    palabras.forEach(p => {
      M.fDato(doc, ctx, seg.b)
      const w = doc.getTextWidth(p)
      if (cx + w > x + maxW && p.trim() !== '') { cx = x; cy += lineH; lineas++ }
      if (cx === x && p.trim() === '') return
      doc.text(p, cx, cy)
      cx += w
    })
  })
  return lineas * lineH
}

/** Construye el PDF de una ficha (EP o receta). */
export function construirFichaTecnicaPDF(d: FichaPdfDatos, rec: M.Recursos, bn = false): jsPDF {
  const area: M.Area = d.area ?? 'cocina'
  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(area, bn)
  const AC = pal.acento
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const x0 = MG, x1 = PW - MG, W = x1 - x0
  const bottom = PH - MG - 5

  const nuevaPagina = () => { doc.addPage(); return MG + 4 }

  // ───────── CABECERA ─────────
  let y = MG + 2
  const cajaW = 54
  const cajaX = x1 - cajaW

  // logo
  let logoW = 0
  const logoH = 15
  if (ctx.logo) {
    try {
      const props = doc.getImageProperties(ctx.logo)
      const ratio = props.width / props.height
      logoW = Math.min(logoH * ratio, 26)
      doc.addImage(ctx.logo, 'JPEG', x0, y, logoW, logoW / ratio)
    } catch { logoW = 0 }
  }
  const cx = x0 + (logoW ? logoW + 5 : 0)

  // pastilla de área + tipo de documento
  M.fTitulo(doc, ctx, true); doc.setFontSize(6.4)
  const areaTxt = (area === 'cocina' ? 'Cocina' : area === 'finanzas' ? 'Finanzas' : 'Equipo').toUpperCase()
  const pillTxtW = doc.getTextWidth(areaTxt) + (ctx.emb ? areaTxt.length * 0.55 : 0)
  const pillW = pillTxtW + 8.6, pillH = 4.8
  setDraw(doc, AC); doc.setLineWidth(0.3)
  doc.roundedRect(cx, y, pillW, pillH, R, R, 'S')
  setFill(doc, AC); doc.rect(cx + 2, y + pillH / 2 - 1.1, 2.2, 2.2, 'F')
  setText(doc, AC)
  doc.text(areaTxt, cx + 6, y + 3.4, { charSpace: ctx.emb ? 0.55 : 0.3 })
  etiqueta(doc, ctx, d.tipoDoc, cx + pillW + 4, y + 3.4, 6.2, M.GRIS)

  // nombre grande
  const nombre = (d.nombre ?? '').replace(/\.\s*$/, '').toUpperCase()
  M.fTitulo(doc, ctx, true); setText(doc, M.TINTA)
  const maxNombreW = cajaX - cx - 6
  M.fitFont(doc, nombre, maxNombreW, 23, 12)
  doc.text(nombre, cx, y + 13.4)

  // gama
  if (d.gama) {
    M.fDato(doc, ctx, false); doc.setFontSize(9); setText(doc, TXT_SUAVE)
    doc.text(d.gama, cx, y + 18)
  }

  // caja Código / Revisión / Fecha
  const cajaH = 19, filaH = 9.5
  marco(doc, cajaX, y - 1, cajaW, cajaH)
  setDraw(doc, BORDE); doc.setLineWidth(0.3)
  doc.line(cajaX, y - 1 + filaH, cajaX + cajaW, y - 1 + filaH)
  doc.line(cajaX + cajaW / 2, y - 1 + filaH, cajaX + cajaW / 2, y - 1 + cajaH)
  etiqueta(doc, ctx, 'Código', cajaX + 3, y + 2.2)
  M.fTitulo(doc, ctx, true); doc.setFontSize(11); setText(doc, M.TINTA)
  doc.text(d.codigo || '—', cajaX + 3, y + 6.6)
  etiqueta(doc, ctx, 'Revisión', cajaX + 3, y + 11.6)
  etiqueta(doc, ctx, 'Fecha', cajaX + cajaW / 2 + 3, y + 11.6)
  M.fTitulo(doc, ctx, true); doc.setFontSize(11); setText(doc, M.TINTA)
  doc.text(String(d.revision ?? 1).padStart(2, '0'), cajaX + 3, y + 16)
  doc.text(d.fecha || '__/__/__', cajaX + cajaW / 2 + 3, y + 16)

  y += cajaH + 3

  // regla fina
  setDraw(doc, BORDE); doc.setLineWidth(0.3)
  doc.line(x0, y, x1, y)
  y += 4

  // ───────── META (4 celdas) ─────────
  const metaH = 12, celW = W / 4
  const celdas: [string, string][] = [
    ['Tiempo de preparación', d.tiempoPrep || '—'],
    ['Rendimiento', d.rendimiento || '—'],
    ['Coste tanda', d.costeTanda],
    ['€ / Ración', d.costeRacion],
  ]
  setFill(doc, pal.soft2)
  doc.roundedRect(x0 + celW * 3, y, celW, metaH, R, R, 'F')
  doc.rect(x0 + celW * 3, y, celW - R, metaH, 'F')
  marco(doc, x0, y, W, metaH)
  celdas.forEach((c, i) => {
    const cxx = x0 + celW * i
    if (i > 0) { setDraw(doc, BORDE); doc.setLineWidth(0.3); doc.line(cxx, y, cxx, y + metaH) }
    etiqueta(doc, ctx, c[0], cxx + 4, y + 4.2)
    M.fTitulo(doc, ctx, true); doc.setFontSize(12)
    setText(doc, i === 3 ? AC : M.TINTA)
    M.fitFont(doc, c[1], celW - 8, 12, 8)
    doc.text(c[1], cxx + 4, y + 9.6)
  })
  y += metaH + 6

  // ───────── etiqueta de sección ─────────
  const seccion = (txt: string, yy: number, xx: number = x0): number => {
    setFill(doc, AC); doc.rect(xx, yy - 2.4, 2.4, 2.4, 'F')
    M.fTitulo(doc, ctx, true); doc.setFontSize(7.6); setText(doc, AC)
    doc.text(txt.toUpperCase(), xx + 4.2, yy, { charSpace: ctx.emb ? 0.9 : 0.5 })
    return yy + 3
  }

  // ───────── INGREDIENTES ─────────
  y = seccion('Ingredientes', y)
  const cIng = W * 0.44, cCant = W * 0.14, cUd = W * 0.16
  const xCant = x0 + cIng, xUd = xCant + cCant, xEq = xUd + cUd
  const hCab = 6.4, hFila = 6.2
  const nFilas = Math.max(d.ingredientes.length, 1)
  const altoTabla = hCab + nFilas * hFila

  setFill(doc, CABEZA)
  doc.roundedRect(x0, y, W, hCab, R, R, 'F')
  doc.rect(x0, y + hCab - R, W, R, 'F')
  M.fTitulo(doc, ctx, true); doc.setFontSize(6.6); setText(doc, TXT_CAB)
  doc.text('INGREDIENTE', x0 + 4, y + 4.3, { charSpace: ctx.emb ? 0.35 : 0.2 })
  doc.text('CANTIDAD', xCant + cCant - 4, y + 4.3, { align: 'right', charSpace: ctx.emb ? 0.35 : 0.2 })
  doc.text('UNIDAD', xUd + 4, y + 4.3, { charSpace: ctx.emb ? 0.35 : 0.2 })
  doc.text('EQUIVALENCIA', xEq + 4, y + 4.3, { charSpace: ctx.emb ? 0.35 : 0.2 })
  setDraw(doc, BORDE); doc.setLineWidth(0.3); doc.line(x0, y + hCab, x1, y + hCab)

  let yf = y + hCab
  if (d.ingredientes.length === 0) {
    M.fDato(doc, ctx, false); doc.setFontSize(9); setText(doc, TXT_LBL)
    doc.text('Sin ingredientes enlazados.', x0 + 4, yf + 4.2)
    yf += hFila
  }
  d.ingredientes.forEach((ing, i) => {
    if (i % 2 === 1) { setFill(doc, ZEBRA); doc.rect(x0 + 0.2, yf, W - 0.4, hFila, 'F') }
    M.fDato(doc, ctx, false); doc.setFontSize(9.6); setText(doc, M.TINTA)
    M.fitFont(doc, ing.ingrediente, cIng - 8, 9.6, 7)
    doc.text(ing.ingrediente, x0 + 4, yf + 4.2)
    M.fTitulo(doc, ctx, true); doc.setFontSize(10); setText(doc, M.TINTA)
    doc.text(ing.cantidad, xCant + cCant - 4, yf + 4.2, { align: 'right' })
    M.fDato(doc, ctx, false); doc.setFontSize(9.2); setText(doc, TXT_SUAVE)
    doc.text(ing.unidad, xUd + 4, yf + 4.2)
    if (ing.equivalencia) { setText(doc, M.TINTA); doc.text(ing.equivalencia, xEq + 4, yf + 4.2) }
    if (i < d.ingredientes.length - 1) { setDraw(doc, BORDE_FILA); doc.setLineWidth(0.2); doc.line(x0 + 0.2, yf + hFila, x1 - 0.2, yf + hFila) }
    yf += hFila
  })
  marco(doc, x0, y, W, altoTabla)
  y = y + altoTabla + 6

  // ───────── PREPARACIÓN ─────────
  y = seccion('Preparación', y)
  const pasos = d.pasos ?? []
  const numW = 7
  const bloques = (pasos.length ? pasos : ['Sin elaboración escrita.']).map(p => {
    const segs = segmentar(p, d.ingredientes)
    M.fDato(doc, ctx, false); doc.setFontSize(9.6)
    let cxx = 0, lineas = 1
    segs.forEach(s => s.t.split(/(\s+)/).filter(t => t !== '').forEach(w0 => {
      M.fDato(doc, ctx, s.b)
      const w = doc.getTextWidth(w0)
      if (cxx + w > W - numW - 8 && w0.trim() !== '') { cxx = 0; lineas++ }
      cxx += w
    }))
    return { segs, h: lineas * 4.4 + 3.4 }
  })
  const altoPasos = bloques.reduce((s, b) => s + b.h, 0)
  let yp = y
  bloques.forEach((b, i) => {
    M.fTitulo(doc, ctx, true); doc.setFontSize(9.6); setText(doc, AC)
    doc.text(`${pasos.length ? i + 1 : '—'}.`, x0 + 4, yp + 4.2)
    textoRico(doc, ctx, b.segs, x0 + numW + 2, yp + 4.2, W - numW - 8, 9.6, 4.4)
    if (i < bloques.length - 1) { setDraw(doc, BORDE_FILA); doc.setLineWidth(0.2); doc.line(x0 + 0.2, yp + b.h, x1 - 0.2, yp + b.h) }
    yp += b.h
  })
  marco(doc, x0, y, W, altoPasos)
  y = y + altoPasos + 6

  // ───────── PIE: CONSERVACIÓN + ALÉRGENOS ─────────
  const pieH = 36
  if (y + pieH > bottom) y = nuevaPagina()

  const consW = 74, gap = 10
  const alergX = x0 + consW + gap, alergW = x1 - alergX

  // Conservación
  const yc = seccion('Conservación', y)
  const hCons = 6.2
  const tiempoDe = (metodo: string) => {
    const raiz: Record<string, string[]> = {
      'Táper': ['tapper', 'taper', 'tupper', 'táper'], 'Biberón': ['biber'],
      'Vacío': ['vacio', 'vacío', 'vac'], 'Congelación': ['congel'],
    }
    const claves = raiz[metodo] ?? [metodo.toLowerCase().slice(0, 4)]
    const hit = (d.conservacion ?? []).find(c => claves.some(k => (c.metodo ?? '').toLowerCase().includes(k)))
    return hit?.tiempo ?? 'NO'
  }
  let yy = yc
  METODOS_CONSERVA.forEach((m, i) => {
    if (i % 2 === 1) { setFill(doc, ZEBRA); doc.rect(x0 + 0.2, yy, consW - 0.4, hCons, 'F') }
    M.fTitulo(doc, ctx, true); doc.setFontSize(8.6); setText(doc, M.TINTA)
    doc.text(m.toUpperCase(), x0 + 4, yy + 4.2, { charSpace: ctx.emb ? 0.3 : 0.15 })
    M.fTitulo(doc, ctx, true); doc.setFontSize(9.4)
    doc.text(tiempoDe(m), x0 + consW - 4, yy + 4.2, { align: 'right' })
    if (i < METODOS_CONSERVA.length - 1) { setDraw(doc, BORDE_FILA); doc.setLineWidth(0.2); doc.line(x0 + 0.2, yy + hCons, x0 + consW - 0.2, yy + hCons) }
    yy += hCons
  })
  marco(doc, x0, yc, consW, hCons * METODOS_CONSERVA.length)

  // Alérgenos
  const marcados = new Set((d.alergenos ?? []).map(a => a.toLowerCase()))
  const tiene = (a: string) => marcados.has(a.toLowerCase()) ||
    (a === 'Lácteos' && marcados.has('lacteos')) || (a === 'Huevos' && marcados.has('huevo'))
  const ya = seccion('Alérgenos', y, alergX)
  const colW = (alergW - 4) / 3, chipH = 6, gapC = 2
  const chip = (a: string, cxx: number, cyy: number, w: number) => {
    marco(doc, cxx, cyy, w, chipH)
    const on = tiene(a)
    if (on) { setFill(doc, AC); setDraw(doc, AC) } else { setFill(doc, M.BLANCO); setDraw(doc, [179, 170, 161]) }
    doc.setLineWidth(0.25)
    doc.roundedRect(cxx + 2.6, cyy + chipH / 2 - 1.5, 3, 3, 0.4, 0.4, on ? 'FD' : 'S')
    M.fTitulo(doc, ctx, true); doc.setFontSize(6.6); setText(doc, TXT_CAB)
    doc.text(a.toUpperCase(), cxx + 7.4, cyy + chipH / 2 + 1.1, { charSpace: ctx.emb ? 0.35 : 0.2 })
  }
  ALERGENOS_PDF.forEach((a, i) => {
    const col = i % 3, fila = Math.floor(i / 3)
    chip(a, alergX + col * (colW + gapC), ya + fila * (chipH + gapC), colW)
  })
  const yPie = ya + 4 * (chipH + gapC)
  const anchoPie = colW * 1.6
  ALERGENOS_PDF_PIE.forEach((a, i) => {
    chip(a, alergX + (alergW - anchoPie * 2 - gapC) / 2 + i * (anchoPie + gapC), yPie, anchoPie)
  })

  const tp = doc.getNumberOfPages()
  for (let p = 1; p <= tp; p++) { doc.setPage(p); M.pintarPaginado(doc, p, tp, ctx) }
  return doc
}
