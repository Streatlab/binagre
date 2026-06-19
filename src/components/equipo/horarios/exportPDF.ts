/**
 * Export PDF horizontal A4 — mismo formato que el mockup aprobado.
 * jspdf pendiente de instalar (npm install jspdf)
 */

// import jsPDF from 'jspdf'
import {
  DIAS, type DiaKey, type Empleado, type Turno,
  fmtRangoSemana, numeroSemanaISO, tramosTexto,
} from './utils'
import { nombrePila } from './CuadranteCuadricula'

interface ExportOpts {
  abrir?: boolean
  titulo?: string
}

const COL: Record<string, { bg: [number,number,number]; txt: [number,number,number] }> = {
  Ray:    { bg: [192, 221, 151], txt: [23, 52, 4] },
  'Andrés': { bg: [181, 212, 244], txt: [4, 44, 83] },
  Emilio: { bg: [250, 199, 117], txt: [65, 36, 2] },
  'Rubén':  { bg: [244, 192, 209], txt: [75, 21, 40] },
}

function turnosDe(empId: string, dia: DiaKey, turnos: Turno[]) {
  return turnos.find(t => t.empleado_id === empId && t.dia === dia)
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type jsPDFType = any

function buildPDF(empleados: Empleado[], turnos: Turno[], lunes: Date, opts: ExportOpts = {}): jsPDFType {
  throw new Error('jspdf no instalado — ejecuta: npm install jspdf')
}

export function exportarHorarioPDF(empleados: Empleado[], turnos: Turno[], lunes: Date, opts: ExportOpts = {}) {
  const pdf = buildPDF(empleados, turnos, lunes, opts)
  const filename = `horario_S${numeroSemanaISO(lunes)}_${isoDate(lunes)}.pdf`
  if (opts.abrir) {
    pdf.save(filename)
  }
  return pdf
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
