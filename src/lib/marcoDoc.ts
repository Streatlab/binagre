/* ==============================================================================
 * MODULO BLINDADO - MARCO UNICO DE DOCUMENTOS IMPRIMIBLES (ERP Streat Lab)
 * Fuente de verdad de la CAPA DE PRESENTACION de todo documento imprimible del ERP.
 * Espina lateral + cabecera (doc + meta + titulo centrado + logo) + paginado + paleta
 * por area + radio unico + fuentes embebidas (Oswald titulos / Barlow datos).
 * Cada documento SOLO aporta su contenido; el marco es la fuente de verdad del look.
 * PROHIBIDO cambiar paleta, medidas, fuentes o estructura del marco sin que Ruben lo
 * pida EXPLICITAMENTE. Registro: Notion CEREBRO-SL "MARCO DOCUMENTOS ERP" y docs/MARCO_DOCUMENTOS.md.
 * Doc de referencia: docs/MARCO_DOCUMENTOS.md.
 * ============================================================================== */
import { jsPDF } from 'jspdf'

// ─── TIPOS / PALETA ─────────────────────────────────────────────────────────
export type Area = 'cocina' | 'finanzas' | 'equipo'
export type RGB = [number, number, number]

export interface Paleta { acento: RGB; soft: RGB; soft2: RGB }

const PALETAS: Record<Area, Paleta> = {
  cocina:   { acento: [168, 82, 78],  soft: [236, 218, 217], soft2: [247, 239, 238] }, // #A8524E
  finanzas: { acento: [75, 90, 114],  soft: [218, 223, 232], soft2: [238, 241, 245] }, // #4B5A72
  equipo:   { acento: [92, 138, 110], soft: [217, 232, 223], soft2: [238, 245, 241] }, // #5C8A6E
}
const PALETA_BN: Paleta = { acento: [86, 86, 86], soft: [231, 231, 231], soft2: [243, 243, 243] } // #565656

/** Colores neutros comunes a todas las areas. */
export const TINTA: RGB = [35, 35, 35]    // #232323
export const GRIS: RGB = [108, 108, 108]  // #6c6c6c
export const LINEA: RGB = [207, 207, 207] // #cfcfcf
export const BLANCO: RGB = [255, 255, 255]

/** Radio unico para TODA esquina redondeada del ERP (tablas, tarjetas, pills, circulos de paso). */
export const R = 1.6 // mm (≈6px)

/** Medidas canonicas del marco (mm). */
export const MARGEN = 10
export const ESPINA_W = 7   // ancho de la espina lateral izquierda
export const ESPINA_GAP = 3 // aire entre espina y contenido

/** Paleta activa segun area + modo B/N. */
export function paleta(area: Area, bn = false): Paleta { return bn ? PALETA_BN : PALETAS[area] }

function mezcla(c: RGB, con: RGB, t: number): RGB {
  return [Math.round(c[0] + (con[0] - c[0]) * t), Math.round(c[1] + (con[1] - c[1]) * t), Math.round(c[2] + (con[2] - c[2]) * t)]
}
/** Color de la espina = 86% acento + 14% blanco (un punto mas suave que el acento). */
export function espinaColor(area: Area, bn = false): RGB { return mezcla(paleta(area, bn).acento, BLANCO, 0.14) }

const AREA_LABEL: Record<Area, string> = { cocina: 'COCINA', finanzas: 'FINANZAS', equipo: 'EQUIPO' }

// ─── RECURSOS EMBEBIDOS (fuentes + logo) ────────────────────────────────────
// Mismo patron de carga+cache+base64 que Esquemas.tsx (cargarFuentesEsquemas).
const FUENTES_URLS: Record<string, string> = {
  oswald: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/oswald@0.4.2/700Bold/Oswald_700Bold.ttf',
  oswaldMed: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/oswald@0.4.2/500Medium/Oswald_500Medium.ttf',
  barlow: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/barlow-semi-condensed@0.4.1/600SemiBold/BarlowSemiCondensed_600SemiBold.ttf',
  barlowReg: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/barlow-semi-condensed@0.4.1/400Regular/BarlowSemiCondensed_400Regular.ttf',
}
const LOGO_URL = '/data/STREAT LAB LOGO-04.jpg'

export interface Recursos { fonts: Record<string, string> | null; logo: string | null }
let _cache: Recursos | null = null

async function cargarFuentes(): Promise<Record<string, string> | null> {
  try {
    const pares = await Promise.all(Object.entries(FUENTES_URLS).map(async ([k, u]) => {
      const r = await fetch(u)
      if (!r.ok) throw new Error('font ' + k)
      const bytes = new Uint8Array(await r.arrayBuffer())
      let bin = ''
      const CH = 0x8000
      for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)))
      return [k, btoa(bin)] as const
    }))
    return Object.fromEntries(pares)
  } catch { return null }
}

// Carga el logo real de la app y lo reduce a un JPEG pequeño (base64) para no inflar el PDF.
async function cargarLogo(): Promise<string | null> {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const done = new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('logo')) })
    img.src = LOGO_URL
    await done
    const maxW = 420
    const scale = Math.min(1, maxW / img.naturalWidth)
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch { return null }
}

/** Carga (y cachea) fuentes + logo. Si algo falla, cae a Helvetica / texto "STREAT LAB". */
export async function cargarRecursos(): Promise<Recursos> {
  if (_cache) return _cache
  const [fonts, logo] = await Promise.all([cargarFuentes(), cargarLogo()])
  _cache = { fonts, logo }
  return _cache
}

// ─── REGISTRO DE FUENTES EN EL DOC ──────────────────────────────────────────
export interface Ctx { emb: boolean; logo: string | null }

/** Registra fuentes en el doc y devuelve el contexto (emb + logo) que consumen los helpers. */
export function preparar(doc: jsPDF, rec: Recursos): Ctx {
  let emb = false
  if (rec.fonts) {
    try {
      doc.addFileToVFS('MOsw.ttf', rec.fonts.oswald); doc.addFont('MOsw.ttf', 'MOsw', 'bold')
      doc.addFileToVFS('MOswM.ttf', rec.fonts.oswaldMed); doc.addFont('MOswM.ttf', 'MOsw', 'normal')
      doc.addFileToVFS('MBar.ttf', rec.fonts.barlow); doc.addFont('MBar.ttf', 'MBar', 'bold')
      doc.addFileToVFS('MBarR.ttf', rec.fonts.barlowReg); doc.addFont('MBarR.ttf', 'MBar', 'normal')
      emb = true
    } catch { emb = false }
  }
  return { emb, logo: rec.logo }
}

/** Fuente de titulos/etiquetas (Oswald embebido, fallback Helvetica). */
export function fTitulo(doc: jsPDF, ctx: Ctx, bold = true) { doc.setFont(ctx.emb ? 'MOsw' : 'helvetica', bold ? 'bold' : 'normal') }
/** Fuente de datos/contenido (Barlow Semi Condensed embebido, fallback Helvetica). */
export function fDato(doc: jsPDF, ctx: Ctx, bold = false) { doc.setFont(ctx.emb ? 'MBar' : 'helvetica', bold ? 'bold' : 'normal') }

// ─── HOJA ───────────────────────────────────────────────────────────────────
export function nuevaHoja({ orientation = 'portrait' }: { orientation?: 'portrait' | 'landscape' } = {}): jsPDF {
  return new jsPDF({ orientation, unit: 'mm', format: 'a4' })
}

/** Caja de contenido util (a la derecha de la espina, dentro de los margenes). */
export function contentBox(doc: jsPDF): { x0: number; x1: number; w: number; top: number; bottom: number } {
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const x0 = MARGEN + ESPINA_W + ESPINA_GAP
  const x1 = PW - MARGEN
  return { x0, x1, w: x1 - x0, top: MARGEN, bottom: PH - MARGEN - 6 }
}

// ─── ESPINA ─────────────────────────────────────────────────────────────────
/** Barra lateral izquierda con el area escrita en vertical. */
export function pintarEspina(doc: jsPDF, area: Area, ctx: Ctx, bn = false) {
  const PH = doc.internal.pageSize.getHeight()
  const x = MARGEN
  const top = MARGEN
  const h = PH - MARGEN * 2
  const col = espinaColor(area, bn)
  doc.setFillColor(col[0], col[1], col[2])
  doc.roundedRect(x, top, ESPINA_W, h, R, R, 'F')
  fTitulo(doc, ctx, true)
  doc.setFontSize(9); doc.setTextColor(255, 255, 255)
  doc.text(AREA_LABEL[area], x + ESPINA_W / 2 + 1.1, top + h / 2, { align: 'center', angle: 90 })
}

// ─── CABECERA ───────────────────────────────────────────────────────────────
export interface CabeceraOpts {
  docNombre: string
  meta?: string
  tituloCentrado?: string
  area: Area
  bn?: boolean
}
/** Nombre doc + meta a la izq, titulo grande centrado, logo a la dcha, regla de acento. Devuelve la Y de continuacion. */
export function pintarCabecera(doc: jsPDF, ctx: Ctx, { docNombre, meta, tituloCentrado, area, bn = false }: CabeceraOpts): number {
  const { x0, x1, w } = contentBox(doc)
  const pal = paleta(area, bn)
  const yTop = MARGEN + 2

  // logo (o texto de fallback) arriba a la derecha
  const logoH = 11, logoMaxW = 34
  if (ctx.logo) {
    try {
      const props = doc.getImageProperties(ctx.logo)
      const ratio = props.width / props.height
      let lw = logoH * ratio
      if (lw > logoMaxW) lw = logoMaxW
      const lh = lw / ratio
      doc.addImage(ctx.logo, 'JPEG', x1 - lw, yTop, lw, lh)
    } catch {
      fTitulo(doc, ctx, true); doc.setFontSize(11); doc.setTextColor(...TINTA)
      doc.text('STREAT LAB', x1, yTop + 5, { align: 'right' })
    }
  } else {
    fTitulo(doc, ctx, true); doc.setFontSize(11); doc.setTextColor(...TINTA)
    doc.text('STREAT LAB', x1, yTop + 5, { align: 'right' })
  }

  // nombre del documento (izquierda)
  fTitulo(doc, ctx, true); doc.setFontSize(12.5); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
  doc.text(docNombre.toUpperCase(), x0, yTop + 4.6)
  let yMeta = yTop + 4.6
  if (meta) {
    fDato(doc, ctx, false); doc.setFontSize(8.2); doc.setTextColor(...GRIS)
    doc.text(meta, x0, yTop + 9.4)
    yMeta = yTop + 9.4
  }

  // titulo grande centrado (opcional)
  if (tituloCentrado) {
    fTitulo(doc, ctx, true); doc.setTextColor(...TINTA)
    let fs = 22; doc.setFontSize(fs)
    const maxW = w - logoMaxW * 2 - 8
    while (fs > 12 && doc.getTextWidth(tituloCentrado.toUpperCase()) > maxW) { fs -= 0.5; doc.setFontSize(fs) }
    doc.text(tituloCentrado.toUpperCase(), x0 + w / 2, yTop + 7.4, { align: 'center', charSpace: ctx.emb ? 0.4 : 0 })
  }

  const yRule = Math.max(yMeta, yTop + logoH) + 3
  doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.6)
  doc.line(x0, yRule, x1, yRule)
  return yRule + 4
}

// ─── PAGINADO ───────────────────────────────────────────────────────────────
/** "actual / total" abajo centrado (en la caja de contenido). */
export function pintarPaginado(doc: jsPDF, actual: number, total: number, ctx: Ctx) {
  const PH = doc.internal.pageSize.getHeight()
  const { x0, w } = contentBox(doc)
  fDato(doc, ctx, true); doc.setFontSize(9); doc.setTextColor(...GRIS)
  doc.text(`${actual} / ${total}`, x0 + w / 2, PH - MARGEN - 0.5, { align: 'center' })
}

// ─── HELPERS DE CONTENIDO (radio unico + paleta) ────────────────────────────
/** Contenedor/tarjeta con borde de acento y radio unico. Modo 'S' (borde) por defecto. */
export function tarjeta(doc: jsPDF, x: number, y: number, w: number, h: number, area: Area, opts: { bn?: boolean; fill?: boolean; lineWidth?: number } = {}) {
  const pal = paleta(area, opts.bn)
  doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(opts.lineWidth ?? 0.5)
  if (opts.fill) { doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.roundedRect(x, y, w, h, R, R, 'FD') }
  else doc.roundedRect(x, y, w, h, R, R, 'S')
}

/** Marco redondeado de tabla/seccion con la linea neutra del marco. */
export function tablaWrap(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(...LINEA); doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, R, R, 'S')
}

/**
 * Linea de relleno a mano (continuidad tras un dato para anotar cantidad, check, etc.).
 * UNICA linea permitida para este uso en todo el marco: nunca dibujar una segunda
 * linea de separador de fila pegada a esta (bug corregido: Inventario Permanente
 * dibujaba esta linea + un separador de fila 1,4mm por debajo -> se veian dos lineas juntas).
 */
export function lineaRelleno(doc: jsPDF, x0: number, x1: number, y: number) {
  doc.setDrawColor(...LINEA); doc.setLineWidth(0.3)
  doc.line(x0, y, x1, y)
}

/** Pastilla (pill) con relleno soft y texto en acento. Devuelve el ancho ocupado. */
export function pill(doc: jsPDF, x: number, y: number, text: string, area: Area, ctx: Ctx, opts: { bn?: boolean; fontSize?: number } = {}): number {
  const pal = paleta(area, opts.bn)
  const fs = opts.fontSize ?? 8
  fDato(doc, ctx, true); doc.setFontSize(fs)
  const padX = 2.4, hP = fs * 0.44 + 2.2
  const tw = doc.getTextWidth(text)
  const w = tw + padX * 2
  doc.setFillColor(pal.soft[0], pal.soft[1], pal.soft[2])
  doc.roundedRect(x, y, w, hP, R, R, 'F')
  doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
  doc.text(text, x + padX, y + hP - hP * 0.32)
  return w
}

/** Reduce el cuerpo de letra solo si el texto no cabe en el ancho dado. */
export function fitFont(doc: jsPDF, text: string, maxWidth: number, base: number, min: number): number {
  let fs = base; doc.setFontSize(fs)
  while (fs > min && doc.getTextWidth(text) > maxWidth) { fs -= 0.5; doc.setFontSize(fs) }
  return fs
}

// ─── SALIDA ─────────────────────────────────────────────────────────────────
export function nombreArchivo(tipo: string): string {
  const limpio = tipo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-|-$/g, '')
  return `${limpio}.pdf`
}

/** Abre el PDF en pestaña nueva y lanza el dialogo de impresion (evita la cola colgada WiFi). */
export function abrirImprimir(doc: jsPDF) {
  const url = doc.output('bloburl')
  const win = window.open(url as unknown as string, '_blank')
  if (win) win.addEventListener('load', () => { try { win.focus(); win.print() } catch { /* imprime desde el visor */ } })
}

export function descargar(doc: jsPDF, tipo: string) { doc.save(nombreArchivo(tipo)) }

// ─── CSS VARS PARA PANTALLA ──────────────────────────────────────────────────
function toHex(rgb: RGB): string {
  return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')
}

/** Tokens del marco como CSS custom properties para pantalla.
 *  Aplica en el contenedor del documento (style prop) para que los hijos
 *  hereden los colores del area via var(--m-acento), var(--m-soft), etc. */
export function marcoCSSVars(area: Area): Record<string, string> {
  const pal = PALETAS[area]
  return {
    '--m-acento': toHex(pal.acento),
    '--m-soft':   toHex(pal.soft),
    '--m-soft2':  toHex(pal.soft2),
    '--m-tinta':  toHex(TINTA),
    '--m-linea':  toHex(LINEA),
    '--m-espina': toHex(espinaColor(area)),
    '--m-radio':  '6px',
  }
}
