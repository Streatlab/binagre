import { useState, useEffect, useMemo } from 'react'
import React from 'react'
import { Download, Plus, Trash2, X, Check, Pencil, FileDown } from 'lucide-react'
import { jsPDF } from 'jspdf'
import * as M from '@/lib/marcoDoc'
import HojaDoc from '@/components/marco/HojaDoc'
import BotonImprimir from '@/components/BotonImprimir'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { GRANATE, BLANCO } from '@/styles/neobrutal'
import { PRINT_BN_BG, PRINT_BN_TXT } from '@/styles/palettes'
import Esquemas from '@/pages/cocina/Esquemas'
import { HeroCantera, PantallaCantera } from '@/components/kit/cantera'
import TabsPastilla from '@/components/ui/TabsPastilla'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type Dia = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
const DIAS: Dia[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const DIAS_LABEL: Record<Dia, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
}
const TOTAL_COLS = 1 + DIAS.length * 2 + 1 // 16

const PAG_CAP = 24
const HEADER_COST = 3

interface CeldaValor { hoy: string; ssp: string }
interface Partida { id: string; seccion_id: string; nombre: string; orden: number; activa: boolean; biberon?: boolean; solo_camara?: boolean }
interface Seccion { id: string; nombre: string; orden: number; activa: boolean }
interface EntradaProduccion { id: string; partida_id: string; semana_iso: string; dia: Dia; hoy: string; ssp: string }
interface BloqueImpresion { sec: Seccion; cont: boolean; parts: Partida[] }
interface InvItem { id: string; ubicacion: string; ord_ubi: number; categoria: string; ord_cat: number; nombre: string; min_seguridad: number | null; ord_item: number }
interface InvCat { nombre: string; items: InvItem[] }
interface InvUbi { nombre: string; cats: InvCat[] }

// ─── UTILS ────────────────────────────────────────────────────────────────────

function getSemanaISO(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getSemanaLabel(iso: string): string {
  const [year, week] = iso.split('-W').map(Number)
  const jan4 = new Date(year, 0, 4)
  const startOfWeek = new Date(jan4.getTime() - (((jan4.getDay() || 7) - 1) * 86400000) + ((week - 1) * 7 * 86400000))
  const endOfWeek = new Date(startOfWeek.getTime() + 6 * 86400000)
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`
  return `Semana ${week} · ${fmt(startOfWeek)}–${fmt(endOfWeek)}`
}

function paginar(secciones: Seccion[], partidas: Partida[]): BloqueImpresion[][] {
  const paginas: BloqueImpresion[][] = []
  let pagina: BloqueImpresion[] = []
  let usado = 0
  const cerrar = () => { if (pagina.length) { paginas.push(pagina); pagina = []; usado = 0 } }
  for (const sec of secciones) {
    const parts = partidas.filter(p => p.seccion_id === sec.id)
    if (parts.length === 0) continue
    if (usado + HEADER_COST + 1 > PAG_CAP) cerrar()
    let bloque: BloqueImpresion = { sec, cont: false, parts: [] }
    pagina.push(bloque); usado += HEADER_COST
    for (const part of parts) {
      if (usado + 1 > PAG_CAP) {
        cerrar()
        bloque = { sec, cont: true, parts: [] }
        pagina.push(bloque); usado += HEADER_COST
      }
      bloque.parts.push(part); usado += 1
    }
  }
  cerrar()
  return paginas
}

// Agrupa por lado físico. Solo izquierda y derecha (lo demás no va en los carteles de cámara).
function agruparLados(secciones: Seccion[]): { titulo: string; secs: Seccion[] }[] {
  const izq = secciones.filter(s => s.nombre.toUpperCase().startsWith('IZQUIERDA'))
  const der = secciones.filter(s => s.nombre.toUpperCase().startsWith('DERECHA'))
  const grupos: { titulo: string; secs: Seccion[] }[] = []
  if (izq.length) grupos.push({ titulo: 'PARTE IZQUIERDA', secs: izq })
  if (der.length) grupos.push({ titulo: 'PARTE DERECHA', secs: der })
  return grupos
}

// Devuelve las filas de una lista de partidas insertando un subencabezado "Biberones:" antes del primer biberón
type FilaItem = { kind: 'sub'; label: string } | { kind: 'part'; part: Partida }
function conBiberones(parts: Partida[]): FilaItem[] {
  const out: FilaItem[] = []
  let metido = false
  for (const p of parts) {
    if (p.biberon && !metido) { out.push({ kind: 'sub', label: 'Biberones:' }); metido = true }
    out.push({ kind: 'part', part: p })
  }
  return out
}

function agruparInventario(items: InvItem[]): InvUbi[] {
  const ubis: InvUbi[] = []
  for (const it of items) {
    let u = ubis.find(x => x.nombre === it.ubicacion)
    if (!u) { u = { nombre: it.ubicacion, cats: [] }; ubis.push(u) }
    let c = u.cats.find(x => x.nombre === it.categoria)
    if (!c) { c = { nombre: it.categoria, items: [] }; u.cats.push(c) }
    c.items.push(it)
  }
  ubis.forEach(u => u.cats.forEach(c => c.items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))))
  return ubis
}

// ─── GENERACIÓN DE PDF REAL — MARCO ÚNICO (src/lib/marcoDoc.ts) ────────────────
// Todos los documentos usan la misma espina + cabecera + logo + paginado + paleta + radio.

const AREA: M.Area = 'cocina'

function construirListaPDF(paginas: BloqueImpresion[][], semanaLabel: string, rec: M.Recursos, bn = false): jsPDF {
  const doc = M.nuevaHoja({ orientation: 'landscape' })
  const ctx = M.preparar(doc, rec)
  const cb = M.contentBox(doc)
  const pal = M.paleta(AREA, bn)
  const rowH = 5.2
  // Columna Producto ajustada al nombre más largo; el resto se reparte entre HOY/SSP.
  M.fDato(doc, ctx, false); doc.setFontSize(11)
  let maxNombreW = 0
  paginas.forEach(bloques => bloques.forEach(b => b.parts.forEach(p => {
    const w = doc.getTextWidth(p.nombre)
    if (w > maxNombreW) maxNombreW = w
  })))
  const wProd = Math.min(Math.max(maxNombreW + 5, 26), 56)
  const wCelda = (cb.w - wProd * 2) / 14
  const xProdDer = cb.x0 + wProd + wCelda * 14

  paginas.forEach((bloques, pi) => {
    if (pi > 0) doc.addPage()
    M.pintarEspina(doc, AREA, ctx, bn)
    let y = M.pintarCabecera(doc, ctx, { docNombre: 'Lista de Producción', meta: semanaLabel, area: AREA, bn })

    bloques.forEach(b => {
      const filas = conBiberones(b.parts)
      const tituloSec = `${b.sec.nombre}${b.cont ? '  ·  (CONTINÚA)' : ''}`
      doc.setFillColor(pal.soft[0], pal.soft[1], pal.soft[2]); doc.rect(cb.x0, y, cb.w, 6, 'F')
      M.fTitulo(doc, ctx, true); doc.setFontSize(9); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
      doc.text(tituloSec, cb.x0 + 2, y + 4)
      doc.text(tituloSec, xProdDer + 2, y + 4)
      y += 6
      doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.rect(cb.x0, y, cb.w, 5, 'F')
      M.fTitulo(doc, ctx, true); doc.setFontSize(7); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
      doc.text('Producto', cb.x0 + 1.5, y + 3.3)
      let x = cb.x0 + wProd
      DIAS.forEach(dia => { doc.text(DIAS_LABEL[dia], x + wCelda, y + 3.3, { align: 'center' }); x += wCelda * 2 })
      doc.text('Producto', xProdDer + 1.5, y + 3.3)
      y += 5
      doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.rect(cb.x0, y, cb.w, 3.6, 'F')
      doc.setFontSize(5.5)
      x = cb.x0 + wProd
      DIAS.forEach(() => { doc.text('HOY', x + wCelda / 2, y + 2.6, { align: 'center' }); doc.text('SSP', x + wCelda + wCelda / 2, y + 2.6, { align: 'center' }); x += wCelda * 2 })
      y += 3.6

      M.fDato(doc, ctx, false)
      let prevBib = false
      filas.forEach(f => {
        if (f.kind === 'sub') {
          doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.rect(cb.x0, y, cb.w, rowH, 'F')
          M.fTitulo(doc, ctx, true); doc.setFontSize(8); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
          doc.text(f.label.toUpperCase(), cb.x0 + 6, y + 3.7)
          doc.text(f.label.toUpperCase(), xProdDer + 6, y + 3.7)
          M.fDato(doc, ctx, false)
          drawColsLines(doc, cb.x0, y, rowH, wProd, wCelda, pal)
          y += rowH
          prevBib = false
          return
        }
        // franja de acento suave al terminar los biberones
        if (prevBib && !f.part.biberon) {
          doc.setFillColor(pal.soft[0], pal.soft[1], pal.soft[2]); doc.rect(cb.x0, y, cb.w, 2.6, 'F')
          y += 2.6
        }
        prevBib = !!f.part.biberon
        x = cb.x0 + wProd
        DIAS.forEach(() => { doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.rect(x + wCelda, y, wCelda, rowH, 'F'); x += wCelda * 2 })
        doc.setTextColor(...M.TINTA)
        M.fitFont(doc, f.part.nombre, wProd - 2.5, 11, 7)
        doc.text(f.part.nombre, cb.x0 + 1.5, y + 3.7)
        doc.text(f.part.nombre, xProdDer + 1.5, y + 3.7)
        doc.setFontSize(11)
        drawColsLines(doc, cb.x0, y, rowH, wProd, wCelda, pal)
        y += rowH
      })
      y += 3
    })
    M.pintarPaginado(doc, pi + 1, paginas.length, ctx)
  })
  return doc
}

// Líneas de columnas: día enmarcado (borde de acento entre días) + separador fino HOY|SSP.
function drawColsLines(doc: jsPDF, x0: number, y: number, rowH: number, wProd: number, wCelda: number, pal: M.Paleta) {
  const totalW = wProd * 2 + wCelda * 14
  doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.1)
  doc.line(x0, y + rowH, x0 + totalW, y + rowH)
  let x = x0
  doc.line(x, y, x, y + rowH); x += wProd
  for (let i = 0; i < 14; i++) {
    if (i % 2 === 0) { doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.5) } // borde de día
    else { doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.1) }                                             // separador HOY|SSP
    doc.line(x, y, x, y + rowH)
    x += wCelda
  }
  doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.5)
  doc.line(x, y, x, y + rowH); x += wProd
  doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.1)
  doc.line(x, y, x, y + rowH)
}

function descargarListaPDF(paginas: BloqueImpresion[][], semanaLabel: string, rec: M.Recursos, bn = false) {
  M.descargar(construirListaPDF(paginas, semanaLabel, rec, bn), `lista-produccion-${semanaLabel}`)
}

// Carteles de cámara: una columna por balda, letra lo más grande posible sin saltos de línea.
function construirCamaraPDF(grupos: { titulo: string; secs: Seccion[] }[], partidas: Partida[], rec: M.Recursos, bn = false): jsPDF {
  const doc = M.nuevaHoja({ orientation: 'landscape' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)

  grupos.forEach((g, gi) => {
    if (gi > 0) doc.addPage()
    M.pintarEspina(doc, AREA, ctx, bn)
    const top = M.pintarCabecera(doc, ctx, { docNombre: 'Ordenación de Cámara', tituloCentrado: g.titulo, area: AREA, bn })
    const cb = M.contentBox(doc)
    const colW = cb.w / g.secs.length
    const colH = cb.bottom - top

    g.secs.forEach((sec, ci) => {
      const x0 = cb.x0 + ci * colW
      const parts = partidas.filter(p => p.seccion_id === sec.id)
      if (ci > 0) { doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.5); doc.line(x0, top, x0, top + colH) }
      doc.setFillColor(pal.soft[0], pal.soft[1], pal.soft[2]); doc.roundedRect(x0 + 1, top, colW - 2, 9, M.R, M.R, 'F')
      M.fTitulo(doc, ctx, true); doc.setFontSize(13); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
      doc.text(sec.nombre, x0 + 4, top + 6)

      const filas = conBiberones(parts)
      const nF = filas.length || 1
      const innerTop = top + 12
      const innerH = colH - 12
      const maxTextW = colW - 8
      M.fDato(doc, ctx, true); doc.setFontSize(10)
      let wMax10 = 1
      for (const f of filas) {
        const t = f.kind === 'sub' ? f.label : f.part.nombre
        const w = doc.getTextWidth(t)
        if (w > wMax10) wMax10 = w
      }
      const fsAncho = (maxTextW * 10) / wMax10
      const fsAlto = innerH / (nF * 0.41)
      const fs = Math.max(9, Math.min(34, fsAncho, fsAlto))
      const lh = innerH / nF
      let fy = innerTop + lh * 0.72
      let prevBib = false
      for (const f of filas) {
        if (f.kind === 'sub') {
          M.fTitulo(doc, ctx, true); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setFontSize(fs)
          doc.text(f.label, x0 + 4, fy)
          fy += lh
          continue
        }
        if (prevBib && !f.part.biberon) {
          doc.setDrawColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setLineWidth(0.8)
          doc.line(x0 + 4, fy - lh * 0.6, x0 + colW - 4, fy - lh * 0.6)
        }
        prevBib = !!f.part.biberon
        M.fDato(doc, ctx, false); doc.setTextColor(...M.TINTA); doc.setFontSize(fs)
        doc.text(f.part.nombre, x0 + 4, fy)
        fy += lh
      }
    })
    M.pintarPaginado(doc, gi + 1, grupos.length, ctx)
  })
  return doc
}

function descargarCamaraPDF(grupos: { titulo: string; secs: Seccion[] }[], partidas: Partida[], rec: M.Recursos, bn = false) {
  M.descargar(construirCamaraPDF(grupos, partidas, rec, bn), 'ordenacion-camara')
}

// Inventario: una hoja A4 apaisada por ubicación. 2 columnas, stock mínimo entre paréntesis,
// línea continua a la derecha para anotar.
function pintarInventarioUbi(doc: jsPDF, ubi: InvUbi, ctx: M.Ctx, bn: boolean, hoja = 1, hojas = 1) {
  const pal = M.paleta(AREA, bn)
  const yTop0 = M.pintarCabecera(doc, ctx, { docNombre: 'Inventario Permanente', meta: `SL-COC-103 · REV. 01 · FECHA ___ / ___ / ______ · HOJA ${hoja}/${hojas}`, tituloCentrado: ubi.nombre, area: AREA, bn })
  // instrucción fija (modelo Design rev. 01)
  M.fDato(doc, ctx, false); doc.setFontSize(7.2); doc.setTextColor(...M.GRIS)
  doc.text('( ) = stock EXACTO a tener · escribe la cantidad real en la línea; al coger uno, tacha el número y escribe el nuevo', M.contentBox(doc).x0, yTop0 - 1)
  const yTop = yTop0 + 3
  const cb = M.contentBox(doc)
  const usableW = cb.w

  const top = yTop
  const bottom = cb.bottom
  const alturaDisp = bottom - top
  const headH = 6.5
  const gap = 1.4

  const nCols = 2
  const colGap = 5
  const colW = (usableW - colGap) / nCols
  const xCol = [cb.x0, cb.x0 + colW + colGap]

  // reparto equilibrado de categorías enteras entre las 2 columnas
  const cols: InvCat[][] = [[], []]
  const carga = [0, 0]
  for (const cat of ubi.cats) {
    const ci = carga[0] <= carga[1] ? 0 : 1
    cols[ci].push(cat)
    carga[ci] += cat.items.length + 0.8
  }

  let maxItems = 1, catsEnMax = 1, peor = -1
  for (let k = 0; k < nCols; k++) {
    const its = cols[k].reduce((a, c) => a + c.items.length, 0)
    if (carga[k] > peor) { peor = carga[k]; maxItems = Math.max(its, 1); catsEnMax = Math.max(cols[k].length, 1) }
  }
  let itemH = (alturaDisp - catsEnMax * (headH + gap)) / maxItems
  itemH = Math.max(3, Math.min(9.5, itemH))

  for (let k = 0; k < nCols; k++) {
    const x = xCol[k]
    let y = top
    for (const cat of cols[k]) {
      // cabecera de categoría (acento, radio único)
      doc.setFillColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.roundedRect(x, y, colW, headH, M.R, M.R, 'F')
      M.fTitulo(doc, ctx, true); doc.setFontSize(11); doc.setTextColor(255, 255, 255)
      doc.text(cat.nombre.toUpperCase(), x + 3, y + headH - 2.1)
      y += headH

      for (const it of cat.items) {
        const sufijo = it.min_seguridad != null ? `  (${it.min_seguridad})` : ''
        const fsAltura = Math.min(16, itemH * 2.7)
        const fs = M.fitFont(doc, it.nombre + sufijo, colW * 0.7, fsAltura, 7)
        const baseY = y + itemH * 0.5 + fs * 0.13
        M.fDato(doc, ctx, false); doc.setTextColor(...M.TINTA); doc.setFontSize(fs)
        doc.text(it.nombre, x + 2.5, baseY)
        let endX = x + 2.5 + doc.getTextWidth(it.nombre)
        if (it.min_seguridad != null) {
          M.fTitulo(doc, ctx, true); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2]); doc.setFontSize(fs)
          doc.text(`  (${it.min_seguridad})`, endX, baseY)
          endX += doc.getTextWidth(`  (${it.min_seguridad})`)
        }
        // línea continua de anotación (única línea del marco para este uso, ver M.lineaRelleno)
        M.lineaRelleno(doc, endX + 3, x + colW - 2, y + itemH - 1.4)
        y += itemH
      }
      y += gap
    }
  }
  // pie: responsable de aterrizaje (modelo Design rev. 01)
  M.fTitulo(doc, ctx, true); doc.setFontSize(6.5); doc.setTextColor(...M.GRIS)
  doc.text('RESPONSABLE DE ATERRIZAJE:', cb.x0, cb.bottom + 5)
  M.lineaRelleno(doc, cb.x0 + 42, cb.x0 + 100, cb.bottom + 5)
}

function construirInventarioPDF(ubi: InvUbi, rec: M.Recursos, bn = false, hoja = 1, hojas = 1): jsPDF {
  const doc = M.nuevaHoja({ orientation: 'landscape' })
  const ctx = M.preparar(doc, rec)
  M.pintarEspina(doc, AREA, ctx, bn)
  pintarInventarioUbi(doc, ubi, ctx, bn, hoja, hojas)
  M.pintarPaginado(doc, 1, 1, ctx)
  return doc
}

function construirInventarioTodosPDF(ubis: InvUbi[], rec: M.Recursos, bn = false): jsPDF {
  const doc = M.nuevaHoja({ orientation: 'landscape' })
  const ctx = M.preparar(doc, rec)
  ubis.forEach((u, i) => {
    if (i > 0) doc.addPage()
    M.pintarEspina(doc, AREA, ctx, bn)
    pintarInventarioUbi(doc, u, ctx, bn, i + 1, ubis.length)
    M.pintarPaginado(doc, i + 1, ubis.length, ctx)
  })
  return doc
}

function descargarInventarioPDF(ubi: InvUbi, rec: M.Recursos, bn = false) {
  M.descargar(construirInventarioPDF(ubi, rec, bn), `inventario-${ubi.nombre}`)
}

function descargarInventarioTodosPDF(ubis: InvUbi[], rec: M.Recursos, bn = false) {
  M.descargar(construirInventarioTodosPDF(ubis, rec, bn), 'inventario-completo')
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────

export default function Produccion() {
  const { T } = useTheme()
  const [activeTab, setActiveTab] = useState<'lista' | 'camara' | 'inventario' | 'esquemas'>('lista')
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [inventario, setInventario] = useState<InvItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarBase() }, [])
  async function cargarBase() {
    setLoading(true)
    const [{ data: secs }, { data: parts }, { data: inv }] = await Promise.all([
      supabase.from('produccion_secciones').select('*').eq('activa', true).order('orden'),
      supabase.from('produccion_partidas').select('*').eq('activa', true).order('orden'),
      supabase.from('inventario_permanente').select('*').eq('activo', true).order('ord_ubi').order('ord_cat').order('ord_item'),
    ])
    setSecciones((secs as Seccion[]) ?? [])
    setPartidas((parts as Partida[]) ?? [])
    setInventario((inv as InvItem[]) ?? [])
    setLoading(false)
  }

  const tabs = [
    { id: 'lista', label: 'Lista de Producción' },
    { id: 'camara', label: 'Ordenación de Cámara' },
    { id: 'inventario', label: 'Inventario Permanente' },
    { id: 'esquemas', label: 'Esquemas' },
  ]

  return (
    <PantallaCantera embedded>
      <style>{FICHA_CSS}</style>

      {/* HÉROE (naranja · área Cocina) — pantalla-lista sin KPI: titular + resumen, sin cifra */}
      <HeroCantera
        area="cocina"
        titular="Plantillas y carteles de producción, listos para imprimir sin salir de aquí."
        resumen="Lista semanal, ordenación de cámara e inventario permanente en un único sitio."
        atencion={[
          secciones.length > 0 ? `${secciones.length} secciones` : null,
          partidas.length > 0 ? `${partidas.length} partidas` : null,
        ].filter(Boolean) as string[]}
      />

      <div className="no-print">
        <TabsPastilla tabs={tabs} activeId={activeTab} onChange={id => setActiveTab(id as 'lista' | 'camara' | 'inventario' | 'esquemas')} />
      </div>

      {loading ? (
        <div style={{ padding: 24, color: T.sec, fontFamily: FONT.body }}>Cargando producción…</div>
      ) : activeTab === 'lista' ? (
        <TabListaProduccion T={T} secciones={secciones} partidas={partidas} onChanged={cargarBase} />
      ) : activeTab === 'camara' ? (
        <TabOrdenacionCamara T={T} secciones={secciones} partidas={partidas} />
      ) : activeTab === 'inventario' ? (
        <TabInventarioPermanente T={T} inventario={inventario} />
      ) : (
        <Esquemas />
      )}
    </PantallaCantera>
  )
}

// ─── TAB: LISTA DE PRODUCCIÓN (plantilla fija) ─────────────────────────────────

function TabListaProduccion({ T, secciones, partidas, onChanged }: { T: ReturnType<typeof useTheme>['T']; secciones: Seccion[]; partidas: Partida[]; onChanged: () => void }) {
  const [entradas, setEntradas] = useState<EntradaProduccion[]>([])
  const [modalSecciones, setModalSecciones] = useState(false)
  const [modalPartidas, setModalPartidas] = useState(false)
  const [bn, setBn] = useState(false)
  const semana = useMemo(() => getSemanaISO(new Date()), [])

  const partidasLista = useMemo(() => partidas.filter(p => !p.solo_camara), [partidas])

  useEffect(() => {
    supabase.from('produccion_entradas').select('*').eq('semana_iso', semana)
      .then(({ data }) => setEntradas((data as EntradaProduccion[]) ?? []))
  }, [semana])

  function getCelda(partidaId: string, dia: Dia): CeldaValor {
    const e = entradas.find(e => e.partida_id === partidaId && e.dia === dia)
    return { hoy: e?.hoy ?? '', ssp: e?.ssp ?? '' }
  }
  async function setCelda(partidaId: string, dia: Dia, campo: 'hoy' | 'ssp', valor: string) {
    const existing = entradas.find(e => e.partida_id === partidaId && e.dia === dia)
    setEntradas(prev => {
      const idx = prev.findIndex(e => e.partida_id === partidaId && e.dia === dia)
      if (idx >= 0) { const u = [...prev]; u[idx] = { ...u[idx], [campo]: valor }; return u }
      return [...prev, { id: `tmp-${Date.now()}`, partida_id: partidaId, semana_iso: semana, dia, hoy: campo === 'hoy' ? valor : '', ssp: campo === 'ssp' ? valor : '' }]
    })
    if (existing) await supabase.from('produccion_entradas').update({ [campo]: valor }).eq('id', existing.id)
    else {
      const { data } = await supabase.from('produccion_entradas')
        .insert({ partida_id: partidaId, semana_iso: semana, dia, hoy: campo === 'hoy' ? valor : '', ssp: campo === 'ssp' ? valor : '' })
        .select().single()
      if (data) setEntradas(prev => prev.map(e => e.partida_id === partidaId && e.dia === dia && e.id.startsWith('tmp-') ? (data as EntradaProduccion) : e))
    }
  }

  const paginas = useMemo(() => paginar(secciones, partidasLista), [secciones, partidasLista])
  const hayContenido = secciones.length > 0
  const semLabel = getSemanaLabel(semana)

  const cabeceraDias = (
    <>
      <th className="th-partida th-partida-ini">Producto</th>
      {DIAS.map(dia => <th key={dia} colSpan={2} className="th-dia dia-ini">{DIAS_LABEL[dia]}</th>)}
      <th className="th-partida th-partida-fin">Producto</th>
    </>
  )
  const subCabecera = (
    <>
      <th className="th-sub-empty" />
      {DIAS.map(dia => (
        <React.Fragment key={dia}>
          <th className="th-sub th-sub-hoy dia-ini">HOY</th>
          <th className="th-sub th-sub-ssp">SSP</th>
        </React.Fragment>
      ))}
      <th className="th-sub-empty" />
    </>
  )

  const filaPartidaPantalla = (part: Partida) => (
    <tr key={part.id} className="fila-partida">
      <td className="td-partida td-partida-ini">{part.nombre}</td>
      {DIAS.map(dia => {
        const c = getCelda(part.id, dia)
        return (
          <React.Fragment key={dia}>
            <td className="td-celda td-celda-hoy dia-ini"><input value={c.hoy} onChange={e => setCelda(part.id, dia, 'hoy', e.target.value)} className="celda-input" /></td>
            <td className="td-celda td-celda-ssp"><input value={c.ssp} onChange={e => setCelda(part.id, dia, 'ssp', e.target.value)} className="celda-input celda-ssp" /></td>
          </React.Fragment>
        )
      })}
      <td className="td-partida td-partida-fin">{part.nombre}</td>
    </tr>
  )

  const filaPartidaImpresion = (part: Partida) => (
    <tr key={part.id} className="fila-partida">
      <td className="td-partida td-partida-ini">{part.nombre}</td>
      {DIAS.map(dia => {
        const c = getCelda(part.id, dia)
        return (
          <React.Fragment key={dia}>
            <td className="td-celda td-celda-hoy dia-ini"><span className="celda-print">{c.hoy}</span></td>
            <td className="td-celda td-celda-ssp"><span className="celda-print">{c.ssp}</span></td>
          </React.Fragment>
        )
      })}
      <td className="td-partida td-partida-fin">{part.nombre}</td>
    </tr>
  )

  return (
    <>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 14, color: T.pri, letterSpacing: '0.5px' }}>
          Plantilla · {semLabel}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setModalSecciones(true)} style={btnGhost}><Plus size={15} /> Secciones</button>
          <button onClick={() => setModalPartidas(true)} style={btnGhost}><Plus size={15} /> Partidas</button>
          <BnToggle bn={bn} setBn={setBn} />
          <BotonImprimir compacto documentoId="cocina.lista_produccion" titulo={`Lista de Producción · ${semLabel}`} generarPdf={async opts => { const rec = await M.cargarRecursos(); return construirListaPDF(paginas, semLabel, rec, opts.bn) }} />
          <button onClick={async () => { const rec = await M.cargarRecursos(); descargarListaPDF(paginas, semLabel, rec, bn) }} style={btnPrimary}><Download size={15} /> Descargar PDF</button>
        </div>
      </div>

      {/* VISTA PANTALLA */}
      <div className="vista-pantalla">
        <HojaDoc area="cocina" docNombre="Lista de Producción" meta={semLabel}>
          <div className="ficha-section" style={{ borderBottom: 'none', paddingBottom: 6 }}>
          {!hayContenido ? (
            <div style={{ padding: 36, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin secciones todavía.</div>
          ) : (
            <div className="prod-table-wrap">
              <table className="prod-table">
                <thead><tr>{cabeceraDias}</tr><tr>{subCabecera}</tr></thead>
                <tbody>
                  {secciones.map(sec => (
                    <React.Fragment key={sec.id}>
                      <tr className="fila-seccion"><td colSpan={TOTAL_COLS} className="td-seccion">{sec.nombre}</td></tr>
                      {conBiberones(partidasLista.filter(p => p.seccion_id === sec.id)).map((f, i) =>
                        f.kind === 'sub'
                          ? <tr key={`sub-${i}`} className="fila-bib"><td colSpan={TOTAL_COLS} className="td-bib">{f.label}</td></tr>
                          : filaPartidaPantalla(f.part)
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </HojaDoc>
      </div>

      {/* VISTA IMPRESIÓN paginada */}
      <div className="vista-impresion lista-print">
        {paginas.map((bloques, pi) => (
          <div key={pi} className="hoja" style={{ breakAfter: pi < paginas.length - 1 ? 'page' : 'auto' }}>
            <div className="print-head">
              <span className="print-title">Lista de Producción</span>
              <span className="print-week">{semLabel}</span>
              <span className="print-pag">Página {pi + 1} de {paginas.length}</span>
            </div>
            {bloques.map((b, bi) => (
              <table key={bi} className="prod-table prod-table-print">
                <thead>
                  <tr><th colSpan={TOTAL_COLS} className="th-seccion-print">{b.sec.nombre}{b.cont ? ' · (CONTINÚA)' : ''}</th></tr>
                  <tr>{cabeceraDias}</tr>
                  <tr>{subCabecera}</tr>
                </thead>
                <tbody>
                  {conBiberones(b.parts).map((f, i) =>
                    f.kind === 'sub'
                      ? <tr key={`sub-${i}`} className="fila-bib"><td colSpan={TOTAL_COLS} className="td-bib">{f.label}</td></tr>
                      : filaPartidaImpresion(f.part)
                  )}
                </tbody>
              </table>
            ))}
          </div>
        ))}
      </div>

      {modalSecciones && <ModalGestionSecciones T={T} secciones={secciones} onClose={() => setModalSecciones(false)} onSaved={() => { setModalSecciones(false); onChanged() }} />}
      {modalPartidas && <ModalGestionPartidas T={T} secciones={secciones} partidas={partidas} onClose={() => setModalPartidas(false)} onSaved={() => { setModalPartidas(false); onChanged() }} />}
    </>
  )
}

// ─── TAB: ORDENACIÓN DE CÁMARA (2 hojas: izquierda / derecha) ──────────────────

function TabOrdenacionCamara({ T, secciones, partidas }: { T: ReturnType<typeof useTheme>['T']; secciones: Seccion[]; partidas: Partida[] }) {
  const grupos = useMemo(() => agruparLados(secciones), [secciones])
  const [bn, setBn] = useState(false)

  return (
    <>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, maxWidth: 560 }}>
          Una hoja A4 por lado de la cámara (izquierda / derecha), con todas sus baldas y los productos en grande para pegar en la puerta.
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <BnToggle bn={bn} setBn={setBn} />
          <BotonImprimir compacto documentoId="cocina.ordenacion_camara" titulo="Hoja de ordenación de Cámara" generarPdf={async opts => { const rec = await M.cargarRecursos(); return construirCamaraPDF(grupos, partidas, rec, opts.bn) }} />
          <button onClick={async () => { const rec = await M.cargarRecursos(); descargarCamaraPDF(grupos, partidas, rec, bn) }} style={btnPrimary}><Download size={15} /> Descargar PDF</button>
        </div>
      </div>

      <div className="camara-wrap">
        {grupos.map((g, gi) => (
          <HojaDoc key={gi} area="cocina" docNombre="Ordenación de Cámara" tituloCentrado={g.titulo}>
            <div className="camara-cols" style={{ display: 'grid', gridTemplateColumns: `repeat(${g.secs.length}, 1fr)`, gap: 0 }}>
              {g.secs.map(sec => {
                const parts = partidas.filter(p => p.seccion_id === sec.id)
                const filas = conBiberones(parts)
                return (
                  <div key={sec.id} className="camara-balda">
                    <div className="camara-balda-head">{sec.nombre}</div>
                    <ul className="camara-balda-list">
                      {filas.map((f, i) => {
                        if (f.kind === 'sub') return <li key={`sub-${i}`} className="camara-bib-head">{f.label}</li>
                        const prev = filas[i - 1]
                        const sep = prev && prev.kind === 'part' && prev.part.biberon && !f.part.biberon
                        return (
                          <React.Fragment key={f.part.id}>
                            {sep && <li className="camara-sep" />}
                            <li className="camara-balda-item">{f.part.nombre}</li>
                          </React.Fragment>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          </HojaDoc>
        ))}
      </div>
    </>
  )
}

// ─── TAB: INVENTARIO PERMANENTE ────────────────────────────────────────────────

function TabInventarioPermanente({ T, inventario }: { T: ReturnType<typeof useTheme>['T']; inventario: InvItem[] }) {
  const ubis = useMemo(() => agruparInventario(inventario), [inventario])
  const [activa, setActiva] = useState(0)
  const [bn, setBn] = useState(false)

  if (!ubis.length) {
    return <div style={{ padding: 36, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin inventario todavía.</div>
  }
  const ubi = ubis[Math.min(activa, ubis.length - 1)]

  return (
    <div style={M.marcoCSSVars('cocina') as React.CSSProperties}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="inv-pills">
          {ubis.map((u, i) => (
            <button key={u.nombre} onClick={() => setActiva(i)} className={`inv-pill ${i === activa ? 'on' : ''}`}>{u.nombre}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <BnToggle bn={bn} setBn={setBn} />
          <BotonImprimir compacto documentoId="cocina.inventario_permanente" titulo={`Inventario permanente · ${ubi.nombre}`} generarPdf={async opts => { const rec = await M.cargarRecursos(); return construirInventarioPDF(ubi, rec, opts.bn, activa + 1, ubis.length) }} />
          <BotonImprimir compacto documentoId="cocina.inventario_permanente" titulo="Inventario permanente · TODAS las hojas" etiqueta="Imprimir todo" generarPdf={async opts => { const rec = await M.cargarRecursos(); return construirInventarioTodosPDF(ubis, rec, opts.bn) }} />
          <button onClick={async () => { const rec = await M.cargarRecursos(); descargarInventarioPDF(ubi, rec, bn) }} style={btnGhost}><Download size={15} /> Esta ubicación</button>
          <button onClick={async () => { const rec = await M.cargarRecursos(); descargarInventarioTodosPDF(ubis, rec, bn) }} style={btnPrimary}><FileDown size={15} /> Descargar todo</button>
        </div>
      </div>


      <HojaDoc area="cocina" docNombre="Inventario Permanente" tituloCentrado={ubi.nombre} meta="SL-COC-103 · REV. 01 · FECHA __ / __ / ____">
        <div className="inv-cats">
          {ubi.cats.map(cat => (
            <div className="inv-cat" key={cat.nombre}>
              <div className="inv-cat-head">{cat.nombre}</div>
              {cat.items.map(it => (
                <div className="inv-row" key={it.id}>
                  <span className="inv-name">{it.nombre}{it.min_seguridad != null && <span className="inv-min-inline"> ({it.min_seguridad})</span>}</span>
                  <span className="inv-write" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </HojaDoc>
    </div>
  )
}

// ─── MODAL SECCIONES ──────────────────────────────────────────────────────────

function ModalGestionSecciones({ T, secciones, onClose, onSaved }: { T: ReturnType<typeof useTheme>['T']; secciones: Seccion[]; onClose: () => void; onSaved: () => void }) {
  const [nueva, setNueva] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  async function crear() { if (!nueva.trim()) return; await supabase.from('produccion_secciones').insert({ nombre: nueva.trim().toUpperCase(), orden: secciones.length }); setNueva(''); onSaved() }
  async function renombrar(s: Seccion) { if (!editNombre.trim()) return; await supabase.from('produccion_secciones').update({ nombre: editNombre.trim().toUpperCase() }).eq('id', s.id); setEditId(null); onSaved() }
  async function eliminar(s: Seccion) { if (!confirm(`¿Eliminar sección "${s.nombre}"?`)) return; await supabase.from('produccion_secciones').update({ activa: false }).eq('id', s.id); onSaved() }
  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, background: T.card, border: `0.5px solid ${T.brd}` }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 18, color: GRANATE, letterSpacing: '1px', textTransform: 'uppercase' }}>Secciones</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.mut }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crear()} placeholder="Nueva sección" style={{ ...inputStyle(T), flex: 1 }} />
          <button onClick={crear} style={btnPrimary}><Plus size={16} /> Crear</button>
        </div>
        {secciones.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {editId === s.id ? (
              <>
                <input value={editNombre} onChange={e => setEditNombre(e.target.value)} style={{ ...inputStyle(T), flex: 1 }} />
                <button onClick={() => renombrar(s)} style={iconBtn(T)}><Check size={14} /></button>
                <button onClick={() => setEditId(null)} style={iconBtn(T)}><X size={14} /></button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{s.nombre}</div>
                <button onClick={() => { setEditId(s.id); setEditNombre(s.nombre) }} style={iconBtn(T)}><Pencil size={13} /></button>
                <button onClick={() => eliminar(s)} style={{ ...iconBtn(T), color: GRANATE }}><Trash2 size={13} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MODAL PARTIDAS ───────────────────────────────────────────────────────────

function ModalGestionPartidas({ T, secciones, partidas, onClose, onSaved }: { T: ReturnType<typeof useTheme>['T']; secciones: Seccion[]; partidas: Partida[]; onClose: () => void; onSaved: () => void }) {
  const [seccionFiltro, setSeccionFiltro] = useState(secciones[0]?.id ?? '')
  const [nueva, setNueva] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const partidasSeccion = partidas.filter(p => p.seccion_id === seccionFiltro)
  async function crear() { if (!nueva.trim() || !seccionFiltro) return; await supabase.from('produccion_partidas').insert({ nombre: nueva.trim(), seccion_id: seccionFiltro, orden: 999 }); setNueva(''); onSaved() }
  async function renombrar(p: Partida) { if (!editNombre.trim()) return; await supabase.from('produccion_partidas').update({ nombre: editNombre.trim() }).eq('id', p.id); setEditId(null); onSaved() }
  async function eliminar(p: Partida) { if (!confirm(`¿Eliminar partida "${p.nombre}"?`)) return; await supabase.from('produccion_partidas').update({ activa: false }).eq('id', p.id); onSaved() }
  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, background: T.card, border: `0.5px solid ${T.brd}`, width: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 18, color: GRANATE, letterSpacing: '1px', textTransform: 'uppercase' }}>Partidas</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.mut }}><X size={20} /></button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lblStyle(T)}>Sección</label>
          <select value={seccionFiltro} onChange={e => setSeccionFiltro(e.target.value)} style={inputStyle(T)}>
            {secciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crear()} placeholder="Nueva partida" style={{ ...inputStyle(T), flex: 1 }} />
          <button onClick={crear} style={btnPrimary}><Plus size={16} /> Añadir</button>
        </div>
        <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginBottom: 10 }}>Se reordena alfabéticamente al guardar.</div>
        {partidasSeccion.length === 0 && <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut, padding: '12px 0' }}>Sin partidas en esta sección.</div>}
        {partidasSeccion.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {editId === p.id ? (
              <>
                <input value={editNombre} onChange={e => setEditNombre(e.target.value)} style={{ ...inputStyle(T), flex: 1 }} />
                <button onClick={() => renombrar(p)} style={iconBtn(T)}><Check size={14} /></button>
                <button onClick={() => setEditId(null)} style={iconBtn(T)}><X size={14} /></button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{p.nombre}{p.biberon ? ' · biberón' : ''}{p.solo_camara ? ' · solo cámara' : ''}</div>
                <button onClick={() => { setEditId(p.id); setEditNombre(p.nombre) }} style={iconBtn(T)}><Pencil size={13} /></button>
                <button onClick={() => eliminar(p)} style={{ ...iconBtn(T), color: GRANATE }}><Trash2 size={13} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── TOGGLE BLANCO/NEGRO (impresión) ───────────────────────────────────────────

function BnToggle({ bn, setBn }: { bn: boolean; setBn: (v: boolean) => void }) {
  return (
    <button onClick={() => setBn(!bn)} style={{ ...btnGhost, background: bn ? PRINT_BN_BG : 'transparent', color: bn ? PRINT_BN_TXT : 'var(--sl-text-secondary)' }} title="Imprimir en blanco y negro">
      {bn ? 'B/N' : 'Color'}
    </button>
  )
}

// ─── ESTILOS BOTONES / MODALES ─────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: GRANATE, color: BLANCO, border: 'none', borderRadius: 0, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--sl-text-secondary)', border: '0.5px solid var(--sl-border)', borderRadius: 0, padding: '8px 14px', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: '0.04em' }
const inputStyle = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ width: '100%', background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 0, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '8px 12px', outline: 'none' })
const lblStyle = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ display: 'block', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 5 })
const iconBtn = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 0, color: T.sec, cursor: 'pointer', padding: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' })
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const modalBox: React.CSSProperties = { borderRadius: 0, width: 560, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }

// ─── CSS ────────────────────────────────────────────────────────────────────

const FICHA_CSS = `
.ficha-card { font-family: 'Lexend', sans-serif; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; color: var(--text-primary); overflow: hidden; display: flex; flex-direction: column; }
.ficha-head { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--sl-border-strong); }
.ficha-title { font-family: 'Oswald', sans-serif; font-weight: 500; font-size: 21px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-primary); }
.ficha-week { margin-left: auto; font-family: 'Oswald', sans-serif; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); }
.ficha-section { padding: 14px 20px; }

.prod-table-wrap { overflow-x: auto; }
.prod-table { width: 100%; border-collapse: separate; border-spacing: 0; font-family: 'Lexend', sans-serif; font-size: 13px; }
.prod-table th, .prod-table td { border-right: 1px solid var(--sl-border-strong); border-bottom: 1px solid var(--sl-border-strong); }
.prod-table th.dia-ini, .prod-table td.dia-ini { border-left: 3px solid var(--m-acento) !important; }

.th-partida { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; text-align: left; padding: 6px 8px; background: var(--m-acento); color: #fff; min-width: 120px; }
.th-partida-ini { position: sticky; left: 0; z-index: 2; }
.th-dia { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; text-align: center; padding: 5px 2px; background: var(--m-acento); color: #fff; }
.th-sub-empty { background: var(--m-espina); }
.th-sub { font-family: 'Oswald', sans-serif; font-size: 10px; font-weight: 600; text-align: center; padding: 2px 1px; color: #fff; }
.th-sub-hoy { background: var(--m-espina); }
.th-sub-ssp { background: var(--m-tinta); color: var(--m-soft); }
.td-seccion { font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--m-acento); padding: 5px 8px; background: var(--m-soft2); }
.td-bib { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--m-acento); padding: 3px 8px 3px 20px; background: var(--m-soft2); }

.td-partida { font-family: 'Lexend', sans-serif; font-size: 14.5px; color: var(--text-primary); padding: 0 8px; white-space: nowrap; background: var(--bg-card); }
.td-partida-ini { position: sticky; left: 0; z-index: 1; }
.td-partida-fin { text-align: right; }
.td-celda { padding: 0; }
.td-celda-hoy { background: var(--bg-card); }
.td-celda-ssp { background: var(--m-soft2); }
.celda-input { width: 100%; min-width: 34px; background: transparent; border: none; outline: none; font-family: 'Lexend', sans-serif; font-size: 15px; color: var(--text-primary); padding: 0 3px; text-align: center; }
.celda-ssp { color: var(--text-muted); }
.celda-print { display: none; }

.vista-impresion { display: none; }

/* Carteles cámara — preview en pantalla (1 columna) */
.camara-wrap { display: flex; flex-direction: column; gap: 22px; }
.hoja-camara { border: 2px solid var(--m-acento); border-radius: 12px; overflow: hidden; background: var(--bg-card); }
.camara-lado-head { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 30px; letter-spacing: 0.05em; text-transform: uppercase; color: #fff; background: var(--m-acento); padding: 14px 22px; }
.camara-cols { display: grid; gap: 0; }
.camara-balda { border-right: 1px solid var(--sl-border); padding: 0 0 10px 0; }
.camara-balda:last-child { border-right: none; }
.camara-balda-head { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--m-acento); padding: 10px 16px; border-bottom: 2px solid var(--m-soft); }
.camara-balda-list { list-style: none; margin: 0; padding: 10px 16px; }
.camara-balda-item { font-family: 'Lexend', sans-serif; font-size: 21px; line-height: 1.5; color: var(--text-primary); }
.camara-bib-head { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 19px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--m-acento); margin-top: 6px; }
.camara-sep { height: 0; border-top: 2px solid var(--m-acento); margin: 8px 4px 8px 0; list-style: none; }

/* Inventario permanente — 2 columnas, stock entre paréntesis pegado al nombre, zona rayada para anotar */
.inv-pills { display: flex; gap: 7px; flex-wrap: wrap; }
.inv-pill { font-family: 'Oswald', sans-serif; letter-spacing: 0.03em; text-transform: uppercase; font-size: 12px; padding: 7px 14px; border-radius: 99px; border: 1px solid var(--sl-border); background: var(--bg-card); color: var(--text-secondary); cursor: pointer; white-space: nowrap; }
.inv-pill.on { background: var(--m-acento); border-color: var(--m-acento); color: #fff; }
.inv-mintag { display: inline-flex; align-items: center; background: var(--m-acento); color: #fff; font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 5px; }
.inv-hoja { border: 2px solid var(--m-acento); border-radius: 10px; overflow: hidden; background: var(--bg-card); }
.inv-head { background: var(--m-soft); color: var(--m-acento); font-family: 'Oswald', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; font-size: 24px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid var(--m-acento); }
.inv-head-sub { font-size: 13px; font-weight: 500; }
.inv-cats { column-count: 2; column-gap: 0; }
.inv-cat { break-inside: avoid; border-right: 1px solid var(--sl-border); }
.inv-cat-head { font-family: 'Oswald', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; font-size: 15px; color: #fff; background: var(--m-acento); padding: 7px 14px; border-bottom: 2px solid var(--m-espina); }
.inv-row { display: flex; align-items: stretch; min-height: 38px; }
.inv-name { flex: 0 0 auto; display: flex; align-items: center; white-space: nowrap; padding: 1px 12px; font-family: 'Lexend', sans-serif; font-size: 24px; font-weight: 500; color: var(--text-primary); }
.inv-min-inline { margin-left: 8px; color: var(--m-acento); font-family: 'Oswald', sans-serif; font-weight: 700; }
.inv-write { flex: 1 1 auto; align-self: flex-end; border-bottom: 1.5px solid var(--sl-border); margin: 0 12px 8px 6px; }
@media (max-width: 820px) { .inv-cats { column-count: 1; } .inv-cat { border-right: none; } .inv-name { font-size: 21px; } }

`
