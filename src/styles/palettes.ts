/**
 * palettes.ts — paletas de DATOS del ERP (no estructurales).
 *
 * Vive en src/styles/ (fuente única de color) para que ningún componente
 * hardcodee hex. Aquí van las paletas que codifican DATOS (no estado del kit):
 * p.ej. el color por trimestre del árbol Drive del Gestor Documental, que
 * no tiene equivalente semántico en el kit Neobrutal Alegre.
 */

/** Árbol Drive (Gestor Documental): color pastel por trimestre + cabecera. */
export const DRIVE_TRIM: Record<number, { bg: string; headDark: string }> = {
  1: { bg: '#dde8f4', headDark: '#3a5f80' },
  2: { bg: '#dee9d4', headDark: '#3d6027' },
  3: { bg: '#f4e8c8', headDark: '#7d5a1a' },
  4: { bg: '#e3d8eb', headDark: '#4a3163' },
}
/** Fondo y texto del nodo "año" en el árbol Drive. */
export const DRIVE_ANIO_BG = '#fbe5e8'
export const DRIVE_ANIO_TEXT = '#7a1218'

/** Objetivos · tintes translúcidos de fila por estado de día (no hay token de kit). */
export const OBJ_ROW_FINDE_BG = '#1D9E7510'        // fila de fin de semana (verde 6%)
export const OBJ_ROW_HOY_BG = '#1E5BCC10'          // fila de hoy / en curso (azul 6%)
export const OBJ_ROW_HOY_FESTIVO_BG = '#ffffff15'  // hoy + festivo (blanco 8%)
/** Objetivos · color de día festivo (oliva-lima, dato de calendario sin equivalente kit). */
export const OBJ_FESTIVO_BORDE = '#c8d400'
export const OBJ_FESTIVO_TXT = '#5c5c00'
export const OBJ_FESTIVO_PILL_TXT = '#1a1a00'

/** Grises para dibujar en PDF (jsPDF, fuera del sistema de tema). */
export const PDF_TEXT_GRAY = '#555'
export const PDF_LINE_GRAY = '#ccc'

/** Running (P&L anual) · paleta terrosa de la tabla oscura (sin equivalente kit). */
export const RUNNING_MUT = '#5a4f3a'
export const RUNNING_EST_TXT = '#3d362a'
export const RUNNING_BORDER = '#4a3f2c'
