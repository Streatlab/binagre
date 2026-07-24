/**
 * Export PDF horizontal A4 — mismo cuadrante que la vista.
 * Construye el PDF EXACTAMENTE con los turnos que recibe (los que se ven en pantalla,
 * ya con las ediciones a mano aplicadas). No re-lee nada de memoria antigua.
 * El PDF NO muestra el total de horas, solo los tramos.
 */

import { jsPDF } from 'jspdf'
import * as M from '@/lib/marcoDoc'
import {
  type DiaKey, type Empleado, type Turno,
  fmtRangoSemana, numeroSemanaISO, tramosTexto, colorEmpleado,
} from './utils'
import { nombrePila, fechasSemana, isoDeFecha } from './CuadranteCuadricula'

interface ExportOpts {
  abrir?: boolean
  titulo?: string
}

const ROJO: [number, number, number] = [176, 29, 35]
const GRIS_BG: [number, number, number] = [238, 238, 238]
const GRIS_TXT: [number, number, number] = [140, 140, 140]
const TINTA: [number, number, number] = [30, 34, 51]
const MUT: [number, number, number] = [100, 100, 100]

/** Semana con override puntual: celdas sin turno en gris sin la palabra "Libre" (igual que la vista). */
const SEMANA_SIN_LIBRE = '2026-06-15'

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type jsPDFType = any

function buildPDF(empleados: Empleado[], turnos: Turno[], lunes: Date, _opts: ExportOpts = {}): jsPDFType {
  const doc: jsPDFType = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = 297
  const pageH = 210
  const margin = 10

  // Título
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(ROJO[0], ROJO[1], ROJO[2])
  doc.text(`ROTA S${numeroSemanaISO(lunes)} · ${fmtRangoSemana(lunes)}`.toUpperCase(), margin, 14)

  const dias = fechasSemana(lunes)
  const visibles = empleados.filter(e => (!e.estado || e.estado === 'activo') && turnos.some(t => t.empleado_id === e.id))
  const idxEmp: Record<string, number> = {}
  empleados.forEach((e, i) => { idxEmp[e.id] = i })

  const colNombre = 30
  const headerY = 22
  const headerH = 8
  const gridX = margin + colNombre
  const diaW = (pageW - margin - margin - colNombre) / 7
  const ocultarLibre = isoDeFecha(lunes) === SEMANA_SIN_LIBRE

  const turnoDe = (id: string, dia: DiaKey): Turno | undefined =>
    turnos.find(t => t.empleado_id === id && t.dia === dia)

  // Cabecera de días
  doc.setFontSize(9)
  dias.forEach((d, i) => {
    const x = gridX + i * diaW
    if (d.festivo) {
      doc.setDrawColor(ROJO[0], ROJO[1], ROJO[2])
      doc.setLineWidth(0.5)
      doc.rect(x + 0.5, headerY, diaW - 1, headerH)
    }
    doc.setFont('helvetica', 'bold')
    const c = d.festivo ? ROJO : MUT
    doc.setTextColor(c[0], c[1], c[2])
    doc.text(`${d.dia.toUpperCase()} ${d.num}`, x + diaW / 2, headerY + 5.5, { align: 'center' })
  })

  // Filas por empleado (sin columna de Total)
  const contentTop = headerY + headerH + 1
  const dispH = pageH - margin - contentTop
  const rowH = visibles.length > 0 ? Math.min(36, dispH / visibles.length) : 36

  visibles.forEach((emp, row) => {
    const y = contentTop + row * rowH

    // Nombre
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(TINTA[0], TINTA[1], TINTA[2])
    doc.text(nombrePila(emp.nombre), margin, y + rowH / 2 + 1.5)

    const col = colorEmpleado(idxEmp[emp.id] ?? 0)
    const bg = hexRgb(col.bg)
    const txt = hexRgb(col.text)

    dias.forEach((d, i) => {
      const x = gridX + i * diaW
      const pad = 1.2
      const cx = x + pad
      const cy = y + pad
      const cw = diaW - pad * 2
      const ch = rowH - pad * 2
      const t = turnoDe(emp.id, d.dia)

      if (!t) {
        doc.setFillColor(GRIS_BG[0], GRIS_BG[1], GRIS_BG[2])
        doc.roundedRect(cx, cy, cw, ch, 1.5, 1.5, 'F')
        if (d.festivo) {
          doc.setDrawColor(ROJO[0], ROJO[1], ROJO[2])
          doc.setLineWidth(0.5)
          doc.roundedRect(cx, cy, cw, ch, 1.5, 1.5, 'S')
        }
        if (!ocultarLibre) {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(9)
          doc.setTextColor(GRIS_TXT[0], GRIS_TXT[1], GRIS_TXT[2])
          doc.text('Libre', x + diaW / 2, y + rowH / 2 + 1, { align: 'center' })
        }
        return
      }

      doc.setFillColor(bg[0], bg[1], bg[2])
      doc.roundedRect(cx, cy, cw, ch, 1.5, 1.5, 'F')
      if (d.festivo) {
        doc.setDrawColor(ROJO[0], ROJO[1], ROJO[2])
        doc.setLineWidth(0.5)
        doc.roundedRect(cx, cy, cw, ch, 1.5, 1.5, 'S')
      }

      // Solo los tramos (números), un poco más grandes. Sin horas totales.
      const lineas = tramosTexto(t).split('\n')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(txt[0], txt[1], txt[2])
      const lh = 5
      const startY = y + rowH / 2 - ((lineas.length - 1) * lh) / 2 + 1
      lineas.forEach((ln, li) => {
        doc.text(ln, x + diaW / 2, startY + li * lh, { align: 'center' })
      })
    })
  })

  return doc
}

export function exportarHorarioPDF(empleados: Empleado[], turnos: Turno[], lunes: Date, opts: ExportOpts = {}) {
  const pdf = buildPDF(empleados, turnos, lunes, opts)
  const filename = `horario_S${numeroSemanaISO(lunes)}_${isoDate(lunes)}.pdf`
  if (opts.abrir) {
    pdf.save(filename)
  }
  return pdf
}

// ─── FASE 2: PDF con el marco único (área 'equipo') — botón Imprimir ────────
const AREA: M.Area = 'equipo'

/** Genera el cuadrante semanal con el marco único. Sin turnos → null (regla del marco). */
export function construirHorariosSemanaPDF(empleados: Empleado[], turnos: Turno[], lunes: Date, rec: M.Recursos, bn = false): jsPDF | null {
  if (turnos.length === 0) return null

  const doc = M.nuevaHoja({ orientation: 'landscape' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)
  const meta = `Semana ${numeroSemanaISO(lunes)} · ${fmtRangoSemana(lunes)}`

  M.pintarEspina(doc, AREA, ctx, bn)
  let y = M.pintarCabecera(doc, ctx, { docNombre: 'Cuadrante de Horarios', meta, area: AREA, bn })

  const dias = fechasSemana(lunes)
  const visibles = empleados.filter(e => (!e.estado || e.estado === 'activo') && turnos.some(t => t.empleado_id === e.id))
  const idxEmp: Record<string, number> = {}
  empleados.forEach((e, i) => { idxEmp[e.id] = i })

  const colNombre = 26
  const headerH = 7
  const gridX = cb.x0 + colNombre
  const diaW = (cb.x1 - gridX) / 7

  const turnoDe = (id: string, dia: DiaKey): Turno | undefined =>
    turnos.find(t => t.empleado_id === id && t.dia === dia)

  // Cabecera de días
  dias.forEach((d, i) => {
    const x = gridX + i * diaW
    if (d.festivo) { doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.5); doc.roundedRect(x + 0.5, y, diaW - 1, headerH, M.R, M.R, 'S') }
    M.fTitulo(doc, ctx, true); doc.setFontSize(9)
    doc.setTextColor(d.festivo ? pal.acento[0] : M.GRIS[0], d.festivo ? pal.acento[1] : M.GRIS[1], d.festivo ? pal.acento[2] : M.GRIS[2])
    doc.text(`${d.dia.toUpperCase()} ${d.num}`, x + diaW / 2, y + headerH - 2, { align: 'center' })
  })

  const contentTop = y + headerH + 1.5
  const rowH = visibles.length > 0 ? Math.min(30, (cb.bottom - contentTop) / visibles.length) : 30

  visibles.forEach((emp, row) => {
    const yRow = contentTop + row * rowH
    M.fTitulo(doc, ctx, true); doc.setFontSize(12); doc.setTextColor(...M.TINTA)
    doc.text(nombrePila(emp.nombre), cb.x0, yRow + rowH / 2 + 1.5)

    const col = colorEmpleado(idxEmp[emp.id] ?? 0)
    const bg = hexRgb(col.bg)
    const txt = hexRgb(col.text)

    dias.forEach((d, i) => {
      const x = gridX + i * diaW
      const pad = 1.2
      const cx = x + pad, cy = yRow + pad, cw = diaW - pad * 2, ch = rowH - pad * 2
      const t = turnoDe(emp.id, d.dia)

      if (!t) {
        doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.roundedRect(cx, cy, cw, ch, M.R, M.R, 'F')
        if (d.festivo) { doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.5); doc.roundedRect(cx, cy, cw, ch, M.R, M.R, 'S') }
        M.fDato(doc, ctx, false); doc.setFontSize(9); doc.setTextColor(...M.GRIS)
        doc.text('Libre', x + diaW / 2, yRow + rowH / 2 + 1, { align: 'center' })
        return
      }

      doc.setFillColor(bg[0], bg[1], bg[2]); doc.roundedRect(cx, cy, cw, ch, M.R, M.R, 'F')
      if (d.festivo) { doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.5); doc.roundedRect(cx, cy, cw, ch, M.R, M.R, 'S') }

      const lineas = tramosTexto(t).split('\n')
      M.fDato(doc, ctx, true); doc.setFontSize(11); doc.setTextColor(txt[0], txt[1], txt[2])
      const lh = 4.6
      const startY = yRow + rowH / 2 - ((lineas.length - 1) * lh) / 2 + 1
      lineas.forEach((ln, li) => doc.text(ln, x + diaW / 2, startY + li * lh, { align: 'center' }))
    })
  })

  M.pintarPaginado(doc, 1, 1, ctx)
  return doc
}

export async function compartirHorarioPDF(empleados: Empleado[], turnos: Turno[], lunes: Date, opts: ExportOpts = {}) {
  const pdf = buildPDF(empleados, turnos, lunes, opts)
  const filename = `horario_S${numeroSemanaISO(lunes)}_${isoDate(lunes)}.pdf`
  const blob = pdf.output('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })

  const navAny = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean; share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void> }
  if (navAny.canShare && navAny.canShare({ files: [file] }) && navAny.share) {
    try {
      await navAny.share({ files: [file], title: filename, text: 'Horario cocina' })
      return
    } catch {
      // usuario canceló
    }
  }
  pdf.save(filename)
}
