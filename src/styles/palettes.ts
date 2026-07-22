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
