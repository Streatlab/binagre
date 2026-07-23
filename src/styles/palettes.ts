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
export const PARETO_WARN_BORDER = '#f0dca0'
export const PARETO_WARN_MUT = '#a08a4a'

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

/** Escandallo · tablas (Índice/Ingredientes/Mermas/EPS/Recetas): zebra crema
 * tostada, subtítulo y borde de cabecera — fuente única de estilosTabla.ts. */
export const ESCANDALLO_ZEBRA_B = '#F7EACE'
export const ESCANDALLO_SUBT = '#5a4f3a'
export const ESCANDALLO_TH_BORDE = '#4a3f2c'

/** Menú Engineering · cuadrante "Caballo" (naranja distinto de NAR del kit). */
export const ME_CABALLO = '#f5a623'

/** Inventario · washes oscuros de alerta (verde/rojo/azul sobre fondo dark, fijos). */
export const DARK_WASH_ROJO_BG = '#2a1a1a'
export const DARK_WASH_VERDE_BG = '#1a2a1a'
export const DARK_WASH_AZUL_BG = '#1a1a2a'
export const DARK_WASH_AMA_BG = '#2a2a1a'

/** TabCostes (Config·Compras) · tag "manual" (rojo) vs "auto" (azul), claro/oscuro. */
export const TABCOSTES_MANUAL_BG_DARK = 'rgba(176,29,35,0.28)'
export const TABCOSTES_MANUAL_BG_LIGHT = '#FCEBEB'
export const TABCOSTES_MANUAL_FG_DARK = '#F09595'
export const TABCOSTES_MANUAL_FG_LIGHT = '#A32D2D'
export const TABCOSTES_AUTO_BG_DARK = 'rgba(102,160,214,0.22)'
export const TABCOSTES_AUTO_BG_LIGHT = '#E6F1FB'
export const TABCOSTES_AUTO_FG_DARK = '#89B5DF'
export const TABCOSTES_AUTO_FG_LIGHT = '#0C447C'

/** Botón primario granate en estado disabled (Tareas Operativas). */
export const GRANATE_DISABLED = '#6b1015'

/** Manuales de Operaciones · categorías con color propio (fuera de la paleta kit). */
export const MANUALES_CAT_EMERGENCIA = '#ff4444'
export const MANUALES_CAT_RRHH = '#cc88ff'
/** Texto rojo claro de acción "peligrosa" sobre fondo oscuro (Archivar). */
export const MANUALES_DANGER_TXT = '#ff7777'

/** Banner de error (Operaciones): mismo lenguaje visual que el campo calculado
 * oficial pero es un componente DISTINTO (alerta, no dato calculado) — token
 * propio para no acoplarse a la regla de campos calculados de CLAUDE.md. */
export const ERROR_BANNER_BG = '#2d1515'
export const ERROR_BANNER_BORDE = '#aa3030'

/** Fila/tarjeta seleccionada en Libro de Equipos (navy oscuro). */
export const LIBRO_SELECTED_BG = '#1a1f2e'

/** Bitácora de Novedades · chip de etiqueta (GRANATE alpha, wash sobre fondo oscuro). */
export const BITACORA_TAG_BG = 'rgba(176,29,35,0.08)'
export const BITACORA_TAG_BORDE = 'rgba(176,29,35,0.25)'

/** Libro de Equipos · badge de estado (VERDE/GRANATE alpha, wash sobre fondo oscuro). */
export const LIBRO_ESTADO_OK_BG = 'rgba(15,184,107,0.13)'
export const LIBRO_ESTADO_BAJA_BG = 'rgba(176,29,35,0.13)'

/** BPM Calidad · item completado (VERDE alpha, wash + borde sobre fondo oscuro). */
export const BPM_ITEM_DONE_BG = 'rgba(15,184,107,0.08)'
export const BPM_ITEM_DONE_BORDE = 'rgba(15,184,107,0.19)'

/** Reuniones de Equipo · borde de acuerdos pendientes (NAR alpha). */
export const REUNIONES_ACUERDO_BORDE = 'rgba(255,106,26,0.25)'

/** Calendario Laboral (Equipo) · wash de celda festivo (LIMA alpha, mismo tono que la leyenda). */
export const CALENDARIO_FESTIVO_BG = 'rgba(232,244,66,0.08)'

/** Badge de estado genérico (VERDE/GRANATE/NAR alpha ~12,5%) · Permisos, Portal, etc. */
export const BADGE_PENDIENTE_BG = 'rgba(255,106,26,0.13)'

/** Portal (Equipo) · fila "hoy" resaltada (GRANATE alpha suave). */
export const TABPORTAL_TODAY_BG = 'rgba(176,29,35,0.06)'

/** Incentivos · documento HTML imprimible independiente (window.open), fijo
 * como un "hoja" — no sigue el tema claro/oscuro de la app a propósito. */
/** Calendario Laboral (Equipo) · color por empleado (top-5 + fallback) y tipos
 * de ausencia sin equivalente semántico en el kit. */
export const EMP_CALENDARIO_EXTRA = ['#1E88CC', '#9b59b6', '#e67e22', '#27ae60']
export const PERMISO_RETRIBUIDO = '#9b59b6'
export const FESTIVO_CALENDARIO_TXT = '#9a9a1e'
export const SIN_DATO_GRIS = '#888'

/** Organigrama · dorado "responsable" y violeta "habilidades/onboarding" (sin equivalente kit). */
export const ORG_DORADO = '#e8b341'
export const ORG_VIOLETA = '#9b6dff'

/** Control de Presencia · washes de entrada/salida (verdes/rojos oscuros propios). */
export const PRESENCIA_WASH_VERDE_BG = '#0d3320'
export const PRESENCIA_WASH_ROJO_BG = '#2a0d0d'
export const PRESENCIA_SALIDA_TXT = '#ff6b6b'

/** Horarios (Equipo) · color pastel por empleado, rama suave del kit (6 tonos). */
export const COLORES_EMPLEADO_HORARIOS = [
  { bg: '#B5D4F4', text: '#042C53' }, // azul
  { bg: '#C0DD97', text: '#173404' }, // verde
  { bg: '#F4C0D1', text: '#4B1528' }, // rosa
  { bg: '#FAC775', text: '#412402' }, // ámbar
  { bg: '#9FE1CB', text: '#04342C' }, // teal
  { bg: '#CECBF6', text: '#26215C' }, // morado
] as const
/** Botón "Guardando…" (Cuadrante Horarios): verde apagado mientras persiste. */
export const VERDE_GUARDANDO = '#7a8'

/* ── Configuración · micro-sistema visual propio (claro fijo + oscuro=kit) ──
 * Todo components/configuracion/* comparte este patrón: isDark ? INK/GRIS : hex. */
export const CONFIG_BORDE = '#E9E1D0'
export const CONFIG_BORDE_ALT = '#DDD4BF'
export const CONFIG_BORDE_ALT2 = '#F0E8D5'
export const CONFIG_MUT = '#9E9588'
export const CONFIG_MUT_ALT = '#6E6656'
export const CONFIG_TEXT_FUERTE = '#1A1A1A'
export const CONFIG_HOVER_CREMA = '#F1EADD'
export const CONFIG_HOVER_CREMA_ALT = '#FAF4E4'
export const CONFIG_ROJO_WASH = '#FCE0E2'
export const CONFIG_ROJO_WASH_DARK = 'rgba(176,29,35,0.22)'

/** Aprendizajes (Config) · badge de módulo, 8 colores distintos (dark bg + texto saturado). */
export const APRENDIZAJES_MODULO = {
  facturacion:   { bg: '#1a2d1a', color: '#4ade80' },
  conciliacion:  { bg: '#1a1a2d', color: '#818cf8' },
  ocr:           { bg: '#2d1a2d', color: '#e879f9' },
  ingredientes:  { bg: '#2d2a1a', color: '#fbbf24' },
  recetas:       { bg: '#1a2d2d', color: '#22d3ee' },
  panel:         { bg: '#2d1a1a', color: '#f87171' },
  compras:       { bg: '#1a2520', color: '#34d399' },
} as const
export const APRENDIZAJES_MODULO_DEFAULT = { bg: '#222', color: '#ccc' }
export const APRENDIZAJES_MODULO_CONFIG_TXT = '#9ca3af'
export const APRENDIZAJES_SEC = '#9ba8c0'
export const APRENDIZAJES_OK_BG = '#0d2d1a'
export const APRENDIZAJES_OK_TXT = '#4ade80'

/** CalcNeto Aprendizaje (Config) · badge "ESTIMADO"/"EST" sobre PANEL_MODAL_BG. */
export const ESTIMADO_BADGE_TXT = '#d0d8ff'
/** Wash de alerta ámbar oscuro (fila con estado "alerta"). */
export const ALERTA_WASH_BG = '#2d2800'

/** Usuarios (Config) · badge de rol — roles sin equivalente en STATUSTAG. */
export const USUARIOS_ROL_REPARTIDOR = { bgDark: 'rgba(29,158,117,0.22)', bgLight: '#D4F0E4', fgDark: '#5DD8A8', fgLight: '#027b4b' }
export const USUARIOS_ROL_SOLO_LECTURA = { bgDark: 'rgba(90,104,128,0.22)', bgLight: '#EAEDF2', fgDark: '#8A98B8', fgLight: '#445570' }
export const USUARIOS_ROL_EMPLEADO = { bgDark: 'rgba(155,89,182,0.22)', bgLight: '#F0E8F8', fgDark: '#C39FDE', fgLight: '#6B3A8F' }
export const USUARIOS_ROL_DEFAULT = { bg: '#333', fg: '#888' }
export const USUARIOS_ROL_SIN_DATO = '#7080a8'

/** Conciliación bancaria (Config) · pestaña activa ámbar, dark+light. */
export const CONCILIACION_ACTIVE_BG_DARK = '#2a2600'
export const CONCILIACION_ACTIVE_BG_LIGHT = '#FFF3B8'
export const CONCILIACION_ACTIVE_BORDE_DARK = '#4a4000'
export const CONCILIACION_ACTIVE_BORDE_LIGHT = '#E8D066'
export const CONCILIACION_ACTIVE_TXT_LIGHT = '#5a4d0a'
/** Wash de error dark (distinto de DARK_WASH_ROJO_BG, tono ligeramente más rojo). */
export const ROJO_WASH_BG_DARK = '#3a1a1a'
export const ROJO_TXT_DARK = '#ff8080'

/** Calendario Laboral (Config) · tipo de día festivo/vacaciones (cerrado usa
 * ERROR_BANNER_BG / ROJO / ROJO_S ya existentes). bg reusa PANEL_SIDEBAR_BG y PANEL_MODAL_BG. */
export const CALENDARIO_FESTIVO_BORDE = '#3a4060'
export const CALENDARIO_VACACIONES_BORDE = '#6070aa'
/** Modal "Cambiar tipo de día": panel navy oscuro. */
export const CALENDARIO_MODAL_BG = '#131928'
export const CALENDARIO_MODAL_BORDE = '#2a3050'

/** Mapeo de Marcas (Config) · variante de color de canal propia de esta pantalla. */
export const MARCA_GLOVO = '#FFC107'
export const MARCA_JE = '#F36805'
/** Fondo claro fijo de TabCanales (distinto de CREMA). */
export const TABCANALES_BG_LIGHT = '#faf8f3'

/** Diccionario NIF (Config) · badge "Plantilla" (azul distinto de AZUL del kit). */
export const DICCIONARIO_PLANTILLA_AZUL = '#3b82f6'

/** Reglas/Categorías (Config·Bancos) · wash ámbar de aviso informativo, reusado
 * en ReglasGlobalesPanel/CategoriasPanel/ReglasPanel con las mismas 3 gamas de
 * borde (normal, código). */
export const CONFIG_AMBER_WASH = {
  bgLight: '#FAEEDA',
  bgDark: 'rgba(186,117,23,0.18)',
  brdLight: '#FAC775',
  brdDark: 'rgba(250,199,117,0.28)',
  brdCodeDark: 'rgba(250,199,117,0.22)',
  brdCodeLight: '#E9D9A6',
  txtStrongLight: '#412402',
  txtStrongDark: '#FAC775',
  txtSubLight: '#854F0B',
  txtSubDark: '#F5C36B',
}
/** Categorías (Config·Bancos) · acento nivel 1 / ingreso, dark+light. */
export const CATEGORIAS_N1_LIGHT = '#A32D2D'
export const CATEGORIAS_ING_LIGHT = '#3B6D11'
/** Titulares (Config·Bancos) · fondo claro fijo, casi blanco. */
export const TITULARES_BG_LIGHT = '#fafafa'

/** OCR (piel, V8) · beige/navy propios de VentasPlatosFranjas y wash rojo muy claro. */
export const OCR_BEIGE = '#edecea'
export const OCR_ROJO_WASH_CLARO = '#fff5f5'
export const OCR_NAR_WASH_BG = '#FFF7ED'
export const OCR_NAR_WASH_TXT = '#9a4a12'
export const OCR_FOOTER_BG = '#fafaf7'
export const OCR_TOAST_GRANATE_OSCURO = '#7a0d12'
export const OCR_TOAST_AMBER_BG = '#FFF3E0'
export const OCR_TOAST_AMBER_TXT = '#8a4b00'
export const OCR_TOAST_VERDE_WASH = '#EAF7F1'
export const OCR_TOAST_ROJO_WASH = '#FDECEC'

/** Conciliación (piel, V8) · badge "no conciliable" (violeta propio). */
export const CONCILIACION_VIOLETA = '#6a5acd'
export const CONCILIACION_VIOLETA_CLARO = '#8a7df0'

/** Importador (piel, V8) · texto canónico de Glovo (regla design-system) y Rushour. */
export const PLATAFORMA_GLOVO_TXT = '#aabc00'
export const PLATAFORMA_RUSHOUR = '#7F77DD'
/** Granate en hover (botones primarios de Configuración). */
export const GRANATE_HOVER = '#901A1E'
/** Verde "positivo" distinto de COBERTURA_VERDE (KpiCard subTone). */
export const KPI_POS_VERDE = '#22B573'

/** StatusTag: 9 categorías, cada una con {bg,fg} oscuro/claro. admin/gestor
 * coinciden exactamente con TabCostes (manual/auto) — mismo origen visual. */
export const STATUSTAG = {
  ok:     { bgDark: 'rgba(29,158,117,0.22)', bgLight: '#D4F0E0', fgDark: '#5DCAA5', fgLight: '#027b4b' },
  off:    { bgDark: 'rgba(255,255,255,0.08)', bgLight: '#ebe5d8', fgDark: '#9ba8c0', fgLight: '#9E9588' },
  cocina: { bgDark: 'rgba(186,117,23,0.26)', bgLight: '#FAEEDA', fgDark: '#F5C36B', fgLight: '#854F0B' },
  fijo:   { bgDark: 'rgba(90,74,191,0.26)', bgLight: '#E6DFFF', fgDark: '#B7A8F5', fgLight: '#5A4ABF' },
  var:    { bgDark: 'rgba(184,86,31,0.22)', bgLight: '#FFE6D9', fgDark: '#F5A983', fgLight: '#B8561F' },
  pers:   { bgDark: 'rgba(31,108,184,0.26)', bgLight: '#D9EFFF', fgDark: '#89BFF0', fgLight: '#1F6CB8' },
  mkt:    { bgDark: 'rgba(184,38,110,0.22)', bgLight: '#FFD9E9', fgDark: '#F092B6', fgLight: '#B8266E' },
} as const

/** Ctag: único valor sin equivalente ya tokenizado (el resto reusa STATUSTAG/TABCOSTES). */
export const CTAG_LIMA_TXT_LIGHT = '#5c550d'

/** CanalCard: filas de mix por canal (Uber/Glovo/Just Eat), color de dato. */
export const CANALCARD = {
  ue: { bg: '#DCEFE0', border: '#22B573', text: '#027b4b', val: '#22B573' },
  gl: { bg: '#F4EEBC', border: '#DCCF2A', text: '#5c550d', val: '#8a7d00' },
  je: { bg: '#F9E8CC', border: '#E89A2B', text: '#B8561F', val: '#E89A2B' },
} as const

export const INCENTIVOS_PRINT = {
  borde: '#eee',
  texto: '#111',
  mut: '#666',
  fondoSuave: '#f6f6f6',
  pieMut: '#999',
  granate: '#B01D23',
}
/** Verde "positivo" Material (distinto de VERDE del kit), usado en Inventario. */
export const VERDE_POSITIVO = '#4caf50'
