/**
 * planIncentivosPdf.ts — "Plan de Incentivos de Cocina" (SL-EQP-PR-001)
 * Documento imprimible del marco (área Equipo). Texto aprobado por Rubén (rev. 13),
 * con TODOS los importes leídos de incentivos_config: si la config cambia, el
 * documento impreso cambia solo. Cláusulas fijas: personal e intransferible +
 * los cambios se avisan antes del mes en que aplican.
 */
import * as M from '@/lib/marcoDoc'

type Cfg = Record<string, number | string | null>

const AREA: M.Area = 'equipo'
const n = (v: unknown) => Number(v ?? 0)
const eur = (v: unknown) => `${Math.round(n(v))} €`
const miles = (v: unknown) => n(v).toLocaleString('es-ES') + ' €'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export function construirPlanIncentivosPDF(cfg: Cfg, rec: M.Recursos, opts: { bn?: boolean; para?: string; mes?: number; anio?: number } = {}) {
  const bn = !!opts.bn
  const now = new Date()
  const mesTxt = `${MESES[(opts.mes ?? now.getMonth() + 1) - 1]} ${opts.anio ?? now.getFullYear()}`
  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)
  const TOTAL_PAGS = 3

  const colMax = n(cfg.retrasos_eur) + n(cfg.reemb_eur1) + n(cfg.reemb_cero_extra) + n(cfg.inventario_eur) + n(cfg.valoracion_eur)
  const indMax = n(cfg.vacio_eur) + n(cfg.checklist_eur) + n(cfg.fechado_eur)

  let y = 0

  const cabecera = () => {
    y = M.pintarCabecera(doc, ctx, {
      docNombre: 'Plan de Incentivos · Cocina',
      meta: `SL-EQP-PR-001 · ${mesTxt}`,
      tituloCentrado: 'PLAN DE INCENTIVOS',
      area: AREA, bn,
    })
  }

  const titulo = (num: string, txt: string) => {
    M.fTitulo(doc, ctx, true); doc.setFontSize(12)
    doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.text(num, cb.x0, y)
    doc.setTextColor(...M.TINTA)
    doc.text(txt, cb.x0 + 10, y)
    y += 2
    doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.5)
    doc.line(cb.x0, y, cb.x1, y)
    y += 6
  }

  const parrafo = (txt: string, size = 9, gap = 4) => {
    M.fDato(doc, ctx, false); doc.setFontSize(size); doc.setTextColor(...M.TINTA)
    const lines = doc.splitTextToSize(txt, cb.w)
    doc.text(lines, cb.x0, y)
    y += lines.length * (size * 0.42) + gap
  }

  const caja = (tituloTxt: string, cuerpo: string, importe?: string, alto?: number) => {
    const lines = doc.splitTextToSize(cuerpo, cb.w - (importe ? 28 : 8))
    const h = alto ?? Math.max(14, 9 + lines.length * 3.8)
    M.tarjeta(doc, cb.x0, y, cb.w, h, AREA, { bn })
    M.fTitulo(doc, ctx, true); doc.setFontSize(9); doc.setTextColor(...M.TINTA)
    doc.text(tituloTxt.toUpperCase(), cb.x0 + 4, y + 6)
    if (importe) {
      doc.setFontSize(12); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
      doc.text(importe, cb.x1 - 4, y + 7, { align: 'right' })
    }
    M.fDato(doc, ctx, false); doc.setFontSize(8.2); doc.setTextColor(...M.TINTA)
    doc.text(lines, cb.x0 + 4, y + 11)
    y += h + 4
  }

  const filaTramos = (tramos: Array<[string, string, string]>) => {
    const w = (cb.w - 3 * 4) / 4
    tramos.forEach(([eti, cifra, sub], i) => {
      const x = cb.x0 + i * (w + 4)
      M.tarjeta(doc, x, y, w, 22, AREA, { bn })
      M.fDato(doc, ctx, false); doc.setFontSize(6.5); doc.setTextColor(...M.GRIS)
      doc.text(eti.toUpperCase(), x + 3, y + 5)
      M.fTitulo(doc, ctx, true); doc.setFontSize(10.5); doc.setTextColor(...M.TINTA)
      doc.text(cifra, x + 3, y + 11.5)
      M.fDato(doc, ctx, false); doc.setFontSize(6.6); doc.setTextColor(...M.TINTA)
      doc.text(doc.splitTextToSize(sub, w - 6), x + 3, y + 15.5)
    })
    y += 26
  }

  // ─────────────────────────── PÁGINA 1 ───────────────────────────
  cabecera()

  M.fDato(doc, ctx, false); doc.setFontSize(9.5); doc.setTextColor(...M.TINTA)
  doc.text('Este dinero es tuyo. Solo hay que hacer bien el trabajo de cada día.', cb.x0, y)
  y += 7

  // Para + cuándo se paga
  M.tarjeta(doc, cb.x0, y, cb.w * 0.46, 16, AREA, { bn })
  M.fDato(doc, ctx, false); doc.setFontSize(7); doc.setTextColor(...M.GRIS)
  doc.text('PARA', cb.x0 + 4, y + 6)
  M.fDato(doc, ctx, true); doc.setFontSize(11); doc.setTextColor(...M.TINTA)
  doc.text(opts.para ?? '', cb.x0 + 16, y + 10.5)
  if (!opts.para) { doc.setDrawColor(...M.GRIS); doc.setLineWidth(0.2); doc.line(cb.x0 + 16, y + 11.5, cb.x0 + cb.w * 0.46 - 4, y + 11.5) }
  M.tarjeta(doc, cb.x0 + cb.w * 0.5, y, cb.w * 0.5, 16, AREA, { bn, fill: true })
  M.fTitulo(doc, ctx, true); doc.setFontSize(7); doc.setTextColor(...M.TINTA)
  doc.text('CUÁNDO SE PAGA', cb.x0 + cb.w * 0.5 + 4, y + 5.5)
  M.fDato(doc, ctx, false); doc.setFontSize(7.6)
  doc.text(doc.splitTextToSize('El incentivo del mes natural se abona con la nómina del mes siguiente.', cb.w * 0.5 - 8), cb.x0 + cb.w * 0.5 + 4, y + 9.5)
  y += 21

  // Hero 250 + resumen bloques
  M.tarjeta(doc, cb.x0, y, cb.w * 0.4, 40, AREA, { bn, fill: true })
  M.fTitulo(doc, ctx, true); doc.setFontSize(7.5); doc.setTextColor(...M.TINTA)
  doc.text('PUEDES GANAR HASTA', cb.x0 + 5, y + 7)
  doc.setFontSize(30); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
  doc.text(eur(cfg.tope_total), cb.x0 + 5, y + 22)
  M.fDato(doc, ctx, false); doc.setFontSize(7.2); doc.setTextColor(...M.TINTA)
  doc.text(doc.splitTextToSize('Extra al mes, por persona. Todo lo que puntúa ya deberías hacerlo; ahora, además, se paga.', cb.w * 0.4 - 10), cb.x0 + 5, y + 28)

  const xr = cb.x0 + cb.w * 0.44
  const wr = cb.w * 0.56
  const bloque = (yy: number, cifra: string, tituloB: string, sub: string) => {
    M.tarjeta(doc, xr, yy, wr, 12, AREA, { bn })
    M.fTitulo(doc, ctx, true); doc.setFontSize(11); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.text(cifra, xr + 4, yy + 8)
    doc.setFontSize(7.5); doc.setTextColor(...M.TINTA)
    doc.text(tituloB, xr + 26, yy + 5)
    M.fDato(doc, ctx, false); doc.setFontSize(6.6)
    doc.text(doc.splitTextToSize(sub, wr - 30), xr + 26, yy + 8.5)
  }
  bloque(y, eur(colMax), 'BLOQUE COLECTIVO', `Entregas a tiempo (${n(cfg.retrasos_eur)}) + reembolsos (${n(cfg.reemb_eur1) + n(cfg.reemb_cero_extra)}) + inventario (${n(cfg.inventario_eur)}) + valoración (${n(cfg.valoracion_eur)}). Todo el equipo, o nadie.`)
  bloque(y + 14, eur(indMax), 'BLOQUE INDIVIDUAL', `Vacío de cámara (${n(cfg.vacio_eur)}) + checklists (${n(cfg.checklist_eur)}) + fechado (${n(cfg.fechado_eur)}). Cada uno lo suyo.`)
  bloque(y + 28, `×${n(cfg.mult_n3)}`, 'MULTIPLICADOR', `Con +${miles(cfg.fact_t3)} de facturación todo se multiplica ×${n(cfg.mult_n3)}. El tope de ${eur(cfg.tope_total)} está a tu alcance por más de un camino.`)
  y += 46

  titulo('01', 'EL CANDADO DE FACTURACIÓN')
  parrafo(`Si la cocina no llega a ${miles(cfg.fact_min)} brutos en el mes, no hay incentivos: por debajo de esa cifra el negocio no cubre gastos y no hay dinero que repartir. A partir de ahí, cuanto más se factura, más se multiplica todo lo ganado. Objetivo diario de referencia: 900–1.000 € al día (alrededor de 40–60 pedidos diarios).`)
  filaTramos([
    ['Por debajo', `< ${miles(cfg.fact_min)}`, 'No hay incentivos. El negocio no cubre gastos.'],
    [`Abre · ×${n(cfg.mult_n1)}`, `${n(cfg.fact_min) / 1000}–${n(cfg.fact_t2) / 1000} mil €`, 'Se cobra tal cual lo ganado.'],
    [`Sube · ×${n(cfg.mult_n2)}`, `${n(cfg.fact_t2) / 1000}–${n(cfg.fact_t3) / 1000} mil €`, `Todo lo ganado ×${n(cfg.mult_n2)}.`],
    [`Completo · ×${n(cfg.mult_n3)}`, `+${miles(cfg.fact_t3)}`, `Todo ×${n(cfg.mult_n3)}. Aquí se alcanza el tope.`],
  ])
  parrafo('Tu trabajo diario ES la facturación: servir rápido, sin errores, sin reembolsos y con la tienda siempre operativa. Las plataformas premian eso con mejor posición y más pedidos.', 8.5)

  titulo('02', 'LAS REGLAS DE MUERTE')
  caja('¡ La regla de muerte (grupal)',
    `Un solo pedido cancelado o sin aceptar por la cocina, o un cierre de tienda en horario de apertura, deja el incentivo del mes a 0 € PARA TODOS. Es lo que más castigan los algoritmos de Uber Eats, Glovo y Just Eat: una cancelación hunde la visibilidad de la tienda durante semanas y nos quita pedidos a todos. Se comprueba con los informes oficiales de las plataformas a través del ERP ("pedidos no completados").`)
  caja('Regla de compañerismo (individual)',
    `Cuidamos al equipo igual que cuidamos al cliente. Faltas de respeto a compañeros, incidentes graves de actitud o dejar tirado al equipo anulan el incentivo del mes solo de esa persona (la regla grupal de arriba sigue afectando a todos). Se registra en el ERP con su motivo.`)

  M.pintarPaginado(doc, 1, TOTAL_PAGS, ctx)

  // ─────────────────────────── PÁGINA 2 ───────────────────────────
  doc.addPage()
  cabecera()

  titulo('03', `BLOQUE COLECTIVO — HASTA ${eur(colMax)}`)
  parrafo('Se gana entre todos o no lo gana nadie: la cámara, el stock y el cliente son de todos.', 8.5, 3)
  caja('A · Entregas a tiempo y tiempo de preparación',
    `El concepto de más peso. Sin retrasos al rider ni pedidos demorados: tiempo de preparación cumplido y "listo" marcado cuando la comida está de verdad. Se mide con los datos de Glovo (pedidos demorados, tiempo de preparación) y Uber Eats.`,
    eur(cfg.retrasos_eur))
  caja('B · Reembolsos del mes',
    `Un reembolso es cuando un cliente reclama y la plataforma le devuelve el dinero (falta un artículo, pedido equivocado, comida en mal estado, personalización no respetada). Cuesta dos veces: el importe devuelto Y un cliente que no vuelve. Por eso el objetivo es CERO. Se mide sumando en euros todos los reembolsos del mes, cruzando los datos oficiales de las plataformas con el módulo de reembolsos del ERP.\n\nLA REGLA DE LA FOTO: hay que fotografiar todos los pedidos antes de cerrarlos, con el ticket claramente visible y todos los productos a la vista. Es lo que permite a la empresa reclamar el reembolso. CON foto, el reembolso cuenta su importe tal cual (×1). SIN foto, ese importe cuenta el doble (×2) al sumar.`,
    `hasta ${eur(n(cfg.reemb_eur1) + n(cfg.reemb_cero_extra))}`)
  filaTramos([
    ['0 € (cero)', eur(n(cfg.reemb_eur1) + n(cfg.reemb_cero_extra)), `${eur(cfg.reemb_eur1)} del bloque + ${eur(cfg.reemb_cero_extra)} de premio a la excelencia.`],
    [`Hasta ${eur(cfg.reemb_lim1)}`, eur(cfg.reemb_eur1), 'Tramo bueno.'],
    [`${n(cfg.reemb_lim1)} – ${eur(cfg.reemb_lim2)}`, eur(cfg.reemb_eur2), 'Tramo tolerable.'],
    [`Más de ${eur(cfg.reemb_lim2)}`, '0 €', 'Fuera de tramos.'],
  ])
  caja('C · Inventario permanente',
    `Siempre al día y cuadrado. Se realizarán comprobaciones aleatorias durante la semana: recuento físico contra el ERP y contra el documento de congeladores y cámaras. Se cobra si el descuadre es como máximo el ${n(cfg.inventario_tolerancia_pct)}% del valor contado: el descuadre normal de cocina se tolera; el de verdad, no.`,
    eur(cfg.inventario_eur))
  caja('D · Valoración de clientes',
    'La nota media en plataformas se mantiene o mejora respecto al mes anterior. Cada tienda parte de su nota; el objetivo es subir o mantener ≥ 4,5.',
    eur(cfg.valoracion_eur))
  parrafo('Entregar a tiempo y tener buena nota son las palancas que hacen que los algoritmos nos den más pedidos → más facturación → multiplicador más alto. Es un círculo: cuidar al cliente os paga dos veces.', 8.5)

  titulo('04', `BLOQUE INDIVIDUAL — HASTA ${eur(indMax)}`)
  caja('Procedimiento de vacío de cámara',
    'El procedimiento de vacío (ordenar la cámara según el método establecido) hecho todas las veces que te tocan por rotación y anotado en el checklist de turno con tu firma.',
    eur(cfg.vacio_eur))
  caja('Checklists de turno',
    'Apertura, cierre y limpieza completados en el ERP y verificados con la firma de un compañero o superior (doble firma). Sin verificación no puntúa.',
    eur(cfg.checklist_eur))
  caja('Fechado, conservación y mermas',
    'Etiquetado, fechado y conservación correcta, con las mermas siempre presentes en el trabajo diario. Comprobado en revisiones aleatorias de Rubén o Emilio registradas en el ERP.',
    eur(cfg.fechado_eur))

  M.pintarPaginado(doc, 2, TOTAL_PAGS, ctx)

  // ─────────────────────────── PÁGINA 3 ───────────────────────────
  doc.addPage()
  cabecera()

  caja('Penalizaciones por puntualidad',
    `Solo eres puntual si, a la hora que marca tu cuadrante, estás con el uniforme puesto, manos lavadas, listo para trabajar y has fichado en el control de presencia. Fichar a las 12:00 y cambiarse después ES llegar tarde. Se permiten ${n(cfg.tardes_permitidas)} llegadas tarde al mes sin consecuencia; a partir de la siguiente: −${eur(cfg.pen_tarde)} por llegada tarde. Tarde en la apertura de un turno: −${eur(cfg.pen_apertura)} cada vez (si abres tú y llegas tarde, la cocina está cerrada: pueden entrar pedidos y no hay nadie).`)
  caja('Bonus de constancia',
    `${n(cfg.bonus_meses)} meses seguidos cobrando el 100% de tu incentivo (todos los objetivos cumplidos y sin penalizaciones) → +${eur(cfg.bonus_constancia)} el ${n(cfg.bonus_meses)}º mes.`,
    `+${eur(cfg.bonus_constancia)}`)

  titulo('05', 'EJEMPLOS DE COBRO')
  const ejemplos: Array<[string, string, string]> = [
    [`Mes perfecto, facturación +${miles(cfg.fact_t3)}`, `(${colMax} + ${indMax}) × ${n(cfg.mult_n3)}`, eur(cfg.tope_total)],
    [`Mes bueno a 29.000 €, 30 € de reembolsos, resto bien`, `(${n(cfg.retrasos_eur)} + ${n(cfg.reemb_eur1)} + ${n(cfg.inventario_eur)} + ${n(cfg.valoracion_eur)} + ${indMax}) × ${n(cfg.mult_n2)}`, eur((n(cfg.retrasos_eur) + n(cfg.reemb_eur1) + n(cfg.inventario_eur) + n(cfg.valoracion_eur) + indMax) * n(cfg.mult_n2))],
    ['Mes a 26.000 €, reembolsos 70 €, valoración baja, un retraso', `(0 + ${n(cfg.reemb_eur2)} + ${n(cfg.inventario_eur)} + 0 + ${indMax}) × ${n(cfg.mult_n1)}`, eur((n(cfg.reemb_eur2) + n(cfg.inventario_eur) + indMax) * n(cfg.mult_n1))],
    ['Cualquier mes con una cancelación de pedido', 'Regla de muerte', '0 € todos'],
    ['Falta de respeto grave o dejar tirado al equipo', 'Regla de compañerismo', '0 € esa persona'],
  ]
  for (const [esc, calcTxt, cobra] of ejemplos) {
    M.fDato(doc, ctx, false); doc.setFontSize(8.4); doc.setTextColor(...M.TINTA)
    doc.text(doc.splitTextToSize(esc, cb.w - 70), cb.x0, y + 4)
    doc.setFontSize(7); doc.setTextColor(...M.GRIS)
    doc.text(calcTxt, cb.x0 + cb.w - 66, y + 4)
    doc.setFont(ctx.emb ? 'MBar' : 'helvetica', 'bold'); doc.setFontSize(9)
    doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.text(cobra, cb.x1, y + 4, { align: 'right' })
    y += 8
    M.lineaRelleno(doc, cb.x0, cb.x1, y)
    y += 2
  }
  y += 4

  titulo('06', 'CÓMO SE COMPRUEBA TODO')
  parrafo('Nada es subjetivo: todo sale de datos reales del ERP y de las plataformas. Ves tu incentivo del mes en tu Portal del ERP (pestaña "Mis incentivos"), actualizado al momento: no te enteras a final de mes, lo ves crecer cada día.', 8.5, 3)
  const fuentes: Array<[string, string]> = [
    ['Facturación', 'Ventas del ERP (plataformas + web), en tiempo real'],
    ['Cancelaciones / cierres', 'Informes oficiales Uber Eats / Glovo / Just Eat en el ERP'],
    ['Reembolsos', 'Plataformas + módulo de reembolsos del ERP'],
    ['Entregas a tiempo', 'Informes Glovo (demorados, tiempo de preparación) y Uber Eats'],
    ['Valoración de clientes', 'Nota por tienda en Glovo y Uber Eats'],
    ['Inventario permanente', 'ERP + comprobaciones aleatorias semanales'],
    ['Vacío / checklists / fechado', 'ERP con doble firma y revisiones registradas'],
    ['Puntualidad', 'Control de presencia del ERP'],
    ['Compañerismo', 'Incidencias registradas por el responsable, con su motivo'],
  ]
  for (const [conc, fuente] of fuentes) {
    M.fTitulo(doc, ctx, true); doc.setFontSize(7.4); doc.setTextColor(...M.TINTA)
    doc.text(conc.toUpperCase(), cb.x0, y + 3.5)
    M.fDato(doc, ctx, false); doc.setFontSize(7.8)
    doc.text(doc.splitTextToSize(fuente, cb.w - 62), cb.x0 + 60, y + 3.5)
    y += 6.5
  }
  y += 5

  M.tarjeta(doc, cb.x0, y, cb.w, 22, AREA, { bn, fill: true })
  M.fDato(doc, ctx, false); doc.setFontSize(7.6); doc.setTextColor(...M.TINTA)
  doc.text(doc.splitTextToSize(
    'El plan de incentivos está diseñado para conseguir unas métricas concretas del negocio, así que puede modificarse. Cualquier cambio se avisa siempre con antelación al periodo en el que empieza a aplicar: nunca cambian las reglas de un mes ya en marcha.  ·  DOCUMENTO PERSONAL E INTRANSFERIBLE: este plan te lo entregamos a ti, no lo compartas con el resto de compañeros. Cada persona tiene sus propios acuerdos y condiciones, y además nos obliga la protección de datos.',
    cb.w - 8), cb.x0 + 4, y + 5)

  M.pintarPaginado(doc, 3, TOTAL_PAGS, ctx)
  return doc
}
