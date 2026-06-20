import { useState, useEffect, useMemo } from 'react'
import React from 'react'
import { ClipboardList, Printer, Download, Plus, Trash2, X, Check, Pencil, FileDown } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT, pageTitleStyle, groupStyle, tabsContainerStyle, tabActiveStyle, tabInactiveStyle } from '@/styles/tokens'

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

// ─── GENERACIÓN DE PDF REAL (descarga directa, sin diálogo de impresión) ───────

const RED: [number, number, number] = [176, 29, 35]
const RED_DARK: [number, number, number] = [138, 26, 34]
const RED_SOFT: [number, number, number] = [240, 216, 218]
const RED_SOFT2: [number, number, number] = [245, 226, 227]
const GREY_LINE: [number, number, number] = [201, 201, 201]
const WRITE_LINE: [number, number, number] = [201, 201, 210]

function safe(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
}

// Abre el PDF generado en una pestaña nueva y lanza el diálogo de impresión desde el visor
// (evita la cola colgada de la impresora WiFi al imprimir directo desde la web)
function imprimirDesdePDF(doc: jsPDF) {
  const url = doc.output('bloburl')
  const win = window.open(url as unknown as string, '_blank')
  if (win) {
    win.addEventListener('load', () => { try { win.focus(); win.print() } catch { /* el usuario imprime desde el visor */ } })
  }
}

// Reduce el cuerpo de letra solo si el texto no cabe en el ancho dado (evita salto de linea/pagina)
function fitFont(doc: jsPDF, text: string, maxWidth: number, base: number, min: number): number {
  let fs = base
  doc.setFontSize(fs)
  while (fs > min && doc.getTextWidth(text) > maxWidth) { fs -= 0.5; doc.setFontSize(fs) }
  return fs
}

function construirListaPDF(paginas: BloqueImpresion[][], semanaLabel: string): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const PW = doc.internal.pageSize.getWidth()
  const M = 12
  const usableW = PW - M * 2
  const rowH = 5.2
  // Columna Producto ajustada al nombre más largo (no ocupa todo el sobrante);
  // el resto del ancho se reparte entre las casillas HOY/SSP.
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
  let maxNombreW = 0
  paginas.forEach(bloques => bloques.forEach(b => b.parts.forEach(p => {
    const w = doc.getTextWidth(p.nombre)
    if (w > maxNombreW) maxNombreW = w
  })))
  const wProd = Math.min(Math.max(maxNombreW + 5, 28), 60)
  const wCelda = (usableW - wProd * 2) / 14
  const xProdDer = M + wProd + wCelda * 14

  paginas.forEach((bloques, pi) => {
    if (pi > 0) doc.addPage()
    let y = M
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...RED_DARK)
    doc.text('LISTA DE PRODUCCIÓN', M, y + 4)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90)
    doc.text(semanaLabel, M + 70, y + 4)
    doc.text(`Página ${pi + 1} de ${paginas.length}`, PW - M, y + 4, { align: 'right' })
    y += 7
    doc.setDrawColor(...RED_DARK); doc.setLineWidth(0.4); doc.line(M, y, PW - M, y)
    y += 3

    bloques.forEach(b => {
      const filas = conBiberones(b.parts)
      const tituloSec = `${b.sec.nombre}${b.cont ? '  ·  (CONTINÚA)' : ''}`
      doc.setFillColor(...RED_SOFT); doc.rect(M, y, usableW, 6, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...RED_DARK)
      doc.text(tituloSec, M + 2, y + 4)
      doc.text(tituloSec, xProdDer + 2, y + 4)
      y += 6
      doc.setFillColor(...RED_SOFT2); doc.rect(M, y, usableW, 5, 'F')
      doc.setFontSize(7); doc.setTextColor(...RED_DARK)
      doc.text('Producto', M + 1.5, y + 3.3)
      let x = M + wProd
      DIAS.forEach(dia => { doc.text(DIAS_LABEL[dia], x + wCelda, y + 3.3, { align: 'center' }); x += wCelda * 2 })
      doc.text('Producto', xProdDer + 1.5, y + 3.3)
      y += 5
      doc.setFillColor(...RED_SOFT2); doc.rect(M, y, usableW, 3.6, 'F')
      doc.setFontSize(5.5)
      x = M + wProd
      DIAS.forEach(() => { doc.text('HOY', x + wCelda / 2, y + 2.6, { align: 'center' }); doc.text('SSP', x + wCelda + wCelda / 2, y + 2.6, { align: 'center' }); x += wCelda * 2 })
      y += 3.6

      doc.setFont('helvetica', 'normal')
      let prevBib = false
      filas.forEach(f => {
        if (f.kind === 'sub') {
          doc.setFillColor(247, 238, 239); doc.rect(M, y, usableW, rowH, 'F')
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...RED_DARK)
          doc.text(f.label.toUpperCase(), M + 6, y + 3.7)
          doc.text(f.label.toUpperCase(), xProdDer + 6, y + 3.7)
          doc.setFont('helvetica', 'normal')
          drawColsLines(doc, M, y, rowH, wProd, wCelda)
          y += rowH
          prevBib = false
          return
        }
        // franja roja de separación al terminar los biberones
        if (prevBib && !f.part.biberon) {
          doc.setFillColor(...RED_SOFT); doc.rect(M, y, usableW, 2.6, 'F')
          y += 2.6
        }
        prevBib = !!f.part.biberon
        x = M + wProd
        DIAS.forEach(() => { doc.setFillColor(247, 238, 239); doc.rect(x + wCelda, y, wCelda, rowH, 'F'); x += wCelda * 2 })
        doc.setTextColor(20)
        fitFont(doc, f.part.nombre, wProd - 2.5, 11, 7)
        doc.text(f.part.nombre, M + 1.5, y + 3.7)
        doc.text(f.part.nombre, xProdDer + 1.5, y + 3.7)
        doc.setFontSize(11)
        drawColsLines(doc, M, y, rowH, wProd, wCelda)
        y += rowH
      })
      y += 3
    })
  })
  return doc
}

function descargarListaPDF(paginas: BloqueImpresion[][], semanaLabel: string) {
  construirListaPDF(paginas, semanaLabel).save(`lista-produccion-${safe(semanaLabel)}.pdf`)
}

function drawColsLines(doc: jsPDF, M: number, y: number, rowH: number, wProd: number, wCelda: number) {
  doc.setDrawColor(...GREY_LINE); doc.setLineWidth(0.1)
  const totalW = wProd * 2 + wCelda * 14
  doc.line(M, y + rowH, M + totalW, y + rowH)
  let x = M
  doc.line(x, y, x, y + rowH); x += wProd
  for (let i = 0; i < 14; i++) {
    if (i % 2 === 0) { doc.setDrawColor(207, 123, 129); doc.setLineWidth(0.5) }
    else { doc.setDrawColor(...GREY_LINE); doc.setLineWidth(0.1) }
    doc.line(x, y, x, y + rowH)
    x += wCelda
  }
  doc.setDrawColor(...GREY_LINE); doc.setLineWidth(0.1)
  doc.line(x, y, x, y + rowH); x += wProd
  doc.line(x, y, x, y + rowH)
}

// Carteles de cámara: una sola columna por balda, con el cuerpo de letra MÁS GRANDE posible
// que entre en una hoja sin saltos de línea (tamaño uniforme dentro de cada balda).
function construirCamaraPDF(grupos: { titulo: string; secs: Seccion[] }[], partidas: Partida[]): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const M = 10

  grupos.forEach((g, gi) => {
    if (gi > 0) doc.addPage()
    doc.setFillColor(...RED_SOFT); doc.rect(M, M, PW - M * 2, 16, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(...RED_DARK)
    doc.text(g.titulo, M + 6, M + 11)
    const top = M + 16
    const colW = (PW - M * 2) / g.secs.length
    const colH = PH - top - M

    g.secs.forEach((sec, ci) => {
      const x0 = M + ci * colW
      const parts = partidas.filter(p => p.seccion_id === sec.id)
      if (ci > 0) { doc.setDrawColor(...RED).setLineWidth(0.4); doc.line(x0, top, x0, top + colH) }
      doc.setFillColor(250, 240, 241); doc.rect(x0, top, colW, 9, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...RED_DARK)
      doc.text(sec.nombre, x0 + 4, top + 6)

      const filas = conBiberones(parts)
      const nF = filas.length || 1
      const innerTop = top + 12
      const innerH = colH - 12
      const maxTextW = colW - 8
      // tamaño de letra uniforme = el mayor que cabe en alto (nº filas) y en ancho (texto más largo)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
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
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...RED_DARK); doc.setFontSize(fs)
          doc.text(f.label, x0 + 4, fy)
          doc.setFont('helvetica', 'normal')
          fy += lh
          continue
        }
        if (prevBib && !f.part.biberon) {
          doc.setDrawColor(...RED); doc.setLineWidth(0.8)
          doc.line(x0 + 4, fy - lh * 0.6, x0 + colW - 4, fy - lh * 0.6)
        }
        prevBib = !!f.part.biberon
        doc.setTextColor(20); doc.setFontSize(fs)
        doc.text(f.part.nombre, x0 + 4, fy)
        fy += lh
      }
    })
    doc.setDrawColor(...RED).setLineWidth(0.8); doc.rect(M, M, PW - M * 2, PH - M * 2)
  })
  return doc
}

function descargarCamaraPDF(grupos: { titulo: string; secs: Seccion[] }[], partidas: Partida[]) {
  construirCamaraPDF(grupos, partidas).save('ordenacion-camara.pdf')
}

// Inventario: UNA sola hoja A4 apaisada por ubicación. 2 columnas equilibradas, filas compactas,
// stock mínimo entre paréntesis pegado al nombre (en rojo) y línea continua a la derecha para anotar.
function pintarInventarioUbi(doc: jsPDF, ubi: InvUbi) {
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const M = 10
  const usableW = PW - M * 2

  // cabecera de la hoja
  doc.setFillColor(...RED_SOFT); doc.rect(M, M, usableW, 14, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(...RED_DARK)
  doc.text(ubi.nombre, M + 5, M + 9.3)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
  doc.text('INVENTARIO PERMANENTE     FECHA: ___ / ___ / ______', PW - M - 4, M + 9.3, { align: 'right' })
  doc.setDrawColor(...RED).setLineWidth(0.6); doc.rect(M, M, usableW, PH - M * 2)

  const top = M + 17
  const bottom = PH - M - 3
  const alturaDisp = bottom - top
  const headH = 5.5
  const gap = 1.4

  // 2 columnas fijas, con margen interior para no pisar el borde rojo
  const nCols = 2
  const colGap = 5
  const innerPad = 4
  const contentW = usableW - innerPad * 2
  const colW = (contentW - colGap) / nCols
  const x0c = M + innerPad
  const xCol = [x0c, x0c + colW + colGap]

  // reparto equilibrado de categorías enteras entre las 2 columnas
  const cols: InvCat[][] = [[], []]
  const carga = [0, 0]
  for (const cat of ubi.cats) {
    const ci = carga[0] <= carga[1] ? 0 : 1
    cols[ci].push(cat)
    carga[ci] += cat.items.length + 0.8
  }

  // altura de fila: que la columna más cargada llene la hoja, pero COMPACTA (tope 10mm)
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
      // cabecera de categoría
      doc.setFillColor(250, 240, 241); doc.rect(x, y, colW, headH, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...RED_DARK)
      doc.text(cat.nombre.toUpperCase(), x + 3, y + headH - 1.8)
      y += headH

      for (const it of cat.items) {
        // nombre + stock mínimo entre paréntesis, pegado al nombre, en rojo
        const sufijo = it.min_seguridad != null ? `  (${it.min_seguridad})` : ''
        // letra lo más grande posible que llene ~90% de la altura de la fila,
        // reduciéndose solo si no cabe en el ancho (deja sitio para la raya)
        const fsAltura = Math.min(16, itemH * 2.7)
        const fs = fitFont(doc, it.nombre + sufijo, colW * 0.7, fsAltura, 7)
        const baseY = y + itemH * 0.5 + fs * 0.13
        doc.setFont('helvetica', 'normal'); doc.setTextColor(35); doc.setFontSize(fs)
        doc.text(it.nombre, x + 2.5, baseY)
        let endX = x + 2.5 + doc.getTextWidth(it.nombre)
        if (it.min_seguridad != null) {
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...RED)
          doc.text(`  (${it.min_seguridad})`, endX, baseY)
          endX += doc.getTextWidth(`  (${it.min_seguridad})`)
          doc.setFont('helvetica', 'normal')
        }
        // línea continua de anotación justo tras el stock (sin puntos ni hueco)
        doc.setDrawColor(...WRITE_LINE); doc.setLineWidth(0.3)
        doc.line(endX + 3, y + itemH - 1.4, x + colW - 2, y + itemH - 1.4)
        // separador inferior de la fila
        doc.setDrawColor(236, 236, 240); doc.setLineWidth(0.15)
        doc.line(x, y + itemH, x + colW, y + itemH)
        y += itemH
      }
      y += gap
    }
  }
}

function construirInventarioPDF(ubi: InvUbi): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  pintarInventarioUbi(doc, ubi)
  return doc
}

function construirInventarioTodosPDF(ubis: InvUbi[]): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  ubis.forEach((u, i) => { if (i > 0) doc.addPage(); pintarInventarioUbi(doc, u) })
  return doc
}

function descargarInventarioPDF(ubi: InvUbi) {
  construirInventarioPDF(ubi).save(`inventario-${safe(ubi.nombre)}.pdf`)
}

function descargarInventarioTodosPDF(ubis: InvUbi[]) {
  construirInventarioTodosPDF(ubis).save('inventario-completo.pdf')
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────

export default function Produccion() {
  const { T, isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<'lista' | 'camara' | 'inventario'>('lista')
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
    { key: 'lista', label: 'Lista de Producción' },
    { key: 'camara', label: 'Ordenación de Cámara' },
    { key: 'inventario', label: 'Inventario Permanente' },
  ]

  return (
    <div style={{ ...groupStyle(T), width: '100%' }}>
      <style>{FICHA_CSS}</style>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <ClipboardList size={24} color="#B01D23" />
        <h1 style={{ ...pageTitleStyle(T), margin: 0 }}>PRODUCCIÓN</h1>
      </div>

      <div style={tabsContainerStyle()} className="no-print">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as 'lista' | 'camara' | 'inventario')}
            style={activeTab === tab.key ? tabActiveStyle(isDark) : tabInactiveStyle(T)}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 24, color: T.sec, fontFamily: FONT.body }}>Cargando producción…</div>
      ) : activeTab === 'lista' ? (
        <TabListaProduccion T={T} secciones={secciones} partidas={partidas} onChanged={cargarBase} />
      ) : activeTab === 'camara' ? (
        <TabOrdenacionCamara T={T} secciones={secciones} partidas={partidas} />
      ) : (
        <TabInventarioPermanente T={T} inventario={inventario} />
      )}
    </div>
  )
}

// ─── TAB: LISTA DE PRODUCCIÓN (plantilla fija) ─────────────────────────────────

function TabListaProduccion({ T, secciones, partidas, onChanged }: { T: ReturnType<typeof useTheme>['T']; secciones: Seccion[]; partidas: Partida[]; onChanged: () => void }) {
  const [entradas, setEntradas] = useState<EntradaProduccion[]>([])
  const [modalSecciones, setModalSecciones] = useState(false)
  const [modalPartidas, setModalPartidas] = useState(false)
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
          <button onClick={() => imprimirDesdePDF(construirListaPDF(paginas, semLabel))} style={btnGhost}><Printer size={15} /> Imprimir</button>
          <button onClick={() => descargarListaPDF(paginas, semLabel)} style={btnPrimary}><Download size={15} /> Descargar PDF</button>
        </div>
      </div>

      {/* VISTA PANTALLA */}
      <div className="vista-pantalla ficha-card">
        <div className="ficha-head">
          <span className="ficha-title">Lista de Producción</span>
          <span className="ficha-week">{semLabel}</span>
        </div>
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

  return (
    <>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, maxWidth: 560 }}>
          Una hoja A4 por lado de la cámara (izquierda / derecha), con todas sus baldas y los productos en grande para pegar en la puerta.
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => imprimirDesdePDF(construirCamaraPDF(grupos, partidas))} style={btnGhost}><Printer size={15} /> Imprimir</button>
          <button onClick={() => descargarCamaraPDF(grupos, partidas)} style={btnPrimary}><Download size={15} /> Descargar PDF</button>
        </div>
      </div>

      <div className="camara-wrap">
        {grupos.map((g, gi) => (
          <div key={gi} className="hoja-camara" style={{ breakAfter: gi < grupos.length - 1 ? 'page' : 'auto' }}>
            <div className="camara-lado-head">{g.titulo}</div>
            <div className="camara-cols" style={{ gridTemplateColumns: `repeat(${g.secs.length}, 1fr)` }}>
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
          </div>
        ))}
      </div>
    </>
  )
}

// ─── TAB: INVENTARIO PERMANENTE ────────────────────────────────────────────────

function TabInventarioPermanente({ T, inventario }: { T: ReturnType<typeof useTheme>['T']; inventario: InvItem[] }) {
  const ubis = useMemo(() => agruparInventario(inventario), [inventario])
  const [activa, setActiva] = useState(0)

  if (!ubis.length) {
    return <div style={{ padding: 36, textAlign: 'center', color: T.mut, fontFamily: FONT.body }}>Sin inventario todavía.</div>
  }
  const ubi = ubis[Math.min(activa, ubis.length - 1)]

  return (
    <>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="inv-pills">
          {ubis.map((u, i) => (
            <button key={u.nombre} onClick={() => setActiva(i)} className={`inv-pill ${i === activa ? 'on' : ''}`}>{u.nombre}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => imprimirDesdePDF(construirInventarioPDF(ubi))} style={btnGhost}><Printer size={15} /> Imprimir</button>
          <button onClick={() => descargarInventarioPDF(ubi)} style={btnGhost}><Download size={15} /> Esta ubicación</button>
          <button onClick={() => descargarInventarioTodosPDF(ubis)} style={btnPrimary}><FileDown size={15} /> Descargar todo</button>
        </div>
      </div>


      <div className="inv-hoja">
        <div className="inv-head">
          <span>{ubi.nombre}</span>
          <span className="inv-head-sub">INVENTARIO PERMANENTE · FECHA __ / __ / ____</span>
        </div>
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
      </div>
    </>
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
          <div style={{ fontFamily: FONT.heading, fontSize: 18, color: '#B01D23', letterSpacing: '1px', textTransform: 'uppercase' }}>Secciones</div>
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
                <button onClick={() => eliminar(s)} style={{ ...iconBtn(T), color: '#B01D23' }}><Trash2 size={13} /></button>
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
          <div style={{ fontFamily: FONT.heading, fontSize: 18, color: '#B01D23', letterSpacing: '1px', textTransform: 'uppercase' }}>Partidas</div>
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
                <button onClick={() => eliminar(p)} style={{ ...iconBtn(T), color: '#B01D23' }}><Trash2 size={13} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ESTILOS BOTONES / MODALES ─────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: '#B01D23', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--sl-text-secondary)', border: '0.5px solid var(--sl-border)', borderRadius: 8, padding: '8px 14px', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: '0.04em' }
const inputStyle = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ width: '100%', background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 8, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '8px 12px', outline: 'none' })
const lblStyle = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ display: 'block', fontFamily: FONT.heading, fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T.mut, marginBottom: 5 })
const iconBtn = (T: ReturnType<typeof useTheme>['T']): React.CSSProperties => ({ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 6, color: T.sec, cursor: 'pointer', padding: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' })
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const modalBox: React.CSSProperties = { borderRadius: 16, width: 560, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }

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
.prod-table th.dia-ini, .prod-table td.dia-ini { border-left: 3px solid #B01D23 !important; }

.th-partida { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; text-align: left; padding: 6px 8px; background: #B01D23; color: #fff; min-width: 120px; }
.th-partida-ini { position: sticky; left: 0; z-index: 2; }
.th-dia { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; text-align: center; padding: 5px 2px; background: #B01D23; color: #fff; }
.th-sub-empty { background: #8c161c; }
.th-sub { font-family: 'Oswald', sans-serif; font-size: 10px; font-weight: 600; text-align: center; padding: 2px 1px; color: #fff; }
.th-sub-hoy { background: #8c161c; }
.th-sub-ssp { background: #6e1116; color: #f0c9cb; }
.td-seccion { font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #B01D23; padding: 5px 8px; background: rgba(176,29,35,0.07); }
.td-bib { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8a1a22; padding: 3px 8px 3px 20px; background: rgba(176,29,35,0.04); }

.td-partida { font-family: 'Lexend', sans-serif; font-size: 14.5px; color: var(--text-primary); padding: 0 8px; white-space: nowrap; background: var(--bg-card); }
.td-partida-ini { position: sticky; left: 0; z-index: 1; }
.td-partida-fin { text-align: right; }
.td-celda { padding: 0; }
.td-celda-hoy { background: var(--bg-card); }
.td-celda-ssp { background: rgba(176,29,35,0.06); }
.celda-input { width: 100%; min-width: 34px; background: transparent; border: none; outline: none; font-family: 'Lexend', sans-serif; font-size: 15px; color: var(--text-primary); padding: 0 3px; text-align: center; }
.celda-ssp { color: var(--text-muted); }
.celda-print { display: none; }

.vista-impresion { display: none; }

/* Carteles cámara — preview en pantalla (1 columna) */
.camara-wrap { display: flex; flex-direction: column; gap: 22px; }
.hoja-camara { border: 2px solid #B01D23; border-radius: 12px; overflow: hidden; background: var(--bg-card); }
.camara-lado-head { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 30px; letter-spacing: 0.05em; text-transform: uppercase; color: #fff; background: #B01D23; padding: 14px 22px; }
.camara-cols { display: grid; gap: 0; }
.camara-balda { border-right: 1px solid var(--sl-border); padding: 0 0 10px 0; }
.camara-balda:last-child { border-right: none; }
.camara-balda-head { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.04em; text-transform: uppercase; color: #B01D23; padding: 10px 16px; border-bottom: 2px solid rgba(176,29,35,0.25); }
.camara-balda-list { list-style: none; margin: 0; padding: 10px 16px; }
.camara-balda-item { font-family: 'Lexend', sans-serif; font-size: 21px; line-height: 1.5; color: var(--text-primary); }
.camara-bib-head { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 19px; text-transform: uppercase; letter-spacing: 0.04em; color: #B01D23; margin-top: 6px; }
.camara-sep { height: 0; border-top: 2px solid #B01D23; margin: 8px 4px 8px 0; list-style: none; }

/* Inventario permanente — 2 columnas, stock entre paréntesis pegado al nombre, zona rayada para anotar */
.inv-pills { display: flex; gap: 7px; flex-wrap: wrap; }
.inv-pill { font-family: 'Oswald', sans-serif; letter-spacing: 0.03em; text-transform: uppercase; font-size: 12px; padding: 7px 14px; border-radius: 99px; border: 1px solid var(--sl-border); background: var(--bg-card); color: var(--text-secondary); cursor: pointer; white-space: nowrap; }
.inv-pill.on { background: #B01D23; border-color: #B01D23; color: #fff; }
.inv-mintag { display: inline-flex; align-items: center; background: #B01D23; color: #fff; font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 5px; }
.inv-hoja { border: 2px solid #B01D23; border-radius: 10px; overflow: hidden; background: var(--bg-card); }
.inv-head { background: rgba(176,29,35,0.10); color: #8a1a22; font-family: 'Oswald', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; font-size: 24px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #B01D23; }
.inv-head-sub { font-size: 13px; font-weight: 500; }
.inv-cats { column-count: 2; column-gap: 0; }
.inv-cat { break-inside: avoid; border-right: 1px solid var(--sl-border); }
.inv-cat-head { font-family: 'Oswald', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; font-size: 14px; color: #8a1a22; background: rgba(176,29,35,0.06); padding: 7px 14px; border-bottom: 2px solid rgba(176,29,35,0.30); }
.inv-row { display: flex; align-items: stretch; border-bottom: 1px solid var(--sl-border); min-height: 38px; }
.inv-name { flex: 0 0 auto; display: flex; align-items: center; white-space: nowrap; padding: 1px 12px; font-family: 'Lexend', sans-serif; font-size: 24px; font-weight: 500; color: var(--text-primary); }
.inv-min-inline { margin-left: 8px; color: #B01D23; font-family: 'Oswald', sans-serif; font-weight: 700; }
.inv-write { flex: 1 1 auto; align-self: flex-end; border-bottom: 1.5px solid var(--sl-border); margin: 0 12px 8px 6px; }
@media (max-width: 820px) { .inv-cats { column-count: 1; } .inv-cat { border-right: none; } .inv-name { font-size: 21px; } }

/* ───────── IMPRESIÓN ───────── */
@media print {
  @page { size: A4 landscape; }
  html, body { background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body * { visibility: hidden; }
  .vista-impresion, .vista-impresion *, .camara-wrap, .camara-wrap * { visibility: visible; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .vista-pantalla, .no-print { display: none !important; }

  /* ---- Lista de producción ---- */
  .lista-print { display: block; position: absolute; left: 0; top: 0; width: 100%; color: #111; font-family: 'Lexend', sans-serif; }
  .lista-print .hoja { width: 100%; }
  .print-head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #9a3b42; }
  .print-title { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 18px; text-transform: uppercase; letter-spacing: 0.05em; color: #9a3b42; }
  .print-week { font-family: 'Oswald', sans-serif; font-size: 12px; text-transform: uppercase; color: #555; }
  .print-pag { margin-left: auto; font-family: 'Oswald', sans-serif; font-size: 12px; text-transform: uppercase; color: #555; }

  .prod-table-print { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 12px; }
  .prod-table-print th, .prod-table-print td { border-right: 1px solid #c9c9c9 !important; border-bottom: 1px solid #c9c9c9 !important; }
  .prod-table-print th.dia-ini, .prod-table-print td.dia-ini { border-left: 2.5px solid #cf7b81 !important; }
  .th-seccion-print { font-family: 'Oswald', sans-serif; font-size: 12.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; text-align: left; color: #8a1a22 !important; background: #f0d8da !important; padding: 5px 8px !important; border: 1px solid #d9b3b6 !important; }
  .prod-table-print .th-partida { background: #f5e2e3 !important; color: #8a1a22 !important; padding: 4px 6px !important; position: static !important; font-size: 10.5px; min-width: 0; }
  .prod-table-print .th-dia { background: #f5e2e3 !important; color: #8a1a22 !important; padding: 3px 2px !important; font-size: 10.5px; }
  .prod-table-print .th-sub-empty { background: #f0d8da !important; position: static !important; }
  .prod-table-print .th-sub-hoy { background: #f0d8da !important; color: #8a1a22 !important; font-size: 9.5px; }
  .prod-table-print .th-sub-ssp { background: #e6c7ca !important; color: #7a1419 !important; font-size: 9.5px; }
  .prod-table-print .td-partida { color: #111 !important; background: #fff !important; padding: 1px 6px !important; position: static !important; font-size: 13px; }
  .prod-table-print .td-bib { color: #8a1a22 !important; background: #f7eeef !important; font-size: 11.5px; padding: 1px 6px 1px 18px !important; }
  .prod-table-print .td-celda { padding: 0 !important; height: 20px; }
  .prod-table-print .td-celda-hoy { background: #fff !important; }
  .prod-table-print .td-celda-ssp { background: #f7eeef !important; }
  .prod-table-print .celda-print { display: inline !important; color: #111 !important; font-size: 13px; padding: 0 2px; }

  /* ---- Ordenación de cámara: 1 hoja A4 horizontal por lado ---- */
  .camara-wrap { display: block; position: absolute; left: 0; top: 0; width: 100%; }
  .hoja-camara { border: 3px solid #B01D23 !important; border-radius: 8px; overflow: hidden; page-break-after: always; break-after: page; height: 176mm; display: flex; flex-direction: column; }
  .hoja-camara:last-child { page-break-after: auto; break-after: auto; }
  .camara-lado-head { font-size: 40px !important; background: #f0d8da !important; color: #8a1a22 !important; border-bottom: 3px solid #B01D23 !important; padding: 12px 22px !important; flex: 0 0 auto; }
  .camara-cols { display: grid; flex: 1 1 auto; gap: 0; min-height: 0; }
  .camara-balda { border-right: 2px solid #d9b3b6 !important; padding: 0; display: flex; flex-direction: column; min-height: 0; }
  .camara-balda:last-child { border-right: none; }
  .camara-balda-head { font-size: 22px !important; color: #8a1a22 !important; background: #faf0f1 !important; border-bottom: 2px solid #e0bcc0 !important; padding: 7px 14px !important; flex: 0 0 auto; }
  .camara-balda-list { padding: 8px 16px !important; flex: 1 1 auto; }
  .camara-balda-item { font-size: 30px !important; line-height: 1.4 !important; color: #111 !important; }
  .camara-bib-head { font-size: 25px !important; color: #8a1a22 !important; margin-top: 4px; }
  .camara-sep { border-top: 3px solid #B01D23 !important; margin: 6px 6px 6px 0 !important; }
}
`
