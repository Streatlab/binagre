/**
 * planIncentivosPdf.ts — "Plan de Incentivos de Cocina" (SL-EQP-PR-001)
 * CLON LITERAL del documento aprobado en Claude Design (rev. 13): mismo texto,
 * mismo orden de secciones (01 candado · regla de muerte sin numerar · 03 colectivo ·
 * 04 individual · 05 ejemplos · 06 cómo se comprueba), misma paleta y misma estructura
 * de cabecera/hero/tarjetas. SOLO los importes se leen en vivo de incentivos_config:
 * si la config cambia, el documento impreso cambia solo, pero el texto no se toca.
 * NO reescribir el copy sin que Rubén lo pida explícitamente: es el original de Design.
 */
import * as M from '@/lib/marcoDoc'

type Cfg = Record<string, number | string | null>

const AREA: M.Area = 'equipo'
const n = (v: unknown) => Number(v ?? 0)
const eur = (v: unknown) => `${Math.round(n(v))} €`
const miles = (v: unknown) => n(v).toLocaleString('es-ES') + ' €'
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ─── PALETA EXACTA DEL DOCUMENTO DE DESIGN ─────────────────────────────────
const INK: M.RGB = [36, 29, 21]        // #241d15
const INK2: M.RGB = [92, 85, 74]       // #5c554a
const INK3: M.RGB = [138, 130, 117]    // #8a8275
const RULE: M.RGB = [195, 187, 168]    // #c3bba8
const RULE2: M.RGB = [125, 117, 102]   // #7d7566
const THEAD: M.RGB = [231, 238, 233]   // #e7eee9 (= acc-soft)
const ZEBRA: M.RGB = [243, 247, 244]   // #f3f7f4
const VERDE_SOFT: M.RGB = [228, 239, 232] // #e4efe8
const ROJO_SOFT: M.RGB = [242, 227, 226]  // #f2e3e2
const MARRON: M.RGB = [138, 109, 47]      // #8a6d2f (tramo 50-100€ de reembolsos, fijo, no cambia en B/N)
const BLANCO: M.RGB = [255, 255, 255]

function paletaDoc(bn: boolean) {
  return {
    acc: (bn ? [86, 86, 86] : [92, 138, 110]) as M.RGB,
    verde: (bn ? [61, 61, 61] : [47, 125, 85]) as M.RGB,
    rojo: (bn ? [43, 43, 43] : [158, 43, 40]) as M.RGB,
  }
}

// mm de CSS → pt de jsPDF (1mm = 2.83465pt); los tamaños están tomados literalmente del HTML de Design.
const PT = (mm: number) => mm * 2.83465

export function construirPlanIncentivosPDF(cfg: Cfg, rec: M.Recursos, opts: { bn?: boolean; para?: string; mes?: number; anio?: number } = {}) {
  const bn = !!opts.bn
  const pal = paletaDoc(bn)
  const now = new Date()
  const mesTxt = `${MESES[(opts.mes ?? now.getMonth() + 1) - 1]} ${opts.anio ?? now.getFullYear()}`
  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)

  const M0 = 7 // margen del documento (7mm, literal de Design), no el margen de 10mm del marco general
  const x0 = M0, x1 = 210 - M0, W = x1 - x0
  const TOTAL_PAGS = 3
  let y = M0

  const colMax = n(cfg.retrasos_eur) + n(cfg.reemb_eur1) + n(cfg.reemb_cero_extra) + n(cfg.inventario_eur) + n(cfg.valoracion_eur)
  const indMax = n(cfg.vacio_eur) + n(cfg.checklist_eur) + n(cfg.fechado_eur)

  // ─── helpers de texto ───
  const titulo = (bold: boolean) => { doc.setFont(ctx.emb ? 'MOsw' : 'helvetica', bold ? 'bold' : 'normal') }
  const dato = (bold: boolean) => { doc.setFont(ctx.emb ? 'MBar' : 'helvetica', bold ? 'bold' : 'normal') }

  // ─── PÁGINA 1: CABECERA ───
  const imgW = 22, imgH = 22
  if (ctx.logo) { try { doc.addImage(ctx.logo, 'JPEG', x0, y, imgW, imgH) } catch { /* noop */ } }
  const txX = x0 + imgW + 5
  const txW = 120
  const metaX = txX + txW + 5 // = 159
  const metaW = x1 - metaX // 44

  // badge "Equipo" + eyebrow
  titulo(true); doc.setFontSize(PT(3)); doc.setTextColor(pal.acc[0], pal.acc[1], pal.acc[2])
  const badgeTxt = 'EQUIPO'
  const bw = doc.getTextWidth(badgeTxt) + 6
  doc.setDrawColor(pal.acc[0], pal.acc[1], pal.acc[2]); doc.setLineWidth(0.35)
  doc.roundedRect(txX, y + 0.5, bw, 5.2, 0.4, 0.4, 'S')
  doc.text(badgeTxt, txX + 3, y + 3.9)
  dato(false); doc.setFontSize(PT(2.7)); doc.setTextColor(...INK3)
  doc.text('PLAN DE INCENTIVOS · COCINA', txX + bw + 4, y + 3.9)

  titulo(true); doc.setFontSize(PT(8.6)); doc.setTextColor(...INK)
  doc.text('PLAN DE INCENTIVOS DE COCINA', txX, y + 12.5)
  dato(false); doc.setFontSize(PT(2.9)); doc.setTextColor(...INK2)
  doc.text('Este dinero es tuyo. Solo hay que hacer bien el trabajo de cada día.', txX, y + 16.3)

  // meta box 2x2 (Código/Rev · Mes/Periodo)
  const metaH = 22
  doc.setDrawColor(...RULE2); doc.setLineWidth(0.3)
  doc.rect(metaX, y, metaW, metaH, 'S')
  doc.line(metaX, y + metaH / 2, metaX + metaW, y + metaH / 2)
  doc.line(metaX + metaW * 0.68, y, metaX + metaW * 0.68, y + metaH)
  const metaCelda = (xx: number, yy: number, w: number, label: string, val: string, fill = false) => {
    if (fill) { doc.setFillColor(pal.acc[0], pal.acc[1], pal.acc[2]); doc.rect(xx, yy, w, metaH / 2, 'F') }
    titulo(false); doc.setFontSize(PT(2.3)); doc.setTextColor(fill ? 255 : INK3[0], fill ? 255 : INK3[1], fill ? 255 : INK3[2])
    doc.text(label.toUpperCase(), xx + 2.4, yy + 4.2)
    titulo(true); doc.setFontSize(PT(3.2)); doc.setTextColor(fill ? 255 : INK[0], fill ? 255 : INK[1], fill ? 255 : INK[2])
    doc.text(val, xx + 2.4, yy + 8.4)
  }
  metaCelda(metaX, y, metaW * 0.68, 'CÓDIGO', 'SL-EQP-PR-001')
  metaCelda(metaX + metaW * 0.68, y, metaW * 0.32, 'REV.', '13')
  metaCelda(metaX, y + metaH / 2, metaW * 0.68, 'MES', mesTxt)
  metaCelda(metaX + metaW * 0.68, y + metaH / 2, metaW * 0.32, 'PERIODO', 'Mensual')

  y += 22
  doc.setDrawColor(pal.acc[0], pal.acc[1], pal.acc[2]); doc.setLineWidth(0.7)
  doc.line(x0, y, x1, y)
  y += 3.4

  // ─── FRANJA PARA / CUÁNDO SE PAGA ───
  const franjaH = 12
  doc.setDrawColor(...RULE2); doc.setLineWidth(0.3)
  doc.rect(x0, y, W, franjaH, 'S')
  const paraW = W * 0.43
  doc.line(x0 + paraW, y, x0 + paraW, y + franjaH)
  titulo(false); doc.setFontSize(PT(2.6)); doc.setTextColor(...INK3)
  doc.text('PARA', x0 + 3, y + 7.2)
  titulo(true); doc.setFontSize(PT(5)); doc.setTextColor(...INK)
  doc.text(opts.para ?? '', x0 + 13, y + 7.6)
  if (!opts.para) { doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.2); doc.line(x0 + 13, y + 8.3, x0 + paraW - 3, y + 8.3) }
  doc.setFillColor(THEAD[0], THEAD[1], THEAD[2]); doc.rect(x0 + paraW + 0.3, y, W - paraW - 0.3, franjaH, 'F')
  titulo(true); doc.setFontSize(PT(2.5)); doc.setTextColor(pal.acc[0], pal.acc[1], pal.acc[2])
  doc.text('CUÁNDO SE PAGA', x0 + paraW + 4, y + 4.4)
  dato(false); doc.setFontSize(PT(2.9)); doc.setTextColor(...INK2)
  doc.text(doc.splitTextToSize('El incentivo del mes natural (p. ej. agosto) se abona con la nómina del mes siguiente (septiembre).', W - paraW - 8), x0 + paraW + 4, y + 8)
  y += franjaH + 3.6

  // ─── HERO: PUEDES GANAR HASTA + 3 BLOQUES ───
  const heroH = 40
  const heroW = 66
  doc.setDrawColor(pal.acc[0], pal.acc[1], pal.acc[2]); doc.setLineWidth(0.4)
  doc.setFillColor(VERDE_SOFT[0], VERDE_SOFT[1], VERDE_SOFT[2])
  doc.roundedRect(x0, y, heroW, heroH, 1.6, 1.6, 'FD')
  titulo(false); doc.setFontSize(PT(2.7)); doc.setTextColor(pal.verde[0], pal.verde[1], pal.verde[2])
  doc.text('PUEDES GANAR HASTA', x0 + 4, y + 7)
  titulo(true); doc.setFontSize(PT(18)); doc.setTextColor(pal.verde[0], pal.verde[1], pal.verde[2])
  doc.text(eur(cfg.tope_total), x0 + 4, y + 22)
  titulo(false); doc.setFontSize(PT(3)); doc.setTextColor(...INK2)
  doc.text('EXTRA AL MES · POR PERSONA', x0 + 4, y + 27.5)
  dato(false); doc.setFontSize(PT(2.7)); doc.setTextColor(...INK2)
  doc.text(doc.splitTextToSize('Todo lo que puntúa ya deberías hacerlo; ahora, además, se paga.', heroW - 8), x0 + 4, y + 31.5)

  const xr = x0 + heroW + 3.4
  const wr = x1 - xr
  const rowH2 = (heroH - 2 * 2.2) / 3
  const bloqueRow = (yy: number, cifra: string, tit: string, sub: string, destacado = false) => {
    if (destacado) { doc.setFillColor(THEAD[0], THEAD[1], THEAD[2]); doc.setDrawColor(pal.acc[0], pal.acc[1], pal.acc[2]); doc.setLineWidth(0.4); doc.roundedRect(xr, yy, wr, rowH2, 1.6, 1.6, 'FD') }
    else { doc.setDrawColor(...RULE); doc.setLineWidth(0.3); doc.roundedRect(xr, yy, wr, rowH2, 1.6, 1.6, 'S') }
    titulo(true); doc.setFontSize(PT(6.4)); doc.setTextColor(pal.acc[0], pal.acc[1], pal.acc[2])
    doc.text(cifra, xr + 3, yy + rowH2 / 2 + 2.2)
    titulo(true); doc.setFontSize(PT(3.1)); doc.setTextColor(...INK)
    doc.text(tit.toUpperCase(), xr + 25, yy + rowH2 / 2 - 1.6)
    dato(false); doc.setFontSize(PT(2.8)); doc.setTextColor(...INK2)
    doc.text(doc.splitTextToSize(sub, wr - 28), xr + 25, yy + rowH2 / 2 + 2.3)
  }
  bloqueRow(y, eur(colMax), 'Bloque colectivo', `Entregas a tiempo (${n(cfg.retrasos_eur)}) + reembolsos (${n(cfg.reemb_eur1) + n(cfg.reemb_cero_extra)}) + inventario (${n(cfg.inventario_eur)}) + valoración de clientes (${n(cfg.valoracion_eur)}). Lo gana todo el equipo, o nadie.`)
  bloqueRow(y + rowH2 + 2.2, eur(indMax), 'Bloque individual', `Vacío de cámara (${n(cfg.vacio_eur)}) + checklists (${n(cfg.checklist_eur)}) + fechado (${n(cfg.fechado_eur)}). Cada uno lo suyo.`)
  bloqueRow(y + (rowH2 + 2.2) * 2, `×${n(cfg.mult_n3)}`, 'Multiplicador', `Con +${miles(cfg.fact_t3)} de facturación, todo se multiplica ×${n(cfg.mult_n3)}. El tope de ${eur(cfg.tope_total)} está a tu alcance por más de un camino.`, true)
  y += heroH + 3.6

  // ─── 01 · EL CANDADO DE FACTURACIÓN ───
  const kick = (num: string | null, texto: string) => {
    if (num) {
      titulo(true); doc.setFontSize(PT(4.6)); doc.setTextColor(pal.acc[0], pal.acc[1], pal.acc[2])
      doc.text(num, x0, y + 4.6)
      titulo(true); doc.setFontSize(PT(4.6)); doc.setTextColor(...INK)
      doc.text(texto.toUpperCase(), x0 + 10, y + 4.6)
    }
    y += 6
    doc.setDrawColor(pal.acc[0], pal.acc[1], pal.acc[2]); doc.setLineWidth(0.5)
    doc.line(x0, y, x1, y)
    y += 5.5
  }
  kick('01', 'El candado de facturación')
  const pCand = `Si la cocina no llega a ${miles(cfg.fact_min)} brutos en el mes, no hay incentivos: por debajo de esa cifra el negocio no cubre gastos y no hay dinero que repartir. A partir de ahí, cuanto más se factura, más se multiplica todo lo ganado. Objetivo diario de referencia: 900–1.000 € al día (alrededor de 40–60 pedidos diarios).`
  {
    dato(false); doc.setFontSize(PT(3.2)); doc.setTextColor(...INK2)
    const lines = doc.splitTextToSize(pCand, W)
    doc.text(lines, x0, y + 3.4)
    y += lines.length * 4.55 + 2
  }
  const tramos: Array<[string, string, string, M.RGB]> = [
    ['Por debajo', `< ${miles(cfg.fact_min)}`, 'No hay incentivos. El negocio no cubre gastos.', pal.rojo],
    [`Abre · ×${n(cfg.mult_n1)}`, `${miles(cfg.fact_min)}–${miles(cfg.fact_t2)}`, 'Se cobra tal cual lo ganado.', pal.acc],
    [`Sube · ×${n(cfg.mult_n2)}`, `${miles(cfg.fact_t2)}–${miles(cfg.fact_t3)}`, `Todo lo ganado se multiplica ×${n(cfg.mult_n2)}.`, pal.acc],
    [`Completo · ×${n(cfg.mult_n3)}`, `+${miles(cfg.fact_t3)}`, `Todo ×${n(cfg.mult_n3)}. Aquí se alcanza el tope de ${eur(cfg.tope_total)}.`, pal.verde],
  ]
  {
    const gap = 2.6, wT = (W - gap * 3) / 4, hT = 22
    tramos.forEach(([tag, cifra, desc, col], i) => {
      const xx = x0 + i * (wT + gap)
      doc.setDrawColor(...RULE2); doc.setLineWidth(0.3); doc.roundedRect(xx, y, wT, hT, 1.6, 1.6, 'S')
      doc.setDrawColor(col[0], col[1], col[2]); doc.setLineWidth(1.1); doc.line(xx, y, xx + wT, y)
      titulo(false); doc.setFontSize(PT(2.4)); doc.setTextColor(...INK3)
      doc.text(tag.toUpperCase(), xx + 2.4, y + 4)
      titulo(true); doc.setFontSize(PT(4.4)); doc.setTextColor(...INK)
      doc.text(cifra, xx + 2.4, y + 9.3)
      dato(false); doc.setFontSize(PT(2.8)); doc.setTextColor(...INK2)
      doc.text(doc.splitTextToSize(desc, wT - 4.5), xx + 2.4, y + 12.8)
    })
    y += hT + 3
  }
  {
    const p2 = 'Tu trabajo diario es la facturación: servir rápido, sin errores, sin reembolsos y con la tienda siempre operativa. Las plataformas premian eso con mejor posición y más pedidos.'
    dato(false); doc.setFontSize(PT(2.9)); doc.setTextColor(...INK2)
    const lines = doc.splitTextToSize(p2, W)
    doc.text(lines, x0, y + 3.3)
    y += lines.length * 4.1 + 4.6
  }

  // ─── LA REGLA DE MUERTE (sin numerar) ───
  {
    const bx0 = x0, bw = W
    // medir alto necesario
    const txtMuerte = 'Un solo pedido cancelado o sin aceptar por la cocina, o un cierre de tienda en horario de apertura, deja el incentivo del mes a 0 € PARA TODOS. Es lo que más castigan los algoritmos de Uber Eats, Glovo y Just Eat: una cancelación hunde la visibilidad de la tienda durante semanas y nos quita pedidos a todos. Se comprueba de forma automática cada 20 minutos con los informes oficiales de las plataformas a través del ERP ("pedidos no completados").'
    const txtCompaner = 'Cuidamos al equipo igual que cuidamos al cliente. Faltas de respeto a compañeros, incidentes graves de actitud o dejar tirado al equipo anulan el incentivo del mes solo de esa persona (la regla grupal de arriba sigue afectando a todos). Se marca en tu fila del ERP con su motivo.'
    dato(false); doc.setFontSize(PT(3.2))
    const l1 = doc.splitTextToSize(txtMuerte, bw - 6.8)
    const l2 = doc.splitTextToSize(txtCompaner, bw - 6.8)
    const boxH = 8 + l1.length * 4.55 + 4 + l2.length * 4.55 + 4
    doc.setDrawColor(pal.rojo[0], pal.rojo[1], pal.rojo[2]); doc.setLineWidth(0.55)
    doc.setFillColor(ROJO_SOFT[0], ROJO_SOFT[1], ROJO_SOFT[2])
    doc.roundedRect(bx0, y, bw, boxH, 1.6, 1.6, 'FD')
    titulo(true); doc.setFontSize(PT(4.6)); doc.setTextColor(pal.rojo[0], pal.rojo[1], pal.rojo[2])
    doc.text('!', bx0 + 3.4, y + 5.6)
    doc.text('LA REGLA DE MUERTE', bx0 + 8.4, y + 5.6)
    dato(false); doc.setFontSize(PT(3.2)); doc.setTextColor(...INK)
    let yy = y + 9.6
    doc.text(l1, bx0 + 3.4, yy); yy += l1.length * 4.55 + 2
    doc.setDrawColor(pal.rojo[0], pal.rojo[1], pal.rojo[2]); doc.setLineWidth(0.3)
    doc.line(bx0 + 3.4, yy, bx0 + bw - 3.4, yy)
    yy += 3
    titulo(true); doc.setFontSize(PT(3.6)); doc.setTextColor(pal.rojo[0], pal.rojo[1], pal.rojo[2])
    doc.text('REGLA DE COMPAÑERISMO (INDIVIDUAL)', bx0 + 3.4, yy)
    yy += 3.6
    dato(false); doc.setFontSize(PT(3.2)); doc.setTextColor(...INK)
    doc.text(l2, bx0 + 3.4, yy)
    y += boxH
  }

  doc.setFont(ctx.emb ? 'MOsw' : 'helvetica', 'normal'); doc.setFontSize(PT(2.4)); doc.setTextColor(...INK3)
  doc.text('PÁGINA 1 DE 3', x1, 291, { align: 'right' })

  // ═══════════════════════════ PÁGINA 2 ═══════════════════════════
  doc.addPage()
  y = M0
  const cabeceraSimple = (pag: number) => {
    if (ctx.logo) { try { doc.addImage(ctx.logo, 'JPEG', x0, y, 8, 8) } catch { /* noop */ } }
    titulo(true); doc.setFontSize(PT(2.5)); doc.setTextColor(pal.acc[0], pal.acc[1], pal.acc[2])
    const bw2 = doc.getTextWidth('EQUIPO') + 5.5
    doc.setDrawColor(pal.acc[0], pal.acc[1], pal.acc[2]); doc.setLineWidth(0.3)
    doc.roundedRect(x0 + 10.6, y + 1, bw2, 4.6, 0.3, 0.3, 'S')
    doc.text('EQUIPO', x0 + 10.6 + 2.6, y + 4.1)
    dato(false); doc.setFontSize(PT(2.5)); doc.setTextColor(...INK3)
    doc.text('PLAN DE INCENTIVOS · COCINA', x0 + 10.6 + bw2 + 3.6, y + 4.1)
    doc.text(`SL-EQP-PR-001 · REV. 13 · PÁGINA ${pag} DE 3`, x1, y + 4.1, { align: 'right' })
    y += 6.4
    doc.setDrawColor(pal.acc[0], pal.acc[1], pal.acc[2]); doc.setLineWidth(0.5)
    doc.line(x0, y, x1, y)
    y += 3.4
  }
  cabeceraSimple(2)

  kick('03', `Bloque colectivo — hasta ${eur(colMax)}`)
  {
    dato(false); doc.setFontSize(PT(3.2)); doc.setTextColor(...INK2)
    doc.text('Se gana entre todos o no lo gana nadie: la cámara y el stock son de todos.', x0, y + 3.4)
    y += 6.4
  }

  const filaSimple = (titTxt: string, desc: string, pago: string) => {
    dato(false); doc.setFontSize(PT(3)); const lines = doc.splitTextToSize(desc, W - 34)
    const h = Math.max(12, 5 + lines.length * 4.1)
    doc.setDrawColor(...RULE2); doc.setLineWidth(0.3); doc.roundedRect(x0, y, W, h, 1.6, 1.6, 'S')
    titulo(true); doc.setFontSize(PT(3.4)); doc.setTextColor(...INK)
    doc.text(titTxt, x0 + 3.2, y + 5)
    dato(false); doc.setFontSize(PT(3)); doc.setTextColor(...INK2)
    doc.text(lines, x0 + 3.2, y + 9)
    titulo(true); doc.setFontSize(PT(3.4)); doc.setTextColor(pal.verde[0], pal.verde[1], pal.verde[2])
    doc.text(pago, x1 - 3, y + h / 2 + 1.2, { align: 'right' })
    y += h + 2.4
  }
  filaSimple('A · Entregas a tiempo y tiempo de preparación',
    'El concepto de más peso. Sin retrasos al rider ni pedidos demorados: tiempo de preparación cumplido y "listo" marcado cuando la comida está de verdad. Se mide con los datos de Glovo (pedidos demorados, tiempo de preparación) y Uber Eats.',
    eur(cfg.retrasos_eur))

  // Caja B · Reembolsos
  {
    const pReemb = `Un reembolso es cuando un cliente reclama y la plataforma le devuelve el dinero (falta un artículo, pedido equivocado, comida en mal estado, personalización no respetada). Cuesta dos veces: el importe devuelto y un cliente que no vuelve. Por eso el objetivo es cero. Se mide sumando en euros todos los reembolsos del mes, cruzando los datos oficiales de las plataformas con el módulo de reembolsos del ERP.`
    const pFoto = 'Hay que fotografiar todos los pedidos antes de cerrarlos: en modo IA, con el ticket claramente visible y todos los productos a la vista. Es lo que permite a la empresa reclamar el reembolso a la plataforma.'
    dato(false); doc.setFontSize(PT(3))
    const lR = doc.splitTextToSize(pReemb, W - 6.4)
    const lF = doc.splitTextToSize(pFoto, W - 12.8)
    const hFotoBox = 5 + lF.length * 4.1 + 4.6
    const hCards = 12
    const hBox = 8 + lR.length * 4.1 + 3 + hFotoBox + 3 + 4 + hCards + 4.5
    doc.setDrawColor(...RULE2); doc.setLineWidth(0.3); doc.roundedRect(x0, y, W, hBox, 1.6, 1.6, 'S')
    let yy = y + 5.4
    titulo(true); doc.setFontSize(PT(3.4)); doc.setTextColor(...INK)
    doc.text('B · Reembolsos del mes', x0 + 3.2, yy)
    doc.setTextColor(pal.verde[0], pal.verde[1], pal.verde[2])
    doc.text(`hasta ${eur(n(cfg.reemb_eur1) + n(cfg.reemb_cero_extra))}`, x1 - 3.2, yy, { align: 'right' })
    yy += 4.6
    dato(false); doc.setFontSize(PT(3)); doc.setTextColor(...INK2)
    doc.text(lR, x0 + 3.2, yy); yy += lR.length * 4.1 + 2.6
    // subcaja foto
    doc.setDrawColor(pal.acc[0], pal.acc[1], pal.acc[2]); doc.setLineWidth(0.4)
    doc.setFillColor(THEAD[0], THEAD[1], THEAD[2])
    doc.roundedRect(x0 + 3.2, yy, W - 6.4, hFotoBox, 1.6, 1.6, 'FD')
    titulo(true); doc.setFontSize(PT(3)); doc.setTextColor(pal.acc[0], pal.acc[1], pal.acc[2])
    doc.text('LA REGLA DE LA FOTO', x0 + 6, yy + 4)
    dato(false); doc.setFontSize(PT(2.9)); doc.setTextColor(...INK2)
    doc.text(lF, x0 + 6, yy + 7.6)
    const yFotoCols = yy + 4 + lF.length * 4.05 + 2.2
    titulo(true); doc.setFontSize(PT(3.4)); doc.setTextColor(pal.verde[0], pal.verde[1], pal.verde[2])
    doc.text('CON foto', x0 + 6, yFotoCols)
    dato(false); doc.setFontSize(PT(2.8)); doc.setTextColor(...INK2)
    doc.text(doc.splitTextToSize('el reembolso cuenta su importe tal cual (× 1).', (W - 12.8) / 2 - 18), x0 + 6 + doc.getTextWidth('CON foto ') + 12, yFotoCols)
    titulo(true); doc.setFontSize(PT(3.4)); doc.setTextColor(pal.rojo[0], pal.rojo[1], pal.rojo[2])
    doc.text('SIN foto', x0 + 6 + (W - 12.8) / 2, yFotoCols)
    dato(false); doc.setFontSize(PT(2.8)); doc.setTextColor(...INK2)
    doc.text(doc.splitTextToSize('ese importe cuenta el doble (× 2) al sumar los reembolsos.', (W - 12.8) / 2 - 18), x0 + 6 + (W - 12.8) / 2 + doc.getTextWidth('SIN foto ') + 12, yFotoCols)
    yy += hFotoBox + 3
    titulo(false); doc.setFontSize(PT(2.5)); doc.setTextColor(...INK3)
    doc.text('SEGÚN EL TOTAL DE REEMBOLSOS DEL MES COBRAS:', x0 + 3.2, yy)
    yy += 2.6
    const reembolsos: Array<[string, string, M.RGB]> = [
      ['0 € (cero)', eur(n(cfg.reemb_eur1) + n(cfg.reemb_cero_extra)), pal.verde],
      [`Hasta ${eur(cfg.reemb_lim1)}`, eur(cfg.reemb_eur1), pal.acc],
      [`${eur(cfg.reemb_lim1)} – ${eur(cfg.reemb_lim2)}`, eur(cfg.reemb_eur2), MARRON],
      [`Más de ${eur(cfg.reemb_lim2)}`, '0 €', pal.rojo],
    ]
    const gapC = 2, wC = (W - 6.4 - gapC * 3) / 4
    reembolsos.forEach(([rango, pago, col], i) => {
      const xx = x0 + 3.2 + i * (wC + gapC)
      doc.setDrawColor(...RULE); doc.setLineWidth(0.3); doc.roundedRect(xx, yy, wC, hCards, 1.2, 1.2, 'S')
      doc.setDrawColor(col[0], col[1], col[2]); doc.setLineWidth(1); doc.line(xx, yy, xx, yy + hCards)
      titulo(true); doc.setFontSize(PT(2.7)); doc.setTextColor(...INK)
      doc.text(rango, xx + 2, yy + 4.2)
      titulo(true); doc.setFontSize(PT(4.4)); doc.setTextColor(col[0], col[1], col[2])
      doc.text(pago, xx + 2, yy + 9.3)
    })
    yy += hCards + 3
    dato(false); doc.setFontSize(PT(2.8)); doc.setTextColor(...INK3)
    doc.text(`${eur(0)} de reembolsos = ${eur(cfg.reemb_eur1)} del bloque + ${eur(cfg.reemb_cero_extra)} de premio a la excelencia.`, x0 + 3.2, yy)
    y += hBox + 2.4
  }

  filaSimple('C · Inventario permanente',
    `Siempre al día y cuadrado. Se realizarán comprobaciones aleatorias durante la semana: recuento físico contra el ERP y contra el documento de congeladores y cámaras. Se cobra si el descuadre es como máximo el ${n(cfg.inventario_tolerancia_pct)}% del valor contado: el descuadre normal de cocina se tolera; el de verdad, no.`,
    eur(cfg.inventario_eur))
  filaSimple('D · Valoración de clientes',
    'La nota media en plataformas se mantiene o mejora respecto al mes anterior. Cada tienda parte de su nota; el objetivo es subir o mantener ≥ 4,5.',
    eur(cfg.valoracion_eur))

  {
    const p3 = 'Entregar a tiempo y tener buena nota son las palancas que hacen que los algoritmos nos den más pedidos → más facturación → multiplicador más alto. Es un círculo: cuidar al cliente os paga dos veces.'
    dato(false); doc.setFontSize(PT(2.9)); doc.setTextColor(...INK2)
    const lines = doc.splitTextToSize(p3, W)
    doc.text(lines, x0, y + 3.3)
    y += lines.length * 4.1 + 5
  }

  kick('04', `Bloque individual — hasta ${eur(indMax)}`)
  const individual: Array<[string, string, string]> = [
    ['Procedimiento de vacío de cámara', `El procedimiento de vacío (ordenar la cámara según el método establecido) hecho todas las veces que te tocan por rotación y anotado en el checklist de turno con tu firma.`, eur(cfg.vacio_eur)],
    ['Checklists de turno', 'Apertura, cierre y limpieza completados en el ERP y verificados con la firma de un compañero o superior (doble firma). Sin verificación no puntúa.', eur(cfg.checklist_eur)],
    ['Fechado, conservación y mermas', 'Etiquetado, fechado y conservación correcta, con las mermas siempre presentes en el trabajo diario. Comprobado en revisiones aleatorias de Rubén o Emilio registradas en el ERP.', eur(cfg.fechado_eur)],
  ]
  individual.forEach(([tit, desc, pago]) => {
    dato(false); doc.setFontSize(PT(2.9)); const lines = doc.splitTextToSize(desc, W - 34)
    const h = Math.max(11, 4.5 + lines.length * 3.9)
    doc.setDrawColor(...RULE); doc.setLineWidth(0.3); doc.roundedRect(x0, y, W, h, 1.6, 1.6, 'S')
    doc.setDrawColor(pal.acc[0], pal.acc[1], pal.acc[2]); doc.setLineWidth(1); doc.line(x0, y, x0, y + h)
    titulo(true); doc.setFontSize(PT(3.3)); doc.setTextColor(...INK)
    doc.text(tit.toUpperCase(), x0 + 3.6, y + 4.6)
    dato(false); doc.setFontSize(PT(2.9)); doc.setTextColor(...INK2)
    doc.text(lines, x0 + 3.6, y + 8.4)
    titulo(true); doc.setFontSize(PT(4.6)); doc.setTextColor(pal.verde[0], pal.verde[1], pal.verde[2])
    doc.text(pago, x1 - 3.2, y + h / 2 + 1.4, { align: 'right' })
    y += h + 2
  })

  doc.setFont(ctx.emb ? 'MOsw' : 'helvetica', 'normal'); doc.setFontSize(PT(2.4)); doc.setTextColor(...INK3)
  doc.text('PÁGINA 2 DE 3', x1, 291, { align: 'right' })

  // ═══════════════════════════ PÁGINA 3 ═══════════════════════════
  doc.addPage()
  y = M0
  cabeceraSimple(3)

  // Penalizaciones (caja roja sin fill)
  {
    const pPunt = 'Solo eres puntual si, a la hora que marca tu cuadrante, estás con el uniforme puesto, manos lavadas, listo para trabajar y has fichado en la aplicación de control de presencia. Fichar a las 12:00 y cambiarse después es llegar tarde.'
    dato(false); doc.setFontSize(PT(3))
    const lP = doc.splitTextToSize(pPunt, W - 6.4)
    const hCards = 20
    const hBox = 6 + lP.length * 4.1 + 3 + hCards + 5
    doc.setDrawColor(pal.rojo[0], pal.rojo[1], pal.rojo[2]); doc.setLineWidth(0.45)
    doc.roundedRect(x0, y, W, hBox, 1.6, 1.6, 'S')
    titulo(true); doc.setFontSize(PT(3.8)); doc.setTextColor(pal.rojo[0], pal.rojo[1], pal.rojo[2])
    doc.text('PENALIZACIONES POR PUNTUALIDAD', x0 + 3.2, y + 5.4)
    dato(false); doc.setFontSize(PT(3)); doc.setTextColor(...INK2)
    doc.text(lP, x0 + 3.2, y + 9.4)
    const yc = y + 9.4 + lP.length * 4.1 + 2.6
    const gapP = 2.4, wP = (W - 6.4 - gapP * 2) / 3
    const cardPen = (xx: number, label: string, cifra: string, sub: string, col: M.RGB, soft?: M.RGB) => {
      doc.setDrawColor(col[0], col[1], col[2]); doc.setLineWidth(0.35)
      if (soft) { doc.setFillColor(soft[0], soft[1], soft[2]); doc.roundedRect(xx, yc, wP, hCards, 1.2, 1.2, 'FD') }
      else doc.roundedRect(xx, yc, wP, hCards, 1.2, 1.2, 'S')
      titulo(false); doc.setFontSize(PT(2.6)); doc.setTextColor(col[0], col[1], col[2])
      doc.text(doc.splitTextToSize(label.toUpperCase(), wP - 4), xx + 2, yc + 3.6)
      titulo(true); doc.setFontSize(PT(4.4)); doc.setTextColor(col[0], col[1], col[2])
      doc.text(cifra, xx + 2, yc + 8.8)
      dato(false); doc.setFontSize(PT(2.7)); doc.setTextColor(...INK2)
      doc.text(doc.splitTextToSize(sub, wP - 4), xx + 2, yc + 12.2)
    }
    cardPen(x0 + 3.2, 'A partir de la 3ª llegada tarde/mes', `−${eur(cfg.pen_tarde)} por llegada tarde`, `Se permiten ${n(cfg.tardes_permitidas)} llegadas tarde al mes sin consecuencia.`, pal.rojo)
    cardPen(x0 + 3.2 + wP + gapP, 'Tarde en la apertura de un turno', `−${eur(cfg.pen_apertura)} cada vez`, 'Si abres tú y llegas tarde, la cocina está cerrada: pueden entrar pedidos y no hay nadie. Penalización máxima.', pal.rojo)
    cardPen(x0 + 3.2 + (wP + gapP) * 2, 'Bonus de constancia', `+${eur(cfg.bonus_constancia)}`, `${n(cfg.bonus_meses)} meses seguidos cobrando el 100% de tu incentivo (todos los objetivos cumplidos y sin penalizaciones) → +${eur(cfg.bonus_constancia)} el ${n(cfg.bonus_meses)}er mes.`, pal.verde, VERDE_SOFT)
    y += hBox + 5
  }

  kick('05', 'Ejemplos de cobro')
  {
    const cols = [W - 52 - 24, 52, 24]
    const heads = ['ESCENARIO DEL MES', 'CÁLCULO', 'COBRA']
    doc.setDrawColor(...RULE2); doc.setLineWidth(0.3)
    doc.setFillColor(THEAD[0], THEAD[1], THEAD[2])
    doc.rect(x0, y, W, 5.5, 'F')
    doc.setDrawColor(pal.acc[0], pal.acc[1], pal.acc[2]); doc.setLineWidth(0.55)
    doc.line(x0, y + 5.5, x1, y + 5.5)
    titulo(true); doc.setFontSize(PT(2.8)); doc.setTextColor(...INK)
    let xx = x0
    heads.forEach((h, i) => { doc.text(h, i === 2 ? xx + cols[i] - 2.4 : xx + 2.4, y + 3.7, i === 2 ? { align: 'right' } : undefined); xx += cols[i] })
    y += 5.5
    type Ej = [string, string, string, M.RGB, M.RGB]
    const ejemplos: Ej[] = [
      [`Mes perfecto, facturación +${miles(cfg.fact_t3)}`, `(${colMax} + ${indMax}) × ${n(cfg.mult_n3)} = ${((colMax + indMax) * n(cfg.mult_n3)).toFixed(0)}`, eur(cfg.tope_total), pal.verde, BLANCO],
      [`Mes bueno a ${((n(cfg.fact_t2) + n(cfg.fact_t3)) / 2 / 1000).toFixed(0)}.000 €, ${eur(cfg.reemb_eur1)} de reembolsos, resto bien`, `(${n(cfg.retrasos_eur)} + ${n(cfg.reemb_eur1)} + ${n(cfg.inventario_eur)} + ${n(cfg.valoracion_eur)} + ${indMax}) × ${n(cfg.mult_n2)}`, eur((n(cfg.retrasos_eur) + n(cfg.reemb_eur1) + n(cfg.inventario_eur) + n(cfg.valoracion_eur) + indMax) * n(cfg.mult_n2)), INK, ZEBRA],
      [`Mes a ${(n(cfg.fact_min) / 1000 + 1).toFixed(0)}.000 €, reembolsos ${eur(cfg.reemb_lim2)}, valoración baja, un retraso de entrega`, `(0 + ${n(cfg.reemb_eur2)} + ${n(cfg.inventario_eur)} + 0 + ${indMax}) × ${n(cfg.mult_n1)}`, eur((n(cfg.reemb_eur2) + n(cfg.inventario_eur) + indMax) * n(cfg.mult_n1)), INK, BLANCO],
      ['Cualquier mes con una cancelación de pedido', 'Regla de muerte', '0 € todos', pal.rojo, ZEBRA],
      ['Falta de respeto grave o dejar tirado al equipo', 'Regla de compañerismo', '0 € esa persona', pal.rojo, BLANCO],
    ]
    ejemplos.forEach(([caso, calc, total, col, bg]) => {
      dato(false); doc.setFontSize(PT(3))
      const lc = doc.splitTextToSize(caso, cols[0] - 4.8)
      const h = Math.max(6, 2 + lc.length * 3.6)
      doc.setFillColor(bg[0], bg[1], bg[2]); doc.rect(x0, y, W, h, 'F')
      doc.setDrawColor(...RULE); doc.setLineWidth(0.25); doc.line(x0, y, x1, y)
      doc.setTextColor(...INK)
      doc.text(lc, x0 + 2.4, y + 3.4)
      titulo(false); doc.setFontSize(PT(3)); doc.setTextColor(...INK2)
      doc.text(doc.splitTextToSize(calc, cols[1] - 4.8), x0 + cols[0] + 2.4, y + 3.4)
      titulo(true); doc.setFontSize(PT(4)); doc.setTextColor(col[0], col[1], col[2])
      doc.text(total, x1 - 2.4, y + 3.4, { align: 'right' })
      y += h
    })
    doc.setDrawColor(...RULE2); doc.setLineWidth(0.3); doc.line(x0, y, x1, y)
    y += 5
  }

  kick('06', 'Cómo se comprueba todo')
  {
    const p4 = 'Nada es subjetivo: todo sale de datos reales del ERP y de las plataformas. Ves tu incentivo del mes en tu Portal del ERP (pestaña «Mis incentivos»), actualizado al momento: no te enteras a final de mes, lo ves crecer cada día.'
    dato(false); doc.setFontSize(PT(3.2)); doc.setTextColor(...INK2)
    const lines = doc.splitTextToSize(p4, W)
    doc.text(lines, x0, y + 3.4)
    y += lines.length * 4.55 + 2.6
  }
  {
    const c0 = 42, c2 = 44, c1 = W - c0 - c2
    doc.setFillColor(THEAD[0], THEAD[1], THEAD[2]); doc.rect(x0, y, W, 5.2, 'F')
    doc.setDrawColor(pal.acc[0], pal.acc[1], pal.acc[2]); doc.setLineWidth(0.55)
    doc.line(x0, y + 5.2, x1, y + 5.2)
    titulo(true); doc.setFontSize(PT(2.8)); doc.setTextColor(...INK)
    doc.text('CONCEPTO', x0 + 2.4, y + 3.5)
    doc.text('FUENTE DE DATOS', x0 + c0 + 2.4, y + 3.5)
    doc.text('QUIÉN LO VE', x0 + c0 + c1 + 2.4, y + 3.5)
    y += 5.2
    const comprobacion: Array<[string, string, string]> = [
      ['Facturación', 'Ventas del ERP (plataformas + web)', 'Todos, en tiempo real en el ERP'],
      ['Cancelaciones / cierres', 'Informes oficiales Uber Eats / Glovo / Just Eat, cada 20 min', 'En el ERP'],
      ['Reembolsos', 'Plataformas + módulo de reembolsos del ERP', 'En el ERP'],
      ['Entregas a tiempo', 'Informes Glovo (pedidos demorados, tiempo de preparación) y Uber Eats', 'En el ERP'],
      ['Valoración de clientes', 'Nota por tienda en Glovo y Uber Eats', 'En el ERP'],
      ['Inventario permanente', 'ERP + comprobaciones aleatorias semanales', 'Resultado en el ERP'],
      ['Vacío de cámara', 'Anotado en el checklist de turno', 'Cada uno en su pantalla del ERP'],
      ['Checklists', 'ERP con doble firma', 'Cada uno en su pantalla del ERP'],
      ['Fechado / conservación', 'Revisiones registradas en el ERP', 'Cada uno en su pantalla del ERP'],
      ['Puntualidad', 'Control de presencia del ERP', 'Cada uno en su pantalla del ERP'],
      ['Compañerismo', 'Incidencias registradas por el responsable, con su motivo', 'Cada uno en su fila del ERP'],
    ]
    comprobacion.forEach(([conc, fuente, quien], i) => {
      dato(false); doc.setFontSize(PT(2.9))
      const lf = doc.splitTextToSize(fuente, c1 - 4.8)
      const h = Math.max(5.2, 1.6 + lf.length * 3.6)
      doc.setFillColor(...(i % 2 === 1 ? ZEBRA : BLANCO)); doc.rect(x0, y, W, h, 'F')
      doc.setDrawColor(...RULE); doc.setLineWidth(0.25); doc.line(x0, y, x1, y)
      titulo(true); doc.setFontSize(PT(2.9)); doc.setTextColor(...INK)
      doc.text(conc.toUpperCase(), x0 + 2.4, y + 3.4)
      dato(false); doc.setFontSize(PT(2.9)); doc.setTextColor(...INK2)
      doc.text(lf, x0 + c0 + 2.4, y + 3.4)
      doc.text(doc.splitTextToSize(quien, c2 - 4.8), x0 + c0 + c1 + 2.4, y + 3.4)
      y += h
    })
    doc.setDrawColor(...RULE2); doc.setLineWidth(0.3); doc.line(x0, y, x1, y)
    y += 5
  }
  {
    const p5 = 'El plan de incentivos está diseñado para conseguir unas métricas concretas del negocio, así que puede modificarse. Cualquier cambio se avisa siempre con antelación al periodo en el que empieza a aplicar: nunca cambian las reglas de un mes ya en marcha.'
    const p6 = 'Documento personal e intransferible. Este plan te lo entregamos a ti: no lo compartas con el resto de compañeros. Cada persona tiene sus propios acuerdos y condiciones, y además nos obliga la protección de datos.'
    dato(false); doc.setFontSize(PT(2.9)); doc.setTextColor(...INK2)
    const l5 = doc.splitTextToSize(p5, W)
    doc.text(l5, x0, y + 3.3)
    y += l5.length * 4.1 + 2.2
    const l6 = doc.splitTextToSize(p6, W)
    doc.text(l6, x0, y + 3.3)
  }

  doc.setFont(ctx.emb ? 'MOsw' : 'helvetica', 'normal'); doc.setFontSize(PT(2.4)); doc.setTextColor(...INK3)
  doc.text('PÁGINA 3 DE 3', x1, 291, { align: 'right' })

  void TOTAL_PAGS
  return doc
}
