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

/** Ventas · chips tintados por canal (color de plataforma + alpha, dato). */
export const VENTAS_CANAL_CHIP: Record<string, { bg: string; tx: string }> = {
  uber:        { bg: '#06C16722', tx: '#05833f' },
  glovo:       { bg: '#F2D20033', tx: '#8a7400' },
  just_eat:    { bg: '#FF800022', tx: '#c25e00' },
  rushour:     { bg: '#1e223318', tx: '#1e2233' },
  desconocido: { bg: '#9aa0ad22', tx: '#6b7280' },
}

/** Punto de equilibrio · fondo de tarjeta con degradado verde suave. */
export const PE_CARD_GRAD = 'linear-gradient(180deg, #fff 0%, #1D9E7508 100%)'
/** Zebra de tabla clara (fila alterna). */
export const ZEBRA_CLARA = '#EFF0EC'

/* ── Panel Global · marca, variantes oscuras de canal y plan contable ──
 * (colores de MARCA/DATO fijos, sin equivalente en neobrutal.ts; viven aquí
 * para que el módulo de tokens del panel quede a 0 hex). */
export const PANEL_SIDEBAR_BG = '#1e2233'
export const PANEL_MODAL_BG = '#484f66'
export const CANAL_UBER_DARK = '#0F6E56'
export const CANAL_GLOVO_DARK = '#8a5b00'
export const CANAL_JE_DARK = '#a34e00'
export const CANAL_WEB_DARK = '#791F1F'
export const CANAL_DIR_DARK = '#185FA5'
export const CAT_PRD = '#7B4F2A'
export const CAT_EQP = '#4A5980'
export const CAT_LOC = '#5A8A6F'
export const CAT_CTR = '#A87C3D'

/* ── ResumenLanding (pestaña Resumen del Panel Global) ── */
/** Colores extra para el gráfico de mix por marca (más allá de los 5 semánticos). */
export const PANEL_MARCA_MORADO = '#8A4FFF'
export const PANEL_MARCA_CIAN = '#0FB8B8'
/** Fondo de fila "en negrita" (totales) de la tabla de costes. */
export const RESUMEN_ROW_BOLD = '#faf4e6'
/** Proyección de caja: texto rojo/verde suave sobre fondo oscuro. */
export const PROY_ROJO_S = '#ffd6d6'
export const PROY_VERDE_S = '#d6ffe0'

/** CardFacturasCorreo (Resumen) · alerta y progreso de correo. */
export const CORREO_ALERTA_BORDE = '#FF4757'
export const CORREO_PROGRESO = '#1D6FE2'
export const CORREO_ERROR_BORDE = '#E24B4A'

/** CardPedidosTM · colores de canal Web/Directa (más allá de los 5 semánticos del kit). */
export const CANAL_TM_WEB = '#8B5CF6'
export const CANAL_TM_DIRECTA = '#06B6D4'

/** TabResumen · borde/sombra "casi negro" de una card puntual (no el INK estándar). */
export const RESUMEN_BORDE_OSCURO = '#140f08'

/** Analytics · azul/morado extra para Web/Directa en graficos de canal (mas alla del kit). */
export const ANALYTICS_WEB_ALT = '#6b7cff'
export const ANALYTICS_DIRECTA_ALT = '#9b59b6'
/** VentasMarca · paleta extendida de 10 colores para el mix por marca (dataviz). */
export const VENTASMARCA_CHART_EXTRA = ['#e8617a', '#3aa8c1', '#c17d3a', '#5a5a5a']
/** ParetoVentas · caja de aviso amarilla (tono propio, distinto de AMA_S del kit). */
export const PARETO_WARN_BG = '#fff8e6'
export const PARETO_WARN_TXT = '#8a6d1f'

/** Toggle "Imprimir en blanco y negro" (Cocina): gris fijo de vista previa de
 * impresión, deliberadamente ajeno al tema claro/oscuro de la app. */
export const PRINT_BN_BG = '#e7e7e7'
export const PRINT_BN_TXT = '#111'

/** Lista de Compra · cobertura de precio (verde/naranja de dato, no semántico kit). */
export const COBERTURA_VERDE = '#1D9E75'
export const COBERTURA_NARANJA = '#c47600'
export const COBERTURA_NARANJA_CLARO = '#e0a53a'

/** Escandallo · badges de match de ingrediente (paleta Tailwind green/amber, no kit). */
export const ESCANDALLO_OK_BG = '#dcfce7'
export const ESCANDALLO_OK_TXT = '#166534'
export const ESCANDALLO_WARN_BG = '#fef3c7'
export const ESCANDALLO_WARN_BORDE = '#f59e0b'
export const ESCANDALLO_WARN_ICON = '#d97706'
export const ESCANDALLO_WARN_BTN = '#b45309'
export const ESCANDALLO_WARN_TXT = '#92400e'
/** Divisor suave dentro de tarjeta de proveedor (Escandallo·Ingrediente), distinto de BORDE_SUAVE. */
export const ESCANDALLO_DIVIDER = '#e5ddc8'

/** Botón "Añadir" canónico (regla design-system): fondo LIMA, texto casi-negro fijo. */
export const BOTON_ANADIR_TXT = '#111111'
